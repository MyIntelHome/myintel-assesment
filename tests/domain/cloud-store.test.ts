// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {useCase,type CaseApi} from "@/lib/case-store";
let api:CaseApi,root:Root;
const fetchMock=vi.fn();
function Harness(){api=useCase({userId:"owner-a"});return null}
const reply=(value:unknown,status=200)=>({ok:status<400,status,json:async()=>value});
async function mount(){await act(async()=>{root.render(createElement(Harness))})}
async function save(){await act(async()=>{await vi.advanceTimersByTimeAsync(600)})}
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();fetchMock.mockResolvedValueOnce(reply({archive:null,revision:0})).mockResolvedValue(reply({revision:1}));root=createRoot(document.createElement("div"))});
afterEach(()=>{act(()=>root.unmount());vi.unstubAllGlobals();vi.useRealTimers()});
it("saves to the account without silently importing device drafts",async()=>{
  localStorage.setItem("myintel.case.v3",JSON.stringify({reference:"DEVICE-ONLY"}));
  await mount();await save();
  const payload=JSON.parse(fetchMock.mock.calls[1]![1].body);
  expect(payload.ownerId).toBe("owner-a");expect(payload.revision).toBe(0);
  expect(payload.archive.cases[0].reference).toBe("");expect(api.storageKind).toBe("account");expect(api.saveState).toBe("saved");
  expect(localStorage.getItem("myintel.cases.v1")).toBeNull();
});
it("serializes an in-flight save and sends the newest edit with the new revision",async()=>{
  await mount();await save();
  let finish!:(value:unknown)=>void;
  fetchMock.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue(reply({revision:3}));
  act(()=>api.setReference("FIRST"));await save();
  act(()=>api.setReference("LATEST"));await save();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await act(async()=>{finish(reply({revision:2}))});
  expect(fetchMock).toHaveBeenCalledTimes(4);
  const payload=JSON.parse(fetchMock.mock.calls[3]![1].body);
  expect(payload.revision).toBe(2);expect(payload.archive.cases[0].reference).toBe("LATEST");expect(api.saveState).toBe("saved");
});
it.each([403,409])("pauses a %s response and preserves unsaved work",async(status)=>{
  await mount();await save();fetchMock.mockResolvedValue(reply({error:"Conflict"},status));
  act(()=>api.setReference("KEEP-THIS"));await save();
  expect(api.storageConflict).toBe(true);expect(api.saveState).toBe("error");expect(api.state.reference).toBe("KEEP-THIS");
  const count=fetchMock.mock.calls.length;act(()=>api.retrySave());await save();expect(fetchMock).toHaveBeenCalledTimes(count);
});
it("keeps failed edits and retries without resetting the form",async()=>{
  await mount();await save();fetchMock.mockRejectedValueOnce(Error("Offline"));
  act(()=>api.setReference("RETRY-ME"));await save();expect(api.saveState).toBe("error");expect(api.state.reference).toBe("RETRY-ME");
  act(()=>api.retrySave());await save();expect(api.saveState).toBe("saved");expect(api.state.reference).toBe("RETRY-ME");
});
it("never writes a blank archive when loading the account fails",async()=>{
  fetchMock.mockReset().mockRejectedValue(Error("Offline"));await mount();await save();
  expect(api.storageProblem).toBeTruthy();expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("imports only home checks from a mixed legacy archive",async()=>{
 await mount();await save();
 localStorage.setItem("myintel.cases.v1",JSON.stringify({activeId:"clinical",cases:[{id:"clinical",audience:"clinician",reference:"CLINICAL"},{id:"home",audience:"family",reference:"HOME"}]}));
 act(()=>api.importLocal());await save();
 expect(api.state.reference).toBe("HOME");
 const payload=JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
 expect(payload.archive.cases.some((c:{reference:string})=>c.reference==="CLINICAL")).toBe(false);
});
it("leaves the current draft intact when all device records belong to professionals",async()=>{
 await mount();await save();const id=api.state.id;
 localStorage.setItem("myintel.cases.v1",JSON.stringify({activeId:"clinical",cases:[{id:"clinical",audience:"clinician"}]}));
 act(()=>api.importLocal());expect(api.state.id).toBe(id);
});
