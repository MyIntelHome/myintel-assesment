// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {ProfessionalHandoff} from "@/components/ProfessionalHandoff";
import type {ServiceRequest} from "@/domain/services";

let root:Root,container:HTMLDivElement;const fetchMock=vi.fn();
const request={id:"request-a",user_id:"client-a",email:"client@example.test",service:"home_modifications",name:"Example Client",postal_code:"80202",phone:"",contact_method:"email",relationship:"self",status:"quoted",provider_id:"provider-a",provider_name:"Example Practice",scope:"Example scope",amount_cents:10000,quote_version:2,created_at:"2026-09-12T00:00:00Z",updated_at:"2026-09-12T00:00:00Z"} satisfies ServiceRequest;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement("div");document.body.append(container);root=createRoot(container);fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock)});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
const reply=(value:unknown)=>({ok:true,json:async()=>value});
it("requires separate contact consent and sends only the options the customer selected",async()=>{
 fetchMock.mockResolvedValueOnce(reply({providerReady:true,providerName:"Example Practice",hasHome:true,photoCount:2,handoff:null}));
 await act(async()=>root.render(createElement(ProfessionalHandoff,{request})));await act(async()=>{});
 const boxes=[...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')],button=[...container.querySelectorAll<HTMLButtonElement>("button")].find(value=>value.textContent?.includes("Share with"))!;
 expect(boxes).toHaveLength(2);expect(button.disabled).toBe(true);
 await act(async()=>boxes[0]!.click());expect(button.disabled).toBe(false);
 await act(async()=>boxes[1]!.click());const photoBox=container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2]!;await act(async()=>photoBox.click());
 fetchMock.mockResolvedValueOnce(reply({shared:true})).mockResolvedValueOnce(reply({providerReady:true,providerName:"Example Practice",hasHome:true,photoCount:2,handoff:{active:true,consentAt:"2026-09-12T00:00:00Z",shareHome:true,sharePhotos:true,revokedAt:null}}));
 await act(async()=>button.click());
 const submitted=JSON.parse(fetchMock.mock.calls.find(call=>call[1]?.method==="POST")![1].body);
 expect(submitted).toEqual({quoteVersion:2,shareContact:true,shareHome:true,sharePhotos:true});
 expect(container.textContent).toContain("Later assessment edits and new photos are not added automatically");
});
