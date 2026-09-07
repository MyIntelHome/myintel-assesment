import { assessSignoffReadiness, ATTESTATION_VERSION, ATTESTATION_TEXT } from "./case";
import type { CaseState } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";
import { templateFor } from "@/seed/templates";

type ReportCase = Pick<CaseState, "reference" | "intake" | "spaces" | "responses" | "findings" | "plan" | "signoff">;

export interface ReportVersion {
  id: string;
  revision: number;
  supersedesId: string | null;
  attestationVersion: string;
  attestationText: string;
  templateVersions: Record<string, number>;
  caseData: ReportCase;
  /** Freeze the actual wording and derived findings, not just response IDs. */
  view: CaseView;
}

export function reportReadiness(state: CaseState, view: CaseView) {
  const observedCount = state.spaces.flatMap(space => templateFor(space.type).items
    .map(item => state.responses[space.id]?.[item.code]))
    .filter(r => r && ["pass", "concern", "critical"].includes(r.status)).length;
  return assessSignoffReadiness({
    signoff: state.signoff, plan: state.plan,
    requiredAssessed: view.completeness.requiredAssessed,
    requiredTotal: view.completeness.requiredTotal,
    unableToAssessCount: view.completeness.unableToAssessCount, observedCount,
    criticalFindings: view.findings.filter(f => f.status === "critical").map(f => ({key:f.key,disposition:f.detail.disposition})),
    findingKeys: view.findings.map(f => f.key),
    unexplainedExclusions: [...view.limitations, ...view.notApplicable].filter(l => !l.reason || l.reason === "No reason recorded").length,
  });
}

export function createReportVersion(state: CaseState, view: CaseView, signedAt: string, id: string): ReportVersion {
  if (!reportReadiness(state, view).canSign) throw new Error("Resolve report blockers before finalising.");
  const versions = state.reportVersions ?? [];
  const {reference,intake,spaces,responses,findings,plan,signoff} = state;
  return JSON.parse(JSON.stringify({
    id, revision: versions.length + 1, supersedesId: versions.at(-1)?.id ?? null,
    attestationVersion: ATTESTATION_VERSION,
    attestationText: ATTESTATION_TEXT,
    templateVersions: Object.fromEntries(spaces.map(s=>[s.type, templateFor(s.type).version])),
    caseData: {reference,intake,spaces,responses,findings,plan,signoff:{...signoff,signedAt}}, view,
  })) as ReportVersion;
}
