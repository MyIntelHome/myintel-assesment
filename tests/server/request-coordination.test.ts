import {handleSitesApi as handleApi} from "../../worker/sites-api";
import {beforeEach,afterEach,expect,it} from "vitest";
import {type Env} from "../../worker/api";
import {SqliteTestDatabase} from "./sqlite-test-db";
let db:SqliteTestDatabase,env:Env;
beforeEach(()=>{db=new SqliteTestDatabase();env={DB:db,ASSETS:{fetch:async()=>new Response("")},MYINTEL_ADMIN_EMAIL:"staff@example.test"}});
afterEach(()=>db.close());
async function call(path:string,method="GET",staff=true,data?:unknown,id="staff"){
 const r=await handleApi(new Request("https://app.test"+path,{method,headers:{"origin":"https://app.test","content-type":"application/json","oai-authenticated-user-id":staff?id:"client","oai-authenticated-user-email":staff?"staff@example.test":"client@example.test"},body:data?JSON.stringify(data):undefined}),env);return {status:r.status,data:await r.json()};
}
async function request(){
 const id=crypto.randomUUID();
 expect((await call("/api/requests","POST",false,{idempotencyKey:id,service:"care_navigation",name:"Example Client",postalCode:"80202",contactMethod:"email",relationship:"self",consent:true})).status).toBe(201);return id;
}
it("requires staff access and records an idempotent claim with no client-visible staff identifiers",async()=>{
 const id=await request(),path="/api/admin/requests/"+id+"/claim";
 expect((await call(path,"POST",false)).status).toBe(403);
 expect((await call(path,"POST")).status).toBe(200);expect((await call(path,"POST")).status).toBe(200);
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM request_events WHERE status='coordinator_assigned'").get()!.n).toBe(1);
 expect((await call("/api/admin/requests")).data.requests[0].coordinator_id).toBe("staff");
 expect((await call("/api/requests","GET",false)).data.requests[0].coordinator_id).toBeUndefined();
});
it("does not let another verified staff identity steal or release ownership",async()=>{
 const path="/api/admin/requests/"+await request()+"/claim";
 await call(path,"POST");
 expect((await call(path,"POST",true,undefined,"other-staff")).status).toBe(409);
 await call(path,"DELETE",true,undefined,"other-staff");
 expect(db.sqlite.prepare("SELECT staff_id FROM request_coordinators").get()!.staff_id).toBe("staff");
 await call(path,"DELETE");await call(path,"DELETE");
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM request_events WHERE status='coordinator_released'").get()!.n).toBe(1);
 expect((await call(path,"POST",true,undefined,"other-staff")).status).toBe(200);
});
it("rejects missing and closed requests",async()=>{
 expect((await call("/api/admin/requests/missing/claim","POST")).status).toBe(404);
 const id=await request();db.sqlite.prepare("UPDATE service_requests SET status='cancelled' WHERE id=?").run(id);
 expect((await call("/api/admin/requests/"+id+"/claim","POST")).status).toBe(409);
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM request_coordinators").get()!.n).toBe(0);
});
