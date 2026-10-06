import {handleSitesApi as handleApi} from "../../worker/sites-api";
import {afterEach,beforeEach,expect,it} from "vitest";
import {type Env} from "../../worker/api";
import {SqliteTestDatabase} from "./sqlite-test-db";
import {normalise} from "../../src/lib/case-store";
import {EMPTY_SIGNOFF} from "../../src/domain/case";
import {visitContextSignature} from "../../src/domain/visit-review";
import {createReportVersion} from "../../src/domain/report-version";
import {buildCaseView} from "../../src/lib/selectors";
let db:SqliteTestDatabase,env:Env;
const origin="https://myintel.test";
const application={name:"Example OT",practice:"Example Practice",credential:"OT 123",region:"MA"};
beforeEach(()=>{db=new SqliteTestDatabase();env={DB:db,ASSETS:{fetch:async()=>new Response("")},MYINTEL_ADMIN_EMAIL:"admin@example.test"}});
afterEach(()=>db.close());
async function call(path:string,user="client",method="GET",data?:unknown){
 const response=await handleApi(new Request(origin+path,{method,headers:{"oai-authenticated-user-id":user,"oai-authenticated-user-email":user+"@example.test","origin":origin,"content-type":"application/json"},body:data?JSON.stringify(data):undefined}),env);return {status:response.status,data:await response.json()};
}
async function approve(){await call("/api/professional-access","client","POST",application);return call("/api/admin/professional-access","admin","PATCH",{userId:"client",revision:1,status:"approved",note:"Verified example credential independently."})}
const record=(id:string,audience="family")=>({id,audience,spaces:[],responses:{},plan:[],reportVersions:[]});
function signedCase(){const c=normalise({id:"clinical",audience:"clinician",spaces:[{id:"bed",type:"bedroom",label:"Bedroom"}],responses:{bed:{br1:{status:"pass"}}},visit:{deferred:[]},signoff:{...EMPTY_SIGNOFF,assessorName:"Assessor",credentials:"OT",partialAssessmentReason:"Limited visit; follow-up needed for remaining checks."}});c.visit!.contextReviewed=visitContextSignature(c);const v=createReportVersion(c,buildCaseView(c),"2026-10-06T12:00:00.000Z","report");return {...c,signoff:v.caseData.signoff,reportVersions:[v]}}
it("recomputes sign-off on the server and rejects forged coverage or missing context review",async()=>{
 await approve();const valid=signedCase();
 const write=(c:typeof valid)=>call("/api/cases?audience=clinician","client","PUT",{ownerId:"client",revision:0,archive:{activeId:c.id,cases:[c]}});
 const missing=structuredClone(valid);delete missing.visit;delete missing.reportVersions[0]!.caseData.visit;expect((await write(missing)).status).toBe(400);
 const forged=structuredClone(valid);forged.reportVersions[0]!.view={...forged.reportVersions[0]!.view,completeness:{...forged.reportVersions[0]!.view.completeness,percent:100}};expect((await write(forged)).status).toBe(400);
 const empty=structuredClone(valid);empty.reportVersions[0]!.caseData.responses={};expect((await write(empty)).status).toBe(400);
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM case_archives").get()!.n).toBe(0);
 const result=await write(valid);expect(result.status,result.data.error).toBe(200);expect((await call("/api/cases?audience=clinician")).data.archive.cases[0].reportVersions[0].caseData.visit.contextReviewed).toBe(valid.visit!.contextReviewed);
});
it("blocks clients and staff from clinical reads/writes without professional approval",async()=>{
 for(const user of ["client","admin"]){expect((await call("/api/cases?audience=clinician",user)).status).toBe(403);expect((await call("/api/cases?audience=clinician",user,"PUT",{})).status).toBe(403)}
 expect((await call("/api/admin/professional-access")).status).toBe(403);
});
it("does not accept self-approved roles and leaves pending requests blocked",async()=>{
 expect((await call("/api/professional-access","client","POST",{...application,status:"approved"})).status).toBe(400);
 expect((await call("/api/professional-access","client","POST",application)).status).toBe(201);
 expect((await call("/api/cases?audience=clinician")).status).toBe(403);
 expect((await call("/api/admin/professional-access","client","PATCH",{userId:"client",revision:1,status:"approved",note:"I approve myself."})).status).toBe(403);
 expect((await call("/api/professional-access","client","POST",application)).status).toBe(409);
});
it("approves, audits, rejects stale decisions and immediately blocks revoked access",async()=>{
 expect((await approve()).status).toBe(200);
 expect((await call("/api/account")).data.professionalAccess.status).toBe("approved");
 expect((await call("/api/cases?audience=clinician")).status).toBe(200);
 expect((await call("/api/cases?audience=clinician","other")).status).toBe(403);
 expect((await call("/api/admin/professional-access","admin","PATCH",{userId:"client",revision:1,status:"rejected",note:"This review is stale."})).status).toBe(409);
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM professional_access_events").get()!.n).toBe(1);
 expect((await call("/api/admin/professional-access","admin","PATCH",{userId:"client",revision:2,status:"revoked",note:"Example credential expired."})).status).toBe(200);
 expect((await call("/api/cases?audience=clinician")).status).toBe(403);
 expect((await call("/api/cases?audience=clinician","client","PUT",{})).status).toBe(403);
 expect((await call("/api/cases")).status).toBe(200);
});
it("partitions legacy mixed archives, preserves hidden records on save and rejects cross-scope IDs",async()=>{
 const home=record("home"),clinical=record("clinical","clinician");
 db.sqlite.prepare("INSERT INTO case_archives(user_id,payload,revision,updated_at) VALUES (?,?,1,?)").run("client",JSON.stringify({activeId:"clinical",cases:[home,clinical]}),"now");
 const client=await call("/api/cases");expect(client.data.archive).toEqual({activeId:"home",cases:[home]});
 expect((await call("/api/cases","client","PUT",{ownerId:"client",revision:1,archive:{activeId:"home",cases:[{...home,reference:"Updated home"}]}})).status).toBe(200);
 expect(JSON.parse(db.sqlite.prepare("SELECT payload FROM case_archives").get()!.payload as string).cases).toContainEqual(clinical);
 expect((await call("/api/cases","client","PUT",{ownerId:"client",revision:2,archive:{activeId:"clinical",cases:[record("clinical")]}})).status).toBe(403);
 await approve();
 expect((await call("/api/cases?audience=clinician")).data.archive.cases).toEqual([clinical]);
 expect((await call("/api/cases?audience=clinician","client","PUT",{ownerId:"client",revision:2,archive:{activeId:"clinical",cases:[{...clinical,reference:"Updated clinical"}]}})).status).toBe(200);
 expect((await call("/api/cases")).data.archive.cases[0].reference).toBe("Updated home");
});
it("rejects clinical content disguised as a family record",async()=>{
 const home=record("home");
 expect((await call("/api/cases","client","PUT",{ownerId:"client",revision:0,archive:{activeId:"home",cases:[{...home,responses:{room:{item:{status:"concern"}}}}]}})).status).toBe(403);
 expect((await call("/api/cases?audience=invalid")).status).toBe(400);
});
