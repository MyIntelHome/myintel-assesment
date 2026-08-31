"use client";

import { useState } from "react";
import {
  ATTESTATION_TEXT,
  AGE_BAND_LABEL,
  CONCERN_LABEL,
  HOUSING_LABEL,
  assessSignoffReadiness,
  prioritisePlan,
  type AgeBand,
  type HousingType,
} from "@/domain/case";
import type { CaseApi } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";

const label = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

const money = (min: string, max: string, notEstimated: boolean) => {
  if (notEstimated) return "Not estimated";
  const a = min.trim();
  const b = max.trim();
  if (!a && !b) return "Not estimated";
  if (a && b) return `$${a} – $${b}`;
  return `$${a || b}`;
};

export function ReportStep({ api, view }: { api: CaseApi; view: CaseView }) {
  const { state } = api;
  const { signoff, intake } = state;
  const [clientName, setClientName] = useState("");

  const readiness = assessSignoffReadiness({
    signoff,
    plan: state.plan,
    requiredAssessed: view.completeness.requiredAssessed,
    requiredTotal: view.completeness.requiredTotal,
    unableToAssessCount: view.completeness.unableToAssessCount,
  });

  const ordered = prioritisePlan(state.plan);
  const signed = Boolean(signoff.signedAt);

  return (
    <>
      <div className="no-print">
        <h1 className="step-title">Report</h1>
        <p className="step-sub">
          Preview below. The client&rsquo;s name is added at export and is never stored or transmitted.
        </p>

        <section className="panel">
          <h2>Assessor</h2>
          <div className="fieldgrid">
            <label>
              <span>Name</span>
              <input
                value={signoff.assessorName}
                placeholder="Jane Smith"
                onChange={(e) => api.patchSignoff({ assessorName: e.target.value })}
              />
            </label>
            <label>
              <span>Credentials</span>
              <input
                value={signoff.credentials}
                placeholder="OTR/L, CAPS"
                onChange={(e) => api.patchSignoff({ credentials: e.target.value })}
              />
            </label>
            <label>
              <span>Licence number</span>
              <input
                value={signoff.licenseNumber}
                onChange={(e) => api.patchSignoff({ licenseNumber: e.target.value })}
              />
            </label>
            <label>
              <span>Licence expiry</span>
              <input
                type="date"
                value={signoff.licenseExpiry}
                onChange={(e) => api.patchSignoff({ licenseExpiry: e.target.value })}
              />
            </label>
            <label>
              <span>Organisation</span>
              <input
                value={signoff.organisation}
                placeholder="Practice name"
                onChange={(e) => api.patchSignoff({ organisation: e.target.value })}
              />
            </label>
            <label>
              <span>Client name (export only)</span>
              <input
                value={clientName}
                placeholder="Added to the PDF, never saved"
                onChange={(e) => setClientName(e.target.value)}
              />
            </label>
          </div>
        </section>

        {readiness.blockers.length > 0 && (
          <section className="panel blockers">
            <h2>Cannot sign yet</h2>
            <ul>
              {readiness.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {readiness.incompletePlanItems.length > 0 && (
              <ul className="sub">
                {readiness.incompletePlanItems.map((p) => (
                  <li key={p.id}>
                    <strong>{p.title}</strong> — missing {p.missing.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {readiness.warnings.length > 0 && (
          <section className="panel warnings">
            <h2>Will be disclosed in the report</h2>
            <ul>
              {readiness.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="plan-actions">
          {signed ? (
            <>
              <button type="button" className="btn" onClick={() => window.print()}>
                Export PDF
              </button>
              <button type="button" className="btn-sm danger" onClick={api.unsign}>
                Withdraw signature
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={!readiness.canSign}
              onClick={api.sign}
              title={readiness.canSign ? "" : "Resolve the blockers above first"}
            >
              Sign and finalise
            </button>
          )}
        </div>
      </div>

      {/* ── the document ─────────────────────────────────────── */}
      <article className="report">
        <header className="report-head">
          <p className="eyebrow">Home Safety Assessment</p>
          <h2>{clientName.trim() || "—"}</h2>
          <p className="report-meta">
            Case {state.reference || "—"}
            {intake.housingType ? ` · ${HOUSING_LABEL[intake.housingType as HousingType]}` : ""}
            {intake.ageBand ? ` · Age ${AGE_BAND_LABEL[intake.ageBand as AgeBand]}` : ""}
            {intake.livesAlone ? ` · ${intake.livesAlone === "alone" ? "Lives alone" : "Lives with others"}` : ""}
          </p>
          <p className="report-meta">
            {signoff.assessorName || "Assessor not named"}
            {signoff.credentials ? `, ${signoff.credentials}` : ""}
            {signoff.organisation ? ` · ${signoff.organisation}` : ""}
          </p>
        </header>

        <section>
          <h3>Summary</h3>
          <p className={`risk risk-${view.risk.state}`}>{view.risk.statement}</p>
          <p className="report-meta">
            {view.completeness.requiredAssessed} of {view.completeness.requiredTotal} required items
            assessed across {state.spaces.length} space{state.spaces.length === 1 ? "" : "s"}.
          </p>
        </section>

        {intake.concerns.length > 0 && (
          <section>
            <h3>Clinical concerns</h3>
            <p>{intake.concerns.map((c) => CONCERN_LABEL[c]).join(" · ")}</p>
            {intake.concernNotes && <p className="report-meta">{intake.concernNotes}</p>}
          </section>
        )}

        <section>
          <h3>Action plan</h3>
          {ordered.length === 0 ? (
            <p className="report-meta">No recommendations recorded.</p>
          ) : (
            <ol className="report-plan">
              {ordered.map((item) => (
                <li key={item.id}>
                  <div className="rp-head">
                    <strong>{item.title || "Untitled"}</strong>
                    {item.urgency && <span className={`tag urgency-${item.urgency}`}>{label(item.urgency)}</span>}
                  </div>
                  {item.rationale && <p>{item.rationale}</p>}
                  <p className="report-meta">
                    {money(item.costMin, item.costMax, item.costNotEstimated)}
                    {item.responsibleParty ? ` · ${label(item.responsibleParty)}` : ""}
                    {` · ${label(item.status)}`}
                    {item.followUpDate ? ` · follow up ${item.followUpDate}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {view.findings.length > 0 && (
          <section>
            <h3>Findings</h3>
            <ul className="report-findings">
              {view.findings.map((f) => (
                <li key={f.key}>
                  <span className={`tag tag-${f.status}`}>
                    {f.status === "critical" ? "✕ Critical" : "! Concern"}
                  </span>{" "}
                  <strong>{f.space.label}</strong> — {f.prompt}
                  {f.detail.notes && <p>{f.detail.notes}</p>}
                  {(f.detail.severity || f.detail.likelihood || f.detail.confidence) && (
                    <p className="report-meta">
                      {f.detail.severity ? `Severity ${label(f.detail.severity)}` : ""}
                      {f.detail.likelihood ? ` · Likelihood ${label(f.detail.likelihood)}` : ""}
                      {f.detail.confidence ? ` · Confidence ${label(f.detail.confidence)}` : ""}
                      {f.detail.residentPriority ? ` · Resident: ${label(f.detail.residentPriority)}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Limitations are generated, never hand-written, so they cannot be omitted. */}
        {(view.limitations.length > 0 || view.completeness.requiredAssessed < view.completeness.requiredTotal) && (
          <section className="limitations">
            <h3>Limitations</h3>
            {view.completeness.requiredAssessed < view.completeness.requiredTotal && (
              <p>
                This assessment is incomplete. {view.completeness.requiredAssessed} of{" "}
                {view.completeness.requiredTotal} required items were assessed. Conclusions apply only
                to the areas assessed.
              </p>
            )}
            {view.limitations.length > 0 && (
              <>
                <p>The following could not be assessed:</p>
                <ul>
                  {view.limitations.map((l) => (
                    <li key={`${l.space.id}-${l.code}`}>
                      <strong>{l.space.label}</strong> — {l.prompt}: {l.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <footer className="report-foot">
          <h3>Attestation</h3>
          <p>{ATTESTATION_TEXT}</p>
          {signed ? (
            <p className="signed">
              Signed by <strong>{signoff.assessorName}</strong>
              {signoff.credentials ? `, ${signoff.credentials}` : ""}
              {signoff.licenseNumber ? ` · Licence ${signoff.licenseNumber}` : ""}
              <br />
              {new Date(signoff.signedAt!).toLocaleString()}
            </p>
          ) : (
            <p className="unsigned">DRAFT — not signed. Not valid for clinical use.</p>
          )}
        </footer>
      </article>
    </>
  );
}
