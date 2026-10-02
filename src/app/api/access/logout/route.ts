import {NextResponse} from 'next/server';
import {accessDenied,requestAuthenticated,sameOrigin,secureCookie,SESSION_COOKIE} from '@/lib/access';
export async function POST(request:Request){
 if(!requestAuthenticated(request))return accessDenied();
 if(!sameOrigin(request))return new Response('Neplatný původ požadavku.',{status:403});
 const response=new NextResponse(null,{status:303,headers:{Location:'/login','Cache-Control':'private, no-store'}});
 response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:secureCookie(),sameSite:'strict',path:'/',maxAge:0});return response;
}
