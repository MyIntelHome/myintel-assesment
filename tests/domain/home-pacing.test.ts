// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {HomeSectionPause} from "@/components/HomeSectionPause";
import {HomeRoutineConversation} from "@/components/HomeRoutineConversation";
import {useCase} from "@/lib/case-store";
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.spyOn(window,"scrollTo").mockImplementation(()=>{});localStorage.clear();container=document.createElement("div");document.body.append(container);root=createRoot(container)});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.restoreAllMocks()});
async function click(text:string){const button=[...container.querySelectorAll("button")].find(b=>b.textContent===text);if(!button)throw Error(text);await act(async()=>button.click())}
it("keeps questions absent until the reader continues, then moves focus",async()=>{await act(async()=>root.render(createElement(HomeSectionPause,{title:"Next room",detail:"Take your time",children:createElement("h1",{tabIndex:-1},"Room question")})));expect(container.textContent).not.toContain("Room question");expect(document.activeElement?.textContent).toBe("Next room");await click("Continue");expect(container.textContent).toContain("Room question");expect(document.activeElement?.textContent).toBe("Room question")});
it("shows one routine question and preserves its choice when going back",async()=>{function Harness(){const api=useCase();return createElement(HomeRoutineConversation,{api,onNext:()=>{}})}await act(async()=>root.render(createElement(Harness)));expect(container.textContent).toContain("Who are we checking");expect(container.textContent).not.toContain("Who lives in the home?");const self=[...container.querySelectorAll("button")].find(b=>b.textContent?.includes("Myself"))!;await act(async()=>self.click());await click("Continue");expect(container.textContent).toContain("Who lives in the home?");await click("Back");expect([...container.querySelectorAll("button")].find(b=>b.textContent?.includes("Myself"))?.getAttribute("aria-pressed")).toBe("true")});
