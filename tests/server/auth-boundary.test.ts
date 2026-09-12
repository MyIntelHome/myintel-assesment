import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApi, type Env } from "../../worker/api";
import { handleSitesApi } from "../../worker/sites-api";
import type { IdentityResolver } from "../../worker/auth";
import { SqliteTestDatabase } from "./sqlite-test-db";

const origin = "https://myintel.test";
let db: SqliteTestDatabase;
let env: Env;
const customer: IdentityResolver = async () => ({ id: "customer", email: "customer@example.test", emailVerified: true });
function request(path: string, method = "GET", body?: unknown) {
  return new Request(origin + path, {
    method,
    headers: {
      origin, "content-type": "application/json",
      "oai-authenticated-user-id": "staff",
      "oai-authenticated-user-email": "admin@example.test",
      "x-user-id": "staff", "x-user-role": "admin",
      authorization: "Bearer visitor-supplied-token",
      cookie: "user=staff; role=admin",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeEach(() => {
  db = new SqliteTestDatabase();
  env = { DB: db, ASSETS: { fetch: async () => new Response("") }, MYINTEL_ADMIN_EMAIL: "admin@example.test" };
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });

describe("shared API authentication boundary", () => {
  it("does not interpret visitor headers, cookies or bearer text as a session", async () => {
    const response = await handleApi(request("/api/account"), env);
    expect((await response.json()).user).toBeNull();
    for (const path of ["/api/cases", "/api/requests", "/api/admin/professional-access", "/api/requests/other/home-review/photos/photo"]) {
      expect((await handleApi(request(path), env)).status).toBe(401);
    }
    expect((await handleApi(request("/api/cases", "PUT", {}), env)).status).toBe(401);
  });

  it("uses only the verified principal and prevents header-based staff elevation", async () => {
    const response = await handleApi(request("/api/account"), env, customer);
    expect((await response.json()).user).toEqual({ id: "customer", email: "customer@example.test", name: "customer@example.test", isAdmin: false });
    expect((await handleApi(request("/api/admin/professional-access"), env, customer)).status).toBe(403);
    expect((await handleApi(request("/api/cases?audience=clinician"), env, customer)).status).toBe(403);
  });

  it("keeps other account archives private despite spoofed identity headers", async () => {
    await db.prepare("INSERT INTO case_archives (user_id,payload,revision,updated_at) VALUES (?,?,1,?)")
      .bind("staff", JSON.stringify({ activeId: "private", cases: [{ id: "private", audience: "family" }] }), new Date().toISOString()).run();
    const response = await handleApi(request("/api/cases"), env, customer);
    expect(await response.json()).toEqual({ archive: null, revision: 0 });
  });

  it.each([
    { id: "staff", email: "admin@example.test", emailVerified: false },
    { id: " ", email: "admin@example.test", emailVerified: true },
    { id: "staff", email: " ", emailVerified: true },
  ])("rejects unverified or incomplete principals: %j", async (principal) => {
    expect((await handleApi(request("/api/cases"), env, async () => principal)).status).toBe(401);
  });

  it("returns a retryable failure when session verification fails without reading records", async () => {
    const prepare = vi.spyOn(db, "prepare");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleApi(request("/api/cases"), env, async () => { throw new Error("private provider diagnostic"); });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider diagnostic");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("requires origin validation even for a valid server session", async () => {
    const incoming = request("/api/cases", "PUT", {});
    incoming.headers.set("origin", "https://unrelated.test");
    expect((await handleApi(incoming, env, customer)).status).toBe(403);
  });

  it("preserves Sites sign-in only through the explicitly selected Sites adapter", async () => {
    const incoming = request("/api/account");
    incoming.headers.set("oai-authenticated-user-full-name", "Ada%20Example");
    incoming.headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
    const response = await handleSitesApi(incoming, env);
    expect((await response.json()).user).toEqual({ id: "staff", email: "admin@example.test", name: "Ada Example", isAdmin: true });
  });
});
