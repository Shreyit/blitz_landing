import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const envPath='supabase/functions/.env';
const sqlPath='supabase/.temp/activate-mail.sql';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
if(!url || !key) throw new Error('Set the project URL and server secret in .env.local first.');
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new Error('This helper expects your hosted Supabase project URL.');
let contents;
try { contents=await readFile(envPath,'utf8'); }
catch(error) {
  if(error.code!=='ENOENT') throw error;
  const workerSecret=randomBytes(32).toString('hex');
  const line=(name,value)=>`${name}=${JSON.stringify(value)}\n`;
  contents='# Private Edge Function settings. Never commit or share this file.\n'
    +line('BLITZ_SUPABASE_SECRET_KEY',key)+line('MAIL_WORKER_SECRET',workerSecret)
    +line('MAIL_PROVIDER','smtp')+line('MAIL_FROM',"Bachelor's BLITZ <bachelorsblitz@tiss.ac.in>")
    +line('SMTP_HOST','smtp.gmail.com')+line('SMTP_PORT','465')
    +line('SMTP_USERNAME','bachelorsblitz@tiss.ac.in')+line('SMTP_PASSWORD','');
  await writeFile(envPath,contents,{mode:0o600,flag:'wx'});
}
await chmod(envPath,0o600);
const match=contents.match(/^MAIL_WORKER_SECRET=(.*)$/m);
const workerSecret=match?.[1]?.trim().replace(/^["']|["']$/g,'');
if(!workerSecret || !/^[a-zA-Z0-9_-]{32,}$/.test(workerSecret)) throw new Error('The existing MAIL_WORKER_SECRET must contain at least 32 letters/digits/underscore/hyphen. The file was preserved.');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const schedule=await readFile('supabase/operations/schedule_mail.sql','utf8');
const sql=`-- PRIVATE: generated setup SQL, excluded from Git. Do not share its contents.\n`
  +`-- Run in your project's SQL Editor after deploying deliver-mail.\n`
  +`begin;\ncreate extension if not exists pg_cron with schema pg_catalog;\ncreate extension if not exists pg_net with schema extensions;\n`
  +`do $setup$\ndeclare secret_id uuid;\nbegin\n`
  +[['blitz_project_url',url],['blitz_mail_worker_secret',workerSecret]].map(([name,value])=>
    `  select id into secret_id from vault.secrets where name=${quote(name)};\n`
    +`  if secret_id is null then\n    perform vault.create_secret(${quote(value)},${quote(name)});\n`
    +`  else\n    perform vault.update_secret(secret_id,${quote(value)},${quote(name)});\n  end if;\n`).join('')
  +`end $setup$;\n`+schedule+`\ncommit;\n`;
await mkdir('supabase/.temp',{recursive:true});
await writeFile(sqlPath,sql,{mode:0o600}); await chmod(sqlPath,0o600);
console.log(`Prepared ${envPath}; existing settings were preserved.`);
console.log('SMTP settings are private. Keep the configured app password, or fill SMTP_PASSWORD locally if it is empty.');
console.log(`Prepared ${sqlPath}. After deploying the mail function, run this file in the Supabase SQL Editor.`);
