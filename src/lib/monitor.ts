import { XMLParser, XMLValidator } from 'fast-xml-parser';
export const MONITOR='https://monitor.statnipokladna.gov.cz';
export const ICO='00266027';
export type Xml = Record<string, any>;
export const parser=new XMLParser({removeNSPrefix:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false});
export const array=<T,>(v:T|T[]|undefined):T[]=>v===undefined?[]:Array.isArray(v)?v:[v];
export function cents(v:unknown):number {
 if(typeof v!=='string'||! /^-?\d+(\.\d{1,2})?$/.test(v)) throw new Error(`Neplatná částka: ${String(v)}`);
 const negative=v.startsWith('-');const [a,b='']=v.replace('-','').split('.');
 const amount=BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
 const n=Number(negative?-amount:amount);if(!Number.isSafeInteger(n))throw new Error('Částka překračuje bezpečný rozsah haléřů');return n;
}
export function parseResponse(payload:string,ico:string,period:string,report:string):Xml {
 if(XMLValidator.validate(payload)!==true)throw new Error('Neplatné XML');
 const body=parser.parse(payload).Envelope?.Body;
 if(body?.Fault)throw new Error(body.Fault.faultstring||'SOAP fault');
 const response=body?.MonitorResponse;
 if(!response?.VykazData)throw new Error('Výkaz není přítomen');
 const h=response.Hlavicka;
 if(h.OrganizaceIC!==ico||h.Obdobi!==period||h.Vykaz!==report||h.Rad!=='1')throw new Error('Hlavička neodpovídá požadovanému IČO, období, výkazu nebo jednotkám Kč');
 return response.VykazData;
}
export function requestBody(period:string|undefined,report:string,ico=ICO,year?:number) {
 if(!/^\d{8}$/.test(ico)||!/^\d{3}$/.test(report)||(period&&!/^\d{4}-\d{2}-\d{2}$/.test(period)))throw new Error('Invalid SOAP arguments');
 return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:r="urn:cz:mfcr:monitor:schemas:MonitorRequest:v1" xmlns:m="urn:cz:mfcr:monitor:schemas:MonitorTypes:v1"><s:Body><r:MonitorRequest><r:Hlavicka><m:OrganizaceIC>${ico}</m:OrganizaceIC>${year?`<m:Rok>${year}</m:Rok>`:''}${period?`<m:Obdobi>${period}</m:Obdobi>`:''}<m:Vykaz>${report}</m:Vykaz><m:Rad>1</m:Rad></r:Hlavicka></r:MonitorRequest></s:Body></s:Envelope>`;
}
export async function download(url:string,init?:RequestInit):Promise<string> {
 if(new URL(url).hostname!=='monitor.statnipokladna.gov.cz')throw new Error('Nepovolený zdroj');
 let last:unknown;
 for(let attempt=0;attempt<3;attempt++) {
  try {const r=await fetch(url,{...init,signal:AbortSignal.timeout(60000)});const text=await r.text();
   if(!r.ok){const e=new Error(`MONITOR HTTP ${r.status}: ${text.slice(0,500)}`);if(r.status<500&&r.status!==429)throw Object.assign(e,{permanent:true});throw e;}return text;
  } catch(e){last=e;if((e as {permanent?:boolean}).permanent)throw e;if(attempt<2)await new Promise(r=>setTimeout(r,1000*2**attempt));}
 } throw last;
}
export type Code={code:string;from:string;to:string;name:string;group:string;className:string;consolidation:boolean};
export function parseCodes(xml:string,kind:'paragraph'|'item'):Code[] {
 const root=Object.values(parser.parse(xml)).find((v:any)=>v?.row) as Xml;
 return array<Xml>(root.row).map(r=>({code:r[kind==='item'?'polozka':'paragraf'],from:r.start_date,to:r.end_date,name:r.nazev,group:r.oddil||r.seskupeni||r.skupina,className:r.trida||'',consolidation:r.kon_pol==='true'}));
}
export function codeAt(codes:Code[],code:string,date:string) {return codes.find(c=>c.code===code&&c.from<=date&&c.to>=date);}
export type Fact={row_number:number;paragraph:string;item:string;flow:'income'|'expense'|'financing';class_code:string;purpose:string|null;partner:string|null;instrument:string|null;spatial:string|null;paragraph_name:string;item_name:string;sector:string;consolidated_out:boolean;approved_cents:number;amended_cents:number;actual_cents:number;original_values:Xml};
export type Amounts={approved:number;amended:number;actual:number};
export type Check={name:string;passed:boolean;details:Xml};
export function normalize(data:Xml,date:string,paragraphs:Code[],items:Code[]) {
 const modern=!!data.Fin212M2026;const fin=data.Fin212M2026||data.Fin212M;
 if(!fin)throw new Error('Neznámé schéma FIN');
 const source:Xml[]=modern?array(fin.CastI?.Radek):[...array<Xml>(fin.PrijmyRozpoctove?.Radek),...array<Xml>(fin.VydajeRozpoctove?.Radek),...array<Xml>(fin.Financovani?.Radek).filter(r=>r.RadekCislo!=='8000').map(r=>({...r,Paragraf:'0000',Polozka:r.RadekCislo}))];
 const keys=new Set<string>();
 const facts:Fact[]=source.map((r,i)=>{
  const item=String(r.Polozka);const paragraph=String(r.Paragraf);
  if(!/^[1234568]\d{3}$/.test(item)||!/^\d{4}$/.test(paragraph))throw new Error(`Neznámý kód ${paragraph}/${item}`);
  const partner=r.Partner ? (typeof r.Partner==='object'?JSON.stringify(r.Partner):String(r.Partner)) : null;
  const key=[paragraph,item,r.ZnakUcelovy||'',r.JednotkaProstorova||'',r.Nastroj||'',r.UdalostMimoradna||'',partner||''].join('|');
  if(keys.has(key))throw new Error(`Duplicitní rozpočtová věta: ${key}`);keys.add(key);
  const p=codeAt(paragraphs,paragraph,date),d=codeAt(items,item,date);
  return {row_number:i+1,paragraph,item,flow:item[0]==='8'?'financing':Number(item[0])<5?'income':'expense',class_code:item[0],purpose:r.ZnakUcelovy||null,partner,instrument:r.Nastroj||null,spatial:r.JednotkaProstorova||null,paragraph_name:p?.name||`Paragraf ${paragraph}`,item_name:d?.name||`Financování ${item}`,sector:p?.group||'Financování',consolidated_out:d?.consolidation||false,approved_cents:cents(r.RozpocetSchvaleny),amended_cents:cents(r.RozpocetPoZmenach),actual_cents:cents(r.Vysledek),original_values:r};
 });
 const sum=(filter:(f:Fact)=>boolean):Amounts=>facts.filter(filter).reduce((a,f)=>({approved:a.approved+f.approved_cents,amended:a.amended+f.amended_cents,actual:a.actual+f.actual_cents}),{approved:0,amended:0,actual:0});
 const net=(f:Fact)=>!f.consolidated_out;
 const metrics:Record<string,Amounts>={
  income:sum(f=>net(f)&&f.flow==='income'),expense:sum(f=>net(f)&&f.flow==='expense'),
  operatingIncome:sum(f=>net(f)&&['1','2'].includes(f.class_code)||net(f)&&f.item.startsWith('41')),
  operatingExpense:sum(f=>net(f)&&f.class_code==='5'),investments:sum(f=>net(f)&&f.class_code==='6'),
  tax:sum(f=>net(f)&&f.class_code==='1'),nonTax:sum(f=>net(f)&&f.class_code==='2'),capitalIncome:sum(f=>net(f)&&f.class_code==='3'),transfers:sum(f=>net(f)&&f.class_code==='4'),
  financing:sum(f=>f.flow==='financing'),debtService:sum(f=>net(f)&&f.item==='5141'||['8112','8114','8122','8124','8212','8214','8222','8224'].includes(f.item))
 };
 // Financing repayments carry a negative sign; debt service is interest plus positive repayment magnitude.
 metrics.debtService=sum(f=>net(f)&&f.item==='5141');
 const repayments=sum(f=>['8112','8114','8122','8124','8212','8214','8222','8224'].includes(f.item));
 for(const k of ['approved','amended','actual'] as const) metrics.debtService[k]-=repayments[k];
 const subtract=(a:Amounts,b:Amounts):Amounts=>({approved:a.approved-b.approved,amended:a.amended-b.amended,actual:a.actual-b.actual});
 metrics.balance=subtract(metrics.income,metrics.expense);metrics.operatingBalance=subtract(metrics.operatingIncome,metrics.operatingExpense);
 // Early extracts are rounded to 0.01 thousand CZK (10 CZK per row).
 const rounded=!modern&&(Number(date.slice(0,4))<=2012||data.sourceScale===1000)&&facts.every(f=>[f.approved_cents,f.amended_cents,f.actual_cents].every(v=>v%1000===0));
 const tolerance=rounded?(facts.length+1)*500:1;
 const checks:Check[]=[{name:'non_empty',passed:facts.length>0,details:{rows:facts.length,schema:modern?'063':'051',source_resolution_cents:rounded?1000:1}}];
 for(const measure of ['approved','amended','actual'] as const) {
  const diff=metrics.balance[measure]+metrics.financing[measure];
  checks.push({name:`balance_identity_${measure}`,passed:Math.abs(diff)<=tolerance,details:{difference_cents:diff,tolerance_cents:tolerance}});
 }
 if(!modern) {
  const recap=array<Xml>(fin.RekapitulacePrijmyVydaje?.Radek);
  for(const [code,metric] of [['4050','grossIncome'],['4240','grossExpense'],['4200','income'],['4430','expense'],['4440','balance']] as const){
   const row=recap.find(r=>r.RadekCislo===code);
   if(!row)throw new Error(`Chybí kontrolní řádek ${code}`);
   const calculated=metric==='grossIncome'?sum(f=>f.flow==='income'):metric==='grossExpense'?sum(f=>f.flow==='expense'):metrics[metric];
   for(const [measure,field] of [['approved','RozpocetSchvaleny'],['amended','RozpocetPoZmenach'],['actual','Vysledek']] as const){const expected=cents(row[field]);checks.push({name:`recap_${code}_${measure}`,passed:Math.abs(calculated[measure]-expected)<=tolerance,details:{expected_cents:expected,calculated_cents:calculated[measure],tolerance_cents:tolerance}});}
  }
 }
 const bank=array<Xml>((modern?fin.CastII:fin.UctyBankovniStavyAObraty)?.Radek);
 return {facts,metrics,checks,bank,modern};
}
