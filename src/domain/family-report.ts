/**
 * Turning family answers into something worth reading.
 *
 * The first version of this screen listed the flagged questions back at the
 * family verbatim, which read as a repetitive accusation and told them
 * nothing they didn't already know. A report has to answer three questions:
 * what did you find, why does it matter, and what happens next.
 *
 * Two rules carry over from the self-check and are enforced by tests:
 *   - Nothing here calls a home safe, or unsafe. It is not an assessment.
 *   - Guidance describes what commonly helps. It never prescribes.
 */

import { FAMILY_GUIDANCE, type Guidance } from "@/seed/family-guidance";
import { familyItemsFor, familyKey, type FamilyAnswer } from "./family";
import type { AssessmentTemplate } from "./types";

export interface ReportSpace {
  readonly id: string;
  readonly label: string;
  readonly template: AssessmentTemplate;
}

export interface ReportEntry {
  readonly spaceId: string;
  readonly spaceLabel: string;
  readonly code: string;
  readonly question: string;
  readonly answer: FamilyAnswer;
  /** True when the family said "not sure" rather than reporting a problem. */
  readonly uncertain: boolean;
  readonly guidance: Guidance | undefined;
}

export interface ReportRoom {
  readonly spaceId: string;
  readonly spaceLabel: string;
  readonly entries: readonly ReportEntry[];
  /** Questions answered the reassuring way. Shown as a count, not a list. */
  readonly clearCount: number;
}

export interface FamilyReport {
  /** Flagged first, then not-sure, ordered by how much each tends to matter. */
  readonly priority: readonly ReportEntry[];
  readonly rooms: readonly ReportRoom[];
  readonly flaggedCount: number;
  readonly unsureCount: number;
  readonly answeredCount: number;
  readonly totalCount: number;
  /** One line for the top of the report. Never reassures, never alarms. */
  readonly headline: string;
}

/**
 * Reported problems outrank uncertainty, and within each group the items
 * that most often lead to a fall come first. Ordering by room would put a
 * loose front-door mat above a missing grab bar purely by accident of which
 * room was added first.
 */
function rank(entry: ReportEntry): number {
  const weight = entry.guidance?.weight ?? 2;
  return (entry.uncertain ? 0 : 10) + weight;
}

export function buildFamilyReport(
  spaces: readonly ReportSpace[],
  answers: Readonly<Record<string, FamilyAnswer>>,
): FamilyReport {
  const rooms: ReportRoom[] = [];
  const all: ReportEntry[] = [];
  let answeredCount = 0;
  let totalCount = 0;

  for (const space of spaces) {
    const entries: ReportEntry[] = [];
    let clearCount = 0;

    for (const item of familyItemsFor(space.template)) {
      totalCount++;
      const answer = answers[familyKey(space.id, item.code)];
      if (!answer) continue;
      answeredCount++;

      const uncertain = answer === "unsure";
      if (!uncertain && answer !== item.concernWhen) {
        clearCount++;
        continue;
      }

      const entry: ReportEntry = {
        spaceId: space.id,
        spaceLabel: space.label,
        code: item.code,
        question: item.promptPlain,
        answer,
        uncertain,
        guidance: FAMILY_GUIDANCE[item.code],
      };
      entries.push(entry);
      all.push(entry);
    }

    entries.sort((a, b) => rank(b) - rank(a));
    rooms.push({ spaceId: space.id, spaceLabel: space.label, entries, clearCount });
  }

  const flaggedCount = all.filter((e) => !e.uncertain).length;
  const unsureCount = all.length - flaggedCount;
  const priority = [...all].sort((a, b) => rank(b) - rank(a));

  return {
    priority,
    rooms,
    flaggedCount,
    unsureCount,
    answeredCount,
    totalCount,
    headline: headlineFor(flaggedCount, unsureCount, answeredCount),
  };
}

/**
 * The handful of items to lead with.
 *
 * Capped per room so a bathroom with three serious items doesn't fill the
 * whole list and leave the rest of the home looking irrelevant.
 */
export function topPriorities(
  report: FamilyReport,
  limit = 3,
  perRoom = 2,
): readonly ReportEntry[] {
  const counts = new Map<string, number>();
  const picked: ReportEntry[] = [];

  for (const entry of report.priority) {
    if (picked.length >= limit) break;
    // A "not sure" is not a finding to lead with — it's a question for the
    // professional. Only lead with something the family actually reported.
    if (entry.uncertain) continue;
    const used = counts.get(entry.spaceId) ?? 0;
    if (used >= perRoom) continue;
    counts.set(entry.spaceId, used + 1);
    picked.push(entry);
  }
  return picked;
}

/**
 * Deliberately plain. "You have 6 hazards" would be a clinical claim we have
 * no basis for; "your home is safe" would be worse. Both are avoided.
 */
function headlineFor(flagged: number, unsure: number, answered: number): string {
  if (answered === 0) return "Nothing answered yet.";
  if (flagged === 0 && unsure === 0) {
    return "You didn't flag anything as you went through. That's a good sign, though it isn't a professional assessment.";
  }
  const bits: string[] = [];
  if (flagged > 0) bits.push(`${flagged} thing${flagged === 1 ? "" : "s"} worth a closer look`);
  if (unsure > 0) bits.push(`${unsure} you weren't sure about`);
  return `You came out with ${bits.join(", and ")}.`;
}

// ─── Contact details ────────────────────────────────────────────────────────

/**
 * Held in the browser only. Nothing is transmitted anywhere unless the family
 * chooses to share, and sharing hands the text to their own email client
 * rather than posting it to us. See docs/operating-model.md.
 */
export interface FamilyContact {
  name: string;
  email: string;
  phone: string;
  /** Explicit, unticked by default. Required before the report is shown. */
  consent: boolean;
}

export const EMPTY_CONTACT: FamilyContact = { name: "", email: "", phone: "", consent: false };

/** Loose on purpose: enough to catch a typo, not enough to reject real addresses. */
export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length >= 5 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export interface ContactProblem {
  readonly field: keyof FamilyContact;
  readonly message: string;
}

export function validateContact(contact: FamilyContact): readonly ContactProblem[] {
  const problems: ContactProblem[] = [];
  if (contact.name.trim().length < 2) {
    problems.push({ field: "name", message: "Please tell us what to call you." });
  }
  if (!looksLikeEmail(contact.email)) {
    problems.push({ field: "email", message: "Please enter an email address we can send this to." });
  }
  if (!contact.consent) {
    problems.push({ field: "consent", message: "Please tick the box to continue." });
  }
  return problems;
}

// ─── Sharing ────────────────────────────────────────────────────────────────

/**
 * The report as plain text, for email or the clipboard.
 *
 * This is the only place a name appears. It is composed in the browser and
 * handed to the family's own mail client — it is never sent through us.
 */
export function reportToPlainText(report: FamilyReport, contactName?: string): string {
  const lines: string[] = [];
  lines.push("HOME SAFETY SELF-CHECK");
  if (contactName?.trim()) lines.push(`Completed by: ${contactName.trim()}`);
  lines.push(`Questions answered: ${report.answeredCount} of ${report.totalCount}`);
  lines.push("");
  lines.push(report.headline);
  lines.push("");

  for (const room of report.rooms) {
    if (room.entries.length === 0) continue;
    lines.push(`--- ${room.spaceLabel} ---`);
    for (const entry of room.entries) {
      lines.push(`* ${entry.question}`);
      lines.push(`  Answered: ${entry.uncertain ? "Not sure" : entry.answer === "yes" ? "Yes" : "No"}`);
      if (entry.guidance) {
        lines.push(`  Why it matters: ${entry.guidance.why}`);
        lines.push(`  Often helps: ${entry.guidance.helps}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(
    "This is a self-check completed by a member of the household, not a professional assessment. " +
      "An occupational therapist can visit, check these items in person, and put together a plan.",
  );
  return lines.join("\n");
}

/** Caps the body so long reports don't silently truncate in a mail client. */
const MAILTO_BODY_LIMIT = 1800;

export function buildShareMailto(
  toEmail: string,
  report: FamilyReport,
  contactName?: string,
): string {
  const subject = "Home safety self-check";
  const full = reportToPlainText(report, contactName);
  const body =
    full.length > MAILTO_BODY_LIMIT
      ? `${full.slice(0, MAILTO_BODY_LIMIT)}\n\n[Report continues — the full version is attached or printed separately.]`
      : full;
  const to = toEmail.trim();
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
