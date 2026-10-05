import {expect,it} from "vitest";
import {TEMPLATES} from "@/seed/templates";
import {familyItemsFor,familyKey} from "@/domain/family";
import {buildFamilyReport} from "@/domain/family-report";
import {homeReportSummary} from "@/domain/home-report-summary";
import {EMPTY_PROFILE} from "@/domain/home-profile";
const spaces=[{id:"bed",label:"Bedroom",template:TEMPLATES.bedroom}];
it("asks at most five focused questions per space without changing clinical templates",()=>{
 for(const template of Object.values(TEMPLATES).filter(t=>t.items.length)){expect(familyItemsFor(template).length).toBeGreaterThanOrEqual(4);expect(familyItemsFor(template).length).toBeLessThanOrEqual(5)}
 expect(TEMPLATES.bathroom.items.filter(i=>i.required)).toHaveLength(8);
});
it("uses answered questions as the concern denominator and does not score an empty check",()=>{
 const empty=homeReportSummary(buildFamilyReport(spaces,{}));expect(empty.level).toBeNull();expect(empty.concerns).toBeNull();
 const report=buildFamilyReport(spaces,{"bed::br1":"no","bed::br2":"unsure"});const s=homeReportSummary(report);
 expect(s.completion).toBe(50);expect(s.concerns).toBe(50);expect(s.unknowns).toBe(50);expect(s.roomsComplete).toBe(0);
});
it("keeps earlier detailed concerns in reports while shortening the current questions",()=>{
 const report=buildFamilyReport(spaces,{"bed::br6":"yes"});expect(report.priority.some(e=>e.code==="br6")).toBe(true);
 expect(report.totalCount).toBe(5);expect(familyItemsFor(TEMPLATES.bedroom).some(i=>i.code==="br6")).toBe(false);
});
it("never interprets a completed no-concern check as proof of safety, and responds to reported falls",()=>{
 const answers=Object.fromEntries(familyItemsFor(TEMPLATES.bedroom).map(i=>[familyKey("bed",i.code),i.concernWhen==="yes"?"no" as const:"yes" as const]));
 const report=buildFamilyReport(spaces,answers);expect(homeReportSummary(report).label).toBe("No concerns reported");
 expect(homeReportSummary(report,{...EMPTY_PROFILE,fallConcern:"fall"}).level).toBe(3);
});
