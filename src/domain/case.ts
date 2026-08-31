/**
 * Case-level types and the validation that gates sign-off.
 *
 * Contains no identifiers by design. Age is banded and capped at 90+;
 * there is no name, date of birth, address, or contact field anywhere.
 */

import type {
  ClinicianConfidence,
  Consequence,
  EvidenceSource,
  Likelihood,
  RecommendationCategory,
  RecommendationStatus,
  RecommendedTimeframe,
  ResidentPriority,
  ResponsibleParty,
  Severity,
} from "./types";

// ─── Intake ─────────────────────────────────────────────────────────────────

/** Banded, and capped at 90+ so no individual is identifiable by age. */
export const AGE_BANDS = [
  "under_65",
  "65_69",
  "70_74",
  "75_79",
  "80_84",
  "85_89",
  "90_plus",
] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  under_65: "Under 65",
  "65_69": "65–69",
  "70_74": "70–74",
  "75_79": "75–79",
  "80_84": "80–84",
  "85_89": "85–89",
  "90_plus": "90 or over",
};

export const HOUSING_TYPES = [
  "single_family",
  "apartment",
  "condo",
  "townhome",
  "mobile_home",
  "assisted_living",
] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export const HOUSING_LABEL: Record<HousingType, string> = {
  single_family: "Single family",
  apartment: "Apartment",
  condo: "Condo",
  townhome: "Townhome",
  mobile_home: "Mobile home",
  assisted_living: "Assisted living",
};

export const CLINICAL_CONCERNS = [
  "history_of_falls",
  "mobility_impairment",
  "visual_deficit",
  "cognitive_change",
  "neurological",
  "cardiac",
  "chronic_pain",
  "high_risk_medications",
] as const;
export type ClinicalConcern = (typeof CLINICAL_CONCERNS)[number];

export const CONCERN_LABEL: Record<ClinicalConcern, string> = {
  history_of_falls: "History of falls",
  mobility_impairment: "Mobility impairment",
  visual_deficit: "Visual deficit",
  cognitive_change: "Cognitive change",
  neurological: "Neurological",
  cardiac: "Cardiac / cardiopulmonary",
  chronic_pain: "Chronic pain",
  high_risk_medications: "High-risk medications",
};

export interface Intake {
  ageBand: AgeBand | "";
  housingType: HousingType | "";
  floors: string;
  livesAlone: "" | "alone" | "with_others";
  mobilityAids: string;
  fallsLast12Months: string;
  concerns: ClinicalConcern[];
  concernNotes: string;
}

export const EMPTY_INTAKE: Intake = {
  ageBand: "",
  housingType: "",
  floors: "",
  livesAlone: "",
  mobilityAids: "",
  fallsLast12Months: "",
  concerns: [],
  concernNotes: "",
};

// ─── Findings ───────────────────────────────────────────────────────────────

/**
 * Clinical detail attached to an item already marked concern or critical.
 * Findings are not created separately — they emerge from the assessment,
 * which keeps the two in step.
 */
export interface FindingDetail {
  severity?: Severity;
  likelihood?: Likelihood;
  consequence?: Consequence;
  evidenceSource?: EvidenceSource;
  confidence?: ClinicianConfidence;
  residentPriority?: ResidentPriority;
  timeframe?: RecommendedTimeframe;
  notes?: string;
}

/** Stable key for a finding: which item, in which space. */
export function findingKey(spaceId: string, code: string): string {
  return `${spaceId}::${code}`;
}

// ─── Action plan ────────────────────────────────────────────────────────────

export interface PlanItem {
  id: string;
  title: string;
  rationale: string;
  category: RecommendationCategory;
  urgency: RecommendedTimeframe | "";
  costMin: string;
  costMax: string;
  costNotEstimated: boolean;
  responsibleParty: ResponsibleParty | "";
  status: RecommendationStatus;
  targetDate: string;
  followUpDate: string;
  linkedFindings: string[];
}

export function emptyPlanItem(id: string, title = ""): PlanItem {
  return {
    id,
    title,
    rationale: "",
    category: "home_modification",
    urgency: "",
    costMin: "",
    costMax: "",
    costNotEstimated: false,
    responsibleParty: "",
    status: "proposed",
    targetDate: "",
    followUpDate: "",
    linkedFindings: [],
  };
}

export interface PlanItemProblems {
  readonly id: string;
  readonly title: string;
  readonly missing: readonly string[];
}

/**
 * Every field the plan promised must be present before a report is signed.
 * A recommendation without a responsible party or a timeframe is not an
 * action, it is a wish.
 */
export function validatePlanItem(item: PlanItem): readonly string[] {
  const missing: string[] = [];
  if (!item.title.trim()) missing.push("title");
  if (!item.rationale.trim()) missing.push("rationale");
  if (!item.urgency) missing.push("urgency");
  if (!item.responsibleParty) missing.push("responsible party");
  if (!item.costNotEstimated && !item.costMin.trim() && !item.costMax.trim()) {
    missing.push("cost range");
  }
  return missing;
}

// ─── Sign-off ───────────────────────────────────────────────────────────────

export interface Signoff {
  assessorName: string;
  credentials: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiry: string;
  organisation: string;
  signedAt: string | null;
}

export const EMPTY_SIGNOFF: Signoff = {
  assessorName: "",
  credentials: "",
  licenseNumber: "",
  licenseState: "",
  licenseExpiry: "",
  organisation: "",
  signedAt: null,
};

export const ATTESTATION_VERSION = "1.0";

export const ATTESTATION_TEXT =
  "I attest that I personally conducted this home safety assessment, that the findings and " +
  "recommendations recorded here reflect my professional clinical judgement, and that any areas " +
  "I was unable to assess are disclosed in the limitations section of this report.";

export interface SignoffReadiness {
  readonly canSign: boolean;
  /** Hard blocks. Sign-off is refused while any of these stand. */
  readonly blockers: readonly string[];
  /** Disclosed on the report but do not prevent signing. */
  readonly warnings: readonly string[];
  readonly incompletePlanItems: readonly PlanItemProblems[];
}

export function assessSignoffReadiness(args: {
  signoff: Signoff;
  plan: readonly PlanItem[];
  requiredAssessed: number;
  requiredTotal: number;
  unableToAssessCount: number;
  today?: Date;
}): SignoffReadiness {
  const { signoff, plan, requiredAssessed, requiredTotal, unableToAssessCount } = args;
  const today = args.today ?? new Date();

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!signoff.assessorName.trim()) blockers.push("Assessor name is required.");
  if (!signoff.credentials.trim()) blockers.push("Professional credentials are required.");

  if (signoff.licenseExpiry) {
    const expiry = new Date(`${signoff.licenseExpiry}T23:59:59`);
    if (!Number.isNaN(expiry.getTime()) && expiry < today) {
      blockers.push("Licence has expired. A report cannot be signed under an expired licence.");
    }
  }

  const incompletePlanItems: PlanItemProblems[] = [];
  for (const item of plan) {
    const missing = validatePlanItem(item);
    if (missing.length > 0) {
      incompletePlanItems.push({ id: item.id, title: item.title || "Untitled recommendation", missing });
    }
  }
  if (incompletePlanItems.length > 0) {
    blockers.push(
      `${incompletePlanItems.length} recommendation${incompletePlanItems.length === 1 ? " is" : "s are"} incomplete.`,
    );
  }

  // Gaps are disclosed, not blocking — a clinician may legitimately sign an
  // assessment that could not cover everything, provided it says so.
  if (requiredTotal === 0) {
    warnings.push("No spaces have been assessed yet.");
  } else if (requiredAssessed < requiredTotal) {
    warnings.push(
      `Assessment is incomplete: ${requiredAssessed} of ${requiredTotal} required items assessed. ` +
        "This will be disclosed in the report.",
    );
  }
  if (unableToAssessCount > 0) {
    warnings.push(
      `${unableToAssessCount} item${unableToAssessCount === 1 ? "" : "s"} could not be assessed and will appear under limitations.`,
    );
  }

  return { canSign: blockers.length === 0, blockers, warnings, incompletePlanItems };
}

/** Plan ordering for the report: most urgent first, then by status. */
const URGENCY_RANK: Record<string, number> = {
  immediate: 0,
  within_7_days: 1,
  within_30_days: 2,
  within_90_days: 3,
  monitor: 4,
  "": 5,
};

export function prioritisePlan(plan: readonly PlanItem[]): PlanItem[] {
  return [...plan].sort((a, b) => {
    const ua = URGENCY_RANK[a.urgency] ?? 5;
    const ub = URGENCY_RANK[b.urgency] ?? 5;
    if (ua !== ub) return ua - ub;
    return a.title.localeCompare(b.title);
  });
}
