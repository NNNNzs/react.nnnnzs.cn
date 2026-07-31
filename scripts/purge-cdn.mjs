#!/usr/bin/env node
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function readChangedFiles(file) {
  try {
    return readFileSync(resolve(file), 'utf8')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function writeManifest(output, manifest) {
  const target = resolve(output);
  const temporary = `${target}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
  console.log(`CDN purge manifest written: ${target}`);
  console.log(`changedFiles=${manifest.changedFiles.length} fullSite=${manifest.fullSite}`);
}

const args = process.argv.slice(2);
const changedFile = readOption(args, '--changed-file');
const output = readOption(args, '--output') || '.cdn-purge/pending.json';
const commit = readOption(args, '--commit') || process.env.COMMIT_SHA || 'unknown';
const version = readOption(args, '--version') || process.env.VERSION || 'unknown';
const fullSite = args.includes('--full-site');

if (!changedFile && !fullSite) {
  console.error('Usage: purge-cdn.mjs --changed-file <file> [--output <file>] [--commit <sha>] [--version <version>]');
  console.error('   or: purge-cdn.mjs --full-site [--output <file>]');
  process.exit(1);
}

writeManifest(output, {
  source: 'deploy',
  changedFiles: changedFile ? readChangedFiles(changedFile) : [],
  fullSite,
  commit,
  version,
  createdAt: new Date().toISOString(),
});
