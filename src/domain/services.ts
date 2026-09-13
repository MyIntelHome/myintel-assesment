import { z } from "zod";
export const SERVICES = {
  professional_assessment:{title:"Professional home assessment",description:"An occupational therapist reviews the home and daily activities with you."},
  home_modifications:{title:"Home modifications",description:"Help planning changes such as access, lighting or bathroom support."},
  technology_support:{title:"Technology and monitoring",description:"Explore home technology and the support needed to use it."},
  care_navigation:{title:"Help choosing the next step",description:"Talk through the options when you are not sure where to start."},
} as const;
export type ServiceType=keyof typeof SERVICES;
export const serviceSchema=z.enum(["professional_assessment","home_modifications","technology_support","care_navigation"]);
export const requestSchema=z.object({
  idempotencyKey:z.string().uuid(),service:serviceSchema,name:z.string().trim().min(2).max(100),
  postalCode:z.string().regex(/^\d{5}$/),phone:z.string().trim().max(30).default(""),
  contactMethod:z.enum(["email","phone"]),relationship:z.enum(["self","family","professional"]),consent:z.literal(true),
  caseId:z.string().max(100).optional(),shareAssessment:z.boolean().optional(),
}).refine(v=>v.contactMethod!=="phone" || v.phone.replace(/\D/g,"").length>=10,{message:"Add a phone number for a callback",path:["phone"]});
export const REQUEST_STATUS={submitted:"Request received",reviewing:"MyIntel is reviewing",quoted:"Your proposal is ready",accepted:"Proposal accepted",paid:"Payment received",completed:"Service completed",cancelled:"Cancelled"} as const;
export type RequestStatus=keyof typeof REQUEST_STATUS;
export interface ServiceRequest {id:string;user_id:string;email:string;service:ServiceType;name:string;postal_code:string;phone:string;contact_method:string;relationship:string;status:RequestStatus;provider_id:string|null;provider_name?:string|null;scope:string;amount_cents:number|null;quote_version:number;created_at:string;updated_at:string;}
export interface Provider {id:string;name:string;service:ServiceType;area:string;credentials:string;status:string;account_user_id?:string|null;account_revision?:number|null;account_email?:string|null;account_status?:string|null;}
export interface AccountUser {id:string;email:string;name:string;isAdmin:boolean;}
