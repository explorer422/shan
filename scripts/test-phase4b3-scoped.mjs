import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { parseScopeArgs } from './publish-media.mjs';

console.log('[test-phase4b3] Starting Scoped Media Publishing Test Suite...');

// ---------------------------------------------------------------------------
// 1. Argument parsing unit tests
// ---------------------------------------------------------------------------
console.log('\n[1] parseScopeArgs() unit tests');

// Single --item <id>
const parsed1 = parseScopeArgs(['--dry-run', '--item', 'story/cover']);
assert.deepEqual(parsed1, ['story/cover']);

// Repeated --item <id>
const parsed2 = parseScopeArgs([
  '--item',
  'moment/p1',
  '--mock',
  '--item',
  'moment/p2',
]);
assert.deepEqual(parsed2, ['moment/p1', 'moment/p2']);

// Syntax --item=<id>
const parsed3 = parseScopeArgs(['--item=story/cover', '--item=moment/p1']);
assert.deepEqual(parsed3, ['story/cover', 'moment/p1']);

// Missing argument throws error
assert.throws(
  () => parseScopeArgs(['--item']),
  /--item requires a media ID argument/,
  'Must throw when --item has no value'
);
assert.throws(
  () => parseScopeArgs(['--item', '--prod']),
  /--item requires a media ID argument/,
  'Must throw when --item is followed by another flag'
);
assert.throws(
  () => parseScopeArgs(['--item=']),
  /--item requires a media ID argument/,
  'Must throw when --item= is empty'
);
console.log('  ✓ CLI argument parsing correctly extracts scoped media IDs.');

// ---------------------------------------------------------------------------
// 2. Scoped Dry-Run CLI validation
// ---------------------------------------------------------------------------
console.log('\n[2] Scoped dry-run CLI execution');
const singleDryOut = execSync(
  'node scripts/publish-media.mjs --dry-run ' +
    '--item stories/forest-time/cover',
  { encoding: 'utf-8' }
);
assert.ok(singleDryOut.includes('Scope: 1 item(s)'));
assert.ok(singleDryOut.includes('uploaded: 4'));
assert.ok(!singleDryOut.includes('moments/above-clouds'));
console.log('  ✓ Single item scope processed exactly 4 variants.');

const multiDryOut = execSync(
  'node scripts/publish-media.mjs --dry-run ' +
    '--item moments/above-clouds/photo-01 ' +
    '--item moments/above-clouds/photo-02',
  { encoding: 'utf-8' }
);
assert.ok(multiDryOut.includes('Scope: 2 item(s)'));
assert.ok(multiDryOut.includes('uploaded: 8'));
assert.ok(!multiDryOut.includes('stories/forest-time'));
console.log('  ✓ Multi-item scope processed exactly 8 variants.');

// ---------------------------------------------------------------------------
// 3. Invalid & Nonexistent Media ID handling
// ---------------------------------------------------------------------------
console.log('\n[3] Invalid & nonexistent media ID error handling');
try {
  execSync(
    'node scripts/publish-media.mjs --item nonexistent/sample/cover',
    { stdio: 'pipe' }
  );
  assert.fail('Command should fail for nonexistent media ID');
} catch (err) {
  const stderr = err.stderr.toString();
  assert.ok(
    stderr.includes("Media ID 'nonexistent/sample/cover' not found in manifest")
  );
  assert.equal(err.status, 1);
  console.log('  ✓ Nonexistent media ID cleanly rejected with exit code 1.');
}

try {
  execSync('node scripts/publish-media.mjs --item', { stdio: 'pipe' });
  assert.fail('Command should fail for bare --item flag');
} catch (err) {
  const stderr = err.stderr.toString();
  assert.ok(stderr.includes('--item requires a media ID argument'));
  assert.equal(err.status, 1);
  console.log('  ✓ Bare --item flag cleanly rejected with exit code 1.');
}

// ---------------------------------------------------------------------------
// 4. Scoped Mock publishing & verification
// ---------------------------------------------------------------------------
console.log('\n[4] Scoped mock mode publishing & verification');
const mockOut = execSync(
  'node scripts/publish-media.mjs --mock ' +
    '--item stories/forest-time/cover',
  { encoding: 'utf-8' }
);
assert.ok(mockOut.includes('Scope: 1 item(s)'));
assert.ok(mockOut.includes('verified: 4'));
console.log('  ✓ Scoped mock publish verified exactly 4 variants.');

const verifyOut = execSync(
  'node scripts/publish-media.mjs --mock --verify-only ' +
    '--item moments/above-clouds/photo-01 ' +
    '--item moments/above-clouds/photo-02',
  { encoding: 'utf-8' }
);
assert.ok(verifyOut.includes('Scope: 2 item(s)'));
assert.ok(verifyOut.includes('skipped: 8'));
assert.ok(verifyOut.includes('verified: 8'));
console.log('  ✓ Scoped verify-only verified exactly 8 variants.');

// ---------------------------------------------------------------------------
// 5. Unscoped publishing backward compatibility
// ---------------------------------------------------------------------------
console.log('\n[5] Unscoped publishing backward compatibility');
const unscopedDry = execSync('node scripts/publish-media.mjs --dry-run', {
  encoding: 'utf-8',
});
const manifestData = JSON.parse(
  fs.readFileSync('src/data/media-manifest.json', 'utf-8')
);
const manifestCount = Object.keys(manifestData.items).length;
const totalExpected = manifestCount * 4;
assert.ok(
  unscopedDry.includes(`Loaded ${manifestCount} items from manifest.`)
);
assert.ok(unscopedDry.includes(`uploaded: ${totalExpected}`));
console.log('  ✓ Unscoped mode operates normally over full manifest.');

console.log('\n[test-phase4b3] ALL SCOPED PUBLISHING CHECKS PASSED! ✓');
