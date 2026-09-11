/** Conservatively retain legacy clinical records in the professional workspace. */
export function isClinicalRecord(record: {audience?:string;responses?:object;plan?:unknown[];reportVersions?:unknown[];findings?:object;signoff?:object;intake?:object}) {
  const populated=(value:unknown):boolean=>Array.isArray(value)?value.some(populated):value!==null && typeof value==="object"?Object.values(value).some(populated):value!==undefined && value!==null && value!=="" && value!==false;
  return record.audience==="clinician" || !!record.reportVersions?.length || !!record.plan?.length || populated(record.responses) || populated(record.findings) || populated(record.signoff) || populated(record.intake);
}
export interface ProfessionalAccess {user_id:string;email:string;name:string;practice:string;credential:string;region:string;status:"pending"|"approved"|"rejected"|"revoked";revision:number;review_note:string;updated_at:string;}
