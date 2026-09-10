import {expect,it,vi} from "vitest";
import {createUuid} from "../../src/lib/ids";
it("creates unique UUIDs when randomUUID is unavailable in a local browser",()=>{
 const getRandomValues=crypto.getRandomValues.bind(crypto);
 vi.stubGlobal("crypto",{getRandomValues});
 try { const a=createUuid(),b=createUuid();expect(a).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);expect(a).not.toBe(b); } finally {vi.unstubAllGlobals();}
});
