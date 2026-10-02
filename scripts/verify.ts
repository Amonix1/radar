import {db} from '../src/lib/db';
import {parseResponse,parseCodes,normalize} from '../src/lib/monitor';
const dictionary=await db().query("SELECT DISTINCT ON (report) report,payload FROM raw_snapshot WHERE report IN ('dictionary-paragraph','dictionary-item') ORDER BY report,imported_at DESC");
const paragraphs=parseCodes(dictionary.rows.find(r=>r.report==='dictionary-paragraph').payload,'paragraph'),items=parseCodes(dictionary.rows.find(r=>r.report==='dictionary-item').payload,'item');
const snapshots=await db().query("SELECT s.id,s.period::text,s.report,s.payload FROM raw_snapshot s JOIN active_statement a ON a.snapshot_id=s.id WHERE a.family='budget' ORDER BY s.period");
let sourceChecks=0;
for(const s of snapshots.rows){if(!s.payload.trim().startsWith('<'))continue;const n=normalize(parseResponse(s.payload,'00266027',s.period,s.report),s.period,paragraphs,items);if(n.checks.some(c=>!c.passed))throw new Error('Source failed '+s.period);const m=await db().query('SELECT * FROM metric_aggregate WHERE snapshot_id=$1',[s.id]);for(const row of m.rows){const calculated=n.metrics[row.metric];if(Number(row.actual_cents)!==calculated.actual||Number(row.amended_cents)!==calculated.amended||Number(row.approved_cents)!==calculated.approved)throw new Error('Stored KPI mismatch '+s.period+'/'+row.metric);sourceChecks++;}}
const invalid=await db().query('SELECT v.* FROM validation_result v JOIN active_statement a ON a.snapshot_id=v.snapshot_id WHERE NOT v.passed');
// Failed historical attempts remain in the audit; successful repeated validations establish the active version.
const latestFailed=await db().query('SELECT * FROM (SELECT DISTINCT ON(snapshot_id,check_name) snapshot_id,check_name,passed FROM validation_result ORDER BY snapshot_id,check_name,id DESC) v JOIN active_statement a ON a.snapshot_id=v.snapshot_id WHERE NOT v.passed');
if(latestFailed.rowCount)throw new Error('Active snapshots have failing latest checks');
const summary=await db().query("SELECT a.family,count(*),min(period)::text,max(period)::text FROM active_statement a GROUP BY a.family");
console.log(JSON.stringify({verifiedAggregatesAgainstSource:sourceChecks,verifiedAmounts:sourceChecks*3,coverage:summary.rows,earlierFailedAuditChecks:invalid.rowCount,activeLatestChecks:'all_passed'},null,2));await db().end();
