import {db} from './db';
import {ICO} from './monitor';
import {detect,detectItems,change,seasonality,type Amount,type Metrics,type SeriesPoint,type BudgetRow} from './analytics';
export type Filters={period?:string;paragraph?:string;item?:string;scope?:string;flow?:string};
export type Bundle={period:string;periods:string[];series:SeriesPoint[];metrics:Metrics;rows:BudgetRow[];allRows:BudgetRow[];source:{url:string;report:string;snapshot:number;importedAt:string};population:Record<string,number>;cpi:Record<string,number>;accounting:{period:string|null;debt:number|null;cash:number|null;source:string|null};debtHistory:{period:string;debt:number;cash:number}[];alerts:ReturnType<typeof detect>;season:ReturnType<typeof seasonality>;filters:Filters;sync:{status:string;finishedAt:string|null;imported:number;skipped:number;errors:number}|null;coverage:{periods:number;rows:number;checks:number};cpiSource:string|null};
const empty=():Amount=>({approved:0,amended:0,actual:0});
function aggregate(rows:BudgetRow[]):Metrics {
 const sum=(fn:(r:BudgetRow)=>boolean)=>rows.filter(fn).reduce((a,r)=>({approved:a.approved+r.approved,amended:a.amended+r.amended,actual:a.actual+r.actual}),empty());
 const m:Metrics={income:sum(r=>r.flow==='income'),expense:sum(r=>r.flow==='expense'),investments:sum(r=>r.classCode==='6'),operatingExpense:sum(r=>r.classCode==='5'),operatingIncome:sum(r=>['1','2'].includes(r.classCode)||r.item.startsWith('41')),tax:sum(r=>r.classCode==='1'),nonTax:sum(r=>r.classCode==='2'),capitalIncome:sum(r=>r.classCode==='3'),transfers:sum(r=>r.classCode==='4'),financing:sum(r=>r.flow==='financing'),debtService:sum(r=>r.item==='5141')};
 const repay=sum(r=>['8112','8114','8122','8124','8212','8214','8222','8224'].includes(r.item));
 for(const k of ['approved','amended','actual'] as const)m.debtService[k]-=repay[k];
 m.balance={approved:m.income.approved-m.expense.approved,amended:m.income.amended-m.expense.amended,actual:m.income.actual-m.expense.actual};
 m.operatingBalance={approved:m.operatingIncome.approved-m.operatingExpense.approved,amended:m.operatingIncome.amended-m.operatingExpense.amended,actual:m.operatingIncome.actual-m.operatingExpense.actual};return m;
}
const mapRow=(r:any):BudgetRow=>({paragraph:r.paragraph,item:r.item,flow:r.flow,classCode:r.class_code,paragraphName:r.paragraph_name,itemName:r.item_name,sector:r.sector,approved:Number(r.approved_cents)/100,amended:Number(r.amended_cents)/100,actual:Number(r.actual_cents)/100});
export async function getBundle(filters:Filters={}):Promise<Bundle> {
 if(filters.period&&!/^\d{4}-\d{2}-\d{2}$/.test(filters.period))throw new Error('Neplatné období');
 if(filters.paragraph&&!/^\d{4}$/.test(filters.paragraph)||filters.item&&!/^\d{4}$/.test(filters.item))throw new Error('Neplatný filtr');
 if(filters.scope&&!['all','operating','capital'].includes(filters.scope)||filters.flow&&!['income','expense','financing'].includes(filters.flow))throw new Error('Neplatný filtr');
 const p=await db().query("SELECT DISTINCT period::text FROM public_metrics WHERE entity_ico=$1 ORDER BY period DESC",[ICO]);const periods=p.rows.map(r=>r.period);
 const period=filters.period||periods[0];if(!period)throw new Error('Data nejsou načtena. Spusťte npm run sync.');if(!periods.includes(period))throw new Error('Zvolené období není dostupné');
 const [mr,fr,source,external,account,run,coverage]=await Promise.all([
  db().query('SELECT period::text,metric,approved_cents,amended_cents,actual_cents,snapshot_id,source_url FROM public_metrics WHERE entity_ico=$1 ORDER BY period',[ICO]),
  db().query('SELECT paragraph,item,flow,class_code,paragraph_name,item_name,sector,sum(approved_cents) approved_cents,sum(amended_cents) amended_cents,sum(actual_cents) actual_cents FROM public_budget_fact WHERE period=$1 AND entity_ico=$2 AND NOT consolidated_out GROUP BY paragraph,item,flow,class_code,paragraph_name,item_name,sector',[period,ICO]),
  db().query('SELECT source_url,report,snapshot_id,imported_at FROM public_metrics WHERE period=$1 AND entity_ico=$2 LIMIT 1',[period,ICO]),
  db().query("SELECT DISTINCT ON (o.kind,o.year) o.year,o.kind,o.value,s.source_url FROM external_observation o JOIN raw_snapshot s ON s.id=o.snapshot_id WHERE o.entity_ico=$1 AND s.visibility='public' ORDER BY o.kind,o.year,s.imported_at DESC",[ICO]),
  db().query(`SELECT s.period::text,s.source_url,sum(CASE WHEN f.section='liabilities' AND f.account IN ('281','282','283','289','451','452','453') THEN f.amount_cents ELSE 0 END)/100.0 debt,sum(CASE WHEN f.section='assets' AND f.account IN ('231','236','244','245','261') THEN f.amount_cents ELSE 0 END)/100.0 cash FROM account_fact f JOIN active_statement a ON a.snapshot_id=f.snapshot_id AND a.family='balance-sheet' JOIN raw_snapshot s ON s.id=f.snapshot_id WHERE s.entity_ico=$1 AND s.visibility='public' GROUP BY s.period,s.source_url ORDER BY s.period`,[ICO]),
  db().query('SELECT status,finished_at,imported,skipped,jsonb_array_length(errors) AS errors FROM sync_run ORDER BY id DESC LIMIT 1'),
  db().query("SELECT (SELECT count(*) FROM public_budget_fact) rows,(SELECT count(*) FROM validation_result v JOIN active_statement a ON a.snapshot_id=v.snapshot_id WHERE v.passed) checks")
 ]);
 const points=new Map<string,SeriesPoint>();for(const r of mr.rows){if(!points.has(r.period))points.set(r.period,{period:r.period,snapshot:Number(r.snapshot_id),sourceUrl:r.source_url,metrics:{}});points.get(r.period)!.metrics[r.metric]={approved:Number(r.approved_cents)/100,amended:Number(r.amended_cents)/100,actual:Number(r.actual_cents)/100};}
 let series=[...points.values()];const allRows=fr.rows.map(mapRow);
 const matches=(r:BudgetRow)=>(!filters.paragraph||r.paragraph===filters.paragraph)&&(!filters.item||r.item===filters.item)&&(!filters.flow||r.flow===filters.flow)&&(!filters.scope||filters.scope==='all'||filters.scope==='capital'&&(r.classCode==='6'||r.classCode==='3'||r.item.startsWith('42'))||filters.scope==='operating'&&(r.classCode==='5'||['1','2'].includes(r.classCode)||r.item.startsWith('41')));
 const rows=allRows.filter(matches);
 if(filters.paragraph||filters.item||filters.flow||filters.scope&&filters.scope!=='all'){
  const historical=await db().query(`SELECT period::text,snapshot_id,paragraph,item,flow,class_code,paragraph_name,item_name,sector,sum(approved_cents) approved_cents,sum(amended_cents) amended_cents,sum(actual_cents) actual_cents FROM public_budget_fact WHERE entity_ico=$1 AND NOT consolidated_out GROUP BY period,snapshot_id,paragraph,item,flow,class_code,paragraph_name,item_name,sector ORDER BY period`,[ICO]);
  const grouped=new Map<string,BudgetRow[]>();for(const r of historical.rows){if(!grouped.has(r.period))grouped.set(r.period,[]);const row=mapRow(r);if(matches(row))grouped.get(r.period)!.push(row);}
  series=series.map(p=>({...p,metrics:aggregate(grouped.get(p.period)||[])}));
 }
 const population:Record<string,number>={},cpi:Record<string,number>={};let cpiSource:string|null=null;
 for(const r of external.rows){(r.kind==='population'?population:cpi)[r.year]=Number(r.value);if(r.kind==='cpi')cpiSource=r.source_url;}
 const debtHistory=account.rows.map(r=>({period:r.period,debt:Number(r.debt),cash:Number(r.cash)}));const a=account.rows.filter(r=>r.period<=period).at(-1);
 const metrics=series.find(p=>p.period===period)!.metrics;const s=source.rows[0],job=run.rows[0];
 const annual=series.filter(p=>p.period.endsWith('12-31')&&p.period<=period).slice(-2);
 const itemAlerts:ReturnType<typeof detect>=[];
 if(annual.length===2&&Number(annual[1].period.slice(0,4))-Number(annual[0].period.slice(0,4))===1){
  const details=await db().query(`SELECT period::text,paragraph,item,flow,class_code,paragraph_name,item_name,sector,sum(approved_cents) approved_cents,sum(amended_cents) amended_cents,sum(actual_cents) actual_cents FROM public_budget_fact WHERE entity_ico=$1 AND period IN ($2,$3) AND flow='expense' AND NOT consolidated_out GROUP BY period,paragraph,item,flow,class_code,paragraph_name,item_name,sector`,[ICO,annual[0].period,annual[1].period]);
  const before=details.rows.filter(r=>r.period===annual[0].period).map(mapRow).filter(matches),after=details.rows.filter(r=>r.period===annual[1].period).map(mapRow).filter(matches);
  const inflation=change(cpi[annual[1].period.slice(0,4)],cpi[annual[0].period.slice(0,4)]);
  itemAlerts.push(...detectItems(after,before,annual[1].period,annual[0].period,change(annual[1].metrics.expense?.actual,annual[0].metrics.expense?.actual),inflation));
 }
 return {period,periods,series,metrics,rows,allRows,source:{url:s.source_url,report:s.report,snapshot:Number(s.snapshot_id),importedAt:s.imported_at.toISOString()},population,cpi,cpiSource,accounting:{period:a?.period||null,debt:a?Number(a.debt):null,cash:a?Number(a.cash):null,source:a?.source_url||null},debtHistory,alerts:[...detect(series,period),...itemAlerts],season:seasonality(series,period,'expense'),filters,sync:job?{status:job.status,finishedAt:job.finished_at?.toISOString()||null,imported:job.imported,skipped:job.skipped,errors:job.errors}:null,coverage:{periods:periods.length,rows:Number(coverage.rows[0].rows),checks:Number(coverage.rows[0].checks)}};
}
