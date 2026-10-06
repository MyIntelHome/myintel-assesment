import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { PublicAuth } from "../../production/auth";
import { AuthRejected, type AuthProvider, type AuthResult } from "../../production/auth-provider";
import { LibsqlDatabase } from "../../production/database";
import { applyMigrations, readMigrations } from "../../production/migrations";
import { productionApi } from "../../production/app";

const origin = "https://myintel.test", secret = Buffer.alloc(32, 7).toString("base64");
const verified: AuthResult = { user: { id: "alice", email: "alice@example.test", verified: true }, tokens: { accessToken: "private-provider-access", refreshToken: "private-provider-refresh" } };
let client: Client, db: LibsqlDatabase, auth: PublicAuth, provider: AuthProvider;
function request(action: string, body: unknown = {}, cookie?: string, extra: Record<string, string> = {}) {
  return new Request(origin + "/api/auth/" + action, { method: "POST", headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extra }, body: JSON.stringify(body) });
}
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!;
const identityRequest = (cookie: string) => new Request(origin + "/api/account", { headers: { cookie } });
const login = () => auth.route(request("login", { email: verified.user.email, password: "example password" }));
it('creates an opaque verified session from an email code without exposing provider tokens',async()=>{
 provider.requestCode=vi.fn(async()=>{});provider.verifyCode=vi.fn(async()=>verified);
 const sent=await auth.route(request('request-code',{email:verified.user.email}));expect(sent.status).toBe(200);expect(sent.headers.get('set-cookie')).toBeNull();
 const res=await auth.route(request('verify-code',{email:verified.user.email,code:'123456'}));expect(res.status).toBe(200);expect(res.headers.get('set-cookie')).not.toContain('private-provider');expect(await auth.identity(identityRequest(cookieOf(res)))).toMatchObject({id:'alice',emailVerified:true});
});
it('rejects code identity mismatches, wrong-origin verification and production code entry',async()=>{
 provider.verifyCode=vi.fn(async()=>verified);
 expect((await auth.route(request('verify-code',{email:'other@example.test',code:'123456'}))).status).toBe(401);
 expect((await auth.route(request('verify-code',{email:verified.user.email,code:'123456'},undefined,{origin:'https://other.test'}))).status).toBe(403);
 const api=productionApi({DB:db,ASSETS:{fetch:async()=>new Response('')},APP_ORIGIN:origin,LEADS:{enabled:false,deliveryEnabled:false}},auth);
 expect((await api(request('request-code',{email:verified.user.email}))).status).toBe(503);
});
beforeEach(async () => {
  client = createClient({ url: ":memory:" }); await applyMigrations(client, await readMigrations()); db = new LibsqlDatabase(client);
  provider = { login: vi.fn(async () => verified), signup: vi.fn(async () => {}), recover: vi.fn(async () => {}), confirm: vi.fn(async () => verified), verify: vi.fn(async () => verified), password: vi.fn(async () => {}), logout: vi.fn(async () => {}) };
  auth = new PublicAuth(db, provider, origin, secret);
});
afterEach(() => { client.close(); vi.restoreAllMocks(); });

it("creates only an opaque secure cookie and encrypted server-side provider tokens", async () => {
  const response = await login(); expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!;
  for (const flag of ["__Host-myintel-session=", "Secure", "HttpOnly", "SameSite=Lax", "Path=/"]) expect(cookie).toContain(flag);
  expect(cookie).not.toContain("private-provider");
  const row = await db.prepare("SELECT * FROM public_sessions").first();
  expect(JSON.stringify(row)).not.toContain("private-provider"); expect(JSON.stringify(row)).not.toContain(cookieOf(response).split("=")[1]);
  expect(await auth.identity(identityRequest(cookieOf(response)))).toEqual({ id: "alice", email: "alice@example.test", emailVerified: true });
});
it("rejects forged visitor identity headers and duplicate session cookies", async () => {
  expect(await auth.identity(new Request(origin, { headers: { "oai-authenticated-user-id": "staff", "oai-authenticated-user-email": "staff@example.test" } }))).toBeNull();
  const cookie = cookieOf(await login());
  expect(await auth.identity(identityRequest(cookie + "; " + cookie))).toBeNull();
});
it("supports concurrent account reads without falsely signing out one request", async () => {
  const cookie = cookieOf(await login());
  const users = await Promise.all([auth.identity(identityRequest(cookie)), auth.identity(identityRequest(cookie))]);
  expect(users.map(user => user?.id)).toEqual(["alice", "alice"]);
});
it("invalidates the local session immediately even if provider logout fails", async () => {
  const cookie = cookieOf(await login()); vi.mocked(provider.logout).mockRejectedValue(new Error("offline"));
  const response = await auth.route(request("logout", {}, cookie));
  expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(await auth.identity(identityRequest(cookie))).toBeNull();
});
it("does not resurrect a session signed out during remote verification", async () => {
  const cookie = cookieOf(await login());
  vi.mocked(provider.verify).mockImplementation(async () => { await db.prepare("DELETE FROM public_sessions").run(); return verified; });
  expect(await auth.identity(identityRequest(cookie))).toBeNull();
});
it("rejects expired sessions without calling the identity provider", async () => {
  const cookie = cookieOf(await login()); await db.prepare("UPDATE public_sessions SET expires_at=0").run();
  expect(await auth.identity(identityRequest(cookie))).toBeNull(); expect(provider.verify).not.toHaveBeenCalled();
});
it("requires a fresh sign-in when a restored session used an older encryption key", async () => {
  const oldCookie = cookieOf(await login());
  const rotated = new PublicAuth(db, provider, origin, Buffer.alloc(32, 8).toString("base64"));
  expect(await rotated.identity(identityRequest(oldCookie))).toBeNull();
  expect(provider.verify).not.toHaveBeenCalled();
  const fresh = await rotated.route(request("login", { email: verified.user.email, password: "example password" }, oldCookie));
  expect(fresh.status).toBe(200);
  expect(await rotated.identity(identityRequest(cookieOf(fresh)))).toMatchObject({ id: "alice", emailVerified: true });
});
it("never creates an account session for an unverified email", async () => {
  vi.mocked(provider.login).mockResolvedValue({ ...verified, user: { ...verified.user, verified: false } });
  const response = await login(); expect(response.status).toBe(401); expect(response.headers.get("set-cookie")).toBeNull();
});
it("keeps recovery sessions out of account APIs, resets the password, and revokes all old MyIntel sessions", async () => {
  const oldCookie = cookieOf(await login());
  const recovery = await auth.route(request("confirm", { type: "recovery", token: "example-one-time-token" }));
  const recoveryCookie = cookieOf(recovery);
  expect(await auth.identity(identityRequest(recoveryCookie))).toBeNull();
  const response = await auth.route(request("password", { password: "new example password" }, recoveryCookie));
  expect(response.status).toBe(200); expect(provider.password).toHaveBeenCalledWith(verified.tokens, "new example password");
  expect(await auth.identity(identityRequest(oldCookie))).toBeNull();
  expect((await auth.route(request("password", { password: "another password" }, recoveryCookie))).status).toBe(401);
});
it("accepts a default provider email fragment only after remote token verification", async () => {
  const response = await auth.route(request("confirm", { type: "signup", accessToken: "provider-access-token", refreshToken: "provider-refresh-token" }));
  expect(response.status).toBe(200);
  expect(provider.verify).toHaveBeenCalledWith({ accessToken: "provider-access-token", refreshToken: "provider-refresh-token" });
  expect(await auth.identity(identityRequest(cookieOf(response)))).toMatchObject({ id: "alice", emailVerified: true });
});
it("does not allow an ordinary session to use the recovery password endpoint", async () => {
  const cookie = cookieOf(await login());
  expect((await auth.route(request("password", { password: "new example password" }, cookie))).status).toBe(401);
  expect(provider.password).not.toHaveBeenCalled();
});
it("blocks a login that began before password reset from creating a stale session afterward", async () => {
  const recoveryCookie = cookieOf(await auth.route(request("confirm", { type: "recovery", token: "example-recovery-token" })));
  let release!: (value: AuthResult) => void;
  vi.mocked(provider.login).mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const pending = login();
  await vi.waitFor(() => expect(provider.login).toHaveBeenCalled());
  expect((await auth.route(request("password", { password: "new example password" }, recoveryCookie))).status).toBe(200);
  release(verified);
  expect((await pending).status).toBe(401);
  expect((await db.prepare("SELECT * FROM public_sessions").all()).results).toEqual([]);
});
it("allows recovery after a crashed reset lock ages out", async () => {
  await db.prepare("INSERT INTO public_auth_revocations VALUES (?,?,1)").bind("alice", Date.now() - 180_000).run();
  expect((await login()).status).toBe(200);
});
it("returns the same recovery message for an unknown account", async () => {
  const first = await auth.route(request("recover", { email: "known@example.test" }));
  vi.mocked(provider.recover).mockRejectedValue(new AuthRejected());
  const second = await auth.route(request("recover", { email: "unknown@example.test" }));
  expect(await second.json()).toEqual(await first.json()); expect(second.status).toBe(200);
});
it("throttles repeat authentication attempts without storing plaintext email addresses", async () => {
  for (let i = 0; i < 5; i++) expect((await login()).status).toBe(200);
  expect((await login()).status).toBe(429);
  expect(JSON.stringify(await db.prepare("SELECT * FROM public_auth_attempts").all())).not.toContain(verified.user.email);
});
it("preserves failures without leaking private provider diagnostics or setting cookies", async () => {
  vi.mocked(provider.login).mockRejectedValue(new Error("private provider detail"));
  const response = await login(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private provider detail");
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("rejects wrong origins, unsafe methods, short new passwords and oversized bodies", async () => {
  expect((await auth.route(request("login", {}, undefined, { origin: "https://other.test" }))).status).toBe(403);
  expect((await auth.route(new Request(origin + "/api/auth/logout"))).status).toBe(405);
  expect((await auth.route(request("signup", { email: "alice@example.test", password: "short" }))).status).toBe(400);
  expect((await auth.route(request("login", { data: "x".repeat(17_000) }))).status).toBe(413);
});
it("rejects provider identity changes and propagates verification outages as retryable failures", async () => {
  const cookie = cookieOf(await login());
  vi.mocked(provider.verify).mockResolvedValue({ ...verified, user: { ...verified.user, id: "bob" } });
  expect(await auth.identity(identityRequest(cookie))).toBeNull();
  vi.mocked(provider.verify).mockRejectedValue(new Error("offline"));
  const api = productionApi({ DB: db, ASSETS: { fetch: async () => new Response() }, APP_ORIGIN: origin, STRIPE_SECRET_KEY: "must-not-enable", STRIPE_WEBHOOK_SECRET: "must-not-enable" }, auth);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await api(identityRequest(cookie))).status).toBe(503);
  expect((await api(new Request(origin + "/api/account"))).status).toBe(200);
  expect((await (await api(new Request(origin + "/api/account"))).json()).paymentsEnabled).toBe(false);
});
