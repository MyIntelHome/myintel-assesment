"use client";

import { useState,useEffect } from "react";
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
  const [removeId,setRemoveId]=useState<string|null>(null);

  const active = state.spaces.find((s) => s.id === state.visit?.activeSpaceId) ?? state.spaces.find((s) => s.id === activeId) ?? state.spaces[0] ?? null;
  useEffect(()=>{if(state.visit?.focusCode&&active)document.getElementById(`clinical-${active.id}-${state.visit.focusCode}`)?.scrollIntoView?.({block:"center"})},[active?.id,state.visit?.focusCode]);
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
                    api.patchVisit({activeSpaceId:id,focusCode:undefined});
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
                  onClick={() => {setActiveId(space.id);api.patchVisit({activeSpaceId:space.id,focusCode:undefined})}}
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
              <label className="space-level">Level<select value={active.level??""} onChange={e=>api.setRoomLevel(active.id,Number(e.target.value))}><option value="">Not recorded</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
              <button
                type="button"
                className="btn-sm danger"
                onClick={() => setRemoveId(active.id)}
              >
                Remove
              </button>
            </div>

            {removeId===active.id&&<div className="panel" role="alert"><p>Remove {active.label} and its observations from this draft? Saved report versions remain in history.</p><button className="btn-sm danger" onClick={()=>{api.removeSpace(active.id);api.patchVisit({activeSpaceId:undefined,focusCode:undefined});setActiveId(null);setRemoveId(null)}}>Confirm removal</button><button className="btn-sm" onClick={()=>setRemoveId(null)}>Keep this space</button></div>}
            <ul className="items">
              {templateFor(active.type).items.map((item) => {
                const response = state.responses[active.id]?.[item.code];
                const status = (response?.status ?? "unknown") as AssessmentStatus;
                const familyAnswer = state.familyAnswers[familyKey(active.id, item.code)];
                const familyFlagged = isFlagged(item, familyAnswer);
                return (
                  <li key={item.code} id={`clinical-${active.id}-${item.code}`} className={`item item-${status}`}>
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
                    <button type="button" className="btn-sm visit-defer" aria-pressed={state.visit?.deferred.includes(`${active.id}::${item.code}`)??false} onClick={()=>{const key=`${active.id}::${item.code}`,keys=state.visit?.deferred??[];api.patchVisit({deferred:keys.includes(key)?keys.filter(k=>k!==key):[...keys,key]})}}>{state.visit?.deferred.includes(`${active.id}::${item.code}`)?"Return reminder recorded":"Return to this"}</button>
                    {(status==="concern"||status==="critical")&&<label className="visit-observation">Quick observation<textarea value={state.findings[`${active.id}::${item.code}`]?.notes??""} onChange={e=>api.patchFinding(`${active.id}::${item.code}`,{notes:e.target.value})} placeholder="What you observed; avoid identifying information"/></label>}
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
