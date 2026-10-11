#!/usr/bin/env node
// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
// Rebuild from shipped inputs: node scripts/build-bundle.mjs [--check]
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));

// embedded:standalone:inputs
var implementation, sourceFiles, assets, assetHashes, expectedExports, packageSpecifiers;
var init_standalone_inputs = __esm({
  "embedded:standalone:inputs"() {
    implementation = "@cosmic/commons/0.2.2";
    sourceFiles = [{ "path": "canonical.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { createHash } from 'node:crypto';\n\nexport type JsonPrimitive = null | boolean | number | string;\nexport type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };\nexport const CANONICAL_MAX_NODES = 100_000;\nexport const CANONICAL_MAX_BYTES = 2_000_000;\n\n/** Strict canonical JSON v1: UTF-16 key order, JSON number format, no coercions. */\nexport function canonicalize(value: unknown): string {\n  const active = new Set<object>();\n  let nodes = 0;\n  let bytes = 0;\n  const take = (text: string): string => {\n    bytes += Buffer.byteLength(text, 'utf8');\n    if (bytes > CANONICAL_MAX_BYTES) throw new RangeError(`JSON_BYTE_LIMIT: canonical JSON exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);\n    return text;\n  };\n  const quote = (text: string): string => {\n    if (text.length > CANONICAL_MAX_BYTES) throw new RangeError('JSON_BYTE_LIMIT: string exceeds the JSON byte budget');\n    return take(JSON.stringify(text));\n  };\n  const visit = (item: unknown, path: string, depth: number): string => {\n    if (++nodes > CANONICAL_MAX_NODES || depth > 100) throw new TypeError(`JSON_LIMIT at ${path}`);\n    if (item === null) return take('null');\n    if (typeof item === 'string') {\n      if (!item.isWellFormed()) throw new TypeError(`INVALID_UNICODE at ${path}`);\n      return quote(item);\n    }\n    if (typeof item === 'boolean') return take(item ? 'true' : 'false');\n    if (typeof item === 'number') {\n      if (!Number.isFinite(item) || Object.is(item, -0)) throw new TypeError(`INVALID_NUMBER at ${path}`);\n      if (Number.isInteger(item) && !Number.isSafeInteger(item)) throw new TypeError(`UNSAFE_INTEGER at ${path}`);\n      return take(JSON.stringify(item));\n    }\n    if (typeof item !== 'object') throw new TypeError(`NOT_JSON at ${path}`);\n    if (active.has(item)) throw new TypeError(`JSON_CYCLE at ${path}`);\n    const proto = Object.getPrototypeOf(item);\n    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) {\n      throw new TypeError(`NOT_PLAIN_OBJECT at ${path}`);\n    }\n    if (Array.isArray(item) && proto !== Array.prototype) throw new TypeError(`NOT_PLAIN_ARRAY at ${path}`);\n    active.add(item);\n    try {\n      const keys = Reflect.ownKeys(item);\n      if (keys.some((key) => typeof key !== 'string')) throw new TypeError(`SYMBOL_KEY at ${path}`);\n      if (Array.isArray(item)) {\n        if (keys.length !== item.length + 1) throw new TypeError(`SPARSE_OR_EXTENDED_ARRAY at ${path}`);\n        take('[]');\n        const parts: string[] = [];\n        for (let index = 0; index < item.length; index++) {\n          if (index) take(',');\n          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));\n          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {\n            throw new TypeError(`NON_DATA_PROPERTY at ${path}[${index}]`);\n          }\n          parts.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));\n        }\n        return `[${parts.join(',')}]`;\n      }\n      take('{}');\n      const parts: string[] = [];\n      for (const key of (keys as string[]).sort()) {\n        if (parts.length) take(',');\n        if (!key.isWellFormed()) throw new TypeError(`INVALID_UNICODE_KEY at ${path}`);\n        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;\n        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError(`NON_DATA_PROPERTY at ${path}.${key}`);\n        const encodedKey = quote(key); take(':');\n        parts.push(`${encodedKey}:${visit(descriptor.value, `${path}.${key}`, depth + 1)}`);\n      }\n      return `{${parts.join(',')}}`;\n    } finally {\n      active.delete(item);\n    }\n  };\n  return visit(value, '$', 0);\n}\n\n/** Receipt exports use two-space JSON plus a newline. Refuse an artifact that\n * our own raw-text boundary could not ingest, including formatting overhead. */\nexport function assertReceiptTextLimit(value: unknown): void {\n  const bytes = Buffer.byteLength(JSON.stringify(value, null, 2) + '\\n', 'utf8');\n  if (bytes > CANONICAL_MAX_BYTES) throw new RangeError(`RECEIPT_BYTE_LIMIT: formatted receipt exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);\n}\n\n/** SHA-256 of the canonical JSON bytes; this is not a signature. */\nexport function sha256(value: unknown): string {\n  return sha256Bytes(canonicalize(value));\n}\n\nexport function sha256Bytes(text: string): string {\n  if (typeof text !== 'string' || !text.isWellFormed()) throw new TypeError('Expected well-formed UTF-8 text');\n  return createHash('sha256').update(text, 'utf8').digest('hex');\n}\n\nexport function jsonClone<T>(value: T): T {\n  return JSON.parse(canonicalize(value)) as T;\n}\n\n/** Requires an explicit UTC instant and rejects invalid calendar dates. */\nexport function timestamp(value: unknown, label = 'timestamp'): number {\n  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$/.test(value)) {\n    throw new TypeError(`${label} must be an ISO UTC instant with seconds and optional three-digit milliseconds`);\n  }\n  const time = Date.parse(value);\n  const expanded = value.length === 20 ? value.replace('Z', '.000Z') : value;\n  if (!Number.isFinite(time) || new Date(time).toISOString() !== expanded) throw new TypeError(`${label} is not a valid calendar instant`);\n  return time;\n}\n" }, { "path": "cli.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { readFileSync, writeFileSync, readdirSync, mkdirSync, lstatSync } from 'node:fs';\nimport { dirname, join } from 'node:path';\nimport { spawnSync } from 'node:child_process';\nimport { runRequest, verifyRunText, executionRuntime } from './run.ts';\nimport { parseStrictJson } from './strict-json.ts';\nimport { listExamples, getExample } from './examples.ts';\nimport { serve } from './server.ts';\nimport { packageRoot, packagePath } from './package-root.ts';\nconst help=`COSMIC Commons 0.2.2 — reason, decide, replay\\n\\n  cosmic serve [--port 4317]              Open the local workbench\\n  cosmic examples                         List included examples\\n  cosmic demo [name] [--out receipt.json]   Run a complete example\\n  cosmic run input.json [--out receipt.json]\\n  cosmic verify receipt.json [--expect SHA256]\\n  cosmic doctor                           Inspect runtime and build information\\n  cosmic prove                            Run the shipped correctness suite\\n\\nUse: node bin/cosmic.mjs <command>\\nVerification without --expect checks consistency, not trusted origin.\\n`;\nfunction parse(args:string[]){const positional:string[]=[];const flags:Record<string,string>={};for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){if(!['--port','--out','--expect'].includes(a)||Object.hasOwn(flags,a))throw new Error(`Unknown or repeated option: ${a}`);const value=args[++i];if(!value || value.startsWith('--'))throw new Error(`Missing value for ${a}`);flags[a]=value;}else positional.push(a);}return {positional,flags};}\nfunction assertOutputAvailable(path:string):void {\n  try { lstatSync(path); }\n  catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error; }\n  throw new Error(`Output already exists; refusing to overwrite a file, directory, or symlink: ${path}`);\n}\nfunction output(value:unknown,path?:string){const data=JSON.stringify(value,null,2)+'\\n';if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data,{flag:'wx'});process.stderr.write(`Saved ${path}\\n`);}else process.stdout.write(data);}\nexport async function main(args:string[]):Promise<void>{\n try {\n  if(!args.length||['help','--help','-h'].includes(args[0])){process.stdout.write(help);return;}\n  const command=args[0];const {positional,flags}=parse(args.slice(1));\n  const allowed:Record<string,string[]>={serve:['--port'],examples:[],demo:['--out'],run:['--out'],verify:['--expect'],prove:[],doctor:[]};\n  if(!Object.hasOwn(allowed,command))throw new Error(`Unknown command: ${command}`);\n  for(const flag of Object.keys(flags))if(!allowed[command].includes(flag))throw new Error(`${flag} is not supported by ${command}`);\n  if(positional.length>(['demo','run','verify'].includes(command)?1:0))throw new Error('Too many arguments');\n  if(flags['--expect']!==undefined && !/^[a-f0-9]{64}$/.test(flags['--expect']))throw new Error('--expect must be 64 lowercase hexadecimal characters');\n  if(flags['--out']!==undefined)assertOutputAvailable(flags['--out']);\n  if(command==='serve'){await serve(flags['--port']?Number(flags['--port']):4317);return;}\n  if(command==='doctor'){output({runtime:executionRuntime(),executionTarget:'Node >=20',typescriptRequired:false,npmInstallRequired:false,validationEvidence:'verification/portable-runtime-results.json',replayContract:'Exact recorded Node/V8, platform, architecture, endianness, source and executed-code hashes'});return;}\n  if(command==='examples'){output(listExamples().map(({id,name,description})=>({id,name,description})));return;}\n  if(command==='demo'){output(runRequest(getExample(positional[0])),flags['--out']);return;}\n  if(command==='run'||command==='verify'){\n    if(!positional[0])throw new Error(`${command} requires a JSON file`);\n    const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(readFileSync(positional[0]));\n    if(command==='run')output(runRequest(parseStrictJson(raw)),flags['--out']);\n    else {const result=verifyRunText(raw,flags['--expect']);output(result);if(!result.valid)process.exitCode=1;}\n    return;\n  }\n  const directory=packagePath('dist','tests');\n  const files=readdirSync(directory).filter(f=>f.endsWith('.test.js')).sort().map(f=>join(directory,f));\n  if(!files.length)throw new Error('No compiled tests found; rebuild with npm ci && npm run build');\n  const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:packageRoot,stdio:'inherit'});\n  if(run.error)throw run.error;\n  process.exitCode=run.status??1;\n }catch(error){process.stderr.write(`COSMIC: ${error instanceof Error?error.message:String(error)}\\n`);process.exitCode=2;}\n}\n" }, { "path": "evidence.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { canonicalize, sha256, timestamp } from './canonical.ts';\nimport type { JsonValue } from './canonical.ts';\n\nexport interface EvidenceSource { id: string; uri?: string; content?: JsonValue; digest?: string }\nexport interface EvidenceFact {\n  id: string;\n  sourceId: string;\n  value: JsonValue;\n  /** Independent records about the same claim conflict if their values or units disagree. */\n  claimId?: string;\n  unit?: string;\n  observedAt?: string;\n  expiresAt?: string;\n  dependsOn?: string[];\n}\nexport interface EvidenceBundle { sources: EvidenceSource[]; facts: EvidenceFact[] }\nexport type FactStatus = 'AVAILABLE' | 'MISSING' | 'EXPIRED' | 'FUTURE' | 'CONFLICT' | 'INVALID';\nexport interface EvidenceIssue { code: string; severity: 'ERROR' | 'UNAVAILABLE'; factIds: string[]; message: string }\nexport interface FactState { id: string; status: FactStatus; reasons: string[] }\nexport interface EvidenceReport {\n  asOf: string;\n  valid: boolean;\n  issues: EvidenceIssue[];\n  facts: FactState[];\n  lineage: { factId: string; sourceId: string; dependsOn: string[] }[];\n  sources: { id: string; contentStatus: 'DIGEST_VERIFIED' | 'DIGEST_MISMATCH' | 'CONTENT_ONLY' | 'REFERENCE_ONLY'; computedDigest?: string }[];\n}\n\nconst isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);\n/** Bounds graph work and diagnostic output independently of the JSON byte limit. */\nexport const EVIDENCE_LIMITS = Object.freeze({ sources: 1000, facts: 1000, dependencies: 10_000 });\n\nclass EvidenceLimitError extends TypeError {}\nexport function requiredId(value: unknown, label: string): asserts value is string {\n  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 256) throw new TypeError(`${label} must be a nonempty string of at most 256 characters without surrounding whitespace`);\n}\nexport function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {\n  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`);\n}\n\nfunction validateBundle(value: unknown): asserts value is EvidenceBundle {\n  canonicalize(value);\n  if (!isRecord(value)) throw new TypeError('Evidence must be an object');\n  exactKeys(value, ['sources', 'facts'], 'evidence');\n  if (!Array.isArray(value.sources) || !Array.isArray(value.facts)) throw new TypeError('Evidence requires sources and facts arrays');\n  if (value.sources.length > EVIDENCE_LIMITS.sources || value.facts.length > EVIDENCE_LIMITS.facts) {\n    throw new EvidenceLimitError('Evidence supports at most 1000 sources and 1000 facts');\n  }\n  // Inspect all lengths before allocating graph indexes, issue arrays or dependency sets.\n  let dependencies = 0;\n  for (const fact of value.facts) if (isRecord(fact) && Array.isArray(fact.dependsOn)) {\n    dependencies += fact.dependsOn.length;\n    if (dependencies > EVIDENCE_LIMITS.dependencies) {\n      throw new EvidenceLimitError('Evidence supports at most 10000 total dependency references');\n    }\n  }\n  for (const source of value.sources) {\n    if (!isRecord(source)) throw new TypeError('Each source must be an object');\n    exactKeys(source, ['id', 'uri', 'content', 'digest'], 'source');\n    requiredId(source.id, 'source.id');\n    if ('uri' in source && (typeof source.uri !== 'string' || !source.uri.trim())) throw new TypeError('source.uri must be a nonempty string');\n    if ('digest' in source && (typeof source.digest !== 'string' || !/^[0-9a-f]{64}$/.test(source.digest))) throw new TypeError('source.digest must be a lowercase SHA-256 hex string');\n  }\n  for (const fact of value.facts) {\n    if (!isRecord(fact)) throw new TypeError('Each fact must be an object');\n    exactKeys(fact, ['id', 'sourceId', 'value', 'claimId', 'unit', 'observedAt', 'expiresAt', 'dependsOn'], 'fact');\n    requiredId(fact.id, 'fact.id');\n    requiredId(fact.sourceId, 'fact.sourceId');\n    if (!Object.hasOwn(fact, 'value')) throw new TypeError('fact.value is required');\n    if ('claimId' in fact) requiredId(fact.claimId, 'fact.claimId');\n    if ('unit' in fact) requiredId(fact.unit, 'fact.unit');\n    if ('observedAt' in fact) timestamp(fact.observedAt, 'fact.observedAt');\n    if ('expiresAt' in fact) timestamp(fact.expiresAt, 'fact.expiresAt');\n    if ('observedAt' in fact && 'expiresAt' in fact && timestamp(fact.expiresAt) <= timestamp(fact.observedAt)) {\n      throw new TypeError('fact.expiresAt must follow fact.observedAt');\n    }\n    if ('dependsOn' in fact) {\n      if (!Array.isArray(fact.dependsOn)) throw new TypeError('fact.dependsOn must be an array');\n      for (const id of fact.dependsOn) requiredId(id, 'fact.dependsOn entry');\n      if (new Set(fact.dependsOn).size !== fact.dependsOn.length) throw new TypeError('fact.dependsOn contains duplicate references');\n    }\n  }\n}\n\n/** Checks declared structure, references, time-based availability and contradictions, not source truth. */\nexport function inspectEvidence(bundle: EvidenceBundle, asOf: string): EvidenceReport {\n  const now = timestamp(asOf, 'asOf');\n  const report: EvidenceReport = { asOf, valid: false, issues: [], facts: [], lineage: [], sources: [] };\n  try { validateBundle(bundle); }\n  catch (error) {\n    report.issues.push({ code: error instanceof EvidenceLimitError ? 'EVIDENCE_LIMIT' : 'MALFORMED_EVIDENCE', severity: 'ERROR', factIds: [], message: error instanceof Error ? error.message : 'Malformed evidence' });\n    return report;\n  }\n  const sources = new Map<string, EvidenceSource>();\n  const facts = new Map<string, EvidenceFact>();\n  const states = new Map<string, FactState>();\n  const reasonSets = new Map<string, Set<string>>();\n  const sourceFacts = new Map<string, string[]>();\n  const invalidSources = new Set<string>();\n  const rank: Record<FactStatus, number> = { AVAILABLE: 0, FUTURE: 1, EXPIRED: 2, MISSING: 3, CONFLICT: 4, INVALID: 5 };\n  const mark = (id: string, status: FactStatus, reason: string): boolean => {\n    const state = states.get(id);\n    if (!state) return false;\n    const changed = rank[status] > rank[state.status];\n    if (changed) state.status = status;\n    reasonSets.get(id)!.add(reason);\n    return changed;\n  };\n  const issue = (code: string, severity: EvidenceIssue['severity'], factIds: string[], message: string) => report.issues.push({ code, severity, factIds: [...factIds].sort(), message });\n  for (const source of bundle.sources) {\n    if (sources.has(source.id)) { invalidSources.add(source.id); issue('DUPLICATE_SOURCE_ID', 'ERROR', [], `Duplicate source id: ${source.id}`); }\n    else sources.set(source.id, source);\n  }\n  for (const fact of bundle.facts) {\n    if (facts.has(fact.id)) { mark(fact.id, 'INVALID', 'DUPLICATE_FACT_ID'); issue('DUPLICATE_FACT_ID', 'ERROR', [fact.id], `Duplicate fact id: ${fact.id}`); }\n    else {\n      facts.set(fact.id, fact); states.set(fact.id, { id: fact.id, status: 'AVAILABLE', reasons: [] });\n      reasonSets.set(fact.id, new Set());\n      const ids = sourceFacts.get(fact.sourceId) ?? []; ids.push(fact.id); sourceFacts.set(fact.sourceId, ids);\n    }\n  }\n  for (const source of sources.values()) {\n    if (Object.hasOwn(source, 'content')) {\n      const computedDigest = sha256(source.content);\n      const contentStatus = source.digest === undefined ? 'CONTENT_ONLY' : source.digest === computedDigest ? 'DIGEST_VERIFIED' : 'DIGEST_MISMATCH';\n      report.sources.push({ id: source.id, contentStatus, computedDigest });\n      if (contentStatus === 'DIGEST_MISMATCH') {\n        invalidSources.add(source.id);\n        issue('SOURCE_DIGEST_MISMATCH', 'ERROR', sourceFacts.get(source.id) ?? [], `Content digest mismatch: ${source.id}`);\n      }\n    } else report.sources.push({ id: source.id, contentStatus: 'REFERENCE_ONLY' });\n  }\n  for (const fact of facts.values()) {\n    report.lineage.push({ factId: fact.id, sourceId: fact.sourceId, dependsOn: [...(fact.dependsOn ?? [])].sort() });\n    if (!sources.has(fact.sourceId)) { mark(fact.id, 'MISSING', 'MISSING_SOURCE'); issue('MISSING_SOURCE', 'UNAVAILABLE', [fact.id], `Missing source: ${fact.sourceId}`); }\n    if (invalidSources.has(fact.sourceId)) mark(fact.id, 'INVALID', 'INVALID_SOURCE');\n    if (fact.observedAt !== undefined && timestamp(fact.observedAt) > now) { mark(fact.id, 'FUTURE', 'FUTURE_OBSERVATION'); issue('FUTURE_OBSERVATION', 'UNAVAILABLE', [fact.id], 'Observation occurs after asOf'); }\n    if (fact.expiresAt !== undefined && timestamp(fact.expiresAt) <= now) { mark(fact.id, 'EXPIRED', 'EXPIRED_EVIDENCE'); issue('EXPIRED_EVIDENCE', 'UNAVAILABLE', [fact.id], 'Evidence expires at or before asOf'); }\n    for (const dependency of fact.dependsOn ?? []) if (!facts.has(dependency)) { mark(fact.id, 'MISSING', `MISSING_DEPENDENCY:${dependency}`); issue('MISSING_DEPENDENCY', 'UNAVAILABLE', [fact.id], `Missing dependency: ${dependency}`); }\n  }\n  // Iterative Kosaraju passes identify strongly connected components in O(V + E).\n  // Emit one bounded diagnostic per cyclic component, never one per overlapping path.\n  const dependencies = new Map<string, string[]>();\n  const dependents = new Map<string, string[]>();\n  for (const id of facts.keys()) { dependencies.set(id, []); dependents.set(id, []); }\n  for (const fact of facts.values()) for (const dependency of fact.dependsOn ?? []) if (facts.has(dependency)) {\n    dependencies.get(fact.id)!.push(dependency);\n    dependents.get(dependency)!.push(fact.id);\n  }\n  const visited = new Set<string>();\n  const finished: string[] = [];\n  for (const id of facts.keys()) {\n    if (visited.has(id)) continue;\n    visited.add(id);\n    const stack = [{ id, next: 0 }];\n    while (stack.length) {\n      const frame = stack[stack.length - 1];\n      const edges = dependencies.get(frame.id)!;\n      if (frame.next === edges.length) { finished.push(frame.id); stack.pop(); continue; }\n      const child = edges[frame.next++];\n      if (!visited.has(child)) { visited.add(child); stack.push({ id: child, next: 0 }); }\n    }\n  }\n  visited.clear();\n  for (let index = finished.length - 1; index >= 0; index--) {\n    const id = finished[index];\n    if (visited.has(id)) continue;\n    visited.add(id);\n    const members: string[] = [];\n    const stack = [id];\n    while (stack.length) {\n      const member = stack.pop()!; members.push(member);\n      for (const parent of dependents.get(member)!) if (!visited.has(parent)) { visited.add(parent); stack.push(parent); }\n    }\n    if (members.length > 1 || dependencies.get(id)!.includes(id)) {\n      issue('DEPENDENCY_CYCLE', 'ERROR', members, 'Evidence dependencies contain a cycle');\n      for (const member of members) mark(member, 'INVALID', 'DEPENDENCY_CYCLE');\n    }\n  }\n  const claims = new Map<string, EvidenceFact[]>();\n  for (const fact of facts.values()) if (fact.claimId && states.get(fact.id)!.status === 'AVAILABLE') {\n    const group = claims.get(fact.claimId) ?? []; group.push(fact); claims.set(fact.claimId, group);\n  }\n  for (const [claimId, group] of claims) {\n    const values = new Set(group.map((fact) => canonicalize({ value: fact.value, unit: fact.unit ?? null })));\n    if (values.size > 1) {\n      const ids = group.map((fact) => fact.id);\n      issue('CONFLICTING_CLAIM', 'UNAVAILABLE', ids, `Conflicting declared values or units for claim: ${claimId}`);\n      for (const id of ids) mark(id, 'CONFLICT', 'CONFLICTING_CLAIM');\n    }\n  }\n  // Each fact's status increases at most five times. Revisit only affected edges;\n  // a diagnostic reason is recorded once per edge, even in a dense cyclic graph.\n  const pending = [...states.values()].filter((state) => state.status !== 'AVAILABLE').map((state) => state.id);\n  const queued = new Set(pending);\n  for (let cursor = 0; cursor < pending.length; cursor++) {\n    const dependency = pending[cursor]; queued.delete(dependency);\n    const status = states.get(dependency)!.status;\n    for (const dependent of dependents.get(dependency)!) {\n      if (mark(dependent, status, `DEPENDENCY_UNAVAILABLE:${dependency}`) && !queued.has(dependent)) {\n        pending.push(dependent); queued.add(dependent);\n      }\n    }\n  }\n  report.valid = !report.issues.some((item) => item.severity === 'ERROR');\n  report.facts = [...states.values()].map((state) => ({ ...state, reasons: [...reasonSets.get(state.id)!].sort() })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);\n  report.lineage.sort((a, b) => a.factId < b.factId ? -1 : a.factId > b.factId ? 1 : 0);\n  report.sources.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);\n  return report;\n}\n" }, { "path": "examples.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { readFileSync, readdirSync } from 'node:fs';\nimport { parseStrictJson } from './strict-json.ts';\nimport { packagePath } from './package-root.ts';\nconst directory=packagePath('examples');\nconst descriptions:Record<string,{name:string;description:string}>={\n  'sensor-investigation':{name:'Sensor investigation',description:'Update two declared explanations, inspect model adequacy, and choose the next measurement.'},\n  'discovery-deferred':{name:'Rejected model family',description:'A zero-prior decoy cannot rescue rejected active models: DEFER with no action suggestion.'},\n  'release-authorization':{name:'Release authorization',description:'Evaluate artifact evidence against explicit tests, review, and security requirements.'},\n  'release-deferred':{name:'Missing evidence',description:'See why missing review evidence produces DEFER instead of approval.'},\n  'release-denied':{name:'Failed requirement',description:'See a complete record fail an explicit security requirement.'},\n};\nexport function listExamples(){return readdirSync(directory).filter(n=>n.endsWith('.json')).sort().map(name=>{const id=name.slice(0,-5);return{id,...descriptions[id],input:parseStrictJson(readFileSync(packagePath('examples',name),'utf8')) as any};});}\nexport function getExample(id='sensor-investigation'){const found=listExamples().find(e=>e.id===id);if(!found)throw new Error(`Unknown example: ${id}`);return found.input;}\n" }, { "path": "index.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nexport * from './run.ts';\nexport * from './canonical.ts';\nexport * from './evidence.ts';\nexport * from './policy.ts';\nexport * from './receipt.ts';\nexport * from './inference/index.ts';\nexport * from './strict-json.ts';\n" }, { "path": "inference/adequacy.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.\nimport { canonicalJSON, DiscoverySession, hashJSON, validateDiscoveryIdentifier as identifier } from './session.ts';\nimport { currentReplayRuntime, ReplayRuntimeError } from './runtime.ts';\nimport type { DiscoveryConfig, Experiment, ReplayRuntime } from './types.ts';\n\nexport const ADEQUACY_SCHEMA_VERSION = 2 as const;\nexport const ADEQUACY_IMPLEMENTATION = '@cosmic/commons-adequacy/0.2.2' as const;\nexport const ADEQUACY_NORMALIZATION_POLICY = 'normalize-row-preserve-smaller-tail-binary64-v1' as const;\nexport const ADEQUACY_SUPPORT_POLICY = 'strictly-positive-declared-prior-frozen-at-construction-v1' as const;\nexport type AdequacyRuntime = Omit<ReplayRuntime, 'implementation'> & {\n  implementation: typeof ADEQUACY_IMPLEMENTATION;\n};\nexport interface FamilyAdequacyOptions { alpha: number; epochId: string }\nexport type AdequacyStatus = 'NOT_REJECTED' | 'REJECTED_DECLARED_FAMILY' | 'ZERO_SUPPORT_CONTRADICTION';\n/** Exact Bernoulli interpretation: P(tailOutcome)=tailProbability and the other\n * probability is its mathematical complement. The displayed complement may round\n * to one; log1p(-tailProbability) preserves its log contribution. */\nexport interface EffectiveBernoulliLaw {\n  tailOutcome: string;\n  tailProbability: number;\n  complementOutcome: string;\n}\n\ninterface AdequacyIdentity {\n  schemaVersion: typeof ADEQUACY_SCHEMA_VERSION;\n  runtime: AdequacyRuntime;\n  epochId: string;\n  definitionHash: string;\n  optionsHash: string;\n  chainAnchorHash: string;\n  alpha: number;\n  supportPolicy: typeof ADEQUACY_SUPPORT_POLICY;\n  /** The frozen null family, selected once from the original declaration. */\n  nullHypothesisIds: string[];\n  /** Zero prior excludes a law from both inference and this adequacy guarantee. */\n  excludedZeroPriorHypothesisIds: string[];\n  normalizationPolicy: typeof ADEQUACY_NORMALIZATION_POLICY;\n  effectiveLawHash: string;\n}\nexport interface PreparedAdequacyObservation extends AdequacyIdentity {\n  id: string;\n  experimentId: string;\n  sequence: number;\n  outcomes: [string, string];\n  nullProbabilities: Record<string, Record<string, number>>;\n  /** Effective log probabilities; null means an exact zero, never underflow. */\n  nullLogProbabilities: Record<string, Record<string, number | null>>;\n  alternativeProbabilities: Record<string, number>;\n  previousHash: string;\n  hash: string;\n}\ninterface AdequacyStatistics {\n  status: AdequacyStatus;\n  /** null represents positive infinity only when eValueState says zero support. */\n  logEValue: number | null;\n  eValueState: 'finite' | 'infinite-zero-support';\n  /** Includes E_0 = 1. This historical maximum is not itself an e-process. */\n  maxLogEValue: number | null;\n  firstCrossingSequence: number | null;\n  /** null is negative infinity: that candidate assigns zero probability to the path. */\n  nullLogLikelihoods: Record<string, number | null>;\n  impossibleHypothesisIds: string[];\n  alternativeLogLikelihood: number;\n}\nexport interface AdequacyReceipt extends AdequacyIdentity, AdequacyStatistics {\n  id: string;\n  experimentId: string;\n  outcome: string;\n  sequence: number;\n  prepared: PreparedAdequacyObservation;\n  previousHash: string;\n  hash: string;\n}\nexport interface FamilyAdequacySnapshot extends AdequacyIdentity, AdequacyStatistics {\n  modelId: string;\n  nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws';\n  notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval';\n  budgetSemantics: 'external-discovery-session-only';\n  alternative: 'per-experiment-beta-half-prequential';\n  observationCount: number;\n  effectiveNullLaws: Record<string, Record<string, EffectiveBernoulliLaw>>;\n  counts: Record<string, Record<string, number>>;\n  pending: PreparedAdequacyObservation | null;\n  receipts: AdequacyReceipt[];\n}\n\nexport function currentAdequacyRuntime(): AdequacyRuntime {\n  return { ...currentReplayRuntime(), implementation: ADEQUACY_IMPLEMENTATION };\n}\nfunction assertAdequacyRuntime(recorded: AdequacyRuntime | undefined): void {\n  const current = currentAdequacyRuntime();\n  const keys = Object.keys(current) as Array<keyof AdequacyRuntime>;\n  if (!recorded || keys.some(key => typeof recorded[key] !== 'string' || !recorded[key])) {\n    throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME', 'Adequacy replay requires a complete recorded runtime');\n  }\n  if (keys.some(key => recorded[key] !== current[key])) {\n    throw new ReplayRuntimeError('REPLAY_RUNTIME_MISMATCH', 'Adequacy replay runtime or implementation mismatch');\n  }\n}\n/** Validate requested monitoring options even when the experiment family is\n * outside the Bernoulli monitor's supported scope. */\nexport function validateFamilyAdequacyOptions(options: FamilyAdequacyOptions): void {\n  if (!options || !Number.isFinite(options.alpha) || options.alpha <= 0 || options.alpha >= 1) {\n    throw new Error('alpha must be finite and strictly between zero and one');\n  }\n  identifier(options.epochId, 'epochId');\n}\nfunction freezeDeep<T>(value: T): T {\n  if (value !== null && typeof value === 'object') {\n    for (const child of Object.values(value)) freezeDeep(child);\n    Object.freeze(value);\n  }\n  return value;\n}\nfunction finite(value: number): number {\n  if (!Number.isFinite(value)) throw new Error('Adequacy numeric range exceeded; no observation was committed');\n  return value;\n}\n\n/**\n * Monitors only the declared, frozen, fully specified conditional Bernoulli laws\n * whose original priors are strictly positive. Zero prior excludes a hypothesis\n * from inference and from this null family; it cannot shield the active family\n * from rejection. Positive prior magnitudes do not weight the null likelihoods.\n * The support is fixed at construction, never refitted to a posterior or outcome.\n * Approximate input rows (legacy tolerance 1e-12) are explicitly transformed into\n * effective normalized laws: normalize the smaller tail, use its exact complement.\n * Raw definition and effective-law digests are both retained. The null guarantee\n * concerns the effective laws; their probabilities can differ from raw inputs at\n * rounding scale. Tiny positive tails are never silently clipped to zero.\n * E_t = Q_t / max_h L_h,t, with Q learned strictly from previous observations.\n * Under any admitted positive-prior true conditional law, threshold crossing has probability at\n * most alpha (in exact arithmetic). Native binary64 calculations are not a formal\n * numerical proof. NOT_REJECTED does not validate a law or authorize an action.\n *\n * Experiment choice may adapt to past observations. Candidate discovery, refitting,\n * batch observations, parameter-family rejection, and automatic resets are absent.\n * The originating DiscoverySession owns budget enforcement; this monitor spends\n * no budget and does not change the old session or its v2 evidence format.\n */\nexport class FamilyAdequacyMonitor {\n  private readonly definition: DiscoveryConfig;\n  private readonly options: FamilyAdequacyOptions;\n  private readonly identity: AdequacyIdentity;\n  private readonly ids: string[];\n  private readonly experiments: Map<string, Experiment>;\n  private readonly countState: Map<string, [number, number]>;\n  private readonly effectiveNullLaws: Record<string, Record<string, EffectiveBernoulliLaw>>;\n  private readonly evidenceIds = new Set<string>();\n  private readonly receipts: AdequacyReceipt[] = [];\n  private pending: PreparedAdequacyObservation | null = null;\n  private logs: number[];\n  private alternativeLog = 0;\n  private logE = 0;\n  private maxLogE = 0;\n  private firstCrossing: number | null = null;\n\n  constructor(definition: DiscoveryConfig, options: FamilyAdequacyOptions) {\n    validateFamilyAdequacyOptions(options);\n    // Reuse public validation and a defensive copy, never its posterior weights.\n    this.definition = new DiscoverySession(definition).exportDefinition();\n    this.ids = this.definition.hypotheses.filter(h => h.prior > 0).map(h => h.id);\n    const excludedZeroPriorHypothesisIds = this.definition.hypotheses.filter(h => h.prior === 0).map(h => h.id);\n    const effectiveEntries: Array<[string, Record<string, EffectiveBernoulliLaw>]> = [];\n    for (const experiment of this.definition.experiments) {\n      if (experiment.outcomes.length !== 2) throw new Error('Adequacy v2 requires exactly two outcome labels per experiment');\n      const rows = this.ids.map((id): [string, EffectiveBernoulliLaw] => {\n        const row = experiment.likelihoods[id];\n        const [left, right] = experiment.outcomes;\n        const total = row[left] + row[right]; // Legacy validation already bounds |total-1| <= 1e-12.\n        const tailOutcome = row[left] <= row[right] ? left : right;\n        const complementOutcome = tailOutcome === left ? right : left;\n        const tailProbability = row[tailOutcome] / total;\n        if (!Number.isFinite(tailProbability) || tailProbability < 0 || tailProbability > 0.5 ||\n            (row[tailOutcome] > 0 && tailProbability === 0)) {\n          throw new Error('Normalized Bernoulli tail is not representable');\n        }\n        return [id, { tailOutcome, tailProbability, complementOutcome }];\n      });\n      effectiveEntries.push([experiment.id, Object.fromEntries(rows)]);\n    }\n    this.effectiveNullLaws = Object.fromEntries(effectiveEntries);\n    this.options = { alpha: options.alpha, epochId: options.epochId };\n    this.logs = this.ids.map(() => 0);\n    this.experiments = new Map(this.definition.experiments.map(e => [e.id, e]));\n    this.countState = new Map(this.definition.experiments.map(e => [e.id, [0, 0]]));\n    const normalizationPolicy = ADEQUACY_NORMALIZATION_POLICY;\n    const anchor = { schemaVersion: ADEQUACY_SCHEMA_VERSION, runtime: currentAdequacyRuntime(),\n      definitionHash: hashJSON(this.definition), optionsHash: hashJSON(this.options), ...this.options,\n      supportPolicy: ADEQUACY_SUPPORT_POLICY, nullHypothesisIds: [...this.ids], excludedZeroPriorHypothesisIds,\n      normalizationPolicy, effectiveLawHash: hashJSON({ normalizationPolicy, laws: this.effectiveNullLaws }) };\n    this.identity = { ...anchor, chainAnchorHash: hashJSON(anchor) };\n  }\n\n  private statistics(): AdequacyStatistics {\n    const impossible = this.logs.every(value => value === -Infinity);\n    return {\n      status: impossible ? 'ZERO_SUPPORT_CONTRADICTION' : this.firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',\n      logEValue: impossible ? null : this.logE,\n      eValueState: impossible ? 'infinite-zero-support' : 'finite',\n      maxLogEValue: this.maxLogE === Infinity ? null : this.maxLogE,\n      firstCrossingSequence: this.firstCrossing,\n      nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, this.logs[i] === -Infinity ? null : this.logs[i]])),\n      impossibleHypothesisIds: this.ids.filter((_, i) => this.logs[i] === -Infinity),\n      alternativeLogLikelihood: this.alternativeLog,\n    };\n  }\n\n  prepare(observationId: string, experimentId: string): PreparedAdequacyObservation {\n    identifier(observationId, 'observation id');\n    identifier(experimentId, 'experiment id');\n    if (this.pending) throw new Error('A prepared observation is pending; commit it before preparing another');\n    if (this.logs.every(value => value === -Infinity)) throw new Error('Monitor stopped after zero support contradiction');\n    if (this.evidenceIds.has(observationId)) throw new Error('Duplicate observation id: evidence cannot be counted twice');\n    const experiment = this.experiments.get(experimentId);\n    if (!experiment) throw new Error('Unknown experiment');\n    const counts = this.countState.get(experimentId)!;\n    const total = counts[0] + counts[1];\n    // Keep half-counts and the next count exactly representable, and q interior.\n    if (total >= 2 ** 50 || !Number.isSafeInteger(this.receipts.length + 1)) throw new Error('Adequacy observation count limit reached');\n    const q0 = (counts[0] + 0.5) / (total + 1);\n    const q1 = (counts[1] + 0.5) / (total + 1);\n    if (!(q0 > 0 && q0 < 1 && q1 > 0 && q1 < 1)) throw new Error('Alternative probabilities are not representable');\n    const laws = this.effectiveNullLaws[experimentId];\n    const nullProbabilities = Object.fromEntries(this.ids.map(id => {\n      const law = laws[id];\n      return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability], [law.complementOutcome, 1 - law.tailProbability]])];\n    }));\n    const nullLogProbabilities = Object.fromEntries(this.ids.map(id => {\n      const law = laws[id];\n      return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability === 0 ? null : Math.log(law.tailProbability)],\n        [law.complementOutcome, law.tailProbability === 0 ? 0 : Math.log1p(-law.tailProbability)]])];\n    }));\n    const body = { ...structuredClone(this.identity), id: observationId, experimentId,\n      sequence: this.receipts.length + 1, outcomes: [...experiment.outcomes] as [string, string],\n      nullProbabilities, nullLogProbabilities,\n      alternativeProbabilities: Object.fromEntries([[experiment.outcomes[0], q0], [experiment.outcomes[1], q1]]),\n      previousHash: this.receipts.at(-1)?.hash ?? this.identity.chainAnchorHash };\n    const prepared: PreparedAdequacyObservation = { ...body, hash: hashJSON(body) };\n    this.pending = prepared;\n    return freezeDeep(structuredClone(prepared));\n  }\n\n  observe(token: PreparedAdequacyObservation, outcome: string): AdequacyReceipt {\n    if (!this.pending) throw new Error('No prepared observation is pending');\n    if (canonicalJSON(token) !== canonicalJSON(this.pending)) throw new Error('Prepared token verification failed');\n    const prepared = this.pending;\n    const index = prepared.outcomes.indexOf(outcome);\n    if (index < 0) throw new Error('Outcome is outside the declared binary observation alphabet');\n    const nextLogs = this.logs.map((value, i) => {\n      const logProbability = prepared.nullLogProbabilities[this.ids[i]][outcome];\n      return value === -Infinity || logProbability === null ? -Infinity : finite(value + logProbability);\n    });\n    const alternativeLog = finite(this.alternativeLog + Math.log(prepared.alternativeProbabilities[outcome]));\n    const peak = nextLogs.reduce((maximum, value) => Math.max(maximum, value), -Infinity);\n    const logE = peak === -Infinity ? Infinity : finite(alternativeLog - peak);\n    const firstCrossing = this.firstCrossing ?? (logE >= -Math.log(this.options.alpha) ? prepared.sequence : null);\n    const maxLogE = Math.max(this.maxLogE, logE);\n    const statistics: AdequacyStatistics = {\n      status: peak === -Infinity ? 'ZERO_SUPPORT_CONTRADICTION' : firstCrossing === null ? 'NOT_REJECTED' : 'REJECTED_DECLARED_FAMILY',\n      logEValue: logE === Infinity ? null : logE,\n      eValueState: peak === -Infinity ? 'infinite-zero-support' : 'finite',\n      maxLogEValue: maxLogE === Infinity ? null : maxLogE,\n      firstCrossingSequence: firstCrossing,\n      nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, nextLogs[i] === -Infinity ? null : nextLogs[i]])),\n      impossibleHypothesisIds: this.ids.filter((_, i) => nextLogs[i] === -Infinity),\n      alternativeLogLikelihood: alternativeLog,\n    };\n    const body = { ...structuredClone(this.identity), ...statistics, id: prepared.id,\n      experimentId: prepared.experimentId, outcome, sequence: prepared.sequence,\n      prepared: structuredClone(prepared), previousHash: prepared.previousHash };\n    const receipt: AdequacyReceipt = { ...body, hash: hashJSON(body) };\n    // All validation, numeric work, cloning and hashing precede state mutation.\n    const result = structuredClone(receipt);\n    this.logs = nextLogs;\n    this.alternativeLog = alternativeLog;\n    this.logE = logE;\n    this.maxLogE = maxLogE;\n    this.firstCrossing = firstCrossing;\n    this.countState.get(prepared.experimentId)![index]++;\n    this.evidenceIds.add(prepared.id);\n    this.receipts.push(receipt);\n    this.pending = null;\n    return result;\n  }\n\n  snapshot(): FamilyAdequacySnapshot {\n    return { ...structuredClone(this.identity), ...this.statistics(), modelId: this.definition.modelId,\n      nullSemantics: 'frozen-positive-prior-conditional-bernoulli-laws',\n      notRejectedSemantics: 'insufficient-evidence-against-declared-laws-not-approval',\n      budgetSemantics: 'external-discovery-session-only', alternative: 'per-experiment-beta-half-prequential',\n      observationCount: this.receipts.length,\n      effectiveNullLaws: structuredClone(this.effectiveNullLaws),\n      counts: Object.fromEntries([...this.experiments].map(([id, experiment]) => [id,\n        Object.fromEntries(experiment.outcomes.map((label, i) => [label, this.countState.get(id)![i]]))])),\n      pending: this.pending === null ? null : structuredClone(this.pending), receipts: structuredClone(this.receipts) };\n  }\n  exportDefinition(): DiscoveryConfig { return structuredClone(this.definition); }\n  exportOptions(): FamilyAdequacyOptions { return { ...this.options }; }\n}\n\n/** Recompute every prediction and body; hash consistency alone is insufficient.\n * A recorded runtime is mandatory for an empty committed prefix. A pending prepare\n * is not an observation receipt and is not restored by this helper. */\nexport function replayFamilyAdequacy(definition: DiscoveryConfig, options: FamilyAdequacyOptions,\n  receipts: AdequacyReceipt[], recordedRuntime?: AdequacyRuntime): FamilyAdequacyMonitor {\n  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');\n  if (recordedRuntime !== undefined || receipts.length === 0) assertAdequacyRuntime(recordedRuntime);\n  for (const receipt of receipts) {\n    if (receipt?.schemaVersion !== ADEQUACY_SCHEMA_VERSION) throw new Error('Adequacy receipt schema mismatch');\n    assertAdequacyRuntime(receipt.runtime);\n  }\n  const monitor = new FamilyAdequacyMonitor(definition, options);\n  for (const receipt of receipts) {\n    const prepared = monitor.prepare(receipt.id, receipt.experimentId);\n    const actual = monitor.observe(prepared, receipt.outcome);\n    if (canonicalJSON(actual) !== canonicalJSON(receipt)) throw new Error(`Adequacy receipt verification failed at sequence ${receipt.sequence}`);\n  }\n  return monitor;\n}\n" }, { "path": "inference/compare.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.\nimport { currentReplayRuntime } from './runtime.ts';\nimport { DiscoverySession } from './session.ts';\nimport type { DiscoveryConfig, EvidenceReceipt, ReplayRuntime } from './types.ts';\n\n/** Both v1 and v2 numerical records can be inspected; hashes are intentionally not trusted here. */\nexport type ComparableReceipt = Pick<EvidenceReceipt,\n  'id' | 'experimentId' | 'outcome' | 'sequence' | 'status' | 'cost' | 'posterior' |\n  'entropyNats' | 'priorPredictiveProbability' | 'priorPredictiveLogProbability'> & {runtime?: ReplayRuntime};\n\nexport interface NumericalComparisonOptions { absoluteTolerance: number; relativeTolerance: number }\n\n/** Recompute given observations and compare numerical fields with caller-declared\n * tolerances. This is explicitly NOT verification of hashes, runtime, source or truth. */\nexport function compareReceiptNumerics(\n  config: DiscoveryConfig, receipts: ComparableReceipt[], options: NumericalComparisonOptions,\n) {\n  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');\n  const {absoluteTolerance, relativeTolerance} = options;\n  for (const value of [absoluteTolerance, relativeTolerance]) {\n    if (!Number.isFinite(value) || value < 0) throw new RangeError('Comparison tolerances must be finite and nonnegative');\n  }\n  const session = new DiscoverySession(config);\n  let comparedNumbers = 0, exactlyEqualNumbers = 0;\n  const differences: Array<{path: string; recorded: number; recomputed: number; absoluteDifference: number; withinTolerance: boolean}> = [];\n  const structuralDifferences: string[] = [];\n  function compareNumber(path: string, recorded: number, recomputed: number) {\n    if (!Number.isFinite(recorded) || !Number.isFinite(recomputed)) {\n      structuralDifferences.push(`${path}: missing or nonfinite number`); return;\n    }\n    comparedNumbers++;\n    if (recorded === recomputed) { exactlyEqualNumbers++; return; }\n    const absoluteDifference = Math.abs(recorded - recomputed);\n    differences.push({path, recorded, recomputed, absoluteDifference,\n      withinTolerance: absoluteDifference <= absoluteTolerance + relativeTolerance * Math.max(Math.abs(recorded), Math.abs(recomputed))});\n  }\n  for (let i = 0; i < receipts.length; i++) {\n    const receipt = receipts[i];\n    const actual = session.observe({id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome});\n    const prefix = `receipts[${i}]`;\n    for (const key of ['sequence', 'status'] as const) {\n      if (receipt[key] !== actual[key]) structuralDifferences.push(`${prefix}.${key}: differs`);\n    }\n    for (const key of ['cost', 'entropyNats', 'priorPredictiveProbability'] as const) compareNumber(`${prefix}.${key}`, receipt[key], actual[key]);\n    if (receipt.priorPredictiveLogProbability === null || actual.priorPredictiveLogProbability === null) {\n      if (receipt.priorPredictiveLogProbability !== actual.priorPredictiveLogProbability) structuralDifferences.push(`${prefix}.priorPredictiveLogProbability: support differs`);\n    } else compareNumber(`${prefix}.priorPredictiveLogProbability`, receipt.priorPredictiveLogProbability, actual.priorPredictiveLogProbability);\n    if (!receipt.posterior || typeof receipt.posterior !== 'object' ||\n        Object.keys(receipt.posterior).length !== Object.keys(actual.posterior).length ||\n        Object.keys(actual.posterior).some(key => !Object.hasOwn(receipt.posterior, key))) {\n      structuralDifferences.push(`${prefix}.posterior: candidate keys differ`);\n    } else {\n      for (const key of Object.keys(actual.posterior)) compareNumber(`${prefix}.posterior.${key}`, receipt.posterior[key], actual.posterior[key]);\n    }\n  }\n  return {\n    mode: 'numerical-comparison' as const, exactReplayVerified: false as const,\n    claim: 'Numerical agreement for these observations and declared tolerances only. Hashes, runtime identity, and the source artifact are not verified.',\n    currentRuntime: currentReplayRuntime(),\n    recordedRuntime: receipts[0]?.runtime ?? null,\n    tolerances: {absoluteTolerance, relativeTolerance}, comparedNumbers, exactlyEqualNumbers,\n    withinTolerance: structuralDifferences.length === 0 && differences.every(difference => difference.withinTolerance),\n    differences, structuralDifferences,\n  };\n}\n" }, { "path": "inference/index.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nexport * from './types.ts';\nexport { DiscoverySession, entropy, canonicalJSON, hashJSON, replaySession, validateDiscoveryIdentifier, DISCOVERY_MAX_IDENTIFIER_LENGTH } from './session.ts';\nexport * from './runtime.ts';\nexport { compareReceiptNumerics } from './compare.ts';\nexport type { ComparableReceipt, NumericalComparisonOptions } from './compare.ts';\nexport * from './adequacy.ts';\n" }, { "path": "inference/runtime.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.\nimport { endianness } from 'node:os';\nimport type { ReplayRuntime } from './types.ts';\n\n/** Validated reference runtime for recorded evidence; not an execution-version pin. */\nexport const VALIDATED_NODE_VERSION = '24.19.0';\nexport const RECEIPT_SCHEMA_VERSION = 2 as const;\n\n/** Runtime context, not proof of identical hardware, binary build or source bytes.\n * Exact replay also requires the same implementation artifact and matching receipts. */\nexport function currentReplayRuntime(): ReplayRuntime {\n  return {\n    implementation: '@cosmic/commons-discovery/0.2.1',\n    node: process.versions.node,\n    v8: process.versions.v8,\n    platform: process.platform,\n    architecture: process.arch,\n    endianness: endianness(),\n    numericalModel: 'binary64-native-math',\n  };\n}\n\nexport class ReplayRuntimeError extends Error {\n  readonly code: 'MISSING_REPLAY_RUNTIME' | 'REPLAY_RUNTIME_MISMATCH';\n  constructor(code: ReplayRuntimeError['code'], message: string) {\n    super(message);\n    this.name = 'ReplayRuntimeError';\n    this.code = code;\n  }\n}\n\n/** Reject absent/changed runtime context before any receipt is replayed. */\nexport function assertReplayRuntime(recorded: ReplayRuntime | undefined): void {\n  const actual = currentReplayRuntime();\n  const keys = Object.keys(actual) as Array<keyof ReplayRuntime>;\n  if (!recorded || keys.some(key => typeof recorded[key] !== 'string' || !recorded[key])) {\n    throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME',\n      'Receipt has no complete runtime contract. Legacy receipts require explicit numerical comparison; they cannot receive v2 exact verification.');\n  }\n  const differences = keys.filter(key => recorded[key] !== actual[key]);\n  if (differences.length) {\n    throw new ReplayRuntimeError('REPLAY_RUNTIME_MISMATCH',\n      'Exact replay runtime mismatch: ' + differences.map(key => `${key}: recorded=${recorded[key]}, current=${actual[key]}`).join('; ') +\n      '. Use the recorded runtime and source artifact, or request numerical comparison without byte verification.');\n  }\n}\n" }, { "path": "inference/session.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.\nimport { createHash } from 'node:crypto';\nimport { assertReplayRuntime, currentReplayRuntime, RECEIPT_SCHEMA_VERSION, ReplayRuntimeError } from './runtime.ts';\nimport type {\n  DecisionAction, DiscoveryConfig, DiscoverySnapshot, EvidenceReceipt,\n  Experiment, ExperimentUtility, Observation, Recommendation, ReplayRuntime,\n} from './types.ts';\n\n/** Deterministic finite JSON encoding for receipts. No timestamps or global counters. */\nexport function canonicalJSON(value: unknown): string {\n  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);\n  if (typeof value === 'number') {\n    if (!Number.isFinite(value)) throw new Error('Receipt numbers must be finite');\n    return JSON.stringify(value);\n  }\n  if (Array.isArray(value)) {\n    for (let i = 0; i < value.length; i++) {\n      if (!Object.hasOwn(value, i)) throw new Error('Receipts require dense arrays');\n    }\n    return '[' + value.map(canonicalJSON).join(',') + ']';\n  }\n  if (typeof value === 'object' && value !== null) {\n    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {\n      throw new Error('Receipts require plain objects');\n    }\n    const record = value as Record<string, unknown>;\n    // Like JSON.stringify, absent optional object properties have no wire value.\n    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(record[key])).join(',') + '}';\n  }\n  throw new Error('Unsupported receipt value');\n}\n\nexport function hashJSON(value: unknown): string {\n  return createHash('sha256').update(canonicalJSON(value)).digest('hex');\n}\n\nexport const DISCOVERY_MAX_IDENTIFIER_LENGTH = 256;\nexport function validateDiscoveryIdentifier(value: unknown, name: string): asserts value is string {\n  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonempty string`);\n  if(value.length>DISCOVERY_MAX_IDENTIFIER_LENGTH) throw new RangeError(`DISCOVERY_IDENTIFIER_LIMIT: ${name} exceeds ${DISCOVERY_MAX_IDENTIFIER_LENGTH} UTF-16 code units`);\n}\nconst identifier:typeof validateDiscoveryIdentifier=validateDiscoveryIdentifier;\nfunction probability(value: unknown, name: string): asserts value is number {\n  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {\n    throw new Error(`${name} must be a probability in [0,1]`);\n  }\n}\nfunction assertKeys(record: Record<string, unknown>, keys: string[], name: string): void {\n  if (!record || typeof record !== 'object' || Array.isArray(record) ||\n      Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) {\n    throw new Error(`${name} must contain exactly the declared keys`);\n  }\n}\n\nexport function entropy(probabilities: number[]): number {\n  const result = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);\n  return result === 0 ? 0 : result;\n}\n\n// Costs are exact decimal quantities in their JavaScript number's shortest decimal\n// representation. Integer accounting avoids .3 - .1 - .1 incorrectly rejecting .1.\nfunction decimalParts(value: number): { coefficient: bigint; scale: number } {\n  const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e');\n  const [whole, fraction = ''] = mantissa.split('.');\n  return {coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent)};\n}\n\nfunction decimalNumber(units: bigint, scale: number): number {\n  return Number(`${units.toString()}e${-scale}`);\n}\n\n/**\n * Exact Bayes over a declared discrete model family. This does not discover arbitrary\n * structural graphs or prove the family contains the truth. Experiment utility is a\n * greedy one-step mutual-information/cost criterion, not globally optimal planning.\n */\nexport class DiscoverySession {\n  private readonly definition: DiscoveryConfig;\n  private readonly definitionHash: string;\n  private readonly runtime = currentReplayRuntime();\n  private readonly chainAnchorHash: string;\n  private readonly experiments: Map<string, Experiment>;\n  private logWeights: number[];\n  private readonly ids: string[];\n  private readonly costScale: number;\n  private readonly budgetUnits: bigint;\n  private readonly costUnits: Map<string, bigint>;\n  private spentUnits = 0n;\n  private mismatch = false;\n  private readonly receipts: EvidenceReceipt[] = [];\n  private readonly evidenceIds = new Set<string>();\n\n  constructor(config: DiscoveryConfig) {\n    identifier(config.modelId, 'modelId');\n    if (config.observationAssumption !== 'conditionally-independent-given-hypothesis-and-experiment') {\n      throw new Error('Declare the conditional independence assumption explicitly');\n    }\n    if (!Number.isFinite(config.budget) || config.budget < 0) throw new Error('budget must be finite and nonnegative');\n    if (!Array.isArray(config.hypotheses) || config.hypotheses.length < 2) throw new Error('At least two hypotheses are required');\n    this.ids = config.hypotheses.map(h => {identifier(h.id, 'hypothesis id'); probability(h.prior, 'prior'); return h.id;});\n    if (new Set(this.ids).size !== this.ids.length) throw new Error('Hypothesis ids must be unique');\n    const total = config.hypotheses.reduce((sum, h) => sum + h.prior, 0);\n    if (Math.abs(total - 1) > 1e-12) throw new Error('Prior probabilities must sum to one');\n    if (!Array.isArray(config.experiments) || config.experiments.length === 0) throw new Error('At least one experiment is required');\n    const experimentIds = new Set<string>();\n    for (const experiment of config.experiments) {\n      identifier(experiment.id, 'experiment id');\n      if (experimentIds.has(experiment.id)) throw new Error('Experiment ids must be unique');\n      experimentIds.add(experiment.id);\n      if (!Number.isFinite(experiment.cost) || experiment.cost <= 0) throw new Error('Experiment cost must be finite and positive');\n      if (!Number.isFinite(Math.log(this.ids.length) / experiment.cost)) throw new Error('Experiment cost is too small to represent finite information per cost');\n      if (!Array.isArray(experiment.outcomes) || experiment.outcomes.length < 2) throw new Error('Declare at least two outcomes');\n      experiment.outcomes.forEach(outcome => identifier(outcome, 'outcome'));\n      if (new Set(experiment.outcomes).size !== experiment.outcomes.length) throw new Error('Outcomes must be unique');\n      assertKeys(experiment.likelihoods, this.ids, 'Likelihood table');\n      for (const id of this.ids) {\n        const row = experiment.likelihoods[id];\n        assertKeys(row, experiment.outcomes, 'Likelihood row');\n        const sum = experiment.outcomes.reduce((s, outcome) => {probability(row[outcome], 'likelihood'); return s + row[outcome];}, 0);\n        if (Math.abs(sum - 1) > 1e-12) throw new Error('Each likelihood row must sum to one');\n      }\n    }\n    if (config.stopProbability !== undefined) {\n      probability(config.stopProbability, 'stopProbability');\n      if (config.stopProbability <= 0.5) throw new Error('stopProbability must be greater than 0.5');\n    }\n    if (config.minInformationGainNats !== undefined && (!Number.isFinite(config.minInformationGainNats) || config.minInformationGainNats < 0)) {\n      throw new Error('minInformationGainNats must be finite and nonnegative');\n    }\n    // Copy the caller's inputs; later mutation cannot rewrite evidence or likelihoods.\n    this.definition = structuredClone(config);\n    this.definitionHash = hashJSON(this.definition);\n    this.chainAnchorHash = hashJSON({schemaVersion: RECEIPT_SCHEMA_VERSION, definitionHash: this.definitionHash, runtime: this.runtime});\n    this.experiments = new Map(this.definition.experiments.map(experiment => [experiment.id, experiment]));\n    const budgetParts = decimalParts(config.budget);\n    const costs = this.definition.experiments.map(experiment => ({id: experiment.id, ...decimalParts(experiment.cost)}));\n    this.costScale = Math.max(budgetParts.scale, ...costs.map(cost => cost.scale));\n    this.budgetUnits = budgetParts.coefficient * 10n ** BigInt(this.costScale - budgetParts.scale);\n    this.costUnits = new Map(costs.map(cost => [cost.id, cost.coefficient * 10n ** BigInt(this.costScale - cost.scale)]));\n    this.logWeights = this.definition.hypotheses.map(h => h.prior === 0 ? -Infinity : Math.log(h.prior / total));\n  }\n\n  private probabilities(): number[] {\n    const peak = Math.max(...this.logWeights);\n    const weights = this.logWeights.map(weight => Math.exp(weight - peak));\n    const total = weights.reduce((sum, weight) => sum + weight, 0);\n    return weights.map(weight => weight / total);\n  }\n\n  posterior(): Record<string, number> {\n    const probabilities = this.probabilities();\n    return Object.fromEntries(this.ids.map((id, index) => [id, probabilities[index]]));\n  }\n\n  remainingBudget(): number { return decimalNumber(this.budgetUnits - this.spentUnits, this.costScale); }\n\n  canAfford(experimentId: string): boolean {\n    const cost = this.costUnits.get(experimentId);\n    if (cost === undefined) throw new Error('Unknown experiment');\n    return cost <= this.budgetUnits - this.spentUnits;\n  }\n\n  experimentUtilities(): ExperimentUtility[] {\n    const weights = this.probabilities();\n    return Array.from(this.experiments.values(), experiment => {\n      const predictiveOutcomes = Object.fromEntries(experiment.outcomes.map(outcome => [outcome,\n        this.ids.reduce((sum, id, index) => sum + weights[index] * experiment.likelihoods[id][outcome], 0),\n      ]));\n      let gain = 0;\n      for (let i = 0; i < this.ids.length; i++) {\n        if (weights[i] === 0) continue;\n        for (const outcome of experiment.outcomes) {\n          const likelihood = experiment.likelihoods[this.ids[i]][outcome];\n          if (likelihood > 0 && predictiveOutcomes[outcome] > 0) {\n            gain += weights[i] * likelihood * (Math.log(likelihood) - Math.log(predictiveOutcomes[outcome]));\n          }\n        }\n      }\n      gain = Math.max(0, gain); // Roundoff at an exactly uninformative experiment.\n      return {experimentId: experiment.id, cost: experiment.cost, expectedInformationGainNats: gain,\n        informationGainPerCost: gain / experiment.cost, predictiveOutcomes};\n    });\n  }\n\n  recommend(): Recommendation {\n    if (this.mismatch) return {status: 'stop', reason: 'model-mismatch'};\n    if (this.definition.stopProbability !== undefined && Math.max(...this.probabilities()) >= this.definition.stopProbability) {\n      return {status: 'stop', reason: 'posterior-threshold'};\n    }\n    const affordable = this.experimentUtilities().filter(experiment => this.canAfford(experiment.experimentId));\n    if (affordable.length === 0) return {status: 'stop', reason: 'budget-exhausted'};\n    const eligible = affordable.filter(experiment => experiment.expectedInformationGainNats > (this.definition.minInformationGainNats ?? 1e-12));\n    if (eligible.length === 0) return {status: 'stop', reason: 'no-informative-experiment'};\n    eligible.sort((a, b) => b.informationGainPerCost - a.informationGainPerCost ||\n      b.expectedInformationGainNats - a.expectedInformationGainNats ||\n      (a.experimentId < b.experimentId ? -1 : a.experimentId > b.experimentId ? 1 : 0));\n    return {status: 'experiment', ...eligible[0]};\n  }\n\n  observe(observation: Observation): EvidenceReceipt {\n    identifier(observation.id, 'observation id');\n    if (this.mismatch) throw new Error('Session stopped after model mismatch');\n    if (this.evidenceIds.has(observation.id)) throw new Error('Duplicate observation id: evidence cannot be counted twice');\n    const experiment = this.experiments.get(observation.experimentId);\n    if (!experiment) throw new Error('Unknown experiment');\n    if (!experiment.outcomes.includes(observation.outcome)) throw new Error('Outcome is outside the declared observation alphabet');\n    if (!this.canAfford(experiment.id)) throw new Error('Experiment exceeds remaining budget');\n    const nextWeights = this.logWeights.map((weight, i) => {\n      const likelihood = experiment.likelihoods[this.ids[i]][observation.outcome];\n      return likelihood > 0 ? weight + Math.log(likelihood) : -Infinity;\n    });\n    const weights = this.probabilities();\n    const predictive = this.ids.reduce((sum, id, i) => sum + weights[i] * experiment.likelihoods[id][observation.outcome], 0);\n    // Use log support, not an underflowed displayed probability, for impossibility.\n    this.mismatch = nextWeights.every(weight => weight === -Infinity);\n    let predictiveLogProbability: number | null = null;\n    if (!this.mismatch) {\n      const peak = Math.max(...nextWeights);\n      const logTotal = peak + Math.log(nextWeights.reduce((sum, value) => sum + Math.exp(value - peak), 0));\n      predictiveLogProbability = logTotal;\n      this.logWeights = nextWeights.map(value => value - logTotal);\n    }\n    this.spentUnits += this.costUnits.get(experiment.id)!;\n    this.evidenceIds.add(observation.id);\n    const body = {\n      schemaVersion: RECEIPT_SCHEMA_VERSION, runtime: {...this.runtime},\n      id: observation.id, experimentId: observation.experimentId, outcome: observation.outcome,\n      sequence: this.receipts.length + 1, status: this.mismatch ? 'model-mismatch' as const : 'updated' as const,\n      cost: experiment.cost, priorPredictiveProbability: predictive, posterior: this.posterior(),\n      priorPredictiveLogProbability: predictiveLogProbability,\n      entropyNats: entropy(this.probabilities()), previousHash: this.receipts.at(-1)?.hash ?? this.chainAnchorHash,\n    };\n    const receipt = {...body, hash: hashJSON(body)};\n    this.receipts.push(receipt);\n    return structuredClone(receipt);\n  }\n\n  /** Rank caller-defined actions by posterior expected loss; include abstention as an action if needed. */\n  chooseAction(actions: DecisionAction[]): {actionId: string; expectedLoss: number; alternatives: Array<{actionId: string; expectedLoss: number}>} {\n    if (this.mismatch) throw new Error('Cannot recommend an action after model mismatch');\n    if (!actions.length) throw new Error('At least one action is required');\n    const ids = new Set<string>();\n    const posterior = this.posterior();\n    const alternatives = actions.map(action => {\n      identifier(action.id, 'action id');\n      if (ids.has(action.id)) throw new Error('Action ids must be unique');\n      ids.add(action.id);\n      assertKeys(action.losses, this.ids, 'Action losses');\n      if (Object.values(action.losses).some(loss => !Number.isFinite(loss))) throw new Error('Action losses must be finite');\n      const expectedLoss = this.ids.reduce((sum, id) => sum + posterior[id] * action.losses[id], 0);\n      if (!Number.isFinite(expectedLoss)) throw new Error('Expected loss exceeded the finite numerical range');\n      return {actionId: action.id, expectedLoss};\n    }).sort((a, b) => a.expectedLoss - b.expectedLoss || (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));\n    return {...alternatives[0], alternatives};\n  }\n\n  snapshot(): DiscoverySnapshot {\n    return {schemaVersion: RECEIPT_SCHEMA_VERSION, runtime: {...this.runtime}, chainAnchorHash: this.chainAnchorHash,\n      modelId: this.definition.modelId, definitionHash: this.definitionHash,\n      observationAssumption: this.definition.observationAssumption,\n      probabilitySemantics: 'posterior-within-declared-candidate-family', posterior: this.posterior(),\n      entropyNats: entropy(this.probabilities()), spent: decimalNumber(this.spentUnits, this.costScale), remainingBudget: this.remainingBudget(),\n      modelMismatch: this.mismatch, receipts: structuredClone(this.receipts)};\n  }\n\n  /** Export the exact declaration needed to reproduce this numerical receipt chain. */\n  exportDefinition(): DiscoveryConfig { return structuredClone(this.definition); }\n}\n\n/** Exact v2 replay only. Runtime compatibility is necessary, not sufficient:\n * every body and hash is still recomputed; no float rounding/tolerance is applied. */\nexport function replaySession(config: DiscoveryConfig, receipts: EvidenceReceipt[], recordedRuntime?: ReplayRuntime): DiscoverySession {\n  if (!Array.isArray(receipts)) throw new Error('Receipts must be an array');\n  // Empty sessions have no first receipt from which to recover their runtime.\n  if (recordedRuntime !== undefined || receipts.length === 0) assertReplayRuntime(recordedRuntime);\n  for (const receipt of receipts) {\n    if (receipt?.schemaVersion !== RECEIPT_SCHEMA_VERSION) {\n      throw new ReplayRuntimeError('MISSING_REPLAY_RUNTIME',\n        'Exact replay requires v2 receipts with a recorded runtime. Legacy receipts may only be compared numerically.');\n    }\n    assertReplayRuntime(receipt.runtime);\n  }\n  const session = new DiscoverySession(config);\n  for (const receipt of receipts) {\n    const actual = session.observe({id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome});\n    if (canonicalJSON(actual) !== canonicalJSON(receipt)) throw new Error(`Receipt verification failed at sequence ${receipt.sequence}`);\n  }\n  return session;\n}\n" }, { "path": "inference/types.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\n// Modified for COSMIC Commons; origin and changes: provenance/RELEASE-SELECTION.json.\n/** Posterior probabilities are conditional on the explicit finite family;\n * a zero declared prior excludes the hypothesis from posterior support and adequacy. */\nexport interface Hypothesis {\n  id: string;\n  prior: number;\n}\n\n/** A row P(outcome | hypothesis, experiment). Outcomes are mutually exclusive. */\nexport interface Experiment {\n  id: string;\n  cost: number;\n  outcomes: string[];\n  likelihoods: Record<string, Record<string, number>>;\n}\n\nexport interface DiscoveryConfig {\n  modelId: string;\n  hypotheses: Hypothesis[];\n  experiments: Experiment[];\n  budget: number;\n  /** Required declaration; repeated observations must satisfy this assumption. */\n  observationAssumption: 'conditionally-independent-given-hypothesis-and-experiment';\n  /** Optional policy, not an empirical calibration guarantee. */\n  stopProbability?: number;\n  minInformationGainNats?: number;\n}\n\nexport interface ExperimentUtility {\n  experimentId: string;\n  cost: number;\n  expectedInformationGainNats: number;\n  informationGainPerCost: number;\n  predictiveOutcomes: Record<string, number>;\n}\n\nexport type Recommendation =\n  | ({ status: 'experiment' } & ExperimentUtility)\n  | { status: 'stop'; reason: 'budget-exhausted' | 'posterior-threshold' | 'no-informative-experiment' | 'model-mismatch' };\n\nexport interface Observation {\n  id: string;\n  experimentId: string;\n  outcome: string;\n}\n\nexport interface ReplayRuntime {\n  implementation: '@cosmic/commons-discovery/0.2.1';\n  node: string;\n  v8: string;\n  platform: string;\n  architecture: string;\n  endianness: 'LE' | 'BE';\n  numericalModel: 'binary64-native-math';\n}\n\nexport interface EvidenceReceipt extends Observation {\n  schemaVersion: 2;\n  runtime: ReplayRuntime;\n  sequence: number;\n  status: 'updated' | 'model-mismatch';\n  cost: number;\n  priorPredictiveProbability: number;\n  /** null only for an outcome impossible under every supported candidate. */\n  priorPredictiveLogProbability: number | null;\n  posterior: Record<string, number>;\n  entropyNats: number;\n  previousHash: string;\n  hash: string;\n}\n\nexport interface DiscoverySnapshot {\n  schemaVersion: 2;\n  runtime: ReplayRuntime;\n  /** Hash of schema version, definition hash and runtime; anchors the first receipt. */\n  chainAnchorHash: string;\n  modelId: string;\n  definitionHash: string;\n  observationAssumption: DiscoveryConfig['observationAssumption'];\n  probabilitySemantics: 'posterior-within-declared-candidate-family';\n  posterior: Record<string, number>;\n  entropyNats: number;\n  spent: number;\n  remainingBudget: number;\n  modelMismatch: boolean;\n  receipts: EvidenceReceipt[];\n}\n\nexport interface DecisionAction {\n  id: string;\n  /** Caller-specified loss under each hypothesis, in a consistent unit. */\n  losses: Record<string, number>;\n}\n" }, { "path": "package-root.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { dirname, basename, resolve, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\n// Keep assets in one place for both the source tree and the shipped dist/src tree.\nconst moduleDirectory = dirname(fileURLToPath(import.meta.url));\nexport const packageRoot = resolve(moduleDirectory, basename(dirname(moduleDirectory)) === 'dist' ? '../..' : '..');\nexport const packagePath = (...parts: string[]): string => join(packageRoot, ...parts);\n" }, { "path": "policy.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { canonicalize, timestamp } from './canonical.ts';\nimport type { JsonValue } from './canonical.ts';\nimport { exactKeys, inspectEvidence, requiredId } from './evidence.ts';\nimport type { EvidenceBundle, EvidenceReport } from './evidence.ts';\n\nexport type PredicateOperator = 'exists' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';\nexport interface PolicyRule { id: string; factId: string; op: PredicateOperator; value?: JsonValue }\n/** All listed rules are requirements. No executable expressions or implicit conversions. */\nexport interface Policy { id: string; version: string; rules: PolicyRule[] }\nexport type Verdict = 'ALLOW' | 'DENY' | 'DEFER' | 'ERROR';\nexport interface RuleTrace {\n  ruleId: string;\n  factId: string;\n  result: 'PASS' | 'FAIL' | 'DEFER' | 'ERROR';\n  code: string;\n  actual?: JsonValue;\n  expected?: JsonValue;\n  reasons?: string[];\n}\nexport interface PolicyReport {\n  schema: 'cosmic.policy-report.v1';\n  policyId: string | null;\n  policyVersion: string | null;\n  asOf: string;\n  verdict: Verdict;\n  trace: RuleTrace[];\n  errors: { code: string; message: string }[];\n  evidence?: EvidenceReport;\n}\n\nexport function validatePolicy(value: unknown): asserts value is Policy {\n  canonicalize(value);\n  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Policy must be an object');\n  const policy = value as Record<string, unknown>;\n  exactKeys(policy, ['id', 'version', 'rules'], 'policy');\n  requiredId(policy.id, 'policy.id'); requiredId(policy.version, 'policy.version');\n  if (!Array.isArray(policy.rules) || policy.rules.length < 1 || policy.rules.length > 1000) throw new TypeError('Policy must contain between 1 and 1000 rules');\n  const ids = new Set<string>();\n  for (const item of policy.rules) {\n    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Rule must be an object');\n    const rule = item as Record<string, unknown>;\n    exactKeys(rule, ['id', 'factId', 'op', 'value'], 'rule');\n    requiredId(rule.id, 'rule.id'); requiredId(rule.factId, 'rule.factId');\n    if (ids.has(rule.id)) throw new TypeError(`Duplicate rule id: ${rule.id}`);\n    ids.add(rule.id);\n    if (!['exists', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'].includes(rule.op as string)) throw new TypeError('Unsupported rule operator');\n    if (rule.op === 'exists') {\n      if (Object.hasOwn(rule, 'value')) throw new TypeError('exists must not declare value');\n    } else if (!Object.hasOwn(rule, 'value')) throw new TypeError('Comparison rule requires value');\n    if (['gt', 'gte', 'lt', 'lte'].includes(rule.op as string) && typeof rule.value !== 'number') throw new TypeError('Ordered comparison requires numeric value');\n    if (rule.op === 'in' && (!Array.isArray(rule.value) || rule.value.length === 0)) throw new TypeError('in requires a nonempty array');\n  }\n}\n\nfunction compare(actual: JsonValue, op: PredicateOperator, expected?: JsonValue): boolean {\n  if (op === 'exists') return true;\n  if (op === 'eq') return canonicalize(actual) === canonicalize(expected);\n  if (op === 'ne') return canonicalize(actual) !== canonicalize(expected);\n  if (op === 'in') return (expected as JsonValue[]).some((item) => canonicalize(actual) === canonicalize(item));\n  if (typeof actual !== 'number' || typeof expected !== 'number') throw new TypeError('Ordered comparison requires a numeric fact and threshold');\n  switch (op) {\n    case 'gt': return actual > expected;\n    case 'gte': return actual >= expected;\n    case 'lt': return actual < expected;\n    case 'lte': return actual <= expected;\n  }\n}\n\n/** Precedence: ERROR > DENY > DEFER > ALLOW. A failed requirement proves denial even when another is unknown. */\nexport function evaluatePolicy(policy: Policy, bundle: EvidenceBundle, asOf: string): PolicyReport {\n  const report: PolicyReport = {\n    schema: 'cosmic.policy-report.v1', policyId: null, policyVersion: null, asOf,\n    verdict: 'ERROR', trace: [], errors: [],\n  };\n  try { timestamp(asOf, 'asOf'); validatePolicy(policy); }\n  catch (error) {\n    report.errors.push({ code: 'MALFORMED_INPUT', message: error instanceof Error ? error.message : 'Malformed policy input' });\n    return report;\n  }\n  report.policyId = policy.id; report.policyVersion = policy.version;\n  const evidence = inspectEvidence(bundle, asOf);\n  report.evidence = evidence;\n  if (!evidence.valid) {\n    report.errors = evidence.issues.filter((item) => item.severity === 'ERROR').map((item) => ({ code: item.code, message: item.message }));\n    return report;\n  }\n  const facts = new Map(bundle.facts.map((fact) => [fact.id, fact]));\n  const states = new Map(evidence.facts.map((fact) => [fact.id, fact]));\n  for (const rule of policy.rules) {\n    const trace: RuleTrace = { ruleId: rule.id, factId: rule.factId, result: 'DEFER', code: 'MISSING_FACT' };\n    if (Object.hasOwn(rule, 'value')) trace.expected = rule.value!;\n    const fact = facts.get(rule.factId);\n    const state = states.get(rule.factId);\n    if (fact && state) {\n      trace.actual = fact.value;\n      if (state.status !== 'AVAILABLE') {\n        trace.code = `EVIDENCE_${state.status}`;\n        trace.reasons = state.reasons;\n      } else {\n        try {\n          const passed = compare(fact.value, rule.op, rule.value);\n          trace.result = passed ? 'PASS' : 'FAIL';\n          trace.code = passed ? 'REQUIREMENT_SATISFIED' : 'REQUIREMENT_FAILED';\n        } catch (error) {\n          trace.result = 'ERROR'; trace.code = 'TYPE_MISMATCH';\n          report.errors.push({ code: 'TYPE_MISMATCH', message: `Rule ${rule.id}: ${error instanceof Error ? error.message : 'Type mismatch'}` });\n        }\n      }\n    }\n    report.trace.push(trace);\n  }\n  report.verdict = report.trace.some((rule) => rule.result === 'ERROR') ? 'ERROR'\n    : report.trace.some((rule) => rule.result === 'FAIL') ? 'DENY'\n    : report.trace.some((rule) => rule.result === 'DEFER') ? 'DEFER' : 'ALLOW';\n  return report;\n}\n\nexport interface ThresholdSensitivityInput { lower: number; upper: number; op: 'gt' | 'gte' | 'lt' | 'lte'; threshold: number }\nexport interface ThresholdSensitivityReport extends ThresholdSensitivityInput {\n  classification: 'ALWAYS_PASS' | 'ALWAYS_FAIL' | 'SENSITIVE';\n  lowerPass: boolean;\n  upperPass: boolean;\n}\n/** Exact interval endpoint analysis for one monotone threshold predicate; not a probability. */\nexport function thresholdSensitivity(input: ThresholdSensitivityInput): ThresholdSensitivityReport {\n  canonicalize(input);\n  exactKeys(input as unknown as Record<string, unknown>, ['lower', 'upper', 'op', 'threshold'], 'sensitivity');\n  if (![input.lower, input.upper, input.threshold].every((value) => typeof value === 'number' && Number.isFinite(value))) throw new TypeError('Sensitivity endpoints and threshold must be finite numbers');\n  if (input.lower > input.upper) throw new TypeError('lower must not exceed upper');\n  if (!['gt', 'gte', 'lt', 'lte'].includes(input.op)) throw new TypeError('Sensitivity requires a monotone numeric operator');\n  const lowerPass = compare(input.lower, input.op, input.threshold);\n  const upperPass = compare(input.upper, input.op, input.threshold);\n  return { ...input, lowerPass, upperPass, classification: lowerPass === upperPass ? lowerPass ? 'ALWAYS_PASS' : 'ALWAYS_FAIL' : 'SENSITIVE' };\n}\n" }, { "path": "receipt.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { policyImplementation } from './runtime.ts';\nimport { canonicalize, jsonClone, sha256, timestamp, assertReceiptTextLimit } from './canonical.ts';\nimport { parseStrictJson, StrictJsonError } from './strict-json.ts';\nimport { exactKeys, requiredId } from './evidence.ts';\nimport type { EvidenceBundle } from './evidence.ts';\nimport { evaluatePolicy, validatePolicy } from './policy.ts';\nimport type { Policy, PolicyReport } from './policy.ts';\n\nexport interface ReceiptEnvironment { implementation: string; runtime: string; platform: string; arch: string }\nexport interface ReceiptInput { policy: Policy; evidence: EvidenceBundle; asOf: string; environment: ReceiptEnvironment }\nexport interface ReceiptPayload { schema: 'cosmic.policy-receipt.v1'; input: ReceiptInput; report: PolicyReport }\nexport interface PolicyReceipt { payload: ReceiptPayload; digest: string }\nexport interface ReceiptVerification {\n  valid: boolean;\n  integrity: 'VALID' | 'INVALID' | 'NOT_CHECKED';\n  replay: 'MATCH' | 'MISMATCH' | 'UNSUPPORTED' | 'NOT_RUN';\n  integrityValid: boolean;\n  replayValid: boolean;\n  anchoring: 'ANCHORED' | 'UNANCHORED' | 'MISMATCH';\n  environmentMatches: boolean | null;\n  authenticity: 'NOT_ESTABLISHED';\n  issues: string[];\n  replayedReport?: PolicyReport;\n}\nexport interface ReceiptVerificationOptions { trustedDigest?: string; expectedEnvironment?: ReceiptEnvironment }\n\nexport function captureEnvironment(): ReceiptEnvironment {\n  return { implementation: policyImplementation(), runtime: `node/${process.versions.node}`, platform: process.platform, arch: process.arch };\n}\n\nfunction validateEnvironment(value: unknown): asserts value is ReceiptEnvironment {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('environment must be an object');\n  const environment = value as Record<string, unknown>;\n  exactKeys(environment, ['implementation', 'runtime', 'platform', 'arch'], 'environment');\n  for (const key of ['implementation', 'runtime', 'platform', 'arch']) requiredId(environment[key], `environment.${key}`);\n}\n\nfunction validateInput(value: unknown): asserts value is ReceiptInput {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('receipt input must be an object');\n  const input = value as Record<string, unknown>;\n  exactKeys(input, ['policy', 'evidence', 'asOf', 'environment'], 'receipt input');\n  timestamp(input.asOf, 'asOf'); validatePolicy(input.policy); validateEnvironment(input.environment);\n  if (!Object.hasOwn(input, 'evidence')) throw new TypeError('receipt evidence is required');\n}\n\n/** A receipt binds the declared input and recomputable output. It does not certify facts or authorship. */\nexport function createReceipt(input: ReceiptInput): PolicyReceipt {\n  const copy = jsonClone(input);\n  validateInput(copy);\n  const report = evaluatePolicy(copy.policy, copy.evidence, copy.asOf);\n  const payload: ReceiptPayload = { schema: 'cosmic.policy-receipt.v1', input: copy, report };\n  const receipt={ payload, digest: sha256(payload) };\n  assertReceiptTextLimit(receipt);\n  return receipt;\n}\n\n/**\n * Object-only API: use verifyReceiptText for external JSON. trustedDigest must come\n * from an independently trusted channel. Exact replay always requires the current\n * environment; expectedEnvironment adds a caller constraint and cannot override it.\n */\nexport function verifyReceipt(receipt: unknown, options: ReceiptVerificationOptions = {}): ReceiptVerification {\n  const result: ReceiptVerification = {\n    valid: false, integrity: 'NOT_CHECKED', replay: 'NOT_RUN', integrityValid: false, replayValid: false, anchoring: options.trustedDigest===undefined?'UNANCHORED':'MISMATCH',\n    environmentMatches: null, authenticity: 'NOT_ESTABLISHED', issues: [],\n  };\n  try {\n    canonicalize(options);\n    exactKeys(options as Record<string, unknown>, ['trustedDigest', 'expectedEnvironment'], 'verification options');\n    if (options.trustedDigest !== undefined && (typeof options.trustedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(options.trustedDigest))) throw new TypeError('trustedDigest must be lowercase SHA-256 hex');\n    if (options.expectedEnvironment !== undefined) validateEnvironment(options.expectedEnvironment);\n    canonicalize(receipt);\n    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new TypeError('receipt must be an object');\n    const envelope = receipt as Record<string, unknown>;\n    exactKeys(envelope, ['payload', 'digest'], 'receipt');\n    if (typeof envelope.digest !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.digest)) throw new TypeError('receipt digest must be lowercase SHA-256 hex');\n    const payload = envelope.payload;\n    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('payload must be an object');\n    exactKeys(payload as Record<string, unknown>, ['schema', 'input', 'report'], 'receipt payload');\n    const candidate = payload as ReceiptPayload;\n    if (candidate.schema !== 'cosmic.policy-receipt.v1') throw new TypeError('Unsupported receipt schema');\n    validateInput(candidate.input);\n    const computedDigest = sha256(payload);\n    result.integrityValid = computedDigest === envelope.digest;\n    result.integrity = result.integrityValid ? 'VALID' : 'INVALID';\n    if (!result.integrityValid) result.issues.push('DIGEST_MISMATCH');\n    if (options.trustedDigest !== undefined) {\n      result.anchoring = computedDigest === options.trustedDigest && envelope.digest === options.trustedDigest ? 'ANCHORED' : 'MISMATCH';\n      if (result.anchoring === 'MISMATCH') result.issues.push('TRUSTED_DIGEST_MISMATCH');\n    } else result.issues.push('UNANCHORED_SELF_CONSISTENCY_ONLY');\n    const declaredEnvironment = canonicalize(candidate.input.environment);\n    const currentEnvironmentMatches = declaredEnvironment === canonicalize(captureEnvironment());\n    const expectedEnvironmentMatches = options.expectedEnvironment === undefined || declaredEnvironment === canonicalize(options.expectedEnvironment);\n    result.environmentMatches = currentEnvironmentMatches && expectedEnvironmentMatches;\n    if (!result.environmentMatches) result.issues.push('ENVIRONMENT_MISMATCH');\n    if (!currentEnvironmentMatches) {\n      result.replay = 'UNSUPPORTED';\n      result.issues.push('UNSUPPORTED_ENVIRONMENT');\n      return result;\n    }\n    const replayed = evaluatePolicy(candidate.input.policy, candidate.input.evidence, candidate.input.asOf);\n    result.replayedReport = replayed;\n    result.replayValid = canonicalize(replayed) === canonicalize(candidate.report);\n    result.replay = result.replayValid ? 'MATCH' : 'MISMATCH';\n    if (!result.replayValid) result.issues.push('REPLAY_MISMATCH');\n    result.valid = result.integrityValid && result.replayValid && result.anchoring !== 'MISMATCH' && result.environmentMatches !== false;\n  } catch (error) {\n    result.valid = false;\n    result.issues.push(`MALFORMED_RECEIPT:${error instanceof Error ? error.message : 'unknown error'}`);\n  }\n  return result;\n}\n\n/** Safe text entrypoint for policy receipts, before any canonicalization. */\nexport function verifyReceiptText(raw:string,options:ReceiptVerificationOptions = {}):ReceiptVerification {\n  try { return verifyReceipt(parseStrictJson(raw),options); }\n  catch(error) {\n    return {valid:false,integrity:'NOT_CHECKED',replay:'NOT_RUN',integrityValid:false,replayValid:false,anchoring:options.trustedDigest===undefined?'UNANCHORED':'MISMATCH',environmentMatches:null,authenticity:'NOT_ESTABLISHED',\n      issues:[error instanceof StrictJsonError?error.code:'MALFORMED_RECEIPT',error instanceof Error?error.message:String(error)]};\n  }\n}\n" }, { "path": "run.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { canonicalize, sha256, CANONICAL_MAX_NODES, CANONICAL_MAX_BYTES, assertReceiptTextLimit } from './canonical.ts';\nimport { parseStrictJson } from './strict-json.ts';\nimport { executionRuntime } from './runtime.ts';\nimport type { RuntimeContract } from './runtime.ts';\nexport { executionRuntime } from './runtime.ts';\nexport type { RuntimeContract } from './runtime.ts';\nimport { DiscoverySession, FamilyAdequacyMonitor, validateFamilyAdequacyOptions, validateDiscoveryIdentifier } from './inference/index.ts';\nimport type { DiscoveryConfig, Observation, DecisionAction } from './inference/index.ts';\nimport { evaluatePolicy } from './policy.ts';\nimport type { Policy } from './policy.ts';\nimport type { EvidenceBundle } from './evidence.ts';\nimport { EVIDENCE_LIMITS } from './evidence.ts';\n\nexport type DiscoveryInput = {kind:'discovery'; definition:DiscoveryConfig; observations:Observation[]; adequacy?:{alpha:number;epochId:string}; actions?:DecisionAction[]};\nexport type PolicyInput = {kind:'policy'; policy:Policy; evidence:EvidenceBundle; asOf:string};\nexport type RunInput = DiscoveryInput | PolicyInput\n;\nexport const MAX_DISCOVERY_OBSERVATIONS = 5000;\nexport interface RunReceipt {schemaVersion:1;kind:RunInput['kind'];input:RunInput;result:unknown;runtime:RuntimeContract;digest:string}\nexport interface VerificationResult {valid:boolean;integrity:'VALID'|'INVALID'|'NOT_CHECKED';replay:'MATCH'|'MISMATCH'|'UNSUPPORTED'|'NOT_RUN';anchoring:'MATCH'|'MISMATCH'|'UNANCHORED';reason:string}\n\nfunction object(v:unknown,label:string):Record<string,unknown> {\n  if(!v || typeof v!=='object' || Array.isArray(v)) throw new Error(`${label} must be an object`);\n  return v as Record<string,unknown>;\n}\nfunction keys(v:Record<string,unknown>,allowed:string[],required:string[],label:string):void {\n  for(const k of Object.keys(v)) if(!allowed.includes(k)) throw new Error(`${label}: unknown field ${k}`);\n  for(const k of required) if(!Object.hasOwn(v,k)) throw new Error(`${label}: missing ${k}`);\n}\nfunction jsonNodeCount(value:unknown):number {\n  return value!==null && typeof value==='object'\n    ? 1+Object.values(value).reduce<number>((sum,child)=>sum+jsonNodeCount(child),0)\n    : 1;\n}\n/** Conservative schema-derived bound on the complete integrated receipt, including\n * its input and both observation chains. It is checked before inference starts.\n * A hypothesis appears in every posterior and in multiple adequacy fields, so an\n * observation-count limit alone cannot bound the resulting canonical JSON tree. */\nfunction assertDiscoveryReceiptBudget(input:DiscoveryInput):void {\n  const hypotheses=input.definition.hypotheses.length;\n  const experiments=input.definition.experiments.length;\n  const monitored=input.adequacy!==undefined && input.definition.experiments.every(e=>e.outcomes.length===2);\n  const fixedNodes=512+8*hypotheses+experiments*(8+5*hypotheses)+4*(input.actions?.length??0);\n  const nodesPerObservation=40+hypotheses+(monitored?128+10*hypotheses:0);\n  const upperBound=jsonNodeCount(input)+fixedNodes+input.observations.length*nodesPerObservation;\n  if(upperBound>CANONICAL_MAX_NODES) {\n    throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated receipt bound ${upperBound} exceeds ${CANONICAL_MAX_NODES} JSON nodes; reduce observations, hypotheses, or experiments`);\n  }\n  // Quote actual identifiers before measuring: UTF-8 and JSON escaping can make\n  // their byte sizes differ substantially from JavaScript string lengths.\n  const quotedBytes=(text:string):number=>Buffer.byteLength(JSON.stringify(text),'utf8');\n  const hypothesisBytes=input.definition.hypotheses.reduce((sum,h)=>sum+quotedBytes(h.id),0);\n  const experimentBytes=input.definition.experiments.reduce((sum,e)=>sum+quotedBytes(e.id),0);\n  const outcomeBytes=input.definition.experiments.map(e=>e.outcomes.reduce((sum,o)=>sum+quotedBytes(o),0));\n  const allOutcomeBytes=outcomeBytes.reduce((sum,bytes)=>sum+bytes,0);\n  const maxOutcomeBytes=Math.max(0,...outcomeBytes);\n  const epochBytes=input.adequacy?quotedBytes(input.adequacy.epochId):0;\n  const actionBytes=(input.actions??[]).reduce((sum,a)=>sum+quotedBytes(a.id),0);\n  // Fixed reserves cover property names, runtime/hash fields, punctuation,\n  // finite-number spellings (at most 25 bytes) and two-space indentation at the\n  // receipt schema's maximum depth. Variable keys/values are added separately.\n  const fixedBytes=32768+8*hypothesisBytes+4*experimentBytes+4*quotedBytes(input.definition.modelId)\n    +4*epochBytes+4*actionBytes+256*(input.actions?.length??0)\n    +experiments*(256+512*hypotheses+4*hypothesisBytes)+4*hypotheses*allOutcomeBytes;\n  let chainBytes=0;\n  for(const observation of input.observations) {\n    const observationBytes=quotedBytes(observation.id)+quotedBytes(observation.experimentId)+quotedBytes(observation.outcome);\n    chainBytes+=2048+64*hypotheses+hypothesisBytes+2*observationBytes;\n    if(monitored) chainBytes+=8192+256*hypotheses+12*hypothesisBytes+8*observationBytes\n      +4*epochBytes+4*(hypotheses+1)*maxOutcomeBytes;\n  }\n  // The input is indented one additional level inside the final receipt. Four\n  // bytes per node cover that extra indentation, including closing containers.\n  const inputBytes=Buffer.byteLength(JSON.stringify(input,null,2),'utf8')+4*jsonNodeCount(input);\n  const byteBound=inputBytes+fixedBytes+chainBytes;\n  if(byteBound>CANONICAL_MAX_BYTES) {\n    throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated pretty-printed receipt bound ${byteBound} exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes; reduce observations, hypotheses, or identifier lengths`);\n  }\n}\nexport function validateInput(value:unknown):RunInput {\n  const copy=JSON.parse(canonicalize(value));\n  const input=object(copy,'Input');\n  if(input.kind==='discovery') {\n    keys(input,['kind','definition','observations','adequacy','actions'],['kind','definition','observations'],'Discovery input');\n    if(!Array.isArray(input.observations) || input.observations.length>MAX_DISCOVERY_OBSERVATIONS) throw new Error(`Observations must be an array with at most ${MAX_DISCOVERY_OBSERVATIONS} entries and fit the discovery receipt budget`);\n    const d=object(input.definition,'Definition');\n    keys(d,['modelId','hypotheses','experiments','budget','observationAssumption','stopProbability','minInformationGainNats'],['modelId','hypotheses','experiments','budget','observationAssumption'],'Definition');\n    if(!Array.isArray(d.hypotheses) || d.hypotheses.length>100 || !Array.isArray(d.experiments) || d.experiments.length>100) throw new Error('At most 100 hypotheses and 100 experiments are supported');\n    validateDiscoveryIdentifier(d.modelId,'modelId');\n    for(const h of d.hypotheses) {\n      const hypothesis=object(h,'Hypothesis');\n      keys(hypothesis,['id','prior'],['id','prior'],'Hypothesis');\n      validateDiscoveryIdentifier(hypothesis.id,'hypothesis id');\n    }\n    for(const e of d.experiments) {\n      const ex=object(e,'Experiment');\n      keys(ex,['id','cost','outcomes','likelihoods'],['id','cost','outcomes','likelihoods'],'Experiment');\n      if(!Array.isArray(ex.outcomes) || ex.outcomes.length>100) throw new Error('At most 100 outcomes per experiment are supported');\n      validateDiscoveryIdentifier(ex.id,'experiment id');\n      for(const outcome of ex.outcomes) validateDiscoveryIdentifier(outcome,'outcome');\n    }\n    for(const obs of input.observations) {\n      const observation=object(obs,'Observation');\n      keys(observation,['id','experimentId','outcome'],['id','experimentId','outcome'],'Observation');\n      for(const field of ['id','experimentId','outcome']) validateDiscoveryIdentifier(observation[field],`observation ${field}`);\n    }\n    if(input.adequacy!==undefined) {\n      const adequacy=object(input.adequacy,'Adequacy');\n      keys(adequacy,['alpha','epochId'],['alpha','epochId'],'Adequacy');\n      validateDiscoveryIdentifier(adequacy.epochId,'epochId');\n    }\n    if(input.actions!==undefined) {\n      if(!Array.isArray(input.actions) || input.actions.length>100) throw new Error('At most 100 actions are supported');\n      for(const action of input.actions) {\n        const candidate=object(action,'Action');\n        keys(candidate,['id','losses'],['id','losses'],'Action');\n        validateDiscoveryIdentifier(candidate.id,'action id');\n      }\n    }\n    assertDiscoveryReceiptBudget(copy as DiscoveryInput);\n  } else if(input.kind==='policy') {\n    keys(input,['kind','policy','evidence','asOf'],['kind','policy','evidence','asOf'],'Policy input');\n    const evidence=object(input.evidence,'Evidence');\n    const policy=object(input.policy,'Policy');\n    if(!Array.isArray(evidence.facts) || evidence.facts.length>EVIDENCE_LIMITS.facts || !Array.isArray(evidence.sources) || evidence.sources.length>EVIDENCE_LIMITS.sources) throw new Error('Evidence requires arrays of at most 1000 facts and sources');\n    if(!Array.isArray(policy.rules) || policy.rules.length>1000) throw new Error('Policy requires at most 1000 rules');\n  } else throw new Error('Input kind is not supported by this edition');\n  return copy as RunInput;\n}\nexport function evaluateInput(input:RunInput):unknown {\n  if(input.kind==='policy') return evaluatePolicy(input.policy,input.evidence,input.asOf);\n  const session=new DiscoverySession(input.definition);\n  if(input.adequacy) validateFamilyAdequacyOptions(input.adequacy);\n  const unsupportedExperimentIds=input.definition.experiments.filter(e=>e.outcomes.length!==2).map(e=>e.id);\n  const monitor=input.adequacy && unsupportedExperimentIds.length===0\n    ? new FamilyAdequacyMonitor(input.definition,input.adequacy):null;\n  for(const observation of input.observations) {\n    const prepared=monitor?.prepare(observation.id,observation.experimentId);\n    session.observe(observation);\n    if(monitor && prepared) monitor.observe(prepared,observation.outcome);\n  }\n  const snapshot=session.snapshot();\n  const adequacy=monitor?.snapshot()??(input.adequacy\n    ? {status:'UNSUPPORTED' as const,reason:'Adequacy requires exactly two outcome labels for every experiment.',unsupportedExperimentIds}\n    : {status:'NOT_EVALUATED' as const,reason:'Adequacy was not requested; no family adequacy assessment was made.'});\n  const available=!snapshot.modelMismatch && adequacy.status==='NOT_REJECTED';\n  const stopReason=adequacy.status==='NOT_EVALUATED'?'adequacy-not-evaluated'\n    :adequacy.status==='UNSUPPORTED'?'adequacy-unsupported':'declared-family-rejected';\n  return {snapshot,recommendation:adequacy.status==='NOT_REJECTED'?session.recommend():{status:'stop',reason:stopReason},adequacy,decisionStatus:available?'AVAILABLE':'DEFER',action:input.actions && available?session.chooseAction(input.actions):null,assumptions:['Probabilities are conditional on the declared finite candidate family.','Observations are conditionally independent given the hypothesis and experiment.','NOT_REJECTED means insufficient evidence against the declared family, not approval.','An absent or unsupported adequacy assessment defers integrated action suggestions.','Experiment selection is greedy expected information per cost, not global optimality.']};\n}\nexport function runRequest(value:unknown):RunReceipt {\n  if(Number(process.versions.node.split('.')[0])<20) throw new Error('Unsupported execution runtime: Node 20 or newer is required');\n  const input=validateInput(value);\n  const payload={schemaVersion:1 as const,kind:input.kind,input,result:evaluateInput(input),runtime:executionRuntime()};\n  const receipt={...payload,digest:sha256(payload)};\n  assertReceiptTextLimit(receipt);\n  return receipt;\n}\n/** Verifies an already parsed object. Use verifyRunText at external JSON boundaries. */\nexport function verifyRun(value:unknown,expectedDigest?:string):VerificationResult {\n  const answer:VerificationResult={valid:false,integrity:'NOT_CHECKED',replay:'NOT_RUN',anchoring:expectedDigest===undefined?'UNANCHORED':'MISMATCH',reason:''};\n  try {\n    if(expectedDigest!==undefined && (typeof expectedDigest!=='string' || !/^[a-f0-9]{64}$/.test(expectedDigest))) throw new Error('Trusted digest must be 64 lowercase hexadecimal characters');\n    const r=object(value,'Receipt');\n    keys(r,['schemaVersion','kind','input','result','runtime','digest'],['schemaVersion','kind','input','result','runtime','digest'],'Receipt');\n    if(r.schemaVersion!==1 || typeof r.digest!=='string' || !/^[a-f0-9]{64}$/.test(r.digest)) throw new Error('Unsupported or malformed receipt');\n    const {digest,...payload}=r;\n    const payloadDigest=sha256(payload);\n    answer.integrity=payloadDigest===digest?'VALID':'INVALID';\n    answer.anchoring=expectedDigest===undefined?'UNANCHORED':digest===expectedDigest && payloadDigest===expectedDigest?'MATCH':'MISMATCH';\n    if(payloadDigest!==digest) throw new Error('Receipt digest does not match its payload');\n    if(answer.anchoring==='MISMATCH') throw new Error('Receipt does not match the trusted external digest');\n    if(canonicalize(r.runtime)!==canonicalize(executionRuntime())) {\n      answer.replay='UNSUPPORTED';\n      throw new Error('Exact replay requires the recorded source artifact, Node/V8, platform, architecture, and endianness');\n    }\n    const replay=runRequest(r.input);\n    if(replay.digest!==digest) {\n      answer.replay='MISMATCH';\n      throw new Error('Payload is internally hashed but recomputation disagrees');\n    }\n    answer.replay='MATCH';answer.valid=true;\n    answer.reason=expectedDigest?'Exact replay and trusted digest match.':'Exact replay matches. No trusted external digest was supplied; this verifies consistency, not origin or historical completeness.';\n  } catch(error) {answer.reason=error instanceof Error?error.message:String(error);}\n  return answer;\n}\n\n/** Safe text entrypoint: reject duplicates before hashing or runtime checks. */\nexport function verifyRunText(raw:string,expectedDigest?:string):VerificationResult {\n  try { return verifyRun(parseStrictJson(raw),expectedDigest); }\n  catch(error) { return {valid:false,integrity:'NOT_CHECKED',replay:'NOT_RUN',anchoring:expectedDigest===undefined?'UNANCHORED':'MISMATCH',reason:error instanceof Error?error.message:String(error)}; }\n}\n" }, { "path": "runtime.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { readdirSync, readFileSync } from 'node:fs';\nimport { fileURLToPath } from 'node:url';\nimport { join, relative, dirname } from 'node:path';\nimport { endianness } from 'node:os';\nimport { sha256 } from './canonical.ts';\nimport { packagePath } from './package-root.ts';\nexport interface RuntimeContract {implementation:string;node:string;v8:string;platform:string;architecture:string;endianness:string;sourceDigest:string;codeDigest:string}\nconst root = dirname(fileURLToPath(import.meta.url));\nfunction sourceFiles(dir:string,extension:string):string[] {\n  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name),extension):e.isFile() && e.name.endsWith(extension) && !e.name.endsWith('.d.ts')?[join(dir,e.name)]:[]).sort();\n}\nfunction treeDigest(directory:string,extension:string):string {\n  return sha256(sourceFiles(directory,extension).map(p=>({path:relative(directory,p).split('\\\\').join('/'),source:readFileSync(p,'utf8')})));\n}\nexport function executionRuntime():RuntimeContract {\n  return {implementation:'@cosmic/commons/0.2.2',node:process.versions.node,v8:process.versions.v8,platform:process.platform,architecture:process.arch,endianness:endianness(),sourceDigest:treeDigest(packagePath('src'),'.ts'),codeDigest:treeDigest(root,import.meta.url.endsWith('.ts')?'.ts':'.js')};\n}\n\n/** Separate deployments cannot silently replay each other's policy receipts. */\nexport function policyImplementation():string { return 'cosmic-commons/policy-v1/0.2.2'; }\n" }, { "path": "server.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { createServer } from 'node:http';\nimport { readFileSync } from 'node:fs';\nimport { packagePath } from './package-root.ts';\nimport { runRequest, verifyRun } from './run.ts';\nimport { parseStrictJson, StrictJsonError } from './strict-json.ts';\nimport { listExamples } from './examples.ts';\nexport function createWorkbenchServer(){\n  return createServer(async(req,res)=>{\n    res.setHeader('X-Content-Type-Options','nosniff');\n    res.setHeader('Cache-Control','no-store');\n    res.setHeader('Content-Security-Policy',\"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'\");\n    const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};\n    if(!/^(127\\.0\\.0\\.1|localhost)(:\\d+)?$/.test(req.headers.host??'')) {send(403,{error:'Local host required'});return;}\n    const origin=req.headers.origin;\n    if(origin && origin!==`http://${req.headers.host}`){send(403,{error:'Same-origin requests only'});return;}\n    try {\n      const pathname=new URL(req.url??'/',`http://${req.headers.host}`).pathname;\n      if(req.method==='GET' && pathname==='/api/examples'){send(200,{examples:listExamples()});return;}\n      if(req.method==='GET' && pathname==='/api/health'){send(200,{status:'ready',version:'0.2.1',node:process.versions.node});return;}\n      if(req.method==='POST' && ['/api/run','/api/verify','/api/format'].includes(pathname)){\n        if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'Content-Type application/json required'});return;}\n        const chunks:Buffer[]=[];let size=0;\n        for await(const chunk of req){size+=chunk.length;if(size>2_000_000){send(413,{error:'Maximum request size is 2 MB'});return;}chunks.push(chunk);}\n        const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks));\n        if(pathname==='/api/run')send(200,runRequest(parseStrictJson(raw)));\n        else if(pathname==='/api/format')send(200,{formatted:JSON.stringify(parseStrictJson(raw),null,2)});\n        else {\n          // Scan the entire raw body, including legacy envelopes, before unwrapping.\n          try {\n            const value=parseStrictJson(raw);\n            const header=req.headers['x-cosmic-expected-digest'];\n            if(header!==undefined && typeof header!=='string')throw new Error('Trusted digest header must be a single value');\n            if(value && typeof value==='object' && !Array.isArray(value) && Object.hasOwn(value,'receipt')) {\n              const envelope=value as Record<string,unknown>;\n              if(Object.keys(envelope).some(key=>!['receipt','expectedDigest'].includes(key)))throw new Error('Unknown verification envelope field');\n              if(envelope.expectedDigest!==undefined && typeof envelope.expectedDigest!=='string')throw new Error('Trusted digest must be a string');\n              if(header!==undefined && envelope.expectedDigest!==undefined && header!==envelope.expectedDigest)throw new Error('Conflicting trusted digests');\n              send(200,verifyRun(envelope.receipt,header ?? envelope.expectedDigest as string | undefined));\n            } else send(200,verifyRun(value,header));\n          } catch(error) {\n            // A malformed legacy envelope may itself contain an unreadable\n            // expectedDigest. Do not claim that no anchor was supplied.\n            send(200,{valid:false,integrity:'NOT_CHECKED',replay:'NOT_RUN',anchoring:req.headers['x-cosmic-expected-digest']===undefined?'NOT_CHECKED':'MISMATCH',reason:error instanceof Error?error.message:String(error)});\n          }\n        }\n        return;\n      }\n      const files:Record<string,[string,string]>={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/styles.css':['styles.css','text/css']};\n      const entry=files[pathname];\n      if(req.method==='GET' && entry){res.writeHead(200,{'Content-Type':entry[1]+'; charset=utf-8'});res.end(readFileSync(packagePath('web',entry[0])));return;}\n      send(404,{error:'Not found'});\n    }catch(error){send(400,{error:error instanceof Error?error.message:String(error),...(error instanceof StrictJsonError?{code:error.code}:{})});}\n  });\n}\nexport async function serve(port=4317):Promise<void>{\n  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port must be an integer between 1 and 65535');\n  const server=createWorkbenchServer();\n  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});\n  process.stdout.write(`COSMIC Commons is ready: http://127.0.0.1:${port}\\nLocal computation only. Press Ctrl+C to stop.\\n`);\n}\n" }, { "path": "strict-json.ts", "source": "// Copyright 2026 Leland Jourdan II / C&L Strategy\n// SPDX-License-Identifier: Apache-2.0\nimport { CANONICAL_MAX_BYTES } from './canonical.ts';\n/** Raw JSON trust boundary. Object APIs cannot recover keys or numbers discarded by a parser. */\nexport const MAX_JSON_BYTES = CANONICAL_MAX_BYTES;\nexport const MAX_JSON_DEPTH = 128;\nexport type StrictJsonErrorCode = 'DUPLICATE_JSON_KEY' | 'UNSAFE_INTEGER' | 'NUMBER_NOT_ROUNDTRIPPABLE' | 'INVALID_JSON' | 'JSON_TOO_LARGE' | 'JSON_TOO_DEEP';\n\nexport class StrictJsonError extends SyntaxError {\n  readonly code: StrictJsonErrorCode;\n  readonly offset: number;\n  constructor(code: StrictJsonErrorCode, offset: number, detail: string) {\n    super(`${code}: ${detail} at character ${offset}`);\n    this.name = 'StrictJsonError';\n    this.code = code;\n    this.offset = offset;\n  }\n}\n\n/**\n * Exact decimal identity, not binary64 representability. Thus 0.1 is supported,\n * and 1.00e-1 is equivalent, but 0.10000000000000001 cannot silently become 0.1.\n * Never expand an exponent or construct a large BigInt: work is bounded by the\n * token length. The input has already passed the JSON number grammar.\n */\nfunction decimalIdentity(token: string): string | null {\n  const parts = /^(-?)(\\d+)(?:\\.(\\d+))?(?:[eE]([+-]?\\d+))?$/.exec(token)!;\n  const fraction = parts[3] ?? '';\n  const digits = (parts[2] + fraction).replace(/^0+/, '');\n  if (!digits) return '0';\n  let end = digits.length;\n  while (digits[end - 1] === '0') end--;\n  const significant = digits.slice(0, end);\n  const exponent = Number(parts[4] ?? '0');\n  // A nonzero token within the input-size bound cannot cancel an exponent\n  // outside the safe-integer range into a finite, nonzero binary64 number.\n  if (!Number.isSafeInteger(exponent)) return null;\n  const scale = exponent - fraction.length + digits.length - significant.length;\n  if (!Number.isSafeInteger(scale)) return null;\n  return `${parts[1]}${significant}e${scale}`;\n}\n\nfunction requireRoundtrippableNumber(token: string, offset: number): void {\n  const number = Number(token);\n  const canonical = Number.isFinite(number) && !Object.is(number, -0) ? JSON.stringify(number) : null;\n  if (canonical === null || decimalIdentity(token) !== decimalIdentity(canonical)) {\n    throw new StrictJsonError('NUMBER_NOT_ROUNDTRIPPABLE', offset,\n      'Number must retain its exact decimal value through binary64 JSON serialization; non-finite values and negative zero are unsupported');\n  }\n  // Exact decimal round-trip is insufficient for integers. For example 2**53\n  // serializes unchanged, but its adjacent integer does not remain distinct.\n  // The same rule covers exponent/fraction spellings and negative integers.\n  if (Number.isInteger(number) && !Number.isSafeInteger(number)) {\n    throw new StrictJsonError('UNSAFE_INTEGER', offset,\n      'Integer values must be within the inclusive safe range -9007199254740991 to 9007199254740991');\n  }\n}\n\n/**\n * Reject ambiguous JSON before materializing an object. Names are compared after\n * JSON escape decoding, within their containing object. Native JSON.parse only\n * runs on the complete document after the bounded grammar scan succeeds.\n * Each numeric token must have the same exact decimal value as the native JSON\n * serialization of its binary64 value. This is not arbitrary-precision arithmetic;\n * it prevents distinct source decimals from silently collapsing at this boundary.\n * All integer values must additionally be within the binary64 safe integer range.\n */\nexport function parseStrictJson(raw: string): unknown {\n  if (typeof raw !== 'string') throw new StrictJsonError('INVALID_JSON', 0, 'Expected raw JSON text');\n  if (raw.length > MAX_JSON_BYTES || Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) {\n    throw new StrictJsonError('JSON_TOO_LARGE', 0, `Maximum input size is ${MAX_JSON_BYTES} UTF-8 bytes`);\n  }\n  let offset = 0;\n  const fail = (detail: string): never => { throw new StrictJsonError('INVALID_JSON', offset, detail); };\n  const whitespace = (): void => {\n    while (raw[offset] === ' ' || raw[offset] === '\\t' || raw[offset] === '\\n' || raw[offset] === '\\r') offset++;\n  };\n  const string = (): string => {\n    if (raw[offset] !== '\"') return fail('Expected a quoted string');\n    const start = offset++;\n    while (offset < raw.length) {\n      const character = raw[offset++];\n      if (character === '\\\\') { offset++; continue; }\n      if (character === '\"') {\n        try { return JSON.parse(raw.slice(start, offset)) as string; }\n        catch { return fail('Invalid JSON string'); }\n      }\n    }\n    return fail('Unterminated JSON string');\n  };\n  const number = /-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?/y;\n  const value = (depth: number): void => {\n    whitespace();\n    const first = raw[offset];\n    if (first === '{' || first === '[') {\n      if (depth >= MAX_JSON_DEPTH) throw new StrictJsonError('JSON_TOO_DEEP', offset, `Maximum nesting depth is ${MAX_JSON_DEPTH}`);\n      offset++;\n      whitespace();\n      const object = first === '{';\n      const end = object ? '}' : ']';\n      const keys = new Set<string>();\n      if (raw[offset] === end) { offset++; return; }\n      for (;;) {\n        if (object) {\n          whitespace();\n          const keyOffset = offset;\n          const key = string();\n          if (keys.has(key)) throw new StrictJsonError('DUPLICATE_JSON_KEY', keyOffset, 'Duplicate decoded object key');\n          keys.add(key);\n          whitespace();\n          if (raw[offset++] !== ':') fail('Expected colon after object key');\n        }\n        value(depth + 1);\n        whitespace();\n        if (raw[offset] === end) { offset++; return; }\n        if (raw[offset++] !== ',') fail('Expected comma or closing delimiter');\n      }\n    }\n    if (first === '\"') { string(); return; }\n    for (const literal of ['true', 'false', 'null']) {\n      if (raw.startsWith(literal, offset)) { offset += literal.length; return; }\n    }\n    number.lastIndex = offset;\n    const match = number.exec(raw);\n    if (!match) fail('Expected a JSON value');\n    // A matched prefix such as -0 in -01 is malformed syntax, not a complete\n    // unsupported number. Check its boundary before interpreting its value.\n    const next = raw[number.lastIndex];\n    if (next !== undefined && next !== ' ' && next !== '\\t' && next !== '\\n' && next !== '\\r' && next !== ',' && next !== ']' && next !== '}') {\n      fail('Invalid character after JSON number');\n    }\n    requireRoundtrippableNumber(match![0], offset);\n    offset = number.lastIndex;\n  };\n  value(0);\n  whitespace();\n  if (offset !== raw.length) fail('Trailing content');\n  // JSON.parse defines own properties (including __proto__) without setters.\n  try { return JSON.parse(raw) as unknown; }\n  catch { return fail('Invalid JSON'); }\n}\n" }];
    assets = { "examples/artifact.txt": "Q09TTUlDIENvbW1vbnMgc3ludGhldGljIHJlbGVhc2UgYXJ0aWZhY3QgdjEK", "examples/discovery-deferred.json": "ewogICJraW5kIjogImRpc2NvdmVyeSIsCiAgImRlZmluaXRpb24iOiB7CiAgICAibW9kZWxJZCI6ICJleGNsdWRlZC1kZWNveS1kZW1vbnN0cmF0aW9uLXYxIiwKICAgICJvYnNlcnZhdGlvbkFzc3VtcHRpb24iOiAiY29uZGl0aW9uYWxseS1pbmRlcGVuZGVudC1naXZlbi1oeXBvdGhlc2lzLWFuZC1leHBlcmltZW50IiwKICAgICJidWRnZXQiOiA2LAogICAgImh5cG90aGVzZXMiOiBbCiAgICAgIHsiaWQiOiAiYWN0aXZlLWEiLCAicHJpb3IiOiAwLjV9LAogICAgICB7ImlkIjogImFjdGl2ZS1iIiwgInByaW9yIjogMC41fSwKICAgICAgeyJpZCI6ICJleGNsdWRlZC1kZWNveSIsICJwcmlvciI6IDB9CiAgICBdLAogICAgImV4cGVyaW1lbnRzIjogW3sKICAgICAgImlkIjogInByb2JlIiwgImNvc3QiOiAxLCAib3V0Y29tZXMiOiBbIjEiLCAiMCJdLAogICAgICAibGlrZWxpaG9vZHMiOiB7CiAgICAgICAgImFjdGl2ZS1hIjogeyIxIjogMC4xLCAiMCI6IDAuOX0sCiAgICAgICAgImFjdGl2ZS1iIjogeyIxIjogMC4xLCAiMCI6IDAuOX0sCiAgICAgICAgImV4Y2x1ZGVkLWRlY295IjogeyIxIjogMSwgIjAiOiAwfQogICAgICB9CiAgICB9XQogIH0sCiAgIm9ic2VydmF0aW9ucyI6IFsKICAgIHsiaWQiOiAibWVhc3VyZW1lbnQtMSIsICJleHBlcmltZW50SWQiOiAicHJvYmUiLCAib3V0Y29tZSI6ICIxIn0sCiAgICB7ImlkIjogIm1lYXN1cmVtZW50LTIiLCAiZXhwZXJpbWVudElkIjogInByb2JlIiwgIm91dGNvbWUiOiAiMSJ9LAogICAgeyJpZCI6ICJtZWFzdXJlbWVudC0zIiwgImV4cGVyaW1lbnRJZCI6ICJwcm9iZSIsICJvdXRjb21lIjogIjEifSwKICAgIHsiaWQiOiAibWVhc3VyZW1lbnQtNCIsICJleHBlcmltZW50SWQiOiAicHJvYmUiLCAib3V0Y29tZSI6ICIxIn0KICBdLAogICJhZGVxdWFjeSI6IHsiYWxwaGEiOiAwLjA1LCAiZXBvY2hJZCI6ICJleGNsdWRlZC1kZWNveS1tb25pdG9yLXYyIn0sCiAgImFjdGlvbnMiOiBbeyJpZCI6ICJwcm9jZWVkIiwgImxvc3NlcyI6IHsiYWN0aXZlLWEiOiAwLCAiYWN0aXZlLWIiOiAwLCAiZXhjbHVkZWQtZGVjb3kiOiAwfX1dCn0K", "examples/release-authorization.json": "ewogICJraW5kIjoicG9saWN5IiwKICAiYXNPZiI6IjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAgInBvbGljeSI6eyJpZCI6InJlbGVhc2UtYXV0aG9yaXphdGlvbiIsInZlcnNpb24iOiIxLjAuMCIsInJ1bGVzIjpbeyJpZCI6ImFydGlmYWN0LWJvdW5kIiwiZmFjdElkIjoiYXJ0aWZhY3QiLCJvcCI6ImVxIiwidmFsdWUiOiJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiJ9LHsiaWQiOiJ0ZXN0cy1wYXNzIiwiZmFjdElkIjoidGVzdHMiLCJvcCI6ImVxIiwidmFsdWUiOnRydWV9LHsiaWQiOiJyZXZpZXdlZCIsImZhY3RJZCI6InJldmlldyIsIm9wIjoiZXEiLCJ2YWx1ZSI6ImFwcHJvdmVkIn0seyJpZCI6Im5vLWNyaXRpY2FsLWZpbmRpbmdzIiwiZmFjdElkIjoiY3JpdGljYWwiLCJvcCI6Imx0ZSIsInZhbHVlIjowfV19LAogICJldmlkZW5jZSI6eyJzb3VyY2VzIjpbeyJpZCI6ImJ1aWxkLXJlY29yZCIsImNvbnRlbnQiOnsiYXJ0aWZhY3QiOiJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsInRlc3RzUGFzc2VkIjp0cnVlLCJjcml0aWNhbEZpbmRpbmdzIjowfX0seyJpZCI6InJldmlldy1yZWNvcmQiLCJjb250ZW50Ijp7InJldmlldyI6ImFwcHJvdmVkIiwiYXJ0aWZhY3QiOiJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiJ9fV0sImZhY3RzIjpbeyJpZCI6ImFydGlmYWN0Iiwic291cmNlSWQiOiJidWlsZC1yZWNvcmQiLCJ2YWx1ZSI6InNoYTI1Njo3NzM4ZWE4ZGYwYzk4MzU5NmQxNDlkMzQ0NjYwZGI4MjhiMWIyNDc0ZTBhYmFkMmIyZWY0Njg0MWI1YmY1MTcyIn0seyJpZCI6InRlc3RzIiwic291cmNlSWQiOiJidWlsZC1yZWNvcmQiLCJ2YWx1ZSI6dHJ1ZSwiZGVwZW5kc09uIjpbImFydGlmYWN0Il19LHsiaWQiOiJyZXZpZXciLCJzb3VyY2VJZCI6InJldmlldy1yZWNvcmQiLCJ2YWx1ZSI6ImFwcHJvdmVkIiwiZGVwZW5kc09uIjpbImFydGlmYWN0Il0sImV4cGlyZXNBdCI6IjIwMjYtMDktMjlUMTg6MDA6MDAuMDAwWiJ9LHsiaWQiOiJjcml0aWNhbCIsInNvdXJjZUlkIjoiYnVpbGQtcmVjb3JkIiwidmFsdWUiOjAsImRlcGVuZHNPbiI6WyJhcnRpZmFjdCJdfV19Cn0K", "examples/release-deferred.json": "ewogICJraW5kIjogInBvbGljeSIsCiAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAicG9saWN5IjogewogICAgImlkIjogInJlbGVhc2UtYXV0aG9yaXphdGlvbiIsCiAgICAidmVyc2lvbiI6ICIxLjAuMCIsCiAgICAicnVsZXMiOiBbCiAgICAgIHsKICAgICAgICAiaWQiOiAiYXJ0aWZhY3QtYm91bmQiLAogICAgICAgICJmYWN0SWQiOiAiYXJ0aWZhY3QiLAogICAgICAgICJvcCI6ICJlcSIsCiAgICAgICAgInZhbHVlIjogInNoYTI1Njo3NzM4ZWE4ZGYwYzk4MzU5NmQxNDlkMzQ0NjYwZGI4MjhiMWIyNDc0ZTBhYmFkMmIyZWY0Njg0MWI1YmY1MTcyIgogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInRlc3RzLXBhc3MiLAogICAgICAgICJmYWN0SWQiOiAidGVzdHMiLAogICAgICAgICJvcCI6ICJlcSIsCiAgICAgICAgInZhbHVlIjogdHJ1ZQogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInJldmlld2VkIiwKICAgICAgICAiZmFjdElkIjogInJldmlldyIsCiAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAidmFsdWUiOiAiYXBwcm92ZWQiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAibm8tY3JpdGljYWwtZmluZGluZ3MiLAogICAgICAgICJmYWN0SWQiOiAiY3JpdGljYWwiLAogICAgICAgICJvcCI6ICJsdGUiLAogICAgICAgICJ2YWx1ZSI6IDAKICAgICAgfQogICAgXQogIH0sCiAgImV2aWRlbmNlIjogewogICAgInNvdXJjZXMiOiBbCiAgICAgIHsKICAgICAgICAiaWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAiY29udGVudCI6IHsKICAgICAgICAgICJhcnRpZmFjdCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgICAidGVzdHNQYXNzZWQiOiB0cnVlLAogICAgICAgICAgImNyaXRpY2FsRmluZGluZ3MiOiAwCiAgICAgICAgfQogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICJjb250ZW50IjogewogICAgICAgICAgInJldmlldyI6ICJhcHByb3ZlZCIsCiAgICAgICAgICAiYXJ0aWZhY3QiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgICAgfQogICAgICB9CiAgICBdLAogICAgImZhY3RzIjogWwogICAgICB7CiAgICAgICAgImlkIjogImFydGlmYWN0IiwKICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAidmFsdWUiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAidGVzdHMiLAogICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICJ2YWx1ZSI6IHRydWUsCiAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICBdCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAiY3JpdGljYWwiLAogICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICJ2YWx1ZSI6IDAsCiAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICBdCiAgICAgIH0KICAgIF0KICB9Cn0K", "examples/release-denied.json": "ewogICJraW5kIjogInBvbGljeSIsCiAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAicG9saWN5IjogewogICAgImlkIjogInJlbGVhc2UtYXV0aG9yaXphdGlvbiIsCiAgICAidmVyc2lvbiI6ICIxLjAuMCIsCiAgICAicnVsZXMiOiBbCiAgICAgIHsKICAgICAgICAiaWQiOiAiYXJ0aWZhY3QtYm91bmQiLAogICAgICAgICJmYWN0SWQiOiAiYXJ0aWZhY3QiLAogICAgICAgICJvcCI6ICJlcSIsCiAgICAgICAgInZhbHVlIjogInNoYTI1Njo3NzM4ZWE4ZGYwYzk4MzU5NmQxNDlkMzQ0NjYwZGI4MjhiMWIyNDc0ZTBhYmFkMmIyZWY0Njg0MWI1YmY1MTcyIgogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInRlc3RzLXBhc3MiLAogICAgICAgICJmYWN0SWQiOiAidGVzdHMiLAogICAgICAgICJvcCI6ICJlcSIsCiAgICAgICAgInZhbHVlIjogdHJ1ZQogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInJldmlld2VkIiwKICAgICAgICAiZmFjdElkIjogInJldmlldyIsCiAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAidmFsdWUiOiAiYXBwcm92ZWQiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAibm8tY3JpdGljYWwtZmluZGluZ3MiLAogICAgICAgICJmYWN0SWQiOiAiY3JpdGljYWwiLAogICAgICAgICJvcCI6ICJsdGUiLAogICAgICAgICJ2YWx1ZSI6IDAKICAgICAgfQogICAgXQogIH0sCiAgImV2aWRlbmNlIjogewogICAgInNvdXJjZXMiOiBbCiAgICAgIHsKICAgICAgICAiaWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAiY29udGVudCI6IHsKICAgICAgICAgICJhcnRpZmFjdCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgICAidGVzdHNQYXNzZWQiOiB0cnVlLAogICAgICAgICAgImNyaXRpY2FsRmluZGluZ3MiOiAyCiAgICAgICAgfQogICAgICB9LAogICAgICB7CiAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICJjb250ZW50IjogewogICAgICAgICAgInJldmlldyI6ICJhcHByb3ZlZCIsCiAgICAgICAgICAiYXJ0aWZhY3QiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgICAgfQogICAgICB9CiAgICBdLAogICAgImZhY3RzIjogWwogICAgICB7CiAgICAgICAgImlkIjogImFydGlmYWN0IiwKICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAidmFsdWUiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAidGVzdHMiLAogICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICJ2YWx1ZSI6IHRydWUsCiAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICBdCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAicmV2aWV3IiwKICAgICAgICAic291cmNlSWQiOiAicmV2aWV3LXJlY29yZCIsCiAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIiwKICAgICAgICAiZGVwZW5kc09uIjogWwogICAgICAgICAgImFydGlmYWN0IgogICAgICAgIF0sCiAgICAgICAgImV4cGlyZXNBdCI6ICIyMDI2LTA5LTI5VDE4OjAwOjAwLjAwMFoiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiaWQiOiAiY3JpdGljYWwiLAogICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICJ2YWx1ZSI6IDIsCiAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICBdCiAgICAgIH0KICAgIF0KICB9Cn0K", "examples/sensor-investigation.json": "ewogICJraW5kIjoiZGlzY292ZXJ5IiwKICAiZGVmaW5pdGlvbiI6ewogICAgIm1vZGVsSWQiOiJzZW5zb3ItZGlyZWN0aW9uLXYxIiwKICAgICJvYnNlcnZhdGlvbkFzc3VtcHRpb24iOiJjb25kaXRpb25hbGx5LWluZGVwZW5kZW50LWdpdmVuLWh5cG90aGVzaXMtYW5kLWV4cGVyaW1lbnQiLAogICAgImJ1ZGdldCI6NiwKICAgICJoeXBvdGhlc2VzIjpbeyJpZCI6InBvc2l0aXZlIiwicHJpb3IiOjAuNX0seyJpZCI6Im5lZ2F0aXZlIiwicHJpb3IiOjAuNX1dLAogICAgImV4cGVyaW1lbnRzIjpbCiAgICAgIHsiaWQiOiJwcm9iZSIsImNvc3QiOjEsIm91dGNvbWVzIjpbIjEiLCIwIl0sImxpa2VsaWhvb2RzIjp7InBvc2l0aXZlIjp7IjEiOjAuOCwiMCI6MC4yfSwibmVnYXRpdmUiOnsiMSI6MC4yLCIwIjowLjh9fX0sCiAgICAgIHsiaWQiOiJ3ZWFrLXByb2JlIiwiY29zdCI6MC41LCJvdXRjb21lcyI6WyIxIiwiMCJdLCJsaWtlbGlob29kcyI6eyJwb3NpdGl2ZSI6eyIxIjowLjYsIjAiOjAuNH0sIm5lZ2F0aXZlIjp7IjEiOjAuNCwiMCI6MC42fX19CiAgICBdCiAgfSwKICAib2JzZXJ2YXRpb25zIjpbeyJpZCI6Im1lYXN1cmVtZW50LTEiLCJleHBlcmltZW50SWQiOiJwcm9iZSIsIm91dGNvbWUiOiIxIn0seyJpZCI6Im1lYXN1cmVtZW50LTIiLCJleHBlcmltZW50SWQiOiJwcm9iZSIsIm91dGNvbWUiOiIxIn1dLAogICJhZGVxdWFjeSI6eyJhbHBoYSI6MC4wNSwiZXBvY2hJZCI6InNlbnNvci1tb25pdG9yLXYxIn0sCiAgImFjdGlvbnMiOlt7ImlkIjoiaW52ZXN0aWdhdGUiLCJsb3NzZXMiOnsicG9zaXRpdmUiOjEsIm5lZ2F0aXZlIjoxfX0seyJpZCI6ImFjY2VwdC1wb3NpdGl2ZSIsImxvc3NlcyI6eyJwb3NpdGl2ZSI6MCwibmVnYXRpdmUiOjIwfX0seyJpZCI6ImFjY2VwdC1uZWdhdGl2ZSIsImxvc3NlcyI6eyJwb3NpdGl2ZSI6MjAsIm5lZ2F0aXZlIjowfX1dCn0K", "tests/fixtures/regression/adequacy/with-zero-prior.json": "eyJraW5kIjogImRpc2NvdmVyeSIsICJkZWZpbml0aW9uIjogeyJtb2RlbElkIjogInplcm8tcHJpb3ItcHJvYmUiLCAib2JzZXJ2YXRpb25Bc3N1bXB0aW9uIjogImNvbmRpdGlvbmFsbHktaW5kZXBlbmRlbnQtZ2l2ZW4taHlwb3RoZXNpcy1hbmQtZXhwZXJpbWVudCIsICJidWRnZXQiOiAxMDAsICJoeXBvdGhlc2VzIjogW3siaWQiOiAiUCIsICJwcmlvciI6IDAuNX0sIHsiaWQiOiAiUSIsICJwcmlvciI6IDAuNX0sIHsiaWQiOiAiWiIsICJwcmlvciI6IDB9XSwgImV4cGVyaW1lbnRzIjogW3siaWQiOiAiZSIsICJjb3N0IjogMSwgIm91dGNvbWVzIjogWyIxIiwgIjAiXSwgImxpa2VsaWhvb2RzIjogeyJQIjogeyIxIjogMC45LCAiMCI6IDAuMX0sICJRIjogeyIxIjogMC44LCAiMCI6IDAuMn0sICJaIjogeyIxIjogMC4xLCAiMCI6IDAuOX19fV19LCAib2JzZXJ2YXRpb25zIjogW3siaWQiOiAibTAwIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMSJ9LCB7ImlkIjogIm0wMSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDIiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTAzIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0wNCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDUiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTA2IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0wNyIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDgiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTA5IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xMCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjEifSwgeyJpZCI6ICJtMTEiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTEyIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xMyIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMTQiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTE1IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xNiIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMTciLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTE4IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xOSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjAiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIxIn0sIHsiaWQiOiAibTIxIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yMiIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjMiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTI0IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yNSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjYiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTI3IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yOCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjkiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTMwIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMSJ9LCB7ImlkIjogIm0zMSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzIiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTMzIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0zNCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzUiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTM2IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0zNyIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzgiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTM5IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9XSwgImFkZXF1YWN5IjogeyJhbHBoYSI6IDAuMDUsICJlcG9jaElkIjogInByb2JlIn0sICJhY3Rpb25zIjogW3siaWQiOiAiYWNjZXB0LVAiLCAibG9zc2VzIjogeyJQIjogMCwgIlEiOiAyMCwgIloiOiAyMH19LCB7ImlkIjogImFjY2VwdC1RIiwgImxvc3NlcyI6IHsiUCI6IDIwLCAiUSI6IDAsICJaIjogMjB9fSwgeyJpZCI6ICJpbnZlc3RpZ2F0ZSIsICJsb3NzZXMiOiB7IlAiOiAxLCAiUSI6IDEsICJaIjogMX19XX0=", "tests/fixtures/regression/adequacy/without-zero-prior.json": "eyJraW5kIjogImRpc2NvdmVyeSIsICJkZWZpbml0aW9uIjogeyJtb2RlbElkIjogInplcm8tcHJpb3ItcHJvYmUiLCAib2JzZXJ2YXRpb25Bc3N1bXB0aW9uIjogImNvbmRpdGlvbmFsbHktaW5kZXBlbmRlbnQtZ2l2ZW4taHlwb3RoZXNpcy1hbmQtZXhwZXJpbWVudCIsICJidWRnZXQiOiAxMDAsICJoeXBvdGhlc2VzIjogW3siaWQiOiAiUCIsICJwcmlvciI6IDAuNX0sIHsiaWQiOiAiUSIsICJwcmlvciI6IDAuNX1dLCAiZXhwZXJpbWVudHMiOiBbeyJpZCI6ICJlIiwgImNvc3QiOiAxLCAib3V0Y29tZXMiOiBbIjEiLCAiMCJdLCAibGlrZWxpaG9vZHMiOiB7IlAiOiB7IjEiOiAwLjksICIwIjogMC4xfSwgIlEiOiB7IjEiOiAwLjgsICIwIjogMC4yfX19XX0sICJvYnNlcnZhdGlvbnMiOiBbeyJpZCI6ICJtMDAiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIxIn0sIHsiaWQiOiAibTAxIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0wMiIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDMiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTA0IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0wNSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDYiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTA3IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0wOCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMDkiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTEwIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMSJ9LCB7ImlkIjogIm0xMSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMTIiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTEzIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xNCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMTUiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTE2IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0xNyIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMTgiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTE5IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yMCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjEifSwgeyJpZCI6ICJtMjEiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTIyIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yMyIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjQiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTI1IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yNiIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMjciLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTI4IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0yOSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzAiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIxIn0sIHsiaWQiOiAibTMxIiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0zMiIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzMiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTM0IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0zNSIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzYiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn0sIHsiaWQiOiAibTM3IiwgImV4cGVyaW1lbnRJZCI6ICJlIiwgIm91dGNvbWUiOiAiMCJ9LCB7ImlkIjogIm0zOCIsICJleHBlcmltZW50SWQiOiAiZSIsICJvdXRjb21lIjogIjAifSwgeyJpZCI6ICJtMzkiLCAiZXhwZXJpbWVudElkIjogImUiLCAib3V0Y29tZSI6ICIwIn1dLCAiYWRlcXVhY3kiOiB7ImFscGhhIjogMC4wNSwgImVwb2NoSWQiOiAicHJvYmUifSwgImFjdGlvbnMiOiBbeyJpZCI6ICJhY2NlcHQtUCIsICJsb3NzZXMiOiB7IlAiOiAwLCAiUSI6IDIwfX0sIHsiaWQiOiAiYWNjZXB0LVEiLCAibG9zc2VzIjogeyJQIjogMjAsICJRIjogMH19LCB7ImlkIjogImludmVzdGlnYXRlIiwgImxvc3NlcyI6IHsiUCI6IDEsICJRIjogMX19XX0=", "tests/fixtures/regression/numbers/bigint-eq.json": "eyJraW5kIjoicG9saWN5IiwiYXNPZiI6IjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAicG9saWN5Ijp7ImlkIjoiZXhhY3QtYnVpbGQtbnVtYmVyIiwidmVyc2lvbiI6IjEiLCJydWxlcyI6W3siaWQiOiJtdXN0LWJlLWJ1aWxkIiwiZmFjdElkIjoiYnVpbGQiLCJvcCI6ImVxIiwidmFsdWUiOjEyMzQ1Njc4OTAxMjM0NTY3ODl9XX0sCiAiZXZpZGVuY2UiOnsic291cmNlcyI6W3siaWQiOiJjaSIsImNvbnRlbnQiOnsiYnVpbGQiOjEyMzQ1Njc4OTAxMjM0NTY3ODh9fV0sImZhY3RzIjpbeyJpZCI6ImJ1aWxkIiwic291cmNlSWQiOiJjaSIsInZhbHVlIjoxMjM0NTY3ODkwMTIzNDU2Nzg4fV19fQo=", "tests/fixtures/regression/numbers/underflow-lte.json": "eyJraW5kIjoicG9saWN5IiwiYXNPZiI6IjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAicG9saWN5Ijp7ImlkIjoibm8tcmlzayIsInZlcnNpb24iOiIxIiwicnVsZXMiOlt7ImlkIjoicmlzay16ZXJvIiwiZmFjdElkIjoicmlzayIsIm9wIjoibHRlIiwidmFsdWUiOjB9XX0sCiAiZXZpZGVuY2UiOnsic291cmNlcyI6W3siaWQiOiJzY2FuIiwiY29udGVudCI6eyJyaXNrIjoxZS00MDB9fV0sImZhY3RzIjpbeyJpZCI6InJpc2siLCJzb3VyY2VJZCI6InNjYW4iLCJ2YWx1ZSI6MWUtNDAwfV19fQo=", "tests/fixtures/regression/receipts/c-A1.json": "ewogICJzY2hlbWFWZXJzaW9uIjogMSwKICAia2luZCI6ICJwb2xpY3kiLAogICJpbnB1dCI6IHsKICAgICJhc09mIjogIjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAgICAiZXZpZGVuY2UiOiB7CiAgICAgICJmYWN0cyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QiLAogICAgICAgICAgInNvdXJjZUlkIjogImJ1aWxkLXJlY29yZCIsCiAgICAgICAgICAidmFsdWUiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZGVwZW5kc09uIjogWwogICAgICAgICAgICAiYXJ0aWZhY3QiCiAgICAgICAgICBdLAogICAgICAgICAgImlkIjogInRlc3RzIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogdHJ1ZQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJleHBpcmVzQXQiOiAiMjAyNi0wOS0yOVQxODowMDowMC4wMDBaIiwKICAgICAgICAgICJpZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJ2YWx1ZSI6IDIKICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJjb250ZW50IjogewogICAgICAgICAgICAiYXJ0aWZhY3QiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiLAogICAgICAgICAgICAiY3JpdGljYWxGaW5kaW5ncyI6IDIsCiAgICAgICAgICAgICJ0ZXN0c1Bhc3NlZCI6IHRydWUKICAgICAgICAgIH0sCiAgICAgICAgICAiaWQiOiAiYnVpbGQtcmVjb3JkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImNvbnRlbnQiOiB7CiAgICAgICAgICAgICJhcnRpZmFjdCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgICAgICJyZXZpZXciOiAiYXBwcm92ZWQiCiAgICAgICAgICB9LAogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiCiAgICAgICAgfQogICAgICBdCiAgICB9LAogICAgImtpbmQiOiAicG9saWN5IiwKICAgICJwb2xpY3kiOiB7CiAgICAgICJpZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgICAicnVsZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QtYm91bmQiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAidGVzdHMiLAogICAgICAgICAgImlkIjogInRlc3RzLXBhc3MiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6IHRydWUKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAgICJpZCI6ICJyZXZpZXdlZCIsCiAgICAgICAgICAib3AiOiAiZXEiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAiaWQiOiAibm8tY3JpdGljYWwtZmluZGluZ3MiLAogICAgICAgICAgIm9wIjogImx0ZSIsCiAgICAgICAgICAidmFsdWUiOiAwCiAgICAgICAgfQogICAgICBdLAogICAgICAidmVyc2lvbiI6ICIxLjAuMCIKICAgIH0KICB9LAogICJyZXN1bHQiOiB7CiAgICAic2NoZW1hIjogImNvc21pYy5wb2xpY3ktcmVwb3J0LnYxIiwKICAgICJwb2xpY3lJZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgInBvbGljeVZlcnNpb24iOiAiMS4wLjAiLAogICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICJ2ZXJkaWN0IjogIkFMTE9XIiwKICAgICJ2ZXJkaWN0IjogIkRFTlkiLAogICAgInRyYWNlIjogWwogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJhcnRpZmFjdC1ib3VuZCIsCiAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgImFjdHVhbCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAidGVzdHMtcGFzcyIsCiAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6IHRydWUsCiAgICAgICAgImFjdHVhbCI6IHRydWUKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAicmV2aWV3ZWQiLAogICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAicmVzdWx0IjogIlBBU1MiLAogICAgICAgICJjb2RlIjogIlJFUVVJUkVNRU5UX1NBVElTRklFRCIsCiAgICAgICAgImV4cGVjdGVkIjogImFwcHJvdmVkIiwKICAgICAgICAiYWN0dWFsIjogImFwcHJvdmVkIgogICAgICB9LAogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJuby1jcml0aWNhbC1maW5kaW5ncyIsCiAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgInJlc3VsdCI6ICJGQUlMIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9GQUlMRUQiLAogICAgICAgICJleHBlY3RlZCI6IDAsCiAgICAgICAgImFjdHVhbCI6IDIKICAgICAgfQogICAgXSwKICAgICJlcnJvcnMiOiBbXSwKICAgICJldmlkZW5jZSI6IHsKICAgICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICAgInZhbGlkIjogdHJ1ZSwKICAgICAgImlzc3VlcyI6IFtdLAogICAgICAiZmFjdHMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAicmV2aWV3IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfQogICAgICBdLAogICAgICAibGluZWFnZSI6IFsKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImNyaXRpY2FsIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJkZXBlbmRzT24iOiBbCiAgICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICAgIF0KICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICJkZjI2YTVkZTllOWJjZmU4NGJiOGFhNWQ2ZmFhMGI1MDllOTAwMzVkNjJlMTMyNzNhODI0OWE5MjExOWYwZGMyIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICIxOWNhZGU0YTIzM2ZmZmMzMGM5NWVlODVjNDQ4NDE4YTU0YTkxMzQwMWRjMmFlZDUzMDg0ODYxMDFmZGQzZWI3IgogICAgICAgIH0KICAgICAgXQogICAgfQogIH0sCiAgInJ1bnRpbWUiOiB7CiAgICAiaW1wbGVtZW50YXRpb24iOiAiQGNvc21pYy9jb21tb25zLzAuMS4xIiwKICAgICJub2RlIjogIjI0LjE5LjAiLAogICAgInY4IjogIjEzLjYuMjMzLjE3LW5vZGUuNTEiLAogICAgInBsYXRmb3JtIjogImRhcndpbiIsCiAgICAiYXJjaGl0ZWN0dXJlIjogImFybTY0IiwKICAgICJlbmRpYW5uZXNzIjogIkxFIiwKICAgICJzb3VyY2VEaWdlc3QiOiAiZjVjMzA4MGM1MDdhM2UzYjgwOGJhZjc1MTM1OTEwMjRkODVmNDMzYTQ1OTQ2NmY2OGY5OTFmZTAxYjcxOGQwNCIKICB9LAogICJkaWdlc3QiOiAiNzIwODdjNzY1OGNhNjY0NTE3ZjRlYTYwNzljNzc2YWY1MmJjYTBmZGIxY2YzMDc1Y2MwNDQ4ZjVjOGQ5NWIzZCIKfQo=", "tests/fixtures/regression/receipts/c-clean.digest": "NzIwODdjNzY1OGNhNjY0NTE3ZjRlYTYwNzljNzc2YWY1MmJjYTBmZGIxY2YzMDc1Y2MwNDQ4ZjVjOGQ5NWIzZAo=", "tests/fixtures/regression/receipts/c-clean.json": "ewogICJzY2hlbWFWZXJzaW9uIjogMSwKICAia2luZCI6ICJwb2xpY3kiLAogICJpbnB1dCI6IHsKICAgICJhc09mIjogIjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAgICAiZXZpZGVuY2UiOiB7CiAgICAgICJmYWN0cyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QiLAogICAgICAgICAgInNvdXJjZUlkIjogImJ1aWxkLXJlY29yZCIsCiAgICAgICAgICAidmFsdWUiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZGVwZW5kc09uIjogWwogICAgICAgICAgICAiYXJ0aWZhY3QiCiAgICAgICAgICBdLAogICAgICAgICAgImlkIjogInRlc3RzIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogdHJ1ZQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJleHBpcmVzQXQiOiAiMjAyNi0wOS0yOVQxODowMDowMC4wMDBaIiwKICAgICAgICAgICJpZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJ2YWx1ZSI6IDIKICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJjb250ZW50IjogewogICAgICAgICAgICAiYXJ0aWZhY3QiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiLAogICAgICAgICAgICAiY3JpdGljYWxGaW5kaW5ncyI6IDIsCiAgICAgICAgICAgICJ0ZXN0c1Bhc3NlZCI6IHRydWUKICAgICAgICAgIH0sCiAgICAgICAgICAiaWQiOiAiYnVpbGQtcmVjb3JkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImNvbnRlbnQiOiB7CiAgICAgICAgICAgICJhcnRpZmFjdCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgICAgICJyZXZpZXciOiAiYXBwcm92ZWQiCiAgICAgICAgICB9LAogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiCiAgICAgICAgfQogICAgICBdCiAgICB9LAogICAgImtpbmQiOiAicG9saWN5IiwKICAgICJwb2xpY3kiOiB7CiAgICAgICJpZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgICAicnVsZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QtYm91bmQiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAidGVzdHMiLAogICAgICAgICAgImlkIjogInRlc3RzLXBhc3MiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6IHRydWUKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAgICJpZCI6ICJyZXZpZXdlZCIsCiAgICAgICAgICAib3AiOiAiZXEiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAiaWQiOiAibm8tY3JpdGljYWwtZmluZGluZ3MiLAogICAgICAgICAgIm9wIjogImx0ZSIsCiAgICAgICAgICAidmFsdWUiOiAwCiAgICAgICAgfQogICAgICBdLAogICAgICAidmVyc2lvbiI6ICIxLjAuMCIKICAgIH0KICB9LAogICJyZXN1bHQiOiB7CiAgICAic2NoZW1hIjogImNvc21pYy5wb2xpY3ktcmVwb3J0LnYxIiwKICAgICJwb2xpY3lJZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgInBvbGljeVZlcnNpb24iOiAiMS4wLjAiLAogICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICJ2ZXJkaWN0IjogIkRFTlkiLAogICAgInRyYWNlIjogWwogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJhcnRpZmFjdC1ib3VuZCIsCiAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgImFjdHVhbCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAidGVzdHMtcGFzcyIsCiAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6IHRydWUsCiAgICAgICAgImFjdHVhbCI6IHRydWUKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAicmV2aWV3ZWQiLAogICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAicmVzdWx0IjogIlBBU1MiLAogICAgICAgICJjb2RlIjogIlJFUVVJUkVNRU5UX1NBVElTRklFRCIsCiAgICAgICAgImV4cGVjdGVkIjogImFwcHJvdmVkIiwKICAgICAgICAiYWN0dWFsIjogImFwcHJvdmVkIgogICAgICB9LAogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJuby1jcml0aWNhbC1maW5kaW5ncyIsCiAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgInJlc3VsdCI6ICJGQUlMIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9GQUlMRUQiLAogICAgICAgICJleHBlY3RlZCI6IDAsCiAgICAgICAgImFjdHVhbCI6IDIKICAgICAgfQogICAgXSwKICAgICJlcnJvcnMiOiBbXSwKICAgICJldmlkZW5jZSI6IHsKICAgICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICAgInZhbGlkIjogdHJ1ZSwKICAgICAgImlzc3VlcyI6IFtdLAogICAgICAiZmFjdHMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAicmV2aWV3IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfQogICAgICBdLAogICAgICAibGluZWFnZSI6IFsKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImNyaXRpY2FsIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJkZXBlbmRzT24iOiBbCiAgICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICAgIF0KICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICJkZjI2YTVkZTllOWJjZmU4NGJiOGFhNWQ2ZmFhMGI1MDllOTAwMzVkNjJlMTMyNzNhODI0OWE5MjExOWYwZGMyIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICIxOWNhZGU0YTIzM2ZmZmMzMGM5NWVlODVjNDQ4NDE4YTU0YTkxMzQwMWRjMmFlZDUzMDg0ODYxMDFmZGQzZWI3IgogICAgICAgIH0KICAgICAgXQogICAgfQogIH0sCiAgInJ1bnRpbWUiOiB7CiAgICAiaW1wbGVtZW50YXRpb24iOiAiQGNvc21pYy9jb21tb25zLzAuMS4xIiwKICAgICJub2RlIjogIjI0LjE5LjAiLAogICAgInY4IjogIjEzLjYuMjMzLjE3LW5vZGUuNTEiLAogICAgInBsYXRmb3JtIjogImRhcndpbiIsCiAgICAiYXJjaGl0ZWN0dXJlIjogImFybTY0IiwKICAgICJlbmRpYW5uZXNzIjogIkxFIiwKICAgICJzb3VyY2VEaWdlc3QiOiAiZjVjMzA4MGM1MDdhM2UzYjgwOGJhZjc1MTM1OTEwMjRkODVmNDMzYTQ1OTQ2NmY2OGY5OTFmZTAxYjcxOGQwNCIKICB9LAogICJkaWdlc3QiOiAiNzIwODdjNzY1OGNhNjY0NTE3ZjRlYTYwNzljNzc2YWY1MmJjYTBmZGIxY2YzMDc1Y2MwNDQ4ZjVjOGQ5NWIzZCIKfQo=", "tests/fixtures/regression/receipts/denied.TAMPERED.receipt.json": "ewogICJzY2hlbWFWZXJzaW9uIjogMSwKICAia2luZCI6ICJwb2xpY3kiLAogICJpbnB1dCI6IHsKICAgICJhc09mIjogIjIwMjYtMDktMjhUMTg6MDA6MDAuMDAwWiIsCiAgICAiZXZpZGVuY2UiOiB7CiAgICAgICJmYWN0cyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QiLAogICAgICAgICAgInNvdXJjZUlkIjogImJ1aWxkLXJlY29yZCIsCiAgICAgICAgICAidmFsdWUiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZGVwZW5kc09uIjogWwogICAgICAgICAgICAiYXJ0aWZhY3QiCiAgICAgICAgICBdLAogICAgICAgICAgImlkIjogInRlc3RzIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogdHJ1ZQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJleHBpcmVzQXQiOiAiMjAyNi0wOS0yOVQxODowMDowMC4wMDBaIiwKICAgICAgICAgICJpZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXSwKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJ2YWx1ZSI6IDIKICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJjb250ZW50IjogewogICAgICAgICAgICAiYXJ0aWZhY3QiOiAic2hhMjU2Ojc3MzhlYThkZjBjOTgzNTk2ZDE0OWQzNDQ2NjBkYjgyOGIxYjI0NzRlMGFiYWQyYjJlZjQ2ODQxYjViZjUxNzIiLAogICAgICAgICAgICAiY3JpdGljYWxGaW5kaW5ncyI6IDIsCiAgICAgICAgICAgICJ0ZXN0c1Bhc3NlZCI6IHRydWUKICAgICAgICAgIH0sCiAgICAgICAgICAiaWQiOiAiYnVpbGQtcmVjb3JkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImNvbnRlbnQiOiB7CiAgICAgICAgICAgICJhcnRpZmFjdCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgICAgICJyZXZpZXciOiAiYXBwcm92ZWQiCiAgICAgICAgICB9LAogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiCiAgICAgICAgfQogICAgICBdCiAgICB9LAogICAgImtpbmQiOiAicG9saWN5IiwKICAgICJwb2xpY3kiOiB7CiAgICAgICJpZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgICAicnVsZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgICAiaWQiOiAiYXJ0aWZhY3QtYm91bmQiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAidGVzdHMiLAogICAgICAgICAgImlkIjogInRlc3RzLXBhc3MiLAogICAgICAgICAgIm9wIjogImVxIiwKICAgICAgICAgICJ2YWx1ZSI6IHRydWUKICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAgICJpZCI6ICJyZXZpZXdlZCIsCiAgICAgICAgICAib3AiOiAiZXEiLAogICAgICAgICAgInZhbHVlIjogImFwcHJvdmVkIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAiaWQiOiAibm8tY3JpdGljYWwtZmluZGluZ3MiLAogICAgICAgICAgIm9wIjogImx0ZSIsCiAgICAgICAgICAidmFsdWUiOiAwCiAgICAgICAgfQogICAgICBdLAogICAgICAidmVyc2lvbiI6ICIxLjAuMCIKICAgIH0KICB9LAogICJyZXN1bHQiOiB7CiAgICAic2NoZW1hIjogImNvc21pYy5wb2xpY3ktcmVwb3J0LnYxIiwKICAgICJwb2xpY3lJZCI6ICJyZWxlYXNlLWF1dGhvcml6YXRpb24iLAogICAgInBvbGljeVZlcnNpb24iOiAiMS4wLjAiLAogICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICJ2ZXJkaWN0IjogIkFMTE9XIiwKICAgICJ2ZXJkaWN0IjogIkRFTlkiLAogICAgInRyYWNlIjogWwogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJhcnRpZmFjdC1ib3VuZCIsCiAgICAgICAgImZhY3RJZCI6ICJhcnRpZmFjdCIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIsCiAgICAgICAgImFjdHVhbCI6ICJzaGEyNTY6NzczOGVhOGRmMGM5ODM1OTZkMTQ5ZDM0NDY2MGRiODI4YjFiMjQ3NGUwYWJhZDJiMmVmNDY4NDFiNWJmNTE3MiIKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAidGVzdHMtcGFzcyIsCiAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgInJlc3VsdCI6ICJQQVNTIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9TQVRJU0ZJRUQiLAogICAgICAgICJleHBlY3RlZCI6IHRydWUsCiAgICAgICAgImFjdHVhbCI6IHRydWUKICAgICAgfSwKICAgICAgewogICAgICAgICJydWxlSWQiOiAicmV2aWV3ZWQiLAogICAgICAgICJmYWN0SWQiOiAicmV2aWV3IiwKICAgICAgICAicmVzdWx0IjogIlBBU1MiLAogICAgICAgICJjb2RlIjogIlJFUVVJUkVNRU5UX1NBVElTRklFRCIsCiAgICAgICAgImV4cGVjdGVkIjogImFwcHJvdmVkIiwKICAgICAgICAiYWN0dWFsIjogImFwcHJvdmVkIgogICAgICB9LAogICAgICB7CiAgICAgICAgInJ1bGVJZCI6ICJuby1jcml0aWNhbC1maW5kaW5ncyIsCiAgICAgICAgImZhY3RJZCI6ICJjcml0aWNhbCIsCiAgICAgICAgInJlc3VsdCI6ICJGQUlMIiwKICAgICAgICAiY29kZSI6ICJSRVFVSVJFTUVOVF9GQUlMRUQiLAogICAgICAgICJleHBlY3RlZCI6IDAsCiAgICAgICAgImFjdHVhbCI6IDIKICAgICAgfQogICAgXSwKICAgICJlcnJvcnMiOiBbXSwKICAgICJldmlkZW5jZSI6IHsKICAgICAgImFzT2YiOiAiMjAyNi0wOS0yOFQxODowMDowMC4wMDBaIiwKICAgICAgInZhbGlkIjogdHJ1ZSwKICAgICAgImlzc3VlcyI6IFtdLAogICAgICAiZmFjdHMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJjcml0aWNhbCIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAicmV2aWV3IiwKICAgICAgICAgICJzdGF0dXMiOiAiQVZBSUxBQkxFIiwKICAgICAgICAgICJyZWFzb25zIjogW10KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic3RhdHVzIjogIkFWQUlMQUJMRSIsCiAgICAgICAgICAicmVhc29ucyI6IFtdCiAgICAgICAgfQogICAgICBdLAogICAgICAibGluZWFnZSI6IFsKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImFydGlmYWN0IiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFtdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiZmFjdElkIjogImNyaXRpY2FsIiwKICAgICAgICAgICJzb3VyY2VJZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJyZXZpZXciLAogICAgICAgICAgInNvdXJjZUlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImRlcGVuZHNPbiI6IFsKICAgICAgICAgICAgImFydGlmYWN0IgogICAgICAgICAgXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImZhY3RJZCI6ICJ0ZXN0cyIsCiAgICAgICAgICAic291cmNlSWQiOiAiYnVpbGQtcmVjb3JkIiwKICAgICAgICAgICJkZXBlbmRzT24iOiBbCiAgICAgICAgICAgICJhcnRpZmFjdCIKICAgICAgICAgIF0KICAgICAgICB9CiAgICAgIF0sCiAgICAgICJzb3VyY2VzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJidWlsZC1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICJkZjI2YTVkZTllOWJjZmU4NGJiOGFhNWQ2ZmFhMGI1MDllOTAwMzVkNjJlMTMyNzNhODI0OWE5MjExOWYwZGMyIgogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInJldmlldy1yZWNvcmQiLAogICAgICAgICAgImNvbnRlbnRTdGF0dXMiOiAiQ09OVEVOVF9PTkxZIiwKICAgICAgICAgICJjb21wdXRlZERpZ2VzdCI6ICIxOWNhZGU0YTIzM2ZmZmMzMGM5NWVlODVjNDQ4NDE4YTU0YTkxMzQwMWRjMmFlZDUzMDg0ODYxMDFmZGQzZWI3IgogICAgICAgIH0KICAgICAgXQogICAgfQogIH0sCiAgInJ1bnRpbWUiOiB7CiAgICAiaW1wbGVtZW50YXRpb24iOiAiQGNvc21pYy9jb21tb25zLW1qcy8wLjEuMCIsCiAgICAibm9kZSI6ICIyNC4xOC4wIiwKICAgICJ2OCI6ICIxMy42LjIzMy4xNy1ub2RlLjUwIiwKICAgICJwbGF0Zm9ybSI6ICJkYXJ3aW4iLAogICAgImFyY2hpdGVjdHVyZSI6ICJhcm02NCIsCiAgICAiZW5kaWFubmVzcyI6ICJMRSIsCiAgICAic291cmNlRGlnZXN0IjogIjkwYTZmZWUzMWFjMjJjZTc2OWE2YzU3ZTcyYjRiNDZlY2QyNGVlMjE5YzQxZmQzYjEyMjNlOTcyZjE5MTEyZjIiCiAgfSwKICAiZGlnZXN0IjogImIxZjdmZjFjODA4MGIyMjM1YzRjYzdhMzM0ZjMzMWZhMWUxODNkMTUzYzhhNzRjNDJkZmU2NmQwMDdlMmY5OTciCn0K", "web/app.js": "Ly8gQ29weXJpZ2h0IDIwMjYgTGVsYW5kIEpvdXJkYW4gSUkgLyBDJkwgU3RyYXRlZ3kKLy8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAKJ3VzZSBzdHJpY3QnOwoKKCgpID0+IHsKICBjb25zdCAkID0gKGlkKSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7CiAgY29uc3Qgc3RhdGUgPSB7IGV4YW1wbGVzOiBbXSwgc2VsZWN0ZWRFeGFtcGxlOiBudWxsLCByZWNlaXB0OiBudWxsLCBydW5uaW5nOiBmYWxzZSwgdmVyaWZ5aW5nOiBmYWxzZSwgaW1wb3J0ZWRSZWNlaXB0VGV4dDogbnVsbCwgdG9hc3RUaW1lcjogbnVsbCB9OwogIGNvbnN0IE1BWF9JTVBPUlRfQllURVMgPSAxXzkwMF8wMDA7CiAgY29uc3QgdGV4dCA9ICh0YWcsIGNvbnRlbnQsIGNsYXNzTmFtZSkgPT4gewogICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTsKICAgIGlmIChjbGFzc05hbWUpIGVsZW1lbnQuY2xhc3NOYW1lID0gY2xhc3NOYW1lOwogICAgZWxlbWVudC50ZXh0Q29udGVudCA9IFN0cmluZyhjb250ZW50ID8/ICcnKTsKICAgIHJldHVybiBlbGVtZW50OwogIH07CiAgY29uc3QganNvbiA9ICh2YWx1ZSkgPT4gSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsIDIpOwogIGNvbnN0IGlzT2JqZWN0ID0gKHZhbHVlKSA9PiB2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTsKICBjb25zdCBodW1hbml6ZSA9ICh2YWx1ZSkgPT4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC8oW2EtejAtOV0pKFtBLVpdKS9nLCAnJDEgJDInKS5yZXBsYWNlKC9bXy1dL2csICcgJykucmVwbGFjZSgvXi4vLCAocykgPT4gcy50b1VwcGVyQ2FzZSgpKTsKICBjb25zdCBzaG9ydFZhbHVlID0gKHZhbHVlKSA9PiB7CiAgICAvLyBQcmVzZXJ2ZSBldmVyeSBkaXNwbGF5ZWQgYmluYXJ5NjQgZGlnaXQsIGluY2x1ZGluZyBwb2xpY3kgdGhyZXNob2xkIGRpZmZlcmVuY2VzLgogICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHJldHVybiBTdHJpbmcodmFsdWUpOwogICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSByZXR1cm4gdmFsdWUgPyAnWWVzJyA6ICdObyc7CiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiAnTm9uZSc7CiAgICBpZiAoaXNPYmplY3QodmFsdWUpIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpOwogICAgcmV0dXJuIFN0cmluZyh2YWx1ZSA/PyAn4oCUJyk7CiAgfTsKCiAgZnVuY3Rpb24gc2hvd0Vycm9yKGlkLCBtZXNzYWdlKSB7ICQoaWQpLnRleHRDb250ZW50ID0gbWVzc2FnZSB8fCAnJzsgJChpZCkuaGlkZGVuID0gIW1lc3NhZ2U7IH0KICBmdW5jdGlvbiB0b2FzdChtZXNzYWdlKSB7CiAgICBjbGVhclRpbWVvdXQoc3RhdGUudG9hc3RUaW1lcik7CiAgICAkKCd0b2FzdCcpLnRleHRDb250ZW50ID0gbWVzc2FnZTsKICAgICQoJ3RvYXN0JykuaGlkZGVuID0gZmFsc2U7CiAgICBzdGF0ZS50b2FzdFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7ICQoJ3RvYXN0JykuaGlkZGVuID0gdHJ1ZTsgfSwgMzUwMCk7CiAgfQogIGZ1bmN0aW9uIGNvbm5lY3Rpb24ob25saW5lKSB7CiAgICAkKCdjb25uZWN0aW9uJykuY2xhc3NOYW1lID0gYGNvbm5lY3Rpb24gJHtvbmxpbmUgPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnfWA7CiAgICAkKCdjb25uZWN0aW9uLWxhYmVsJykudGV4dENvbnRlbnQgPSBvbmxpbmUgPyAnTG9jYWwgc2VydmljZSByZWFkeScgOiAnU2VydmljZSB1bmF2YWlsYWJsZSc7CiAgfQogIGFzeW5jIGZ1bmN0aW9uIGFwaShwYXRoLCBib2R5LCByYXcgPSBmYWxzZSwgZXh0cmFIZWFkZXJzID0ge30pIHsKICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7CiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDQ1MDAwKTsKICAgIHRyeSB7CiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2gocGF0aCwgeyBtZXRob2Q6IGJvZHkgPT09IHVuZGVmaW5lZCA/ICdHRVQnIDogJ1BPU1QnLCBoZWFkZXJzOiBib2R5ID09PSB1bmRlZmluZWQgPyB7fSA6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJywgLi4uZXh0cmFIZWFkZXJzIH0sIGJvZHk6IGJvZHkgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHJhdyA/IGJvZHkgOiBKU09OLnN0cmluZ2lmeShib2R5KSwgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTsKICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiBudWxsKTsKICAgICAgY29ubmVjdGlvbih0cnVlKTsKICAgICAgaWYgKCFyZXNwb25zZS5vaykgewogICAgICAgIGNvbnN0IHByb2JsZW0gPSBkYXRhPy5lcnJvcj8ubWVzc2FnZSB8fCBkYXRhPy5lcnJvciB8fCBkYXRhPy5tZXNzYWdlIHx8IGBSZXF1ZXN0IGZhaWxlZCAoJHtyZXNwb25zZS5zdGF0dXN9KS5gOwogICAgICAgIHRocm93IG5ldyBFcnJvcih0eXBlb2YgcHJvYmxlbSA9PT0gJ3N0cmluZycgPyBwcm9ibGVtIDoganNvbihwcm9ibGVtKSk7CiAgICAgIH0KICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHRocm93IG5ldyBFcnJvcignVGhlIGxvY2FsIHNlcnZpY2UgcmV0dXJuZWQgYW4gZW1wdHkgb3IgaW52YWxpZCBKU09OIHJlc3BvbnNlLicpOwogICAgICByZXR1cm4gZGF0YTsKICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHRocm93IG5ldyBFcnJvcignVGhlIHJlcXVlc3QgdGltZWQgb3V0LiBDaGVjayB0aGUgbG9jYWwgc2VydmljZSBhbmQgdHJ5IGFnYWluLicpOwogICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHsgY29ubmVjdGlvbihmYWxzZSk7IHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlYWNoIHRoZSBsb2NhbCBzZXJ2aWNlLiBNYWtlIHN1cmUgQ09TTUlDIENvbW1vbnMgaXMgcnVubmluZywgdGhlbiB0cnkgYWdhaW4uJyk7IH0KICAgICAgdGhyb3cgZXJyb3I7CiAgICB9IGZpbmFsbHkgeyBjbGVhclRpbWVvdXQodGltZW91dCk7IH0KICB9CgogIGZ1bmN0aW9uIHNldE1vZGUobW9kZSwgZm9jdXMgPSBmYWxzZSkgewogICAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgWydydW4nLCAndmVyaWZ5J10pIHsKICAgICAgY29uc3QgYWN0aXZlID0gY2FuZGlkYXRlID09PSBtb2RlOwogICAgICBjb25zdCB0YWIgPSAkKGAke2NhbmRpZGF0ZX0tdGFiYCk7CiAgICAgIHRhYi5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnLCBhY3RpdmUpOwogICAgICB0YWIuc2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJywgU3RyaW5nKGFjdGl2ZSkpOwogICAgICB0YWIudGFiSW5kZXggPSBhY3RpdmUgPyAwIDogLTE7CiAgICAgICQoYCR7Y2FuZGlkYXRlfS1wYW5lbGApLmhpZGRlbiA9ICFhY3RpdmU7CiAgICB9CiAgICBpZiAoZm9jdXMpICQoYCR7bW9kZX0tdGFiYCkuZm9jdXMoKTsKICB9CiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbW9kZV0nKS5mb3JFYWNoKChidXR0b24pID0+IHsKICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHNldE1vZGUoYnV0dG9uLmRhdGFzZXQubW9kZSkpOwogICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHsKICAgICAgaWYgKFsnQXJyb3dMZWZ0JywgJ0Fycm93UmlnaHQnLCAnSG9tZScsICdFbmQnXS5pbmNsdWRlcyhldmVudC5rZXkpKSB7CiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsKICAgICAgICBjb25zdCBtb2RlID0gZXZlbnQua2V5ID09PSAnSG9tZScgPyAncnVuJyA6IGV2ZW50LmtleSA9PT0gJ0VuZCcgPyAndmVyaWZ5JyA6IGJ1dHRvbi5kYXRhc2V0Lm1vZGUgPT09ICdydW4nID8gJ3ZlcmlmeScgOiAncnVuJzsKICAgICAgICBzZXRNb2RlKG1vZGUsIHRydWUpOwogICAgICB9CiAgICB9KTsKICB9KTsKCiAgZnVuY3Rpb24gdXBkYXRlRWRpdG9yTWV0YSgpIHsKICAgIGNvbnN0IHZhbHVlID0gJCgnaW5wdXQtZWRpdG9yJykudmFsdWU7CiAgICBjb25zdCBsaW5lcyA9IHZhbHVlID8gdmFsdWUuc3BsaXQoJ1xuJykubGVuZ3RoIDogMDsKICAgICQoJ2VkaXRvci1tZXRhJykudGV4dENvbnRlbnQgPSBgJHtsaW5lc30gJHtsaW5lcyA9PT0gMSA/ICdsaW5lJyA6ICdsaW5lcyd9IMK3ICR7bmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHZhbHVlKS5sZW5ndGgudG9Mb2NhbGVTdHJpbmcoJ2VuLVVTJyl9IGJ5dGVzYDsKICB9CiAgZnVuY3Rpb24gbWFya1Jlc3VsdFN0YWxlKG1lc3NhZ2UgPSAnSW5wdXQgY2hhbmdlZC4gUnVuIGl0IHRvIGNyZWF0ZSBhIG5ldyByZWNlaXB0LicpIHsKICAgIGlmICghc3RhdGUucmVjZWlwdCkgcmV0dXJuOwogICAgJCgncmVzdWx0LWtpbmQnKS50ZXh0Q29udGVudCA9ICdQUkVWSU9VUyBSRVNVTFQnOwogICAgJCgncmVzdWx0LWtpbmQnKS5jbGFzc05hbWUgPSAncGlsbCB3YXJuaW5nJzsKICAgICQoJ2lucHV0LWhlbHAnKS50ZXh0Q29udGVudCA9IG1lc3NhZ2U7CiAgfQogIGZ1bmN0aW9uIGNob29zZUV4YW1wbGUoZXhhbXBsZSkgewogICAgc3RhdGUuc2VsZWN0ZWRFeGFtcGxlID0gZXhhbXBsZS5pZDsKICAgICQoJ2lucHV0LWVkaXRvcicpLnZhbHVlID0ganNvbihleGFtcGxlLmlucHV0KTsKICAgICQoJ2lucHV0LWZpbGVuYW1lJykudGV4dENvbnRlbnQgPSBgJHtleGFtcGxlLmlkfS5qc29uYDsKICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5leGFtcGxlLWNhcmQnKS5mb3JFYWNoKChidXR0b24pID0+IHsKICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBidXR0b24uZGF0YXNldC5leGFtcGxlID09PSBleGFtcGxlLmlkOwogICAgICBidXR0b24uY2xhc3NMaXN0LnRvZ2dsZSgnc2VsZWN0ZWQnLCBzZWxlY3RlZCk7CiAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIFN0cmluZyhzZWxlY3RlZCkpOwogICAgfSk7CiAgICB1cGRhdGVFZGl0b3JNZXRhKCk7CiAgICBzaG93RXJyb3IoJ3J1bi1lcnJvcicsICcnKTsKICAgIG1hcmtSZXN1bHRTdGFsZSgpOwogIH0KICBhc3luYyBmdW5jdGlvbiBsb2FkRXhhbXBsZXMoKSB7CiAgICB0cnkgewogICAgICBjb25zdCBkYXRhID0gYXdhaXQgYXBpKCcvYXBpL2V4YW1wbGVzJyk7CiAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhLmV4YW1wbGVzKSB8fCAhZGF0YS5leGFtcGxlcy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignVGhlIHNlcnZpY2UgZGlkIG5vdCByZXR1cm4gYW55IGV4YW1wbGVzLiBZb3UgY2FuIHN0aWxsIHBhc3RlIGFuIGlucHV0IGJlbG93LicpOwogICAgICBzdGF0ZS5leGFtcGxlcyA9IGRhdGEuZXhhbXBsZXM7CiAgICAgICQoJ2V4YW1wbGVzJykucmVwbGFjZUNoaWxkcmVuKCk7CiAgICAgIGRhdGEuZXhhbXBsZXMuZm9yRWFjaCgoZXhhbXBsZSwgaW5kZXgpID0+IHsKICAgICAgICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTsKICAgICAgICBidXR0b24udHlwZSA9ICdidXR0b24nOyBidXR0b24uY2xhc3NOYW1lID0gJ2V4YW1wbGUtY2FyZCc7IGJ1dHRvbi5kYXRhc2V0LmV4YW1wbGUgPSBleGFtcGxlLmlkOyBidXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnLCAnZmFsc2UnKTsKICAgICAgICBidXR0b24uYXBwZW5kKHRleHQoJ3NwYW4nLCBTdHJpbmcoaW5kZXggKyAxKS5wYWRTdGFydCgyLCAnMCcpLCAnZXhhbXBsZS1udW1iZXInKSk7CiAgICAgICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTsKICAgICAgICBjb250ZW50LmFwcGVuZCh0ZXh0KCdzcGFuJywgZXhhbXBsZS5uYW1lLCAnZXhhbXBsZS10aXRsZScpLCB0ZXh0KCdzcGFuJywgZXhhbXBsZS5kZXNjcmlwdGlvbiwgJ2V4YW1wbGUtZGVzY3JpcHRpb24nKSk7CiAgICAgICAgYnV0dG9uLmFwcGVuZChjb250ZW50LCB0ZXh0KCdzcGFuJywgJ+KGlycsICdleGFtcGxlLWFycm93JykpOwogICAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNob29zZUV4YW1wbGUoZXhhbXBsZSkpOwogICAgICAgICQoJ2V4YW1wbGVzJykuYXBwZW5kKGJ1dHRvbik7CiAgICAgIH0pOwogICAgICBjaG9vc2VFeGFtcGxlKGRhdGEuZXhhbXBsZXNbMF0pOwogICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgJCgnZXhhbXBsZXMnKS5yZXBsYWNlQ2hpbGRyZW4oKTsKICAgICAgc2hvd0Vycm9yKCdleGFtcGxlcy1lcnJvcicsIGVycm9yLm1lc3NhZ2UpOwogICAgfQogIH0KICAkKCdpbnB1dC1lZGl0b3InKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsKICAgIHVwZGF0ZUVkaXRvck1ldGEoKTsKICAgICQoJ2lucHV0LWhlbHAnKS50ZXh0Q29udGVudCA9IHN0YXRlLnJlY2VpcHQgPyAnSW5wdXQgY2hhbmdlZC4gUnVuIGl0IHRvIGNyZWF0ZSBhIG5ldyByZWNlaXB0LicgOiAnRXZlcnkgYXNzdW1wdGlvbiBpcyBwYXJ0IG9mIHRoZSBpbnB1dC4nOwogICAgbWFya1Jlc3VsdFN0YWxlKCk7CiAgfSk7CiAgJCgnZm9ybWF0LWJ1dHRvbicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogICAgY29uc3Qgc3VibWl0dGVkVGV4dCA9ICQoJ2lucHV0LWVkaXRvcicpLnZhbHVlOwogICAgJCgnZm9ybWF0LWJ1dHRvbicpLmRpc2FibGVkID0gdHJ1ZTsKICAgIHRyeSB7CiAgICAgIC8vIFJhdyBpbmdyZXNzIG11c3QgcmVhY2ggdGhlIHNoYXJlZCBwYXJzZXIgYmVmb3JlIGFueSBKU09OIHJvdW5kIHRyaXAuCiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXBpKCcvYXBpL2Zvcm1hdCcsIHN1Ym1pdHRlZFRleHQsIHRydWUpOwogICAgICBpZiAodHlwZW9mIHJlc3BvbnNlLmZvcm1hdHRlZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcignVGhlIHNlcnZpY2UgZGlkIG5vdCByZXR1cm4gZm9ybWF0dGVkIEpTT04uJyk7CiAgICAgIGlmICgkKCdpbnB1dC1lZGl0b3InKS52YWx1ZSAhPT0gc3VibWl0dGVkVGV4dCkgeyB0b2FzdCgnSW5wdXQgY2hhbmdlZCBkdXJpbmcgZm9ybWF0dGluZy4gWW91ciBlZGl0cyB3ZXJlIGtlcHQuJyk7IHJldHVybjsgfQogICAgICAkKCdpbnB1dC1lZGl0b3InKS52YWx1ZSA9IHJlc3BvbnNlLmZvcm1hdHRlZDsgdXBkYXRlRWRpdG9yTWV0YSgpOyBzaG93RXJyb3IoJ3J1bi1lcnJvcicsICcnKTsgbWFya1Jlc3VsdFN0YWxlKCk7CiAgICB9IGNhdGNoIChlcnJvcikgeyBzaG93RXJyb3IoJ3J1bi1lcnJvcicsIGBJbnB1dCB3YXMgbm90IGZvcm1hdHRlZDogJHtlcnJvci5tZXNzYWdlfWApOyBtYXJrUmVzdWx0U3RhbGUoJ0Zvcm1hdHRpbmcgZmFpbGVkLiBUaGUgaW5wdXQgYW5kIHByZXZpb3VzIHJlY2VpcHQgd2VyZSBrZXB0LicpOyB9CiAgICBmaW5hbGx5IHsgJCgnZm9ybWF0LWJ1dHRvbicpLmRpc2FibGVkID0gZmFsc2U7IH0KICB9KTsKICAkKCdpbnB1dC1lZGl0b3InKS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7IGlmIChldmVudC5rZXkgPT09ICdFbnRlcicgJiYgKGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSkpIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgcnVuKCk7IH0gfSk7CgogIGZ1bmN0aW9uIGNhcmQobGFiZWwsIHZhbHVlLCBub3RlKSB7CiAgICBjb25zdCBlbGVtZW50ID0gdGV4dCgnZGl2JywgJycsICdzdW1tYXJ5LWNhcmQnKTsKICAgIGVsZW1lbnQuYXBwZW5kKHRleHQoJ3NwYW4nLCBsYWJlbCwgJ3N1bW1hcnktY2FyZC1sYWJlbCcpKTsKICAgIGNvbnN0IGRpc3BsYXkgPSBzaG9ydFZhbHVlKHZhbHVlKTsKICAgIGVsZW1lbnQuYXBwZW5kKHRleHQoJ2RpdicsIGRpc3BsYXksIGBzdW1tYXJ5LWNhcmQtdmFsdWUke2Rpc3BsYXkubGVuZ3RoID4gMTMgPyAnIGxvbmcnIDogJyd9YCkpOwogICAgaWYgKG5vdGUpIGVsZW1lbnQuYXBwZW5kKHRleHQoJ2RpdicsIG5vdGUsICdzdW1tYXJ5LWNhcmQtbm90ZScpKTsKICAgIHJldHVybiBlbGVtZW50OwogIH0KICBmdW5jdGlvbiBzZWN0aW9uKHRpdGxlKSB7CiAgICBjb25zdCBlbGVtZW50ID0gdGV4dCgnc2VjdGlvbicsICcnLCAnZGV0YWlsLXNlY3Rpb24nKTsKICAgIGVsZW1lbnQuYXBwZW5kKHRleHQoJ2gzJywgdGl0bGUpKTsKICAgIHJldHVybiBlbGVtZW50OwogIH0KICBmdW5jdGlvbiB0YWJsZSh0aXRsZSwgcm93cywgcHJlZmVycmVkS2V5cykgewogICAgaWYgKCFBcnJheS5pc0FycmF5KHJvd3MpIHx8ICFyb3dzLmxlbmd0aCkgcmV0dXJuIG51bGw7CiAgICBjb25zdCBub3JtYWxpemVkID0gcm93cy5tYXAoKHJvdykgPT4gaXNPYmplY3Qocm93KSA/IHJvdyA6IHsgdmFsdWU6IHJvdyB9KTsKICAgIGNvbnN0IGFsbEtleXMgPSBbLi4ubmV3IFNldChub3JtYWxpemVkLmZsYXRNYXAoT2JqZWN0LmtleXMpKV07CiAgICBjb25zdCBrZXlzID0gcHJlZmVycmVkS2V5cz8uZmlsdGVyKChrZXkpID0+IGFsbEtleXMuaW5jbHVkZXMoa2V5KSkgfHwgYWxsS2V5cy5zbGljZSgwLCA1KTsKICAgIGlmICgha2V5cy5sZW5ndGgpIHJldHVybiBudWxsOwogICAgY29uc3QgZWxlbWVudCA9IHNlY3Rpb24odGl0bGUpOwogICAgY29uc3Qgd3JhcHBlciA9IHRleHQoJ2RpdicsICcnLCAnZGF0YS10YWJsZS13cmFwJyk7CiAgICBjb25zdCB0YWJsZUVsZW1lbnQgPSB0ZXh0KCd0YWJsZScsICcnLCAnZGF0YS10YWJsZScpOwogICAgY29uc3QgaGVhZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RoZWFkJyk7IGNvbnN0IGhlYWRlclJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7CiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4geyBjb25zdCBjZWxsID0gdGV4dCgndGgnLCBodW1hbml6ZShrZXkpKTsgY2VsbC5zY29wZSA9ICdjb2wnOyBoZWFkZXJSb3cuYXBwZW5kKGNlbGwpOyB9KTsKICAgIGhlYWQuYXBwZW5kKGhlYWRlclJvdyk7IHRhYmxlRWxlbWVudC5hcHBlbmQoaGVhZCk7CiAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGJvZHknKTsKICAgIG5vcm1hbGl6ZWQuc2xpY2UoMCwgNDApLmZvckVhY2goKHJvdykgPT4geyBjb25zdCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7IGtleXMuZm9yRWFjaCgoa2V5KSA9PiB0ci5hcHBlbmQodGV4dCgndGQnLCBzaG9ydFZhbHVlKHJvd1trZXldKSkpKTsgYm9keS5hcHBlbmQodHIpOyB9KTsKICAgIHRhYmxlRWxlbWVudC5hcHBlbmQoYm9keSk7IHdyYXBwZXIuYXBwZW5kKHRhYmxlRWxlbWVudCk7IGVsZW1lbnQuYXBwZW5kKHdyYXBwZXIpOwogICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoID4gNDApIGVsZW1lbnQuYXBwZW5kKHRleHQoJ3AnLCBgU2hvd2luZyA0MCBvZiAke25vcm1hbGl6ZWQubGVuZ3RofSByb3dzLiBBbGwgcm93cyBhcmUgaW4gdGhlIGZ1bGwgcmVzdWx0IGJlbG93LmAsICdyZXN1bHQtZXhwbGFuYXRpb24nKSk7CiAgICByZXR1cm4gZWxlbWVudDsKICB9CiAgZnVuY3Rpb24gcmVjb3Jkcyh2YWx1ZSwgbmFtZUtleSA9ICduYW1lJykgewogICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7CiAgICBpZiAoaXNPYmplY3QodmFsdWUpKSByZXR1cm4gT2JqZWN0LmVudHJpZXModmFsdWUpLm1hcCgoW2tleSwgdmFsXSkgPT4gaXNPYmplY3QodmFsKSA/IHsgW25hbWVLZXldOiBrZXksIC4uLnZhbCB9IDogeyBbbmFtZUtleV06IGtleSwgdmFsdWU6IHZhbCB9KTsKICAgIHJldHVybiBbXTsKICB9CiAgZnVuY3Rpb24gYXBwZW5kVGFibGUodGl0bGUsIHJvd3MsIGtleXMpIHsgY29uc3QgZWxlbWVudCA9IHRhYmxlKHRpdGxlLCByb3dzLCBrZXlzKTsgaWYgKGVsZW1lbnQpICQoJ3Jlc3VsdC1kZXRhaWxzJykuYXBwZW5kKGVsZW1lbnQpOyB9CgogIGZ1bmN0aW9uIHJlbmRlclJlY2VpcHQocmVjZWlwdCkgewogICAgY29uc3QgcmVzdWx0ID0gcmVjZWlwdC5yZXN1bHQgPz8ge307CiAgICBjb25zdCBraW5kID0gcmVjZWlwdC5raW5kIHx8IHJlY2VpcHQuaW5wdXQ/LmtpbmQgfHwgJ3Jlc3VsdCc7CiAgICBjb25zdCBjYXJkcyA9ICQoJ3N1bW1hcnktY2FyZHMnKTsgY2FyZHMucmVwbGFjZUNoaWxkcmVuKCk7CiAgICAkKCdyZXN1bHQtZGV0YWlscycpLnJlcGxhY2VDaGlsZHJlbigpOwogICAgJCgnZGVjaXNpb24tbm90aWNlJykucmVwbGFjZUNoaWxkcmVuKCk7ICQoJ2RlY2lzaW9uLW5vdGljZScpLmhpZGRlbiA9IHRydWU7CiAgICAkKCdyZXN1bHQta2luZCcpLnRleHRDb250ZW50ID0gaHVtYW5pemUoa2luZCkudG9VcHBlckNhc2UoKTsgJCgncmVzdWx0LWtpbmQnKS5jbGFzc05hbWUgPSAncGlsbCByZWFkeSc7CiAgICAkKCdlbXB0eS1yZXN1bHQnKS5oaWRkZW4gPSB0cnVlOyAkKCdyZXN1bHQtY29udGVudCcpLmhpZGRlbiA9IGZhbHNlOwogICAgaWYgKGtpbmQgPT09ICdwb2xpY3knKSB7CiAgICAgIGNvbnN0IHZlcmRpY3QgPSByZXN1bHQudmVyZGljdCA/PyByZXN1bHQuZGVjaXNpb24gPz8gcmVzdWx0Lm91dGNvbWUgPz8gJ0NvbXB1dGVkJzsKICAgICAgY29uc3QgZGVjaXNpb24gPSBpc09iamVjdCh2ZXJkaWN0KSA/IHZlcmRpY3QudmVyZGljdCA/PyB2ZXJkaWN0Lm91dGNvbWUgPz8gJ0NvbXB1dGVkJyA6IHZlcmRpY3Q7CiAgICAgICQoJ3Jlc3VsdC1raW5kJykudGV4dENvbnRlbnQgPSBgUE9MSUNZIMK3ICR7U3RyaW5nKGRlY2lzaW9uKS50b1VwcGVyQ2FzZSgpfWA7CiAgICAgICQoJ3Jlc3VsdC1raW5kJykuY2xhc3NOYW1lID0gYHBpbGwgJHtkZWNpc2lvbiA9PT0gJ0FMTE9XJyA/ICdyZWFkeScgOiBkZWNpc2lvbiA9PT0gJ0RFRkVSJyA/ICd3YXJuaW5nJyA6IFsnREVOWScsICdFUlJPUiddLmluY2x1ZGVzKGRlY2lzaW9uKSA/ICdpbnZhbGlkJyA6ICd3YXJuaW5nJ31gOwogICAgICBjb25zdCB0cmFjZSA9IHJlY29yZHMocmVzdWx0LnRyYWNlID8/IHJlc3VsdC5ldmFsdWF0aW9ucyA/PyByZXN1bHQucnVsZXMpOwogICAgICBjb25zdCBldmlkZW5jZUZhY3RzID0gcmVjb3JkcyhyZXN1bHQuZXZpZGVuY2U/LmZhY3RzKTsKICAgICAgY2FyZHMuYXBwZW5kKGNhcmQoJ0RlY2lzaW9uJywgZGVjaXNpb24pLCBjYXJkKCdSdWxlcyBldmFsdWF0ZWQnLCB0cmFjZS5sZW5ndGgpLCBjYXJkKCdFdmlkZW5jZSBmYWN0cycsIGV2aWRlbmNlRmFjdHMubGVuZ3RoKSk7CiAgICAgICQoJ3Jlc3VsdC1leHBsYW5hdGlvbicpLnRleHRDb250ZW50ID0gJ1RoZSBkZWNpc2lvbiBmb2xsb3dzIHRoZSBkZWNsYXJlZCBwb2xpY3kgYW5kIHN1cHBsaWVkIGV2aWRlbmNlLiBJbnNwZWN0IHRoZSBydWxlIHRyYWNlIHRvIHNlZSB3aGljaCBjb25kaXRpb25zIGRldGVybWluZWQgdGhlIG91dGNvbWUuJzsKICAgICAgYXBwZW5kVGFibGUoJ0RlY2lzaW9uIHRyYWNlJywgdHJhY2UsIFsncnVsZUlkJywgJ3Jlc3VsdCcsICdhY3R1YWwnLCAnZXhwZWN0ZWQnLCAnY29kZSddKTsKICAgICAgYXBwZW5kVGFibGUoJ0V2aWRlbmNlIGF2YWlsYWJpbGl0eScsIGV2aWRlbmNlRmFjdHMsIFsnaWQnLCAnc3RhdHVzJywgJ3JlYXNvbnMnXSk7CiAgICAgIGFwcGVuZFRhYmxlKCdFdmlkZW5jZSBsaW5lYWdlJywgcmVjb3JkcyhyZXN1bHQuZXZpZGVuY2U/LmxpbmVhZ2UpKTsKICAgICAgYXBwZW5kVGFibGUoJ0V2aWRlbmNlIGlzc3VlcycsIHJlY29yZHMocmVzdWx0LmV2aWRlbmNlPy5pc3N1ZXMpKTsKICAgICAgYXBwZW5kVGFibGUoJ1BvbGljeSBlcnJvcnMnLCByZWNvcmRzKHJlc3VsdC5lcnJvcnMpKTsKICAgICAgaWYgKHJlc3VsdC5yZWFzb25zKSBhcHBlbmRUYWJsZSgnUmVhc29ucycsIHJlY29yZHMocmVzdWx0LnJlYXNvbnMpKTsKICAgICAgaWYgKHJlc3VsdC5taXNzaW5nRXZpZGVuY2UpIGFwcGVuZFRhYmxlKCdNaXNzaW5nIGV2aWRlbmNlJywgcmVjb3JkcyhyZXN1bHQubWlzc2luZ0V2aWRlbmNlKSk7CiAgICB9IGVsc2UgaWYgKGtpbmQgPT09ICdkaXNjb3ZlcnknKSB7CiAgICAgIGNvbnN0IHNuYXBzaG90ID0gcmVzdWx0LnNuYXBzaG90ID8/IHJlc3VsdDsKICAgICAgY29uc3QgYmVsaWVmcyA9IHJlY29yZHMoc25hcHNob3QucG9zdGVyaW9yID8/IHJlc3VsdC5iZWxpZWZzID8/IHJlc3VsdC5wb3N0ZXJpb3IgPz8gcmVzdWx0LnBvc3RlcmlvcnMgPz8gcmVzdWx0Lmh5cG90aGVzZXMsICdoeXBvdGhlc2lzJyk7CiAgICAgIGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IHJlc3VsdC5yZWNvbW1lbmRhdGlvbiA/IFtyZXN1bHQucmVjb21tZW5kYXRpb25dIDogcmVjb3JkcyhyZXN1bHQucmVjb21tZW5kYXRpb25zID8/IHJlc3VsdC5leHBlcmltZW50cyA/PyByZXN1bHQubmV4dEV4cGVyaW1lbnRzKTsKICAgICAgY29uc3QgYWRlcXVhY3kgPSByZXN1bHQuYWRlcXVhY3k7CiAgICAgIGNvbnN0IGFkZXF1YWN5RGlzcGxheSA9IGlzT2JqZWN0KGFkZXF1YWN5KSA/IGFkZXF1YWN5LnN0YXR1cyA/PyBhZGVxdWFjeS52ZXJkaWN0ID8/IGFkZXF1YWN5LmFkZXF1YXRlIDogYWRlcXVhY3k7CiAgICAgIGNvbnN0IGRlZmVycmVkID0gcmVzdWx0LmRlY2lzaW9uU3RhdHVzICE9PSAnQVZBSUxBQkxFJyB8fCBzbmFwc2hvdC5tb2RlbE1pc21hdGNoID09PSB0cnVlIHx8IGFkZXF1YWN5RGlzcGxheSAhPT0gJ05PVF9SRUpFQ1RFRCc7CiAgICAgIGNvbnN0IGRlY2lzaW9uU3RhdHVzID0gWydERU5ZJywgJ0VSUk9SJ10uaW5jbHVkZXMocmVzdWx0LmRlY2lzaW9uU3RhdHVzKSA/IHJlc3VsdC5kZWNpc2lvblN0YXR1cyA6IGRlZmVycmVkID8gJ0RFRkVSJyA6ICdBVkFJTEFCTEUnOwogICAgICBjb25zdCBhZGVxdWFjeUxhYmVsID0geyBOT1RfUkVKRUNURUQ6ICdOb3QgcmVqZWN0ZWQnLCBSRUpFQ1RFRF9ERUNMQVJFRF9GQU1JTFk6ICdSZWplY3RlZCBmYW1pbHknLCBaRVJPX1NVUFBPUlRfQ09OVFJBRElDVElPTjogJ1plcm8gc3VwcG9ydCcsIE5PVF9FVkFMVUFURUQ6ICdOb3QgZXZhbHVhdGVkJywgVU5TVVBQT1JURUQ6ICdVbnN1cHBvcnRlZCcgfVthZGVxdWFjeURpc3BsYXldID8/IGFkZXF1YWN5RGlzcGxheSA/PyAnTm90IGV2YWx1YXRlZCc7CiAgICAgIGNhcmRzLmFwcGVuZChjYXJkKCdEZWNpc2lvbiBzdGF0dXMnLCBkZWNpc2lvblN0YXR1cywgZGVmZXJyZWQgPyAnQWN0aW9uIHdpdGhoZWxkJyA6ICdDb25kaXRpb25hbCBvbiB0aGUgbW9kZWwnKSwgY2FyZCgnQnVkZ2V0IGxlZnQnLCBzbmFwc2hvdC5yZW1haW5pbmdCdWRnZXQgPz8gJ+KAlCcsICdEZWNsYXJlZCBjb3N0IHVuaXRzJyksIGNhcmQoJ0FkZXF1YWN5JywgYWRlcXVhY3lMYWJlbCwgYWRlcXVhY3lEaXNwbGF5ID09PSAnTk9UX1JFSkVDVEVEJyA/ICdOb3QgYSBtb2RlbCBhcHByb3ZhbCcgOiB1bmRlZmluZWQpKTsKICAgICAgJCgncmVzdWx0LWtpbmQnKS50ZXh0Q29udGVudCA9IGBESVNDT1ZFUlkgwrcgJHtkZWNpc2lvblN0YXR1c31gOwogICAgICAkKCdyZXN1bHQta2luZCcpLmNsYXNzTmFtZSA9IGBwaWxsICR7ZGVmZXJyZWQgPyBbJ0RFTlknLCAnRVJST1InXS5pbmNsdWRlcyhkZWNpc2lvblN0YXR1cykgPyAnaW52YWxpZCcgOiAnd2FybmluZycgOiAncmVhZHknfWA7CiAgICAgIGlmIChkZWZlcnJlZCkgewogICAgICAgIGNvbnN0IHJlYXNvbiA9IHNuYXBzaG90Lm1vZGVsTWlzbWF0Y2ggfHwgYWRlcXVhY3lEaXNwbGF5ID09PSAnWkVST19TVVBQT1JUX0NPTlRSQURJQ1RJT04nCiAgICAgICAgICA/ICdBbiBvYnNlcnZhdGlvbiBoYXMgemVybyBzdXBwb3J0IHVuZGVyIHRoZSBhY3RpdmUgbW9kZWwgZmFtaWx5LicKICAgICAgICAgIDogYWRlcXVhY3lEaXNwbGF5ID09PSAnUkVKRUNURURfREVDTEFSRURfRkFNSUxZJwogICAgICAgICAgICA/ICdUaGUgYWRlcXVhY3kgbW9uaXRvciByZWplY3RlZCB0aGUgYWN0aXZlIG1vZGVsIGZhbWlseS4nCiAgICAgICAgICAgIDogYWRlcXVhY3lEaXNwbGF5ID09PSAnVU5TVVBQT1JURUQnCiAgICAgICAgICAgICAgPyBgQWRlcXVhY3kgaXMgVU5TVVBQT1JURUQuICR7YWRlcXVhY3kucmVhc29uIHx8ICdUaGUgZGVjbGFyZWQgZXhwZXJpbWVudCBpcyBvdXRzaWRlIHRoaXMgbW9uaXRvcuKAmXMgc3VwcG9ydGVkIHNjb3BlLid9YAogICAgICAgICAgICAgIDogYWRlcXVhY3lEaXNwbGF5ID09PSAnTk9UX0VWQUxVQVRFRCcgfHwgYWRlcXVhY3lEaXNwbGF5ID09IG51bGwKICAgICAgICAgICAgICAgID8gYEFkZXF1YWN5IGlzIE5PVF9FVkFMVUFURUQuICR7YWRlcXVhY3k/LnJlYXNvbiB8fCAnTm8gZmFtaWx5IGFkZXF1YWN5IGFzc2Vzc21lbnQgd2FzIG1hZGUuJ31gCiAgICAgICAgICAgICAgICA6ICdUaGlzIHJ1biBkb2VzIG5vdCBzdXBwb3J0IGEgZGVjaXNpb24uJzsKICAgICAgICAkKCdkZWNpc2lvbi1ub3RpY2UnKS5hcHBlbmQodGV4dCgnc3Ryb25nJywgYCR7ZGVjaXNpb25TdGF0dXN9IOKAlCBubyBhY3Rpb24gcmVjb21tZW5kYXRpb25gKSwgdGV4dCgncCcsIGAke3JlYXNvbn0gUmV2aWV3IHRoZSBkZWNsYXJlZCBoeXBvdGhlc2VzIGFuZCBsaWtlbGlob29kcyBiZWZvcmUgdXNpbmcgdGhpcyBtb2RlbCB0byBkZWNpZGUuYCkpOwogICAgICAgICQoJ2RlY2lzaW9uLW5vdGljZScpLmhpZGRlbiA9IGZhbHNlOwogICAgICB9CiAgICAgICQoJ3Jlc3VsdC1leHBsYW5hdGlvbicpLnRleHRDb250ZW50ID0gc25hcHNob3QubW9kZWxNaXNtYXRjaAogICAgICAgID8gJ1RoZSBwb3N0ZXJpb3IgY291bGQgbm90IGJlIHVwZGF0ZWQgYWZ0ZXIgdGhlIGNvbnRyYWRpY3Rpb24uIFZhbHVlcyBiZWxvdyByZXRhaW4gdGhlIGxhc3Qgc3VwcG9ydGVkIHN0YXRlOyB0aGV5IGFyZSBub3QgcHJvYmFiaWxpdGllcyBmb3IgdGhlIGNvbnRyYWRpY3RlZCBvYnNlcnZhdGlvbi4nCiAgICAgICAgOiBkZWZlcnJlZAogICAgICAgICAgPyAnUG9zdGVyaW9yIHdlaWdodHMgZGVzY3JpYmUgb25seSB0aGUgZGVjbGFyZWQgbW9kZWwgZmFtaWx5LiBFdmVuIGEgd2VpZ2h0IG9mIDEwMCUgY2Fubm90IG92ZXJyaWRlIERFRkVSIG9yIGVzdGFibGlzaCB0aGF0IGEgaHlwb3RoZXNpcyBpcyB0cnVlLicKICAgICAgICAgIDogJ1Bvc3RlcmlvciB3ZWlnaHRzIGFyZSBjb25kaXRpb25hbCBvbiB5b3VyIGRlY2xhcmVkIGh5cG90aGVzZXMsIHByaW9ycywgYW5kIGxpa2VsaWhvb2RzLiBOT1RfUkVKRUNURUQgbWVhbnMgaW5zdWZmaWNpZW50IGV2aWRlbmNlIGFnYWluc3QgdGhlIGFjdGl2ZSBtb2RlbCBmYW1pbHk7IGl0IGRvZXMgbm90IGFwcHJvdmUgdGhlIG1vZGVsIG9yIGF1dGhvcml6ZSBhbiBhY3Rpb24uJzsKICAgICAgY29uc3QgcHJvYmFiaWxpdHlLZXkgPSBiZWxpZWZzLmxlbmd0aCA/IFsncG9zdGVyaW9yJywgJ3Byb2JhYmlsaXR5JywgJ3Bvc3RlcmlvclByb2JhYmlsaXR5JywgJ3ZhbHVlJ10uZmluZCgoa2V5KSA9PiBiZWxpZWZzLmV2ZXJ5KChiZWxpZWYpID0+IHR5cGVvZiBiZWxpZWY/LltrZXldID09PSAnbnVtYmVyJyAmJiBiZWxpZWZba2V5XSA+PSAwICYmIGJlbGllZltrZXldIDw9IDEpKSA6IG51bGw7CiAgICAgIGlmIChwcm9iYWJpbGl0eUtleSkgewogICAgICAgIGNvbnN0IGNoYXJ0ID0gc2VjdGlvbihzbmFwc2hvdC5tb2RlbE1pc21hdGNoID8gJ0xhc3Qgc3VwcG9ydGVkIHBvc3RlcmlvciB3ZWlnaHRzJyA6ICdQb3N0ZXJpb3Igd2VpZ2h0cyB3aXRoaW4gdGhlIGRlY2xhcmVkIGZhbWlseScpOwogICAgICAgIGlmIChkZWZlcnJlZCkgY2hhcnQuY2xhc3NMaXN0LmFkZCgnZGVmZXJyZWQtYmVsaWVmcycpOwogICAgICAgIGJlbGllZnMuc2xpY2UoMCwgMjApLmZvckVhY2goKGJlbGllZiwgaW5kZXgpID0+IHsKICAgICAgICAgIGNvbnN0IHJvdyA9IHRleHQoJ2RpdicsICcnLCAnYmVsaWVmLXJvdycpOyBjb25zdCBsaW5lID0gdGV4dCgnZGl2JywgJycsICdiZWxpZWYtbGluZScpOwogICAgICAgICAgY29uc3QgcGVyY2VudGFnZSA9IGJlbGllZltwcm9iYWJpbGl0eUtleV0gKiAxMDA7CiAgICAgICAgICAvLyBBIGRpc3BsYXkgYXBwcm94aW1hdGlvbiBtdXN0IG5ldmVyIHR1cm4gYSBub256ZXJvIHdlaWdodCBpbnRvIHplcm8sCiAgICAgICAgICAvLyBvciBhIHdlaWdodCBiZWxvdyBvbmUgaW50byBhbiBhcHBhcmVudCBjZXJ0YWludHkgb2YgMTAwIHBlcmNlbnQuCiAgICAgICAgICBjb25zdCByb3VuZGVkID0gcGVyY2VudGFnZS50b0ZpeGVkKDIpOwogICAgICAgICAgY29uc3QgcGVyY2VudGFnZVRleHQgPSAocGVyY2VudGFnZSA+IDAgJiYgTnVtYmVyKHJvdW5kZWQpID09PSAwKSB8fCAoYmVsaWVmW3Byb2JhYmlsaXR5S2V5XSA8IDEgJiYgTnVtYmVyKHJvdW5kZWQpID09PSAxMDApCiAgICAgICAgICAgID8gU3RyaW5nKHBlcmNlbnRhZ2UpIDogcm91bmRlZDsKICAgICAgICAgIGNvbnN0IHdlaWdodCA9IHRleHQoJ3N0cm9uZycsIGAke051bWJlcihwZXJjZW50YWdlVGV4dCkgPT09IHBlcmNlbnRhZ2UgPyAnJyA6ICfiiYggJ30ke3BlcmNlbnRhZ2VUZXh0fSVgKTsKICAgICAgICAgIHdlaWdodC50aXRsZSA9IGBDb25kaXRpb25hbCBwb3N0ZXJpb3Igd2VpZ2h0OiAke1N0cmluZyhiZWxpZWZbcHJvYmFiaWxpdHlLZXldKX1gOwogICAgICAgICAgd2VpZ2h0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke3dlaWdodC50ZXh0Q29udGVudH07ICR7d2VpZ2h0LnRpdGxlfWApOwogICAgICAgICAgbGluZS5hcHBlbmQodGV4dCgnc3BhbicsIGJlbGllZi5oeXBvdGhlc2lzID8/IGJlbGllZi5uYW1lID8/IGJlbGllZi5pZCA/PyBgSHlwb3RoZXNpcyAke2luZGV4ICsgMX1gKSwgd2VpZ2h0KTsKICAgICAgICAgIGNvbnN0IHRyYWNrID0gdGV4dCgnZGl2JywgJycsICdiZWxpZWYtdHJhY2snKTsgY29uc3QgZmlsbCA9IHRleHQoJ2RpdicsICcnLCAnYmVsaWVmLWZpbGwnKTsgZmlsbC5zdHlsZS53aWR0aCA9IGAke2JlbGllZltwcm9iYWJpbGl0eUtleV0gKiAxMDB9JWA7IHRyYWNrLmFwcGVuZChmaWxsKTsgcm93LmFwcGVuZChsaW5lLCB0cmFjayk7IGNoYXJ0LmFwcGVuZChyb3cpOwogICAgICAgIH0pOwogICAgICAgICQoJ3Jlc3VsdC1kZXRhaWxzJykuYXBwZW5kKGNoYXJ0KTsKICAgICAgfSBlbHNlIGFwcGVuZFRhYmxlKCdQb3N0ZXJpb3Igd2VpZ2h0cyB3aXRoaW4gdGhlIGRlY2xhcmVkIGZhbWlseScsIGJlbGllZnMpOwogICAgICBhcHBlbmRUYWJsZSgnTmV4dCBleHBlcmltZW50JywgcmVjb21tZW5kYXRpb25zLCBbJ3N0YXR1cycsICdleHBlcmltZW50SWQnLCAnY29zdCcsICdleHBlY3RlZEluZm9ybWF0aW9uR2Fpbk5hdHMnLCAncmVhc29uJ10pOwogICAgICBpZiAoIWRlZmVycmVkICYmIHJlc3VsdC5hY3Rpb24pIGFwcGVuZFRhYmxlKCdFeHBlY3RlZC1sb3NzIGRlY2lzaW9uJywgQXJyYXkuaXNBcnJheShyZXN1bHQuYWN0aW9uLmFsdGVybmF0aXZlcykgPyByZXN1bHQuYWN0aW9uLmFsdGVybmF0aXZlcy5tYXAoKGFjdGlvbikgPT4gKHsgYWN0aW9uOiBhY3Rpb24uYWN0aW9uSWQsIGV4cGVjdGVkTG9zczogYWN0aW9uLmV4cGVjdGVkTG9zcywgc2VsZWN0ZWQ6IGFjdGlvbi5hY3Rpb25JZCA9PT0gcmVzdWx0LmFjdGlvbi5hY3Rpb25JZCB9KSkgOiBbcmVzdWx0LmFjdGlvbl0pOwogICAgICBpZiAoaXNPYmplY3QoYWRlcXVhY3kpKSBhcHBlbmRUYWJsZSgnTW9kZWwgYWRlcXVhY3knLCBbJ3N0YXR1cycsICdyZWFzb24nLCAndW5zdXBwb3J0ZWRFeHBlcmltZW50SWRzJywgJ2FscGhhJywgJ29ic2VydmF0aW9uQ291bnQnLCAnbG9nRVZhbHVlJywgJ2ZpcnN0Q3Jvc3NpbmdTZXF1ZW5jZSddLmZpbHRlcigoa2V5KSA9PiBPYmplY3QuaGFzT3duKGFkZXF1YWN5LCBrZXkpKS5tYXAoKGtleSkgPT4gKHsgY2hlY2s6IGh1bWFuaXplKGtleSksIHZhbHVlOiBhZGVxdWFjeVtrZXldIH0pKSk7CiAgICAgIGlmIChyZXN1bHQuYXNzdW1wdGlvbnMpIGFwcGVuZFRhYmxlKCdEZWNsYXJlZCBhc3N1bXB0aW9ucycsIHJlY29yZHMocmVzdWx0LmFzc3VtcHRpb25zKSk7CiAgICB9IGVsc2UgewogICAgICBjb25zdCBzY2FsYXJzID0gaXNPYmplY3QocmVzdWx0KSA/IE9iamVjdC5lbnRyaWVzKHJlc3VsdCkuZmlsdGVyKChbLCB2YWx1ZV0pID0+ICFpc09iamVjdCh2YWx1ZSkgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpKS5zbGljZSgwLCAzKSA6IFtdOwogICAgICBpZiAoc2NhbGFycy5sZW5ndGgpIHNjYWxhcnMuZm9yRWFjaCgoW2xhYmVsLCB2YWx1ZV0pID0+IGNhcmRzLmFwcGVuZChjYXJkKGh1bWFuaXplKGxhYmVsKSwgdmFsdWUpKSk7CiAgICAgIGVsc2UgY2FyZHMuYXBwZW5kKGNhcmQoJ0NvbXB1dGF0aW9uJywgJ0NvbXBsZXRlJyksIGNhcmQoJ1JlY2VpcHQnLCAnQ3JlYXRlZCcpKTsKICAgICAgJCgncmVzdWx0LWV4cGxhbmF0aW9uJykudGV4dENvbnRlbnQgPSAnSW5zcGVjdCB0aGUgcmVzdWx0IGFuZCBpdHMgaW5wdXRzIGluIHRoZSByZWNlaXB0IGJlbG93LiBEb3dubG9hZCB0aGUgcmVjZWlwdCB0byBwcmVzZXJ2ZSB0aGlzIGNvbXB1dGF0aW9uIG9yIHZlcmlmeSBpdCBpbmRlcGVuZGVudGx5Lic7CiAgICB9CiAgICAkKCdyZWNlaXB0LWRpZ2VzdCcpLnRleHRDb250ZW50ID0gcmVjZWlwdC5kaWdlc3QgPz8gJ05vIGRpZ2VzdCByZXR1cm5lZCc7CiAgICAkKCdjb3B5LWRpZ2VzdCcpLmRpc2FibGVkID0gIXJlY2VpcHQuZGlnZXN0OwogICAgJCgncmVzdWx0LWpzb24nKS50ZXh0Q29udGVudCA9IGpzb24ocmVzdWx0KTsKICAgICQoJ3JlY2VpcHQtanNvbicpLnRleHRDb250ZW50ID0ganNvbihyZWNlaXB0KTsKICAgICQoJ2xvYWQtY3VycmVudCcpLmRpc2FibGVkID0gZmFsc2U7CiAgfQogIGFzeW5jIGZ1bmN0aW9uIHJ1bigpIHsKICAgIGlmIChzdGF0ZS5ydW5uaW5nKSByZXR1cm47CiAgICBzaG93RXJyb3IoJ3J1bi1lcnJvcicsICcnKTsKICAgIGNvbnN0IHN1Ym1pdHRlZFRleHQgPSAkKCdpbnB1dC1lZGl0b3InKS52YWx1ZTsKICAgIHN0YXRlLnJ1bm5pbmcgPSB0cnVlOwogICAgJCgncnVuLWJ1dHRvbicpLmRpc2FibGVkID0gdHJ1ZTsgJCgncnVuLWJ1dHRvbi1sYWJlbCcpLnRleHRDb250ZW50ID0gJ0NvbXB1dGluZ+KApic7CiAgICAkKCdyZXN1bHQtcGFuZWwnKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtYnVzeScsICd0cnVlJyk7ICQoJ3Jlc3VsdC1raW5kJykudGV4dENvbnRlbnQgPSAnUlVOTklORyc7ICQoJ3Jlc3VsdC1raW5kJykuY2xhc3NOYW1lID0gJ3BpbGwgcnVubmluZyc7CiAgICB0cnkgewogICAgICBjb25zdCByZWNlaXB0ID0gYXdhaXQgYXBpKCcvYXBpL3J1bicsIHN1Ym1pdHRlZFRleHQsIHRydWUpOwogICAgICBpZiAoIWlzT2JqZWN0KHJlY2VpcHQpIHx8ICEoJ3Jlc3VsdCcgaW4gcmVjZWlwdCkgfHwgdHlwZW9mIHJlY2VpcHQuZGlnZXN0ICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKCdUaGUgc2VydmljZSByZXR1cm5lZCBhbiBpbmNvbXBsZXRlIHJlY2VpcHQuIE5vIG5ldyByZXN1bHQgd2FzIHNhdmVkLicpOwogICAgICBzdGF0ZS5yZWNlaXB0ID0gcmVjZWlwdDsKICAgICAgcmVuZGVyUmVjZWlwdChyZWNlaXB0KTsKICAgICAgJCgnaW5wdXQtaGVscCcpLnRleHRDb250ZW50ID0gJ1JlY2VpcHQgY3JlYXRlZC4gUmVhZHkgdG8gaW5zcGVjdCBhbmQgcmVwbGF5Lic7CiAgICAgIGlmICgkKCdpbnB1dC1lZGl0b3InKS52YWx1ZSAhPT0gc3VibWl0dGVkVGV4dCkgbWFya1Jlc3VsdFN0YWxlKCdJbnB1dCBjaGFuZ2VkIGR1cmluZyB0aGUgcnVuLiBUaGlzIHJlY2VpcHQgcmVjb3JkcyB0aGUgZWFybGllciBpbnB1dC4nKTsKICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIHNob3dFcnJvcigncnVuLWVycm9yJywgZXJyb3IubWVzc2FnZSk7CiAgICAgICQoJ3Jlc3VsdC1raW5kJykudGV4dENvbnRlbnQgPSBzdGF0ZS5yZWNlaXB0ID8gJ1BSRVZJT1VTIFJFU1VMVCcgOiAnTk9UIFJVTic7ICQoJ3Jlc3VsdC1raW5kJykuY2xhc3NOYW1lID0gJ3BpbGwgd2FybmluZyc7CiAgICAgICQoJ2lucHV0LWhlbHAnKS50ZXh0Q29udGVudCA9IHN0YXRlLnJlY2VpcHQgPyAnUnVuIGZhaWxlZC4gVGhlIHByZXZpb3VzIHJlY2VpcHQgcmVtYWlucyBkaXNwbGF5ZWQuJyA6ICdSZXNvbHZlIHRoZSBlcnJvciBhbmQgcnVuIGFnYWluLic7CiAgICB9IGZpbmFsbHkgewogICAgICBzdGF0ZS5ydW5uaW5nID0gZmFsc2U7ICQoJ3J1bi1idXR0b24nKS5kaXNhYmxlZCA9IGZhbHNlOyAkKCdydW4tYnV0dG9uLWxhYmVsJykudGV4dENvbnRlbnQgPSAnUnVuIHJlYXNvbmluZyc7ICQoJ3Jlc3VsdC1wYW5lbCcpLnNldEF0dHJpYnV0ZSgnYXJpYS1idXN5JywgJ2ZhbHNlJyk7CiAgICB9CiAgfQogICQoJ3J1bi1idXR0b24nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHJ1bik7CiAgJCgnZG93bmxvYWQtcmVjZWlwdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gewogICAgaWYgKCFzdGF0ZS5yZWNlaXB0KSByZXR1cm47CiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW2Ake2pzb24oc3RhdGUucmVjZWlwdCl9XG5gXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vanNvbicgfSk7CiAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpOyBjb25zdCBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7CiAgICBjb25zdCBraW5kID0gU3RyaW5nKHN0YXRlLnJlY2VpcHQua2luZCB8fCAncmVzdWx0JykucmVwbGFjZSgvW15hLXowLTktXS9naSwgJy0nKTsKICAgIGFuY2hvci5ocmVmID0gdXJsOyBhbmNob3IuZG93bmxvYWQgPSBgY29zbWljLSR7a2luZH0tJHtTdHJpbmcoc3RhdGUucmVjZWlwdC5kaWdlc3QpLnNsaWNlKDAsIDEyKX0ucmVjZWlwdC5qc29uYDsgZG9jdW1lbnQuYm9keS5hcHBlbmQoYW5jaG9yKTsgYW5jaG9yLmNsaWNrKCk7IGFuY2hvci5yZW1vdmUoKTsKICAgIHNldFRpbWVvdXQoKCkgPT4gVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpLCAxMDAwKTsKICB9KTsKICAkKCdjb3B5LWRpZ2VzdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogICAgaWYgKCFzdGF0ZS5yZWNlaXB0Py5kaWdlc3QpIHJldHVybjsKICAgIHRyeSB7IGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHN0YXRlLnJlY2VpcHQuZGlnZXN0KTsgdG9hc3QoJ1JlY2VpcHQgZGlnZXN0IGNvcGllZC4nKTsgfQogICAgY2F0Y2ggeyBjb25zdCBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7IGNvbnN0IHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTsgcmFuZ2Uuc2VsZWN0Tm9kZUNvbnRlbnRzKCQoJ3JlY2VpcHQtZGlnZXN0JykpOyBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7IHNlbGVjdGlvbi5hZGRSYW5nZShyYW5nZSk7IHRvYXN0KCdEaWdlc3Qgc2VsZWN0ZWQuIFVzZSB5b3VyIGtleWJvYXJkIHRvIGNvcHkuJyk7IH0KICB9KTsKCiAgZnVuY3Rpb24gcmVzZXRWZXJpZmljYXRpb24oKSB7CiAgICAkKCd2ZXJpZmljYXRpb24tc3RhdHVzJykudGV4dENvbnRlbnQgPSAnTk9UIFZFUklGSUVEJzsgJCgndmVyaWZpY2F0aW9uLXN0YXR1cycpLmNsYXNzTmFtZSA9ICdwaWxsJzsKICAgICQoJ3ZlcmlmaWNhdGlvbi1jb250ZW50JykuaGlkZGVuID0gdHJ1ZTsgJCgnZW1wdHktdmVyaWZpY2F0aW9uJykuaGlkZGVuID0gZmFsc2U7CiAgICBzaG93RXJyb3IoJ3ZlcmlmeS1lcnJvcicsICcnKTsKICB9CiAgZnVuY3Rpb24gbG9hZEN1cnJlbnQoKSB7CiAgICBpZiAoIXN0YXRlLnJlY2VpcHQpIHJldHVybjsKICAgIHN0YXRlLmltcG9ydGVkUmVjZWlwdFRleHQgPSBudWxsOwogICAgJCgncmVjZWlwdC1lZGl0b3InKS52YWx1ZSA9IGpzb24oc3RhdGUucmVjZWlwdCk7ICQoJ3JlY2VpcHQtZmlsZW5hbWUnKS50ZXh0Q29udGVudCA9ICdMYXRlc3QgbG9jYWwgcmVjZWlwdCc7ICQoJ2ltcG9ydC1zdGF0dXMnKS50ZXh0Q29udGVudCA9ICdMYXRlc3QgcmVzdWx0IGxvYWRlZC4nOyAkKCd0cnVzdGVkLWRpZ2VzdCcpLnZhbHVlID0gJyc7IHJlc2V0VmVyaWZpY2F0aW9uKCk7CiAgfQogICQoJ2xvYWQtY3VycmVudCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbG9hZEN1cnJlbnQpOwogICQoJ3ZlcmlmeS1jdXJyZW50JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7IGxvYWRDdXJyZW50KCk7IHNldE1vZGUoJ3ZlcmlmeScpOyAkKCd2ZXJpZnktYnV0dG9uJykuZm9jdXMoKTsgfSk7CiAgJCgncmVjZWlwdC1lZGl0b3InKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgc3RhdGUuaW1wb3J0ZWRSZWNlaXB0VGV4dCA9IG51bGw7ICQoJ2ltcG9ydC1zdGF0dXMnKS50ZXh0Q29udGVudCA9ICdSZWNlaXB0IGVkaXRlZC4gVmVyaWZ5IHRvIGNoZWNrIHRoZXNlIGJ5dGVzLic7IHJlc2V0VmVyaWZpY2F0aW9uKCk7IH0pOwogICQoJ3RydXN0ZWQtZGlnZXN0JykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCByZXNldFZlcmlmaWNhdGlvbik7CiAgYXN5bmMgZnVuY3Rpb24gaW1wb3J0UmVjZWlwdChmaWxlKSB7CiAgICBpZiAoIWZpbGUpIHJldHVybjsKICAgIHJlc2V0VmVyaWZpY2F0aW9uKCk7CiAgICBpZiAoZmlsZS5zaXplID4gTUFYX0lNUE9SVF9CWVRFUykgeyBzaG93RXJyb3IoJ3ZlcmlmeS1lcnJvcicsICdUaGlzIHJlY2VpcHQgZXhjZWVkcyB0aGUgd29ya2JlbmNoIGltcG9ydCBsaW1pdC4gQWxsIEpTT04gZW50cnlwb2ludHMgZW5mb3JjZSBhIDIgTUIgbGltaXQuJyk7IHJldHVybjsgfQogICAgdHJ5IHsKICAgICAgY29uc3QgY29udGVudCA9IG5ldyBUZXh0RGVjb2RlcigndXRmLTgnLCB7IGZhdGFsOiB0cnVlLCBpZ25vcmVCT006IHRydWUgfSkuZGVjb2RlKGF3YWl0IGZpbGUuYXJyYXlCdWZmZXIoKSk7CiAgICAgIC8vIEtlZXAgdXBsb2FkZWQgdGV4dCBzZXBhcmF0ZWx5OiB0ZXh0YXJlYS52YWx1ZSBub3JtYWxpemVzIENSTEYgdG8gTEYuCiAgICAgIHN0YXRlLmltcG9ydGVkUmVjZWlwdFRleHQgPSBjb250ZW50OwogICAgICAkKCdyZWNlaXB0LWVkaXRvcicpLnZhbHVlID0gY29udGVudDsgJCgncmVjZWlwdC1maWxlbmFtZScpLnRleHRDb250ZW50ID0gZmlsZS5uYW1lOyAkKCdpbXBvcnQtc3RhdHVzJykudGV4dENvbnRlbnQgPSBgJHtmaWxlLm5hbWV9IGxvYWRlZC5gOyByZXNldFZlcmlmaWNhdGlvbigpOwogICAgfSBjYXRjaCAoZXJyb3IpIHsgc2hvd0Vycm9yKCd2ZXJpZnktZXJyb3InLCBgQ291bGQgbm90IGltcG9ydCByZWNlaXB0IEpTT046ICR7ZXJyb3IubWVzc2FnZX1gKTsgJCgnaW1wb3J0LXN0YXR1cycpLnRleHRDb250ZW50ID0gJ0ltcG9ydCByZWZ1c2VkLiBUaGUgcHJldmlvdXMgcmVjZWlwdCB0ZXh0IHdhcyBrZXB0OyB2ZXJpZnkgaXQgYWdhaW4gYmVmb3JlIHJlbHlpbmcgb24gaXQuJzsgfQogIH0KICAkKCdyZWNlaXB0LWZpbGUnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXZlbnQpID0+IHsgaW1wb3J0UmVjZWlwdChldmVudC50YXJnZXQuZmlsZXNbMF0pOyBldmVudC50YXJnZXQudmFsdWUgPSAnJzsgfSk7CiAgWydkcmFnZW50ZXInLCAnZHJhZ292ZXInXS5mb3JFYWNoKCh0eXBlKSA9PiAkKCdpbXBvcnQtem9uZScpLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgKGV2ZW50KSA9PiB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICQoJ2ltcG9ydC16b25lJykuY2xhc3NMaXN0LmFkZCgnZHJhZy1vdmVyJyk7IH0pKTsKICBbJ2RyYWdsZWF2ZScsICdkcm9wJ10uZm9yRWFjaCgodHlwZSkgPT4gJCgnaW1wb3J0LXpvbmUnKS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIChldmVudCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAkKCdpbXBvcnQtem9uZScpLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWctb3ZlcicpOyB9KSk7CiAgJCgnaW1wb3J0LXpvbmUnKS5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgKGV2ZW50KSA9PiBpbXBvcnRSZWNlaXB0KGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlc1swXSkpOwoKICBmdW5jdGlvbiByZW5kZXJWZXJpZmljYXRpb24ocmVzcG9uc2UpIHsKICAgICQoJ2VtcHR5LXZlcmlmaWNhdGlvbicpLmhpZGRlbiA9IHRydWU7ICQoJ3ZlcmlmaWNhdGlvbi1jb250ZW50JykuaGlkZGVuID0gZmFsc2U7CiAgICBjb25zdCB2YWxpZCA9IHJlc3BvbnNlLnZhbGlkID09PSB0cnVlOwogICAgY29uc3QgdW5hbmNob3JlZCA9IHJlc3BvbnNlLmFuY2hvcmluZyA9PT0gJ1VOQU5DSE9SRUQnOwogICAgJCgndmVyaWZpY2F0aW9uLXN0YXR1cycpLnRleHRDb250ZW50ID0gdmFsaWQgPyB1bmFuY2hvcmVkID8gJ1VOQU5DSE9SRUQnIDogJ0NIRUNLUyBQQVNTRUQnIDogJ0NIRUNLUyBGQUlMRUQnOyAkKCd2ZXJpZmljYXRpb24tc3RhdHVzJykuY2xhc3NOYW1lID0gYHBpbGwgJHt2YWxpZCA/IHVuYW5jaG9yZWQgPyAnd2FybmluZycgOiAndmFsaWQnIDogJ2ludmFsaWQnfWA7CiAgICBjb25zdCBkZWZpbml0aW9ucyA9IFsKICAgICAgeyBrZXk6ICdpbnRlZ3JpdHknLCB0aXRsZTogJ1JlY2VpcHQgaW50ZWdyaXR5JywgZ29vZDogJ1ZBTElEJywgZGVzY3JpcHRpb25zOiB7IFZBTElEOiAnVGhlIHJlY29yZGVkIGRpZ2VzdCBtYXRjaGVzIHRoZSByZWNlaXB0IGNvbnRlbnQuJywgSU5WQUxJRDogJ1RoZSByZWNvcmRlZCBkaWdlc3QgZG9lcyBub3QgbWF0Y2ggdGhlIHJlY2VpcHQgY29udGVudC4nLCBOT1RfQ0hFQ0tFRDogJ1ZlcmlmaWNhdGlvbiBzdG9wcGVkIGJlZm9yZSByZWNlaXB0IGludGVncml0eSBjb3VsZCBiZSBjaGVja2VkLicgfSB9LAogICAgICB7IGtleTogJ3JlcGxheScsIHRpdGxlOiAnQ29tcHV0YXRpb24gcmVwbGF5JywgZ29vZDogJ01BVENIJywgZGVzY3JpcHRpb25zOiB7IE1BVENIOiAnVGhlIGxvY2FsIGltcGxlbWVudGF0aW9uIHJlcHJvZHVjZWQgdGhlIHJlY29yZGVkIGNvbXB1dGF0aW9uLicsIE1JU01BVENIOiAnVGhlIHJlcGxheWVkIGNvbXB1dGF0aW9uIGRpZmZlcnMgZnJvbSB0aGUgcmVjb3JkZWQgcmVzdWx0LicsIFVOU1VQUE9SVEVEOiAnVGhpcyBydW50aW1lIGNhbm5vdCByZXBsYXkgdGhlIHJlY2VpcHQgYXMgcHJvdmlkZWQuJywgTk9UX1JVTjogJ1JlcGxheSB3YXMgbm90IHBlcmZvcm1lZC4nIH0gfSwKICAgICAgeyBrZXk6ICdhbmNob3JpbmcnLCB0aXRsZTogJ1RydXN0ZWQgZGlnZXN0JywgZ29vZDogJ01BVENIJywgZGVzY3JpcHRpb25zOiB7IE1BVENIOiAnVGhlIHJlY2VpcHQgbWF0Y2hlcyB0aGUgdHJ1c3RlZCBkaWdlc3QgeW91IHN1cHBsaWVkLicsIE1JU01BVENIOiAnQSBtYXRjaCB0byB0aGUgc3VwcGxpZWQgdHJ1c3RlZCBkaWdlc3Qgd2FzIG5vdCBlc3RhYmxpc2hlZC4nLCBOT1RfQ0hFQ0tFRDogJ1ZlcmlmaWNhdGlvbiBzdG9wcGVkIGJlZm9yZSB0aGUgdHJ1c3RlZCBkaWdlc3QgY291bGQgYmUgY2hlY2tlZC4nLCBVTkFOQ0hPUkVEOiAnTm8gdHJ1c3RlZCBkaWdlc3Qgd2FzIHN1cHBsaWVkLiBUaGlzIGNoZWNrcyByZWNlaXB0IGNvbnNpc3RlbmN5IG9ubHkuJyB9IH0sCiAgICBdOwogICAgJCgndmVyaWZpY2F0aW9uLWNoZWNrcycpLnJlcGxhY2VDaGlsZHJlbigpOwogICAgZGVmaW5pdGlvbnMuZm9yRWFjaCgoZGVmaW5pdGlvbikgPT4gewogICAgICBjb25zdCBzdGF0dXMgPSByZXNwb25zZVtkZWZpbml0aW9uLmtleV0gPz8gJ05PVF9SRVBPUlRFRCc7CiAgICAgIGNvbnN0IGdvb2QgPSBzdGF0dXMgPT09IGRlZmluaXRpb24uZ29vZDsgY29uc3QgYmFkID0gWydJTlZBTElEJywgJ01JU01BVENIJ10uaW5jbHVkZXMoc3RhdHVzKTsKICAgICAgY29uc3Qgcm93ID0gdGV4dCgnZGl2JywgJycsICdjaGVjay1yb3cnKTsgY29uc3QgaWNvbiA9IHRleHQoJ3NwYW4nLCBnb29kID8gJ+KckycgOiBiYWQgPyAnw5cnIDogJ+KAkycsIGBjaGVjay1pY29uICR7Z29vZCA/ICdnb29kJyA6IGJhZCA/ICdiYWQnIDogJ25ldXRyYWwnfWApOyBpY29uLnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpOwogICAgICBjb25zdCBib2R5ID0gdGV4dCgnZGl2JywgJycsICdjaGVjay1ib2R5Jyk7IGNvbnN0IGhlYWRlciA9IHRleHQoJ2RpdicsICcnLCAnY2hlY2staGVhZGVyJyk7CiAgICAgIGhlYWRlci5hcHBlbmQodGV4dCgnaDMnLCBkZWZpbml0aW9uLnRpdGxlKSwgdGV4dCgnY29kZScsIHN0YXR1cykpOyBib2R5LmFwcGVuZChoZWFkZXIsIHRleHQoJ3AnLCBkZWZpbml0aW9uLmRlc2NyaXB0aW9uc1tzdGF0dXNdIHx8ICdUaGUgc2VydmljZSBkaWQgbm90IHJlcG9ydCBhIHJlY29nbml6ZWQgc3RhdHVzIGZvciB0aGlzIGNoZWNrLicpKTsKICAgICAgcm93LmFwcGVuZChpY29uLCBib2R5KTsgJCgndmVyaWZpY2F0aW9uLWNoZWNrcycpLmFwcGVuZChyb3cpOwogICAgfSk7CiAgICAkKCd2ZXJpZmljYXRpb24tcmVhc29uJykudGV4dENvbnRlbnQgPSBgJHt2YWxpZCAmJiB1bmFuY2hvcmVkID8gJ1VuYW5jaG9yZWQg4oCUIHJlY2VpcHQgY29uc2lzdGVuY3kgb25seS4gJyA6ICcnfSR7cmVzcG9uc2UucmVhc29uIHx8ICh2YWxpZCA/ICdUaGUgcmVwb3J0ZWQgdmVyaWZpY2F0aW9uIGNoZWNrcyBwYXNzZWQuJyA6ICdSZXZpZXcgdGhlIGNoZWNrIHJlc3VsdHMgYmVmb3JlIHJlbHlpbmcgb24gdGhpcyByZWNlaXB0LicpfWA7CiAgICAkKCd2ZXJpZmljYXRpb24tanNvbicpLnRleHRDb250ZW50ID0ganNvbihyZXNwb25zZSk7CiAgfQogIGFzeW5jIGZ1bmN0aW9uIHZlcmlmeSgpIHsKICAgIGlmIChzdGF0ZS52ZXJpZnlpbmcpIHJldHVybjsKICAgIHJlc2V0VmVyaWZpY2F0aW9uKCk7CiAgICBjb25zdCBzdWJtaXR0ZWRSZWNlaXB0VGV4dCA9IHN0YXRlLmltcG9ydGVkUmVjZWlwdFRleHQgPz8gJCgncmVjZWlwdC1lZGl0b3InKS52YWx1ZTsKICAgIGNvbnN0IHN1Ym1pdHRlZERpZ2VzdFRleHQgPSAkKCd0cnVzdGVkLWRpZ2VzdCcpLnZhbHVlOwogICAgY29uc3QgZXhwZWN0ZWREaWdlc3QgPSBzdWJtaXR0ZWREaWdlc3RUZXh0LnRyaW0oKTsKICAgIGlmIChleHBlY3RlZERpZ2VzdCAmJiAhL15bYS1mQS1GMC05XXs2NH0kLy50ZXN0KGV4cGVjdGVkRGlnZXN0KSkgeyBzaG93RXJyb3IoJ3ZlcmlmeS1lcnJvcicsICdBIHRydXN0ZWQgZGlnZXN0IG11c3QgY29udGFpbiBleGFjdGx5IDY0IGhleGFkZWNpbWFsIGNoYXJhY3RlcnMuJyk7ICQoJ3RydXN0ZWQtZGlnZXN0JykuZm9jdXMoKTsgcmV0dXJuOyB9CiAgICBzdGF0ZS52ZXJpZnlpbmcgPSB0cnVlOyAkKCd2ZXJpZnktYnV0dG9uJykuZGlzYWJsZWQgPSB0cnVlOyAkKCd2ZXJpZnktYnV0dG9uLWxhYmVsJykudGV4dENvbnRlbnQgPSAnVmVyaWZ5aW5n4oCmJzsgJCgndmVyaWZpY2F0aW9uLXBhbmVsJykuc2V0QXR0cmlidXRlKCdhcmlhLWJ1c3knLCAndHJ1ZScpOwogICAgJCgndmVyaWZpY2F0aW9uLXN0YXR1cycpLnRleHRDb250ZW50ID0gJ0NIRUNLSU5HJzsgJCgndmVyaWZpY2F0aW9uLXN0YXR1cycpLmNsYXNzTmFtZSA9ICdwaWxsIHJ1bm5pbmcnOwogICAgdHJ5IHsKICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpKCcvYXBpL3ZlcmlmeScsIHN1Ym1pdHRlZFJlY2VpcHRUZXh0LCB0cnVlLCBleHBlY3RlZERpZ2VzdCA/IHsgJ1gtQ29zbWljLUV4cGVjdGVkLURpZ2VzdCc6IGV4cGVjdGVkRGlnZXN0LnRvTG93ZXJDYXNlKCkgfSA6IHt9KTsKICAgICAgaWYgKChzdGF0ZS5pbXBvcnRlZFJlY2VpcHRUZXh0ID8/ICQoJ3JlY2VpcHQtZWRpdG9yJykudmFsdWUpICE9PSBzdWJtaXR0ZWRSZWNlaXB0VGV4dCB8fCAkKCd0cnVzdGVkLWRpZ2VzdCcpLnZhbHVlICE9PSBzdWJtaXR0ZWREaWdlc3RUZXh0KSB7CiAgICAgICAgcmVzZXRWZXJpZmljYXRpb24oKTsKICAgICAgICAkKCdpbXBvcnQtc3RhdHVzJykudGV4dENvbnRlbnQgPSAnUmVjZWlwdCBvciB0cnVzdGVkIGRpZ2VzdCBjaGFuZ2VkIGR1cmluZyB2ZXJpZmljYXRpb24uIFZlcmlmeSBhZ2Fpbi4nOwogICAgICB9IGVsc2UgewogICAgICAgIHJlbmRlclZlcmlmaWNhdGlvbihyZXN1bHQpOwogICAgICAgICQoJ2ltcG9ydC1zdGF0dXMnKS50ZXh0Q29udGVudCA9ICdWZXJpZmljYXRpb24gY29tcGxldGUuJzsKICAgICAgfQogICAgfQogICAgY2F0Y2ggKGVycm9yKSB7IHNob3dFcnJvcigndmVyaWZ5LWVycm9yJywgZXJyb3IubWVzc2FnZSk7IHJlc2V0VmVyaWZpY2F0aW9uKCk7IHNob3dFcnJvcigndmVyaWZ5LWVycm9yJywgZXJyb3IubWVzc2FnZSk7ICQoJ2ltcG9ydC1zdGF0dXMnKS50ZXh0Q29udGVudCA9ICdWZXJpZmljYXRpb24gY291bGQgbm90IGNvbXBsZXRlLic7IH0KICAgIGZpbmFsbHkgeyBzdGF0ZS52ZXJpZnlpbmcgPSBmYWxzZTsgJCgndmVyaWZ5LWJ1dHRvbicpLmRpc2FibGVkID0gZmFsc2U7ICQoJ3ZlcmlmeS1idXR0b24tbGFiZWwnKS50ZXh0Q29udGVudCA9ICdWZXJpZnkgJiByZXBsYXknOyAkKCd2ZXJpZmljYXRpb24tcGFuZWwnKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtYnVzeScsICdmYWxzZScpOyB9CiAgfQogICQoJ3ZlcmlmeS1idXR0b24nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHZlcmlmeSk7CiAgbG9hZEV4YW1wbGVzKCk7Cn0pKCk7Cg==", "web/index.html": "PCFkb2N0eXBlIGh0bWw+CjwhLS0KQ29weXJpZ2h0IDIwMjYgTGVsYW5kIEpvdXJkYW4gSUkgLyBDJkwgU3RyYXRlZ3kKU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAKLS0+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPG1ldGEgbmFtZT0iY29sb3Itc2NoZW1lIiBjb250ZW50PSJsaWdodCI+CiAgPG1ldGEgbmFtZT0iZGVzY3JpcHRpb24iIGNvbnRlbnQ9IkEgbG9jYWwgd29ya2JlbmNoIGZvciBkZXRlcm1pbmlzdGljIHJlYXNvbmluZywgZXhwbGljaXQgZGVjaXNpb25zLCBhbmQgaW5kZXBlbmRlbnRseSB2ZXJpZmlhYmxlIHJlY2VpcHRzLiI+CiAgPHRpdGxlPkNPU01JQyBDb21tb25zIMK3IFJlYXNvbi4gRGVjaWRlLiBSZXBsYXkuPC90aXRsZT4KICA8bGluayByZWw9InN0eWxlc2hlZXQiIGhyZWY9Ii9zdHlsZXMuY3NzIj4KICA8c2NyaXB0IHNyYz0iL2FwcC5qcyIgZGVmZXI+PC9zY3JpcHQ+CjwvaGVhZD4KPGJvZHk+CiAgPGEgY2xhc3M9InNraXAtbGluayIgaHJlZj0iI3dvcmtzcGFjZSI+U2tpcCB0byB3b3JrYmVuY2g8L2E+CiAgPGhlYWRlciBjbGFzcz0ic2l0ZS1oZWFkZXIiPgogICAgPGEgaHJlZj0iLyIgY2xhc3M9ImJyYW5kIiBhcmlhLWxhYmVsPSJDT1NNSUMgQ29tbW9ucyBob21lIj4KICAgICAgPHN2ZyB2aWV3Qm94PSIwIDAgMzQgMzQiIGZpbGw9Im5vbmUiIGFyaWEtaGlkZGVuPSJ0cnVlIj48cGF0aCBkPSJNMTcgMiAzMCA5LjV2MTVMMTcgMzIgNCAyNC41di0xNUwxNyAyWiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0ibTQgOS41IDEzIDcuNW0wIDAgMTMtNy41TTE3IDE3djE1IiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48Y2lyY2xlIGN4PSIxNyIgY3k9IjE3IiByPSI0IiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4KICAgICAgPHNwYW4+Q09TTUlDIDxzdHJvbmc+Q09NTU9OUzwvc3Ryb25nPjwvc3Bhbj4KICAgIDwvYT4KICAgIDxkaXYgY2xhc3M9ImhlYWRlci1yaWdodCI+PHNwYW4gY2xhc3M9ImVkaXRpb24iPkRFVkVMT1BFUiBXT1JLQkVOQ0g8L3NwYW4+PHNwYW4gY2xhc3M9ImNvbm5lY3Rpb24iIGlkPSJjb25uZWN0aW9uIj48c3BhbiBjbGFzcz0ic3RhdHVzLWRvdCI+PC9zcGFuPjxzcGFuIGlkPSJjb25uZWN0aW9uLWxhYmVsIj5Db25uZWN0aW5nPC9zcGFuPjwvc3Bhbj48L2Rpdj4KICA8L2hlYWRlcj4KCiAgPG1haW4+CiAgICA8c2VjdGlvbiBjbGFzcz0iaW50cm8iIGFyaWEtbGFiZWxsZWRieT0icGFnZS10aXRsZSI+CiAgICAgIDxkaXY+PHAgY2xhc3M9ImV5ZWJyb3ciPkVYUExJQ0lUIElOUFVUUy4gSU5TUEVDVEFCTEUgQU5TV0VSUy48L3A+PGgxIGlkPSJwYWdlLXRpdGxlIj5SZWFzb24uIERlY2lkZS4gPGVtPlJlcGxheS48L2VtPjwvaDE+PHAgY2xhc3M9ImludHJvLWNvcHkiPlR1cm4gZGVjbGFyZWQgZXZpZGVuY2UgYW5kIGFzc3VtcHRpb25zIGludG8gcmVzdWx0cyB5b3UgY2FuIGluc3BlY3QsIGV4cG9ydCwgYW5kIHJlcHJvZHVjZS48L3A+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImludHJvLW5vdGUiPjxzcGFuIGNsYXNzPSJub3RlLXN5bWJvbCIgYXJpYS1oaWRkZW49InRydWUiPuKGszwvc3Bhbj48cD5SdW5zIG9uIHlvdXIgbWFjaGluZS48YnI+PHN0cm9uZz5Zb3VyIGlucHV0cyBzdGF5IGluIHRoaXMgbG9jYWwgc2VydmljZS48L3N0cm9uZz48L3A+PC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPGRpdiBjbGFzcz0id29ya3NwYWNlLW5hdiIgYXJpYS1sYWJlbD0iV29ya2JlbmNoIG1vZGVzIj4KICAgICAgPGRpdiBjbGFzcz0ibW9kZS10YWJzIiByb2xlPSJ0YWJsaXN0IiBhcmlhLWxhYmVsPSJXb3JrYmVuY2ggbW9kZSI+CiAgICAgICAgPGJ1dHRvbiBpZD0icnVuLXRhYiIgY2xhc3M9Im1vZGUtdGFiIGFjdGl2ZSIgcm9sZT0idGFiIiBhcmlhLXNlbGVjdGVkPSJ0cnVlIiBhcmlhLWNvbnRyb2xzPSJydW4tcGFuZWwiIGRhdGEtbW9kZT0icnVuIj5CdWlsZCBhIHJlc3VsdCA8c3Bhbj4wMTwvc3Bhbj48L2J1dHRvbj4KICAgICAgICA8YnV0dG9uIGlkPSJ2ZXJpZnktdGFiIiBjbGFzcz0ibW9kZS10YWIiIHJvbGU9InRhYiIgYXJpYS1zZWxlY3RlZD0iZmFsc2UiIGFyaWEtY29udHJvbHM9InZlcmlmeS1wYW5lbCIgdGFiaW5kZXg9Ii0xIiBkYXRhLW1vZGU9InZlcmlmeSI+VmVyaWZ5IGEgcmVjZWlwdCA8c3Bhbj4wMjwvc3Bhbj48L2J1dHRvbj4KICAgICAgPC9kaXY+CiAgICAgIDxzcGFuIGNsYXNzPSJuYXYtbm90ZSI+RXZpZGVuY2UgaW4uIFJlY2VpcHQgb3V0Ljwvc3Bhbj4KICAgIDwvZGl2PgoKICAgIDxzZWN0aW9uIGlkPSJ3b3Jrc3BhY2UiIGFyaWEtbGFiZWw9IkNPU01JQyB3b3JrYmVuY2giPgogICAgICA8ZGl2IGlkPSJydW4tcGFuZWwiIHJvbGU9InRhYnBhbmVsIiBhcmlhLWxhYmVsbGVkYnk9InJ1bi10YWIiPgogICAgICAgIDxkaXYgY2xhc3M9ImV4YW1wbGUtaGVhZGluZyI+PGgyPlN0YXJ0IHdpdGggYSBxdWVzdGlvbjwvaDI+PHNwYW4+VXNlIGFuIGV4YW1wbGUsIHRoZW4gbWFrZSBpdCB5b3Vycy48L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0iZXhhbXBsZXMiIGlkPSJleGFtcGxlcyIgYXJpYS1sYWJlbD0iRXhhbXBsZSBpbnB1dHMiPjxwIGNsYXNzPSJsb2FkaW5nLW1lc3NhZ2UiPkxvYWRpbmcgZXhhbXBsZXMgZnJvbSB0aGUgbG9jYWwgc2VydmljZeKApjwvcD48L2Rpdj4KICAgICAgICA8cCBjbGFzcz0iZXJyb3ItYmFubmVyIiBpZD0iZXhhbXBsZXMtZXJyb3IiIHJvbGU9ImFsZXJ0IiBoaWRkZW4+PC9wPgogICAgICAgIDxkaXYgY2xhc3M9IndvcmstZ3JpZCI+CiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz0icGFuZWwgaW5wdXQtcGFuZWwiIGFyaWEtbGFiZWxsZWRieT0iaW5wdXQtaGVhZGluZyI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9InBhbmVsLWhlYWRpbmciPjxkaXY+PHAgY2xhc3M9InNlY3Rpb24taW5kZXgiPjAxIC8gREVDTEFSRTwvcD48aDIgaWQ9ImlucHV0LWhlYWRpbmciPllvdXIgaW5wdXQ8L2gyPjwvZGl2PjxidXR0b24gY2xhc3M9InRleHQtYnV0dG9uIiBpZD0iZm9ybWF0LWJ1dHRvbiIgdHlwZT0iYnV0dG9uIj5Gb3JtYXQgSlNPTjwvYnV0dG9uPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJlZGl0b3ItdG9vbGJhciI+PHNwYW4gY2xhc3M9ImZpbGUtbmFtZSIgaWQ9ImlucHV0LWZpbGVuYW1lIj5pbnB1dC5qc29uPC9zcGFuPjxzcGFuIGNsYXNzPSJzeW50YXgtbGFiZWwiPkpTT048L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxsYWJlbCBjbGFzcz0ic3Itb25seSIgZm9yPSJpbnB1dC1lZGl0b3IiPklucHV0IEpTT048L2xhYmVsPjx0ZXh0YXJlYSBpZD0iaW5wdXQtZWRpdG9yIiBjbGFzcz0ianNvbi1lZGl0b3IiIHNwZWxsY2hlY2s9ImZhbHNlIiBhdXRvY2FwaXRhbGl6ZT0ib2ZmIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9IkNob29zZSBhbiBleGFtcGxlIG9yIHBhc3RlIGEgc3VwcG9ydGVkIGlucHV0IGhlcmUuIj48L3RleHRhcmVhPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJlZGl0b3ItZm9vdGVyIj48c3BhbiBpZD0iZWRpdG9yLW1ldGEiPjAgbGluZXM8L3NwYW4+PHNwYW4gY2xhc3M9InNob3J0Y3V0Ij7ijJggLyBDdHJsICsgRW50ZXIgdG8gcnVuPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJydW4tY29udHJvbHMiPjxwIGlkPSJpbnB1dC1oZWxwIj5FdmVyeSBhc3N1bXB0aW9uIGlzIHBhcnQgb2YgdGhlIGlucHV0LjwvcD48YnV0dG9uIGNsYXNzPSJwcmltYXJ5LWJ1dHRvbiIgaWQ9InJ1bi1idXR0b24iIHR5cGU9ImJ1dHRvbiI+PHNwYW4gaWQ9InJ1bi1idXR0b24tbGFiZWwiPlJ1biByZWFzb25pbmc8L3NwYW4+PHNwYW4gYXJpYS1oaWRkZW49InRydWUiPuKGlzwvc3Bhbj48L2J1dHRvbj48L2Rpdj4KICAgICAgICAgICAgPHAgY2xhc3M9ImVycm9yLWJhbm5lciBpbnNldC1lcnJvciIgaWQ9InJ1bi1lcnJvciIgcm9sZT0iYWxlcnQiIGhpZGRlbj48L3A+CiAgICAgICAgICA8L3NlY3Rpb24+CgogICAgICAgICAgPHNlY3Rpb24gY2xhc3M9InBhbmVsIHJlc3VsdC1wYW5lbCIgYXJpYS1sYWJlbGxlZGJ5PSJyZXN1bHQtaGVhZGluZyIgYXJpYS1saXZlPSJwb2xpdGUiIGFyaWEtYnVzeT0iZmFsc2UiIGlkPSJyZXN1bHQtcGFuZWwiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwYW5lbC1oZWFkaW5nIj48ZGl2PjxwIGNsYXNzPSJzZWN0aW9uLWluZGV4Ij4wMiAvIElOU1BFQ1Q8L3A+PGgyIGlkPSJyZXN1bHQtaGVhZGluZyI+VGhlIHJlc3VsdDwvaDI+PC9kaXY+PHNwYW4gY2xhc3M9InBpbGwiIGlkPSJyZXN1bHQta2luZCI+Tk9UIFJVTjwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZW1wdHktc3RhdGUiIGlkPSJlbXB0eS1yZXN1bHQiPjxkaXYgY2xhc3M9ImVtcHR5LWljb24iIGFyaWEtaGlkZGVuPSJ0cnVlIj48c3ZnIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTE2IDdoMThsOCA4djM0SDE2VjdaIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48cGF0aCBkPSJNMzQgN3Y5aDhNMjMgMjZoMTJNMjMgMzJoMTJNMjMgMzhoNyIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS41Ii8+PGNpcmNsZSBjeD0iMTUiIGN5PSIxMyIgcj0iNiIgZmlsbD0idmFyKC0tc3VyZmFjZSkiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEuNSIvPjwvc3ZnPjwvZGl2PjxoMz5BbnN3ZXJzIGNvbWUgd2l0aCBhIHBhcGVyIHRyYWlsLjwvaDM+PHA+Q2hvb3NlIGFuIGV4YW1wbGUgYW5kIHJ1biBpdC4gWW91ciByZXN1bHQsIGRlY2xhcmVkIGFzc3VtcHRpb25zLCBhbmQgcmVwbGF5YWJsZSByZWNlaXB0IHdpbGwgYXBwZWFyIGhlcmUuPC9wPjxzcGFuIGNsYXNzPSJlbXB0eS1jYXB0aW9uIj5ObyBjb21wdXRhdGlvbiBoYXMgcnVuIHlldC48L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgaWQ9InJlc3VsdC1jb250ZW50IiBjbGFzcz0icmVzdWx0LWNvbnRlbnQiIGhpZGRlbj4KICAgICAgICAgICAgICA8ZGl2IGlkPSJkZWNpc2lvbi1ub3RpY2UiIGNsYXNzPSJkZWNpc2lvbi1ub3RpY2UiIHJvbGU9InN0YXR1cyIgaGlkZGVuPjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9InN1bW1hcnktY2FyZHMiIGlkPSJzdW1tYXJ5LWNhcmRzIj48L2Rpdj4KICAgICAgICAgICAgICA8ZGl2IGlkPSJyZXN1bHQtZXhwbGFuYXRpb24iIGNsYXNzPSJyZXN1bHQtZXhwbGFuYXRpb24iPjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgaWQ9InJlc3VsdC1kZXRhaWxzIj48L2Rpdj4KICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJyZWNlaXB0LXN0cmlwIj48ZGl2PjxzcGFuIGNsYXNzPSJyZWNlaXB0LWxhYmVsIj5SRUNFSVBUIERJR0VTVCDCtyBTSEEtMjU2PC9zcGFuPjxjb2RlIGlkPSJyZWNlaXB0LWRpZ2VzdCI+PC9jb2RlPjwvZGl2PjxidXR0b24gY2xhc3M9Imljb24tYnV0dG9uIiBpZD0iY29weS1kaWdlc3QiIGFyaWEtbGFiZWw9IkNvcHkgcmVjZWlwdCBkaWdlc3QiIHRpdGxlPSJDb3B5IGRpZ2VzdCIgdHlwZT0iYnV0dG9uIj5Db3B5PC9idXR0b24+PC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0icmVjZWlwdC1hY3Rpb25zIj48YnV0dG9uIGNsYXNzPSJzZWNvbmRhcnktYnV0dG9uIiBpZD0iZG93bmxvYWQtcmVjZWlwdCIgdHlwZT0iYnV0dG9uIj5Eb3dubG9hZCByZWNlaXB0IDxzcGFuIGFyaWEtaGlkZGVuPSJ0cnVlIj7ihpM8L3NwYW4+PC9idXR0b24+PGJ1dHRvbiBjbGFzcz0idGV4dC1idXR0b24iIGlkPSJ2ZXJpZnktY3VycmVudCIgdHlwZT0iYnV0dG9uIj5WZXJpZnkgdGhpcyByZXN1bHQgPHNwYW4gYXJpYS1oaWRkZW49InRydWUiPuKGkjwvc3Bhbj48L2J1dHRvbj48L2Rpdj4KICAgICAgICAgICAgICA8ZGV0YWlscyBjbGFzcz0ianNvbi1kZXRhaWxzIj48c3VtbWFyeT5JbnNwZWN0IGZ1bGwgcmVzdWx0PC9zdW1tYXJ5PjxwcmUgaWQ9InJlc3VsdC1qc29uIiB0YWJpbmRleD0iMCI+PC9wcmU+PC9kZXRhaWxzPgogICAgICAgICAgICAgIDxkZXRhaWxzIGNsYXNzPSJqc29uLWRldGFpbHMiPjxzdW1tYXJ5Pkluc3BlY3QgY29tcGxldGUgcmVjZWlwdDwvc3VtbWFyeT48cHJlIGlkPSJyZWNlaXB0LWpzb24iIHRhYmluZGV4PSIwIj48L3ByZT48L2RldGFpbHM+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9zZWN0aW9uPgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KCiAgICAgIDxkaXYgaWQ9InZlcmlmeS1wYW5lbCIgcm9sZT0idGFicGFuZWwiIGFyaWEtbGFiZWxsZWRieT0idmVyaWZ5LXRhYiIgaGlkZGVuPgogICAgICAgIDxkaXYgY2xhc3M9InZlcmlmeS1pbnRybyI+PGgyPkdpdmUgYSByZWNlaXB0IGEgc2Vjb25kIGxvb2suPC9oMj48cD5DaGVjayBpdHMgZGlnZXN0IGFuZCByZXBsYXkgdGhlIGNvbXB1dGF0aW9uLiBBZGQgYSBkaWdlc3QgZnJvbSBhIHRydXN0ZWQgc291cmNlIHRvIGNoZWNrIGl0cyBleHRlcm5hbCBhbmNob3IsIHRvby48L3A+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0id29yay1ncmlkIHZlcmlmeS1ncmlkIj4KICAgICAgICAgIDxzZWN0aW9uIGNsYXNzPSJwYW5lbCIgYXJpYS1sYWJlbGxlZGJ5PSJyZWNlaXB0LWlucHV0LWhlYWRpbmciPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwYW5lbC1oZWFkaW5nIj48ZGl2PjxwIGNsYXNzPSJzZWN0aW9uLWluZGV4Ij4wMSAvIElNUE9SVDwvcD48aDIgaWQ9InJlY2VpcHQtaW5wdXQtaGVhZGluZyI+WW91ciByZWNlaXB0PC9oMj48L2Rpdj48YnV0dG9uIGNsYXNzPSJ0ZXh0LWJ1dHRvbiIgaWQ9ImxvYWQtY3VycmVudCIgdHlwZT0iYnV0dG9uIiBkaXNhYmxlZD5Vc2UgbGFzdCByZXN1bHQ8L2J1dHRvbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaW1wb3J0LXpvbmUiIGlkPSJpbXBvcnQtem9uZSI+PHNwYW4gY2xhc3M9ImltcG9ydC1pY29uIiBhcmlhLWhpZGRlbj0idHJ1ZSI+4oalPC9zcGFuPjxkaXY+PHN0cm9uZz5Ecm9wIGEgcmVjZWlwdCBoZXJlPC9zdHJvbmc+PHA+b3IgY2hvb3NlIGEgSlNPTiBmaWxlIGZyb20geW91ciBtYWNoaW5lPC9wPjwvZGl2PjxsYWJlbCBjbGFzcz0ic2Vjb25kYXJ5LWJ1dHRvbiBmaWxlLWJ1dHRvbiIgZm9yPSJyZWNlaXB0LWZpbGUiPkNob29zZSBmaWxlPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJyZWNlaXB0LWZpbGUiIGFjY2VwdD0iLmpzb24sYXBwbGljYXRpb24vanNvbiI+PC9sYWJlbD48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZWRpdG9yLXRvb2xiYXIiPjxsYWJlbCBjbGFzcz0iZmlsZS1uYW1lIiBmb3I9InJlY2VpcHQtZWRpdG9yIiBpZD0icmVjZWlwdC1maWxlbmFtZSI+T3IgcGFzdGUgcmVjZWlwdCBKU09OPC9sYWJlbD48c3BhbiBjbGFzcz0ic3ludGF4LWxhYmVsIj5KU09OPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8dGV4dGFyZWEgaWQ9InJlY2VpcHQtZWRpdG9yIiBjbGFzcz0ianNvbi1lZGl0b3IgcmVjZWlwdC1lZGl0b3IiIHNwZWxsY2hlY2s9ImZhbHNlIiBhdXRvY2FwaXRhbGl6ZT0ib2ZmIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9IlBhc3RlIHRoZSBjb21wbGV0ZSByZWNlaXB0LCBpbmNsdWRpbmcgaXRzIGRpZ2VzdC4iPjwvdGV4dGFyZWE+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImFuY2hvci1maWVsZCI+PGxhYmVsIGZvcj0idHJ1c3RlZC1kaWdlc3QiPlRydXN0ZWQgZGlnZXN0IDxzcGFuPm9wdGlvbmFsPC9zcGFuPjwvbGFiZWw+PGlucHV0IGlkPSJ0cnVzdGVkLWRpZ2VzdCIgdHlwZT0idGV4dCIgc3BlbGxjaGVjaz0iZmFsc2UiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0iNjQtY2hhcmFjdGVyIFNIQS0yNTYgZnJvbSBhIHRydXN0ZWQgc291cmNlIiBtYXhsZW5ndGg9IjY0Ij48cD5BIHJlY2VpcHQncyBvd24gZGlnZXN0IGlzIG5vdCBhbiBpbmRlcGVuZGVudCB0cnVzdCBhbmNob3IuPC9wPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJydW4tY29udHJvbHMiPjxwIGlkPSJpbXBvcnQtc3RhdHVzIj5SZWFkeSB3aGVuIHlvdSBhcmUuPC9wPjxidXR0b24gY2xhc3M9InByaW1hcnktYnV0dG9uIiBpZD0idmVyaWZ5LWJ1dHRvbiIgdHlwZT0iYnV0dG9uIj48c3BhbiBpZD0idmVyaWZ5LWJ1dHRvbi1sYWJlbCI+VmVyaWZ5ICYgcmVwbGF5PC9zcGFuPjxzcGFuIGFyaWEtaGlkZGVuPSJ0cnVlIj7ihpc8L3NwYW4+PC9idXR0b24+PC9kaXY+CiAgICAgICAgICAgIDxwIGNsYXNzPSJlcnJvci1iYW5uZXIgaW5zZXQtZXJyb3IiIGlkPSJ2ZXJpZnktZXJyb3IiIHJvbGU9ImFsZXJ0IiBoaWRkZW4+PC9wPgogICAgICAgICAgPC9zZWN0aW9uPgoKICAgICAgICAgIDxzZWN0aW9uIGNsYXNzPSJwYW5lbCB2ZXJpZmljYXRpb24tcGFuZWwiIGFyaWEtbGFiZWxsZWRieT0idmVyaWZpY2F0aW9uLWhlYWRpbmciIGlkPSJ2ZXJpZmljYXRpb24tcGFuZWwiIGFyaWEtbGl2ZT0icG9saXRlIiBhcmlhLWJ1c3k9ImZhbHNlIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0icGFuZWwtaGVhZGluZyI+PGRpdj48cCBjbGFzcz0ic2VjdGlvbi1pbmRleCI+MDIgLyBDSEVDSzwvcD48aDIgaWQ9InZlcmlmaWNhdGlvbi1oZWFkaW5nIj5WZXJpZmljYXRpb248L2gyPjwvZGl2PjxzcGFuIGNsYXNzPSJwaWxsIiBpZD0idmVyaWZpY2F0aW9uLXN0YXR1cyI+Tk9UIFZFUklGSUVEPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJlbXB0eS1zdGF0ZSB2ZXJpZmljYXRpb24tZW1wdHkiIGlkPSJlbXB0eS12ZXJpZmljYXRpb24iPjxkaXYgY2xhc3M9ImVtcHR5LWljb24iIGFyaWEtaGlkZGVuPSJ0cnVlIj48c3ZnIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSI+PHBhdGggZD0ibTI4IDYgMTcgN3YxNGMwIDExLTEwIDE5LTE3IDIzLTctNC0xNy0xMi0xNy0yM1YxM2wxNy03WiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0ibTIxIDI4IDUgNSAxMC0xMSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS41Ii8+PC9zdmc+PC9kaXY+PGgzPlRydXN0IGlzIGEgY2hlY2sgeW91IGNhbiBydW4uPC9oMz48cD5JbXBvcnQgYSByZWNlaXB0IHRvIGluc3BlY3QgaXRzIGludGVncml0eSwgcmVwbGF5IHN0YXR1cywgYW5kIHRydXN0ZWQgZGlnZXN0IG1hdGNoLjwvcD48L2Rpdj4KICAgICAgICAgICAgPGRpdiBpZD0idmVyaWZpY2F0aW9uLWNvbnRlbnQiIGNsYXNzPSJ2ZXJpZmljYXRpb24tY29udGVudCIgaGlkZGVuPjxkaXYgaWQ9InZlcmlmaWNhdGlvbi1jaGVja3MiIGNsYXNzPSJ2ZXJpZmljYXRpb24tY2hlY2tzIj48L2Rpdj48cCBpZD0idmVyaWZpY2F0aW9uLXJlYXNvbiIgY2xhc3M9InZlcmlmaWNhdGlvbi1yZWFzb24iPjwvcD48ZGl2IGNsYXNzPSJ2ZXJpZmljYXRpb24tbm90ZSI+PHN0cm9uZz5XaGF0IHRoaXMgcHJvdmVzPC9zdHJvbmc+PHA+U3VjY2Vzc2Z1bCByZXBsYXkgcmVwcm9kdWNlcyB0aGUgcmVjb3JkZWQgY29tcHV0YXRpb24uIEl0IGRvZXMgbm90IGVzdGFibGlzaCB0aGF0IHRoZSBzdXBwbGllZCBldmlkZW5jZSBvciBtb2RlbCBpcyB0cnVlLjwvcD48L2Rpdj48ZGV0YWlscyBjbGFzcz0ianNvbi1kZXRhaWxzIj48c3VtbWFyeT5JbnNwZWN0IHZlcmlmaWNhdGlvbiByZXNwb25zZTwvc3VtbWFyeT48cHJlIGlkPSJ2ZXJpZmljYXRpb24tanNvbiIgdGFiaW5kZXg9IjAiPjwvcHJlPjwvZGV0YWlscz48L2Rpdj4KICAgICAgICAgIDwvc2VjdGlvbj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CiAgICA8Zm9vdGVyPjxzcGFuPkNPU01JQyBDT01NT05TPC9zcGFuPjxwPlJlcHJvZHVjaWJsZSBjb21wdXRhdGlvbi4gRXhwbGljaXQgdW5jZXJ0YWludHkuIEluc3BlY3RhYmxlIGRlY2lzaW9ucy48L3A+PGEgaHJlZj0iI3BhZ2UtdGl0bGUiPkJhY2sgdG8gdG9wIOKGkTwvYT48L2Zvb3Rlcj4KICA8L21haW4+CiAgPGRpdiBjbGFzcz0idG9hc3QiIGlkPSJ0b2FzdCIgcm9sZT0ic3RhdHVzIiBoaWRkZW4+PC9kaXY+CjwvYm9keT4KPC9odG1sPgo=", "web/styles.css": "LyoKICogQ29weXJpZ2h0IDIwMjYgTGVsYW5kIEpvdXJkYW4gSUkgLyBDJkwgU3RyYXRlZ3kKICogU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAKICovCkBjaGFyc2V0ICJVVEYtOCI7Cjpyb290ey0tYmc6I2Y2ZjVmMTstLXN1cmZhY2U6I2ZmZjstLWluazojMjQyMzMxOy0tbXV0ZWQ6Izc3NzQ4MDstLWxpbmU6I2U2ZTRlOTstLXB1cnBsZTojNTk0MGM0Oy0tcHVycGxlLWRhcms6IzQwMmJhMjstLXB1cnBsZS1zb2Z0OiNmMGVjZmY7LS1ncmVlbjojMjM3NDVhOy0tZ3JlZW4tc29mdDojZWFmN2VmOy0tYW1iZXI6IzhhNjUxODstLWFtYmVyLXNvZnQ6I2ZmZjZkZjstLXJlZDojYTkzNjQwOy0tcmVkLXNvZnQ6I2ZmZjBmMDstLW1vbm86dWktbW9ub3NwYWNlLFNGTW9uby1SZWd1bGFyLENvbnNvbGFzLCJMaWJlcmF0aW9uIE1vbm8iLG1vbm9zcGFjZTstLXNhbnM6SW50ZXIsdWktc2Fucy1zZXJpZiwtYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCwiU2Vnb2UgVUkiLHNhbnMtc2VyaWZ9Cip7Ym94LXNpemluZzpib3JkZXItYm94fWh0bWx7c2Nyb2xsLWJlaGF2aW9yOnNtb290aH1ib2R5e21hcmdpbjowO2JhY2tncm91bmQ6dmFyKC0tYmcpO2NvbG9yOnZhcigtLWluayk7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyk7Zm9udC1zaXplOjE0cHg7bGluZS1oZWlnaHQ6MS41NX1idXR0b24saW5wdXQsdGV4dGFyZWF7Zm9udDppbmhlcml0fWJ1dHRvbixhLGxhYmVsLmZpbGUtYnV0dG9ue3RvdWNoLWFjdGlvbjptYW5pcHVsYXRpb259YnV0dG9ue2N1cnNvcjpwb2ludGVyfWJ1dHRvbjpkaXNhYmxlZHtjdXJzb3I6bm90LWFsbG93ZWQ7b3BhY2l0eTouNDh9YnV0dG9uOmZvY3VzLXZpc2libGUsYTpmb2N1cy12aXNpYmxlLHN1bW1hcnk6Zm9jdXMtdmlzaWJsZXtvdXRsaW5lOjNweCBzb2xpZCAjYjRhNGYyO291dGxpbmUtb2Zmc2V0OjRweH10ZXh0YXJlYTpmb2N1cy12aXNpYmxlLGlucHV0OmZvY3VzLXZpc2libGV7b3V0bGluZToycHggc29saWQgI2E5OTVlZjtvdXRsaW5lLW9mZnNldDotMnB4fWJ1dHRvbnt0cmFuc2l0aW9uOmJhY2tncm91bmQgLjE1cyxjb2xvciAuMTVzLGJveC1zaGFkb3cgLjE1c31he2NvbG9yOmluaGVyaXR9aDEsaDIsaDMscHttYXJnaW46MH1oMntmb250LXNpemU6MThweDtsaW5lLWhlaWdodDoxLjM1O2ZvbnQtd2VpZ2h0OjY1MDtsZXR0ZXItc3BhY2luZzotLjQ1cHh9aDN7Zm9udC1zaXplOjE3cHg7bGV0dGVyLXNwYWNpbmc6LS4zcHh9YnV0dG9uIHN2Z3t3aWR0aDoxNnB4O2hlaWdodDoxNnB4fVtoaWRkZW5de2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9LnNyLW9ubHl7cG9zaXRpb246YWJzb2x1dGU7d2lkdGg6MXB4O2hlaWdodDoxcHg7cGFkZGluZzowO21hcmdpbjotMXB4O292ZXJmbG93OmhpZGRlbjtjbGlwOnJlY3QoMCwwLDAsMCk7d2hpdGUtc3BhY2U6bm93cmFwO2JvcmRlcjowfS5za2lwLWxpbmt7cG9zaXRpb246Zml4ZWQ7dG9wOjhweDtsZWZ0OjhweDt6LWluZGV4OjIwO2JhY2tncm91bmQ6dmFyKC0taW5rKTtjb2xvcjojZmZmO3BhZGRpbmc6MTJweCAxOHB4O3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0xNjAlKX0uc2tpcC1saW5rOmZvY3Vze3RyYW5zZm9ybTp0cmFuc2xhdGVZKDApfQouc2l0ZS1oZWFkZXJ7aGVpZ2h0Ojg4cHg7cGFkZGluZzowIG1heCgzMnB4LGNhbGMoKDEwMHZ3IC0gMTQ0MHB4KS8yKSk7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKX0uYnJhbmR7ZGlzcGxheTppbmxpbmUtZmxleDtnYXA6MTJweDthbGlnbi1pdGVtczpjZW50ZXI7dGV4dC1kZWNvcmF0aW9uOm5vbmU7bGV0dGVyLXNwYWNpbmc6MS40cHg7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NTAwfS5icmFuZCBzdmd7d2lkdGg6MzFweDtoZWlnaHQ6MzFweDtjb2xvcjp2YXIoLS1wdXJwbGUpfS5icmFuZCBzdHJvbmd7Zm9udC13ZWlnaHQ6NzUwfS5oZWFkZXItcmlnaHR7ZGlzcGxheTpmbGV4O2dhcDoyNXB4O2FsaWduLWl0ZW1zOmNlbnRlcn0uZWRpdGlvbntmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6MTBweDtjb2xvcjp2YXIoLS1tdXRlZCk7bGV0dGVyLXNwYWNpbmc6MXB4fS5jb25uZWN0aW9ue2Rpc3BsYXk6aW5saW5lLWZsZXg7Z2FwOjhweDthbGlnbi1pdGVtczpjZW50ZXI7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtiYWNrZ3JvdW5kOiNmYmZhZjc7Ym9yZGVyLXJhZGl1czoyMHB4O2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6NXB4IDExcHg7Y29sb3I6dmFyKC0tbXV0ZWQpfS5zdGF0dXMtZG90e3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2I3YWRiOH0uY29ubmVjdGlvbi5jb25uZWN0ZWQgLnN0YXR1cy1kb3R7YmFja2dyb3VuZDp2YXIoLS1ncmVlbil9LmNvbm5lY3Rpb24uY29ubmVjdGVke2NvbG9yOiM1MTYxNWJ9LmNvbm5lY3Rpb24uZGlzY29ubmVjdGVkIC5zdGF0dXMtZG90e2JhY2tncm91bmQ6dmFyKC0tcmVkKX1tYWlue21heC13aWR0aDoxNDQwcHg7bWFyZ2luOmF1dG87cGFkZGluZzowIDMycHh9LmludHJve2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpmbGV4LWVuZDtwYWRkaW5nOjU1cHggMCA0NHB4O2dhcDoyNXB4fS5leWVicm93e2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMHB4O2xldHRlci1zcGFjaW5nOjEuNDVweDtjb2xvcjp2YXIoLS1wdXJwbGUpO2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjE2cHh9aDF7Zm9udC1zaXplOmNsYW1wKDMycHgsMy41NXZ3LDUwcHgpO2ZvbnQtd2VpZ2h0OjU1MDtsZXR0ZXItc3BhY2luZzotMnB4O2xpbmUtaGVpZ2h0OjEuMTR9aDEgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tcHVycGxlKX0uaW50cm8tY29weXtjb2xvcjojNzM2ZjdjO21heC13aWR0aDo1OTBweDttYXJnaW4tdG9wOjE1cHg7Zm9udC1zaXplOjE0cHg7bGluZS1oZWlnaHQ6MS43fS5pbnRyby1ub3Rle2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2dhcDoxMXB4O2ZsZXgtc2hyaW5rOjA7Zm9udC1zaXplOjExcHg7bGluZS1oZWlnaHQ6MS44O21hcmdpbi1ib3R0b206NHB4O2NvbG9yOnZhcigtLW11dGVkKX0uaW50cm8tbm90ZSBzdHJvbmd7Zm9udC13ZWlnaHQ6NDUwO2NvbG9yOiM1MjRlNjB9Lm5vdGUtc3ltYm9se2ZvbnQtc2l6ZToyN3B4O2NvbG9yOiM5OThmYWE7bGluZS1oZWlnaHQ6MS4yfS53b3Jrc3BhY2UtbmF2e2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgI2RjZDllMTttYXJnaW4tYm90dG9tOjI2cHh9Lm1vZGUtdGFic3tkaXNwbGF5OmZsZXg7Z2FwOjMwcHh9Lm1vZGUtdGFie2JvcmRlcjowO2JvcmRlci1ib3R0b206MnB4IHNvbGlkIHRyYW5zcGFyZW50O2JhY2tncm91bmQ6bm9uZTtjb2xvcjp2YXIoLS1tdXRlZCk7cGFkZGluZzoxM3B4IDAgMTVweDtmb250LXdlaWdodDo1NTA7Zm9udC1zaXplOjEzcHg7bWFyZ2luLWJvdHRvbTotMXB4fS5tb2RlLXRhYiBzcGFue2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi1sZWZ0OjhweDtvcGFjaXR5Oi42NX0ubW9kZS10YWIuYWN0aXZle2JvcmRlci1jb2xvcjp2YXIoLS1wdXJwbGUpO2NvbG9yOnZhcigtLXB1cnBsZSl9Lm1vZGUtdGFiOmhvdmVye2NvbG9yOnZhcigtLXB1cnBsZSl9Lm5hdi1ub3Rle2ZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ZDg3OTd9LmV4YW1wbGUtaGVhZGluZ3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6YmFzZWxpbmU7Z2FwOjE0cHg7bWFyZ2luLWJvdHRvbToxM3B4fS5leGFtcGxlLWhlYWRpbmcgaDJ7Zm9udC1zaXplOjEzcHg7bGV0dGVyLXNwYWNpbmc6MDtmb250LXdlaWdodDo2NTB9LmV4YW1wbGUtaGVhZGluZyBzcGFue2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW11dGVkKX0uZXhhbXBsZXN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKTtnYXA6MTJweDttYXJnaW4tYm90dG9tOjI1cHh9LmV4YW1wbGUtY2FyZHtwYWRkaW5nOjE1cHggMTdweDtiYWNrZ3JvdW5kOiNmYWY5ZjY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjhweDt0ZXh0LWFsaWduOmxlZnQ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Z2FwOjEzcHg7bWluLWhlaWdodDo5MXB4fS5leGFtcGxlLWNhcmQ6aG92ZXJ7YmFja2dyb3VuZDp3aGl0ZTtib3JkZXItY29sb3I6I2JiYjFkNn0uZXhhbXBsZS1jYXJkLnNlbGVjdGVke2JvcmRlci1jb2xvcjojYjZhNmUxO2JhY2tncm91bmQ6I2YyZWVmYjtib3gtc2hhZG93OjAgMCAwIDFweCAjZTRkY2Y2IGluc2V0fS5leGFtcGxlLW51bWJlcntmb250LWZhbWlseTp2YXIoLS1tb25vKTtjb2xvcjojOWE5MmFhO2ZvbnQtc2l6ZToxMHB4O3BhZGRpbmctdG9wOjNweH0uZXhhbXBsZS10aXRsZXtkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjY1MDttYXJnaW4tYm90dG9tOjRweDtsaW5lLWhlaWdodDoxLjN9LmV4YW1wbGUtZGVzY3JpcHRpb257Zm9udC1zaXplOjExcHg7bGluZS1oZWlnaHQ6MS41O2NvbG9yOiM4MTc5OGQ7ZGlzcGxheTpibG9ja30uZXhhbXBsZS1jYXJkLnNlbGVjdGVkIC5leGFtcGxlLXRpdGxle2NvbG9yOnZhcigtLXB1cnBsZS1kYXJrKX0uZXhhbXBsZS1jYXJkLnNlbGVjdGVkIC5leGFtcGxlLW51bWJlcntjb2xvcjp2YXIoLS1wdXJwbGUpfS5leGFtcGxlLWFycm93e21hcmdpbi1sZWZ0OmF1dG87Y29sb3I6I2EyOWFhZjtmb250LXNpemU6MTdweDtsaW5lLWhlaWdodDoxO3BhZGRpbmctdG9wOjFweH0uZXhhbXBsZS1jYXJkLnNlbGVjdGVkIC5leGFtcGxlLWFycm93e2NvbG9yOnZhcigtLXB1cnBsZSl9LmxvYWRpbmctbWVzc2FnZXtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7cGFkZGluZzoyMHB4fS53b3JrLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwuOTVmcikgbWlubWF4KDAsMS4wNWZyKTtnYXA6MjBweDthbGlnbi1pdGVtczpzdGFydH0ucGFuZWx7YmFja2dyb3VuZDp2YXIoLS1zdXJmYWNlKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTBweDtvdmVyZmxvdzpoaWRkZW47Ym94LXNoYWRvdzowIDJweCAzcHggIzI3MjAzNTAzfS5wYW5lbC1oZWFkaW5ne2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7cGFkZGluZzoyM3B4IDI0cHggMjBweDtnYXA6MTJweH0uc2VjdGlvbi1pbmRleHtmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2NvbG9yOiM5NzkwOWY7bWFyZ2luLWJvdHRvbTo3cHh9LnRleHQtYnV0dG9ue2JvcmRlcjowO2JhY2tncm91bmQ6bm9uZTtwYWRkaW5nOjVweCAwO2NvbG9yOnZhcigtLXB1cnBsZSk7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NjAwfS50ZXh0LWJ1dHRvbjpob3Zlcntjb2xvcjp2YXIoLS1wdXJwbGUtZGFyayk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZX0uZWRpdG9yLXRvb2xiYXJ7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSk7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6OXB4IDIycHg7YmFja2dyb3VuZDojZmFmOWZjO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4YTgyOTl9LmZpbGUtbmFtZXtjb2xvcjojNjU1ZTc0fS5zeW50YXgtbGFiZWx7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxcHh9Lmpzb24tZWRpdG9ye2Rpc3BsYXk6YmxvY2s7d2lkdGg6MTAwJTttaW4taGVpZ2h0OjM2MnB4O3Jlc2l6ZTp2ZXJ0aWNhbDtib3JkZXI6MDtib3JkZXItcmFkaXVzOjA7cGFkZGluZzoyMHB4IDIzcHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjExLjVweDtsaW5lLWhlaWdodDoxLjc7Y29sb3I6IzRlNDI2YjtiYWNrZ3JvdW5kOiNmZGZjZmU7dGFiLXNpemU6MjtvdmVyZmxvdzphdXRvO3doaXRlLXNwYWNlOnByZX0uanNvbi1lZGl0b3I6OnBsYWNlaG9sZGVye2NvbG9yOiNhMjlhYWM7d2hpdGUtc3BhY2U6bm9ybWFsfS5lZGl0b3ItZm9vdGVye2JvcmRlci10b3A6MXB4IHNvbGlkICNlZmVhZjQ7cGFkZGluZzo4cHggMjJweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjEycHg7Y29sb3I6I2FhYTFiNDtmb250LXNpemU6MTBweDtmb250LWZhbWlseTp2YXIoLS1tb25vKTtiYWNrZ3JvdW5kOiNmZGZjZmV9LnNob3J0Y3V0e2ZvbnQtZmFtaWx5OnZhcigtLXNhbnMpO2NvbG9yOiM5YjkxYWF9LnJ1bi1jb250cm9sc3tib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1saW5lKTtwYWRkaW5nOjE3cHggMjFweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxNnB4fS5ydW4tY29udHJvbHMgcHtmb250LXNpemU6MTBweDttYXgtd2lkdGg6MTg1cHg7Y29sb3I6IzkxODc5ZTtsaW5lLWhlaWdodDoxLjU1fS5wcmltYXJ5LWJ1dHRvbntwYWRkaW5nOjExcHggMTdweDtjb2xvcjp3aGl0ZTtiYWNrZ3JvdW5kOnZhcigtLXB1cnBsZSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1wdXJwbGUpO2JvcmRlci1yYWRpdXM6NXB4O2Rpc3BsYXk6aW5saW5lLWZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Z2FwOjE4cHg7d2hpdGUtc3BhY2U6bm93cmFwO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjYwMDttaW4taGVpZ2h0OjQwcHh9LnByaW1hcnktYnV0dG9uOmhvdmVyOm5vdCg6ZGlzYWJsZWQpe2JhY2tncm91bmQ6dmFyKC0tcHVycGxlLWRhcmspO2JvcmRlci1jb2xvcjp2YXIoLS1wdXJwbGUtZGFyayk7Ym94LXNoYWRvdzowIDNweCA4cHggIzU5NDBjNDIxfS5wcmltYXJ5LWJ1dHRvbiBzcGFuOmxhc3QtY2hpbGR7Zm9udC1zaXplOjE3cHg7bGluZS1oZWlnaHQ6MX0ucGlsbHtkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtib3JkZXItcmFkaXVzOjRweDtiYWNrZ3JvdW5kOiNmNGYyZjc7Y29sb3I6Izk2OGI5ZjtwYWRkaW5nOjRweCA3cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzouNXB4O3doaXRlLXNwYWNlOm5vd3JhcH0ucGlsbC5ydW5uaW5ne2JhY2tncm91bmQ6dmFyKC0tcHVycGxlLXNvZnQpO2NvbG9yOnZhcigtLXB1cnBsZSl9LnBpbGwucmVhZHksLnBpbGwudmFsaWR7YmFja2dyb3VuZDp2YXIoLS1ncmVlbi1zb2Z0KTtjb2xvcjp2YXIoLS1ncmVlbil9LnBpbGwuaW52YWxpZHtiYWNrZ3JvdW5kOnZhcigtLXJlZC1zb2Z0KTtjb2xvcjp2YXIoLS1yZWQpfS5waWxsLndhcm5pbmd7YmFja2dyb3VuZDp2YXIoLS1hbWJlci1zb2Z0KTtjb2xvcjp2YXIoLS1hbWJlcil9LmVtcHR5LXN0YXRle21pbi1oZWlnaHQ6NTAycHg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjQ1cHggMzZweDt0ZXh0LWFsaWduOmNlbnRlcjtib3JkZXItdG9wOjFweCBzb2xpZCAjZjBlZGYzfS5lbXB0eS1pY29ue3dpZHRoOjY3cHg7aGVpZ2h0OjY3cHg7ZGlzcGxheTpncmlkO3BsYWNlLWl0ZW1zOmNlbnRlcjtjb2xvcjojYjZhYWNiO21hcmdpbi1ib3R0b206MjVweH0uZW1wdHktaWNvbiBzdmd7d2lkdGg6NTVweDtoZWlnaHQ6NTVweH0uZW1wdHktc3RhdGUgaDN7Zm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NTUwO2NvbG9yOiM2MjU4NmU7bWFyZ2luLWJvdHRvbToxMXB4fS5lbXB0eS1zdGF0ZSBwe2ZvbnQtc2l6ZToxMnB4O2NvbG9yOiM5YjkyYTQ7bGluZS1oZWlnaHQ6MS44O21heC13aWR0aDozMTVweH0uZW1wdHktY2FwdGlvbntmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6OXB4O2NvbG9yOiNiM2FhYmI7bWFyZ2luLXRvcDoyOHB4fS5yZXN1bHQtY29udGVudHtwYWRkaW5nOjAgMjRweCAyMHB4fS5zdW1tYXJ5LWNhcmRze2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSk7Z2FwOjhweDttYXJnaW46MnB4IDAgMThweH0uc3VtbWFyeS1jYXJke2JhY2tncm91bmQ6I2Y4ZjdmYjtib3JkZXI6MXB4IHNvbGlkICNlZGU4ZjI7cGFkZGluZzoxM3B4IDEycHg7Ym9yZGVyLXJhZGl1czo2cHg7bWluLWhlaWdodDo4NXB4fS5zdW1tYXJ5LWNhcmQtbGFiZWx7ZGlzcGxheTpibG9jazt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjdweDtmb250LXNpemU6OHB4O2NvbG9yOiM5Mjg3OWU7Zm9udC13ZWlnaHQ6NjUwO21hcmdpbi1ib3R0b206N3B4fS5zdW1tYXJ5LWNhcmQtdmFsdWV7Zm9udC1zaXplOjIwcHg7Zm9udC13ZWlnaHQ6NjAwO2xldHRlci1zcGFjaW5nOi0uNnB4O2NvbG9yOiM0YzM5NmM7d29yZC1icmVhazpicmVhay13b3JkO2xpbmUtaGVpZ2h0OjEuMn0uc3VtbWFyeS1jYXJkLXZhbHVlLmxvbmd7Zm9udC1zaXplOjEzcHg7bGV0dGVyLXNwYWNpbmc6MDtwYWRkaW5nLXRvcDozcHh9LnN1bW1hcnktY2FyZC1ub3Rle2ZvbnQtc2l6ZTo5cHg7Y29sb3I6I2ExOTRhZDttYXJnaW4tdG9wOjZweH0ucmVzdWx0LWV4cGxhbmF0aW9ue2ZvbnQtc2l6ZToxMnB4O2xpbmUtaGVpZ2h0OjEuNzU7Y29sb3I6IzgxNzM4ZTttYXJnaW4tYm90dG9tOjE5cHh9LnJlc3VsdC1leHBsYW5hdGlvbiBzdHJvbmd7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOiM2MjUwNzB9LmRldGFpbC1zZWN0aW9ue2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpO3BhZGRpbmc6MTZweCAwfS5kZXRhaWwtc2VjdGlvbiBoM3tmb250LXNpemU6MTFweDtsZXR0ZXItc3BhY2luZzowO2ZvbnQtd2VpZ2h0OjY1MDttYXJnaW4tYm90dG9tOjEycHh9LmRhdGEtdGFibGUtd3JhcHtvdmVyZmxvdzphdXRvfS5kYXRhLXRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMHB4O2xpbmUtaGVpZ2h0OjEuNX0uZGF0YS10YWJsZSB0aHt0ZXh0LWFsaWduOmxlZnQ7Zm9udC13ZWlnaHQ6NTAwO2NvbG9yOiNhMDkxYWQ7Zm9udC1zaXplOjlweDtwYWRkaW5nOjAgOXB4IDdweCAwO3doaXRlLXNwYWNlOm5vd3JhcH0uZGF0YS10YWJsZSB0ZHtwYWRkaW5nOjhweCA5cHggOHB4IDA7Ym9yZGVyLXRvcDoxcHggc29saWQgI2YwZWJmNDt2ZXJ0aWNhbC1hbGlnbjp0b3A7bWF4LXdpZHRoOjIyMHB4O292ZXJmbG93LXdyYXA6YW55d2hlcmU7Y29sb3I6IzY4NTY3M30uZGF0YS10YWJsZSB0ZDpmaXJzdC1jaGlsZHtjb2xvcjojNDEzMDRlO2ZvbnQtd2VpZ2h0OjU1MH0uZGF0YS10YWJsZSBjb2Rle2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMHB4fS5iZWxpZWYtcm93e21hcmdpbjoxMXB4IDB9LmJlbGllZi1saW5le2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7Zm9udC1zaXplOjExcHh9LmJlbGllZi1saW5lIHNwYW46Zmlyc3QtY2hpbGR7Y29sb3I6IzY2NTY3NH0uYmVsaWVmLWxpbmUgc3Ryb25ne2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMHB4O2NvbG9yOnZhcigtLXB1cnBsZSk7Zm9udC13ZWlnaHQ6NTAwfS5iZWxpZWYtdHJhY2t7aGVpZ2h0OjVweDtiYWNrZ3JvdW5kOiNmMWVkZjY7Ym9yZGVyLXJhZGl1czozcHg7bWFyZ2luLXRvcDo3cHg7b3ZlcmZsb3c6aGlkZGVufS5iZWxpZWYtZmlsbHtoZWlnaHQ6MTAwJTtiYWNrZ3JvdW5kOiM4Zjc5Y2I7Ym9yZGVyLXJhZGl1czozcHh9LnJlY2VpcHQtc3RyaXB7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSk7cGFkZGluZzoxN3B4IDAgMTRweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxM3B4fS5yZWNlaXB0LXN0cmlwPmRpdnttaW4td2lkdGg6MH0ucmVjZWlwdC1sYWJlbHtmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6OHB4O2NvbG9yOiNhMDkxYWQ7bGV0dGVyLXNwYWNpbmc6LjdweDtkaXNwbGF5OmJsb2NrO21hcmdpbi1ib3R0b206NnB4fS5yZWNlaXB0LXN0cmlwIGNvZGV7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjlweDt3b3JkLWJyZWFrOmJyZWFrLWFsbDtjb2xvcjojN2U2YzhhO2Rpc3BsYXk6YmxvY2s7bGluZS1oZWlnaHQ6MS44fS5pY29uLWJ1dHRvbntmb250LXNpemU6OXB4O2JhY2tncm91bmQ6bm9uZTtjb2xvcjojODg3NDk1O2JvcmRlcjoxcHggc29saWQgI2U4ZGZlZDtib3JkZXItcmFkaXVzOjRweDtwYWRkaW5nOjVweCA3cHh9Lmljb24tYnV0dG9uOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tcHVycGxlLXNvZnQpfS5yZWNlaXB0LWFjdGlvbnN7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTJweDttYXJnaW4tYm90dG9tOjE3cHh9LnNlY29uZGFyeS1idXR0b257Ym9yZGVyOjFweCBzb2xpZCAjZGRkNWU3O2JvcmRlci1yYWRpdXM6NXB4O2NvbG9yOiM3NzYzODY7YmFja2dyb3VuZDojZmZmO3BhZGRpbmc6OXB4IDEycHg7Zm9udC1zaXplOjEwcHg7Zm9udC13ZWlnaHQ6NTUwO3RleHQtZGVjb3JhdGlvbjpub25lO2Rpc3BsYXk6aW5saW5lLWZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Z2FwOjE1cHg7d2hpdGUtc3BhY2U6bm93cmFwfS5zZWNvbmRhcnktYnV0dG9uOmhvdmVye2JhY2tncm91bmQ6I2Y3ZjRmYjtib3JkZXItY29sb3I6I2M2YjhkNn0uanNvbi1kZXRhaWxze2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpfS5qc29uLWRldGFpbHMgc3VtbWFyeXtjdXJzb3I6cG9pbnRlcjtwYWRkaW5nOjEycHggMDtjb2xvcjojODk3ODk2O2ZvbnQtc2l6ZToxMHB4O2xpc3Qtc3R5bGUtcG9zaXRpb246aW5zaWRlfS5qc29uLWRldGFpbHMgcHJle3BhZGRpbmc6MTNweDtiYWNrZ3JvdW5kOiNmYWY4ZmM7Y29sb3I6IzZkNTI3Zjtib3JkZXI6MXB4IHNvbGlkICNlZWU3ZjI7Ym9yZGVyLXJhZGl1czo0cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjEwcHg7bGluZS1oZWlnaHQ6MS43O21heC1oZWlnaHQ6NDAwcHg7b3ZlcmZsb3c6YXV0bzttYXJnaW46MCAwIDEycHg7dGFiLXNpemU6Mn0uZXJyb3ItYmFubmVye2JhY2tncm91bmQ6dmFyKC0tcmVkLXNvZnQpO2JvcmRlcjoxcHggc29saWQgI2VkY2JkMDtib3JkZXItcmFkaXVzOjVweDtwYWRkaW5nOjExcHggMTRweDtjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbjoxMHB4IDAgMjBweDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtvdmVyZmxvdy13cmFwOmFueXdoZXJlfS5pbnNldC1lcnJvcnttYXJnaW46MCAyMHB4IDE4cHh9LnZlcmlmeS1pbnRyb3twYWRkaW5nOjJweCAwIDI0cHh9LnZlcmlmeS1pbnRybyBoMntmb250LXNpemU6MThweDtmb250LXdlaWdodDo1NTB9LnZlcmlmeS1pbnRybyBwe2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweDttYXJnaW4tdG9wOjhweH0uaW1wb3J0LXpvbmV7bWFyZ2luOjAgMjJweCAyMXB4O3BhZGRpbmc6MTlweCAxNXB4O2JhY2tncm91bmQ6I2ZiZmFmYztib3JkZXI6MXB4IGRhc2hlZCAjZDNjOGUxO2JvcmRlci1yYWRpdXM6NnB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjE0cHh9LmltcG9ydC16b25lLmRyYWctb3ZlcntiYWNrZ3JvdW5kOnZhcigtLXB1cnBsZS1zb2Z0KTtib3JkZXItY29sb3I6dmFyKC0tcHVycGxlKX0uaW1wb3J0LWljb257Zm9udC1zaXplOjI2cHg7Y29sb3I6I2E1OTNiNTtsaW5lLWhlaWdodDoxfS5pbXBvcnQtem9uZSBzdHJvbmd7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NTUwO2NvbG9yOiM3NDYwODJ9LmltcG9ydC16b25lIHB7Zm9udC1zaXplOjlweDtjb2xvcjojYTE5MWFkO21hcmdpbi10b3A6M3B4fS5pbXBvcnQtem9uZSAuZmlsZS1idXR0b257bWFyZ2luLWxlZnQ6YXV0bztjdXJzb3I6cG9pbnRlcjtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59LmZpbGUtYnV0dG9uIGlucHV0e3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7b3BhY2l0eTowO3dpZHRoOjEwMCU7Y3Vyc29yOnBvaW50ZXJ9LmZpbGUtYnV0dG9uOmZvY3VzLXdpdGhpbntvdXRsaW5lOjNweCBzb2xpZCAjYjRhNGYyO291dGxpbmUtb2Zmc2V0OjNweH0ucmVjZWlwdC1lZGl0b3J7bWluLWhlaWdodDoyNDVweH0uYW5jaG9yLWZpZWxke3BhZGRpbmc6MTdweCAyMnB4IDE4cHg7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSl9LmFuY2hvci1maWVsZCBsYWJlbHtkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjojNmQ1OTdiO21hcmdpbi1ib3R0b206OHB4fS5hbmNob3ItZmllbGQgbGFiZWwgc3Bhbntmb250LXNpemU6OXB4O2ZvbnQtd2VpZ2h0OjQwMDtjb2xvcjojYTI5NGFjO21hcmdpbi1sZWZ0OjVweH0uYW5jaG9yLWZpZWxkIGlucHV0e3dpZHRoOjEwMCU7Ym9yZGVyOjFweCBzb2xpZCAjZTFkOWU4O2JvcmRlci1yYWRpdXM6NHB4O3BhZGRpbmc6OXB4IDEwcHg7Y29sb3I6IzcyNTQ4NjtiYWNrZ3JvdW5kOiNmY2ZiZmU7Zm9udC1zaXplOjEwcHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9LmFuY2hvci1maWVsZCBpbnB1dDo6cGxhY2Vob2xkZXJ7Y29sb3I6I2IwYTJiYX0uYW5jaG9yLWZpZWxkIHB7Y29sb3I6I2ExOGVhZTtmb250LXNpemU6OXB4O21hcmdpbi10b3A6N3B4fS52ZXJpZmljYXRpb24tZW1wdHl7bWluLWhlaWdodDo1MzhweH0udmVyaWZpY2F0aW9uLWNvbnRlbnR7cGFkZGluZzowIDI0cHggMjRweH0udmVyaWZpY2F0aW9uLWNoZWNrc3tib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1saW5lKX0uY2hlY2stcm93e2Rpc3BsYXk6ZmxleDtnYXA6MTNweDtwYWRkaW5nOjIycHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKX0uY2hlY2staWNvbntmbGV4OjAgMCAyNXB4O2hlaWdodDoyNXB4O2JvcmRlci1yYWRpdXM6NTAlO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6MTJweDtiYWNrZ3JvdW5kOiNmM2VmZjg7Y29sb3I6Izk3ODNhNDttYXJnaW4tdG9wOjFweH0uY2hlY2staWNvbi5nb29ke2JhY2tncm91bmQ6dmFyKC0tZ3JlZW4tc29mdCk7Y29sb3I6dmFyKC0tZ3JlZW4pfS5jaGVjay1pY29uLmJhZHtiYWNrZ3JvdW5kOnZhcigtLXJlZC1zb2Z0KTtjb2xvcjp2YXIoLS1yZWQpfS5jaGVjay1pY29uLm5ldXRyYWx7YmFja2dyb3VuZDp2YXIoLS1hbWJlci1zb2Z0KTtjb2xvcjp2YXIoLS1hbWJlcil9LmNoZWNrLWJvZHl7ZmxleDoxO21pbi13aWR0aDowfS5jaGVjay1oZWFkZXJ7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmJhc2VsaW5lO2dhcDoxMHB4fS5jaGVjay1oZWFkZXIgaDN7Zm9udC1zaXplOjEycHg7bGV0dGVyLXNwYWNpbmc6MDtmb250LXdlaWdodDo2MDB9LmNoZWNrLWhlYWRlciBjb2Rle2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZTo5cHg7Y29sb3I6IzhiNzU5YX0uY2hlY2stYm9keSBwe2ZvbnQtc2l6ZToxMXB4O2NvbG9yOiM5NzgyYTM7bGluZS1oZWlnaHQ6MS42NTttYXJnaW4tdG9wOjVweDttYXgtd2lkdGg6MzUwcHh9LnZlcmlmaWNhdGlvbi1yZWFzb257Zm9udC1zaXplOjEycHg7bGluZS1oZWlnaHQ6MS44O21hcmdpbjoxN3B4IDA7Y29sb3I6IzdjNjc4YTtvdmVyZmxvdy13cmFwOmFueXdoZXJlfS52ZXJpZmljYXRpb24tbm90ZXtiYWNrZ3JvdW5kOiNmOGY2ZmI7Ym9yZGVyLWxlZnQ6MnB4IHNvbGlkICNjNmI2ZGQ7Ym9yZGVyLXJhZGl1czowIDVweCA1cHggMDtwYWRkaW5nOjEzcHggMTZweDttYXJnaW46MjBweCAwfS52ZXJpZmljYXRpb24tbm90ZSBzdHJvbmd7Zm9udC1zaXplOjEwcHg7Y29sb3I6Izc5NjU4Yjtmb250LXdlaWdodDo2MDB9LnZlcmlmaWNhdGlvbi1ub3RlIHB7Zm9udC1zaXplOjEwcHg7Y29sb3I6IzliODhhOTtsaW5lLWhlaWdodDoxLjg7bWFyZ2luLXRvcDo1cHh9Zm9vdGVye2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjE4cHg7cGFkZGluZzozNHB4IDAgMjVweDtmb250LXNpemU6MTBweDtjb2xvcjojYWFhMGFmfWZvb3Rlcj5zcGFue2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2xldHRlci1zcGFjaW5nOjFweDtmb250LXNpemU6OXB4fWZvb3RlciBhe3RleHQtZGVjb3JhdGlvbjpub25lO2ZvbnQtc2l6ZTo5cHg7Y29sb3I6IzliOGJhNn1mb290ZXIgYTpob3Zlcntjb2xvcjp2YXIoLS1wdXJwbGUpfS50b2FzdHtwb3NpdGlvbjpmaXhlZDtib3R0b206MjJweDtsZWZ0OjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNTAlKTtwYWRkaW5nOjEwcHggMThweDtib3JkZXItcmFkaXVzOjZweDtiYWNrZ3JvdW5kOnZhcigtLWluayk7Y29sb3I6d2hpdGU7Ym94LXNoYWRvdzowIDVweCAyMHB4ICMyZjIwNDkzMztmb250LXNpemU6MTJweDt6LWluZGV4OjEwO21heC13aWR0aDo5MHZ3O3RleHQtYWxpZ246Y2VudGVyfQpAbWVkaWEobWluLXdpZHRoOjE1MDBweCl7LnNpdGUtaGVhZGVye3BhZGRpbmctbGVmdDpjYWxjKCgxMDB2dyAtIDEzNzZweCkvMik7cGFkZGluZy1yaWdodDpjYWxjKCgxMDB2dyAtIDEzNzZweCkvMil9fQpAbWVkaWEobWF4LXdpZHRoOjEwMDBweCl7LmludHJvLW5vdGV7ZGlzcGxheTpub25lfS5zdW1tYXJ5LWNhcmQtdmFsdWV7Zm9udC1zaXplOjE4cHh9LnJ1bi1jb250cm9sc3tnYXA6MTBweDtwYWRkaW5nLWxlZnQ6MTZweDtwYWRkaW5nLXJpZ2h0OjE2cHh9LnJ1bi1jb250cm9scyBwe2ZvbnQtc2l6ZTo5cHh9LnBhbmVsLWhlYWRpbmd7cGFkZGluZzoyMHB4fS5yZXN1bHQtY29udGVudCwudmVyaWZpY2F0aW9uLWNvbnRlbnR7cGFkZGluZy1sZWZ0OjIwcHg7cGFkZGluZy1yaWdodDoyMHB4fS5wcmltYXJ5LWJ1dHRvbntwYWRkaW5nOjEwcHggMTJweDtnYXA6MTJweH0uaW1wb3J0LXpvbmV7ZmxleC13cmFwOndyYXB9LmltcG9ydC16b25lIC5maWxlLWJ1dHRvbnttYXJnaW4tbGVmdDowfS5yZWNlaXB0LWFjdGlvbnN7ZmxleC13cmFwOndyYXB9LmVkaXRpb257ZGlzcGxheTpub25lfS53b3JrLWdyaWR7Z2FwOjE2cHh9LmV4YW1wbGUtY2FyZHtwYWRkaW5nOjEzcHggMTJweDtnYXA6OHB4fS5leGFtcGxlLW51bWJlcntkaXNwbGF5Om5vbmV9fQpAbWVkaWEobWF4LXdpZHRoOjc2MHB4KXsuc2l0ZS1oZWFkZXJ7aGVpZ2h0OjcxcHg7cGFkZGluZzowIDIycHh9LmJyYW5ke2ZvbnQtc2l6ZToxMnB4O2xldHRlci1zcGFjaW5nOjFweDtnYXA6OXB4fS5icmFuZCBzdmd7d2lkdGg6MjdweDtoZWlnaHQ6MjdweH1tYWlue3BhZGRpbmc6MCAyMHB4fS5pbnRyb3twYWRkaW5nOjM3cHggMCAzMHB4fWgxe2ZvbnQtc2l6ZTozOHB4O2xldHRlci1zcGFjaW5nOi0xLjhweH0uZXllYnJvd3tmb250LXNpemU6OHB4O2xldHRlci1zcGFjaW5nOjEuMTVweH0uaW50cm8tY29weXtmb250LXNpemU6MTJweDttYXgtd2lkdGg6NDUwcHg7bGluZS1oZWlnaHQ6MS44fS5uYXYtbm90ZXtkaXNwbGF5Om5vbmV9LndvcmstZ3JpZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfS5leGFtcGxlc3tnYXA6OHB4fS5leGFtcGxlLWNhcmR7cGFkZGluZzoxM3B4IDExcHg7bWluLWhlaWdodDoxMDdweH0uZXhhbXBsZS10aXRsZXtmb250LXNpemU6MTFweH0uZXhhbXBsZS1kZXNjcmlwdGlvbntmb250LXNpemU6OXB4fS5leGFtcGxlLWFycm93e2Rpc3BsYXk6bm9uZX0uZW1wdHktc3RhdGV7bWluLWhlaWdodDozMzBweH0uanNvbi1lZGl0b3J7bWluLWhlaWdodDozMzBweDtmb250LXNpemU6MTFweH0ucmVjZWlwdC1lZGl0b3J7bWluLWhlaWdodDoyNTBweH0uc3VtbWFyeS1jYXJkc3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSl9LnN1bW1hcnktY2FyZC12YWx1ZXtmb250LXNpemU6MjNweH0uc3VtbWFyeS1jYXJkLXZhbHVlLmxvbmd7Zm9udC1zaXplOjE0cHh9LnJlc3VsdC1jb250ZW50LC52ZXJpZmljYXRpb24tY29udGVudHtwYWRkaW5nOjAgMjJweCAyMHB4fS5ydW4tY29udHJvbHMgcHtmb250LXNpemU6MTBweDttYXgtd2lkdGg6bm9uZX0ucnVuLWNvbnRyb2xze3BhZGRpbmc6MTdweCAyMnB4fS5wcmltYXJ5LWJ1dHRvbntwYWRkaW5nOjEwcHggMTVweDtnYXA6MThweH0uZXhhbXBsZS1oZWFkaW5ne2dhcDoxMHB4fS5leGFtcGxlLWhlYWRpbmcgc3Bhbntmb250LXNpemU6MTBweH0uZXhhbXBsZS1oZWFkaW5nIGgye2ZvbnQtc2l6ZToxMnB4fS5wYW5lbC1oZWFkaW5ne3BhZGRpbmc6MjFweCAyMnB4fS5yZWNlaXB0LWFjdGlvbnN7ZmxleC13cmFwOm5vd3JhcH0udmVyaWZpY2F0aW9uLWVtcHR5e21pbi1oZWlnaHQ6MzI1cHh9LmltcG9ydC16b25le2ZsZXgtd3JhcDpub3dyYXB9LmltcG9ydC16b25lIC5maWxlLWJ1dHRvbnttYXJnaW4tbGVmdDphdXRvfWZvb3RlcntmbGV4LXdyYXA6d3JhcDtyb3ctZ2FwOjhweDtwYWRkaW5nLXRvcDoyNXB4fWZvb3RlciBwe29yZGVyOjM7ZmxleDoxIDEgMTAwJX0ubW9kZS10YWJze2dhcDoyNXB4fS5tb2RlLXRhYntmb250LXNpemU6MTJweH0uY29ubmVjdGlvbntmb250LXNpemU6OXB4O3BhZGRpbmc6NXB4IDhweH19CkBtZWRpYShtYXgtd2lkdGg6NDIwcHgpe21haW57cGFkZGluZzowIDE0cHh9LnNpdGUtaGVhZGVye3BhZGRpbmc6MCAxNXB4fS5icmFuZHtmb250LXNpemU6MTBweH0uYnJhbmQgc3Zne3dpZHRoOjI0cHg7aGVpZ2h0OjI0cHh9LmNvbm5lY3Rpb257Zm9udC1zaXplOjhweDtnYXA6NXB4fS5oZWFkZXItcmlnaHR7Z2FwOjB9aDF7Zm9udC1zaXplOjMzcHh9LmludHJvLWNvcHl7Zm9udC1zaXplOjExcHh9LmV4YW1wbGUtaGVhZGluZ3tkaXNwbGF5OmJsb2NrfS5leGFtcGxlLWhlYWRpbmcgc3BhbntkaXNwbGF5OmJsb2NrO21hcmdpbi10b3A6NHB4fS5leGFtcGxlLWNhcmR7bWluLWhlaWdodDoxMTJweDtwYWRkaW5nOjExcHggOXB4fS5tb2RlLXRhYnN7Z2FwOjIwcHh9Lm1vZGUtdGFie2ZvbnQtc2l6ZToxMXB4fS5tb2RlLXRhYiBzcGFue2ZvbnQtc2l6ZTo4cHg7bWFyZ2luLWxlZnQ6NHB4fS5zdW1tYXJ5LWNhcmRze2dhcDo2cHh9LnN1bW1hcnktY2FyZHtwYWRkaW5nOjExcHggOXB4fS5zdW1tYXJ5LWNhcmQtdmFsdWV7Zm9udC1zaXplOjIwcHh9LnN1bW1hcnktY2FyZC1sYWJlbHtmb250LXNpemU6N3B4fS5zaG9ydGN1dHtmb250LXNpemU6OHB4fS5ydW4tY29udHJvbHMgcHtmb250LXNpemU6OXB4fS5wcmltYXJ5LWJ1dHRvbntmb250LXNpemU6MTBweDtwYWRkaW5nOjEwcHggMTJweH0uaW1wb3J0LXpvbmV7Z2FwOjlweDttYXJnaW4tbGVmdDoxNnB4O21hcmdpbi1yaWdodDoxNnB4O3BhZGRpbmc6MTVweCAxMHB4fS5pbXBvcnQtem9uZSBwe2ZvbnQtc2l6ZTo4cHh9LmltcG9ydC16b25lIHN0cm9uZ3tmb250LXNpemU6MTBweH0uZmlsZS1idXR0b257cGFkZGluZzo4cHg7Zm9udC1zaXplOjlweH0ucmVjZWlwdC1hY3Rpb25zIC5zZWNvbmRhcnktYnV0dG9ue2ZvbnQtc2l6ZTo5cHh9LnJlY2VpcHQtYWN0aW9ucyAudGV4dC1idXR0b257Zm9udC1zaXplOjEwcHh9LnBhbmVsLWhlYWRpbmcsLnJlc3VsdC1jb250ZW50LC52ZXJpZmljYXRpb24tY29udGVudHtwYWRkaW5nLWxlZnQ6MThweDtwYWRkaW5nLXJpZ2h0OjE4cHh9Lmpzb24tZWRpdG9ye3BhZGRpbmc6MTdweCAxOHB4fS5jaGVjay1oZWFkZXJ7ZmxleC13cmFwOndyYXA7Z2FwOjRweH19CkBtZWRpYShwcmVmZXJzLXJlZHVjZWQtbW90aW9uOnJlZHVjZSl7KntzY3JvbGwtYmVoYXZpb3I6YXV0byFpbXBvcnRhbnQ7dHJhbnNpdGlvbjpub25lIWltcG9ydGFudH19CgouZGVjaXNpb24tbm90aWNle2JhY2tncm91bmQ6dmFyKC0tYW1iZXItc29mdCk7Ym9yZGVyOjFweCBzb2xpZCAjZGRjNzk1O2JvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1hbWJlcik7Ym9yZGVyLXJhZGl1czo1cHg7cGFkZGluZzoxNHB4IDE2cHg7bWFyZ2luOjAgMCAxNnB4O2NvbG9yOnZhcigtLWFtYmVyKX0uZGVjaXNpb24tbm90aWNlIHN0cm9uZ3tkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxNHB4O2xpbmUtaGVpZ2h0OjEuNH0uZGVjaXNpb24tbm90aWNlIHB7Zm9udC1zaXplOjEycHg7bGluZS1oZWlnaHQ6MS43O21hcmdpbi10b3A6NnB4fS5kZWZlcnJlZC1iZWxpZWZzIC5iZWxpZWYtZmlsbHtiYWNrZ3JvdW5kOiNhYWEwYjV9LmRlZmVycmVkLWJlbGllZnMgLmJlbGllZi1saW5lIHN0cm9uZ3tjb2xvcjojNzg2ZDgzfQo=" };
    assetHashes = { "examples/artifact.txt": "7738ea8df0c983596d149d344660db828b1b2474e0abad2b2ef46841b5bf5172", "examples/discovery-deferred.json": "5b87c063d28b613c19e9429f8935dca5e7a7b7592c7b13a1e1259762372c26eb", "examples/release-authorization.json": "cf74bc4fe9bb2638095458888dabb0db58926be8fd5ecdc5bbdd42f7c291b03f", "examples/release-deferred.json": "879632a900e4824d198e167a17d387516bf0aac836c7bc29eed279b0e5cc16df", "examples/release-denied.json": "58950ff4fb7792c3a7b3dc38fd617577ecada229ceaf2bec5c4abb1584a6f00c", "examples/sensor-investigation.json": "6fb436d9e78aa5f73d24a5e26567f0dab3cda6d3aa848c7526114a34604a95a2", "tests/fixtures/regression/adequacy/with-zero-prior.json": "180ad6e6191ae0052d6043c3c75d6fa8ee42f3bacd69c954bbc9464659a0066c", "tests/fixtures/regression/adequacy/without-zero-prior.json": "7d4e434cd10c8474ec589f5ba4875cbe00d0bfd00763ccd35be4455c36205d0e", "tests/fixtures/regression/numbers/bigint-eq.json": "fac169ecdc38c58affbf7df81e1b53baf9c5db4d3aa36f0ff57f74daf42a4e11", "tests/fixtures/regression/numbers/underflow-lte.json": "57415048f1a748bb4d64fcf2d2177a458b9f4cfd08a6b57b7d5bbe646375603b", "tests/fixtures/regression/receipts/c-A1.json": "a0275a62e0a8e8d7fae61cada7ba04e847e24529c661dc39aabc550316865187", "tests/fixtures/regression/receipts/c-clean.digest": "f109df15a704a2418bab62b202875f9c9b9394ca8a867beec71c0071dd087d7f", "tests/fixtures/regression/receipts/c-clean.json": "c54ceec10491875511c24f2609fc0bc4be8a5f60d597b27688045ca8e5512f16", "tests/fixtures/regression/receipts/denied.TAMPERED.receipt.json": "f4018e61991c2339f3c9c83f952bfd3ababa66fd9ead4ad50d355db1e1741ce2", "web/app.js": "1359c5d69f9d90b870505fbea0707f3b87dc4af422990727285ef3380443cf00", "web/index.html": "29dcc75346c31a39d92827853e866093362a628aae9a4aa09eaaa56bc677a502", "web/styles.css": "21521210a85bea8eb013608e62f5345c326075f7aed16df18d4a7d0cf31239b0" };
    expectedExports = ["ADEQUACY_IMPLEMENTATION", "ADEQUACY_NORMALIZATION_POLICY", "ADEQUACY_SCHEMA_VERSION", "ADEQUACY_SUPPORT_POLICY", "CANONICAL_MAX_BYTES", "CANONICAL_MAX_NODES", "DISCOVERY_MAX_IDENTIFIER_LENGTH", "DiscoverySession", "EVIDENCE_LIMITS", "FamilyAdequacyMonitor", "MAX_DISCOVERY_OBSERVATIONS", "MAX_JSON_BYTES", "MAX_JSON_DEPTH", "RECEIPT_SCHEMA_VERSION", "ReplayRuntimeError", "StrictJsonError", "VALIDATED_NODE_VERSION", "assertReceiptTextLimit", "assertReplayRuntime", "canonicalJSON", "canonicalize", "captureEnvironment", "compareReceiptNumerics", "createReceipt", "currentAdequacyRuntime", "currentReplayRuntime", "entropy", "evaluateInput", "evaluatePolicy", "exactKeys", "executionRuntime", "hashJSON", "inspectEvidence", "jsonClone", "parseStrictJson", "replayFamilyAdequacy", "replaySession", "requiredId", "runRequest", "sha256", "sha256Bytes", "thresholdSensitivity", "timestamp", "validateDiscoveryIdentifier", "validateFamilyAdequacyOptions", "validateInput", "validatePolicy", "verifyReceipt", "verifyReceiptText", "verifyRun", "verifyRunText"];
    packageSpecifiers = ["@cosmic/commons", "@cosmic/commons/inference", "@cosmic/commons/policy"];
  }
});

// standalone/package-root.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var bundlePath, packageRoot, packagePath;
var init_package_root = __esm({
  "standalone/package-root.mjs"() {
    bundlePath = fileURLToPath(import.meta.url);
    packageRoot = join(dirname(bundlePath), ".cosmic-embedded-assets");
    packagePath = (...parts) => join(packageRoot, ...parts);
  }
});

// standalone/fs.mjs
var fs_exports = {};
__export(fs_exports, {
  readFileSync: () => readFileSync2,
  readdirSync: () => readdirSync2
});
import * as actualFs from "node:fs";
import { relative, isAbsolute, sep } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import * as node_fs_star from "node:fs";
function embeddedKey(path) {
  if (path instanceof URL) path = fileURLToPath2(path);
  if (typeof path !== "string") return null;
  const key = relative(packageRoot, path);
  if (key === ".." || key.startsWith(`..${sep}`) || isAbsolute(key)) return null;
  return key.split(sep).join("/");
}
function missing(path) {
  const error = new Error(`ENOENT: no embedded resource, ${String(path)}`);
  error.code = "ENOENT";
  throw error;
}
function assertReservedNamespaceEmpty() {
  try {
    actualFs.lstatSync(packageRoot);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`EMBEDDED_ASSET_NAMESPACE_COLLISION: reserved path exists: ${packageRoot}`);
}
function readFileSync2(path, options2) {
  const key = embeddedKey(path);
  if (key === null) return actualFs.readFileSync(path, options2);
  assertReservedNamespaceEmpty();
  if (!Object.hasOwn(assets, key)) return missing(path);
  const bytes = Buffer.from(assets[key], "base64");
  const encoding = typeof options2 === "string" ? options2 : options2?.encoding;
  return encoding ? bytes.toString(encoding) : bytes;
}
function readdirSync2(path, options2) {
  const key = embeddedKey(path);
  if (key === null) return actualFs.readdirSync(path, options2);
  assertReservedNamespaceEmpty();
  if (options2) throw new Error("Embedded directory listing accepts the shared examples API only");
  const prefix = key ? key + "/" : "";
  const names = [...new Set(Object.keys(assets).filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length).split("/")[0]))].sort();
  if (!names.length) return missing(path);
  return names;
}
var init_fs = __esm({
  "standalone/fs.mjs"() {
    init_standalone_inputs();
    init_package_root();
    __reExport(fs_exports, node_fs_star);
  }
});

// standalone/child-process.mjs
var child_process_exports = {};
__export(child_process_exports, {
  spawnSync: () => spawnSync
});
import { spawnSync as actualSpawnSync } from "node:child_process";
import { dirname as dirname2 } from "node:path";
import { pathToFileURL } from "node:url";
import * as node_child_process_star from "node:child_process";
function spawnSync(command, args, options2) {
  if (command === process.execPath && Array.isArray(args) && options2?.cwd === packageRoot && args.includes("-e")) {
    args = [...args];
    const expressionIndex = args.indexOf("-e") + 1;
    if (typeof args[expressionIndex] !== "string") throw new Error("Missing embedded SDK test expression");
    for (const specifier of packageSpecifiers) for (const quote of ['"', "'"]) {
      args[expressionIndex] = args[expressionIndex].split(quote + specifier + quote).join(JSON.stringify(pathToFileURL(bundlePath).href));
    }
    options2 = { ...options2, cwd: dirname2(bundlePath) };
  }
  if (command === process.execPath && Array.isArray(args) && (args[0] === packagePath("bin", "cosmic.mjs") || args[0] === "bin/cosmic.mjs" && options2?.cwd === packageRoot)) {
    args = [bundlePath, ...args.slice(1)];
    if (options2?.cwd === packageRoot) options2 = { ...options2, cwd: dirname2(bundlePath) };
  }
  return actualSpawnSync(command, args, options2);
}
var init_child_process = __esm({
  "standalone/child-process.mjs"() {
    init_package_root();
    init_standalone_inputs();
    __reExport(child_process_exports, node_child_process_star);
  }
});

// dist/src/canonical.js
import { createHash } from "node:crypto";
function canonicalize(value) {
  const active = /* @__PURE__ */ new Set();
  let nodes = 0;
  let bytes = 0;
  const take = (text) => {
    bytes += Buffer.byteLength(text, "utf8");
    if (bytes > CANONICAL_MAX_BYTES)
      throw new RangeError(`JSON_BYTE_LIMIT: canonical JSON exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);
    return text;
  };
  const quote = (text) => {
    if (text.length > CANONICAL_MAX_BYTES)
      throw new RangeError("JSON_BYTE_LIMIT: string exceeds the JSON byte budget");
    return take(JSON.stringify(text));
  };
  const visit = (item, path, depth) => {
    if (++nodes > CANONICAL_MAX_NODES || depth > 100)
      throw new TypeError(`JSON_LIMIT at ${path}`);
    if (item === null)
      return take("null");
    if (typeof item === "string") {
      if (!item.isWellFormed())
        throw new TypeError(`INVALID_UNICODE at ${path}`);
      return quote(item);
    }
    if (typeof item === "boolean")
      return take(item ? "true" : "false");
    if (typeof item === "number") {
      if (!Number.isFinite(item) || Object.is(item, -0))
        throw new TypeError(`INVALID_NUMBER at ${path}`);
      if (Number.isInteger(item) && !Number.isSafeInteger(item))
        throw new TypeError(`UNSAFE_INTEGER at ${path}`);
      return take(JSON.stringify(item));
    }
    if (typeof item !== "object")
      throw new TypeError(`NOT_JSON at ${path}`);
    if (active.has(item))
      throw new TypeError(`JSON_CYCLE at ${path}`);
    const proto = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) {
      throw new TypeError(`NOT_PLAIN_OBJECT at ${path}`);
    }
    if (Array.isArray(item) && proto !== Array.prototype)
      throw new TypeError(`NOT_PLAIN_ARRAY at ${path}`);
    active.add(item);
    try {
      const keys2 = Reflect.ownKeys(item);
      if (keys2.some((key) => typeof key !== "string"))
        throw new TypeError(`SYMBOL_KEY at ${path}`);
      if (Array.isArray(item)) {
        if (keys2.length !== item.length + 1)
          throw new TypeError(`SPARSE_OR_EXTENDED_ARRAY at ${path}`);
        take("[]");
        const parts2 = [];
        for (let index = 0; index < item.length; index++) {
          if (index)
            take(",");
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
            throw new TypeError(`NON_DATA_PROPERTY at ${path}[${index}]`);
          }
          parts2.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
        }
        return `[${parts2.join(",")}]`;
      }
      take("{}");
      const parts = [];
      for (const key of keys2.sort()) {
        if (parts.length)
          take(",");
        if (!key.isWellFormed())
          throw new TypeError(`INVALID_UNICODE_KEY at ${path}`);
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!("value" in descriptor) || !descriptor.enumerable)
          throw new TypeError(`NON_DATA_PROPERTY at ${path}.${key}`);
        const encodedKey = quote(key);
        take(":");
        parts.push(`${encodedKey}:${visit(descriptor.value, `${path}.${key}`, depth + 1)}`);
      }
      return `{${parts.join(",")}}`;
    } finally {
      active.delete(item);
    }
  };
  return visit(value, "$", 0);
}
function assertReceiptTextLimit(value) {
  const bytes = Buffer.byteLength(JSON.stringify(value, null, 2) + "\n", "utf8");
  if (bytes > CANONICAL_MAX_BYTES)
    throw new RangeError(`RECEIPT_BYTE_LIMIT: formatted receipt exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes`);
}
function sha256(value) {
  return sha256Bytes(canonicalize(value));
}
function sha256Bytes(text) {
  if (typeof text !== "string" || !text.isWellFormed())
    throw new TypeError("Expected well-formed UTF-8 text");
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function jsonClone(value) {
  return JSON.parse(canonicalize(value));
}
function timestamp(value, label = "timestamp") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new TypeError(`${label} must be an ISO UTC instant with seconds and optional three-digit milliseconds`);
  }
  const time = Date.parse(value);
  const expanded = value.length === 20 ? value.replace("Z", ".000Z") : value;
  if (!Number.isFinite(time) || new Date(time).toISOString() !== expanded)
    throw new TypeError(`${label} is not a valid calendar instant`);
  return time;
}
var CANONICAL_MAX_NODES, CANONICAL_MAX_BYTES;
var init_canonical = __esm({
  "dist/src/canonical.js"() {
    CANONICAL_MAX_NODES = 1e5;
    CANONICAL_MAX_BYTES = 2e6;
  }
});

// dist/src/strict-json.js
function decimalIdentity(token) {
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  const fraction = parts[3] ?? "";
  const digits = (parts[2] + fraction).replace(/^0+/, "");
  if (!digits)
    return "0";
  let end = digits.length;
  while (digits[end - 1] === "0")
    end--;
  const significant = digits.slice(0, end);
  const exponent = Number(parts[4] ?? "0");
  if (!Number.isSafeInteger(exponent))
    return null;
  const scale = exponent - fraction.length + digits.length - significant.length;
  if (!Number.isSafeInteger(scale))
    return null;
  return `${parts[1]}${significant}e${scale}`;
}
function requireRoundtrippableNumber(token, offset) {
  const number = Number(token);
  const canonical = Number.isFinite(number) && !Object.is(number, -0) ? JSON.stringify(number) : null;
  if (canonical === null || decimalIdentity(token) !== decimalIdentity(canonical)) {
    throw new StrictJsonError("NUMBER_NOT_ROUNDTRIPPABLE", offset, "Number must retain its exact decimal value through binary64 JSON serialization; non-finite values and negative zero are unsupported");
  }
  if (Number.isInteger(number) && !Number.isSafeInteger(number)) {
    throw new StrictJsonError("UNSAFE_INTEGER", offset, "Integer values must be within the inclusive safe range -9007199254740991 to 9007199254740991");
  }
}
function parseStrictJson(raw2) {
  if (typeof raw2 !== "string")
    throw new StrictJsonError("INVALID_JSON", 0, "Expected raw JSON text");
  if (raw2.length > MAX_JSON_BYTES || Buffer.byteLength(raw2, "utf8") > MAX_JSON_BYTES) {
    throw new StrictJsonError("JSON_TOO_LARGE", 0, `Maximum input size is ${MAX_JSON_BYTES} UTF-8 bytes`);
  }
  let offset = 0;
  const fail = (detail) => {
    throw new StrictJsonError("INVALID_JSON", offset, detail);
  };
  const whitespace = () => {
    while (raw2[offset] === " " || raw2[offset] === "	" || raw2[offset] === "\n" || raw2[offset] === "\r")
      offset++;
  };
  const string = () => {
    if (raw2[offset] !== '"')
      return fail("Expected a quoted string");
    const start = offset++;
    while (offset < raw2.length) {
      const character = raw2[offset++];
      if (character === "\\") {
        offset++;
        continue;
      }
      if (character === '"') {
        try {
          return JSON.parse(raw2.slice(start, offset));
        } catch {
          return fail("Invalid JSON string");
        }
      }
    }
    return fail("Unterminated JSON string");
  };
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const value = (depth) => {
    whitespace();
    const first = raw2[offset];
    if (first === "{" || first === "[") {
      if (depth >= MAX_JSON_DEPTH)
        throw new StrictJsonError("JSON_TOO_DEEP", offset, `Maximum nesting depth is ${MAX_JSON_DEPTH}`);
      offset++;
      whitespace();
      const object2 = first === "{";
      const end = object2 ? "}" : "]";
      const keys2 = /* @__PURE__ */ new Set();
      if (raw2[offset] === end) {
        offset++;
        return;
      }
      for (; ; ) {
        if (object2) {
          whitespace();
          const keyOffset = offset;
          const key = string();
          if (keys2.has(key))
            throw new StrictJsonError("DUPLICATE_JSON_KEY", keyOffset, "Duplicate decoded object key");
          keys2.add(key);
          whitespace();
          if (raw2[offset++] !== ":")
            fail("Expected colon after object key");
        }
        value(depth + 1);
        whitespace();
        if (raw2[offset] === end) {
          offset++;
          return;
        }
        if (raw2[offset++] !== ",")
          fail("Expected comma or closing delimiter");
      }
    }
    if (first === '"') {
      string();
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (raw2.startsWith(literal, offset)) {
        offset += literal.length;
        return;
      }
    }
    number.lastIndex = offset;
    const match = number.exec(raw2);
    if (!match)
      fail("Expected a JSON value");
    const next = raw2[number.lastIndex];
    if (next !== void 0 && next !== " " && next !== "	" && next !== "\n" && next !== "\r" && next !== "," && next !== "]" && next !== "}") {
      fail("Invalid character after JSON number");
    }
    requireRoundtrippableNumber(match[0], offset);
    offset = number.lastIndex;
  };
  value(0);
  whitespace();
  if (offset !== raw2.length)
    fail("Trailing content");
  try {
    return JSON.parse(raw2);
  } catch {
    return fail("Invalid JSON");
  }
}
var MAX_JSON_BYTES, MAX_JSON_DEPTH, StrictJsonError;
var init_strict_json = __esm({
  "dist/src/strict-json.js"() {
    init_canonical();
    MAX_JSON_BYTES = CANONICAL_MAX_BYTES;
    MAX_JSON_DEPTH = 128;
    StrictJsonError = class extends SyntaxError {
      code;
      offset;
      constructor(code2, offset, detail) {
        super(`${code2}: ${detail} at character ${offset}`);
        this.name = "StrictJsonError";
        this.code = code2;
        this.offset = offset;
      }
    };
  }
});

// standalone/runtime.mjs
import { readFileSync as readFileSync3 } from "node:fs";
import { createHash as createHash2 } from "node:crypto";
import { endianness } from "node:os";
function bundleDigest() {
  return createHash2("sha256").update(readFileSync3(new URL(import.meta.url))).digest("hex");
}
function executionRuntime() {
  return {
    implementation: `${implementation}/standalone`,
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    architecture: process.arch,
    endianness: endianness(),
    sourceDigest: sha256(sourceFiles),
    codeDigest: bundleDigest()
  };
}
function policyImplementation() {
  return `${implementation}/policy-v1/standalone/${bundleDigest()}`;
}
var init_runtime = __esm({
  "standalone/runtime.mjs"() {
    init_standalone_inputs();
    init_canonical();
  }
});

// dist/src/inference/types.js
var init_types = __esm({
  "dist/src/inference/types.js"() {
  }
});

// dist/src/inference/runtime.js
import { endianness as endianness2 } from "node:os";
function currentReplayRuntime() {
  return {
    implementation: "@cosmic/commons-discovery/0.2.1",
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    architecture: process.arch,
    endianness: endianness2(),
    numericalModel: "binary64-native-math"
  };
}
function assertReplayRuntime(recorded) {
  const actual = currentReplayRuntime();
  const keys2 = Object.keys(actual);
  if (!recorded || keys2.some((key) => typeof recorded[key] !== "string" || !recorded[key])) {
    throw new ReplayRuntimeError("MISSING_REPLAY_RUNTIME", "Receipt has no complete runtime contract. Legacy receipts require explicit numerical comparison; they cannot receive v2 exact verification.");
  }
  const differences = keys2.filter((key) => recorded[key] !== actual[key]);
  if (differences.length) {
    throw new ReplayRuntimeError("REPLAY_RUNTIME_MISMATCH", "Exact replay runtime mismatch: " + differences.map((key) => `${key}: recorded=${recorded[key]}, current=${actual[key]}`).join("; ") + ". Use the recorded runtime and source artifact, or request numerical comparison without byte verification.");
  }
}
var VALIDATED_NODE_VERSION, RECEIPT_SCHEMA_VERSION, ReplayRuntimeError;
var init_runtime2 = __esm({
  "dist/src/inference/runtime.js"() {
    VALIDATED_NODE_VERSION = "24.19.0";
    RECEIPT_SCHEMA_VERSION = 2;
    ReplayRuntimeError = class extends Error {
      code;
      constructor(code2, message) {
        super(message);
        this.name = "ReplayRuntimeError";
        this.code = code2;
      }
    };
  }
});

// dist/src/inference/session.js
import { createHash as createHash3 } from "node:crypto";
function canonicalJSON(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Receipt numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i))
        throw new Error("Receipts require dense arrays");
    }
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  if (typeof value === "object" && value !== null) {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error("Receipts require plain objects");
    }
    const record = value;
    return "{" + Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => JSON.stringify(key) + ":" + canonicalJSON(record[key])).join(",") + "}";
  }
  throw new Error("Unsupported receipt value");
}
function hashJSON(value) {
  return createHash3("sha256").update(canonicalJSON(value)).digest("hex");
}
function validateDiscoveryIdentifier(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} must be a nonempty string`);
  if (value.length > DISCOVERY_MAX_IDENTIFIER_LENGTH)
    throw new RangeError(`DISCOVERY_IDENTIFIER_LIMIT: ${name} exceeds ${DISCOVERY_MAX_IDENTIFIER_LENGTH} UTF-16 code units`);
}
function probability(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a probability in [0,1]`);
  }
}
function assertKeys(record, keys2, name) {
  if (!record || typeof record !== "object" || Array.isArray(record) || Object.keys(record).length !== keys2.length || keys2.some((key) => !Object.hasOwn(record, key))) {
    throw new Error(`${name} must contain exactly the declared keys`);
  }
}
function entropy(probabilities) {
  const result = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
  return result === 0 ? 0 : result;
}
function decimalParts(value) {
  const [mantissa, exponent = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent) };
}
function decimalNumber(units, scale) {
  return Number(`${units.toString()}e${-scale}`);
}
function replaySession(config, receipts, recordedRuntime) {
  if (!Array.isArray(receipts))
    throw new Error("Receipts must be an array");
  if (recordedRuntime !== void 0 || receipts.length === 0)
    assertReplayRuntime(recordedRuntime);
  for (const receipt of receipts) {
    if (receipt?.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
      throw new ReplayRuntimeError("MISSING_REPLAY_RUNTIME", "Exact replay requires v2 receipts with a recorded runtime. Legacy receipts may only be compared numerically.");
    }
    assertReplayRuntime(receipt.runtime);
  }
  const session = new DiscoverySession(config);
  for (const receipt of receipts) {
    const actual = session.observe({ id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome });
    if (canonicalJSON(actual) !== canonicalJSON(receipt))
      throw new Error(`Receipt verification failed at sequence ${receipt.sequence}`);
  }
  return session;
}
var DISCOVERY_MAX_IDENTIFIER_LENGTH, identifier, DiscoverySession;
var init_session = __esm({
  "dist/src/inference/session.js"() {
    init_runtime2();
    DISCOVERY_MAX_IDENTIFIER_LENGTH = 256;
    identifier = validateDiscoveryIdentifier;
    DiscoverySession = class {
      definition;
      definitionHash;
      runtime = currentReplayRuntime();
      chainAnchorHash;
      experiments;
      logWeights;
      ids;
      costScale;
      budgetUnits;
      costUnits;
      spentUnits = 0n;
      mismatch = false;
      receipts = [];
      evidenceIds = /* @__PURE__ */ new Set();
      constructor(config) {
        identifier(config.modelId, "modelId");
        if (config.observationAssumption !== "conditionally-independent-given-hypothesis-and-experiment") {
          throw new Error("Declare the conditional independence assumption explicitly");
        }
        if (!Number.isFinite(config.budget) || config.budget < 0)
          throw new Error("budget must be finite and nonnegative");
        if (!Array.isArray(config.hypotheses) || config.hypotheses.length < 2)
          throw new Error("At least two hypotheses are required");
        this.ids = config.hypotheses.map((h) => {
          identifier(h.id, "hypothesis id");
          probability(h.prior, "prior");
          return h.id;
        });
        if (new Set(this.ids).size !== this.ids.length)
          throw new Error("Hypothesis ids must be unique");
        const total = config.hypotheses.reduce((sum, h) => sum + h.prior, 0);
        if (Math.abs(total - 1) > 1e-12)
          throw new Error("Prior probabilities must sum to one");
        if (!Array.isArray(config.experiments) || config.experiments.length === 0)
          throw new Error("At least one experiment is required");
        const experimentIds = /* @__PURE__ */ new Set();
        for (const experiment of config.experiments) {
          identifier(experiment.id, "experiment id");
          if (experimentIds.has(experiment.id))
            throw new Error("Experiment ids must be unique");
          experimentIds.add(experiment.id);
          if (!Number.isFinite(experiment.cost) || experiment.cost <= 0)
            throw new Error("Experiment cost must be finite and positive");
          if (!Number.isFinite(Math.log(this.ids.length) / experiment.cost))
            throw new Error("Experiment cost is too small to represent finite information per cost");
          if (!Array.isArray(experiment.outcomes) || experiment.outcomes.length < 2)
            throw new Error("Declare at least two outcomes");
          experiment.outcomes.forEach((outcome) => identifier(outcome, "outcome"));
          if (new Set(experiment.outcomes).size !== experiment.outcomes.length)
            throw new Error("Outcomes must be unique");
          assertKeys(experiment.likelihoods, this.ids, "Likelihood table");
          for (const id of this.ids) {
            const row = experiment.likelihoods[id];
            assertKeys(row, experiment.outcomes, "Likelihood row");
            const sum = experiment.outcomes.reduce((s, outcome) => {
              probability(row[outcome], "likelihood");
              return s + row[outcome];
            }, 0);
            if (Math.abs(sum - 1) > 1e-12)
              throw new Error("Each likelihood row must sum to one");
          }
        }
        if (config.stopProbability !== void 0) {
          probability(config.stopProbability, "stopProbability");
          if (config.stopProbability <= 0.5)
            throw new Error("stopProbability must be greater than 0.5");
        }
        if (config.minInformationGainNats !== void 0 && (!Number.isFinite(config.minInformationGainNats) || config.minInformationGainNats < 0)) {
          throw new Error("minInformationGainNats must be finite and nonnegative");
        }
        this.definition = structuredClone(config);
        this.definitionHash = hashJSON(this.definition);
        this.chainAnchorHash = hashJSON({ schemaVersion: RECEIPT_SCHEMA_VERSION, definitionHash: this.definitionHash, runtime: this.runtime });
        this.experiments = new Map(this.definition.experiments.map((experiment) => [experiment.id, experiment]));
        const budgetParts = decimalParts(config.budget);
        const costs = this.definition.experiments.map((experiment) => ({ id: experiment.id, ...decimalParts(experiment.cost) }));
        this.costScale = Math.max(budgetParts.scale, ...costs.map((cost) => cost.scale));
        this.budgetUnits = budgetParts.coefficient * 10n ** BigInt(this.costScale - budgetParts.scale);
        this.costUnits = new Map(costs.map((cost) => [cost.id, cost.coefficient * 10n ** BigInt(this.costScale - cost.scale)]));
        this.logWeights = this.definition.hypotheses.map((h) => h.prior === 0 ? -Infinity : Math.log(h.prior / total));
      }
      probabilities() {
        const peak = Math.max(...this.logWeights);
        const weights = this.logWeights.map((weight) => Math.exp(weight - peak));
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        return weights.map((weight) => weight / total);
      }
      posterior() {
        const probabilities = this.probabilities();
        return Object.fromEntries(this.ids.map((id, index) => [id, probabilities[index]]));
      }
      remainingBudget() {
        return decimalNumber(this.budgetUnits - this.spentUnits, this.costScale);
      }
      canAfford(experimentId) {
        const cost = this.costUnits.get(experimentId);
        if (cost === void 0)
          throw new Error("Unknown experiment");
        return cost <= this.budgetUnits - this.spentUnits;
      }
      experimentUtilities() {
        const weights = this.probabilities();
        return Array.from(this.experiments.values(), (experiment) => {
          const predictiveOutcomes = Object.fromEntries(experiment.outcomes.map((outcome) => [
            outcome,
            this.ids.reduce((sum, id, index) => sum + weights[index] * experiment.likelihoods[id][outcome], 0)
          ]));
          let gain = 0;
          for (let i = 0; i < this.ids.length; i++) {
            if (weights[i] === 0)
              continue;
            for (const outcome of experiment.outcomes) {
              const likelihood = experiment.likelihoods[this.ids[i]][outcome];
              if (likelihood > 0 && predictiveOutcomes[outcome] > 0) {
                gain += weights[i] * likelihood * (Math.log(likelihood) - Math.log(predictiveOutcomes[outcome]));
              }
            }
          }
          gain = Math.max(0, gain);
          return {
            experimentId: experiment.id,
            cost: experiment.cost,
            expectedInformationGainNats: gain,
            informationGainPerCost: gain / experiment.cost,
            predictiveOutcomes
          };
        });
      }
      recommend() {
        if (this.mismatch)
          return { status: "stop", reason: "model-mismatch" };
        if (this.definition.stopProbability !== void 0 && Math.max(...this.probabilities()) >= this.definition.stopProbability) {
          return { status: "stop", reason: "posterior-threshold" };
        }
        const affordable = this.experimentUtilities().filter((experiment) => this.canAfford(experiment.experimentId));
        if (affordable.length === 0)
          return { status: "stop", reason: "budget-exhausted" };
        const eligible = affordable.filter((experiment) => experiment.expectedInformationGainNats > (this.definition.minInformationGainNats ?? 1e-12));
        if (eligible.length === 0)
          return { status: "stop", reason: "no-informative-experiment" };
        eligible.sort((a, b) => b.informationGainPerCost - a.informationGainPerCost || b.expectedInformationGainNats - a.expectedInformationGainNats || (a.experimentId < b.experimentId ? -1 : a.experimentId > b.experimentId ? 1 : 0));
        return { status: "experiment", ...eligible[0] };
      }
      observe(observation) {
        identifier(observation.id, "observation id");
        if (this.mismatch)
          throw new Error("Session stopped after model mismatch");
        if (this.evidenceIds.has(observation.id))
          throw new Error("Duplicate observation id: evidence cannot be counted twice");
        const experiment = this.experiments.get(observation.experimentId);
        if (!experiment)
          throw new Error("Unknown experiment");
        if (!experiment.outcomes.includes(observation.outcome))
          throw new Error("Outcome is outside the declared observation alphabet");
        if (!this.canAfford(experiment.id))
          throw new Error("Experiment exceeds remaining budget");
        const nextWeights = this.logWeights.map((weight, i) => {
          const likelihood = experiment.likelihoods[this.ids[i]][observation.outcome];
          return likelihood > 0 ? weight + Math.log(likelihood) : -Infinity;
        });
        const weights = this.probabilities();
        const predictive = this.ids.reduce((sum, id, i) => sum + weights[i] * experiment.likelihoods[id][observation.outcome], 0);
        this.mismatch = nextWeights.every((weight) => weight === -Infinity);
        let predictiveLogProbability = null;
        if (!this.mismatch) {
          const peak = Math.max(...nextWeights);
          const logTotal = peak + Math.log(nextWeights.reduce((sum, value) => sum + Math.exp(value - peak), 0));
          predictiveLogProbability = logTotal;
          this.logWeights = nextWeights.map((value) => value - logTotal);
        }
        this.spentUnits += this.costUnits.get(experiment.id);
        this.evidenceIds.add(observation.id);
        const body = {
          schemaVersion: RECEIPT_SCHEMA_VERSION,
          runtime: { ...this.runtime },
          id: observation.id,
          experimentId: observation.experimentId,
          outcome: observation.outcome,
          sequence: this.receipts.length + 1,
          status: this.mismatch ? "model-mismatch" : "updated",
          cost: experiment.cost,
          priorPredictiveProbability: predictive,
          posterior: this.posterior(),
          priorPredictiveLogProbability: predictiveLogProbability,
          entropyNats: entropy(this.probabilities()),
          previousHash: this.receipts.at(-1)?.hash ?? this.chainAnchorHash
        };
        const receipt = { ...body, hash: hashJSON(body) };
        this.receipts.push(receipt);
        return structuredClone(receipt);
      }
      /** Rank caller-defined actions by posterior expected loss; include abstention as an action if needed. */
      chooseAction(actions) {
        if (this.mismatch)
          throw new Error("Cannot recommend an action after model mismatch");
        if (!actions.length)
          throw new Error("At least one action is required");
        const ids = /* @__PURE__ */ new Set();
        const posterior = this.posterior();
        const alternatives = actions.map((action) => {
          identifier(action.id, "action id");
          if (ids.has(action.id))
            throw new Error("Action ids must be unique");
          ids.add(action.id);
          assertKeys(action.losses, this.ids, "Action losses");
          if (Object.values(action.losses).some((loss) => !Number.isFinite(loss)))
            throw new Error("Action losses must be finite");
          const expectedLoss = this.ids.reduce((sum, id) => sum + posterior[id] * action.losses[id], 0);
          if (!Number.isFinite(expectedLoss))
            throw new Error("Expected loss exceeded the finite numerical range");
          return { actionId: action.id, expectedLoss };
        }).sort((a, b) => a.expectedLoss - b.expectedLoss || (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
        return { ...alternatives[0], alternatives };
      }
      snapshot() {
        return {
          schemaVersion: RECEIPT_SCHEMA_VERSION,
          runtime: { ...this.runtime },
          chainAnchorHash: this.chainAnchorHash,
          modelId: this.definition.modelId,
          definitionHash: this.definitionHash,
          observationAssumption: this.definition.observationAssumption,
          probabilitySemantics: "posterior-within-declared-candidate-family",
          posterior: this.posterior(),
          entropyNats: entropy(this.probabilities()),
          spent: decimalNumber(this.spentUnits, this.costScale),
          remainingBudget: this.remainingBudget(),
          modelMismatch: this.mismatch,
          receipts: structuredClone(this.receipts)
        };
      }
      /** Export the exact declaration needed to reproduce this numerical receipt chain. */
      exportDefinition() {
        return structuredClone(this.definition);
      }
    };
  }
});

// dist/src/inference/compare.js
function compareReceiptNumerics(config, receipts, options2) {
  if (!Array.isArray(receipts))
    throw new Error("Receipts must be an array");
  const { absoluteTolerance, relativeTolerance } = options2;
  for (const value of [absoluteTolerance, relativeTolerance]) {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError("Comparison tolerances must be finite and nonnegative");
  }
  const session = new DiscoverySession(config);
  let comparedNumbers = 0, exactlyEqualNumbers = 0;
  const differences = [];
  const structuralDifferences = [];
  function compareNumber(path, recorded, recomputed) {
    if (!Number.isFinite(recorded) || !Number.isFinite(recomputed)) {
      structuralDifferences.push(`${path}: missing or nonfinite number`);
      return;
    }
    comparedNumbers++;
    if (recorded === recomputed) {
      exactlyEqualNumbers++;
      return;
    }
    const absoluteDifference = Math.abs(recorded - recomputed);
    differences.push({
      path,
      recorded,
      recomputed,
      absoluteDifference,
      withinTolerance: absoluteDifference <= absoluteTolerance + relativeTolerance * Math.max(Math.abs(recorded), Math.abs(recomputed))
    });
  }
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    const actual = session.observe({ id: receipt.id, experimentId: receipt.experimentId, outcome: receipt.outcome });
    const prefix = `receipts[${i}]`;
    for (const key of ["sequence", "status"]) {
      if (receipt[key] !== actual[key])
        structuralDifferences.push(`${prefix}.${key}: differs`);
    }
    for (const key of ["cost", "entropyNats", "priorPredictiveProbability"])
      compareNumber(`${prefix}.${key}`, receipt[key], actual[key]);
    if (receipt.priorPredictiveLogProbability === null || actual.priorPredictiveLogProbability === null) {
      if (receipt.priorPredictiveLogProbability !== actual.priorPredictiveLogProbability)
        structuralDifferences.push(`${prefix}.priorPredictiveLogProbability: support differs`);
    } else
      compareNumber(`${prefix}.priorPredictiveLogProbability`, receipt.priorPredictiveLogProbability, actual.priorPredictiveLogProbability);
    if (!receipt.posterior || typeof receipt.posterior !== "object" || Object.keys(receipt.posterior).length !== Object.keys(actual.posterior).length || Object.keys(actual.posterior).some((key) => !Object.hasOwn(receipt.posterior, key))) {
      structuralDifferences.push(`${prefix}.posterior: candidate keys differ`);
    } else {
      for (const key of Object.keys(actual.posterior))
        compareNumber(`${prefix}.posterior.${key}`, receipt.posterior[key], actual.posterior[key]);
    }
  }
  return {
    mode: "numerical-comparison",
    exactReplayVerified: false,
    claim: "Numerical agreement for these observations and declared tolerances only. Hashes, runtime identity, and the source artifact are not verified.",
    currentRuntime: currentReplayRuntime(),
    recordedRuntime: receipts[0]?.runtime ?? null,
    tolerances: { absoluteTolerance, relativeTolerance },
    comparedNumbers,
    exactlyEqualNumbers,
    withinTolerance: structuralDifferences.length === 0 && differences.every((difference) => difference.withinTolerance),
    differences,
    structuralDifferences
  };
}
var init_compare = __esm({
  "dist/src/inference/compare.js"() {
    init_runtime2();
    init_session();
  }
});

// dist/src/inference/adequacy.js
function currentAdequacyRuntime() {
  return { ...currentReplayRuntime(), implementation: ADEQUACY_IMPLEMENTATION };
}
function assertAdequacyRuntime(recorded) {
  const current = currentAdequacyRuntime();
  const keys2 = Object.keys(current);
  if (!recorded || keys2.some((key) => typeof recorded[key] !== "string" || !recorded[key])) {
    throw new ReplayRuntimeError("MISSING_REPLAY_RUNTIME", "Adequacy replay requires a complete recorded runtime");
  }
  if (keys2.some((key) => recorded[key] !== current[key])) {
    throw new ReplayRuntimeError("REPLAY_RUNTIME_MISMATCH", "Adequacy replay runtime or implementation mismatch");
  }
}
function validateFamilyAdequacyOptions(options2) {
  if (!options2 || !Number.isFinite(options2.alpha) || options2.alpha <= 0 || options2.alpha >= 1) {
    throw new Error("alpha must be finite and strictly between zero and one");
  }
  validateDiscoveryIdentifier(options2.epochId, "epochId");
}
function freezeDeep(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value))
      freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function finite(value) {
  if (!Number.isFinite(value))
    throw new Error("Adequacy numeric range exceeded; no observation was committed");
  return value;
}
function replayFamilyAdequacy(definition2, options2, receipts, recordedRuntime) {
  if (!Array.isArray(receipts))
    throw new Error("Receipts must be an array");
  if (recordedRuntime !== void 0 || receipts.length === 0)
    assertAdequacyRuntime(recordedRuntime);
  for (const receipt of receipts) {
    if (receipt?.schemaVersion !== ADEQUACY_SCHEMA_VERSION)
      throw new Error("Adequacy receipt schema mismatch");
    assertAdequacyRuntime(receipt.runtime);
  }
  const monitor = new FamilyAdequacyMonitor(definition2, options2);
  for (const receipt of receipts) {
    const prepared = monitor.prepare(receipt.id, receipt.experimentId);
    const actual = monitor.observe(prepared, receipt.outcome);
    if (canonicalJSON(actual) !== canonicalJSON(receipt))
      throw new Error(`Adequacy receipt verification failed at sequence ${receipt.sequence}`);
  }
  return monitor;
}
var ADEQUACY_SCHEMA_VERSION, ADEQUACY_IMPLEMENTATION, ADEQUACY_NORMALIZATION_POLICY, ADEQUACY_SUPPORT_POLICY, FamilyAdequacyMonitor;
var init_adequacy = __esm({
  "dist/src/inference/adequacy.js"() {
    init_session();
    init_runtime2();
    ADEQUACY_SCHEMA_VERSION = 2;
    ADEQUACY_IMPLEMENTATION = "@cosmic/commons-adequacy/0.2.2";
    ADEQUACY_NORMALIZATION_POLICY = "normalize-row-preserve-smaller-tail-binary64-v1";
    ADEQUACY_SUPPORT_POLICY = "strictly-positive-declared-prior-frozen-at-construction-v1";
    FamilyAdequacyMonitor = class {
      definition;
      options;
      identity;
      ids;
      experiments;
      countState;
      effectiveNullLaws;
      evidenceIds = /* @__PURE__ */ new Set();
      receipts = [];
      pending = null;
      logs;
      alternativeLog = 0;
      logE = 0;
      maxLogE = 0;
      firstCrossing = null;
      constructor(definition2, options2) {
        validateFamilyAdequacyOptions(options2);
        this.definition = new DiscoverySession(definition2).exportDefinition();
        this.ids = this.definition.hypotheses.filter((h) => h.prior > 0).map((h) => h.id);
        const excludedZeroPriorHypothesisIds = this.definition.hypotheses.filter((h) => h.prior === 0).map((h) => h.id);
        const effectiveEntries = [];
        for (const experiment of this.definition.experiments) {
          if (experiment.outcomes.length !== 2)
            throw new Error("Adequacy v2 requires exactly two outcome labels per experiment");
          const rows = this.ids.map((id) => {
            const row = experiment.likelihoods[id];
            const [left, right] = experiment.outcomes;
            const total = row[left] + row[right];
            const tailOutcome = row[left] <= row[right] ? left : right;
            const complementOutcome = tailOutcome === left ? right : left;
            const tailProbability = row[tailOutcome] / total;
            if (!Number.isFinite(tailProbability) || tailProbability < 0 || tailProbability > 0.5 || row[tailOutcome] > 0 && tailProbability === 0) {
              throw new Error("Normalized Bernoulli tail is not representable");
            }
            return [id, { tailOutcome, tailProbability, complementOutcome }];
          });
          effectiveEntries.push([experiment.id, Object.fromEntries(rows)]);
        }
        this.effectiveNullLaws = Object.fromEntries(effectiveEntries);
        this.options = { alpha: options2.alpha, epochId: options2.epochId };
        this.logs = this.ids.map(() => 0);
        this.experiments = new Map(this.definition.experiments.map((e) => [e.id, e]));
        this.countState = new Map(this.definition.experiments.map((e) => [e.id, [0, 0]]));
        const normalizationPolicy = ADEQUACY_NORMALIZATION_POLICY;
        const anchor = {
          schemaVersion: ADEQUACY_SCHEMA_VERSION,
          runtime: currentAdequacyRuntime(),
          definitionHash: hashJSON(this.definition),
          optionsHash: hashJSON(this.options),
          ...this.options,
          supportPolicy: ADEQUACY_SUPPORT_POLICY,
          nullHypothesisIds: [...this.ids],
          excludedZeroPriorHypothesisIds,
          normalizationPolicy,
          effectiveLawHash: hashJSON({ normalizationPolicy, laws: this.effectiveNullLaws })
        };
        this.identity = { ...anchor, chainAnchorHash: hashJSON(anchor) };
      }
      statistics() {
        const impossible = this.logs.every((value) => value === -Infinity);
        return {
          status: impossible ? "ZERO_SUPPORT_CONTRADICTION" : this.firstCrossing === null ? "NOT_REJECTED" : "REJECTED_DECLARED_FAMILY",
          logEValue: impossible ? null : this.logE,
          eValueState: impossible ? "infinite-zero-support" : "finite",
          maxLogEValue: this.maxLogE === Infinity ? null : this.maxLogE,
          firstCrossingSequence: this.firstCrossing,
          nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, this.logs[i] === -Infinity ? null : this.logs[i]])),
          impossibleHypothesisIds: this.ids.filter((_, i) => this.logs[i] === -Infinity),
          alternativeLogLikelihood: this.alternativeLog
        };
      }
      prepare(observationId, experimentId) {
        validateDiscoveryIdentifier(observationId, "observation id");
        validateDiscoveryIdentifier(experimentId, "experiment id");
        if (this.pending)
          throw new Error("A prepared observation is pending; commit it before preparing another");
        if (this.logs.every((value) => value === -Infinity))
          throw new Error("Monitor stopped after zero support contradiction");
        if (this.evidenceIds.has(observationId))
          throw new Error("Duplicate observation id: evidence cannot be counted twice");
        const experiment = this.experiments.get(experimentId);
        if (!experiment)
          throw new Error("Unknown experiment");
        const counts = this.countState.get(experimentId);
        const total = counts[0] + counts[1];
        if (total >= 2 ** 50 || !Number.isSafeInteger(this.receipts.length + 1))
          throw new Error("Adequacy observation count limit reached");
        const q0 = (counts[0] + 0.5) / (total + 1);
        const q1 = (counts[1] + 0.5) / (total + 1);
        if (!(q0 > 0 && q0 < 1 && q1 > 0 && q1 < 1))
          throw new Error("Alternative probabilities are not representable");
        const laws = this.effectiveNullLaws[experimentId];
        const nullProbabilities = Object.fromEntries(this.ids.map((id) => {
          const law = laws[id];
          return [id, Object.fromEntries([[law.tailOutcome, law.tailProbability], [law.complementOutcome, 1 - law.tailProbability]])];
        }));
        const nullLogProbabilities = Object.fromEntries(this.ids.map((id) => {
          const law = laws[id];
          return [id, Object.fromEntries([
            [law.tailOutcome, law.tailProbability === 0 ? null : Math.log(law.tailProbability)],
            [law.complementOutcome, law.tailProbability === 0 ? 0 : Math.log1p(-law.tailProbability)]
          ])];
        }));
        const body = {
          ...structuredClone(this.identity),
          id: observationId,
          experimentId,
          sequence: this.receipts.length + 1,
          outcomes: [...experiment.outcomes],
          nullProbabilities,
          nullLogProbabilities,
          alternativeProbabilities: Object.fromEntries([[experiment.outcomes[0], q0], [experiment.outcomes[1], q1]]),
          previousHash: this.receipts.at(-1)?.hash ?? this.identity.chainAnchorHash
        };
        const prepared = { ...body, hash: hashJSON(body) };
        this.pending = prepared;
        return freezeDeep(structuredClone(prepared));
      }
      observe(token, outcome) {
        if (!this.pending)
          throw new Error("No prepared observation is pending");
        if (canonicalJSON(token) !== canonicalJSON(this.pending))
          throw new Error("Prepared token verification failed");
        const prepared = this.pending;
        const index = prepared.outcomes.indexOf(outcome);
        if (index < 0)
          throw new Error("Outcome is outside the declared binary observation alphabet");
        const nextLogs = this.logs.map((value, i) => {
          const logProbability = prepared.nullLogProbabilities[this.ids[i]][outcome];
          return value === -Infinity || logProbability === null ? -Infinity : finite(value + logProbability);
        });
        const alternativeLog = finite(this.alternativeLog + Math.log(prepared.alternativeProbabilities[outcome]));
        const peak = nextLogs.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
        const logE = peak === -Infinity ? Infinity : finite(alternativeLog - peak);
        const firstCrossing = this.firstCrossing ?? (logE >= -Math.log(this.options.alpha) ? prepared.sequence : null);
        const maxLogE = Math.max(this.maxLogE, logE);
        const statistics = {
          status: peak === -Infinity ? "ZERO_SUPPORT_CONTRADICTION" : firstCrossing === null ? "NOT_REJECTED" : "REJECTED_DECLARED_FAMILY",
          logEValue: logE === Infinity ? null : logE,
          eValueState: peak === -Infinity ? "infinite-zero-support" : "finite",
          maxLogEValue: maxLogE === Infinity ? null : maxLogE,
          firstCrossingSequence: firstCrossing,
          nullLogLikelihoods: Object.fromEntries(this.ids.map((id, i) => [id, nextLogs[i] === -Infinity ? null : nextLogs[i]])),
          impossibleHypothesisIds: this.ids.filter((_, i) => nextLogs[i] === -Infinity),
          alternativeLogLikelihood: alternativeLog
        };
        const body = {
          ...structuredClone(this.identity),
          ...statistics,
          id: prepared.id,
          experimentId: prepared.experimentId,
          outcome,
          sequence: prepared.sequence,
          prepared: structuredClone(prepared),
          previousHash: prepared.previousHash
        };
        const receipt = { ...body, hash: hashJSON(body) };
        const result = structuredClone(receipt);
        this.logs = nextLogs;
        this.alternativeLog = alternativeLog;
        this.logE = logE;
        this.maxLogE = maxLogE;
        this.firstCrossing = firstCrossing;
        this.countState.get(prepared.experimentId)[index]++;
        this.evidenceIds.add(prepared.id);
        this.receipts.push(receipt);
        this.pending = null;
        return result;
      }
      snapshot() {
        return {
          ...structuredClone(this.identity),
          ...this.statistics(),
          modelId: this.definition.modelId,
          nullSemantics: "frozen-positive-prior-conditional-bernoulli-laws",
          notRejectedSemantics: "insufficient-evidence-against-declared-laws-not-approval",
          budgetSemantics: "external-discovery-session-only",
          alternative: "per-experiment-beta-half-prequential",
          observationCount: this.receipts.length,
          effectiveNullLaws: structuredClone(this.effectiveNullLaws),
          counts: Object.fromEntries([...this.experiments].map(([id, experiment]) => [
            id,
            Object.fromEntries(experiment.outcomes.map((label, i) => [label, this.countState.get(id)[i]]))
          ])),
          pending: this.pending === null ? null : structuredClone(this.pending),
          receipts: structuredClone(this.receipts)
        };
      }
      exportDefinition() {
        return structuredClone(this.definition);
      }
      exportOptions() {
        return { ...this.options };
      }
    };
  }
});

// dist/src/inference/index.js
var init_inference = __esm({
  "dist/src/inference/index.js"() {
    init_types();
    init_session();
    init_runtime2();
    init_compare();
    init_adequacy();
  }
});

// dist/src/evidence.js
function requiredId(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 256)
    throw new TypeError(`${label} must be a nonempty string of at most 256 characters without surrounding whitespace`);
}
function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new TypeError(`Unknown ${label} field: ${key}`);
}
function validateBundle(value) {
  canonicalize(value);
  if (!isRecord(value))
    throw new TypeError("Evidence must be an object");
  exactKeys(value, ["sources", "facts"], "evidence");
  if (!Array.isArray(value.sources) || !Array.isArray(value.facts))
    throw new TypeError("Evidence requires sources and facts arrays");
  if (value.sources.length > EVIDENCE_LIMITS.sources || value.facts.length > EVIDENCE_LIMITS.facts) {
    throw new EvidenceLimitError("Evidence supports at most 1000 sources and 1000 facts");
  }
  let dependencies = 0;
  for (const fact of value.facts)
    if (isRecord(fact) && Array.isArray(fact.dependsOn)) {
      dependencies += fact.dependsOn.length;
      if (dependencies > EVIDENCE_LIMITS.dependencies) {
        throw new EvidenceLimitError("Evidence supports at most 10000 total dependency references");
      }
    }
  for (const source of value.sources) {
    if (!isRecord(source))
      throw new TypeError("Each source must be an object");
    exactKeys(source, ["id", "uri", "content", "digest"], "source");
    requiredId(source.id, "source.id");
    if ("uri" in source && (typeof source.uri !== "string" || !source.uri.trim()))
      throw new TypeError("source.uri must be a nonempty string");
    if ("digest" in source && (typeof source.digest !== "string" || !/^[0-9a-f]{64}$/.test(source.digest)))
      throw new TypeError("source.digest must be a lowercase SHA-256 hex string");
  }
  for (const fact of value.facts) {
    if (!isRecord(fact))
      throw new TypeError("Each fact must be an object");
    exactKeys(fact, ["id", "sourceId", "value", "claimId", "unit", "observedAt", "expiresAt", "dependsOn"], "fact");
    requiredId(fact.id, "fact.id");
    requiredId(fact.sourceId, "fact.sourceId");
    if (!Object.hasOwn(fact, "value"))
      throw new TypeError("fact.value is required");
    if ("claimId" in fact)
      requiredId(fact.claimId, "fact.claimId");
    if ("unit" in fact)
      requiredId(fact.unit, "fact.unit");
    if ("observedAt" in fact)
      timestamp(fact.observedAt, "fact.observedAt");
    if ("expiresAt" in fact)
      timestamp(fact.expiresAt, "fact.expiresAt");
    if ("observedAt" in fact && "expiresAt" in fact && timestamp(fact.expiresAt) <= timestamp(fact.observedAt)) {
      throw new TypeError("fact.expiresAt must follow fact.observedAt");
    }
    if ("dependsOn" in fact) {
      if (!Array.isArray(fact.dependsOn))
        throw new TypeError("fact.dependsOn must be an array");
      for (const id of fact.dependsOn)
        requiredId(id, "fact.dependsOn entry");
      if (new Set(fact.dependsOn).size !== fact.dependsOn.length)
        throw new TypeError("fact.dependsOn contains duplicate references");
    }
  }
}
function inspectEvidence(bundle3, asOf4) {
  const now = timestamp(asOf4, "asOf");
  const report = { asOf: asOf4, valid: false, issues: [], facts: [], lineage: [], sources: [] };
  try {
    validateBundle(bundle3);
  } catch (error) {
    report.issues.push({ code: error instanceof EvidenceLimitError ? "EVIDENCE_LIMIT" : "MALFORMED_EVIDENCE", severity: "ERROR", factIds: [], message: error instanceof Error ? error.message : "Malformed evidence" });
    return report;
  }
  const sources = /* @__PURE__ */ new Map();
  const facts = /* @__PURE__ */ new Map();
  const states = /* @__PURE__ */ new Map();
  const reasonSets = /* @__PURE__ */ new Map();
  const sourceFacts = /* @__PURE__ */ new Map();
  const invalidSources = /* @__PURE__ */ new Set();
  const rank = { AVAILABLE: 0, FUTURE: 1, EXPIRED: 2, MISSING: 3, CONFLICT: 4, INVALID: 5 };
  const mark = (id, status, reason) => {
    const state = states.get(id);
    if (!state)
      return false;
    const changed = rank[status] > rank[state.status];
    if (changed)
      state.status = status;
    reasonSets.get(id).add(reason);
    return changed;
  };
  const issue = (code2, severity, factIds, message) => report.issues.push({ code: code2, severity, factIds: [...factIds].sort(), message });
  for (const source of bundle3.sources) {
    if (sources.has(source.id)) {
      invalidSources.add(source.id);
      issue("DUPLICATE_SOURCE_ID", "ERROR", [], `Duplicate source id: ${source.id}`);
    } else
      sources.set(source.id, source);
  }
  for (const fact of bundle3.facts) {
    if (facts.has(fact.id)) {
      mark(fact.id, "INVALID", "DUPLICATE_FACT_ID");
      issue("DUPLICATE_FACT_ID", "ERROR", [fact.id], `Duplicate fact id: ${fact.id}`);
    } else {
      facts.set(fact.id, fact);
      states.set(fact.id, { id: fact.id, status: "AVAILABLE", reasons: [] });
      reasonSets.set(fact.id, /* @__PURE__ */ new Set());
      const ids = sourceFacts.get(fact.sourceId) ?? [];
      ids.push(fact.id);
      sourceFacts.set(fact.sourceId, ids);
    }
  }
  for (const source of sources.values()) {
    if (Object.hasOwn(source, "content")) {
      const computedDigest = sha256(source.content);
      const contentStatus = source.digest === void 0 ? "CONTENT_ONLY" : source.digest === computedDigest ? "DIGEST_VERIFIED" : "DIGEST_MISMATCH";
      report.sources.push({ id: source.id, contentStatus, computedDigest });
      if (contentStatus === "DIGEST_MISMATCH") {
        invalidSources.add(source.id);
        issue("SOURCE_DIGEST_MISMATCH", "ERROR", sourceFacts.get(source.id) ?? [], `Content digest mismatch: ${source.id}`);
      }
    } else
      report.sources.push({ id: source.id, contentStatus: "REFERENCE_ONLY" });
  }
  for (const fact of facts.values()) {
    report.lineage.push({ factId: fact.id, sourceId: fact.sourceId, dependsOn: [...fact.dependsOn ?? []].sort() });
    if (!sources.has(fact.sourceId)) {
      mark(fact.id, "MISSING", "MISSING_SOURCE");
      issue("MISSING_SOURCE", "UNAVAILABLE", [fact.id], `Missing source: ${fact.sourceId}`);
    }
    if (invalidSources.has(fact.sourceId))
      mark(fact.id, "INVALID", "INVALID_SOURCE");
    if (fact.observedAt !== void 0 && timestamp(fact.observedAt) > now) {
      mark(fact.id, "FUTURE", "FUTURE_OBSERVATION");
      issue("FUTURE_OBSERVATION", "UNAVAILABLE", [fact.id], "Observation occurs after asOf");
    }
    if (fact.expiresAt !== void 0 && timestamp(fact.expiresAt) <= now) {
      mark(fact.id, "EXPIRED", "EXPIRED_EVIDENCE");
      issue("EXPIRED_EVIDENCE", "UNAVAILABLE", [fact.id], "Evidence expires at or before asOf");
    }
    for (const dependency of fact.dependsOn ?? [])
      if (!facts.has(dependency)) {
        mark(fact.id, "MISSING", `MISSING_DEPENDENCY:${dependency}`);
        issue("MISSING_DEPENDENCY", "UNAVAILABLE", [fact.id], `Missing dependency: ${dependency}`);
      }
  }
  const dependencies = /* @__PURE__ */ new Map();
  const dependents = /* @__PURE__ */ new Map();
  for (const id of facts.keys()) {
    dependencies.set(id, []);
    dependents.set(id, []);
  }
  for (const fact of facts.values())
    for (const dependency of fact.dependsOn ?? [])
      if (facts.has(dependency)) {
        dependencies.get(fact.id).push(dependency);
        dependents.get(dependency).push(fact.id);
      }
  const visited = /* @__PURE__ */ new Set();
  const finished = [];
  for (const id of facts.keys()) {
    if (visited.has(id))
      continue;
    visited.add(id);
    const stack = [{ id, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edges = dependencies.get(frame.id);
      if (frame.next === edges.length) {
        finished.push(frame.id);
        stack.pop();
        continue;
      }
      const child = edges[frame.next++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, next: 0 });
      }
    }
  }
  visited.clear();
  for (let index = finished.length - 1; index >= 0; index--) {
    const id = finished[index];
    if (visited.has(id))
      continue;
    visited.add(id);
    const members = [];
    const stack = [id];
    while (stack.length) {
      const member = stack.pop();
      members.push(member);
      for (const parent of dependents.get(member))
        if (!visited.has(parent)) {
          visited.add(parent);
          stack.push(parent);
        }
    }
    if (members.length > 1 || dependencies.get(id).includes(id)) {
      issue("DEPENDENCY_CYCLE", "ERROR", members, "Evidence dependencies contain a cycle");
      for (const member of members)
        mark(member, "INVALID", "DEPENDENCY_CYCLE");
    }
  }
  const claims = /* @__PURE__ */ new Map();
  for (const fact of facts.values())
    if (fact.claimId && states.get(fact.id).status === "AVAILABLE") {
      const group = claims.get(fact.claimId) ?? [];
      group.push(fact);
      claims.set(fact.claimId, group);
    }
  for (const [claimId, group] of claims) {
    const values = new Set(group.map((fact) => canonicalize({ value: fact.value, unit: fact.unit ?? null })));
    if (values.size > 1) {
      const ids = group.map((fact) => fact.id);
      issue("CONFLICTING_CLAIM", "UNAVAILABLE", ids, `Conflicting declared values or units for claim: ${claimId}`);
      for (const id of ids)
        mark(id, "CONFLICT", "CONFLICTING_CLAIM");
    }
  }
  const pending = [...states.values()].filter((state) => state.status !== "AVAILABLE").map((state) => state.id);
  const queued = new Set(pending);
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const dependency = pending[cursor];
    queued.delete(dependency);
    const status = states.get(dependency).status;
    for (const dependent of dependents.get(dependency)) {
      if (mark(dependent, status, `DEPENDENCY_UNAVAILABLE:${dependency}`) && !queued.has(dependent)) {
        pending.push(dependent);
        queued.add(dependent);
      }
    }
  }
  report.valid = !report.issues.some((item) => item.severity === "ERROR");
  report.facts = [...states.values()].map((state) => ({ ...state, reasons: [...reasonSets.get(state.id)].sort() })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  report.lineage.sort((a, b) => a.factId < b.factId ? -1 : a.factId > b.factId ? 1 : 0);
  report.sources.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return report;
}
var isRecord, EVIDENCE_LIMITS, EvidenceLimitError;
var init_evidence = __esm({
  "dist/src/evidence.js"() {
    init_canonical();
    isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    EVIDENCE_LIMITS = Object.freeze({ sources: 1e3, facts: 1e3, dependencies: 1e4 });
    EvidenceLimitError = class extends TypeError {
    };
  }
});

// dist/src/policy.js
function validatePolicy(value) {
  canonicalize(value);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Policy must be an object");
  const policy2 = value;
  exactKeys(policy2, ["id", "version", "rules"], "policy");
  requiredId(policy2.id, "policy.id");
  requiredId(policy2.version, "policy.version");
  if (!Array.isArray(policy2.rules) || policy2.rules.length < 1 || policy2.rules.length > 1e3)
    throw new TypeError("Policy must contain between 1 and 1000 rules");
  const ids = /* @__PURE__ */ new Set();
  for (const item of policy2.rules) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new TypeError("Rule must be an object");
    const rule = item;
    exactKeys(rule, ["id", "factId", "op", "value"], "rule");
    requiredId(rule.id, "rule.id");
    requiredId(rule.factId, "rule.factId");
    if (ids.has(rule.id))
      throw new TypeError(`Duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!["exists", "eq", "ne", "gt", "gte", "lt", "lte", "in"].includes(rule.op))
      throw new TypeError("Unsupported rule operator");
    if (rule.op === "exists") {
      if (Object.hasOwn(rule, "value"))
        throw new TypeError("exists must not declare value");
    } else if (!Object.hasOwn(rule, "value"))
      throw new TypeError("Comparison rule requires value");
    if (["gt", "gte", "lt", "lte"].includes(rule.op) && typeof rule.value !== "number")
      throw new TypeError("Ordered comparison requires numeric value");
    if (rule.op === "in" && (!Array.isArray(rule.value) || rule.value.length === 0))
      throw new TypeError("in requires a nonempty array");
  }
}
function compare(actual, op, expected) {
  if (op === "exists")
    return true;
  if (op === "eq")
    return canonicalize(actual) === canonicalize(expected);
  if (op === "ne")
    return canonicalize(actual) !== canonicalize(expected);
  if (op === "in")
    return expected.some((item) => canonicalize(actual) === canonicalize(item));
  if (typeof actual !== "number" || typeof expected !== "number")
    throw new TypeError("Ordered comparison requires a numeric fact and threshold");
  switch (op) {
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
  }
}
function evaluatePolicy(policy2, bundle3, asOf4) {
  const report = {
    schema: "cosmic.policy-report.v1",
    policyId: null,
    policyVersion: null,
    asOf: asOf4,
    verdict: "ERROR",
    trace: [],
    errors: []
  };
  try {
    timestamp(asOf4, "asOf");
    validatePolicy(policy2);
  } catch (error) {
    report.errors.push({ code: "MALFORMED_INPUT", message: error instanceof Error ? error.message : "Malformed policy input" });
    return report;
  }
  report.policyId = policy2.id;
  report.policyVersion = policy2.version;
  const evidence = inspectEvidence(bundle3, asOf4);
  report.evidence = evidence;
  if (!evidence.valid) {
    report.errors = evidence.issues.filter((item) => item.severity === "ERROR").map((item) => ({ code: item.code, message: item.message }));
    return report;
  }
  const facts = new Map(bundle3.facts.map((fact) => [fact.id, fact]));
  const states = new Map(evidence.facts.map((fact) => [fact.id, fact]));
  for (const rule of policy2.rules) {
    const trace = { ruleId: rule.id, factId: rule.factId, result: "DEFER", code: "MISSING_FACT" };
    if (Object.hasOwn(rule, "value"))
      trace.expected = rule.value;
    const fact = facts.get(rule.factId);
    const state = states.get(rule.factId);
    if (fact && state) {
      trace.actual = fact.value;
      if (state.status !== "AVAILABLE") {
        trace.code = `EVIDENCE_${state.status}`;
        trace.reasons = state.reasons;
      } else {
        try {
          const passed = compare(fact.value, rule.op, rule.value);
          trace.result = passed ? "PASS" : "FAIL";
          trace.code = passed ? "REQUIREMENT_SATISFIED" : "REQUIREMENT_FAILED";
        } catch (error) {
          trace.result = "ERROR";
          trace.code = "TYPE_MISMATCH";
          report.errors.push({ code: "TYPE_MISMATCH", message: `Rule ${rule.id}: ${error instanceof Error ? error.message : "Type mismatch"}` });
        }
      }
    }
    report.trace.push(trace);
  }
  report.verdict = report.trace.some((rule) => rule.result === "ERROR") ? "ERROR" : report.trace.some((rule) => rule.result === "FAIL") ? "DENY" : report.trace.some((rule) => rule.result === "DEFER") ? "DEFER" : "ALLOW";
  return report;
}
function thresholdSensitivity(input3) {
  canonicalize(input3);
  exactKeys(input3, ["lower", "upper", "op", "threshold"], "sensitivity");
  if (![input3.lower, input3.upper, input3.threshold].every((value) => typeof value === "number" && Number.isFinite(value)))
    throw new TypeError("Sensitivity endpoints and threshold must be finite numbers");
  if (input3.lower > input3.upper)
    throw new TypeError("lower must not exceed upper");
  if (!["gt", "gte", "lt", "lte"].includes(input3.op))
    throw new TypeError("Sensitivity requires a monotone numeric operator");
  const lowerPass = compare(input3.lower, input3.op, input3.threshold);
  const upperPass = compare(input3.upper, input3.op, input3.threshold);
  return { ...input3, lowerPass, upperPass, classification: lowerPass === upperPass ? lowerPass ? "ALWAYS_PASS" : "ALWAYS_FAIL" : "SENSITIVE" };
}
var init_policy = __esm({
  "dist/src/policy.js"() {
    init_canonical();
    init_evidence();
  }
});

// dist/src/run.js
function object(v, label) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error(`${label} must be an object`);
  return v;
}
function keys(v, allowed, required, label) {
  for (const k of Object.keys(v))
    if (!allowed.includes(k))
      throw new Error(`${label}: unknown field ${k}`);
  for (const k of required)
    if (!Object.hasOwn(v, k))
      throw new Error(`${label}: missing ${k}`);
}
function jsonNodeCount(value) {
  return value !== null && typeof value === "object" ? 1 + Object.values(value).reduce((sum, child) => sum + jsonNodeCount(child), 0) : 1;
}
function assertDiscoveryReceiptBudget(input3) {
  const hypotheses = input3.definition.hypotheses.length;
  const experiments = input3.definition.experiments.length;
  const monitored = input3.adequacy !== void 0 && input3.definition.experiments.every((e) => e.outcomes.length === 2);
  const fixedNodes = 512 + 8 * hypotheses + experiments * (8 + 5 * hypotheses) + 4 * (input3.actions?.length ?? 0);
  const nodesPerObservation = 40 + hypotheses + (monitored ? 128 + 10 * hypotheses : 0);
  const upperBound = jsonNodeCount(input3) + fixedNodes + input3.observations.length * nodesPerObservation;
  if (upperBound > CANONICAL_MAX_NODES) {
    throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated receipt bound ${upperBound} exceeds ${CANONICAL_MAX_NODES} JSON nodes; reduce observations, hypotheses, or experiments`);
  }
  const quotedBytes = (text) => Buffer.byteLength(JSON.stringify(text), "utf8");
  const hypothesisBytes = input3.definition.hypotheses.reduce((sum, h) => sum + quotedBytes(h.id), 0);
  const experimentBytes = input3.definition.experiments.reduce((sum, e) => sum + quotedBytes(e.id), 0);
  const outcomeBytes = input3.definition.experiments.map((e) => e.outcomes.reduce((sum, o) => sum + quotedBytes(o), 0));
  const allOutcomeBytes = outcomeBytes.reduce((sum, bytes) => sum + bytes, 0);
  const maxOutcomeBytes = Math.max(0, ...outcomeBytes);
  const epochBytes = input3.adequacy ? quotedBytes(input3.adequacy.epochId) : 0;
  const actionBytes = (input3.actions ?? []).reduce((sum, a) => sum + quotedBytes(a.id), 0);
  const fixedBytes = 32768 + 8 * hypothesisBytes + 4 * experimentBytes + 4 * quotedBytes(input3.definition.modelId) + 4 * epochBytes + 4 * actionBytes + 256 * (input3.actions?.length ?? 0) + experiments * (256 + 512 * hypotheses + 4 * hypothesisBytes) + 4 * hypotheses * allOutcomeBytes;
  let chainBytes = 0;
  for (const observation of input3.observations) {
    const observationBytes = quotedBytes(observation.id) + quotedBytes(observation.experimentId) + quotedBytes(observation.outcome);
    chainBytes += 2048 + 64 * hypotheses + hypothesisBytes + 2 * observationBytes;
    if (monitored)
      chainBytes += 8192 + 256 * hypotheses + 12 * hypothesisBytes + 8 * observationBytes + 4 * epochBytes + 4 * (hypotheses + 1) * maxOutcomeBytes;
  }
  const inputBytes = Buffer.byteLength(JSON.stringify(input3, null, 2), "utf8") + 4 * jsonNodeCount(input3);
  const byteBound = inputBytes + fixedBytes + chainBytes;
  if (byteBound > CANONICAL_MAX_BYTES) {
    throw new RangeError(`DISCOVERY_RECEIPT_LIMIT: estimated pretty-printed receipt bound ${byteBound} exceeds ${CANONICAL_MAX_BYTES} UTF-8 bytes; reduce observations, hypotheses, or identifier lengths`);
  }
}
function validateInput(value) {
  const copy = JSON.parse(canonicalize(value));
  const input3 = object(copy, "Input");
  if (input3.kind === "discovery") {
    keys(input3, ["kind", "definition", "observations", "adequacy", "actions"], ["kind", "definition", "observations"], "Discovery input");
    if (!Array.isArray(input3.observations) || input3.observations.length > MAX_DISCOVERY_OBSERVATIONS)
      throw new Error(`Observations must be an array with at most ${MAX_DISCOVERY_OBSERVATIONS} entries and fit the discovery receipt budget`);
    const d = object(input3.definition, "Definition");
    keys(d, ["modelId", "hypotheses", "experiments", "budget", "observationAssumption", "stopProbability", "minInformationGainNats"], ["modelId", "hypotheses", "experiments", "budget", "observationAssumption"], "Definition");
    if (!Array.isArray(d.hypotheses) || d.hypotheses.length > 100 || !Array.isArray(d.experiments) || d.experiments.length > 100)
      throw new Error("At most 100 hypotheses and 100 experiments are supported");
    validateDiscoveryIdentifier(d.modelId, "modelId");
    for (const h of d.hypotheses) {
      const hypothesis = object(h, "Hypothesis");
      keys(hypothesis, ["id", "prior"], ["id", "prior"], "Hypothesis");
      validateDiscoveryIdentifier(hypothesis.id, "hypothesis id");
    }
    for (const e of d.experiments) {
      const ex = object(e, "Experiment");
      keys(ex, ["id", "cost", "outcomes", "likelihoods"], ["id", "cost", "outcomes", "likelihoods"], "Experiment");
      if (!Array.isArray(ex.outcomes) || ex.outcomes.length > 100)
        throw new Error("At most 100 outcomes per experiment are supported");
      validateDiscoveryIdentifier(ex.id, "experiment id");
      for (const outcome of ex.outcomes)
        validateDiscoveryIdentifier(outcome, "outcome");
    }
    for (const obs of input3.observations) {
      const observation = object(obs, "Observation");
      keys(observation, ["id", "experimentId", "outcome"], ["id", "experimentId", "outcome"], "Observation");
      for (const field of ["id", "experimentId", "outcome"])
        validateDiscoveryIdentifier(observation[field], `observation ${field}`);
    }
    if (input3.adequacy !== void 0) {
      const adequacy = object(input3.adequacy, "Adequacy");
      keys(adequacy, ["alpha", "epochId"], ["alpha", "epochId"], "Adequacy");
      validateDiscoveryIdentifier(adequacy.epochId, "epochId");
    }
    if (input3.actions !== void 0) {
      if (!Array.isArray(input3.actions) || input3.actions.length > 100)
        throw new Error("At most 100 actions are supported");
      for (const action of input3.actions) {
        const candidate = object(action, "Action");
        keys(candidate, ["id", "losses"], ["id", "losses"], "Action");
        validateDiscoveryIdentifier(candidate.id, "action id");
      }
    }
    assertDiscoveryReceiptBudget(copy);
  } else if (input3.kind === "policy") {
    keys(input3, ["kind", "policy", "evidence", "asOf"], ["kind", "policy", "evidence", "asOf"], "Policy input");
    const evidence = object(input3.evidence, "Evidence");
    const policy2 = object(input3.policy, "Policy");
    if (!Array.isArray(evidence.facts) || evidence.facts.length > EVIDENCE_LIMITS.facts || !Array.isArray(evidence.sources) || evidence.sources.length > EVIDENCE_LIMITS.sources)
      throw new Error("Evidence requires arrays of at most 1000 facts and sources");
    if (!Array.isArray(policy2.rules) || policy2.rules.length > 1e3)
      throw new Error("Policy requires at most 1000 rules");
  } else
    throw new Error("Input kind is not supported by this edition");
  return copy;
}
function evaluateInput(input3) {
  if (input3.kind === "policy")
    return evaluatePolicy(input3.policy, input3.evidence, input3.asOf);
  const session = new DiscoverySession(input3.definition);
  if (input3.adequacy)
    validateFamilyAdequacyOptions(input3.adequacy);
  const unsupportedExperimentIds = input3.definition.experiments.filter((e) => e.outcomes.length !== 2).map((e) => e.id);
  const monitor = input3.adequacy && unsupportedExperimentIds.length === 0 ? new FamilyAdequacyMonitor(input3.definition, input3.adequacy) : null;
  for (const observation of input3.observations) {
    const prepared = monitor?.prepare(observation.id, observation.experimentId);
    session.observe(observation);
    if (monitor && prepared)
      monitor.observe(prepared, observation.outcome);
  }
  const snapshot = session.snapshot();
  const adequacy = monitor?.snapshot() ?? (input3.adequacy ? { status: "UNSUPPORTED", reason: "Adequacy requires exactly two outcome labels for every experiment.", unsupportedExperimentIds } : { status: "NOT_EVALUATED", reason: "Adequacy was not requested; no family adequacy assessment was made." });
  const available = !snapshot.modelMismatch && adequacy.status === "NOT_REJECTED";
  const stopReason = adequacy.status === "NOT_EVALUATED" ? "adequacy-not-evaluated" : adequacy.status === "UNSUPPORTED" ? "adequacy-unsupported" : "declared-family-rejected";
  return { snapshot, recommendation: adequacy.status === "NOT_REJECTED" ? session.recommend() : { status: "stop", reason: stopReason }, adequacy, decisionStatus: available ? "AVAILABLE" : "DEFER", action: input3.actions && available ? session.chooseAction(input3.actions) : null, assumptions: ["Probabilities are conditional on the declared finite candidate family.", "Observations are conditionally independent given the hypothesis and experiment.", "NOT_REJECTED means insufficient evidence against the declared family, not approval.", "An absent or unsupported adequacy assessment defers integrated action suggestions.", "Experiment selection is greedy expected information per cost, not global optimality."] };
}
function runRequest(value) {
  if (Number(process.versions.node.split(".")[0]) < 20)
    throw new Error("Unsupported execution runtime: Node 20 or newer is required");
  const input3 = validateInput(value);
  const payload = { schemaVersion: 1, kind: input3.kind, input: input3, result: evaluateInput(input3), runtime: executionRuntime() };
  const receipt = { ...payload, digest: sha256(payload) };
  assertReceiptTextLimit(receipt);
  return receipt;
}
function verifyRun(value, expectedDigest) {
  const answer = { valid: false, integrity: "NOT_CHECKED", replay: "NOT_RUN", anchoring: expectedDigest === void 0 ? "UNANCHORED" : "MISMATCH", reason: "" };
  try {
    if (expectedDigest !== void 0 && (typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/.test(expectedDigest)))
      throw new Error("Trusted digest must be 64 lowercase hexadecimal characters");
    const r = object(value, "Receipt");
    keys(r, ["schemaVersion", "kind", "input", "result", "runtime", "digest"], ["schemaVersion", "kind", "input", "result", "runtime", "digest"], "Receipt");
    if (r.schemaVersion !== 1 || typeof r.digest !== "string" || !/^[a-f0-9]{64}$/.test(r.digest))
      throw new Error("Unsupported or malformed receipt");
    const { digest, ...payload } = r;
    const payloadDigest = sha256(payload);
    answer.integrity = payloadDigest === digest ? "VALID" : "INVALID";
    answer.anchoring = expectedDigest === void 0 ? "UNANCHORED" : digest === expectedDigest && payloadDigest === expectedDigest ? "MATCH" : "MISMATCH";
    if (payloadDigest !== digest)
      throw new Error("Receipt digest does not match its payload");
    if (answer.anchoring === "MISMATCH")
      throw new Error("Receipt does not match the trusted external digest");
    if (canonicalize(r.runtime) !== canonicalize(executionRuntime())) {
      answer.replay = "UNSUPPORTED";
      throw new Error("Exact replay requires the recorded source artifact, Node/V8, platform, architecture, and endianness");
    }
    const replay = runRequest(r.input);
    if (replay.digest !== digest) {
      answer.replay = "MISMATCH";
      throw new Error("Payload is internally hashed but recomputation disagrees");
    }
    answer.replay = "MATCH";
    answer.valid = true;
    answer.reason = expectedDigest ? "Exact replay and trusted digest match." : "Exact replay matches. No trusted external digest was supplied; this verifies consistency, not origin or historical completeness.";
  } catch (error) {
    answer.reason = error instanceof Error ? error.message : String(error);
  }
  return answer;
}
function verifyRunText(raw2, expectedDigest) {
  try {
    return verifyRun(parseStrictJson(raw2), expectedDigest);
  } catch (error) {
    return { valid: false, integrity: "NOT_CHECKED", replay: "NOT_RUN", anchoring: expectedDigest === void 0 ? "UNANCHORED" : "MISMATCH", reason: error instanceof Error ? error.message : String(error) };
  }
}
var MAX_DISCOVERY_OBSERVATIONS;
var init_run = __esm({
  "dist/src/run.js"() {
    init_canonical();
    init_strict_json();
    init_runtime();
    init_runtime();
    init_inference();
    init_policy();
    init_evidence();
    MAX_DISCOVERY_OBSERVATIONS = 5e3;
  }
});

// dist/src/examples.js
function listExamples() {
  return readdirSync2(directory).filter((n) => n.endsWith(".json")).sort().map((name) => {
    const id = name.slice(0, -5);
    return { id, ...descriptions[id], input: parseStrictJson(readFileSync2(packagePath("examples", name), "utf8")) };
  });
}
function getExample(id = "sensor-investigation") {
  const found = listExamples().find((e) => e.id === id);
  if (!found)
    throw new Error(`Unknown example: ${id}`);
  return found.input;
}
var directory, descriptions;
var init_examples = __esm({
  "dist/src/examples.js"() {
    init_fs();
    init_strict_json();
    init_package_root();
    directory = packagePath("examples");
    descriptions = {
      "sensor-investigation": { name: "Sensor investigation", description: "Update two declared explanations, inspect model adequacy, and choose the next measurement." },
      "discovery-deferred": { name: "Rejected model family", description: "A zero-prior decoy cannot rescue rejected active models: DEFER with no action suggestion." },
      "release-authorization": { name: "Release authorization", description: "Evaluate artifact evidence against explicit tests, review, and security requirements." },
      "release-deferred": { name: "Missing evidence", description: "See why missing review evidence produces DEFER instead of approval." },
      "release-denied": { name: "Failed requirement", description: "See a complete record fail an explicit security requirement." }
    };
  }
});

// dist/src/server.js
import { createServer } from "node:http";
function createWorkbenchServer() {
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? "")) {
      send(403, { error: "Local host required" });
      return;
    }
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) {
      send(403, { error: "Same-origin requests only" });
      return;
    }
    try {
      const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
      if (req.method === "GET" && pathname === "/api/examples") {
        send(200, { examples: listExamples() });
        return;
      }
      if (req.method === "GET" && pathname === "/api/health") {
        send(200, { status: "ready", version: "0.2.1", node: process.versions.node });
        return;
      }
      if (req.method === "POST" && ["/api/run", "/api/verify", "/api/format"].includes(pathname)) {
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          send(415, { error: "Content-Type application/json required" });
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2e6) {
            send(413, { error: "Maximum request size is 2 MB" });
            return;
          }
          chunks.push(chunk);
        }
        const raw2 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
        if (pathname === "/api/run")
          send(200, runRequest(parseStrictJson(raw2)));
        else if (pathname === "/api/format")
          send(200, { formatted: JSON.stringify(parseStrictJson(raw2), null, 2) });
        else {
          try {
            const value = parseStrictJson(raw2);
            const header = req.headers["x-cosmic-expected-digest"];
            if (header !== void 0 && typeof header !== "string")
              throw new Error("Trusted digest header must be a single value");
            if (value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, "receipt")) {
              const envelope = value;
              if (Object.keys(envelope).some((key) => !["receipt", "expectedDigest"].includes(key)))
                throw new Error("Unknown verification envelope field");
              if (envelope.expectedDigest !== void 0 && typeof envelope.expectedDigest !== "string")
                throw new Error("Trusted digest must be a string");
              if (header !== void 0 && envelope.expectedDigest !== void 0 && header !== envelope.expectedDigest)
                throw new Error("Conflicting trusted digests");
              send(200, verifyRun(envelope.receipt, header ?? envelope.expectedDigest));
            } else
              send(200, verifyRun(value, header));
          } catch (error) {
            send(200, { valid: false, integrity: "NOT_CHECKED", replay: "NOT_RUN", anchoring: req.headers["x-cosmic-expected-digest"] === void 0 ? "NOT_CHECKED" : "MISMATCH", reason: error instanceof Error ? error.message : String(error) });
          }
        }
        return;
      }
      const files = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/styles.css": ["styles.css", "text/css"] };
      const entry = files[pathname];
      if (req.method === "GET" && entry) {
        res.writeHead(200, { "Content-Type": entry[1] + "; charset=utf-8" });
        res.end(readFileSync2(packagePath("web", entry[0])));
        return;
      }
      send(404, { error: "Not found" });
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : String(error), ...error instanceof StrictJsonError ? { code: error.code } : {} });
    }
  });
}
async function serve(port = 4317) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Port must be an integer between 1 and 65535");
  const server = createWorkbenchServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  process.stdout.write(`COSMIC Commons is ready: http://127.0.0.1:${port}
Local computation only. Press Ctrl+C to stop.
`);
}
var init_server = __esm({
  "dist/src/server.js"() {
    init_fs();
    init_package_root();
    init_run();
    init_strict_json();
    init_examples();
  }
});

// dist/src/receipt.js
function captureEnvironment() {
  return { implementation: policyImplementation(), runtime: `node/${process.versions.node}`, platform: process.platform, arch: process.arch };
}
function validateEnvironment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("environment must be an object");
  const environment = value;
  exactKeys(environment, ["implementation", "runtime", "platform", "arch"], "environment");
  for (const key of ["implementation", "runtime", "platform", "arch"])
    requiredId(environment[key], `environment.${key}`);
}
function validateInput2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("receipt input must be an object");
  const input3 = value;
  exactKeys(input3, ["policy", "evidence", "asOf", "environment"], "receipt input");
  timestamp(input3.asOf, "asOf");
  validatePolicy(input3.policy);
  validateEnvironment(input3.environment);
  if (!Object.hasOwn(input3, "evidence"))
    throw new TypeError("receipt evidence is required");
}
function createReceipt(input3) {
  const copy = jsonClone(input3);
  validateInput2(copy);
  const report = evaluatePolicy(copy.policy, copy.evidence, copy.asOf);
  const payload = { schema: "cosmic.policy-receipt.v1", input: copy, report };
  const receipt = { payload, digest: sha256(payload) };
  assertReceiptTextLimit(receipt);
  return receipt;
}
function verifyReceipt(receipt, options2 = {}) {
  const result = {
    valid: false,
    integrity: "NOT_CHECKED",
    replay: "NOT_RUN",
    integrityValid: false,
    replayValid: false,
    anchoring: options2.trustedDigest === void 0 ? "UNANCHORED" : "MISMATCH",
    environmentMatches: null,
    authenticity: "NOT_ESTABLISHED",
    issues: []
  };
  try {
    canonicalize(options2);
    exactKeys(options2, ["trustedDigest", "expectedEnvironment"], "verification options");
    if (options2.trustedDigest !== void 0 && (typeof options2.trustedDigest !== "string" || !/^[0-9a-f]{64}$/.test(options2.trustedDigest)))
      throw new TypeError("trustedDigest must be lowercase SHA-256 hex");
    if (options2.expectedEnvironment !== void 0)
      validateEnvironment(options2.expectedEnvironment);
    canonicalize(receipt);
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt))
      throw new TypeError("receipt must be an object");
    const envelope = receipt;
    exactKeys(envelope, ["payload", "digest"], "receipt");
    if (typeof envelope.digest !== "string" || !/^[0-9a-f]{64}$/.test(envelope.digest))
      throw new TypeError("receipt digest must be lowercase SHA-256 hex");
    const payload = envelope.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new TypeError("payload must be an object");
    exactKeys(payload, ["schema", "input", "report"], "receipt payload");
    const candidate = payload;
    if (candidate.schema !== "cosmic.policy-receipt.v1")
      throw new TypeError("Unsupported receipt schema");
    validateInput2(candidate.input);
    const computedDigest = sha256(payload);
    result.integrityValid = computedDigest === envelope.digest;
    result.integrity = result.integrityValid ? "VALID" : "INVALID";
    if (!result.integrityValid)
      result.issues.push("DIGEST_MISMATCH");
    if (options2.trustedDigest !== void 0) {
      result.anchoring = computedDigest === options2.trustedDigest && envelope.digest === options2.trustedDigest ? "ANCHORED" : "MISMATCH";
      if (result.anchoring === "MISMATCH")
        result.issues.push("TRUSTED_DIGEST_MISMATCH");
    } else
      result.issues.push("UNANCHORED_SELF_CONSISTENCY_ONLY");
    const declaredEnvironment = canonicalize(candidate.input.environment);
    const currentEnvironmentMatches = declaredEnvironment === canonicalize(captureEnvironment());
    const expectedEnvironmentMatches = options2.expectedEnvironment === void 0 || declaredEnvironment === canonicalize(options2.expectedEnvironment);
    result.environmentMatches = currentEnvironmentMatches && expectedEnvironmentMatches;
    if (!result.environmentMatches)
      result.issues.push("ENVIRONMENT_MISMATCH");
    if (!currentEnvironmentMatches) {
      result.replay = "UNSUPPORTED";
      result.issues.push("UNSUPPORTED_ENVIRONMENT");
      return result;
    }
    const replayed = evaluatePolicy(candidate.input.policy, candidate.input.evidence, candidate.input.asOf);
    result.replayedReport = replayed;
    result.replayValid = canonicalize(replayed) === canonicalize(candidate.report);
    result.replay = result.replayValid ? "MATCH" : "MISMATCH";
    if (!result.replayValid)
      result.issues.push("REPLAY_MISMATCH");
    result.valid = result.integrityValid && result.replayValid && result.anchoring !== "MISMATCH" && result.environmentMatches !== false;
  } catch (error) {
    result.valid = false;
    result.issues.push(`MALFORMED_RECEIPT:${error instanceof Error ? error.message : "unknown error"}`);
  }
  return result;
}
function verifyReceiptText(raw2, options2 = {}) {
  try {
    return verifyReceipt(parseStrictJson(raw2), options2);
  } catch (error) {
    return {
      valid: false,
      integrity: "NOT_CHECKED",
      replay: "NOT_RUN",
      integrityValid: false,
      replayValid: false,
      anchoring: options2.trustedDigest === void 0 ? "UNANCHORED" : "MISMATCH",
      environmentMatches: null,
      authenticity: "NOT_ESTABLISHED",
      issues: [error instanceof StrictJsonError ? error.code : "MALFORMED_RECEIPT", error instanceof Error ? error.message : String(error)]
    };
  }
}
var init_receipt = __esm({
  "dist/src/receipt.js"() {
    init_runtime();
    init_canonical();
    init_strict_json();
    init_evidence();
    init_policy();
  }
});

// dist/src/index.js
var init_src = __esm({
  "dist/src/index.js"() {
    init_run();
    init_canonical();
    init_evidence();
    init_policy();
    init_receipt();
    init_inference();
    init_strict_json();
  }
});

// dist/tests/evidence.test.js
import test from "node:test";
import assert from "node:assert/strict";
var asOf, bundle;
var init_evidence_test = __esm({
  "dist/tests/evidence.test.js"() {
    init_canonical();
    init_evidence();
    asOf = "2026-09-29T00:00:00Z";
    bundle = () => ({ sources: [{ id: "source", content: { reading: 42 }, digest: sha256({ reading: 42 }) }], facts: [{ id: "reading", sourceId: "source", value: 42 }] });
    test("canonical hashes ignore object key insertion order and preserve array order", () => {
      assert.equal(canonicalize({ z: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"z":1}');
      assert.equal(sha256({ z: 1, a: 2 }), sha256({ a: 2, z: 1 }));
      assert.notEqual(sha256([1, 2]), sha256([2, 1]));
      assert.notEqual(sha256("1"), sha256(1));
    });
    test("strict canonicalizer rejects lossy, executable or non-JSON inputs", () => {
      const cycle = [];
      cycle.push(cycle);
      let called = false;
      const getter = Object.defineProperty({}, "secret", { enumerable: true, get() {
        called = true;
        return 2;
      } });
      for (const value of [void 0, NaN, Infinity, -0, 1n, /* @__PURE__ */ new Date(), /* @__PURE__ */ new Map(), [1, void 0], Array(2), cycle, getter, "\uD800"]) {
        assert.throws(() => canonicalize(value));
      }
      assert.equal(called, false);
      const symbol = { [Symbol("s")]: 1 };
      assert.throws(() => canonicalize(symbol));
      const nonEnumerable = Object.defineProperty({}, "hidden", { value: 1 });
      assert.throws(() => canonicalize(nonEnumerable));
    });
    test("calendar validation is explicit and rejects invalid UTC dates", () => {
      assert.equal(timestamp(asOf), Date.parse(asOf));
      assert.throws(() => timestamp("2026-02-30T00:00:00Z"));
      assert.throws(() => timestamp("2026-09-29"));
      assert.throws(() => timestamp("2026-09-29T00:00:00-05:00"));
    });
    test("source digest verification checks the supplied content bytes through canonical JSON", () => {
      const good = inspectEvidence(bundle(), asOf);
      assert.equal(good.valid, true);
      assert.equal(good.sources[0].contentStatus, "DIGEST_VERIFIED");
      const tampered = bundle();
      tampered.sources[0].content = { reading: 43 };
      const bad = inspectEvidence(tampered, asOf);
      assert.equal(bad.valid, false);
      assert.equal(bad.facts[0].status, "INVALID");
      assert.ok(bad.issues.some((issue) => issue.code === "SOURCE_DIGEST_MISMATCH"));
    });
    test("reference-only provenance is reported honestly without claiming content verification", () => {
      const value = bundle();
      delete value.sources[0].content;
      assert.equal(inspectEvidence(value, asOf).sources[0].contentStatus, "REFERENCE_ONLY");
    });
    test("duplicate references, absent dependencies and cycles have different failure codes", () => {
      const duplicate = bundle();
      duplicate.facts.push({ ...duplicate.facts[0] });
      assert.equal(inspectEvidence(duplicate, asOf).issues[0].code, "DUPLICATE_FACT_ID");
      const missing2 = bundle();
      missing2.facts[0].dependsOn = ["absent"];
      const missingReport = inspectEvidence(missing2, asOf);
      assert.equal(missingReport.valid, true);
      assert.equal(missingReport.facts[0].status, "MISSING");
      assert.equal(missingReport.issues[0].code, "MISSING_DEPENDENCY");
      const cyclic = bundle();
      cyclic.facts[0].dependsOn = ["derived"];
      cyclic.facts.push({ id: "derived", sourceId: "source", value: 1, dependsOn: ["reading"] });
      const cycleReport = inspectEvidence(cyclic, asOf);
      assert.equal(cycleReport.valid, false);
      assert.ok(cycleReport.facts.every((fact) => fact.status === "INVALID"));
      assert.equal(cycleReport.issues[0].code, "DEPENDENCY_CYCLE");
    });
    test("availability propagates through lineage and expires exactly at the declared boundary", () => {
      const value = bundle();
      value.facts[0].expiresAt = asOf;
      value.facts.push({ id: "derived", sourceId: "source", value: 84, dependsOn: ["reading"] });
      const result = inspectEvidence(value, asOf);
      assert.equal(result.valid, true);
      assert.ok(result.facts.every((fact) => fact.status === "EXPIRED"));
      assert.ok(result.facts.find((fact) => fact.id === "derived").reasons.includes("DEPENDENCY_UNAVAILABLE:reading"));
    });
    test("conflicting live claim records are distinct from malformed duplicate IDs", () => {
      const value = bundle();
      value.facts[0].claimId = "temperature";
      value.facts.push({ id: "other-reading", sourceId: "source", value: 39, claimId: "temperature" });
      const result = inspectEvidence(value, asOf);
      assert.equal(result.valid, true);
      assert.ok(result.facts.every((fact) => fact.status === "CONFLICT"));
      assert.equal(result.issues[0].code, "CONFLICTING_CLAIM");
      value.facts[1].expiresAt = asOf;
      assert.equal(inspectEvidence(value, asOf).facts.find((fact) => fact.id === "reading").status, "AVAILABLE");
    });
    test("future records and dangling sources cannot become available facts", () => {
      const value = bundle();
      value.facts[0].observedAt = "2026-09-30T00:00:00Z";
      assert.equal(inspectEvidence(value, asOf).facts[0].status, "FUTURE");
      delete value.facts[0].observedAt;
      value.facts[0].sourceId = "missing";
      assert.equal(inspectEvidence(value, asOf).facts[0].status, "MISSING");
    });
    test("dense cycles produce one component diagnostic and bounded per-edge reasons", () => {
      const ids = Array.from({ length: 100 }, (_, i) => `fact-${i}`);
      const value = { sources: [{ id: "source" }], facts: ids.map((id) => ({ id, sourceId: "source", value: true, dependsOn: ids })) };
      assert.equal(ids.length ** 2, EVIDENCE_LIMITS.dependencies);
      const result = inspectEvidence(value, asOf);
      assert.equal(result.valid, false);
      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].code, "DEPENDENCY_CYCLE");
      assert.equal(result.issues[0].factIds.length, ids.length);
      assert.ok(result.facts.every((fact) => fact.status === "INVALID" && fact.reasons.length === ids.length + 1));
    });
    test("graph limits refuse before building graph diagnostics, including missing edges", () => {
      const ids = Array.from({ length: 101 }, (_, i) => `fact-${i}`);
      const value = { sources: [{ id: "source" }], facts: ids.map((id) => ({ id, sourceId: "source", value: true, dependsOn: ids })) };
      const result = inspectEvidence(value, asOf);
      assert.equal(result.valid, false);
      assert.deepEqual(result.issues.map((issue) => issue.code), ["EVIDENCE_LIMIT"]);
      assert.deepEqual(result.facts, []);
      assert.deepEqual(result.lineage, []);
      assert.deepEqual(result.sources, []);
      value.facts = [{ id: "only", sourceId: "source", value: true, dependsOn: Array.from({ length: EVIDENCE_LIMITS.dependencies + 1 }, (_, i) => `missing-${i}`) }];
      assert.equal(inspectEvidence(value, asOf).issues[0].code, "EVIDENCE_LIMIT");
      value.facts = Array.from({ length: EVIDENCE_LIMITS.facts + 1 }, (_, i) => ({ id: `fact-${i}`, sourceId: "source", value: true }));
      assert.equal(inspectEvidence(value, asOf).issues[0].code, "EVIDENCE_LIMIT");
    });
    test("a thousand-fact reverse-ordered chain propagates the strongest unavailable status", () => {
      const value = { sources: [{ id: "source" }], facts: Array.from({ length: 1e3 }, (_, i) => ({
        id: `fact-${i}`,
        sourceId: "source",
        value: true,
        ...i < 999 ? { dependsOn: [`fact-${i + 1}`] } : { expiresAt: asOf }
      })) };
      const result = inspectEvidence(value, asOf);
      assert.equal(result.valid, true);
      assert.equal(result.issues.length, 1);
      assert.ok(result.facts.every((fact) => fact.status === "EXPIRED"));
      assert.deepEqual(result.facts.find((fact) => fact.id === "fact-0").reasons, ["DEPENDENCY_UNAVAILABLE:fact-1"]);
    });
    test("cycle components exclude downstream facts, which become invalid through lineage", () => {
      const value = { sources: [{ id: "source" }], facts: [
        { id: "a", sourceId: "source", value: true, dependsOn: ["b"] },
        { id: "b", sourceId: "source", value: true, dependsOn: ["a"] },
        { id: "self", sourceId: "source", value: true, dependsOn: ["self"] },
        { id: "downstream", sourceId: "source", value: true, dependsOn: ["a", "self"] },
        { id: "independent", sourceId: "source", value: true }
      ] };
      const result = inspectEvidence(value, asOf);
      assert.deepEqual(result.issues.filter((issue) => issue.code === "DEPENDENCY_CYCLE").map((issue) => issue.factIds).sort(), [["a", "b"], ["self"]]);
      const downstream = result.facts.find((fact) => fact.id === "downstream");
      assert.equal(downstream.status, "INVALID");
      assert.deepEqual(downstream.reasons, ["DEPENDENCY_UNAVAILABLE:a", "DEPENDENCY_UNAVAILABLE:self"]);
      assert.equal(result.facts.find((fact) => fact.id === "independent").status, "AVAILABLE");
    });
    test("bounded graph traversal agrees with an independent reachability oracle", () => {
      let seed = 20261002;
      const next = () => {
        seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
        return seed;
      };
      for (let trial = 0; trial < 64; trial++) {
        const size = 12;
        const edges = Array.from({ length: size }, () => Array.from({ length: size }, () => next() % 13 === 0));
        const reaches = edges.map((row) => [...row]);
        for (let k = 0; k < size; k++)
          for (let i = 0; i < size; i++)
            for (let j = 0; j < size; j++) {
              reaches[i][j] ||= reaches[i][k] && reaches[k][j];
            }
        const value = { sources: [{ id: "source" }], facts: edges.map((row, i) => ({
          id: String(i),
          sourceId: "source",
          value: true,
          dependsOn: row.flatMap((present, j) => present ? [String(j)] : []),
          ...i === 0 ? { expiresAt: asOf } : {}
        })) };
        const result = inspectEvidence(value, asOf);
        for (let i = 0; i < size; i++) {
          const invalid = reaches[i].some((reachable, j) => reachable && reaches[j][j]);
          const expected = invalid ? "INVALID" : i === 0 || reaches[i][0] ? "EXPIRED" : "AVAILABLE";
          assert.equal(result.facts.find((fact) => fact.id === String(i)).status, expected, `trial ${trial}, fact ${i}`);
        }
        const cycleMembers = result.issues.filter((issue) => issue.code === "DEPENDENCY_CYCLE").flatMap((issue) => issue.factIds);
        assert.equal(cycleMembers.length, new Set(cycleMembers).size);
        assert.deepEqual(cycleMembers.sort(), reaches.flatMap((row, i) => row[i] ? [String(i)] : []).sort());
      }
    });
    test("claim conflicts use individual availability before dependency propagation", () => {
      const value = { sources: [{ id: "source" }], facts: [
        { id: "expired", sourceId: "source", value: 0, expiresAt: asOf },
        { id: "current", sourceId: "source", value: 1, claimId: "claim" },
        { id: "derived", sourceId: "source", value: 2, claimId: "claim", dependsOn: ["expired"] },
        { id: "old-claim", sourceId: "source", value: 3, claimId: "claim", expiresAt: asOf }
      ] };
      const result = inspectEvidence(value, asOf);
      assert.deepEqual(result.issues.find((issue) => issue.code === "CONFLICTING_CLAIM").factIds, ["current", "derived"]);
      assert.equal(result.facts.find((fact) => fact.id === "old-claim").status, "EXPIRED");
    });
  }
});

// dist/tests/inference-adequacy-adversarial.test.js
import test2 from "node:test";
import assert2 from "node:assert/strict";
function decoyDefinition(includeDecoy = true) {
  const config = {
    modelId: "reconstructed-decoy-regression",
    budget: 4,
    observationAssumption: "conditionally-independent-given-hypothesis-and-experiment",
    hypotheses: [{ id: "active-a", prior: 0.5 }, { id: "active-b", prior: 0.5 }],
    experiments: [{ id: "probe", cost: 1, outcomes: ["positive", "negative"], likelihoods: {
      "active-a": { positive: 0.1, negative: 0.9 },
      "active-b": { positive: 0.1, negative: 0.9 }
    } }]
  };
  if (includeDecoy) {
    config.hypotheses.push({ id: "zero-prior-decoy", prior: 0 });
    config.experiments[0].likelihoods["zero-prior-decoy"] = { positive: 1, negative: 0 };
  }
  return config;
}
var options, observations;
var init_inference_adequacy_adversarial_test = __esm({
  "dist/tests/inference-adequacy-adversarial.test.js"() {
    init_inference();
    init_run();
    options = { alpha: 0.05, epochId: "b1-decoy" };
    observations = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, experimentId: "probe", outcome: "positive" }));
    test2("B1: a zero-prior decoy cannot keep an inadequate active family AVAILABLE", () => {
      const receipt = runRequest({
        kind: "discovery",
        definition: decoyDefinition(),
        observations,
        adequacy: options,
        actions: [{ id: "ship", losses: { "active-a": 0, "active-b": 0, "zero-prior-decoy": 100 } }]
      });
      const result = receipt.result;
      assert2.equal(result.snapshot.posterior["zero-prior-decoy"], 0);
      assert2.equal(result.adequacy.status, "REJECTED_DECLARED_FAMILY");
      assert2.ok(Math.abs(result.adequacy.logEValue - Math.log(35 / 128 / 1e-4)) < 1e-13);
      assert2.equal(result.adequacy.firstCrossingSequence, 2);
      assert2.equal(result.decisionStatus, "DEFER");
      assert2.equal(result.action, null);
      assert2.deepEqual(result.recommendation, { status: "stop", reason: "declared-family-rejected" });
    });
    test2("adding excluded laws leaves the adequacy statistics unchanged and records their exclusion", () => {
      const base = new FamilyAdequacyMonitor(decoyDefinition(false), options);
      const decoy = new FamilyAdequacyMonitor(decoyDefinition(), options);
      for (const observation of observations) {
        base.observe(base.prepare(observation.id, observation.experimentId), observation.outcome);
        decoy.observe(decoy.prepare(observation.id, observation.experimentId), observation.outcome);
        const actual = decoy.snapshot();
        const expected = base.snapshot();
        for (const field of [
          "status",
          "logEValue",
          "maxLogEValue",
          "firstCrossingSequence",
          "nullLogLikelihoods",
          "effectiveNullLaws",
          "alternativeLogLikelihood"
        ]) {
          assert2.deepEqual(actual[field], expected[field], field);
        }
      }
      const snapshot = decoy.snapshot();
      assert2.equal(snapshot.schemaVersion, ADEQUACY_SCHEMA_VERSION);
      assert2.equal(snapshot.supportPolicy, ADEQUACY_SUPPORT_POLICY);
      assert2.deepEqual(snapshot.nullHypothesisIds, ["active-a", "active-b"]);
      assert2.deepEqual(snapshot.excludedZeroPriorHypothesisIds, ["zero-prior-decoy"]);
      assert2.equal(snapshot.nullSemantics, "frozen-positive-prior-conditional-bernoulli-laws");
      assert2.notEqual(snapshot.definitionHash, base.snapshot().definitionHash);
      assert2.notEqual(snapshot.chainAnchorHash, base.snapshot().chainAnchorHash);
    });
    test2("all strictly positive prior laws remain admitted, independent of prior magnitude", () => {
      const definition2 = decoyDefinition();
      definition2.hypotheses[0].prior = 0.5;
      definition2.hypotheses[1].prior = 0.5 - Number.EPSILON;
      definition2.hypotheses[2].prior = Number.EPSILON;
      const monitor = new FamilyAdequacyMonitor(definition2, options);
      for (const observation of observations)
        monitor.observe(monitor.prepare(observation.id, observation.experimentId), observation.outcome);
      assert2.equal(monitor.snapshot().status, "NOT_REJECTED");
      assert2.deepEqual(monitor.snapshot().nullHypothesisIds, ["active-a", "active-b", "zero-prior-decoy"]);
      assert2.deepEqual(monitor.snapshot().excludedZeroPriorHypothesisIds, []);
      assert2.ok(Math.abs(monitor.snapshot().logEValue - Math.log(35 / 128)) < 1e-13);
    });
    test2("zero support is determined by the active family even when an excluded law predicts the outcome", () => {
      const definition2 = decoyDefinition();
      for (const id of ["active-a", "active-b"])
        definition2.experiments[0].likelihoods[id] = { positive: 0, negative: 1 };
      const monitor = new FamilyAdequacyMonitor(definition2, options);
      const receipt = monitor.observe(monitor.prepare("impossible", "probe"), "positive");
      assert2.equal(receipt.status, "ZERO_SUPPORT_CONTRADICTION");
      assert2.equal(receipt.eValueState, "infinite-zero-support");
      assert2.deepEqual(receipt.impossibleHypothesisIds, ["active-a", "active-b"]);
      assert2.throws(() => monitor.prepare("after-contradiction", "probe"), /zero support contradiction/);
      const run = runRequest({
        kind: "discovery",
        definition: definition2,
        adequacy: options,
        observations: [{ id: "impossible", experimentId: "probe", outcome: "positive" }]
      });
      const result = run.result;
      assert2.equal(result.decisionStatus, "DEFER");
      assert2.equal(result.action, null);
      assert2.equal(result.adequacy.status, "ZERO_SUPPORT_CONTRADICTION");
    });
    test2("the admitted support is fixed before outcomes and cannot change through caller mutation", () => {
      const definition2 = decoyDefinition();
      const monitor = new FamilyAdequacyMonitor(definition2, options);
      definition2.hypotheses[2].prior = 1;
      const prepared = monitor.prepare("one", "probe");
      assert2.ok(Object.isFrozen(prepared.nullHypothesisIds));
      assert2.ok(Object.isFrozen(prepared.excludedZeroPriorHypothesisIds));
      const forged = structuredClone(prepared);
      forged.nullHypothesisIds.push("zero-prior-decoy");
      const { hash: _hash, ...body } = forged;
      forged.hash = hashJSON(body);
      assert2.throws(() => monitor.observe(forged, "positive"), /verification failed/);
      assert2.equal(monitor.snapshot().observationCount, 0);
      monitor.observe(prepared, "positive");
      const snapshot = monitor.snapshot();
      snapshot.nullHypothesisIds.push("zero-prior-decoy");
      assert2.deepEqual(monitor.snapshot().nullHypothesisIds, ["active-a", "active-b"]);
    });
    test2("v2 adequacy replay binds the support contract and refuses v1 receipts", () => {
      const definition2 = decoyDefinition();
      const monitor = new FamilyAdequacyMonitor(definition2, options);
      for (const observation of observations)
        monitor.observe(monitor.prepare(observation.id, observation.experimentId), observation.outcome);
      const snapshot = monitor.snapshot();
      assert2.deepEqual(replayFamilyAdequacy(definition2, options, snapshot.receipts).snapshot(), snapshot);
      assert2.deepEqual(replayFamilyAdequacy(definition2, options, [], currentAdequacyRuntime()).snapshot().nullHypothesisIds, ["active-a", "active-b"]);
      const changed = structuredClone(snapshot.receipts);
      changed[0].excludedZeroPriorHypothesisIds = [];
      const { hash: _hash, ...body } = changed[0];
      changed[0].hash = hashJSON(body);
      assert2.throws(() => replayFamilyAdequacy(definition2, options, changed), /verification failed/);
      const old = structuredClone(snapshot.receipts);
      Object.assign(old[0], { schemaVersion: 1 });
      assert2.throws(() => replayFamilyAdequacy(definition2, options, old), /schema mismatch/);
    });
  }
});

// dist/tests/inference-scope.test.js
import test3 from "node:test";
import assert3 from "node:assert/strict";
function input(outcomes = ["yes", "no"], monitored = true, count = 1, hypotheses = 2) {
  const ids = Array.from({ length: hypotheses }, (_, i) => `h${i}`);
  return {
    kind: "discovery",
    definition: {
      modelId: "adequacy-scope",
      budget: 5e3,
      observationAssumption: "conditionally-independent-given-hypothesis-and-experiment",
      hypotheses: ids.map((id) => ({ id, prior: 1 / hypotheses })),
      experiments: [{
        id: "probe",
        cost: 1,
        outcomes,
        likelihoods: Object.fromEntries(ids.map((id) => [id, Object.fromEntries(outcomes.map((outcome) => [outcome, 1 / outcomes.length]))]))
      }]
    },
    observations: Array.from({ length: count }, (_, i) => ({ id: `o${i}`, experimentId: "probe", outcome: outcomes[i % outcomes.length] })),
    ...monitored ? { adequacy: { alpha: 0.05, epochId: "scope" } } : {},
    actions: [{ id: "act", losses: Object.fromEntries(ids.map((id) => [id, 0])) }]
  };
}
var init_inference_scope_test = __esm({
  "dist/tests/inference-scope.test.js"() {
    init_fs();
    init_canonical();
    init_inference();
    init_package_root();
    init_strict_json();
    init_run();
    test3("Original regression B1 fixtures both DEFER and suppress actions", () => {
      for (const name of ["with-zero-prior", "without-zero-prior"]) {
        const raw2 = readFileSync2(packagePath("tests", "fixtures", "regression", "adequacy", `${name}.json`), "utf8");
        const result = runRequest(parseStrictJson(raw2)).result;
        assert3.equal(result.adequacy.status, "REJECTED_DECLARED_FAMILY", name);
        assert3.equal(result.decisionStatus, "DEFER", name);
        assert3.equal(result.action, null, name);
      }
    });
    test3("omitted adequacy is explicitly NOT_EVALUATED and cannot suggest an integrated action", () => {
      const result = runRequest(input(["yes", "no"], false)).result;
      assert3.equal(result.adequacy.status, "NOT_EVALUATED");
      assert3.match(result.adequacy.reason, /not requested/);
      assert3.equal(result.decisionStatus, "DEFER");
      assert3.equal(result.action, null);
      assert3.equal(result.recommendation.reason, "adequacy-not-evaluated");
      assert3.deepEqual(result.snapshot.posterior, { h0: 0.5, h1: 0.5 });
      assert3.equal(result.snapshot.receipts.length, 1);
    });
    test3("a valid three-outcome discovery is UNSUPPORTED for adequacy, while retaining its conditional posterior", () => {
      const result = runRequest(input(["yes", "no", "other"])).result;
      assert3.equal(result.adequacy.status, "UNSUPPORTED");
      assert3.deepEqual(result.adequacy.unsupportedExperimentIds, ["probe"]);
      assert3.equal(result.decisionStatus, "DEFER");
      assert3.equal(result.action, null);
      assert3.equal(result.recommendation.reason, "adequacy-unsupported");
      assert3.deepEqual(result.snapshot.posterior, { h0: 0.5, h1: 0.5 });
      assert3.equal(result.snapshot.receipts.length, 1);
      const malformed = input(["yes", "no", "other"]);
      malformed.adequacy.alpha = 0;
      assert3.throws(() => runRequest(malformed), /alpha/);
    });
    test3("a supported nonrejected monitor retains model-conditional action suggestions", () => {
      const result = runRequest(input()).result;
      assert3.equal(result.adequacy.status, "NOT_REJECTED");
      assert3.equal(result.decisionStatus, "AVAILABLE");
      assert3.ok(result.action);
    });
    test3("receipt budget refuses oversize observation chains before inference and scales with family size", () => {
      assert3.throws(() => validateInput(input(["yes", "no"], true, 1100)), /DISCOVERY_RECEIPT_LIMIT/);
      assert3.doesNotThrow(() => validateInput(input(["yes", "no"], true, 100)));
      assert3.throws(() => validateInput(input(["yes", "no"], true, 200, 100)), /DISCOVERY_RECEIPT_LIMIT/);
      assert3.throws(() => validateInput(input(["yes", "no"], false, 5001)), /at most 5000/);
    });
    test3("largest admitted chains fit canonical receipt limits with and without adequacy", () => {
      for (const monitored of [false, true]) {
        let low = 0, high = 5e3;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          try {
            validateInput(input(["yes", "no"], monitored, middle));
            low = middle;
          } catch (error) {
            assert3.match(String(error), /DISCOVERY_RECEIPT_LIMIT/);
            high = middle - 1;
          }
        }
        assert3.ok(low > 0 && low < 5e3);
        const receipt = runRequest(input(["yes", "no"], monitored, low));
        const encoded = canonicalize(receipt);
        const count = (value) => value !== null && typeof value === "object" ? 1 + Object.values(value).reduce((sum, child) => sum + count(child), 0) : 1;
        assert3.ok(count(JSON.parse(encoded)) <= CANONICAL_MAX_NODES);
        assert3.ok(Buffer.byteLength(JSON.stringify(receipt, null, 2), "utf8") <= CANONICAL_MAX_BYTES);
        assert3.throws(() => validateInput(input(["yes", "no"], monitored, low + 1)), /DISCOVERY_RECEIPT_LIMIT/);
      }
    });
    test3("long identifier amplification is refused before inference in integrated and low-level APIs", () => {
      const request2 = input(["yes", "no"], true, 100);
      const ids = ["a".repeat(2e4), "b".repeat(2e4)];
      request2.definition.hypotheses = ids.map((id) => ({ id, prior: 0.5 }));
      request2.definition.experiments[0].likelihoods = Object.fromEntries(ids.map((id) => [id, { yes: 0.5, no: 0.5 }]));
      delete request2.actions;
      assert3.ok(Buffer.byteLength(JSON.stringify(request2), "utf8") < 1e5);
      assert3.throws(() => validateInput(request2), /DISCOVERY_IDENTIFIER_LIMIT/);
      assert3.throws(() => new DiscoverySession(request2.definition), /DISCOVERY_IDENTIFIER_LIMIT/);
      assert3.throws(() => new FamilyAdequacyMonitor(input().definition, { alpha: 0.05, epochId: "x".repeat(257) }), /DISCOVERY_IDENTIFIER_LIMIT/);
    });
    test3("byte preflight accounts for escaped and multibyte identifiers in repeated receipt fields", () => {
      const request2 = input(["yes", "no"], true, 1);
      const ids = ["a" + "".repeat(255), "b" + "漢".repeat(255)];
      const outcomes = ["x" + "".repeat(255), "y" + "龍".repeat(255)];
      const experimentId = "e" + "".repeat(255);
      request2.definition.modelId = "m" + "字".repeat(255);
      request2.definition.hypotheses = ids.map((id) => ({ id, prior: 0.5 }));
      request2.definition.experiments = [{
        id: experimentId,
        cost: 1,
        outcomes,
        likelihoods: Object.fromEntries(ids.map((id) => [id, Object.fromEntries(outcomes.map((outcome) => [outcome, 0.5]))]))
      }];
      request2.adequacy.epochId = "z" + "".repeat(255);
      request2.actions = [{ id: "a" + "".repeat(255), losses: Object.fromEntries(ids.map((id) => [id, 0])) }];
      let admitted = 0;
      for (let length = 1; length <= 100; length++) {
        request2.observations = Array.from({ length }, (_, i) => ({ id: String(i).padEnd(256, ""), experimentId, outcome: outcomes[i % 2] }));
        try {
          validateInput(request2);
          admitted = length;
        } catch (error) {
          assert3.match(String(error), /DISCOVERY_RECEIPT_LIMIT/);
          break;
        }
      }
      assert3.ok(admitted > 0 && admitted < 100);
      request2.observations = request2.observations.slice(0, admitted);
      const receipt = runRequest(request2);
      assert3.ok(Buffer.byteLength(JSON.stringify(receipt, null, 2), "utf8") <= CANONICAL_MAX_BYTES);
    });
  }
});

// dist/tests/inference.test.js
import test4 from "node:test";
import assert4 from "node:assert/strict";
import { createHash as createHash4 } from "node:crypto";
function definition() {
  return {
    modelId: "component-diagnostic-v1",
    budget: 10,
    observationAssumption: "conditionally-independent-given-hypothesis-and-experiment",
    hypotheses: [{ id: "faulty", prior: 0.2 }, { id: "healthy", prior: 0.8 }],
    experiments: [{ id: "test", cost: 1, outcomes: ["positive", "negative"], likelihoods: {
      faulty: { positive: 0.9, negative: 0.1 },
      healthy: { positive: 0.1, negative: 0.9 }
    } }]
  };
}
function near(actual, expected, tolerance = 1e-14) {
  assert4.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}
var init_inference_test = __esm({
  "dist/tests/inference.test.js"() {
    init_inference();
    test4("Bayes matches hand-derived odds and expected-loss decisions", () => {
      const session = new DiscoverySession(definition());
      session.observe({ id: "one", experimentId: "test", outcome: "positive" });
      near(session.posterior().faulty, 9 / 13);
      session.observe({ id: "two", experimentId: "test", outcome: "positive" });
      near(session.posterior().faulty, 81 / 85);
      const action = session.chooseAction([
        { id: "repair", losses: { faulty: 1, healthy: 5 } },
        { id: "ignore", losses: { faulty: 20, healthy: 0 } }
      ]);
      assert4.equal(action.actionId, "repair");
      near(action.expectedLoss, 101 / 85);
    });
    test4("perfect test yields log(2) nats; tie-break is stable lexical ID", () => {
      const config = definition();
      config.hypotheses.forEach((h) => h.prior = 0.5);
      config.experiments[0].likelihoods = { faulty: { positive: 1, negative: 0 }, healthy: { positive: 0, negative: 1 } };
      config.experiments.push({ ...structuredClone(config.experiments[0]), id: "a-test" });
      const session = new DiscoverySession(config);
      near(session.experimentUtilities()[0].expectedInformationGainNats, Math.log(2));
      const recommendation = session.recommend();
      assert4.equal(recommendation.status, "experiment");
      if (recommendation.status === "experiment")
        assert4.equal(recommendation.experimentId, "a-test");
    });
    test4("decimal budgets permit exactly three 0.1-cost observations", () => {
      const config = definition();
      config.budget = 0.3;
      config.experiments[0].cost = 0.1;
      const session = new DiscoverySession(config);
      for (let i = 0; i < 3; i++)
        session.observe({ id: String(i), experimentId: "test", outcome: "positive" });
      assert4.equal(session.remainingBudget(), 0);
      assert4.equal(session.snapshot().spent, 0.3);
      assert4.throws(() => session.observe({ id: "excess", experimentId: "test", outcome: "positive" }), /budget/);
    });
    test4("input and receipt mutations cannot change an active session; duplicate evidence is rejected", () => {
      const config = definition();
      const session = new DiscoverySession(config);
      config.hypotheses[0].prior = 1;
      const receipt = session.observe({ id: "one", experimentId: "test", outcome: "positive" });
      receipt.posterior.faulty = 0;
      near(session.posterior().faulty, 9 / 13);
      near(session.snapshot().receipts[0].posterior.faulty, 9 / 13);
      assert4.throws(() => session.observe({ id: "one", experimentId: "test", outcome: "positive" }), /Duplicate/);
      assert4.equal(session.snapshot().spent, 1);
    });
    test4("zero support halts action recommendation and preserves explicit mismatch", () => {
      const config = definition();
      config.experiments[0].likelihoods = { faulty: { positive: 1, negative: 0 }, healthy: { positive: 1, negative: 0 } };
      const session = new DiscoverySession(config);
      const receipt = session.observe({ id: "impossible", experimentId: "test", outcome: "negative" });
      assert4.equal(receipt.status, "model-mismatch");
      assert4.equal(receipt.priorPredictiveLogProbability, null);
      assert4.deepEqual(session.recommend(), { status: "stop", reason: "model-mismatch" });
      assert4.throws(() => session.chooseAction([{ id: "act", losses: { faulty: 0, healthy: 0 } }]), /mismatch/);
    });
    test4("exact replay rejects tampering even when the attacker recomputes a hash", () => {
      const config = definition();
      const session = new DiscoverySession(config);
      session.observe({ id: "one", experimentId: "test", outcome: "positive" });
      const receipts = session.snapshot().receipts;
      assert4.deepEqual(replaySession(config, receipts).snapshot(), session.snapshot());
      const tampered = structuredClone(receipts);
      tampered[0].posterior.faulty = 0.7;
      const { hash: _hash, ...body } = tampered[0];
      tampered[0].hash = hashJSON(body);
      assert4.throws(() => replaySession(config, tampered), /verification failed/);
    });
    test4("runtime mismatch is refused while numerical comparison disclaims exact verification", () => {
      const config = definition();
      const session = new DiscoverySession(config);
      session.observe({ id: "one", experimentId: "test", outcome: "positive" });
      const receipts = session.snapshot().receipts;
      receipts[0].runtime.architecture = "different-architecture";
      assert4.throws(() => replaySession(config, receipts), /runtime mismatch/);
      const comparison = compareReceiptNumerics(config, receipts, { absoluteTolerance: 0, relativeTolerance: 0 });
      assert4.equal(comparison.withinTolerance, true);
      assert4.equal(comparison.exactReplayVerified, false);
      assert4.throws(() => replaySession(config, []), /runtime contract/);
      assert4.equal(replaySession(config, [], currentReplayRuntime()).snapshot().receipts.length, 0);
    });
    test4("finite JSON hashing is stable and refuses sparse/nonfinite values", () => {
      assert4.equal(canonicalJSON({ z: 2, a: 1 }), '{"a":1,"z":2}');
      assert4.equal(hashJSON({ z: 2, a: 1 }), createHash4("sha256").update('{"a":1,"z":2}').digest("hex"));
      assert4.throws(() => canonicalJSON([, 1]), /dense/);
      assert4.throws(() => canonicalJSON({ x: Infinity }), /finite/);
    });
    test4("adequacy e-value matches a closed-form prequential Bernoulli calculation", () => {
      const config = definition();
      config.experiments[0].likelihoods = { faulty: { positive: 0.5, negative: 0.5 }, healthy: { positive: 0.5, negative: 0.5 } };
      const options2 = { alpha: 0.5, epochId: "fixed-law-epoch" };
      const monitor = new FamilyAdequacyMonitor(config, options2);
      for (let i = 0; i < 3; i++)
        monitor.observe(monitor.prepare(String(i), "test"), "positive");
      near(monitor.snapshot().logEValue, Math.log(2.5));
      assert4.equal(monitor.snapshot().status, "REJECTED_DECLARED_FAMILY");
      assert4.equal(monitor.snapshot().firstCrossingSequence, 3);
      assert4.deepEqual(replayFamilyAdequacy(config, options2, monitor.snapshot().receipts).snapshot(), monitor.snapshot());
    });
    test4("adequacy preparation commits predictions before the outcome and rejects forged tokens", () => {
      const monitor = new FamilyAdequacyMonitor(definition(), { alpha: 0.05, epochId: "epoch" });
      const prepared = monitor.prepare("one", "test");
      assert4.ok(Object.isFrozen(prepared.alternativeProbabilities));
      assert4.throws(() => monitor.prepare("two", "test"), /pending/);
      const forged = structuredClone(prepared);
      forged.alternativeProbabilities.positive = 0.9;
      assert4.throws(() => monitor.observe(forged, "positive"), /verification failed/);
      assert4.equal(monitor.snapshot().observationCount, 0);
      monitor.observe(prepared, "positive");
      assert4.equal(monitor.snapshot().observationCount, 1);
      assert4.equal(monitor.snapshot().status, "NOT_REJECTED");
    });
  }
});

// dist/tests/ingress.test.js
import test5 from "node:test";
import assert5 from "node:assert/strict";
var init_ingress_test = __esm({
  "dist/tests/ingress.test.js"() {
    init_server();
    init_run();
    init_receipt();
    init_examples();
    test5("format endpoint refuses ambiguous keys and numbers before changing editable input", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert5.ok(address && typeof address === "object");
      const post = (body, path = "/api/format") => fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      try {
        const valid = await post('{"amount":0.10,"rows":[{"x":1},{"x":2}]}');
        assert5.equal(valid.status, 200);
        assert5.deepEqual(JSON.parse((await valid.json()).formatted), { amount: 0.1, rows: [{ x: 1 }, { x: 2 }] });
        for (const [raw2, code2] of [
          ['{"status":"ALLOW","status":"DEFER"}', "DUPLICATE_JSON_KEY"],
          ['{"amount":9007199254740993}', "NUMBER_NOT_ROUNDTRIPPABLE"],
          ['{"amount":0.10000000000000001}', "NUMBER_NOT_ROUNDTRIPPABLE"]
        ]) {
          const result = await post(raw2);
          assert5.equal(result.status, 400);
          const error = await result.json();
          assert5.equal(error.code, code2);
          assert5.equal(error.formatted, void 0);
        }
        const invalid = Uint8Array.from([123, 34, 120, 34, 58, 34, 192, 175, 34, 125]);
        for (const endpoint of ["/api/run", "/api/verify", "/api/format"])
          assert5.equal((await post(invalid, endpoint)).status, 400);
        assert5.equal((await post("\uFEFF{}")).status, 400);
        const malformedEnvelope = await post('{"receipt":{"x":1,"x":2},"expectedDigest":"' + "a".repeat(64) + '"}', "/api/verify");
        const refused = await malformedEnvelope.json();
        assert5.equal(refused.valid, false);
        assert5.equal(refused.anchoring, "NOT_CHECKED");
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
    test5("early receipt refusal cannot label a supplied anchor as absent or matched", () => {
      const input3 = getExample("release-deferred");
      const run = runRequest(input3);
      const policy2 = createReceipt({ policy: input3.policy, evidence: input3.evidence, asOf: input3.asOf, environment: captureEnvironment() });
      assert5.equal(verifyRunText('{"x":1,"x":2}', run.digest).anchoring, "MISMATCH");
      assert5.equal(verifyRunText('{"x":1,"x":2}').anchoring, "UNANCHORED");
      assert5.equal(verifyReceiptText('{"x":1,"x":2}', { trustedDigest: policy2.digest }).anchoring, "MISMATCH");
      assert5.equal(verifyReceiptText('{"x":1,"x":2}').anchoring, "UNANCHORED");
    });
  }
});

// dist/tests/integration-adversarial.test.js
import test6 from "node:test";
import assert6 from "node:assert/strict";
import { request as httpRequest } from "node:http";
function rehash(receipt) {
  const { digest: _digest, ...body } = receipt;
  return { ...body, digest: sha256(body) };
}
var declaration;
var init_integration_adversarial_test = __esm({
  "dist/tests/integration-adversarial.test.js"() {
    init_child_process();
    init_package_root();
    init_run();
    init_canonical();
    init_server();
    declaration = () => ({ kind: "policy", asOf: "2026-10-02T00:00:00Z", policy: { id: "adversarial", version: "1", rules: [{ id: "rule", factId: "fact", op: "eq", value: true }] }, evidence: { sources: [{ id: "source" }], facts: [{ id: "fact", sourceId: "source", value: false }] } });
    test6("receipt verification refuses changed runtime or source artifact even with recomputed digest", () => {
      const receipt = runRequest(declaration());
      for (const field of ["node", "v8", "platform", "architecture", "endianness", "sourceDigest", "codeDigest", "implementation"]) {
        const changed = structuredClone(receipt);
        changed.runtime[field] = "attacker-value";
        const verification = verifyRun(rehash(changed));
        assert6.equal(verification.valid, false, field);
        assert6.equal(verification.integrity, "VALID", field);
        assert6.equal(verification.replay, "UNSUPPORTED", field);
      }
    });
    test6("a freshly recomputed digest does not hide a false result", () => {
      const receipt = runRequest(declaration());
      receipt.result.verdict = "ALLOW";
      assert6.equal(verifyRun(receipt).integrity, "INVALID");
      const verification = verifyRun(rehash(receipt));
      assert6.equal(verification.integrity, "VALID");
      assert6.equal(verification.replay, "MISMATCH");
      assert6.equal(verification.valid, false);
    });
    test6("self-consistent replacement passes unanchored replay but fails the original external digest", () => {
      const original = runRequest(declaration());
      const alteredInput = declaration();
      alteredInput.evidence.facts[0].value = true;
      const replacement = runRequest(alteredInput);
      const unanchored = verifyRun(replacement);
      assert6.equal(unanchored.valid, true);
      assert6.equal(unanchored.anchoring, "UNANCHORED");
      assert6.match(unanchored.reason, /not origin or historical completeness/);
      const anchored = verifyRun(replacement, original.digest);
      assert6.equal(anchored.valid, false);
      assert6.equal(anchored.anchoring, "MISMATCH");
      assert6.equal(verifyRun(original, original.digest).anchoring, "MATCH");
    });
    test6("wrong top-level kind, unknown fields and malformed digest are refused", () => {
      const changed = runRequest(declaration());
      changed.kind = "discovery";
      assert6.equal(verifyRun(rehash(changed)).replay, "MISMATCH");
      assert6.equal(verifyRun({ ...runRequest(declaration()), extra: true }).valid, false);
      assert6.equal(verifyRun(runRequest(declaration()), "not-a-sha256").valid, false);
      assert6.throws(() => validateInput({ ...declaration(), extra: true }), /unknown field/);
      assert6.throws(() => validateInput({ kind: "unrecognized" }), /Input kind/);
      const { asOf: _asOf, ...missingTime } = declaration();
      assert6.throws(() => validateInput(missingTime), /missing asOf/);
    });
    test6("certain posterior and exact-zero likelihoods remain serializable and replayable", () => {
      const input3 = {
        kind: "discovery",
        definition: {
          modelId: "perfect-test",
          budget: 3,
          observationAssumption: "conditionally-independent-given-hypothesis-and-experiment",
          hypotheses: [{ id: "a", prior: 0.5 }, { id: "b", prior: 0.5 }],
          experiments: [{ id: "probe", cost: 1, outcomes: ["yes", "no"], likelihoods: { a: { yes: 1, no: 0 }, b: { yes: 0, no: 1 } } }]
        },
        observations: [{ id: "one", experimentId: "probe", outcome: "yes" }],
        adequacy: { alpha: 0.05, epochId: "perfect-laws" }
      };
      const receipt = runRequest(input3);
      assert6.equal(receipt.result.snapshot.entropyNats, 0);
      assert6.equal(verifyRun(receipt).valid, true);
    });
    test6("rejected model family cannot yield an expected-loss action", () => {
      const input3 = {
        kind: "discovery",
        definition: {
          modelId: "declared-fair-models",
          budget: 10,
          observationAssumption: "conditionally-independent-given-hypothesis-and-experiment",
          hypotheses: [{ id: "a", prior: 0.5 }, { id: "b", prior: 0.5 }],
          experiments: [{ id: "probe", cost: 1, outcomes: ["yes", "no"], likelihoods: { a: { yes: 0.5, no: 0.5 }, b: { yes: 0.5, no: 0.5 } } }]
        },
        observations: [0, 1, 2].map((i) => ({ id: String(i), experimentId: "probe", outcome: "yes" })),
        adequacy: { alpha: 0.5, epochId: "fair-laws" },
        actions: [{ id: "act", losses: { a: 0, b: 1 } }]
      };
      const result = runRequest(input3).result;
      assert6.equal(result.adequacy.status, "REJECTED_DECLARED_FAMILY");
      assert6.equal(result.action, null);
      assert6.equal(result.recommendation.status, "stop");
    });
    test6("HTTP boundary rejects foreign origin/host, malformed JSON and executable input", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = server.address().port;
      const address = `http://127.0.0.1:${port}`;
      try {
        assert6.equal((await fetch(address + "/api/run", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
        assert6.equal((await fetch(address + "/api/run", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://foreign.example" }, body: "{}" })).status, 403);
        assert6.equal((await fetch(address + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
        assert6.equal((await fetch(address + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "eval", code: "process.exit()" }) })).status, 400);
        const foreignHostStatus = await new Promise((resolve, reject) => {
          const req = httpRequest({ hostname: "127.0.0.1", port, path: "/api/health", headers: { Host: "foreign.example" } }, (res) => {
            res.resume();
            resolve(res.statusCode);
          });
          req.on("error", reject);
          req.end();
        });
        assert6.equal(foreignHostStatus, 403);
        assert6.equal((await fetch(address + "/src/run.ts")).status, 404);
        const valid = await fetch(address + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(declaration()) });
        assert6.equal(valid.status, 200);
        const receipt = await valid.json();
        const verification = await fetch(address + "/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, expectedDigest: receipt.digest }) });
        assert6.equal((await verification.json()).valid, true);
        assert6.match(valid.headers.get("content-security-policy"), /frame-ancestors 'none'/);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
    test6("CLI returns nonzero for missing input, unsupported command and invalid options", () => {
      const cli = packagePath("bin", "cosmic.mjs");
      for (const args of [["run"], ["unknown-command"], ["examples", "--expect", "abc"]]) {
        const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 5e3 });
        assert6.equal(result.status, 2, args.join(" "));
        assert6.match(result.stderr, /COSMIC:/);
      }
    });
  }
});

// dist/tests/integration.test.js
import { test as test7 } from "node:test";
import assert7 from "node:assert/strict";
import { tmpdir } from "node:os";
import { join as join3 } from "node:path";
var init_integration_test = __esm({
  "dist/tests/integration.test.js"() {
    init_run();
    init_examples();
    init_server();
    init_canonical();
    init_child_process();
    init_fs();
    init_package_root();
    test7("complete examples yield hand-calculated outputs", () => {
      const discovery = runRequest(getExample("sensor-investigation")).result;
      assert7.ok(Math.abs(discovery.snapshot.posterior.positive - 16 / 17) < 1e-14);
      assert7.equal(discovery.snapshot.remainingBudget, 4);
      assert7.equal(discovery.action.actionId, "investigate");
      assert7.equal(runRequest(getExample("release-authorization")).result.verdict, "ALLOW");
      assert7.equal(runRequest(getExample("release-deferred")).result.verdict, "DEFER");
      assert7.equal(runRequest(getExample("release-denied")).result.verdict, "DENY");
    });
    test7("every example roundtrips through exact replay with separate anchor status", () => {
      for (const example of listExamples()) {
        const receipt = JSON.parse(JSON.stringify(runRequest(example.input)));
        assert7.deepEqual(runRequest(example.input), receipt);
        assert7.equal(verifyRun(receipt).valid, true);
        assert7.equal(verifyRun(receipt).anchoring, "UNANCHORED");
        assert7.equal(verifyRun(receipt, receipt.digest).anchoring, "MATCH");
        assert7.equal(verifyRun(receipt, "f".repeat(64)).valid, false);
      }
    });
    test7("forged policy approval fails replay even after a new digest is computed", () => {
      const receipt = runRequest(getExample("release-denied"));
      receipt.result.verdict = "ALLOW";
      const { digest, ...payload } = receipt;
      receipt.digest = sha256(payload);
      const check = verifyRun(receipt);
      assert7.equal(check.integrity, "VALID");
      assert7.equal(check.replay, "MISMATCH");
      assert7.equal(check.valid, false);
    });
    test7("a retained envelope digest cannot anchor a changed payload", () => {
      const receipt = runRequest(getExample("release-denied"));
      const trusted2 = receipt.digest;
      receipt.result.verdict = "ALLOW";
      const result = verifyRun(receipt, trusted2);
      assert7.equal(result.valid, false);
      assert7.equal(result.integrity, "INVALID");
      assert7.equal(result.anchoring, "MISMATCH");
    });
    test7("runtime changes refuse exact replay instead of falling back to tolerance", () => {
      const receipt = runRequest(getExample());
      receipt.runtime.architecture = "different-arch";
      const { digest, ...payload } = receipt;
      receipt.digest = sha256(payload);
      assert7.equal(verifyRun(receipt).replay, "UNSUPPORTED");
    });
    test7("rejected model families suppress expected-loss action suggestions", () => {
      const input3 = getExample("sensor-investigation");
      input3.definition.budget = 20;
      input3.definition.experiments = [{ id: "probe", cost: 1, outcomes: ["1", "0"], likelihoods: { positive: { "1": 0.5, "0": 0.5 }, negative: { "1": 0.5, "0": 0.5 } } }];
      input3.observations = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, experimentId: "probe", outcome: "1" }));
      const result = runRequest(input3).result;
      assert7.equal(result.adequacy.status, "REJECTED_DECLARED_FAMILY");
      assert7.equal(result.decisionStatus, "DEFER");
      assert7.equal(result.action, null);
      assert7.equal(result.recommendation.reason, "declared-family-rejected");
    });
    test7("policy expiry is evaluated against explicit input time", () => {
      const input3 = getExample("release-authorization");
      input3.asOf = "2026-09-30T18:00:00.000Z";
      assert7.equal(runRequest(input3).result.verdict, "DEFER");
    });
    test7("CLI writes and verifies a portable receipt file and uses error exit codes", () => {
      const dir = (0, fs_exports.mkdtempSync)(join3(tmpdir(), "cosmic-test-"));
      const root = packageRoot;
      try {
        const path = join3(dir, "receipt.json");
        let run = spawnSync(process.execPath, ["bin/cosmic.mjs", "demo", "release-authorization", "--out", path], { cwd: root, encoding: "utf8" });
        assert7.equal(run.status, 0, run.stderr);
        const receipt = JSON.parse(readFileSync2(path, "utf8"));
        run = spawnSync(process.execPath, ["bin/cosmic.mjs", "verify", path, "--expect", receipt.digest], { cwd: root, encoding: "utf8" });
        assert7.equal(run.status, 0, run.stderr);
        assert7.equal(JSON.parse(run.stdout).valid, true);
        run = spawnSync(process.execPath, ["bin/cosmic.mjs", "verify", path, "--expect", "0".repeat(64)], { cwd: root, encoding: "utf8" });
        assert7.equal(run.status, 1);
        run = spawnSync(process.execPath, ["bin/cosmic.mjs", "run"], { cwd: root, encoding: "utf8" });
        assert7.equal(run.status, 2);
      } finally {
        (0, fs_exports.rmSync)(dir, { recursive: true, force: true });
      }
    });
    test7("local API runs examples, rejects malformed input and cross-origin requests", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert7.ok(address && typeof address === "object");
      const url = `http://127.0.0.1:${address.port}`;
      try {
        for (const [path, type] of [["/", "text/html"], ["/app.js", "text/javascript"], ["/styles.css", "text/css"]]) {
          const asset = await fetch(url + path);
          assert7.equal(asset.status, 200, path);
          assert7.ok(asset.headers.get("content-type")?.startsWith(type));
          assert7.ok((await asset.text()).length > 100);
        }
        const listing = await fetch(url + "/api/examples");
        assert7.equal(listing.status, 200);
        assert7.equal((await listing.json()).examples.length, listExamples().length);
        let response = await fetch(url + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(getExample("release-authorization")) });
        assert7.equal(response.status, 200);
        const receipt = await response.json();
        assert7.equal(receipt.result.verdict, "ALLOW");
        response = await fetch(url + "/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, expectedDigest: receipt.digest }) });
        assert7.equal((await response.json()).valid, true);
        response = await fetch(url + "/api/run", { method: "POST", headers: { "Content-Type": "application/json", "Origin": "https://example.invalid" }, body: "{}" });
        assert7.equal(response.status, 403);
        response = await fetch(url + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"kind":"unknown"}' });
        assert7.equal(response.status, 400);
        response = await fetch(url + "/../../package.json");
        assert7.equal(response.status, 404);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(() => resolve()));
      }
    });
  }
});

// dist/tests/numeric-json.test.js
import test8 from "node:test";
import assert8 from "node:assert/strict";
import { createHash as createHash5 } from "node:crypto";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join4 } from "node:path";
function request(op, actual, expected) {
  return `{"kind":"policy","asOf":"${asOf2}","policy":{"id":"reconstructed-b6","version":"1","rules":[{"id":"limit","factId":"number","op":"${op}","value":${expected}}]},"evidence":{"sources":[{"id":"declared"}],"facts":[{"id":"number","sourceId":"declared","value":${actual}}]}}`;
}
function rejects(raw2, expectedCode = code) {
  assert8.throws(() => parseStrictJson(raw2), (error) => error instanceof StrictJsonError && error.code === expectedCode, raw2.slice(0, 200));
}
var code, asOf2, numberRegressions;
var init_numeric_json_test = __esm({
  "dist/tests/numeric-json.test.js"() {
    init_fs();
    init_package_root();
    init_canonical();
    init_child_process();
    init_strict_json();
    init_policy();
    init_run();
    init_receipt();
    init_server();
    code = "NUMBER_NOT_ROUNDTRIPPABLE";
    asOf2 = "2026-10-02T00:00:00Z";
    test8("strict JSON retains ordinary decimals, safe boundaries and exactly equivalent spellings", () => {
      for (const raw2 of [
        "0",
        "0.000e99999999999999999999999999999999999",
        "0.1",
        "1.00e-1",
        "1e0",
        "1.2300",
        "-1.2300",
        "1E+0002",
        "9007199254740991",
        "-9007199254740991",
        "9007199254740991.0",
        "9.007199254740991e15",
        "-9.007199254740991e15",
        "5e-324",
        "2.2250738585072014e-308",
        '[{"n":0.1},{"n":1.00e-1}]',
        '{"9007199254740993":"0.10000000000000001"}'
      ])
        assert8.deepEqual(parseStrictJson(raw2), JSON.parse(raw2), raw2);
    });
    test8("strict JSON refuses exactly round-tripping integers outside the safe range at every depth", () => {
      for (const token of [
        "9007199254740992",
        "-9007199254740992",
        "9007199254740992.0",
        "9.007199254740992e15",
        "-9.007199254740992e15",
        "1e20",
        "-1E+00020",
        "1000000000000000100",
        "1.7976931348623157e308"
      ]) {
        rejects(token, "UNSAFE_INTEGER");
        rejects(`{"outer":[{"n":${token}}]}`, "UNSAFE_INTEGER");
      }
      for (const malformed of ["9007199254740992x", "9007199254740992.", "9007199254740992e", "09007199254740992"]) {
        rejects(malformed, "INVALID_JSON");
      }
    });
    test8("strict JSON refuses decimal collapse, underflow, overflow and negative zero at every depth", () => {
      for (const raw2 of [
        "9007199254740993",
        "-9007199254740993",
        "0.10000000000000001",
        "1.0000000000000001",
        "1e-400",
        "-1e-400",
        "4e-324",
        "1e309",
        "-1e309",
        "-0",
        "-0.000e1000000",
        "1e99999999999999999999999999999999999",
        "1e-99999999999999999999999999999999999",
        '{"rules":[{"value":{"nested":[0.10000000000000001]}}]}'
      ])
        rejects(raw2);
    });
    test8("numeric validation handles long bounded tokens without expanding huge exponents", () => {
      const zeroes = "0".repeat(1e5);
      assert8.equal(parseStrictJson("1" + zeroes + "e-100000"), 1);
      assert8.equal(parseStrictJson("1e+" + zeroes + "0"), 1);
      assert8.equal(parseStrictJson("0e" + "9".repeat(MAX_JSON_BYTES - 2)), 0);
      rejects("1e" + "9".repeat(MAX_JSON_BYTES - 2));
      rejects("1" + zeroes + "1e-100001");
    });
    test8("reconstructed B6 false ALLOW cases are refused before policy evaluation", () => {
      for (const [op, actual, expected] of [
        ["lte", "9007199254740993", "9007199254740992"],
        ["gte", "0.1", "0.10000000000000001"],
        ["eq", "9007199254740993", "9007199254740992"],
        ["eq", '{"nested":[0.10000000000000001]}', '{"nested":[0.1]}'],
        ["in", "0.10000000000000001", "[0.1]"]
      ]) {
        const raw2 = request(op, actual, expected);
        const materialized = JSON.parse(raw2);
        if (op === "lte" || op === "eq" && actual === "9007199254740993") {
          assert8.equal(materialized.policy.rules[0].value, materialized.evidence.facts[0].value);
          assert8.equal(evaluatePolicy(materialized.policy, materialized.evidence, asOf2).verdict, "ERROR");
          rejects(raw2, "UNSAFE_INTEGER");
        } else {
          assert8.equal(evaluatePolicy(materialized.policy, materialized.evidence, asOf2).verdict, "ALLOW");
          rejects(raw2);
        }
      }
      const ordinary = parseStrictJson(request("gte", "0.1", "0.100"));
      assert8.equal(evaluatePolicy(ordinary.policy, ordinary.evidence, asOf2).verdict, "ALLOW");
      const distinct = parseStrictJson(request("gte", "0.1", "0.10000000000000002"));
      assert8.equal(evaluatePolicy(distinct.policy, distinct.evidence, asOf2).verdict, "DENY");
    });
    numberRegressions = [
      { name: "bigint-eq", sha256: "fac169ecdc38c58affbf7df81e1b53baf9c5db4d3aa36f0ff57f74daf42a4e11" },
      { name: "underflow-lte", sha256: "57415048f1a748bb4d64fcf2d2177a458b9f4cfd08a6b57b7d5bbe646375603b" }
    ];
    test8("Original regression B6 files retain their exact bytes and refuse before policy evaluation", () => {
      for (const fixture2 of numberRegressions) {
        const bytes = readFileSync2(packagePath("tests", "fixtures", "regression", "numbers", `${fixture2.name}.json`));
        assert8.equal(createHash5("sha256").update(bytes).digest("hex"), fixture2.sha256);
        rejects(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      }
    });
    test8("object and generated receipt boundaries refuse unsafe integers consistently", () => {
      for (const value of [9007199254740992, -9007199254740992, 1e20, Number.MAX_VALUE]) {
        assert8.throws(() => canonicalize({ nested: [value] }), /UNSAFE_INTEGER/);
        const input3 = JSON.parse(request("eq", String(value), String(value)));
        assert8.throws(() => runRequest(input3), /UNSAFE_INTEGER/);
        assert8.throws(() => createReceipt({ policy: input3.policy, evidence: input3.evidence, asOf: asOf2, environment: captureEnvironment() }), /UNSAFE_INTEGER/);
      }
      const safe = JSON.parse(request("eq", "9007199254740991", "9007199254740991"));
      const run = runRequest(safe);
      assert8.equal(verifyRunText(JSON.stringify(run), run.digest).valid, true);
    });
    test8("SDK receipt text APIs refuse unsafe integers before replay or integrity checks", () => {
      const input3 = JSON.parse(request("gte", "9007199254740991", "9007199254740991"));
      const run = runRequest(input3);
      const runAttack = JSON.stringify(run).replace("9007199254740991", "9007199254740992");
      const answer = verifyRunText(runAttack, run.digest);
      assert8.equal(answer.valid, false);
      assert8.equal(answer.replay, "NOT_RUN");
      assert8.match(answer.reason, /^UNSAFE_INTEGER:/);
      const receipt = createReceipt({ policy: input3.policy, evidence: input3.evidence, asOf: asOf2, environment: captureEnvironment() });
      const policyAttack = JSON.stringify(receipt).replace("9007199254740991", "9007199254740992");
      const policyAnswer = verifyReceiptText(policyAttack, { trustedDigest: receipt.digest });
      assert8.equal(policyAnswer.valid, false);
      assert8.equal(policyAnswer.replayValid, false);
      assert8.equal(policyAnswer.integrityValid, false);
      assert8.equal(policyAnswer.issues[0], "UNSAFE_INTEGER");
    });
    test8("receipt text refuses a decimal substitution even when materialized replay and trusted digest match", () => {
      const input3 = JSON.parse(request("gte", "0.1", "0.1"));
      const run = runRequest(input3);
      const runText = JSON.stringify(run);
      const runAttack = runText.replace('"value":0.1', '"value":0.10000000000000001');
      assert8.notEqual(runAttack, runText);
      assert8.equal(verifyRun(JSON.parse(runAttack), run.digest).valid, true);
      assert8.equal(verifyRunText(runText, run.digest).valid, true);
      const refused = verifyRunText(runAttack, run.digest);
      assert8.equal(refused.valid, false);
      assert8.equal(refused.replay, "NOT_RUN");
      assert8.match(refused.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
      const receipt = createReceipt({ policy: input3.policy, evidence: input3.evidence, asOf: asOf2, environment: captureEnvironment() });
      const text = JSON.stringify(receipt);
      const attack = text.replace('"value":0.1', '"value":0.10000000000000001');
      assert8.notEqual(attack, text);
      assert8.equal(verifyReceipt(JSON.parse(attack), { trustedDigest: receipt.digest }).valid, true);
      assert8.equal(verifyReceiptText(text, { trustedDigest: receipt.digest }).valid, true);
      const policyRefused = verifyReceiptText(attack, { trustedDigest: receipt.digest });
      assert8.equal(policyRefused.valid, false);
      assert8.equal(policyRefused.integrityValid, false);
      assert8.equal(policyRefused.replayValid, false);
      assert8.equal(policyRefused.issues[0], code);
    });
    test8("CLI rejects numeric collapse in raw run inputs and anchored receipts", () => {
      const directory2 = (0, fs_exports.mkdtempSync)(join4(tmpdir2(), "commons-numeric-"));
      const cli = packagePath("bin", "cosmic.mjs");
      try {
        const inputPath = join4(directory2, "input.json");
        (0, fs_exports.writeFileSync)(inputPath, request("gte", "0.1", "0.10000000000000001"));
        const run = spawnSync(process.execPath, [cli, "run", inputPath], { encoding: "utf8" });
        assert8.equal(run.status, 2, run.stderr);
        assert8.match(run.stderr, /^COSMIC: NUMBER_NOT_ROUNDTRIPPABLE:/);
        assert8.equal(run.stdout, "");
        const receipt = runRequest(JSON.parse(request("gte", "0.1", "0.1")));
        const receiptPath = join4(directory2, "receipt.json");
        (0, fs_exports.writeFileSync)(receiptPath, JSON.stringify(receipt).replace('"value":0.1', '"value":0.10000000000000001'));
        const verification = spawnSync(process.execPath, [cli, "verify", receiptPath, "--expect", receipt.digest], { encoding: "utf8" });
        assert8.equal(verification.status, 1, verification.stderr);
        const answer = JSON.parse(verification.stdout);
        assert8.equal(answer.valid, false);
        assert8.equal(answer.replay, "NOT_RUN");
        assert8.match(answer.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
      } finally {
        (0, fs_exports.rmSync)(directory2, { recursive: true, force: true });
      }
    });
    test8("CLI refuses Original regression B6 inputs and exactly represented unsafe integers", () => {
      const directory2 = (0, fs_exports.mkdtempSync)(join4(tmpdir2(), "commons-number-regression-"));
      const cli = packagePath("bin", "cosmic.mjs");
      try {
        for (const fixture2 of numberRegressions) {
          const inputPath2 = packagePath("tests", "fixtures", "regression", "numbers", `${fixture2.name}.json`);
          const result = spawnSync(process.execPath, [cli, "run", inputPath2], { encoding: "utf8" });
          assert8.equal(result.error, void 0);
          assert8.equal(result.status, 2, result.stderr);
          assert8.equal(result.stdout, "");
          assert8.match(result.stderr, /^COSMIC: NUMBER_NOT_ROUNDTRIPPABLE:/);
        }
        const inputPath = join4(directory2, "unsafe.json");
        (0, fs_exports.writeFileSync)(inputPath, request("eq", "9007199254740992", "9007199254740992"));
        const unsafe = spawnSync(process.execPath, [cli, "run", inputPath], { encoding: "utf8" });
        assert8.equal(unsafe.error, void 0);
        assert8.equal(unsafe.status, 2, unsafe.stderr);
        assert8.equal(unsafe.stdout, "");
        assert8.match(unsafe.stderr, /^COSMIC: UNSAFE_INTEGER:/);
        const receipt = runRequest(JSON.parse(request("gte", "9007199254740991", "9007199254740991")));
        const receiptPath = join4(directory2, "receipt.json");
        (0, fs_exports.writeFileSync)(receiptPath, JSON.stringify(receipt).replace("9007199254740991", "9007199254740992"));
        const verification = spawnSync(process.execPath, [cli, "verify", receiptPath, "--expect", receipt.digest], { encoding: "utf8" });
        assert8.equal(verification.error, void 0);
        assert8.equal(verification.status, 1, verification.stderr);
        const answer = JSON.parse(verification.stdout);
        assert8.equal(answer.valid, false);
        assert8.equal(answer.replay, "NOT_RUN");
        assert8.match(answer.reason, /^UNSAFE_INTEGER:/);
      } finally {
        (0, fs_exports.rmSync)(directory2, { recursive: true, force: true });
      }
    });
    test8("HTTP rejects numeric collapse in raw run inputs and both receipt envelope forms", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert8.ok(address && typeof address === "object");
      const base = `http://127.0.0.1:${address.port}`;
      const receipt = runRequest(JSON.parse(request("gte", "0.1", "0.1")));
      const receiptText = JSON.stringify(receipt);
      const attack = receiptText.replace('"value":0.1', '"value":0.10000000000000001');
      const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Cosmic-Expected-Digest": receipt.digest }, body });
      try {
        const valid = await post("/api/run", request("gte", "0.1", "0.1"));
        assert8.equal(valid.status, 200);
        const invalid = await post("/api/run", request("gte", "0.1", "0.10000000000000001"));
        assert8.equal(invalid.status, 400);
        assert8.equal((await invalid.json()).code, code);
        for (const fixture2 of numberRegressions) {
          const raw2 = readFileSync2(packagePath("tests", "fixtures", "regression", "numbers", `${fixture2.name}.json`), "utf8");
          const result = await post("/api/run", raw2);
          assert8.equal(result.status, 400);
          assert8.equal((await result.json()).code, code);
        }
        const unsafe = await post("/api/run", request("eq", "9007199254740992", "9007199254740992"));
        assert8.equal(unsafe.status, 400);
        assert8.equal((await unsafe.json()).code, "UNSAFE_INTEGER");
        assert8.equal((await (await post("/api/verify", receiptText)).json()).valid, true);
        for (const body of [attack, `{"receipt":${attack}}`]) {
          const result = await (await post("/api/verify", body)).json();
          assert8.equal(result.valid, false);
          assert8.equal(result.replay, "NOT_RUN");
          assert8.match(result.reason, /^NUMBER_NOT_ROUNDTRIPPABLE:/);
        }
        const safeIntegerRun = runRequest(JSON.parse(request("eq", "9007199254740991", "9007199254740991")));
        const unsafeReceipt = JSON.stringify(safeIntegerRun).replace("9007199254740991", "9007199254740992");
        for (const body of [unsafeReceipt, `{"receipt":${unsafeReceipt}}`]) {
          const result = await (await post("/api/verify", body)).json();
          assert8.equal(result.valid, false);
          assert8.equal(result.replay, "NOT_RUN");
          assert8.match(result.reason, /^UNSAFE_INTEGER:/);
        }
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
  }
});

// dist/tests/policy.test.js
import test9 from "node:test";
import assert9 from "node:assert/strict";
var asOf3, policy, bundle2;
var init_policy_test = __esm({
  "dist/tests/policy.test.js"() {
    init_policy();
    asOf3 = "2026-09-29T00:00:00Z";
    policy = () => ({ id: "launch", version: "1", rules: [{ id: "threshold", factId: "score", op: "gte", value: 80 }] });
    bundle2 = () => ({ sources: [{ id: "s" }], facts: [{ id: "score", sourceId: "s", value: 85 }] });
    test9("known pass, known fail, absent evidence and malformed rule produce four distinct outcomes", () => {
      assert9.equal(evaluatePolicy(policy(), bundle2(), asOf3).verdict, "ALLOW");
      const low = bundle2();
      low.facts[0].value = 79;
      assert9.equal(evaluatePolicy(policy(), low, asOf3).verdict, "DENY");
      assert9.equal(evaluatePolicy(policy(), { sources: [], facts: [] }, asOf3).verdict, "DEFER");
      const invalid = policy();
      invalid.rules[0].op = "eval";
      assert9.equal(evaluatePolicy(invalid, bundle2(), asOf3).verdict, "ERROR");
    });
    test9("numeric comparison never coerces a string into a number", () => {
      const value = bundle2();
      value.facts[0].value = "85";
      const report = evaluatePolicy(policy(), value, asOf3);
      assert9.equal(report.verdict, "ERROR");
      assert9.equal(report.trace[0].code, "TYPE_MISMATCH");
    });
    test9("missing exists is unknown while a recorded null value exists", () => {
      const rule = policy();
      rule.rules = [{ id: "required", factId: "score", op: "exists" }];
      const value = bundle2();
      value.facts[0].value = null;
      assert9.equal(evaluatePolicy(rule, value, asOf3).verdict, "ALLOW");
      assert9.equal(evaluatePolicy(rule, { sources: [], facts: [] }, asOf3).verdict, "DEFER");
    });
    test9("all-requirement evaluation records every rule and makes a known failure decisive", () => {
      const rule = policy();
      rule.rules.push({ id: "other", factId: "absent", op: "exists" });
      const value = bundle2();
      value.facts[0].value = 70;
      const report = evaluatePolicy(rule, value, asOf3);
      assert9.equal(report.verdict, "DENY");
      assert9.deepEqual(report.trace.map((item) => item.result), ["FAIL", "DEFER"]);
    });
    test9("equality handles structured JSON and membership remains type-sensitive", () => {
      const value = bundle2();
      value.facts[0].value = { b: 2, a: 1 };
      const rule = policy();
      rule.rules[0] = { id: "same", factId: "score", op: "eq", value: { a: 1, b: 2 } };
      assert9.equal(evaluatePolicy(rule, value, asOf3).verdict, "ALLOW");
      value.facts[0].value = 1;
      rule.rules[0] = { id: "member", factId: "score", op: "in", value: ["1", 2] };
      assert9.equal(evaluatePolicy(rule, value, asOf3).verdict, "DENY");
    });
    test9("fact IDs are exact map keys with no property traversal", () => {
      const value = bundle2();
      value.facts[0].id = "__proto__";
      const rule = policy();
      rule.rules[0].factId = "__proto__";
      assert9.equal(evaluatePolicy(rule, value, asOf3).verdict, "ALLOW");
      rule.rules[0].factId = "score.constructor";
      assert9.equal(evaluatePolicy(rule, value, asOf3).verdict, "DEFER");
    });
    test9("expired or conflicted required facts defer and cycles error", () => {
      const expired = bundle2();
      expired.facts[0].expiresAt = asOf3;
      assert9.equal(evaluatePolicy(policy(), expired, asOf3).verdict, "DEFER");
      const conflict = bundle2();
      conflict.facts[0].claimId = "assessment";
      conflict.facts.push({ id: "alternate", sourceId: "s", value: 1, claimId: "assessment" });
      assert9.equal(evaluatePolicy(policy(), conflict, asOf3).verdict, "DEFER");
      const cycle = bundle2();
      cycle.facts[0].dependsOn = ["score"];
      assert9.equal(evaluatePolicy(policy(), cycle, asOf3).verdict, "ERROR");
    });
    test9("vacuous allow and unknown schema fields are rejected", () => {
      const rule = policy();
      rule.rules = [];
      assert9.equal(evaluatePolicy(rule, bundle2(), asOf3).verdict, "ERROR");
      assert9.equal(evaluatePolicy({ ...policy(), magic: true }, bundle2(), asOf3).verdict, "ERROR");
    });
    test9("interval sensitivity respects open and closed thresholds without inventing confidence", () => {
      assert9.equal(thresholdSensitivity({ lower: 80, upper: 90, op: "gte", threshold: 80 }).classification, "ALWAYS_PASS");
      assert9.equal(thresholdSensitivity({ lower: 80, upper: 90, op: "gt", threshold: 80 }).classification, "SENSITIVE");
      assert9.equal(thresholdSensitivity({ lower: 70, upper: 79, op: "gte", threshold: 80 }).classification, "ALWAYS_FAIL");
      assert9.equal(thresholdSensitivity({ lower: 80, upper: 80, op: "lte", threshold: 80 }).classification, "ALWAYS_PASS");
      assert9.throws(() => thresholdSensitivity({ lower: 2, upper: 1, op: "lte", threshold: 80 }));
    });
  }
});

// dist/tests/receipt-budget.test.js
import test10 from "node:test";
import assert10 from "node:assert/strict";
var init_receipt_budget_test = __esm({
  "dist/tests/receipt-budget.test.js"() {
    init_canonical();
    init_run();
    init_receipt();
    init_strict_json();
    test10("canonical byte accounting matches UTF-8, escaped strings, keys, and container punctuation", () => {
      for (const value of [null, true, false, 17, "é\n😀", [1, 2, []], { b: '"\\', a: { "é": null } }]) {
        const output2 = canonicalize(value);
        assert10.deepEqual(parseStrictJson(output2), value);
      }
      const text = "x".repeat(CANONICAL_MAX_BYTES - 2);
      assert10.equal(Buffer.byteLength(canonicalize(text)), CANONICAL_MAX_BYTES);
      assert10.throws(() => canonicalize(text + "x"), /JSON_BYTE_LIMIT/);
      assert10.throws(() => canonicalize("é".repeat(CANONICAL_MAX_BYTES / 2)), /JSON_BYTE_LIMIT/);
      assert10.throws(() => canonicalize("\n".repeat(CANONICAL_MAX_BYTES / 2)), /JSON_BYTE_LIMIT/);
      assert10.throws(() => canonicalize({ [text]: 0 }), /JSON_BYTE_LIMIT/);
    });
    test10("repeated large values stop serialization at the byte budget before traversing later members", () => {
      let touched = false;
      const value = { a: Array(1e3).fill("x".repeat(1e5)) };
      Object.defineProperty(value, "z", { enumerable: true, get() {
        touched = true;
        return true;
      } });
      assert10.throws(() => canonicalize(value), /JSON_BYTE_LIMIT/);
      assert10.equal(touched, false);
    });
    test10("a small request cannot emit a huge receipt by echoing one fact through many policy rules", () => {
      const input3 = {
        kind: "policy",
        asOf: "2026-10-02T00:00:00Z",
        evidence: { sources: [{ id: "s" }], facts: [{ id: "large", sourceId: "s", value: "x".repeat(5e5) }] },
        policy: { id: "amplification", version: "1", rules: Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, factId: "large", op: "exists" })) }
      };
      assert10.ok(Buffer.byteLength(JSON.stringify(input3)) < CANONICAL_MAX_BYTES);
      assert10.throws(() => runRequest(input3), /JSON_BYTE_LIMIT/);
      assert10.throws(() => createReceipt({ policy: input3.policy, evidence: input3.evidence, asOf: input3.asOf, environment: captureEnvironment() }), /JSON_BYTE_LIMIT/);
      input3.evidence.facts[0].value = "ordinary";
      const receipt = runRequest(input3);
      const raw2 = JSON.stringify(receipt, null, 2) + "\n";
      assert10.ok(Buffer.byteLength(raw2) <= CANONICAL_MAX_BYTES);
      assert10.equal(verifyRunText(raw2, receipt.digest).valid, true);
    });
    test10("formatting overhead is included in the standard receipt export limit", () => {
      const value = { a: "x".repeat(CANONICAL_MAX_BYTES - 8) };
      assert10.equal(Buffer.byteLength(canonicalize(value)), CANONICAL_MAX_BYTES);
      assert10.throws(() => assertReceiptTextLimit(value), /RECEIPT_BYTE_LIMIT/);
    });
  }
});

// dist/tests/receipt.test.js
import test11 from "node:test";
import assert11 from "node:assert/strict";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join5 } from "node:path";
function invokeCli(args) {
  const result = spawnSync(process.execPath, [packagePath("bin", "cosmic.mjs"), ...args], { encoding: "utf8" });
  assert11.ifError(result.error);
  return result;
}
var input2;
var init_receipt_test = __esm({
  "dist/tests/receipt.test.js"() {
    init_receipt();
    init_canonical();
    init_run();
    init_child_process();
    init_fs();
    init_package_root();
    input2 = () => ({
      policy: { id: "test", version: "1", rules: [{ id: "threshold", factId: "score", op: "gte", value: 80 }] },
      evidence: { sources: [{ id: "s" }], facts: [{ id: "score", sourceId: "s", value: 85 }] },
      asOf: "2026-09-29T00:00:00Z",
      environment: captureEnvironment()
    });
    test11("receipt bytes repeat, and creation snapshots mutable caller inputs", () => {
      const value = input2();
      const first = createReceipt(value);
      const second = createReceipt(value);
      assert11.deepEqual(first, second);
      value.evidence.facts[0].value = 1;
      assert11.equal(first.payload.input.evidence.facts[0].value, 85);
    });
    test11("verification recomputes a report and labels absent external anchor", () => {
      const receipt = createReceipt(input2());
      const report = verifyReceipt(receipt);
      assert11.equal(report.valid, true);
      assert11.equal(report.integrityValid, true);
      assert11.equal(report.replayValid, true);
      assert11.equal(report.anchoring, "UNANCHORED");
      assert11.equal(report.authenticity, "NOT_ESTABLISHED");
      assert11.ok(report.issues.includes("UNANCHORED_SELF_CONSISTENCY_ONLY"));
    });
    test11("byte tampering fails integrity and recomputed dishonest reports fail replay", () => {
      const receipt = createReceipt(input2());
      const originalDigest = receipt.digest;
      receipt.payload.report.verdict = "DENY";
      const tampered = verifyReceipt(receipt);
      assert11.equal(tampered.integrityValid, false);
      assert11.equal(tampered.replayValid, false);
      assert11.equal(tampered.valid, false);
      assert11.equal(verifyReceipt(receipt, { trustedDigest: originalDigest }).anchoring, "MISMATCH");
      receipt.digest = sha256(receipt.payload);
      const resealed = verifyReceipt(receipt);
      assert11.equal(resealed.integrityValid, true);
      assert11.equal(resealed.replayValid, false);
      assert11.equal(resealed.valid, false);
    });
    test11("rewriting input and output together requires a trusted anchor to detect substitution", () => {
      const original = createReceipt(input2());
      const externalDigest = original.digest;
      const alteredInput = input2();
      alteredInput.evidence.facts[0].value = 1;
      const altered = createReceipt(alteredInput);
      assert11.equal(verifyReceipt(altered).valid, true);
      const anchored = verifyReceipt(altered, { trustedDigest: externalDigest });
      assert11.equal(anchored.valid, false);
      assert11.equal(anchored.anchoring, "MISMATCH");
      const correct = verifyReceipt(original, { trustedDigest: externalDigest });
      assert11.equal(correct.valid, true);
      assert11.equal(correct.anchoring, "ANCHORED");
    });
    test11("environment and asOf are bound, with an additional expected environment constraint", () => {
      const receipt = createReceipt(input2());
      const expected = { ...receipt.payload.input.environment, runtime: "node/999.0.0" };
      const check = verifyReceipt(receipt, { expectedEnvironment: expected });
      assert11.equal(check.valid, false);
      assert11.equal(check.environmentMatches, false);
      receipt.payload.input.asOf = "2026-09-30T00:00:00Z";
      assert11.equal(verifyReceipt(receipt).integrityValid, false);
    });
    test11("unsupported caller-declared environments never count as exact policy replay", () => {
      for (const field of ["runtime", "implementation", "platform", "arch"]) {
        const declared = input2();
        declared.environment[field] = "unsupported";
        const receipt = createReceipt(declared);
        for (const options2 of [{}, { expectedEnvironment: declared.environment }]) {
          const checked = verifyReceipt(receipt, options2);
          assert11.equal(checked.integrity, "VALID");
          assert11.equal(checked.environmentMatches, false, field);
          assert11.equal(checked.replay, "UNSUPPORTED", field);
          assert11.equal(checked.replayValid, false, field);
          assert11.equal(checked.valid, false, field);
          assert11.equal(checked.replayedReport, void 0);
          assert11.ok(checked.issues.includes("UNSUPPORTED_ENVIRONMENT"));
        }
      }
      assert11.equal(verifyReceipt(createReceipt(input2())).environmentMatches, true);
    });
    test11("early verification refusal reports integrity NOT_CHECKED and remembers supplied anchors", () => {
      const anchor = "a".repeat(64);
      for (const raw2 of ['{"digest":1,"digest":2}', "{", "{}"]) {
        const policy3 = verifyReceiptText(raw2, { trustedDigest: anchor });
        assert11.equal(policy3.valid, false);
        assert11.equal(policy3.integrity, "NOT_CHECKED");
        assert11.equal(policy3.replay, "NOT_RUN");
        assert11.equal(policy3.anchoring, "MISMATCH");
        const run2 = verifyRunText(raw2, anchor);
        assert11.equal(run2.valid, false);
        assert11.equal(run2.integrity, "NOT_CHECKED");
        assert11.equal(run2.replay, "NOT_RUN");
        assert11.equal(run2.anchoring, "MISMATCH");
      }
      assert11.equal(verifyReceipt(createReceipt(input2()), { trustedDigest: "bad" }).integrity, "NOT_CHECKED");
      const { environment: _environment, ...declaration2 } = input2();
      const run = runRequest({ kind: "policy", ...declaration2 });
      assert11.equal(verifyRun(run, "bad").integrity, "NOT_CHECKED");
      run.digest = "0".repeat(64);
      assert11.equal(verifyRun(run).integrity, "INVALID");
      const policy2 = createReceipt(input2());
      policy2.digest = "0".repeat(64);
      assert11.equal(verifyReceipt(policy2).integrity, "INVALID");
    });
    test11("CLI distinguishes malformed anchors from well-formed mismatches", () => {
      const dir = (0, fs_exports.mkdtempSync)(join5(tmpdir3(), "cosmic-anchor-"));
      try {
        const path = join5(dir, "receipt.json");
        let result = invokeCli(["demo", "release-authorization", "--out", path]);
        assert11.equal(result.status, 0, result.stderr);
        for (const anchor of ["bad", "A".repeat(64), "0".repeat(63)]) {
          result = invokeCli(["verify", path, "--expect", anchor]);
          assert11.equal(result.status, 2, result.stderr);
          assert11.equal(result.stdout, "");
          assert11.match(result.stderr, /--expect/);
        }
        result = invokeCli(["verify", path, "--expect", "0".repeat(64)]);
        assert11.equal(result.status, 1, result.stderr);
        const verification = JSON.parse(result.stdout);
        assert11.equal(verification.integrity, "VALID");
        assert11.equal(verification.anchoring, "MISMATCH");
      } finally {
        (0, fs_exports.rmSync)(dir, { recursive: true, force: true });
      }
    });
    test11("CLI --out refuses existing paths before evaluation and never follows output symlinks", () => {
      const dir = (0, fs_exports.mkdtempSync)(join5(tmpdir3(), "cosmic-output-"));
      try {
        const inputPath = join5(dir, "input.json");
        const original = '{"invalid":"input must not be evaluated"}\n';
        (0, fs_exports.writeFileSync)(inputPath, original);
        const existingPath = join5(dir, "existing.json");
        (0, fs_exports.writeFileSync)(existingPath, "keep existing bytes");
        const symlinkPath = join5(dir, "symlink.json");
        (0, fs_exports.symlinkSync)(inputPath, symlinkPath);
        const hardlinkPath = join5(dir, "hardlink.json");
        (0, fs_exports.linkSync)(inputPath, hardlinkPath);
        const missingTarget = join5(dir, "missing-target.json");
        const danglingPath = join5(dir, "dangling.json");
        (0, fs_exports.symlinkSync)(missingTarget, danglingPath);
        for (const path of [inputPath, existingPath, symlinkPath, hardlinkPath, danglingPath, dir]) {
          const result2 = invokeCli(["run", inputPath, "--out", path]);
          assert11.equal(result2.status, 2, result2.stderr);
          assert11.match(result2.stderr, /Output already exists/, path);
          assert11.equal(result2.stdout, "");
          assert11.equal(readFileSync2(inputPath, "utf8"), original);
          assert11.equal(readFileSync2(existingPath, "utf8"), "keep existing bytes");
        }
        assert11.equal((0, fs_exports.existsSync)(missingTarget), false);
        const outputPath = join5(dir, "new", "receipt.json");
        const result = invokeCli(["demo", "release-authorization", "--out", outputPath]);
        assert11.equal(result.status, 0, result.stderr);
        assert11.equal(JSON.parse(readFileSync2(outputPath, "utf8")).result.verdict, "ALLOW");
      } finally {
        (0, fs_exports.rmSync)(dir, { recursive: true, force: true });
      }
    });
    test11("malformed envelopes and digest syntax cannot pass", () => {
      for (const receipt of [null, {}, { payload: {}, digest: "x" }, { ...createReceipt(input2()), signature: "made-up" }]) {
        assert11.equal(verifyReceipt(receipt).valid, false);
      }
      assert11.equal(verifyReceipt(createReceipt(input2()), { trustedDigest: "bad" }).valid, false);
    });
  }
});

// dist/tests/regression-receipts.test.js
import test12 from "node:test";
import assert12 from "node:assert/strict";
var fixture, raw, trusted;
var init_regression_receipts_test = __esm({
  "dist/tests/regression-receipts.test.js"() {
    init_fs();
    init_child_process();
    init_package_root();
    init_run();
    init_server();
    fixture = (name) => packagePath("tests", "fixtures", "regression", "receipts", name);
    raw = (name) => readFileSync2(fixture(name), "utf8");
    trusted = raw("c-clean.digest").trim();
    test12("Original regression clean Mac receipt retains valid integrity and anchor but refuses this implementation runtime", () => {
      const result = verifyRunText(raw("c-clean.json"), trusted);
      assert12.equal(result.valid, false);
      assert12.equal(result.integrity, "VALID");
      assert12.equal(result.anchoring, "MATCH");
      assert12.equal(result.replay, "UNSUPPORTED");
    });
    test12("Original regression duplicate verdicts refuse before integrity or runtime checks through SDK and CLI", () => {
      for (const name of ["c-A1.json", "denied.TAMPERED.receipt.json"]) {
        const result = verifyRunText(raw(name), trusted);
        assert12.equal(result.valid, false);
        assert12.equal(result.integrity, "NOT_CHECKED");
        assert12.equal(result.anchoring, "MISMATCH");
        assert12.equal(result.replay, "NOT_RUN");
        assert12.match(result.reason, /^DUPLICATE_JSON_KEY:/);
        const cli = spawnSync(process.execPath, [packagePath("bin", "cosmic.mjs"), "verify", fixture(name), "--expect", trusted], { encoding: "utf8" });
        assert12.equal(cli.status, 1, cli.stderr);
        const output2 = JSON.parse(cli.stdout);
        assert12.equal(output2.integrity, "NOT_CHECKED");
        assert12.equal(output2.anchoring, "MISMATCH");
        assert12.equal(output2.replay, "NOT_RUN");
        assert12.match(output2.reason, /^DUPLICATE_JSON_KEY:/);
      }
    });
    test12("Original regression duplicate receipts refuse on raw and envelope HTTP paths", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert12.ok(address && typeof address === "object");
      try {
        for (const name of ["c-A1.json", "denied.TAMPERED.receipt.json"]) {
          for (const envelope of [false, true]) {
            const body = envelope ? `{"receipt":${raw(name)},"expectedDigest":"${trusted}"}` : raw(name);
            const response = await fetch(`http://127.0.0.1:${address.port}/api/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...!envelope ? { "X-Cosmic-Expected-Digest": trusted } : {} },
              body
            });
            const result = await response.json();
            assert12.equal(response.status, 200);
            assert12.equal(result.valid, false);
            assert12.equal(result.integrity, "NOT_CHECKED");
            assert12.equal(result.replay, "NOT_RUN");
            assert12.equal(result.anchoring, envelope ? "NOT_CHECKED" : "MISMATCH");
            assert12.match(result.reason, /^DUPLICATE_JSON_KEY:/);
          }
        }
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
  }
});

// dist/tests/strict-json.test.js
import test13 from "node:test";
import assert13 from "node:assert/strict";
import { tmpdir as tmpdir4 } from "node:os";
import { join as join6 } from "node:path";
function rejects2(raw2, code2 = "DUPLICATE_JSON_KEY") {
  assert13.throws(() => parseStrictJson(raw2), (error) => error instanceof StrictJsonError && error.code === code2);
}
function duplicateVerdict(raw2) {
  const needle = '"verdict":"DEFER"';
  assert13.ok(raw2.includes(needle));
  return raw2.replace(needle, '"verdict":"ALLOW",' + needle);
}
var init_strict_json_test = __esm({
  "dist/tests/strict-json.test.js"() {
    init_fs();
    init_package_root();
    init_child_process();
    init_strict_json();
    init_run();
    init_receipt();
    init_examples();
    init_server();
    test13("strict JSON rejects duplicate decoded keys throughout nested objects and arrays", () => {
      for (const raw2 of [
        '{"status":"SUPPORTED_WITHIN_SCOPE","status":"OUT_OF_GRAMMAR"}',
        '{"status":1,"status":1}',
        String.raw`{"status":1,"sta\u0074us":2}`,
        '{"a":[{"inner":{"x":1,"x":2}}]}',
        '{"":1,"":2}',
        '{"__proto__":{},"__proto__":{}}',
        String.raw`{"😀":1,"\ud83d\ude00":2}`,
        String.raw`{"a\\b":1,"a\u005cb":2}`
      ])
        rejects2(raw2);
    });
    test13("strict JSON preserves native values, repeated keys in separate objects, and safe own __proto__", () => {
      for (const raw2 of [
        '{"a":{"x":1},"b":{"x":2},"rows":[{"x":3},{"x":4}]}',
        String.raw`{"quote\"slash\\": "braces {}, commas , and quote \"", "n":-1.25e+4}`,
        String.raw`["\u0000","\ud800",null,false,true,0,1.5e-2]`,
        '{"__proto__":{"polluted":true},"constructor":7}',
        ' \r\n	 {"wide":9007199254740991} '
      ])
        assert13.deepEqual(parseStrictJson(raw2), JSON.parse(raw2));
      const value = parseStrictJson('{"__proto__":{"polluted":true}}');
      assert13.equal(Object.getPrototypeOf(value), Object.prototype);
      assert13.equal(Object.hasOwn(value, "__proto__"), true);
      assert13.equal({}.polluted, void 0);
    });
    test13("strict JSON rejects malformed syntax, escapes, control characters, and trailing content", () => {
      for (const raw2 of ["", "{", "[", '{"a":1,}', "[1,]", '{"a" 1}', "{a:1}", "01", "-01", "1.", "1e", "NaN", "+1", "true false", "{}{}", '"unterminated', String.raw`"\q"`, String.raw`"\u00xz"`, '"\n"', " {}", "[undefined]"]) {
        rejects2(raw2, "INVALID_JSON");
      }
    });
    test13("strict JSON enforces UTF-8 byte and nested-container limits with controlled errors", () => {
      assert13.equal(parseStrictJson('"' + "a".repeat(MAX_JSON_BYTES - 2) + '"').length, MAX_JSON_BYTES - 2);
      rejects2('"' + "a".repeat(MAX_JSON_BYTES - 1) + '"', "JSON_TOO_LARGE");
      rejects2('"' + "é".repeat(MAX_JSON_BYTES / 2) + '"', "JSON_TOO_LARGE");
      assert13.doesNotThrow(() => parseStrictJson("[".repeat(MAX_JSON_DEPTH) + "0" + "]".repeat(MAX_JSON_DEPTH)));
      rejects2("[".repeat(MAX_JSON_DEPTH + 1) + "0" + "]".repeat(MAX_JSON_DEPTH + 1), "JSON_TOO_DEEP");
    });
    test13("run receipt text rejects a false first verdict even when parsed replay and external anchor match", () => {
      const receipt = runRequest(getExample("release-deferred"));
      const raw2 = JSON.stringify(receipt);
      const attack = duplicateVerdict(raw2);
      assert13.equal(verifyRun(JSON.parse(attack), receipt.digest).valid, true);
      assert13.equal(verifyRunText(raw2, receipt.digest).valid, true);
      const refused = verifyRunText(attack, receipt.digest);
      assert13.equal(refused.valid, false);
      assert13.equal(refused.replay, "NOT_RUN");
      assert13.match(refused.reason, /^DUPLICATE_JSON_KEY:/);
      assert13.match(verifyRunText(attack.replace('"verdict":"ALLOW"', '"ver\\u0064ict":"ALLOW"'), receipt.digest).reason, /^DUPLICATE_JSON_KEY:/);
    });
    test13("policy receipt text rejects duplicate verdicts before canonicalization", () => {
      const request2 = getExample("release-deferred");
      const receipt = createReceipt({ policy: request2.policy, evidence: request2.evidence, asOf: request2.asOf, environment: captureEnvironment() });
      const raw2 = JSON.stringify(receipt);
      assert13.equal(verifyReceiptText(raw2, { trustedDigest: receipt.digest }).valid, true);
      const refused = verifyReceiptText(duplicateVerdict(raw2), { trustedDigest: receipt.digest });
      assert13.equal(refused.valid, false);
      assert13.equal(refused.integrityValid, false);
      assert13.equal(refused.replayValid, false);
      assert13.equal(refused.issues[0], "DUPLICATE_JSON_KEY");
    });
    test13("CLI refuses raw duplicate keys while a valid receipt still passes anchored replay", () => {
      const directory2 = (0, fs_exports.mkdtempSync)(join6(tmpdir4(), "commons-duplicate-"));
      const cli = packagePath("bin", "cosmic.mjs");
      const receipt = runRequest(getExample("release-deferred"));
      const raw2 = JSON.stringify(receipt);
      try {
        const path = join6(directory2, "receipt.json");
        for (const [content, expected] of [[raw2, true], [duplicateVerdict(raw2), false]]) {
          (0, fs_exports.writeFileSync)(path, content);
          const result = spawnSync(process.execPath, [cli, "verify", path, "--expect", receipt.digest], { encoding: "utf8" });
          assert13.equal(result.status, expected ? 0 : 1, result.stderr);
          const answer = JSON.parse(result.stdout);
          assert13.equal(answer.valid, expected);
          if (!expected)
            assert13.match(answer.reason, /^DUPLICATE_JSON_KEY:/);
        }
      } finally {
        (0, fs_exports.rmSync)(directory2, { recursive: true, force: true });
      }
    });
    test13("HTTP refuses raw and legacy-envelope duplicates without losing uploaded text", async () => {
      const server = createWorkbenchServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert13.ok(address && typeof address === "object");
      const url = `http://127.0.0.1:${address.port}`;
      const receipt = runRequest(getExample("release-deferred"));
      const raw2 = JSON.stringify(receipt);
      const attack = duplicateVerdict(raw2);
      const post = async (path, body) => fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Cosmic-Expected-Digest": receipt.digest }, body });
      try {
        assert13.equal((await (await post("/api/verify", raw2)).json()).valid, true);
        for (const body of [attack, `{"receipt":${attack}}`, `{"receipt":${raw2},"receipt":${raw2}}`, `{"receipt":${raw2},"expectedDigest":"${receipt.digest}","expectedDigest":"${receipt.digest}"}`]) {
          const response2 = await post("/api/verify", body);
          const result = await response2.json();
          assert13.equal(result.valid, false);
          assert13.equal(result.replay, "NOT_RUN");
          assert13.match(result.reason, /^DUPLICATE_JSON_KEY:/);
        }
        const input3 = JSON.stringify(getExample("release-deferred")).replace('"kind":"policy"', '"kind":"discovery","kind":"policy"');
        const response = await post("/api/run", input3);
        assert13.equal(response.status, 400);
        assert13.equal((await response.json()).code, "DUPLICATE_JSON_KEY");
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
  }
});

// standalone/portable-proof.mjs
import test14 from "node:test";
import assert14 from "node:assert/strict";
import { spawnSync as spawnSync2 } from "node:child_process";
import { readFileSync as readFileSync4 } from "node:fs";
import { createHash as createHash6 } from "node:crypto";
import { pathToFileURL as pathToFileURL2 } from "node:url";
var init_portable_proof = __esm({
  "standalone/portable-proof.mjs"() {
    init_package_root();
    init_standalone_inputs();
    init_src();
    test14("standalone ESM exports load directly with no package resolution or side effects", () => {
      const expression = `import * as sdk from ${JSON.stringify(pathToFileURL2(bundlePath).href)}; console.log(JSON.stringify(Object.keys(sdk).sort()));`;
      const result = spawnSync2(process.execPath, ["--input-type=module", "-e", expression], { encoding: "utf8" });
      assert14.ifError(result.error);
      assert14.equal(result.status, 0, result.stderr);
      assert14.deepEqual(JSON.parse(result.stdout), expectedExports);
    });
    test14("standalone doctor binds actual file bytes, source inputs and recorded runtime", () => {
      const result = spawnSync2(process.execPath, [bundlePath, "doctor"], { encoding: "utf8" });
      assert14.ifError(result.error);
      assert14.equal(result.status, 0, result.stderr);
      const doctor = JSON.parse(result.stdout);
      assert14.equal(doctor.executionTarget, "Node >=20");
      assert14.equal(doctor.typescriptRequired, false);
      assert14.equal(doctor.npmInstallRequired, false);
      assert14.deepEqual(doctor.runtime, executionRuntime());
      assert14.equal(doctor.runtime.implementation, `${implementation}/standalone`);
      assert14.equal(doctor.runtime.sourceDigest, sha256(sourceFiles));
      assert14.equal(doctor.runtime.codeDigest, createHash6("sha256").update(readFileSync4(bundlePath)).digest("hex"));
    });
    test14("embedded examples, workbench and original regression bytes match their build input hashes", () => {
      assert14.deepEqual(Object.keys(assetHashes), Object.keys(assets));
      for (const [path, digest] of Object.entries(assetHashes)) {
        assert14.equal(createHash6("sha256").update(Buffer.from(assets[path], "base64")).digest("hex"), digest, path);
      }
    });
  }
});

// embedded:standalone:proof
var standalone_proof_exports = {};
var init_standalone_proof = __esm({
  "embedded:standalone:proof"() {
    init_evidence_test();
    init_inference_adequacy_adversarial_test();
    init_inference_scope_test();
    init_inference_test();
    init_ingress_test();
    init_integration_adversarial_test();
    init_integration_test();
    init_numeric_json_test();
    init_policy_test();
    init_receipt_budget_test();
    init_receipt_test();
    init_regression_receipts_test();
    init_strict_json_test();
    init_portable_proof();
  }
});

// standalone/entry.mjs
import { realpathSync } from "node:fs";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { spawnSync as spawnSync3 } from "node:child_process";

// dist/src/cli.js
init_fs();
init_child_process();
init_run();
init_strict_json();
init_examples();
init_server();
init_package_root();
import { dirname as dirname3, join as join2 } from "node:path";
var help = `COSMIC Commons 0.2.2 — reason, decide, replay

  cosmic serve [--port 4317]              Open the local workbench
  cosmic examples                         List included examples
  cosmic demo [name] [--out receipt.json]   Run a complete example
  cosmic run input.json [--out receipt.json]
  cosmic verify receipt.json [--expect SHA256]
  cosmic doctor                           Inspect runtime and build information
  cosmic prove                            Run the shipped correctness suite

Use: node bin/cosmic.mjs <command>
Verification without --expect checks consistency, not trusted origin.
`;
function parse(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      if (!["--port", "--out", "--expect"].includes(a) || Object.hasOwn(flags, a))
        throw new Error(`Unknown or repeated option: ${a}`);
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for ${a}`);
      flags[a] = value;
    } else
      positional.push(a);
  }
  return { positional, flags };
}
function assertOutputAvailable(path) {
  try {
    (0, fs_exports.lstatSync)(path);
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
  throw new Error(`Output already exists; refusing to overwrite a file, directory, or symlink: ${path}`);
}
function output(value, path) {
  const data = JSON.stringify(value, null, 2) + "\n";
  if (path) {
    (0, fs_exports.mkdirSync)(dirname3(path), { recursive: true });
    (0, fs_exports.writeFileSync)(path, data, { flag: "wx" });
    process.stderr.write(`Saved ${path}
`);
  } else
    process.stdout.write(data);
}
async function main(args) {
  try {
    if (!args.length || ["help", "--help", "-h"].includes(args[0])) {
      process.stdout.write(help);
      return;
    }
    const command = args[0];
    const { positional, flags } = parse(args.slice(1));
    const allowed = { serve: ["--port"], examples: [], demo: ["--out"], run: ["--out"], verify: ["--expect"], prove: [], doctor: [] };
    if (!Object.hasOwn(allowed, command))
      throw new Error(`Unknown command: ${command}`);
    for (const flag of Object.keys(flags))
      if (!allowed[command].includes(flag))
        throw new Error(`${flag} is not supported by ${command}`);
    if (positional.length > (["demo", "run", "verify"].includes(command) ? 1 : 0))
      throw new Error("Too many arguments");
    if (flags["--expect"] !== void 0 && !/^[a-f0-9]{64}$/.test(flags["--expect"]))
      throw new Error("--expect must be 64 lowercase hexadecimal characters");
    if (flags["--out"] !== void 0)
      assertOutputAvailable(flags["--out"]);
    if (command === "serve") {
      await serve(flags["--port"] ? Number(flags["--port"]) : 4317);
      return;
    }
    if (command === "doctor") {
      output({ runtime: executionRuntime(), executionTarget: "Node >=20", typescriptRequired: false, npmInstallRequired: false, validationEvidence: "verification/portable-runtime-results.json", replayContract: "Exact recorded Node/V8, platform, architecture, endianness, source and executed-code hashes" });
      return;
    }
    if (command === "examples") {
      output(listExamples().map(({ id, name, description }) => ({ id, name, description })));
      return;
    }
    if (command === "demo") {
      output(runRequest(getExample(positional[0])), flags["--out"]);
      return;
    }
    if (command === "run" || command === "verify") {
      if (!positional[0])
        throw new Error(`${command} requires a JSON file`);
      const raw2 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(readFileSync2(positional[0]));
      if (command === "run")
        output(runRequest(parseStrictJson(raw2)), flags["--out"]);
      else {
        const result = verifyRunText(raw2, flags["--expect"]);
        output(result);
        if (!result.valid)
          process.exitCode = 1;
      }
      return;
    }
    const directory2 = packagePath("dist", "tests");
    const files = readdirSync2(directory2).filter((f) => f.endsWith(".test.js")).sort().map((f) => join2(directory2, f));
    if (!files.length)
      throw new Error("No compiled tests found; rebuild with npm ci && npm run build");
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { cwd: packageRoot, stdio: "inherit" });
    if (run.error)
      throw run.error;
    process.exitCode = run.status ?? 1;
  } catch (error) {
    process.stderr.write(`COSMIC: ${error instanceof Error ? error.message : String(error)}
`);
    process.exitCode = 2;
  }
}

// standalone/entry.mjs
init_runtime();
init_standalone_inputs();
init_src();
var invoked = false;
try {
  invoked = Boolean(process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath3(import.meta.url)));
} catch {
}
if (invoked) {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    process.stderr.write(`COSMIC Commons requires Node 20 or newer; found ${process.versions.node}.
`);
    process.exitCode = 2;
  } else if (process.argv.length === 2 || process.argv.length === 3 && ["help", "--help", "-h"].includes(process.argv[2])) {
    process.stdout.write(`COSMIC Commons ${implementation.split("/").at(-1)} — standalone reasoning, decisions and replay

Use: node cosmic-commons.mjs <command>

  serve [--port 4317]                    Open the embedded local workbench
  examples                               List embedded examples
  demo [name] [--out receipt.json]         Run an embedded example
  run input.json [--out receipt.json]     Run an external JSON input
  verify receipt.json [--expect SHA256]   Check integrity, replay and anchor
  doctor                                 Inspect this file and runtime
  prove                                  Run embedded correctness checks

Node >=20; no installation, adjacent assets or extraction required.
Verification without --expect checks consistency, not trusted origin.
`);
  } else if (process.argv.length === 3 && process.argv[2] === "doctor") {
    process.stdout.write(JSON.stringify({
      runtime: executionRuntime(),
      executionTarget: "Node >=20",
      typescriptRequired: false,
      npmInstallRequired: false,
      deployment: "standalone",
      validationEvidence: "Run this file with prove for embedded checks; the source archive contains the full verification record and BUNDLE-INPUTS.json.",
      replayContract: "Exact recorded Node/V8, platform, architecture, endianness, embedded source and whole executing-file hashes"
    }, null, 2) + "\n");
  } else if (process.argv.length === 3 && process.argv[2] === "prove") {
    if (process.execArgv.includes("--test-reporter=tap")) await Promise.resolve().then(() => (init_standalone_proof(), standalone_proof_exports));
    else {
      const proof = spawnSync3(process.execPath, ["--test-reporter=tap", fileURLToPath3(import.meta.url), "prove"], { stdio: "inherit" });
      if (proof.error) {
        process.stderr.write(`COSMIC: ${proof.error.message}
`);
        process.exitCode = 2;
      } else process.exitCode = proof.status ?? 1;
    }
  } else {
    await main(process.argv.slice(2));
  }
}
export {
  ADEQUACY_IMPLEMENTATION,
  ADEQUACY_NORMALIZATION_POLICY,
  ADEQUACY_SCHEMA_VERSION,
  ADEQUACY_SUPPORT_POLICY,
  CANONICAL_MAX_BYTES,
  CANONICAL_MAX_NODES,
  DISCOVERY_MAX_IDENTIFIER_LENGTH,
  DiscoverySession,
  EVIDENCE_LIMITS,
  FamilyAdequacyMonitor,
  MAX_DISCOVERY_OBSERVATIONS,
  MAX_JSON_BYTES,
  MAX_JSON_DEPTH,
  RECEIPT_SCHEMA_VERSION,
  ReplayRuntimeError,
  StrictJsonError,
  VALIDATED_NODE_VERSION,
  assertReceiptTextLimit,
  assertReplayRuntime,
  canonicalJSON,
  canonicalize,
  captureEnvironment,
  compareReceiptNumerics,
  createReceipt,
  currentAdequacyRuntime,
  currentReplayRuntime,
  entropy,
  evaluateInput,
  evaluatePolicy,
  exactKeys,
  executionRuntime,
  hashJSON,
  inspectEvidence,
  jsonClone,
  parseStrictJson,
  replayFamilyAdequacy,
  replaySession,
  requiredId,
  runRequest,
  sha256,
  sha256Bytes,
  thresholdSensitivity,
  timestamp,
  validateDiscoveryIdentifier,
  validateFamilyAdequacyOptions,
  validateInput,
  validatePolicy,
  verifyReceipt,
  verifyReceiptText,
  verifyRun,
  verifyRunText
};
