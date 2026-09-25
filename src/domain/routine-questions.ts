import {healthPrompts} from './health-profile';
import {GOALS, HELP_STYLE, ROUTINES, type HomeProfile} from './home-profile';

export const routineQuestions = [
 {key:'forWhom',title:'Who are we checking the home for?',hint:'This helps us use the right wording as we go.',options:{self:'Myself',family:'A family member',support:'Someone I support'}},
 {key:'mobility',title:'What helps with getting around?',hint:'Choose what is usually used, indoors or out.',options:{none:'No walking aid',cane:'Cane',walker:'Walker',wheelchair:'Wheelchair',varies:'It varies / another aid',prefer_not:'Prefer not to say'}},
 ...healthPrompts,
 {key:'goal',title:'What matters most right now?',hint:'Choose the closest fit. There is no right or wrong answer.',options:GOALS},
 {key:'helpReach',title:'Could help be reached if it were needed?',hint:'Think about the usual spaces and who could respond.',options:{yes:'Yes, there is a way to call and someone to respond',no:'No, there is a gap',unsure:"I'm not sure"}},
 {key:'livingWith',title:'Who lives in the home?',hint:'Think about a normal week.',options:{alone:'The person lives alone',others:'The person lives with others',varies:'It varies',prefer_not:'Prefer not to say'}},
 {key:'routines',title:'Which parts of the day should we keep in mind?',hint:'You can choose more than one, or move on.',options:ROUTINES},
 {key:'helpStyle',title:'What kind of help would suit you?',hint:'Your answer helps shape the options at the end.',options:HELP_STYLE},
 {key:'technology',title:'Would you like to explore home technology?',hint:'There is no need to buy anything to use this check.',options:{interested:'Yes, if it solves a specific problem',help:'Maybe, with setup and ongoing help',no:'Not right now'}},
] as const;

const essential = new Set(['forWhom','mobility','movement','movementTask','fallConcern','meals','foodAccess','appetite','goal','helpReach']);
export function dailyLifeQuestions(profile:HomeProfile,moreContext=false){
 const appetiteRelevant=(profile.meals!==undefined && !['regular','prefer_not'].includes(profile.meals)) || (profile.foodAccess!==undefined && !['manageable','prefer_not'].includes(profile.foodAccess));
 return routineQuestions.filter(q=>{
  if(moreContext)return !essential.has(q.key) || (q.key==='appetite' && !appetiteRelevant);
  if(!essential.has(q.key))return false;
  if(q.key==='movementTask')return !!profile.movement && !['comfortable','prefer_not'].includes(profile.movement);
  if(q.key==='appetite')return appetiteRelevant;
  return true;
 });
}
