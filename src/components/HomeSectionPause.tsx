"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
/** A reading pause controlled by the reader, never a simulated network wait. */
export function HomeSectionPause({title,detail,button="Continue",children}:{title:string;detail:string;button?:string;children:ReactNode}){
 const [ready,setReady]=useState(false),container=useRef<HTMLDivElement>(null);
 useEffect(()=>{container.current?.querySelector<HTMLElement>("h1")?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})},[ready]);
 return <div ref={container}>{ready?<div className="home-content-enter">{children}</div>:<main className="family-v2 home-reading-pause"><section className="family-v2__card"><div className="home-transition-mark" aria-hidden="true"><i/><i/><i/></div><h1 tabIndex={-1}>{title}</h1><p>{detail}</p><button type="button" className="family-v2__button family-v2__button--primary" onClick={()=>setReady(true)}>{button}</button><p className="family-v2__fine-print">Take your time. Continue when you’re ready.</p></section></main>}</div>;
}
