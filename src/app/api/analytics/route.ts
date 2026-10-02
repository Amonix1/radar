import {accessDenied,requestAuthenticated} from '@/lib/access';
import {getBundle} from '@/lib/repository';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 if(!requestAuthenticated(request))return accessDenied();

 const p=new URL(request.url).searchParams;
 try{return Response.json(await getBundle({period:p.get('period')||undefined,paragraph:p.get('paragraph')||undefined,item:p.get('item')||undefined,scope:p.get('scope')||undefined,flow:p.get('flow')||undefined}),{headers:{'Cache-Control':'no-store'}});}
 catch(e){console.error('analytics_failed',e);return Response.json({error:e instanceof Error?e.message:'Data nejsou dostupná'},{status:400});}
}
