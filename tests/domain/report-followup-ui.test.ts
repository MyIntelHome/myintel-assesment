// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {HomeActionPlan} from "@/components/HomeActionPlan";
import {buildFamilyReport} from "@/domain/family-report";
import {TEMPLATES} from "@/seed/templates";
it("offers distinct consented OT and MyIntel request paths, without claiming an appointment was booked",()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const container=document.createElement("div"),root=createRoot(container),request=vi.fn();
 const report=buildFamilyReport([{id:"bath",label:"Bathroom",template:TEMPLATES.bathroom}],{"bath::b2":"no"});
 act(()=>root.render(createElement(HomeActionPlan,{report,onRequestHelp:request})));
 const buttons=[...container.querySelectorAll("button")];expect(buttons).toHaveLength(2);
 act(()=>buttons[0]!.click());expect(request).toHaveBeenLastCalledWith("professional_assessment");
 act(()=>buttons[1]!.click());expect(request).toHaveBeenLastCalledWith("care_navigation");
 expect(container.textContent).toContain("Sharing your results is optional");expect(container.textContent).toContain("Nothing has been ordered or booked");
 act(()=>root.unmount());
});
