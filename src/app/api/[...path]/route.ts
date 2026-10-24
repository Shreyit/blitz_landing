import { createHash, createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { registrationData, InputError } from '@/lib/registration-validation';
import { SupabaseError } from '@/lib/supabase-http';
import { clearSession, login, publicClient, serviceClient, supabaseConfig, userRpc, usesSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
function originAllowed(origin: string | null) {
  if (origin === null) return true; // Non-browser clients may omit Origin.
  const normalize = (value: string) => {
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
    } catch { return null; }
  };
  const incoming = normalize(origin);
  if (!incoming) return false;
  // PUBLIC_URL is also trusted; an extra local/preview allowlist must not
  // accidentally exclude the configured website. Normalize trailing slashes.
  const configured = [process.env.PUBLIC_URL, process.env.ALLOWED_ORIGINS].filter(Boolean).join(',');
  const allowed = configured || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://127.0.0.1:3000');
  return allowed.split(',').some(value => normalize(value) === incoming);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new InputError('This request is too large.',413);
  const reader=request.body?.getReader(); if(!reader) return new Uint8Array();
  const chunks:Uint8Array[]=[]; let size=0;
  while(true) {
    const {done,value}=await reader.read(); if(done) break;
    size+=value.length;
    if(size>limit) { await reader.cancel(); throw new InputError('This request is too large.',413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function bodyJson(request: Request) {
  try { return JSON.parse(Buffer.from(await limitedBody(request,64*1024)).toString()); }
  catch(e) { if(e instanceof InputError) throw e; throw new InputError('Send a valid JSON request.'); }
}
async function rateLimit(request: Request, purpose: string, limit:number) {
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret) throw new SupabaseError('Server-side Supabase credentials are not configured.',503);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key=createHmac('sha256',secret).update(`${purpose}:${ip}`).digest('hex');
  await serviceClient().rpc('blitz_rate_limit',{p_key:key,p_limit:limit,p_seconds:600});
}
async function snapshot() {
  const rows=await publicClient().request<{snapshot:unknown}[]>('/rest/v1/auction_public_state?id=eq.1&select=snapshot');
  if(!rows[0]) throw new SupabaseError('Apply the Supabase migrations before opening the event.',503);
  return rows[0].snapshot;
}
async function register(request: Request) {
  await rateLimit(request,'register',20);
  // Vercel's request limit is smaller than arbitrary original camera photos.
  // The UI uploads only its confirmed 600px JPEG; enforce a bounded body here.
  const bytes=await limitedBody(request,4*1024*1024);
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type') || ''}}).formData();
  const data=registrationData(form), photo=form.get('photo');
  if(!(photo instanceof File) || !photo.size || photo.size>3.5*1024*1024) throw new InputError('Upload and crop a photo before submitting.');
  let image:Buffer;
  try {
    const source=sharp(Buffer.from(await photo.arrayBuffer()),{limitInputPixels:12_000_000});
    const metadata=await source.metadata();
    if(!['jpeg','png','webp'].includes(metadata.format || '') || (metadata.pages ?? 1)>1) throw new Error();
    image=await source.rotate().resize(600,600,{fit:'cover'}).jpeg({quality:85}).toBuffer();
  } catch { throw new InputError('Upload a valid JPEG, PNG or WebP photo up to 12 megapixels.'); }
  const id=randomUUID(), path=`${id}.jpg`;
  const url=process.env.PUBLIC_URL || (process.env.NODE_ENV==='production' ? '' : 'http://localhost:3000');
  if(!url || !/^https?:\/\//.test(url)) throw new SupabaseError('Set PUBLIC_URL for registration email links.',503);
  await serviceClient().request(`/storage/v1/object/blitz-photos/${path}`,{
    method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:new Uint8Array(image),
  });
  try {
    return json(await serviceClient().rpc('blitz_register',{p_id:id,p_data:data,p_hash:null,p_token:null,p_public_url:url}),201);
  } catch(e) {
    // Only compensate a definite database rejection. A lost response may follow
    // a committed registration; deleting its photo would corrupt that record.
    if(e instanceof SupabaseError && e.status<500) {
      await serviceClient().request('/storage/v1/object/blitz-photos',{
        method:'DELETE',body:JSON.stringify({prefixes:[path]}),
      }).catch(()=>{});
    }
    throw e;
  }
}
function csv(rows:Record<string,unknown>[]) {
  const fields=['id','created_at','consent_at','name','email','whatsapp','role','programme','year','age','gender','region','played_before','sports','volunteer_department','volunteer_rationale'];
  const quote=(value:unknown) => {
    let s=Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    if(/^[\s]*[=+@-]|^[\t\r]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return [fields.map(quote).join(','),...rows.map(r=>fields.map(f=>quote(r[f])).join(','))].join('\r\n');
}
async function handle(request: NextRequest, context:{params:Promise<{path:string[]}>}) {
  const path=(await context.params).path.join('/');
  try {
    if(!usesSupabase()) {
      // Preserve the existing local backend until Supabase is explicitly selected.
      const base=process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000';
      const headers=new Headers(request.headers); headers.delete('host'); headers.delete('content-length');
      const response=await fetch(`${base}/api/${path}${request.nextUrl.search}`,{
        method:request.method,headers,body:request.method==='GET' ? undefined : await limitedBody(request,6*1024*1024),
        cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30_000),
      });
      const output=new Headers(response.headers); output.delete('content-encoding'); output.delete('content-length');
      return new Response(response.body,{status:response.status,headers:output});
    }
    if(request.method==='POST') {
      if(!originAllowed(request.headers.get('origin'))) return json({detail:'Origin is not permitted.'},403);
    }
    if(request.method==='GET') {
      if(path==='health') { await snapshot(); return json({status:'ok',backend:'supabase'}); }
      if(path==='auction') return json(await snapshot());
      if(path==='admin/me') return json(await userRpc('blitz_admin_me'));
      if(['admin/registrations','admin/emails','admin/audit','admin/registrations.csv'].includes(path)) {
        const kind=path.endsWith('.csv') ? 'registrations' : path.split('/')[1];
        const rows=await userRpc<Record<string,unknown>[]>('blitz_admin_data',{p_kind:kind});
        if(path.endsWith('.csv')) return new Response(csv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="blitz-registrations.csv"','Cache-Control':'no-store'}});
        return json(rows);
      }
      if(path.startsWith('photos/')) {
        const id=path.split('/')[1]; if(!UUID.test(id)) return json({detail:'Photo not found.'},404);
        let key:string|null;
        try { key=await userRpc<string|null>('blitz_photo',{p_id:id}); }
        catch(e) {
          if(!(e instanceof SupabaseError) || ![401,403].includes(e.status)) throw e;
          key=await publicClient().rpc<string|null>('blitz_photo',{p_id:id});
        }
        if(!key) return json({detail:'Photo not found.'},404);
        serviceClient(); // Validate server credentials before reading private bytes.
        const {url}=supabaseConfig();
        const response=await fetch(`${url}/storage/v1/object/authenticated/blitz-photos/${encodeURIComponent(key)}`,{
          headers:{apikey:process.env.SUPABASE_SECRET_KEY || ''},cache:'no-store',signal:AbortSignal.timeout(10_000),
        });
        if(!response.ok) return json({detail:'Photo not found.'},404);
        return new Response(response.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
      }
    }
    if(request.method==='POST') {
      if(path==='registrations') return await register(request);
      const body=await bodyJson(request);
      if(!body || typeof body!=='object' || Array.isArray(body)) throw new InputError('Send a valid request.');
      if(path==='registrations/verify') {
        await rateLimit(request,'verify',30);
        if(typeof body.token!=='string' || !/^[a-zA-Z0-9_-]{40,100}$/.test(body.token)) throw new InputError('This verification link is invalid.');
        return json(await serviceClient().rpc('blitz_verify',{p_hash:hash(body.token)}));
      }
      if(path==='admin/login') {
        await rateLimit(request,'login',8);
        if(typeof body.email!=='string' || typeof body.password!=='string' || body.email.length>200 || body.password.length>200)
          throw new InputError('Enter your organiser email and password.');
        return json(await login(body.email.trim().toLowerCase(),body.password));
      }
      if(path==='admin/logout') {
        const token=(await cookies()).get('blitz_access')?.value;
        try { if(token) await publicClient(token).request('/auth/v1/logout',{method:'POST'}); }
        catch { /* Clear the browser session even when Auth is temporarily unavailable. */ }
        await clearSession(); return json({authenticated:false});
      }
      if(path==='admin/teams' || /^admin\/auction\/(start|bid|sell|unsold|cancel|allocate)$/.test(path)) {
        if(!Number.isInteger(body.version) || body.version<0 || !UUID.test(body.command_id || '') ||
          (body.team_id != null && (!Number.isInteger(body.team_id) || body.team_id<1 || body.team_id>8)))
          throw new InputError('Provide a valid command ID and auction version.');
        return json(await userRpc('blitz_auction_command',{
          p_action:path==='admin/teams' ? 'teams' : path.split('/')[2], p_version:body.version,
          p_command_id:body.command_id,p_team_id:body.team_id ?? null,p_teams:body.teams ?? null,
        }));
      }
    }
    return json({detail:'Endpoint not found.'},404);
  } catch(e) {
    if(e instanceof SupabaseError || e instanceof InputError) return json({detail:e.message},e.status);
    return json({detail:'The event service is unavailable. Please try again shortly.'},503);
  }
}
export { handle as GET, handle as POST };
