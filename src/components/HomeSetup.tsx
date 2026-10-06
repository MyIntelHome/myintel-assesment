"use client";
import {useEffect,useRef} from "react";
import {HomeRoutineConversation} from "./HomeRoutineConversation";
import {HomeLayoutFields} from "./HomeLayoutFields";
import type {CaseApi} from "@/lib/case-store";
export function HomeSetup({api,step}:{api:CaseApi;step:"routine"|"home"}){
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus()},[step]);
 if(step==="routine")return <HomeRoutineConversation api={api}/>;
 const places=api.state.homeProfile?.dynamic?.places??[];
 return <main className="family-v2 home-setup"><div className="home-stage" aria-label="Home check stages"><span className="current">Your home</span><span>Everyday life</span><span>Your check</span><span>Next steps</span></div><section className="family-v2__card"><p className="family-v2__eyebrow">Your home</p><h1 ref={heading} tabIndex={-1}>Let's understand the home first.</h1><form onSubmit={e=>{e.preventDefault();if(!places.length)return;if(api.state.spaces.length)api.prepareHomeRooms();else api.setFamilyPosition({phase:"routine",roomIndex:0,contextQuestionId:"personal"})}}><HomeLayoutFields api={api}/><div className="family-v2__actions"><button type="submit" disabled={!places.length} className="family-v2__button family-v2__button--primary">{api.state.spaces.length?"Update my spaces":"Continue to everyday life"}</button><button type="button" className="family-v2__back" onClick={()=>api.setFamilyPosition({phase:"routine",roomIndex:0,contextQuestionId:"goal"})}>Back to my goal</button></div></form></section></main>;
}
