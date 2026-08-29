/**
 * Standing acceptance tests for the status model.
 *
 * These encode the requirements that must never regress:
 *   - no default positive or negative score
 *   - unassessed stays Unknown
 *   - completeness and risk are separate concerns
 *   - status is never conveyed by colour alone
 */

import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_STATUSES,
  DEFAULT_STATUS,
  LEGACY_STATUS_MAP,
  STATUS_META,
  isAssessed,
  isCoverageLimitation,
  requiresReason,
  type AssessmentStatus,
} from "@/domain/status";

describe("defaults", () => {
  it("defaults to unknown", () => {
    expect(DEFAULT_STATUS).toBe("unknown");
  });

  it("does not count the default as assessed", () => {
    expect(isAssessed(DEFAULT_STATUS)).toBe(false);
  });

  it("cannot raise a finding from the default", () => {
    expect(STATUS_META[DEFAULT_STATUS].canRaiseFinding).toBe(false);
  });
});

describe("the six states", () => {
  it("has exactly the six required states", () => {
    expect([...ASSESSMENT_STATUSES]).toEqual([
      "unknown",
      "pass",
      "concern",
      "critical",
      "not_applicable",
      "unable_to_assess",
    ]);
  });

  it("describes every state", () => {
    for (const status of ASSESSMENT_STATUSES) {
      expect(STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(STATUS_META[status].description.length).toBeGreaterThan(0);
    }
  });

  it("gives every state a non-colour glyph", () => {
    // Status must be readable without colour: accessibility, and clinical
    // safety for a colourblind reviewer.
    const glyphs = ASSESSMENT_STATUSES.map((s) => STATUS_META[s].glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    for (const glyph of glyphs) expect(glyph.length).toBeGreaterThan(0);
  });
});

describe("completeness is separate from risk", () => {
  it("counts a decision as assessed regardless of whether it found risk", () => {
    // The point of the separation: not_applicable and unable_to_assess are
    // decisions, so they advance completeness without implying safety.
    const assessed: AssessmentStatus[] = [
      "pass",
      "concern",
      "critical",
      "not_applicable",
      "unable_to_assess",
    ];
    for (const status of assessed) expect(isAssessed(status)).toBe(true);
    expect(isAssessed("unknown")).toBe(false);
  });

  it("treats only unable_to_assess as a coverage limitation", () => {
    for (const status of ASSESSMENT_STATUSES) {
      expect(isCoverageLimitation(status)).toBe(status === "unable_to_assess");
    }
  });

  it("requires a reason wherever a decision needs explaining", () => {
    expect(requiresReason("not_applicable")).toBe(true);
    expect(requiresReason("unable_to_assess")).toBe(true);
    expect(requiresReason("pass")).toBe(false);
    expect(requiresReason("unknown")).toBe(false);
  });
});

describe("finding rules", () => {
  it("only allows findings from states that observed something", () => {
    const canRaise = ASSESSMENT_STATUSES.filter((s) => STATUS_META[s].canRaiseFinding);
    expect([...canRaise]).toEqual(["concern", "critical", "unable_to_assess"]);
  });

  it("requires a finding for critical and nothing else", () => {
    const requires = ASSESSMENT_STATUSES.filter((s) => STATUS_META[s].requiresFinding);
    expect([...requires]).toEqual(["critical"]);
  });

  it("never lets pass raise a finding", () => {
    expect(STATUS_META.pass.canRaiseFinding).toBe(false);
  });
});

describe("legacy migration", () => {
  it("maps a legacy flag to concern, not critical", () => {
    // Decided at review: Critical is reserved for a deliberate clinician
    // escalation so the word keeps its meaning in a signed report.
    expect(LEGACY_STATUS_MAP.flag).toBe("concern");
  });

  it("maps the other legacy ratings directly", () => {
    expect(LEGACY_STATUS_MAP.pass).toBe("pass");
    expect(LEGACY_STATUS_MAP.warn).toBe("concern");
  });

  it("never produces critical from migrated content", () => {
    expect(Object.values(LEGACY_STATUS_MAP)).not.toContain("critical");
  });
});
