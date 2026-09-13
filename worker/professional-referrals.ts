import type { Database } from "./api";
import type { PhotoBucket } from "./home-photos";

const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
type Grant={share_home:number;share_photos:number;photo_ids:string;payload:string|null};

/** Read-only access to the exact home snapshot and photo IDs a customer shared. */
export async function professionalSharedHomeRoute(request:Request,db:Database,bucket:PhotoBucket|undefined,userId:string):Promise<Response|null>{
  const path=new URL(request.url).pathname,match=path.match(/^\/api\/professional\/referrals\/([\w-]+)\/home-review(?:\/photos\/([\w-]+))?$/);
  if(!match)return null;
  if(request.method!=="GET")return response({error:"Shared home information is read only."},405);
  const grant=await db.prepare("SELECT g.share_home,g.share_photos,g.photo_ids,h.payload FROM request_professional_grants g JOIN service_requests r ON r.id=g.request_id JOIN providers p ON p.id=g.provider_id AND p.status='verified' JOIN provider_accounts a ON a.provider_id=g.provider_id AND a.user_id=g.professional_user_id AND a.revision=g.provider_revision JOIN professional_access pa ON pa.user_id=a.user_id AND pa.status='approved' LEFT JOIN home_handoffs h ON h.request_id=r.id WHERE g.request_id=? AND g.professional_user_id=? AND g.revoked_at IS NULL AND g.share_contact=1 AND r.provider_id=g.provider_id AND r.quote_version=g.quote_version AND r.status IN ('quoted','accepted','paid')")
    .bind(match[1],userId).first<Grant>();
  if(!grant)return response({error:"Shared request not found."},404);
  const allowedIds=new Set<string>();
  try{for(const id of JSON.parse(grant.photo_ids)){if(typeof id==="string")allowedIds.add(id)}}catch{return response({error:"Shared request is temporarily unavailable."},503)}
  const photoId=match[2];
  if(photoId){
    if(!grant.share_photos || !allowedIds.has(photoId))return response({error:"Photo not found."},404);
    if(!bucket)return response({error:"Photo storage is temporarily unavailable."},503);
    const photo=await db.prepare("SELECT object_key FROM home_photos WHERE id=? AND request_id=? AND ready=1").bind(photoId,match[1]).first<{object_key:string}>();
    const object=photo?await bucket.get(photo.object_key):null;
    if(!object)return response({error:"Photo not found."},404);
    return new Response(object.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Content-Disposition":"inline; filename=shared-home-review.jpg"}});
  }
  if(!grant.share_home || !grant.payload)return response({error:"The customer did not share a home check."},404);
  const photos=grant.share_photos?(await db.prepare("SELECT id,room,kind FROM home_photos WHERE request_id=? AND ready=1 ORDER BY created_at").bind(match[1]).all<{id:string;room:string;kind:string}>()).results.filter(photo=>allowedIds.has(photo.id)):[];
  return response({review:JSON.parse(grant.payload),photos});
}
