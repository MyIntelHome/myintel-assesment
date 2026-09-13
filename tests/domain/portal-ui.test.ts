// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import AppWorkspace from "@/components/AppWorkspace";
import {ProfessionalPortal} from "@/components/ProfessionalPortal";
import type {ProfessionalAccess} from "@/domain/access";
let root:Root,container:HTMLDivElement;
const user={id:"example",name:"Example User",email:"example@example.test",isAdmin:false};
const access:ProfessionalAccess={user_id:user.id,email:user.email,name:user.name,practice:"Example Practice",credential:"OT 123",region:"MA",status:"approved",revision:2,review_note:"Verified",updated_at:"now"};
const fetchMock=vi.fn();
const reply=(value:unknown)=>({ok:true,json:async()=>value});
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();window.history.replaceState(null,"","/");vi.stubGlobal("scrollTo",vi.fn());vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();container=document.createElement("div");document.body.append(container);root=createRoot(container)});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals()});
async function render(element:ReturnType<typeof createElement>){await act(async()=>root.render(element));await act(async()=>vi.advanceTimersByTimeAsync(650))}
it("shows clients only home checks and support, even when legacy device records include clinical work",async()=>{
 localStorage.setItem("myintel.cases.v1",JSON.stringify({activeId:"clinical",cases:[{id:"clinical",audience:"clinician",reference:"PRIVATE CLINICAL"}]}));
 fetchMock.mockResolvedValue(reply({user:null,paymentsEnabled:false}));
 await render(createElement(AppWorkspace));
 expect(container.textContent).toContain("Start a home check");expect(container.textContent).not.toContain("PRIVATE CLINICAL");
 expect(container.textContent).not.toContain("Open clinical workspace");expect(container.textContent).not.toContain("New clinical assessment");
 expect(container.querySelector('a[href="/?portal=professional"]')).not.toBeNull();
});
it.each(["pending","rejected","revoked"] as const)("does not load clinical records for %s access",async(status)=>{
 await render(createElement(ProfessionalPortal,{user,access:{...access,status}}));
 expect(container.textContent).not.toContain("New clinical assessment");expect(fetchMock).not.toHaveBeenCalled();
});
it("uses a dedicated professional dashboard and scoped archive requests",async()=>{
 fetchMock.mockImplementation((path:string,options?:{method:string})=>Promise.resolve(reply(options?.method==="PUT"?{revision:1}:{archive:null,revision:0})));
 await render(createElement(ProfessionalPortal,{user,access}));
 expect(container.textContent).toContain("Your assessment desk.");expect(container.textContent).toContain("Draft assessments");
 expect(container.textContent).not.toContain("Start a home check");expect(container.querySelector('nav[aria-label="Professional navigation"]')).not.toBeNull();
 expect(fetchMock.mock.calls.every(c=>c[0]==="/api/cases?audience=clinician")).toBe(true);
 const start=[...container.querySelectorAll("button")].find(b=>b.textContent==="New clinical assessment")!;
 await act(async()=>start.click());
 expect(container.textContent).toContain("Clinical assessments");
 expect(container.textContent).not.toContain("Get professional help");
});
it("shows only customer-consented requests in the professional handoff view",async()=>{
 fetchMock.mockImplementation((path:string)=>Promise.resolve(reply(path==="/api/professional/referrals"?{referrals:[{id:"request-a",service:"home_modifications",name:"Example Client",email:"client@example.test",phone:"",contact_method:"email",postal_code:"80202",status:"quoted",scope:"Example scope",provider_name:"Example Practice",consent_at:"2026-09-12T00:00:00Z",share_home:0,share_photos:0,updated_at:"2026-09-12T00:00:00Z"}]}:{archive:null,revision:0})));
 await render(createElement(ProfessionalPortal,{user,access}));
 const shared=[...container.querySelectorAll("button")].find(button=>button.textContent==="Shared requests")!;await act(async()=>shared.click());await act(async()=>{});
 expect(container.textContent).toContain("Example Client");expect(container.textContent).toContain("client@example.test");expect(fetchMock).toHaveBeenCalledWith("/api/professional/referrals",{cache:"no-store"});
});
it("keeps professional entry gated when unsigned in",async()=>{
 await render(createElement(ProfessionalPortal,{user:null,access:null}));
 expect(container.querySelector('a[href^="/signin-with-chatgpt"]')?.textContent).toBe("Continue with ChatGPT");
 expect(fetchMock).not.toHaveBeenCalled();expect(container.textContent).not.toContain("New clinical assessment");
});
