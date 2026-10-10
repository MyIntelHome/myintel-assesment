// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {canStartProfessionalCase,canOpenProfessionalCase,ProfessionalPricing,type ProfessionalBillingStatus} from "@/components/ProfessionalBilling";
const status=(patch:Partial<ProfessionalBillingStatus>={}):ProfessionalBillingStatus=>({enabled:true,checkoutEnabled:true,demoAvailable:true,remaining:0,subscriptionActive:false,renewalAt:null,allocations:[],...patch});
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.restoreAllMocks()});
describe("professional assessment billing gates",()=>{
 it("limits the free demo to one reserved draft while permitting its continuation",()=>{
  expect(canStartProfessionalCase(status())).toBe(true);
  const reserved=status({demoAvailable:false,allocations:[{case_id:"demo",state:"reserved"}]});
  expect(canStartProfessionalCase(reserved)).toBe(false);
  expect(canOpenProfessionalCase(reserved,"demo",false)).toBe(true);
  expect(canOpenProfessionalCase(reserved,"other",false)).toBe(false);
  expect(canStartProfessionalCase(status({allocations:[{case_id:"demo",state:"reserved"}]}))).toBe(false);
 });
 it("requires prepaid credits after demo while preserving completed reports and corrections",()=>{
  const paid=status({demoAvailable:false,remaining:1});
  expect(canStartProfessionalCase(paid)).toBe(true);
  expect(canOpenProfessionalCase(paid,"old-unpaid-draft",false)).toBe(true);
  const used=status({demoAvailable:false,allocations:[{case_id:"completed",state:"completed"}]});
  expect(canStartProfessionalCase(used)).toBe(false);
  expect(canOpenProfessionalCase(used,"completed",false)).toBe(true);
  expect(canOpenProfessionalCase(used,"legacy-report",true)).toBe(true);
  expect(canOpenProfessionalCase(null,"legacy-report",true)).toBe(true);
  expect(canStartProfessionalCase(null)).toBe(false);
 });
 it("preserves unrestricted behavior only when billing is explicitly disabled",()=>{
  const disabled=status({enabled:false,demoAvailable:false});
  expect(canStartProfessionalCase(disabled)).toBe(true);
  expect(canOpenProfessionalCase(disabled,"draft",false)).toBe(true);
 });
});
async function render(props:Parameters<typeof ProfessionalPricing>[0]){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement("div");document.body.append(container);root=createRoot(container);
 await act(async()=>root!.render(createElement(ProfessionalPricing,props)));return container;
}
it("shows prices before sign-up without offering checkout or promising an enabled demo",async()=>{
 const el=await render({});expect(el.textContent).toContain("$19");expect(el.textContent).toContain("$49");expect(el.textContent).toContain("$10");expect(el.textContent).toContain("Planned offer");expect(el.querySelector("button")).toBeNull();
});
it("disables checkout when payments are unavailable",async()=>{
 const purchase=vi.fn();const el=await render({approved:true,status:status({enabled:false}),onPurchase:purchase});
 expect(el.textContent).toContain("free demo offer are not enabled");for(const button of el.querySelectorAll<HTMLButtonElement>("button")){expect(button.disabled).toBe(true);button.click()}expect(purchase).not.toHaveBeenCalled();
});
it("offers an explicit prepaid extra only for an active subscription",async()=>{
 const purchase=vi.fn();const el=await render({approved:true,status:status({subscriptionActive:true}),onPurchase:purchase});
 const extra=[...el.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.includes("Buy extra"))!;expect(extra.disabled).toBe(false);await act(async()=>extra.click());expect(purchase).toHaveBeenCalledWith("extra");expect(el.textContent).toContain("No automatic overage");
});
