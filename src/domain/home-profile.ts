import {createUuid} from "@/lib/ids";
import {z} from "zod";
import {templateFor} from "@/seed/templates";
import type {Space} from "@/lib/case-store";
export const HOME_TYPES={house:"House",townhome:"Townhome",apartment:"Apartment / condo",other:"Another type of home"} as const;
export const ROUTINES={night:"Getting up at night",cooking:"Cooking and preparing meals",bathing:"Bathing and dressing",outside:"Going out and coming home"} as const;
export const GOALS={independence:"Keep doing things independently",confidence:"Feel more confident moving around",planning:"Plan ahead",support:"Find support for someone I care about"} as const;
export const USED_AREAS={bedroom:"Where I sleep",bathroom:"Bathroom with a bath or shower",half_bath:"Toilet and sink only",living:"Where I sit or spend time",kitchen:"Where I prepare food",entry:"The entrance I use",stairway:"Steps or stairs I use",exterior:"An outside area I use"} as const;
export const HELP_STYLE={diy:"Simple changes I can arrange myself",professional:"Help planning or installing changes",explore:"Talk through my options first"} as const;
export const profileSchema=z.object({
  forWhom:z.enum(["","self","family","support"]),livingWith:z.enum(["","alone","others","varies","prefer_not"]),
  mobility:z.enum(["","none","cane","walker","wheelchair","varies","prefer_not"]),
  routines:z.array(z.enum(["night","cooking","bathing","outside"])).max(4),goal:z.enum(["","independence","confidence","planning","support"]),
  homeType:z.enum(["","house","townhome","apartment","other"]),bedrooms:z.number().int().min(0).max(8),
  fullBaths:z.number().int().min(0).max(6),halfBaths:z.number().int().min(0).max(4),levels:z.number().int().min(1).max(4),
  stairs:z.enum(["","yes","no","unsure"]),outside:z.boolean(),confirmed:z.boolean(),
  usedAreas:z.array(z.enum(["bedroom","bathroom","half_bath","living","kitchen","entry","stairway","exterior"])).max(8).optional(),
  helpStyle:z.enum(["","diy","professional","explore"]).optional(),
  technology:z.enum(["","interested","help","no"]).optional(),
  helpReach:z.enum(["","yes","no","unsure"]).optional(),
});
export type HomeProfile=z.infer<typeof profileSchema>;
export function homeQuestionText(prompt:string,forWhom:HomeProfile["forWhom"]|undefined){
  return forWhom==="self"?prompt.replace(/\btheir\b/g,"your").replace(/\bthey\b/g,"you"):prompt;
}
export const EMPTY_PROFILE:HomeProfile={forWhom:"",livingWith:"",mobility:"",routines:[],goal:"",homeType:"",bedrooms:1,fullBaths:1,halfBaths:0,levels:1,stairs:"",outside:false,confirmed:false};
export function familyTemplateFor(space:Pick<Space,"type"|"familyKind">){
  const template=templateFor(space.type);
  return space.familyKind==="half_bath"?{...template,items:template.items.filter(i=>!["b2","b3","b4","b8"].includes(i.code))}:template;
}
/** Generate suggestions only. Never infer answers or remove existing work. */
export function suggestedRooms(profile:HomeProfile):Space[]{
  const p=profileSchema.parse(profile),rooms:Space[]=[];
  const add=(type:Space["type"],label:string,familyKind?:Space["familyKind"])=>rooms.push({id:`home-${type}-${familyKind??"full"}-${rooms.length}`,type,label,familyKind});
  if(p.usedAreas!==undefined){
    for(const area of p.usedAreas){const type=area==="half_bath"?"bathroom":area;add(type,USED_AREAS[area].replace(" I "," you "),area==="half_bath"?"half_bath":undefined)}
    const first=p.routines.includes("night")?"bedroom":p.routines.includes("bathing")?"bathroom":p.routines.includes("cooking")?"kitchen":undefined;
    return rooms.sort((a,b)=>Number(b.type===first)-Number(a.type===first));
  }
  add("entry","Front door");add("living","Living room");add("kitchen","Kitchen");
  for(let n=1;n<=p.bedrooms;n++)add("bedroom",n===1?"Main bedroom":`Bedroom ${n}`);
  for(let n=1;n<=p.fullBaths;n++)add("bathroom",`Full bathroom ${n}`);
  for(let n=1;n<=p.halfBaths;n++)add("bathroom",`Half bath ${n}`,"half_bath");
  if(p.stairs==="yes" || p.stairs==="unsure")for(let n=1;n<=Math.max(1,p.levels-1);n++)add("stairway",p.levels>1?`Stairs: level ${n} to ${n+1}`:"Entrance steps");
  if(p.outside)add("exterior","Outside area");
  const priority=p.routines.includes("night")?["bedroom","bathroom"]:p.routines.includes("bathing")?["bathroom"]:p.routines.includes("cooking")?["kitchen"]:["entry"];
  return rooms.sort((a,b)=>(priority.includes(a.type)?priority.indexOf(a.type):10)-(priority.includes(b.type)?priority.indexOf(b.type):10));
}
export function mergeSuggestedRooms(existing:Space[],proposed:Space[]):Space[]{
  const remaining=[...existing];const result=[...existing];
  for(const room of proposed){const match=remaining.findIndex(s=>s.type===room.type && (s.familyKind??"full")===(room.familyKind??"full"));if(match>=0){remaining.splice(match,1);continue}result.push({...room,id:createUuid()})}return result;
}
export function activeHomeSpaces<T extends {excludedFromHome?:boolean}>(spaces:readonly T[]):T[]{return spaces.filter(s=>!s.excludedFromHome)}
/** Keep excluded rooms and their IDs so restoring a room restores its answers. */
export function selectUsedRooms(existing:Space[],proposed:Space[]):Space[]{
 const remaining=[...existing],chosen:Space[]=[];
 for(const room of proposed){const index=remaining.findIndex(s=>s.type===room.type && s.familyKind===room.familyKind);chosen.push(index<0?{...room,id:createUuid()}:{...remaining.splice(index,1)[0]!,excludedFromHome:false})}
 return [...chosen,...remaining.map(s=>({...s,excludedFromHome:true}))];
}
export function profileLines(p:HomeProfile|undefined):string[]{
  if(!p)return [];
  return [p.usedAreas!==undefined?`${p.homeType?HOME_TYPES[p.homeType]:"Home check"} · Selected everyday spaces only; other areas are not assessed.`:p.homeType?`${HOME_TYPES[p.homeType]} · ${p.bedrooms} ${p.bedrooms===1?"bedroom":"bedrooms"} · ${p.fullBaths} full + ${p.halfBaths} half baths · ${p.levels} ${p.levels===1?"level":"levels"}`:"Home layout not provided",
    p.helpStyle?`Preferred next step: ${HELP_STYLE[p.helpStyle]}`:"",
    p.technology?`Technology preference: ${{interested:"open to options",help:"would need setup and ongoing help",no:"not interested right now"}[p.technology]}`:"",
    p.helpReach?`Can reach help from usual spaces: ${{yes:"yes",no:"no",unsure:"not sure"}[p.helpReach]}`:"",
    p.forWhom?`Check for: ${{self:"myself",family:"a family member",support:"someone I support"}[p.forWhom]}`:"",
    p.livingWith?`Living situation: ${{alone:"lives alone",others:"lives with others",varies:"varies",prefer_not:"not disclosed"}[p.livingWith]}`:"",
    p.mobility?`Getting around: ${{none:"no aid reported",cane:"cane",walker:"walker",wheelchair:"wheelchair",varies:"varies",prefer_not:"not disclosed"}[p.mobility]}`:"",
    p.routines.length?`Daily routines: ${p.routines.map(r=>ROUTINES[r]).join(", ")}`:"",p.goal?`What matters: ${GOALS[p.goal]}`:""].filter(Boolean);
}
