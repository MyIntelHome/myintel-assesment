import {z} from "zod";
import type {HomeProfile} from "./home-profile";
import {SPACE_TYPES} from "./types";
const count=z.number().int().min(0).max(30).nullable();
export const contextPlaceSchema=z.object({id:z.string().min(1).max(100),type:z.enum(SPACE_TYPES),label:z.string().min(1).max(80),familyKind:z.literal("half_bath").optional(),level:z.number().int().min(1).max(4).nullable()});
const answer=z.union([z.string().max(150),z.array(z.string().max(100)).max(20)]);
export const dynamicContextSchema=z.object({version:z.literal(1),layout:z.object({bedrooms:count,fullBaths:count,halfBaths:count,levels:z.number().int().min(1).max(4).nullable(),occupants:count,sleepId:z.string().max(100),toiletId:z.string().max(100),bathingId:z.string().max(100),nightToiletId:z.string().max(100),entranceSteps:z.enum(["","none","steps","ramp","both","unsure"]),fixture:z.enum(["","shower","tub","both","elsewhere","unsure"]),confirmed:z.boolean()}),places:z.array(contextPlaceSchema).max(30).refine(p=>new Set(p.map(s=>s.id)).size===p.length,"Repeated place IDs"),answers:z.record(z.string().max(100),answer),history:z.array(z.object({id:z.string().max(100),value:answer,reason:z.string().max(400),at:z.string().datetime()})).max(200)});
export type DynamicContext=z.infer<typeof dynamicContextSchema>;
export type ContextPlace=z.infer<typeof contextPlaceSchema>;
export const emptyDynamicContext=():DynamicContext=>({version:1,layout:{bedrooms:null,fullBaths:null,halfBaths:null,levels:null,occupants:null,sleepId:"",toiletId:"",bathingId:"",nightToiletId:"",entranceSteps:"",fixture:"",confirmed:false},places:[],answers:{},history:[]});
export const PERSONAL_TASKS={bathing:"Bathing or showering",dressing:"Dressing and grooming",toileting:"Using the toilet",eating:"Eating or drinking",transfers:"Getting into or out of a bed or chair"};
export const HOUSEHOLD_TASKS={cooking:"Preparing meals",shopping:"Shopping and errands",laundry:"Laundry or housework",transport:"Going out or using transport",appointments:"Appointments or medication routines"};
export const TASK_LABELS={...PERSONAL_TASKS,...HOUSEHOLD_TASKS};
export type TaskId=keyof typeof TASK_LABELS;
const exceptions={none:"None of these",unsure:"Not sure",prefer_not:"Prefer not to answer"};
const difficulty={managed:"Difficult or tiring, but managed",equipment:"Managed with equipment",help:"Need someone's help",avoided:"Avoid it or cannot currently do it",unsure:"Not sure",prefer_not:"Prefer not to answer"};
const PARTS:Record<TaskId,Record<string,string>>={bathing:{getting_in:"Getting in or out",standing:"Standing or sitting",reaching:"Reaching or washing"},dressing:{bending:"Bending or reaching",fastening:"Buttons or fastenings",standing:"Balance while dressing"},toileting:{sitting:"Sitting down or standing up",getting_there:"Getting to the toilet",clothing:"Clothing or personal care"},eating:{holding:"Holding utensils or drinks",chewing:"Chewing",swallowing:"Swallowing"},transfers:{bed:"Getting in or out of bed",chair:"Getting up from a chair",both:"Both"},cooking:{standing:"Standing or moving in the kitchen",reaching:"Reaching items or controls",carrying:"Carrying or handling food",planning:"Planning or remembering steps"},shopping:{getting_there:"Getting to shops",carrying:"Carrying purchases",organizing:"Organizing purchases"},laundry:{access:"Getting to laundry or storage",carrying:"Carrying items",doing:"Doing the task"},transport:{entry:"Leaving or entering the home",vehicle:"Getting into or out of transport",availability:"Finding available transport"},appointments:{organizing:"Keeping track of routines",getting_there:"Getting to appointments",access:"Accessing help or supplies"}};
export interface ContextPrompt {id:string;title:string;why:string;options:Record<string,string>;multiple?:boolean;chapter:string}
const prompt=(id:string,title:string,why:string,options:Record<string,string>,chapter="Everyday life",multiple=false):ContextPrompt=>({id,title,why,options,chapter,multiple});
const legacyKeys=["forWhom","goal","mobility","movement","fallConcern","meals","foodAccess","appetite","helpReach","livingWith","technology","helpStyle"];
export function contextAnswer(p:HomeProfile,id:string):string|string[]|undefined{return legacyKeys.includes(id)?p[id as keyof HomeProfile] as string|undefined:p.dynamic?.answers[id]}
export function selectedTasks(p:HomeProfile):TaskId[]{const a=p.dynamic?.answers;return [...new Set([...(Array.isArray(a?.personal)?a.personal:[]),...(Array.isArray(a?.household)?a.household:[])])].filter((id):id is TaskId=>id in TASK_LABELS)}
export function taskPlace(p:HomeProfile,task:TaskId):ContextPlace|undefined{
 const d=p.dynamic;if(!d)return;
 const usual=task==="bathing"?d.layout.bathingId:task==="toileting"?d.layout.toiletId:task==="transfers"&&d.answers["part:transfers"]==="bed"?d.layout.sleepId:undefined;
 return d.places.find(s=>s.id===(usual||d.answers[`location:${task}`]));
}
/** Versioned deterministic routing: context never supplies clinical or room ratings. */
export function contextPrompts(p:HomeProfile):ContextPrompt[]{
 const d=p.dynamic,a=d?.answers??{},tasks=selectedTasks(p),out:ContextPrompt[]=[];
 const places=()=>Object.fromEntries([...(d?.places.map(s=>[s.id,s.label])??[]),["elsewhere","Somewhere else"],["unsure","Not sure"]]);
 out.push(prompt("forWhom","Who are we checking the home for?","We distinguish your experience from a report about someone else.",{self:"Myself",family:"A family member",support:"Someone I support"},"Getting started"));
 out.push(prompt("goal","What matters most right now?","This guides the conversation; essential home questions remain in the check.",{independence:"Keep doing things independently",confidence:"Feel more confident moving around",planning:"Plan ahead",support:"Find support for someone I care about"},"Getting started"));
 out.push(prompt("personal","Which personal activities are difficult, tiring, or need help?","We ask details only about the activities you select. Include something you avoid or want to do again.",{...PERSONAL_TASKS,...exceptions},"Daily activities",true));
 out.push(prompt("household","Which everyday tasks would you like help making easier?","Delegating a task does not mean you cannot do it.",{...HOUSEHOLD_TASKS,...exceptions},"Daily activities",true));
 for(const task of tasks){const place=taskPlace(p,task),value=a[`task:${task}`];
  out.push(prompt(`task:${task}`,`How is ${TASK_LABELS[task].toLowerCase()} managed?`,place?`We connect this to ${place.label}. This is reported experience, not a professional rating.`:"This helps distinguish equipment, assistance and an activity being avoided.",difficulty));
  if(value&&!['unsure','prefer_not'].includes(String(value))){
   out.push(prompt(`part:${task}`,`Which part of ${TASK_LABELS[task].toLowerCase()} is most difficult?`,"The specific difficulty helps avoid generic recommendations.",{...PARTS[task],other:"Another part",unsure:"Not sure"}));
   if(!place&&["bathing","toileting","transfers","cooking","laundry"].includes(task))out.push(prompt(`location:${task}`,"Where does this activity happen?","We reuse this place for related questions.",places()));
   if(["help","avoided"].includes(String(value)))out.push(prompt(`support:${task}`,"Does the available help meet the person's needs?","Occupancy does not automatically mean help is available.",{met:"Yes, the arrangement works",gap:"No, more or different help is needed",unsure:"Not sure",prefer_not:"Prefer not to answer"}));
  }
 }
 out.push(prompt("demands","What movement does a usual day require?","Daily demands are separate from how comfortable movement feels.",{indoors:"Moving between rooms",stairs:"Using steps or stairs",carrying:"Carrying things",outside:"Going out and coming home",...exceptions},"Movement and routes",true));
 out.push(prompt("movement","How is getting around on a usual day?","Answer from experience; do not attempt a movement test.",{comfortable:"Usually comfortable",difficult:"Difficult or tiring",help:"Need another person's help",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Movement and routes"));
 if(p.movement&&["difficult","help","unsure"].includes(p.movement))out.push(prompt("demandDifficulty","Which movement needs the most support?","We use the movements you described, with an option to add another.",Object.fromEntries(Object.entries({indoors:"Moving indoors",stairs:"Steps or stairs",carrying:"Carrying things",outside:"Going out"}).filter(([key])=>!Array.isArray(a.demands)||a.demands.includes(key)).concat([["other","Another movement"],["unsure","Not sure"]])),"Movement and routes",true));
 out.push(prompt("mobility","What helps with getting around?","We ask once and reuse this context. Equipment does not establish safety.",{none:"No walking aid",cane:"Cane",walker:"Walker",wheelchair:"Wheelchair",varies:"It varies / another aid",prefer_not:"Prefer not to answer"},"Movement and routes"));
 out.push(prompt("fallConcern","Have falls or balance been a concern?","Think about the past year. This does not produce a clinical risk score.",{none:"None of these",fall:"A fall in the past year",unsteady:"Feeling unsteady",worried:"Worried about falling",several:"More than one of these",prefer_not:"Prefer not to answer"},"Movement and routes"));
 if(p.fallConcern&&!['none','prefer_not'].includes(p.fallConcern))out.push(prompt("fallWhere","Where is the main fall or balance concern?","This directs attention to a relevant place without declaring the cause.",places(),"Movement and routes"));
 out.push(prompt("night","Is getting up to use the toilet part of a usual night?","We connect the sleeping place and nighttime toilet into one journey.",{yes:"Yes",no:"No",varies:"It varies",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Movement and routes"));
 if(["yes","varies"].includes(String(a.night)))out.push(prompt("nightDifficulty","How is that nighttime journey?","Room checks still examine actual lighting and surfaces.",{managed:"Usually manageable",difficult:"Difficult or tiring",help:"Need help",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Movement and routes"));
 out.push(prompt("meals","What does a usual day of meals look like?","This asks about routine, not whether a diet is healthy.",{regular:"Usually regular meals",sometimes_skipped:"Sometimes skip a meal",often_skipped:"Often skip meals",varies:"It varies",prefer_not:"Prefer not to answer"},"Food and connection"));
 if(!tasks.some(t=>t==="cooking"||t==="shopping"))out.push(prompt("foodAccess","How is getting or preparing food?","We reuse cooking or shopping difficulties if you already described them.",{manageable:"Usually manageable",shopping:"Shopping is difficult",preparing:"Preparing food is difficult",both:"Both are difficult",prefer_not:"Prefer not to answer"},"Food and connection"));
 out.push(prompt("eatingChanges","Are there changes in appetite, chewing, or swallowing you want to discuss?","Regular meals do not answer this question. Health details can stay private.",{none:"No changes to discuss",yes:"Yes",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Food and connection"));
 if(a.eatingChanges==="yes"&&!tasks.includes("eating"))out.push(prompt("appetite","Which change would you like help with?","A healthcare professional should review concerns; this check does not prescribe a diet.",{less:"Less appetite",chewing:"Difficulty chewing",swallowing:"Difficulty swallowing",usual:"Another change",prefer_not:"Prefer not to answer"},"Food and connection"));
 out.push(prompt("social","Do you have as much contact with other people as you would like?","Living alone and wanting more connection are different things.",{enough:"Yes, enough for me",more:"I would like more",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Food and connection"));
 if(a.social==="more")out.push(prompt("socialBarriers","What gets in the way of the contact you want?","We suggest support for the barrier, not an assumed diagnosis.",{transport:"Transport",movement:"Movement or fatigue",communication:"Hearing or communication",activities:"Finding activities",other:"Another reason",unsure:"Not sure"},"Food and connection",true));
 out.push(prompt("participation","Can you do the activities outside the home that matter to you?","An activity you have stopped doing can identify a useful goal.",{yes:"As much as I want",less:"Less than I would like",not_relevant:"Not relevant to my goals",unsure:"Not sure",prefer_not:"Prefer not to answer"},"Food and connection"));
 if(a.participation==="less"&&a.social!=="more"&&!tasks.includes("transport"))out.push(prompt("participationBarrier","What is the main barrier?","This connects the goal to appropriate help.",{transport:"Transport",movement:"Movement or fatigue",access:"Getting in or out of the home",other:"Another reason",unsure:"Not sure"},"Food and connection"));
 out.push(prompt("helpReach","Could help be reached if it were needed?","Think about both a way to call and someone who could respond.",{yes:"Yes, a way to call and someone to respond",no:"No, there is a gap",unsure:"Not sure"},"Support"));
 if(p.helpReach&&p.helpReach!=="yes")out.push(prompt("helpGap","What is missing or uncertain about reaching help?","A device cannot replace an actual response plan.",{calling:"A way to call",responding:"Someone available to respond",both:"Both",unsure:"Not sure"},"Support"));
 return out;
}
export function answerContext(p:HomeProfile,id:string,value:string|string[],at=new Date().toISOString()):Partial<HomeProfile>{
 const q=contextPrompts(p).find(q=>q.id===id);if(!q)throw Error("This question is not currently applicable.");const values=Array.isArray(value)?value:[value];
 if(!values.length||values.some(v=>!(v in q.options))||(!q.multiple&&Array.isArray(value)))throw Error("Choose an available answer.");
 if(values.length>1&&values.some(v=>['none','unsure','prefer_not'].includes(v)))throw Error("Choose one unknown/none option or the activities that apply.");
 const d=p.dynamic??emptyDynamicContext(),dynamic={...d,answers:{...d.answers,[id]:value},history:[...d.history,{id,value,reason:q.why,at}].slice(-200)};
 return legacyKeys.includes(id)?{dynamic,[id]:value} as Partial<HomeProfile>:{dynamic};
}
/** An explicit skip clears the current answer while keeping the prior record. */
export function leaveContextUnknown(p:HomeProfile,id:string,at=new Date().toISOString()):Partial<HomeProfile>{
 const d=p.dynamic??emptyDynamicContext(),answers={...d.answers};delete answers[id];
 const dynamic={...d,answers,history:[...d.history,{id,value:"",reason:"Left unknown by the reader",at}].slice(-200)};
 const empty=["forWhom","goal","mobility","helpReach","livingWith","technology","helpStyle"].includes(id)?"":undefined;
 return legacyKeys.includes(id)?{dynamic,[id]:empty} as Partial<HomeProfile>:{dynamic};
}
/** Retain hidden historical answers, but do not use them in current conclusions. */
export function activeContextAnswers(p:HomeProfile):Record<string,string|string[]>{
 const out:Record<string,string|string[]>={};for(const q of contextPrompts(p)){const value=contextAnswer(p,q.id);if(Array.isArray(value)){const valid=value.filter(v=>v in q.options);if(valid.length)out[q.id]=valid;}else if(value&&value in q.options)out[q.id]=value;}return out;
}
export function dynamicContextLines(p:HomeProfile):string[]{
 const d=p.dynamic;if(!d)return [];const l=d.layout,show=(n:number|null)=>n===null?"not provided":String(n);
 const lines=[`Home inventory (reported${l.confirmed?", summary confirmed":"; not confirmed"}): ${show(l.bedrooms)} bedrooms, ${show(l.fullBaths)} full baths, ${show(l.halfBaths)} half baths, ${show(l.levels)} levels.`,`Occupants: ${show(l.occupants)}. Support availability is assessed separately.`,`Check scope: ${d.places.length?d.places.map(s=>`${s.label}${s.level?` (level ${s.level})`:" (level not provided)"}`).join(", "):"places not selected"}. Other areas are not checked.`];
 for(const [key,label] of [["sleepId","Sleeping place"],["toiletId","Usual toilet"],["nightToiletId","Nighttime toilet"],["bathingId","Bathing place"]] as const)lines.push(`${label}: ${d.places.find(s=>s.id===l[key])?.label??"not established"}.`);
 const active=activeContextAnswers(p);
 for(const q of contextPrompts(p)){if(q.id in active){const v=active[q.id];lines.push(`${q.title} ${(Array.isArray(v)?v:[v]).map(x=>q.options[x!]??"not established").join(", ")} (reported)`);}}
 return lines;
}
export function contextGaps(p?:HomeProfile):string[]{
 const d=p?.dynamic;if(!d)return [];const gaps:string[]=[];
 if(!d.layout.confirmed)gaps.push("Home layout summary has not been confirmed.");if(d.layout.levels===null)gaps.push("Home levels have not been established.");if(!d.layout.entranceSteps||d.layout.entranceSteps==="unsure")gaps.push("Entrance access needs clarification.");
 for(const q of contextPrompts(p!)){const v=contextAnswer(p!,q.id);if(!v||(Array.isArray(v)&&!v.length)||v==="unsure"||v==="prefer_not"||(Array.isArray(v)&&v.some(x=>['unsure','prefer_not'].includes(x))))gaps.push(`${q.title} — not established or not disclosed.`);}
 for(const id of [d.layout.sleepId,d.layout.toiletId,d.layout.bathingId,d.layout.nightToiletId].filter(Boolean))if(!d.places.some(s=>s.id===id))gaps.push("An activity place is no longer in the check.");
 for(const [key,type,kind] of [["bedrooms","bedroom",undefined],["fullBaths","bathroom",undefined],["halfBaths","bathroom","half_bath"]] as const){const count=d.layout[key];if(count!==null&&d.places.filter(s=>s.type===type&&s.familyKind===kind).length>count)gaps.push("Selected places exceed the reported home inventory. Review the counts and space list.");}
 if(d.layout.levels!==null&&d.places.some(s=>s.level!==null&&s.level>d.layout.levels!))gaps.push("A selected place is on a level outside the reported home layout.");
 if(["yes","varies"].includes(String(d.answers.night))&&(!d.layout.sleepId||!(d.layout.nightToiletId||d.layout.toiletId)))gaps.push("The sleeping place and nighttime toilet route have not both been established.");
 return [...new Set(gaps)];
}
