import { createClient, type Session, type User } from "@supabase/supabase-js";

export interface AuthTokens { accessToken: string; refreshToken: string }
export interface AuthResult { tokens: AuthTokens; user: { id: string; email: string; verified: boolean } }
export interface AuthProvider {
  login(email: string, password: string): Promise<AuthResult>;
  signup(email: string, password: string): Promise<void>;
  recover(email: string): Promise<void>;
  confirm(token: string, type: "signup" | "recovery"): Promise<AuthResult>;
  verify(tokens: AuthTokens): Promise<AuthResult | null>;
  password(tokens: AuthTokens, password: string): Promise<void>;
  logout(tokens: AuthTokens): Promise<void>;
}
export class AuthRejected extends Error {}
function result(session: Session, user: User): AuthResult {
  return { tokens: { accessToken: session.access_token, refreshToken: session.refresh_token }, user: { id: user.id, email: user.email ?? "", verified: !!user.email_confirmed_at } };
}

export function supabaseAuth(url: string, key: string, origin: string): AuthProvider {
  // A fresh client for each operation prevents session state leaking across users.
  const client = () => createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }) },
  });
  function check(error: { status?: number } | null) {
    if (!error) return;
    if (error.status && error.status < 500) throw new AuthRejected("Account request was not accepted");
    throw new Error("Account provider unavailable");
  }
  return {
    async login(email, password) {
      const { data, error } = await client().auth.signInWithPassword({ email, password }); check(error);
      if (!data.session || !data.user) throw new AuthRejected();
      return result(data.session, data.user);
    },
    async signup(email, password) {
      const { error } = await client().auth.signUp({ email, password, options: { emailRedirectTo: origin } }); check(error);
    },
    async recover(email) {
      const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: origin }); check(error);
    },
    async confirm(token_hash, type) {
      const { data, error } = await client().auth.verifyOtp({ token_hash, type }); check(error);
      if (!data.session || !data.user) throw new AuthRejected();
      return result(data.session, data.user);
    },
    async verify(tokens) {
      const auth = client().auth;
      const initial = await auth.getUser(tokens.accessToken);
      if (!initial.error && initial.data.user) return { tokens, user: { id: initial.data.user.id, email: initial.data.user.email ?? "", verified: !!initial.data.user.email_confirmed_at } };
      if (!initial.error?.status || initial.error.status >= 500) throw new Error("Account verification unavailable");
      const refreshed = await auth.refreshSession({ refresh_token: tokens.refreshToken });
      if (refreshed.error) { if (!refreshed.error.status || refreshed.error.status >= 500) throw new Error("Account verification unavailable"); return null; }
      if (!refreshed.data.session) return null;
      const verified = await auth.getUser(refreshed.data.session.access_token);
      check(verified.error);
      return verified.data.user ? result(refreshed.data.session, verified.data.user) : null;
    },
    async password(tokens, password) {
      const auth = client().auth;
      const restored = await auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }); check(restored.error);
      const { error } = await auth.updateUser({ password }); check(error);
    },
    async logout(tokens) {
      const auth = client().auth;
      const restored = await auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }); check(restored.error);
      const { error } = await auth.signOut({ scope: "local" }); check(error);
    },
  };
}
