import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SupabaseHttp, SupabaseError} from '../src/lib/supabase-http.ts';
import {registrationData} from '../src/lib/registration-validation.ts';
import {normaliseWhatsapp, formatWhatsapp} from '../src/lib/whatsapp.ts';
import {mergeAuctionState} from '../src/lib/auction-state.ts';
import {subscribeAuction} from '../src/lib/auction-realtime.ts';
import {createMailHandler} from '../supabase/functions/deliver-mail/handler.ts';

function form(extra={}) {
  const data={name:'Example Student',email:'m2024bsass027@stud.tiss.ac.in',whatsapp:'98765 43210',role:'player',
    programme:'BSASS',year:'2',age:'20',gender:'female',region:'Andaman and Nicobar Islands',
    played_before:'no',sports:'["Football"]',consent:'true',...extra};
  const f=new FormData(); for(const [key,value] of Object.entries(data)) f.set(key,value); return f;
}
test('registration validation handles both roles and rejects forged or missing details',()=>{
  const p=registrationData(form()); assert.equal(p.whatsapp,'+919876543210'); assert.equal(p.played_before,false); assert.deepEqual(p.sports,['Football']);
  const v=registrationData(form({role:'volunteer',sports:'[]',volunteer_department:'Medical',volunteer_rationale:'I can coordinate first aid.'}));
  assert.equal(v.volunteer_department,'Medical');
  for(const extra of [{email:'x@example.com'},{age:'20.5'},{year:'0'},{region:'Invalid'},
    {played_before:''},{whatsapp:''},{whatsapp:'12345'},{consent:'false'},{sports:'["Football","Football"]'},
    {sports:'["Basketball"]'},{volunteer_department:'Medical'},{name:'Bad\nName'},
    {role:'volunteer',sports:'[]',volunteer_department:'Operations',volunteer_rationale:''}])
    assert.throws(()=>registrationData(form(extra)));
});
test('WhatsApp numbers normalise to E.164 and reject implausible input',()=>{
  for(const input of ['9876543210','98765 43210','098765-43210','919876543210','+91 98765 43210','(+91) 98765.43210'])
    assert.equal(normaliseWhatsapp(input),'+919876543210',input);
  assert.equal(normaliseWhatsapp('+44 7700 900123'),'+447700900123');
  for(const input of ['','12345','5876543210','+91 12345 67890','+0123456789','98765abcde','+9198765432101'])
    assert.equal(normaliseWhatsapp(input),null,input);
  assert.equal(formatWhatsapp('+919876543210'),'+91 98765 43210');
  assert.equal(formatWhatsapp(null),'Not provided');
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

test('SMTP delivery uses TLS on 465, a stable message ID and the queued recipient',async()=>{
  const {createSmtpSender}=await import('../supabase/functions/deliver-mail/smtp.ts');
  const messages=[];let options;
  const sender=createSmtpSender({host:'smtp.gmail.com',port:'465',username:'sender@example.test',password:'fixture-app-password'},value=>{
    options=value;
    return {sendMail:async message=>{messages.push(message);return {accepted:[message.to]};}};
  });
  assert.ok(sender);assert.equal(options,undefined);
  const message={from:'BLITZ <sender@example.test>',to:'student@tiss.edu',subject:'Verify',text:'Private verification link',key:'registration:fixture-id'};
  assert.equal(await sender(message),true);assert.equal(await sender(message),true);
  assert.equal(options.secure,true);assert.equal(options.requireTLS,true);assert.equal(options.port,465);
  assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);
  assert.equal(messages[0].messageId,messages[1].messageId);
  assert.match(messages[0].messageId,/^<blitz-[a-f0-9]{64}@example\.test>$/);
  assert.equal(messages[0].to,message.to);assert.equal(messages[0].text,message.text);
  assert.equal('password' in messages[0],false);
});
test('SMTP config rejects missing credentials and ports blocked by hosted Edge Functions',async()=>{
  const {createSmtpSender}=await import('../supabase/functions/deliver-mail/smtp.ts');
  for(const extra of [{password:''},{host:''},{port:'25'},{port:'587'},{port:'NaN'},{port:'0'}]) {
    assert.equal(createSmtpSender({host:'smtp.gmail.com',port:'465',username:'sender@example.test',password:'fixture',...extra},()=>{throw new Error('Must not create transport');}),undefined);
  }
});
test('an unauthorised worker invocation cannot open an SMTP connection or claim mail',async()=>{
  const {createSmtpSender}=await import('../supabase/functions/deliver-mail/smtp.ts');
  const sender=createSmtpSender({host:'smtp.gmail.com',username:'sender@example.test',password:'fixture'},()=>{throw new Error('Must not open transport');});
  const handler=createMailHandler({...config,provider:'smtp',resendKey:undefined},async()=>{throw new Error('Must not call database');},sender);
  assert.equal((await handler(new Request('https://example.com',{method:'POST'}))).status,401);
});
test('SMTP worker marks accepted queued messages sent without requiring a Resend key',async()=>{
  let claimed=false;const jobs=[],acknowledgements=[];
  const handler=createMailHandler({...config,provider:'smtp',resendKey:undefined},async(url,init)=>{
    assert.ok(url.startsWith(config.url));
    if(url.endsWith('blitz_mail_claim')) {
      if(claimed)return Response.json(null);claimed=true;
      return Response.json({id:7,key:'registration:student',recipient:'student@tiss.edu',subject:'Verify',body:'Message',lease_token:'smtp-lease'});
    }
    acknowledgements.push(JSON.parse(init.body));return Response.json(true);
  },async message=>{jobs.push(message);return true;});
  assert.deepEqual(await (await handler(workerRequest())).json(),{sent:1,retried:0});
  assert.equal(jobs[0].to,'student@tiss.edu');
  assert.deepEqual(acknowledgements,[{p_id:7,p_lease_token:'smtp-lease',p_success:true}]);
});
test('SMTP failures leave mail for the database retry schedule',async()=>{
  let claimed=false;
  const handler=createMailHandler({...config,provider:'smtp',resendKey:undefined},async(url,init)=>{
    if(url.endsWith('blitz_mail_claim')) {
      if(claimed)return Response.json(null);claimed=true;
      return Response.json({id:7,key:'registration:student',recipient:'student@tiss.edu',subject:'Verify',body:'Message',lease_token:'smtp-lease'});
    }
    assert.equal(JSON.parse(init.body).p_success,false);return Response.json(true);
  },async()=>{throw new Error('Private SMTP diagnostic must not be returned');});
  const response=await handler(workerRequest());
  assert.deepEqual(await response.json(),{sent:0,retried:1});
});
test('an unconfigured or unknown mail provider cannot consume queued jobs',async()=>{
  for(const provider of ['smtp','unknown']) {
    const handler=createMailHandler({...config,provider},async()=>{throw new Error('Must not claim');});
    assert.equal((await handler(workerRequest())).status,503);
  }
});
test('SMTP recipient rejection is not mistaken for successful delivery',async()=>{
  const {createSmtpSender}=await import('../supabase/functions/deliver-mail/smtp.ts');
  const sender=createSmtpSender({host:'smtp.gmail.com',username:'sender@example.test',password:'fixture'},()=>({sendMail:async()=>({accepted:[]})}));
  assert.equal(await sender({from:'BLITZ <sender@example.test>',to:'student@tiss.edu',subject:'Verify',text:'Message',key:'job'}),false);
});
