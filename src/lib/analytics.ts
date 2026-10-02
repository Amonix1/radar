export type Amount={approved:number;amended:number;actual:number};
export type Metrics=Record<string,Amount>;
export type SeriesPoint={period:string;metrics:Metrics;snapshot:number;sourceUrl?:string};
export type BudgetRow={paragraph:string;item:string;flow:string;classCode:string;paragraphName:string;itemName:string;sector:string;approved:number;amended:number;actual:number};
export const definitions:Record<string,{label:string;formula:string;unit?:string}>={
 income:{label:'Příjmy',formula:'Součet položek tříd 1–4 po vyloučení časově platných konsolidačních položek kon_pol.'},
 expense:{label:'Výdaje',formula:'Součet položek tříd 5–6 po vyloučení časově platných konsolidačních položek kon_pol.'},
 balance:{label:'Saldo',formula:'Konsolidované příjmy − konsolidované výdaje. Záporné saldo může souviset s investicemi; samo neurčuje finanční zdraví.'},
 operatingIncome:{label:'Provozní příjmy',formula:'Daňové + nedaňové příjmy + neinvestiční transfery (položky 41xx), po konsolidaci.'},
 operatingExpense:{label:'Provozní výdaje',formula:'Konsolidované výdaje třídy 5.'},
 operatingBalance:{label:'Provozní saldo',formula:'Provozní příjmy − provozní výdaje. Jde o rozpočtový, nikoli účetní výsledek.'},
 investments:{label:'Investice',formula:'Konsolidované kapitálové výdaje, třída 6. Obsahují i investiční transfery, nikoli pouze vlastní stavby.'},
 investmentPerCapita:{label:'Investice na obyvatele',formula:'Kapitálové výdaje / počet obyvatel podle MONITORu (ČSÚ) pro tentýž rok.'},
 investmentShare:{label:'Podíl investic',formula:'Kapitálové výdaje / konsolidované výdaje × 100.',unit:'%'},
 tax:{label:'Daňové příjmy',formula:'Konsolidované příjmy třídy 1.'},
 nonTax:{label:'Nedaňové příjmy',formula:'Konsolidované příjmy třídy 2.'},
 capitalIncome:{label:'Kapitálové příjmy',formula:'Konsolidované příjmy třídy 3.'},
 transfers:{label:'Transfery',formula:'Konsolidované přijaté transfery třídy 4. Vnitřní převody jsou vyloučeny.'},
 debt:{label:'Úvěrový dluh',formula:'Zůstatky pasiv rozvahy na účtech 281, 282, 283, 289, 451, 452 a 453. Zahrnuje úvěry a vydané dluhopisy. Nejde o úplný zákonný ukazatel dluhu. Období rozvahy může být starší než FIN.'},
 debtPerCapita:{label:'Dluh na obyvatele',formula:'Úvěrový dluh / počet obyvatel roku rozvahy.'},
 debtService:{label:'Dluhová služba',formula:'Úroky (5141) + absolutní hodnota splátek jistiny (8112, 8114, 8122, 8124, 8212, 8214, 8222, 8224). Neobsahuje veškeré bankovní poplatky.'},
 operatingRatio:{label:'Běžné výdaje / příjmy',formula:'Provozní výdaje / provozní příjmy × 100.',unit:'%'},
 ownResources:{label:'Vlastní financování investic',formula:'Provozní saldo / kapitálové výdaje × 100. Indikátor krytí investic z provozního přebytku; nezahrnuje dřívější rezervy.',unit:'%'},
 cash:{label:'Peněžní prostředky',formula:'Zůstatky aktiv rozvahy účtů 231, 236, 244, 245 a 261. Mohou obsahovat účelově vázané prostředky; nejsou totožné s volně disponibilní rezervou.'},
 execution:{label:'Čerpání výdajů',formula:'Skutečné konsolidované výdaje od počátku roku / upravený roční rozpočet × 100.',unit:'%'},
 financing:{label:'Financování',formula:'Součet detailních položek třídy 8. Rekapitulační součtový řádek 8000 se nezapočítává.'}
};
export function ratio(n:number|null|undefined,d:number|null|undefined):number|null {return n==null||d==null||d===0?null:n/d*100;}
export function change(current:number|null|undefined,previous:number|null|undefined):number|null {return current==null||previous==null||previous===0?null:(current-previous)/Math.abs(previous)*100;}
export function seasonality(series:SeriesPoint[],period:string,metric:string) {
 const year=Number(period.slice(0,4)),month=period.slice(5,7);
 const observations=series.filter(p=>p.period.slice(5,7)===month&&Number(p.period.slice(0,4))>=year-5&&Number(p.period.slice(0,4))<year).map(p=>({period:p.period,value:ratio(p.metrics[metric]?.actual,p.metrics[metric]?.amended)})).filter((x):x is {period:string;value:number}=>x.value!==null);
 const values=observations.map(p=>p.value),actual=series.find(p=>p.period===period)?.metrics[metric];
 const current=ratio(actual?.actual,actual?.amended);
 return {observations,count:values.length,min:values.length>=3?Math.min(...values):null,max:values.length>=3?Math.max(...values):null,mean:values.length>=3?values.reduce((a,b)=>a+b,0)/values.length:null,current,unusual:values.length>=3&&current!==null&&(current<Math.min(...values)-5||current>Math.max(...values)+5)};
}
export function trend(points:{year:number;value:number}[]) {
 if(points.length<2)return {direction:'Nedostatek období',cagr:null,volatility:null};
 const first=points[0],last=points.at(-1)!;
 const cagr=first.value>0&&last.value>0?(Math.pow(last.value/first.value,1/(last.year-first.year))-1)*100:null;
 const changes=points.slice(1).map((p,i)=>change(p.value,points[i].value)).filter((v):v is number=>v!==null);
 const mean=changes.reduce((a,b)=>a+b,0)/changes.length;
 const volatility=changes.length>=2?Math.sqrt(changes.reduce((a,b)=>a+(b-mean)**2,0)/changes.length):null;
 return {direction:cagr===null?'CAGR není definováno':Math.abs(cagr)<1?'Přibližně stabilní':cagr>0?points.length===2?'Meziroční růst':'Dlouhodobý růst':points.length===2?'Meziroční pokles':'Dlouhodobý pokles',cagr,volatility};
}
export type Alert={kind:'fact'|'interpretation'|'attention';title:string;text:string;metric:string;evidence:string};
export function detectItems(current:BudgetRow[],previous:BudgetRow[],period:string,priorPeriod:string,totalGrowth:number|null,inflation:number|null):Alert[]{
 const prior=new Map(previous.map(r=>[r.paragraph+':'+r.item,r]));
 const signals:Alert[]=[];
 for(const r of current.filter(r=>r.flow==='expense')){
  const p=prior.get(r.paragraph+':'+r.item);if(!p||p.actual<1e6||Math.abs(r.actual-p.actual)<1e6)continue;
  const growth=change(r.actual,p.actual)!;
  const evidence=`§ ${r.paragraph}, položka ${r.item}; ${period}: ${r.actual.toFixed(2)} Kč, ${priorPeriod}: ${p.actual.toFixed(2)} Kč. Změna (aktuální − předchozí) / |předchozí| × 100 = ${growth.toFixed(1)} %.`;
  const name=r.itemName+' · § '+r.paragraph;
  if(totalGrowth!==null&&growth>=totalGrowth+10)signals.push({kind:'fact',metric:'expense',title:`Rychlejší růst než celkové výdaje: ${name}`,text:`Položka +${growth.toFixed(1)} %, celkové výdaje ${totalGrowth.toFixed(1)} %. Rozdíl nejméně 10 p. b.; nejde o automatické hodnocení hospodárnosti.`,evidence});
  if(inflation!==null&&growth>=inflation+5)signals.push({kind:'fact',metric:'expense',title:`Růst nad inflací: ${name}`,text:`Položka +${growth.toFixed(1)} %, roční průměrná inflace ČSÚ ${inflation.toFixed(1)} %. Oba údaje za uzavřený rok; rozdíl nejméně 5 p. b.`,evidence});
  if(Math.abs(growth)>=50)signals.push({kind:'attention',metric:'expense',title:`Skoková změna položky: ${name}`,text:`Meziroční změna ${growth.toFixed(1)} %. Výchozí hodnota i absolutní změna nejméně 1 mil. Kč. Ověřte rozsah plnění, rozpočtové změny a případné změny klasifikace; příčinu data neurčují.`,evidence});
 }
 return ['Skoková změna','Rychlejší růst','Růst nad inflací'].flatMap(prefix=>signals.filter(s=>s.title.startsWith(prefix)).slice(0,6));
}
export function detect(series:SeriesPoint[],period:string):Alert[] {
 const now=series.find(p=>p.period===period),prev=series.find(p=>p.period.slice(0,7)===`${Number(period.slice(0,4))-1}${period.slice(4,7)}`);
 if(!now)return [];
 const out:Alert[]=[];
 for(const metric of ['income','expense','investments','operatingBalance','tax','transfers']){
  const c=now.metrics[metric]?.actual,p=prev?.metrics[metric]?.actual,yoy=change(c,p);
  if(yoy!==null&&Math.abs(yoy)>=15)out.push({kind:'fact',metric,title:`${definitions[metric].label}: ${yoy>0?'+':''}${yoy.toFixed(1)} %`,text:'Změna proti stejnému období předchozího roku. Data sama nevysvětlují její příčinu.',evidence:`${period} (${c?.toFixed(2)} Kč), ${prev?.period} (${p?.toFixed(2)} Kč). (aktuální − předchozí) / |předchozí|.`});
  const s=seasonality(series,period,metric);if(s.unusual&&metric!=='operatingBalance')out.push({kind:'attention',metric,title:`Neobvyklé čerpání: ${definitions[metric].label.toLowerCase()}`,text:`Aktuálně ${s.current?.toFixed(1)} %, historické rozpětí ${s.min?.toFixed(1)}–${s.max?.toFixed(1)} %. Rozdíl přesahuje 5 procentních bodů.`,evidence:`${s.count} srovnatelných období: ${s.observations.map(o=>o.period).join(', ')}. Rozpětí min–max, nejde o statistický interval spolehlivosti.`});
  const same=series.filter(p=>p.period.slice(5,7)===period.slice(5,7)&&Number(p.period.slice(0,4))>=Number(period.slice(0,4))-5&&p.period<period);
  const vals=same.map(p=>p.metrics[metric]?.actual).filter((v):v is number=>v!==undefined);
  if(vals.length>=3){const avg=vals.reduce((a,b)=>a+b,0)/vals.length;const delta=change(c,avg);if(delta!==null&&Math.abs(delta)>=25)out.push({kind:'fact',metric,title:`Odchylka od historického průměru`,text:`${definitions[metric].label} jsou ${delta>0?'o':'nižší o'} ${Math.abs(delta).toFixed(1)} % ${delta>0?'vyšší než':'proti'} průměr dostupných stejných období.`,evidence:`Průměr ${avg.toFixed(2)} Kč; ${vals.length} období za předchozích nejvýše 5 let.`});}
 }
 const share=ratio(now.metrics.investments?.actual,now.metrics.expense?.actual),pastShare=ratio(prev?.metrics.investments?.actual,prev?.metrics.expense?.actual);
 if(share!==null&&pastShare!==null&&Math.abs(share-pastShare)>=5)out.push({kind:'fact',metric:'investmentShare',title:'Změna struktury výdajů',text:`Podíl investic se meziročně změnil o ${(share-pastShare).toFixed(1)} procentního bodu.`,evidence:`Třída 6 / třídy 5–6 po konsolidaci, ${period} a ${prev?.period}.`});
 if(now.metrics.balance?.actual<0&&now.metrics.operatingBalance?.actual>0)out.push({kind:'interpretation',metric:'balance',title:'Deficit při provozním přebytku',text:'Provozní část vykazuje přebytek, celkové výdaje převyšují příjmy. Pro posouzení krytí je nutné sledovat financování a rozvahu.',evidence:`Saldo ${now.metrics.balance.actual.toFixed(2)} Kč, provozní saldo ${now.metrics.operatingBalance.actual.toFixed(2)} Kč. Příčina změny není určena.`});
 for(const metric of ['operatingExpense','tax','investments']){
  const annual=series.filter(p=>p.period.endsWith('12-31')&&p.period<=period).slice(-6).map(p=>({year:Number(p.period.slice(0,4)),value:p.metrics[metric]?.actual||0}));const t=trend(annual);
  if(t.cagr!==null)out.push({kind:'interpretation',metric,title:`${definitions[metric].label}: ${t.direction.toLowerCase()}`,text:`Průměrná roční změna ${t.cagr.toFixed(1)} %. Samotný růst či pokles není hodnocen jako dobrý nebo špatný.`,evidence:`CAGR z ${annual[0]?.year}–${annual.at(-1)?.year}; ${annual.length} uzavřených let. Volatilita meziročních změn ${t.volatility?.toFixed(1)} p. b.`});
 }
 return out;
}
