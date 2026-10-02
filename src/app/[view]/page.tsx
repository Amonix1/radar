import {requirePageAccess} from '@/lib/page-access';
import {notFound} from 'next/navigation';
import {getBundle} from '@/lib/repository';
import {Dashboard} from '@/components/dashboard';
export const dynamic='force-dynamic';
const views=['cerpani','trendy','prijmy','vydaje','investice','zdravi','porovnani','analytik','metodika'];
export default async function Page({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {view}=await params;if(!views.includes(view))notFound();await requirePageAccess();const query=await searchParams;const filters=Object.fromEntries(['period','paragraph','item','scope','flow'].flatMap(k=>typeof query[k]==='string'?[[k,query[k]]]:[]));try{return <Dashboard key={view+JSON.stringify(filters)} initial={await getBundle(filters)} view={view}/>;}catch(e){return <main className="startup"><h1>Data nejsou dostupná</h1><p>{e instanceof Error?e.message:'Chyba načtení dat'}</p><a href="/">Zkusit znovu</a></main>;}}
