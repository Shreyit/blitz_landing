import type { MailSender } from './handler.ts';
import type { InlineImage } from './templates.ts';

type Config = { host?:string; port?:string; username?:string; password?:string };
type Options = {
  host:string; port:number; secure:boolean; requireTLS:boolean;
  auth:{user:string; pass:string}; connectionTimeout:number;
  greetingTimeout:number; socketTimeout:number; dnsTimeout:number;
  disableFileAccess:boolean; disableUrlAccess:boolean;
};
type Transport = {sendMail(message:{from:string;to:string;subject:string;text:string;messageId:string;html?:string;attachments?:InlineImage[]}):Promise<{accepted?:unknown[]}>};

export function createSmtpSender(config:Config, createTransport:(options:Options)=>Transport):MailSender|undefined {
  const port=Number(config.port || '465');
  // Hosted Edge Functions block ports 25 and 587. Gmail supports TLS on 465.
  if(!config.host || !config.username || !config.password || !Number.isInteger(port)
    || port<1 || port>65535 || [25,587].includes(port)) return undefined;
  let transport:Transport|undefined;
  return async message=>{
    // Do not open SMTP connections until an authenticated worker claims a job.
    transport ??= createTransport({
      host:config.host!,port,secure:port===465,requireTLS:true,
      auth:{user:config.username!,pass:config.password!},
      connectionTimeout:8000,greetingTimeout:5000,socketTimeout:8000,dnsTimeout:5000,
      disableFileAccess:true,disableUrlAccess:true,
    });
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(message.key));
    const id=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    const domain=config.username!.split('@')[1] || 'localhost';
    const result=await transport.sendMail({from:message.from,to:message.to,subject:message.subject,
      text:message.text,...(message.html?{html:message.html}:{}),
      ...(message.attachments?{attachments:message.attachments}:{}),messageId:`<blitz-${id}@${domain}>`});
    // A successful SMTP connection alone does not mean this recipient was accepted.
    return !!result.accepted?.some(address=>String(address).toLowerCase()===message.to.toLowerCase());
  };
}
