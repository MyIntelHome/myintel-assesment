"use client";

import { ASSESSMENT_STATUSES, STATUS_META, type AssessmentStatus } from "@/domain/status";

/** Colours are supplementary. Every option also carries a glyph and a word. */
const TONE: Record<Exclude<AssessmentStatus, "unknown">, { fg: string; bg: string; border: string }> = {
  pass: { fg: "#1d6b4f", bg: "#e6f1eb", border: "#1d6b4f" },
  concern: { fg: "#8a5a12", bg: "#fbf1de", border: "#8a5a12" },
  critical: { fg: "#9e342a", bg: "#f9e8e6", border: "#9e342a" },
  not_applicable: { fg: "#55627a", bg: "#eeeade", border: "#55627a" },
  unable_to_assess: { fg: "#2b6b80", bg: "#e6f0f3", border: "#2b6b80" },
};

const OPTIONS = ASSESSMENT_STATUSES.filter((s) => s !== "unknown");

const SHORT: Record<string, string> = {
  pass: "Pass",
  concern: "Concern",
  critical: "Critical",
  not_applicable: "N/A",
  unable_to_assess: "Can't assess",
};

export function StatusPicker({
  value,
  onChange,
  itemLabel,
}: {
  value: AssessmentStatus;
  onChange: (status: AssessmentStatus) => void;
  itemLabel: string;
}) {
  return (
    <div role="group" aria-label={`Rating for ${itemLabel}`} className="status-picker">
      {OPTIONS.map((status) => {
        const active = value === status;
        const tone = TONE[status as Exclude<AssessmentStatus, "unknown">];
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(status)}
            title={STATUS_META[status].description}
            style={{
              minHeight: 48,
              padding: "0 14px",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: active ? 700 : 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap",
              background: active ? tone.bg : "#fff",
              color: active ? tone.fg : "#55627a",
              border: `1.5px solid ${active ? tone.border : "#e3ddd0"}`,
              transition: "background .12s, border-color .12s",
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 700 }}>
              {STATUS_META[status].glyph}
            </span>
            {SHORT[status]}
          </button>
        );
      })}
    </div>
  );
}
