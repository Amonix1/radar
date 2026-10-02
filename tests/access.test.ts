import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,scryptSync} from 'node:crypto';
import {accessConfigured,createSession,validSession,verifyPassword,requestAuthenticated,safeReturnPath,sameOrigin,SESSION_SECONDS} from '../src/lib/access';
test('access sessions reject tampering, expiry, changed password and missing secrets',()=>{
 const salt=randomBytes(16).toString('hex'),password=randomBytes(16).toString('hex');
 process.env.APP_PASSWORD_HASH=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
 process.env.APP_SESSION_SECRET=randomBytes(32).toString('base64url');
 assert.equal(accessConfigured(),true);assert.equal(verifyPassword(password),true);assert.equal(verifyPassword(password+'x'),false);
 const now=Date.now(),session=createSession(now);
 assert.equal(validSession(session,now),true);
 assert.equal(validSession(session.slice(0,-1)+(session.endsWith('A')?'B':'A'),now),false);
 assert.equal(validSession(session,now+SESSION_SECONDS*1000),false);
 assert.equal(validSession(session,now-2000),false);
 assert.equal(requestAuthenticated(new Request('https://radar.example',{headers:{cookie:'other=x; radar_access='+session}})),true);
 assert.equal(requestAuthenticated(new Request('https://radar.example',{headers:{cookie:'radar_access=forged'}})),false);
 process.env.APP_PASSWORD_HASH=process.env.APP_PASSWORD_HASH.replace(salt,randomBytes(16).toString('hex'));
 assert.equal(validSession(session),false);delete process.env.APP_SESSION_SECRET;assert.equal(accessConfigured(),false);assert.equal(validSession(session),false);
});
test('login allows local return paths and rejects foreign origins',()=>{
 assert.equal(safeReturnPath('/trendy?period=2025-12-31'),'/trendy?period=2025-12-31');
 for(const value of ['//evil.example','/\\evil.example','https://evil.example','/api/export','/login','/\nLocation:evil'])assert.equal(safeReturnPath(value),'/');
 process.env.APP_ORIGIN='https://radar.example';
 assert.equal(sameOrigin(new Request('http://internal/api/access/login',{headers:{origin:'https://radar.example'}})),true);
 assert.equal(sameOrigin(new Request('https://radar.example/api/access/login',{headers:{origin:'https://evil.example'}})),false);
 assert.equal(sameOrigin(new Request('https://radar.example/api/access/login')),false);
});
