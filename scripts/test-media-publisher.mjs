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
import { checkRemoteExists, parseScopeArgs } from './publish-media.mjs';
import { setupTestFixtures } from './test-fixture.mjs';

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, '.mock-r2');
const { manifest: manifestData, manifestPath: MANIFEST_PATH } =
  await setupTestFixtures();

console.log('[test-media-publisher] Starting Media Publisher Suite...');

// ---------------------------------------------------------------------------
// 1. Configuration & Endpoint Verification
// ---------------------------------------------------------------------------
console.log('\n[1] Configuration loading & EU endpoint verification');
const config = loadEnvConfig();
assert.equal(config.bucket, 'shan-media', 'Bucket must match shan-media');
assert.equal(config.jurisdiction, 'eu', 'Jurisdiction must be eu');
assert.ok(
  config.host.endsWith('.eu.r2.cloudflarestorage.com'),
  'Host must use .eu.r2.cloudflarestorage.com'
);
console.log('  ✓ EU jurisdiction endpoint properly configured.');

// ---------------------------------------------------------------------------
// 2. MIME Type Mapping
// ---------------------------------------------------------------------------
console.log('\n[2] MIME type detection');
assert.equal(getMimeType('photo.webp'), 'image/webp');
assert.equal(getMimeType('photo.avif'), 'image/avif');
assert.equal(getMimeType('icon.png'), 'image/png');
assert.equal(getMimeType('unknown.bin'), 'application/octet-stream');
console.log('  ✓ MIME types mapped accurately.');

// ---------------------------------------------------------------------------
// 3. SigV4 Signing Construction
// ---------------------------------------------------------------------------
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
  },
  testConfig
);
assert.ok(signedReq.headers.Authorization, 'Authorization header present');
assert.ok(
  signedReq.headers.Authorization.includes('SignedHeaders='),
  'SignedHeaders parameter present'
);
assert.ok(
  signedReq.headers.Authorization.includes('x-amz-meta-sha256'),
  'x-amz-meta-sha256 must be included in SignedHeaders'
);
console.log('  ✓ SigV4 headers, metadata, and signed headers verified.');

// ---------------------------------------------------------------------------
// 4. CLI Argument Parsing Unit Tests
// ---------------------------------------------------------------------------
console.log('\n[4] parseScopeArgs() unit tests');
assert.deepEqual(parseScopeArgs(['--dry-run', '--item', 'story/cover']), [
  'story/cover',
]);
assert.deepEqual(
  parseScopeArgs(['--item', 'm/p1', '--mock', '--item', 'm/p2']),
  ['m/p1', 'm/p2']
);
assert.deepEqual(
  parseScopeArgs(['--item=story/cover', '--item=moment/p1']),
  ['story/cover', 'moment/p1']
);
assert.throws(
  () => parseScopeArgs(['--item']),
  /--item requires a media ID argument/
);
assert.throws(
  () => parseScopeArgs(['--item', '--prod']),
  /--item requires a media ID argument/
);
assert.throws(
  () => parseScopeArgs(['--item=']),
  /--item requires a media ID argument/
);
console.log('  ✓ CLI argument parsing correctly extracts scoped media IDs.');

// ---------------------------------------------------------------------------
// 5. Default Invocation Safety & Dry-Run
// ---------------------------------------------------------------------------
console.log('\n[5] Default invocation safety (no flags => dry-run)');
const defaultOut = execSync(
  `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
    'node scripts/publish-media.mjs',
  { encoding: 'utf-8' }
);
assert.ok(
  defaultOut.includes('Mode: DRY-RUN'),
  'Default execution must be DRY-RUN'
);
assert.ok(
  defaultOut.includes('(dry-run) Would upload'),
  'Must simulate without real uploads'
);
console.log('  ✓ Default execution safely falls back to DRY-RUN.');

// ---------------------------------------------------------------------------
// 6. Scoped Dry-Run CLI Execution
// ---------------------------------------------------------------------------
console.log('\n[6] Scoped dry-run CLI execution');
const singleDryOut = execSync(
  `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
    'node scripts/publish-media.mjs --dry-run ' +
    '--item test/sample-story/cover',
  { encoding: 'utf-8' }
);
assert.ok(singleDryOut.includes('Scope: 1 item(s)'));
assert.ok(singleDryOut.includes('uploaded: 4'));
assert.ok(!singleDryOut.includes('test/sample-moment'));
console.log('  ✓ Single item scope processed exactly 4 variants.');

const multiDryOut = execSync(
  `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
    'node scripts/publish-media.mjs --dry-run ' +
    '--item test/sample-moment/photo-01 ' +
    '--item test/sample-moment/photo-02',
  { encoding: 'utf-8' }
);
assert.ok(multiDryOut.includes('Scope: 2 item(s)'));
assert.ok(multiDryOut.includes('uploaded: 8'));
assert.ok(!multiDryOut.includes('test/sample-story'));
console.log('  ✓ Multi-item scope processed exactly 8 variants.');

// ---------------------------------------------------------------------------
// 7. Invalid & Nonexistent Media ID Error Handling
// ---------------------------------------------------------------------------
console.log('\n[7] Invalid & nonexistent media ID error handling');
try {
  execSync(
    `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
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

// ---------------------------------------------------------------------------
// 8. Mock Mode Upload & Idempotency
// ---------------------------------------------------------------------------
console.log('\n[8] Mock mode upload & idempotency with SHA-256');
const totalVariants = Object.keys(manifestData.items).length * 4;

if (fs.existsSync(MOCK_DIR)) {
  fs.rmSync(MOCK_DIR, { recursive: true, force: true });
}
const mockCmd =
  `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
  'node scripts/publish-media.mjs --mock';
const mockOut1 = execSync(mockCmd, { encoding: 'utf-8' });
assert.ok(mockOut1.includes('Mode: LOCAL MOCK'));
assert.ok(mockOut1.includes(`uploaded: ${totalVariants}`));
assert.ok(mockOut1.includes('skipped: 0'));

// Verify metadata files were generated in .mock-r2
const targetKey =
  manifestData.items['test/sample-story/cover'].variants.card800.key;
const sampleMeta = path.join(MOCK_DIR, `${targetKey}.meta.json`);
assert.ok(fs.existsSync(sampleMeta), 'Metadata file must be stored in mock');
const parsedMeta = JSON.parse(fs.readFileSync(sampleMeta, 'utf-8'));
assert.ok(parsedMeta.sha256, 'Metadata must include sha256 checksum');

// Second run: must skip all stored files via checksum match
const mockOut2 = execSync(mockCmd, { encoding: 'utf-8' });
assert.ok(mockOut2.includes('uploaded: 0'));
assert.ok(mockOut2.includes(`skipped: ${totalVariants}`));
assert.ok(mockOut2.includes(`verified: ${totalVariants}`));
console.log(
  `  ✓ Mock mode uploaded ${totalVariants} files with verified SHA-256.`
);

// ---------------------------------------------------------------------------
// 9. Collision Protection (Same byte length, divergent content)
// ---------------------------------------------------------------------------
console.log('\n[9] Collision protection on divergent content');
const targetFile = path.join(MOCK_DIR, targetKey);
const targetMeta = `${targetFile}.meta.json`;
const originalBytes = fs.readFileSync(targetFile);
const originalMeta = JSON.parse(fs.readFileSync(targetMeta, 'utf-8'));

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
  JSON.stringify({ ...originalMeta, sha256: tamperedSha256 })
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

// Restore original file and metadata
fs.writeFileSync(targetFile, originalBytes);
fs.writeFileSync(targetMeta, JSON.stringify(originalMeta));

// ---------------------------------------------------------------------------
// 10. Missing Checksum Metadata Fallback & Verify-Only Mode
// ---------------------------------------------------------------------------
console.log('\n[10] Missing metadata fallback & verify-only mode');
const targetMetaPath = `${targetFile}.meta.json`;
if (fs.existsSync(targetMetaPath)) {
  fs.unlinkSync(targetMetaPath);
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
console.log('  ✓ Fallback body verification succeeded on missing metadata.');

// Re-publish to restore metadata
execSync(mockCmd, { encoding: 'utf-8' });

const verifyOut = execSync(
  `SHAN_MANIFEST_PATH="${MANIFEST_PATH}" ` +
    'node scripts/publish-media.mjs --mock --verify-only',
  { encoding: 'utf-8' }
);
assert.ok(verifyOut.includes('Mode: VERIFY-ONLY'));
assert.ok(verifyOut.includes(`skipped: ${totalVariants}`));
assert.ok(verifyOut.includes('uploaded: 0'));
console.log(
  `  ✓ Verify-only mode verified all ${totalVariants} objects.`
);

console.log(
  '\n[test-media-publisher] ALL PUBLISHER REGRESSION CHECKS PASSED! ✓'
);
