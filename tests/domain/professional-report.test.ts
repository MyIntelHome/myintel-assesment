import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalise, EMPTY_CASE, type CaseApi } from "@/lib/case-store";
import { buildCaseView } from "@/lib/selectors";
import { professionalReportMetrics } from "@/domain/professional-report";
import { createReportVersion, reportReadiness } from "@/domain/report-version";
import { ReportStep } from "@/components/ReportStep";
import { isClinicalRecord } from "@/domain/access";
function fixture() {
  return normalise({
    ...EMPTY_CASE,
    id: "clinical",
    audience: "clinician",
    reference: "CASE-1042",
    spaces: [{ id: "door", type: "entry", label: "Entrance" }],
    responses: { door: { e1: { status: "pass" } } },
    signoff: {
      ...EMPTY_CASE.signoff,
      assessorName: "Test assessor",
      credentials: "TEST",
      partialAssessmentReason:
        "Partial demonstration visit; remaining observations require review.",
    },
  });
}
describe("professional reporting and documentation", () => {
  it("keeps coverage distinct from decisions and percentages of observed concerns", () => {
    const state = fixture();
    state.responses.door = {
      e1: { status: "pass" },
      e2: { status: "concern" },
      e3: { status: "critical" },
      e4: { status: "not_applicable", reason: "No ramp" },
      e5: { status: "unable_to_assess", reason: "Access blocked" },
    };
    const m = professionalReportMetrics(state, buildCaseView(state));
    expect(m).toMatchObject({
      total: 7,
      observed: 3,
      applicable: 6,
      notApplicable: 1,
      unable: 1,
      unknown: 2,
      coverage: 50,
      decisions: 71,
      concernShare: 67,
      documented: 0,
    });
  });
  it("does not show an all-clear percentage for empty or entirely excluded scope", () => {
    const state = fixture();
    state.responses.door = Object.fromEntries(
      ["e1", "e2", "e3", "e4", "e5", "e6", "e7"].map((code) => [
        code,
        { status: "not_applicable" as const, reason: "Outside scope" },
      ]),
    );
    expect(
      professionalReportMetrics(state, buildCaseView(state)),
    ).toMatchObject({
      coverage: null,
      concernShare: null,
      decisions: 100,
      observed: 0,
    });
    expect(
      professionalReportMetrics(
        { ...state, spaces: [] },
        buildCaseView({ ...state, spaces: [] }),
      ),
    ).toMatchObject({ coverage: null, decisions: null });
  });
  it("preserves bounded notes and assessment units through validation and signed snapshots", () => {
    const state = fixture();
    state.documentation = {
      clientSummary: "Original client context",
      rooms: {
        door: {
          observation: "Original room narrative",
          residentPerspective: "Reported worry",
          followUp: "Recheck lighting",
        },
      },
      tests: [
        {
          id: "test",
          name: "External instrument",
          date: "2026-10-27",
          result: "1.2 original units",
          interpretation: "Recorded by the assessor",
          limitations: "Conditions documented",
        },
      ],
    };
    const version = createReportVersion(
      state,
      buildCaseView(state),
      "2026-10-27T15:00:00Z",
      "first",
    );
    state.documentation.clientSummary = "Later summary";
    state.documentation.rooms!.door!.observation = "Later room";
    expect(version.reportLayoutVersion).toBe(3);
    const signed = normalise({
      ...state,
      signoff: version.caseData.signoff,
      reportVersions: [version],
    });
    expect(
      signed.reportVersions[0]?.caseData.documentation?.rooms?.door
        ?.observation,
    ).toBe("Original room narrative");
    const html = renderToStaticMarkup(
      createElement(ReportStep, {
        api: { state: signed, saveState: "saved" } as CaseApi,
        view: buildCaseView(signed),
      }),
    );
    expect(html).toContain("Original client context");
    expect(html).toContain("Original room narrative");
    expect(html).not.toContain("Later summary");
    expect(html).not.toContain("Later room");
    expect(html).toContain("1.2 original units");
    expect(html).toContain("Signed by");
    expect(html).toContain("Overall concern score");
    expect(html).not.toContain("Observation coverage");
  });
  it("renders legacy signed reports with their original layout and does not inherit later notes", () => {
    const state = fixture(),
      version = createReportVersion(
        state,
        buildCaseView(state),
        "2026-10-27T15:00:00Z",
        "legacy",
      );
    delete version.reportLayoutVersion;
    delete version.caseData.documentation;
    state.documentation = { clientSummary: "Later private narrative" };
    state.reportVersions = [version];
    state.signoff = version.caseData.signoff;
    const html = renderToStaticMarkup(
      createElement(ReportStep, {
        api: { state, saveState: "saved" } as CaseApi,
        view: buildCaseView(state),
      }),
    );
    expect(html).not.toContain("Later private narrative");
    expect(html).not.toContain("Assessment dashboard");
    expect(html).toContain("Home Safety Assessment");
  });
  it('keeps the original coverage dashboard in a version 2 signed report',()=>{
    const state=fixture();
    const version=createReportVersion(state,buildCaseView(state),'2026-10-27T15:00:00Z','v2');
    version.reportLayoutVersion=2;state.reportVersions=[version];state.signoff=version.caseData.signoff;
    const loaded=normalise(state);
    const html=renderToStaticMarkup(createElement(ReportStep,{api:{state:loaded,saveState:'saved'} as CaseApi,view:buildCaseView(loaded)}));
    expect(html).toContain('Observation coverage');
    expect(html).not.toContain('Overall concern score');
  });
  it("classifies professional notes as clinical even if an archive is mislabeled", () => {
    expect(
      isClinicalRecord({
        audience: "family",
        documentation: { clientSummary: "Clinical context" },
      }),
    ).toBe(true);
    expect(isClinicalRecord({ audience: "family", documentation: {} })).toBe(
      false,
    );
  });
  it("rejects oversized notes and incomplete or stale external assessment entries", () => {
    const state = fixture();
    expect(() =>
      normalise({
        ...state,
        documentation: { clientSummary: "x".repeat(5001) },
      }),
    ).toThrow();
    state.documentation = {
      tests: [
        {
          id: "test",
          name: "External instrument",
          date: "",
          result: "",
          interpretation: "",
          limitations: "",
        },
      ],
    };
    expect(reportReadiness(state, buildCaseView(state)).canSign).toBe(false);
    Object.assign(state.documentation.tests![0]!, {
      result: "2 original units",
      interpretation: "Professional interpretation",
      linkedFindings: ["removed::item"],
    });
    expect(
      reportReadiness(state, buildCaseView(state)).blockers.join(" "),
    ).toContain("assessment links");
  });
});
