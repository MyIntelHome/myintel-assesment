"use client";
import {useEffect,useState} from "react";
import {shopLink,SHOP_DISCLOSURE} from "@/domain/lead-config";
import type {HomeProfile} from "@/domain/home-profile";
import {topPriorities,type FamilyReport} from "@/domain/family-report";
import {homeActions,type HomeAction} from "@/domain/home-actions";
import type {SpaceType} from "@/domain/types";
import {Glyph,type GlyphName} from "./Brand";
import {RoomArt} from "./RoomArt";

const CATEGORY_ICON:Record<HomeAction["category"],GlyphName>={home_modification:"wrench",technology:"bulb",daily_life:"heart",support_plan:"phone",routine:"route"};
const FIRST=4;

/** The few reported concerns to lead with, each shown in its room. */
export function ReportPriorities({report,spaceTypes}:{report:FamilyReport;spaceTypes:Readonly<Record<string,SpaceType>>}){
 const priorities=topPriorities(report);
 if(!priorities.length)return null;
 return <section className="report-first-priorities" aria-labelledby="priorities-heading"><h2 id="priorities-heading">Start with these</h2><p>The reported concerns that tend to matter most. One manageable step is enough for today.</p>
  <ol>{priorities.map((e,i)=><li key={`${e.spaceId}-${e.code}`}><div className="priority-art"><RoomArt type={spaceTypes[e.spaceId]} focus={e.code}/></div><div className="priority-body"><span className="priority-room"><b aria-hidden="true">{i+1}</b>{e.spaceLabel}</span><h3>{e.question}</h3>{e.guidance && <><p><strong>Why it matters:</strong> {e.guidance.why}</p><p className="priority-help"><strong>What may help:</strong> {e.guidance.helps}</p></>}</div></li>)}</ol>
 </section>;
}

function ActionCard({a,shop}:{a:HomeAction;shop:string}){
 const link=shopLink(shop,a.category,a.needCode);
 return <article className={`home-action-card home-action-card--${a.category}`}><span className="home-action-card__icon" aria-hidden="true"><Glyph name={CATEGORY_ICON[a.category]??"spark"}/></span><div><span className="family-v2__eyebrow">{a.label}</span><h3>{a.title}</h3><p>{a.why}</p><p className="home-action-card__step"><strong>Next step:</strong> {a.step}</p>{link&&<a href={link} target="_blank" rel="noopener noreferrer sponsored">See options</a>}</div></article>;
}

export function HomeActionPlan({profile,report,onRequestHelp}:{profile?:HomeProfile;report:FamilyReport;onRequestHelp?:(service?:string)=>void}){
 const [shop,setShop]=useState("");
 useEffect(()=>{fetch("/api/lead-config").then(r=>r.ok?r.json():Promise.resolve({enabled:false,deliveryEnabled:false,shopUrl:""})).then(d=>setShop(d.shopUrl??"")).catch(()=>{})},[]);
 const rank=(x:HomeAction)=>x.id==="simple"?0:x.category==="home_modification"?1:x.category==="technology"?2:x.category==="support_plan"?3:x.id.startsWith("activity-")?4:x.id==="context-gaps"?9:5;
 const actions=homeActions(report,profile).map((x,i)=>({x,i})).sort((m,n)=>rank(m.x)-rank(n.x)||m.i-n.i).map(m=>m.x),rest=actions.slice(FIRST);
 return <section className="home-action-plan" aria-labelledby="action-plan-heading">
  <h2 id="action-plan-heading">Your next steps</h2><p>Choose one manageable step. You do not need to solve everything today.</p>
  {actions.length?<div className="home-action-list">{actions.slice(0,FIRST).map(a=><ActionCard key={a.id} a={a} shop={shop}/>)}{rest.length>0&&<details className="home-action-more"><summary>Show {rest.length} more {rest.length===1?"step":"steps"}</summary><div className="home-action-list">{rest.map(a=><ActionCard key={a.id} a={a} shop={shop}/>)}</div></details>}</div>:<p>No specific change is suggested by the answers provided so far. That does not rule out other hazards or support needs. A professional can check what this short home check misses.</p>}
  {actions.some(a=>shopLink(shop,a.category,a.needCode))&&<p className="family-v2__fine-print">{SHOP_DISCLOSURE}</p>}
  <p className="family-v2__fine-print">These are options to discuss or arrange, not a clinical prescription. Nothing has been ordered or booked.</p>
  <div className="report-professional-review"><h3>What might this check have missed?</h3><p>Does moving around feel difficult? Are you unsure about bathroom support, equipment or a change in daily life? Even a completed check cannot tell you that you are safe. An in-person review can look at how you use the home, not just the answers on a screen.</p>
   {onRequestHelp && <div className="report-followup-options"><article><span className="report-followup-options__icon" aria-hidden="true"><Glyph name="clipboard"/></span><h4>Occupational therapist (OT)</h4><p>Request an assessment of movement, transfers, falls concerns and equipment fit, with a plan tailored to your activities.</p><button type="button" className="family-v2__button family-v2__button--primary" onClick={()=>onRequestHelp("professional_assessment")}>Request an OT assessment →</button></article><article><span className="report-followup-options__icon" aria-hidden="true"><Glyph name="home"/></span><h4>MyIntel aging-in-place follow-up</h4><p>Ask MyIntel to arrange a follow-up with Austin about practical home modifications, routines, technology and what to prioritize. This does not replace an OT&apos;s clinical assessment.</p><button type="button" className="family-v2__button family-v2__button--secondary" onClick={()=>onRequestHelp("care_navigation")}>Request a follow-up with MyIntel →</button></article></div>}
   <p className="family-v2__fine-print">A request starts a conversation. Availability, scope, price and appointment times are confirmed separately. Sharing your results is optional; nothing is sent to a professional automatically.</p>
  </div>
 </section>;
}
