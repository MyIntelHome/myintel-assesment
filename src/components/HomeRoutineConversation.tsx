"use client";
import {dailyLifeQuestions} from "@/domain/routine-questions";
import {useEffect,useRef,useState} from "react";
import type {CaseApi} from "@/lib/case-store";
import {EMPTY_PROFILE,ROUTINES,type HomeProfile} from "@/domain/home-profile";
export function HomeRoutineConversation({api,onNext}:{api:CaseApi;onNext:()=>void}){
 const [index,setIndex]=useState(0),[moreContext,setMoreContext]=useState(false),heading=useRef<HTMLHeadingElement>(null),p=api.state.homeProfile??EMPTY_PROFILE;
 const prompts=dailyLifeQuestions(p,moreContext);
 const prompt=prompts[Math.min(index,prompts.length-1)]!;
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})},[index,moreContext]);
 const next=()=>index<prompts.length-1?setIndex(index+1):onNext();
 const back=()=>{if(index>0){setIndex(index-1);return}setMoreContext(false);setIndex(dailyLifeQuestions(p).length-1)};
 return <main className="family-v2 home-conversation"><section className="family-v2__card" key={`${moreContext}-${index}`}><p className="family-v2__eyebrow">{moreContext?"More daily-life details":"Daily life"} · {index+1} of {prompts.length} · Optional</p><h1 ref={heading} tabIndex={-1}>{prompt.title}</h1><p className="family-v2__lead">{prompt.hint}</p><div className="home-conversation-options" role="group" aria-label={prompt.title}>{Object.entries(prompt.options).map(([value,label])=>{const selected=prompt.key==="routines"?p.routines.includes(value as keyof typeof ROUTINES):p[prompt.key]===value;return <button type="button" key={value} aria-pressed={selected} onClick={()=>{if(prompt.key==="routines"){const routine=value as keyof typeof ROUTINES;api.patchHomeProfile({routines:selected?p.routines.filter(r=>r!==routine):[...p.routines,routine]})}else api.patchHomeProfile({[prompt.key]:value} as Partial<HomeProfile>)}}><span aria-hidden="true">{selected?"✓":"○"}</span>{label}</button>})}</div><div className="family-v2__actions"><button type="button" className="family-v2__button family-v2__button--primary" onClick={next}>{index===prompts.length-1?"Choose my spaces":"Continue"}</button>{(index>0||moreContext) && <button type="button" className="family-v2__back" onClick={back}>Back</button>}</div>{!moreContext && index===prompts.length-1 && <button type="button" className="family-v2__skip" onClick={()=>{setMoreContext(true);setIndex(0)}}>Add more daily-life details (optional)</button>}<button type="button" className="family-v2__skip" onClick={onNext}>Go straight to my spaces</button></section></main>;
}
