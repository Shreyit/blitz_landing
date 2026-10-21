import { createMailHandler } from './handler.ts';
import { createSmtpSender } from './smtp.ts';
import nodemailer from 'npm:nodemailer@10.1.7';

const provider=Deno.env.get('MAIL_PROVIDER') || 'resend';
const smtpSender=provider==='smtp' ? createSmtpSender({
  host:Deno.env.get('SMTP_HOST'),port:Deno.env.get('SMTP_PORT'),
  username:Deno.env.get('SMTP_USERNAME'),password:Deno.env.get('SMTP_PASSWORD'),
},options=>nodemailer.createTransport(options)) : undefined;

Deno.serve(createMailHandler({
  url:Deno.env.get('SUPABASE_URL'),
  key:Deno.env.get('BLITZ_SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  workerSecret:Deno.env.get('MAIL_WORKER_SECRET'),
  resendKey:Deno.env.get('RESEND_API_KEY'),
  from:Deno.env.get('MAIL_FROM'),
  provider,
},fetch,smtpSender));
