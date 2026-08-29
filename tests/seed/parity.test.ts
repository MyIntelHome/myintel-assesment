/**
 * Stage 0 acceptance: "Seed templates match the current app item for item."
 *
 * The legacy fixture below is transcribed from the v1 prototype's ROOMS array
 * (myintel-assessment/src/App.jsx). It is the reference the port is checked
 * against, so a dropped or renamed item fails the build rather than quietly
 * changing what clinicians assess.
 */

import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/seed/templates";
import { RECOMMENDATION_LIBRARY } from "@/seed/recommendations";
import type { SpaceType } from "@/domain/types";

/** Legacy room id -> new space type. */
const LEGACY_ROOM_TO_SPACE: Record<string, SpaceType> = {
  entryway: "entry",
  living: "living",
  kitchen: "kitchen",
  stairs: "stairway",
  bathroom: "bathroom",
  bedroom: "bedroom",
  exterior: "exterior",
};

/** Item codes and clinician-facing prompts, exactly as they were in v1. */
const LEGACY_ITEMS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  entryway: [
    ["e1", "Door threshold"],
    ["e2", "Entry lighting"],
    ["e3", "Non-slip surface at entry"],
    ["e4", "Step / ramp condition"],
    ["e5", "Handrails at steps"],
    ["e6", "Door hardware"],
    ["e7", "Visible house numbers"],
  ],
  living: [
    ["l1", "Throw rugs / loose mats"],
    ["l2", "Furniture pathway clearance"],
    ["l3", "Lighting adequacy"],
    ["l4", "Power cord management"],
    ["l5", "Chair/sofa transfer height"],
    ["l6", "Emergency device accessible"],
    ["l7", "Fall detection coverage"],
  ],
  kitchen: [
    ["k1", "Flooring slip resistance"],
    ["k2", "Cabinet/shelf reach zones"],
    ["k3", "Counter clearance"],
    ["k4", "Stove control placement"],
    ["k5", "Smoke / CO detectors"],
    ["k6", "Task lighting"],
    ["k7", "Step stool use"],
  ],
  stairs: [
    ["s1", "Handrails — both sides"],
    ["s2", "Stair tread condition"],
    ["s3", "Tread edge contrast"],
    ["s4", "Lighting at top and bottom"],
    ["s5", "Clear stair width"],
    ["s6", "Clutter on stairs"],
    ["s7", "Stair lift evaluation"],
  ],
  bathroom: [
    ["b1", "Grab bars at toilet"],
    ["b2", "Grab bars in shower/tub"],
    ["b3", "Non-slip in shower/tub"],
    ["b4", "Shower seat / bench"],
    ["b5", "Toilet height"],
    ["b6", "Night light path"],
    ["b7", "Faucet controls"],
    ["b8", "Floor when wet"],
  ],
  bedroom: [
    ["br1", "Bed height for transfer"],
    ["br2", "Path to bathroom clear"],
    ["br3", "Night lighting / switch reach"],
    ["br4", "Emergency device in reach"],
    ["br5", "Bed rail / assist device"],
    ["br6", "Clutter / equipment mgmt"],
    ["br7", "Closet accessibility"],
  ],
  exterior: [
    ["ex1", "Pathway condition"],
    ["ex2", "Exterior lighting"],
    ["ex3", "Driveway / parking surface"],
    ["ex4", "Exterior handrails"],
    ["ex5", "Mailbox accessibility"],
    ["ex6", "Entry ramp condition"],
  ],
};

describe("template parity with the v1 prototype", () => {
  for (const [legacyRoom, spaceType] of Object.entries(LEGACY_ROOM_TO_SPACE)) {
    describe(`${legacyRoom} -> ${spaceType}`, () => {
      const template = TEMPLATES[spaceType];
      const legacy = LEGACY_ITEMS[legacyRoom]!;

      it("carries every legacy item, in order, with codes preserved", () => {
        expect(template.items.map((i) => i.code)).toEqual(legacy.map(([code]) => code));
      });

      it("has no items the legacy content did not have", () => {
        expect(template.items).toHaveLength(legacy.length);
      });
    });
  }

  it("ports all 49 legacy items across the seven space types", () => {
    const ported = Object.values(LEGACY_ROOM_TO_SPACE).reduce(
      (n, spaceType) => n + TEMPLATES[spaceType].items.length,
      0,
    );
    const expected = Object.values(LEGACY_ITEMS).reduce((n, items) => n + items.length, 0);
    expect(ported).toBe(expected);
    expect(ported).toBe(49);
  });
});

describe("template authoring rules", () => {
  const everyItem = Object.values(TEMPLATES).flatMap((t) =>
    t.items.map((item) => ({ spaceType: t.spaceType, item })),
  );

  it("gives every item a plain-language phrasing for the family flow", () => {
    for (const { spaceType, item } of everyItem) {
      expect(item.promptPlain.length, `${spaceType}/${item.code} has no plain prompt`).toBeGreaterThan(10);
    }
  });

  it("phrases plain prompts differently from clinical prompts", () => {
    for (const { spaceType, item } of everyItem) {
      expect(item.promptPlain, `${spaceType}/${item.code} was not rewritten`).not.toBe(item.prompt);
    }
  });

  it("keeps item codes globally unique", () => {
    const codes = everyItem.map(({ item }) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("vendor neutrality of the seed content", () => {
  // Standing acceptance test from the plan: the default library is
  // vendor-neutral. Named products live in the gated catalog, not here.
  //
  // Matched on word boundaries — a naive substring check flags "monitoring"
  // for "ring" and "flooring" for "ring", which is a false positive.
  const BRANDS = ["myintel", "talius", "echo", "alexa", "google", "amazon", "apple", "ring", "nest"];

  const namesABrand = (text: string): string | null => {
    for (const brand of BRANDS) {
      if (new RegExp(`\\b${brand}\\b`, "i").test(text)) return brand;
    }
    return null;
  };

  it("names no brand in the recommendation library", () => {
    for (const rec of RECOMMENDATION_LIBRARY) {
      expect(namesABrand(rec.title), `"${rec.title}" names a brand`).toBeNull();
    }
  });

  it("names no brand in any assessment item", () => {
    for (const template of Object.values(TEMPLATES)) {
      for (const item of template.items) {
        const text = `${item.prompt} ${item.hint} ${item.promptPlain}`;
        expect(namesABrand(text), `${item.code} names a brand`).toBeNull();
      }
    }
  });

  it("catches a brand name if one is reintroduced", () => {
    // Guards the guard: proves the matcher actually fires.
    expect(namesABrand("MyIntel Motion Sensor")).toBe("myintel");
    expect(namesABrand("Echo Show / Smart Display")).toBe("echo");
    expect(namesABrand("Motion-activated monitoring sensor")).toBeNull();
  });

  it("keeps recommendation codes unique", () => {
    const codes = RECOMMENDATION_LIBRARY.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
