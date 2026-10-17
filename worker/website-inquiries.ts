import { z } from 'zod';
import type { Database } from './api';
import type { AccountUser } from '../src/domain/services';
import { deliverMail, type LeadSettings } from './leads';

const productionOrigins = ['https://www.myintelhome.com', 'https://myintelhome.com'];
// Exact project preview origins only. Never allow the shared *.vercel.app suffix.
export function websitePreviewOrigins(value = '') {
  return value.split(',').map(s => s.trim()).filter(s => {
    try { const u = new URL(s); return u.origin === s && u.protocol === 'https:' && /^my-intel-website-[a-z0-9-]+\.vercel\.app$/.test(u.hostname); } catch { return false; }
  });
}
const text = (max: number) => z.string().trim().min(1).max(max);
const phone = z.string().trim().max(30).refine(s => !s || (/^[+()\d .-]+$/.test(s) && s.replace(/\D/g, '').length >= 10 && s.replace(/\D/g, '').length <= 15));
const email = z.union([z.literal(''), z.email().max(254)]).transform(s => s.toLowerCase());
const common = { idempotencyKey: z.uuid(), name: text(100), email: email.default(''), phone: phone.default(''), message: text(3000), contactConsent: z.literal(true), website: z.string().max(200).default('') };
const inquirySchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('contact'), relationship: z.enum(['myself', 'parent_or_relative', 'someone_else']), postalCode: z.string().regex(/^$|^\d{5}$/).default('') }).strict(),
  z.object({ ...common, type: z.literal('care_company'), companyName: text(150), role: text(100), clientCount: z.enum(['', '1-10', '11-50', '51-200', '200+']).default('') }).strict(),
]).refine(v => v.type === 'care_company' ? !!v.email : !!(v.email || v.phone));
type Inquiry = z.infer<typeof inquirySchema>;
export const inquiryLabel = (type: string) => type === 'care_company' ? 'Care company' : 'Website contact';
const relationshipLabel = { myself: 'Myself', parent_or_relative: 'A parent or relative', someone_else: 'Someone else' };

async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
async function limited(db: Database, request: Request, salt: string) {
  // Vercel overwrites X-Forwarded-For. Other adapters must supply a trusted proxy value.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || 'unknown';
  const window = Math.floor(Date.now() / 900000);
  const key = await digest(`${salt}:website:${window}:${ip}`);
  const result = await db.prepare('INSERT INTO website_inquiry_limits(key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 WHERE attempts<10').bind(key, window).run();
  await db.prepare('DELETE FROM website_inquiry_limits WHERE window<?').bind(window - 2).run();
  return result.meta.changes !== 1;
}
async function readInput(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Error('content type');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length; if (size > 16000) { await reader.cancel(); throw Error('size'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function staffText(v: Inquiry, origin: string, now: string) {
  return [
    `New MyIntel item: ${inquiryLabel(v.type)}`, `Name: ${v.name}`,
    ...(v.type === 'care_company' ? [`Company: ${v.companyName}`, `Role: ${v.role}`, `Approximate clients: ${v.clientCount || 'Not provided'}`] : [`Help is for: ${relationshipLabel[v.relationship]}`, `ZIP: ${v.postalCode || 'Not provided'}`]),
    `Email: ${v.email || 'Not provided'}`, `Phone: ${v.phone || 'Not provided'}`, `Message:\n${v.message}`,
    `Permission for MyIntel to contact this person: yes. Recorded: ${now}`,
    `Open Operations: ${new URL(`/?view=operations&item=${v.idempotencyKey}`, origin).href}`,
    'This is a website inquiry. No appointment is booked.',
  ].join('\n');
}

/** Public, credential-free intake. No submitted data or internal identifiers leave this route. */
export async function websiteInquiryRoute(request: Request, db: Database | undefined, settings: LeadSettings) {
  const origin = request.headers.get('origin') || '';
  const allowed = [...productionOrigins, ...(settings.websiteOrigins || [])].includes(origin);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
  if (allowed) headers.set('Access-Control-Allow-Origin', origin);
  const reply = (ok: boolean, status: number) => Response.json({ ok }, { status, headers });
  if (!allowed) return reply(false, 403);
  if (request.method === 'OPTIONS') {
    const requested = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (request.headers.get('access-control-request-method') !== 'POST' || requested.some(s => s !== 'content-type')) return reply(false, 403);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return reply(false, 405); }
  if (!settings.enabled || !db || !settings.rateLimitSalt || !settings.origin?.startsWith('https://')) return reply(false, 503);
  try {
    if (await limited(db, request, settings.rateLimitSalt)) { headers.set('Retry-After', '900'); return reply(false, 429); }
    let raw: unknown;
    try { raw = await readInput(request); } catch { return reply(false, 400); }
    const result = inquirySchema.safeParse(raw);
    if (!result.success) return reply(false, 400);
    const v = result.data;
    if (v.website) return reply(true, 200); // Honeypot: neither store nor notify.
    const hash = await digest(JSON.stringify(v)), now = new Date().toISOString();
    const recipient = settings.staffEmail || 'austin@myintelhome.com';
    const status = settings.deliveryEnabled && (settings.allowedEmails === undefined || settings.allowedEmails.includes(recipient.toLowerCase())) ? 'pending' : 'disabled';
    // Inquiry, audit entry and notification are one transaction. Retried keys cannot rewrite a lead.
    await db.batch([
      db.prepare('INSERT INTO website_inquiries(id,type,name,email,phone,relationship,postal_code,company_name,role,client_count,message,consent_at,payload_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
        .bind(v.idempotencyKey, v.type, v.name, v.email, v.phone, v.type === 'contact' ? v.relationship : '', v.type === 'contact' ? v.postalCode : '', v.type === 'care_company' ? v.companyName : '', v.type === 'care_company' ? v.role : '', v.type === 'care_company' ? v.clientCount : '', v.message, now, hash, now),
      db.prepare("INSERT INTO website_inquiry_events(id,inquiry_id,actor_id,action,created_at) SELECT ?,?,'website','submitted',? WHERE changes()=1").bind(crypto.randomUUID(), v.idempotencyKey, now),
      db.prepare("INSERT INTO lead_mail(id,owner_id,kind,recipient,subject,text,status,created_at) SELECT ?,id,'staff',?,?,?,?,? FROM website_inquiries WHERE id=? AND payload_hash=? ON CONFLICT(id) DO NOTHING")
        .bind(`staff-website:${v.idempotencyKey}`, recipient, `MyIntel: ${inquiryLabel(v.type)}`, staffText(v, settings.origin, now), status, now, v.idempotencyKey, hash),
    ]);
    const row = await db.prepare('SELECT payload_hash FROM website_inquiries WHERE id=?').bind(v.idempotencyKey).first<{ payload_hash: string }>();
    if (row?.payload_hash !== hash) return reply(false, 409);
    await deliverMail(db, settings, `staff-website:${v.idempotencyKey}`);
    return reply(true, 200);
  } catch { return reply(false, 503); }
}

export async function websiteInquiryAdminRoute(request: Request, db: Database, user: AccountUser | null) {
  const path = new URL(request.url).pathname;
  if (path !== '/api/admin/website-inquiries' && !/^\/api\/admin\/website-inquiries\/[\w-]+$/.test(path)) return null;
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!user) return reply({ error: 'Sign in to continue.' }, 401);
  if (!user.isAdmin) return reply({ error: 'MyIntel staff access required.' }, 403);
  if (path === '/api/admin/website-inquiries' && request.method === 'GET') return reply({ inquiries: (await db.prepare('SELECT id,type,name,email,phone,relationship,postal_code,company_name,role,client_count,message,consent_at,created_at,coordinator_id,coordinator_name,closed_at FROM website_inquiries ORDER BY closed_at IS NOT NULL,created_at ASC LIMIT 200').all()).results });
  const id = path.split('/')[4];
  if (id && request.method === 'PATCH') {
    const v = z.object({ action: z.enum(['claim', 'release', 'close']) }).strict().parse(await readInput(request));
    const sql = v.action === 'claim' ? 'UPDATE website_inquiries SET coordinator_id=?,coordinator_name=? WHERE id=? AND closed_at IS NULL AND coordinator_id IS NULL' : v.action === 'release' ? 'UPDATE website_inquiries SET coordinator_id=NULL,coordinator_name=NULL WHERE id=? AND coordinator_id=? AND closed_at IS NULL' : 'UPDATE website_inquiries SET closed_at=? WHERE id=? AND coordinator_id=? AND closed_at IS NULL';
    const args = v.action === 'claim' ? [user.id, user.name, id] : v.action === 'release' ? [id, user.id] : [new Date().toISOString(), id, user.id];
    const r = await db.batch([
      db.prepare(sql).bind(...args),
      db.prepare('INSERT INTO website_inquiry_events(id,inquiry_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(), id, user.id, v.action, new Date().toISOString()),
    ]);
    return reply(r[0]?.meta.changes ? { updated: true } : { error: 'This inquiry changed. Refresh and try again.' }, r[0]?.meta.changes ? 200 : 409);
  }
  return reply({ error: 'This action was not found.' }, 404);
}
