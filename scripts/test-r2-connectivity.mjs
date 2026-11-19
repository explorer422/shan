import { loadEnvConfig, sendS3Request } from './lib/r2-client.mjs';

// ponytail: Validated live connectivity verification using shared R2 client
const config = loadEnvConfig();
if (!config.isConfigured) {
  console.error('[r2-test] Error: Missing required R2 credentials in .env');
  process.exit(1);
}

export async function runConnectivityTest() {
  const timestamp = Date.now();
  const testKey = `_connectivity-tests/phase3b4-${timestamp}.txt`;
  const testPayload =
    `SHAN R2 Connectivity Verification at ${new Date().toISOString()}`;
  const contentType = 'text/plain; charset=utf-8';
  const cacheControl = 'public, max-age=3600';

  console.log('[r2-test] Starting Phase 3B-4 R2 S3 API Connectivity Test...');
  console.log(`[r2-test] Target Bucket: ${config.bucket}`);
  console.log(`[r2-test] Endpoint: https://${config.host}`);
  console.log(`[r2-test] Test Key: ${testKey}`);

  // Step 0: Pre-check existence
  console.log('\n[Step 0] Pre-check: Ensure test key does not already exist');
  const headPre = await sendS3Request('HEAD', testKey, {}, config);
  console.log(`[Step 0] HEAD response status: ${headPre.status}`);
  if (headPre.status === 200) {
    throw new Error('Test key already exists in bucket. Aborting.');
  }
  console.log('  ✓ Test key is clear and available.');

  // Step 1: PUT test object
  console.log('\n[Step 1] PUT: Uploading test object');
  const putRes = await sendS3Request(
    'PUT',
    testKey,
    {
      body: testPayload,
      extraHeaders: {
        'content-type': contentType,
        'cache-control': cacheControl,
      },
    },
    config
  );
  console.log(`[Step 1] PUT response status: ${putRes.status}`);
  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`PUT failed: ${putRes.status} ${errText}`);
  }
  console.log('  ✓ PUT succeeded.');

  // Step 2: HEAD test object
  console.log('\n[Step 2] HEAD: Verifying object metadata');
  const headRes = await sendS3Request('HEAD', testKey, {}, config);
  console.log(`[Step 2] HEAD response status: ${headRes.status}`);
  if (!headRes.ok) {
    throw new Error(`HEAD failed: ${headRes.status}`);
  }
  const headType = headRes.headers.get('content-type');
  const headLength = headRes.headers.get('content-length');
  const headCache = headRes.headers.get('cache-control');
  console.log(`  Content-Type: ${headType}`);
  console.log(`  Content-Length: ${headLength}`);
  console.log(`  Cache-Control: ${headCache}`);

  if (headLength !== Buffer.byteLength(testPayload).toString()) {
    const expectedLen = Buffer.byteLength(testPayload);
    throw new Error(
      `Length mismatch: expected ${expectedLen}, got ${headLength}`
    );
  }
  console.log('  ✓ HEAD metadata verified successfully.');

  // Step 3: GET test object
  console.log('\n[Step 3] GET: Downloading and validating object content');
  const getRes = await sendS3Request('GET', testKey, {}, config);
  console.log(`[Step 3] GET response status: ${getRes.status}`);
  if (!getRes.ok) {
    throw new Error(`GET failed: ${getRes.status}`);
  }
  const bodyText = await getRes.text();
  if (bodyText !== testPayload) {
    throw new Error(
      'Payload integrity mismatch: downloaded content does not match uploaded'
    );
  }
  console.log('  ✓ Payload integrity 100% verified.');

  // Step 4: DELETE test object
  console.log('\n[Step 4] DELETE: Cleaning up test object');
  const delRes = await sendS3Request('DELETE', testKey, {}, config);
  console.log(`[Step 4] DELETE response status: ${delRes.status}`);
  if (delRes.status !== 204 && delRes.status !== 200) {
    throw new Error(`DELETE failed: ${delRes.status}`);
  }
  console.log('  ✓ DELETE request completed.');

  // Step 5: Confirm deletion
  console.log('\n[Step 5] Confirmation: Verify object no longer exists');
  const headPost = await sendS3Request('HEAD', testKey, {}, config);
  console.log(`[Step 5] Post-delete HEAD status: ${headPost.status}`);
  if (headPost.status !== 404) {
    throw new Error(`Expected 404 after deletion, got ${headPost.status}`);
  }
  console.log('  ✓ Object confirmed deleted (404 Not Found).');

  console.log('\n[r2-test] ALL 5 CONNECTIVITY & INTEGRITY STEPS PASSED! ✓');
  return {
    bucket: config.bucket,
    endpoint: `https://${config.host}`,
    testKey,
    putStatus: putRes.status,
    headStatus: headRes.status,
    getStatus: getRes.status,
    delStatus: delRes.status,
    postDeleteStatus: headPost.status,
    contentType: headType,
    contentLength: headLength,
    cacheControl: headCache,
  };
}

if (process.argv[1]?.endsWith('test-r2-connectivity.mjs')) {
  runConnectivityTest().catch((err) => {
    console.error('[r2-test] Error:', err.message);
    process.exit(1);
  });
}
