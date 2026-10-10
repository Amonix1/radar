import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Readable} from 'node:stream';
import {mapBalanceCsv} from '../src/lib/balance-csv';
import {readCityCsv,readOfficialArchive} from '../src/lib/archive-csv';
import {cents,type Xml} from '../src/lib/monitor';
async function fixture(period:string):Promise<Xml[]> {return Object.values(JSON.parse(await fs.readFile(`tests/fixtures/balance-${period}.json`,'utf8'))).flat() as Xml[];}
test('official annual CSV matches independently verified SOAP debt, cash and assets',async()=>{
 const data=mapBalanceCsv(await fixture('2025-12-31'),'2025-12-31').Rozvaha;
 const assets=data.Aktiva.Radek,liabilities=data.Pasiva.Radek;
 assert.equal(assets.length+liabilities.length,152);
 assert.equal(cents(assets.find(r=>r.Polozka==='AKTIVA')!.ObdobiBezneNetto),392725161774);
 assert.equal(cents(liabilities.find(r=>r.SyntetickyUcet==='451')!.ObdobiBezne),13524177101);
 assert.equal(cents(assets.find(r=>r.SyntetickyUcet==='231')!.ObdobiBezneNetto),6626963522);
});
test('legacy March 2013 balance uses thousands and preserves original values',async()=>{
 const data=mapBalanceCsv(await fixture('2013-03-31'),'2013-03-31');
 assert.equal(data.sourceScale,1000);
 const total=data.Rozvaha.Aktiva.Radek.find(r=>r.Polozka==='AKTIVA')!;
 assert.equal(total.SourceCsv.ZU_AONET,'2519969.51');
 assert.equal(cents(total.ObdobiBezneNetto),251996951000);
});
test('archived quarter maps all accounts and rejects wrong city, period, duplicate or unreconciled totals',async()=>{
 const rows=await fixture('2026-03-31');
 const mapped=mapBalanceCsv(rows,'2026-03-31');assert.equal(mapped.sourceScale,1);
 assert.equal(cents(mapped.Rozvaha.Aktiva.Radek.find(r=>r.Polozka==='AKTIVA')!.ObdobiBezneNetto),391858454160);
 assert.throws(()=>mapBalanceCsv(rows,'2026-06-30'),/period/);
 assert.throws(()=>mapBalanceCsv([{...rows[0],ZC_ICO:'99999999'},...rows.slice(1)],'2026-03-31'),/identity/);
 assert.throws(()=>mapBalanceCsv([...rows,rows[0]],'2026-03-31'),/Duplicate/);
 assert.throws(()=>mapBalanceCsv(rows.map(r=>r.ZC_POLVYK==='PASIVA'?{...r,ZU_AONET:'1'}:r),'2026-03-31'),/reconciliation/);
});
test('CSV reader accepts padded city IDs and DOS EOF but rejects malformed records',async()=>{
 const header='ZC_ICO;value\n';
 assert.deepEqual(await readCityCsv(Readable.from([header+'0000266027;12\n99999999;99\n\x1a'])),[{ZC_ICO:'0000266027',value:'12'}]);
 await assert.rejects(()=>readCityCsv(Readable.from([header+'00266027;12;unexpected\n'])),/Record Length/);
});
test('2014 descriptive SAP header is normalized without relaxing data quoting',async()=>{
 const header='"""IČO"""ZC_UCJED__ZC_ICO:ZC_ICO;"""Období"""FISCPER:0FISCPER;"""Účet"""/BIC/ZC_SYNUC_0013:ZC_SYNUC;"""Netto"""KYF_0003:ZU_AONET\r\n';
 assert.deepEqual(await readCityCsv(Readable.from([header.slice(0,30),header.slice(30)+'00266027;2014009;231;12.34\r\n99999999;2014009;231;1\r\n'])),[{ZC_ICO:'00266027','0FISCPER':'2014009',ZSYN_UCET:'231',ZU_AONET:'12.34'}]);
 assert.deepEqual(await readCityCsv(Readable.from(['ZC_ICO:ZC_ICO;ZC_SYNUC:ZC_SYNUC\n00266027;231\n'])),[{ZC_ICO:'00266027',ZSYN_UCET:'231'}]);
 await assert.rejects(()=>readCityCsv(Readable.from([header+'00266027;2014009;231;"12"/bad\n'])),/Invalid Closing Quote/);
 await assert.rejects(()=>readCityCsv(Readable.from([header.replace('KYF_0003:ZU_AONET','bad')+'00266027;2014009;231;12\n'])),/legacy CSV header/);
});
test('actual legacy RAR and current ZIP archives agree with independent libarchive extraction',{skip:!process.env.SOURCE_TESTS},async()=>{
 for(const [period,file,format]of [['2013-03-31','fa72d523d666b39199668d7b7d3bcd5dab990c1f737beaa5669379a18925df2d.zip','rar'],['2026-03-31','08f09c2981ddf81a8bf915226ec2356eb8c4e76ce6ae26cd043f0d08655a24b1.zip','zip']]){
  const extracted=await readOfficialArchive('data/raw/'+file);assert.equal(extracted.format,format);
  const order=(rows:Xml[])=>rows.sort((a,b)=>(a.ZC_POLVYK+'|'+a.ZSYN_UCET).localeCompare(b.ZC_POLVYK+'|'+b.ZSYN_UCET));
  assert.deepEqual(order(Object.values(extracted.files).flat()),order(await fixture(period)));
 }
});
