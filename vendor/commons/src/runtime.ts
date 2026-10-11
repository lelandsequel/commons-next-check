// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, dirname } from 'node:path';
import { endianness } from 'node:os';
import { sha256 } from './canonical.ts';
import { packagePath } from './package-root.ts';
export interface RuntimeContract {implementation:string;node:string;v8:string;platform:string;architecture:string;endianness:string;sourceDigest:string;codeDigest:string}
const root = dirname(fileURLToPath(import.meta.url));
function sourceFiles(dir:string,extension:string):string[] {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name),extension):e.isFile() && e.name.endsWith(extension) && !e.name.endsWith('.d.ts')?[join(dir,e.name)]:[]).sort();
}
function treeDigest(directory:string,extension:string):string {
  return sha256(sourceFiles(directory,extension).map(p=>({path:relative(directory,p).split('\\').join('/'),source:readFileSync(p,'utf8')})));
}
export function executionRuntime():RuntimeContract {
  return {implementation:'@cosmic/commons/0.2.2',node:process.versions.node,v8:process.versions.v8,platform:process.platform,architecture:process.arch,endianness:endianness(),sourceDigest:treeDigest(packagePath('src'),'.ts'),codeDigest:treeDigest(root,import.meta.url.endsWith('.ts')?'.ts':'.js')};
}

/** Separate deployments cannot silently replay each other's policy receipts. */
export function policyImplementation():string { return 'cosmic-commons/policy-v1/0.2.2'; }
