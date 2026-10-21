import { createMailHandler } from './handler.ts';

Deno.serve(createMailHandler({
  url:Deno.env.get('SUPABASE_URL'),
  key:Deno.env.get('BLITZ_SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  workerSecret:Deno.env.get('MAIL_WORKER_SECRET'),
  resendKey:Deno.env.get('RESEND_API_KEY'),
  from:Deno.env.get('MAIL_FROM'),
}));
