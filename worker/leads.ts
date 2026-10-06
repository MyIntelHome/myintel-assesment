import {z} from 'zod';
import type {Database,Statement} from './api';
import type {AccountUser} from '../src/domain/services';
import {savedCaseSchema} from '../src/lib/case-validation';
import {activeHomeSpaces,familyTemplateFor,profileLines} from '../src/domain/home-profile';
import {buildFamilyReport,reportToPlainText} from '../src/domain/family-report';
import {homeSummaryText} from '../src/domain/home-report-summary';
import {homeActionsText} from '../src/domain/home-actions';
import {FUNNEL_EVENTS,TIMING_BUCKETS,validShopUrl} from '../src/domain/lead-config';
export interface LeadSettings { enabled:boolean; deliveryEnabled:boolean; shopUrl?:string; staffEmail?:string; sender?:string; apiKey?:string; allowedEmails?:string[] }
export const leadSettings=(env:Record<string,string|undefined>):LeadSettings=>({
 enabled:env.VERCEL_ENV==='preview'&&env.MYINTEL_LEAD_PREVIEW==='true',
 deliveryEnabled:env.VERCEL_ENV==='preview'&&env.MYINTEL_LEAD_PREVIEW==='true'&&env.MYINTEL_EMAIL_PREVIEW==='true',
 shopUrl:validShopUrl(env.SHOP_URL),staffEmail:env.MYINTEL_STAFF_NOTIFICATION_EMAIL||'info@myintelhome.com',sender:env.MYINTEL_EMAIL_FROM,apiKey:env.RESEND_API_KEY,allowedEmails:(env.MYINTEL_PREVIEW_EMAIL_ALLOWLIST??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),
});
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function input(request:Request,max:number):Promise<{value?:unknown;error?:Response}>{
 if(!request.headers.get('content-type')?.startsWith('application/json'))return {error:reply({error:'Use this form to continue.'},415)};
 const reader=request.body?.getReader();let bytes=0;const chunks:Uint8Array[]=[];
 if(reader)for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();return {error:reply({error:'This form is too large.'},413)}}chunks.push(value)}
 const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 try{return {value:JSON.parse(new TextDecoder().decode(data))}}catch{return {error:reply({error:'Check the form and try again.'},400)}}
}
export function countStatement(db:Database,event:string,bucket=''):Statement{return db.prepare('INSERT INTO funnel_counts(day,event,bucket,total) VALUES (?,?,?,1) ON CONFLICT(day,event,bucket) DO UPDATE SET total=total+1').bind(new Date().toISOString().slice(0,10),event,bucket)}
export function planSummary(input:unknown){
 const home=savedCaseSchema.parse(input);
 if(home.audience!=='family'||home.deletedAt)throw new Error('Only an active home check can be saved as a plan.');
 const spaces=activeHomeSpaces(home.spaces??[]);if(!spaces.length)throw new Error('Choose at least one used space before saving your plan.');
 const report=buildFamilyReport(spaces.map(s=>({id:s.id,label:s.level?`${s.label}, level ${s.level}`:s.label,template:familyTemplateFor(s,home.homeProfile,home.familyAnswers)})),home.familyAnswers??{});
 return [...profileLines(home.homeProfile),'',homeSummaryText(report,home.homeProfile),reportToPlainText(report),homeActionsText(report,home.homeProfile)].join('\n').replaceAll('—',',');
}
export function staffMessage(input:{name:string;email:string;phone:string;postalCode:string;contactMethod:string;type:string;id:string},origin:string){
 return `New MyIntel item: ${input.type}\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone||'Not provided'}\nContact preference: ${input.contactMethod}\nZIP: ${input.postalCode||'Not provided'}\nOpen Operations: ${origin}/?view=operations&item=${encodeURIComponent(input.id)}\nReview consent in Operations before contacting this person. No appointment is booked.`;
}
export function mailStatement(db:Database,settings:LeadSettings,input:{id:string;ownerId:string;kind:string;recipient:string;subject:string;text:string}){
 const source=input.kind==='plan'||input.id.startsWith('staff-plan:')?'saved_plans':'service_requests';
 const sourceId=input.id.slice(input.id.indexOf(':')+1);
 return db.prepare(`INSERT INTO lead_mail(id,owner_id,kind,recipient,subject,text,status,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${source} WHERE id=? AND user_id=?) ON CONFLICT(id) DO NOTHING`).bind(input.id,input.ownerId,input.kind,input.recipient,input.subject,input.text,settings.deliveryEnabled&&settings.allowedEmails?.includes(input.recipient.toLowerCase())?'pending':'disabled',new Date().toISOString(),sourceId,input.ownerId);
}
export function emailHtml(text:string){const escaped=text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');return `<html><body style="font-family:Arial,sans-serif;font-size:18px;line-height:1.6;color:#18394a"><h1>Your MyIntel HomeCheck plan</h1><div style="white-space:pre-wrap">${escaped}</div></body></html>`}
/** A durable lease prevents concurrent sends. Provider acceptance is not inbox delivery. */
export async function deliverMail(db:Database,settings:LeadSettings,id:string,send:typeof fetch=fetch){
 if(!settings.deliveryEnabled||!settings.apiKey||!settings.sender)return 'disabled';
 const now=new Date(),cutoff=new Date(now.getTime()-23*3600000).toISOString();
 await db.prepare("UPDATE lead_mail SET status='needs_review' WHERE id=? AND status='pending' AND created_at<=?").bind(id,cutoff).run();
 const claimed=await db.prepare("UPDATE lead_mail SET lease_until=? WHERE id=? AND status='pending' AND created_at>? AND (lease_until IS NULL OR lease_until<?)").bind(new Date(now.getTime()+60000).toISOString(),id,cutoff,now.toISOString()).run();
 if(!claimed.meta.changes)return (await db.prepare('SELECT status FROM lead_mail WHERE id=?').bind(id).first<{status:string}>())?.status??'pending';
 const row=await db.prepare('SELECT * FROM lead_mail WHERE id=?').bind(id).first<{recipient:string;subject:string;text:string;kind:string}>();if(!row)return 'pending';
 if(!settings.allowedEmails?.includes(row.recipient.toLowerCase()))return 'disabled';
 try{
  const r=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${settings.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`homecheck/${id}`},body:JSON.stringify({from:settings.sender,to:[row.recipient],subject:row.subject,text:row.text,html:emailHtml(row.text)}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)return 'pending';const data=await r.json();if(typeof data.id!=='string')return 'pending';
  await db.batch([db.prepare("UPDATE lead_mail SET status='accepted',accepted_at=?,text='' WHERE id=? AND status='pending'").bind(new Date().toISOString(),id),...(row.kind==='plan'?[db.prepare("INSERT INTO funnel_counts(day,event,bucket,total) SELECT ?,'plan_emailed','',1 WHERE changes()=1 ON CONFLICT(day,event,bucket) DO UPDATE SET total=total+1").bind(new Date().toISOString().slice(0,10))]:[])]);
  return 'accepted';
 }catch{return 'pending'}
}
const planSchema=z.object({idempotencyKey:z.uuid(),caseId:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),postalCode:z.string().regex(/^$|^\d{5}$/),phone:z.string().trim().max(30).refine(s=>!s||s.replace(/\D/g,'').length>=10),contactConsent:z.boolean(),shareConsent:z.boolean(),emailConsent:z.boolean()}).strict();
export async function leadRoute(request:Request,db:Database,user:AccountUser|null,settings:LeadSettings,origin:string){
 const {pathname:path}=new URL(request.url),method=request.method;
 if(path==='/api/lead-config'&&method==='GET')return reply({enabled:settings.enabled,deliveryEnabled:settings.deliveryEnabled,shopUrl:validShopUrl(settings.shopUrl)});
 if(!settings.enabled)return null;
 if(path==='/api/funnel'&&method==='POST'){
  const data=await input(request,300);if(data.error)return data.error;
  const v=z.object({event:z.enum(['check_started','daily_life_finished','room_finished','results_viewed']),bucket:z.enum(TIMING_BUCKETS).optional()}).strict().safeParse(data.value);
  if(!v.success || (v.data.bucket&&v.data.event!=='results_viewed'))return reply({error:'Event not accepted.'},400);
  await db.batch([countStatement(db,v.data.event,v.data.bucket??''),db.prepare('DELETE FROM funnel_counts WHERE day<?').bind(new Date(Date.now()-31*86400000).toISOString().slice(0,10))]);return reply({counted:true});
 }
 if(!['/api/plans','/api/admin/plans','/api/admin/funnel','/api/admin/mail-retry'].includes(path)&&!path.startsWith('/api/admin/plans/')&&!path.startsWith('/api/plans/'))return null;
 if(!user)return reply({error:'Verify your email before saving.'},401);
 if(path==='/api/plans'&&method==='POST'){
  const data=await input(request,4000);if(data.error)return data.error;
  const parsed=planSchema.safeParse(data.value);if(!parsed.success)return reply({error:'Check your name and contact details.'},400);const v=parsed.data;
  let row=await db.prepare('SELECT user_id,email_consent FROM saved_plans WHERE id=?').bind(v.idempotencyKey).first<{user_id:string;email_consent:number}>();
  if(row&&row.user_id!==user.id)return reply({error:'Please reopen this form.'},409);
  if(!row){
   const recent=await db.prepare('SELECT COUNT(*) AS total FROM saved_plans WHERE user_id=? AND created_at>?').bind(user.id,new Date(Date.now()-86400000).toISOString()).first<{total:number}>();if((recent?.total??0)>=10)return reply({error:'Review your saved plans before sending more.'},429);
   const archive=await db.prepare('SELECT payload FROM case_archives WHERE user_id=?').bind(user.id).first<{payload:string}>();
   const home=archive?JSON.parse(archive.payload).cases.find((c:{id:string})=>c.id===v.caseId):null;let summary;
   try{summary=planSummary(home)}catch{return reply({error:'Save your home check to your account before saving this plan.'},400)}
   const text=`Hello ${v.name},\n\nHere is the plan you asked MyIntel to email. It includes your home and daily-life answers. Only you decide who to share it with.\n\n${summary}\n\nThis is a self-guided home check, not a professional assessment. It cannot confirm a home is safe.\nOpen your account: ${origin}/?view=assessments`;
   await db.batch([
    db.prepare('INSERT INTO saved_plans(id,user_id,case_id,name,email,postal_code,phone,contact_consent,share_consent,email_consent,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.idempotencyKey,user.id,v.caseId,v.name,user.email,v.postalCode,v.phone,+v.contactConsent,+v.shareConsent,+v.emailConsent,summary,new Date().toISOString()),
    db.prepare("INSERT INTO saved_plan_events(id,plan_id,actor_id,action,created_at) SELECT ?,?,?,'saved',? WHERE changes()=1").bind(crypto.randomUUID(),v.idempotencyKey,user.id,new Date().toISOString()),
    ...(v.emailConsent?[mailStatement(db,settings,{id:`plan:${v.idempotencyKey}`,ownerId:user.id,kind:'plan',recipient:user.email,subject:'Your MyIntel HomeCheck plan',text})]:[]),
    ...(v.contactConsent?[mailStatement(db,settings,{id:`staff-plan:${v.idempotencyKey}`,ownerId:user.id,kind:'staff',recipient:settings.staffEmail||'info@myintelhome.com',subject:'MyIntel: plan saved with contact permission',text:staffMessage({name:v.name,email:user.email,phone:v.phone,postalCode:v.postalCode,contactMethod:'email',type:'Plan saved',id:v.idempotencyKey},origin)})]:[]),
   ]);row={user_id:user.id,email_consent:+v.emailConsent};
  }
  const owner=await db.prepare('SELECT user_id,email_consent FROM saved_plans WHERE id=?').bind(v.idempotencyKey).first<{user_id:string;email_consent:number}>();
  if(owner?.user_id!==user.id)return reply({error:'Please reopen this form.'},409);
  const emailStatus=owner.email_consent?await deliverMail(db,settings,`plan:${v.idempotencyKey}`):'not_requested';
  await deliverMail(db,settings,`staff-plan:${v.idempotencyKey}`);
  return reply({saved:true,id:v.idempotencyKey,emailStatus},201);
 }
 if(path.startsWith('/api/admin/')&&!user.isAdmin)return reply({error:'MyIntel staff access required.'},403);
 if(path==='/api/admin/mail-retry'&&method==='POST'){
  const data=await input(request,300);if(data.error)return data.error;
  const v=z.object({id:z.string().max(120).regex(/^staff-(plan|request):[\w-]+$/)}).strict().parse(data.value);
  return reply({status:await deliverMail(db,settings,v.id)});
 }
 if(path==='/api/admin/plans'&&method==='GET')return reply({plans:(await db.prepare('SELECT id,name,email,postal_code,phone,contact_consent,share_consent,email_consent,created_at,coordinator_id,coordinator_name,closed_at,CASE WHEN share_consent=1 THEN snapshot ELSE NULL END AS snapshot FROM saved_plans ORDER BY closed_at IS NOT NULL,created_at ASC LIMIT 200').all()).results,mail:(await db.prepare('SELECT id,kind,status,created_at,accepted_at FROM lead_mail ORDER BY created_at DESC LIMIT 200').all()).results});
 if(path==='/api/admin/funnel'&&method==='GET')return reply({counts:(await db.prepare('SELECT event,bucket,SUM(total) AS total FROM funnel_counts WHERE day>=? GROUP BY event,bucket ORDER BY event,bucket').bind(new Date(Date.now()-29*86400000).toISOString().slice(0,10)).all()).results});
 const admin=path.match(/^\/api\/admin\/plans\/([\w-]+)$/);
 if(admin&&method==='PATCH'){
  const data=await input(request,300);if(data.error)return data.error;
  const v=z.object({action:z.enum(['claim','release','close'])}).strict().parse(data.value);
  const sql=v.action==='claim'?"UPDATE saved_plans SET coordinator_id=?,coordinator_name=? WHERE id=? AND contact_consent=1 AND closed_at IS NULL AND coordinator_id IS NULL":v.action==='release'?"UPDATE saved_plans SET coordinator_id=NULL,coordinator_name=NULL WHERE id=? AND coordinator_id=? AND closed_at IS NULL":"UPDATE saved_plans SET closed_at=? WHERE id=? AND coordinator_id=? AND closed_at IS NULL";
  const args=v.action==='claim'?[user.id,user.name,admin[1]]:v.action==='release'?[admin[1],user.id]:[new Date().toISOString(),admin[1],user.id];
  const r=await db.batch([db.prepare(sql).bind(...args),db.prepare('INSERT INTO saved_plan_events(id,plan_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),admin[1],user.id,v.action,new Date().toISOString())]);return reply(r[0]?.meta.changes?{updated:true}:{error:'This plan changed or has no contact permission.'},r[0]?.meta.changes?200:409);
 }
 return reply({error:'This action was not found.'},404);
}
