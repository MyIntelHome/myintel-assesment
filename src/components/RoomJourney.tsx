import type { Space } from "@/lib/case-store";
import type { FamilyAnswer } from "@/domain/family";
import {roomProgress} from "@/domain/family";
import {familyTemplateFor,type HomeProfile} from "@/domain/home-profile";

export function RoomJourney({spaces,answers,profile}:{spaces:Space[];answers:Record<string,FamilyAnswer>;profile?:HomeProfile}) {
  if(!spaces.length)return null;
  return <ol className="room-journey" aria-label="Room check progress">{spaces.map(space=>{
    const progress=roomProgress(space.id,familyTemplateFor(space,profile,answers),answers);
    return <li key={space.id} className={progress.complete?"done":progress.answered?"started":""}><span aria-hidden="true">{progress.complete?"✓":progress.answered?"◐":"○"}</span><strong>{space.label}</strong><small>{progress.complete?"Checked":progress.answered?`${progress.answered} of ${progress.total}`:"Not started"}</small></li>;
  })}</ol>;
}
