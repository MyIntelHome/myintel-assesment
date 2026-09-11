"use client";
import {useEffect,useRef,useState} from "react";
import type {CaseApi} from "@/lib/case-store";
import {EMPTY_PROFILE,GOALS,HELP_STYLE,ROUTINES,type HomeProfile} from "@/domain/home-profile";
const prompts=[
 {key:"forWhom",title:"Who are we checking the home for?",hint:"This helps us use the right wording as we go.",options:{self:"Myself",family:"A family member",support:"Someone I support"}},
 {key:"livingWith",title:"Who lives in the home?",hint:"Think about a normal week.",options:{alone:"The person lives alone",others:"The person lives with others",varies:"It varies",prefer_not:"Prefer not to say"}},
 {key:"mobility",title:"What helps with getting around?",hint:"Choose what is usually used, indoors or out.",options:{none:"No walking aid",cane:"Cane",walker:"Walker",wheelchair:"Wheelchair",varies:"It varies / another aid",prefer_not:"Prefer not to say"}},
 {key:"goal",title:"What matters most right now?",hint:"Choose the closest fit. There is no right or wrong answer.",options:GOALS},
 {key:"routines",title:"Which parts of the day should we keep in mind?",hint:"You can choose more than one, or move on.",options:ROUTINES},
 {key:"helpReach",title:"Could help be reached if it were needed?",hint:"Think about the usual spaces and who could respond.",options:{yes:"Yes, there is a way to call and someone to respond",no:"No, there is a gap",unsure:"I'm not sure"}},
 {key:"helpStyle",title:"What kind of help would suit you?",hint:"Your answer helps shape the options at the end.",options:HELP_STYLE},
 {key:"technology",title:"Would you like to explore home technology?",hint:"There is no need to buy anything to use this check.",options:{interested:"Yes, if it solves a specific problem",help:"Maybe, with setup and ongoing help",no:"Not right now"}},
] as const;
export function HomeRoutineConversation({api,onNext}:{api:CaseApi;onNext:()=>void}){
 const [index,setIndex]=useState(0),heading=useRef<HTMLHeadingElement>(null),p=api.state.homeProfile??EMPTY_PROFILE;
 const prompt=prompts[index]!;
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})},[index]);
 const next=()=>index<prompts.length-1?setIndex(index+1):onNext();
 return <main className="family-v2 home-conversation"><section className="family-v2__card" key={index}><p className="family-v2__eyebrow">Daily life · {index+1} of {prompts.length} · Optional</p><h1 ref={heading} tabIndex={-1}>{prompt.title}</h1><p className="family-v2__lead">{prompt.hint}</p><div className="home-conversation-options" role="group" aria-label={prompt.title}>{Object.entries(prompt.options).map(([value,label])=>{const selected=prompt.key==="routines"?p.routines.includes(value as keyof typeof ROUTINES):p[prompt.key]===value;return <button type="button" key={value} aria-pressed={selected} onClick={()=>{if(prompt.key==="routines"){const routine=value as keyof typeof ROUTINES;api.patchHomeProfile({routines:selected?p.routines.filter(r=>r!==routine):[...p.routines,routine]})}else api.patchHomeProfile({[prompt.key]:value} as Partial<HomeProfile>)}}><span aria-hidden="true">{selected?"✓":"○"}</span>{label}</button>})}</div><div className="family-v2__actions"><button type="button" className="family-v2__button family-v2__button--primary" onClick={next}>{index===prompts.length-1?"Choose my spaces":"Continue"}</button>{index>0 && <button type="button" className="family-v2__back" onClick={()=>setIndex(index-1)}>Back</button>}</div><button type="button" className="family-v2__skip" onClick={onNext}>Go straight to my spaces</button></section></main>;
}
