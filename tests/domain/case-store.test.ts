// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCase, readArchive, type CaseApi } from "@/lib/case-store";

const KEY = "myintel.cases.v1";
let api: CaseApi;
let root: Root;
function Harness() { api = useCase(); return null; }
function mount() { act(() => root.render(createElement(Harness))); }
function saved() { act(() => vi.advanceTimersByTime(400)); }
function archive() { return readArchive(localStorage.getItem(KEY)); }

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  root = createRoot(document.createElement("div"));
});
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("local persistence lifecycle", () => {
  it("preserves and reopens an earlier case with its answers and resume position", () => {
    mount(); saved();
    const first = api.state.id;
    act(() => { api.setAudience("family"); api.addSpace("entry", "Test entrance"); api.setFamilyAnswer("test::e1", "yes"); api.setFamilyPosition({phase:"report",roomIndex:0}); });
    saved();
    act(() => api.reset("family")); saved();
    expect(archive().cases).toHaveLength(2);
    expect(api.state.id).not.toBe(first);
    act(() => api.openCase(first)); saved();
    expect(api.state.spaces[0]?.label).toBe("Test entrance");
    expect(api.state.familyPosition?.phase).toBe("report");
    expect(api.state.familyAnswers["test::e1"]).toBe("yes");
  });
  it("blocks a case switch while saving and flushes the last edit on page exit", () => {
    mount(); saved(); const first = api.state.id;
    act(() => api.setReference("TEST-42"));
    act(() => api.reset());
    expect(api.state.id).toBe(first);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(archive().cases[0]?.reference).toBe("TEST-42");
    expect(api.saveState).toBe("saved");
  });
  it("pauses on another tab's write and preserves that tab's data", () => {
    mount(); saved();
    const other = JSON.stringify({activeId:api.state.id,cases:[{...api.state,reference:"OTHER-TAB"}]});
    localStorage.setItem(KEY, other);
    act(() => window.dispatchEvent(new StorageEvent("storage",{key:KEY,newValue:other})));
    act(() => api.setReference("UNSAVED")); saved();
    expect(api.storageConflict).toBe(true);
    expect(api.saveState).toBe("error");
    expect(localStorage.getItem(KEY)).toBe(other);
  });
  it("detects a conflict even if the storage event has not arrived", () => {
    mount(); saved();
    act(() => api.setReference("PENDING"));
    localStorage.setItem(KEY,"other-tab-write"); saved();
    expect(api.storageConflict).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("other-tab-write");
  });
  it("reports storage failures instead of claiming the changes are saved", () => {
    mount(); saved();
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(() => {throw new Error("Quota exceeded");});
    act(() => api.setReference("NOT-SAVED")); saved();
    expect(api.saveState).toBe("error");
    expect(api.state.reference).toBe("NOT-SAVED");
  });
  it.each(["{broken", "{}", '{"cases":null}', '{"activeId":"missing","cases":[{"id":"a"}]}'])
    ("does not overwrite an unreadable archive: %s", raw => {
      localStorage.setItem(KEY,raw); mount(); saved();
      expect(api.storageProblem).toBeTruthy();
      expect(localStorage.getItem(KEY)).toBe(raw);
    });
  it.each([
    {spaces:[{id:"s",type:"invalid",label:"Test"}]},
    {responses:{s:{e1:{status:"invalid"}}}},
    {signoff:{assessorName:123}},
    {intake:{concerns:"invalid"}},
    {plan:[{id:"p",linkedFindings:null}]},
    {reportVersions:[{id:"r",caseData:null}]},
  ])("preserves structurally damaged records without rendering them: %j", fields => {
    const raw=JSON.stringify({activeId:"a",cases:[{id:"a",...fields}]});
    localStorage.setItem(KEY,raw); mount(); saved();
    expect(api.storageProblem).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe(raw);
  });
  it("migrates the previous case and removes the old contact record", () => {
    localStorage.setItem("myintel.case.v3",JSON.stringify({reference:"LEGACY",spaces:[]}));
    localStorage.setItem("myintel.family.contact.v1",JSON.stringify({email:"example@example.com"}));
    mount(); saved();
    expect(archive().cases[0]?.reference).toBe("LEGACY");
    expect(localStorage.getItem("myintel.family.contact.v1")).toBeNull();
    expect(localStorage.getItem(KEY)).not.toContain("example@example.com");
  });
  it("preserves a damaged legacy case rather than silently replacing its rooms", () => {
    const raw=JSON.stringify({reference:"LEGACY",spaces:"damaged"});
    localStorage.setItem("myintel.case.v3",raw); mount(); saved();
    expect(api.storageProblem).toBeTruthy();
    expect(localStorage.getItem("myintel.case.v3")).toBe(raw);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
