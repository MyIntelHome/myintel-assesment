/**
 * The assessment status model.
 *
 * This is the single most important correctness surface in the product. Two
 * rules drive everything downstream and are enforced here rather than in UI:
 *
 *   1. `unknown` is the default for every item. There is no default positive
 *      or negative value anywhere in the system.
 *   2. Completeness and risk are separate measures. An item being *assessed*
 *      says nothing about whether it is *safe*, and vice versa.
 *
 * The per-status metadata below is the authority for both. Engines read this
 * table; they never hard-code status names in conditionals.
 */

export const ASSESSMENT_STATUSES = [
  "unknown",
  "pass",
  "concern",
  "critical",
  "not_applicable",
  "unable_to_assess",
] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/** The status every item starts in. Never change this to a positive value. */
export const DEFAULT_STATUS: AssessmentStatus = "unknown";

export interface StatusMeta {
  /** Short label for the interface. */
  readonly label: string;
  /** What this status means, in the clinician's terms. */
  readonly description: string;
  /**
   * Does choosing this status count as having assessed the item?
   * Drives the completeness numerator. Note that `not_applicable` and
   * `unable_to_assess` both count: the clinician made a decision.
   */
  readonly countsAsAssessed: boolean;
  /** May this status produce a finding? */
  readonly canRaiseFinding: boolean;
  /** Must this status produce a finding before the report can be signed? */
  readonly requiresFinding: boolean;
  /**
   * Does this status represent a gap in coverage that must be disclosed in
   * the report's limitations section?
   */
  readonly isCoverageLimitation: boolean;
  /** Requires the clinician to say why. */
  readonly requiresReason: boolean;
  /**
   * Non-colour indicator. Status must never be conveyed by colour alone —
   * this is both an accessibility requirement and a clinical safety one.
   */
  readonly glyph: string;
}

export const STATUS_META: Readonly<Record<AssessmentStatus, StatusMeta>> = {
  unknown: {
    label: "Not assessed",
    description: "No judgement has been recorded for this item yet.",
    countsAsAssessed: false,
    canRaiseFinding: false,
    requiresFinding: false,
    isCoverageLimitation: false,
    requiresReason: false,
    glyph: "—",
  },
  pass: {
    label: "Pass",
    description: "Assessed. No risk identified for this item.",
    countsAsAssessed: true,
    canRaiseFinding: false,
    requiresFinding: false,
    isCoverageLimitation: false,
    requiresReason: false,
    glyph: "✓",
  },
  concern: {
    label: "Concern",
    description: "Assessed. A risk worth addressing, but not urgent.",
    countsAsAssessed: true,
    canRaiseFinding: true,
    requiresFinding: false,
    isCoverageLimitation: false,
    requiresReason: false,
    glyph: "!",
  },
  critical: {
    label: "Critical",
    description:
      "Assessed. An urgent risk requiring action. Chosen deliberately by the clinician, never applied by default.",
    countsAsAssessed: true,
    canRaiseFinding: true,
    requiresFinding: true,
    isCoverageLimitation: false,
    requiresReason: false,
    glyph: "✕",
  },
  not_applicable: {
    label: "Not applicable",
    description:
      "This does not exist in the home, or does not apply. A real decision, not a gap.",
    countsAsAssessed: true,
    canRaiseFinding: false,
    requiresFinding: false,
    isCoverageLimitation: false,
    requiresReason: true,
    glyph: "○",
  },
  unable_to_assess: {
    label: "Unable to assess",
    description:
      "Attempted but blocked — access refused, area locked, conditions prevented judgement. Disclosed as a limitation in the report.",
    countsAsAssessed: true,
    canRaiseFinding: true,
    requiresFinding: false,
    isCoverageLimitation: true,
    requiresReason: true,
    glyph: "?",
  },
};

export function isAssessed(status: AssessmentStatus): boolean {
  return STATUS_META[status].countsAsAssessed;
}

export function isCoverageLimitation(status: AssessmentStatus): boolean {
  return STATUS_META[status].isCoverageLimitation;
}

export function requiresReason(status: AssessmentStatus): boolean {
  return STATUS_META[status].requiresReason;
}

/**
 * Legacy mapping from the v1 prototype's three-value ratings.
 *
 * Decided at review: a legacy "flag" becomes `concern`, not `critical`.
 * Critical is reserved for a deliberate clinician escalation so the word
 * keeps its meaning in a signed report.
 */
export const LEGACY_STATUS_MAP = {
  pass: "pass",
  warn: "concern",
  flag: "concern",
} as const satisfies Record<string, AssessmentStatus>;
