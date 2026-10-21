import {readFile,writeFile,mkdir,chmod,unlink} from 'node:fs/promises';
import {SupabaseHttp} from '../src/lib/supabase-http.ts';
import {inspectPilot,deletePilot} from './pilot-cleanup.mjs';

const path='supabase/.temp/pilot-cleanup.json';
const project=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const args=process.argv.slice(2);
try {
  if(!project || !key) throw new Error('Set the Supabase URL and server key in .env.local first.');
  const resetAuction=args.length===2 && args.includes('--all') && args.includes('--reset-auction');
  const all=(args.length===1 && args[0]==='--all') || resetAuction;
  const resume=args.length===1 && args[0]==='--resume';
  const requested=args.length===2 && args[0]==='--ids' ? args[1].split(',') : null;
  if(args.length && !all && !resume && !requested) throw new Error('Use no flags to inspect, --all to delete current dummy entries, --ids UUID,UUID to select entries, add --reset-auction to --all for the confirmed dummy auction, or use --resume to finish interrupted cleanup.');
  const client=new SupabaseHttp(project,key);
  let manifest;
  try {manifest=JSON.parse(await readFile(path,'utf8'));}
  catch(error) {if(error.code!=='ENOENT') throw error;}
  if(manifest && !resume) throw new Error('An unfinished cleanup exists. Use npm run cleanup:pilot -- --resume to finish only those records.');
  if(resume && !manifest) throw new Error('There is no unfinished cleanup to resume.');
  let records,version;
  let resetMail=0;
  if(!resume) {
    const inspected=await inspectPilot(client,{resetAuction});
    records=inspected.records;version=inspected.version;
    console.log(`${records.length} stored registrations:`);
    for(const row of records) console.log(`${row.id} | ${row.name} | ${row.email} | ${row.role}`);
    if(!all && !requested) {
      console.log('Inspection only. To remove the current dummy entries and their photos: npm run cleanup:pilot -- --all');
      process.exitCode=0;
    } else {
      if(requested) {
        if(new Set(requested).size!==requested.length || requested.some(id=>!records.some(row=>row.id===id))) throw new Error('One or more selected IDs were not found; no changes made.');
        records=records.filter(row=>requested.includes(row.id));
      }
    }
  }
  if(resume || all || requested) {
    if(resetAuction) {
      const reset=await client.rpc('blitz_reset_pilot_auction',{p_ids:records.map(row=>row.id),p_version:version});
      resetMail=reset.deleted_mail_jobs;
      console.log(`Pilot auction reset: ${reset.deleted_bids} bids and ${reset.deleted_assignments} assignments removed. Team purses restored to ₹2,000. Registration reopened.`);
    }
    const result=await deletePilot({client,project,records,manifest,
      persist:async plan=>{await mkdir('supabase/.temp',{recursive:true});await writeFile(path,JSON.stringify(plan),{mode:0o600});await chmod(path,0o600);},
      complete:async()=>{await unlink(path);},
    });
    console.log(`Removed ${result.registrations} registrations, ${result.photos} photos, and ${result.mail+resetMail} related email records.`);
    console.log(resetAuction ? 'Team names/colours, admin access, mail settings and website configuration were preserved.' : 'Teams, purses, admin account, mail settings, and website configuration were preserved.');
  }
} catch(error) {
  console.error(error.cause?.code ? `Cannot reach Supabase (${error.cause.code}). No cleanup has been confirmed.` : error.message);
  process.exitCode=1;
}
