import type { CaseState } from "@/lib/case-store";
import { professionalFindingScores, type FindingScore } from "@/domain/professional-finding-scores";

const scoreLabel = (score: FindingScore) => score.percent === null ? "Not assessed" : score.percent === 0 && score.findings > 0 ? "<1%" : `${score.percent}%`;

function ScoreStatus({ score }: { score: FindingScore }) {
  return <>
    {score.critical > 0 && <strong className="pr-critical-flag">{score.critical} critical {score.critical === 1 ? "finding" : "findings"}</strong>}
    {score.incomplete && <span className="pr-incomplete-flag">Incomplete observations</span>}
    {!score.critical && !score.incomplete && score.examined > 0 && <span className="pr-score-status">{score.findings ? "Review the action plan" : "No concerns recorded in assessed checks"}</span>}
  </>;
}

export function FindingScoreCard({ title, score }: { title: string; score: FindingScore }) {
  return <div className={`pr-room-overview pr-finding-score ${score.critical ? "has-critical" : ""}`}>
    <h4>{title}</h4>
    <div className="pr-room-percent">{scoreLabel(score)} <small>{score.percent === null ? "" : "concern score"}</small></div>
    {score.percent !== null && <div className="pr-progress pr-concern-progress" role="img" aria-label={`${title}: ${score.findings} of ${score.examined} assessed checks have concerns, ${scoreLabel(score)}`}>
      <span style={{ width: `${score.percent}%` }} />
    </div>}
    <p>{score.examined > 0 ? `${score.findings} of ${score.examined} assessed checks have a concern or critical finding.` : "No checks have been assessed in this group."}</p>
    <div className="pr-score-flags"><ScoreStatus score={score} /></div>
    <p className="report-meta">{score.pending} required checks not assessed · {score.unable} unable to assess · {score.notApplicable} N/A</p>
  </div>;
}

export function FindingsDashboard({ state }: { state: CaseState }) {
  const { overall } = professionalFindingScores(state);
  const noConcern = overall.examined - overall.findings;
  const segments = [[noConcern, "clear"], [overall.concern, "concern"], [overall.critical, "critical"]] as const;
  return <>
    <section className="pr-dashboard pr-findings-dashboard" aria-label="Findings dashboard">
      <div className="pr-metrics">
        <div>
          <span>Overall concern score</span>
          <strong>{scoreLabel(overall)}</strong>
          <small>{overall.examined > 0 ? `${overall.findings} of ${overall.examined} assessed checks have concerns` : "No checks assessed yet"}</small>
        </div>
        <div className={overall.critical ? "pr-critical-metric" : ""}>
          <span>Critical findings</span><strong>{overall.critical}</strong>
          <small>{overall.critical ? "Review these first, regardless of the score" : "None recorded in the checks assessed"}</small>
        </div>
        <div><span>Recorded concerns</span><strong>{overall.findings}</strong><small>{overall.concern} concern · {overall.critical} critical</small></div>
        <div><span>Actions in the plan</span><strong>{state.plan.length}</strong><small>Recommendations and responsibilities follow below</small></div>
      </div>
      <div className="pr-overview">
        <div>
          <h3>How to read your scores</h3>
          <p>Higher means more concerns recorded. For example, 25% means 2 of 8 assessed checks have a concern or critical finding.</p>
          <p>These are findings percentages, not completion percentages. A low score does not establish safety. Critical findings always need separate attention.</p>
        </div>
        <div>
          <h3>Recorded findings</h3>
          <div className="pr-stack" role="img" aria-label={`${noConcern} no concern, ${overall.concern} concern, ${overall.critical} critical, among ${overall.examined} assessed checks`}>
            {segments.filter(([count])=>count>0).map(([count,color])=><span key={color} className={`pr-segment pr-${color}`} style={{width:`${count / overall.examined * 100}%`}} />)}
          </div>
          <ul className="pr-legend">
            <li><span className="pr-dot pr-clear" />No concern recorded<strong>{noConcern}</strong></li>
            <li><span className="pr-dot pr-concern" />Concern<strong>{overall.concern}</strong></li>
            <li><span className="pr-dot pr-critical" />Critical<strong>{overall.critical}</strong></li>
          </ul>
        </div>
      </div>
      <div className="pr-scope-note">
        <strong>Assessment scope and gaps</strong>
        <p>{overall.examined} checks assessed · {overall.pending} required checks not assessed · {overall.unable} unable to assess · {overall.notApplicable} N/A.</p>
        {overall.incomplete && <p className="pr-incomplete-flag">Scores are provisional because observations remain incomplete.</p>}
      </div>
      <p className="pr-method">Concern score = checks marked concern or critical divided by checks marked pass, concern or critical. Assessed optional checks are included. N/A, unable-to-assess and unanswered checks are excluded from the score and shown separately. Each assessed check counts equally. This HomeCheck summary is not a validated clinical score or a probability of falling. AMPS and other external test scores remain separate.</p>
    </section>
  </>;
}

export function FindingCategoryScores({ state }: { state: CaseState }) {
  const { categories } = professionalFindingScores(state);
  return <section className="pr-section" aria-label="Findings scores by category">
      <h3>Findings by category</h3>
      <p>Each category uses its own assessed checks. Categories may have different numbers of checks; read the counts and critical findings alongside the percentage.</p>
      <div className="pr-room-grid">{categories.map(score => <FindingScoreCard key={score.id} title={score.label} score={score} />)}</div>
    </section>;
}
