"use client";

import { useState } from "react";
import { StatusPicker } from "@/components/StatusPicker";
import { STATUS_META, type AssessmentStatus } from "@/domain/status";
import { SPACE_TYPE_META, SPACE_TYPES, type SpaceType } from "@/domain/types";
import { FAMILY_ANSWER_LABEL, familyKey, isFlagged } from "@/domain/family";
import { templateFor } from "@/seed/templates";
import type { CaseApi } from "@/lib/case-store";
import type { CaseView } from "@/lib/selectors";

const ADDABLE: SpaceType[] = SPACE_TYPES.filter((t) => templateFor(t).items.length > 0);

export function AssessStep({ api, view }: { api: CaseApi; view: CaseView }) {
  const { state } = api;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const active = state.spaces.find((s) => s.id === activeId) ?? state.spaces[0] ?? null;
  const activeCompleteness = view.perSpace.find((p) => p.space.id === active?.id)?.completeness;

  return (
    <div className="assess">
      <aside>
        <div className="panel">
          <div className="panel-head">
            <h2>Spaces</h2>
            <button type="button" className="btn-sm" onClick={() => setAddOpen((v) => !v)}>
              {addOpen ? "Close" : "Add"}
            </button>
          </div>

          {addOpen && (
            <div className="chips add">
              {ADDABLE.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="chip"
                  onClick={() => {
                    const existing = state.spaces.filter((s) => s.type === type).length;
                    const base = SPACE_TYPE_META[type].label;
                    const id = api.addSpace(type, existing === 0 ? base : `${base} ${existing + 1}`);
                    setActiveId(id);
                    setAddOpen(false);
                  }}
                >
                  + {SPACE_TYPE_META[type].label}
                </button>
              ))}
            </div>
          )}

          {state.spaces.length === 0 && !addOpen && (
            <p className="hint">
              Add every room in the home — as many bedrooms, bathrooms, entrances and stairways as it
              actually has.
            </p>
          )}

          <ul className="spacelist">
            {view.perSpace.map(({ space, completeness }) => (
              <li key={space.id}>
                <button
                  type="button"
                  className={space.id === active?.id ? "sp active" : "sp"}
                  onClick={() => setActiveId(space.id)}
                >
                  <span className="sp-name">{space.label}</span>
                  <span className="sp-meta">
                    {completeness.requiredAssessed}/{completeness.requiredTotal}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div>
        {!active ? (
          <div className="panel placeholder">
            <h1>Start the walkthrough</h1>
            <p>
              Add the spaces in this home to begin. Every item starts as{" "}
              <strong>Not assessed</strong> — nothing is assumed safe or unsafe until you say so.
            </p>
          </div>
        ) : (
          <>
            <div className="space-head">
              <input
                className="space-name"
                value={active.label}
                onChange={(e) => api.renameSpace(active.id, e.target.value)}
                aria-label="Space name"
              />
              <span className="space-count">
                {activeCompleteness?.requiredAssessed ?? 0} of {activeCompleteness?.requiredTotal ?? 0}{" "}
                assessed
              </span>
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => {
                  api.removeSpace(active.id);
                  setActiveId(null);
                }}
              >
                Remove
              </button>
            </div>

            <ul className="items">
              {templateFor(active.type).items.map((item) => {
                const response = state.responses[active.id]?.[item.code];
                const status = (response?.status ?? "unknown") as AssessmentStatus;
                const familyAnswer = state.familyAnswers[familyKey(active.id, item.code)];
                const familyFlagged = isFlagged(item, familyAnswer);
                return (
                  <li key={item.code} className={`item item-${status}`}>
                    <div className="item-text">
                      <h3>
                        {item.prompt}
                        {!item.required && <span className="optional">Optional</span>}
                      </h3>
                      <p>{item.hint}</p>
                    </div>

                    {/* Family input is evidence, never a rating. It is shown as a
                        report to confirm or override, and is visually distinct
                        from the clinician's own judgement. */}
                    {familyAnswer && (
                      <p className={familyFlagged ? "famreport flagged" : "famreport"}>
                        <span className="famreport-tag">Reported by family</span>
                        &ldquo;{item.promptPlain}&rdquo; — {FAMILY_ANSWER_LABEL[familyAnswer]}
                        {familyFlagged && <strong> · worth checking</strong>}
                      </p>
                    )}
                    <StatusPicker
                      value={status}
                      itemLabel={item.prompt}
                      onChange={(s) => api.setStatus(active.id, item.code, s)}
                    />
                    {STATUS_META[status].requiresReason && (
                      <input
                        className="reason"
                        value={response?.reason ?? ""}
                        placeholder={
                          status === "unable_to_assess"
                            ? "Why couldn't this be assessed? (appears in report limitations)"
                            : "Why does this not apply?"
                        }
                        onChange={(e) => api.setReason(active.id, item.code, e.target.value)}
                        aria-label={`Reason for ${item.prompt}`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
