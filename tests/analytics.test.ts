import test from 'node:test';
import assert from 'node:assert/strict';
import {change,ratio,seasonality,trend,detectItems,type SeriesPoint,type BudgetRow} from '../src/lib/analytics';
import {cents,parseResponse,normalize,parseCodes,parser} from '../src/lib/monitor';
import fs from 'node:fs/promises';
test('money uses exact integer cents and rejects missing/invalid precision',()=>{assert.equal(cents('69923903.53'),6992390353);assert.equal(cents('-0.10'),-10);assert.equal(cents('0'),0);assert.throws(()=>cents('NaN'));assert.throws(()=>cents('1.234'));assert.throws(()=>cents(undefined));});
test('undefined ratios and zero prior are not fabricated as zero',()=>{assert.equal(ratio(10,0),null);assert.equal(change(10,0),null);assert.equal(change(-20,-10),-100);assert.equal(ratio(25,100),25);});
test('seasonality only uses the same month and previous five years',()=>{
 const point=(period:string,actual:number):SeriesPoint=>({period,snapshot:1,metrics:{expense:{approved:100,amended:100,actual}}});
 const data=[point('2020-08-31',100),point('2021-08-31',30),point('2022-08-31',35),point('2023-08-31',32),point('2024-06-30',99),point('2025-08-31',38),point('2026-08-31',51),point('2026-12-31',90)];
 const s=seasonality(data,'2026-08-31','expense');assert.equal(s.count,4);assert.equal(s.min,30);assert.equal(s.max,38);assert.equal(s.unusual,true);assert.equal(seasonality(data.slice(-3),'2026-08-31','expense').min,null);
});
test('CAGR uses elapsed years and never assigns a judgment to expenses',()=>{const t=trend([{year:2020,value:100},{year:2021,value:110},{year:2022,value:121}]);assert.ok(Math.abs(t.cagr!-10)<1e-9);assert.equal(t.direction,'Dlouhodobý růst');assert.equal(trend([{year:2020,value:-1},{year:2021,value:1},{year:2022,value:2}]).cagr,null);});
test('SOAP header prevents wrong city, report, period and currency scale',()=>{const xml='<Envelope><Body><MonitorResponse><Hlavicka><OrganizaceIC>00266027</OrganizaceIC><Obdobi>2026-08-31</Obdobi><Vykaz>063</Vykaz><Rad>1000</Rad></Hlavicka><VykazData><Fin212M2026/></VykazData></MonitorResponse></Body></Envelope>';assert.throws(()=>parseResponse(xml,'00266027','2026-08-31','063'));assert.throws(()=>parseResponse('<garbage','00266027','2026-08-31','063'));});
test('item signals require comparable material amounts and never invent inflation',()=>{
 const row=(actual:number):BudgetRow=>({paragraph:'2212',item:'5171',flow:'expense',classCode:'5',paragraphName:'Silnice',itemName:'Opravy',sector:'Doprava',approved:0,amended:0,actual});
 const signals=detectItems([row(4e6)],[row(2e6)],'2025-12-31','2024-12-31',5,2.5);
 assert.equal(signals.length,3);assert.ok(signals.every(s=>s.evidence.includes('2024-12-31')));assert.ok(signals.some(s=>s.title.startsWith('Růst nad inflací')));
 assert.equal(detectItems([row(4e6)],[row(2e6)],'2026-08-31','2025-08-31',5,null).filter(s=>s.title.startsWith('Růst nad inflací')).length,0);
 assert.equal(detectItems([row(2e6)],[row(0)],'2025-12-31','2024-12-31',5,2.5).length,0);
 assert.equal(detectItems([row(1.1e6)],[row(1e6)],'2025-12-31','2024-12-31',5,2.5).length,0);
 const annual=trend([{year:2024,value:100},{year:2025,value:120}]);assert.ok(Math.abs(annual.cagr!-20)<1e-9);assert.equal(annual.volatility,null);
});
test('new FIN preserves partner dimensions and does not add internal transfers',()=>{
 const row=(item:string,amount:string,partner?:string)=>({Paragraf:'0000',Polozka:item,RozpocetSchvaleny:amount,RozpocetPoZmenach:amount,Vysledek:amount,...(partner?{Partner:{PartnerIC:partner}}:{})});
 const data={Fin212M2026:{CastI:{Radek:[row('1111','100'),row('4121','10','00000001'),row('4121','20','00000002'),row('4134','1000'),{...row('5169','130'),Paragraf:'6171'},{...row('5345','1000'),Paragraf:'6330'}]}}};
 const codes=[{code:'4134',from:'2010-01-01',to:'9999-12-31',name:'Vnitřní převod',group:'',className:'',consolidation:true},{code:'5345',from:'2010-01-01',to:'9999-12-31',name:'Vnitřní převod',group:'',className:'',consolidation:true}];
 const n=normalize(data,'2026-08-31',[],codes);assert.equal(n.facts.length,6);assert.equal(n.metrics.income.actual,13000);assert.equal(n.metrics.expense.actual,13000);assert.ok(n.checks.every(c=>c.passed));assert.throws(()=>normalize({Fin212M2026:{CastI:{Radek:[row('1111','100'),row('1111','100')]}}},'2026-08-31',[],[]));
});
test('official Litvínov 2025 source reconciles exactly after consolidation',{skip:!process.env.SOURCE_TESTS},async()=>{
 const [xml,paragraphXml,itemXml]=await Promise.all(['data/research/2025-8-051.xml','data/research/paragraf.xml','data/research/polozka.xml'].map(f=>fs.readFile(f,'utf8')));
 const n=normalize(parseResponse(xml,'00266027','2025-08-31','051'),'2025-08-31',parseCodes(paragraphXml,'paragraph'),parseCodes(itemXml,'item'));
 assert.equal(n.metrics.income.actual,55051215904);assert.equal(n.metrics.expense.actual,55551831200);assert.equal(n.metrics.financing.actual,500615296);assert.ok(n.checks.every(c=>c.passed));
});
