// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {HomeSetup} from "@/components/HomeSetup";
import {ProfessionalContext} from "@/components/ProfessionalContext";
import {VisitReview} from "@/components/VisitReview";
import {AssessStep} from "@/components/AssessStep";
import {useCase,type CaseApi} from "@/lib/case-store";
import {buildCaseView} from "@/lib/selectors";
let root:Root,container:HTMLDivElement,api:CaseApi;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();vi.spyOn(window,"scrollTo").mockImplementation(()=>{});container=document.createElement("div");document.body.append(container);root=createRoot(container)});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.restoreAllMocks()});
async function click(text:string){const b=[...container.querySelectorAll("button")].find(b=>b.textContent?.replace(/^[✓○]\s*/,"")===text);expect(b,`Button: ${text}`).toBeTruthy();await act(async()=>b!.click())}
it("takes a reader from identity through a real selected home into tailored space checks",async()=>{
 function Harness(){api=useCase();return api.state.familyPosition?.phase==="rooms"?createElement("p",{},"Ready for space checks"):createElement(HomeSetup,{api,step:api.state.familyPosition?.phase==="home"?"home":"routine"})}
 await act(async()=>root.render(createElement(Harness)));await click("Myself");await click("Continue");await click("Plan ahead");await click("Continue");
 expect(container.textContent).toContain("understand the home first");const input=[...container.querySelectorAll("label")].find(l=>l.textContent?.startsWith("Bedroom")&&l.querySelector('input[type="checkbox"]'))!.querySelector<HTMLInputElement>("input")!;await act(async()=>input.click());
 await act(async()=>container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(container.textContent).toContain("Which personal activities");await click("Bathing or showering");await click("Continue");await click("None of these");await click("Continue");
 expect(container.textContent).toContain("How is bathing or showering managed?");await click("Need someone's help");await click("Continue");expect(container.textContent).toContain("Which part of bathing");await click("Getting in or out");await click("Continue");expect(container.textContent).toContain("Where does this activity happen?");await click("Somewhere else");await click("Continue");expect(container.textContent).toContain("available help");await click("No, more or different help is needed");await click("Continue");
 await click("Pause these details and review my check");expect(container.textContent).toContain("A check built around");await click("Start my space checks");expect(container.textContent).toContain("Ready for space checks");expect(api.state.homeProfile?.goal).toBe("planning");expect(api.state.homeProfile?.dynamic?.answers["support:bathing"]).toBe("gap");expect(api.state.spaces).toHaveLength(1);expect(api.state.responses).toEqual({});expect(api.state.familyAnswers).toEqual({});
});
it("leaves a deferred observation unknown and routes back to its exact room",async()=>{
 function Harness(){api=useCase({userId:"",audience:"clinician"});return createElement("div",{},createElement(ProfessionalContext,{api}),createElement(AssessStep,{api,view:buildCaseView(api.state)}),createElement(VisitReview,{api,view:buildCaseView(api.state),onGo:t=>api.patchVisit({activeSpaceId:t.spaceId,focusCode:t.code})}))}
 await act(async()=>root.render(createElement(Harness)));await act(async()=>{const id=api.addSpace("bedroom","Demo bedroom");api.patchVisit({activeSpaceId:id,deferred:[]})});const space=api.state.spaces[0]!;
 const item=container.querySelector(`#clinical-${space.id}-br1`)!;const defer=[...item.querySelectorAll("button")].find(b=>b.textContent==="Return to this")!;await act(async()=>defer.click());expect(api.state.responses[space.id]?.br1).toBeUndefined();expect(container.textContent).toContain("Marked return to this");await click("Record context and scope review");expect(container.textContent).toContain("review recorded");
 const review=container.querySelector(".visit-review")!;const task=[...review.querySelectorAll("li")].find(li=>li.textContent?.includes("Marked return to this"))!;await act(async()=>task.querySelector<HTMLButtonElement>("button")!.click());expect(api.state.visit?.focusCode).toBe("br1");
 await click("Remove");expect(api.state.spaces).toHaveLength(1);await click("Keep this space");expect(api.state.spaces).toHaveLength(1);await click("Add");await click("+ Bathroom");expect(container.querySelector<HTMLInputElement>('[aria-label="Space name"]')?.value).toBe("Bathroom");expect(container.textContent).not.toContain("Context and scope review recorded");
});
