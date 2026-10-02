import {createHmac} from 'node:crypto';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {accessConfigured,createSession,sameOrigin,safeReturnPath,secureCookie,SESSION_COOKIE,SESSION_SECONDS,verifyPassword} from '@/lib/access';
export const dynamic='force-dynamic';
function back(error:string,next='/'){return new NextResponse(null,{status:303,headers:{Location:'/login?'+new URLSearchParams({error,next}),'Cache-Control':'private, no-store'}});}
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Neplatný původ požadavku.',{status:403});
 if(!accessConfigured())return new Response('Přístup zatím není nakonfigurován.',{status:503});
 if(Number(request.headers.get('content-length')||0)>4096)return new Response('Požadavek je příliš velký.',{status:413});
 const input=await request.text();if(input.length>4096)return new Response('Požadavek je příliš velký.',{status:413});
 const form=new URLSearchParams(input),next=safeReturnPath(form.get('next'));
 // The global limit remains effective even when an attacker spoofs forwarded IPs.
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
 const bucket=createHmac('sha256',process.env.APP_SESSION_SECRET!).update(ip).digest('hex');
 try{
  await db().query("DELETE FROM access_attempt WHERE started_at < now()-interval '2 hours'");
  const result=await db().query(`INSERT INTO access_attempt(bucket,attempts) VALUES('global',1),($1,1)
   ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN access_attempt.started_at < now()-interval '10 minutes' THEN 1 ELSE access_attempt.attempts+1 END,
   started_at=CASE WHEN access_attempt.started_at < now()-interval '10 minutes' THEN now() ELSE access_attempt.started_at END RETURNING bucket,attempts`,[bucket]);
  if(result.rows.some(r=>r.attempts>(r.bucket==='global'?60:10)))return back('limit',next);
  if(!verifyPassword(form.get('password')||''))return back('password',next);
  const response=new NextResponse(null,{status:303,headers:{Location:next,'Cache-Control':'private, no-store'}});
  response.cookies.set(SESSION_COOKIE,createSession(),{httpOnly:true,secure:secureCookie(),sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});
  return response;
 }catch(e){console.error('access_login_failed');return back('unavailable',next);}
}
