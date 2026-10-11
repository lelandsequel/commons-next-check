// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import * as actualFs from 'node:fs';
import { relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assets } from 'standalone:inputs';
import { packageRoot } from './package-root.mjs';
export * from 'node:fs';

function embeddedKey(path) {
  if (path instanceof URL) path = fileURLToPath(path);
  if (typeof path !== 'string') return null;
  const key = relative(packageRoot, path);
  if (key === '..' || key.startsWith(`..${sep}`) || isAbsolute(key)) return null;
  return key.split(sep).join('/');
}
function missing(path) { const error = new Error(`ENOENT: no embedded resource, ${String(path)}`); error.code = 'ENOENT'; throw error; }
function assertReservedNamespaceEmpty() {
  try { actualFs.lstatSync(packageRoot); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  // Never substitute embedded content for a caller's real path, including a
  // dangling symlink. Move the bundle away from this reserved directory.
  throw new Error(`EMBEDDED_ASSET_NAMESPACE_COLLISION: reserved path exists: ${packageRoot}`);
}
export function readFileSync(path, options) {
  const key = embeddedKey(path);
  if (key === null) return actualFs.readFileSync(path, options);
  assertReservedNamespaceEmpty();
  if (!Object.hasOwn(assets, key)) return missing(path);
  const bytes = Buffer.from(assets[key], 'base64');
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? bytes.toString(encoding) : bytes;
}
export function readdirSync(path, options) {
  const key = embeddedKey(path);
  if (key === null) return actualFs.readdirSync(path, options);
  assertReservedNamespaceEmpty();
  if (options) throw new Error('Embedded directory listing accepts the shared examples API only');
  const prefix = key ? key + '/' : '';
  const names = [...new Set(Object.keys(assets).filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length).split('/')[0]))].sort();
  if (!names.length) return missing(path);
  return names;
}
