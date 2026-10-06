// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {HomeSetup} from "@/components/HomeSetup";
import {useCase,type CaseApi} from "@/lib/case-store";
let root:Root,container:HTMLDivElement,api:CaseApi;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.restoreAllMocks()});
it("requires a selection and keeps existing room identity when a space is left out and restored",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
 container=document.createElement("div");document.body.append(container);root=createRoot(container);
 function Harness(){api=useCase();return createElement(HomeSetup,{api,step:"home"})}
 await act(async()=>root.render(createElement(Harness)));
 const submit=()=>container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
 const choose=async(text:string)=>{const input=[...container.querySelectorAll("label")].find(l=>l.textContent?.startsWith(text)&&l.querySelector('input[type="checkbox"]'))?.querySelector<HTMLInputElement>('input[type="checkbox"]');expect(input).toBeTruthy();await act(async()=>input!.click())};
 const prepare=async()=>act(async()=>container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(submit().disabled).toBe(true);
 await choose("Bedroom");await choose("Toilet / half bath");expect(submit().disabled).toBe(false);
 expect(container.textContent).toContain("2 spaces selected");await prepare();await act(async()=>api.prepareHomeRooms());
 const bedroom=api.state.spaces.find(s=>s.type==="bedroom")!;
 expect(api.state.spaces.find(s=>s.type==="bathroom")?.familyKind).toBe("half_bath");
 await choose("Bedroom");await prepare();expect(api.state.spaces.find(s=>s.id===bedroom.id)?.excludedFromHome).toBe(true);
 await choose("Bedroom");await prepare();expect(api.state.spaces.find(s=>s.type==="bedroom")?.id).toBe(bedroom.id);
 expect(api.state.spaces.find(s=>s.id===bedroom.id)?.excludedFromHome).toBe(false);
});
