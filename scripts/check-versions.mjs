#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packages = [
  'apps/desktop/package.json',
  'apps/website/package.json',
  'packages/ui/package.json',
];

const versions = packages.map((path) => {
  const pkg = JSON.parse(readFileSync(resolve(path), 'utf8'));
  return { path, version: pkg.version };
});

const unique = [...new Set(versions.map((entry) => entry.version))];
if (unique.length !== 1) {
  console.error('App package versions are out of sync:');
  for (const entry of versions) {
    console.error(`  ${entry.path}: ${entry.version}`);
  }
  process.exit(1);
}

console.log(`All app packages at version ${unique[0]}.`);
