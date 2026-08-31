"use client";

import { useMemo, useState } from "react";
import { StatusPicker } from "@/components/StatusPicker";
import { combineCompleteness, completenessForSpace } from "@/domain/completeness";
import { summariseRisk } from "@/domain/risk";
import { STATUS_META, type AssessmentStatus } from "@/domain/status";
import { SPACE_TYPE_META, SPACE_TYPES, type SpaceType } from "@/domain/types";
import { templateFor } from "@/seed/templates";
import { referenceLooksIdentifying, responseMap, useCase } from "@/lib/case-store";

const ADDABLE: SpaceType[] = SPACE_TYPES.filter((t) => templateFor(t).items.length > 0);

export default function Page() {
  const c = useCase();
  const { state } = c;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const active = state.spaces.find((s) => s.id === activeId) ?? state.spaces[0] ?? null;

  const perSpace = useMemo(
    () =>
      state.spaces.map((sp) => ({
        space: sp,
        completeness: completenessForSpace(templateFor(sp.type), responseMap(state, sp.id)),
      })),
    [state],
  );

  const overall = useMemo(
    () => combineCompleteness(perSpace.map((p) => p.completeness)),
    [perSpace],
  );

  const allStatuses = useMemo(
    () =>
      state.spaces.flatMap((sp) =>
        templateFor(sp.type).items.map(
          (i) => (state.responses[sp.id]?.[i.code]?.status ?? "unknown") as AssessmentStatus,
        ),
      ),
    [state],
  );

  const risk = useMemo(() => summariseRisk(allStatuses, overall), [allStatuses, overall]);

  if (!c.hydrated) {
    return <main style={{ padding: 40, color: "var(--clay)" }}>Loading…</main>;
  }

  const identifying = referenceLooksIdentifying(state.reference);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="mark">MI</span>
          <span>
            <strong>MyIntel</strong>
            <em>Assessment</em>
          </span>
        </div>
        <label className="ref">
          <span>Case reference</span>
          <input
            value={state.reference}
            onChange={(e) => c.setReference(e.target.value)}
            placeholder="2026-014"
            aria-invalid={identifying}
            aria-describedby={identifying ? "ref-warn" : undefined}
          />
        </label>
        <span className={`save save-${c.saveState}`} role="status">
          {c.saveState === "saving" ? "Saving…" : c.saveState === "error" ? "Not saved" : "Saved"}
        </span>
      </header>

      {identifying && (
        <p id="ref-warn" className="warn">
          That reference looks like it contains someone&rsquo;s initials and year of birth. This
          system stores no identifying information — use a reference that doesn&rsquo;t identify the
          client, such as <code>2026-014</code>.
        </p>
      )}

      <div className="layout">
        {/* ── Spaces ─────────────────────────────────────────── */}
        <aside>
          <div className="panel">
            <h2>Overall</h2>
            <div className="bigstat">
              <span className="num">{overall.percent}%</span>
              <span className="cap">
                assessed · {overall.requiredAssessed} of {overall.requiredTotal}
              </span>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${overall.percent}%` }} />
            </div>
            <p className={`risk risk-${risk.state}`}>{risk.statement}</p>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Spaces</h2>
              <button type="button" className="btn-sm" onClick={() => setAddOpen((v) => !v)}>
                {addOpen ? "Close" : "Add"}
              </button>
            </div>

            {addOpen && (
              <div className="addgrid">
                {ADDABLE.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="btn-add"
                    onClick={() => {
                      const existing = state.spaces.filter((s) => s.type === type).length;
                      const base = SPACE_TYPE_META[type].label;
                      const id = c.addSpace(type, existing === 0 ? base : `${base} ${existing + 1}`);
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
              <p className="empty">
                No spaces yet. Add every room in the home — as many bedrooms, bathrooms, entrances
                and stairways as it actually has.
              </p>
            )}

            <ul className="spacelist">
              {perSpace.map(({ space, completeness }) => (
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

        {/* ── Assessment ─────────────────────────────────────── */}
        <main>
          {!active ? (
            <div className="panel placeholder">
              <h1>Start an assessment</h1>
              <p>
                Add the spaces in this home to begin. Every item starts as <strong>Not assessed</strong>
                {" "}— nothing is assumed safe or unsafe until you say so.
              </p>
            </div>
          ) : (
            <ActiveSpace
              key={active.id}
              label={active.label}
              type={active.type}
              spaceId={active.id}
              state={state}
              onRename={(v) => c.renameSpace(active.id, v)}
              onRemove={() => {
                c.removeSpace(active.id);
                setActiveId(null);
              }}
              onStatus={(code, s) => c.setStatus(active.id, code, s)}
              onReason={(code, r) => c.setReason(active.id, code, r)}
            />
          )}
        </main>
      </div>
    </>
  );
}

function ActiveSpace({
  label,
  type,
  spaceId,
  state,
  onRename,
  onRemove,
  onStatus,
  onReason,
}: {
  label: string;
  type: SpaceType;
  spaceId: string;
  state: ReturnType<typeof useCase>["state"];
  onRename: (v: string) => void;
  onRemove: () => void;
  onStatus: (code: string, s: AssessmentStatus) => void;
  onReason: (code: string, r: string) => void;
}) {
  const template = templateFor(type);
  const completeness = completenessForSpace(template, responseMap(state, spaceId));

  return (
    <>
      <div className="space-head">
        <input
          className="space-name"
          value={label}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Space name"
        />
        <span className="space-count">
          {completeness.requiredAssessed} of {completeness.requiredTotal} assessed
        </span>
        <button type="button" className="btn-sm danger" onClick={onRemove}>
          Remove
        </button>
      </div>

      <ul className="items">
        {template.items.map((item) => {
          const response = state.responses[spaceId]?.[item.code];
          const status = (response?.status ?? "unknown") as AssessmentStatus;
          const needsReason = STATUS_META[status].requiresReason;
          return (
            <li key={item.code} className={`item item-${status}`}>
              <div className="item-text">
                <h3>
                  {item.prompt}
                  {!item.required && <span className="optional">Optional</span>}
                </h3>
                <p>{item.hint}</p>
              </div>
              <StatusPicker
                value={status}
                itemLabel={item.prompt}
                onChange={(s) => onStatus(item.code, s)}
              />
              {needsReason && (
                <input
                  className="reason"
                  value={response?.reason ?? ""}
                  placeholder={
                    status === "unable_to_assess"
                      ? "Why couldn't this be assessed? (appears in report limitations)"
                      : "Why does this not apply?"
                  }
                  onChange={(e) => onReason(item.code, e.target.value)}
                  aria-label={`Reason for ${item.prompt}`}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
