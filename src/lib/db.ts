import 'dotenv/config';
import { Pool } from 'pg';
const globalDb=globalThis as unknown as {radarPool?:Pool};
export function db() {
 if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL není nastaveno. Spusťte databázi podle README.');
 if(!globalDb.radarPool){
  // Synchronization and migrations use session advisory locks, so they need
  // direct PostgreSQL connections rather than transaction-mode PgBouncer.
  const uri=new URL(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL);
  if(uri.hostname.endsWith('.neon.tech')){
   uri.hostname=uri.hostname.replace(/-pooler(?=\.)/,'');
   uri.searchParams.set('sslmode','verify-full');
  }
  globalDb.radarPool=new Pool({connectionString:uri.toString(),max:8,connectionTimeoutMillis:15000});
  // pg evicts idle clients closed by suspended cloud compute.
  globalDb.radarPool.on('error',()=>console.error('database_idle_connection_closed'));
 }
 return globalDb.radarPool;
}
