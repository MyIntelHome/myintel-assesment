import type {HomeProfile} from './home-profile';
import {activeContextAnswers} from './dynamic-context';
function currentHealth(p:HomeProfile):HomeProfile {
 if(!p.dynamic)return p;
 const current={...p},active=activeContextAnswers(p);
 for(const key of ['movement','movementTask','fallConcern','meals','foodAccess','appetite','hydration'] as const)if(!(key in active))delete current[key];
 return current;
}


/** Optional reported context, not a validated screening instrument or diagnosis. */
export const healthPrompts = [
 {key:'movement',title:'How is getting around on a usual day?',hint:'Think about movement at home and outside. Do not try a movement test for this check.',options:{comfortable:'Usually comfortable',difficult:'Difficult or tiring',help:"Need another person's help",unsure:'Not sure',prefer_not:'Prefer not to say'}},
 {key:'movementTask',title:'Which movement needs the most support?',hint:'Choose the closest fit, or skip this question.',options:{indoors:'Moving indoors',outside:'Going outside',transfers:'Getting in or out of a chair or bed',stairs:'Using steps or stairs',several:'Several of these',prefer_not:'Prefer not to say'}},
 {key:'fallConcern',title:'Have falls or balance been a concern?',hint:'Think about the past year. These answers do not produce a clinical risk score.',options:{none:'None of these',fall:'A fall in the past year',unsteady:'Feeling unsteady standing or walking',worried:'Concern about falling',several:'More than one of these',prefer_not:'Prefer not to say'}},
 {key:'meals',title:'What does a usual day of meals look like?',hint:'There is no ideal schedule to match. Think about what actually happens.',options:{regular:'Usually eat regular meals',sometimes_skipped:'Sometimes skip a meal',often_skipped:'Often skip meals',varies:'It varies',prefer_not:'Prefer not to say'}},
 {key:'foodAccess',title:'How is getting groceries and preparing meals?',hint:'Include help already available. No financial details are needed.',options:{manageable:'Usually manageable',shopping:'Getting groceries is difficult',preparing:'Preparing meals is difficult',both:'Both are difficult',prefer_not:'Prefer not to say'}},
 {key:'appetite',title:'Has eating become more difficult?',hint:'New or ongoing appetite, chewing or swallowing difficulties are worth discussing with a healthcare professional.',options:{usual:'Usual appetite and no difficulty',less:'Less appetite than usual',chewing:'Chewing is difficult',swallowing:'Swallowing is difficult',prefer_not:'Prefer not to say'}},
 {key:'hydration',title:'How does drinking during the day usually go?',hint:"Follow any fluid advice from your healthcare team. This check does not set a drinking target.",options:{regular:'Drinks regularly',forget:'Sometimes forgets to drink',difficult:'Getting or drinking fluids is difficult',care_plan:"Follows a clinician's fluid plan",prefer_not:'Prefer not to say'}},
] as const;

export function healthProfileLines(p:HomeProfile):string[]{
 p=currentHealth(p);
 return healthPrompts.flatMap(q=>{
  if(q.key==='movementTask' && (!p.movement || ['comfortable','prefer_not'].includes(p.movement)))return [];
  const value=p[q.key];
  if(!value)return [];
  const label=(q.options as Record<string,string>)[value];
  return [`${q.title} ${label} (reported)`];
 });
}

export function healthNextSteps(p?:HomeProfile):string[]{
 if(!p)return [];
 p=currentHealth(p);
 const steps:string[]=[];
 if((p.movement && ['difficult','help','unsure'].includes(p.movement)) || (p.fallConcern && !['none','prefer_not'].includes(p.fallConcern)))steps.push('Discuss usual movement, falls and walking-aid fit with a healthcare professional. Do not try challenging movements alone or change equipment based on this check.');
 if((p.foodAccess && !['manageable','prefer_not'].includes(p.foodAccess)) || (p.meals && ['sometimes_skipped','often_skipped'].includes(p.meals)))steps.push('Discuss help with groceries or preparing meals. Check local meal support availability and costs before relying on a service.');
 if(p.appetite && !['usual','prefer_not'].includes(p.appetite))steps.push('Contact a healthcare professional about changes in appetite or difficulty chewing or swallowing. This check does not prescribe a diet, supplements or food texture. If someone is choking or cannot breathe, call emergency services.');
 if(p.hydration && ['forget','difficult'].includes(p.hydration))steps.push("Discuss reminders or help keeping drinks within reach. Follow your healthcare team's fluid plan; no daily amount is recommended by this check.");
 return steps;
}
