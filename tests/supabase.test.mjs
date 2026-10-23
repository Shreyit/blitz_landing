import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// PGlite executes real PostgreSQL/PLpgSQL in-process. Only Supabase platform
// schemas (Auth, Storage, Realtime transport) are stubbed, not application SQL.
const db = new PGlite();
const organiser = '00000000-0000-4000-8000-000000000001';
const outsider = '00000000-0000-4000-8000-000000000002';
let sequence = 0;
let legacyUpgrade;
async function scalar(sql, args = []) { return (await db.query(sql, args)).rows[0]?.value; }
async function as(role, uid = '') {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
}
async function state() { return scalar('select snapshot as value from public.auction_public_state where id=1'); }
async function command(action, team = null, id = randomUUID(), version = undefined, teams = null) {
  if (version === undefined) version = (await state()).version;
  return scalar('select public.blitz_auction_command($1, $2, $3, $4, $5) as value', [action, version, id, team, teams]);
}
async function register(role = 'player', extra = {}) {
  const id = randomUUID(); const n = ++sequence;
  const data = {name: `Student ${n}`, email: `student${n}@stud.tiss.ac.in`, role,
    programme: 'BSASS', year: 2, age: 20, gender: 'female', region: 'Maharashtra',
    played_before: false, sports: role === 'player' ? ['Football'] : [], consent: true,
    ...(role === 'volunteer' ? {volunteer_department: 'Operations', volunteer_rationale: 'I can coordinate the venue.'} : {}), ...extra};
  await as('service_role');
  await scalar('select public.blitz_register($1,$2,$3,$4,$5) as value', [id, data, n.toString(16).padStart(64,'0'), 'verification-token', 'http://localhost:3000']);
  await as('postgres');
  return id;
}
async function eligible(count = 1) {
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(await register());
  await db.exec('update blitz.registrations set verified=true');
  await as('authenticated', organiser);
  return ids;
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage; create table storage.buckets(
      id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create schema realtime; create table realtime.test_messages(payload jsonb, event text, topic text, private boolean);
    create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void
      language sql as $$ insert into realtime.test_messages values(payload,event,topic,private); $$;
  `);
  for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if(name==='202610220006_confirmation_emails.sql') {
      const legacyData={name:'Legacy Pilot',email:'legacy@tiss.edu',role:'player',programme:'BSASS',year:2,age:20,
        gender:'female',region:'Maharashtra',played_before:false,sports:['Football'],consent:true};
      await scalar('select public.blitz_register($1,$2,$3,$4,$5) as value',[randomUUID(),legacyData,'a'.repeat(64),'old-private-token','https://example.test']);
      await scalar('select public.blitz_register($1,$2,$3,$4,$5) as value',[randomUUID(),{...legacyData,email:'already-sent@tiss.edu'},'b'.repeat(64),'old-sent-token','https://example.test']);
      await db.exec("update blitz.email_outbox set status='sent' where recipient='already-sent@tiss.edu'");
    }
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
    if(name==='202610220006_confirmation_emails.sql') legacyUpgrade={
      registrations:(await db.query('select verified,verification_hash,verification_expires from blitz.registrations')).rows,
      jobs:(await db.query('select recipient,status,template,body,data from blitz.email_outbox order by recipient')).rows,
    };
  }
  await db.query('insert into auth.users(id) values ($1),($2)', [organiser, outsider]);
  await db.query('insert into blitz.organiser_users(user_id) values ($1)', [organiser]);
});
beforeEach(async () => {
  await as('postgres');
  await db.exec(`truncate blitz.registrations, blitz.auction, blitz.bids, blitz.assignments,
    blitz.audit_events, blitz.email_outbox, blitz.rate_limits, realtime.test_messages restart identity cascade;
    insert into blitz.auction default values;
    update blitz.teams set purse=2000;
    select blitz.publish_snapshot();
    truncate realtime.test_messages;`);
});
after(async () => db.close());

test('all migrations execute and seed eight teams with one coherent public snapshot', async () => {
  const s = await state(); assert.equal(s.phase, 'idle'); assert.equal(s.teams.length, 8);
  assert.ok(s.teams.every(t => t.purse === 2000 && t.players.length === 0));
  // Confirmed team renames (migrations 010–012) must reach the public snapshot.
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(id => s.teams.find(t => t.id === id).name), ['The Monarchs', 'United Spartans', 'Shell Mates', 'SlytherWins', 'X Force United', 'Vikings', 'Shadow Strikers', 'The Symbiotes']);
});
test('SQL sports and region catalogues match the frontend configuration', async () => {
  const options = JSON.parse(await readFile('shared/registration-options.json', 'utf8'));
  const regions = (await db.query('select name from blitz.regions order by name')).rows.map(r=>r.name);
  assert.deepEqual(regions, [...options.regions].sort());
  assert.equal(await scalar('select count(*)::integer as value from blitz.sports'), 8);
});
test('anonymous spectators can read the projection but cannot mutate it or call admin RPCs', async () => {
  await as('anon'); assert.equal((await state()).version, 0);
  await assert.rejects(db.exec('update public.auction_public_state set snapshot=\'{}\''), /permission denied/);
  await assert.rejects(command('start', null, randomUUID(), 0), /permission denied/);
  await assert.rejects(db.exec('select * from blitz.registrations'), /permission denied/);
  await assert.rejects(db.exec('select public.blitz_mail_claim()'), /permission denied/);
});
test('an ordinary signed-in account cannot become an organiser', async () => {
  await as('authenticated', outsider);
  await assert.rejects(command('start'), /Organiser access/);
  await assert.rejects(db.exec("select public.blitz_admin_data('registrations')"), /Organiser access/);
  await assert.rejects(db.exec(`insert into blitz.organiser_users(user_id) values ('${outsider}')`), /permission denied/);
});
test('intake completes on submit and keeps separate player and volunteer entries', async () => {
  const player = await register('player', {email:'same@tiss.edu', verified:false});
  await register('volunteer', {email:'same@tiss.edu'});
  assert.equal(await scalar('select verified as value from blitz.registrations where id=$1',[player]), true);
  await assert.rejects(register('player', {email:'same@tiss.edu'}), /unique constraint/);
});
test('intake rejects invalid domains, demographics, sports, department, consent and absent previous participation', async () => {
  for (const extra of [{email:'x@gmail.com'}, {age:0}, {age:20.5}, {gender:'invalid'},
    {region:'Atlantis'}, {sports:['Football','Football']}, {sports:['Basketball']},
    {sports:[]}, {played_before:null}, {consent:false}, {volunteer_department:'Medical'}]) {
    await assert.rejects(register('player', extra));
  }
  await assert.rejects(register('volunteer', {volunteer_department:'Football'}));
  await assert.rejects(register('volunteer', {volunteer_rationale:''}));
  await assert.rejects(register('volunteer', {sports:['Chess']}));
});
test('registration needs no token or verification step and still closes when the auction starts', async () => {
  const id=await register();
  const row=(await db.query('select * from blitz.registrations where id=$1',[id])).rows[0];
  assert.equal(row.verified,true);assert.equal(row.verification_hash,null);assert.equal(row.verification_expires,null);
  const receipt=await scalar("select data as value from blitz.email_outbox where key=$1",['registration:'+id]);
  assert.deepEqual(receipt.sports,['Football']);assert.equal(receipt.role,'player');
  assert.ok(!JSON.stringify(receipt).includes('verification'));
  await as('service_role');
  assert.match((await scalar('select public.blitz_verify($1) as value',['old-token-hash'])).message,/no longer required/);
  await as('authenticated',organiser);assert.equal((await command('start')).total,1);
  await assert.rejects(register(),/Registration has closed/);
});
test('every completed player enters the queue while volunteer and private details stay out', async () => {
  await eligible(2); await register('volunteer'); await register();
  await as('authenticated',organiser); const s=await command('start'); assert.equal(s.total,3);
  const text=JSON.stringify(s);
  for (const privateField of ['@stud.tiss.ac.in','verification_hash','volunteer_rationale','gender','region','played_before']) assert.ok(!text.includes(privateField));
});
test('normal and rapid bid thresholds match the event rules', async () => {
  for (const [round,current,next] of [[0,0,20],[0,95,100],[0,100,110],[0,190,200],
    [0,200,225],[1,0,10],[1,10,15],[2,0,2],[2,2,4],[3,0,1],[3,1,2]]) {
    assert.equal(await scalar('select blitz.next_bid($1,$2) as value',[round,current]),next);
  }
});
test('a sale atomically changes purse and roster and enqueues exactly one assignment email', async () => {
  await eligible(); await command('start'); await command('bid',1);
  const id=randomUUID(), version=(await state()).version;
  const sold=await command('sell',null,id,version);
  assert.equal(sold.teams[0].purse,1980); assert.equal(sold.teams[0].players.length,1);
  assert.equal(sold.sold,1); assert.equal(sold.phase,'complete');
  assert.deepEqual(await command('sell',null,id,version),sold);
  await as('postgres');
  assert.equal(await scalar("select count(*)::integer as value from blitz.email_outbox where key like 'assignment:%'"),1);
  assert.equal(await scalar('select count(*)::integer as value from blitz.assignments'),1);
  assert.equal(await scalar("select count(*)::integer as value from blitz.audit_events where action='sell'"),1);
});
test('stale versions and reused command IDs with changed requests are rejected', async () => {
  await eligible(); await command('start'); const id=randomUUID(); await command('bid',1,id);
  await assert.rejects(command('bid',2,randomUUID(),0),/auction changed/);
  await assert.rejects(command('bid',2,id),/already used/);
  await assert.rejects(command('sell',null,id),/already used/);
});
test('insufficient purse and self-bidding fail without changing state', async () => {
  await eligible(); await command('start'); await command('bid',1);
  await assert.rejects(command('bid',1),/already leading/);
  await as('postgres'); await db.exec('update blitz.teams set purse=24 where id=2');
  await as('authenticated',organiser); const before=await state();
  await assert.rejects(command('bid',2),/cannot afford/); assert.deepEqual(await state(),before);
  await as('postgres'); await db.exec('update blitz.teams set purse=25 where id=2');
  await as('authenticated',organiser); assert.equal((await command('bid',2)).bid,25);
});
test('sale failure rolls back the assignment, purse, audit, outbox and projection', async () => {
  const [player]=await eligible(); await command('start'); await command('bid',1);
  await as('postgres');
  await db.query("insert into blitz.email_outbox(key,recipient,subject,body) values($1,'test@tiss.edu','test','test')",['assignment:'+player]);
  const before=await state();
  await as('authenticated',organiser); await assert.rejects(command('sell'),/unique constraint/);
  assert.deepEqual(await state(),before);
  await as('postgres'); assert.equal(await scalar('select count(*)::integer as value from blitz.assignments'),0);
  assert.equal(await scalar('select purse as value from blitz.teams where id=1'),2000);
  assert.equal(await scalar("select count(*)::integer as value from blitz.audit_events where action='sell'"),0);
});
test('bid cancellation is audited and unsold lots proceed through all rapid rounds', async () => {
  await eligible(); await command('start'); await command('bid',1);
  await assert.rejects(command('unsold'),/Cancel the current bids/);
  await command('cancel');
  await as('postgres'); assert.equal(await scalar('select cancelled as value from blitz.bids limit 1'),true);
  await as('authenticated',organiser);
  for(const opening of [10,2,1]) assert.equal((await command('unsold')).next_bid,opening);
  assert.equal((await command('unsold')).phase,'allocation');
});
test('random allocation saves once, costs zero, and balances shuffled cycles', async () => {
  await eligible(9); await command('start');
  for(let i=0;i<36;i++) await command('unsold');
  const id=randomUUID(); const v=(await state()).version; const draw=await command('allocate',null,id,v);
  assert.equal(draw.phase,'complete'); assert.equal(draw.sold,9);
  assert.ok(draw.teams.every(t=>t.purse===2000 && t.players.length>=1 && t.players.length<=2));
  assert.deepEqual(await command('allocate',null,id,v),draw);
  await assert.rejects(command('allocate'),/only after/);
});
test('team names can be exchanged before start but duplicate names and later edits fail', async () => {
  await as('authenticated',organiser); const teams=(await state()).teams.map(t=>({id:t.id,name:t.name}));
  [teams[0].name,teams[1].name]=[teams[1].name,teams[0].name];
  const saved=await command('teams',null,randomUUID(),0,teams);
  assert.equal(saved.teams[0].name,teams[0].name);
  const duplicate=teams.map(t=>({...t,name:'Same name'}));
  await assert.rejects(command('teams',null,randomUUID(),saved.version,duplicate),/distinct/);
  await eligible(); await command('start');
  await assert.rejects(command('teams',null,randomUUID(),undefined,teams),/fixed/);
});
test('volunteers never enter the auction queue, lots or allocation', async () => {
  const volunteer = await register('volunteer');
  const [player] = await eligible(1);
  await command('start');
  let s = await state();
  assert.equal(s.total, 1);
  assert.equal(s.current.id, player);
  await as('postgres');
  assert.equal(await scalar('select ($1::uuid = any(queue)) as value from blitz.auction where id=1', [volunteer]), false);
  await as('authenticated', organiser);
  await command('unsold'); await command('unsold'); await command('unsold'); await command('unsold');
  await command('allocate');
  s = await state();
  assert.equal(s.phase, 'complete');
  await as('postgres');
  assert.equal(await scalar('select count(*)::int as value from blitz.assignments where player_id=$1', [volunteer]), 0);
  assert.equal(await scalar('select count(*)::int as value from blitz.assignments where player_id=$1', [player]), 1);
  await assert.rejects(db.query('select blitz.assign_player($1, 1, 0, $2)', [volunteer, 'random']), /not eligible/);
});
test('private volunteer photos are inaccessible to spectators and ordinary accounts', async () => {
  const volunteer=await register('volunteer'); const player=await register();
  await db.exec("update blitz.registrations set verified=true where role='player'");
  await as('anon'); assert.equal(await scalar('select public.blitz_photo($1) as value',[volunteer]),null);
  assert.equal(await scalar('select public.blitz_photo($1) as value',[player]),player+'.jpg');
  await as('authenticated',outsider); assert.equal(await scalar('select public.blitz_photo($1) as value',[volunteer]),null);
  await as('authenticated',organiser); assert.equal(await scalar('select public.blitz_photo($1) as value',[volunteer]),volunteer+'.jpg');
});
test('shared database rate limits enforce their cap and reset after expiry', async () => {
  await as('service_role');
  for(let i=0;i<2;i++) await db.query('select public.blitz_rate_limit($1,2,60)',['test-key']);
  await assert.rejects(db.query('select public.blitz_rate_limit($1,2,60)',['test-key']),/Too many/);
  await as('postgres'); await db.exec("update blitz.rate_limits set expires_at=now()-interval '1 minute'");
  await as('service_role'); await db.query('select public.blitz_rate_limit($1,2,60)',['test-key']);
});
test('mail jobs use exclusive leases, retry backoff and stale-worker protection', async () => {
  await register(); await as('service_role');
  const job=await scalar('select public.blitz_mail_claim() as value'); assert.ok(job.lease_token);
  assert.equal(await scalar('select public.blitz_mail_claim() as value'),null);
  assert.equal(await scalar('select public.blitz_mail_finish($1,$2,false) as value',[job.id,randomUUID()]),false);
  assert.equal(await scalar('select public.blitz_mail_finish($1,$2,false) as value',[job.id,job.lease_token]),true);
  assert.equal(await scalar('select public.blitz_mail_claim() as value'),null);
  await as('postgres'); await db.exec("update blitz.email_outbox set next_attempt=now()-interval '1 minute'");
  await as('service_role'); const retried=await scalar('select public.blitz_mail_claim() as value');
  assert.notEqual(retried.lease_token,job.lease_token);
  assert.equal(await scalar('select public.blitz_mail_finish($1,$2,true) as value',[job.id,job.lease_token]),false);
  assert.equal(await scalar('select public.blitz_mail_finish($1,$2,true) as value',[job.id,retried.lease_token]),true);
});
test('realtime trigger sends only a version notification and rolls back on failed commands', async () => {
  await eligible(); await command('start');
  await as('postgres'); const messages=(await db.query('select * from realtime.test_messages')).rows;
  assert.equal(messages.length,1); assert.deepEqual(messages[0].payload,{version:1});
  assert.equal(messages[0].event,'auction_changed'); assert.equal(messages[0].topic,'blitz:auction');
  await as('authenticated',organiser); await assert.rejects(command('sell'),/valid bid/);
  await as('postgres'); assert.equal(await scalar('select count(*)::integer as value from realtime.test_messages'),1);
});

test('first-admin bootstrap is service-only, confirmed, idempotent and cannot replace an existing organiser', async () => {
  await db.exec('begin');
  try {
    await db.query('update auth.users set email=$1,email_confirmed_at=now() where id=$2', ['admin@example.test', outsider]);
    await db.query('update auth.users set email=$1,email_confirmed_at=now() where id=$2', ['owner@example.test', organiser]);
    for (const role of ['anon', 'authenticated']) {
      await as(role, outsider);
      await db.exec('savepoint denied');
      await assert.rejects(db.query('select public.blitz_bootstrap_organiser($1,$2)', [outsider, 'admin@example.test']), /permission denied/);
      await db.exec('rollback to savepoint denied');
    }
    await as('service_role');
    await db.exec('savepoint existing');
    await assert.rejects(db.query('select public.blitz_bootstrap_organiser($1,$2)', [outsider, 'admin@example.test']), /organiser already exists/);
    await db.exec('rollback to savepoint existing');
    await as('postgres'); await db.exec('delete from blitz.organiser_users');
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [outsider]);
    await as('service_role'); await db.exec('savepoint unconfirmed');
    await assert.rejects(db.query('select public.blitz_bootstrap_organiser($1,$2)', [outsider, 'admin@example.test']), /confirm the matching/);
    await db.exec('rollback to savepoint unconfirmed');
    await as('postgres'); await db.query('update auth.users set email_confirmed_at=now() where id=$1', [outsider]);
    await as('service_role');
    for (let i = 0; i < 2; i++) {
      const enabled = await scalar('select public.blitz_bootstrap_organiser($1,$2) as value', [outsider, 'ADMIN@example.test']);
      assert.equal(enabled.enabled, true);
    }
    await as('authenticated', outsider);
    assert.equal((await scalar('select public.blitz_admin_me() as value')).authenticated, true);
    await as('postgres'); assert.equal(await scalar('select count(*)::integer as value from blitz.organiser_users'), 1);
  } finally { await db.exec('rollback'); await as('postgres'); }
});

test('admin roster includes completed registrations and all submitted details without legacy secrets', async () => {
  const player = await register();
  const volunteer = await register('volunteer');
  await as('authenticated', organiser);
  const rows = await scalar("select public.blitz_admin_data('registrations') as value");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.ok([player, volunteer].includes(row.id));
    assert.equal(row.verified, true);
    assert.equal(row.photo, `/api/photos/${row.id}`);
    for (const key of ['name','email','programme','year','age','gender','region','played_before','sports','created_at','consent_at']) assert.ok(key in row, key);
    for (const key of ['verification_hash','verification_expires','photo_key']) assert.equal(key in row, false);
    assert.equal(await scalar('select public.blitz_photo($1) as value', [row.id]), `${row.id}.jpg`);
  }
  const crew = rows.find(row => row.id === volunteer);
  assert.equal(crew.volunteer_department, 'Operations');
  assert.equal(crew.volunteer_rationale, 'I can coordinate the venue.');
  await as('anon');
  assert.equal(await scalar('select public.blitz_photo($1) as value', [volunteer]), null);
});

test('sale mail captures the sold team, exact price, sports and source once in the sale transaction',async()=>{
  const [id]=await eligible();await command('start');await command('bid',2);
  const version=(await state()).version,commandId=randomUUID();
  await command('sell',null,commandId,version);await command('sell',null,commandId,version);
  await as('postgres');
  const rows=(await db.query("select template,data from blitz.email_outbox where key=$1",['assignment:'+id])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].template,'assignment');
  assert.equal(rows[0].data.team,(await state()).teams[1].name);
  assert.equal(rows[0].data.price,20);assert.equal(rows[0].data.source,'auction');
  assert.deepEqual(rows[0].data.sports,['Football']);
  assert.equal(rows[0].data.website_url,'http://localhost:3000');
  await as('service_role');
  const claimed=await scalar('select public.blitz_mail_claim() as value');
  assert.equal(claimed.template,'assignment');assert.equal(claimed.key,'assignment:'+id);
});

const mailPlatform=`
  create schema vault;
  create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
  insert into vault.decrypted_secrets values
    ('blitz_project_url','https://fixture.supabase.co'),
    ('blitz_mail_worker_secret','fixture-worker-secret-at-least-thirty-two-characters');
  create schema net;
  create table net.requests(url text,headers jsonb,body jsonb);
  create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
    returns bigint language plpgsql as $$ begin
      insert into net.requests values(url,headers,body);return 1;
    end $$;
`;
test('registration and sale enqueue authenticated worker wake-ups which roll back with the transaction',async()=>{
  await db.exec('begin');
  try {
    await db.exec(mailPlatform);
    const [id]=await eligible();
    await as('postgres');assert.equal(await scalar('select count(*)::integer as value from net.requests'),1);
    const first=(await db.query('select * from net.requests')).rows[0];
    assert.equal(first.url,'https://fixture.supabase.co/functions/v1/deliver-mail');
    assert.equal(first.headers.Authorization,'Bearer fixture-worker-secret-at-least-thirty-two-characters');
    assert.deepEqual(first.body,{});
    await as('authenticated',organiser);await command('start');await command('bid',1);
    await db.exec('savepoint sale');await command('sell');
    await as('postgres');assert.equal(await scalar('select count(*)::integer as value from net.requests'),2);
    await db.exec('rollback to savepoint sale');await as('postgres');
    assert.equal(await scalar('select count(*)::integer as value from net.requests'),1);
    assert.equal(await scalar('select count(*)::integer as value from blitz.assignments'),0);
    assert.equal(await scalar("select count(*)::integer as value from blitz.email_outbox where key=$1",['assignment:'+id]),0);
  } finally {await db.exec('rollback');await as('postgres');}
});
test('a worker wake-up failure cannot lose registration, prevent a sale or delay purse updates',async()=>{
  await db.exec('begin');
  try {
    await db.exec(mailPlatform);
    await db.exec(`create or replace function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
      returns bigint language plpgsql as $$ begin raise exception 'Network unavailable'; end $$;`);
    await eligible();await command('start');await command('bid',1);
    const sold=await command('sell');assert.equal(sold.teams[0].purse,1980);assert.equal(sold.sold,1);
    await as('postgres');assert.equal(await scalar('select count(*)::integer as value from blitz.email_outbox'),2);
    assert.equal(await scalar("select count(*)::integer as value from blitz.email_outbox where status='pending'"),2);
  } finally {await db.exec('rollback');await as('postgres');}
});

test('migration completes existing registrations and upgrades only queued receipts without resending accepted mail',()=>{
  assert.ok(legacyUpgrade.registrations.every(row=>row.verified && row.verification_hash===null && row.verification_expires===null));
  const pending=legacyUpgrade.jobs.find(row=>row.recipient==='legacy@tiss.edu');
  assert.equal(pending.template,'registration');assert.equal(pending.status,'pending');
  assert.deepEqual(pending.data.sports,['Football']);assert.ok(!pending.body.includes('old-private-token'));
  const sent=legacyUpgrade.jobs.find(row=>row.recipient==='already-sent@tiss.edu');
  assert.equal(sent.status,'sent');assert.equal(sent.template,'legacy');
});

test('pilot cleanup is service-only and preserves unrelated registrations, teams and organisers',async()=>{
  const target=await register(),survivor=await register('volunteer');
  await as('anon');await assert.rejects(db.exec('select public.blitz_pilot_registrations()'),/permission denied/);
  await as('authenticated',organiser);await assert.rejects(db.query('select public.blitz_delete_pilot_registrations($1)',[[target]]),/permission denied/);
  await as('service_role');const listed=await scalar('select public.blitz_pilot_registrations() as value');
  assert.equal(listed.phase,'idle');assert.equal(listed.registrations.length,2);
  const result=await scalar('select public.blitz_delete_pilot_registrations($1) as value',[[target]]);
  assert.equal(result.deleted_registrations,1);assert.equal(result.deleted_mail_jobs,1);assert.deepEqual(result.photo_keys,[`${target}.jpg`]);
  await as('postgres');assert.equal(await scalar('select id as value from blitz.registrations'),survivor);
  assert.equal(await scalar('select count(*)::integer as value from blitz.email_outbox'),1);
  assert.equal(await scalar('select count(*)::integer as value from blitz.teams where purse=2000'),8);
  assert.equal(await scalar('select count(*)::integer as value from blitz.organiser_users'),1);
});
test('pilot cleanup refuses active mail leases and auction activity, and repeated cleanup is harmless',async()=>{
  const id=await register();await as('service_role');await scalar('select public.blitz_mail_claim() as value');
  await assert.rejects(scalar('select public.blitz_delete_pilot_registrations($1) as value',[[id]]),/being sent/);
  await as('postgres');assert.equal(await scalar('select count(*)::integer as value from blitz.registrations'),1);
  await db.exec("update blitz.email_outbox set status='sent',lease_until=null,lease_token=null");
  await as('authenticated',organiser);await command('start');
  await as('service_role');await assert.rejects(scalar('select public.blitz_delete_pilot_registrations($1) as value',[[id]]),/before the auction/);
  await as('postgres');await db.exec("update blitz.auction set phase='idle',queue='{}',total=0");
  await as('service_role');await scalar('select public.blitz_delete_pilot_registrations($1) as value',[[id]]);
  const again=await scalar('select public.blitz_delete_pilot_registrations($1) as value',[[id]]);
  assert.equal(again.deleted_registrations,0);assert.deepEqual(again.photo_keys,[]);
  await assert.rejects(scalar('select public.blitz_delete_pilot_registrations($1) as value',[[]]),/Choose between/);
});

test('explicit pilot reset clears test auction activity, restores purses, reopens intake and keeps versions increasing',async()=>{
  const [id]=await eligible();await command('start');await command('bid',1);await command('sell');
  const sold=await state();assert.equal(sold.phase,'complete');assert.equal(sold.teams[0].purse,1980);
  const teamNames=sold.teams.map(t=>[t.name,t.color]);
  await as('authenticated',organiser);
  await assert.rejects(db.query('select public.blitz_reset_pilot_auction($1,$2)',[[id],sold.version]),/permission denied/);
  await as('service_role');
  const reset=await scalar('select public.blitz_reset_pilot_auction($1,$2) as value',[[id],sold.version]);
  assert.equal(reset.deleted_bids,1);assert.equal(reset.deleted_assignments,1);assert.equal(reset.deleted_mail_jobs,1);
  await as('postgres');
  const fresh=await state();assert.equal(fresh.phase,'idle');assert.equal(fresh.version,sold.version+1);
  assert.equal(fresh.total,0);assert.equal(fresh.sold,0);assert.equal(fresh.current,null);assert.deepEqual(fresh.history,[]);
  assert.ok(fresh.teams.every(t=>t.purse===2000 && t.players.length===0));assert.deepEqual(fresh.teams.map(t=>[t.name,t.color]),teamNames);
  await as('service_role');
  const removed=await scalar('select public.blitz_delete_pilot_registrations($1) as value',[[id]]);
  assert.equal(removed.deleted_registrations,1);
  await as('postgres');assert.equal(await scalar('select count(*)::integer as value from blitz.audit_events'),0);
  assert.equal(await scalar('select count(*)::integer as value from blitz.organiser_users'),1);
  await register();
});
test('pilot reset refuses stale versions, changed participant lists and live mail leases before changing anything',async()=>{
  const [id]=await eligible();await command('start');await command('bid',1);
  const before=await state();await as('service_role');
  await assert.rejects(scalar('select public.blitz_reset_pilot_auction($1,$2) as value',[[id],before.version-1]),/auction changed/);
  await assert.rejects(scalar('select public.blitz_reset_pilot_auction($1,$2) as value',[[],before.version]),/Registrations changed/);
  await scalar('select public.blitz_mail_claim() as value');
  await assert.rejects(scalar('select public.blitz_reset_pilot_auction($1,$2) as value',[[id],before.version]),/being sent/);
  await as('postgres');assert.deepEqual(await state(),before);
});

test('the reset function satisfies hosted safe-update filtering for every data mutation',async()=>{
  const definition=await scalar("select pg_get_functiondef('public.blitz_reset_pilot_auction(uuid[],integer)'::regprocedure) as value");
  // PGlite cannot load Supabase's native safeupdate extension. Check the deployed
  // function's SQL against its WHERE requirement alongside the behavioral tests.
  const statements=definition.replace(/--[^\n]*/g,'').split(';')
    .filter(statement=>/\b(?:delete\s+from|update)\s+blitz\./i.test(statement));
  assert.ok(statements.length>0);
  for(const statement of statements) assert.match(statement,/\bwhere\b/i,'Hosted safe-update rejects an unfiltered mutation.');
});
