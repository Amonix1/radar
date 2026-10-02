import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

export const SESSION_COOKIE='radar_access';
export const SESSION_SECONDS=12*60*60;
export function accessConfigured(){return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.APP_PASSWORD_HASH||'')&&(process.env.APP_SESSION_SECRET?.length||0)>=43;}
export function verifyPassword(password:string){
 if(!accessConfigured()||password.length>256)return false;
 const [,salt,hash]=process.env.APP_PASSWORD_HASH!.split(':');
 return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
}
function signature(payload:string){return createHmac('sha256',process.env.APP_SESSION_SECRET!).update(process.env.APP_PASSWORD_HASH!+'|'+payload).digest('base64url');}
export function createSession(now=Date.now()){
 if(!accessConfigured())throw new Error('Access configuration missing');
 const payload=`${Math.floor(now/1000)+SESSION_SECONDS}.${randomBytes(24).toString('base64url')}`;
 return payload+'.'+signature(payload);
}
export function validSession(value:string|undefined,now=Date.now()){
 if(!accessConfigured()||!value||value.length>200)return false;
 const parts=value.split('.');if(parts.length!==3||!/^\d{10}$/.test(parts[0])||!/^[\w-]{32}$/.test(parts[1])||!/^[\w-]{43}$/.test(parts[2]))return false;
 const expires=Number(parts[0]),current=Math.floor(now/1000);
 if(expires<=current||expires>current+SESSION_SECONDS)return false;
 const expected=Buffer.from(signature(parts.slice(0,2).join('.'))),provided=Buffer.from(parts[2]);
 return expected.length===provided.length&&timingSafeEqual(expected,provided);
}
export function requestAuthenticated(request:Request){
 const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 return validSession(value);
}
export function accessDenied(){return Response.json({error:'Pro přístup se přihlaste heslem.'},{status:401,headers:{'Cache-Control':'private, no-store'}});}
export function sameOrigin(request:Request){
 const expected=process.env.APP_ORIGIN||new URL(request.url).origin;
 try{return !!request.headers.get('origin')&&new URL(request.headers.get('origin')!).origin===new URL(expected).origin;}catch{return false;}
}
export function secureCookie(){return process.env.APP_ORIGIN?new URL(process.env.APP_ORIGIN).protocol==='https:':process.env.NODE_ENV==='production';}
export function safeReturnPath(value:unknown){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\r\n]/.test(value)&&!value.startsWith('/login')&&!value.startsWith('/api/')?value:'/';}
