import {expect,it} from "vitest";
import {requestQueue,waitingLabel} from "@/domain/request-queue";
import type {ServiceRequest} from "@/domain/services";
const rows=(["quoted","submitted","completed","cancelled","accepted","paid","reviewing"] as const).map((status,i)=>({id:String(i),status,created_at:"2026-09-01T0"+i+":00:00Z"} as ServiceRequest));
it("keeps accepted and paid work in the active queue until completion",()=>{
 expect(requestQueue(rows,"active").map(r=>r.status)).toEqual(["quoted","submitted","accepted","paid","reviewing"]);
 expect(requestQueue(rows,"closed").map(r=>r.status)).toEqual(["completed","cancelled"]);
 expect(requestQueue(rows,"new").map(r=>r.status)).toEqual(["submitted"]);
 expect(requestQueue(rows,"proposals").map(r=>r.status)).toEqual(["quoted"]);
});
it("puts older requests first without mutating the source",()=>{
 const reversed=rows.slice().reverse();expect(requestQueue(reversed,"all")[0]?.id).toBe("0");expect(reversed[0]?.id).toBe("6");
});
it("handles missing and future timestamps without misleading negative ages",()=>{
 expect(waitingLabel("bad")).toBe("Submission time unavailable");
 expect(waitingLabel("2026-09-03T00:00:00Z",Date.parse("2026-09-02T00:00:00Z"))).toBe("Received within the last hour");
 expect(waitingLabel("2026-09-01T00:00:00Z",Date.parse("2026-09-02T00:00:00Z"))).toBe("Received 1d ago");
});
