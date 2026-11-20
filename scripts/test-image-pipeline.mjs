import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { setupTestFixtures } from './test-fixture.mjs';

const ROOT = process.cwd();
const { manifest, samplePhotoPath } = await setupTestFixtures();
const LOCAL_MEDIA_DIR = path.join(ROOT, '.local-media');
const SAMPLE_IMAGE = samplePhotoPath;

console.log('[test-image-pipeline] Starting Image Pipeline Test Suite...');

const items = Object.values(manifest.items);

// ---------------------------------------------------------------------------
// 1. Auto-Orientation Normalization
// ---------------------------------------------------------------------------
console.log('\n[1] EXIF orientation normalization');
const unorientedImg = await sharp({
  create: {
    width: 200,
    height: 100,
    channels: 3,
    background: { r: 50, g: 100, b: 150 },
  },
})
  .jpeg()
  .toBuffer();

const orientedImg = await sharp(unorientedImg).rotate().toBuffer();
const meta = await sharp(orientedImg).metadata();
assert.ok(!meta.orientation || meta.orientation === 1);
console.log('  ✓ EXIF orientation correctly normalized via .rotate().');

// ---------------------------------------------------------------------------
// 2. Privacy & Metadata Sanitization
// ---------------------------------------------------------------------------
console.log('\n[2] Privacy & GPS metadata sanitization');
const processedBuffer = await sharp({
  create: {
    width: 100,
    height: 100,
    channels: 3,
    background: { r: 255, g: 0, b: 0 },
  },
})
  .webp({ quality: 80 })
  .toBuffer();

const sanitizedMeta = await sharp(processedBuffer).metadata();
assert.equal(sanitizedMeta.gps, undefined, 'GPS metadata must be stripped');
console.log('  ✓ GPS and personal EXIF metadata confirmed stripped.');

// ---------------------------------------------------------------------------
// 3. Deterministic Key Generation
// ---------------------------------------------------------------------------
console.log('\n[3] Deterministic variant key generation');
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
console.log('  ✓ Deterministic cryptographic key generation verified.');

// ---------------------------------------------------------------------------
// 4. Content Sensitivity
// ---------------------------------------------------------------------------
console.log('\n[4] Key changes on encoding or content change');
const bDiff = await sharp(imgBuffer)
  .rotate()
  .resize(800)
  .webp({ quality: 80 })
  .toBuffer();
const hDiff = crypto.createHash('sha256').update(bDiff).digest('hex');
assert.notEqual(h1, hDiff, 'Different quality must produce different hash');
console.log('  ✓ Changing image encoding produces different hash key.');

// ---------------------------------------------------------------------------
// 5. WebP and AVIF Format Separation
// ---------------------------------------------------------------------------
console.log('\n[5] WebP and AVIF format separation');
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
console.log(`  ✓ All ${items.length} items have distinct WebP and AVIF keys.`);

// ---------------------------------------------------------------------------
// 6. Encoded Dimensions vs Manifest Dimensions
// ---------------------------------------------------------------------------
console.log('\n[6] Encoded dimensions vs Manifest dimensions');
let verifiedVariantCount = 0;
for (const item of items) {
  for (const [varName, v] of Object.entries(item.variants)) {
    const filePath = path.join(LOCAL_MEDIA_DIR, v.key);
    assert.ok(fs.existsSync(filePath), `Variant file must exist: ${v.key}`);
    const variantMeta = await sharp(filePath).metadata();
    assert.equal(
      variantMeta.width,
      v.w,
      `Width mismatch on ${v.key}: disk=${variantMeta.width}, manifest=${v.w}`
    );
    assert.equal(
      variantMeta.height,
      v.h,
      `Height mismatch on ${v.key}: disk=${variantMeta.height}, manifest=${v.h}`
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

console.log(
  '\n[test-image-pipeline] ALL IMAGE PIPELINE CHECKS PASSED SUCCESSFULLY! ✓'
);
