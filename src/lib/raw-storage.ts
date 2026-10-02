import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {S3Client,HeadObjectCommand,PutObjectCommand,HeadBucketCommand} from '@aws-sdk/client-s3';
import {db} from './db';
function storageClient(){return new S3Client({forcePathStyle:true,endpoint:process.env.AWS_ENDPOINT_URL_S3,
 requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});}
export async function ensureArchiveStorage(){
 const client=storageClient();
 try{await client.send(new HeadBucketCommand({Bucket:process.env.RAW_STORAGE_BUCKET}));}
 finally{client.destroy();}
}

// Content-addressed keys and a database lock prevent archive replacement.
export async function archiveRawFile(file:string,sha256:string) {
 const bucket=process.env.RAW_STORAGE_BUCKET;
 if(!bucket)return null;
 if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Invalid archive SHA256');
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 if(hash.digest('hex')!==sha256)throw new Error('Archive checksum mismatch');
 const bytes=(await stat(file)).size,key=`archives/${sha256}.zip`;
 const s3=storageClient();
 const client=await db().connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  let exists=false;
  try {
   const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
   if(head.ContentLength!==bytes||head.Metadata?.sha256!==sha256)throw new Error('Stored archive integrity mismatch');
   exists=true;
  }catch(e){if((e as {$metadata?:{httpStatusCode:number}}).$metadata?.httpStatusCode!==404)throw e;}
  if(!exists){
   await client.query('SELECT pg_advisory_xact_lock(266027,4)');
   const used=Number((await client.query('SELECT coalesce(sum(byte_length),0) AS bytes FROM raw_archive')).rows[0].bytes);
   if(used+bytes>4_000_000_000)throw new Error('Archive budget reached; refusing to exceed free storage allowance');
   await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:createReadStream(file),
    ContentLength:bytes,ContentType:'application/zip',Metadata:{sha256}}));
   const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
   if(head.ContentLength!==bytes||head.Metadata?.sha256!==sha256)throw new Error('Archive upload verification failed');
  }
  const uri=`s3://${bucket}/${key}`;
  await client.query('INSERT INTO raw_archive(sha256,byte_length,storage_uri) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[sha256,bytes,uri]);
  const recorded=(await client.query('SELECT byte_length,storage_uri FROM raw_archive WHERE sha256=$1',[sha256])).rows[0];
  if(Number(recorded.byte_length)!==bytes||recorded.storage_uri!==uri)throw new Error('Archive catalog mismatch');
  await client.query('COMMIT');
  return {sha256,bytes,key,uri,uploaded:!exists};
 }catch(e){await client.query('ROLLBACK');throw e;}
 finally{client.release();s3.destroy();}
}
