#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseRef = process.argv[2] ?? 'origin/main';
const desktopPkg = 'apps/desktop/package.json';
const sourcePrefixes = ['apps/', 'packages/'];

function readVersion(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8')).version;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function hasSourceChanges() {
  let diff;
  try {
    diff = git(['diff', '--name-only', `${baseRef}...HEAD`, '--', ...sourcePrefixes]);
  } catch {
    console.warn(`Could not diff against ${baseRef}; skipping version bump check.`);
    return false;
  }

  return diff
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .some((file) => !file.endsWith('package.json') && !file.endsWith('package-lock.json'));
}

const currentVersion = readVersion(desktopPkg);
let baseVersion = '0.0.0';

try {
  baseVersion = JSON.parse(git(['show', `${baseRef}:${desktopPkg}`])).version;
} catch {
  console.warn(`No ${desktopPkg} on ${baseRef}; treating base version as 0.0.0.`);
}

if (!hasSourceChanges()) {
  console.log('No source changes under apps/ or packages/; version bump not required.');
  process.exit(0);
}

if (compareSemver(currentVersion, baseVersion) <= 0) {
  console.error(
    `Source files changed but app version was not incremented (${baseVersion} -> ${currentVersion}).`,
  );
  console.error(`Bump ${desktopPkg} (and matching workspace packages) before merging.`);
  process.exit(1);
}

console.log(`Version bumped ${baseVersion} -> ${currentVersion}.`);
