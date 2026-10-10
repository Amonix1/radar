import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';
import yauzl from 'yauzl';
import {parse} from 'csv-parse';
import {createExtractorFromFile} from 'node-unrar-js';
import {ICO,type Xml} from './monitor';

// The standalone Function bundle embeds this WASM; ordinary Node resolves the package asset.
declare const __RADAR_UNRAR_WASM__:Buffer|undefined;
async function* normalizeLegacyHeader(stream:Readable) {
 let pending=Buffer.alloc(0),complete=false;
 const header=(line:Buffer)=>{
  const text=line.toString('utf8').replace(/^\uFEFF/,'');
  if(!text.startsWith('"""'))return line;
  // 2014 ROZV2 exports prepend improperly quoted SAP descriptions to the header.
  // Only the header is repaired: technical aliases after ':' are authoritative.
  const names=text.replace(/\r$/,'').split(';').map(cell=>{
   const match=cell.match(/^""".+"""[^:]+:([A-Z0-9_]+)$/);
   if(!match)throw new Error('Unsupported legacy CSV header');
   return match[1]==='ZC_SYNUC'?'ZSYN_UCET':match[1];
  });
  if(new Set(names).size!==names.length||!names.includes('ZC_ICO')||!names.includes('0FISCPER'))throw new Error('Invalid legacy CSV header');
  return Buffer.from(names.join(';'));
 };
 for await(const value of stream){
  const chunk=Buffer.isBuffer(value)?value:Buffer.from(value);
  if(complete){yield chunk;continue;}
  pending=Buffer.concat([pending,chunk]);const newline=pending.indexOf(10);
  if(newline<0){if(pending.length>65536)throw new Error('CSV header exceeds limit');continue;}
  if(newline>65536)throw new Error('CSV header exceeds limit');
  yield Buffer.concat([header(pending.subarray(0,newline)),Buffer.from('\n')]);
  yield pending.subarray(newline+1);pending=Buffer.alloc(0);complete=true;
 }
 if(!complete&&pending.length)yield header(pending);
}
export async function readCityCsv(stream:Readable):Promise<Xml[]> {
 const input=Readable.from(normalizeLegacyHeader(stream));
 const records=input.pipe(parse({delimiter:';',bom:true,columns:(h:string[])=>h.map(x=>{const name=x.split(':')[0];return name==='ZC_SYNUC'?'ZSYN_UCET':name;}),trim:true,
  // Legacy CSUIS exports end with a DOS EOF marker on its own line.
  comment:'\x1a',comment_no_infix:true,
  on_record:r=>String((r as Xml).ZC_ICO||'').replace(/^0+/,'')===ICO.replace(/^0+/,'')?r:null}));
 input.on('error',error=>records.destroy(error));
 const rows:Xml[]=[];
 try{for await(const row of records)rows.push(row);}
 finally{records.destroy();input.destroy();}
 return rows;
}
export async function readOfficialArchive(file:string):Promise<{format:'zip'|'rar';files:Record<string,Xml[]>}> {
 const handle=await fs.open(file,'r'),signature=Buffer.alloc(8);
 try{await handle.read(signature,0,8,0);}finally{await handle.close();}
 const selected:Record<string,Xml[]>={};
 if(signature.subarray(0,4).equals(Buffer.from('Rar!'))){
  const directory=await fs.mkdtemp(path.join(path.dirname(file),'extract-'));
  try{
   const wasmBinary=typeof __RADAR_UNRAR_WASM__!=='undefined'?__RADAR_UNRAR_WASM__:await fs.readFile(path.join(path.dirname(createRequire(import.meta.url).resolve('node-unrar-js')),'js','unrar.wasm'));
   const extractor=await createExtractorFromFile({filepath:file,targetPath:directory,wasmBinary:wasmBinary.buffer.slice(wasmBinary.byteOffset,wasmBinary.byteOffset+wasmBinary.byteLength) as ArrayBuffer,
    filenameTransform:name=>{if(name!==path.basename(name)||/[\\/]/.test(name))throw new Error('Unexpected archive path');return name;}});
   const headers=[...extractor.getFileList().fileHeaders];
   if(headers.some(h=>h.flags.encrypted||h.unpSize>600_000_000))throw new Error('Unsupported archive size or encryption');
   const files=extractor.extract({files:h=>!h.flags.directory&&h.name.toLowerCase().endsWith('.csv')}).files;
   // Fully consume the iterator so the native archive handle is closed.
   for(const entry of files)selected[entry.fileHeader.name]=await readCityCsv(createReadStream(path.join(directory,entry.fileHeader.name)));
  }finally{
   // Only remove files in the unique directory created above; never follow archive paths.
   for(const name of await fs.readdir(directory))await fs.unlink(path.join(directory,name));
   await fs.rmdir(directory);
  }
  return {format:'rar',files:selected};
 }
 if(signature.readUInt32LE(0)!==0x04034b50)throw new Error('Unsupported official archive format');
 await new Promise<void>((resolve,reject)=>{
  yauzl.open(file,{lazyEntries:true,autoClose:true},(err,zip)=>{
   if(err||!zip){reject(err);return;}
   zip.on('error',reject);zip.on('end',resolve);
   zip.on('entry',(entry:yauzl.Entry)=>{
    if(!entry.fileName.toLowerCase().endsWith('.csv')){zip.readEntry();return;}
    if(entry.uncompressedSize>600_000_000){zip.close();reject(new Error('Archive entry exceeds limit'));return;}
    zip.openReadStream(entry,(err,stream)=>{
     if(err||!stream){zip.close();reject(err);return;}
     readCityCsv(stream).then(rows=>{selected[entry.fileName]=rows;zip.readEntry();},error=>{zip.close();reject(error);});
    });
   });zip.readEntry();
  });
 });
 return {format:'zip',files:selected};
}
