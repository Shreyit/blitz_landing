import assert from 'node:assert/strict';
import {beforeEach,after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

// Invoke actual Next.js route handlers in-process. Only cookies and upstream
// HTTP are replaced; no server port, Supabase account or outgoing email is used.
const cookies=new Map();
globalThis.__blitzTestCookies={get:name=>cookies.has(name)?{value:cookies.get(name)}:undefined,
  set:(name,value,options)=>{if(options?.maxAge===0)cookies.delete(name);else cookies.set(name,value);}};
const hooks=registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(specifier==='next/headers')return {url:'data:text/javascript,export async function cookies(){return globalThis.__blitzTestCookies}',shortCircuit:true};
  if(specifier==='next/server')return nextResolve('next/server.js',context);
  if(specifier.startsWith('@/'))return nextResolve(pathToFileURL(path.resolve('src',specifier.slice(2)+'.ts')).href,context);
  if(specifier.startsWith('./') && !path.extname(specifier) && context.parentURL?.endsWith('.ts'))
    return nextResolve(new URL(specifier+'.ts',context.parentURL).href,context);
  return nextResolve(specifier,context);
}});
const {GET,POST}=await import('../src/app/api/[...path]/route.ts');
const {NextRequest}=await import('next/server.js');
const originalFetch=globalThis.fetch;
const savedEnv={...process.env};
let calls=[], responder;
beforeEach(()=>{
  cookies.clear();calls=[];
  process.env.NEXT_PUBLIC_BACKEND_PROVIDER='supabase';
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='publishable';
  process.env.SUPABASE_SECRET_KEY='server-secret';
  process.env.PUBLIC_URL='http://localhost:3000';
  process.env.ALLOWED_ORIGINS='http://localhost:3000';
  responder=async()=>Response.json(null);
  globalThis.fetch=async(url,init)=>{const call={url:String(url),init};calls.push(call);return responder(call);};
});
after(()=>{
  globalThis.fetch=originalFetch;hooks.deregister();delete globalThis.__blitzTestCookies;
  for(const k of Object.keys(process.env))if(!(k in savedEnv))delete process.env[k];
  Object.assign(process.env,savedEnv);
});
function request(endpoint,body,headers={}){
  const init=body===undefined?{}:{method:'POST',body:body instanceof FormData ? body : JSON.stringify(body),
    headers:body instanceof FormData ? headers : {'Content-Type':'application/json',...headers}};
  if(body===undefined)init.headers=headers;
  return new NextRequest('http://localhost:3000/api/'+endpoint,init);
}
function route(endpoint,body,headers){
  return (body===undefined?GET:POST)(request(endpoint,body,headers),{params:Promise.resolve({path:endpoint.split('/')})});
}
test('Supabase health and public state read the safe projection without server credentials',async()=>{
  delete process.env.SUPABASE_SECRET_KEY;
  responder=async()=>Response.json([{snapshot:{version:3,teams:[]}}]);
  const response=await route('auction'); assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{version:3,teams:[]});
  assert.equal(calls[0].init.headers.get('apikey'),'publishable');
});
test('cross-origin mutations and anonymous organiser access fail before any privileged request',async()=>{
  assert.equal((await route('admin/login',{email:'admin@tiss.edu',password:'password'},{origin:'https://other.example'})).status,403);
  assert.equal((await route('admin/me')).status,401); assert.equal(calls.length,0);
});
test('the configured website and explicit preview origins accept trailing slashes without trusting unrelated sites',async()=>{
  process.env.PUBLIC_URL='https://blitz-landing-theta.vercel.app/';
  process.env.ALLOWED_ORIGINS=' http://localhost:3000, https://blitz-preview.example/ ';
  // Malformed command input reaches validation only after the origin check.
  for (const origin of ['https://blitz-landing-theta.vercel.app','https://blitz-preview.example','http://localhost:3000']) {
    assert.equal((await route('admin/auction/sell',{}, {origin})).status,422);
  }
  for (const origin of ['https://other.example','null','https://blitz-landing-theta.vercel.app.attacker.example']) {
    assert.equal((await route('admin/auction/sell',{}, {origin})).status,403);
  }
  assert.equal(calls.length,0);
});
test('login checks the organiser allowlist before saving a session',async()=>{
  responder=async c=>{
    if(c.url.endsWith('blitz_rate_limit'))return Response.json(null);
    if(c.url.includes('/auth/v1/token'))return Response.json({access_token:'user-token',refresh_token:'refresh-token',expires_in:3600});
    assert.equal(c.init.headers.get('authorization'),'Bearer user-token');
    return Response.json({authenticated:true});
  };
  const response=await route('admin/login',{email:'admin@tiss.edu',password:'password'});
  assert.equal(response.status,200); assert.equal(cookies.get('blitz_access'),'user-token');
  assert.equal(cookies.get('blitz_refresh'),'refresh-token');
});
test('valid Auth credentials without organiser membership never create a dashboard session',async()=>{
  responder=async c=>{
    if(c.url.endsWith('blitz_rate_limit'))return Response.json(null);
    if(c.url.includes('/auth/v1/token'))return Response.json({access_token:'outsider',refresh_token:'refresh',expires_in:3600});
    return Response.json({code:'42501',message:'Organiser access is required.'},{status:403});
  };
  assert.equal((await route('admin/login',{email:'other@tiss.edu',password:'password'})).status,403);
  assert.equal(cookies.size,0);
});
test('expired access tokens refresh and retry an authorised request',async()=>{
  cookies.set('blitz_access','expired');cookies.set('blitz_refresh','refresh');
  responder=async c=>{
    if(c.url.includes('/auth/v1/token?grant_type=refresh_token'))return Response.json({access_token:'fresh',refresh_token:'new-refresh',expires_in:3600});
    if(c.init.headers.get('authorization')==='Bearer expired')return Response.json({message:'expired'},{status:401});
    assert.equal(c.init.headers.get('authorization'),'Bearer fresh');return Response.json({authenticated:true});
  };
  assert.equal((await route('admin/me')).status,200);assert.equal(cookies.get('blitz_access'),'fresh');
});
test('malformed JSON and invalid command IDs return validation errors',async()=>{
  const req=new NextRequest('http://localhost:3000/api/admin/auction/sell',{method:'POST',body:'{invalid'});
  assert.equal((await POST(req,{params:Promise.resolve({path:['admin','auction','sell']})})).status,422);
  assert.equal((await route('admin/auction/sell',{version:1,command_id:'bad'})).status,422);
  assert.equal(calls.length,0);
});
async function registration(){
  const form=new FormData();
  const data={name:'Example Student',email:'student@tiss.edu',role:'player',programme:'BSASS',
    year:'2',age:'20',gender:'female',region:'Maharashtra',played_before:'yes',sports:'["Chess"]',consent:'true'};
  for(const [k,v]of Object.entries(data))form.set(k,v);
  const photo=await sharp({create:{width:800,height:600,channels:3,background:'#315a36'}}).png().toBuffer();
  form.set('photo',new File([photo],'photo.png',{type:'image/png'}));return form;
}
test('registration normalizes the image and sends only validated intake to the service-only RPC',async()=>{
  let payload;
  responder=async c=>{
    if(c.url.endsWith('blitz_rate_limit'))return Response.json(null);
    if(c.url.includes('/storage/v1/object/')){
      assert.equal(c.init.headers.get('apikey'),'server-secret');
      const meta=await sharp(c.init.body).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.width,600);assert.equal(meta.height,600);
      return Response.json({Key:'photo'});
    }
    payload=JSON.parse(c.init.body);return Response.json({id:payload.p_id,message:'saved'});
  };
  const form=await registration();form.set('verified','true');
  const response=await route('registrations',form);assert.equal(response.status,201);
  assert.equal(payload.p_data.verified,undefined);assert.equal(payload.p_data.played_before,true);
  assert.equal(payload.p_hash,null);assert.equal(payload.p_token,null);
});
test('definite registration rejection cleans up the uploaded photo',async()=>{
  responder=async c=>{
    if(c.url.endsWith('blitz_register'))return Response.json({code:'23505',message:'duplicate'},{status:409});
    return Response.json(null);
  };
  assert.equal((await route('registrations',await registration())).status,409);
  const cleanup=calls.find(c=>c.init.method==='DELETE');assert.ok(cleanup);
  assert.equal(JSON.parse(cleanup.init.body).prefixes.length,1);
});
test('ambiguous registration network failure does not delete a possibly committed photo',async()=>{
  responder=async c=>{if(c.url.endsWith('blitz_register'))throw new Error('lost response');return Response.json(null);};
  assert.equal((await route('registrations',await registration())).status,503);
  assert.ok(!calls.some(c=>c.init.method==='DELETE'));
});
test('invalid image content is rejected before storage upload',async()=>{
  responder=async()=>Response.json(null);
  const form=await registration();form.set('photo',new File(['<svg/>'],'photo.jpg',{type:'image/jpeg'}));
  assert.equal((await route('registrations',form)).status,422);
  assert.ok(!calls.some(c=>c.url.includes('/storage/')));
});
test('photo endpoint does not request private storage when eligibility is denied',async()=>{
  responder=async()=>Response.json(null);
  assert.equal((await route('photos/00000000-0000-4000-8000-000000000001')).status,404);
  assert.ok(!calls.some(c=>c.url.includes('/storage/')));
});
test('eligible photos are served from private storage with server credentials',async()=>{
  responder=async c=>{
    if(c.url.endsWith('blitz_photo'))return Response.json('00000000-0000-4000-8000-000000000001.jpg');
    assert.ok(c.url.includes('/object/authenticated/blitz-photos/'));
    assert.equal(c.init.headers.apikey,'server-secret');return new Response(new Uint8Array([255,216,255,217]));
  };
  const response=await route('photos/00000000-0000-4000-8000-000000000001');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.match(response.headers.get('cache-control'),/private/);
});
test('organiser CSV export quotes cells and prevents spreadsheet formula execution',async()=>{
  cookies.set('blitz_access','organiser-token');
  responder=async()=>Response.json([{name:' =HYPERLINK("bad")',email:'student@tiss.edu',sports:['Chess','Football']}]);
  const response=await route('admin/registrations.csv');const csv=await response.text();
  assert.equal(response.status,200);assert.ok(csv.includes('"\' =HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Chess, Football"'));assert.match(response.headers.get('content-disposition'),/attachment/);
});
test('the existing API still proxies in explicitly selected FastAPI mode',async()=>{
  process.env.NEXT_PUBLIC_BACKEND_PROVIDER='fastapi';
  responder=async c=>{assert.match(c.url,/127\.0\.0\.1:8000\/api\/auction$/);return Response.json({phase:'idle'});};
  assert.equal((await route('auction')).status,200);
});
