import {accessDenied,requestAuthenticated} from '@/lib/access';
import {answerQuestion} from '@/lib/analyst';
export async function POST(request:Request){
 if(!requestAuthenticated(request))return accessDenied();
try{const body=await request.json();if(typeof body.question!=='string'||body.question.length>1000||!body.question.trim())return Response.json({error:'Zadejte otázku do 1 000 znaků.'},{status:400});return Response.json(await answerQuestion(body.question,body.period));}catch(e){console.error('analyst_failed',e);return Response.json({error:'Analýza se nezdařila. Zkuste dotaz znovu.'},{status:500});}}
