import {getBundle} from './repository';
import {db} from './db';
import {ICO} from './monitor';
import {change,definitions} from './analytics';
import {money,periodLabel} from './utils';
export const analystTools=[
 {name:'budget_summary',description:'Ověřené KPI města pro explicitní období'},
 {name:'seasonal_outliers',description:'Čerpání proti nejvýše pěti stejným historickým obdobím'},
 {name:'sector_history',description:'Konsolidovaná časová řada zvoleného odvětví'},
 {name:'fastest_growing_expenses',description:'Odvětví s nejvyšší meziroční změnou, základ nejméně 1 mil. Kč'}
] as const;
export type AnalystAnswer={tool:string;facts:string[];calculation:string;interpretation:string;sources:{period:string;url:string;snapshot:number}[]};
export async function answerQuestion(question:string,period?:string):Promise<AnalystAnswer> {
 const b=await getBundle({period});const q=question.toLowerCase();
 const sources=[{period:b.period,url:b.source.url,snapshot:b.source.snapshot}];
 if(/neobvykl|rychle.*čerp|cerpa|čerp|pozornost/.test(q))return {tool:'seasonal_outliers',facts:b.alerts.filter(a=>a.kind==='attention'&&a.title.startsWith('Neobvyklé čerpání')).map(a=>`${a.title}. ${a.text} ${a.evidence}`),calculation:'Skutečnost / upravený rozpočet × 100; stejné měsíce předchozích nejvýše pěti let, minimálně tři pozorování. Signál při překročení min–max o více než 5 p. b.',interpretation:'Odchylka je signál k ověření harmonogramu a rozpočtových změn. Příčinu nelze určit jen z výkazu. Pokud seznam zůstává prázdný, engine v souhrnných ukazatelích odchylku nenašel.',sources};
 if(/dopr|deset|10 let|2015/.test(q)){
  const metric=/dopr/.test(q)?'Doprava':'Celkové výdaje';
  const r=await db().query(`SELECT period::text,max(source_url) source_url,max(snapshot_id) snapshot,sum(actual_cents)/100.0 value FROM public_budget_fact WHERE entity_ico=$1 AND flow='expense' AND NOT consolidated_out AND ($2::boolean=false OR paragraph LIKE '22%') AND extract(month FROM period)=12 AND period<=$3 GROUP BY period ORDER BY period`,[ICO,metric==='Doprava',b.period]);
  const requestedYear=q.match(/(?:od|roku)\s*(20\d{2}|19\d{2})/);const fromYear=requestedYear?Number(requestedYear[1]):Number(r.rows.at(-1)?.period.slice(0,4))-10;const rows=r.rows.filter(r=>Number(r.period.slice(0,4))>=fromYear);const first=rows[0],last=rows.at(-1);
  return {tool:'sector_history',facts:rows.map(r=>`${r.period.slice(0,4)}: ${money(Number(r.value),false)}`),calculation:first&&last?`${metric}: změna ${change(Number(last.value),Number(first.value))?.toFixed(1)} % mezi ${first.period.slice(0,4)} a ${last.period.slice(0,4)}. Nominální Kč, uzavřené roky.`:'Nedostatek uzavřených let.',interpretation:'Růst může souviset s rozsahem služeb, cenami i investicemi. Výkazy samy neprokazují příčinu. Doprava zahrnuje paragrafy 22xx.',sources:rows.map(r=>({period:r.period,url:r.source_url,snapshot:Number(r.snapshot)}))};
 }
 if(/nejrych|rostou|růst|rust/.test(q)){
  const prior=b.series.find(s=>s.period.slice(0,7)===`${Number(b.period.slice(0,4))-1}${b.period.slice(4,7)}`);
  if(!prior)return {tool:'fastest_growing_expenses',facts:[],calculation:'Stejné období předchozího roku chybí.',interpretation:'Srovnání není možné.',sources};
  const r=await db().query(`SELECT period::text,sector,sum(actual_cents)/100.0 value FROM public_budget_fact WHERE entity_ico=$1 AND period IN ($2,$3) AND flow='expense' AND NOT consolidated_out GROUP BY period,sector`,[ICO,b.period,prior.period]);
  const previous=new Map(r.rows.filter(r=>r.period===prior.period).map(r=>[r.sector,Number(r.value)]));
  const growth=r.rows.filter(r=>r.period===b.period&&Number(previous.get(r.sector))>=1e6).map(r=>({name:r.sector,value:Number(r.value),previous:previous.get(r.sector)!,change:change(Number(r.value),previous.get(r.sector))!})).sort((a,b)=>b.change-a.change).slice(0,5);
  return {tool:'fastest_growing_expenses',facts:growth.map(r=>`${r.name}: ${money(r.value)}, meziročně ${r.change.toFixed(1)} % (z ${money(r.previous)}).`),calculation:'(Skutečnost aktuální − skutečnost předchozí) / |skutečnost předchozí| × 100. Základ předchozího roku nejméně 1 mil. Kč.',interpretation:'Pořadí popisuje tempo změny. Vyšší výdaje nejsou automaticky negativní.',sources:[...sources,{period:prior.period,url:prior.sourceUrl!,snapshot:prior.snapshot}]};
 }
 if(/hospod|rozpoč|rozpoc|příjm|prijm|saldo|invest/.test(q))return {tool:'budget_summary',facts:['income','expense','balance','operatingBalance','investments'].map(k=>`${definitions[k].label}: ${money(b.metrics[k]?.actual,false)} (${periodLabel(b.period)}).`),calculation:'Konsolidované součty FIN; saldo = příjmy − výdaje; provozní saldo = provozní příjmy − provozní výdaje.',interpretation:'Výsledky jsou kumulativní od počátku roku. Pro příčiny změn je nutné doplnit podklady města a harmonogram investic.',sources};
 return {tool:'unsupported',facts:[],calculation:'Dotaz neodpovídá dostupným analytickým nástrojům.',interpretation:'Použijte některý z navržených dotazů. Jazykový model zatím není připojen; tato verze používá deterministické nástroje nad databází a nevytváří volné odpovědi.',sources:[]};
}

