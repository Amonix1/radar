import {db} from '../src/lib/db';
console.log((await db().query("SELECT period::text,actual_cents/100.0 AS income FROM public_metrics WHERE metric='income' AND extract(year FROM period)<2020 ORDER BY period")).rows);
const r=await db().query("SELECT payload FROM raw_snapshot WHERE period='2013-03-31' ORDER BY id DESC LIMIT 1");
console.log(r.rows[0].payload.slice(0,5000));
await db().end();
