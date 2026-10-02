import {Hono} from 'hono';
import {db} from '../src/lib/db';
import {synchronize} from '../src/lib/sync';
import {ensureArchiveStorage} from '../src/lib/raw-storage';

process.env.RAW_DATA_DIR='/tmp/radar/raw';
const app=new Hono();
app.post('/',async c=>{
 // Neon strips client-supplied X-Neon-* headers before routing a request.
 const invocation=c.req.header('x-neon-trigger-invocation-id');
 if(!invocation)return c.json({error:'Forbidden'},403);
 let scheduledAt:string;
 try{
  const body=await c.req.json();
  const date=new Date(body.data?.scheduled_at);
  if(!Number.isFinite(date.getTime()))return c.json({error:'Invalid schedule'},400);
  scheduledAt=date.toISOString();
 }catch{return c.json({error:'Invalid request'},400);}
 if(!process.env.RAW_STORAGE_BUCKET)return c.json({error:'Archive storage is not configured'},503);
 const client=await db().connect();
 let locked=false;
 try {
  locked=(await client.query('SELECT pg_try_advisory_lock(266027,3) AS locked')).rows[0].locked;
  if(!locked)return c.json({status:'busy'},503);
  const previous=(await client.query('SELECT status FROM scheduled_sync WHERE scheduled_at=$1',[scheduledAt])).rows[0];
  if(previous?.status==='success')return c.json({status:'already_completed'});
  await client.query(`INSERT INTO scheduled_sync(scheduled_at,invocation_id,status) VALUES($1,$2,'running')
   ON CONFLICT(scheduled_at) DO UPDATE SET invocation_id=$2,status='running',attempts=scheduled_sync.attempts+1,started_at=now(),finished_at=NULL`,[scheduledAt,invocation]);
  await ensureArchiveStorage();
  const result=await synchronize({refresh:true,latestOnly:true});
  const success=result.errors.length===0;
  await client.query('UPDATE scheduled_sync SET status=$2,finished_at=now(),sync_run_id=$3 WHERE scheduled_at=$1',[scheduledAt,success?'success':'failed',result.runId]);
  console.log(JSON.stringify({event:'scheduled_sync_finished',scheduledAt,runId:result.runId,success}));
  return c.json({status:success?'completed':'failed'},success?200:500);
 }catch{
  if(locked)await client.query("UPDATE scheduled_sync SET status='failed',finished_at=now() WHERE scheduled_at=$1",[scheduledAt]).catch(()=>{});
  console.error('scheduled_sync_failed');
  return c.json({status:'failed'},500);
 }finally{
  if(locked)await client.query('SELECT pg_advisory_unlock(266027,3)').catch(()=>{});
  client.release();
 }
});
export default app;
