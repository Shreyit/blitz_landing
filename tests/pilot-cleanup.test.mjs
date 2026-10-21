import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectPilot,deletePilot} from '../scripts/pilot-cleanup.mjs';

const id='00000000-0000-4000-8000-000000000111';
const records=[{id,photo_key:`${id}.jpg`,name:'Pilot',email:'pilot@example.test',role:'player'}];
const project='https://fixture.supabase.co';
function fixture() {
  const calls=[],saved=[];let finished=false;
  const client={rpc:async(name,body)=>{
    calls.push({name,body});
    if(name==='blitz_pilot_registrations')return {phase:'idle',registrations:records};
    return {deleted_registrations:1,deleted_mail_jobs:1,photo_keys:[`${id}.jpg`]};
  },request:async(path,init)=>{calls.push({path,init});return [];}};
  return {client,calls,saved,persist:async value=>saved.push(structuredClone(value)),complete:async()=>{finished=true;},isFinished:()=>finished};
}
test('pilot cleanup captures exact IDs, deletes rows before photos and clears its private manifest',async()=>{
  const f=fixture();assert.deepEqual((await inspectPilot(f.client)).records,records);
  const result=await deletePilot({...f,records,project});
  assert.deepEqual(result,{registrations:1,photos:1,mail:1});
  assert.deepEqual(f.calls[1],{name:'blitz_delete_pilot_registrations',body:{p_ids:[id]}});
  assert.deepEqual(JSON.parse(f.calls[2].init.body),{prefixes:[`${id}.jpg`]});
  assert.deepEqual(JSON.parse(f.calls[3].init.body),{prefix:'',search:`${id}.jpg`,limit:100,offset:0});
  assert.equal(f.saved[0].phase,'planned');assert.equal(f.saved[1].phase,'database-deleted');assert.equal(f.isFinished(),true);
});
test('inspection refuses non-idle auctions and unexpected photo paths',async()=>{
  await assert.rejects(inspectPilot({rpc:async()=>({phase:'active',registrations:records})}),/auction has started/);
  await assert.rejects(inspectPilot({rpc:async()=>({phase:'idle',registrations:[{...records[0],photo_key:'another-person.jpg'}]})}),/Unexpected/);
});
test('a manifest write failure prevents all database and storage mutations',async()=>{
  const f=fixture();await assert.rejects(deletePilot({...f,records,project,persist:async()=>{throw new Error('Disk unavailable');}}),/Disk unavailable/);
  assert.equal(f.calls.length,0);
});
test('an ambiguous database response preserves the plan and does not delete photos',async()=>{
  const f=fixture();f.client.rpc=async()=>{throw new Error('Lost response');};
  await assert.rejects(deletePilot({...f,records,project}),/Lost response/);
  assert.equal(f.saved[0].phase,'planned');assert.equal(f.calls.length,0);assert.equal(f.isFinished(),false);
});
test('storage failure can resume the original snapshot without touching later registrations',async()=>{
  const f=fixture();f.client.request=async()=>{throw new Error('Storage unavailable');};
  await assert.rejects(deletePilot({...f,records,project}),/Storage unavailable/);
  const manifest=f.saved.at(-1);assert.equal(manifest.phase,'database-deleted');
  const retry=fixture();retry.client.rpc=async()=>{throw new Error('Must not widen the deletion scope');};
  const result=await deletePilot({...retry,project,manifest});
  assert.equal(result.registrations,1);assert.equal(retry.calls[0].path,'/storage/v1/object/blitz-photos');assert.equal(retry.isFinished(),true);
});
test('a remaining photo keeps the cleanup manifest for a safe retry',async()=>{
  const f=fixture();f.client.request=async(path)=>path.includes('/list/')?[{name:`${id}.jpg`}]:[];
  await assert.rejects(deletePilot({...f,records,project}),/could not be verified/);
  assert.equal(f.isFinished(),false);
});
test('resume rejects another project or a widened photo scope',async()=>{
  for(const extra of [{project:'https://another.supabase.co'},{photos:['someone-else.jpg']}]) {
    const f=fixture();await assert.rejects(deletePilot({...f,project,manifest:{project,ids:[id],photos:[`${id}.jpg`],phase:'database-deleted',...extra}}),/does not match/);
    assert.equal(f.calls.length,0);
  }
});

test('auction reset inspection requires an explicit option and a valid database version',async()=>{
  const client={rpc:async()=>({phase:'complete',version:8,registrations:records})};
  await assert.rejects(inspectPilot(client),/auction has started/);
  assert.deepEqual(await inspectPilot(client,{resetAuction:true}),{records,version:8});
  await assert.rejects(inspectPilot({rpc:async()=>({phase:'active',registrations:records})},{resetAuction:true}),/migration 008/);
});
