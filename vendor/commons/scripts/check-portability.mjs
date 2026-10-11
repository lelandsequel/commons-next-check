#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Pass real Node executables. No version shims, network downloads, or installations.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const shippedExampleIds=readdirSync(join(root,'examples')).filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5)).sort();
assert.ok(shippedExampleIds.length>0,'The package must contain at least one example.');
const executables=process.argv.slice(2);
if(!executables.length)executables.push(process.execPath);
const temporary=mkdtempSync(join(tmpdir(),'cosmic-portable-'));
const copy=join(temporary,'package');
const evidence=join(root,'verification');
mkdirSync(copy);mkdirSync(evidence,{recursive:true});
try {
  // A fresh recipient needs only the shipped package, with no dependency directory.
  for(const name of ['src','dist','bin','examples','web','package.json'])cpSync(join(root,name),join(copy,name),{recursive:true});
  if(existsSync(join(root,'tests','fixtures')))cpSync(join(root,'tests','fixtures'),join(copy,'tests','fixtures'),{recursive:true});
  assert.equal(existsSync(join(copy,'node_modules')),false);
  function run(executable,args){const result=spawnSync(executable,args,{cwd:copy,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});assert.ifError(result.error);return result;}
  const rows=[];
  for(const executable of executables){
    const info=run(executable,['bin/cosmic.mjs','doctor']);
    assert.equal(info.status,0,info.stderr);
    const doctor=JSON.parse(info.stdout);
    const test=run(executable,['bin/cosmic.mjs','prove']);
    const transcript=`Node ${doctor.runtime.node} / ${doctor.runtime.platform}-${doctor.runtime.architecture}\nClean package copy; node_modules absent.\n${test.stdout}${test.stderr}`;
    const transcriptName=`portable-node-${doctor.runtime.node}-${doctor.runtime.platform}-${doctor.runtime.architecture}.txt`;
    writeFileSync(join(evidence,transcriptName),transcript);
    assert.equal(test.status,0,transcript);
    const tests=Number(test.stdout.match(/^# tests (\d+)$/m)?.[1]);
    const passed=Number(test.stdout.match(/^# pass (\d+)$/m)?.[1]);
    const failed=Number(test.stdout.match(/^# fail (\d+)$/m)?.[1]);
    const skipped=Number(test.stdout.match(/^# skipped (\d+)$/m)?.[1]);
    assert.ok(tests>0);assert.equal(passed,tests);assert.equal(failed,0);assert.equal(skipped,0);
    const listing=run(executable,['bin/cosmic.mjs','examples']);
    assert.equal(listing.status,0,listing.stderr);
    const examples=JSON.parse(listing.stdout);
    assert.deepEqual(examples.map(example=>example.id).sort(),shippedExampleIds,'The CLI example list must match the JSON examples actually shipped.');
    const replay=[];
    for(const example of examples){
      const receiptPath=join(temporary,`${doctor.runtime.node}-${example.id}.json`);
      const demo=run(executable,['bin/cosmic.mjs','demo',example.id,'--out',receiptPath]);
      assert.equal(demo.status,0,demo.stderr);
      const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
      const checked=run(executable,['bin/cosmic.mjs','verify',receiptPath,'--expect',receipt.digest]);
      const result=JSON.parse(checked.stdout);
      assert.equal(checked.status,0,checked.stderr);assert.equal(result.valid,true);assert.equal(result.anchoring,'MATCH');
      replay.push({example:example.id,digest:receipt.digest,result});
    }
    rows.push({executable,runtime:doctor.runtime,tests,passed,failed,skipped,transcript:transcriptName,replay});
  }
  const crossRuntime=[];
  for(const source of rows)for(const target of rows){
    if(source.runtime.node===target.runtime.node)continue;
    const example=source.replay[0];
    const path=join(temporary,`${source.runtime.node}-${example.example}.json`);
    const check=run(target.executable,['bin/cosmic.mjs','verify',path,'--expect',example.digest]);
    const result=JSON.parse(check.stdout);
    assert.equal(check.status,1);assert.equal(result.valid,false);assert.equal(result.integrity,'VALID');assert.equal(result.replay,'UNSUPPORTED');assert.equal(result.anchoring,'MATCH');
    crossRuntime.push({from:source.runtime.node,to:target.runtime.node,result});
  }
  const results={package:`${manifest.name}/${manifest.version}`,private:manifest.private===true,shippedExampleIds,cleanCopyWithoutNodeModules:true,executionTarget:manifest.engines.node,runtimes:rows.map(({executable,...row})=>row),crossRuntime};
  writeFileSync(join(evidence,'portable-runtime-results.json'),JSON.stringify(results,null,2)+'\n');
  process.stdout.write(JSON.stringify({runtimes:rows.map(row=>({node:row.runtime.node,tests:row.tests,passed:row.passed,examples:row.replay.length})),crossRuntimeRefusals:crossRuntime.length},null,2)+'\n');
} finally {rmSync(temporary,{recursive:true,force:true});}
