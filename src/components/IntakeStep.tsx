"use client";

import {
  AGE_BANDS,
  AGE_BAND_LABEL,
  CLINICAL_CONCERNS,
  CONCERN_LABEL,
  HOUSING_LABEL,
  HOUSING_TYPES,
  type AgeBand,
  type ClinicalConcern,
  type HousingType,
} from "@/domain/case";
import type { CaseApi } from "@/lib/case-store";

export function IntakeStep({ api }: { api: CaseApi }) {
  const { intake } = api.state;

  const toggleConcern = (c: ClinicalConcern) => {
    const has = intake.concerns.includes(c);
    api.patchIntake({
      concerns: has ? intake.concerns.filter((x) => x !== c) : [...intake.concerns, c],
    });
  };

  return (
    <>
      <h1 className="step-title">Client context</h1>
      <p className="step-sub">
        Background that shapes clinical judgement. No name, date of birth, or address is collected —
        the client&rsquo;s identity stays in your own records.
      </p>

      <section className="panel">
        <h2>About the client</h2>
        <div className="fieldgrid">
          <label>
            <span>Age band</span>
            <select
              value={intake.ageBand}
              onChange={(e) => api.patchIntake({ ageBand: e.target.value as AgeBand })}
            >
              <option value="">Select</option>
              {AGE_BANDS.map((b) => (
                <option key={b} value={b}>
                  {AGE_BAND_LABEL[b]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Living situation</span>
            <select
              value={intake.livesAlone}
              onChange={(e) =>
                api.patchIntake({ livesAlone: e.target.value as "alone" | "with_others" | "" })
              }
            >
              <option value="">Select</option>
              <option value="alone">Lives alone</option>
              <option value="with_others">Lives with others</option>
            </select>
          </label>

          <label>
            <span>Mobility aids</span>
            <input
              value={intake.mobilityAids}
              placeholder="Cane, walker, none…"
              onChange={(e) => api.patchIntake({ mobilityAids: e.target.value })}
            />
          </label>

          <label>
            <span>Falls in last 12 months</span>
            <input
              value={intake.fallsLast12Months}
              placeholder="0"
              inputMode="numeric"
              onChange={(e) => api.patchIntake({ fallsLast12Months: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>The home</h2>
        <div className="fieldgrid">
          <label>
            <span>Housing type</span>
            <select
              value={intake.housingType}
              onChange={(e) => api.patchIntake({ housingType: e.target.value as HousingType })}
            >
              <option value="">Select</option>
              {HOUSING_TYPES.map((h) => (
                <option key={h} value={h}>
                  {HOUSING_LABEL[h]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Floors</span>
            <input
              value={intake.floors}
              placeholder="1"
              inputMode="numeric"
              onChange={(e) => api.patchIntake({ floors: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Clinical concerns</h2>
        <p className="hint">Select any that apply. These appear in the report.</p>
        <div className="chips">
          {CLINICAL_CONCERNS.map((c) => {
            const on = intake.concerns.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                className={on ? "chip on" : "chip"}
                onClick={() => toggleConcern(c)}
              >
                <span aria-hidden="true">{on ? "✓" : "+"}</span> {CONCERN_LABEL[c]}
              </button>
            );
          })}
        </div>
        {intake.concerns.length > 0 && (
          <label className="stack">
            <span>Clinical notes</span>
            <textarea
              rows={3}
              value={intake.concernNotes}
              placeholder="Relevant detail about these concerns…"
              onChange={(e) => api.patchIntake({ concernNotes: e.target.value })}
            />
          </label>
        )}
      </section>
    </>
  );
}
