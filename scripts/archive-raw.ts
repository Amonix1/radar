import fs from 'node:fs/promises';
import path from 'node:path';
import {archiveRawFile} from '../src/lib/raw-storage';
import {db} from '../src/lib/db';
if(!process.env.RAW_STORAGE_BUCKET)throw new Error('RAW_STORAGE_BUCKET is required');
const directory=process.env.RAW_DATA_DIR||path.resolve('data/raw');
try{
 for(const name of (await fs.readdir(directory)).filter(n=>/^[a-f0-9]{64}\.zip$/.test(n)).sort()){
  console.log(JSON.stringify(await archiveRawFile(path.join(directory,name),name.slice(0,64))));
 }
}finally{await db().end();}
