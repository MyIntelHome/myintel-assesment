"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {FlowStages} from "./Brand";
/** A reading pause controlled by the reader, never a simulated network wait. */
export function HomeSectionPause({title,detail,button="Continue",art,stage,eyebrow,children}:{title:string;detail:string;button?:string;art?:ReactNode;stage?:0|1|2|3|4;eyebrow?:string;children:ReactNode}){
 const [ready,setReady]=useState(false),container=useRef<HTMLDivElement>(null);
 useEffect(()=>{container.current?.querySelector<HTMLElement>("h1")?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})},[ready]);
 return <div ref={container}>{ready?<div className="home-content-enter">{children}</div>:<main className="family-v2 home-reading-pause">{stage!==undefined&&<FlowStages current={stage}/>}<section className="family-v2__card intro-card"><div className="intro-card__art" aria-hidden="true">{art??<div className="home-transition-mark"><i/><i/><i/></div>}</div>{eyebrow&&<p className="family-v2__eyebrow">{eyebrow}</p>}<h1 tabIndex={-1}>{title}</h1><p className="family-v2__lead">{detail}</p><button type="button" className="family-v2__button family-v2__button--primary" onClick={()=>setReady(true)}>{button}</button><p className="family-v2__fine-print">Take your time. Continue when you’re ready.</p></section></main>}</div>;
}
