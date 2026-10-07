import { handleApi, type Env } from "../worker/api";
import { PublicAuth } from "./auth";
import { supabaseAuth } from "./auth-provider";
import { createProductionDatabase } from "./database";
import { privatePhotos } from "./photos";
import {leadSettings} from '../worker/leads';

export function productionApi(env: Env, auth: Pick<PublicAuth, "identity" | "route">) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!env.APP_ORIGIN || url.origin !== env.APP_ORIGIN || (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== env.APP_ORIGIN)) {
      return Response.json({ error: "Open MyIntel on its configured address." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname.startsWith("/api/auth/")) {
      if(['/api/auth/request-code','/api/auth/verify-code'].includes(url.pathname)&&!env.LEADS?.enabled)return Response.json({error:'Email codes are not enabled here.'},{status:503});
      return auth.route(request);
    }
    if (url.pathname.startsWith("/api/stripe/") || url.pathname.endsWith("/checkout")) return Response.json({ error: "Payments are not enabled." }, { status: 503 });
    // Do not propagate payment credentials, Sites headers, or browser role flags.
    return handleApi(request, { DB: env.DB, BUCKET: env.BUCKET, ASSETS: env.ASSETS, APP_ORIGIN: env.APP_ORIGIN, MYINTEL_ADMIN_EMAIL: env.MYINTEL_ADMIN_EMAIL,LEADS:env.LEADS }, request => auth.identity(request));
  };
}

let cached: ReturnType<typeof productionApi> | undefined;
export async function handleProductionRequest(request: Request): Promise<Response> {
  try {
    if(new URL(request.url).pathname==='/api/lead-config'&&request.method==='GET'){
      const settings=leadSettings(process.env);return Response.json({enabled:settings.enabled,deliveryEnabled:settings.deliveryEnabled&&!!settings.apiKey&&!!settings.sender&&!!settings.allowedEmails?.length,shopUrl:settings.shopUrl},{headers:{'Cache-Control':'no-store'}});
    }
    if (!cached) {
      const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error("Production service configuration is missing"); return value; };
      const url = required("MYINTEL_SUPABASE_URL"), origin = required("APP_ORIGIN");
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.origin !== url || parsed.username || parsed.password) throw new Error("Invalid account service URL");
      const db = createProductionDatabase({ url: required("MYINTEL_DATABASE_URL"), authToken: required("MYINTEL_DATABASE_AUTH_TOKEN") });
      const auth = new PublicAuth(db, supabaseAuth(url, required("MYINTEL_SUPABASE_PUBLISHABLE_KEY"), origin), origin, required("MYINTEL_SESSION_KEY"));
      cached = productionApi({ DB: db, BUCKET: privatePhotos(url, required("MYINTEL_SUPABASE_SERVICE_KEY"), required("MYINTEL_PHOTO_BUCKET")), ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, APP_ORIGIN: origin, MYINTEL_ADMIN_EMAIL: process.env.MYINTEL_ADMIN_EMAIL,LEADS:leadSettings(process.env) }, auth);
    }
    return await cached(request);
  } catch {
    return Response.json({ error: "MyIntel account services are temporarily unavailable. Your device draft is still here." }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
