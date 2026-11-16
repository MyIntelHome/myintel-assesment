import type { CaseState } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";
import type { ReportVersion } from "@/domain/report-version";
import { professionalReportMetrics } from "@/domain/professional-report";
import {
  ATTESTATION_TEXT,
  AGE_BAND_LABEL,
  HOUSING_LABEL,
  CONCERN_LABEL,
  prioritisePlan,
} from "@/domain/case";
import { profileLines } from "@/domain/home-profile";
import { FindingsDashboard, FindingScoreCard, FindingCategoryScores } from "./FindingsDashboard";
import { professionalFindingScores } from "@/domain/professional-finding-scores";

const words = (v: string) =>
  v.replace(/_/g, " ").replace(/^\w/, (s) => s.toUpperCase());
const pct = (n: number | null) => (n === null ? "Not established" : `${n}%`);
const date = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(v + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : v;
function Narrative({ title, text }: { title: string; text?: string }) {
  return text?.trim() ? (
    <div className="pr-narrative">
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  ) : null;
}
function RoomIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 10 12 3l9 7v11H3Z M9 21v-8h6v8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function ProfessionalReport({
  state,
  view,
  clientName,
  version,
}: {
  state: CaseState;
  view: CaseView;
  clientName: string;
  version?: ReportVersion;
}) {
  const m = professionalReportMetrics(state, view),
    doc = state.documentation ?? {},
    plan = prioritisePlan(state.plan),
    signed = !!state.signoff.signedAt,
    originalDashboard = version?.reportLayoutVersion === 2;
  const segments = [
    ["No concern recorded", m.noConcern, "clear"],
    ["Concern", m.concern, "concern"],
    ["Critical", m.critical, "critical"],
    ["Unable to assess", m.unable, "unable"],
    ["Not assessed", m.unknown, "unknown"],
    ["Not applicable", m.notApplicable, "na"],
  ] as const;
  return (
    <article className="report professional-report-v2">
      <header className="pr-hero">
        <div className="pr-brand">
          <span className="pr-mark">MI</span>
          <span>
            HomeCheck <small>Professional home assessment</small>
          </span>
        </div>
        <p className="pr-kicker">
          Your home. Your priorities. A clear next step.
        </p>
        <h2>{clientName.trim() || "Client name added at export"}</h2>
        <p className="pr-profile">
          Case {state.reference || "Not recorded"}
          {state.intake.ageBand
            ? ` · Age ${AGE_BAND_LABEL[state.intake.ageBand]}`
            : ""}
          {state.intake.housingType
            ? ` · ${HOUSING_LABEL[state.intake.housingType]}`
            : ""}
          {state.intake.livesAlone
            ? ` · ${state.intake.livesAlone === "alone" ? "Lives alone" : "Lives with others"}`
            : ""}
        </p>
        <div className="pr-meta">
          <span>
            Visit: {doc.visitDate ? date(doc.visitDate) : "Not recorded"}
          </span>
          <span>{state.spaces.length} areas in scope</span>
          <span>
            {version
              ? `Report ${version.id} · Version ${version.revision}`
              : "Unsigned working draft"}
          </span>
        </div>
        <p className="pr-assessor">
          {state.signoff.assessorName || "Assessor not named"}
          {state.signoff.credentials ? `, ${state.signoff.credentials}` : ""}
          {state.signoff.organisation ? ` · ${state.signoff.organisation}` : ""}
        </p>
      </header>
      {originalDashboard ? <section className="pr-dashboard" aria-label="Assessment dashboard">
        <div className="pr-metrics">
          <div>
            <span>Observation coverage</span>
            <strong>{pct(m.coverage)}</strong>
            <small>
              {m.observed} of {m.applicable} applicable required checks examined
            </small>
          </div>
          <div>
            <span>Checklist decisions</span>
            <strong>{pct(m.decisions)}</strong>
            <small>
              {m.total - m.unknown} of {m.total} required checks decided,
              including exclusions
            </small>
          </div>
          <div>
            <span>Recorded findings</span>
            <strong>{m.findings}</strong>
            <small>
              {view.findings.filter((f) => f.status === "critical").length}{" "}
              critical,{" "}
              {view.findings.filter((f) => f.status === "concern").length}{" "}
              concerns, including optional checks
            </small>
          </div>
          <div>
            <span>Actions in the plan</span>
            <strong>{plan.length}</strong>
            <small>
              {m.documented} of {m.findings} findings have an action or
              professional disposition
            </small>
          </div>
        </div>
        <div className="pr-overview">
          <div>
            <h3>What the checks show</h3>
            <p>{view.risk.statement}</p>
            <p>
              <strong>{pct(m.concernShare)}</strong>
              {m.concernShare === null
                ? " of examined checks with a concern cannot be calculated yet."
                : " of examined required checks have a concern or critical finding."}
            </p>
          </div>
          <div className="pr-distribution">
            <div
              className="pr-stack"
              role="img"
              aria-label={segments
                .map(([label, n]) => `${label}: ${n}`)
                .join(", ")}
            >
              {segments
                .filter(([, n]) => n > 0)
                .map(([label, n, color]) => (
                  <span
                    key={label}
                    className={`pr-segment pr-${color}`}
                    style={{ width: `${m.total ? (n / m.total) * 100 : 0}%` }}
                  />
                ))}
            </div>
            <ul className="pr-legend">
              {segments.map(([label, n, color]) => (
                <li key={label}>
                  <span className={`pr-dot pr-${color}`} />
                  {label}
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="pr-method">
          Percentages describe this recorded assessment, not how safe a person
          is or their chance of falling. Observation coverage excludes N/A
          items; unable-to-assess and unanswered checks stay in its denominator.
          No recorded concerns does not establish safety.
        </p>
      </section> : <FindingsDashboard state={state} />}
      <section className="pr-section">
        <h3>About the client and this visit</h3>
        {!doc.clientSummary?.trim() && (
          <p className="report-meta">Client summary not recorded.</p>
        )}
        <Narrative title="Client summary" text={doc.clientSummary} />
        <Narrative title="What matters to the client" text={doc.goals} />
        <Narrative
          title="Daily activities and participation"
          text={doc.dailyActivities}
        />
      </section>
      <section className="pr-section">
        <div className="pr-section-heading">
          <h3>Your action plan</h3>
          <span>{plan.length} actions</span>
        </div>
        <p>
          Discuss priorities, fit and responsibilities with the assessor. A
          recommendation is not a booking, purchase or confirmation that work
          has been completed.
        </p>
        {!plan.length && <p>No actions recorded.</p>}
        <ol className="pr-actions">
          {plan.map((item, index) => (
            <li key={item.id}>
              <span className="pr-action-number">{index + 1}</span>
              <div>
                <div className="rp-head">
                  <strong>{item.title || "Untitled action"}</strong>
                  {item.urgency && (
                    <span className={`tag urgency-${item.urgency}`}>
                      {words(item.urgency)}
                    </span>
                  )}
                </div>
                <p>{item.rationale || "Rationale not recorded."}</p>
                <dl className="pr-action-meta">
                  <div>
                    <dt>Category</dt>
                    <dd>{words(item.category)}</dd>
                  </div>
                  <div>
                    <dt>Responsible</dt>
                    <dd>
                      {item.responsibleParty
                        ? words(item.responsibleParty)
                        : "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{words(item.status)}</dd>
                  </div>
                  <div>
                    <dt>Cost estimate</dt>
                    <dd>
                      {item.costNotEstimated || (!item.costMin && !item.costMax)
                        ? "Not estimated"
                        : item.costMin && item.costMax
                          ? `$${item.costMin} - $${item.costMax}`
                          : `$${item.costMin || item.costMax}`}
                    </dd>
                  </div>
                  {item.targetDate && (
                    <div>
                      <dt>Target date</dt>
                      <dd>{date(item.targetDate)}</dd>
                    </div>
                  )}
                  {item.followUpDate && (
                    <div>
                      <dt>Follow-up</dt>
                      <dd>{date(item.followUpDate)}</dd>
                    </div>
                  )}
                </dl>
                {item.linkedFindings.length > 0 && (
                  <p className="report-meta">
                    Linked findings:{" "}
                    {item.linkedFindings
                      .map((key) => view.findings.find((f) => f.key === key))
                      .filter((f) => !!f)
                      .map((f) => `${f.space.label}: ${f.prompt}`)
                      .join("; ") || "Review links"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <Narrative title="Follow-up and review plan" text={doc.followUpPlan} />
      </section>
      {!originalDashboard && <FindingCategoryScores state={state} />}
      <section className="pr-section">
        <h3>Area overview</h3>
        {originalDashboard ? <p>
          Coverage reflects required observations. Findings can also include
          optional checks. Room notes and the client’s perspective do not
          automatically change ratings.
        </p> : <p>Each area has a concern score based on its assessed checks. Higher means more concerns recorded. Notes and reported perspectives do not automatically change ratings.</p>}
        <div className="pr-room-grid">
          {originalDashboard ? m.rooms.map((r) => (
            <div className="pr-room-overview" key={r.space.id}>
              <div className="pr-room-title">
                <RoomIcon />
                <strong>{r.space.label}</strong>
              </div>
              <div className="pr-room-percent">
                {pct(r.coverage)} <small>observed</small>
              </div>
              <div
                className="pr-progress"
                role="img"
                aria-label={`${r.space.label} observation coverage ${pct(r.coverage)}`}
              >
                <span style={{ width: `${r.coverage ?? 0}%` }} />
              </div>
              <p>
                {r.observed}/{r.applicable} applicable checks ·{" "}
                {view.findings.filter((f) => f.space.id === r.space.id).length}{" "}
                {view.findings.filter((f) => f.space.id === r.space.id).length === 1
                  ? "finding"
                  : "findings"}
              </p>
              <p className="report-meta">
                {r.unknown} not assessed · {r.unable} unable · {r.notApplicable}{" "}
                N/A
              </p>
            </div>
          )) : professionalFindingScores(state).rooms.map(score => <FindingScoreCard key={score.space.id} title={score.space.label} score={score} />)}
        </div>
      </section>
      <section className="pr-section">
        <h3>Professional observations by area</h3>
        {state.spaces.map((space) => {
          const notes = doc.rooms?.[space.id],
            findings = view.findings.filter((f) => f.space.id === space.id);
          return (
            <section className="pr-room-detail" key={space.id}>
              <h4>
                <RoomIcon />
                {space.label}
                {space.level ? ` · Level ${space.level}` : ""}
              </h4>
              <Narrative
                title="Area observations and task performance"
                text={notes?.observation}
              />
              <Narrative
                title="Client or supporter perspective (reported)"
                text={notes?.residentPerspective}
              />
              {!notes?.observation?.trim() &&
                !notes?.residentPerspective?.trim() && (
                  <p className="report-meta">
                    No area narrative recorded. See the item observations below.
                  </p>
                )}
              {findings.length === 0 ? (
                <p>
                  No concern or critical finding recorded in this area. This
                  does not establish safety.
                </p>
              ) : (
                <ul className="report-findings">
                  {findings.map((f) => (
                    <li key={f.key}>
                      <span className={`tag tag-${f.status}`}>
                        {words(f.status)}
                      </span>{" "}
                      <strong>{f.prompt}</strong>
                      {f.detail.notes && <p>{f.detail.notes}</p>}
                      <p className="report-meta">
                        Severity:{" "}
                        {f.detail.severity
                          ? words(f.detail.severity)
                          : "not recorded"}{" "}
                        · Likelihood:{" "}
                        {f.detail.likelihood
                          ? words(f.detail.likelihood)
                          : "not recorded"}{" "}
                        · Confidence:{" "}
                        {f.detail.confidence
                          ? words(f.detail.confidence)
                          : "not recorded"}
                      </p>
                      <p className="report-meta">
                        Evidence:{" "}
                        {f.detail.evidenceSource
                          ? words(f.detail.evidenceSource)
                          : "not recorded"}{" "}
                        · Client priority:{" "}
                        {f.detail.residentPriority
                          ? words(f.detail.residentPriority)
                          : "not recorded"}
                      </p>
                      {f.detail.consequence && (
                        <p>
                          Potential consequence: {words(f.detail.consequence)}
                        </p>
                      )}
                      {f.detail.timeframe && (
                        <p>Timeframe: {words(f.detail.timeframe)}</p>
                      )}
                      {f.detail.disposition && (
                        <p>Professional disposition: {f.detail.disposition}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Narrative title="Area follow-up notes" text={notes?.followUp} />
            </section>
          );
        })}
      </section>
      <section className="pr-section">
        <h3>Clinical context and assessment results</h3>
        <Narrative
          title="Relevant history and reported medication issues"
          text={doc.medicalContext}
        />
        <Narrative title="Current equipment and use" text={doc.equipment} />
        <Narrative title="Support and routines" text={doc.support} />
        <Narrative title="Mobility aids" text={state.intake.mobilityAids} />
        <Narrative
          title="Falls in the last 12 months"
          text={state.intake.fallsLast12Months}
        />
        {state.intake.concerns.length > 0 && (
          <p>
            Recorded concerns:{" "}
            {state.intake.concerns.map((c) => CONCERN_LABEL[c]).join(", ")}
          </p>
        )}
        <Narrative
          title="Clinical concern notes"
          text={state.intake.concernNotes}
        />
        {(doc.tests ?? []).map((test) => (
          <div className="pr-test" key={test.id}>
            <h4>{test.name || "Assessment name not recorded"}</h4>
            <p className="report-meta">
              Clinician-entered external assessment
              {test.date ? ` · ${date(test.date)}` : ""}
            </p>
            <Narrative title="Result and units" text={test.result} />
            <Narrative
              title="Professional interpretation"
              text={test.interpretation}
            />
            <Narrative
              title="Conditions and limitations"
              text={test.limitations}
            />
            {!!test.linkedFindings?.length && (
              <p className="report-meta">
                Related home findings:{" "}
                {test.linkedFindings
                  .map((key) => view.findings.find((f) => f.key === key))
                  .filter((f) => !!f)
                  .map((f) => `${f.space.label}: ${f.prompt}`)
                  .join("; ") || "Links need review"}
              </p>
            )}
          </div>
        ))}
        {(doc.tests ?? []).length > 0 && (
          <p className="pr-method">
            External test results retain their own units and interpretation.
            They are not administered, scored or validated by HomeCheck and are
            not combined into a HomeCheck safety score.
          </p>
        )}
        {state.homeProfile && (
          <section className="pr-context">
            <h4>Reported home and daily-life context</h4>
            <ul>
              {profileLines(state.homeProfile).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p>
              Reported information is separate from professional observations.
            </p>
          </section>
        )}
      </section>
      <section className="pr-section pr-limitations">
        <h3>Scope, gaps and exclusions</h3>
        <p>
          Conclusions apply to the areas and activities assessed at this visit.
          Other areas, changing ability and circumstances may require further
          review.
        </p>
        {state.signoff.partialAssessmentReason && (
          <p className="pr-preline">{state.signoff.partialAssessmentReason}</p>
        )}
        {m.unknown > 0 && <p>{m.unknown} required checks are not assessed.</p>}
        {view.limitations.length > 0 && (
          <>
            <h4>Unable to assess</h4>
            <ul>
              {view.limitations.map((l) => (
                <li key={`${l.space.id}-${l.code}`}>
                  {l.space.label}: {l.prompt}. {l.reason}
                </li>
              ))}
            </ul>
          </>
        )}
        {view.notApplicable.length > 0 && (
          <>
            <h4>Not applicable</h4>
            <ul>
              {view.notApplicable.map((l) => (
                <li key={`${l.space.id}-${l.code}`}>
                  {l.space.label}: {l.prompt}.{" "}
                  {l.reason || "Reason not recorded."}
                </li>
              ))}
            </ul>
          </>
        )}
        {m.total === 0 && (
          <p>
            No required checks are recorded; percentages cannot be established.
          </p>
        )}
      </section>
      <footer className="report-foot">
        <h3>Professional attestation and report history</h3>
        <p>{version?.attestationText ?? ATTESTATION_TEXT}</p>
        <p className="report-meta">
          Assessor credentials are self-entered and have not been independently
          verified by MyIntel.
        </p>
        {signed ? (
          <p className="signed">
            Signed by <strong>{state.signoff.assessorName}</strong>
            {state.signoff.credentials ? `, ${state.signoff.credentials}` : ""}
            {state.signoff.licenseNumber
              ? ` · Licence ${state.signoff.licenseNumber}`
              : ""}
            <br />
            {new Date(state.signoff.signedAt!).toLocaleString()}
          </p>
        ) : (
          <p className="unsigned">
            Draft, not signed. Not valid for clinical use.
          </p>
        )}
        {version?.supersedesId && (
          <p>
            Amends report {version.supersedesId}. Previous signed versions
            remain in history.
          </p>
        )}
      </footer>
    </article>
  );
}
