// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import ProfessionalHelp from "@/components/ProfessionalHelp";
import {RequestCenter} from "@/components/RequestCenter";
let root:Root,container:HTMLDivElement;
const fetchMock=vi.fn();
const user={id:"example",name:"Example User",email:"example@example.test",isAdmin:false};
function button(text:string){const b=[...container.querySelectorAll("button")].find(e=>e.textContent?.includes(text));if(!b)throw Error("Missing button: "+text);return b}
async function click(text:string){await act(async()=>button(text).click())}
async function fill(id:string,value:string){await act(async()=>{const e=container.querySelector<HTMLInputElement>("#"+id)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(e,value);e.dispatchEvent(new Event("input",{bubbles:true}))})}
async function help(){await act(async()=>root.render(createElement(ProfessionalHelp,{user,onBack:vi.fn(),onRequests:vi.fn()})));await click("Professional assessment");await click("Continue")}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement("div");document.body.append(container);root=createRoot(container);fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock)});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
it("requires ZIP and contact consent before sending a request",async()=>{
  await help();await click("Send my request");expect(fetchMock).not.toHaveBeenCalled();expect(container.textContent).toContain("five-digit US ZIP");expect(container.textContent).toContain("Please agree");
});
it("preserves form details and request identity across a failed submission and retry",async()=>{
  await help();await fill("help-postalCode","00000");await act(async()=>container.querySelector<HTMLInputElement>("#help-consent")!.click());
  fetchMock.mockRejectedValueOnce(Error("Example connection failure"));await click("Send my request");
  expect(container.textContent).toContain("Example connection failure");expect(container.querySelector<HTMLInputElement>("#help-postalCode")!.value).toBe("00000");
  fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({request:{id:"example-request",status:"reviewing",createdAt:new Date().toISOString()}})});
  await click("Send my request");expect(container.textContent).toContain("Your request is saved with MyIntel");
  const first=JSON.parse(fetchMock.mock.calls[0]![1].body),second=JSON.parse(fetchMock.mock.calls[1]![1].body);
  expect(first.idempotencyKey).toBe(second.idempotencyKey);expect(first.email).toBeUndefined();expect(first.consent).toBe(true);expect(container.textContent).not.toContain("Change help type");
});
it("shows the actual provider, scope and price and accepts the displayed quote version",async()=>{
  const request={id:"example-request",service:"professional_assessment",status:"quoted",provider_name:"Example Practice",scope:"Example visit scope",amount_cents:12500,quote_version:4,created_at:"2026-09-08T00:00:00Z"};
  fetchMock.mockResolvedValue({ok:true,json:async()=>({requests:[request]})});
  await act(async()=>root.render(createElement(RequestCenter,{user,paymentsEnabled:false,onNew:vi.fn()})));
  expect(container.textContent).toContain("Example Practice");expect(container.textContent).toContain("Example visit scope");expect(container.textContent).toContain("125");
  const accept=[...container.querySelectorAll("button")].find(b=>b.textContent?.toLowerCase().includes("accept"))!;
  fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({accepted:true})});await act(async()=>accept.click());
  const post=fetchMock.mock.calls.find(c=>c[1]?.method==="POST");expect(JSON.parse(post![1].body)).toEqual({quoteVersion:4});
});
