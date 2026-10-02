import { db } from '../src/lib/db';
import fs from 'node:fs/promises';
const client=await db().connect();
try {
 await client.query('SELECT pg_advisory_lock(266027,1)');
 const exists=await client.query("SELECT to_regclass('public.schema_migration') AS name");
 const applied=exists.rows[0].name ? (await client.query('SELECT version FROM schema_migration')).rows.map(r=>r.version) : [];
 for(const file of (await fs.readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
  if(applied.includes(file)) continue;
  await client.query('BEGIN');
  try {await client.query(await fs.readFile('db/migrations/'+file,'utf8'));await client.query('INSERT INTO schema_migration(version) VALUES($1)',[file]);await client.query('COMMIT');console.log('Applied',file);}
  catch(e){await client.query('ROLLBACK');throw e;}
 }
} finally {await client.query('SELECT pg_advisory_unlock(266027,1)');client.release();await db().end();}
