import type {FunnelEvent} from '../domain/lead-config';
import {timingBucket} from '../domain/lead-config';
const PREFIX='myintel.funnel.v1.';
/** Device-only progress markers. Requests contain only an event and coarse time group. */
export function funnelOnce(caseId:string,event:FunnelEvent,roomId?:string){
 if(typeof window==='undefined'||!caseId||['plan_emailed','help_request_submitted'].includes(event))return;
 try{
  const key=PREFIX+caseId,record=JSON.parse(localStorage.getItem(key)||'{"seen":[]}');
  const mark=event==='room_finished'?`${event}:${roomId}`:event;
  if(record.seen.includes(mark))return;
  if(event==='check_started')record.start=Date.now();
  const bucket=event==='results_viewed'&&record.start?timingBucket(Math.max(0,(Date.now()-record.start)/1000)):undefined;
  record.seen.push(mark);localStorage.setItem(key,JSON.stringify(record));
  void fetch('/api/funnel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,...(bucket?{bucket}:{})}),keepalive:true}).catch(()=>{});
 }catch{/* Analytics must never prevent completing or saving a check. */}
}
