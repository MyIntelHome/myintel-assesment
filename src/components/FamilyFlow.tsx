"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  looksLikeEmail,
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
  const roomIndex = Math.min(state.familyPosition?.roomIndex ?? 0, Math.max(0,state.spaces.length - 1));
  const savedPhase = state.familyPosition?.phase ?? (state.spaces.length > 0 ? "rooms" : "welcome");
  const phase = savedPhase === "contact" ? "report" : savedPhase;
  const setPhase = (phase: Phase) => api.setFamilyPosition({phase,roomIndex});
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
    api.setFamilyPosition({roomIndex:index,phase:"room"});
    window.scrollTo({ top: 0 });
  }, [api.setFamilyPosition]);
  useEffect(()=>{
    const heading = document.querySelector<HTMLElement>(".fam h1");
    heading?.setAttribute("tabindex","-1");
    heading?.focus({preventScroll:true});
  },[phase,roomIndex]);

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
          <p className="fam-lede">Take your time. You can read your results without giving us contact details.</p>
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
                      <button type="button" className="fam-secondary" onClick={()=>goToRoom(i)} aria-label={`Review answers for ${s.label}`}>{s.label}</button>
                      <span className="fam-roomcount">
                        {p.answered > 0 ? `${p.answered}/${p.total}` : `${p.total} questions`}
                      </span>
                      <button
                        type="button"
                        className="fam-remove"
                        onClick={() => {
                          api.removeSpace(s.id);
                          if (roomIndex >= i) api.setFamilyPosition({phase:"rooms",roomIndex:Math.max(0, roomIndex - 1)});
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
    const roomReport = report.rooms.find((r) => r.spaceId === space?.id);
    const roomEntries = roomReport?.entries ?? [];
    const unanswered = roomReport?.unansweredCount ?? 0;
    const line = MILESTONE_LINES[Math.min(roomIndex, MILESTONE_LINES.length - 1)];
    const mins = minutesRemaining(overall);

    return (
      <div className="fam">
        <div className="fam-card fam-milestone">
          <div className="fam-tick" aria-hidden="true">
            ✓
          </div>
          <p className="fam-eyebrow">{unanswered ? "Progress saved" : line}</p>
          <h1>{space?.label}{unanswered ? ": still some questions to check" : " complete"}.</h1>

          <p className="fam-lede">
            {unanswered ? `${unanswered} questions are unanswered. We can only summarise the answers you've given.` : roomEntries.length === 0
              ? "You reported no concerns in these answers. This does not confirm the room is safe."
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
              <button type="button" className="fam-primary" onClick={() => setPhase("report")}>
                See my results
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

  // ── The report ───────────────────────────────────────────
  return (
    <ReportScreen
      report={report}
      contactName=""
      shareTo={shareTo}
      setShareTo={setShareTo}
      copied={copied}
      setCopied={setCopied}
      onRevisit={() => setPhase("rooms")}
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
  const [autoAdvance, setAutoAdvance] = useState(false);

  const codes = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.code)), [groups]);

  const answerAndAdvance = (code: string, answer: FamilyAnswer) => {
    api.setFamilyAnswer(familyKey(space.id, code), answer);

    // Scroll to the next question still unanswered, so the eye is already
    // where the next tap goes.
    const from = codes.indexOf(code);
    const nextCode = codes
      .slice(from + 1)
      .find((c) => !api.state.familyAnswers[familyKey(space.id, c)]);
    if (autoAdvance && nextCode) {
      window.setTimeout(() => {
        refs.current.get(nextCode)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
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
        <label className="fam-check"><input type="checkbox" checked={autoAdvance} onChange={e=>setAutoAdvance(e.target.checked)} /><span>Scroll to the next question after I answer</span></label>

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
  const [copyError, setCopyError] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToPlainText(report, contactName));
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  return (
    <div className="fam">
      <div className="fam-card fam-report">
        <p className="fam-eyebrow">Your results</p>
        <h1>{contactName.trim() ? `Here's what you found, ${contactName.trim()}.` : "Here's what you found."}</h1>
        <p className="fam-lede">{report.headline}</p>
        <div className="fam-help no-print">
          <h2>Want help with your next step?</h2>
          <p>An OT can review your concerns and discuss what fits your home. Ask MyIntel about availability and costs before deciding.</p>
          <button type="button" className="fam-primary" onClick={()=>{window.location.href=buildShareMailto(SPECIALIST_EMAIL,report,contactName);}}>Draft a request for help</button>
          <p className="fam-note">Opens your email app with a short summary addressed to MyIntel. Review it and press Send there. No request or appointment is confirmed by this button.</p>
        </div>

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
              Here are a few reported concerns to discuss first. An OT can help decide what matters most for this resident.
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

        {report.rooms.length > 0 && (
          <section className="fam-section">
            <h2 className="fam-sub">Room by room</h2>
            {report.rooms.map((room) => (
              <div key={room.spaceId} className="fam-reproom">
                <h3>
                  {room.spaceLabel}
                  <span className="fam-repclear">
                    {room.unansweredCount ? `${room.unansweredCount} unanswered` : `${room.entries.length} noted`}
                  </span>
                </h3>

                {room.entries.length === 0 ? (
                  <p className="fam-repnone">
                    {room.unansweredCount ? "This room has unanswered questions. No concerns were reported in the answers provided." : "No concerns reported in these answers. This is not a professional assessment."}
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
              disabled={!looksLikeEmail(shareTo)}
              onClick={() => {
                window.location.href = buildShareMailto(shareTo, report, contactName);
              }}
            >
              Draft email summary
            </button>
          </div>
          <p className="fam-note">
            Opens your email app with a short summary to review and send. Download the full findings report if you want to attach it yourself.
          </p>

          <div className="fam-actions">
            <button type="button" className="fam-secondary" onClick={copy}>
              {copied ? "Copied" : "Copy the text"}
            </button>
            <button type="button" className="fam-secondary" onClick={() => window.print()}>
              Save or print
            </button>
            <button type="button" className="fam-secondary" onClick={()=>{
              const url=URL.createObjectURL(new Blob([reportToPlainText(report,contactName)],{type:"text/plain;charset=utf-8"}));
              const a=document.createElement("a");a.href=url;a.download="MyIntel-home-check.txt";a.click();
              window.setTimeout(()=>URL.revokeObjectURL(url),1000);
            }}>Download full findings</button>
          </div>
          {copyError && <p role="alert">Copy was unavailable. Download the full findings instead.</p>}
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
            Review my rooms and answers
          </button>
          <button type="button" className="fam-secondary" onClick={onRooms}>
            Add another room
          </button>
        </div>
      </div>
    </div>
  );
}
