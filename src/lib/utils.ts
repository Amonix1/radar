import {clsx,type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs));}
export const money=(n:number|null|undefined,compact=true)=>n==null?'Nedostupné':compact&&Math.abs(n)>=1e6?new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(n/1e6)+' mil. Kč':compact&&Math.abs(n)>=1000?new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(n/1000)+' tis. Kč':new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:2}).format(n);
export const pct=(n:number|null|undefined)=>n==null?'—':new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(n)+' %';
export const months=['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
export function periodLabel(p:string){return `${months[Number(p.slice(5,7))-1]} ${p.slice(0,4)}`;}
