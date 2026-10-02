import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2),portIndex=args.indexOf('--port');
const port=Number(portIndex>=0?args[portIndex+1]:process.env.PORT||3100);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Neplatný port');
process.env.PORT=String(port);process.env.HOSTNAME='127.0.0.1';
process.env.RAW_DATA_DIR=process.env.RAW_DATA_DIR||path.resolve('data/raw');
await fs.cp('.next/static','.next/standalone/.next/static',{recursive:true});
try{await fs.access('public');await fs.cp('public','.next/standalone/public',{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
await import('../.next/standalone/server.js');
