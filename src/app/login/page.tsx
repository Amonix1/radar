import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {LockKeyhole,Radar,ShieldCheck} from 'lucide-react';
import {accessConfigured,safeReturnPath,SESSION_COOKIE,validSession} from '@/lib/access';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams,next=safeReturnPath(query.next);
 if(validSession((await cookies()).get(SESSION_COOKIE)?.value))redirect(next);
 const configured=accessConfigured();
 const errors:Record<string,string>={password:'Heslo není správné. Zkuste to znovu.',limit:'Příliš mnoho pokusů. Zkuste přihlášení za 10 minut.',unavailable:'Přihlášení není momentálně dostupné. Zkuste to za chvíli.'};
 const message=typeof query.error==='string'?errors[query.error]:undefined;
 return <main className="access-screen"><section className="access-card"><div className="access-brand"><span className="brand-mark"><Radar size={28}/></span><span>Finanční radar<small>LITVÍNOVA</small></span></div><div className="access-lock"><LockKeyhole size={25}/></div><h1>Váš přehled hospodaření</h1><p>Pro vstup do aplikace zadejte přístupové heslo.</p><form action="/api/access/login" method="post"><input type="hidden" name="next" value={next}/><label htmlFor="password">Přístupové heslo</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} autoFocus disabled={!configured}/>{message&&<div className="access-error" role="alert">{message}</div>}{!configured&&<div className="access-error" role="alert">Správce musí dokončit nastavení přístupu.</div>}<button className="button" type="submit" disabled={!configured}>Otevřít finanční radar <span aria-hidden>→</span></button></form><div className="access-foot"><ShieldCheck size={16}/><span>Chráněný přístup · Oficiální data města Litvínov</span></div></section><p className="access-caption">Rozpočet v souvislostech.</p></main>;
}
