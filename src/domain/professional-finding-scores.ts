import type { CaseState } from "@/lib/case-store";
import { templateFor } from "@/seed/templates";
import { ITEM_CATEGORIES, type ItemCategory } from "./types";

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  access: "Access and movement",
  lighting: "Lighting",
  surfaces: "Floors and surfaces",
  support: "Rails and supports",
  transfers: "Transfers",
  hazards: "Home hazards",
  emergency: "Emergency access",
  reach: "Reach and usability",
};

function emptyCounts() {
  return { examined: 0, concern: 0, critical: 0, pending: 0, unable: 0, notApplicable: 0 };
}
type Counts = ReturnType<typeof emptyCounts>;
function result(counts: Counts) {
  const findings = counts.concern + counts.critical;
  return {
    ...counts,
    findings,
    // An unweighted proportion of recorded findings, not a validated clinical instrument.
    percent: counts.examined ? Math.round(findings / counts.examined * 100) : null,
    incomplete: counts.pending > 0 || counts.unable > 0,
  };
}
export type FindingScore = ReturnType<typeof result>;

/** Required and explicitly assessed optional items contribute; missing checks never count as passes. */
export function professionalFindingScores(state: CaseState) {
  const overall = emptyCounts();
  const categories = new Map(ITEM_CATEGORIES.map(id => [id, emptyCounts()]));
  const present = new Set<ItemCategory>();
  const rooms = state.spaces.map(space => {
    const room = emptyCounts();
    for (const item of templateFor(space.type).items) {
      present.add(item.category);
      const category = categories.get(item.category)!;
      const status = state.responses[space.id]?.[item.code]?.status ?? "unknown";
      for (const count of [overall, room, category]) {
        if (status === "pass" || status === "concern" || status === "critical") {
          count.examined++;
          if (status === "concern") count.concern++;
          if (status === "critical") count.critical++;
        } else if (status === "unable_to_assess") count.unable++;
        else if (status === "not_applicable") count.notApplicable++;
        else if (item.required) count.pending++;
      }
    }
    return { space, ...result(room) };
  });
  return {
    overall: result(overall),
    rooms,
    categories: ITEM_CATEGORIES.filter(id => present.has(id)).map(id => ({
      id, label: CATEGORY_LABELS[id], ...result(categories.get(id)!),
    })),
  };
}
