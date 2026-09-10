"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FAMILY_ANSWERS,
  FAMILY_ANSWER_LABEL,
  familyKey,
  familyProgress,
  groupItemsForFamily,
  roomProgress,
  type FamilyAnswer,
} from "@/domain/family";
import {
  buildFamilyReport,
  buildShareMailto,
  looksLikeEmail,
  reportToPlainText,
  topPriorities,
  type FamilyReport,
} from "@/domain/family-report";
import { SPACE_TYPE_META, type ItemCategory, type SpaceType } from "@/domain/types";
import type { CaseApi, Space } from "@/lib/case-store";
import {familyTemplateFor,profileLines,homeQuestionText} from "@/domain/home-profile";
import {HomeSetup} from "./HomeSetup";
import {HomeInsights} from "./HomeInsights";

const ROOM_CHOICES: SpaceType[] = [
  "entry",
  "living",
  "kitchen",
  "bathroom",
  "bedroom",
  "stairway",
  "exterior",
];

const FRIENDLY: Record<string, string> = {
  entry: "Front door",
  living: "Living room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bedroom: "Bedroom",
  stairway: "Stairs",
  exterior: "Outside",
};

const LOOK_HINT: Record<ItemCategory, string> = {
  access: "Look at the usual route through this area. Check it as it is used on a normal day.",
  lighting: "Check in the light normally used here, including at night if that is when the area is used.",
  surfaces: "Look for wet, worn, loose, shiny, or uneven surfaces. Check the whole area people step on.",
  support: "Think about what the person normally holds for support. Choose Not sure if you do not know whether it is secure; do not test it by leaning or pulling.",
  transfers: "Think about the usual way the person sits down, stands up, gets in, or gets out.",
  hazards: "Look along the floor and the usual walking path for anything a foot or walking aid could catch.",
  emergency: "Think about whether the person could get help from this spot if nobody else were nearby.",
  reach: "Check the things used most days. Notice any stretching, bending, twisting, or strong gripping needed.",
};

type Phase = "welcome" | "routine" | "home" | "rooms" | "room" | "milestone" | "contact" | "report";

type FlowPosition = {
  phase: Phase;
  roomIndex: number;
  questionIndex?: number;
};

type IconName = "arrow-left" | "arrow-right" | "check" | "copy" | "download" | "mail" | "trash";

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className="family-v2__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
      {name === "arrow-left" && <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>}
      {name === "arrow-right" && <><path d="m9 18 6-6-6-6" /><path d="M5 12h10" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "copy" && <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>}
      {name === "download" && <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>}
      {name === "mail" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>}
      {name === "trash" && <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 13h8l1-13" /></>}
    </svg>
  );
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function FamilyFlow({
  api,
  onRequestHelp,
}: {
  api: CaseApi;
  onRequestHelp?: (service?: string) => void;
}) {
  const { state } = api;
  const maxRoomIndex = Math.max(0, state.spaces.length - 1);
  const roomIndex = Math.min(state.familyPosition?.roomIndex ?? 0, maxRoomIndex);
  const savedPhase = (state.familyPosition?.phase ?? (state.spaces.length ? "rooms" : "welcome")) as Phase;
  const phase: Phase = savedPhase === "contact" ? "report" : savedPhase;
  const questionIndex = Math.max(0, state.familyPosition?.questionIndex ?? 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [shareTo, setShareTo] = useState("");
  const [copied, setCopied] = useState(false);

  const overall = useMemo(
    () => familyProgress(
      state.spaces.map((space) => ({ spaceId: space.id, template: familyTemplateFor(space) })),
      state.familyAnswers,
    ),
    [state.spaces, state.familyAnswers],
  );

  const report = useMemo(
    () => buildFamilyReport(
      state.spaces.map((space) => ({ id: space.id, label: space.level ? `${space.label} · Level ${space.level}` : space.label, template: familyTemplateFor(space) })),
      state.familyAnswers,
    ),
    [state.spaces, state.familyAnswers],
  );

  const setPosition = (next: FlowPosition) => {
    api.setFamilyPosition(next);
    scrollToTop();
  };

  const setPhase = (nextPhase: Phase) => {
    setPosition({ phase: nextPhase, roomIndex, questionIndex });
  };

  const openRoom = (index: number) => {
    const space = state.spaces[index];
    if (!space) return;
    const items = groupItemsForFamily(familyTemplateFor(space)).flatMap((group) => group.items);
    const firstUnanswered = items.findIndex((item) => !state.familyAnswers[familyKey(space.id, item.code)]);
    setPosition({ phase: "room", roomIndex: index, questionIndex: firstUnanswered < 0 ? 0 : firstUnanswered });
  };

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [phase, roomIndex, questionIndex]);

  if (phase === "welcome" || phase === "routine" || phase === "home") return <HomeSetup api={api} step={phase==="home"?"home":"routine"}/>;

  if (phase === "rooms") {
    return (
      <main className="family-v2">
        <FlowHeader percent={overall.percent} label={`${overall.answered} of ${overall.total} answered`} />
        <section className="family-v2__card">
          <p className="family-v2__eyebrow">Set up your check</p>
          <h1 ref={headingRef} tabIndex={-1}>Review your room checklist</h1>
          <p className="family-v2__lead">Check the rooms and levels below. Start anywhere, and come back when you need to.</p><button className="family-v2__back" onClick={()=>setPhase("routine")}>Edit daily life & home details</button>

          <div className="family-v2__room-picker">
            {ROOM_CHOICES.map((type) => (
              <button
                className="family-v2__add-room"
                key={type}
                type="button"
                onClick={() => {
                  const count = state.spaces.filter((space) => space.type === type).length;
                  const base = FRIENDLY[type] ?? SPACE_TYPE_META[type].label;
                  api.addSpace(type, count ? `${base} ${count + 1}` : base);
                }}
              >
                <span aria-hidden="true">+</span> {FRIENDLY[type] ?? SPACE_TYPE_META[type].label}
              </button>
            ))}
          </div>

          {state.spaces.length > 0 ? (
            <section className="family-v2__room-section" aria-labelledby="your-rooms-heading">
              <div className="family-v2__section-heading">
                <h2 id="your-rooms-heading">Your rooms</h2>
                <span>{state.spaces.length} added</span>
              </div>
              <ul className="family-v2__room-list">
                {state.spaces.map((space, index) => {
                  const progress = roomProgress(space.id, familyTemplateFor(space), state.familyAnswers);
                  const stateLabel = progress.complete
                    ? "Complete"
                    : progress.answered
                      ? `${progress.answered} of ${progress.total}`
                      : `${progress.total} questions`;
                  return (
                    <li key={space.id}>
                      <button className="family-v2__room-main" type="button" onClick={() => openRoom(index)}>
                        <span className={`family-v2__room-status${progress.complete ? " is-complete" : ""}`} aria-hidden="true">
                          {progress.complete ? <Icon name="check" /> : index + 1}
                        </span>
                        <span>
                          <strong>{space.label}</strong>
                          <small>{stateLabel}</small>
                        </span>
                        <Icon name="arrow-right" />
                      </button>
                      {(state.homeProfile?.levels??1)>1 && <label className="room-level">Level for {space.label}<select value={space.level??""} onChange={e=>api.setRoomLevel(space.id,Number(e.target.value))}><option value="">Not assigned</option>{Array.from({length:state.homeProfile!.levels},(_,n)=><option key={n} value={n+1}>Level {n+1}</option>)}</select></label>}
                      <button
                        className="family-v2__remove"
                        type="button"
                        aria-label={`Remove ${space.label}`}
                        title={`Remove ${space.label}`}
                        onClick={() => {
                          if(progress.answered && !window.confirm(`Remove ${space.label} and its answers from this check?`))return;
                          api.removeSpace(space.id);
                          api.setFamilyPosition({ phase: "rooms", roomIndex: Math.max(0, roomIndex >= index ? roomIndex - 1 : roomIndex), questionIndex: 0 });
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => {
                const next = state.spaces.findIndex((space) => !roomProgress(space.id, familyTemplateFor(space), state.familyAnswers).complete);
                openRoom(next < 0 ? 0 : next);
              }}>
                {overall.answered ? "Continue home check" : "Start with the first room"} <Icon name="arrow-right" />
              </button>
              <p className="family-v2__time">{overall.total-overall.answered} unanswered questions · Take one room at a time.</p><button className="family-v2__back" onClick={()=>setPhase("report")}>See results so far</button>
            </section>
          ) : (
            <p className="family-v2__empty">Add at least one room to begin.</p>
          )}
        </section>
      </main>
    );
  }

  if (phase === "room") {
    const space = state.spaces[roomIndex];
    if (!space) {
      return (
        <main className="family-v2 family-v2--centered">
          <section className="family-v2__card">
            <h1 ref={headingRef} tabIndex={-1}>That room is no longer in the check.</h1>
            <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => setPosition({ phase: "rooms", roomIndex: 0, questionIndex: 0 })}>Back to rooms</button>
          </section>
        </main>
      );
    }
    return (
      <QuestionScreen
        api={api}
        space={space}
        roomIndex={roomIndex}
        totalRooms={state.spaces.length}
        savedQuestionIndex={questionIndex}
        headingRef={headingRef}
        onPosition={setPosition}
      />
    );
  }

  if (phase === "milestone") {
    const space = state.spaces[roomIndex];
    const isLast = roomIndex >= state.spaces.length - 1;
    const room = report.rooms.find((item) => item.spaceId === space?.id);
    const noted = room?.entries.length ?? 0;
    const unanswered = room?.unansweredCount ?? 0;
    return (
      <main className="family-v2 family-v2--centered">
        <FlowHeader percent={overall.percent} label={`${overall.answered} of ${overall.total} answered`} onBack={() => setPhase("rooms")} />
        <section className="family-v2__card family-v2__milestone">
          <div className="family-v2__success" aria-hidden="true"><Icon name="check" /></div>
          <p className="family-v2__eyebrow">Room saved</p>
          <h1 ref={headingRef} tabIndex={-1}>{space?.label ?? "Room"} checked</h1>
          <p className="family-v2__lead">
            {noted > 0
              ? `Your answers noted ${noted} item${noted === 1 ? "" : "s"} to look at more closely.`
              : "No concerns were reported in the answers you gave. This does not confirm the room is safe."}
          </p>
          {unanswered > 0 && <p className="family-v2__notice">{unanswered} question{unanswered === 1 ? " is" : "s are"} unanswered. Your results will show this.</p>}
          <div className="family-v2__actions">
            {isLast ? (
              <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => setPhase("report")}>See my results <Icon name="arrow-right" /></button>
            ) : (
              <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => openRoom(roomIndex + 1)}>Next room: {state.spaces[roomIndex + 1]?.label} <Icon name="arrow-right" /></button>
            )}
            <button className="family-v2__button family-v2__button--secondary" type="button" onClick={() => setPhase("rooms")}>See all rooms</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <ReportScreen
      report={report}
      api={api}
      shareTo={shareTo}
      setShareTo={setShareTo}
      copied={copied}
      setCopied={setCopied}
      headingRef={headingRef}
      onRequestHelp={onRequestHelp}
      onRooms={() => setPhase("rooms")}
    />
  );
}

function FlowHeader({ percent, label, onBack }: { percent: number; label: string; onBack?: () => void }) {
  return (
    <header className="family-v2__flow-header">
      <div className="family-v2__flow-row">
        {onBack ? (
          <button className="family-v2__back" type="button" onClick={onBack}><Icon name="arrow-left" /> Back</button>
        ) : <span />}
        <span className="family-v2__progress-label">{label}</span>
      </div>
      <div className="family-v2__progress" role="progressbar" aria-label="Home check progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </header>
  );
}

function QuestionScreen({
  api,
  space,
  roomIndex,
  totalRooms,
  savedQuestionIndex,
  headingRef,
  onPosition,
}: {
  api: CaseApi;
  space: Space;
  roomIndex: number;
  totalRooms: number;
  savedQuestionIndex: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onPosition: (position: FlowPosition) => void;
}) {
  const groups = useMemo(() => groupItemsForFamily(familyTemplateFor(space)), [space.type,space.familyKind]);
  const questions = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const questionIndex = Math.min(savedQuestionIndex, Math.max(0, questions.length - 1));
  const question = questions[questionIndex];
  const progress = roomProgress(space.id, familyTemplateFor(space), api.state.familyAnswers);
  const answer = question ? api.state.familyAnswers[familyKey(space.id, question.code)] : undefined;

  if (!question) {
    return (
      <main className="family-v2 family-v2--centered">
        <section className="family-v2__card">
          <h1 ref={headingRef} tabIndex={-1}>There are no questions for this room.</h1>
          <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => onPosition({ phase: "rooms", roomIndex, questionIndex: 0 })}>Back to rooms</button>
        </section>
      </main>
    );
  }

  const moveForward = () => {
    if (questionIndex < questions.length - 1) {
      onPosition({ phase: "room", roomIndex, questionIndex: questionIndex + 1 });
    } else {
      onPosition({ phase: "milestone", roomIndex, questionIndex });
    }
  };

  const moveBack = () => {
    if (questionIndex > 0) onPosition({ phase: "room", roomIndex, questionIndex: questionIndex - 1 });
    else onPosition({ phase: "rooms", roomIndex, questionIndex: 0 });
  };

  return (
    <main className="family-v2 family-v2--question">
      <FlowHeader
        percent={progress.percent}
        label={`${space.label} · ${progress.answered} of ${progress.total}`}
        onBack={moveBack}
      />
      <section className="family-v2__card family-v2__question-card">
        <div className="family-v2__question-meta">
          <span>Room {roomIndex + 1} of {totalRooms}</span>
          <span>Question {questionIndex + 1} of {questions.length}</span>
        </div>
        <p className="family-v2__topic">{groups.find((group) => group.category === question.category)?.label}</p>
        <h1 ref={headingRef} tabIndex={-1}>{homeQuestionText(question.promptPlain,api.state.homeProfile?.forWhom)}</h1>

        <details className="family-v2__hint">
          <summary>What should I look for?</summary>
          <p>{LOOK_HINT[question.category]}</p>
        </details>

        <div className="family-v2__answers" role="group" aria-label={homeQuestionText(question.promptPlain,api.state.homeProfile?.forWhom)}>
          {FAMILY_ANSWERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={answer === option}
              className={`family-v2__answer${answer === option ? " is-selected" : ""}`}
              onClick={() => api.setFamilyAnswer(familyKey(space.id, question.code), option as FamilyAnswer)}
            >
              <span className="family-v2__radio" aria-hidden="true">{answer === option && <Icon name="check" />}</span>
              {FAMILY_ANSWER_LABEL[option]}
            </button>
          ))}
        </div>

        <div className="family-v2__question-actions">
          <button className="family-v2__skip" type="button" onClick={moveForward}>Skip for now</button>
          <button className="family-v2__button family-v2__button--primary" type="button" disabled={!answer} onClick={moveForward}>
            {questionIndex === questions.length - 1 ? "Finish room" : "Next question"} <Icon name="arrow-right" />
          </button>
        </div>
        <p className="family-v2__answer-note">Skipped questions stay unanswered. &ldquo;Not sure&rdquo; is saved as your answer.</p>
      </section>
    </main>
  );
}

function ReportScreen({
  api,
  report,
  shareTo,
  setShareTo,
  copied,
  setCopied,
  headingRef,
  onRequestHelp,
  onRooms,
}: {
  api:CaseApi;
  report: FamilyReport;
  shareTo: string;
  setShareTo: (value: string) => void;
  copied: boolean;
  setCopied: (value: boolean) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRequestHelp?: (service?: string) => void;
  onRooms: () => void;
}) {
  const priorities = topPriorities(report);
  const fullText=[...profileLines(api.state.homeProfile),"",reportToPlainText(report)].join("\n");
  const [copyError, setCopyError] = useState(false);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([fullText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "home-check-full-findings.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="family-v2 family-v2--report">
      <section className="family-v2__card family-v2__report-card">
        <p className="family-v2__eyebrow">Your results</p>
        <h1 ref={headingRef} tabIndex={-1}>Your home check</h1>
        <p className="family-v2__report-headline">{report.headline}</p>
        <p className="family-v2__notice">This home check is not a professional assessment and cannot confirm that a home is safe.</p>

        <dl className="family-v2__tally">
          <div><dt>Worth a closer look</dt><dd>{report.flaggedCount}</dd></div>
          <div><dt>Not sure</dt><dd>{report.unsureCount}</dd></div>
          <div><dt>Answered</dt><dd>{report.answeredCount}/{report.totalCount}</dd></div>
        </dl>

        <HomeInsights api={api} report={report} onRooms={onRooms}/>
        {priorities.length > 0 && (
          <section className="family-v2__report-section" aria-labelledby="start-heading">
            <h2 id="start-heading">Start here</h2>
            <p>These reported concerns are listed first because they often have a bigger effect on everyday safety.</p>
            <ol className="family-v2__priorities">
              {priorities.map((entry) => (
                <li key={`${entry.spaceId}-${entry.code}`}>
                  <span>{entry.spaceLabel}</span>
                  <h3>{entry.question}</h3>
                  {entry.guidance && <p>{entry.guidance.helps}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {report.rooms.length > 0 && (
          <section className="family-v2__report-section" aria-labelledby="room-detail-heading">
            <h2 id="room-detail-heading">Room details</h2>
            <div className="family-v2__report-rooms">
              {report.rooms.map((room) => (
                <details key={room.spaceId}>
                  <summary>
                    <span><strong>{room.spaceLabel}</strong><small>{room.entries.length} noted · {room.unansweredCount} unanswered</small></span>
                    <span className="family-v2__disclosure" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="family-v2__room-detail">
                    {room.entries.length === 0 ? (
                      <p>{room.unansweredCount ? "No concerns were reported in the answers provided. This room still has unanswered questions." : "No concerns were reported in these answers. This is not a professional assessment."}</p>
                    ) : (
                      <ul>
                        {room.entries.map((entry) => (
                          <li key={entry.code}>
                            <span className={`family-v2__tag${entry.uncertain ? " family-v2__tag--unsure" : ""}`}>{entry.uncertain ? "Not sure" : "Worth a look"}</span>
                            <h3>{entry.question}</h3>
                            {entry.guidance ? <><p><strong>Why it matters:</strong> {entry.guidance.why}</p><p><strong>What may help:</strong> {entry.guidance.helps}</p></> : <p>Consider mentioning this to a professional.</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {onRequestHelp && (
          <section className="family-v2__help">
            <div>
              <h2>Would you like help with next steps?</h2>
              <p>Request a professional review through MyIntel. You can choose to share this home check and add guided photos after your request is saved. Nothing is sent to a professional automatically.</p>
            </div>
            <button className="family-v2__button family-v2__button--primary" type="button" onClick={() => onRequestHelp("professional_assessment")}>Request help <Icon name="arrow-right" /></button>
          </section>
        )}

        <section className="family-v2__report-section family-v2__share" aria-labelledby="share-heading">
          <h2 id="share-heading">Keep or share the full findings</h2>
          <div className="family-v2__share-controls">
            <label>
              <span>Email address</span>
              <input type="email" inputMode="email" value={shareTo} placeholder="name@example.com" onChange={(event) => setShareTo(event.target.value)} />
            </label>
            <button className="family-v2__button family-v2__button--secondary" type="button" disabled={!looksLikeEmail(shareTo)} onClick={() => { window.location.href = buildShareMailto(shareTo, report); }}><Icon name="mail" /> Draft email</button>
          </div>
          <p className="family-v2__fine-print">This opens your email app with a short summary for you to review and send.</p>
          <div className="family-v2__utility-actions">
            <button type="button" onClick={copyReport}><Icon name="copy" /> {copied ? "Copied" : "Copy full text"}</button>
            <button type="button" onClick={downloadReport}><Icon name="download" /> Download full text</button>
            <button type="button" onClick={() => window.print()}>Save or print</button>
          </div>
          {copyError && <p className="family-v2__error" role="alert">Copy was unavailable. Download the full text instead.</p>}
        </section>

        <button className="family-v2__button family-v2__button--secondary family-v2__review" type="button" onClick={onRooms}><Icon name="arrow-left" /> Review rooms and answers</button>
      </section>
    </main>
  );
}
