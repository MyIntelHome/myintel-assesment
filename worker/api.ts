import { z } from "zod";
import { requestSchema, serviceSchema } from "../src/domain/services";
import { savedCaseSchema } from "../src/lib/case-validation";
import {createCheckout,verifyStripeEvent} from "./stripe";
import {homePhotoRoute,type PhotoBucket} from "./home-photos";
import {buildFamilyReport,reportToPlainText} from "../src/domain/family-report";
import {familyTemplateFor,profileLines} from "../src/domain/home-profile";

export interface Statement {bind(...values:unknown[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<{meta:{changes:number}}[]>}
export interface Env {DB:Database;BUCKET?:PhotoBucket;ASSETS:{fetch(request:Request):Promise<Response>};MYINTEL_ADMIN_EMAIL?:string;APP_ORIGIN?:string;STRIPE_SECRET_KEY?:string;STRIPE_WEBHOOK_SECRET?:string}
export function identity(request:Request,env:Env) {
  const id=request.headers.get("oai-authenticated-user-id"),email=request.headers.get("oai-authenticated-user-email");
  if(!id || !email) return null;
  let name=email; const raw=request.headers.get("oai-authenticated-user-full-name");
  if(raw && request.headers.get("oai-authenticated-user-full-name-encoding")==="percent-encoded-utf-8") {try{name=decodeURIComponent(raw)}catch{}}
  return {id,email,name,isAdmin:!!env.MYINTEL_ADMIN_EMAIL && email.toLowerCase()===env.MYINTEL_ADMIN_EMAIL.toLowerCase()};
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
async function body(request:Request,max=16000){
  if(!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415,"Send JSON data.");
  if(Number(request.headers.get("content-length"))>max)throw new ApiError(413,"This record is too large.");
  const bytes=await boundedBytes(request,max);
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new ApiError(400,"The submitted data could not be read.")}
}
class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
async function boundedBytes(request:Request,max:number){
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new ApiError(413,"This record is too large.")}chunks.push(value)}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}
async function webhook(request:Request,env:Env){
  if(!env.STRIPE_WEBHOOK_SECRET || !env.DB)throw new ApiError(503,"Payments are not enabled.");
  const raw=await boundedBytes(request,100_000);let event;
  try{event=await verifyStripeEvent(raw,request.headers.get("stripe-signature")??"",env.STRIPE_WEBHOOK_SECRET)}catch{throw new ApiError(400,"Invalid payment notification.")}
  if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type))return json({received:true});
  const session=event.data.object;if(session.payment_status!=="paid")return json({received:true});
  const row=await env.DB.prepare("SELECT * FROM service_requests WHERE id=?").bind(session.metadata.requestId??"").first();
  if(!row || row.payment_session_id!==session.id || String(row.quote_version)!==session.metadata.quoteVersion || row.amount_cents!==session.amount_total || session.currency!=="usd")throw new ApiError(409,"Payment does not match the current proposal.");
  if(row.status==="paid" || row.status==="completed")return json({received:true});
  if(row.status!=="accepted")throw new ApiError(409,"This proposal is not awaiting payment.");
  const now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO payment_events (id,session_id,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING").bind(event.id,session.id,now),
    env.DB.prepare("UPDATE service_requests SET status='paid',updated_at=? WHERE id=? AND status='accepted' AND payment_session_id=? AND quote_version=? AND amount_cents=?").bind(now,row.id,session.id,row.quote_version,session.amount_total),
    env.DB.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) SELECT ?,id,'stripe','paid',? FROM service_requests WHERE id=? AND status='paid' ON CONFLICT(id) DO NOTHING").bind(session.id+":paid",now,row.id),
  ]);
  return json({received:true});
}
const archiveSchema=z.object({ownerId:z.string(),revision:z.number().int().nonnegative(),archive:z.object({activeId:z.string(),cases:z.array(savedCaseSchema.required({id:true,spaces:true,responses:true,plan:true,reportVersions:true})).max(100)})});
export function preservedHistory(before: {cases: Array<{id?:string;reportVersions?:unknown[]}>}, after:{cases:Array<{id?:string;reportVersions?:unknown[]}>}) {
  return before.cases.every(old=>{const next=after.cases.find(c=>c.id===old.id);return !!next && (old.reportVersions??[]).every((v,i)=>JSON.stringify(v)===JSON.stringify(next.reportVersions?.[i]));});
}
const requestSelect="SELECT r.*, p.name AS provider_name FROM service_requests r LEFT JOIN providers p ON p.id=r.provider_id";
export async function handleApi(request:Request,env:Env):Promise<Response>{
  try{
    const url=new URL(request.url),path=url.pathname,method=request.method,user=identity(request,env);
    if(path==="/api/stripe/webhook" && method==="POST")return await webhook(request,env);
    if(method!=="GET" && method!=="HEAD"){
      const origin=request.headers.get("origin");
      if(!origin || (origin!==url.origin && origin!==env.APP_ORIGIN))return json({error:"This request must come from the MyIntel app."},403);
    }
    if(path==="/api/account" && method==="GET")return json({user,paymentsEnabled:!!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET});
    if(!user)return json({error:"Sign in to continue."},401);
    if(!env.DB)throw new ApiError(503,"Your account service is temporarily unavailable. Your draft is still here.");
    const db=env.DB;
    const homeResponse=await homePhotoRoute(request,db,env.BUCKET,user);if(homeResponse)return homeResponse;
    if(path==="/api/cases" && method==="GET"){
      const row=await db.prepare("SELECT payload, revision FROM case_archives WHERE user_id=?").bind(user.id).first<{payload:string;revision:number}>();
      return json({archive:row?JSON.parse(row.payload):null,revision:row?.revision??0});
    }
    if(path==="/api/cases" && method==="PUT"){
      const parsed=archiveSchema.safeParse(await body(request,2_000_000));if(!parsed.success)throw new ApiError(400,"Some saved assessment fields are invalid. Keep your draft open.");
      const {archive,revision,ownerId}=parsed.data;
      if(ownerId!==user.id)throw new ApiError(403,"Your signed-in account changed. Reload before saving.");
      if(new Set(archive.cases.map(c=>c.id)).size!==archive.cases.length || !archive.cases.some(c=>c.id===archive.activeId))throw new ApiError(400,"The selected assessment is missing or duplicated.");
      const old=await db.prepare("SELECT payload, revision FROM case_archives WHERE user_id=?").bind(user.id).first<{payload:string;revision:number}>();
      if((old?.revision??0)!==revision)throw new ApiError(409,"A newer version was saved elsewhere. Your changes have not overwritten it.");
      if(old && !preservedHistory(JSON.parse(old.payload),archive))throw new ApiError(409,"Earlier cases and signed reports must be preserved. Create an amendment to make changes.");
      const now=new Date().toISOString(),payload=JSON.stringify(archive);
      const result=old?await db.prepare("UPDATE case_archives SET payload=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?").bind(payload,now,user.id,revision).run():await db.prepare("INSERT INTO case_archives (user_id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO NOTHING").bind(user.id,payload,now).run();
      if(result.meta.changes!==1)throw new ApiError(409,"Another save arrived first. Reload before continuing.");
      return json({revision:revision+1});
    }
    if(path==="/api/providers" && method==="GET")return json({providers:(await db.prepare("SELECT id,name,service,area,credentials,status FROM providers WHERE status='verified' ORDER BY name").all()).results});
    if(path==="/api/requests" && method==="GET")return json({requests:(await db.prepare(requestSelect+" WHERE r.user_id=? ORDER BY r.created_at DESC").bind(user.id).all()).results});
    if(path==="/api/requests" && method==="POST"){
      const p=requestSchema.safeParse(await body(request));if(!p.success)throw new ApiError(400,p.error.issues[0]?.message??"Check your contact details.");
      const v=p.data,existing=await db.prepare("SELECT * FROM service_requests WHERE id=?").bind(v.idempotencyKey).first();
      if(existing){if(existing.user_id!==user.id)throw new ApiError(409,"Please refresh this request form.");return json({request:{...existing,createdAt:existing.created_at}});}
      const count=await db.prepare("SELECT COUNT(*) AS total FROM service_requests WHERE user_id=? AND created_at>?").bind(user.id,new Date(Date.now()-86400000).toISOString()).first<{total:number}>();
      if((count?.total??0)>=10)throw new ApiError(429,"You have several recent requests. Review My requests before sending another.");
      const now=new Date().toISOString();
      let sharedHome:string|null=null;
      if(v.shareAssessment){
        const archive=await db.prepare("SELECT payload FROM case_archives WHERE user_id=?").bind(user.id).first<{payload:string}>();
        const cases=archive?JSON.parse(archive.payload).cases:[];
        const found=cases.find((c:{id:string})=>c.id===v.caseId);
        const checked=savedCaseSchema.safeParse(found);
        if(!checked.success || checked.data.audience!=="family" || !checked.data.spaces?.length)throw new ApiError(400,"Save your home check before sharing it. You can also send a request without the check.");
        const home=checked.data,spaces=home.spaces!;
        const report=buildFamilyReport(spaces.map(s=>({id:s.id,label:s.level?`${s.label} · Level ${s.level}`:s.label,template:familyTemplateFor(s)})),home.familyAnswers??{});
        sharedHome=JSON.stringify({rooms:spaces.map(s=>s.label),summary:[...profileLines(home.homeProfile),"",reportToPlainText(report)].join("\n"),savedAt:now});
      }
      await db.batch([
        db.prepare("INSERT INTO service_requests (id,user_id,email,service,name,postal_code,phone,contact_method,relationship,status,consent_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'submitted',?,?,?) ON CONFLICT(id) DO NOTHING").bind(v.idempotencyKey,user.id,user.email,v.service,v.name,v.postalCode,v.phone,v.contactMethod,v.relationship,now,now,now),
        db.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) VALUES (?,?,?,'submitted',?) ON CONFLICT(id) DO NOTHING").bind(v.idempotencyKey+":submitted",v.idempotencyKey,user.id,now),
        ...(sharedHome?[db.prepare("INSERT INTO home_handoffs (request_id,payload,consent_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM service_requests WHERE id=? AND user_id=?) ON CONFLICT(request_id) DO NOTHING").bind(v.idempotencyKey,sharedHome,now,v.idempotencyKey,user.id)]:[]),
      ]);
      const created=await db.prepare("SELECT * FROM service_requests WHERE id=? AND user_id=?").bind(v.idempotencyKey,user.id).first();
      if(!created)throw new ApiError(409,"Please refresh this request form.");
      return json({request:{...created,createdAt:created.created_at}},201);
    }
    const accept=path.match(/^\/api\/requests\/([\w-]+)\/accept$/);
    if(accept && method==="POST"){
      const p=z.object({quoteVersion:z.number().int().positive()}).parse(await body(request));
      const result=await db.prepare("UPDATE service_requests SET status='accepted',updated_at=? WHERE id=? AND user_id=? AND status='quoted' AND quote_version=?").bind(new Date().toISOString(),accept[1],user.id,p.quoteVersion).run();
      if(result.meta.changes!==1)throw new ApiError(409,"This proposal changed. Refresh and review the current details.");
      await db.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) VALUES (?,?,?,'accepted',?) ON CONFLICT(id) DO NOTHING").bind(accept[1]+":accepted:"+p.quoteVersion,accept[1],user.id,new Date().toISOString()).run();
      return json({accepted:true});
    }
    const checkout=path.match(/^\/api\/requests\/([\w-]+)\/checkout$/);
    if(checkout && method==="POST"){
      if(!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.APP_ORIGIN)throw new ApiError(503,"Payment is not enabled yet. Your accepted proposal is saved; no charge has been made.");
      const p=z.object({quoteVersion:z.number().int().positive()}).parse(await body(request));
      const row=await db.prepare("SELECT * FROM service_requests WHERE id=? AND user_id=?").bind(checkout[1],user.id).first();
      if(!row)throw new ApiError(404,"Request not found.");
      if(row.status!=="accepted" || row.quote_version!==p.quoteVersion || typeof row.amount_cents!=="number")throw new ApiError(409,"Refresh and review your current proposal before paying.");
      const session=await createCheckout({secretKey:env.STRIPE_SECRET_KEY,requestId:String(row.id),quoteVersion:String(row.quote_version),amountCents:row.amount_cents,currency:"usd",origin:env.APP_ORIGIN});
      const result=await db.prepare("UPDATE service_requests SET payment_session_id=? WHERE id=? AND user_id=? AND status='accepted' AND quote_version=?").bind(session.id,row.id,user.id,p.quoteVersion).run();
      if(result.meta.changes!==1)throw new ApiError(409,"The proposal changed. Refresh your requests.");
      return json({url:session.url});
    }
    if(path.startsWith("/api/admin")){
      if(!user.isAdmin)throw new ApiError(403,"This area is for MyIntel staff.");
      if(path==="/api/admin/requests" && method==="GET")return json({requests:(await db.prepare(requestSelect+" ORDER BY r.created_at DESC LIMIT 200").all()).results});
      if(path==="/api/admin/providers" && method==="GET")return json({providers:(await db.prepare("SELECT * FROM providers ORDER BY created_at DESC").all()).results});
      if(path==="/api/admin/providers" && method==="POST"){
        const p=z.object({name:z.string().trim().min(2).max(150),service:serviceSchema,area:z.string().trim().min(2).max(120),credentials:z.string().trim().min(2).max(200),verificationNote:z.string().trim().min(10).max(1000)}).parse(await body(request));
        const id=crypto.randomUUID();await db.prepare("INSERT INTO providers (id,name,service,area,credentials,verification_note,status,created_at) VALUES (?,?,?,?,?,?,'verified',?)").bind(id,p.name,p.service,p.area,p.credentials,p.verificationNote,new Date().toISOString()).run();return json({id},201);
      }
      const edit=path.match(/^\/api\/admin\/requests\/([\w-]+)$/);
      if(edit && method==="PATCH"){
        const p=z.object({quoteVersion:z.number().int().nonnegative(),status:z.enum(["reviewing","quoted","completed","cancelled"]),providerId:z.string().optional(),scope:z.string().trim().max(2000).optional(),amountCents:z.number().int().min(100).max(1000000).optional()}).parse(await body(request));
        const current=await db.prepare("SELECT * FROM service_requests WHERE id=?").bind(edit[1]).first();if(!current)throw new ApiError(404,"Request not found.");
        if(current.quote_version!==p.quoteVersion || ["cancelled","completed"].includes(String(current.status)))throw new ApiError(409,"This request changed or is closed. Refresh the queue.");
        if(["paid","completed","accepted"].includes(String(current.status)) && p.status!=="completed")throw new ApiError(409,"This accepted or paid proposal cannot be changed here.");
        if(p.status==="completed" && !["paid","accepted"].includes(String(current.status)))throw new ApiError(409,"A proposal must be accepted before completing the service.");
        if(p.status==="completed" && current.status==="accepted" && current.payment_session_id)throw new ApiError(409,"Wait for payment confirmation before completing this service.");
        let result;
        if(p.status==="quoted"){
          if(!p.providerId || !p.scope || !p.amountCents)throw new ApiError(400,"Select a verified provider and add the scope and price.");
          const provider=await db.prepare("SELECT id FROM providers WHERE id=? AND status='verified' AND service=?").bind(p.providerId,current.service).first();if(!provider)throw new ApiError(400,"Select a verified professional for this service.");
          result=await db.prepare("UPDATE service_requests SET status='quoted',provider_id=?,scope=?,amount_cents=?,quote_version=quote_version+1,payment_session_id=NULL,updated_at=? WHERE id=? AND status=? AND quote_version=?").bind(p.providerId,p.scope,p.amountCents,new Date().toISOString(),edit[1],current.status,p.quoteVersion).run();
        }else result=await db.prepare("UPDATE service_requests SET status=?,updated_at=? WHERE id=? AND status=? AND quote_version=?").bind(p.status,new Date().toISOString(),edit[1],current.status,p.quoteVersion).run();
        if(result.meta.changes!==1)throw new ApiError(409,"Another update arrived first. Refresh the queue.");
        await db.prepare("INSERT INTO request_events (id,request_id,actor_id,status,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),edit[1],user.id,p.status,new Date().toISOString()).run();
        return json({updated:true});
      }
    }
    return json({error:"This action was not found."},404);
  }catch(error){
    if(error instanceof ApiError)return json({error:error.message},error.status);
    if(error instanceof z.ZodError)return json({error:"Check the form fields and try again."},400);
    console.error("MyIntel API request failed",error instanceof Error?error.name:"Unknown error");
    return json({error:"We could not save this right now. Your information is still in the form. Please try again."},503);
  }
}
