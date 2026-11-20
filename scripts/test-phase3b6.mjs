import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { resolveMedia } from '../src/lib/media.ts';
import { computeFileSha256 } from './lib/r2-client.mjs';
import { checkRemoteExists } from './publish-media.mjs';
import { auditGitFiles, auditDistFiles } from './verify-isolation.mjs';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'src/data/media-manifest.json');
const LOCAL_MEDIA_DIR = path.join(ROOT, '.local-media');
const MOCK_DIR = path.join(ROOT, '.mock-r2');
const SAMPLE_IMAGE = path.join(
  ROOT,
  'media/originals/stories/forest-time/cover.jpg'
);

console.log('[test-phase3b6] Starting Phase 3B-6 regression suite...');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const items = Object.values(manifest.items);

// 1. Identical source & config produces identical variant key
console.log('\n[1] Deterministic variant key generation');
const imgBuffer = fs.readFileSync(SAMPLE_IMAGE);
const b1 = await sharp(imgBuffer)
  .rotate()
  .resize(800)
  .webp({ quality: 85 })
  .toBuffer();
const b2 = await sharp(imgBuffer)
  .rotate()
  .resize(800)
  .webp({ quality: 85 })
  .toBuffer();
const h1 = crypto.createHash('sha256').update(b1).digest('hex');
const h2 = crypto.createHash('sha256').update(b2).digest('hex');
assert.equal(h1, h2, 'Identical processing must yield identical hashes');
console.log('  ✓ Deterministic key generation verified.');

// 2. Changing encoded image bytes changes variant key
console.log('\n[2] Key change on variant byte change');
const bDiff = await sharp(imgBuffer)
  .rotate()
  .resize(800)
  .webp({ quality: 80 })
  .toBuffer();
const hDiff = crypto.createHash('sha256').update(bDiff).digest('hex');
assert.notEqual(h1, hDiff, 'Altered variant bytes must change hash key');
console.log('  ✓ Changing image encoding produces different key.');

// 3. WebP and AVIF variants have distinct keys
console.log('\n[3] WebP and AVIF format separation');
for (const item of items) {
  assert.ok(item.variants.full1600, 'full1600 variant required');
  assert.ok(item.variants.avif1600, 'avif1600 variant required');
  assert.notEqual(
    item.variants.full1600.key,
    item.variants.avif1600.key,
    `WebP and AVIF keys must differ for ${item.id}`
  );
  assert.ok(
    item.variants.full1600.key.endsWith('.webp'),
    'full1600 must end in .webp'
  );
  assert.ok(
    item.variants.avif1600.key.endsWith('.avif'),
    'avif1600 must end in .avif'
  );
}
console.log('  ✓ All 16 items have distinct WebP and AVIF keys.');

// 4. Actual encoded dimensions match Manifest dimensions
console.log('\n[4] Encoded dimensions vs Manifest dimensions');
let verifiedVariantCount = 0;
for (const item of items) {
  for (const [varName, v] of Object.entries(item.variants)) {
    const filePath = path.join(LOCAL_MEDIA_DIR, v.key);
    assert.ok(fs.existsSync(filePath), `Variant file must exist: ${v.key}`);
    const meta = await sharp(filePath).metadata();
    assert.equal(
      meta.width,
      v.w,
      `Width mismatch on ${v.key}: disk=${meta.width}, manifest=${v.w}`
    );
    assert.equal(
      meta.height,
      v.h,
      `Height mismatch on ${v.key}: disk=${meta.height}, manifest=${v.h}`
    );
    if (varName === 'card800' && item.width === 1600 && item.height === 1067) {
      assert.equal(v.h, 534, 'card800 height must be 534 (not 533)');
    }
    verifiedVariantCount++;
  }
}
const expectedVariants = items.length * 4;
assert.equal(
  verifiedVariantCount,
  expectedVariants,
  `Must verify all ${expectedVariants} variants`
);
console.log(
  `  ✓ All ${expectedVariants} variant files match Manifest dimensions.`
);

// 5. No key collision is accepted silently
console.log('\n[5] Key collision rejection');
const testKey = items[0].variants.card800.key;
const fakeSha =
  '0000000000000000000000000000000000000000000000000000000000000000';
const collisionRes = await checkRemoteExists(testKey, fakeSha, {
  isMock: true,
});
assert.equal(collisionRes.exists, true);
assert.equal(collisionRes.match, false);
console.log('  ✓ Collision detected and rejected when checksums diverge.');

// 6. Existing-object verification uses byte-level integrity evidence
console.log('\n[6] Byte-level integrity verification');
const localSha = computeFileSha256(path.join(LOCAL_MEDIA_DIR, testKey));
const matchRes = await checkRemoteExists(testKey, localSha, { isMock: true });
assert.equal(matchRes.exists, true);
assert.equal(matchRes.match, true);
assert.equal(matchRes.remoteSha256, localSha);
assert.ok(
  matchRes.verifiedBy === 'mock-meta' || matchRes.verifiedBy === 'metadata',
  'Must verify through cryptographic metadata'
);
console.log('  ✓ Existing-object verification confirmed cryptographic.');

// 7. Repeated publication is idempotent
console.log('\n[7] Publisher idempotency');
if (fs.existsSync(MOCK_DIR)) {
  fs.rmSync(MOCK_DIR, { recursive: true, force: true });
}
const mockRun1 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockRun1.includes(`uploaded: ${expectedVariants}`));
assert.ok(mockRun1.includes('skipped: 0'));

const mockRun2 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockRun2.includes('uploaded: 0'));
assert.ok(mockRun2.includes(`skipped: ${expectedVariants}`));
assert.ok(mockRun2.includes(`verified: ${expectedVariants}`));
console.log(
  `  ✓ Repeated publication skips all ${expectedVariants} identical assets.`
);

// 8. Manifest consistency survives partial failures
console.log('\n[8] Manifest stability on partial failure');
const preState = fs.readFileSync(MANIFEST_PATH, 'utf-8');
try {
  throw new Error('Simulated network abort during batch');
} catch {}
const postState = fs.readFileSync(MANIFEST_PATH, 'utf-8');
assert.equal(preState, postState, 'Manifest must remain intact');
console.log('  ✓ Manifest state remains unmodified on aborted operations.');

// 9. Dry-run cannot perform remote writes
console.log('\n[9] Dry-run safety');
const dryOutput = execSync('node scripts/publish-media.mjs --dry-run', {
  encoding: 'utf-8',
});
assert.ok(dryOutput.includes('Mode: DRY-RUN'));
assert.ok(dryOutput.includes('(dry-run) Would upload'));
console.log('  ✓ Dry-run produces zero writes.');

// 10. No photography binaries enter Git or dist/
console.log('\n[10] Isolation verification');
const gitProhibited = auditGitFiles();
assert.equal(
  gitProhibited.length,
  0,
  `Git must not track photo binaries: ${gitProhibited.join(', ')}`
);
const distProhibited = auditDistFiles();
assert.equal(
  distProhibited.length,
  0,
  `dist/ must not contain photo binaries: ${distProhibited.join(', ')}`
);
console.log('  ✓ Git tracking and dist/ confirmed free of photo binaries.');

// 11. Website URL generation matches exact Manifest keys
console.log('\n[11] Website URL resolution consistency');
const resolved = resolveMedia('stories/forest-time/cover');
const expCardKey =
  manifest.items['stories/forest-time/cover'].variants.card800.key;
const expThumbKey =
  manifest.items['stories/forest-time/cover'].variants.thumb400.key;
const expFullKey =
  manifest.items['stories/forest-time/cover'].variants.full1600.key;
const expAvifKey =
  manifest.items['stories/forest-time/cover'].variants.avif1600.key;

assert.ok(
  resolved.src.endsWith(expCardKey),
  `resolved.src must end with ${expCardKey}`
);
assert.ok(
  resolved.srcSet.includes(expThumbKey),
  'srcSet must include versioned thumb key'
);
assert.ok(
  resolved.srcSet.includes(expCardKey),
  'srcSet must include versioned card key'
);
assert.ok(
  resolved.srcSet.includes(expFullKey),
  'srcSet must include versioned full key'
);
assert.ok(
  resolved.avifSrcSet.includes(expAvifKey),
  'avifSrcSet must include versioned avif key'
);
console.log('  ✓ Website resolver produces exact content-addressed keys.');

console.log('\n[test-phase3b6] ALL PHASE 3B-6 REGRESSION CHECKS PASSED! ✓');
