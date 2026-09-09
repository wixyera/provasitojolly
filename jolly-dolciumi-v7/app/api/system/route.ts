import { env } from "cloudflare:workers";
import { currentUser, jsonError, RouteError, supabaseFetch } from "../_supabase";
import { processEmails } from "../../../worker/email-jobs";
export async function GET(request:Request){
 try{
  const c=await currentUser(request);if(c.profile.role!=="staff")throw new RouteError(403,"Solo staff");
  const bindings=env as unknown as Record<string,unknown>;
  const mails=await supabaseFetch<Array<{status:string;attempts:number;last_error:string|null;created_at:string}>>(c.config,"/rest/v1/email_outbox?select=status,attempts,last_error,created_at&order=created_at.desc&limit=30",{headers:{Authorization:`Bearer ${c.token}`}},c.config.publishableKey);
  return Response.json({version:7,configured:{supabase:!!c.config.secretKey,email:!!bindings.RESEND_API_KEY&&!!bindings.MAIL_FROM,stripe:!!bindings.STRIPE_SECRET_KEY&&!!bindings.STRIPE_WEBHOOK_SECRET},mails});
 }catch(e){return jsonError(e);}
}
export async function POST(request:Request){
 try{const c=await currentUser(request);if(c.profile.role!=="staff")throw new RouteError(403,"Solo staff");return Response.json(await processEmails());}catch(e){return jsonError(e);}
}
