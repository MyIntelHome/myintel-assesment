"use client";

import { useMemo, useState } from "react";
import { AssessStep } from "@/components/AssessStep";
import { FindingsStep } from "@/components/FindingsStep";
import { IntakeStep } from "@/components/IntakeStep";
import { PlanStep } from "@/components/PlanStep";
import { ReportStep } from "@/components/ReportStep";
import { referenceLooksIdentifying, type CaseApi } from "@/lib/case-store";
import { buildCaseView } from "@/lib/selectors";

const STEPS = [
  { id: "intake", label: "Context" },
  { id: "assess", label: "Assessment" },
  { id: "findings", label: "Findings" },
  { id: "plan", label: "Action plan" },
  { id: "report", label: "Report" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function ClinicalWorkspace({api}:{api:CaseApi}) {
  const [step, setStep] = useState<StepId>(api.state.signoff.signedAt?"report":"intake");
  const view = useMemo(() => buildCaseView(api.state), [api.state]);

  const identifying = referenceLooksIdentifying(api.state.reference);
  const signed = Boolean(api.state.signoff.signedAt);

  const badge = (id: StepId): string | null => {
    if (id === "findings" && view.findings.length > 0) return String(view.findings.length);
    if (id === "plan" && api.state.plan.length > 0) return String(api.state.plan.length);
    if (id === "assess" && view.completeness.requiredTotal > 0) return `${view.completeness.percent}%`;
    return null;
  };

  return (
    <div className="clinical-workspace">
      <header className="topbar no-print">
        <div className="brand">
          <span className="mark">MI</span>
          <span>
            <strong>MyIntel</strong>
            <em>Assessment</em>
          </span>
        </div>
        <label className="ref">
          <span>Case</span>
          <input
            disabled={signed}
            value={api.state.reference}
            onChange={(e) => api.setReference(e.target.value)}
            placeholder="2026-014"
            aria-invalid={identifying}
            aria-describedby={identifying ? "ref-warn" : undefined}
          />
        </label>
        <span className="mode-pill" title="Vendor-neutral clinical workspace">
          {api.state.mode === "myintel" ? "MyIntel" : "Standard OT"}
        </span>
        <span className={`save save-${api.saveState}`} role="status">
          {api.saveState === "saving" ? "Saving…" : api.saveState === "error" ? "Not saved" : `Saved to ${api.storageKind === "account" ? "your account" : "this device"}`}
        </span>
      </header>

      {identifying && (
        <p id="ref-warn" className="warn no-print">
          That reference looks like it contains someone&rsquo;s initials and year of birth. This system
          is intended for non-identifying case references — use a reference that doesn&rsquo;t identify the client,
          such as <code>2026-014</code>.
        </p>
      )}

      {signed && (
        <p className="signed-banner no-print">
          This report is signed and locked. Create an amendment from Report to make changes; the signed version is preserved.
        </p>
      )}

      <nav className="steps no-print" aria-label="Assessment stages">
        {STEPS.map((s) => {
          const b = badge(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-current={step === s.id ? "step" : undefined}
              className={step === s.id ? "stepbtn active" : "stepbtn"}
              onClick={() => setStep(s.id)}
            >
              {s.label}
              {b && <span className="stepbadge">{b}</span>}
            </button>
          );
        })}
      </nav>

      <main className="page">
        {api.storageConflict && <p className="warn" role="alert">Another tab changed the saved cases. Saving is paused to avoid overwriting that work. Copy any unsaved notes, then reload this page.</p>}
        <fieldset disabled={signed && step !== "report"} className="workspace-fields">
        {step === "intake" && <IntakeStep api={api} />}
        {step === "assess" && <AssessStep api={api} view={view} />}
        {step === "findings" && <FindingsStep api={api} view={view} />}
        {step === "plan" && <PlanStep api={api} view={view} />}
        {step === "report" && <ReportStep key={api.state.id} api={api} view={view} />}
        </fieldset>
      </main>

      <div className="footbar no-print">
        <span className="risk-mini">{view.risk.statement}</span>
        <label className="case-picker"><span>Saved assessments</span><select value={api.state.id} disabled={api.saveState !== "saved" || api.storageConflict} onChange={e=>{api.openCase(e.target.value);setStep("intake");}}>
          {api.cases.map(c=><option key={c.id} value={c.id}>{c.reference || (c.audience === "family" ? "Family check" : "Untitled case")} · {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "New"}</option>)}
        </select></label>
        <button
          type="button"
          className="btn-sm"
          disabled={api.saveState !== "saved" || api.storageConflict}
          onClick={() => {api.reset("clinician");setStep("intake");}}
        >
          Start another case
        </button>
      </div>
    </div>
  );
}
