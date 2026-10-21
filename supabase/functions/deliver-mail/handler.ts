import { renderMail, type InlineImage } from './templates.ts';

type Config = { url?:string; key?:string; workerSecret?:string; resendKey?:string; from?:string; provider?:string };
type Job = {id:number; key:string; recipient:string; subject:string; body:string; template?:string; data?:unknown; lease_token:string};
export type MailMessage = {from:string; to:string; subject:string; text:string; key:string; html?:string; attachments?:InlineImage[]};
export type MailSender = (message:MailMessage)=>Promise<boolean>;

async function sameSecret(left:string,right:string) {
  const encode=new TextEncoder();
  const [a,b]=await Promise.all([left,right].map(s=>crypto.subtle.digest('SHA-256',encode.encode(s))));
  const x=new Uint8Array(a), y=new Uint8Array(b); let diff=0;
  for(let i=0;i<x.length;i++) diff|=x[i]^y[i];
  return diff===0;
}
export function createMailHandler(config:Config, fetcher:typeof fetch=fetch, smtpSender?:MailSender) {
  const reply=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  return async (request:Request)=>{
    if(request.method!=='POST') return reply({error:'Method not allowed.'},405);
    const provider=config.provider || 'resend';
    const transportReady=provider==='smtp' ? !!smtpSender : provider==='resend' && !!config.resendKey;
    if(!config.url || !config.key || !config.workerSecret || config.workerSecret.length<32 || !transportReady || !config.from)
      return reply({error:'Mail worker is not configured.'},503);
    if(!await sameSecret(request.headers.get('authorization') || '',`Bearer ${config.workerSecret}`))
      return reply({error:'Not authorised.'},401);
    const rpc=async <T>(name:string,body:object={})=>{
      const response=await fetcher(`${config.url}/rest/v1/rpc/${name}`,{
        method:'POST',headers:{apikey:config.key!,'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:AbortSignal.timeout(8_000),
      });
      if(!response.ok) throw new Error('Outbox request failed.');
      return await response.json() as T;
    };
    let sent=0, retried=0; const deadline=Date.now()+20_000;
    try {
      for(let i=0;i<20 && Date.now()<deadline;i++) {
        const job=await rpc<Job|null>('blitz_mail_claim'); if(!job) break;
        let success=false;
        try {
          const rendered=renderMail(job);
          if(provider==='smtp') {
            success=await smtpSender!({from:config.from!,to:job.recipient,...rendered,key:job.key});
          } else {
            const response=await fetcher('https://api.resend.com/emails',{
              method:'POST',headers:{Authorization:`Bearer ${config.resendKey}`,'Content-Type':'application/json',
                'Idempotency-Key':`blitz-${job.key}`},
              body:JSON.stringify({from:config.from,to:[job.recipient],subject:rendered.subject,text:rendered.text,
                ...(rendered.html?{html:rendered.html}:{}),
                ...(rendered.attachments?{attachments:rendered.attachments.map(image=>({filename:image.filename,content:image.content,content_type:image.contentType,content_id:image.cid}))}:{})}),
              signal:AbortSignal.timeout(8_000),
            });
            success=response.ok;
            // Consume the response; do not log message bodies, tokens or recipients.
            await response.arrayBuffer();
          }
        } catch { /* Persist retry state instead of delaying an auction command. */ }
        const acknowledged=await rpc<boolean>('blitz_mail_finish',{
          p_id:job.id,p_lease_token:job.lease_token,p_success:success,
        });
        if(!acknowledged) throw new Error('Mail lease expired.');
        if(success) sent++; else retried++;
      }
      return reply({sent,retried});
    } catch { return reply({error:'Mail processing interrupted; unacknowledged jobs will be retried.',sent,retried},503); }
  };
}
