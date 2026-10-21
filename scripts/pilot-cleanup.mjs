// The caller supplies a service-only client. A durable private manifest allows
// photo deletion to resume after database deletion without widening its scope.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function inspectPilot(client,{resetAuction=false}={}) {
  const result=await client.rpc('blitz_pilot_registrations');
  if(!resetAuction && result.phase!=='idle') throw new Error('The auction has started. This cleanup cannot reset auction activity.');
  if(!Array.isArray(result.registrations)) throw new Error('Could not read the pilot registrations.');
  for(const row of result.registrations) {
    if(!uuid.test(row.id) || row.photo_key!==`${row.id}.jpg`) throw new Error('Unexpected registration/photo identifier; no changes made.');
  }
  if(resetAuction && (!Number.isInteger(result.version) || result.version<0)) throw new Error('Apply migration 008 before resetting the pilot auction.');
  return {records:result.registrations,version:result.version};
}
export async function deletePilot({client,project,records,manifest,persist,complete}) {
  let plan=manifest;
  if(!plan) {
    if(!records?.length) return {registrations:0,photos:0,mail:0};
    plan={project,ids:records.map(row=>row.id),photos:records.map(row=>row.photo_key),phase:'planned',registrations:0,mail:0};
    // Save the exact scope before making the first destructive request.
    await persist(plan);
  }
  if(plan.project!==project || !Array.isArray(plan.ids) || !plan.ids.length || plan.ids.length>100
    || !plan.ids.every(id=>uuid.test(id)) || new Set(plan.ids).size!==plan.ids.length
    || !Array.isArray(plan.photos) || plan.photos.length!==plan.ids.length
    || plan.photos.some((key,index)=>key!==`${plan.ids[index]}.jpg`)
    || !['planned','database-deleted'].includes(plan.phase)) throw new Error('Cleanup manifest does not match this project or its original registration IDs.');
  if(plan.phase==='planned') {
    const result=await client.rpc('blitz_delete_pilot_registrations',{p_ids:plan.ids});
    plan={...plan,phase:'database-deleted',registrations:result.deleted_registrations,mail:result.deleted_mail_jobs};
    await persist(plan);
  }
  // Always use Storage's API. Deleting storage.objects rows in SQL would leave
  // the underlying uploaded files behind.
  await client.request('/storage/v1/object/blitz-photos',{
    method:'DELETE',body:JSON.stringify({prefixes:plan.photos}),
  });
  // Check exact names; a missing object is already cleaned up and is harmless.
  for(const key of plan.photos) {
    const files=await client.request('/storage/v1/object/list/blitz-photos',{
      method:'POST',body:JSON.stringify({prefix:'',search:key,limit:100,offset:0}),
    });
    if(!Array.isArray(files) || files.some(file=>file.name===key)) throw new Error('Photo cleanup could not be verified. Rerun with --resume.');
  }
  await complete();
  return {registrations:plan.registrations,mail:plan.mail,photos:plan.photos.length};
}
