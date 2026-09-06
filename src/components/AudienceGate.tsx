"use client";

import type { AssessmentMode } from "@/domain/types";
import type { CaseApi } from "@/lib/case-store";

export function AudienceGate({ api }: { api: CaseApi }) {
  const start = (mode: AssessmentMode) => {
    api.setMode(mode);
    api.setAudience("clinician");
  };

  return (
    <div className="gate">
      <div className="gate-inner">
        <div className="brand gate-brand">
          <span className="mark">MI</span>
          <span>
            <strong>MyIntel</strong>
            <em>Home Safety Assessment</em>
          </span>
        </div>

        <h1>Who&rsquo;s using this?</h1>

        <div className="gate-grid">
          <section className="gate-card">
            <p className="gate-eyebrow">For a resident or family member</p>
            <h2>Home safety check</h2>
            <p>
              A simple walk-through of the home in plain language, one room at a time. About ten
              minutes. No clinical training needed.
            </p>
            <ul>
              <li>A handful of questions per room</li>
              <li>Yes, no, or not sure</li>
              <li>Ends with a report explaining what each answer means</li>
            </ul>
            <button type="button" className="fam-primary" onClick={() => api.setAudience("family")}>
              Start the home check
            </button>
          </section>

          <section className="gate-card clinician">
            <p className="gate-eyebrow">For an occupational therapist</p>
            <h2>Clinical assessment</h2>
            <p>
              The full workspace: room-by-room assessment, findings with severity and confidence, a
              prioritised action plan, and a signed report.
            </p>
            <ul>
              <li>Six-state assessment with limitations tracking</li>
              <li>Findings, action plan, attestation and sign-off</li>
            </ul>
            <div className="gate-actions">
              <button type="button" className="btn" onClick={() => start("standard_ot")}>
                Standard OT assessment
              </button>
              <button type="button" className="btn-sm" onClick={() => start("myintel")}>
                MyIntel assessment
              </button>
            </div>
            <p className="gate-note">
              Both are clinically identical. MyIntel mode additionally surfaces MyIntel and Talius
              product options; Standard stays vendor-neutral throughout.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
