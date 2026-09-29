import type { Database, Env } from "./api";
import { createCheckout, retrieveCheckout, parseCheckoutSession, verifyStripeEvent, type CheckoutSessionReference } from "./stripe";

export class PaymentError extends Error { constructor(public status: number, message: string) { super(message); } }
function paymentsConfigured(env: Env) { return (env.PAYMENT_MODE === "test" || env.PAYMENT_MODE === "live") && !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET && !!env.APP_ORIGIN; }
export function paymentsEnabled(env: Env) { return paymentsConfigured(env) && env.PAYMENT_CHECKOUT_ENABLED !== false; }
function requirePayments(env: Env) { if (!paymentsEnabled(env)) throw new PaymentError(503, "Payment is not enabled yet. Your accepted proposal is saved; no charge has been made."); }
interface Attempt { id: string; request_id: string; quote_version: number; attempt: number; amount_cents: number; mode: "test" | "live"; state: "creating" | "open" | "expired" | "paid"; session_id: string | null; payment_intent_id: string | null; amount_refunded_cents: number; expires_at: number; created_at: string; }
const marker = (a: Attempt) => a.session_id ?? `pending:${a.id}`;
function matches(a: Attempt, s: CheckoutSessionReference) {
  if (s.metadata.requestId !== a.request_id || s.metadata.quoteVersion !== String(a.quote_version) || s.metadata.attempt !== String(a.attempt) || s.amount_total !== a.amount_cents || s.livemode !== (a.mode === "live") || (a.session_id && s.id !== a.session_id)) throw new PaymentError(409, "Payment does not match its saved proposal.");
}

async function settle(db: Database, a: Attempt, s: CheckoutSessionReference) {
  matches(a, s);
  if (s.status !== "complete" || s.payment_status !== "paid" || !s.payment_intent) throw new PaymentError(409, "Payment confirmation is still pending. Refresh your requests shortly.");
  if (a.state === "expired") throw new PaymentError(409, "This payment needs staff reconciliation.");
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare("UPDATE payment_attempts SET state='paid',session_id=?,payment_intent_id=?,updated_at=? WHERE id=? AND state IN ('creating','open','paid') AND EXISTS(SELECT 1 FROM service_requests WHERE id=? AND quote_version=? AND amount_cents=? AND status IN ('accepted','paid','completed') AND payment_session_id IN (?,?))").bind(s.id,s.payment_intent,now,a.id,a.request_id,a.quote_version,a.amount_cents,marker(a),s.id),
    db.prepare("UPDATE service_requests SET status=CASE WHEN ?='live' AND status='accepted' THEN 'paid' ELSE status END,payment_session_id=?,updated_at=? WHERE id=? AND quote_version=? AND changes()=1").bind(a.mode,s.id,now,a.request_id,a.quote_version),
    db.prepare("INSERT INTO payment_events (id,session_id,created_at) SELECT ?,?,? WHERE changes()=1 ON CONFLICT DO NOTHING").bind(`${s.id}:settled`,s.id,now),
    db.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) SELECT ?,?,'stripe',?,? WHERE EXISTS(SELECT 1 FROM payment_attempts WHERE id=? AND state='paid') ON CONFLICT(id) DO NOTHING").bind(`${s.id}:paid`,a.request_id,a.mode === "live" ? "paid" : "test_payment_confirmed",now,a.id),
  ]);
  if (results[0]?.meta.changes !== 1) throw new PaymentError(409, "The request changed. Staff must reconcile this payment.");
}

async function expire(db: Database, a: Attempt, s: CheckoutSessionReference) {
  matches(a,s);
  if (s.status !== "expired" || s.payment_status === "paid") throw new PaymentError(409,"Payment is still pending.");
  await db.batch([
    db.prepare("UPDATE payment_attempts SET state='expired',updated_at=? WHERE id=? AND state IN ('creating','open')").bind(new Date().toISOString(),a.id),
    db.prepare("UPDATE service_requests SET payment_session_id=NULL WHERE id=? AND quote_version=? AND status='accepted' AND payment_session_id IN (?,?) AND changes()=1").bind(a.request_id,a.quote_version,marker(a),s.id),
  ]);
}

/** Reserve before contacting Stripe. Concurrent callers share one immutable attempt. */
export async function checkout(env: Env, requestId: string, userId: string, quoteVersion: number): Promise<{url?:string;paid?:boolean;testPayment?:boolean}> {
  requirePayments(env);
  const db=env.DB, row=await db.prepare("SELECT * FROM service_requests WHERE id=? AND user_id=?").bind(requestId,userId).first();
  if(!row) throw new PaymentError(404,"Request not found.");
  if(row.status!=="accepted" || row.quote_version!==quoteVersion || !Number.isSafeInteger(row.amount_cents)) throw new PaymentError(409,"Refresh and review your current proposal before paying.");
  for(let pass=0;pass<2;pass++) {
    const id=crypto.randomUUID(),now=new Date().toISOString(),deadline=Math.floor(Date.now()/1000)+3600;
    await db.batch([
      db.prepare("INSERT INTO payment_attempts (id,request_id,quote_version,attempt,amount_cents,mode,state,expires_at,created_at,updated_at) SELECT ?,r.id,r.quote_version,COALESCE((SELECT MAX(attempt) FROM payment_attempts WHERE request_id=r.id AND quote_version=r.quote_version AND mode=?),0)+1,r.amount_cents,?,'creating',?,?,? FROM service_requests r WHERE r.id=? AND r.user_id=? AND r.status='accepted' AND r.quote_version=? AND r.payment_session_id IS NULL AND NOT EXISTS(SELECT 1 FROM payment_attempts WHERE request_id=r.id AND quote_version=r.quote_version AND mode=? AND state<>'expired') ON CONFLICT DO NOTHING").bind(id,env.PAYMENT_MODE,env.PAYMENT_MODE,deadline,now,now,requestId,userId,quoteVersion,env.PAYMENT_MODE),
      db.prepare("UPDATE service_requests SET payment_session_id=? WHERE id=? AND user_id=? AND status='accepted' AND quote_version=? AND payment_session_id IS NULL AND EXISTS(SELECT 1 FROM payment_attempts WHERE id=?)").bind(`pending:${id}`,requestId,userId,quoteVersion,id),
    ]);
    const a=await db.prepare("SELECT * FROM payment_attempts WHERE request_id=? AND quote_version=? AND mode=? AND state<>'expired'").bind(requestId,quoteVersion,env.PAYMENT_MODE).first<Attempt>();
    if(!a) throw new PaymentError(409,"This proposal has an existing or changed payment. Ask MyIntel to review it before trying again.");
    if(a.state==="paid") return {paid:true,testPayment:a.mode==="test"};
    let s:CheckoutSessionReference;
    if(a.session_id) s=await retrieveCheckout(env.STRIPE_SECRET_KEY!,a.session_id,a.mode==="live");
    else {
      // Do not create a fresh charge after Stripe's idempotency retention window.
      // An old uncertain attempt stays reserved for operator reconciliation.
      if(Date.now()-Date.parse(a.created_at)>23*60*60*1000 || a.expires_at < Math.floor(Date.now()/1000)+1800) throw new PaymentError(409,"This earlier checkout needs MyIntel review before it can be retried. No new checkout was created.");
      s=await createCheckout({secretKey:env.STRIPE_SECRET_KEY!,requestId,quoteVersion:String(quoteVersion),amountCents:a.amount_cents,currency:"usd",origin:env.APP_ORIGIN!,attempt:a.attempt,expiresAt:a.expires_at,expectedLivemode:a.mode==="live"});
      matches(a,s);
      await db.batch([
        db.prepare("UPDATE payment_attempts SET session_id=?,state=CASE WHEN state='creating' THEN 'open' ELSE state END,updated_at=? WHERE id=? AND (session_id IS NULL OR session_id=?)").bind(s.id,new Date().toISOString(),a.id,s.id),
        db.prepare("UPDATE service_requests SET payment_session_id=? WHERE id=? AND quote_version=? AND status='accepted' AND payment_session_id=? AND changes()=1").bind(s.id,requestId,quoteVersion,marker(a)),
      ]);
      // Stripe may replay the original creation response after a lost network
      // response. Read current state before returning that recovered link.
      if(a.id!==id) s=await retrieveCheckout(env.STRIPE_SECRET_KEY!,s.id,a.mode==="live");
    }
    matches(a,s);
    if(s.payment_status==="paid") {await settle(db,a,s);return {paid:true,testPayment:a.mode==="test"};}
    if(s.status==="expired") {await expire(db,a,s);continue;}
    if(s.status!=="open" || !s.url) throw new PaymentError(409,"Payment confirmation is pending. Refresh your requests shortly.");
    return {url:s.url};
  }
  throw new PaymentError(409,"Checkout expired. Please try opening payment again.");
}

export async function paymentWebhook(request: Request, env: Env) {
  if(!paymentsConfigured(env)) throw new PaymentError(503,"Payments are not enabled.");
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
  if(reader) for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>100_000){await reader.cancel();throw new PaymentError(413,"Payment notification is too large.");}chunks.push(part.value);}
  const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
  let event;
  try {event=await verifyStripeEvent(raw,request.headers.get("stripe-signature")??"",env.STRIPE_WEBHOOK_SECRET!);} catch {throw new PaymentError(400,"Invalid payment notification.");}
  if(event.livemode !== (env.PAYMENT_MODE==="live")) throw new PaymentError(400,"Payment mode does not match.");
  if(["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.expired"].includes(event.type)) {
    let s:CheckoutSessionReference;
    try{s=parseCheckoutSession(event.data.object,event.livemode);}catch{throw new PaymentError(400,"Invalid payment session.");}
    const a=await env.DB.prepare("SELECT * FROM payment_attempts WHERE request_id=? AND quote_version=? AND attempt=? AND mode=?").bind(s.metadata.requestId??"",s.metadata.quoteVersion??"",s.metadata.attempt??"",env.PAYMENT_MODE).first<Attempt>();
    if(!a) throw new PaymentError(409,"Payment attempt is not recorded yet.");
    matches(a,s);
    if(s.payment_status==="paid") await settle(env.DB,a,s);
    else if(event.type==="checkout.session.expired") await expire(env.DB,a,s);
  } else if(event.type==="charge.refunded") {
    const charge=event.data.object;
    if(typeof charge.payment_intent!=="string" || charge.currency!=="usd" || !Number.isSafeInteger(charge.amount) || !Number.isSafeInteger(charge.amount_refunded) || Number(charge.amount_refunded)<=0 || Number(charge.amount_refunded)>Number(charge.amount)) throw new PaymentError(400,"Invalid refund notification.");
    const a=await env.DB.prepare("SELECT * FROM payment_attempts WHERE payment_intent_id=? AND mode=? AND state='paid'").bind(charge.payment_intent,env.PAYMENT_MODE).first<Attempt>();
    if(!a || a.amount_cents!==charge.amount) throw new PaymentError(409,"The original payment needs reconciliation before this refund.");
    const now=new Date().toISOString();
    await env.DB.batch([
      dbUpdateRefund(env.DB,a,Number(charge.amount_refunded),now),
      env.DB.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) SELECT ?,?,'stripe',?,? WHERE changes()=1 ON CONFLICT(id) DO NOTHING").bind(`${a.session_id}:refund:${charge.amount_refunded}`,a.request_id,Number(charge.amount_refunded)===a.amount_cents?"payment_refunded":"payment_partially_refunded",now),
    ]);
  }
  return {received:true};
}
function dbUpdateRefund(db:Database,a:Attempt,amount:number,now:string) {return db.prepare("UPDATE payment_attempts SET amount_refunded_cents=?,updated_at=? WHERE id=? AND amount_refunded_cents<?").bind(amount,now,a.id,amount);}

/** Only attach ledger fields to rows already filtered by owner or staff access. */
export async function withPayments(env:Env,rows:Record<string,unknown>[]) {
  if(!paymentsConfigured(env)) return rows;
  return Promise.all(rows.map(async row=>{
    const a=await env.DB.prepare("SELECT mode,state,amount_refunded_cents FROM payment_attempts WHERE request_id=? AND quote_version=? AND state<>'expired' ORDER BY CASE mode WHEN 'live' THEN 0 ELSE 1 END LIMIT 1").bind(row.id,row.quote_version).first<Pick<Attempt,"mode"|"state"|"amount_refunded_cents">>();
    return a?{...row,payment_mode:a.mode,payment_state:a.state,amount_refunded_cents:a.amount_refunded_cents,test_paid:a.mode==="test"&&a.state==="paid"}:row;
  }));
}
