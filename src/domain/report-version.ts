import { assessSignoffReadiness, ATTESTATION_VERSION, ATTESTATION_TEXT } from "./case";
import type { CaseState } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";
import { templateFor } from "@/seed/templates";
import {visitReview,visitContextSignature} from "./visit-review";

type ReportCase = Pick<CaseState, "reference" | "intake" | "spaces" | "responses" | "findings" | "plan" | "signoff" | "homeProfile" | "visit">;

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
  const base=assessSignoffReadiness({
    signoff: state.signoff, plan: state.plan,
    requiredAssessed: view.completeness.requiredAssessed,
    requiredTotal: view.completeness.requiredTotal,
    unableToAssessCount: view.completeness.unableToAssessCount, observedCount,
    criticalFindings: view.findings.filter(f => f.status === "critical").map(f => ({key:f.key,disposition:f.detail.disposition})),
    findingKeys: view.findings.map(f => f.key),
    unexplainedExclusions: [...view.limitations, ...view.notApplicable].filter(l => !l.reason || l.reason === "No reason recorded").length,
  });
  const blockers=[...base.blockers];
  if(state.visit){
   if(state.visit.contextReviewed!==visitContextSignature(state))blockers.push("Review the current context and visit scope before signing.");
   if(visitReview(state,view).unhandled.length)blockers.push("Every reported clinical finding needs a linked action or documented professional disposition.");
   if(view.completeness.unableToAssessCount&&!state.signoff.partialAssessmentReason?.trim())blockers.push("Explain the visit limitations and follow-up for observations that could not be completed.");
  }
  return {...base,blockers,canSign:!blockers.length};
}

export function createReportVersion(state: CaseState, view: CaseView, signedAt: string, id: string): ReportVersion {
  if (!reportReadiness(state, view).canSign) throw new Error("Resolve report blockers before finalising.");
  const versions = state.reportVersions ?? [];
  const {reference,intake,spaces,responses,findings,plan,signoff,homeProfile,visit} = state;
  return JSON.parse(JSON.stringify({
    id, revision: versions.length + 1, supersedesId: versions.at(-1)?.id ?? null,
    attestationVersion: ATTESTATION_VERSION,
    attestationText: ATTESTATION_TEXT,
    templateVersions: Object.fromEntries(spaces.map(s=>[s.type, templateFor(s.type).version])),
    caseData: {reference,intake,spaces,responses,findings,plan,signoff:{...signoff,signedAt},homeProfile,visit}, view,
  })) as ReportVersion;
}
