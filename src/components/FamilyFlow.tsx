"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FAMILY_ANSWERS,
  FAMILY_ANSWER_LABEL,
  familyKey,
  familyProgress,
  groupItemsForFamily,
  minutesRemaining,
  roomProgress,
  type FamilyAnswer,
} from "@/domain/family";
import {
  buildFamilyReport,
  buildShareMailto,
  reportToPlainText,
  topPriorities,
  validateContact,
  type ContactProblem,
  type FamilyReport,
} from "@/domain/family-report";
import { SPACE_TYPE_META, type SpaceType } from "@/domain/types";
import { templateFor } from "@/seed/templates";
import type { CaseApi, Space } from "@/lib/case-store";

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

/**
 * Rotated so the screen between rooms doesn't read the same way five times.
 * Varying it is the cheapest defence against the flow feeling like a form.
 */
const MILESTONE_LINES = [
  "That's the first room done.",
  "Two rooms behind you.",
  "You're making good progress.",
  "Nearly through.",
  "Almost there.",
];

/** Where "send to a specialist" goes. One constant so it is easy to change. */
const SPECIALIST_EMAIL = "austin@myintelhome.com";

type Phase = "welcome" | "rooms" | "room" | "milestone" | "contact" | "report";

export function FamilyFlow({ api }: { api: CaseApi }) {
  const { state } = api;
  const [phase, setPhase] = useState<Phase>(state.spaces.length > 0 ? "rooms" : "welcome");
  const [roomIndex, setRoomIndex] = useState(0);
  const [problems, setProblems] = useState<readonly ContactProblem[]>([]);
  const [shareTo, setShareTo] = useState("");
  const [copied, setCopied] = useState(false);

  const overall = useMemo(
    () =>
      familyProgress(
        state.spaces.map((s) => ({ spaceId: s.id, template: templateFor(s.type) })),
        state.familyAnswers,
      ),
    [state.spaces, state.familyAnswers],
  );

  const report = useMemo(
    () =>
      buildFamilyReport(
        state.spaces.map((s) => ({ id: s.id, label: s.label, template: templateFor(s.type) })),
        state.familyAnswers,
      ),
    [state.spaces, state.familyAnswers],
  );

  const goToRoom = useCallback((index: number) => {
    setRoomIndex(index);
    setPhase("room");
    window.scrollTo({ top: 0 });
  }, []);

  // ── Welcome ──────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <div className="fam">
        <div className="fam-card">
          <p className="fam-eyebrow">Home safety check</p>
          <h1>Let&rsquo;s look around the home together.</h1>
          <p className="fam-lede">
            We&rsquo;ll go one room at a time. Each room is only a handful of questions, and you can
            stop and come back whenever you like.
          </p>
          <p className="fam-lede">Most people finish in about ten minutes.</p>
          <button type="button" className="fam-primary" onClick={() => setPhase("rooms")}>
            Get started
          </button>
          <p className="fam-note">
            We don&rsquo;t ask for a birthday or an address, and nothing you enter leaves this device
            unless you choose to share it.
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

          {state.spaces.length > 0 ? (
            <>
              <h2 className="fam-sub">Rooms you&rsquo;ve added</h2>
              <ul className="fam-roomlist">
                {state.spaces.map((s, i) => {
                  const p = roomProgress(s.id, templateFor(s.type), state.familyAnswers);
                  return (
                    <li key={s.id}>
                      <span>{s.label}</span>
                      <span className="fam-roomcount">
                        {p.answered > 0 ? `${p.answered}/${p.total}` : `${p.total} questions`}
                      </span>
                      <button
                        type="button"
                        className="fam-remove"
                        onClick={() => {
                          api.removeSpace(s.id);
                          if (roomIndex >= i) setRoomIndex(Math.max(0, roomIndex - 1));
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className="fam-primary"
                onClick={() => {
                  const next = state.spaces.findIndex((s) => {
                    return !roomProgress(s.id, templateFor(s.type), state.familyAnswers).complete;
                  });
                  goToRoom(next === -1 ? 0 : next);
                }}
              >
                {overall.answered > 0 ? "Carry on" : "Start with the first room"}
              </button>
              <p className="fam-note">
                About {minutesRemaining(overall) || 1} minute
                {minutesRemaining(overall) === 1 ? "" : "s"}, across {state.spaces.length} room
                {state.spaces.length === 1 ? "" : "s"}.
              </p>
            </>
          ) : (
            <p className="fam-note">Pick at least one room above to begin.</p>
          )}
        </div>
      </div>
    );
  }

  // ── One room at a time ───────────────────────────────────
  if (phase === "room") {
    const space = state.spaces[roomIndex];
    if (!space) {
      return (
        <div className="fam">
          <div className="fam-card">
            <h1>That room is no longer here.</h1>
            <button type="button" className="fam-primary" onClick={() => setPhase("rooms")}>
              Back to the room list
            </button>
          </div>
        </div>
      );
    }
    return (
      <RoomScreen
        key={space.id}
        api={api}
        space={space}
        index={roomIndex}
        total={state.spaces.length}
        onDone={() => {
          setPhase("milestone");
          window.scrollTo({ top: 0 });
        }}
        onBack={() => (roomIndex === 0 ? setPhase("rooms") : goToRoom(roomIndex - 1))}
      />
    );
  }

  // ── Between rooms ────────────────────────────────────────
  if (phase === "milestone") {
    const space = state.spaces[roomIndex];
    const isLast = roomIndex >= state.spaces.length - 1;
    const roomEntries = report.rooms.find((r) => r.spaceId === space?.id)?.entries ?? [];
    const line = MILESTONE_LINES[Math.min(roomIndex, MILESTONE_LINES.length - 1)];
    const mins = minutesRemaining(overall);

    return (
      <div className="fam">
        <div className="fam-card fam-milestone">
          <div className="fam-tick" aria-hidden="true">
            ✓
          </div>
          <p className="fam-eyebrow">{line}</p>
          <h1>{space?.label} done.</h1>

          <p className="fam-lede">
            {roomEntries.length === 0
              ? "Nothing to flag in there."
              : `You noted ${roomEntries.length} thing${roomEntries.length === 1 ? "" : "s"} in that room. We'll explain each one at the end.`}
          </p>

          {!isLast && (
            <p className="fam-note">
              {state.spaces.length - roomIndex - 1} room
              {state.spaces.length - roomIndex - 1 === 1 ? "" : "s"} to go
              {mins > 0 ? ` · about ${mins} minute${mins === 1 ? "" : "s"} left` : ""}.
            </p>
          )}

          <div className="fam-actions">
            {isLast ? (
              <button type="button" className="fam-primary" onClick={() => setPhase("contact")}>
                See what we found
              </button>
            ) : (
              <button type="button" className="fam-primary" onClick={() => goToRoom(roomIndex + 1)}>
                Next room: {state.spaces[roomIndex + 1]?.label}
              </button>
            )}
            <button type="button" className="fam-secondary" onClick={() => setPhase("rooms")}>
              {isLast ? "Add another room" : "See all rooms"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Contact details, before the report ───────────────────
  if (phase === "contact") {
    const contact = state.familyContact;
    const problemFor = (field: string) => problems.find((p) => p.field === field)?.message;

    return (
      <div className="fam">
        <div className="fam-card">
          <p className="fam-eyebrow">One last step</p>
          <h1>Where should we send your results?</h1>
          <p className="fam-lede">
            {report.flaggedCount + report.unsureCount > 0
              ? `We've got ${report.flaggedCount + report.unsureCount} item${report.flaggedCount + report.unsureCount === 1 ? "" : "s"} to walk you through, with what each one means and what usually helps.`
              : "Your results are ready, along with what to keep an eye on."}
          </p>

          <form
            className="fam-form"
            onSubmit={(e) => {
              e.preventDefault();
              const found = validateContact(contact);
              setProblems(found);
              if (found.length === 0) {
                setPhase("report");
                window.scrollTo({ top: 0 });
              }
            }}
          >
            <label className="fam-field">
              <span>Your name</span>
              <input
                value={contact.name}
                autoComplete="name"
                onChange={(e) => api.patchFamilyContact({ name: e.target.value })}
                aria-invalid={Boolean(problemFor("name"))}
              />
              {problemFor("name") && <em className="fam-error">{problemFor("name")}</em>}
            </label>

            <label className="fam-field">
              <span>Email</span>
              <input
                type="email"
                value={contact.email}
                autoComplete="email"
                inputMode="email"
                onChange={(e) => api.patchFamilyContact({ email: e.target.value })}
                aria-invalid={Boolean(problemFor("email"))}
              />
              {problemFor("email") && <em className="fam-error">{problemFor("email")}</em>}
            </label>

            <label className="fam-field">
              <span>
                Phone <small>optional</small>
              </span>
              <input
                type="tel"
                value={contact.phone}
                autoComplete="tel"
                inputMode="tel"
                onChange={(e) => api.patchFamilyContact({ phone: e.target.value })}
              />
            </label>

            <label className="fam-check">
              <input
                type="checkbox"
                checked={contact.consent}
                onChange={(e) => api.patchFamilyContact({ consent: e.target.checked })}
                aria-invalid={Boolean(problemFor("consent"))}
              />
              <span>
                I&rsquo;m happy to be contacted about these results. I can ask to be removed at any
                time.
              </span>
            </label>
            {problemFor("consent") && <em className="fam-error">{problemFor("consent")}</em>}

            <button type="submit" className="fam-primary">
              Show my results
            </button>
          </form>

          <p className="fam-note">
            Your details stay on this device. Nothing is sent anywhere until you press a share
            button on the next screen.
          </p>
        </div>
      </div>
    );
  }

  // ── The report ───────────────────────────────────────────
  return (
    <ReportScreen
      report={report}
      contactName={state.familyContact.name}
      shareTo={shareTo}
      setShareTo={setShareTo}
      copied={copied}
      setCopied={setCopied}
      onRevisit={() => goToRoom(0)}
      onRooms={() => setPhase("rooms")}
    />
  );
}

// ─── Room screen ────────────────────────────────────────────────────────────

/**
 * A whole room on one screen, grouped under short headings.
 *
 * The earlier build put one question per screen, which meant fifty screens
 * and no sense of an ending. A room is five to eight questions with a
 * visible finish line, and answering scrolls to the next one so there is
 * always momentum without a page transition.
 */
function RoomScreen({
  api,
  space,
  index,
  total,
  onDone,
  onBack,
}: {
  api: CaseApi;
  space: Space;
  index: number;
  total: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const template = templateFor(space.type);
  const groups = useMemo(() => groupItemsForFamily(template), [template]);
  const progress = roomProgress(space.id, template, api.state.familyAnswers);
  const refs = useRef(new Map<string, HTMLLIElement>());

  const codes = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.code)), [groups]);

  const answerAndAdvance = (code: string, answer: FamilyAnswer) => {
    api.setFamilyAnswer(familyKey(space.id, code), answer);

    // Scroll to the next question still unanswered, so the eye is already
    // where the next tap goes.
    const from = codes.indexOf(code);
    const nextCode = codes
      .slice(from + 1)
      .find((c) => !api.state.familyAnswers[familyKey(space.id, c)]);
    if (nextCode) {
      window.setTimeout(() => {
        refs.current.get(nextCode)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 160);
    }
  };

  return (
    <div className="fam">
      <div className="fam-progress" role="status" aria-live="polite">
        <div className="fam-bar" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <p>
          {space.label} · {progress.answered} of {progress.total} · room {index + 1} of {total}
        </p>
      </div>

      <div className="fam-card">
        <h1 className="fam-roomtitle">{space.label}</h1>
        <p className="fam-lede">
          Have a look around as you answer. If you don&rsquo;t know, say so — that&rsquo;s a useful
          answer too.
        </p>

        {groups.map((group) => (
          <section key={group.category} className="fam-group">
            <h2 className="fam-grouphead">{group.label}</h2>
            <ul className="fam-qlist">
              {group.items.map((item) => {
                const key = familyKey(space.id, item.code);
                const answer = api.state.familyAnswers[key];
                return (
                  <li
                    key={item.code}
                    className={answer ? "fam-q answered" : "fam-q"}
                    ref={(el) => {
                      if (el) refs.current.set(item.code, el);
                      else refs.current.delete(item.code);
                    }}
                  >
                    <p className="fam-qtext">{item.promptPlain}</p>
                    <div className="fam-answers" role="group" aria-label={item.promptPlain}>
                      {FAMILY_ANSWERS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={answer === a}
                          className={answer === a ? "fam-answer on" : "fam-answer"}
                          onClick={() => answerAndAdvance(item.code, a)}
                        >
                          {FAMILY_ANSWER_LABEL[a]}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="fam-nav">
          <button type="button" className="fam-secondary" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className={progress.complete ? "fam-primary" : "fam-secondary"}
            onClick={onDone}
          >
            {progress.complete
              ? "Done with this room"
              : `Move on (${progress.total - progress.answered} unanswered)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Report screen ──────────────────────────────────────────────────────────

function ReportScreen({
  report,
  contactName,
  shareTo,
  setShareTo,
  copied,
  setCopied,
  onRevisit,
  onRooms,
}: {
  report: FamilyReport;
  contactName: string;
  shareTo: string;
  setShareTo: (v: string) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
  onRevisit: () => void;
  onRooms: () => void;
}) {
  const top = topPriorities(report);
  const hasItems = report.priority.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToPlainText(report, contactName));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fam">
      <div className="fam-card fam-report">
        <p className="fam-eyebrow">Your results</p>
        <h1>{contactName.trim() ? `Here's what you found, ${contactName.trim()}.` : "Here's what you found."}</h1>
        <p className="fam-lede">{report.headline}</p>

        <dl className="fam-tally">
          <div>
            <dt>Worth a closer look</dt>
            <dd>{report.flaggedCount}</dd>
          </div>
          <div>
            <dt>Not sure</dt>
            <dd>{report.unsureCount}</dd>
          </div>
          <div>
            <dt>Questions answered</dt>
            <dd>
              {report.answeredCount} of {report.totalCount}
            </dd>
          </div>
        </dl>

        {top.length > 0 && (
          <section className="fam-section">
            <h2 className="fam-sub">Where to start</h2>
            <p className="fam-lede">
              Of everything you flagged, these are the ones that most often make a difference. The
              reasons for each are further down.
            </p>
            <ol className="fam-top">
              {top.map((entry) => (
                <li key={`${entry.spaceId}-${entry.code}`}>
                  <span className="fam-toproom">{entry.spaceLabel}</span>
                  <p className="fam-topwhy">{entry.question}</p>
                  {entry.guidance && <p className="fam-tophelp">{entry.guidance.helps}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {hasItems && (
          <section className="fam-section">
            <h2 className="fam-sub">Room by room</h2>
            {report.rooms.map((room) => (
              <div key={room.spaceId} className="fam-reproom">
                <h3>
                  {room.spaceLabel}
                  <span className="fam-repclear">
                    {room.entries.length === 0
                      ? "nothing flagged"
                      : `${room.entries.length} noted · ${room.clearCount} fine`}
                  </span>
                </h3>

                {room.entries.length === 0 ? (
                  <p className="fam-repnone">
                    Nothing came up here. Worth checking again if anything changes.
                  </p>
                ) : (
                  <ul className="fam-repitems">
                    {room.entries.map((entry) => (
                      <li
                        key={entry.code}
                        className={entry.uncertain ? "fam-repitem unsure" : "fam-repitem"}
                      >
                        <p className="fam-repq">
                          <span className="fam-reptag">
                            {entry.uncertain ? "Not sure" : "Worth a look"}
                          </span>{" "}
                          <span>{entry.question}</span>
                        </p>
                        {entry.guidance ? (
                          <>
                            <p className="fam-repwhy">
                              <strong>Why it matters.</strong> {entry.guidance.why}
                            </p>
                            <p className="fam-rephelp">
                              <strong>What usually helps.</strong> {entry.guidance.helps}
                            </p>
                          </>
                        ) : (
                          <p className="fam-repwhy">Worth mentioning to a professional.</p>
                        )}
                        {entry.uncertain && (
                          <p className="fam-repnote">
                            You weren&rsquo;t sure about this one — easy for someone to check in
                            person.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="fam-section fam-share no-print">
          <h2 className="fam-sub">Share this with someone</h2>
          <p className="fam-lede">
            An occupational therapist can visit, check these in person, and put together a proper
            plan. Send them what you found so they aren&rsquo;t starting from scratch.
          </p>

          <div className="fam-sharerow">
            <label className="fam-field">
              <span>Their email address</span>
              <input
                type="email"
                inputMode="email"
                value={shareTo}
                placeholder="name@practice.com"
                onChange={(e) => setShareTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="fam-primary"
              disabled={!shareTo.includes("@")}
              onClick={() => {
                window.location.href = buildShareMailto(shareTo, report, contactName);
              }}
            >
              Send to them
            </button>
          </div>
          <p className="fam-note">
            This opens your own email app with the results written out, ready for you to read over
            and send.
          </p>

          <div className="fam-actions">
            <button
              type="button"
              className="fam-secondary"
              onClick={() => {
                window.location.href = buildShareMailto(SPECIALIST_EMAIL, report, contactName);
              }}
            >
              Send to a MyIntel specialist
            </button>
            <button type="button" className="fam-secondary" onClick={copy}>
              {copied ? "Copied" : "Copy the text"}
            </button>
            <button type="button" className="fam-secondary" onClick={() => window.print()}>
              Save or print
            </button>
          </div>
        </section>

        <div className="fam-disclaimer">
          <h2 className="fam-sub">What this is, and isn&rsquo;t</h2>
          <p>
            This is a self-check you filled in yourself, not a professional assessment. It
            can&rsquo;t tell you a home is safe, and it may have missed things. What it does is give
            an occupational therapist a head start on what to look at first.
          </p>
        </div>

        <div className="fam-actions no-print">
          <button type="button" className="fam-secondary" onClick={onRevisit}>
            Change an answer
          </button>
          <button type="button" className="fam-secondary" onClick={onRooms}>
            Add another room
          </button>
        </div>
      </div>
    </div>
  );
}
