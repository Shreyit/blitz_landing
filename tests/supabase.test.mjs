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
    create schema auth; create table auth.users(id uuid primary key);
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
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  }
  await db.query('insert into auth.users values ($1),($2)', [organiser, outsider]);
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
test('intake ignores forged verification and keeps separate player and volunteer entries', async () => {
  const player = await register('player', {email:'same@tiss.edu', verified:true});
  await register('volunteer', {email:'same@tiss.edu'});
  assert.equal(await scalar('select verified as value from blitz.registrations where id=$1',[player]), false);
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
test('verification is idempotent, rejects expired links and freezes eligibility at auction start', async () => {
  const id=await register();
  const hash=await scalar('select verification_hash as value from blitz.registrations where id=$1',[id]);
  await as('service_role');
  assert.match((await scalar('select public.blitz_verify($1) as value',[hash])).message,/verified/);
  assert.match((await scalar('select public.blitz_verify($1) as value',[hash])).message,/already/);
  await as('postgres'); const late=await register();
  const lateHash=await scalar('select verification_hash as value from blitz.registrations where id=$1',[late]);
  await as('authenticated',organiser); await command('start');
  await as('service_role'); await assert.rejects(scalar('select public.blitz_verify($1) as value',[lateHash]),/frozen/);
  await as('postgres'); await db.exec("update blitz.registrations set verification_expires=now()-interval '1 hour' where not verified");
  await as('service_role'); await assert.rejects(scalar('select public.blitz_verify($1) as value',[lateHash]),/expired/);
  await assert.rejects(register(),/Registration has closed/);
});
test('volunteers and unverified players never enter the queue or public snapshot', async () => {
  await eligible(2); await register('volunteer'); await register();
  await as('postgres'); await db.exec("update blitz.registrations set verified=true where role='volunteer'");
  await as('authenticated',organiser); const s=await command('start'); assert.equal(s.total,2);
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
