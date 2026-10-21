import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SupabaseHttp, SupabaseError} from '../src/lib/supabase-http.ts';
import {registrationData} from '../src/lib/registration-validation.ts';
import {mergeAuctionState} from '../src/lib/auction-state.ts';
import {subscribeAuction} from '../src/lib/auction-realtime.ts';
import {createMailHandler} from '../supabase/functions/deliver-mail/handler.ts';

function form(extra={}) {
  const data={name:'Example Student',email:'m2024bsass027@stud.tiss.ac.in',role:'player',
    programme:'BSASS',year:'2',age:'20',gender:'female',region:'Andaman and Nicobar Islands',
    played_before:'no',sports:'["Football"]',consent:'true',...extra};
  const f=new FormData(); for(const [key,value] of Object.entries(data)) f.set(key,value); return f;
}
test('registration validation handles both roles and rejects forged or missing details',()=>{
  const p=registrationData(form()); assert.equal(p.played_before,false); assert.deepEqual(p.sports,['Football']);
  const v=registrationData(form({role:'volunteer',sports:'[]',volunteer_department:'Medical',volunteer_rationale:'I can coordinate first aid.'}));
  assert.equal(v.volunteer_department,'Medical');
  for(const extra of [{email:'x@example.com'},{age:'20.5'},{year:'0'},{region:'Invalid'},
    {played_before:''},{consent:'false'},{sports:'["Football","Football"]'},
    {sports:'["Basketball"]'},{volunteer_department:'Medical'},{name:'Bad\nName'},
    {role:'volunteer',sports:'[]',volunteer_department:'Operations',volunteer_rationale:''}])
    assert.throws(()=>registrationData(form(extra)));
});
test('REST adapter uses an apikey and a separate user bearer token without caching',async()=>{
  let request;
  const client=new SupabaseHttp('https://example.supabase.co/','publishable','user-jwt',async(url,init)=>{
    request={url,init}; return Response.json({authenticated:true});
  });
  assert.deepEqual(await client.rpc('blitz_admin_me'),{authenticated:true});
  assert.equal(request.url,'https://example.supabase.co/rest/v1/rpc/blitz_admin_me');
  assert.equal(request.init.headers.get('apikey'),'publishable');
  assert.equal(request.init.headers.get('authorization'),'Bearer user-jwt');
  assert.equal(request.init.cache,'no-store');
});
test('server secret keys are sent as apikey, not mistaken for JWTs',async()=>{
  const client=new SupabaseHttp('https://example.supabase.co','sb_secret_example',undefined,async(url,init)=>{
    assert.equal(init.headers.get('apikey'),'sb_secret_example'); assert.equal(init.headers.get('authorization'),null);
    return Response.json({ok:true});
  });
  assert.deepEqual(await client.rpc('blitz_register',{}),{ok:true});
});
test('REST errors map stale commands, permission failures and rate limits to useful HTTP statuses',async()=>{
  for(const [code,status] of [['40001',409],['23505',409],['23514',422],['42501',403],['P0429',429]]) {
    const client=new SupabaseHttp('https://example.supabase.co','key',undefined,async()=>Response.json({code,message:'test'},{status:400}));
    await assert.rejects(client.rpc('test'),e=>e instanceof SupabaseError && e.status===status);
  }
  const invalid=new SupabaseHttp('https://example.supabase.co','key',undefined,async()=>new Response('not json',{status:502}));
  await assert.rejects(invalid.rpc('test'),e=>e.status===503);
  const empty=new SupabaseHttp('https://example.supabase.co','key',undefined,async()=>new Response(null,{status:204}));
  assert.equal(await empty.request('/auth/v1/logout'),undefined);
});
test('out-of-order HTTP results cannot revert purse and roster to an older version',()=>{
  const current={phase:'active',version:4,teams:[{purse:1850,players:[{id:'sold'}]}]};
  assert.equal(mergeAuctionState(current,{phase:'active',version:3,teams:[{purse:2000,players:[]}]}),current);
  assert.equal(mergeAuctionState(current,{phase:'preview',version:0}),current);
  assert.equal(mergeAuctionState(current,{phase:'active',version:-1}),current);
  const initial={phase:'idle',version:0}; assert.equal(mergeAuctionState({phase:'preview',version:0},initial),initial);
});

class Socket {
  readyState=1; sent=[]; closed=false;
  send(data){this.sent.push(JSON.parse(data));}
  close(){this.closed=true;this.onclose?.({});}
  receive(data){this.onmessage?.({data:JSON.stringify(data)});}
}
test('realtime subscribes before refreshing and treats broadcast data only as invalidation',t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const socket=new Socket(), statuses=[], changes=[]; let endpoint;
  const stop=subscribeAuction({url:'https://example.supabase.co',key:'publishable',
    socketFactory:url=>{endpoint=url;return socket;},onChange:v=>changes.push(v),onStatus:s=>statuses.push(s)});
  assert.match(endpoint,/^wss:/); assert.ok(!endpoint.includes('secret'));
  socket.onopen(); const join=socket.sent[0]; assert.equal(join.event,'phx_join');
  socket.receive({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok'}});
  assert.deepEqual(statuses,[true]); assert.deepEqual(changes,[undefined]);
  socket.receive({topic:join.topic,event:'broadcast',payload:{event:'auction_changed',payload:{version:5,teams:[{purse:999999}]}}});
  t.mock.timers.tick(50); assert.deepEqual(changes,[undefined,5]);
  socket.receive({topic:join.topic,event:'broadcast',payload:{event:'auction_changed',payload:{version:'forged'}}});
  t.mock.timers.tick(50); assert.equal(changes.length,2);
  stop(); assert.equal(socket.closed,true); t.mock.timers.reset();
});
test('realtime heartbeat timeout reconnects and subscription cleanup cancels retries',t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const sockets=[]; const stop=subscribeAuction({url:'http://localhost:54321',key:'key',
    socketFactory:()=>{const s=new Socket();sockets.push(s);return s;},onChange:()=>{},onStatus:()=>{}});
  const first=sockets[0]; first.onopen(); const join=first.sent[0];
  first.receive({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok'}});
  t.mock.timers.tick(25_000); assert.equal(first.sent.at(-1).event,'heartbeat');
  t.mock.timers.tick(25_000); assert.equal(first.closed,true);
  t.mock.timers.tick(1000); assert.equal(sockets.length,2);
  stop(); t.mock.timers.tick(60_000); assert.equal(sockets.length,2); t.mock.timers.reset();
});

const config={url:'https://example.supabase.co',key:'server-secret',workerSecret:'x'.repeat(40),resendKey:'provider-secret',from:'BLITZ <events@example.com>'};
const workerRequest=()=>new Request('https://example.supabase.co/functions/v1/deliver-mail',{
  method:'POST',headers:{authorization:`Bearer ${config.workerSecret}`},
});
test('mail worker rejects unauthorised requests before making any network calls',async()=>{
  let calls=0; const handler=createMailHandler(config,async()=>{calls++;throw new Error();});
  const response=await handler(new Request('https://example.com',{method:'POST'}));
  assert.equal(response.status,401); assert.equal(calls,0);
});
test('mail worker sends with an idempotency key and acknowledges the exact lease',async()=>{
  let claimed=false; const messages=[];
  const handler=createMailHandler(config,async(url,init)=>{
    const body=JSON.parse(init.body); messages.push({url,init,body});
    if(url.endsWith('blitz_mail_claim')) {
      if(claimed)return Response.json(null); claimed=true;
      return Response.json({id:1,key:'assignment:player-id',recipient:'student@tiss.edu',subject:'Welcome',body:'Message',lease_token:'lease'});
    }
    if(url==='https://api.resend.com/emails') {
      assert.equal(init.headers['Idempotency-Key'],'blitz-assignment:player-id');
      return Response.json({id:'sent'});
    }
    assert.equal(body.p_lease_token,'lease'); assert.equal(body.p_success,true); return Response.json(true);
  });
  const response=await handler(workerRequest()); assert.deepEqual(await response.json(),{sent:1,retried:0});
  assert.equal(messages.length,4);
});
test('mail provider errors persist retry state instead of reporting success',async()=>{
  let claimed=false;
  const handler=createMailHandler(config,async(url,init)=>{
    if(url.endsWith('blitz_mail_claim')) {
      if(claimed)return Response.json(null); claimed=true;
      return Response.json({id:1,key:'job',recipient:'student@tiss.edu',subject:'Welcome',body:'Message',lease_token:'lease'});
    }
    if(url==='https://api.resend.com/emails')return Response.json({error:'Unavailable'},{status:503});
    assert.equal(JSON.parse(init.body).p_success,false);return Response.json(true);
  });
  assert.deepEqual(await (await handler(workerRequest())).json(),{sent:0,retried:1});
});
