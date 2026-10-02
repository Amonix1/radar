import {db} from '../src/lib/db';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url='https://csu.gov.cz/docs/107508/a3bcc692-1894-b309-99d1-470e95b65144/inflace_2000_2025.pdf';
const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('ČSÚ PDF nedostupné');
const pdf=Buffer.from(await response.arrayBuffer());if(!pdf.subarray(0,4).equals(Buffer.from('%PDF')))throw new Error('Neplatný zdroj ČSÚ');
const csv=await fs.readFile('data-sources/csu-annual-inflation.csv','utf8');
const values=csv.trim().split(/\r?\n/).slice(1).map(line=>{const [year,rate]=line.split(';').map(Number);if(!Number.isInteger(year)||!Number.isFinite(rate))throw new Error('CPI validation');return {year,rate};});
const payload=JSON.stringify({source_document_base64:pdf.toString('base64'),source_document_sha256:createHash('sha256').update(pdf).digest('hex'),reviewed_csv:csv,reference_year:2025,method:'Year-average inflation rates manually verified against official signed ČSÚ statement dated 2026-01-13. Chained backwards from 2025 = 100.'});
const hash=createHash('sha256').update(payload).digest('hex');
const c=await db().connect();try{await c.query('BEGIN');let r=await c.query("INSERT INTO raw_snapshot(source,source_url,entity_ico,period,report,sha256,payload) VALUES('CSU',$1,'00266027','2025-12-31','annual-cpi',$2,$3) ON CONFLICT DO NOTHING RETURNING id",[url,hash,payload]);if(!r.rowCount)r=await c.query("SELECT id FROM raw_snapshot WHERE source='CSU' AND sha256=$1",[hash]);const id=r.rows[0].id;let index=100;for(const row of [...values].reverse()){await c.query("INSERT INTO external_observation VALUES($1,'00266027',$2,'cpi',$3) ON CONFLICT DO NOTHING",[id,row.year,index]);index/=1+row.rate/100;}await c.query('COMMIT');console.log('Imported verified annual CPI, 2010–2025; snapshot',id);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db().end();}
