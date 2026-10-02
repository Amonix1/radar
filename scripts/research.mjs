import fs from 'node:fs/promises';
await fs.mkdir('data/research', {recursive:true});
const base='https://monitor.statnipokladna.gov.cz';
const cat=await (await fetch(base+'/api/opendata/monitor')).json();
await fs.writeFile('data/research/catalog.json',JSON.stringify(cat,null,2));
const fin=cat['datová_sada'].filter(x=>/Fin|fin|soap/.test(x));
console.log('FIN catalogs',fin.filter(x=>x.split('/').length===7));
console.log('Recent FIN',fin.filter(x=>/202[456]_/.test(x)).slice(-45));
for(const url of [base+'/api/opendata/monitor/soap',base+'/api/monitorws?wsdl',base+'/datovy-katalog/webova-sluzba']) {
 const r=await fetch(url); const text=await r.text();
 await fs.writeFile('data/research/'+(url.includes('wsdl')?'monitor.wsdl':url.endsWith('soap')?'soap.json':'soap-doc.html'),text);
 console.log(url,r.status,text.slice(0,1000));
}
