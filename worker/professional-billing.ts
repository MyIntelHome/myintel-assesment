import type {Database} from './api';
export class BillingError extends Error {constructor(public status:number,message:string){super(message)}}
export interface BillingSettings {enabled:boolean;checkoutEnabled:boolean;live:boolean;singlePrice?:string;monthlyPrice?:string;extraPrice?:string;secretKey?:string;webhookSecret?:string}
export const billingSettings=(env:Record<string,string|undefined>):BillingSettings=>({enabled:env.MYINTEL_PROFESSIONAL_BILLING==='true',checkoutEnabled:env.MYINTEL_PROFESSIONAL_CHECKOUT==='true',live:env.MYINTEL_PROFESSIONAL_STRIPE_LIVE==='true',secretKey:env.MYINTEL_PROFESSIONAL_STRIPE_KEY,webhookSecret:env.MYINTEL_PROFESSIONAL_WEBHOOK_SECRET,singlePrice:env.MYINTEL_PROFESSIONAL_SINGLE_PRICE,monthlyPrice:env.MYINTEL_PROFESSIONAL_MONTHLY_PRICE,extraPrice:env.MYINTEL_PROFESSIONAL_EXTRA_PRICE});
export async function approvedProfessional(db:Database,userId:string){
 const access=await db.prepare('SELECT status FROM professional_access WHERE user_id=?').bind(userId).first<{status:string}>();
 if(access?.status!=='approved')throw new BillingError(403,'Approved professional access is required. Payment does not grant clinical access.');
}
export async function ensureBilling(db:Database,userId:string){
 await db.prepare('INSERT INTO professional_billing(user_id) VALUES (?) ON CONFLICT DO NOTHING').bind(userId).run();
 await db.prepare("INSERT INTO professional_credits(id,user_id,kind,quantity,created_at) VALUES (?,?,'demo',1,?) ON CONFLICT DO NOTHING").bind('demo:'+userId,userId,new Date().toISOString()).run();
}
export async function billingStatus(db:Database,userId:string,settings:BillingSettings){
 if(!settings.enabled)return {enabled:false,checkoutEnabled:false,demoAvailable:false,remaining:0,subscriptionActive:false,renewalAt:null,allocations:[]};
 await approvedProfessional(db,userId);await ensureBilling(db,userId);
 const now=Math.floor(Date.now()/1000);
 const account=await db.prepare('SELECT * FROM professional_billing WHERE user_id=?').bind(userId).first<{customer_id:string|null;subscription_id:string|null;subscription_status:string;period_end:number;blocked:number}>();
 const grants=(await db.prepare(`SELECT c.kind,MAX(0,c.quantity-(SELECT COUNT(*) FROM professional_allocations a WHERE a.credit_id=c.id)) AS remaining FROM professional_credits c WHERE c.user_id=? AND c.revoked=0 AND (c.expires_at IS NULL OR c.expires_at>?)`).bind(userId,now).all<{kind:string;remaining:number}>()).results;
 const allocations=(await db.prepare('SELECT case_id,state FROM professional_allocations WHERE user_id=?').bind(userId).all()).results;
 const active=account?.subscription_status==='active' && account.period_end>now && !account.blocked;
 return {enabled:true,checkoutEnabled:settings.checkoutEnabled&&!!settings.secretKey&&!!settings.webhookSecret&&!!settings.singlePrice&&!!settings.monthlyPrice&&!!settings.extraPrice,demoAvailable:grants.some(c=>c.kind==='demo'&&c.remaining>0),remaining:account?.blocked?grants.filter(c=>c.kind==='demo').reduce((n,c)=>n+c.remaining,0):grants.filter(c=>c.kind!=='subscription'||active).reduce((n,c)=>n+c.remaining,0),subscriptionActive:active,hasBillingAccount:!!account?.customer_id,hasSubscription:!!account?.subscription_id&&!['canceled','incomplete_expired'].includes(account.subscription_status),renewalAt:account?.period_end?new Date(account.period_end*1000).toISOString():null,allocations,reviewRequired:!!account?.blocked};
}
type ClinicalCase={id:string;reference?:string;spaces?:unknown[];responses?:object;intake?:object;plan?:unknown[];reportVersions?:unknown[]};
const populated=(v:unknown):boolean=>Array.isArray(v)?v.some(populated):v!==null&&typeof v==='object'?Object.values(v).some(populated):v!==undefined&&v!==null&&v!==''&&v!==false;
export function substantiveCase(c:ClinicalCase){return !!c.reference?.trim()||!!c.spaces?.length||populated(c.responses)||populated(c.intake)||!!c.plan?.length||!!c.reportVersions?.length}
/** Run inside the same write transaction as the clinical archive save. */
export async function allocateAssessments(db:Database,userId:string,cases:ClinicalCase[],previous:ClinicalCase[]){
 await approvedProfessional(db,userId);await ensureBilling(db,userId);
 const account=await db.prepare('SELECT subscription_status,period_end,blocked FROM professional_billing WHERE user_id=?').bind(userId).first<{subscription_status:string;period_end:number;blocked:number}>();
 const now=Math.floor(Date.now()/1000),active=account?.subscription_status==='active'&&account.period_end>now&&!account.blocked;
 for(const c of cases){
  if(!substantiveCase(c))continue;
  let allocation=await db.prepare('SELECT a.state,c.kind,c.revoked FROM professional_allocations a JOIN professional_credits c ON c.id=a.credit_id WHERE a.user_id=? AND a.case_id=?').bind(userId,c.id).first<{state:string;kind:string;revoked:number}>();
  // Preserve completed historical reports without charging for their corrections.
  if(!allocation&&previous.find(p=>p.id===c.id)?.reportVersions?.length){
   const id='legacy:'+userId+':'+c.id;
   await db.prepare("INSERT INTO professional_credits(id,user_id,kind,quantity,created_at) VALUES (?,?,'legacy',1,?) ON CONFLICT DO NOTHING").bind(id,userId,new Date().toISOString()).run();
   await db.prepare("INSERT INTO professional_allocations(user_id,case_id,credit_id,state) VALUES (?,?,?,'completed') ON CONFLICT DO NOTHING").bind(userId,c.id,id).run();continue;
  }
  if(allocation?.state==='completed')continue;
  if(allocation&&(allocation.revoked||(account?.blocked&&allocation.kind!=='demo')))throw new BillingError(402,'This payment needs review. Your draft and completed reports are retained.');
  if(!allocation){
   const credit=await db.prepare(`SELECT c.id,c.kind FROM professional_credits c WHERE c.user_id=? AND c.revoked=0 AND (c.expires_at IS NULL OR c.expires_at>?) AND c.quantity>(SELECT COUNT(*) FROM professional_allocations a WHERE a.credit_id=c.id) AND (?=0 OR c.kind='demo') AND (c.kind!='subscription' OR ?=1) ORDER BY CASE c.kind WHEN 'demo' THEN 0 WHEN 'subscription' THEN 1 ELSE 2 END,c.created_at,c.id LIMIT 1`).bind(userId,now,account?.blocked??0,active?1:0).first<{id:string;kind:string}>();
   if(!credit)throw new BillingError(402,'Your free assessment or purchased allowance is in use. Continue that draft, buy an assessment for $19, or subscribe for $49/month before starting another.');
   await db.prepare("INSERT INTO professional_allocations(user_id,case_id,credit_id,state) VALUES (?,?,?,'reserved')").bind(userId,c.id,credit.id).run();
   allocation={state:'reserved',kind:credit.kind,revoked:0};
  }
  if(c.reportVersions?.length)await db.prepare("UPDATE professional_allocations SET state='completed' WHERE user_id=? AND case_id=?").bind(userId,c.id).run();
 }
}
