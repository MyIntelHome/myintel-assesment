import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SqliteTestDatabase } from './sqlite-test-db';
import { productionApi } from '../../production/app';
import { handleApi, type Env } from '../../worker/api';
import { deliverMail } from '../../worker/leads';
import { websiteInquiryRoute, websitePreviewOrigins } from '../../worker/website-inquiries';

let db: SqliteTestDatabase, env: Env;
const preview = 'https://my-intel-website-git-feature-website-inquiry-forms-austin-8620s-projects.vercel.app';
const config = { enabled: true, deliveryEnabled: true, origin: 'https://homecheck.test', rateLimitSalt: 'test-only-salt', websiteOrigins: [preview], staffEmail: 'austin@myintelhome.com', allowedEmails: ['austin@myintelhome.com'], sender: 'plans@example.test', apiKey: 'not-a-real-key' };
function values(type = 'contact') {
  return { type, idempotencyKey: crypto.randomUUID(), name: 'Test Person', email: type === 'contact' ? '' : 'test@example.test', phone: '720 555 0100', message: 'Synthetic website form test. No real client.', contactConsent: true, website: '', ...(type === 'contact' ? { relationship: 'parent_or_relative', postalCode: '80202' } : { companyName: 'Test Care Company', role: 'Owner', clientCount: '11-50' }) };
}
function request(body: unknown = values(), origin = 'https://www.myintelhome.com', method = 'POST', ip = '192.0.2.1') {
  return new Request('https://homecheck.test/api/website-inquiry', { method, headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': ip }, body: method === 'POST' ? JSON.stringify(body) : undefined });
}
const call = (v = values(), origin?: string) => websiteInquiryRoute(request(v, origin), db, env.LEADS!);
function admin(path: string, user = 'staff', method = 'GET', data?: unknown) {
  return handleApi(new Request('https://homecheck.test' + path, { method, headers: { origin: 'https://homecheck.test', 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined }), env, async () => user ? { id: user, email: `${user}@example.test`, emailVerified: true, name: user } : null);
}
beforeEach(() => {
  db = new SqliteTestDatabase();
  env = { DB: db, APP_ORIGIN: 'https://homecheck.test', ASSETS: { fetch: async () => new Response() }, MYINTEL_ADMIN_EMAIL: 'staff@example.test', LEADS: { ...config } };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'test-provider-message' })));
});
afterEach(() => { db.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['contact', 'care_company'])('captures %s anonymously, queues only staff mail and returns no submitted data', async type => {
  const v = values(type), r = await call(v);
  expect(r.status).toBe(200); expect(await r.json()).toEqual({ ok: true });
  expect(r.headers.get('access-control-allow-origin')).toBe('https://www.myintelhome.com');
  expect(r.headers.get('cache-control')).toBe('no-store');
  const row = await db.prepare('SELECT * FROM website_inquiries').first();
  expect(row).toMatchObject({ type, name: v.name, message: v.message }); expect(row?.consent_at).toBeTruthy();
  const mail = await db.prepare('SELECT * FROM lead_mail').all(); expect(mail.results).toHaveLength(1);
  expect(mail.results[0]).toMatchObject({ recipient: config.staffEmail, kind: 'staff', status: 'accepted', text: '' });
  const send = vi.mocked(fetch); expect(send).toHaveBeenCalledTimes(1);
  const sent = JSON.parse(String(send.mock.calls[0]![1]?.body));
  expect(sent.to).toEqual([config.staffEmail]);
  expect(sent.text).toContain(type === 'contact' ? 'Website contact' : 'Care company');
  expect(sent.text).toContain(v.message); expect(sent.text).toContain(`?view=operations&item=${v.idempotencyKey}`);
});
it('keeps the production origin check for other routes and never resolves a public form identity', async () => {
  const identity = vi.fn(async () => null), route = productionApi(env, { identity, route: async () => new Response() });
  expect((await route(request())).status).toBe(200); expect(identity).not.toHaveBeenCalled();
  expect((await route(new Request('https://homecheck.test/api/cases', { method: 'PUT', headers: { origin: preview } }))).status).toBe(403);
  expect((await route(new Request('https://evil.test/api/website-inquiry', { method: 'POST', headers: { origin: preview } }))).status).toBe(403);
});
it('accepts exact website origins and preflights, rejects lookalikes, all other Vercel projects and credentials', async () => {
  for (const origin of ['https://myintelhome.com', preview]) expect((await call(values(), origin)).status).toBe(200);
  for (const origin of ['', 'null', 'https://evil.test', 'https://myintelhome.com.evil.test', 'https://my-intel-website-evil.vercel.app', 'http://www.myintelhome.com']) {
    const r = await call(values(), origin); expect(r.status).toBe(403); expect(r.headers.has('access-control-allow-origin')).toBe(false);
  }
  const pre = request(undefined, preview, 'OPTIONS'); pre.headers.set('access-control-request-method', 'POST'); pre.headers.set('access-control-request-headers', 'content-type');
  const r = await websiteInquiryRoute(pre, db, config); expect(r.status).toBe(204); expect(r.headers.has('access-control-allow-credentials')).toBe(false);
  pre.headers.set('access-control-request-headers', 'authorization'); expect((await websiteInquiryRoute(pre, db, config)).status).toBe(403);
  expect(websitePreviewOrigins(`${preview},https://other.vercel.app,${preview}/path,https://www.myintelhome.com,http://my-intel-website-test.vercel.app`)).toEqual([preview]);
});
it('stores no lead when capture is off, delivery is allowlist-limited, or the honeypot is filled', async () => {
  env.LEADS = { ...config, enabled: false }; const off = await call(); expect(off.status).toBe(503); expect(await off.json()).toEqual({ ok: false });
  env.LEADS = { ...config }; expect((await call({ ...values(), website: 'spam' })).status).toBe(200);
  expect((await db.prepare('SELECT * FROM website_inquiries').all()).results).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
  env.LEADS = { ...config, allowedEmails: [] }; expect((await call()).status).toBe(200);
  expect((await db.prepare('SELECT status FROM lead_mail').first())?.status).toBe('disabled'); expect(fetch).not.toHaveBeenCalled();
});
it.each([
  { contactConsent: false }, { contactConsent: 'true' }, { name: '' }, { email: '', phone: '' }, { email: 'bad' }, { postalCode: 'bad' }, { phone: 'x'.repeat(15) }, { message: 'x'.repeat(3001) }, { relationship: 'unknown' }, { recipient: 'evil@example.test' },
])('rejects invalid or extra fields %j', async changes => {
  expect((await call({ ...values(), ...changes } as ReturnType<typeof values>)).status).toBe(400);
  expect((await db.prepare('SELECT * FROM website_inquiries').all()).results).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
});
it('requires company, role and email for company inquiries and allows email-only family inquiries', async () => {
  for (const changes of [{ companyName: '' }, { role: '' }, { email: '' }, { clientCount: '500' }]) expect((await call({ ...values('care_company'), ...changes })).status).toBe(400);
  expect((await call({ ...values(), email: 'test@example.test', phone: '' })).status).toBe(200);
});
it('bounds malformed and oversized input without exposing parser or database details', async () => {
  const req = request(); req.headers.set('content-type', 'text/plain'); expect((await websiteInquiryRoute(req, db, config)).status).toBe(400);
  const huge = await call({ ...values(), message: 'x'.repeat(17000) }); expect(await huge.json()).toEqual({ ok: false });
  vi.spyOn(db, 'prepare').mockImplementation(() => { throw Error('private database secret'); }); expect(await (await call()).text()).toBe('{"ok":false}');
});
it('counts attempts durably per IP, has a bounded window, and never stores the raw IP', async () => {
  for (let i = 0; i < 10; i++) expect((await call({ ...values(), contactConsent: false })).status).toBe(400);
  const limited = await call(); expect(limited.status).toBe(429); expect(limited.headers.get('retry-after')).toBe('900');
  expect(JSON.stringify((await db.prepare('SELECT * FROM website_inquiry_limits').all()).results)).not.toContain('192.0.2.1');
  expect((await websiteInquiryRoute(request(values(), undefined, 'POST', '192.0.2.2'), db, config)).status).toBe(200);
});
it('does not change an inquiry or send duplicate mail when the browser retries', async () => {
  const v = values(); await call(v); await call(v);
  expect(fetch).toHaveBeenCalledTimes(1); expect((await db.prepare('SELECT * FROM website_inquiries').all()).results).toHaveLength(1);
  expect((await db.prepare('SELECT * FROM website_inquiry_events').all()).results).toHaveLength(1);
  expect((await call({ ...v, message: 'Changed content' })).status).toBe(409); expect(fetch).toHaveBeenCalledTimes(1);
});
it('reuses the durable lease and Resend idempotency key for failures, staff retry and expired sends', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
  const v = values(); expect((await call(v)).status).toBe(200); await call(v); expect(fetch).toHaveBeenCalledTimes(1);
  await db.prepare('UPDATE lead_mail SET lease_until=NULL').run();
  vi.mocked(fetch).mockResolvedValue(Response.json({ id: 'retry-provider-id' }));
  expect((await admin('/api/admin/mail-retry', 'staff', 'POST', { id: `staff-website:${v.idempotencyKey}` })).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(new Headers(vi.mocked(fetch).mock.calls[0]![1]?.headers).get('Idempotency-Key')).toBe(new Headers(vi.mocked(fetch).mock.calls[1]![1]?.headers).get('Idempotency-Key'));
  await deliverMail(db, config, `staff-website:${v.idempotencyKey}`); expect(fetch).toHaveBeenCalledTimes(2);
  await db.prepare("UPDATE lead_mail SET status='pending',lease_until=NULL,created_at=?").bind(new Date(Date.now() - 24 * 3600000).toISOString()).run();
  expect(await deliverMail(db, config, `staff-website:${v.idempotencyKey}`)).toBe('needs_review'); expect(fetch).toHaveBeenCalledTimes(2);
});
it('keeps Operations private and audits coordinator work', async () => {
  const v = values(); await call(v);
  expect((await admin('/api/admin/website-inquiries', '')).status).toBe(401); expect((await admin('/api/admin/website-inquiries', 'family')).status).toBe(403);
  const list = await (await admin('/api/admin/website-inquiries')).json(); expect(list.inquiries[0]).toMatchObject({ type: 'contact', message: v.message }); expect(list.inquiries[0]).not.toHaveProperty('payload_hash');
  for (const action of ['claim', 'release', 'claim', 'close']) expect((await admin(`/api/admin/website-inquiries/${v.idempotencyKey}`, 'staff', 'PATCH', { action })).status).toBe(200);
  expect((await db.prepare('SELECT action FROM website_inquiry_events').all()).results.map(r => r.action)).toEqual(['submitted', 'claim', 'release', 'claim', 'close']);
});
it('only one concurrent notification worker can acquire the website mail lease',async()=>{
 vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:503}));
 const v=values();await call(v);await db.prepare('UPDATE lead_mail SET lease_until=NULL').run();
 vi.mocked(fetch).mockClear();vi.mocked(fetch).mockResolvedValue(Response.json({id:'claimed-once'}));
 await Promise.all([deliverMail(db,config,`staff-website:${v.idempotencyKey}`),deliverMail(db,config,`staff-website:${v.idempotencyKey}`)]);
 expect(fetch).toHaveBeenCalledTimes(1);expect((await db.prepare('SELECT status FROM lead_mail').first())?.status).toBe('accepted');
});
