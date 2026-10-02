import {accessDenied,requestAuthenticated} from '@/lib/access';
import {timingSafeEqual} from 'node:crypto';
import {synchronize} from '@/lib/sync';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!requestAuthenticated(request))return accessDenied();

 const expected=process.env.SYNC_TOKEN,provided=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!expected||!provided||Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return Response.json({error:'Neoprávněný přístup'},{status:401});
 try{return Response.json(await synchronize({refresh:true,latestOnly:true}));}catch(e){console.error('sync_failed',e);return Response.json({error:'Synchronizace selhala; podrobnosti jsou v serverovém logu.'},{status:500});}
}
