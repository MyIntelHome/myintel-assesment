import type {CaseState} from "./case-store";
import type {AssessmentStatus} from "@/domain/status";
/** Pure projection shared by client screens and server report verification. */
export function responseMap(state:CaseState,spaceId:string):Map<string,{code:string;status:AssessmentStatus;reason?:string}>{
 return new Map(Object.entries(state.responses[spaceId]??{}).map(([code,r])=>[code,{code,status:r.status,reason:r.reason}]));
}
