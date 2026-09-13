import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Database } from "../worker/api";
import type { VerifiedPrincipal } from "../worker/auth";
import { AuthRejected, type AuthProvider, type AuthResult, type AuthTokens } from "./auth-provider";

const cookieName = "__Host-myintel-session";
const hours = 12 * 60 * 60 * 1000;
type SessionRow = { id_hash: string; user_id: string; encrypted_tokens: string; purpose: string; expires_at: number };
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(12).max(128) }).strict();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });

export class PublicAuth {
  private readonly key: Buffer;
  constructor(private readonly db: Database, private readonly provider: AuthProvider, private readonly origin: string, secret: string) {
    this.key = Buffer.from(secret, "base64");
    if (this.key.length !== 32) throw new Error("A 32-byte session encryption key is required");
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin) throw new Error("A canonical HTTPS origin is required");
  }
  private seal(tokens: AuthTokens): string {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  }
  private open(value: string): AuthTokens {
    const bytes = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return z.object({ accessToken: z.string(), refreshToken: z.string() }).parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")));
  }
  private token(request: Request) {
    const values = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).filter(s => s.startsWith(cookieName + "="));
    if (values.length !== 1) return null;
    const token = values[0]!.slice(cookieName.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }
  private async session(request: Request): Promise<SessionRow | null> {
    const token = this.token(request);
    if (!token) return null;
    return this.db.prepare("SELECT * FROM public_sessions WHERE id_hash=? AND expires_at>?").bind(hash(token), Date.now()).first<SessionRow>();
  }
  async identity(request: Request): Promise<VerifiedPrincipal | null> {
    const session = await this.session(request);
    if (!session || session.purpose !== "account") return null;
    const originalTokens = this.open(session.encrypted_tokens);
    const verified = await this.provider.verify(originalTokens);
    if (!verified || !verified.user.verified || verified.user.id !== session.user_id) return null;
    // Conditional update also detects signout/reset while provider verification ran.
    const updated = await this.db.prepare("UPDATE public_sessions SET encrypted_tokens=? WHERE id_hash=? AND encrypted_tokens=? AND expires_at>?")
      .bind(JSON.stringify(originalTokens) === JSON.stringify(verified.tokens) ? session.encrypted_tokens : this.seal(verified.tokens), session.id_hash, session.encrypted_tokens, Date.now()).run();
    if (!updated.meta.changes) {
      const current = await this.session(request);
      if (!current || current.user_id !== verified.user.id || current.purpose !== "account") return null;
    }
    return { id: verified.user.id, email: verified.user.email, emailVerified: true };
  }
  private cookie(value: string, maxAge: number) { return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
  private async start(result: AuthResult, purpose: "account" | "recovery", incoming: Request, startedAt: number) {
    if (!result.user.verified || !result.user.email) throw new AuthRejected();
    const token = randomBytes(32).toString("base64url"), lifetime = purpose === "recovery" ? 10 * 60 * 1000 : hours;
    const previous = this.token(incoming);
    const created = await this.db.batch([
      this.db.prepare("DELETE FROM public_sessions WHERE id_hash=? OR expires_at<=?").bind(previous ? hash(previous) : "", Date.now()),
      this.db.prepare("INSERT INTO public_sessions SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM public_auth_revocations WHERE user_id=? AND ((resetting=1 AND revoked_before>?) OR revoked_before>=?))").bind(hash(token), result.user.id, this.seal(result.tokens), purpose, Date.now() + lifetime, result.user.id, Date.now() - 120_000, startedAt),
    ]);
    if (created[1]?.meta.changes !== 1) throw new AuthRejected();
    const res = response({ redirect: purpose === "recovery" ? "/auth/password" : "/?view=account" });
    res.headers.append("Set-Cookie", this.cookie(token, Math.floor(lifetime / 1000)));
    return res;
  }
  private async limit(action: string, email: string) {
    const key = createHmac("sha256", this.key).update(action + ":" + email.toLowerCase()).digest("hex");
    const window = Math.floor(Date.now() / 60_000);
    const row = await this.db.prepare("INSERT INTO public_auth_attempts (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts")
      .bind(key, window).first<{ attempts: number }>();
    if (!row || row.attempts > 5) throw new RateLimited();
    await this.db.prepare("DELETE FROM public_auth_attempts WHERE window<?").bind(window - 60).run();
  }
  async route(request: Request): Promise<Response> {
    const startedAt = Date.now();
    if (request.method !== "POST") return response({ error: "Use the account form to continue." }, 405);
    if (request.headers.get("origin") !== this.origin) return response({ error: "Open this form on MyIntel." }, 403);
    try {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "Use the account form to continue." }, 415);
      const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
      if (reader) for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16_000) { await reader.cancel(); return response({ error: "This form is too large." }, 413); } chunks.push(value); }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const action = new URL(request.url).pathname.split("/").at(-1);
      if (action === "login" || action === "signup") {
        // Existing passwords may be shorter than the new-account minimum.
        const schema = action === "login" ? credentials.extend({ password: z.string().min(1).max(128) }) : credentials;
        const v = schema.parse(body); await this.limit(action, v.email);
        if (action === "login") return await this.start(await this.provider.login(v.email, v.password), "account", request, startedAt);
        await this.provider.signup(v.email, v.password);
        return response({ message: "Check your email to confirm your account. If you already have an account, sign in or reset your password." });
      }
      if (action === "recover") {
        const v = z.object({ email: z.string().trim().email().max(254) }).strict().parse(body); await this.limit(action, v.email);
        try { await this.provider.recover(v.email); } catch (error) { if (!(error instanceof AuthRejected)) throw error; }
        return response({ message: "If an account matches that email, you will receive a link to choose a new password." });
      }
      if (action === "confirm") {
        const v = z.union([
          z.object({ token: z.string().min(10).max(2048), type: z.enum(["signup", "recovery"]) }).strict(),
          z.object({ accessToken: z.string().min(10).max(8192), refreshToken: z.string().min(10).max(8192), type: z.enum(["signup", "recovery"]) }).strict(),
        ]).parse(body);
        await this.limit(action, "token" in v ? v.token : v.accessToken);
        const providerResult = "token" in v
          ? await this.provider.confirm(v.token, v.type)
          : await this.provider.verify({ accessToken: v.accessToken, refreshToken: v.refreshToken });
        if (!providerResult) throw new AuthRejected();
        return await this.start(providerResult, v.type === "recovery" ? "recovery" : "account", request, startedAt);
      }
      if (action === "password") {
        const v = z.object({ password: z.string().min(12).max(128) }).strict().parse(body);
        const session = await this.session(request);
        if (!session || session.purpose !== "recovery") throw new AuthRejected();
        const verified = await this.provider.verify(this.open(session.encrypted_tokens));
        if (!verified?.user.verified || verified.user.id !== session.user_id) throw new AuthRejected();
        // Invalidate every MyIntel session first, so partial provider failure
        // cannot leave old local sessions active after a successful reset.
        const claimed = await this.db.batch([
          this.db.prepare("INSERT INTO public_auth_revocations SELECT user_id,?,1 FROM public_sessions WHERE id_hash=? AND purpose='recovery' AND expires_at>? ON CONFLICT(user_id) DO UPDATE SET revoked_before=excluded.revoked_before,resetting=1").bind(Date.now(), session.id_hash, Date.now()),
          this.db.prepare("DELETE FROM public_sessions WHERE user_id=? AND changes()=1").bind(session.user_id),
        ]);
        if (claimed[0]?.meta.changes !== 1) throw new AuthRejected();
        try { await this.provider.password(verified.tokens, v.password); }
        finally {
          await this.db.batch([
            this.db.prepare("UPDATE public_auth_revocations SET revoked_before=?,resetting=0 WHERE user_id=?").bind(Date.now(), session.user_id),
            this.db.prepare("DELETE FROM public_sessions WHERE user_id=?").bind(session.user_id),
          ]);
        }
        const res = response({ redirect: "/auth/login?reset=complete" });
        res.headers.append("Set-Cookie", this.cookie("", 0)); return res;
      }
      if (action === "logout") {
        const session = await this.session(request), token = this.token(request);
        if (token) await this.db.prepare("DELETE FROM public_sessions WHERE id_hash=?").bind(hash(token)).run();
        // Local revocation is authoritative even if provider logout is unavailable.
        if (session) { try { await this.provider.logout(this.open(session.encrypted_tokens)); } catch { /* Never log tokens. */ } }
        const res = response({ redirect: "/" }); res.headers.append("Set-Cookie", this.cookie("", 0)); return res;
      }
      return response({ error: "Account action not found." }, 404);
    } catch (error) {
      if (error instanceof RateLimited) return response({ error: "Please wait a minute before trying again." }, 429);
      if (error instanceof AuthRejected) return response({ error: "We could not verify those details. Check your email and password, or request a new recovery link." }, 401);
      if (error instanceof z.ZodError || error instanceof SyntaxError) return response({ error: "Check the form. New passwords need at least 12 characters." }, 400);
      return response({ error: "Account service is temporarily unavailable. Please try again." }, 503);
    }
  }
}
class RateLimited extends Error {}
