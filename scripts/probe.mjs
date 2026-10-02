import fs from 'node:fs/promises';
const base='https://monitor.statnipokladna.gov.cz';
for(const [name,path] of [
 ['request.xsd','/data/xsd/ws/monitorRequest.xsd'],['response.xsd','/data/xsd/ws/monitorResponse.xsd'],
 ['latest.json','/api/opendata/monitor/FinM_2026/2026_08_Data_CSUIS_FINM'],
 ['paragraf.json','/api/opendata/monitor/ciselnik-paragraf'],
 ['polozka.json','/api/opendata/monitor/ciselnik-rozpoctova-polozka']]) {
 const r=await fetch(base+path); const body=await r.text();await fs.writeFile('data/research/'+name,body);console.log(name,r.status,body);
}
