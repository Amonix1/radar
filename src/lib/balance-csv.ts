import {ICO,cents,type Xml} from './monitor';
export function mapBalanceCsv(rows:Xml[],period:string) {
 const expected=period.slice(0,4)+'0'+period.slice(5,7),scale=period==='2013-03-31'?1000:1;
 const keys=new Set<string>(),assets:Xml[]=[],liabilities:Xml[]=[];
 const amount=(value:string)=>{
  const normalized=value.trim().endsWith('-')?'-'+value.trim().slice(0,-1):value.trim();
  const n=BigInt(cents(normalized))*BigInt(scale),sign=n<0?'-':'',abs=n<0?-n:n;
  if(!Number.isSafeInteger(Number(n)))throw new Error('Balance amount exceeds safe range');
  return `${sign}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;
 };
 for(const r of rows){
  if(String(r.ZC_ICO||'').replace(/^0+/,'')!==ICO.replace(/^0+/,'')||r.ZC_VYKAZ!=='001'||r.ZC_VTAB!=='000100'||r['0FISCPER']!==expected)throw new Error('Balance CSV identity or period mismatch');
  const code=r.ZC_POLVYK,account=r.ZSYN_UCET;
  const section=code==='AKTIVA'||/^[AB]\./.test(code)?assets:code==='PASIVA'||/^[CD]\./.test(code)?liabilities:null;
  if(!section||!/^(-|\d{3})$/.test(account))throw new Error('Unknown balance row or account');
  const key=code+'|'+account;if(keys.has(key))throw new Error('Duplicate balance row');keys.add(key);
  section.push({Polozka:code,SyntetickyUcet:account,ObdobiBezneNetto:amount(r.ZU_AONET),ObdobiBezne:amount(r.ZU_AONET),SourceCsv:r});
 }
 const a=assets.find(r=>r.Polozka==='AKTIVA'),p=liabilities.find(r=>r.Polozka==='PASIVA');
 if(!a||!p||cents(a.ObdobiBezneNetto)!==cents(p.ObdobiBezne))throw new Error('Balance CSV reconciliation failed');
 return {sourceScale:scale,Rozvaha:{Aktiva:{Radek:assets},Pasiva:{Radek:liabilities}}};
}
