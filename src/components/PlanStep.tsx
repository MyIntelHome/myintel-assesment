"use client";

import { useState } from "react";
import { validatePlanItem } from "@/domain/case";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_STATUSES,
  RESPONSIBLE_PARTIES,
  TIMEFRAMES,
} from "@/domain/types";
import { RECOMMENDATION_LIBRARY } from "@/seed/recommendations";
import type { CaseApi } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";

const label = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

export function PlanStep({ api, view }: { api: CaseApi; view: CaseView }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { plan } = api.state;

  // Only offer suggestions relevant to the spaces actually in this home.
  const spaceTypes = new Set(api.state.spaces.map((s) => s.type));
  const suggestions = RECOMMENDATION_LIBRARY.filter((r) =>
    r.spaceTypes.some((t) => spaceTypes.has(t)),
  );

  return (
    <>
      <h1 className="step-title">Action plan</h1>
      <p className="step-sub">
        What should actually happen, in what order, and who does it. Every recommendation needs an
        urgency, a responsible party, and a cost range before the report can be signed.
      </p>

      <div className="plan-actions">
        <button type="button" className="btn" onClick={() => api.addPlanItem()}>
          + Blank recommendation
        </button>
        <button type="button" className="btn-sm" onClick={() => setPickerOpen((v) => !v)}>
          {pickerOpen ? "Close suggestions" : `Suggestions (${suggestions.length})`}
        </button>
      </div>

      {pickerOpen && (
        <div className="panel">
          <h2>Common recommendations</h2>
          <p className="hint">Vendor-neutral. Selecting one still requires the details below.</p>
          <div className="chips">
            {suggestions.map((s) => (
              <button
                key={s.code}
                type="button"
                className="chip"
                onClick={() => {
                  api.addPlanItem(s.title);
                  setPickerOpen(false);
                }}
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {plan.length === 0 && (
        <div className="panel placeholder">
          <p>
            No recommendations yet.{" "}
            {view.findings.length > 0
              ? `You have ${view.findings.length} finding${view.findings.length === 1 ? "" : "s"} to address.`
              : "Mark items as Concern or Critical in the assessment to see what needs addressing."}
          </p>
        </div>
      )}

      {plan.map((item) => {
        const missing = validatePlanItem(item);
        return (
          <section key={item.id} className={`panel plan-item${missing.length ? " incomplete" : ""}`}>
            <div className="plan-head">
              <input
                className="plan-title"
                value={item.title}
                placeholder="What needs to happen"
                aria-label="Recommendation title"
                onChange={(e) => api.patchPlanItem(item.id, { title: e.target.value })}
              />
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => api.removePlanItem(item.id)}
              >
                Remove
              </button>
            </div>

            {missing.length > 0 && (
              <p className="missing">Still needed: {missing.join(", ")}</p>
            )}

            <label className="stack">
              <span>Why it matters</span>
              <textarea
                rows={2}
                value={item.rationale}
                placeholder="The clinical reason for this recommendation…"
                onChange={(e) => api.patchPlanItem(item.id, { rationale: e.target.value })}
              />
            </label>

            <div className="fieldgrid">
              <label>
                <span>Urgency</span>
                <select
                  value={item.urgency}
                  onChange={(e) => api.patchPlanItem(item.id, { urgency: e.target.value as never })}
                >
                  <option value="">Not set</option>
                  {TIMEFRAMES.map((v) => (
                    <option key={v} value={v}>{label(v)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Category</span>
                <select
                  value={item.category}
                  onChange={(e) => api.patchPlanItem(item.id, { category: e.target.value as never })}
                >
                  {RECOMMENDATION_CATEGORIES.map((v) => (
                    <option key={v} value={v}>{label(v)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Responsible party</span>
                <select
                  value={item.responsibleParty}
                  onChange={(e) => api.patchPlanItem(item.id, { responsibleParty: e.target.value as never })}
                >
                  <option value="">Not set</option>
                  {RESPONSIBLE_PARTIES.map((v) => (
                    <option key={v} value={v}>{label(v)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={item.status}
                  onChange={(e) => api.patchPlanItem(item.id, { status: e.target.value as never })}
                >
                  {RECOMMENDATION_STATUSES.map((v) => (
                    <option key={v} value={v}>{label(v)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cost from ($)</span>
                <input
                  value={item.costMin}
                  inputMode="numeric"
                  placeholder="50"
                  disabled={item.costNotEstimated}
                  onChange={(e) => api.patchPlanItem(item.id, { costMin: e.target.value })}
                />
              </label>
              <label>
                <span>Cost to ($)</span>
                <input
                  value={item.costMax}
                  inputMode="numeric"
                  placeholder="200"
                  disabled={item.costNotEstimated}
                  onChange={(e) => api.patchPlanItem(item.id, { costMax: e.target.value })}
                />
              </label>
              <label>
                <span>Follow-up date</span>
                <input
                  type="date"
                  value={item.followUpDate}
                  onChange={(e) => api.patchPlanItem(item.id, { followUpDate: e.target.value })}
                />
              </label>
            </div>

            <label className="inline">
              <input
                type="checkbox"
                checked={item.costNotEstimated}
                onChange={(e) => api.patchPlanItem(item.id, { costNotEstimated: e.target.checked })}
              />
              <span>Cost not estimated</span>
            </label>

            {view.findings.length > 0 && (
              <details className="links">
                <summary>
                  Linked findings ({item.linkedFindings.length})
                </summary>
                <div className="chips">
                  {view.findings.map((f) => {
                    const on = item.linkedFindings.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={on}
                        className={on ? "chip on" : "chip"}
                        onClick={() =>
                          api.patchPlanItem(item.id, {
                            linkedFindings: on
                              ? item.linkedFindings.filter((k) => k !== f.key)
                              : [...item.linkedFindings, f.key],
                          })
                        }
                      >
                        <span aria-hidden="true">{on ? "✓" : "+"}</span> {f.space.label}: {f.prompt}
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
