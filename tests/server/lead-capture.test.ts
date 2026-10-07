import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {SqliteTestDatabase} from './sqlite-test-db';
import {handleApi,type Env} from '../../worker/api';
import {leadSettings,deliverMail,emailHtml,planSummary} from '../../worker/leads';
import {EMPTY_CASE} from '../../src/lib/case-store';
let db:SqliteTestDatabase,env:Env;
const home={...EMPTY_CASE,id:'selected-check',audience:'family',spaces:[{id:'room',type:'bathroom',label:'Synthetic bathroom'}],familyAnswers:{'room::b5':'no'}};
const config={enabled:true,deliveryEnabled:false,allowedEmails:['alice@example.test','info@myintelhome.com']};
function call(path:string,user='alice',method='GET',body?:unknown){return handleApi(new Request('https://pilot.test'+path,{method,headers:{origin:'https://pilot.test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env,async()=>user?{id:user,email:user+'@example.test',emailVerified:true}:null)}
function values(contact=false,share=false){return {idempotencyKey:crypto.randomUUID(),caseId:home.id,name:'Example',postalCode:'',phone:'',emailConsent:true,contactConsent:contact,shareConsent:share}}
beforeEach(async()=>{db=new SqliteTestDatabase();env={DB:db,ASSETS:{fetch:async()=>new Response('')},APP_ORIGIN:'https://pilot.test',MYINTEL_ADMIN_EMAIL:'staff@example.test',LEADS:config};await db.prepare('INSERT INTO case_archives VALUES (?,?,1,?)').bind('alice',JSON.stringify({activeId:home.id,cases:[home]}),'now').run()});
afterEach(()=>{db.sqlite.close();vi.restoreAllMocks()});
it('keeps production delivery disabled even if preview flags and keys are supplied',()=>{expect(leadSettings({VERCEL_ENV:'production',MYINTEL_LEAD_PREVIEW:'true',MYINTEL_EMAIL_PREVIEW:'true',RESEND_API_KEY:'example'})).toMatchObject({enabled:false,deliveryEnabled:false})});
it('requires verified ownership and rejects another account case or clinical case',async()=>{
 expect((await call('/api/plans','','POST',values())).status).toBe(401);expect((await call('/api/plans','bob','POST',values())).status).toBe(400);
 await db.prepare('UPDATE case_archives SET payload=? WHERE user_id=?').bind(JSON.stringify({cases:[{...home,audience:'clinician'}]}),'alice').run();expect((await call('/api/plans','alice','POST',values())).status).toBe(400);
});
it('stores email, contact and sharing permissions separately and hides unshared results from staff',async()=>{
 const v=values();expect((await call('/api/plans','alice','POST',v)).status).toBe(201);
 const staff=await (await call('/api/admin/plans','staff')).json();expect(staff.plans[0]).toMatchObject({contact_consent:0,share_consent:0,email_consent:1,snapshot:null,email:'alice@example.test'});
 const mails=(await db.prepare('SELECT * FROM lead_mail').all()).results;expect(mails).toHaveLength(1);expect(mails[0]!.recipient).toBe('alice@example.test');expect(mails[0]!.status).toBe('disabled');
 expect((await call('/api/admin/plans','bob')).status).toBe(403);expect((await call('/api/admin/funnel','alice')).status).toBe(403);
});
it('keeps a shared snapshot immutable and creates health-free staff notifications only with contact permission',async()=>{
 const v=values(true,true);await call('/api/plans','alice','POST',v);const before=await (await call('/api/admin/plans','staff')).json();expect(before.plans[0].snapshot).toContain('Synthetic bathroom');
 const notification=await db.prepare("SELECT text FROM lead_mail WHERE kind='staff'").first<{text:string}>();expect(notification?.text).toContain('Open Operations: https://pilot.test/?view=operations&item=');expect(notification?.text).not.toContain('Synthetic bathroom');
 await db.prepare('UPDATE case_archives SET payload=?').bind(JSON.stringify({cases:[]})).run();await call('/api/plans','alice','POST',{...v,shareConsent:false,contactConsent:false});const after=await (await call('/api/admin/plans','staff')).json();expect(after.plans[0]).toEqual(before.plans[0]);expect((await db.prepare('SELECT * FROM lead_mail').all()).results).toHaveLength(2);
});
it('enforces explicit booleans, bounded fields and strips no forged recipient into an email',async()=>{expect((await call('/api/plans','alice','POST',{...values(),recipient:'attacker@example.test'})).status).toBe(400);const v=values() as Record<string,unknown>;delete v.contactConsent;expect((await call('/api/plans','alice','POST',v)).status).toBe(400)});
it('saves the plan once without email if only account saving was requested',async()=>{const v={...values(),emailConsent:false};await call('/api/plans','alice','POST',v);await call('/api/plans','alice','POST',v);expect((await db.prepare('SELECT * FROM saved_plans').all()).results).toHaveLength(1);expect((await db.prepare('SELECT * FROM lead_mail').all()).results).toHaveLength(0);expect((await db.prepare('SELECT * FROM saved_plan_events').all()).results).toHaveLength(1)});
it('records coordinator history and prevents contact without permission',async()=>{const v=values(false);await call('/api/plans','alice','POST',v);expect((await call('/api/admin/plans/'+v.idempotencyKey,'staff','PATCH',{action:'claim'})).status).toBe(409);const yes=values(true);await call('/api/plans','alice','POST',yes);expect((await call('/api/admin/plans/'+yes.idempotencyKey,'staff','PATCH',{action:'claim'})).status).toBe(200);expect((await call('/api/admin/plans/'+yes.idempotencyKey,'staff','PATCH',{action:'close'})).status).toBe(200);expect((await db.prepare('SELECT action FROM saved_plan_events WHERE plan_id=?').bind(yes.idempotencyKey).all()).results.map(r=>r.action)).toEqual(['saved','claim','close'])});
it('does not duplicate a help request notification or submission count on retries',async()=>{
 const v={idempotencyKey:crypto.randomUUID(),service:'care_navigation',name:'Example',postalCode:'80202',contactMethod:'email',relationship:'self',consent:true};expect((await call('/api/requests','alice','POST',v)).status).toBe(201);expect((await call('/api/requests','alice','POST',v)).status).toBe(200);expect((await db.prepare('SELECT * FROM lead_mail').all()).results).toHaveLength(1);expect((await db.prepare("SELECT total FROM funnel_counts WHERE event='help_request_submitted'").first())?.total).toBe(1);
});
it('keeps a failed email pending, retries within provider deduplication window and counts acceptance once',async()=>{
 env.LEADS={...config,deliveryEnabled:true,apiKey:'example-test-key',sender:'plans@example.test'};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));const v=values();const response=await (await call('/api/plans','alice','POST',v)).json();expect(response).toMatchObject({saved:true,emailStatus:'pending'});
 await db.prepare('UPDATE lead_mail SET lease_until=NULL').run();const send=vi.fn(async()=>Response.json({id:'provider-id'}));expect(await deliverMail(db,env.LEADS,`plan:${v.idempotencyKey}`,send)).toBe('accepted');expect(await deliverMail(db,env.LEADS,`plan:${v.idempotencyKey}`,send)).toBe('accepted');expect(send).toHaveBeenCalledTimes(1);expect((await db.prepare("SELECT total FROM funnel_counts WHERE event='plan_emailed'").first())?.total).toBe(1);expect((await db.prepare('SELECT text FROM lead_mail').first())?.text).toBe('');vi.unstubAllGlobals();
});
it('rejects health/contact/identifier data in analytics and stores only aggregate counts and timing groups',async()=>{expect((await call('/api/funnel','','POST',{event:'results_viewed',email:'alice@example.test'})).status).toBe(400);expect((await call('/api/funnel','','POST',{event:'room_finished',room:'Bathroom'})).status).toBe(400);expect((await call('/api/funnel','','POST',{event:'plan_emailed'})).status).toBe(400);expect((await call('/api/funnel','','POST',{event:'results_viewed',bucket:'10_to_15'})).status).toBe(200);const r=await (await call('/api/admin/funnel','staff')).json();expect(r.counts).toEqual([{event:'results_viewed',bucket:'10_to_15',total:1}])});
it('escapes HTML while retaining readable text',()=>{expect(emailHtml('<script>')).toContain('&lt;script&gt;');expect(emailHtml('<script>')).not.toContain('<script>');expect(planSummary(home)).not.toContain('—')});
it('blocks another account from reusing a saved plan receipt',async()=>{const v=values();await call('/api/plans','alice','POST',v);expect((await call('/api/plans','bob','POST',v)).status).toBe(409)});
it('refuses sends outside the preview recipient allowlist and refuses uncertain sends after 23 hours',async()=>{
 env.LEADS={...config,allowedEmails:[],deliveryEnabled:true,apiKey:'example',sender:'plans@example.test'};const v=values();const send=vi.fn();await call('/api/plans','alice','POST',v);expect(await deliverMail(db,env.LEADS,`plan:${v.idempotencyKey}`,send)).toBe('disabled');expect(send).not.toHaveBeenCalled();
 await db.prepare("UPDATE lead_mail SET status='pending',created_at=?").bind(new Date(Date.now()-24*3600000).toISOString()).run();env.LEADS.allowedEmails=['alice@example.test'];expect(await deliverMail(db,env.LEADS,`plan:${v.idempotencyKey}`,send)).toBe('needs_review');expect(send).not.toHaveBeenCalled();
});
