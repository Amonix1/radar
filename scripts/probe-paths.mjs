import fs from 'node:fs/promises';
import {XMLParser} from 'fast-xml-parser';
const base='https://monitor.statnipokladna.gov.cz';
for(const path of ['/data/extrakty/csv/FinM/2010_12_Data_CSUIS_FINM.zip','/data/extrakty/csv/FinM/2010_12_Data_CSUIS_FINM/','/data/extrakty/2010_12_Data_CSUIS_FINM.zip']){
 const r=await fetch(base+path);console.log(path,r.status,Object.fromEntries(r.headers));
 if(r.ok){const b=Buffer.from(await r.arrayBuffer());await fs.writeFile('data/research/bulk-2010.zip',b);console.log('Saved',b.length);}else await r.body.cancel();
}
for(const year of [2026,2025,2010]){
 const body=`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:r="urn:cz:mfcr:monitor:schemas:MonitorRequest:v1" xmlns:m="urn:cz:mfcr:monitor:schemas:MonitorTypes:v1"><s:Body><r:MonitorRequest><r:Hlavicka><m:OrganizaceIC>00266027</m:OrganizaceIC><m:Rok>${year}</m:Rok><m:Vykaz>100</m:Vykaz><m:Rad>1</m:Rad></r:Hlavicka></r:MonitorRequest></s:Body></s:Envelope>`;
 const res=await fetch(base+'/api/monitorws',{method:'POST',headers:{'Content-Type':'text/xml'},body});const t=await res.text();console.log('IND',year,res.status,t.slice(0,1100));
 if(res.ok)await fs.writeFile('data/research/ind-'+year+'.xml',t);
}
