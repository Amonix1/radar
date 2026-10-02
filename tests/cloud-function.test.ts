import {test} from 'node:test';
import assert from 'node:assert/strict';
import app from '../functions/sync';

test('scheduled function rejects anonymous invocation before any database access',async()=>{
 const response=await app.request('/',{method:'POST',body:'{}'});
 assert.equal(response.status,403);
 assert.deepEqual(await response.json(),{error:'Forbidden'});
});
test('scheduled function rejects malformed occurrence',async()=>{
 const response=await app.request('/',{method:'POST',headers:{'x-neon-trigger-invocation-id':'local-test'},
  body:JSON.stringify({data:{scheduled_at:'invalid'}})});
 assert.equal(response.status,400);
});
test('scheduled function refuses to run without durable archive storage',async()=>{
 const original=process.env.RAW_STORAGE_BUCKET;
 delete process.env.RAW_STORAGE_BUCKET;
 try{
  const response=await app.request('/',{method:'POST',headers:{'x-neon-trigger-invocation-id':'local-test'},
   body:JSON.stringify({data:{scheduled_at:'2026-10-02T03:17:00Z'}})});
  assert.equal(response.status,503);
 }finally{if(original)process.env.RAW_STORAGE_BUCKET=original;}
});
