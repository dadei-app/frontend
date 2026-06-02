#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VERSION_PACKAGE_PATHS } from './version-packages.mjs';

const versions = VERSION_PACKAGE_PATHS.map((path) => {
  const pkg = JSON.parse(readFileSync(resolve(path), 'utf8'));
  return { path, version: pkg.version };
});

const missing = versions.filter((entry) => !entry.version);
if (missing.length > 0) {
  console.error('Missing version field:');
  for (const entry of missing) {
    console.error(`  ${entry.path}`);
  }
  process.exit(1);
}

const unique = [...new Set(versions.map((entry) => entry.version))];
if (unique.length !== 1) {
  console.error('Package versions are out of sync:');
  for (const entry of versions) {
    console.error(`  ${entry.path}: ${entry.version}`);
  }
  process.exit(1);
}

console.log(`All packages at version ${unique[0]} (source: ${VERSION_PACKAGE_PATHS[0]}).`);
