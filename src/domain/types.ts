/**
 * Core domain vocabulary.
 *
 * Deliberately contains no identifying fields. v1 operates de-identified:
 * the clinician holds the link between a case reference and a person in their
 * own records. See docs/operating-model.md.
 */

// ─── Spaces ─────────────────────────────────────────────────────────────────

export const SPACE_TYPES = [
  "entry",
  "living",
  "kitchen",
  "stairway",
  "bathroom",
  "bedroom",
  "hallway",
  "laundry",
  "garage",
  "exterior",
  "custom",
] as const;

export type SpaceType = (typeof SPACE_TYPES)[number];

export interface SpaceTypeMeta {
  readonly label: string;
  /** May a case contain more than one of these? */
  readonly repeatable: boolean;
  /** Suggested when a new case is created. */
  readonly defaultForNewCase: boolean;
  /** Placeholder shown when the clinician names the space. */
  readonly labelHint: string;
}

export const SPACE_TYPE_META: Readonly<Record<SpaceType, SpaceTypeMeta>> = {
  entry: { label: "Entrance", repeatable: true, defaultForNewCase: true, labelHint: "Front entrance" },
  living: { label: "Living area", repeatable: true, defaultForNewCase: true, labelHint: "Living room" },
  kitchen: { label: "Kitchen", repeatable: true, defaultForNewCase: true, labelHint: "Kitchen" },
  stairway: { label: "Stairway", repeatable: true, defaultForNewCase: false, labelHint: "Stairs to upper floor" },
  bathroom: { label: "Bathroom", repeatable: true, defaultForNewCase: true, labelHint: "Main bathroom" },
  bedroom: { label: "Bedroom", repeatable: true, defaultForNewCase: true, labelHint: "Main bedroom" },
  hallway: { label: "Hallway", repeatable: true, defaultForNewCase: false, labelHint: "Upstairs hallway" },
  laundry: { label: "Laundry", repeatable: true, defaultForNewCase: false, labelHint: "Laundry room" },
  garage: { label: "Garage", repeatable: true, defaultForNewCase: false, labelHint: "Garage" },
  exterior: { label: "Exterior", repeatable: true, defaultForNewCase: true, labelHint: "Outside the home" },
  custom: { label: "Other space", repeatable: true, defaultForNewCase: false, labelHint: "Name this space" },
};

// ─── Assessment template ────────────────────────────────────────────────────

export const ITEM_CATEGORIES = [
  "access",
  "lighting",
  "surfaces",
  "support",
  "transfers",
  "hazards",
  "emergency",
  "reach",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface TemplateItem {
  /** Stable identifier. Never reused, never renumbered. */
  readonly code: string;
  /** How the item reads to a clinician. */
  readonly prompt: string;
  /** The clinical consideration behind it. */
  readonly hint: string;
  /**
   * The same question asked in plain language, for the family capture flow
   * shipping in v2. Written now so the templates only get authored once.
   */
  readonly promptPlain: string;
  readonly category: ItemCategory;
  /**
   * Counts toward the completeness denominator. An optional item left
   * `unknown` does not block a report.
   */
  readonly required: boolean;
}

export interface AssessmentTemplate {
  readonly spaceType: SpaceType;
  /** Bumped whenever items change. A signed report records the version it used. */
  readonly version: number;
  readonly items: readonly TemplateItem[];
}

// ─── Findings ───────────────────────────────────────────────────────────────

export const SEVERITIES = ["low", "moderate", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const LIKELIHOODS = ["rare", "unlikely", "possible", "likely", "almost_certain"] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export const CONSEQUENCES = ["minor", "moderate", "major", "severe"] as const;
export type Consequence = (typeof CONSEQUENCES)[number];

export const EVIDENCE_SOURCES = [
  "direct_observation",
  "resident_report",
  "family_report",
  "record_review",
  "ai_draft",
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const CONFIDENCE_LEVELS = ["low", "moderate", "high"] as const;
export type ClinicianConfidence = (typeof CONFIDENCE_LEVELS)[number];

/**
 * The resident's own view of a hazard. Clinically meaningful and a genuine
 * differentiator — a risk the resident dismisses is addressed differently
 * from one that frightens them.
 */
export const RESIDENT_PRIORITIES = [
  "not_a_priority",
  "would_like_addressed",
  "important",
  "top_priority",
  "not_discussed",
] as const;
export type ResidentPriority = (typeof RESIDENT_PRIORITIES)[number];

export const TIMEFRAMES = [
  "immediate",
  "within_7_days",
  "within_30_days",
  "within_90_days",
  "monitor",
] as const;
export type RecommendedTimeframe = (typeof TIMEFRAMES)[number];

// ─── Recommendations ────────────────────────────────────────────────────────

export const RECOMMENDATION_CATEGORIES = [
  "behavioural",
  "equipment",
  "home_modification",
  "referral",
  "technology",
  "education",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export const RESPONSIBLE_PARTIES = [
  "resident",
  "family",
  "landlord",
  "contractor",
  "clinician",
  "other",
] as const;
export type ResponsibleParty = (typeof RESPONSIBLE_PARTIES)[number];

export const RECOMMENDATION_STATUSES = [
  "proposed",
  "accepted",
  "declined",
  "in_progress",
  "complete",
  "deferred",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

/**
 * A starter recommendation, offered as a suggestion when building the plan.
 * Selecting one creates a Recommendation that still requires urgency, cost,
 * and responsible party before the report can be signed.
 *
 * Descriptions are vendor-neutral by default. Product references attach
 * separately and only in MyIntel assessment mode.
 */
export interface RecommendationTemplate {
  readonly code: string;
  readonly title: string;
  readonly category: RecommendationCategory;
  /** Space types where this is offered. */
  readonly spaceTypes: readonly SpaceType[];
}

// ─── Case ───────────────────────────────────────────────────────────────────

export const CASE_STATUSES = [
  "draft",
  "in_progress",
  "in_review",
  "report_draft",
  "signed",
  "delivered",
  "closed",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const ASSESSMENT_MODES = ["standard_ot", "myintel"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];
