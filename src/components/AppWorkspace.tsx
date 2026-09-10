"use client";
import {useEffect,useState} from "react";
import {useCase,type Audience,type CaseState} from "@/lib/case-store";
import {familyProgress} from "@/domain/family";
import {familyTemplateFor} from "@/domain/home-profile";
import {buildCaseView} from "@/lib/selectors";
import {FamilyFlow} from "./FamilyFlow";
import {ClinicalWorkspace} from "./ClinicalWorkspace";
import ProfessionalHelp from "./ProfessionalHelp";
import {RequestCenter} from "./RequestCenter";
import {Operations} from "./Operations";
import {SERVICES,type AccountUser,type Provider} from "@/domain/services";

type View="home"|"assessments"|"workspace"|"help"|"requests"|"account"|"operations";
const views:View[]=["home","assessments","workspace","help","requests","account","operations"];
function currentView():View {const v=new URLSearchParams(window.location.search).get("view");return views.includes(v as View)?v as View:"home"}
export default function AppWorkspace(){
  const [session,setSession]=useState<{user:AccountUser|null;paymentsEnabled:boolean}|null>(null);
  const [error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let live=true;setError(false);fetch("/api/account",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(live)setSession(data)}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[attempt]);
  if(error && !session)return <main className="connection-state"><span className="app-mark">MI</span><h1>Let’s reconnect your account</h1><p>Your saved work has not changed. Try again, or use a temporary home check on this device.</p><button className="app-primary" onClick={()=>setAttempt(n=>n+1)}>Try again</button><button className="app-secondary" onClick={()=>setSession({user:null,paymentsEnabled:false})}>Use a device draft</button></main>;
  if(!session)return <main className="connection-state" role="status"><span className="app-mark">MI</span><p>Opening MyIntel…</p></main>;
  return <Workspace key={session.user?.id??"guest"} user={session.user} paymentsEnabled={session.paymentsEnabled}/>;
}
function Workspace({user,paymentsEnabled}:{user:AccountUser|null;paymentsEnabled:boolean}){
  const api=useCase(user?{userId:user.id}:undefined);
  const [view,setView]=useState<View>("home"),[helpService,setHelpService]=useState<string>(),[providers,setProviders]=useState<Provider[]>([]);
  useEffect(()=>{setView(currentView());const pop=()=>setView(currentView());window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop)},[]);
  useEffect(()=>{if(user)fetch("/api/providers").then(r=>r.ok?r.json():{providers:[]}).then(d=>setProviders(d.providers??[])).catch(()=>{})},[user]);
  function navigate(next:View){setView(next);window.history.pushState(null,"","/?view="+next);window.scrollTo({top:0})}
  function begin(audience:Audience){if(api.saveState!=="saved")return;if(api.state.audience!=="unchosen" || api.state.spaces.length)api.reset(audience);else api.setAudience(audience);navigate("workspace")}
  function requestHelp(service?:string){setHelpService(service);navigate("help")}
  const labelCase=(c:CaseState)=>c.reference || c.spaces.map(s=>s.label).slice(0,2).join(" + ") || (c.audience==="clinician"?"Clinical assessment":"Home check");
  const saved=api.cases.filter(c=>c.audience!=="unchosen");
  const ready=api.hydrated && api.saveState==="saved" && !api.storageConflict;
  useEffect(()=>{if(view==="workspace" && ready && api.state.audience==="unchosen")api.setAudience("family")},[view,ready,api.state.audience,api.setAudience]);
  useEffect(()=>{document.getElementById("app-content")?.focus({preventScroll:true})},[view]);
  const saveLabel=api.storageConflict?"Save paused":api.saveState==="error"?"Changes not saved":api.saveState==="saving"?"Saving…":"Saved to "+(user?"your account":"this device");
  return <div className="app-shell">
    <a className="skip-link" href="#app-content">Skip to content</a>
    <header className="app-header no-print"><button className="app-brand" onClick={()=>navigate("home")} aria-label="MyIntel home"><span className="app-mark">MI</span><span>MyIntel<small>Live well at home</small></span></button>
      <nav className="app-nav" aria-label="Main navigation">{([["home","Overview"],["assessments","My assessments"],["help","Find help"],["requests","My requests"]] as const).map(([id,label])=><button key={id} className={view===id?"active":""} aria-current={view===id?"page":undefined} onClick={()=>navigate(id)}>{label}</button>)}</nav>
      <button className="account-button" onClick={()=>navigate("account")}><span className="avatar" aria-hidden="true">{user?.name?.slice(0,1).toUpperCase()??"○"}</span>{user?"My account":"Sign in"}</button>
    </header>
    <div className="app-status no-print"><span>Private review · use example information</span><span role="status">{api.hydrated?saveLabel:"Opening your assessments…"}</span></div>
    <div id="app-content" tabIndex={-1}>
    {api.storageConflict && <div className="app-alert" role="alert">A newer version exists. Saving is paused to protect it. Download your current draft before reloading.<button onClick={()=>{const a=document.createElement("a");const url=URL.createObjectURL(new Blob([JSON.stringify(api.state,null,2)],{type:"application/json"}));a.href=url;a.download="MyIntel-unsaved-draft.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Download this draft</button></div>}
    {api.saveState==="error" && !api.storageConflict && !api.storageProblem && <div className="app-alert" role="alert">Your latest changes have not been saved. Keep this page open.<button onClick={api.retrySave}>Retry saving</button></div>}
    {api.storageProblem?<main className="connection-state"><h1>We couldn’t open your saved work</h1><p>{api.storageProblem}</p><button className="app-primary" onClick={()=>window.location.reload()}>Try again</button></main>:!api.hydrated?<main className="connection-state" role="status">Loading your assessments…</main>:<>
    {(view==="home" || view==="assessments") && <main className="overview">
      <div className="page-heading"><div><p className="eyebrow">{view==="home"?"A clearer next step":"Your saved work"}</p><h1>{view==="home"?"More confidence at home.":"My assessments"}</h1><p>{view==="home"?"Understand what needs attention. Make a plan. Get the right help.":"Pick up where you left off, or start a new assessment."}</p></div>{user?.isAdmin && <button className="app-secondary" onClick={()=>navigate("operations")}>MyIntel operations</button>}</div>
      {view==="home" && <div className="path-grid"><section className="path-card family-path"><span className="path-label">FOR YOU & YOUR FAMILY</span><h2>A home check,<br/>one clear step at a time.</h2><p>Choose your rooms. Answer simple questions. Get a practical starting point you can understand.</p><button className="app-primary" disabled={!ready} onClick={()=>begin("family")}>Start a home check <span aria-hidden="true">→</span></button><span className="path-note">At your pace · No payment to see your results</span></section>
      <section className="path-card clinical-path"><span className="path-label">FOR OCCUPATIONAL THERAPISTS</span><h2>Your expertise.<br/>Less report admin.</h2><p>Capture observations, connect findings to actions, and prepare a report with a preserved version history.</p><button className="app-secondary" disabled={!ready} onClick={()=>begin("clinician")}>Open clinical workspace <span aria-hidden="true">→</span></button><span className="path-note">Clinician-led · Vendor-neutral recommendations</span></section></div>}
      <section className="recent-section"><div className="section-heading"><h2>{view==="home"?"Pick up where you left off":"Saved assessments"}</h2>{view==="assessments" && <div className="inline-actions"><button className="app-secondary" disabled={!ready} onClick={()=>begin("family")}>New home check</button><button className="app-secondary" disabled={!ready} onClick={()=>begin("clinician")}>New clinical assessment</button></div>}</div>
      {saved.length===0?<div className="empty-work"><strong>Your next step starts here.</strong><p>Once you begin, your assessments will appear here so you can return to them.</p></div>:<div className="case-grid">{saved.slice().reverse().slice(0,view==="home"?4:100).map(c=>{const progress=c.audience==="family"?familyProgress(c.spaces.map(s=>({spaceId:s.id,template:familyTemplateFor(s)})),c.familyAnswers).percent:buildCaseView(c).completeness.percent;return <button disabled={!ready} key={c.id} className="case-card" onClick={()=>{api.openCase(c.id);navigate("workspace")}}><span className="case-type">{c.audience==="family"?"Home check":"Clinical assessment"}</span><strong>{labelCase(c)}</strong><span>{c.signoff.signedAt?"Signed · "+c.reportVersions.length+" report version(s)":progress+"% of questions completed"}</span><span className="case-progress" aria-hidden="true"><i style={{width:progress+"%"}}/></span><span className="case-return">{c.signoff.signedAt?"View report":"Continue assessment"} →</span></button>})}</div>}
      </section>
      {view==="home" && <section className="help-strip"><div><p className="eyebrow">YOU DON’T HAVE TO WORK IT OUT ALONE</p><h2>Need someone to look at the home with you?</h2><p>Request professional help now, even if you haven’t completed a home check.</p></div><button className="app-primary" onClick={()=>requestHelp("professional_assessment")}>Request an assessment</button></section>}
    </main>}
    {view==="workspace" && <><div className="workspace-breadcrumb no-print"><button onClick={()=>navigate("assessments")}>← My assessments</button><span>{api.state.audience==="clinician"?"Clinical workspace":"Home check"}</span><button onClick={()=>requestHelp()}>Get professional help</button></div>{api.state.audience==="clinician"?<ClinicalWorkspace key={api.state.id} api={api}/>:<FamilyFlow key={api.state.id} api={api} onRequestHelp={requestHelp}/>}</>}
    {view==="help" && <><ProfessionalHelp key={helpService??"any"} user={user} initialService={helpService} homeCaseId={api.state.audience==="family" && api.state.spaces.length>0 && ready && user?api.state.id:undefined} onBack={()=>navigate("home")} onRequests={()=>navigate("requests")}/>{providers.length>0 && <section className="overview"><h2>Professionals in the MyIntel network</h2><p>Availability and fit are confirmed after your request.</p><div className="case-grid">{providers.map(p=><article className="provider-card" key={p.id}><span className="case-type">{SERVICES[p.service].title}</span><h3>{p.name}</h3><p>{p.credentials}</p><p>{p.area}</p><span className="verified-label">Reviewed by MyIntel</span></article>)}</div></section>}</>}
    {view==="requests" && <RequestCenter user={user} paymentsEnabled={paymentsEnabled} onNew={()=>requestHelp()}/>}
    {view==="operations" && (user?.isAdmin?<Operations/>:<main className="connection-state"><h1>MyIntel staff access required</h1><button className="app-primary" onClick={()=>navigate("home")}>Back to overview</button></main>)}
    {view==="account" && <main className="account-page"><p className="eyebrow">YOUR MYINTEL ACCOUNT</p><h1>{user?"Your work, ready when you are.":"Keep your next steps together."}</h1>{user?<><section className="account-card"><span className="avatar large">{user.name.slice(0,1).toUpperCase()}</span><div><h2>{user.name}</h2><p>{user.email}</p><span>Signed in with ChatGPT</span></div></section><div className="account-grid"><section className="account-card"><h2>Assessments & requests</h2><p>Your account saves your assessments and professional requests for your next visit. Your assessments are private to this account; MyIntel staff can review service requests.</p><button className="app-secondary" onClick={()=>navigate("assessments")}>View my assessments</button></section><section className="account-card"><h2>Earlier device drafts</h2><p>Copy drafts from the previous version in this browser into your account. Only import records you are authorized to manage.</p><button className="app-secondary" disabled={!ready} onClick={()=>{api.importLocal();navigate("assessments")}}>Import device drafts</button></section></div><p className="account-note">This private review uses ChatGPT sign-in. Family-facing sign-in options and clinical data agreements must be finalized before a public launch.</p>{ready?<a className="app-secondary signout" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>:<p>Wait for your latest changes to save before signing out.</p>}</>:<section className="account-card"><h2>Sign in to save to your account</h2><p>Return to your assessments and track requests for professional help. A home check does not require sign-in to show your results.</p><a className="app-primary" href="/signin-with-chatgpt?return_to=%2F%3Fview%3Daccount" target="_top">Continue with ChatGPT</a><p className="account-note">Already started on this device? You can import your draft after signing in.</p></section>}</main>}
    </>}
    </div><footer className="app-footer no-print"><span>MyIntel · A practical path to living well at home</span><button onClick={()=>navigate("help")}>Need help?</button></footer>
  </div>;
}
