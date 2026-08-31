/**
 * Standing acceptance tests for sign-off.
 *
 *   - incomplete recommendations block signing
 *   - an expired licence blocks signing
 *   - an incomplete assessment does NOT block signing, but is disclosed
 *   - the plan is ordered by urgency for the report
 */

import { describe, expect, it } from "vitest";
import {
  EMPTY_SIGNOFF,
  assessSignoffReadiness,
  emptyPlanItem,
  prioritisePlan,
  validatePlanItem,
  type PlanItem,
  type Signoff,
} from "@/domain/case";

const validSignoff: Signoff = {
  ...EMPTY_SIGNOFF,
  assessorName: "Jane Smith",
  credentials: "OTR/L, CAPS",
};

function completeItem(over: Partial<PlanItem> = {}): PlanItem {
  return {
    ...emptyPlanItem("rec_1", "Install grab bars"),
    rationale: "No support at the toilet; client reports difficulty standing.",
    urgency: "within_30_days",
    responsibleParty: "contractor",
    costMin: "150",
    costMax: "400",
    ...over,
  };
}

const base = { requiredAssessed: 10, requiredTotal: 10, unableToAssessCount: 0 };

describe("recommendation validation", () => {
  it("accepts a fully specified recommendation", () => {
    expect(validatePlanItem(completeItem())).toEqual([]);
  });

  it("requires each promised field", () => {
    expect(validatePlanItem(completeItem({ title: "" }))).toContain("title");
    expect(validatePlanItem(completeItem({ rationale: "" }))).toContain("rationale");
    expect(validatePlanItem(completeItem({ urgency: "" }))).toContain("urgency");
    expect(validatePlanItem(completeItem({ responsibleParty: "" }))).toContain("responsible party");
  });

  it("requires a cost range unless explicitly not estimated", () => {
    expect(validatePlanItem(completeItem({ costMin: "", costMax: "" }))).toContain("cost range");
    expect(
      validatePlanItem(completeItem({ costMin: "", costMax: "", costNotEstimated: true })),
    ).toEqual([]);
  });
});

describe("sign-off blockers", () => {
  it("allows signing when everything is in order", () => {
    const r = assessSignoffReadiness({ signoff: validSignoff, plan: [completeItem()], ...base });
    expect(r.canSign).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("blocks on an incomplete recommendation", () => {
    const r = assessSignoffReadiness({
      signoff: validSignoff,
      plan: [completeItem(), completeItem({ id: "rec_2", urgency: "" })],
      ...base,
    });
    expect(r.canSign).toBe(false);
    expect(r.incompletePlanItems).toHaveLength(1);
    expect(r.incompletePlanItems[0]!.missing).toContain("urgency");
  });

  it("blocks without assessor name and credentials", () => {
    expect(assessSignoffReadiness({ signoff: EMPTY_SIGNOFF, plan: [], ...base }).canSign).toBe(false);
  });

  it("blocks on an expired licence", () => {
    const r = assessSignoffReadiness({
      signoff: { ...validSignoff, licenseExpiry: "2020-01-01" },
      plan: [],
      today: new Date("2026-08-01"),
      ...base,
    });
    expect(r.canSign).toBe(false);
    expect(r.blockers.join(" ")).toContain("expired");
  });

  it("allows a licence expiring in the future", () => {
    const r = assessSignoffReadiness({
      signoff: { ...validSignoff, licenseExpiry: "2030-01-01" },
      plan: [],
      today: new Date("2026-08-01"),
      ...base,
    });
    expect(r.canSign).toBe(true);
  });
});

describe("assessment gaps are disclosed, not blocking", () => {
  // A clinician may legitimately sign an assessment that could not cover
  // everything — provided the report says so.
  it("permits signing an incomplete assessment", () => {
    const r = assessSignoffReadiness({
      signoff: validSignoff,
      plan: [],
      requiredAssessed: 4,
      requiredTotal: 10,
      unableToAssessCount: 0,
    });
    expect(r.canSign).toBe(true);
    expect(r.warnings.join(" ")).toContain("4 of 10");
  });

  it("warns about items that could not be assessed", () => {
    const r = assessSignoffReadiness({
      signoff: validSignoff,
      plan: [],
      requiredAssessed: 10,
      requiredTotal: 10,
      unableToAssessCount: 2,
    });
    expect(r.canSign).toBe(true);
    expect(r.warnings.join(" ")).toContain("limitations");
  });

  it("warns when nothing has been assessed at all", () => {
    const r = assessSignoffReadiness({
      signoff: validSignoff,
      plan: [],
      requiredAssessed: 0,
      requiredTotal: 0,
      unableToAssessCount: 0,
    });
    expect(r.warnings.join(" ")).toContain("No spaces");
  });
});

describe("plan ordering", () => {
  it("puts the most urgent first", () => {
    const plan = [
      completeItem({ id: "a", title: "Monitor", urgency: "monitor" }),
      completeItem({ id: "b", title: "Now", urgency: "immediate" }),
      completeItem({ id: "c", title: "Month", urgency: "within_30_days" }),
    ];
    expect(prioritisePlan(plan).map((p) => p.title)).toEqual(["Now", "Month", "Monitor"]);
  });

  it("sorts unset urgency last rather than dropping it", () => {
    const plan = [
      completeItem({ id: "a", title: "Unset", urgency: "" }),
      completeItem({ id: "b", title: "Urgent", urgency: "immediate" }),
    ];
    const out = prioritisePlan(plan);
    expect(out).toHaveLength(2);
    expect(out[0]!.title).toBe("Urgent");
  });
});
