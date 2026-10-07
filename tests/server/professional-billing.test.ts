import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type Stripe from 'stripe';
import {handleApi,type Env} from '../../worker/api';
import {billingStatus,ensureBilling,type BillingSettings} from '../../worker/professional-billing';
import {professionalBillingRoute,professionalBillingWebhook,type ProfessionalStripe} from '../../production/professional-stripe';
import {EMPTY_CASE,normalise,type CaseState} from '../../src/lib/case-store';
import {EMPTY_SIGNOFF} from '../../src/domain/case';
import {visitContextSignature} from '../../src/domain/visit-review';
import {createReportVersion} from '../../src/domain/report-version';
import {buildCaseView} from '../../src/lib/selectors';
import {SqliteTestDatabase} from './sqlite-test-db';

const origin='https://myintel.test';
const settings:BillingSettings={enabled:true,checkoutEnabled:true,live:false,secretKey:'test-key',webhookSecret:'test-secret',singlePrice:'price_single',monthlyPrice:'price_monthly',extraPrice:'price_extra'};
const user={id:'professional',email:'professional@example.test',name:'Example OT',isAdmin:false};
let db:SqliteTestDatabase,env:Env,provider:ProfessionalStripe;
let event:Record<string,unknown>,session:Record<string,unknown>,subscription:Record<string,unknown>,invoice:Record<string,unknown>;
const now=()=>Math.floor(Date.now()/1000);
const draft=(id='case-a'):CaseState=>({...structuredClone(EMPTY_CASE),id,audience:'clinician',reference:'Example assessment'});
function signed(id='case-a'){
 const c=normalise({...draft(id),spaces:[{id:'bed',type:'bedroom',label:'Bedroom'}],responses:{bed:{br1:{status:'pass'}}},visit:{deferred:[]},signoff:{...EMPTY_SIGNOFF,assessorName:'Assessor',credentials:'OT',partialAssessmentReason:'Limited visit; remaining items need follow-up.'}});
 c.visit!.contextReviewed=visitContextSignature(c);
 const v=createReportVersion(c,buildCaseView(c),'2026-10-06T12:00:00.000Z','report-'+id);
 return {...c,signoff:v.caseData.signoff,reportVersions:[v]};
}
async function approve(id=user.id){await db.prepare("INSERT INTO professional_access(user_id,email,name,practice,credential,region,status,revision,review_note,updated_at) VALUES (?,?,'Example OT','Practice','OT','CO','approved',1,'verified',?)").bind(id,id+'@example.test',new Date().toISOString()).run();}
async function save(cases:CaseState[],revision=0,id=user.id){return handleApi(new Request(origin+'/api/cases?audience=clinician',{method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify({ownerId:id,revision,archive:{activeId:cases[0]!.id,cases}})}),env,async()=>({id,email:id+'@example.test',emailVerified:true}));}
async function read(id=user.id){const r=await handleApi(new Request(origin+'/api/cases?audience=clinician'),env,async()=>({id,email:id+'@example.test',emailVerified:true}));return {status:r.status,data:await r.json()};}
const allocations=()=>db.sqlite.prepare('SELECT * FROM professional_allocations ORDER BY case_id').all();
async function grant(id:string,kind='purchase',quantity=1,expires:number|null=null,owner=user.id){await ensureBilling(db,owner);await db.prepare('INSERT INTO professional_credits(id,user_id,kind,quantity,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(id,owner,kind,quantity,expires,new Date().toISOString()).run();}
async function webhook(type='checkout.session.completed',id='evt-1'){event={id,type,livemode:false,data:{object:{id:type.startsWith('invoice.')?'in_1':type.startsWith('customer.subscription.')?'sub_1':type.startsWith('charge.')?'ch_1':'cs_1',charge:'ch_1'}}};return professionalBillingWebhook(new Request(origin+'/api/professional/billing/webhook',{method:'POST',headers:{'stripe-signature':'valid'},body:'signed payload'}),db,settings,provider);}
async function register(kind='single',owner=user.id){await ensureBilling(db,owner);await db.prepare('UPDATE professional_billing SET customer_id=? WHERE user_id=?').bind('cus_1',owner).run();await db.prepare('INSERT INTO professional_checkouts(id,user_id,kind,session_id,created_at) VALUES (?,?,?,?,?)').bind('checkout-1',owner,kind,'cs_1',now()).run();}
beforeEach(async()=>{
 db=new SqliteTestDatabase();env={DB:db,ASSETS:{fetch:async()=>new Response('')},PROFESSIONAL_BILLING:true};await approve();
 session={id:'cs_1',customer:'cus_1',livemode:false,payment_status:'paid',mode:'payment',currency:'usd',amount_subtotal:1900,line_items:{data:[{price:{id:'price_single'},quantity:1}]}};
 subscription={id:'sub_1',customer:'cus_1',livemode:false,status:'active',items:{data:[{price:{id:'price_monthly'},quantity:1,current_period_end:now()+86400}]}};
 invoice={id:'in_1',customer:'cus_1',livemode:false,status:'paid',currency:'usd',billing_reason:'subscription_cycle',parent:{subscription_details:{subscription:'sub_1'}},lines:{data:[{pricing:{price_details:{price:'price_monthly'}},parent:{subscription_item_details:{proration:false}},amount:4900,quantity:1,period:{end:now()+86400}}]}};
 provider={customer:vi.fn(async()=> 'cus_1'),checkout:vi.fn(async()=>({id:'cs_1',url:'https://checkout.stripe.com/c/pay'})),portal:vi.fn(async()=> 'https://billing.stripe.com/session'),verify:vi.fn(async()=>event as unknown as Stripe.Event),session:vi.fn(async()=>session as unknown as Stripe.Checkout.Session),subscription:vi.fn(async()=>subscription as unknown as Stripe.Subscription),invoice:vi.fn(async()=>invoice as unknown as Stripe.Invoice),charge:vi.fn(async()=>({customer:'cus_1'}) as Stripe.Charge)};
});
afterEach(()=>db.close());

describe('professional assessment allowance',()=>{
 it('preserves substantive family checks without charging the clinical allowance',async()=>{
  const family={...draft('family-check'),audience:'family'};
  await db.prepare('INSERT INTO case_archives(user_id,payload,revision,updated_at) VALUES (?,?,1,?)').bind(user.id,JSON.stringify({activeId:family.id,cases:[family]}),new Date().toISOString()).run();
  expect((await save([draft()],1)).status).toBe(200);
  expect(allocations()).toMatchObject([{case_id:'case-a',credit_id:'demo:professional'}]);
  expect(allocations()).toHaveLength(1);
  const stored=JSON.parse(String(db.sqlite.prepare('SELECT payload FROM case_archives').get()!.payload));
  expect(stored.cases.find((c:CaseState)=>c.id==='family-check')).toEqual(family);
 });
 it('does not reserve a blank placeholder; reserves one demo and rejects another draft',async()=>{
  const blank={...structuredClone(EMPTY_CASE),id:'blank',audience:'clinician' as const};
  expect((await save([blank])).status).toBe(200);expect(allocations()).toHaveLength(0);
  expect((await save([draft()],1)).status).toBe(409); // Earlier case identifiers must be preserved.
  expect((await save([blank,draft()],1)).status).toBe(200);expect(allocations()).toHaveLength(1);
  expect((await save([blank,draft(),draft('second')],2)).status).toBe(402);
  expect((await read()).data.revision).toBe(2);expect(allocations()).toHaveLength(1);
 });
 it('finalizes once and keeps archived signed history readable with no remaining allowance',async()=>{
  expect((await save([draft()])).status).toBe(200);
  const completed=signed();expect((await save([completed],1)).status).toBe(200);
  expect((await save([{...completed,deletedAt:'2026-10-07T12:00:00Z'}],2)).status).toBe(200);
  expect(allocations()).toMatchObject([{credit_id:'demo:professional',state:'completed'}]);
  expect((await billingStatus(db,user.id,settings)).remaining).toBe(0);
  expect((await read()).data.archive.cases[0].reportVersions).toEqual(completed.reportVersions);
 });
 it('rolls back newly reserved credits when the archive write fails',async()=>{
  db.sqlite.exec("CREATE TRIGGER fail_archive BEFORE INSERT ON case_archives BEGIN SELECT RAISE(ABORT,'forced archive failure'); END");
  expect((await save([draft()])).status).toBe(503);expect(allocations()).toHaveLength(0);
  expect((await read()).data.archive).toBeNull();
 });
 it('rolls back completion when an archive update fails',async()=>{
  expect((await save([draft()])).status).toBe(200);
  db.sqlite.exec("CREATE TRIGGER fail_archive BEFORE UPDATE ON case_archives BEGIN SELECT RAISE(ABORT,'forced archive failure'); END");
  expect((await save([signed()],1)).status).toBe(503);
  expect(allocations()).toMatchObject([{state:'reserved'}]);expect((await read()).data.archive.cases[0].reportVersions).toEqual([]);
 });
 it('denies a revoked professional despite purchased allowance',async()=>{
  await grant('paid');await db.prepare("UPDATE professional_access SET status='revoked' WHERE user_id=?").bind(user.id).run();
  expect((await save([draft()])).status).toBe(403);expect((await read()).status).toBe(403);
  expect((await professionalBillingRoute(new Request(origin+'/api/professional/billing'),db,user,settings,provider)).status).toBe(403);
 });
 it('ignores expired credits and uses only the current paid subscription period',async()=>{
  expect((await save([draft()])).status).toBe(200);
  await grant('old','subscription',5,now()-1);await grant('new','subscription',5,now()+86400);
  await db.prepare("UPDATE professional_billing SET subscription_status='active',period_end=? WHERE user_id=?").bind(now()+86400,user.id).run();
  expect((await billingStatus(db,user.id,settings)).remaining).toBe(5);
  expect((await save([draft(),draft('new-month')],1)).status).toBe(200);
  expect(allocations()[1]).toMatchObject({credit_id:'new'});
  await db.prepare("UPDATE professional_billing SET period_end=? WHERE user_id=?").bind(now()-1,user.id).run();
  expect((await save([draft(),draft('new-month'),draft('third')],2)).status).toBe(402);
 });
 it('isolates credits and case identifiers between owners',async()=>{
  await approve('other');await grant('other-paid','purchase',2,null,'other');
  expect((await save([draft()])).status).toBe(200);expect((await save([draft(),draft('second')],1)).status).toBe(402);
  expect((await read('other')).data.archive).toBeNull();
  expect((await save([draft()],0,'other')).status).toBe(200);
  expect(allocations()).toHaveLength(2);
 });
 it('runs a nested batch within a transaction and rolls back all statements on failure',async()=>{
  await expect(db.writeTransaction(async tx=>{await tx.batch([tx.prepare("INSERT INTO professional_billing(user_id) VALUES ('nested')")]);throw new Error('rollback');})).rejects.toThrow('rollback');
  expect(await db.prepare("SELECT * FROM professional_billing WHERE user_id='nested'").first()).toBeNull();
 });
});

describe('verified professional payments',()=>{
 const purchase=(kind='subscription')=>new Request(origin+'/api/professional/billing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,idempotencyKey:crypto.randomUUID()})});
 it('resumes a canceled open subscription checkout across reload without creating another payment',async()=>{
  await register('subscription');Object.assign(session,{status:'open',url:'https://checkout.stripe.com/c/existing',mode:'subscription'});
  for(let i=0;i<2;i++){
   const response=await professionalBillingRoute(purchase(),db,user,settings,provider);
   expect(response.status).toBe(200);expect(await response.json()).toEqual({url:'https://checkout.stripe.com/c/existing'});
  }
  expect(provider.checkout).not.toHaveBeenCalled();expect(provider.customer).not.toHaveBeenCalled();
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM professional_checkouts').get()!.n).toBe(1);
 });
 it('permits a new subscription purchase after a canonical expired checkout',async()=>{
  await register('subscription');session.status='expired';
  vi.mocked(provider.checkout).mockResolvedValue({id:'cs_new',url:'https://checkout.stripe.com/c/new'});
  const response=await professionalBillingRoute(purchase(),db,user,settings,provider);
  expect(response.status).toBe(200);expect(provider.checkout).toHaveBeenCalledTimes(1);
  expect(await response.json()).toEqual({url:'https://checkout.stripe.com/c/new'});
 });
 it('retries a pending subscription creation with its original key',async()=>{
  await register('subscription');await db.prepare('UPDATE professional_checkouts SET session_id=NULL').run();
  const response=await professionalBillingRoute(purchase(),db,user,settings,provider);
  expect(response.status).toBe(200);expect(provider.checkout).toHaveBeenCalledWith('cus_1','subscription','checkout-1');
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM professional_checkouts').get()!.n).toBe(1);
 });
 it('exposes billing management for a failed existing subscription and prevents buying a duplicate',async()=>{
  await register('subscription');await db.prepare("UPDATE professional_billing SET subscription_id='sub_1',subscription_status='past_due' WHERE user_id=?").bind(user.id).run();
  const response=await professionalBillingRoute(new Request(origin+'/api/professional/billing'),db,user,settings,provider);
  expect(await response.json()).toMatchObject({hasBillingAccount:true,hasSubscription:true,subscriptionActive:false});
  expect((await professionalBillingRoute(purchase(),db,user,settings,provider)).status).toBe(409);expect(provider.checkout).not.toHaveBeenCalled();
 });
 it('rejects an invalid signed webhook without fetching payment details',async()=>{
  vi.mocked(provider.verify).mockRejectedValue(new Error('invalid signature'));expect((await webhook()).status).toBe(400);
  expect(provider.session).not.toHaveBeenCalled();expect(await db.prepare("SELECT * FROM professional_credits").all()).toEqual({results:[]});
 });
 it('does not grant unpaid checkout access and grants one credit across duplicate and success replay events',async()=>{
  await register();session.payment_status='unpaid';expect((await webhook()).status).toBe(200);
  expect((await billingStatus(db,user.id,settings)).remaining).toBe(1);
  session.payment_status='paid';expect((await webhook()).status).toBe(200);expect((await webhook('checkout.session.async_payment_succeeded','evt-2')).status).toBe(200);
  expect((await billingStatus(db,user.id,settings)).remaining).toBe(2);
  expect((await save([draft(),draft('paid-case')])).status).toBe(200);expect((await save([draft(),draft('paid-case'),draft('third')],1)).status).toBe(402);
 });
 it.each([{currency:'eur'},{mode:'subscription'},{amount_subtotal:1000},{livemode:true},{customer:'cus_other'},{line_items:{data:[{price:{id:'price_wrong'},quantity:1}]}},{line_items:{data:[{price:{id:'price_single'},quantity:2}]}}])('rejects mismatched checkout %j',async change=>{
  await register();Object.assign(session,change);expect((await webhook()).status).toBe(409);
  expect(await db.prepare("SELECT * FROM professional_credits WHERE kind='purchase'").first()).toBeNull();
 });
 it('rejects a live event in the test environment',async()=>{
  event={type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_1'}}};
  const r=await professionalBillingWebhook(new Request(origin+'/webhook',{method:'POST',body:'payload'}),db,settings,provider);expect(r.status).toBe(400);
 });
 it('syncs subscription checkout without granting an unpaid monthly allowance, then grants five per paid invoice once',async()=>{
  await register('subscription');session.subscription='sub_1';session.mode='subscription';
  expect((await webhook()).status).toBe(200);expect((await billingStatus(db,user.id,settings)).remaining).toBe(1);
  expect((await webhook('invoice.paid')).status).toBe(200);expect((await webhook('invoice.paid','evt-duplicate')).status).toBe(200);
  expect((await billingStatus(db,user.id,settings)).remaining).toBe(6);
  subscription.status='past_due';invoice.status='open';expect((await webhook('invoice.payment_failed')).status).toBe(200);
  expect((await billingStatus(db,user.id,settings)).subscriptionActive).toBe(false);expect((await billingStatus(db,user.id,settings)).remaining).toBe(1);
  subscription.status='active';invoice.status='paid';invoice.id='in_2';
  db.sqlite.prepare("UPDATE professional_credits SET expires_at=? WHERE id='in_1'").run(now()-1);
  expect((await webhook('invoice.paid','evt-renewal')).status).toBe(200);expect((await billingStatus(db,user.id,settings)).remaining).toBe(6);
  subscription.status='canceled';expect((await webhook('customer.subscription.deleted')).status).toBe(200);expect((await billingStatus(db,user.id,settings)).remaining).toBe(1);
 });
 it('rejects an incorrect monthly invoice without adding allowance',async()=>{
  await register('subscription');invoice.lines={data:[{pricing:{price_details:{price:'price_monthly'}},amount:1000,quantity:1,period:{end:now()+86400}}]};
  expect((await webhook('invoice.paid')).status).toBe(409);expect(await db.prepare("SELECT * FROM professional_credits WHERE kind='subscription'").first()).toBeNull();
 });
 it.each(['charge.refunded','charge.dispute.created'])('holds paid draft access on %s while preserving completed history',async type=>{
  await register();await webhook();expect((await save([signed(),draft('paid-draft')])).status).toBe(200);
  expect((await webhook(type)).status).toBe(200);const status=await billingStatus(db,user.id,settings);expect(status.reviewRequired).toBe(true);expect(status.remaining).toBe(0);
  expect((await read()).data.archive.cases[0].reportVersions).toHaveLength(1);
  expect((await save([signed(),draft('paid-draft')],1)).status).toBe(402);
 });
 it('blocks unapproved purchase and extra-price checkout without an active subscription',async()=>{
  const checkout=()=>new Request(origin+'/api/professional/billing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'extra',idempotencyKey:crypto.randomUUID()})});
  expect((await professionalBillingRoute(checkout(),db,user,settings,provider)).status).toBe(409);expect(provider.checkout).not.toHaveBeenCalled();
  await db.prepare("UPDATE professional_access SET status='revoked' WHERE user_id=?").bind(user.id).run();
  expect((await professionalBillingRoute(checkout(),db,user,settings,provider)).status).toBe(403);
 });
});



