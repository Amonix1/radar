import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {SESSION_COOKIE,validSession} from './access';
export async function requirePageAccess(){if(!validSession((await cookies()).get(SESSION_COOKIE)?.value))redirect('/login');}
