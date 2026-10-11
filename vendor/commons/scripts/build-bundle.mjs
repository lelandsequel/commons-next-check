#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build, version as esbuildVersion } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.length === 3 && process.argv[2] === '--check';
if (process.argv.length > 2 && !check) throw new Error('Usage: node scripts/build-bundle.mjs [--check]');
if (esbuildVersion !== '0.25.12') throw new Error('Bundle requires pinned esbuild 0.25.12; run npm ci --ignore-scripts');
function files(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Symlink build input refused: ${path}`);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
const relativePath = path => relative(root, path).split('\\').join('/');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const sourceFiles = files(join(root, 'src')).filter(path => path.endsWith('.ts') && !path.endsWith('.d.ts')).map(path => ({path:relative(join(root, 'src'), path).split('\\').join('/'), source:readFileSync(path, 'utf8')}));
const assetPaths = ['examples','web','tests/fixtures'].flatMap(part => files(join(root, part))).sort();
const assets = Object.fromEntries(assetPaths.map(path => [relativePath(path), readFileSync(path).toString('base64')]));
const assetHashes = Object.fromEntries(assetPaths.map(path => [relativePath(path), digest(readFileSync(path))]));
const testPaths = files(join(root, 'dist/tests')).filter(path => path.endsWith('.test.js') && !path.endsWith('/portable.test.js'));
const expectedExports = Object.keys(await import(pathToFileURL(join(root, 'dist/src/index.js')).href)).sort();
const packageSpecifiers = Object.keys(packageJson.exports).map(key => packageJson.name + (key === '.' ? '' : key.slice(1)));
const embedded = {implementation:`${packageJson.name}/${packageJson.version}`, sourceFiles, assets, assetHashes, expectedExports, packageSpecifiers};
const plugin = {
  name:'embedded-commons',
  setup(api) {
    api.onResolve({filter:/^standalone:(inputs|proof)$/}, args => ({path:args.path, namespace:'embedded'}));
    api.onLoad({filter:/.*/, namespace:'embedded'}, args => ({contents: args.path === 'standalone:inputs'
      ? Object.entries(embedded).map(([key,value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n')
      : [...testPaths, join(root, 'standalone/portable-proof.mjs')].map(path => `import ${JSON.stringify(path)};`).join('\n'), resolveDir:root, loader:'js'}));
    api.onResolve({filter:/(^|\/)runtime\.js$/}, args => args.namespace === 'file' && resolve(dirname(args.importer), args.path) === join(root, 'dist/src/runtime.js') ? {path:join(root, 'standalone/runtime.mjs')} : undefined);
    api.onResolve({filter:/(^|\/)package-root\.js$/}, args => args.namespace === 'file' && resolve(dirname(args.importer), args.path) === join(root, 'dist/src/package-root.js') ? {path:join(root, 'standalone/package-root.mjs')} : undefined);
    api.onResolve({filter:/^node:(fs|child_process)$/}, args => {
      if (args.importer.startsWith(join(root, 'dist') + '/')) return {path:join(root, 'standalone', args.path === 'node:fs' ? 'fs.mjs' : 'child-process.mjs')};
      return {path:args.path, external:true};
    });
  }
};
const output = await build({absWorkingDir:root, entryPoints:['standalone/entry.mjs'], bundle:true,
  // Inputs are already emitted JavaScript or native ESM. An explicit empty
  // configuration prevents ambient tsconfig discovery from assigning different
  // strict-mode metadata to modules reached through native and plugin paths.
  // ESM is inherently strict; the source build remains governed by strict tsc.
  platform:'node', format:'esm', target:['node20'], tsconfigRaw:{compilerOptions:{}}, write:false, outfile:'cosmic-commons.mjs',
  minify:false, charset:'utf8', legalComments:'inline', sourcemap:false, metafile:true,
  banner:{js:'#!/usr/bin/env node\n// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Rebuild from shipped inputs: node scripts/build-bundle.mjs [--check]'}, plugins:[plugin]});
if (output.outputFiles.length !== 1) throw new Error('Standalone build must produce exactly one file');
const bytes = Buffer.from(output.outputFiles[0].contents);
// All executable imports must be Node built-ins; no external package or assets.
for (const item of Object.values(output.metafile.outputs)) for (const dependency of item.imports) {
  if (!dependency.path.startsWith('node:')) throw new Error(`Non-built-in runtime dependency: ${dependency.path}`);
}
const inputPaths = [...new Set([join(root,'package.json'),join(root,'package-lock.json'),join(root,'scripts/build-bundle.mjs'),
  ...files(join(root,'standalone')), ...files(join(root,'src')), ...files(join(root,'dist')).filter(path=>path.endsWith('.js')), ...assetPaths])].sort();
const manifest = Buffer.from(JSON.stringify({schemaVersion:1, builder:`esbuild/${esbuildVersion}`, target:'node20', format:'esm',
  bundle:'cosmic-commons.mjs', bundleSha256:digest(bytes), bundleBytes:bytes.length,
  embeddedCompiledTestFiles:testPaths.map(relativePath), replacedCompiledTestFiles:['dist/tests/portable.test.js'],
  replacement:'standalone/portable-proof.mjs', inputFiles:inputPaths.map(path => ({path:relativePath(path),bytes:readFileSync(path).length,sha256:digest(readFileSync(path))}))}, null, 2)+'\n');
for (const [name, content] of [['cosmic-commons.mjs', bytes], ['BUNDLE-INPUTS.json', manifest]]) {
  const path = join(root, name);
  if (check) {
    if (!readFileSync(path).equals(content)) throw new Error(`Shipped ${name} differs from its reproducible inputs; run npm run bundle`);
  } else writeFileSync(path, content, {mode:name.endsWith('.mjs')?0o755:0o644});
}
process.stdout.write(`${check?'REPRODUCIBLE':'BUILT'}: cosmic-commons.mjs (${bytes.length} bytes, sha256 ${digest(bytes)}); ${testPaths.length} shared test files plus standalone deployment proofs.\n`);
