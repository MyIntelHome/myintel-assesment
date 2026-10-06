import {describe,it,expect} from "vitest";
import {normalise} from "@/lib/case-store";
import {buildCaseView} from "@/lib/selectors";
import {visitReview,visitContextSignature} from "@/domain/visit-review";
import {reportReadiness,createReportVersion} from "@/domain/report-version";
import {templateFor} from "@/seed/templates";
import {EMPTY_PROFILE} from "@/domain/home-profile";
import {emptyDynamicContext} from "@/domain/dynamic-context";
import {EMPTY_SIGNOFF} from "@/domain/case";
const caseData=()=>normalise({id:"case",audience:"clinician",spaces:[{id:"bath",type:"bathroom",label:"Bathroom"}],visit:{deferred:[]},signoff:{...EMPTY_SIGNOFF,assessorName:"Assessor",credentials:"OT",partialAssessmentReason:"Limited visit; remaining checks require follow-up."}});
describe("visit omission prevention",()=>{
 it("keeps a return reminder unassessed and provides an exact navigation target",()=>{const c=caseData();c.visit!.deferred=["bath::b1"];const r=visitReview(c,buildCaseView(c));expect(r.tasks.find(t=>t.id==="bath::b1")).toMatchObject({code:"b1",spaceId:"bath",inHome:true});expect(r.tasks.find(t=>t.id==="bath::b1")?.detail).toContain("return");expect(r.decided).toBe(0);expect(c.responses).toEqual({})});
 it("distinguishes decisions from examined observations and explicit limitations",()=>{const c=caseData();c.responses={bath:{b1:{status:"pass"},b2:{status:"unable_to_assess",reason:"Resident declined"},b3:{status:"not_applicable",reason:"No shower used in this limited scope"}}};const r=visitReview(c,buildCaseView(c));expect(r).toMatchObject({decided:3,observed:1,unable:1,notApplicable:1});expect(r.tasks.some(t=>t.id==="unable:bath::b2")).toBe(true)});
 it("invalidates a context review after a room or intake change",()=>{const c=caseData();c.visit!.contextReviewed=visitContextSignature(c);expect(visitReview(c,buildCaseView(c)).tasks.some(t=>t.id==="context")).toBe(false);c.spaces=[{...c.spaces[0]!,level:2}];expect(visitReview(c,buildCaseView(c)).tasks.some(t=>t.id==="context")).toBe(true)});
 it("requires dispositions or linked actions for noncritical concerns in visit mode",()=>{const c=caseData();c.responses={bath:{b1:{status:"concern"}}};c.visit!.contextReviewed=visitContextSignature(c);expect(reportReadiness(c,buildCaseView(c)).canSign).toBe(false);c.findings={"bath::b1":{disposition:"Discussed with resident; OT follow-up arranged."}};expect(reportReadiness(c,buildCaseView(c)).canSign).toBe(true)});
 it("does not hide an unable observation behind 100 percent checklist decisions",()=>{const c=caseData();c.responses.bath=Object.fromEntries(templateFor("bathroom").items.filter(i=>i.required).map(i=>[i.code,{status:"pass"}]));c.responses.bath.b2={status:"unable_to_assess",reason:"No consent for observation"};c.signoff.partialAssessmentReason="";c.visit!.contextReviewed=visitContextSignature(c);expect(buildCaseView(c).completeness.percent).toBe(100);expect(reportReadiness(c,buildCaseView(c)).blockers.some(b=>b.includes("limitations"))).toBe(true)});
 it("freezes reported context and review state in signed history",()=>{const c=caseData();c.responses={bath:{b1:{status:"pass"}}};c.homeProfile={...EMPTY_PROFILE,dynamic:emptyDynamicContext()};c.visit!.contextReviewed=visitContextSignature(c);const v=createReportVersion(c,buildCaseView(c),"2026-10-06T12:00:00Z","v1");c.homeProfile.dynamic!.layout.bedrooms=5;expect(v.caseData.homeProfile?.dynamic?.layout.bedrooms).toBeNull();expect(v.caseData.visit?.contextReviewed).not.toBe(visitContextSignature(c))});
});

it("includes an optional check when the professional explicitly marked a return reminder",()=>{const c=caseData(),item=templateFor("living").items.find(i=>!i.required)!;c.spaces=[{id:"living",type:"living",label:"Living room"}];c.visit!.deferred=[`living::${item.code}`];expect(visitReview(c,buildCaseView(c)).tasks.some(t=>t.id===`living::${item.code}`)).toBe(true)});
