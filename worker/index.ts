import { handleApi, type Env } from "./api";
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    if(new URL(request.url).pathname.startsWith("/api/"))return handleApi(request,env);
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set("X-Content-Type-Options","nosniff");headers.set("Referrer-Policy","no-referrer");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};
