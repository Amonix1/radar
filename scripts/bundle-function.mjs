import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

await fs.mkdir('dist',{recursive:true});
const wasm=await fs.readFile(createRequire(import.meta.url).resolve('node-unrar-js/dist/js/unrar.wasm'));
await build({entryPoints:['functions/sync.ts'],bundle:true,platform:'node',target:'node24',format:'esm',
 outfile:'dist/index.mjs',minify:true,external:['pg-native'],banner:{js:
 "import{createRequire as __cr}from'node:module';import{fileURLToPath as __f}from'node:url';import{dirname as __d}from'node:path';const require=__cr(import.meta.url);const __filename=__f(import.meta.url);const __dirname=__d(__filename);const __RADAR_UNRAR_WASM__=Buffer.from('"+wasm.toString('base64')+"','base64');"}});
// A single-file ZIP, with no machine-specific paths or environment secrets.
const body=await fs.readFile('dist/index.mjs'),compressed=deflateRawSync(body),name=Buffer.from('index.mjs');
let crc=0xffffffff;
for(const byte of body){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
crc=(crc^0xffffffff)>>>0;
const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);
local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
central.writeUInt16LE(8,10);central.writeUInt16LE(33,14);central.writeUInt32LE(crc,16);
central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(name.length,28);
const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+compressed.length,16);
const zip=Buffer.concat([local,name,compressed,central,name,end]);
await fs.writeFile('dist/radarsync.zip',zip);
console.log(JSON.stringify({file:'dist/radarsync.zip',bytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex')}));
