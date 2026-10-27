import type { CaseState } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";
import { templateFor } from "@/seed/templates";

/** Descriptive coverage only. Never a validated safety or falling probability. */
export function professionalReportMetrics(state: CaseState, view: CaseView) {
  const rooms = state.spaces.map((space) => {
    let total = 0,
      observed = 0,
      notApplicable = 0,
      unable = 0,
      unknown = 0,
      noConcern = 0,
      concern = 0,
      critical = 0;
    for (const item of templateFor(space.type).items) {
      if (!item.required) continue;
      total++;
      const status =
        state.responses[space.id]?.[item.code]?.status ?? "unknown";
      if (status === "not_applicable") notApplicable++;
      else if (status === "unable_to_assess") unable++;
      else if (status === "unknown") unknown++;
      else {
        observed++;
        if (status === "pass") noConcern++;
        if (status === "concern") concern++;
        if (status === "critical") critical++;
      }
    }
    const applicable = total - notApplicable;
    return {
      space,
      total,
      observed,
      notApplicable,
      unable,
      unknown,
      noConcern,
      concern,
      critical,
      applicable,
      coverage: applicable ? Math.round((observed / applicable) * 100) : null,
      decisions: total ? Math.round(((total - unknown) / total) * 100) : null,
    };
  });
  const sum = (
    key:
      | "total"
      | "observed"
      | "notApplicable"
      | "unable"
      | "unknown"
      | "noConcern"
      | "concern"
      | "critical"
      | "applicable",
  ) => rooms.reduce((n, r) => n + r[key], 0);
  const observed = sum("observed"),
    applicable = sum("applicable");
  const documented = view.findings.filter(
    (f) =>
      f.detail.disposition?.trim() ||
      state.plan.some((p) => p.linkedFindings.includes(f.key)),
  ).length;
  return {
    rooms,
    total: sum("total"),
    observed,
    applicable,
    notApplicable: sum("notApplicable"),
    unable: sum("unable"),
    unknown: sum("unknown"),
    noConcern: sum("noConcern"),
    concern: sum("concern"),
    critical: sum("critical"),
    coverage: applicable ? Math.round((observed / applicable) * 100) : null,
    decisions: sum("total")
      ? Math.round(((sum("total") - sum("unknown")) / sum("total")) * 100)
      : null,
    concernShare: observed
      ? Math.round(((sum("concern") + sum("critical")) / observed) * 100)
      : null,
    documented,
    findings: view.findings.length,
    documentedPercent: view.findings.length
      ? Math.round((documented / view.findings.length) * 100)
      : null,
  };
}
