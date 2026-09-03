/**
 * The family / resident self-check.
 *
 * Design rule that everything here follows: **a family answer is evidence,
 * not a clinical judgement.** A daughter reporting "no grab bar" is a
 * reported observation. It never becomes a clinician's Concern or Critical
 * on its own — the clinician confirms or overrides it, exactly as they do
 * with an AI draft. That is what keeps a signed report meaningful.
 *
 * So family answers live in their own store and are surfaced to the
 * clinician as suggestions. They never write to `responses`.
 */

import type { AssessmentTemplate, TemplateItem } from "./types";

export const FAMILY_ANSWERS = ["yes", "no", "unsure"] as const;
export type FamilyAnswer = (typeof FAMILY_ANSWERS)[number];

export const FAMILY_ANSWER_LABEL: Record<FamilyAnswer, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

/** familyKey -> answer. Same shape as clinician responses, kept separate. */
export function familyKey(spaceId: string, code: string): string {
  return `${spaceId}::${code}`;
}

/**
 * Optional items are clinical judgement calls ("would a stair lift be worth
 * considering?") and are not put to families.
 */
export function familyItemsFor(template: AssessmentTemplate): readonly TemplateItem[] {
  return template.items.filter((i) => i.required);
}

/**
 * Does this answer suggest something worth a professional look?
 * "Not sure" is deliberately flagged too — an unknown is worth checking,
 * and it keeps families from feeling they must guess.
 */
export function isFlagged(item: TemplateItem, answer: FamilyAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer === "unsure") return true;
  return answer === item.concernWhen;
}

export interface FamilyProgress {
  readonly total: number;
  readonly answered: number;
  readonly percent: number;
  readonly complete: boolean;
}

export function familyProgress(
  templates: readonly { spaceId: string; template: AssessmentTemplate }[],
  answers: Readonly<Record<string, FamilyAnswer>>,
): FamilyProgress {
  let total = 0;
  let answered = 0;
  for (const { spaceId, template } of templates) {
    for (const item of familyItemsFor(template)) {
      total++;
      if (answers[familyKey(spaceId, item.code)]) answered++;
    }
  }
  return {
    total,
    answered,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
    complete: total > 0 && answered === total,
  };
}

export interface FamilySummaryEntry {
  readonly spaceId: string;
  readonly spaceLabel: string;
  readonly code: string;
  readonly question: string;
  readonly answer: FamilyAnswer;
}

export interface FamilySummary {
  readonly flagged: readonly FamilySummaryEntry[];
  readonly unsure: readonly FamilySummaryEntry[];
  readonly progress: FamilyProgress;
  /**
   * Wording shown to the family. Never states the home is safe — a
   * self-check is not an assessment, and saying otherwise would be the
   * single most harmful thing this screen could do.
   */
  readonly statement: string;
}

export function summariseFamily(
  spaces: readonly { id: string; label: string; template: AssessmentTemplate }[],
  answers: Readonly<Record<string, FamilyAnswer>>,
): FamilySummary {
  const flagged: FamilySummaryEntry[] = [];
  const unsure: FamilySummaryEntry[] = [];

  for (const space of spaces) {
    for (const item of familyItemsFor(space.template)) {
      const answer = answers[familyKey(space.id, item.code)];
      if (!answer) continue;
      const entry: FamilySummaryEntry = {
        spaceId: space.id,
        spaceLabel: space.label,
        code: item.code,
        question: item.promptPlain,
        answer,
      };
      if (answer === "unsure") unsure.push(entry);
      else if (answer === item.concernWhen) flagged.push(entry);
    }
  }

  const progress = familyProgress(
    spaces.map((s) => ({ spaceId: s.id, template: s.template })),
    answers,
  );

  let statement: string;
  if (progress.answered === 0) {
    statement = "Nothing answered yet.";
  } else if (flagged.length === 0 && unsure.length === 0) {
    // Careful wording. A completed self-check is still not an assessment.
    statement = progress.complete
      ? "You didn't flag anything in the rooms you went through. That's a good sign, though it isn't a professional assessment."
      : "Nothing flagged so far. Keep going to finish the rooms you added.";
  } else {
    const bits: string[] = [];
    if (flagged.length > 0) {
      bits.push(`${flagged.length} thing${flagged.length === 1 ? "" : "s"} worth a closer look`);
    }
    if (unsure.length > 0) {
      bits.push(`${unsure.length} you weren't sure about`);
    }
    statement = `${bits.join(", and ")}.`;
  }

  return { flagged, unsure, progress, statement };
}
