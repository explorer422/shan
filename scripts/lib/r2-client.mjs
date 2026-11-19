import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ponytail: Native SigV4 client for Cloudflare R2 Standard without AWS SDK
export function loadEnvConfig() {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    try {
      process.loadEnvFile();
    } catch {
      // Ignore if .env is missing or invalid in CI/tests
    }
  }

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || 'shan-media';
  const jurisdiction = process.env.R2_JURISDICTION?.trim() || 'eu';
  const publicBaseUrl =
    process.env.PUBLIC_MEDIA_BASE_URL?.trim() || 'https://media.shan.page';

  const host = jurisdiction
    ? `${accountId}.${jurisdiction}.r2.cloudflarestorage.com`
    : `${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    jurisdiction,
    host,
    region: 'auto',
    service: 's3',
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    isConfigured: Boolean(accountId && accessKeyId && secretAccessKey),
  };
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function computeFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return sha256Hex(data);
}

export function computeBufferSha256(buffer) {
  return sha256Hex(buffer);
}

export function getSigningKey(secret, dateStamp, regionName, serviceName) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export function buildSignedRequest(method, objectKey, options = {}, config) {
  const now = options.date || new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const body = options.body ?? null;
  const payloadHash = sha256Hex(body ?? '');

  const canonicalUri = `/${config.bucket}/${encodeURI(objectKey)}`;

  const headers = {
    host: config.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(options.extraHeaders || {}),
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
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope =
    `${dateStamp}/${config.region}/${config.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    config.service
  );
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = {
    ...headers,
    Authorization: authHeader,
  };

  if (body) {
    const len = Buffer.isBuffer(body)
      ? body.length
      : Buffer.byteLength(body.toString());
    requestHeaders['content-length'] = len.toString();
  }

  const url = `https://${config.host}${canonicalUri}`;

  return {
    url,
    method,
    headers: requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  };
}

export async function sendS3Request(method, objectKey, options = {}, config) {
  const req = buildSignedRequest(method, objectKey, options, config);
  return fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
}
