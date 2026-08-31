/**
 * Standing acceptance tests for completeness and risk.
 *
 * These encode the requirements that must never regress:
 *   - a new case shows no score at all
 *   - completeness and risk are independent
 *   - "No risks identified" is impossible below full completeness
 *   - "No risks identified" is impossible when anything was unassessable
 *   - risks found are reported even when the assessment is incomplete
 */

import { describe, expect, it } from "vitest";
import { combineCompleteness, completenessForSpace, type ItemResponse } from "@/domain/completeness";
import { countRisks, summariseRisk } from "@/domain/risk";
import { TEMPLATES } from "@/seed/templates";
import type { AssessmentStatus } from "@/domain/status";
import type { AssessmentTemplate } from "@/domain/types";

const bathroom = TEMPLATES.bathroom;

/** Build a response map from code -> status. */
function responses(entries: Record<string, AssessmentStatus>): Map<string, ItemResponse> {
  return new Map(
    Object.entries(entries).map(([code, status]) => [code, { code, status } as ItemResponse]),
  );
}

/** Set every item in a template to one status. */
function allSetTo(template: AssessmentTemplate, status: AssessmentStatus) {
  return responses(Object.fromEntries(template.items.map((i) => [i.code, status])));
}

function statusesOf(template: AssessmentTemplate, map: Map<string, ItemResponse>) {
  return template.items.map((i) => map.get(i.code)?.status ?? ("unknown" as AssessmentStatus));
}

describe("a brand new case", () => {
  const empty = new Map<string, ItemResponse>();
  const c = completenessForSpace(bathroom, empty);

  it("has assessed nothing", () => {
    expect(c.requiredAssessed).toBe(0);
    expect(c.percent).toBe(0);
    expect(c.isComplete).toBe(false);
  });

  it("reports no risk counts, positive or negative", () => {
    const risk = summariseRisk(statusesOf(bathroom, empty), c);
    expect(risk.counts.total).toBe(0);
    expect(risk.counts.critical).toBe(0);
  });

  it("refuses to say the home is safe", () => {
    const risk = summariseRisk(statusesOf(bathroom, empty), c);
    expect(risk.state).toBe("insufficient_data");
    expect(risk.canStateNoRisks).toBe(false);
  });
});

describe("completeness is independent of risk", () => {
  it("counts a fully-critical space as 100% complete", () => {
    // The point of the separation: every item assessed, every one a risk.
    const map = allSetTo(bathroom, "critical");
    const c = completenessForSpace(bathroom, map);
    expect(c.isComplete).toBe(true);
    expect(c.percent).toBe(100);

    const risk = summariseRisk(statusesOf(bathroom, map), c);
    expect(risk.state).toBe("risks_identified");
    expect(risk.counts.critical).toBe(bathroom.items.length);
  });

  it("counts not-applicable as assessed", () => {
    const c = completenessForSpace(bathroom, allSetTo(bathroom, "not_applicable"));
    expect(c.isComplete).toBe(true);
  });

  it("counts unable-to-assess as assessed but flags it as a limitation", () => {
    const c = completenessForSpace(bathroom, allSetTo(bathroom, "unable_to_assess"));
    expect(c.isComplete).toBe(true);
    expect(c.unableToAssessCount).toBe(bathroom.items.length);
  });

  it("does not count unknown as assessed", () => {
    const c = completenessForSpace(bathroom, allSetTo(bathroom, "unknown"));
    expect(c.requiredAssessed).toBe(0);
    expect(c.outstanding.length).toBeGreaterThan(0);
  });
});

describe('"No risks identified" is tightly gated', () => {
  it("is allowed only when everything required is assessed and nothing was skipped", () => {
    const map = allSetTo(bathroom, "pass");
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(risk.state).toBe("no_risks_identified");
    expect(risk.canStateNoRisks).toBe(true);
  });

  it("is refused when a single required item is still unknown", () => {
    const map = allSetTo(bathroom, "pass");
    map.delete(bathroom.items[0]!.code); // one item back to unknown
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(c.isComplete).toBe(false);
    expect(risk.canStateNoRisks).toBe(false);
    expect(risk.state).toBe("insufficient_data");
  });

  it("is refused when something could not be assessed, even at full coverage", () => {
    const map = allSetTo(bathroom, "pass");
    map.set(bathroom.items[0]!.code, {
      code: bathroom.items[0]!.code,
      status: "unable_to_assess",
      reason: "Door locked",
    });
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(c.isComplete).toBe(true);
    expect(risk.state).toBe("no_risks_in_assessed_areas");
    expect(risk.canStateNoRisks).toBe(false);
    expect(risk.statement).toContain("areas assessed");
  });

  it("never claims no risks when any risk exists", () => {
    const map = allSetTo(bathroom, "pass");
    map.set(bathroom.items[0]!.code, { code: bathroom.items[0]!.code, status: "concern" });
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(risk.canStateNoRisks).toBe(false);
    expect(risk.counts.concern).toBe(1);
  });
});

describe("risks are reported even when the assessment is incomplete", () => {
  // Asymmetry by design: a hazard is not less real for being found early.
  it("reports a critical finding at 1 item assessed", () => {
    const map = responses({ [bathroom.items[0]!.code]: "critical" });
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(c.isComplete).toBe(false);
    expect(risk.state).toBe("risks_identified");
    expect(risk.counts.critical).toBe(1);
  });

  it("says the assessment is incomplete alongside the finding", () => {
    const map = responses({ [bathroom.items[0]!.code]: "critical" });
    const c = completenessForSpace(bathroom, map);
    const risk = summariseRisk(statusesOf(bathroom, map), c);

    expect(risk.assessmentIncomplete).toBe(true);
    expect(risk.statement).toContain("complete");
  });
});

describe("counting", () => {
  it("counts only statuses that can raise a finding", () => {
    const counts = countRisks([
      "pass",
      "unknown",
      "not_applicable",
      "concern",
      "concern",
      "critical",
      "unable_to_assess",
    ]);
    expect(counts.critical).toBe(1);
    expect(counts.concern).toBe(2);
    expect(counts.total).toBe(3);
  });

  it("never counts pass, unknown, or not-applicable as risk", () => {
    expect(countRisks(["pass", "unknown", "not_applicable"]).total).toBe(0);
  });
});

describe("optional items never block a report", () => {
  const stairway = TEMPLATES.stairway; // contains one optional item (s7)

  it("reaches complete without the optional item", () => {
    const required = stairway.items.filter((i) => i.required);
    const map = responses(Object.fromEntries(required.map((i) => [i.code, "pass" as const])));
    const c = completenessForSpace(stairway, map);

    expect(c.isComplete).toBe(true);
    expect(c.optionalAssessed).toBe(0);
    expect(c.optionalTotal).toBeGreaterThan(0);
  });
});

describe("combining spaces", () => {
  it("aggregates required counts across a whole case", () => {
    const a = completenessForSpace(TEMPLATES.bathroom, allSetTo(TEMPLATES.bathroom, "pass"));
    const b = completenessForSpace(TEMPLATES.bedroom, new Map());
    const total = combineCompleteness([a, b]);

    expect(total.requiredAssessed).toBe(a.requiredAssessed);
    expect(total.requiredTotal).toBe(a.requiredTotal + b.requiredTotal);
    expect(total.isComplete).toBe(false);
  });

  it("is complete only when every space is", () => {
    const a = completenessForSpace(TEMPLATES.bathroom, allSetTo(TEMPLATES.bathroom, "pass"));
    const b = completenessForSpace(TEMPLATES.bedroom, allSetTo(TEMPLATES.bedroom, "pass"));
    expect(combineCompleteness([a, b]).isComplete).toBe(true);
  });

  it("treats an empty case as incomplete, not vacuously complete", () => {
    expect(combineCompleteness([]).isComplete).toBe(false);
  });
});
