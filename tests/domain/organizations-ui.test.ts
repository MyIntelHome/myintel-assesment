// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OrganizationDashboard } from "@/components/OrganizationDashboard";
import type { OrganizationDetail } from "@/domain/organizations";
const user={id:'owner',email:'owner@example.test',name:'Owner',isAdmin:false};
const org={id:'b4d56d10-e787-4fa7-8130-b827eb2d365b',name:'Example practice',role:'owner' as const,revision:3,updatedAt:'2026-10-27T12:00:00Z'};
let root:Root,container:HTMLDivElement;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.restoreAllMocks()});
async function setup(canViewSummaries=true){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const detail:OrganizationDetail={organization:org,canViewSummaries,members:[{userId:user.id,name:user.name,email:user.email,role:'owner',professionalStatus:canViewSummaries?'approved':'pending'}],invitations:[],summaries:[],events:[]};
 let denied=false;
 const calls:{path:string;data:Record<string,unknown>}[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const path=String(input),data=init?.body?JSON.parse(String(init.body)):{};calls.push({path,data});
  if(path==='/api/organization-config')return Response.json({enabled:true});
  if(path==='/api/organizations')return Response.json({organizations:[org],invitations:[]});
  if(path.includes('/summary-preview'))return Response.json({sourceRevision:7,payload:{signed:false,reportCount:0,areaCount:1,findings:1,critical:1,concernPercent:100,incomplete:true,followUpDate:null,sourceUpdatedAt:'2026-10-27T12:00:00Z'}});
  if(path.endsWith('/summaries'))return Response.json({shared:true});
  return denied?Response.json({error:'This organization is unavailable to this account.'},{status:404}):Response.json(detail);
 });
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(createElement(OrganizationDashboard,{user,cases:[{id:'private-case',reference:'Private case reference',audience:'clinician'}]})));
 return {calls,detail,deny:()=>{denied=true}};
}
const button=(text:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
it('previews only the intended summary and leaves sharing consent unchecked until the user acts',async()=>{
 const {calls}=await setup();
 const select=[...container.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Your saved professional assessment'))!.querySelector('select')!;
 await act(async()=>{select.value='private-case';select.dispatchEvent(new Event('change',{bubbles:true}))});
 await act(async()=>select.closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const checkbox=container.querySelector<HTMLInputElement>('input[type=checkbox]')!;
 expect(checkbox.checked).toBe(false);expect(button('Share this summary').disabled).toBe(true);
 expect(calls.some(c=>c.path.endsWith('/summaries'))).toBe(false);
 await act(async()=>checkbox.click());await act(async()=>button('Share this summary').click());
 expect(calls.find(c=>c.path.endsWith('/summaries'))?.data).toEqual({revision:3,caseId:'private-case',sourceRevision:7,consent:true});
 expect(container.querySelector<HTMLInputElement>('input[type=checkbox]')).toBeNull();
});
it('does not show clinical metrics or the sharing form for an owner without professional approval',async()=>{
 await setup(false);expect(container.textContent).toContain('Team management is available');
 expect(container.textContent).not.toContain('Shared work at a glance');expect(container.textContent).not.toContain('Share a case summary');
 expect(button('Create invitation')).toBeTruthy();
});
it('clears previously loaded summaries when a refreshed membership check is denied',async()=>{
 const state=await setup();state.detail.summaries=[{id:'summary',reference:'HC-PRIVATE',assessorId:'owner',assessorName:'Owner',own:true,signed:false,reportCount:0,areaCount:1,findings:1,critical:1,concernPercent:100,incomplete:true,followUpDate:null,sourceUpdatedAt:null,sharedAt:'2026-10-27T12:00:00Z'}];
 await act(async()=>window.dispatchEvent(new Event('focus')));expect(container.textContent).toContain('HC-PRIVATE');
 state.deny();await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(container.textContent).not.toContain('HC-PRIVATE');expect(container.textContent).toContain('unavailable to this account');
});
