import 'dotenv/config';
import assert from 'node:assert/strict';
const base=process.env.APP_URL||'http://127.0.0.1:3100';
const origin=process.env.APP_AUTH_ORIGIN||base;
const anonymous=fetch;
for(const path of ['/','/cerpani','/trendy','/prijmy','/vydaje','/investice','/zdravi','/porovnani','/analytik','/metodika','/api/analytics','/api/export']){
 const r=await anonymous(base+path,{redirect:'manual'});assert.equal(r.status,path.startsWith('/api/')?401:307,path);
 if(!path.startsWith('/api/'))assert.ok(r.headers.get('location')?.startsWith(origin+'/login?next='));
 assert.ok(!(await r.text()).includes('638098639.41'));
}
for(const path of ['/api/analyst','/api/sync'])assert.equal((await anonymous(base+path,{method:'POST'})).status,401);
assert.equal((await anonymous(base+'/api/analytics',{headers:{cookie:'radar_access=forged','x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy'}})).status,401);
assert.equal((await anonymous(base+'/api/health')).status,200);
assert.equal((await anonymous(base+'/api/access/login',{method:'POST',headers:{origin:'https://foreign.example'},body:'password=invalid',redirect:'manual'})).status,403);
const wrong=await anonymous(base+'/api/access/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'password=invalid',redirect:'manual'});
assert.equal(wrong.status,303);assert.ok(wrong.headers.get('location')?.includes('error=password'));assert.equal(wrong.headers.get('set-cookie'),null);
if(!process.env.SMOKE_PASSWORD)throw new Error('Set SMOKE_PASSWORD for the real login test');
const login=await anonymous(base+'/api/access/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:process.env.SMOKE_PASSWORD}),redirect:'manual'});
assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/');
const session=login.headers.get('set-cookie')!;assert.ok(session?.includes('HttpOnly'));assert.ok(session?.includes('SameSite=strict'));if(origin.startsWith('https:'))assert.ok(session.includes('Secure'));
const cookie=session.split(';')[0];
const authenticatedFetch=(url:string,options:RequestInit={})=>anonymous(url,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),cookie}});
const routes=['/','/cerpani','/trendy','/prijmy','/vydaje','/investice','/zdravi','/porovnani','/analytik','/metodika'];
for(const route of routes){const r=await authenticatedFetch(base+route);assert.equal(r.status,200,route);const html=await r.text();assert.ok(html.includes('Finanční radar Litvínova'),route);assert.ok(!html.includes('Data nejsou dostupná')&&!html.includes('Data nejsou načtena'),route);console.log('OK page',route);}
const data=await (await authenticatedFetch(base+'/api/analytics')).json();assert.equal(data.period,'2026-08-31');assert.equal(data.coverage.periods,97);assert.equal(data.metrics.income.actual,638098639.41);assert.equal(data.metrics.expense.actual,862113904.62);assert.ok(data.alerts.some((a:{title:string})=>a.title.startsWith('Růst nad inflací')));
const filtered=await (await authenticatedFetch(base+'/api/analytics?period=2025-08-31&paragraph=2212&scope=capital')).json();assert.ok(filtered.rows.every((r:{paragraph:string;classCode:string})=>r.paragraph==='2212'&&r.classCode==='6'));assert.ok(filtered.metrics.investments.actual>0);
assert.equal((await authenticatedFetch(base+'/api/analytics?scope=invalid')).status,400);
assert.equal((await authenticatedFetch(base+'/api/sync',{method:'POST'})).status,401);
assert.equal((await authenticatedFetch(base+'/api/sync',{method:'POST',headers:{Authorization:'Bearer invalid'}})).status,401);
const csv=await authenticatedFetch(base+'/api/export?period=2026-08-31&paragraph=2212');assert.equal(csv.status,200);assert.ok(csv.headers.get('content-type')?.includes('text/csv'));assert.ok((await csv.text()).includes('2212'));
for(const [question,tool] of [['Jak se změnily výdaje na dopravu za deset let?','sector_history'],['Které výdaje rostou nejrychleji?','fastest_growing_expenses'],['Které části rozpočtu letos čerpají neobvykle rychle?','seasonal_outliers'],['Jak město hospodaří?','budget_summary']]){const r=await authenticatedFetch(base+'/api/analyst',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,period:'2026-08-31'})});assert.equal(r.status,200);const a=await r.json();assert.equal(a.tool,tool);assert.ok(a.sources.length>0);assert.ok(a.calculation.length>0);console.log('OK tool',tool);}
const logout=await authenticatedFetch(base+'/api/access/logout',{method:'POST',headers:{origin},redirect:'manual'});assert.equal(logout.status,303);assert.ok(logout.headers.get('set-cookie')?.includes('Max-Age=0'));
const attemptBucket='smoke-'+crypto.randomUUID();
for(let attempt=1;attempt<=11;attempt++){
 const r=await anonymous(base+'/api/access/login',{method:'POST',headers:{origin,'x-forwarded-for':attemptBucket},body:'password=invalid',redirect:'manual'});
 assert.equal(r.status,303);assert.ok(r.headers.get('location')?.includes(attempt<=10?'error=password':'error=limit'));assert.equal(r.headers.get('set-cookie'),null);
}
console.log('PASS: real password login/logout, anonymous and forged-session rejection, CSRF, 10 pages, source KPI, filters, CSV and all 4 analyst tools.');
