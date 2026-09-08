import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createHmac} from "node:crypto";
import {handleApi,type Env} from "../../worker/api";
import {SqliteTestDatabase} from "./sqlite-test-db";
let db:SqliteTestDatabase,env:Env;
const origin="https://myintel.example";
const requestId="00000000-0000-4000-8000-000000000001";
function post(path:string,data:unknown,user="owner-a"){
  return handleApi(new Request(origin+path,{method:"POST",headers:{origin,"content-type":"application/json","oai-authenticated-user-id":user,"oai-authenticated-user-email":user+"@example.test"},body:JSON.stringify(data)}),env);
}
function signedEvent(overrides:Record<string,unknown>={},eventId="evt_test"){
  const object={id:"cs_test",payment_status:"paid",amount_total:12500,currency:"usd",metadata:{requestId,quoteVersion:"1"},...overrides};
  const raw=JSON.stringify({id:eventId,type:"checkout.session.completed",data:{object}}),timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac("sha256","whsec_test").update(timestamp+"."+raw).digest("hex");
  return new Request(origin+"/api/stripe/webhook",{method:"POST",headers:{"stripe-signature":`t=${timestamp},v1=${signature}`},body:raw});
}
const row=()=>db.sqlite.prepare("SELECT * FROM service_requests WHERE id=?").get(requestId)!;
beforeEach(()=>{
  db=new SqliteTestDatabase();env={DB:db,ASSETS:{fetch:async()=>new Response("asset")},APP_ORIGIN:origin,STRIPE_SECRET_KEY:"sk_test",STRIPE_WEBHOOK_SECRET:"whsec_test"};
  db.sqlite.prepare("INSERT INTO service_requests (id,user_id,email,service,name,postal_code,contact_method,relationship,status,consent_at,scope,amount_cents,quote_version,created_at,updated_at) VALUES (?, 'owner-a','example@example.test','professional_assessment','Example User','00000','email','self','accepted','now','Example scope',12500,1,'now','now')").run(requestId);
});
afterEach(()=>{db.close();vi.unstubAllGlobals()});
it("fails closed without both payment secrets",async()=>{
  delete env.STRIPE_WEBHOOK_SECRET;
  const mock=vi.fn();vi.stubGlobal("fetch",mock);
  expect((await post(`/api/requests/${requestId}/checkout`,{quoteVersion:1})).status).toBe(503);expect(mock).not.toHaveBeenCalled();expect(row().status).toBe("accepted");
});
it("uses the accepted server price and isolates checkout ownership",async()=>{
  const mock=vi.fn().mockResolvedValue(Response.json({id:"cs_test",url:"https://checkout.stripe.com/c/pay/example"}));vi.stubGlobal("fetch",mock);
  expect((await post(`/api/requests/${requestId}/checkout`,{quoteVersion:1},"other")).status).toBe(404);
  expect((await post(`/api/requests/${requestId}/checkout`,{quoteVersion:2})).status).toBe(409);
  const result=await post(`/api/requests/${requestId}/checkout`,{quoteVersion:1,amountCents:1});expect(result.status).toBe(200);
  const data=mock.mock.calls[0]![1].body as URLSearchParams;
  expect(data.get("line_items[0][price_data][unit_amount]")).toBe("12500");expect(data.get("customer_email")).toBeNull();
  expect(row().payment_session_id).toBe("cs_test");expect(row().status).toBe("accepted");
});
it("does not treat a return URL as payment confirmation",async()=>{
  const result=await handleApi(new Request(origin+"/api/requests?checkout=returned",{headers:{"oai-authenticated-user-id":"owner-a","oai-authenticated-user-email":"example@example.test"}}),env);
  expect(result.status).toBe(200);expect(row().status).toBe("accepted");
});
it("rejects forged notifications without changing the request",async()=>{
  expect((await handleApi(new Request(origin+"/api/stripe/webhook",{method:"POST",body:"{}"}),env)).status).toBe(400);expect(row().status).toBe("accepted");
});
it.each([{amount_total:1},{currency:"eur"},{id:"cs_other"},{metadata:{requestId,quoteVersion:"2"}}])("rejects a signed payment that mismatches its proposal: %j",async(overrides)=>{
  db.sqlite.prepare("UPDATE service_requests SET payment_session_id='cs_test'").run();
  expect((await handleApi(signedEvent(overrides),env)).status).toBe(409);expect(row().status).toBe("accepted");
});
it("records matching paid notification once across event retries",async()=>{
  db.sqlite.prepare("UPDATE service_requests SET payment_session_id='cs_test'").run();
  expect((await handleApi(signedEvent(),env)).status).toBe(200);
  expect((await handleApi(signedEvent(),env)).status).toBe(200);
  expect((await handleApi(signedEvent({},"evt_second"),env)).status).toBe(200);
  expect(row().status).toBe("paid");
  expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM payment_events").get()!.n).toBe(1);
  expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM request_events WHERE status='paid'").get()!.n).toBe(1);
});
it("waits for asynchronous payment settlement",async()=>{
  db.sqlite.prepare("UPDATE service_requests SET payment_session_id='cs_test'").run();
  expect((await handleApi(signedEvent({payment_status:"unpaid"}),env)).status).toBe(200);expect(row().status).toBe("accepted");
});
