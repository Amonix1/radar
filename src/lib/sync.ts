import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db} from './db';
import {MONITOR,ICO,download,requestBody,parseResponse,parseCodes,normalize,parser,array,cents,type Xml,type Code} from './monitor';
import {bulkStatement} from './bulk';
export function log(event:string,details:object={}) { console.log(JSON.stringify({time:new Date().toISOString(),event,...details})); }
async function raw(c:PoolClient,url:string,report:string,period:string|null,payload:string):Promise<number> {
 const hash=createHash('sha256').update(payload).digest('hex');
 const inserted=await c.query(`INSERT INTO raw_snapshot(source,source_url,entity_ico,period,report,sha256,payload) VALUES('MONITOR',$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,[url,ICO,period,report,hash,payload]);
 if(inserted.rowCount)return Number(inserted.rows[0].id);
 return Number((await c.query('SELECT id FROM raw_snapshot WHERE source=$1 AND entity_ico=$2 AND period IS NOT DISTINCT FROM $3 AND report=$4 AND sha256=$5',['MONITOR',ICO,period,report,hash])).rows[0].id);
}
async function dictionary(c:PoolClient,kind:'paragraph'|'item',name:string):Promise<Code[]> {
 const url=MONITOR+'/data/xml/'+name+'.xml',text=await download(url),codes=parseCodes(text,kind);
 const id=await raw(c,url,'dictionary-'+kind,null,text);
 await c.query(`INSERT INTO dimension_code SELECT $1,$2,x.code,x.from::date,x.to::date,x.name,x.group,x."className",x.consolidation FROM jsonb_to_recordset($3::jsonb) AS x(code text,"from" text,"to" text,name text,"group" text,"className" text,consolidation boolean) ON CONFLICT DO NOTHING`,[id,kind,JSON.stringify(codes)]);
 return codes;
}
export async function synchronize({refresh=false,latestOnly=false}:{refresh?:boolean;latestOnly?:boolean}={}) {
 const c=await db().connect();const locked=await c.query('SELECT pg_try_advisory_lock(266027,2) AS locked');
 if(!locked.rows[0].locked){c.release();throw new Error('Synchronizace již probíhá');}
 const run=await c.query('INSERT INTO sync_run DEFAULT VALUES RETURNING id');const runId=run.rows[0].id;
 let imported=0,skipped=0;const errors:{period:string;report:string;message:string}[]=[];
 try {
  const catText=await download(MONITOR+'/api/opendata/monitor');await raw(c,MONITOR+'/api/opendata/monitor','catalog',null,catText);
  const catalog=JSON.parse(catText)['datová_sada'] as string[];
  const paragraphs=await dictionary(c,'paragraph','paragraf'),items=await dictionary(c,'item','polozka');
  const budgets=catalog.filter(url=>/\/FinM(?:_\d{4})?\/\d{4}_\d{2}_/.test(url));
  // Every published balance period is usable; archived quarters fall back to official CSV.
  const balances=catalog.filter(url=>/\/Rozvaha\/\d{4}_\d{2}_/.test(url)).sort();
  let entries=[...budgets.map(url=>({url,family:'budget'})),...balances.map(url=>({url,family:'balance-sheet'}))].map(e=>{const [,year,month]=e.url.match(/\/(\d{4})_(\d{2})_/) as RegExpMatchArray;return {...e,period:`${year}-${month}-${new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate()}`,report:e.family==='balance-sheet'?'001':Number(year)>=2026?'063':'051'};}).sort((a,b)=>b.period.localeCompare(a.period));
  if(latestOnly)entries=entries.filter(e=>e.period.slice(0,4)===entries[0].period.slice(0,4));
  for(const entry of entries) {
   if(!refresh&&(await c.query('SELECT 1 FROM active_statement WHERE entity_ico=$1 AND period=$2 AND family=$3',[ICO,entry.period,entry.family])).rowCount){skipped++;continue;}
   let id:number|undefined;
   try {
    let data:Xml;
    try {
     const text=await download(MONITOR+'/api/monitorws',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'http://schemas.xmlsoap.org/wsdl/soap'},body:requestBody(entry.period,entry.report,ICO,Number(entry.period.slice(0,4)))});
     id=await raw(c,entry.url,entry.report,entry.period,text);
     data=parseResponse(text,ICO,entry.period,entry.report);
    }catch(e){
     if(!(e instanceof Error)||!e.message.includes('HTTP 404'))throw e;
     log('csv_fallback',{period:entry.period});const bulk=await bulkStatement(entry.url,entry.family,entry.period);data=bulk.data;id=await raw(c,bulk.url,entry.report,entry.period,bulk.payload);
    }
    if(entry.family==='budget') {
     const n=normalize(data,entry.period,paragraphs,items);
     for(const check of n.checks)await c.query('INSERT INTO validation_result(snapshot_id,check_name,passed,details) VALUES($1,$2,$3,$4)',[id,check.name,check.passed,JSON.stringify(check.details)]);
     const failed=n.checks.filter(x=>!x.passed);if(failed.length)throw new Error('Reconciliation failed: '+JSON.stringify(failed));
     await c.query('BEGIN');
     await c.query(`INSERT INTO budget_fact(snapshot_id,row_number,paragraph,item,flow,class_code,purpose,partner,instrument,spatial,paragraph_name,item_name,sector,consolidated_out,approved_cents,amended_cents,actual_cents,original_values)
       SELECT $1,x.row_number,x.paragraph,x.item,x.flow,x.class_code,x.purpose,x.partner,x.instrument,x.spatial,x.paragraph_name,x.item_name,x.sector,x.consolidated_out,x.approved_cents,x.amended_cents,x.actual_cents,x.original_values FROM jsonb_to_recordset($2::jsonb) AS x(row_number int,paragraph text,item text,flow text,class_code text,purpose text,partner text,instrument text,spatial text,paragraph_name text,item_name text,sector text,consolidated_out boolean,approved_cents bigint,amended_cents bigint,actual_cents bigint,original_values jsonb) ON CONFLICT DO NOTHING`,[id,JSON.stringify(n.facts)]);
     for(const [metric,v] of Object.entries(n.metrics)) await c.query('INSERT INTO metric_aggregate VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,metric,v.approved,v.amended,v.actual]);
     for(const row of n.bank)await c.query('INSERT INTO account_fact VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[id,'bank',row.RadekCislo,'',cents(row.StavKonecObdobi),JSON.stringify(row)]);
    } else {
     if(!data.Rozvaha)throw new Error('Missing Rozvaha');
     const assets=array<Xml>(data.Rozvaha.Aktiva?.Radek),liabilities=array<Xml>(data.Rozvaha.Pasiva?.Radek);
     const a=assets.find(r=>r.Polozka==='AKTIVA'),p=liabilities.find(r=>r.Polozka==='PASIVA');
     const passed=!!a&&!!p&&cents(a.ObdobiBezneNetto)===cents(p.ObdobiBezne);
     await c.query('INSERT INTO validation_result(snapshot_id,check_name,passed,details) VALUES($1,$2,$3,$4)',[id,'balance_sheet_identity',passed,JSON.stringify({assets:a?.ObdobiBezneNetto,liabilities:p?.ObdobiBezne})]);if(!passed)throw new Error('Balance sheet reconciliation failed');
     await c.query('BEGIN');
     for(const [section,rows] of [['assets',assets],['liabilities',liabilities]] as const)for(const row of rows)await c.query('INSERT INTO account_fact VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[id,section,row.Polozka,row.SyntetickyUcet,cents(section==='assets'?row.ObdobiBezneNetto:row.ObdobiBezne),JSON.stringify(row)]);
    }
    await c.query('INSERT INTO active_statement VALUES($1,$2,$3,$4) ON CONFLICT(entity_ico,period,family) DO UPDATE SET snapshot_id=excluded.snapshot_id',[ICO,entry.period,entry.family,id]);
    await c.query('COMMIT');imported++;log('imported',{period:entry.period,report:entry.report,snapshot:id});
   }catch(e){await c.query('ROLLBACK');const message=e instanceof Error?e.message:String(e);errors.push({period:entry.period,report:entry.report,message});log('import_failed',{period:entry.period,report:entry.report,message});}
  }
  // The statement 100 can resolve the latest active period by year. Its own header is authoritative.
  const years=[...new Set(entries.map(e=>Number(e.period.slice(0,4))))];
  for(const year of years) {
   try {
    if(!refresh&&(await c.query("SELECT 1 FROM external_observation o JOIN raw_snapshot s ON s.id=o.snapshot_id WHERE o.year=$1 AND o.kind='population' AND s.visibility='public'",[year])).rowCount)continue;
    const text=await download(MONITOR+'/api/monitorws',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8'},body:requestBody(undefined,'100',ICO,year)});
    const response=parser.parse(text).Envelope?.Body?.MonitorResponse;
    if(!response?.VykazData?.UkazateleUJ)throw new Error('Population response unavailable');
    const period=response.Hlavicka.Obdobi;const data=parseResponse(text,ICO,period,'100').UkazateleUJ;
    const value=Number(data.Identifikace.PocetObyvatel);if(!Number.isInteger(value)||value<=0||period.slice(0,4)!==String(year))throw new Error('Invalid population period/value');
    const id=await raw(c,MONITOR+'/api/monitorws','100',period,text);
    await c.query('INSERT INTO external_observation VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,ICO,year,'population',value]);
   } catch(e){const message=e instanceof Error?e.message:String(e);errors.push({period:String(year),report:'100',message});log('population_unavailable',{year,message});}
  }
  await c.query('UPDATE sync_run SET finished_at=now(),status=$2,imported=$3,skipped=$4,errors=$5 WHERE id=$1',[runId,errors.length?'partial':'success',imported,skipped,JSON.stringify(errors)]);
  return {runId,imported,skipped,errors};
 } catch(e){await c.query('UPDATE sync_run SET finished_at=now(),status=$2,errors=$3 WHERE id=$1',[runId,'failed',JSON.stringify([{message:e instanceof Error?e.message:String(e)}])]);throw e;}
 finally{await c.query('SELECT pg_advisory_unlock(266027,2)');c.release();}
}
