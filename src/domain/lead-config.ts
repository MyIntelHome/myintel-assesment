export const FUNNEL_EVENTS = ['check_started','daily_life_finished','room_finished','results_viewed','plan_emailed','help_request_submitted'] as const;
export type FunnelEvent = typeof FUNNEL_EVENTS[number];
export const TIMING_BUCKETS = ['under_10','10_to_15','15_to_30','over_30'] as const;
export function timingBucket(seconds:number){return seconds<600?'under_10':seconds<=900?'10_to_15':seconds<=1800?'15_to_30':'over_30'}
export function validShopUrl(value?:string){
 if(!value)return '';
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash?u.href.replace(/\/$/,''):''}catch{return ''}
}
export function shopLink(base:string,category:string,needCode:string){
 const url=validShopUrl(base);
 return url && ['home_modification','technology'].includes(category) && /^[a-z][a-z0-9_]{1,79}$/.test(needCode)?`${url}/collections/${needCode}`:null;
}
export const SHOP_DISCLOSURE='Some product links may earn MyIntel a commission. It never changes what your results recommend.';
