"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import "./billing.css";

export type ProfessionalBillingStatus={enabled:boolean;checkoutEnabled:boolean;demoAvailable:boolean;remaining:number;subscriptionActive:boolean;hasBillingAccount?:boolean;hasSubscription?:boolean;reviewRequired?:boolean;renewalAt:string|null;allocations:{case_id:string;state:"reserved"|"completed"}[]};
export type PurchaseKind="single"|"subscription"|"extra";
export function canStartProfessionalCase(status:ProfessionalBillingStatus|null){
  if(!status)return false;
  if(!status.enabled)return true;
  return status.remaining>0 || (status.demoAvailable && !status.allocations.some(a=>a.state==="reserved"));
}
export function canOpenProfessionalCase(status:ProfessionalBillingStatus|null,caseId:string,hasReport:boolean){
  return hasReport || !!status && (!status.enabled || status.allocations.some(a=>a.case_id===caseId) || canStartProfessionalCase(status));
}
export function useProfessionalBilling(){
  const [status,setStatus]=useState<ProfessionalBillingStatus|null>(null),[error,setError]=useState("");
  const generation=useRef(0);
  const refresh=useCallback(async()=>{const request=++generation.current;try{
    const response=await fetch("/api/professional/billing",{cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.error??"We couldn’t check your plan. Please retry.");
    if(typeof data.enabled!=="boolean" || typeof data.checkoutEnabled!=="boolean" || typeof data.demoAvailable!=="boolean" || typeof data.remaining!=="number" || typeof data.subscriptionActive!=="boolean" || !Array.isArray(data.allocations))throw Error("We couldn’t confirm your assessment plan. Please retry.");
    if(request===generation.current){setStatus(data);setError("")}
  }catch(e){if(request===generation.current){setStatus(null);setError((e as Error).message)}}},[]);
  useEffect(()=>{void refresh();const focus=()=>void refresh();window.addEventListener("focus",focus);return()=>{generation.current++;window.removeEventListener("focus",focus)}},[refresh]);
  return {status,error,refresh};
}
export function ProfessionalPricing({status,approved=false,onPurchase,busy=false}:{status?:ProfessionalBillingStatus|null;approved?:boolean;onPurchase?:(kind:PurchaseKind)=>void;busy?:boolean}){
  const available=approved && status?.enabled && status.checkoutEnabled;
  return <section className="professional-pricing account-card"><p className="eyebrow">PROFESSIONAL PRICING</p><h2>A clear price for each assessment</h2><p>{status?.enabled?"One free demo assessment per approved professional account. Your demo is used when you first finalize its report. Keep one free draft at a time.":"Planned offer: one free demo assessment per approved professional account, used on first report finalization, with one free draft at a time. Demo availability is confirmed in your approved workspace."}</p><div className="professional-price-grid"><section><h3>Single assessment</h3><p><strong>$19</strong> / credit</p><p>Prepay for one additional assessment.</p>{approved && <button className="app-secondary" disabled={!available || busy} onClick={()=>onPurchase?.("single")}>Buy one credit · $19</button>}</section><section><h3>Monthly plan</h3><p><strong>$49</strong> / month</p><p>Five assessment credits each billing period. Extra prepaid credits cost $10 each while subscribed. No automatic overage charges.</p>{approved && <button className="app-primary" disabled={!available || busy || status?.hasSubscription || status?.subscriptionActive} onClick={()=>onPurchase?.("subscription")}>{status?.subscriptionActive?"Monthly plan active":"Subscribe · $49/month"}</button>}{approved && status?.subscriptionActive && <button className="app-secondary" disabled={!available || busy} onClick={()=>onPurchase?.("extra")}>Buy extra credit · $10</button>}</section></div><p className="account-note">After your demo, prepay before starting more assessments. Existing reports remain accessible and can be corrected without another charge. Payments open in secure hosted checkout.</p>{!approved && <p className="account-note">Professional approval is required before purchasing. These prices do not grant access to clinical records.</p>}{approved && !available && <p role="status">Payments are currently unavailable.{status?.enabled===false?" Pricing is informational; billing and the free demo offer are not enabled for this workspace.":""}</p>}</section>;
}
export function ProfessionalBilling({status,error,onRefresh}:{status:ProfessionalBillingStatus|null;error:string;onRefresh:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[paymentError,setPaymentError]=useState("");
  const keys=useRef<Partial<Record<PurchaseKind,string>>>({});
  async function open(kind:PurchaseKind|"portal"){
    if(busy || !status?.enabled || !status.checkoutEnabled)return;
    setBusy(true);setPaymentError("");
    try{
      if(kind!=="portal")keys.current[kind]??=crypto.randomUUID();
      const response=await fetch(`/api/professional/billing/${kind==="portal"?"portal":"checkout"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="portal"?{}:{kind,idempotencyKey:keys.current[kind]})});
      const data=await response.json();if(!response.ok)throw Error(data.error??"Checkout couldn’t open. Please retry.");
      const url=new URL(data.url);if(url.protocol!=="https:" || !["checkout.stripe.com","billing.stripe.com"].includes(url.hostname))throw Error("Checkout returned an invalid address.");
      window.location.assign(url.href);
    }catch(e){setPaymentError((e as Error).message);setBusy(false)}
  }
  return <><p className="eyebrow">PLAN & BILLING</p><h1>Your assessment plan</h1>{status?.enabled && <section className="account-card"><h2>{status.reviewRequired?"Billing review needed":status.subscriptionActive?"Monthly plan active":status.hasSubscription?"Subscription payment needs attention":"Pay as you go"}</h2><p>{status.remaining} assessment {status.remaining===1?"credit":"credits"} available.</p><p>{status.demoAvailable?status.allocations.some(a=>a.state==="reserved")?"Your free demo draft is in progress. Continue it from Assessments.":"Your free demo is available. Start it from Assessments.":"Your free demo is no longer available for a new assessment. Continue any reserved draft from Assessments."}</p>{status.renewalAt && <p>Current billing period ends {new Date(status.renewalAt).toLocaleDateString()}.</p>}{status.hasBillingAccount && <button className="app-secondary" disabled={busy || !status.checkoutEnabled} onClick={()=>void open("portal")}>Manage subscription & invoices</button>}</section>}{(error || paymentError) && <p role="alert">{paymentError || error}</p>}<ProfessionalPricing status={status} approved onPurchase={kind=>void open(kind)} busy={busy}/><button className="app-secondary" disabled={busy} onClick={()=>void onRefresh()}>Refresh plan</button>{busy && <p role="status">Opening secure checkout…</p>}</>;
}
export function ProfessionalBillingBanner({status,error,onPlan,onRefresh}:{status:ProfessionalBillingStatus|null;error:string;onPlan:()=>void;onRefresh:()=>Promise<void>}){
  return <aside className="professional-billing-banner no-print" aria-label="Assessment plan"><div>{error?<><strong>Plan status unavailable</strong><p role="alert">{error} Saved reports remain accessible.</p></>:!status?<span role="status">Checking your assessment plan…</span>:!status.enabled?<><strong>Professional pricing</strong><p>Billing and the free demo offer are not enabled. Payments are unavailable.</p></>:<><strong>{status.demoAvailable?status.allocations.some(a=>a.state==="reserved")?"Free demo draft in progress":"One free demo available":"Free demo unavailable"} · {status.remaining} assessment {status.remaining===1?"credit":"credits"} available</strong><p>{canStartProfessionalCase(status)?"Your plan is ready for an assessment.":"Continue a reserved draft, or prepay for another assessment."} Existing reports and corrections remain available.</p></>}</div><button className="app-secondary" onClick={onPlan}>Plan & billing</button>{error && <button className="app-secondary" onClick={()=>void onRefresh()}>Retry plan check</button>}</aside>;
}
