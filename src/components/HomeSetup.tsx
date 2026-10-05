"use client";
import {useEffect,useRef} from "react";
import {HomeRoutineConversation} from "./HomeRoutineConversation";
import type {CaseApi} from "@/lib/case-store";
import {EMPTY_PROFILE,HOME_TYPES,USED_AREAS} from "@/domain/home-profile";
const SPACE_LABELS:Record<keyof typeof USED_AREAS,string>={bedroom:"Bedroom",bathroom:"Bathroom",half_bath:"Toilet / half bath",living:"Living room",kitchen:"Kitchen",entry:"Entrance",stairway:"Steps or stairs",exterior:"Outside"};
export function HomeSetup({api,step}:{api:CaseApi;step:"routine"|"home"}){
  const p=api.state.homeProfile??EMPTY_PROFILE,heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus()},[step]);
  const used=p.usedAreas??[];
  const chooseArea=(area:keyof typeof USED_AREAS)=>api.patchHomeProfile({usedAreas:used.includes(area)?used.filter(a=>a!==area):[...used,area]});
  const go=(phase:"routine"|"home"|"rooms")=>api.setFamilyPosition({phase,roomIndex:0,questionIndex:0});
  if(step==="routine")return <HomeRoutineConversation api={api} onNext={()=>go("home")}/>;
  return <main className="family-v2 home-setup"><div className="home-stage" aria-label="Home check stages"><span className={"done"}>1 · Daily life</span><span className={"current"}>2 · Your home</span><span>3 · Room check</span><span>4 · Next steps</span></div><section className="family-v2__card">
    <p className="family-v2__eyebrow">Choose your spaces</p>
    <h1 ref={heading} tabIndex={-1}>Which spaces would you like to check?</h1>
    <p className="family-v2__lead">Choose the spaces used most days. You can start with just one, or a space you want help using again.</p>
    <form onSubmit={e=>{e.preventDefault();if(used.length)api.prepareHomeRooms()}}>
      <fieldset className="space-selection"><legend className="visually-hidden">Spaces to include in your home check</legend><div>{Object.keys(USED_AREAS).map(key=>{const area=key as keyof typeof USED_AREAS;return <label key={area}><input type="checkbox" checked={used.includes(area)} onChange={()=>chooseArea(area)}/><span><strong>{SPACE_LABELS[area]}</strong>{area==="bathroom" && <small>With a bath or shower</small>}{area==="half_bath" && <small>Toilet and sink only</small>}</span></label>})}</div></fieldset>
      <details className="family-v2__hint"><summary>Add home type and levels (optional)</summary><div className="home-fields"><label>Type of home<select value={p.homeType} onChange={e=>api.patchHomeProfile({homeType:e.target.value as typeof p.homeType})}><option value="">Leave blank</option>{Object.entries(HOME_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Levels in the home<select value={p.levels} onChange={e=>api.patchHomeProfile({levels:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div><p>More levels will not add more rooms or stairs automatically.</p></details>
      <p className="space-selection-count" role="status">{used.length?`${used.length} ${used.length===1?"space":"spaces"} selected`:"Select at least one space to continue."}</p>{api.state.spaces.length>0 && <p className="space-selection-note">Saved answers are kept if you leave a space out.</p>}
      <div className="family-v2__actions"><button type="submit" disabled={!used.length} className="family-v2__button family-v2__button--primary">Continue →</button><button type="button" className="family-v2__back" onClick={()=>go("routine")}>Back to daily life</button></div>
    </form>
  </section></main>;
}
