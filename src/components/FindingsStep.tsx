"use client";

import {
  CONFIDENCE_LEVELS,
  CONSEQUENCES,
  EVIDENCE_SOURCES,
  LIKELIHOODS,
  RESIDENT_PRIORITIES,
  SEVERITIES,
  TIMEFRAMES,
} from "@/domain/types";
import type { CaseApi } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";

const label = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

export function FindingsStep({ api, view }: { api: CaseApi; view: CaseView }) {
  return (
    <>
      <h1 className="step-title">Findings</h1>
      <p className="step-sub">
        Every item marked Concern or Critical appears here. Add the clinical detail that turns an
        observation into a defensible finding.
      </p>

      {view.findings.length === 0 ? (
        <div className="panel placeholder">
          <p>
            No findings yet. Items you mark <strong>Concern</strong> or <strong>Critical</strong> in
            the assessment will appear here automatically.
          </p>
        </div>
      ) : (
        view.findings.map((f) => {
          const d = f.detail;
          const patch = (p: Parameters<CaseApi["patchFinding"]>[1]) => api.patchFinding(f.key, p);
          return (
            <section key={f.key} className={`panel finding finding-${f.status}`}>
              <div className="finding-head">
                <span className={`tag tag-${f.status}`}>
                  {f.status === "critical" ? "✕ Critical" : "! Concern"}
                </span>
                <h2 className="finding-title">{f.prompt}</h2>
                <span className="finding-space">{f.space.label}</span>
              </div>
              <p className="hint">{f.hint}</p>

              <div className="fieldgrid">
                <label>
                  <span>Severity</span>
                  <select value={d.severity ?? ""} onChange={(e) => patch({ severity: e.target.value as never })}>
                    <option value="">Not set</option>
                    {SEVERITIES.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Likelihood</span>
                  <select value={d.likelihood ?? ""} onChange={(e) => patch({ likelihood: e.target.value as never })}>
                    <option value="">Not set</option>
                    {LIKELIHOODS.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Consequence</span>
                  <select value={d.consequence ?? ""} onChange={(e) => patch({ consequence: e.target.value as never })}>
                    <option value="">Not set</option>
                    {CONSEQUENCES.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Evidence source</span>
                  <select value={d.evidenceSource ?? ""} onChange={(e) => patch({ evidenceSource: e.target.value as never })}>
                    <option value="">Not set</option>
                    {EVIDENCE_SOURCES.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Your confidence</span>
                  <select value={d.confidence ?? ""} onChange={(e) => patch({ confidence: e.target.value as never })}>
                    <option value="">Not set</option>
                    {CONFIDENCE_LEVELS.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Resident&rsquo;s priority</span>
                  <select value={d.residentPriority ?? ""} onChange={(e) => patch({ residentPriority: e.target.value as never })}>
                    <option value="">Not set</option>
                    {RESIDENT_PRIORITIES.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Recommended timeframe</span>
                  <select value={d.timeframe ?? ""} onChange={(e) => patch({ timeframe: e.target.value as never })}>
                    <option value="">Not set</option>
                    {TIMEFRAMES.map((v) => (
                      <option key={v} value={v}>{label(v)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="stack">
                <span>Clinical notes</span>
                <textarea
                  rows={2}
                  value={d.notes ?? ""}
                  placeholder="What you observed and why it matters…"
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
            </section>
          );
        })
      )}
    </>
  );
}
