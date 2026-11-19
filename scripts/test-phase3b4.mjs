import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  loadEnvConfig,
  getMimeType,
  buildSignedRequest,
} from './lib/r2-client.mjs';

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, '.mock-r2');

console.log('[test-phase3b4] Starting Phase 3B-4 regression suite...');

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

// 3. S3 SigV4 request construction
console.log('\n[3] SigV4 request construction');
const testConfig = {
  host: 'example.eu.r2.cloudflarestorage.com',
  bucket: 'test-bucket',
  region: 'auto',
  service: 's3',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key-32-chars-long-xxx',
};
const signedReq = buildSignedRequest(
  'PUT',
  'test/image.webp',
  {
    body: 'binary-payload',
    extraHeaders: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
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
console.log('  ✓ SigV4 headers, scope, and metadata verified.');

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
console.log('\n[6] Mock mode upload & idempotency');
if (fs.existsSync(MOCK_DIR)) {
  fs.rmSync(MOCK_DIR, { recursive: true, force: true });
}
const mockOut1 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockOut1.includes('Mode: LOCAL MOCK'));
assert.ok(mockOut1.includes('uploaded: 64'));
assert.ok(mockOut1.includes('skipped: 0'));

// Second run: must skip all 64 already-stored files
const mockOut2 = execSync('node scripts/publish-media.mjs --mock', {
  encoding: 'utf-8',
});
assert.ok(mockOut2.includes('uploaded: 0'));
assert.ok(mockOut2.includes('skipped: 64'));
assert.ok(mockOut2.includes('verified: 64'));
console.log('  ✓ Mock mode uploaded 64 files and verified idempotency.');

// 7. Verify-only mode
console.log('\n[7] Verify-only mode');
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

console.log('\n[test-phase3b4] ALL PHASE 3B-4 REGRESSION CHECKS PASSED! ✓');
