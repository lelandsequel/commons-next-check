// Copyright 2026 Leland Jourdan II / C&L Strategy
// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync, readdirSync, mkdirSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runRequest, verifyRunText, executionRuntime } from "./run.js";
import { parseStrictJson } from "./strict-json.js";
import { listExamples, getExample } from "./examples.js";
import { serve } from "./server.js";
import { packageRoot, packagePath } from "./package-root.js";
const help = `COSMIC Commons 0.2.2 — reason, decide, replay\n\n  cosmic serve [--port 4317]              Open the local workbench\n  cosmic examples                         List included examples\n  cosmic demo [name] [--out receipt.json]   Run a complete example\n  cosmic run input.json [--out receipt.json]\n  cosmic verify receipt.json [--expect SHA256]\n  cosmic doctor                           Inspect runtime and build information\n  cosmic prove                            Run the shipped correctness suite\n\nUse: node bin/cosmic.mjs <command>\nVerification without --expect checks consistency, not trusted origin.\n`;
function parse(args) { const positional = []; const flags = {}; for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
        if (!['--port', '--out', '--expect'].includes(a) || Object.hasOwn(flags, a))
            throw new Error(`Unknown or repeated option: ${a}`);
        const value = args[++i];
        if (!value || value.startsWith('--'))
            throw new Error(`Missing value for ${a}`);
        flags[a] = value;
    }
    else
        positional.push(a);
} return { positional, flags }; }
function assertOutputAvailable(path) {
    try {
        lstatSync(path);
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return;
        throw error;
    }
    throw new Error(`Output already exists; refusing to overwrite a file, directory, or symlink: ${path}`);
}
function output(value, path) { const data = JSON.stringify(value, null, 2) + '\n'; if (path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, { flag: 'wx' });
    process.stderr.write(`Saved ${path}\n`);
}
else
    process.stdout.write(data); }
export async function main(args) {
    try {
        if (!args.length || ['help', '--help', '-h'].includes(args[0])) {
            process.stdout.write(help);
            return;
        }
        const command = args[0];
        const { positional, flags } = parse(args.slice(1));
        const allowed = { serve: ['--port'], examples: [], demo: ['--out'], run: ['--out'], verify: ['--expect'], prove: [], doctor: [] };
        if (!Object.hasOwn(allowed, command))
            throw new Error(`Unknown command: ${command}`);
        for (const flag of Object.keys(flags))
            if (!allowed[command].includes(flag))
                throw new Error(`${flag} is not supported by ${command}`);
        if (positional.length > (['demo', 'run', 'verify'].includes(command) ? 1 : 0))
            throw new Error('Too many arguments');
        if (flags['--expect'] !== undefined && !/^[a-f0-9]{64}$/.test(flags['--expect']))
            throw new Error('--expect must be 64 lowercase hexadecimal characters');
        if (flags['--out'] !== undefined)
            assertOutputAvailable(flags['--out']);
        if (command === 'serve') {
            await serve(flags['--port'] ? Number(flags['--port']) : 4317);
            return;
        }
        if (command === 'doctor') {
            output({ runtime: executionRuntime(), executionTarget: 'Node >=20', typescriptRequired: false, npmInstallRequired: false, validationEvidence: 'verification/portable-runtime-results.json', replayContract: 'Exact recorded Node/V8, platform, architecture, endianness, source and executed-code hashes' });
            return;
        }
        if (command === 'examples') {
            output(listExamples().map(({ id, name, description }) => ({ id, name, description })));
            return;
        }
        if (command === 'demo') {
            output(runRequest(getExample(positional[0])), flags['--out']);
            return;
        }
        if (command === 'run' || command === 'verify') {
            if (!positional[0])
                throw new Error(`${command} requires a JSON file`);
            const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(positional[0]));
            if (command === 'run')
                output(runRequest(parseStrictJson(raw)), flags['--out']);
            else {
                const result = verifyRunText(raw, flags['--expect']);
                output(result);
                if (!result.valid)
                    process.exitCode = 1;
            }
            return;
        }
        const directory = packagePath('dist', 'tests');
        const files = readdirSync(directory).filter(f => f.endsWith('.test.js')).sort().map(f => join(directory, f));
        if (!files.length)
            throw new Error('No compiled tests found; rebuild with npm ci && npm run build');
        const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: packageRoot, stdio: 'inherit' });
        if (run.error)
            throw run.error;
        process.exitCode = run.status ?? 1;
    }
    catch (error) {
        process.stderr.write(`COSMIC: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 2;
    }
}
