import {NextRequest,NextResponse} from 'next/server';
import {accessDenied,requestAuthenticated} from './lib/access';
export function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 const publicRoute=path==='/login'||path==='/api/access/login'||path==='/api/health';
 if(!publicRoute&&!requestAuthenticated(request)){
  if(path.startsWith('/api/'))return accessDenied();
  const url=new URL('/login',process.env.APP_ORIGIN||request.url);url.searchParams.set('next',path+request.nextUrl.search);
  const response=NextResponse.redirect(url);response.headers.set('Cache-Control','private, no-store');return response;
 }
 const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
