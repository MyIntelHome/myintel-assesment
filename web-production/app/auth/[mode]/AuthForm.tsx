"use client";
import { useState, type FormEvent } from "react";
import "./auth.css";

const titles: Record<string, string> = { login: "Welcome back", signup: "Create your MyIntel account", recover: "Let’s recover your account", confirm: "Confirm your email link", password: "Choose a new password", logout: "Sign out of MyIntel" };
const labels: Record<string, string> = { login: "Sign in", signup: "Create account", recover: "Send recovery link", confirm: "Continue securely", password: "Save new password", logout: "Sign out" };
export function AuthForm({ mode }: { mode: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, data = new FormData(form), body: Record<string, string> = {};
    for (const key of ["email", "password"]) if (data.has(key)) body[key] = String(data.get(key));
    if (data.has("confirmPassword") && body.password !== String(data.get("confirmPassword"))) { setError("The passwords do not match. Please try again."); return; }
    if (mode === "confirm") {
      const query = new URLSearchParams(window.location.search);
      body.token = query.get("token_hash") ?? ""; body.type = query.get("type") ?? "";
      if (!body.token || !["signup", "recovery"].includes(body.type)) { setError("This link is incomplete. Please request a new email link."); return; }
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/" + mode, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Please try again.");
      if (result.redirect) {
        let destination = String(result.redirect);
        const requested = new URLSearchParams(window.location.search).get("return_to");
        const allowed = ["/?portal=professional", "/?view=account", "/?view=requests", "/?view=help"];
        if (mode === "login" && requested && allowed.includes(requested)) destination = requested;
        if (!["/", "/?view=account", "/auth/password", "/auth/login?reset=complete", ...allowed].includes(destination)) throw new Error("Please return to MyIntel and try again.");
        // Remove consumed email tokens from browser history.
        window.location.replace(destination); return;
      }
      setMessage(result.message ?? "Your request is complete.");
      form.reset();
    } catch (error) { setError(error instanceof Error ? error.message : "We could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  const hasEmail = ["login", "signup", "recover"].includes(mode), hasPassword = ["login", "signup", "password"].includes(mode);
  return <main className="auth-page"><a className="auth-brand" href="/">MyIntel</a><section className="auth-card" aria-labelledby="auth-title">
    <h1 id="auth-title">{titles[mode]}</h1>
    <p>{mode === "recover" ? "Enter the email you use for MyIntel. We’ll send a link so you can choose a new password." : mode === "logout" ? "Make sure your latest changes have finished saving before signing out on this device." : mode === "confirm" ? "Select Continue securely to use this email link. You can request another link if it has expired." : mode === "signup" ? "Save your home checks and keep your requests for help together." : mode === "password" ? "Use at least 12 characters. A few memorable words can be easier to remember." : "Sign in to return to your saved home checks and requests."}</p>
    {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
    <form onSubmit={submit}>
      {hasEmail && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy}/></label>}
      {hasPassword && <><label>{mode === "login" ? "Password" : "New password"}<input name="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} disabled={busy}/></label>
      {mode !== "login" && <label>Type the password again<input name="confirmPassword" type={show ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy}/></label>}
      <label className="auth-show"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)}/>Show password</label></>}
      <button className="app-primary" disabled={busy}>{busy ? "Please wait…" : labels[mode]}</button>
    </form>
    <nav aria-label="Account help">{mode === "login" ? <><a href="/auth/recover">Forgot your password?</a><a href="/auth/signup">Create an account</a></> : <a href="/auth/login">Back to sign in</a>}<a href="/">Return to home check</a></nav>
    <p className="auth-footnote">A home check can be completed without an account. Professional access requires a separate MyIntel review.</p>
  </section></main>;
}
