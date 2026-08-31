/**
 * Risk — what the assessment actually found.
 *
 * Deliberately NOT a percentage and never a "safety score". Risk is reported
 * as counts by severity plus a qualified statement, because a number implies
 * a precision this assessment does not have.
 *
 * The gating rule this file exists to enforce:
 *
 *   "No risks identified" may only be stated when every required item has
 *   been decided AND nothing was left unable-to-assess. Anything less is
 *   either "no risks in the areas assessed", with the gaps listed, or
 *   insufficient data to say anything at all.
 *
 * Note the asymmetry, which is deliberate and clinical: risks found are
 * always reported no matter how incomplete the assessment, because a
 * hazard does not become less real for being found early. Only the
 * reassuring conclusion requires completeness.
 */

import { STATUS_META, type AssessmentStatus } from "./status";
import type { Completeness } from "./completeness";

export type RiskState =
  /** Too little assessed to draw any conclusion. */
  | "insufficient_data"
  /** Complete, nothing found, nothing skipped. The only true all-clear. */
  | "no_risks_identified"
  /** Nothing found, but parts of the home could not be assessed. */
  | "no_risks_in_assessed_areas"
  /** Risks were found. Always reported, complete or not. */
  | "risks_identified";

export interface RiskCounts {
  readonly critical: number;
  readonly concern: number;
  readonly total: number;
}

export interface RiskSummary {
  readonly state: RiskState;
  readonly counts: RiskCounts;
  /** True only for `no_risks_identified`. Report generators must check this. */
  readonly canStateNoRisks: boolean;
  /** Assessment was still incomplete when this was produced. */
  readonly assessmentIncomplete: boolean;
  /** Items attempted but not judgeable. Must appear in report limitations. */
  readonly unableToAssessCount: number;
  /** Plain-language statement safe to place in a report. */
  readonly statement: string;
}

export function countRisks(statuses: readonly AssessmentStatus[]): RiskCounts {
  let critical = 0;
  let concern = 0;
  for (const status of statuses) {
    // Read from the status table rather than hard-coding names, so adding a
    // status cannot silently bypass risk counting.
    if (!STATUS_META[status].canRaiseFinding) continue;
    if (status === "critical") critical++;
    else if (status === "concern") concern++;
  }
  return { critical, concern, total: critical + concern };
}

export function summariseRisk(
  statuses: readonly AssessmentStatus[],
  completeness: Completeness,
): RiskSummary {
  const counts = countRisks(statuses);
  const incomplete = !completeness.isComplete;
  const unable = completeness.unableToAssessCount;

  if (counts.total > 0) {
    const parts: string[] = [];
    if (counts.critical > 0) {
      parts.push(`${counts.critical} critical ${counts.critical === 1 ? "finding" : "findings"}`);
    }
    if (counts.concern > 0) {
      parts.push(`${counts.concern} ${counts.concern === 1 ? "concern" : "concerns"}`);
    }
    let statement = `${parts.join(" and ")} identified.`;
    if (incomplete) {
      statement += ` Assessment is ${completeness.percent}% complete; further risks may exist in areas not yet assessed.`;
    } else if (unable > 0) {
      statement += ` ${unable} ${unable === 1 ? "item" : "items"} could not be assessed.`;
    }
    return {
      state: "risks_identified",
      counts,
      canStateNoRisks: false,
      assessmentIncomplete: incomplete,
      unableToAssessCount: unable,
      statement,
    };
  }

  if (incomplete) {
    return {
      state: "insufficient_data",
      counts,
      canStateNoRisks: false,
      assessmentIncomplete: true,
      unableToAssessCount: unable,
      statement:
        `Not enough of the assessment is complete to draw a conclusion. ` +
        `${completeness.requiredAssessed} of ${completeness.requiredTotal} required items assessed.`,
    };
  }

  if (unable > 0) {
    return {
      state: "no_risks_in_assessed_areas",
      counts,
      canStateNoRisks: false,
      assessmentIncomplete: false,
      unableToAssessCount: unable,
      statement:
        `No risks identified in the areas assessed. ` +
        `${unable} ${unable === 1 ? "item" : "items"} could not be assessed and ${unable === 1 ? "is" : "are"} listed under limitations.`,
    };
  }

  return {
    state: "no_risks_identified",
    counts,
    canStateNoRisks: true,
    assessmentIncomplete: false,
    unableToAssessCount: 0,
    statement: "No risks identified. All required items were assessed.",
  };
}
