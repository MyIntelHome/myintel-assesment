/**
 * Standing acceptance tests for the family self-check.
 *
 * The rule that matters most: a family answer is EVIDENCE, not a clinical
 * rating, and the family-facing summary must never tell someone their home
 * is safe. A self-check is not an assessment.
 */

import { describe, expect, it } from "vitest";
import {
  familyItemsFor,
  familyKey,
  familyProgress,
  isFlagged,
  summariseFamily,
  type FamilyAnswer,
} from "@/domain/family";
import { TEMPLATES } from "@/seed/templates";
import type { TemplateItem } from "@/domain/types";

const bathroom = TEMPLATES.bathroom;
const stairway = TEMPLATES.stairway;

const spaces = [{ id: "sp1", label: "Bathroom", template: bathroom }];

function answerAll(value: FamilyAnswer): Record<string, FamilyAnswer> {
  return Object.fromEntries(
    familyItemsFor(bathroom).map((i) => [familyKey("sp1", i.code), value]),
  );
}

describe("question authoring", () => {
  const every = Object.values(TEMPLATES).flatMap((t) => t.items);

  it("states polarity explicitly on every item", () => {
    for (const item of every) {
      expect(["yes", "no"], `${item.code} has no concernWhen`).toContain(item.concernWhen);
    }
  });

  it("asks a single question, not a compound one", () => {
    // Two question marks means two questions on one screen.
    for (const item of every) {
      const marks = (item.promptPlain.match(/\?/g) ?? []).length;
      expect(marks, `${item.code}: "${item.promptPlain}" asks more than one thing`).toBe(1);
    }
  });

  it("keeps family wording free of clinical jargon", () => {
    const jargon = ["transfer", "ambulat", "clearance", "anchored", "threshold", "contrast", "assess"];
    for (const item of every) {
      const text = item.promptPlain.toLowerCase();
      for (const word of jargon) {
        expect(text, `${item.code} uses clinical wording: ${word}`).not.toContain(word);
      }
    }
  });
});

describe("what families are asked", () => {
  it("leaves out optional clinical judgement calls", () => {
    // "Would a stair lift be worth considering?" is not a family question.
    const codes = familyItemsFor(stairway).map((i) => i.code);
    expect(codes).not.toContain("s7");
    expect(codes).toHaveLength(stairway.items.filter((i) => i.required).length);
  });
});

describe("flagging", () => {
  const needsYes = { code: "x", concernWhen: "no" } as TemplateItem; // absence is the problem
  const needsNo = { code: "y", concernWhen: "yes" } as TemplateItem; // presence is the problem

  it("flags the answer that indicates a problem, per item polarity", () => {
    expect(isFlagged(needsYes, "no")).toBe(true);
    expect(isFlagged(needsYes, "yes")).toBe(false);
    expect(isFlagged(needsNo, "yes")).toBe(true);
    expect(isFlagged(needsNo, "no")).toBe(false);
  });

  it("treats not-sure as worth checking rather than as a pass", () => {
    expect(isFlagged(needsYes, "unsure")).toBe(true);
    expect(isFlagged(needsNo, "unsure")).toBe(true);
  });

  it("does not flag an unanswered question", () => {
    expect(isFlagged(needsYes, undefined)).toBe(false);
  });
});

describe("the family summary never reassures", () => {
  it("does not call the home safe even when nothing is flagged", () => {
    // Every bathroom item answered the reassuring way.
    const answers: Record<string, FamilyAnswer> = {};
    for (const item of familyItemsFor(bathroom)) {
      answers[familyKey("sp1", item.code)] = item.concernWhen === "yes" ? "no" : "yes";
    }
    const summary = summariseFamily(spaces, answers);

    expect(summary.flagged).toHaveLength(0);
    expect(summary.statement.toLowerCase()).not.toContain("safe");
    expect(summary.statement.toLowerCase()).not.toContain("no risks");
    expect(summary.statement).toContain("isn't a professional assessment");
  });

  it("separates flagged answers from not-sure answers", () => {
    const answers: Record<string, FamilyAnswer> = {};
    const items = familyItemsFor(bathroom);
    answers[familyKey("sp1", items[0]!.code)] = items[0]!.concernWhen; // flagged
    answers[familyKey("sp1", items[1]!.code)] = "unsure";

    const summary = summariseFamily(spaces, answers);
    expect(summary.flagged).toHaveLength(1);
    expect(summary.unsure).toHaveLength(1);
  });

  it("counts every not-sure answer as worth checking", () => {
    const summary = summariseFamily(spaces, answerAll("unsure"));
    expect(summary.unsure).toHaveLength(familyItemsFor(bathroom).length);
    expect(summary.flagged).toHaveLength(0);
  });

  it("says nothing at all before any answer is given", () => {
    const summary = summariseFamily(spaces, {});
    expect(summary.statement).toBe("Nothing answered yet.");
  });
});

describe("progress", () => {
  it("counts only the questions families are actually asked", () => {
    const p = familyProgress([{ spaceId: "sp1", template: stairway }], {});
    expect(p.total).toBe(familyItemsFor(stairway).length);
    expect(p.total).toBeLessThan(stairway.items.length);
  });

  it("reaches complete when every asked question is answered", () => {
    const p = familyProgress([{ spaceId: "sp1", template: bathroom }], answerAll("yes"));
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });

  it("is not complete with no rooms", () => {
    expect(familyProgress([], {}).complete).toBe(false);
  });
});
