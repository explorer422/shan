import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { loadEnvConfig, sendS3Request } from './lib/r2-client.mjs';

const config = loadEnvConfig();
if (!config.isConfigured) {
  console.error('[test-phase3b5] Error: Missing R2 credentials in .env');
  process.exit(1);
}

export async function runDeliveryTest() {
  const uid = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const testKey = `_connectivity-tests/phase3b5-${uid}.webp`;
  const contentType = 'image/webp';
  const cacheControl = 'public, max-age=60';

  console.log('[test-phase3b5] Starting Public Delivery Validation...');
  console.log(`[test-phase3b5] Test Object Key: ${testKey}`);

  // 1. Generate small synthetic WebP image using Sharp
  const testImageBuffer = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 42, g: 120, b: 90 },
    },
  })
    .webp({ quality: 80 })
    .toBuffer();

  const localSha256 = crypto
    .createHash('sha256')
    .update(testImageBuffer)
    .digest('hex');
  const localSize = testImageBuffer.length;

  console.log(`[test-phase3b5] Generated WebP: ${localSize} B, 120x80`);
  console.log(`[test-phase3b5] Local SHA-256: ${localSha256}`);

  let uploaded = false;

  try {
    // 2. Pre-check: Ensure key does not exist
    console.log('\n[Step 1] S3 Pre-check: Verify key does not exist');
    const preRes = await sendS3Request('HEAD', testKey, {}, config);
    console.log(`  Pre-check HEAD status: ${preRes.status}`);
    assert.equal(preRes.status, 404, 'Test key must not exist before PUT');
    console.log('  ✓ Key is available.');

    // 3. S3 PUT: Upload with metadata and short cache lifetime
    console.log('\n[Step 2] S3 PUT: Upload test image with SHA-256 metadata');
    const putRes = await sendS3Request(
      'PUT',
      testKey,
      {
        body: testImageBuffer,
        extraHeaders: {
          'content-type': contentType,
          'cache-control': cacheControl,
          'x-amz-meta-sha256': localSha256,
        },
      },
      config
    );
    console.log(`  PUT status: ${putRes.status}`);
    assert.equal(putRes.status, 200, 'S3 PUT must return 200');
    uploaded = true;
    console.log('  ✓ S3 PUT succeeded.');

    // 4. S3 HEAD: Verify metadata and content length
    console.log('\n[Step 3] S3 HEAD: Verify uploaded object metadata');
    const headRes = await sendS3Request('HEAD', testKey, {}, config);
    console.log(`  HEAD status: ${headRes.status}`);
    assert.equal(headRes.status, 200, 'S3 HEAD must return 200');
    const remoteMetaSha = headRes.headers.get('x-amz-meta-sha256');
    const remoteType = headRes.headers.get('content-type');
    const remoteLen = headRes.headers.get('content-length');
    console.log(`  Content-Type: ${remoteType}`);
    console.log(`  Content-Length: ${remoteLen}`);
    console.log(`  x-amz-meta-sha256: ${remoteMetaSha}`);
    assert.equal(remoteMetaSha, localSha256, 'Metadata SHA-256 must match');
    assert.equal(remoteType, contentType, 'Content-Type must match');
    assert.equal(remoteLen, localSize.toString(), 'Content-Length must match');
    console.log('  ✓ S3 HEAD metadata verified.');

    // 5. S3 GET: Verify exact byte payload from origin
    console.log('\n[Step 4] S3 GET: Verify raw byte payload from origin');
    const getRes = await sendS3Request('GET', testKey, {}, config);
    assert.equal(getRes.status, 200, 'S3 GET must return 200');
    const originBuf = Buffer.from(await getRes.arrayBuffer());
    const originSha = crypto
      .createHash('sha256')
      .update(originBuf)
      .digest('hex');
    assert.equal(originSha, localSha256, 'Origin byte SHA-256 must match');
    console.log('  ✓ S3 origin bytes match local file 100%.');

    // 6. Public Delivery: Fetch via https://media.shan.page
    const publicUrl = `https://media.shan.page/${testKey}`;
    console.log(`\n[Step 5] Public Delivery: GET ${publicUrl}`);
    const pubRes = await fetch(publicUrl);
    console.log(`  Public HTTP Status: ${pubRes.status}`);
    assert.equal(pubRes.status, 200, 'Public custom domain must return 200');

    const pubHeaders = {};
    for (const [k, v] of pubRes.headers.entries()) {
      pubHeaders[k] = v;
    }
    console.log('  Public Headers:');
    console.log(`    content-type: ${pubHeaders['content-type']}`);
    console.log(`    content-length: ${pubHeaders['content-length']}`);
    console.log(`    cache-control: ${pubHeaders['cache-control']}`);
    console.log(`    cf-cache-status: ${pubHeaders['cf-cache-status']}`);
    console.log(`    cf-ray: ${pubHeaders['cf-ray']}`);
    console.log(`    server: ${pubHeaders['server']}`);

    assert.ok(
      pubHeaders['content-type'].includes('image/webp'),
      'Public response must be image/webp'
    );
    assert.ok(
      pubHeaders['cache-control'],
      'Public response must include Cache-Control'
    );

    const pubBuf = Buffer.from(await pubRes.arrayBuffer());
    const pubSha256 = crypto
      .createHash('sha256')
      .update(pubBuf)
      .digest('hex');
    console.log(`  Public response size: ${pubBuf.length} B`);
    console.log(`  Public SHA-256: ${pubSha256}`);
    assert.equal(
      pubSha256,
      localSha256,
      'Public response SHA-256 must match local file exactly'
    );
    console.log('  ✓ Public response payload is 100% byte-identical.');

    // 7. Verify image decodability
    console.log(
      '\n[Step 6] Image Validation: Decode delivered image with Sharp'
    );
    const decodedMeta = await sharp(pubBuf).metadata();
    console.log(
      `  Decoded: format=${decodedMeta.format}, ` +
        `dimensions=${decodedMeta.width}x${decodedMeta.height}`
    );
    assert.equal(decodedMeta.format, 'webp', 'Decoded format must be webp');
    assert.equal(decodedMeta.width, 120, 'Width must be 120');
    assert.equal(decodedMeta.height, 80, 'Height must be 80');
    console.log('  ✓ Delivered WebP is valid and decodable.');

    console.log('\n[test-phase3b5] ALL PUBLIC DELIVERY CHECKS PASSED! ✓');

    return {
      testKey,
      publicUrl,
      localSha256,
      localSize,
      publicStatus: pubRes.status,
      pubHeaders,
      decodedMeta,
    };
  } finally {
    if (uploaded) {
      console.log('\n[Step 7] Cleanup: Delete test object from R2 origin');
      const delRes = await sendS3Request('DELETE', testKey, {}, config);
      console.log(`  DELETE status: ${delRes.status}`);

      console.log('\n[Step 8] Confirmation: Verify S3 origin returns 404');
      const postHead = await sendS3Request('HEAD', testKey, {}, config);
      console.log(`  Post-delete HEAD status: ${postHead.status}`);
      assert.equal(
        postHead.status,
        404,
        'Origin S3 HEAD must return 404 after deletion'
      );
      console.log('  ✓ Test object confirmed deleted from R2 bucket origin.');
    }
  }
}

if (process.argv[1]?.endsWith('test-phase3b5-delivery.mjs')) {
  runDeliveryTest().catch((err) => {
    console.error('[test-phase3b5] Error:', err);
    process.exit(1);
  });
}
