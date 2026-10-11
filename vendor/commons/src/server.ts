// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { packagePath } from './package-root.ts';
import { runRequest, verifyRun } from './run.ts';
import { parseStrictJson, StrictJsonError } from './strict-json.ts';
import { listExamples } from './examples.ts';
export function createWorkbenchServer(){
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host??'')) {send(403,{error:'Local host required'});return;}
    const origin=req.headers.origin;
    if(origin && origin!==`http://${req.headers.host}`){send(403,{error:'Same-origin requests only'});return;}
    try {
      const pathname=new URL(req.url??'/',`http://${req.headers.host}`).pathname;
      if(req.method==='GET' && pathname==='/api/examples'){send(200,{examples:listExamples()});return;}
      if(req.method==='GET' && pathname==='/api/health'){send(200,{status:'ready',version:'0.2.1',node:process.versions.node});return;}
      if(req.method==='POST' && ['/api/run','/api/verify','/api/format'].includes(pathname)){
        if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'Content-Type application/json required'});return;}
        const chunks:Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>2_000_000){send(413,{error:'Maximum request size is 2 MB'});return;}chunks.push(chunk);}
        const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks));
        if(pathname==='/api/run')send(200,runRequest(parseStrictJson(raw)));
        else if(pathname==='/api/format')send(200,{formatted:JSON.stringify(parseStrictJson(raw),null,2)});
        else {
          // Scan the entire raw body, including legacy envelopes, before unwrapping.
          try {
            const value=parseStrictJson(raw);
            const header=req.headers['x-cosmic-expected-digest'];
            if(header!==undefined && typeof header!=='string')throw new Error('Trusted digest header must be a single value');
            if(value && typeof value==='object' && !Array.isArray(value) && Object.hasOwn(value,'receipt')) {
              const envelope=value as Record<string,unknown>;
              if(Object.keys(envelope).some(key=>!['receipt','expectedDigest'].includes(key)))throw new Error('Unknown verification envelope field');
              if(envelope.expectedDigest!==undefined && typeof envelope.expectedDigest!=='string')throw new Error('Trusted digest must be a string');
              if(header!==undefined && envelope.expectedDigest!==undefined && header!==envelope.expectedDigest)throw new Error('Conflicting trusted digests');
              send(200,verifyRun(envelope.receipt,header ?? envelope.expectedDigest as string | undefined));
            } else send(200,verifyRun(value,header));
          } catch(error) {
            // A malformed legacy envelope may itself contain an unreadable
            // expectedDigest. Do not claim that no anchor was supplied.
            send(200,{valid:false,integrity:'NOT_CHECKED',replay:'NOT_RUN',anchoring:req.headers['x-cosmic-expected-digest']===undefined?'NOT_CHECKED':'MISMATCH',reason:error instanceof Error?error.message:String(error)});
          }
        }
        return;
      }
      const files:Record<string,[string,string]>={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/styles.css':['styles.css','text/css']};
      const entry=files[pathname];
      if(req.method==='GET' && entry){res.writeHead(200,{'Content-Type':entry[1]+'; charset=utf-8'});res.end(readFileSync(packagePath('web',entry[0])));return;}
      send(404,{error:'Not found'});
    }catch(error){send(400,{error:error instanceof Error?error.message:String(error),...(error instanceof StrictJsonError?{code:error.code}:{})});}
  });
}
export async function serve(port=4317):Promise<void>{
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port must be an integer between 1 and 65535');
  const server=createWorkbenchServer();
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});
  process.stdout.write(`COSMIC Commons is ready: http://127.0.0.1:${port}\nLocal computation only. Press Ctrl+C to stop.\n`);
}
