import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderMail} from '../supabase/functions/deliver-mail/templates.ts';
import {createMailHandler} from '../supabase/functions/deliver-mail/handler.ts';
import {createSmtpSender} from '../supabase/functions/deliver-mail/smtp.ts';

const data={registration_id:'fixture-id',name:'Campus Player',email:'player@example.test',role:'player',programme:'BSASS',year:2,age:20,gender:'female',region:'Maharashtra',played_before:false,
  sports:['Football','Cricket','Badminton','Table tennis','Weightlifting','Chess','Tug of war','Dodgeball'],website_url:'https://blitz-landing-theta.vercel.app'};
const job=(extra={})=>({subject:'Stored subject',body:'Stored fallback',template:'registration',data,...extra});
const worker={url:'https://fixture.supabase.co',key:'fixture-server-key',workerSecret:'w'.repeat(40),from:'BLITZ <sender@example.test>'};
const request=()=>new Request('https://fixture.supabase.co/functions/v1/deliver-mail',{method:'POST',headers:{Authorization:`Bearer ${worker.workerSecret}`}});

test('registration receipt contains every sport and submitted details with no verification action',()=>{
  const mail=renderMail(job());
  for(const value of ['Football','Cricket','Badminton','Table Tennis','Power lifting','Chess','Tug of War','Dodgeball','Campus Player','BSASS','Maharashtra','player@example.test']) {
    assert.ok(mail.html.includes(value),value);assert.ok(mail.text.includes(value),value);
  }
  assert.match(mail.subject,/registration is complete/);
  assert.ok(!/verify|verification/i.test(mail.html+mail.text));
  assert.equal(mail.attachments.length,1);
  const image=mail.attachments[0];
  assert.equal(image.contentType,'image/png');assert.ok(mail.html.includes(`cid:${image.cid}`));
  assert.deepEqual([...Buffer.from(image.content,'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(!mail.html.includes('<svg')); // Source artwork is rasterised for mail compatibility.
});
test('volunteer receipt shows the department and rationale without player-auction instructions',()=>{
  const mail=renderMail(job({data:{...data,role:'volunteer',sports:[],department:'Operations',rationale:'I can coordinate equipment.'}}));
  assert.match(mail.html,/Operations/);assert.match(mail.text,/I can coordinate equipment\./);
  assert.ok(!/auction|player pool/i.test(mail.html+mail.text));
});
test('auction receipt identifies the final team and price while free allocation has distinct wording',()=>{
  const sale=renderMail(job({template:'assignment',data:{...data,team:'Court Kings',team_color:'#4c7051',price:225,source:'auction'}}));
  assert.match(sale.subject,/sold to Court Kings for ₹225/);assert.match(sale.text,/sold to Court Kings for ₹225/);
  assert.match(sale.html,/Court Kings/);assert.match(sale.html,/₹225/);assert.match(sale.html,/\/teams/);
  const free=renderMail(job({template:'assignment',data:{...data,team:'Court Kings',price:0,source:'random'}}));
  assert.ok(!/sold/i.test(free.subject+free.text+free.html));assert.match(free.text,/at no cost/);assert.match(free.html,/₹0/);
});
test('mail HTML escapes participant input and rejects unsafe links and injected team colours',()=>{
  const malicious='<img src=x onerror="alert(1)">';
  const mail=renderMail(job({template:'assignment',data:{...data,name:malicious,team:'<script>bad()</script>',team_color:'red;display:none',price:20,source:'auction',website_url:'javascript:alert(1)'}}));
  assert.ok(!mail.html.includes(malicious));assert.ok(!mail.html.includes('<script>'));assert.ok(!mail.html.includes('javascript:'));
  assert.match(mail.html,/&lt;script&gt;/);assert.ok(!mail.html.includes('red;display:none'));
});
test('malformed typed mail is rejected while older text-only jobs remain readable',()=>{
  for(const extra of [{data:null},{data:{...data,sports:[]}},{template:'assignment',data:{...data,team:'Court Kings',price:-1,source:'auction'}},{template:'unknown'}]) assert.throws(()=>renderMail(job(extra)));
  assert.deepEqual(renderMail(job({template:'legacy'})),{subject:'Stored subject',text:'Stored fallback'});
});
test('SMTP receives multipart HTML, plain text and an inline memory attachment',async()=>{
  let sent;
  const sender=createSmtpSender({host:'smtp.gmail.com',username:'sender@example.test',password:'fixture-only'},()=>({sendMail:async value=>{sent=value;return {accepted:[value.to]};}}));
  const mail=renderMail(job());
  assert.equal(await sender({...mail,from:worker.from,to:'student@tiss.edu',key:'registration:fixture'}),true);
  assert.equal(sent.html,mail.html);assert.equal(sent.text,mail.text);assert.equal(sent.attachments[0].cid,mail.attachments[0].cid);
  assert.equal(sent.attachments[0].encoding,'base64');assert.equal('path' in sent.attachments[0],false);
});
test('both delivery providers render the new receipt and acknowledge its exact lease',async()=>{
  for(const provider of ['smtp','resend']) {
    let claimed=false,smtpMessage,resendMessage,ack;
    const handler=createMailHandler({...worker,provider,resendKey:'fixture-provider-key'},async(url,init)=>{
      if(url.endsWith('blitz_mail_claim')) {
        if(claimed)return Response.json(null);claimed=true;
        return Response.json({...job(),id:1,key:'registration:fixture',recipient:'student@tiss.edu',lease_token:'fixture-lease'});
      }
      if(url==='https://api.resend.com/emails') {resendMessage=JSON.parse(init.body);return Response.json({id:'accepted'});}
      ack=JSON.parse(init.body);return Response.json(true);
    },async value=>{smtpMessage=value;return true;});
    assert.deepEqual(await (await handler(request())).json(),{sent:1,retried:0});
    const delivered=provider==='smtp'?smtpMessage:resendMessage;
    assert.match(delivered.subject,/registration is complete/);assert.match(delivered.html,/Football/);
    assert.ok(delivered.text);assert.equal(delivered.attachments.length,1);
    if(provider==='resend') assert.equal(delivered.attachments[0].content_id,'blitz-registration@mail.tiss.ac.in');
    assert.deepEqual(ack,{p_id:1,p_lease_token:'fixture-lease',p_success:true});
  }
});
