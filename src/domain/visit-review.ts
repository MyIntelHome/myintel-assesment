import type {CaseState} from "@/lib/case-store";
import type {CaseView} from "@/lib/selectors";
import {templateFor} from "@/seed/templates";
import {STATUS_META} from "./status";
import {validatePlanItem} from "./case";
export interface VisitTask {id:string;title:string;detail:string;stage:"intake"|"assess"|"findings"|"plan";spaceId?:string;code?:string;inHome:boolean}
export function stableStringify(value:unknown):string{return JSON.stringify(value,(_key,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)}
/** Exact record context, not an attestation that every reported fact is true. */
export function visitContextSignature(state:Pick<CaseState,"homeProfile"|"intake"|"spaces">):string{return stableStringify({profile:state.homeProfile??null,intake:state.intake,spaces:state.spaces.map(s=>({id:s.id,type:s.type,label:s.label,level:s.level??null}))})}
export function visitReview(state:CaseState,view:CaseView){
 const tasks:VisitTask[]=[];let observed=0,unable=0,na=0;
 if(state.visit?.contextReviewed!==visitContextSignature(state))tasks.push({id:"context",title:"Review context and visit scope",detail:"Confirm the layout, activity locations, reported information and any gaps. Record limitations; reported answers are not observations.",stage:"intake",inHome:true});
 if(!state.spaces.length)tasks.push({id:"spaces",title:"Establish the spaces in this visit",detail:"No rooms or routes have been recorded.",stage:"assess",inHome:true});
 for(const space of state.spaces)for(const item of templateFor(space.type).items){
  const r=state.responses[space.id]?.[item.code],status=r?.status??"unknown",id=`${space.id}::${item.code}`;
  if(item.required){if(["pass","concern","critical"].includes(status))observed++;if(status==="unable_to_assess")unable++;if(status==="not_applicable")na++;}
  if((item.required||state.visit?.deferred.includes(id))&&status==="unknown")tasks.push({id,title:`${space.label}: ${item.prompt}`,detail:state.visit?.deferred.includes(id)?"Marked return to this; no assessment decision yet.":"Required check has not been assessed.",stage:"assess",spaceId:space.id,code:item.code,inHome:true});
  if(STATUS_META[status].requiresReason&&!r?.reason?.trim())tasks.push({id:`reason:${id}`,title:`Explain ${space.label}: ${item.prompt}`,detail:"An explicit reason is needed for this exclusion or limitation.",stage:"assess",spaceId:space.id,code:item.code,inHome:true});
  if(status==="unable_to_assess"&&r?.reason?.trim())tasks.push({id:`unable:${id}`,title:`Unresolved observation: ${space.label}`,detail:`${item.prompt} — ${r.reason}. Keep this limitation visible and arrange follow-up if needed.`,stage:"assess",spaceId:space.id,code:item.code,inHome:true});
 }
 const unhandled=view.findings.filter(f=>!f.detail.disposition?.trim()&&!state.plan.some(p=>p.linkedFindings.includes(f.key)));
 for(const f of unhandled)tasks.push({id:`finding:${f.key}`,title:`Review finding: ${f.space.label} — ${f.prompt}`,detail:"Link an action or document the professional decision about follow-up.",stage:"findings",spaceId:f.space.id,code:f.code,inHome:false});
 for(const p of state.plan){const missing=validatePlanItem(p);if(missing.length)tasks.push({id:`plan:${p.id}`,title:p.title||"Unfinished action",detail:`Missing ${missing.join(", ")}.`,stage:"plan",inHome:false});}
 return {tasks,observed,unable,notApplicable:na,decided:view.completeness.requiredAssessed,total:view.completeness.requiredTotal,unhandled};
}
