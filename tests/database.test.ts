import test from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {getBundle} from '../src/lib/repository';
test('database provenance, immutable RAW and public isolation',{skip:!process.env.INTEGRATION_TESTS},async()=>{
 const b=await getBundle();assert.equal(b.period,'2026-08-31');assert.equal(b.metrics.income.actual,638098639.41);assert.equal(b.metrics.expense.actual,862113904.62);assert.ok(b.coverage.periods>=97);assert.ok(Math.abs(b.metrics.balance.actual+b.metrics.financing.actual)<.01);
 const c=await db().connect();try{
  await assert.rejects(()=>c.query('UPDATE raw_snapshot SET payload=payload WHERE id=$1',[b.source.snapshot]),/immutable/);
  await c.query('BEGIN');const r=await c.query("INSERT INTO raw_snapshot(source,source_url,entity_ico,period,report,sha256,payload,visibility) VALUES('TEST','test','00266027','2099-12-31','051',$1,'test','internal') RETURNING id",['0'.repeat(64)]);const id=r.rows[0].id;await c.query("INSERT INTO metric_aggregate VALUES($1,'income',1,1,1)",[id]);await c.query("INSERT INTO active_statement VALUES('00266027','2099-12-31','budget',$1)",[id]);const publicRows=await c.query('SELECT 1 FROM public_metrics WHERE snapshot_id=$1',[id]);assert.equal(publicRows.rowCount,0);await c.query('ROLLBACK');
 }finally{c.release();await db().end();}
});
