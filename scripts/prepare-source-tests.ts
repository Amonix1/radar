import fs from 'node:fs/promises';
import {download,requestBody,MONITOR} from '../src/lib/monitor';
await fs.mkdir('data/research',{recursive:true});
for(const [name,url,init] of [
 ['2025-8-051.xml',MONITOR+'/api/monitorws',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'http://schemas.xmlsoap.org/wsdl/soap'},body:requestBody('2025-08-31','051',undefined,2025)}],
 ['paragraf.xml',MONITOR+'/data/xml/paragraf.xml',undefined],
 ['polozka.xml',MONITOR+'/data/xml/polozka.xml',undefined]
] as [string,string,RequestInit|undefined][]){const payload=await download(url,init);await fs.writeFile('data/research/'+name,payload);console.log('Saved official source fixture',name);}
