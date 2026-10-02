import fs from 'node:fs/promises';
for(const path of ['/api/opendata/monitor/FinM/2010_12_Data_CSUIS_FINM','/api/opendata/monitor/FinM/2024_08_Data_CSUIS_FINM']){
 const d=await (await fetch('https://monitor.statnipokladna.gov.cz'+path)).json();
 const url=d.distribuce.find(x=>x.soubor_ke_stažení)?.soubor_ke_stažení;console.log(d.název,url);
 const r=await fetch(url);console.log('HEADERS',Object.fromEntries(r.headers));
 if(path.includes('2010')){const b=Buffer.from(await r.arrayBuffer());await fs.writeFile('data/research/bulk-2010.zip',b);console.log('Saved',b.length);}else await r.body.cancel();
}
