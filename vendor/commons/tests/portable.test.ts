// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { packageRoot, packagePath } from '../src/package-root.ts';

test('public ESM package exports execute as JavaScript and carry declared types', async () => {
  const result=spawnSync(process.execPath,['--input-type=module','-e',
    "import { runRequest, verifyRun } from '@cosmic/commons'; import { DiscoverySession } from '@cosmic/commons/inference'; import { evaluatePolicy } from '@cosmic/commons/policy'; const r=runRequest({kind:'policy',asOf:'2026-10-02T00:00:00Z',policy:{id:'portable',version:'1',rules:[{id:'rule',factId:'fact',op:'eq',value:true}]},evidence:{sources:[{id:'s'}],facts:[{id:'fact',sourceId:'s',value:true}]}}); console.log(JSON.stringify({valid:verifyRun(r,r.digest).valid,verdict:r.result.verdict,imports:[typeof DiscoverySession,typeof evaluatePolicy]}));"
  ],{cwd:packageRoot,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{valid:true,verdict:'ALLOW',imports:['function','function']});
});

test('doctor distinguishes the execution target from recorded replay requirements',()=>{
  const result=spawnSync(process.execPath,[packagePath('bin','cosmic.mjs'),'doctor'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const doctor=JSON.parse(result.stdout);
  assert.equal(doctor.executionTarget,'Node >=20');
  assert.equal(doctor.typescriptRequired,false);
  assert.equal(doctor.npmInstallRequired,false);
  assert.equal(doctor.runtime.node,process.versions.node);
  assert.match(doctor.runtime.sourceDigest,/^[a-f0-9]{64}$/);
  assert.match(doctor.runtime.codeDigest,/^[a-f0-9]{64}$/);
  assert.notEqual(doctor.runtime.sourceDigest,doctor.runtime.codeDigest);
});
