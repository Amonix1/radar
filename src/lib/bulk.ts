import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import yauzl from 'yauzl';
import {parse} from 'csv-parse';
import {download,ICO,cents,type Xml} from './monitor';
import {archiveRawFile} from './raw-storage';
function number(v:string){const text=v.trim();return text.endsWith('-')?'-'+text.slice(0,-1):text;}
export async function bulkStatement(datasetUrl:string,family:string,period:string) {
 const metadata=JSON.parse(await download(datasetUrl));
 const distribution=metadata.distribuce.find((d:Xml)=>d.soubor_ke_stažení&&String(d['typ_média_balíčku']).includes('zip'));
 if(!distribution)throw new Error('CSV ZIP distribution unavailable');
 const published=distribution.soubor_ke_stažení as string;
 const url=published.endsWith('.zip')?published:published+'.zip';
 const rawDirectory=process.env.RAW_DATA_DIR||path.resolve('data/raw');
 await fs.mkdir(rawDirectory,{recursive:true});
 const temp=path.resolve(rawDirectory,createHash('sha256').update(url).digest('hex')+'.download');
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok||!response.body)throw new Error(`CSV archive HTTP ${response.status}`);
 await pipeline(Readable.fromWeb(response.body as any),createWriteStream(temp));
 const hash=createHash('sha256');for await(const chunk of createReadStream(temp))hash.update(chunk);
 const sha256=hash.digest('hex');const archive=path.resolve(rawDirectory,sha256+'.zip');
 try{await fs.copyFile(temp,archive,1);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}await fs.unlink(temp);
 await archiveRawFile(archive,sha256);
 const selected:Record<string,Xml[]>={};
 await new Promise<void>((resolve,reject)=>{
  yauzl.open(archive,{lazyEntries:true,autoClose:true},(err,zip)=>{
   if(err||!zip){reject(err);return;}
   zip.on('error',reject);zip.on('end',resolve);
   zip.on('entry',(entry:yauzl.Entry)=>{
    if(!entry.fileName.toLowerCase().endsWith('.csv')){zip.readEntry();return;}
    zip.openReadStream(entry,(err,stream)=>{
     if(err||!stream){zip.close();reject(err);return;}
     (async()=>{try{
      const records=stream.pipe(parse({delimiter:';',bom:true,columns:(h:string[])=>h.map(x=>x.split(':')[0]),trim:true}));const rows:Xml[]=[];
      for await(const row of records){if(String(row.ZC_ICO||'').replace(/^0+/,'')!==ICO.replace(/^0+/,''))continue;rows.push(row);}
      selected[entry.fileName]=rows;zip.readEntry();
     }catch(e){zip.close();reject(e);}})();
    });
   });zip.readEntry();
  });
 });
 const rows=Object.values(selected).flat();
 if(!rows.length)throw new Error('Litvínov v CSV archivu chybí');
 const expected=period.slice(0,4)+'0'+period.slice(5,7);
 if(rows.some(r=>r['0FISCPER']!==expected))throw new Error('CSV period mismatch');
 // Verified legacy exception: the 2013/03 archive is denominated in thousands.
 // Its 1111 approved amount 52,000 matches the annual SOAP amount 52,000,000.
 const scale=period==='2013-03-31'?1000:1;
 const amount=(v:string)=>{const c=BigInt(cents(number(v)))*BigInt(scale);const sign=c<0?'-':'';const abs=c<0?-c:c;return `${sign}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;};
 let data:Xml;
 if(family==='budget'){
  const budget=rows.filter(r=>r['0FUNC_AREA']!==undefined).map(r=>({Paragraf:r['0FUNC_AREA'].padStart(4,'0'),Polozka:r.ZCMMT_ITM,RozpocetSchvaleny:amount(r.ZU_ROZSCH),RozpocetPoZmenach:amount(r.ZU_ROZPZM),Vysledek:amount(r.ZU_ROZKZ),SourceCsv:r}));
  const recap=(table:string)=>rows.filter(r=>r.ZC_VTAB===table).map(r=>({RadekCislo:r.ZC_POLVYK,RozpocetSchvaleny:amount(r.ZU_ROZSCH),RozpocetPoZmenach:amount(r.ZU_ROZPZM),Vysledek:amount(r.ZU_ROZKZ),SourceCsv:r}));
  data={sourceScale:scale,Fin212M:{PrijmyRozpoctove:{Radek:budget.filter(r=>Number(r.Polozka[0])<5)},VydajeRozpoctove:{Radek:budget.filter(r=>['5','6'].includes(r.Polozka[0]))},Financovani:{Radek:recap('000300')},RekapitulacePrijmyVydaje:{Radek:recap('000400')},UctyBankovniStavyAObraty:{Radek:rows.filter(r=>r.ZC_BUCE).map(r=>({RadekCislo:r.ZC_BUCE,StavKonecObdobi:amount(r.ZU_AKTZ),SourceCsv:r}))}}};
 }else{
  throw new Error('Balance sheet CSV mapping not supported');
 }
 return {data,url,payload:JSON.stringify({format:'official-csv-subset',ico:ICO,period,unit_multiplier:scale,archive_sha256:sha256,archive_file:archive,distribution_url:url,files:selected})};
}
