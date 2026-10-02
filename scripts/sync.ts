import {synchronize,log} from '../src/lib/sync';
import {db} from '../src/lib/db';
const watch=process.argv.includes('--watch');
async function run(){try{const result=await synchronize({refresh:watch||process.argv.includes('--refresh'),latestOnly:watch||process.argv.includes('--latest')});log('sync_finished',result);if(result.errors.length&&!watch)process.exitCode=1;}catch(e){log('sync_failed',{message:e instanceof Error?e.message:String(e)});if(!watch)process.exitCode=1;}}
await run();
if(watch){const hours=Number(process.env.SYNC_INTERVAL_HOURS||24);if(!Number.isFinite(hours)||hours<1)throw new Error('SYNC_INTERVAL_HOURS must be >= 1');setInterval(run,hours*3600000);}else await db().end();
