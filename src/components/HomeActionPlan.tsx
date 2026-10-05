import type {HomeProfile} from "@/domain/home-profile";
import {topPriorities,type FamilyReport} from "@/domain/family-report";
import {homeActions} from "@/domain/home-actions";
export function HomeActionPlan({profile,report,onRequestHelp}:{profile?:HomeProfile;report:FamilyReport;onRequestHelp?:(service?:string)=>void}){
 const actions=homeActions(report,profile),priorities=topPriorities(report);
 return <section className="home-action-plan" aria-labelledby="action-plan-heading">
  <h2 id="action-plan-heading">Your next steps</h2><p>Choose one manageable step. You do not need to solve everything today.</p>
  {priorities.length>0 && <div className="report-first-priorities"><h3>Start with these reported concerns</h3><ol>{priorities.map(e=><li key={`${e.spaceId}-${e.code}`}><strong>{e.spaceLabel}</strong><p>{e.question}</p>{e.guidance && <p>{e.guidance.helps}</p>}</li>)}</ol></div>}
  {actions.length?actions.map(a=><article className="home-action-card" key={a.id}><span className="family-v2__eyebrow">{a.label}</span><h3>{a.title}</h3><p>{a.why}</p><p><strong>Next step:</strong> {a.step}</p></article>):<p>No specific change is suggested by the answers provided so far. That does not rule out other hazards or support needs. A professional can check what this short home check misses.</p>}
  <div className="report-professional-review"><h3>What might this check have missed?</h3><p>Does moving around feel difficult? Are you unsure about bathroom support, equipment or a change in daily life? Even a completed check cannot tell you that you are safe. An in-person review can look at how you use the home, not just the answers on a screen.</p>
   {onRequestHelp && <div className="report-followup-options"><article><h4>Occupational therapist (OT)</h4><p>Request an assessment of movement, transfers, falls concerns and equipment fit, with a plan tailored to your activities.</p><button type="button" className="family-v2__button family-v2__button--primary" onClick={()=>onRequestHelp("professional_assessment")}>Request an OT assessment →</button></article><article><h4>MyIntel aging-in-place follow-up</h4><p>Ask MyIntel to arrange a follow-up with Austin about practical home modifications, routines, technology and what to prioritize. This does not replace an OT's clinical assessment.</p><button type="button" className="family-v2__button family-v2__button--secondary" onClick={()=>onRequestHelp("care_navigation")}>Request a follow-up with MyIntel →</button></article></div>}
   <p className="family-v2__fine-print">A request starts a conversation. Availability, scope, price and appointment times are confirmed separately. Sharing your results is optional; nothing is sent to a professional automatically.</p>
  </div><p className="family-v2__fine-print">These are options to discuss or arrange, not a clinical prescription. Nothing has been ordered or booked.</p>
 </section>;
}
