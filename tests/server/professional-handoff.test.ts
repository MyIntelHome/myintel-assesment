import {afterEach,beforeEach,expect,it} from "vitest";
import {createClient,type Client} from "@libsql/client";
import {handleSitesApi} from "../../worker/sites-api";
import type {Env} from "../../worker/api";
import {LibsqlDatabase} from "../../production/database";
import {applyMigrations,readMigrations} from "../../production/migrations";

const origin="https://myintel.test";
const users={client:{id:"client-a",email:"client@example.test"},professional:{id:"professional-a",email:"pro@example.test"},other:{id:"professional-b",email:"other@example.test"},staff:{id:"staff-a",email:"staff@example.test"},staff2:{id:"staff-b",email:"staff@example.test"}};
let client:Client,db:LibsqlDatabase,env:Env;
function headers(user:keyof typeof users){const value=users[user];return {origin,"content-type":"application/json","oai-authenticated-user-id":value.id,"oai-authenticated-user-email":value.email,"oai-authenticated-user-full-name":encodeURIComponent(value.id),"oai-authenticated-user-full-name-encoding":"percent-encoded-utf-8"};}
const raw=(path:string,method="GET",user:keyof typeof users="client",data?:unknown)=>handleSitesApi(new Request(origin+path,{method,headers:headers(user),body:data===undefined?undefined:JSON.stringify(data)}),env);
async function call(path:string,method="GET",user:keyof typeof users="client",data?:unknown){const response=await raw(path,method,user,data);return {status:response.status,data:await response.json()};}
async function seed({home=false}={}){
 const requestId=crypto.randomUUID(),now=new Date().toISOString();
 await db.prepare("INSERT INTO professional_access (user_id,email,name,practice,credential,region,status,revision,review_note,updated_at) VALUES (?,?,?,?,?,?,'approved',1,'verified',?)").bind(users.professional.id,users.professional.email,"Example OT","Example Practice","OT license","Colorado",now).run();
 await db.prepare("INSERT INTO professional_access (user_id,email,name,practice,credential,region,status,revision,review_note,updated_at) VALUES (?,?,?,?,?,?,'approved',1,'verified',?)").bind(users.other.id,users.other.email,"Other OT","Other Practice","OT license","Colorado",now).run();
 await db.prepare("INSERT INTO providers (id,name,service,area,credentials,verification_note,status,created_at) VALUES ('provider-a','Example Practice','home_modifications','Denver','Reviewed credentials','Verified for test fixture','verified',?)").bind(now).run();
 expect((await call("/api/admin/providers/provider-a/account","PUT","staff",{userId:users.professional.id,revision:0})).status).toBe(200);
 await db.prepare("INSERT INTO service_requests (id,user_id,email,service,name,postal_code,phone,contact_method,relationship,status,consent_at,provider_id,scope,amount_cents,quote_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'quoted',?,'provider-a','Install reviewed grab bars',25000,1,?,?)").bind(requestId,users.client.id,users.client.email,"home_modifications","Example Client","80202","3035550100","email","self",now,now,now).run();
 if(home){
  await db.prepare("INSERT INTO home_handoffs (request_id,payload,consent_at) VALUES (?,?,?)").bind(requestId,JSON.stringify({rooms:["Bathroom"],summary:"Customer snapshot",savedAt:now}),now).run();
  await db.prepare("INSERT INTO home_photos (id,request_id,room,kind,object_key,ready,created_at) VALUES ('photo-one',?,'Bathroom','wide',?,1,?)").bind(requestId,`home-photos/${requestId}/photo-one.jpg`,now).run();
 }
 return requestId;
}
beforeEach(async()=>{client=createClient({url:":memory:"});await applyMigrations(client,await readMigrations());db=new LibsqlDatabase(client);env={DB:db,ASSETS:{fetch:async()=>new Response("")},MYINTEL_ADMIN_EMAIL:users.staff.email,BUCKET:{put:async()=>{},delete:async()=>{},get:async()=>({body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array([255,216,255,217]));controller.close();}})})}};});
afterEach(()=>client.close());

it("shares contact details only with the approved account linked to the named proposal",async()=>{
 const id=await seed(),path=`/api/requests/${id}/professional-handoff`;
 expect((await call(path)).data).toMatchObject({providerReady:true,providerName:"Example Practice",handoff:null});
 expect((await call(path,"POST","client",{quoteVersion:1,shareContact:true,shareHome:false,sharePhotos:false})).status).toBe(200);
 const own=await call("/api/professional/referrals","GET","professional");expect(own.status).toBe(200);expect(own.data.referrals[0]).toMatchObject({id,email:users.client.email,phone:"3035550100"});
 expect((await call("/api/professional/referrals","GET","other")).data.referrals).toEqual([]);
 expect((await db.prepare("SELECT action FROM request_professional_events WHERE request_id=?").bind(id).all()).results).toEqual([{action:"consented"}]);
 expect((await call(path,"DELETE","client")).data.revoked).toBe(true);
 expect((await call("/api/professional/referrals","GET","professional")).data.referrals).toEqual([]);
});

it("shares only the home snapshot and photo IDs selected at consent time",async()=>{
 const id=await seed({home:true}),path=`/api/requests/${id}/professional-handoff`;
 expect((await call(path,"POST","client",{quoteVersion:1,shareContact:true,shareHome:true,sharePhotos:true})).status).toBe(200);
 await db.prepare("INSERT INTO home_photos (id,request_id,room,kind,object_key,ready,created_at) VALUES ('later-photo',?,'Bathroom','detail',?,1,?)").bind(id,`home-photos/${id}/later-photo.jpg`,new Date().toISOString()).run();
 const review=await call(`/api/professional/referrals/${id}/home-review`,`GET`,`professional`);expect(review.status).toBe(200);expect(review.data.review.summary).toBe("Customer snapshot");expect(review.data.photos.map((photo:{id:string})=>photo.id)).toEqual(["photo-one"]);
 expect((await raw(`/api/professional/referrals/${id}/home-review/photos/photo-one`,`GET`,`professional`)).status).toBe(200);
 expect((await call(`/api/professional/referrals/${id}/home-review/photos/later-photo`,`GET`,`professional`)).status).toBe(404);
});

it("ends access after approval or account-link changes and requires fresh customer consent",async()=>{
 const id=await seed(),path=`/api/requests/${id}/professional-handoff`;
 await call(path,"POST","client",{quoteVersion:1,shareContact:true,shareHome:false,sharePhotos:false});
 await db.prepare("UPDATE professional_access SET status='revoked' WHERE user_id=?").bind(users.professional.id).run();
 expect((await call("/api/professional/referrals","GET","professional")).status).toBe(403);
 await db.prepare("UPDATE professional_access SET status='approved' WHERE user_id=?").bind(users.professional.id).run();
 expect((await call("/api/admin/providers/provider-a/account","DELETE","staff")).status).toBe(200);
 expect((await call("/api/admin/providers/provider-a/account","PUT","staff",{userId:users.professional.id,revision:2})).status).toBe(200);
 expect((await call("/api/professional/referrals","GET","professional")).data.referrals).toEqual([]);
 expect((await call("/api/admin/providers/provider-a/account","PUT","staff",{userId:users.other.id,revision:3})).status).toBe(200);
 expect((await call("/api/professional/referrals","GET","professional")).data.referrals).toEqual([]);
 expect((await call("/api/professional/referrals","GET","other")).data.referrals).toEqual([]);
 expect((await call(path)).data.handoff.active).toBe(false);
 await call(path,"POST","client",{quoteVersion:1,shareContact:true,shareHome:false,sharePhotos:false});
 expect((await call("/api/professional/referrals","GET","other")).data.referrals).toHaveLength(1);
});

it("keeps follow-up plans with the responsible staff member and preserves history",async()=>{
 const id=await seed(),claim=`/api/admin/requests/${id}/claim`,followup=`/api/admin/requests/${id}/follow-up`,due=new Date(Date.now()+86400000).toISOString();
 expect((await call(followup,"PUT","staff",{revision:0,dueAt:due,note:"Call to confirm next step"})).status).toBe(409);
 await call(claim,"POST","staff");
 expect((await call(followup,"PUT","staff2",{revision:0,dueAt:due,note:"Should not save"})).status).toBe(409);
 expect((await call(followup,"PUT","staff",{revision:0,dueAt:due,note:"Call to confirm next step"})).data.revision).toBe(1);
 expect((await call(followup,"PUT","staff",{revision:0,dueAt:due,note:"Stale edit"})).status).toBe(409);
 const queue=await call("/api/admin/requests","GET","staff");expect(queue.data.requests[0]).toMatchObject({followup_due_at:due,followup_note:"Call to confirm next step",followup_revision:1});
 await call(claim,"DELETE","staff");
 expect(await db.prepare("SELECT * FROM request_followups WHERE request_id=?").bind(id).first()).toBeNull();
 expect((await db.prepare("SELECT note FROM request_followup_events WHERE request_id=?").bind(id).all()).results).toEqual([{note:"Call to confirm next step"}]);
});
