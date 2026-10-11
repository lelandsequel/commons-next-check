#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Run from scripts/ in a shipped edition. Supply genuine Node executables.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const moduleResults=JSON.parse(readFileSync(join(root,'verification','portable-runtime-results.json'),'utf8'));
const executables=process.argv.slice(2);
if(!executables.length)executables.push(process.execPath);
const temporary=mkdtempSync(join(tmpdir(),'cosmic-standalone-'));
const evidence=join(root,'verification');
const bundle='cosmic-commons.mjs';
const bundleInputs=JSON.parse(readFileSync(join(root,'BUNDLE-INPUTS.json'),'utf8'));
const expectedCompiledTests=readdirSync(join(root,'dist','tests')).filter(name=>name.endsWith('.test.js')).map(name=>`dist/tests/${name}`).sort();
assert.deepEqual([...bundleInputs.embeddedCompiledTestFiles,...bundleInputs.replacedCompiledTestFiles].sort(),expectedCompiledTests,'Every shipped compiled test file must be embedded or explicitly replaced.');
mkdirSync(evidence,{recursive:true});
function run(executable,args,cwd){
  const result=spawnSync(executable,[bundle,...args],{cwd,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
  assert.ifError(result.error);return result;
}
function json(result,status=0){
  assert.equal(result.status,status,`${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}
try {
  const rows=[];
  for(const [index,executable] of executables.entries()){
    const empty=join(temporary,`runtime-${index}`);mkdirSync(empty);
    copyFileSync(join(root,bundle),join(empty,bundle));
    assert.deepEqual(readdirSync(empty),[bundle]);
    const doctor=json(run(executable,['doctor'],empty));
    const test=run(executable,['prove'],empty);
    const transcriptName=`standalone-node-${doctor.runtime.node}-${doctor.runtime.platform}-${doctor.runtime.architecture}.txt`;
    const transcript=`Node ${doctor.runtime.node} / ${doctor.runtime.platform}-${doctor.runtime.architecture}\nOnly cosmic-commons.mjs was copied into the initially empty working directory.\n${test.stdout}${test.stderr}`;
    writeFileSync(join(evidence,transcriptName),transcript);
    assert.equal(test.status,0,transcript);
    const tests=Number(test.stdout.match(/^# tests (\d+)$/m)?.[1]);
    const passed=Number(test.stdout.match(/^# pass (\d+)$/m)?.[1]);
    const failed=Number(test.stdout.match(/^# fail (\d+)$/m)?.[1]);
    const skipped=Number(test.stdout.match(/^# skipped (\d+)$/m)?.[1]);
    assert.ok(tests>0);assert.equal(passed,tests);assert.equal(failed,0);assert.equal(skipped,0);
    const moduleRow=moduleResults.runtimes.find(row=>row.runtime.node===doctor.runtime.node);
    assert.ok(moduleRow,'Run the module portability check on this runtime first.');
    const examples=json(run(executable,['examples'],empty));
    assert.deepEqual(examples.map(example=>example.id).sort(),moduleResults.shippedExampleIds);
    const replay=[];
    for(const example of examples){
      const receiptPath=join(temporary,`${index}-${example.id}.json`);
      const demo=run(executable,['demo',example.id,'--out',receiptPath],empty);
      assert.equal(demo.status,0,`${demo.stdout}\n${demo.stderr}`);
      const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
      const result=json(run(executable,['verify',receiptPath,'--expect',receipt.digest],empty));
      assert.equal(result.valid,true);assert.equal(result.integrity,'VALID');assert.equal(result.replay,'MATCH');assert.equal(result.anchoring,'MATCH');
      replay.push({example:example.id,digest:receipt.digest,result});
    }
    assert.deepEqual(readdirSync(empty),[bundle],'No extracted dependency tree or other file may remain beside the standalone bundle.');
    rows.push({executable,empty,index,runtime:doctor.runtime,tests,passed,failed,skipped,moduleTests:moduleRow.tests,transcript:transcriptName,replay});
  }
  const crossRuntime=[];
  for(const source of rows)for(const target of rows){
    if(source.runtime.node===target.runtime.node)continue;
    const example=source.replay[0];
    const receiptPath=join(temporary,`${source.index}-${example.example}.json`);
    const result=json(run(target.executable,['verify',receiptPath,'--expect',example.digest],target.empty),1);
    assert.equal(result.valid,false);assert.equal(result.integrity,'VALID');assert.equal(result.replay,'UNSUPPORTED');assert.equal(result.anchoring,'MATCH');
    crossRuntime.push({from:source.runtime.node,to:target.runtime.node,result});
  }
  const bytes=readFileSync(join(root,bundle));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),bundleInputs.bundleSha256);
  const results={package:`${manifest.name}/${manifest.version}`,private:manifest.private===true,bundleSha256:createHash('sha256').update(bytes).digest('hex'),bundleBytes:bytes.length,initialDirectoryEntries:[bundle],proofScope:'Compiled test suite embedded, except the explicitly listed deployment test replacement; module-suite counts recorded separately.',embeddedCompiledTestFiles:bundleInputs.embeddedCompiledTestFiles,replacedCompiledTestFiles:bundleInputs.replacedCompiledTestFiles,replacement:bundleInputs.replacement,receiptOutputsOutsideWorkingDirectory:true,runtimes:rows.map(({executable,empty,index,...row})=>row),crossRuntime};
  writeFileSync(join(evidence,'standalone-runtime-results.json'),JSON.stringify(results,null,2)+'\n');
  process.stdout.write(JSON.stringify({runtimes:rows.map(row=>({node:row.runtime.node,tests:row.tests,passed:row.passed,examples:row.replay.length})),crossRuntimeRefusals:crossRuntime.length},null,2)+'\n');
}finally{rmSync(temporary,{recursive:true,force:true});}
