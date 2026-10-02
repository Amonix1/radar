import fs from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
if(!process.stdin.isTTY)throw new Error('Run in an interactive terminal');
process.stdout.write('Nové přístupové heslo (skryté): ');
process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();
const password=await new Promise((resolve,reject)=>{let value='';process.stdin.on('data',chunk=>{for(const c of chunk){if(c==='\u0003'){reject(new Error('Cancelled'));return;}if(c==='\r'||c==='\n'){resolve(value);return;}if(c==='\u007f'||c==='\b'){value=value.slice(0,-1);continue;}if(c>=' ')value+=c;}});}).finally(()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');});
if(password.length<10||password.length>256)throw new Error('Use 10–256 characters');
const salt=randomBytes(16).toString('hex');
const values={APP_PASSWORD_HASH:`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`,APP_SESSION_SECRET:randomBytes(32).toString('base64url')};
let env=await fs.readFile('.env','utf8').catch(()=> '');
for(const [key,value] of Object.entries(values)){env=env.replace(new RegExp('^'+key+'=.*\\r?\\n?','gm'),'');env+='\n'+key+'='+value+'\n';}
await fs.writeFile('.env',env,{mode:0o600});
console.log('Hash hesla a nový klíč uloženy do ignorovaného .env. Restartujte web; předchozí relace tím zaniknou.');
