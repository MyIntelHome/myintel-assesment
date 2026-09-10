import type {Database} from "./api";
export interface PhotoBucket{put(key:string,value:Uint8Array,options?:{httpMetadata:{contentType:string}}):Promise<unknown>;get(key:string):Promise<{body:ReadableStream}|null>;delete(key:string):Promise<void>}
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
/** Only JPEGs without an EXIF/APP1 segment. Browser re-encoding removes original metadata. */
export function acceptableJpeg(bytes:Uint8Array){
 if(bytes.length<4 || bytes[0]!==255 || bytes[1]!==216)return false;
 if(bytes.at(-2)!==255 || bytes.at(-1)!==217)return false;
 let p=2,hasDimensions=false;while(p+3<bytes.length){if(bytes[p]!==255)return false;const marker=bytes[p+1];if(marker===225 || marker===254)return false;if(marker===218)return hasDimensions;const len=(bytes[p+2]??0)*256+(bytes[p+3]??0);if(len<2 || p+len+2>bytes.length)return false;if(marker===192 || marker===194){if(len<8)return false;const height=(bytes[p+5]??0)*256+(bytes[p+6]??0),width=(bytes[p+7]??0)*256+(bytes[p+8]??0);if(!width || !height || width>4096 || height>4096 || width*height>4_000_000)return false;hasDimensions=true}p+=len+2}return false;
}
export async function homePhotoRoute(request:Request,db:Database,bucket:PhotoBucket|undefined,user:{id:string;isAdmin:boolean}):Promise<Response|null>{
 const path=new URL(request.url).pathname,match=path.match(/^\/api\/requests\/([\w-]+)\/home-review(?:\/photos(?:\/([\w-]+))?)?$/);if(!match)return null;
 const requestId=match[1]!,photoId=match[2],method=request.method;
 const record=await db.prepare("SELECT user_id,status FROM service_requests WHERE id=?").bind(requestId).first();
 if(!record || (record.user_id!==user.id && !user.isAdmin))return response({error:"Request not found."},404);
 const handoff=await db.prepare("SELECT payload,consent_at FROM home_handoffs WHERE request_id=?").bind(requestId).first<{payload:string;consent_at:string}>();
 if(!handoff)return method==="GET"?response({review:null,photos:[]}):response({error:"No home check was shared with this request."},409);
 if(method==="GET" && !photoId)return response({review:JSON.parse(handoff.payload),photos:(await db.prepare("SELECT id,room,kind FROM home_photos WHERE request_id=? AND ready=1 ORDER BY created_at").bind(requestId).all()).results});
 if(!bucket)return response({error:"Photo storage is temporarily unavailable. Your request is saved."},503);
 if(photoId && method==="GET"){
  const photo=await db.prepare("SELECT object_key FROM home_photos WHERE id=? AND request_id=? AND ready=1").bind(photoId,requestId).first<{object_key:string}>();
  const object=photo?await bucket.get(photo.object_key):null;if(!object)return response({error:"Photo not found."},404);
  return new Response(object.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Content-Disposition":"inline; filename=home-review.jpg"}});
 }
 if(record.user_id!==user.id)return response({error:"Only the requester can change photos."},403);
 if(photoId && method==="DELETE"){
  const photo=await db.prepare("SELECT object_key FROM home_photos WHERE id=? AND request_id=?").bind(photoId,requestId).first<{object_key:string}>();if(photo){await bucket.delete(photo.object_key);await db.prepare("DELETE FROM home_photos WHERE id=? AND request_id=?").bind(photoId,requestId).run()}return response({removed:true});
 }
 if(photoId && method==="PUT"){
  if(!/^[0-9a-f-]{36}$/i.test(photoId) || request.headers.get("content-type")!=="image/jpeg" || request.headers.get("x-photo-consent")!=="yes")return response({error:"Review your photo and agree to share it before uploading."},400);
  if(["completed","cancelled"].includes(String(record.status)))return response({error:"This request is closed."},409);
  let room="";try{room=decodeURIComponent(request.headers.get("x-photo-room")??"")}catch{return response({error:"Choose a room."},400)}
  const kind=request.headers.get("x-photo-kind"),review=JSON.parse(handoff.payload) as {rooms:string[]};
  if(!review.rooms.includes(room) || !["wide","detail"].includes(kind??""))return response({error:"Choose a room and photo type."},400);
  const reader=request.body?.getReader();if(!reader)return response({error:"Choose a photo."},400);
  const chunks:Uint8Array[]=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>3_000_000){await reader.cancel();return response({error:"This photo is too large. Choose a smaller image."},413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}if(!acceptableJpeg(bytes))return response({error:"Use the photo picker to prepare a JPEG without location metadata."},400);
  const existing=await db.prepare("SELECT request_id,ready FROM home_photos WHERE id=?").bind(photoId).first();if(existing && existing.request_id!==requestId)return response({error:"Please choose the photo again."},409);if(existing?.ready===1)return response({saved:true});
  const objectKey=`home-photos/${requestId}/${photoId}.jpg`;
  if(!existing){const result=await db.prepare("INSERT INTO home_photos (id,request_id,room,kind,object_key,ready,created_at) SELECT ?,?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM home_photos WHERE request_id=?)<6 ON CONFLICT(id) DO NOTHING").bind(photoId,requestId,room,kind,objectKey,new Date().toISOString(),requestId).run();if(result.meta.changes!==1)return response({error:"Six photos are already attached. Remove one before adding another."},409)}
  try{await bucket.put(objectKey,bytes,{httpMetadata:{contentType:"image/jpeg"}});await db.prepare("UPDATE home_photos SET ready=1 WHERE id=? AND request_id=?").bind(photoId,requestId).run()}catch{await db.prepare("DELETE FROM home_photos WHERE id=? AND request_id=? AND ready=0").bind(photoId,requestId).run();return response({error:"The photo did not finish saving. Please try again."},503)}
  return response({saved:true},201);
 }
 return response({error:"Action not found."},405);
}
