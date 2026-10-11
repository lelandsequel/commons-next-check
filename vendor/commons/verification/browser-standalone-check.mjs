// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Optional browser QA: node this-script.mjs /path/to/package
// Select external tooling with COMMONS_PLAYWRIGHT_MODULE,
// COMMONS_CHROMIUM_MODULE and COMMONS_BROWSER_EXECUTABLE.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root=resolve(process.argv[2] || '.');
const output=join(root,'verification','browser-standalone');
mkdirSync(output,{recursive:true});
const isolated=mkdtempSync(join(tmpdir(),'commons-single-browser-'));
const filename='cosmic-commons.mjs', bundle=join(isolated,filename);
copyFileSync(join(root,filename),bundle);
const bundleSha256=createHash('sha256').update(readFileSync(bundle)).digest('hex');
const initialFiles=readdirSync(isolated).sort();
assert.deepEqual(initialFiles,[filename]);
function command(args){const result=spawnSync(process.execPath,[bundle,...args],{cwd:isolated,encoding:'utf8',timeout:30000});assert.ifError(result.error);assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
const doctor=command(['doctor']);
assert.equal(doctor.runtime.codeDigest,bundleSha256);
const expected=['discovery-deferred','release-authorization','release-deferred','release-denied','sensor-investigation'];
const examples=command(['examples']);
assert.deepEqual(examples.map(e=>e.id).sort(),expected);
const portProbe=createServer();
await new Promise((resolve,reject)=>{portProbe.once('error',reject);portProbe.listen(0,'127.0.0.1',resolve);});
const port=portProbe.address().port;
await new Promise(resolve=>portProbe.close(resolve));
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[bundle,'serve','--port',String(port)],{cwd:isolated,stdio:['ignore','pipe','pipe']});
let serverText='',serverError='';
server.stderr.on('data',data=>{serverError+=data;});
const {chromium:playwright}=await import(process.env.COMMONS_PLAYWRIGHT_MODULE||'playwright');
const options={headless:true};
if(process.env.COMMONS_CHROMIUM_MODULE)options.args=(await import(process.env.COMMONS_CHROMIUM_MODULE)).default.args;
if(process.env.COMMONS_BROWSER_EXECUTABLE)options.executablePath=process.env.COMMONS_BROWSER_EXECUTABLE;
const results=[],pageErrors=[],consoleErrors=[],externalRequests=[];
let browser;
try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timed out: '+serverError)),10000);
    server.once('error',error=>{clearTimeout(timer);reject(error);});
    server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${serverError}`));});
    server.stdout.on('data',data=>{serverText+=data;if(serverText.includes(base)){clearTimeout(timer);resolve();}});
  });
  browser=await playwright.launch(options);
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('request',request=>{if(!request.url().startsWith(base+'/')&&!request.url().startsWith('blob:'))externalRequests.push(request.url());});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelectorAll('[data-example]').length>0);
  assert.deepEqual((await page.locator('[data-example]').evaluateAll(elements=>elements.map(e=>e.dataset.example))).sort(),expected);
  const receipts=new Map();
  for(const id of expected){
    await page.locator(`[data-example="${id}"]`).click();
    const requestText=await page.locator('#input-editor').inputValue();
    const pending=page.waitForResponse(response=>response.url()===base+'/api/run');
    await page.locator('#run-button').click();
    const response=await pending;
    assert.equal(response.status(),200);
    assert.equal(response.request().postData(),requestText);
    const receipt=await response.json();
    assert.deepEqual(receipt.runtime,doctor.runtime);
    await page.waitForFunction(digest=>document.querySelector('#receipt-digest').textContent===digest,receipt.digest);
    const visibleStatus=await page.locator('#result-kind').innerText();
    if(id==='discovery-deferred'){
      assert.equal(receipt.result.decisionStatus,'DEFER');
      assert.equal(receipt.result.action,null);
      assert.equal(visibleStatus,'DISCOVERY · DEFER');
      assert.match(await page.locator('#decision-notice').innerText(),/DEFER — no action recommendation/);
      assert.doesNotMatch(await page.locator('#result-details').innerText(),/Expected-loss decision/);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:join(output,'discovery-deferred-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:join(output,'discovery-deferred-mobile.png'),fullPage:true});
      await page.setViewportSize({width:1440,height:1100});
    }else if(id.startsWith('release-')){
      const verdict={'release-authorization':'ALLOW','release-deferred':'DEFER','release-denied':'DENY'}[id];
      assert.equal(receipt.result.verdict,verdict);assert.equal(visibleStatus,`POLICY · ${verdict}`);
    }else assert.equal(receipt.result.decisionStatus,'AVAILABLE');
    receipts.set(id,receipt);
    writeFileSync(join(output,`${id}.receipt.json`),JSON.stringify(receipt,null,2)+'\n');
    results.push({case:'example-'+id,digest:receipt.digest,visibleStatus});
  }
  const downloaded=page.waitForEvent('download');
  await page.locator('#download-receipt').click();
  const download=await downloaded;
  const receipt=receipts.get('sensor-investigation');
  const bytes=readFileSync(await download.path());
  assert.deepEqual(JSON.parse(bytes.toString('utf8')),receipt);
  await page.locator('#verify-tab').click();
  const uploadName='downloaded.receipt.json';
  await page.locator('#receipt-file').setInputFiles({name:uploadName,mimeType:'application/json',buffer:bytes});
  await page.waitForFunction(name=>document.querySelector('#receipt-filename').textContent===name,uploadName);
  await page.locator('#trusted-digest').fill(receipt.digest);
  let pending=page.waitForResponse(response=>response.url()===base+'/api/verify');
  await page.locator('#verify-button').click();
  let response=await pending;
  assert.ok(response.request().postDataBuffer().equals(bytes));
  let checked=await response.json();
  assert.equal(checked.valid,true);assert.equal(checked.integrity,'VALID');assert.equal(checked.replay,'MATCH');assert.equal(checked.anchoring,'MATCH');
  await page.waitForFunction(()=>document.querySelector('#verification-status').textContent==='CHECKS PASSED');
  results.push({case:'download-upload-anchored-roundtrip',digest:receipt.digest,requestBodyEqualsDownload:true,response:checked});
  const deferred=receipts.get('release-deferred');
  const raw=JSON.stringify(deferred,null,2)+'\n';
  const duplicate=raw.replace('"verdict": "DEFER"','"verdict": "ALLOW",\n    "verdict": "DEFER"');
  assert.notEqual(duplicate,raw);
  await page.locator('#receipt-file').setInputFiles({name:'duplicate.receipt.json',mimeType:'application/json',buffer:Buffer.from(duplicate)});
  await page.waitForFunction(()=>document.querySelector('#receipt-filename').textContent==='duplicate.receipt.json');
  await page.locator('#trusted-digest').fill(deferred.digest);
  pending=page.waitForResponse(response=>response.url()===base+'/api/verify');
  await page.locator('#verify-button').click();
  response=await pending;
  assert.equal(response.request().postData(),duplicate);
  checked=await response.json();
  assert.equal(checked.valid,false);assert.equal(checked.integrity,'NOT_CHECKED');assert.equal(checked.replay,'NOT_RUN');assert.equal(checked.anchoring,'MISMATCH');assert.match(checked.reason,/^DUPLICATE_JSON_KEY:/);
  await page.waitForFunction(()=>document.querySelector('#verification-status').textContent==='CHECKS FAILED');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:join(output,'duplicate-refused.png'),fullPage:true});
  results.push({case:'duplicate-upload-refused',requestBodyEqualsUpload:true,response:checked});
  assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
  const finalFiles=readdirSync(isolated).sort();
  assert.deepEqual(finalFiles,[filename]);
  assert.equal(createHash('sha256').update(readFileSync(bundle)).digest('hex'),bundleSha256);
  const report={execution:'isolated-standalone-browser',bundleSha256,runtime:doctor.runtime,browserVersion:browser.version(),initialFiles,finalFiles,allRuntimeResourcesEmbedded:true,exampleIds:expected,results,pageErrors,consoleErrors,externalRequests};
  writeFileSync(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser?.close();
  if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
  rmSync(isolated,{recursive:true,force:true});
}
