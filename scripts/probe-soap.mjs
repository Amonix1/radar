import fs from 'node:fs/promises';
for(const [year,month,report] of [[2026,8,'063'],[2025,8,'051'],[2026,8,'100'],[2026,6,'001']]) {
 const date=`${year}-${String(month).padStart(2,'0')}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`;
 const body=`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:req="urn:cz:mfcr:monitor:schemas:MonitorRequest:v1" xmlns:mon="urn:cz:mfcr:monitor:schemas:MonitorTypes:v1"><soapenv:Body><req:MonitorRequest><req:Hlavicka><mon:OrganizaceIC>00266027</mon:OrganizaceIC><mon:Rok>${year}</mon:Rok><mon:Obdobi>${date}</mon:Obdobi><mon:Vykaz>${report}</mon:Vykaz><mon:Rad>1</mon:Rad></req:Hlavicka></req:MonitorRequest></soapenv:Body></soapenv:Envelope>`;
 const r=await fetch('https://monitor.statnipokladna.gov.cz/api/monitorws',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'http://schemas.xmlsoap.org/wsdl/soap'},body});const t=await r.text();
 await fs.writeFile(`data/research/${year}-${month}-${report}.xml`,t);console.log(report,r.status,t.length,t.slice(0,6000));
}
for(const name of ['paragraf','polozka']){const t=await (await fetch('https://monitor.statnipokladna.gov.cz/data/xml/'+name+'.xml')).text();await fs.writeFile('data/research/'+name+'.xml',t);console.log(name,t.slice(0,2500));}
