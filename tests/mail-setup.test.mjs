import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('mail preparation protects credentials and preserves existing settings on rerun',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'blitz-mail-setup-'));
  try {
    await mkdir(join(dir,'supabase/functions'),{recursive:true});
    await mkdir(join(dir,'supabase/operations'),{recursive:true});
    await writeFile(join(dir,'supabase/operations/schedule_mail.sql'),await readFile('supabase/operations/schedule_mail.sql'));
    const run=()=>spawnSync(process.execPath,[resolve('scripts/prepare-mail.mjs')],{cwd:dir,env:{...process.env,
      NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'private-fixture-server-key'},encoding:'utf8'});
    const first=run();assert.equal(first.status,0,first.stderr);
    const path=join(dir,'supabase/functions/.env');
    const initial=await readFile(path,'utf8');
    assert.ok(initial.includes('SMTP_PASSWORD=""'));assert.ok(initial.includes('SMTP_PORT="465"'));
    assert.equal((await stat(path)).mode & 0o777,0o600);
    const worker=JSON.parse(initial.match(/^MAIL_WORKER_SECRET=(.*)$/m)[1]);
    assert.ok(worker.length>=32);
    assert.ok(!first.stdout.includes(worker));assert.ok(!first.stdout.includes('private-fixture-server-key'));
    const updated=initial.replace('SMTP_PASSWORD=""','SMTP_PASSWORD="private-fixture-app-password"');
    await writeFile(path,updated);const second=run();assert.equal(second.status,0,second.stderr);
    assert.equal(await readFile(path,'utf8'),updated);
    const sql=await readFile(join(dir,'supabase/.temp/activate-mail.sql'),'utf8');
    assert.ok(sql.includes(worker));assert.ok(sql.includes('vault.update_secret'));assert.ok(sql.includes('cron.schedule'));
    assert.ok(!sql.includes('private-fixture-server-key'));assert.ok(!sql.includes('private-fixture-app-password'));
    assert.equal((await stat(join(dir,'supabase/.temp/activate-mail.sql'))).mode & 0o777,0o600);
  } finally {await rm(dir,{recursive:true,force:true});}
});
