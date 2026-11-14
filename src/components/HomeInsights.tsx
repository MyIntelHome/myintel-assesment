import type {CaseApi} from "@/lib/case-store";
import type {FamilyReport} from "@/domain/family-report";
import {profileLines} from "@/domain/home-profile";
import {homeReportSummary,REVIEW_LEVELS} from "@/domain/home-report-summary";
import {contextGaps} from "@/domain/dynamic-context";

const TONES={concern:"To look at",unsure:"Not sure",clear:"No concern reported",unanswered:"Unanswered"} as const;

/** Donut of every question in the report. Decorative; the legend carries the numbers. */
function AnswerRing({segments,total,children}:{segments:{tone:string;value:number}[];total:number;children:React.ReactNode}){
 const r=52,c=2*Math.PI*r;let offset=0;
 return <div className="answer-ring"><svg viewBox="0 0 128 128" aria-hidden="true" focusable="false"><circle className="answer-ring__track" cx="64" cy="64" r={r}/>{total>0&&segments.filter(s=>s.value>0).map(s=>{const length=s.value/total*c,gap=segments.filter(x=>x.value>0).length>1?3:0,el=<circle key={s.tone} className={`answer-ring__seg ${s.tone}`} cx="64" cy="64" r={r} strokeDasharray={`${Math.max(0,length-gap)} ${c}`} strokeDashoffset={-offset}/>;offset+=length;return el})}</svg><div className="answer-ring__center">{children}</div></div>;
}

/** The headline picture: what the answers show, and how much follow-up they suggest. */
export function HomeInsights({report,profile,onRooms}:{report:FamilyReport;profile?:CaseApi["state"]["homeProfile"];onRooms:()=>void}){
 const total=report.totalCount,unanswered=total-report.answeredCount,clear=report.answeredCount-report.flaggedCount-report.unsureCount;
 const segments=[{tone:"concern",value:report.flaggedCount},{tone:"unsure",value:report.unsureCount},{tone:"clear",value:clear},{tone:"unanswered",value:unanswered}] as const;
 const summary=homeReportSummary(report,profile),roomsDone=report.rooms.filter(r=>!r.unansweredCount).length;
 return <section className="home-insights" aria-labelledby="coverage-heading">
  <div className="report-glance">
   <AnswerRing segments={[...segments]} total={total}><strong>{report.flaggedCount}</strong><span>to look at</span></AnswerRing>
   <div className="report-glance__body"><h2 id="coverage-heading">Your results at a glance</h2>
    <ul className="home-answer-key">{segments.map(s=><li key={s.tone} className={s.tone}><i className={s.tone} aria-hidden="true"/><strong>{s.value}</strong><span>{TONES[s.tone]}</span></li>)}</ul>
    <p className="report-glance__coverage">{report.answeredCount} of {total} questions answered · {roomsDone} of {report.rooms.length} rooms complete</p>
    {unanswered>0 && <button className="family-v2__back" onClick={onRooms}>Return to unanswered questions →</button>}
   </div>
  </div>
  <section className="report-review-scale" aria-labelledby="review-scale-heading"><h3 id="review-scale-heading">Suggested follow-up</h3>
   <ol>{REVIEW_LEVELS.map((label,index)=><li key={label} className={summary.level===index?"current":summary.level!==null&&index<summary.level?"passed":""} aria-current={summary.level===index?"step":undefined}><span className="visually-hidden">{label}</span></li>)}</ol>
   <strong>{summary.label}</strong><p>{summary.reason}</p>
   <p className="family-v2__fine-print">This describes follow-up priority from your answers. It is not a validated clinical risk score, a diagnosis or a probability of falling. The numbers above count questions; they do not measure how safe the home is.</p>
  </section>
 </section>;
}

/** The reported context behind the results, tucked away until it is wanted. */
export function HomeContextDetails({api}:{api:CaseApi}){
 const lines=profileLines(api.state.homeProfile),gaps=contextGaps(api.state.homeProfile);
 if(!lines.length&&!gaps.length)return null;
 return <section className="home-context"><h2>The answers behind this report</h2>
  {api.state.homeProfile?.routines.includes("night") && <p><strong>A useful starting point:</strong> review the route between the bedroom and bathroom, alongside any concerns listed above.</p>}
  {api.state.homeProfile?.livingWith==="alone" && <p><strong>For professional review:</strong> discuss how help could be reached when nobody else is home.</p>}
  {lines.length>0&&<details><summary>The home and daily life ({lines.length} details)</summary><ul>{lines.map(line=><li key={line}>{line}</li>)}</ul><p className="family-v2__fine-print">Reported context. This does not change the question ratings or establish a clinical risk level.</p></details>}
  {gaps.length>0&&<details><summary>{gaps.length} context details not established</summary><p>These gaps are separate from the room check. No answer is inferred from missing information.</p><ul>{gaps.map(s=><li key={s}>{s}</li>)}</ul></details>}
 </section>;
}
