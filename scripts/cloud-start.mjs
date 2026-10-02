import 'dotenv/config';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const role=process.argv[2];
if(!['web','worker'].includes(role))throw new Error('Specify web or worker');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
if(role==='web'&&(!process.env.APP_PASSWORD_HASH||!process.env.APP_SESSION_SECRET))throw new Error('Access secrets missing; refusing to start');
// Render provides the assigned HTTPS hostname after creating the service.
if(!process.env.APP_ORIGIN&&process.env.RENDER_EXTERNAL_HOSTNAME)process.env.APP_ORIGIN='https://'+process.env.RENDER_EXTERNAL_HOSTNAME;
if(role==='web'&&!process.env.APP_ORIGIN)throw new Error('APP_ORIGIN missing');
process.env.HOSTNAME='0.0.0.0';
process.env.PORT||='3100';
process.env.RAW_DATA_DIR||=path.resolve('data/raw');
await fs.mkdir(process.env.RAW_DATA_DIR,{recursive:true});
let child;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child?child.kill(signal):process.exit(0));
async function run(script){
 await new Promise((resolve,reject)=>{
  child=spawn(process.execPath,['--import','tsx',script],{stdio:'inherit',env:process.env});
  child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`Task ${script} failed (${code??signal})`)));
 });
}
await run('scripts/migrate.ts');
if(role==='worker'){
 await run('scripts/import-cpi.ts');
 await run('scripts/sync.ts');
 child=spawn(process.execPath,['--import','tsx','scripts/sync.ts','--watch'],{stdio:'inherit',env:process.env});
 child.once('exit',code=>process.exit(code??1));
}else{
 // Native Node deployments need the same standalone assets as Docker builds.
 const staticTarget='.next/standalone/.next/static';
 try{await fs.access(staticTarget);}catch{await fs.cp('.next/static',staticTarget,{recursive:true});}
 try{await fs.access('public');await fs.access('.next/standalone/public');}
 catch{try{await fs.cp('public','.next/standalone/public',{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
 child=spawn(process.execPath,['.next/standalone/server.js'],{stdio:'inherit',env:process.env});
 child.once('exit',code=>process.exit(code??1));
}
