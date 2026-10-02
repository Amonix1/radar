import {requirePageAccess} from '@/lib/page-access';
import {getBundle} from '@/lib/repository';
import {Dashboard} from '@/components/dashboard';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){await requirePageAccess();const query=await searchParams;const filters=Object.fromEntries(['period','paragraph','item','scope','flow'].flatMap(k=>typeof query[k]==='string'?[[k,query[k]]]:[]));try{return <Dashboard key={JSON.stringify(filters)} initial={await getBundle(filters)} view="prehled"/>;}catch(e){return <main className="startup"><h1>Finanční radar Litvínova</h1><p>{e instanceof Error?e.message:'Databáze není dostupná.'}</p><p>Postup spuštění najdete v README projektu.</p></main>;}}

