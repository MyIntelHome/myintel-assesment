/**
 * Completeness — how much of the assessment has been decided.
 *
 * This measures COVERAGE ONLY. It says nothing about whether the home is
 * safe. Risk is computed separately in risk.ts, and the two must never be
 * combined into a single "safety score".
 *
 * An item counts as assessed when the clinician has made any decision about
 * it, including "not applicable" and "unable to assess" — deciding an item
 * does not apply is a real judgement, not a gap.
 */

import { DEFAULT_STATUS, isAssessed, isCoverageLimitation, type AssessmentStatus } from "./status";
import type { AssessmentTemplate } from "./types";

export interface ItemResponse {
  readonly code: string;
  readonly status: AssessmentStatus;
  readonly reason?: string;
}

export interface Completeness {
  readonly requiredTotal: number;
  readonly requiredAssessed: number;
  readonly optionalTotal: number;
  readonly optionalAssessed: number;
  /** Percentage of REQUIRED items decided. Optional items never gate a report. */
  readonly percent: number;
  /** Every required item has a decision. */
  readonly isComplete: boolean;
  /** Items the clinician attempted but could not judge. */
  readonly unableToAssessCount: number;
  /** Required item codes still awaiting a decision. */
  readonly outstanding: readonly string[];
}

const EMPTY: Completeness = {
  requiredTotal: 0,
  requiredAssessed: 0,
  optionalTotal: 0,
  optionalAssessed: 0,
  percent: 0,
  isComplete: false,
  unableToAssessCount: 0,
  outstanding: [],
};

export function statusOf(
  responses: ReadonlyMap<string, ItemResponse>,
  code: string,
): AssessmentStatus {
  return responses.get(code)?.status ?? DEFAULT_STATUS;
}

/** Completeness for a single space. */
export function completenessForSpace(
  template: AssessmentTemplate,
  responses: ReadonlyMap<string, ItemResponse>,
): Completeness {
  if (template.items.length === 0) return EMPTY;

  let requiredTotal = 0;
  let requiredAssessed = 0;
  let optionalTotal = 0;
  let optionalAssessed = 0;
  let unableToAssessCount = 0;
  const outstanding: string[] = [];

  for (const item of template.items) {
    const status = statusOf(responses, item.code);
    const assessed = isAssessed(status);

    if (isCoverageLimitation(status)) unableToAssessCount++;

    if (item.required) {
      requiredTotal++;
      if (assessed) requiredAssessed++;
      else outstanding.push(item.code);
    } else {
      optionalTotal++;
      if (assessed) optionalAssessed++;
    }
  }

  return {
    requiredTotal,
    requiredAssessed,
    optionalTotal,
    optionalAssessed,
    // An empty required set is vacuously complete, but reports 0% rather
    // than 100% so a space with no required items never reads as "done".
    percent: requiredTotal === 0 ? 0 : Math.round((requiredAssessed / requiredTotal) * 100),
    isComplete: requiredAssessed === requiredTotal,
    unableToAssessCount,
    outstanding,
  };
}

/** Completeness across every space in a case. */
export function combineCompleteness(parts: readonly Completeness[]): Completeness {
  if (parts.length === 0) return EMPTY;

  const requiredTotal = parts.reduce((n, p) => n + p.requiredTotal, 0);
  const requiredAssessed = parts.reduce((n, p) => n + p.requiredAssessed, 0);

  return {
    requiredTotal,
    requiredAssessed,
    optionalTotal: parts.reduce((n, p) => n + p.optionalTotal, 0),
    optionalAssessed: parts.reduce((n, p) => n + p.optionalAssessed, 0),
    percent: requiredTotal === 0 ? 0 : Math.round((requiredAssessed / requiredTotal) * 100),
    isComplete: requiredTotal > 0 && requiredAssessed === requiredTotal,
    unableToAssessCount: parts.reduce((n, p) => n + p.unableToAssessCount, 0),
    outstanding: parts.flatMap((p) => p.outstanding),
  };
}
