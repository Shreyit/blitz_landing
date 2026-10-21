// Manual invocation processes the existing queue; no recipient/body is accepted.
const root=process.env.BLITZ_SUPABASE_SECRET_KEY;
const secret=process.env.MAIL_WORKER_SECRET;
if(!root || !secret) throw new Error('Load supabase/functions/.env with its configured worker settings first.');
const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
if(!projectUrl) throw new Error('Load .env.local with the project URL first.');
try {
  const response=await fetch(`${projectUrl}/functions/v1/deliver-mail`,{
    method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(60_000),
  });
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || `Mail worker returned HTTP ${response.status}.`);
  console.log(`Provider accepted: ${Number(result.sent) || 0}; queued for retry: ${Number(result.retried) || 0}.`);
  if(result.retried) process.exitCode=1;
} catch(error) {
  console.error(error.cause?.code ? `Could not reach Supabase (${error.cause.code}).` : error.message);
  process.exitCode=1;
}
