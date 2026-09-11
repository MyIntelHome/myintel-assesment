"use client";
import {useEffect,useRef} from "react";
import {HomeRoutineConversation} from "./HomeRoutineConversation";
import type {CaseApi} from "@/lib/case-store";
import {EMPTY_PROFILE,HOME_TYPES,USED_AREAS} from "@/domain/home-profile";
export function HomeSetup({api,step}:{api:CaseApi;step:"routine"|"home"}){
  const p=api.state.homeProfile??EMPTY_PROFILE,heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus()},[step]);
  const used=p.usedAreas??[];
  const chooseArea=(area:keyof typeof USED_AREAS)=>api.patchHomeProfile({usedAreas:used.includes(area)?used.filter(a=>a!==area):[...used,area]});
  const go=(phase:"routine"|"home"|"rooms")=>api.setFamilyPosition({phase,roomIndex:0,questionIndex:0});
  if(step==="routine")return <HomeRoutineConversation api={api} onNext={()=>go("home")}/>;
  return <main className="family-v2 home-setup"><div className="home-stage" aria-label="Home check stages"><span className={"done"}>1 · Daily life</span><span className={"current"}>2 · Your home</span><span>3 · Room check</span><span>4 · Next steps</span></div><section className="family-v2__card">
    <figure className="home-editorial-photo"><img src="/home-interior.webp" alt="A lived-in room with everyday seating and natural light" width={1000} height={863}/><figcaption>Your everyday spaces, at your pace.</figcaption></figure>
    <p className="family-v2__eyebrow">Prepare your room checklist</p>
    <h1 ref={heading} tabIndex={-1}>Which spaces are part of a normal day?</h1>
    <p className="family-v2__lead">Choose the spaces used regularly, or a space you want help using again.</p>
    <form onSubmit={e=>{e.preventDefault();if(used.length)api.prepareHomeRooms()}}>
      <fieldset className="routine-choices"><legend>Which spaces do you want to check?</legend><p>Select the spaces used regularly, or a space you want help using again. Start with one of each; add another only if it needs a separate look.</p><div>{Object.entries(USED_AREAS).map(([area,label])=><button type="button" key={area} aria-pressed={used.includes(area as keyof typeof USED_AREAS)} onClick={()=>chooseArea(area as keyof typeof USED_AREAS)}><span aria-hidden="true">{used.includes(area as keyof typeof USED_AREAS)?"✓":"+"}</span>{p.forWhom==="self"?label:label.replace(" I "," they ")}</button>)}</div></fieldset>
      <details className="family-v2__hint"><summary>Add home type and levels (optional)</summary><div className="home-fields"><label>Type of home<select value={p.homeType} onChange={e=>api.patchHomeProfile({homeType:e.target.value as typeof p.homeType})}><option value="">Leave blank</option>{Object.entries(HOME_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Levels in the home<select value={p.levels} onChange={e=>api.patchHomeProfile({levels:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div><p>More levels will not add more rooms or stairs automatically.</p></details>
      <div className="home-plan-preview"><strong>{used.length?used.length+" everyday spaces selected":"Choose at least one space"}</strong><p>We’ll guide you through one space at a time. You can pause or see your next steps before finishing every question.</p>{api.state.spaces.length>0 && <p>Rooms outside this selection will be set aside, with their answers kept. You can bring them back from your checklist.</p>}</div>
      <div className="family-v2__actions"><button type="submit" disabled={!used.length} className="family-v2__button family-v2__button--primary">Prepare my everyday spaces →</button><button type="button" className="family-v2__button family-v2__button--secondary" onClick={()=>go("routine")}>Back</button><button type="button" className="family-v2__skip" onClick={()=>go("rooms")}>Edit my checklist directly</button></div>
    </form>
  </section></main>;
}
