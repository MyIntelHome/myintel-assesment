"use client";

import { useMemo, useState } from "react";
import {
  FAMILY_ANSWERS,
  FAMILY_ANSWER_LABEL,
  familyItemsFor,
  familyKey,
  familyProgress,
  summariseFamily,
  type FamilyAnswer,
} from "@/domain/family";
import { SPACE_TYPE_META, type SpaceType } from "@/domain/types";
import { templateFor } from "@/seed/templates";
import type { CaseApi } from "@/lib/case-store";

const ROOM_CHOICES: SpaceType[] = ["entry", "living", "kitchen", "bathroom", "bedroom", "stairway", "exterior"];

/** Warm, non-clinical names. Families do not say "Entrance" or "Exterior". */
const FRIENDLY: Record<string, string> = {
  entry: "Front door",
  living: "Living room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bedroom: "Bedroom",
  stairway: "Stairs",
  exterior: "Outside",
};

type Phase = "welcome" | "rooms" | "questions" | "done";

export function FamilyFlow({ api }: { api: CaseApi }) {
  const { state } = api;
  const [phase, setPhase] = useState<Phase>(state.spaces.length > 0 ? "rooms" : "welcome");
  const [cursor, setCursor] = useState(0);

  /** Flat list of every question across every room the family added. */
  const questions = useMemo(
    () =>
      state.spaces.flatMap((space) =>
        familyItemsFor(templateFor(space.type)).map((item) => ({ space, item })),
      ),
    [state.spaces],
  );

  const progress = useMemo(
    () =>
      familyProgress(
        state.spaces.map((s) => ({ spaceId: s.id, template: templateFor(s.type) })),
        state.familyAnswers,
      ),
    [state.spaces, state.familyAnswers],
  );

  const summary = useMemo(
    () =>
      summariseFamily(
        state.spaces.map((s) => ({ id: s.id, label: s.label, template: templateFor(s.type) })),
        state.familyAnswers,
      ),
    [state.spaces, state.familyAnswers],
  );

  // ── Welcome ──────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <div className="fam">
        <div className="fam-card">
          <p className="fam-eyebrow">Home safety check</p>
          <h1>Let&rsquo;s look around the home together.</h1>
          <p className="fam-lede">
            We&rsquo;ll ask some simple questions about each room, one at a time. There are no wrong
            answers, and you can stop and come back whenever you like.
          </p>
          <p className="fam-lede">It takes about ten minutes.</p>
          <button type="button" className="fam-primary" onClick={() => setPhase("rooms")}>
            Get started
          </button>
          <p className="fam-note">
            We don&rsquo;t ask for a name, birthday, or address — nothing that identifies anyone.
          </p>
        </div>
      </div>
    );
  }

  // ── Choose rooms ─────────────────────────────────────────
  if (phase === "rooms") {
    return (
      <div className="fam">
        <div className="fam-card">
          <h1>Which rooms should we look at?</h1>
          <p className="fam-lede">
            Add every room you want to check. If the home has two bathrooms or three bedrooms, add
            each one.
          </p>

          <div className="fam-roomgrid">
            {ROOM_CHOICES.map((type) => (
              <button
                key={type}
                type="button"
                className="fam-roombtn"
                onClick={() => {
                  const existing = state.spaces.filter((s) => s.type === type).length;
                  const base = FRIENDLY[type] ?? SPACE_TYPE_META[type].label;
                  api.addSpace(type, existing === 0 ? base : `${base} ${existing + 1}`);
                }}
              >
                + {FRIENDLY[type] ?? SPACE_TYPE_META[type].label}
              </button>
            ))}
          </div>

          {state.spaces.length > 0 && (
            <>
              <h2 className="fam-sub">Rooms you&rsquo;ve added</h2>
              <ul className="fam-roomlist">
                {state.spaces.map((s) => (
                  <li key={s.id}>
                    <span>{s.label}</span>
                    <button type="button" className="fam-remove" onClick={() => api.removeSpace(s.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="fam-primary"
                onClick={() => {
                  const firstUnanswered = questions.findIndex(
                    (q) => !state.familyAnswers[familyKey(q.space.id, q.item.code)],
                  );
                  setCursor(firstUnanswered === -1 ? 0 : firstUnanswered);
                  setPhase("questions");
                }}
              >
                {progress.answered > 0 ? "Continue" : "Start the questions"} ({questions.length}{" "}
                questions)
              </button>
            </>
          )}

          {state.spaces.length === 0 && (
            <p className="fam-note">Pick at least one room above to begin.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────
  if (phase === "done" || cursor >= questions.length) {
    return (
      <div className="fam">
        <div className="fam-card">
          <p className="fam-eyebrow">All done</p>
          <h1>Thank you.</h1>
          <p className="fam-lede">{summary.statement}</p>

          {summary.flagged.length > 0 && (
            <>
              <h2 className="fam-sub">Worth a closer look</h2>
              <ul className="fam-summary">
                {summary.flagged.map((e) => (
                  <li key={`${e.spaceId}-${e.code}`}>
                    <strong>{e.spaceLabel}</strong>
                    <span>{e.question}</span>
                    <em>You answered: {FAMILY_ANSWER_LABEL[e.answer]}</em>
                  </li>
                ))}
              </ul>
            </>
          )}

          {summary.unsure.length > 0 && (
            <>
              <h2 className="fam-sub">Things you weren&rsquo;t sure about</h2>
              <ul className="fam-summary muted">
                {summary.unsure.map((e) => (
                  <li key={`${e.spaceId}-${e.code}`}>
                    <strong>{e.spaceLabel}</strong>
                    <span>{e.question}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="fam-disclaimer">
            <h2 className="fam-sub">What this is, and isn&rsquo;t</h2>
            <p>
              This is a starting point, not a professional assessment. An occupational therapist can
              visit, check the things you flagged, and put together a proper plan.
            </p>
          </div>

          <div className="fam-actions">
            <button type="button" className="fam-primary" onClick={() => window.print()}>
              Save or print this
            </button>
            <button type="button" className="fam-secondary" onClick={() => { setCursor(0); setPhase("questions"); }}>
              Go back through the answers
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── One question at a time ───────────────────────────────
  const current = questions[cursor]!;
  const key = familyKey(current.space.id, current.item.code);
  const answer = state.familyAnswers[key];

  const answerAndAdvance = (a: FamilyAnswer) => {
    api.setFamilyAnswer(key, a);
    // Small pause so the choice registers visually before moving on.
    window.setTimeout(() => {
      setCursor((c) => (c + 1 >= questions.length ? c + 1 : c + 1));
    }, 180);
  };

  return (
    <div className="fam">
      <div className="fam-progress" role="status" aria-live="polite">
        <div className="fam-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(((cursor + 1) / questions.length) * 100)}%` }} />
        </div>
        <p>
          Question {cursor + 1} of {questions.length} · {current.space.label}
        </p>
      </div>

      <div className="fam-card">
        <h1 className="fam-question">{current.item.promptPlain}</h1>

        <div className="fam-answers">
          {FAMILY_ANSWERS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={answer === a}
              className={answer === a ? "fam-answer on" : "fam-answer"}
              onClick={() => answerAndAdvance(a)}
            >
              {FAMILY_ANSWER_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="fam-nav">
          <button
            type="button"
            className="fam-secondary"
            disabled={cursor === 0}
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
          >
            Back
          </button>
          <button type="button" className="fam-secondary" onClick={() => setCursor((c) => c + 1)}>
            {answer ? "Next" : "Skip for now"}
          </button>
        </div>
      </div>

      <button type="button" className="fam-exit" onClick={() => setPhase("done")}>
        Finish and see the summary
      </button>
    </div>
  );
}
