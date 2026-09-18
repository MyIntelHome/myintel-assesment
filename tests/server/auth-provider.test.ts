import { afterEach, expect, it, vi } from "vitest";
import { AuthRejected, supabaseAuth } from "../../production/auth-provider";

afterEach(() => vi.unstubAllGlobals());
const user = { id: "customer-a", email: "customer@example.test", email_confirmed_at: "2026-09-12T00:00:00Z", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-12T00:00:00Z" };
const session = { access_token: "verified-access", refresh_token: "rotated-refresh", token_type: "bearer", expires_in: 3600, user };
function fixture(replies: Array<{ body: unknown; status?: number }>) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const reply = replies.shift();
    if (!reply) throw new Error("Unexpected provider call");
    return Response.json(reply.body, { status: reply.status ?? 200 });
  }));
  return { provider: supabaseAuth("https://fixture.supabase.co", "fixture-publishable-key", "https://myintel.example"), requests };
}
it("uses the official password endpoint and server-returned verified identity", async () => {
  const f = fixture([{ body: session }]);
  const result = await f.provider.login(user.email, "a memorable password");
  expect(result.user).toEqual({ id: user.id, email: user.email, verified: true });
  expect(f.requests[0]?.url).toContain("/auth/v1/token?grant_type=password");
  expect(JSON.parse(String(f.requests[0]?.init?.body))).toMatchObject({ email: user.email, password: "a memorable password" });
});
it("verifies access tokens with getUser instead of decoding a visitor claim", async () => {
  const f = fixture([{ body: user }]);
  expect(await f.provider.verify({ accessToken: "access", refreshToken: "refresh" })).toMatchObject({ user: { id: user.id, verified: true } });
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0]?.url).toContain("/auth/v1/user");
  expect(new Headers(f.requests[0]?.init?.headers).get("authorization")).toBe("Bearer access");
});
it("refreshes an expired token and verifies the refreshed identity remotely", async () => {
  const f = fixture([{ status: 401, body: { msg: "expired" } }, { body: session }, { body: user }]);
  const result = await f.provider.verify({ accessToken: "expired", refreshToken: "refresh" });
  expect(result?.tokens.refreshToken).toBe("rotated-refresh");
  expect(f.requests[1]?.url).toContain("grant_type=refresh_token");
  expect(new Headers(f.requests[2]?.init?.headers).get("authorization")).toBe("Bearer verified-access");
});
it("does not refresh after a provider outage and rejects revoked refresh tokens", async () => {
  const outage = fixture([{ status: 503, body: { msg: "unavailable" } }]);
  await expect(outage.provider.verify({ accessToken: "access", refreshToken: "refresh" })).rejects.toThrow("unavailable");
  expect(outage.requests).toHaveLength(1);
  const revoked = fixture([{ status: 401, body: { msg: "expired" } }, { status: 400, body: { msg: "revoked" } }]);
  expect(await revoked.provider.verify({ accessToken: "access", refreshToken: "refresh" })).toBeNull();
});
it("sends email actions to the fixed application origin and confirms a token hash", async () => {
  const f = fixture([{ body: {} }, { body: {} }, { body: session }]);
  await f.provider.signup(user.email, "a memorable password");
  expect(JSON.parse(String(f.requests[0]?.init?.body))).toMatchObject({ email: user.email, password: "a memorable password" });
  expect(new URL(f.requests[0]!.url).searchParams.get("redirect_to")).toBe("https://myintel.example");
  await f.provider.recover(user.email);
  expect(new URL(f.requests[1]!.url).searchParams.get("redirect_to")).toBe("https://myintel.example");
  await f.provider.confirm("one-time-hash", "recovery");
  expect(JSON.parse(String(f.requests[2]?.init?.body))).toMatchObject({ token_hash: "one-time-hash", type: "recovery" });
});
it("separates invalid credentials from provider failures", async () => {
  const denied = fixture([{ status: 400, body: { msg: "invalid" } }]);
  await expect(denied.provider.login(user.email, "wrong")).rejects.toBeInstanceOf(AuthRejected);
  const outage = fixture([{ status: 503, body: { msg: "unavailable" } }]);
  await expect(outage.provider.login(user.email, "password")).rejects.not.toBeInstanceOf(AuthRejected);
});
