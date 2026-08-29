import { TEMPLATES } from "@/seed/templates";
import { RECOMMENDATION_LIBRARY } from "@/seed/recommendations";
import { SPACE_TYPE_META } from "@/domain/types";
import { ASSESSMENT_STATUSES, STATUS_META } from "@/domain/status";

/**
 * Stage 0 proof of life. Renders the seeded clinical content so the port can
 * be eyeballed against the v1 prototype. Replaced by the clinician worklist
 * in Stage 1.
 */
export default function Page() {
  const templates = Object.values(TEMPLATES).filter((t) => t.items.length > 0);
  const itemCount = templates.reduce((n, t) => n + t.items.length, 0);
  const requiredCount = templates.reduce(
    (n, t) => n + t.items.filter((i) => i.required).length,
    0,
  );

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 96px" }}>
      <p
        style={{
          fontFamily: "var(--display)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--blue)",
          margin: "0 0 10px",
        }}
      >
        Stage 0 &middot; Foundations
      </p>
      <h1
        style={{
          fontFamily: "var(--display)",
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          margin: "0 0 12px",
        }}
      >
        Assessment platform
      </h1>
      <p style={{ color: "var(--clay)", maxWidth: "62ch", margin: "0 0 8px" }}>
        Clinical content is seeded and under test. {itemCount} assessment items across{" "}
        {templates.length} space types, {requiredCount} of them required for completeness.
      </p>
      <p style={{ color: "var(--clay)", maxWidth: "62ch", margin: "0 0 40px" }}>
        This build stores no client names, dates of birth, or addresses.
      </p>

      <h2 style={{ fontFamily: "var(--display)", fontSize: 20, margin: "0 0 14px" }}>
        Assessment states
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
        {ASSESSMENT_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          return (
            <li
              key={status}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 150px 1fr",
                gap: 12,
                padding: "9px 0",
                borderBottom: "1px solid var(--rule)",
                alignItems: "baseline",
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--clay)" }}>
                {meta.glyph}
              </span>
              <strong style={{ fontSize: 14 }}>{meta.label}</strong>
              <span style={{ fontSize: 14, color: "var(--clay)" }}>
                {meta.countsAsAssessed ? "Counts as assessed" : "Does not count as assessed"}
                {meta.isCoverageLimitation ? " · disclosed as a limitation" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 style={{ fontFamily: "var(--display)", fontSize: 20, margin: "0 0 14px" }}>
        Seeded space types
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
        {templates.map((t) => (
          <li
            key={t.spaceType}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              padding: "9px 0",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <strong style={{ fontSize: 15 }}>{SPACE_TYPE_META[t.spaceType].label}</strong>
            <span style={{ fontSize: 14, color: "var(--clay)" }}>
              {t.items.length} items &middot; v{t.version}
            </span>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 14, color: "var(--clay)" }}>
        {RECOMMENDATION_LIBRARY.length} vendor-neutral recommendations in the starter library.
      </p>
    </main>
  );
}
