import {accessDenied,requestAuthenticated} from '@/lib/access';
import {getBundle} from '@/lib/repository';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!requestAuthenticated(request))return accessDenied();

 try {
 const p=new URL(request.url).searchParams;const b=await getBundle({period:p.get('period')||undefined,paragraph:p.get('paragraph')||undefined,item:p.get('item')||undefined,scope:p.get('scope')||undefined,flow:p.get('flow')||undefined});
 const cell=(v:unknown)=>`"${String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')}"`;
 const lines=[['IČO','Období','Paragraf','Název paragrafu','Položka','Název položky','Schválený rozpočet Kč','Upravený rozpočet Kč','Skutečnost Kč','Zdroj','Snapshot'],...b.rows.map(r=>["00266027",b.period,r.paragraph,r.paragraphName,r.item,r.itemName,r.approved.toFixed(2),r.amended.toFixed(2),r.actual.toFixed(2),b.source.url,b.source.snapshot])];
 return new Response('\uFEFF'+lines.map(r=>r.map(cell).join(';')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="litvinov-${b.period}.csv"`}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Export selhal'},{status:400});}
}
