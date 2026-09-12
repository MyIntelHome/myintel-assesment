import { handleApi, type Env } from "./api";
import type { IdentityResolver } from "./auth";

/**
 * Only the Sites Worker entrypoint may use this adapter. Its dispatcher supplies
 * authenticated headers. These headers have NO authority on public Vercel APIs.
 * Keep this import out of any public server entrypoint.
 */
export const sitesIdentity: IdentityResolver = async (request) => {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  let name = email;
  const raw = request.headers.get("oai-authenticated-user-full-name");
  if (raw && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { name = decodeURIComponent(raw); } catch { /* Fall back to the authenticated email. */ }
  }
  return { id, email, name, emailVerified: true };
};

export function handleSitesApi(request: Request, env: Env): Promise<Response> {
  return handleApi(request, env, sitesIdentity);
}
