"use client";
import type {CaseApi} from "@/lib/case-store";
import {EMPTY_PROFILE,HOME_TYPES,USED_AREAS} from "@/domain/home-profile";
import {emptyDynamicContext,type ContextPlace,type DynamicContext} from "@/domain/dynamic-context";
import {createUuid} from "@/lib/ids";
const labels:Record<keyof typeof USED_AREAS,string>={bedroom:"Bedroom",bathroom:"Bathroom",half_bath:"Toilet / half bath",living:"Living room",kitchen:"Kitchen",entry:"Entrance",stairway:"Steps or stairs",exterior:"Outside"};
export function HomeLayoutFields({api}:{api:CaseApi}){
 const p=api.state.homeProfile??EMPTY_PROFILE,d=p.dynamic??emptyDynamicContext(),l=d.layout;
 const save=(patch:Partial<DynamicContext>)=>api.patchHomeProfile({dynamic:{...d,...patch}});
 const layout=(patch:Partial<DynamicContext["layout"]>)=>save({layout:{...l,...patch,confirmed:false}});
 const place=(id:string,patch:Partial<ContextPlace>)=>save({places:d.places.map(s=>s.id===id?{...s,...patch}:s),layout:{...l,confirmed:false}});
 function add(area:keyof typeof USED_AREAS){
  const type=area==="half_bath"?"bathroom":area,kind=area==="half_bath"?"half_bath" as const:undefined;
  const earlier=api.state.spaces.find(s=>s.type===type&&s.familyKind===kind&&!d.places.some(p=>p.id===s.id));
  const n=d.places.filter(s=>s.type===type&&s.familyKind===kind).length+1;
  const s:ContextPlace={id:earlier?.id??createUuid(),type,label:earlier?.label??`${labels[area]}${n>1?` ${n}`:""}`,level:earlier?.level??null,...(kind?{familyKind:kind}:{})};
  api.patchHomeProfile({usedAreas:[...new Set([...(p.usedAreas??[]),area])],dynamic:{...d,places:[...d.places,s],layout:{...l,confirmed:false}}});
 }
 function toggle(area:keyof typeof USED_AREAS){
  const matches=(s:ContextPlace)=>s.type===(area==="half_bath"?"bathroom":area)&&s.familyKind===(area==="half_bath"?"half_bath":undefined);
  if(!d.places.some(matches)){add(area);return}
  api.patchHomeProfile({usedAreas:(p.usedAreas??[]).filter(a=>a!==area),dynamic:{...d,places:d.places.filter(s=>!matches(s)),layout:{...l,confirmed:false}}});
 }
 return <div className="dynamic-layout">
  <section><h2>A few facts about the home</h2><p>Count the whole home here. Below, choose only the places used most or that you want to use again. Leave anything you do not know blank.</p>
   <div className="home-fields"><label>Type of home<select value={p.homeType} onChange={e=>api.patchHomeProfile({homeType:e.target.value as typeof p.homeType,dynamic:{...d,layout:{...l,confirmed:false}}})}><option value="">Not provided</option>{Object.entries(HOME_TYPES).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
    {([["bedrooms","Bedrooms"],["fullBaths","Bathrooms with bath or shower"],["halfBaths","Toilet-only / half baths"],["levels","Levels, including basement"],["occupants","Usual number of occupants"]] as const).map(([key,label])=><label key={key}>{label}<input type="number" min={key==="levels"?1:0} max={key==="levels"?4:30} value={l[key]??""} placeholder="Not sure / leave blank" onChange={e=>{const n=e.target.value===""?null:Number(e.target.value);if(n===null||Number.isInteger(n)&&n>=(key==="levels"?1:0)&&n<=(key==="levels"?4:30))layout({[key]:n})}}/></label>)}
    <label>Who usually lives here?<select value={p.livingWith} onChange={e=>api.patchHomeProfile({livingWith:e.target.value as typeof p.livingWith,dynamic:{...d,layout:{...l,confirmed:false}}})}><option value="">Not provided</option><option value="alone">Lives alone</option><option value="others">Lives with others</option><option value="varies">It varies</option><option value="prefer_not">Prefer not to answer</option></select></label>
    <label>Access at the usual entrance<select value={l.entranceSteps} onChange={e=>layout({entranceSteps:e.target.value as typeof l.entranceSteps})}><option value="">Not provided</option><option value="none">Level access, no steps or ramp</option><option value="steps">Steps</option><option value="ramp">Ramp</option><option value="both">Steps and ramp</option><option value="unsure">Not sure</option></select></label></div>
  </section>
  <section><h2>Choose your spaces</h2><p>Include a place you have stopped using if you want help using it again. Counts do not add rooms automatically.</p>
   <fieldset className="space-selection"><legend className="visually-hidden">Spaces to include</legend><div>{Object.keys(USED_AREAS).map(key=>{const area=key as keyof typeof USED_AREAS;return <label key={area}><input type="checkbox" checked={d.places.some(s=>s.type===(area==="half_bath"?"bathroom":area)&&s.familyKind===(area==="half_bath"?"half_bath":undefined))} onChange={()=>toggle(area)}/><span><strong>{labels[area]}</strong>{area==="bathroom"&&<small>With a bath or shower</small>}{area==="half_bath"&&<small>Toilet and sink only</small>}</span></label>})}</div></fieldset>
   <p className="space-selection-count" role="status">{d.places.length?`${d.places.length} spaces selected`:"Select at least one space to continue."}</p>
   {d.places.map(s=><div className="context-place" key={s.id}><label>Place name<input maxLength={80} value={s.label} onChange={e=>{if(e.target.value.trim())place(s.id,{label:e.target.value})}}/></label><label>Level<select value={s.level??""} onChange={e=>place(s.id,{level:e.target.value?Number(e.target.value):null})}><option value="">Not provided</option>{[1,2,3,4].map(n=><option key={n} value={n}>Level {n}</option>)}</select></label><button type="button" className="family-v2__back" onClick={()=>save({places:d.places.filter(p=>p.id!==s.id),layout:{...l,confirmed:false}})}>Leave this place out</button></div>)}
   {!!d.places.length&&<details><summary>Add another place of the same kind</summary><div className="context-add">{[...new Set(d.places.map(s=>s.familyKind==="half_bath"?"half_bath":s.type))].filter((a):a is keyof typeof USED_AREAS=>a in USED_AREAS).map(a=><button type="button" className="family-v2__back" key={a} onClick={()=>{if(d.places.length<30)add(a)}}>Add another {labels[a].toLowerCase()}</button>)}</div></details>}
   <p className="family-v2__fine-print">Earlier answers are retained if a place is left out. Do not put names or addresses in place labels.</p>
  </section>
  {!!d.places.length&&<section><h2>Connect the everyday places</h2><p>This lets us follow the actual journey, rather than repeat questions about the layout.</p><div className="home-fields">
   {([["sleepId","Usual sleeping place","bedroom"],["toiletId","Usual toilet","bathroom"],["bathingId","Bathing or showering place","bathroom"],["nightToiletId","Nighttime toilet, if different","bathroom"]] as const).map(([key,label,type])=><label key={key}>{label}<select value={l[key]} onChange={e=>layout({[key]:e.target.value})}><option value="">Not provided / elsewhere</option>{d.places.filter(s=>s.type===type||key==="sleepId"&&s.type==="living").filter(s=>key!=="bathingId"||s.familyKind!=="half_bath").map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>)}
   <label>Bathing setup<select value={l.fixture} onChange={e=>layout({fixture:e.target.value as typeof l.fixture})}><option value="">Not provided</option><option value="shower">Shower</option><option value="tub">Tub</option><option value="both">Both</option><option value="elsewhere">Bathe elsewhere</option><option value="unsure">Not sure</option></select></label></div>
   <label className="layout-confirm"><input type="checkbox" checked={l.confirmed} onChange={e=>save({layout:{...l,confirmed:e.target.checked}})}/> These details reflect what I know; blank details remain unknown.</label>
  </section>}
 </div>;
}
