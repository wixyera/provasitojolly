import { requiredSecret, supabaseConfig, supabaseFetch } from "../app/api/_supabase";
export type MailJob={id:string;lease_token:string;recipient:string;subject:string;body:string};
export async function processEmails(){
 const config=supabaseConfig();requiredSecret("SUPABASE_SECRET_KEY");
 const key=requiredSecret("RESEND_API_KEY"),from=requiredSecret("MAIL_FROM");
 const jobs=await supabaseFetch<MailJob[]>(config,"/rest/v1/rpc/claim_emails",{method:"POST",body:"{}"});
 let sent=0,failed=0;
 for(const job of jobs){
  let error:string|null=null;
  try{
   const response=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`jolly-${job.id}`},body:JSON.stringify({from,to:[job.recipient],subject:job.subject,text:job.body})});
   if(!response.ok)throw new Error(`Resend HTTP ${response.status}: controlla mittente, dominio e quota email.`);
   sent++;
  }catch(e){error=e instanceof Error?e.message:"Invio non riuscito";failed++;}
  await supabaseFetch(config,"/rest/v1/rpc/finish_email",{method:"POST",body:JSON.stringify({p_id:job.id,p_lease:job.lease_token,p_error:error})});
 }
 return {sent,failed};
}
