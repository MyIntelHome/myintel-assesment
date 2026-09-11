import type {ServiceRequest} from "./services";
export type QueueFilter="active"|"new"|"proposals"|"closed"|"all";
export function requestQueue(requests:ServiceRequest[],filter:QueueFilter){
  return requests.filter(r=>{
    const closed=r.status==="completed" || r.status==="cancelled";
    return filter==="all" || (filter==="closed"?closed:filter==="new"?r.status==="submitted":filter==="proposals"?r.status==="quoted":!closed);
  }).slice().sort((a,b)=>a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export function waitingLabel(createdAt:string,now=Date.now()){
  const start=Date.parse(createdAt);if(!Number.isFinite(start))return "Submission time unavailable";
  const hours=Math.max(0,Math.floor((now-start)/3600000));
  return hours<1?"Received within the last hour":hours<24?"Received "+hours+"h ago":"Received "+Math.floor(hours/24)+"d ago";
}
