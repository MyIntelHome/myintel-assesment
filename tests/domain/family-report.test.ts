/**
 * The family report is the one screen a member of the public actually reads.
 *
 * Two things must never regress: it cannot tell anyone their home is safe,
 * and every flagged item must come with an explanation. A list of questions
 * repeated back at someone is not a report.
 */

import { describe, expect, it } from "vitest";
import {
  buildFamilyReport,
  buildShareMailto,
  looksLikeEmail,
  reportToPlainText,
  topPriorities,
  validateContact,
  EMPTY_CONTACT,
  type ReportSpace,
} from "@/domain/family-report";
import { familyItemsFor, familyKey, type FamilyAnswer } from "@/domain/family";
import { FAMILY_GUIDANCE } from "@/seed/family-guidance";
import { TEMPLATES } from "@/seed/templates";

const bathroom = TEMPLATES.bathroom;
const stairway = TEMPLATES.stairway;

const spaces: ReportSpace[] = [{ id: "sp1", label: "Bathroom", template: bathroom }];

/** Answers every bathroom question the way that raises a flag. */
function allFlagged(): Record<string, FamilyAnswer> {
  return Object.fromEntries(
    familyItemsFor(bathroom).map((i) => [familyKey("sp1", i.code), i.concernWhen]),
  );
}

/** Answers every bathroom question the reassuring way. */
function allClear(): Record<string, FamilyAnswer> {
  return Object.fromEntries(
    familyItemsFor(bathroom).map((i) => [
      familyKey("sp1", i.code),
      i.concernWhen === "yes" ? "no" : "yes",
    ]),
  );
}

describe("guidance coverage", () => {
  it("explains every question a family can be asked", () => {
    // A flagged item with no guidance renders as a bare question, which is
    // the exact failure this whole file exists to prevent.
    for (const template of Object.values(TEMPLATES)) {
      for (const item of familyItemsFor(template)) {
        expect(FAMILY_GUIDANCE[item.code], `no guidance for ${item.code}`).toBeDefined();
      }
    }
  });

  it("gives a reason and a next step for each one", () => {
    for (const [code, g] of Object.entries(FAMILY_GUIDANCE)) {
      expect(g.why.length, `${code} why is too thin`).toBeGreaterThan(30);
      expect(g.helps.length, `${code} helps is too thin`).toBeGreaterThan(20);
    }
  });

  it("does not prescribe or diagnose", () => {
    // Guidance describes what commonly helps. It is not clinical instruction.
    const banned = ["you must", "you should", "we recommend", "diagnos", "prescrib"];
    for (const [code, g] of Object.entries(FAMILY_GUIDANCE)) {
      const text = `${g.why} ${g.helps}`.toLowerCase();
      for (const phrase of banned) {
        expect(text, `${code} uses prescriptive wording: ${phrase}`).not.toContain(phrase);
      }
    }
  });
});

describe("building the report", () => {
  it("attaches guidance to every flagged entry", () => {
    const report = buildFamilyReport(spaces, allFlagged());
    expect(report.priority.length).toBeGreaterThan(0);
    for (const entry of report.priority) {
      expect(entry.guidance, `${entry.code} arrived without guidance`).toBeDefined();
    }
  });

  it("leaves out questions answered the reassuring way", () => {
    const report = buildFamilyReport(spaces, allClear());
    expect(report.priority).toHaveLength(0);
    expect(report.flaggedCount).toBe(0);
    expect(report.rooms[0]!.clearCount).toBe(familyItemsFor(bathroom).length);
  });

  it("puts reported problems above things the family was unsure of", () => {
    const items = familyItemsFor(bathroom);
    // A low-weight flag against a high-weight uncertainty: the flag still wins.
    const lowWeightFlag = items.find((i) => FAMILY_GUIDANCE[i.code]?.weight === 1);
    const highWeightUnsure = items.find((i) => FAMILY_GUIDANCE[i.code]?.weight === 3);
    expect(lowWeightFlag, "fixture needs a weight-1 bathroom item").toBeDefined();
    expect(highWeightUnsure, "fixture needs a weight-3 bathroom item").toBeDefined();

    const report = buildFamilyReport(spaces, {
      [familyKey("sp1", highWeightUnsure!.code)]: "unsure",
      [familyKey("sp1", lowWeightFlag!.code)]: lowWeightFlag!.concernWhen,
    });

    expect(report.priority[0]!.code).toBe(lowWeightFlag!.code);
    expect(report.priority[0]!.uncertain).toBe(false);
  });

  it("orders by what matters, not by the order rooms were added", () => {
    const two: ReportSpace[] = [
      { id: "sp1", label: "Bathroom", template: bathroom },
      { id: "sp2", label: "Stairs", template: stairway },
    ];
    const low = familyItemsFor(bathroom).find((i) => FAMILY_GUIDANCE[i.code]?.weight === 1)!;
    const high = familyItemsFor(stairway).find((i) => FAMILY_GUIDANCE[i.code]?.weight === 3)!;

    const report = buildFamilyReport(two, {
      [familyKey("sp1", low.code)]: low.concernWhen,
      [familyKey("sp2", high.code)]: high.concernWhen,
    });

    // The stairs item was added second but matters more.
    expect(report.priority[0]!.code).toBe(high.code);
  });

  it("counts flagged and unsure separately", () => {
    const items = familyItemsFor(bathroom);
    const report = buildFamilyReport(spaces, {
      [familyKey("sp1", items[0]!.code)]: items[0]!.concernWhen,
      [familyKey("sp1", items[1]!.code)]: "unsure",
    });
    expect(report.flaggedCount).toBe(1);
    expect(report.unsureCount).toBe(1);
    expect(report.answeredCount).toBe(2);
    expect(report.totalCount).toBe(items.length);
  });
});

describe("where to start", () => {
  const twoRooms: ReportSpace[] = [
    { id: "sp1", label: "Bathroom", template: bathroom },
    { id: "sp2", label: "Stairs", template: stairway },
  ];

  function flagEverything(): Record<string, FamilyAnswer> {
    const answers: Record<string, FamilyAnswer> = {};
    for (const space of twoRooms) {
      for (const item of familyItemsFor(space.template)) {
        answers[familyKey(space.id, item.code)] = item.concernWhen;
      }
    }
    return answers;
  }

  it("does not fill the list from a single room", () => {
    // The bathroom alone has more than three high-weight items. Without a
    // per-room cap the rest of the home never appears.
    const top = topPriorities(buildFamilyReport(twoRooms, flagEverything()));
    const rooms = new Set(top.map((e) => e.spaceId));
    expect(top).toHaveLength(3);
    expect(rooms.size).toBeGreaterThan(1);
  });

  it("leads only with things the family actually reported", () => {
    const answers: Record<string, FamilyAnswer> = {};
    for (const space of twoRooms) {
      for (const item of familyItemsFor(space.template)) {
        answers[familyKey(space.id, item.code)] = "unsure";
      }
    }
    // Everything is uncertain, so there is nothing to lead with.
    expect(topPriorities(buildFamilyReport(twoRooms, answers))).toHaveLength(0);
  });

  it("is empty when nothing was flagged", () => {
    expect(topPriorities(buildFamilyReport(spaces, allClear()))).toHaveLength(0);
  });

  it("never shows the same item twice", () => {
    const top = topPriorities(buildFamilyReport(twoRooms, flagEverything()));
    expect(new Set(top.map((e) => e.code)).size).toBe(top.length);
  });
});

describe("the report never reassures", () => {
  it("does not call the home safe when nothing is flagged", () => {
    const report = buildFamilyReport(spaces, allClear());
    const text = report.headline.toLowerCase();
    expect(text).not.toContain("safe");
    expect(text).not.toContain("no risks");
    expect(report.headline).toContain("isn't a professional assessment");
  });

  it("says nothing before any answer is given", () => {
    expect(buildFamilyReport(spaces, {}).headline).toBe("Nothing answered yet.");
  });

  it("carries the disclaimer into anything shared", () => {
    const report = buildFamilyReport(spaces, allFlagged());
    const text = reportToPlainText(report, "Sam");
    expect(text).toContain("not a professional assessment");
    expect(text).toContain("Sam");
    expect(text).toContain("Why it matters");
  });
});

describe("contact details", () => {
  it("requires a name, a usable email, and explicit consent", () => {
    const problems = validateContact(EMPTY_CONTACT);
    expect(problems.map((p) => p.field).sort()).toEqual(["consent", "email", "name"]);
  });

  it("does not tick consent for anyone", () => {
    expect(EMPTY_CONTACT.consent).toBe(false);
  });

  it("accepts a filled-in form", () => {
    expect(
      validateContact({ name: "Ada", email: "ada@example.com", phone: "", consent: true }),
    ).toHaveLength(0);
  });

  it("rejects addresses that are obviously typos", () => {
    expect(looksLikeEmail("ada@example.com")).toBe(true);
    expect(looksLikeEmail("ada@example")).toBe(false);
    expect(looksLikeEmail("ada.example.com")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });

  it("treats phone as optional", () => {
    expect(
      validateContact({ name: "Ada", email: "ada@example.com", phone: "", consent: true }),
    ).toHaveLength(0);
  });
});

describe("sharing", () => {
  it("builds a mailto the family's own client can open", () => {
    const report = buildFamilyReport(spaces, allFlagged());
    const link = buildShareMailto("ot@practice.com", report, "Sam");
    expect(link.startsWith("mailto:ot%40practice.com?")).toBe(true);
    expect(link).toContain("subject=");
    expect(link).toContain("body=");
  });

  it("keeps the body inside what a mail client will accept", () => {
    const many: ReportSpace[] = Array.from({ length: 6 }, (_, i) => ({
      id: `sp${i}`,
      label: `Bathroom ${i}`,
      template: bathroom,
    }));
    const answers: Record<string, FamilyAnswer> = {};
    for (const space of many) {
      for (const item of familyItemsFor(bathroom)) {
        answers[familyKey(space.id, item.code)] = item.concernWhen;
      }
    }
    const link = buildShareMailto("ot@practice.com", buildFamilyReport(many, answers), "Sam");
    expect(link.length).toBeLessThan(8000);
  });
});
