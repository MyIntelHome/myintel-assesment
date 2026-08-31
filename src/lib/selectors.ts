/**
 * Derived case data. Every screen reads from here so the assessment, the
 * plan, and the report can never disagree about what was found.
 */

import { combineCompleteness, completenessForSpace, type Completeness } from "@/domain/completeness";
import { summariseRisk, type RiskSummary } from "@/domain/risk";
import { findingKey, type FindingDetail } from "@/domain/case";
import type { AssessmentStatus } from "@/domain/status";
import { templateFor } from "@/seed/templates";
import { responseMap, type CaseState, type Space } from "./case-store";

export interface OpenFinding {
  readonly key: string;
  readonly space: Space;
  readonly code: string;
  readonly prompt: string;
  readonly hint: string;
  readonly status: Extract<AssessmentStatus, "concern" | "critical">;
  readonly detail: FindingDetail;
}

export interface Limitation {
  readonly space: Space;
  readonly code: string;
  readonly prompt: string;
  readonly reason: string;
}

export interface CaseView {
  readonly perSpace: ReadonlyArray<{ space: Space; completeness: Completeness }>;
  readonly completeness: Completeness;
  readonly risk: RiskSummary;
  readonly findings: readonly OpenFinding[];
  readonly limitations: readonly Limitation[];
  readonly notApplicable: readonly Limitation[];
}

export function buildCaseView(state: CaseState): CaseView {
  const perSpace = state.spaces.map((space) => ({
    space,
    completeness: completenessForSpace(templateFor(space.type), responseMap(state, space.id)),
  }));

  const completeness = combineCompleteness(perSpace.map((p) => p.completeness));

  const statuses: AssessmentStatus[] = [];
  const findings: OpenFinding[] = [];
  const limitations: Limitation[] = [];
  const notApplicable: Limitation[] = [];

  for (const space of state.spaces) {
    for (const item of templateFor(space.type).items) {
      const response = state.responses[space.id]?.[item.code];
      const status = (response?.status ?? "unknown") as AssessmentStatus;
      statuses.push(status);

      if (status === "concern" || status === "critical") {
        const key = findingKey(space.id, item.code);
        findings.push({
          key,
          space,
          code: item.code,
          prompt: item.prompt,
          hint: item.hint,
          status,
          detail: state.findings[key] ?? {},
        });
      } else if (status === "unable_to_assess") {
        limitations.push({
          space,
          code: item.code,
          prompt: item.prompt,
          reason: response?.reason?.trim() || "No reason recorded",
        });
      } else if (status === "not_applicable") {
        notApplicable.push({
          space,
          code: item.code,
          prompt: item.prompt,
          reason: response?.reason?.trim() || "",
        });
      }
    }
  }

  // Critical first, then by space order.
  findings.sort((a, b) => {
    if (a.status !== b.status) return a.status === "critical" ? -1 : 1;
    return 0;
  });

  return {
    perSpace,
    completeness,
    risk: summariseRisk(statuses, completeness),
    findings,
    limitations,
    notApplicable,
  };
}
