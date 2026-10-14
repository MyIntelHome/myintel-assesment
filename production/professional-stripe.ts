import Stripe from 'stripe';
import {z} from 'zod';
import type {AccountUser} from '../src/domain/services';
import type {Database} from '../worker/api';
import {approvedProfessional,BillingError,billingStatus,ensureBilling,type BillingSettings} from '../worker/professional-billing';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const idOf=(value:unknown):string=>typeof value==='string'?value:value&&typeof value==='object'&&'id' in value?String(value.id):'';
async function input(request:Request,max=2000){
 const reader=request.body?.getReader();let text='',length=0;const decoder=new TextDecoder();
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new BillingError(413,'This request is too large.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();return text;
}
export interface ProfessionalStripe {
 customer(userId:string,email:string):Promise<string>;
 checkout(customer:string,kind:'single'|'extra'|'subscription',key:string):Promise<{id:string;url:string|null}>;
 portal(customer:string):Promise<string>;
 verify(raw:string,signature:string):Promise<Stripe.Event>;
 session(id:string):Promise<Stripe.Checkout.Session>;
 subscription(id:string):Promise<Stripe.Subscription>;
 invoice(id:string):Promise<Stripe.Invoice>;
 charge(id:string):Promise<Stripe.Charge>;
}
export function professionalStripe(settings:BillingSettings,origin:string):ProfessionalStripe{
 if(!settings.secretKey||!/^https:\/\//.test(origin)||!(settings.live?/^(rk|sk)_live_/:/^(rk|sk)_test_/).test(settings.secretKey))throw new BillingError(503,'Professional checkout is not configured for this payment environment.');
 // SDK instance is server-only. Catalog prices are validated before any checkout.
 const stripe=new Stripe(settings.secretKey,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:2,timeout:15000});
 const priceId=(kind:string)=>kind==='subscription'?settings.monthlyPrice:kind==='extra'?settings.extraPrice:settings.singlePrice;
 return {
  customer:async(userId,email)=>(await stripe.customers.create({email},{idempotencyKey:'homecheck-professional-customer:'+userId})).id,
  checkout:async(customer,kind,key)=>{
   const price=await stripe.prices.retrieve(priceId(kind)!);
   const amount=kind==='subscription'?4900:kind==='extra'?1000:1900;
   if(!price.active||price.livemode!==settings.live||price.currency!=='usd'||price.unit_amount!==amount||(kind==='subscription'?(price.recurring?.interval!=='month'||price.recurring.interval_count!==1):!!price.recurring))throw new BillingError(503,'The professional price configuration needs review.');
   return stripe.checkout.sessions.create({customer,mode:kind==='subscription'?'subscription':'payment',line_items:[{price:price.id,quantity:1}],success_url:origin+'/?portal=professional&billing=returned',cancel_url:origin+'/?portal=professional&billing=cancelled',integration_identifier:'homecheck_professional_abcdwxyz'}, {idempotencyKey:'homecheck-professional:'+key});
  },
  portal:async customer=>(await stripe.billingPortal.sessions.create({customer,return_url:origin+'/?portal=professional&billing=returned'})).url,
  verify:async(raw,signature)=>stripe.webhooks.constructEventAsync(raw,signature,settings.webhookSecret!),
  session:id=>stripe.checkout.sessions.retrieve(id,{expand:['line_items']}),
  subscription:id=>stripe.subscriptions.retrieve(id),
  invoice:id=>stripe.invoices.retrieve(id),
  charge:id=>stripe.charges.retrieve(id),
 };
}
export async function professionalBillingRoute(request:Request,db:Database,user:AccountUser|null,settings:BillingSettings,provider?:ProfessionalStripe):Promise<Response>{
 try{
  const path=new URL(request.url).pathname;
  if(!user)throw new BillingError(401,'Sign in to your professional account.');
  await approvedProfessional(db,user.id);
  if(path==='/api/professional/billing'&&request.method==='GET')return reply(await billingStatus(db,user.id,settings));
  if(!settings.enabled||!settings.checkoutEnabled||!provider)throw new BillingError(503,'Professional payments are not enabled here.');
  if(request.method!=='POST'||!request.headers.get('content-type')?.startsWith('application/json'))throw new BillingError(405,'Use Plan & billing to continue.');
  await ensureBilling(db,user.id);
  if(path==='/api/professional/billing/portal'){
   const row=await db.prepare('SELECT customer_id FROM professional_billing WHERE user_id=?').bind(user.id).first<{customer_id:string|null}>();
   if(!row?.customer_id)throw new BillingError(409,'There is no Stripe billing account to manage yet.');
   return reply({url:await provider.portal(row.customer_id)});
  }
  if(path!=='/api/professional/billing/checkout')throw new BillingError(404,'This billing page is unavailable.');
  const v=z.object({kind:z.enum(['single','subscription','extra']),idempotencyKey:z.uuid()}).strict().parse(JSON.parse(await input(request)));
  const status=await billingStatus(db,user.id,settings);
  const account=await db.prepare('SELECT * FROM professional_billing WHERE user_id=?').bind(user.id).first<{customer_id:string|null;subscription_id:string|null;subscription_status:string;blocked:number}>();
  if(account?.blocked)throw new BillingError(409,'Your billing account needs staff review before another purchase.');
  if(v.kind==='extra'&&!status.subscriptionActive)throw new BillingError(409,'The $10 price requires an active paid subscription.');
  if(v.kind==='subscription'&&account?.subscription_id&&!['canceled','incomplete_expired'].includes(account.subscription_status))throw new BillingError(409,'Manage your existing subscription through Plan & billing.');
  const expiredPending:string[]=[];
  if(v.kind==='subscription'){
   const pendingRows=(await db.prepare("SELECT id,session_id FROM professional_checkouts WHERE user_id=? AND kind='subscription' AND created_at>? ORDER BY created_at DESC LIMIT 10").bind(user.id,Math.floor(Date.now()/1000)-86400).all<{id:string;session_id:string|null}>()).results;
   for(const pending of pendingRows)if(pending.session_id){
    const session=await provider.session(pending.session_id);
    if(idOf(session.customer)!==account?.customer_id)throw new BillingError(409,'Checkout ownership needs review.');
    if(session.status==='open'&&session.url?.startsWith('https://checkout.stripe.com/'))return reply({url:session.url});
    if(session.status==='complete'){if(session.subscription)await syncSubscription(db,provider,idOf(session.subscription),settings);throw new BillingError(409,'Your subscription checkout is complete. Refresh your plan or manage billing.');}
    if(session.status==='expired')expiredPending.push(pending.id);
   }else {v.idempotencyKey=pending.id;break;}
  }
  if(!db.writeTransaction)throw new BillingError(503,'Transactional billing storage is required.');
  await db.writeTransaction(async tx=>{
   const old=await tx.prepare('SELECT user_id,kind,created_at FROM professional_checkouts WHERE id=?').bind(v.idempotencyKey).first<{user_id:string;kind:string;created_at:number}>();
   if(old&&(old.user_id!==user.id||old.kind!==v.kind))throw new BillingError(409,'This purchase belongs to another request.');
   if(old&&old.created_at<Math.floor(Date.now()/1000)-23*3600)throw new BillingError(409,'This checkout expired. Start a new purchase.');
   const recent=await tx.prepare('SELECT COUNT(*) AS total FROM professional_checkouts WHERE user_id=? AND created_at>?').bind(user.id,Math.floor(Date.now()/1000)-3600).first<{total:number}>();
   if(!old&&(recent?.total??0)>=10)throw new BillingError(429,'Too many purchase attempts. Please try again later.');
   // One subscription checkout at a time, including delayed payment methods.
   if(!old&&v.kind==='subscription'){
    const pending=await tx.prepare("SELECT id FROM professional_checkouts WHERE user_id=? AND kind='subscription' AND created_at>? AND id NOT IN (SELECT value FROM json_each(?))").bind(user.id,Math.floor(Date.now()/1000)-86400,JSON.stringify(expiredPending)).first();
    if(pending)throw new BillingError(409,'A subscription checkout is already in progress. Return to it or try again after it expires.');
   }
   await tx.prepare('INSERT INTO professional_checkouts(id,user_id,kind,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(v.idempotencyKey,user.id,v.kind,Math.floor(Date.now()/1000)).run();
  });
  let customer=account?.customer_id;
  if(!customer){customer=await provider.customer(user.id,user.email);await db.prepare('UPDATE professional_billing SET customer_id=? WHERE user_id=? AND customer_id IS NULL').bind(customer,user.id).run();}
  const session=await provider.checkout(customer,v.kind,v.idempotencyKey);
  if(!session.url?.startsWith('https://checkout.stripe.com/'))throw new BillingError(503,'Stripe did not return a valid checkout address.');
  await db.prepare('UPDATE professional_checkouts SET session_id=? WHERE id=? AND user_id=?').bind(session.id,v.idempotencyKey,user.id).run();
  return reply({url:session.url});
 }catch(error){if(error instanceof BillingError)return reply({error:error.message},error.status);if(error instanceof z.ZodError||error instanceof SyntaxError)return reply({error:'Check your purchase choice.'},400);return reply({error:'Billing could not complete. No assessment access has been added. Please retry.'},503);}
}
async function syncSubscription(db:Database,provider:ProfessionalStripe,id:string,settings:BillingSettings){
 const sub=await provider.subscription(id),customer=idOf(sub.customer);
 const account=await db.prepare('SELECT user_id,subscription_id FROM professional_billing WHERE customer_id=?').bind(customer).first<{user_id:string;subscription_id:string|null}>();
 if(!account||sub.livemode!==settings.live)return null;
 const item=sub.items.data.find(i=>i.price.id===settings.monthlyPrice);
 if(!item||sub.items.data.length!==1||item.quantity!==1)return null;
 if(account.subscription_id&&account.subscription_id!==sub.id){
  const other=await provider.subscription(account.subscription_id);
  if(!['canceled','incomplete_expired'].includes(other.status))throw new BillingError(409,'Multiple professional subscriptions need staff review.');
 }
 await db.prepare('UPDATE professional_billing SET subscription_id=?,subscription_status=?,period_end=? WHERE user_id=?').bind(sub.id,sub.status,item.current_period_end,account.user_id).run();
 return {userId:account.user_id,sub,item};
}
export async function professionalBillingWebhook(request:Request,db:Database,settings:BillingSettings,provider?:ProfessionalStripe):Promise<Response>{
 try{
  if(!settings.enabled||!settings.checkoutEnabled||!settings.webhookSecret||!provider)throw new BillingError(503,'Professional payments are not enabled.');
  let event:Stripe.Event;
  const raw=await input(request,100000);
  try{event=await provider.verify(raw,request.headers.get('stripe-signature')??'');}catch{throw new BillingError(400,'Invalid payment signature.');}
  if(event.livemode!==settings.live)throw new BillingError(400,'Wrong payment environment.');
  const object=event.data.object,objectId=idOf(object);
  if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
   const session=await provider.session(objectId);
   const checkout=await db.prepare('SELECT user_id,kind FROM professional_checkouts WHERE session_id=?').bind(session.id).first<{user_id:string;kind:string}>();
   if(!checkout){const known=await db.prepare('SELECT user_id FROM professional_billing WHERE customer_id=?').bind(idOf(session.customer)).first();if(known)throw new BillingError(503,'Checkout registration is still saving. Retry this notification.');return reply({received:true});}
   const account=await db.prepare('SELECT customer_id FROM professional_billing WHERE user_id=?').bind(checkout.user_id).first<{customer_id:string}>();
   if(session.livemode!==settings.live||idOf(session.customer)!==account?.customer_id)throw new BillingError(409,'Payment ownership does not match.');
   if(checkout.kind==='subscription'){if(session.subscription)await syncSubscription(db,provider,idOf(session.subscription),settings);return reply({received:true});}
   const expected=checkout.kind==='extra'?1000:1900,price=checkout.kind==='extra'?settings.extraPrice:settings.singlePrice,line=session.line_items?.data;
   if(session.payment_status!=='paid')return reply({received:true});
   if(session.mode!=='payment'||session.currency!=='usd'||session.amount_subtotal!==expected||line?.length!==1||line[0]?.price?.id!==price||line[0]?.quantity!==1)throw new BillingError(409,'Payment does not match the assessment purchase.');
   await db.prepare("INSERT INTO professional_credits(id,user_id,kind,quantity,created_at) VALUES (?,?,'purchase',1,?) ON CONFLICT DO NOTHING").bind(session.id,checkout.user_id,new Date().toISOString()).run();
  }else if(event.type.startsWith('customer.subscription.')){
   await syncSubscription(db,provider,objectId,settings);
  }else if(event.type==='invoice.paid'||event.type==='invoice.payment_failed'){
   const invoice=await provider.invoice(objectId),subId=idOf(invoice.parent?.subscription_details?.subscription);
   if(!subId)return reply({received:true});
   const state=await syncSubscription(db,provider,subId,settings);
   if(!state||idOf(invoice.customer)!==idOf(state.sub.customer)||invoice.livemode!==settings.live)return reply({received:true});
   if(event.type==='invoice.paid'&&invoice.status==='paid'&&invoice.currency==='usd'&&['subscription_create','subscription_cycle'].includes(invoice.billing_reason??'')){
    const lines=invoice.lines.data.filter(l=>l.pricing?.price_details?.price===settings.monthlyPrice&&!l.parent?.subscription_item_details?.proration);
    if(lines.length!==1||lines[0]?.amount!==4900||lines[0]?.quantity!==1)throw new BillingError(409,'Subscription invoice needs review.');
    await db.prepare("INSERT INTO professional_credits(id,user_id,kind,quantity,expires_at,created_at) VALUES (?,?,'subscription',5,?,?) ON CONFLICT DO NOTHING").bind(invoice.id,state.userId,lines[0]!.period.end,new Date().toISOString()).run();
   }
  }else if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
   // Conservative review hold: paid access pauses; signed history stays readable.
   // Retrieve canonical charge ownership instead of trusting case metadata.
   const charge=await provider.charge(event.type==='charge.refunded'?objectId:'charge' in object?idOf(object.charge):'');
   const customer=idOf(charge.customer);
   if(!customer)throw new BillingError(409,'Disputed payment requires ownership review.');
   await db.prepare('UPDATE professional_billing SET blocked=1 WHERE customer_id=?').bind(customer).run();
  }
  return reply({received:true});
 }catch(error){if(error instanceof BillingError)return reply({error:error.message},error.status);return reply({error:'Payment notification needs retry. No unverified access was granted.'},503);}
}
