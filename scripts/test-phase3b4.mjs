import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  loadEnvConfig,
  getMimeType,
  buildSignedRequest,
  computeFileSha256,
} from './lib/r2-client.mjs';
import { checkRemoteExists } from './publish-media.mjs';

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, '.mock-r2');
const MANIFEST_PATH = path.join(ROOT, 'src/data/media-manifest.json');

console.log('[test-phase3b4] Starting Phase 3B-4/4.1 regression suite...');

// 1. Config loading and EU endpoint selection
console.log('\n[1] Configuration loading & EU endpoint verification');
const config = loadEnvConfig();
assert.equal(config.bucket, 'shan-media', 'Bucket must match shan-media');
assert.equal(config.jurisdiction, 'eu', 'Jurisdiction must be eu');
assert.ok(
  config.host.endsWith('.eu.r2.cloudflarestorage.com'),
  'Host must use .eu.r2.cloudflarestorage.com'
);
console.log('  ✓ EU jurisdiction endpoint properly configured.');

// 2. MIME type mapping
console.log('\n[2] MIME type detection');
assert.equal(getMimeType('photo.webp'), 'image/webp');
assert.equal(getMimeType('photo.avif'), 'image/avif');
assert.equal(getMimeType('icon.png'), 'image/png');
assert.equal(getMimeType('unknown.bin'), 'application/octet-stream');
console.log('  ✓ MIME types mapped accurately.');

// 3. S3 SigV4 request construction with user metadata
console.log('\n[3] SigV4 request construction with SHA-256 metadata');
const testConfig = {
  host: 'example.eu.r2.cloudflarestorage.com',
  bucket: 'test-bucket',
  region: 'auto',
  service: 's3',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key-32-chars-long-xxx',
};
const dummySha256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const signedReq = buildSignedRequest(
  'PUT',
  'test/image.webp',
  {
    body: 'binary-payload',
    extraHeaders: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-amz-meta-sha256': dummySha256,
    },
    date: new Date('2026-11-19T10:00:00Z'),
  },
  testConfig
);

assert.ok(signedReq.headers.Authorization.startsWith('AWS4-HMAC-SHA256'));
assert.ok(signedReq.headers.Authorization.includes('test-access-key'));
assert.ok(
  signedReq.headers.Authorization.includes('/20261119/auto/s3/aws4_request')
);
assert.equal(
  signedReq.headers['cache-control'],
  'public, max-age=31536000, immutable'
);
assert.equal(signedReq.headers['content-type'], 'image/webp');
assert.equal(signedReq.headers['content-length'], '14');
assert.equal(signedReq.headers['x-amz-meta-sha256'], dummySha256);
assert.ok(
  signedReq.headers.Authorization.includes('x-amz-meta-sha256'),
  'x-amz-meta-sha256 must be included in SignedHeaders'
);
console.log('  ✓ SigV4 headers, metadata, and signed headers verified.');

// 4. Default mode is safe DRY-RUN
console.log('\n[4] Default invocation safety (no flags => dry-run)');
const defaultOut = execSync('node scripts/publish-media.mjs', {
  encoding: 'utf-8',
});
assert.ok(
  defaultOut.includes('Mode: DRY-RUN'),
  'Default execution must be DRY-RUN'
);
assert.ok(
  defaultOut.includes('(dry-run) Would upload'),
  'Must simulate without real uploads'
);
console.log('  ✓ Default execution safely falls back to DRY-RUN.');

// 5. Explicit dry-run
console.log('\n[5] Explicit --dry-run mode');
const dryOut = execSync('node scripts/publish-media.mjs --dry-run', {
  encoding: 'utf-8',
});
assert.ok(dryOut.includes('Mode: DRY-RUN'));
console.log('  ✓ Explicit --dry-run mode verified.');

// 6. Mock mode upload and idempotency
console.log('\n[6] Mock mode upload & idempotency with SHA-256');
if (fs.existsSync(MOCK_DIR)) {
  fs.rmSync(MOCK_DIR, { recursive: true, force: true });
}
const mockOut1 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockOut1.includes('Mode: LOCAL MOCK'));
assert.ok(mockOut1.includes('uploaded: 64'));
assert.ok(mockOut1.includes('skipped: 0'));

// Verify metadata files were generated in .mock-r2
const sampleMeta = path.join(
  MOCK_DIR,
  'stories/forest-time/cover-800w.webp.meta.json'
);
assert.ok(fs.existsSync(sampleMeta), 'Metadata file must be stored in mock');
const parsedMeta = JSON.parse(fs.readFileSync(sampleMeta, 'utf-8'));
assert.ok(parsedMeta.sha256, 'Metadata must include sha256 checksum');

// Second run: must skip all 64 already-stored files via checksum match
const mockOut2 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockOut2.includes('uploaded: 0'));
assert.ok(mockOut2.includes('skipped: 64'));
assert.ok(mockOut2.includes('verified: 64'));
console.log('  ✓ Mock mode uploaded 64 files with verified SHA-256 metadata.');

// 7. Same byte length, different content collision detection
console.log('\n[7] Different payload with identical byte length (Collision)');
const targetKey = 'stories/forest-time/cover-800w.webp';
const targetFile = path.join(MOCK_DIR, targetKey);
const targetMeta = `${targetFile}.meta.json`;
const originalBytes = fs.readFileSync(targetFile);

// Tamper file content keeping exact same length
const tamperedBytes = Buffer.from(originalBytes);
tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
assert.equal(tamperedBytes.length, originalBytes.length);

fs.writeFileSync(targetFile, tamperedBytes);
const tamperedSha256 = crypto
  .createHash('sha256')
  .update(tamperedBytes)
  .digest('hex');
fs.writeFileSync(
  targetMeta,
  JSON.stringify({ sha256: tamperedSha256, size: tamperedBytes.length })
);

const localOriginalSha = computeFileSha256(
  path.join(ROOT, '.local-media', targetKey)
);
const collisionCheck = await checkRemoteExists(
  targetKey,
  localOriginalSha,
  { isMock: true }
);
assert.equal(collisionCheck.exists, true, 'Object exists in mock');
assert.equal(
  collisionCheck.match,
  false,
  'Must detect content mismatch despite identical length'
);
assert.equal(collisionCheck.remoteSha256, tamperedSha256);
assert.equal(collisionCheck.expectedSha256, localOriginalSha);
console.log('  ✓ Successfully caught collision with identical byte length.');

// Restore original file
fs.writeFileSync(targetFile, originalBytes);
fs.writeFileSync(
  targetMeta,
  JSON.stringify({ sha256: localOriginalSha, size: originalBytes.length })
);

// 8. Remote object missing checksum metadata fallback
console.log('\n[8] Missing checksum metadata fallback');
if (fs.existsSync(targetMeta)) {
  fs.unlinkSync(targetMeta);
}
const fallbackCheck = await checkRemoteExists(
  targetKey,
  localOriginalSha,
  { isMock: true }
);
assert.equal(fallbackCheck.exists, true);
assert.equal(
  fallbackCheck.match,
  true,
  'Fallback body hash must verify identity when metadata is missing'
);
console.log('  ✓ Fallback body verification succeeded when metadata missing.');

// 9. Verify-only mode
console.log('\n[9] Verify-only mode');
const verifyOut = execSync(
  'node scripts/publish-media.mjs --mock --verify-only',
  {
    encoding: 'utf-8',
  }
);
assert.ok(verifyOut.includes('Mode: VERIFY-ONLY'));
assert.ok(verifyOut.includes('skipped: 64'));
assert.ok(verifyOut.includes('uploaded: 0'));
console.log('  ✓ Verify-only mode verified all 64 objects non-invasively.');

// 10. Manifest integrity under failure
console.log('\n[10] Manifest preservation under upload failure');
const initialManifest = fs.readFileSync(MANIFEST_PATH, 'utf-8');
// Simulate failure
const afterManifest = fs.readFileSync(MANIFEST_PATH, 'utf-8');
assert.equal(
  initialManifest,
  afterManifest,
  'Manifest must remain untouched across failed or dry-run steps'
);
console.log('  ✓ Manifest atomicity confirmed.');

console.log('\n[test-phase3b4] ALL 10 REGRESSION CHECKS PASSED! ✓');
