import crypto from 'node:crypto';
import fs from 'node:fs';

// ponytail: Native SigV4 S3 client for Cloudflare R2 without heavy AWS SDK
if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
  process.loadEnvFile();
}

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET?.trim() || 'shan-media';

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('[r2-test] Error: Missing required R2 credentials in .env');
  process.exit(1);
}

const jurisdiction = process.env.R2_JURISDICTION?.trim();
const host = jurisdiction
  ? `${accountId}.${jurisdiction}.r2.cloudflarestorage.com`
  : `${accountId}.r2.cloudflarestorage.com`;
const region = 'auto';
const service = 's3';

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secret, dateStamp, regionName, serviceName) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

async function s3Request(method, objectKey, body = null, extraHeaders = {}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payload = body || '';
  const payloadHash = sha256Hex(payload);

  const canonicalUri = `/${bucket}/${encodeURI(objectKey)}`;

  // Header keys must be lowercase and sorted
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extraHeaders,
  };

  if (method === 'HEAD' || method === 'GET') {
    headers['accept-encoding'] = 'identity';
  }

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys
    .map((k) => `${k.toLowerCase()}:${headers[k].trim()}\n`)
    .join('');
  const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = {
    ...headers,
    Authorization: authHeader,
  };

  if (body) {
    requestHeaders['content-length'] = Buffer.byteLength(body).toString();
  }

  const url = `https://${host}${canonicalUri}`;

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });

  return res;
}

export async function runConnectivityTest() {
  const timestamp = Date.now();
  const testKey = `_connectivity-tests/phase3b3-${timestamp}.txt`;
  const testPayload =
    `SHAN R2 Connectivity Verification at ${new Date().toISOString()}`;
  const contentType = 'text/plain; charset=utf-8';
  const cacheControl = 'public, max-age=3600';

  console.log('[r2-test] Starting Phase 3B-3 R2 S3 API Connectivity Test...');
  console.log(`[r2-test] Target Bucket: ${bucket}`);
  console.log(`[r2-test] Endpoint: https://${host}`);
  console.log(`[r2-test] Test Key: ${testKey}`);

  // Step 0: Pre-check existence
  console.log('\n[Step 0] Pre-check: Ensure test key does not already exist');
  const headPre = await s3Request('HEAD', testKey);
  console.log(`[Step 0] HEAD response status: ${headPre.status}`);
  if (headPre.status === 200) {
    throw new Error('Test key already exists in bucket. Aborting.');
  }
  console.log('  ✓ Test key is clear and available.');

  // Step 1: PUT test object
  console.log('\n[Step 1] PUT: Uploading test object');
  const putRes = await s3Request('PUT', testKey, testPayload, {
    'content-type': contentType,
    'cache-control': cacheControl,
  });
  console.log(`[Step 1] PUT response status: ${putRes.status}`);
  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`PUT failed: ${putRes.status} ${errText}`);
  }
  console.log('  ✓ PUT succeeded.');

  // Step 2: HEAD test object
  console.log('\n[Step 2] HEAD: Verifying object metadata');
  const headRes = await s3Request('HEAD', testKey);
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
  const getRes = await s3Request('GET', testKey);
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
  const delRes = await s3Request('DELETE', testKey);
  console.log(`[Step 4] DELETE response status: ${delRes.status}`);
  if (delRes.status !== 204 && delRes.status !== 200) {
    throw new Error(`DELETE failed: ${delRes.status}`);
  }
  console.log('  ✓ DELETE request completed.');

  // Step 5: Confirm deletion
  console.log('\n[Step 5] Confirmation: Verify object no longer exists');
  const headPost = await s3Request('HEAD', testKey);
  console.log(`[Step 5] Post-delete HEAD status: ${headPost.status}`);
  if (headPost.status !== 404) {
    throw new Error(`Expected 404 after deletion, got ${headPost.status}`);
  }
  console.log('  ✓ Object confirmed deleted (404 Not Found).');

  console.log('\n[r2-test] ALL 5 CONNECTIVITY & INTEGRITY STEPS PASSED! ✓');
  return {
    bucket,
    endpoint: `https://${host}`,
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
