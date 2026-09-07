import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_CASE, normalise, preserveCase, type CaseApi, type CaseState } from "@/lib/case-store";
import { buildCaseView } from "@/lib/selectors";
import { createReportVersion, reportReadiness } from "@/domain/report-version";
import { emptyPlanItem } from "@/domain/case";
import { ReportStep } from "@/components/ReportStep";

function fixture(): CaseState {
  return normalise({...EMPTY_CASE,id:"case-a",audience:"clinician",reference:"2026-014",
    spaces:[{id:"entry",type:"entry",label:"Front door"}],responses:{entry:{e1:{status:"pass"}}},
    signoff:{...EMPTY_CASE.signoff,assessorName:"Audit Assessor",credentials:"TEST",partialAssessmentReason:"Only the entry threshold was observed; remaining areas require a follow-up."},
    plan:[{...emptyPlanItem("p1","Original plan"),rationale:"Observation",urgency:"within_30_days",responsibleParty:"contractor",costNotEstimated:true}],
  });
}

describe("report integrity",()=>{
  it("preserves original data and renders it after the working case changes",()=>{
    const s=fixture();const view=buildCaseView(s);
    const first=createReportVersion(s,view,"2026-09-07T12:00:00Z","r1");
    s.plan[0]!.title="Changed later";s.intake.mobilityAids="Changed later aid";
    Object.assign(view.risk,{statement:"Changed later risk"});
    expect(first.caseData.plan[0]!.title).toBe("Original plan");
    expect(first.view.risk.statement).not.toContain("Changed later");
    const signed={...s,signoff:first.caseData.signoff,reportVersions:[first]};
    const html=renderToStaticMarkup(createElement(ReportStep,{api:{state:signed,saveState:"saved"} as CaseApi,view:buildCaseView(signed)}));
    expect(html).toContain("Original plan");expect(html).not.toContain("Changed later");expect(html).toContain("Signed by");
  });
  it("links an amendment to the previous version without replacing it",()=>{
    const s=fixture();const a=createReportVersion(s,buildCaseView(s),"2026-09-07T12:00:00Z","a");
    s.reportVersions=[a];s.plan[0]!.title="Amended";
    const b=createReportVersion(s,buildCaseView(s),"2026-09-07T13:00:00Z","b");
    expect(b.revision).toBe(2);expect(b.supersedesId).toBe("a");expect(a.caseData.plan[0]!.title).toBe("Original plan");
  });
  it("rejects blank cases, unexplained exclusions and unaddressed critical findings",()=>{
    const blank={...EMPTY_CASE,signoff:fixture().signoff};
    expect(()=>createReportVersion(blank,buildCaseView(blank),"now","r")).toThrow();
    const s=fixture();s.responses.entry!.e1={status:"critical"};
    expect(reportReadiness(s,buildCaseView(s)).canSign).toBe(false);
    s.plan[0]!.linkedFindings=["entry::e1"];
    expect(reportReadiness(s,buildCaseView(s)).canSign).toBe(true);
    s.responses.entry!.e2={status:"not_applicable"};
    expect(reportReadiness(s,buildCaseView(s)).canSign).toBe(false);
    s.responses.entry!.e2={status:"not_applicable",reason:"No separate night-time entrance use"};
    expect(reportReadiness(s,buildCaseView(s)).canSign).toBe(true);
  });
  it("flags stale action links",()=>{
    const s=fixture();s.plan[0]!.linkedFindings=["removed::item"];
    expect(reportReadiness(s,buildCaseView(s)).blockers.join(" ")).toContain("action links");
  });
  it("does not count orphaned responses as observed assessment items",()=>{
    const s=fixture();s.responses={removed:{e1:{status:"pass"}}};
    expect(reportReadiness(s,buildCaseView(s)).canSign).toBe(false);
  });
  it("retains the signed snapshot through persistence validation",()=>{
    const s=fixture(); const version=createReportVersion(s,buildCaseView(s),"2026-09-07T12:00:00Z","r1");
    const loaded=normalise(JSON.parse(JSON.stringify({...s,reportVersions:[version],signoff:version.caseData.signoff})));
    expect(loaded.reportVersions[0]).toEqual(version);
    expect(loaded.signoff.signedAt).toBe("2026-09-07T12:00:00Z");
  });
});

describe("local case preservation",()=>{
  it("preserves case A when starting B and excludes legacy contact details",()=>{
    const a=fixture();a.familyContact={name:"Legacy name",email:"legacy@example.com",phone:"",consent:true};
    const list=preserveCase([],a,"2026-09-07T12:00:00Z");
    const b=normalise({id:"case-b"});
    const next=preserveCase(list,b,"2026-09-07T13:00:00Z");
    expect(next.map(c=>c.id)).toEqual(["case-a","case-b"]);
    expect(JSON.stringify(next)).not.toContain("legacy@example.com");
    expect(next[0]!.plan[0]!.title).toBe("Original plan");
  });
  it("turns legacy timestamp-only reports into drafts instead of inventing a signed snapshot",()=>{
    const s=fixture();s.signoff.signedAt="2026-08-01T12:00:00Z";
    expect(normalise(s).signoff.signedAt).toBeNull();
  });
});
