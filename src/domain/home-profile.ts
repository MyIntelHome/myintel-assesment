import {createUuid} from "@/lib/ids";
import {z} from "zod";
import {templateFor} from "@/seed/templates";
import type {Space} from "@/lib/case-store";
export const HOME_TYPES={house:"House",townhome:"Townhome",apartment:"Apartment / condo",other:"Another type of home"} as const;
export const ROUTINES={night:"Getting up at night",cooking:"Cooking and preparing meals",bathing:"Bathing and dressing",outside:"Going out and coming home"} as const;
export const GOALS={independence:"Keep doing things independently",confidence:"Feel more confident moving around",planning:"Plan ahead",support:"Find support for someone I care about"} as const;
export const profileSchema=z.object({
  forWhom:z.enum(["","self","family","support"]),livingWith:z.enum(["","alone","others","varies","prefer_not"]),
  mobility:z.enum(["","none","cane","walker","wheelchair","varies","prefer_not"]),
  routines:z.array(z.enum(["night","cooking","bathing","outside"])).max(4),goal:z.enum(["","independence","confidence","planning","support"]),
  homeType:z.enum(["","house","townhome","apartment","other"]),bedrooms:z.number().int().min(0).max(8),
  fullBaths:z.number().int().min(0).max(6),halfBaths:z.number().int().min(0).max(4),levels:z.number().int().min(1).max(4),
  stairs:z.enum(["","yes","no","unsure"]),outside:z.boolean(),confirmed:z.boolean(),
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
export function profileLines(p:HomeProfile|undefined):string[]{
  if(!p)return [];
  return [p.homeType?`${HOME_TYPES[p.homeType]} · ${p.bedrooms} ${p.bedrooms===1?"bedroom":"bedrooms"} · ${p.fullBaths} full + ${p.halfBaths} half baths · ${p.levels} ${p.levels===1?"level":"levels"}`:"Home layout not provided",
    p.forWhom?`Check for: ${{self:"myself",family:"a family member",support:"someone I support"}[p.forWhom]}`:"",
    p.livingWith?`Living situation: ${{alone:"lives alone",others:"lives with others",varies:"varies",prefer_not:"not disclosed"}[p.livingWith]}`:"",
    p.mobility?`Getting around: ${{none:"no aid reported",cane:"cane",walker:"walker",wheelchair:"wheelchair",varies:"varies",prefer_not:"not disclosed"}[p.mobility]}`:"",
    p.routines.length?`Daily routines: ${p.routines.map(r=>ROUTINES[r]).join(", ")}`:"",p.goal?`What matters: ${GOALS[p.goal]}`:""].filter(Boolean);
}
