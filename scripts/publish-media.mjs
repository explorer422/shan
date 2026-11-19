import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEnvConfig,
  getMimeType,
  sendS3Request,
} from './lib/r2-client.mjs';

// ponytail: R2 publishing tool supporting dry-run, mock, and real S3 API
const ROOT = process.cwd();
const LOCAL_MEDIA_DIR = path.join(ROOT, '.local-media');
const MANIFEST_PATH = path.join(ROOT, 'src/data/media-manifest.json');
const MOCK_R2_DIR = path.join(ROOT, '.mock-r2');

const args = process.argv.slice(2);
const isMock = args.includes('--mock');
const isVerifyOnly = args.includes('--verify-only');
const isProd = args.includes('--prod');
// ponytail: default to dry-run unless --prod or --mock is explicitly passed
const isDryRun = args.includes('--dry-run') || (!isProd && !isMock);

const r2Config = loadEnvConfig();

console.log('[publish-media] R2 Media Publishing Tool');
if (isVerifyOnly) {
  const target = isMock ? 'LOCAL MOCK' : 'REMOTE R2';
  console.log(`[publish-media] Mode: VERIFY-ONLY (${target})`);
} else if (isMock) {
  console.log('[publish-media] Mode: LOCAL MOCK (.mock-r2)');
} else if (isProd) {
  console.log(`[publish-media] Mode: PRODUCTION R2 (${r2Config.host})`);
} else {
  console.log('[publish-media] Mode: DRY-RUN (safe simulation)');
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`[publish-media] Manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const items = Object.values(manifest.items);
console.log(`[publish-media] Loaded ${items.length} items from manifest.`);

export async function checkRemoteExists(key, localSize = null) {
  if (isDryRun) {
    return false;
  }
  if (isMock) {
    const dest = path.join(MOCK_R2_DIR, key);
    if (!fs.existsSync(dest)) return false;
    if (localSize !== null) {
      return fs.statSync(dest).size === localSize;
    }
    return true;
  }
  if (!r2Config.isConfigured) {
    throw new Error(
      'R2 credentials are required for remote operations in production mode.'
    );
  }
  try {
    const res = await sendS3Request('HEAD', key, {}, r2Config);
    if (res.status !== 200) {
      return false;
    }
    if (localSize !== null) {
      const len = res.headers.get('content-length');
      if (len && parseInt(len, 10) !== localSize) {
        console.warn(
          `[publish-media] Size mismatch for ${key}: ` +
            `local=${localSize}, remote=${len}`
        );
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error(
      `[publish-media] Remote check error for ${key}:`,
      err.message
    );
    return false;
  }
}

export async function uploadVariant(localPath, key) {
  if (isDryRun) {
    console.log(`[publish-media] (dry-run) Would upload: ${key}`);
    return true;
  }
  if (isMock) {
    const dest = path.join(MOCK_R2_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    const size = fs.statSync(dest).size;
    console.log(`[publish-media] (mock) Stored: ${key} (${size} bytes)`);
    return true;
  }
  if (!r2Config.isConfigured) {
    throw new Error('R2 credentials are not configured in .env');
  }

  const fileData = fs.readFileSync(localPath);
  const contentType = getMimeType(localPath);
  const cacheControl = 'public, max-age=31536000, immutable';

  console.log(
    `[publish-media] (prod) Uploading ${key} ` +
      `(${fileData.length} bytes, ${contentType})...`
  );
  const res = await sendS3Request(
    'PUT',
    key,
    {
      body: fileData,
      extraHeaders: {
        'content-type': contentType,
        'cache-control': cacheControl,
      },
    },
    r2Config
  );

  if (!res.ok) {
    console.error(
      `[publish-media] Upload failed for ${key}: HTTP ${res.status}`
    );
    return false;
  }
  return true;
}

export async function publishAll() {
  const results = {
    uploaded: 0,
    skipped: 0,
    verified: 0,
    failed: 0,
  };

  for (const item of items) {
    const variantKeys = Object.values(item.variants).map((v) => v.key);
    let allVariantsOk = true;

    for (const key of variantKeys) {
      const localFile = path.join(LOCAL_MEDIA_DIR, key);
      if (!fs.existsSync(localFile)) {
        console.error(`[publish-media] Local variant missing: ${localFile}`);
        allVariantsOk = false;
        results.failed++;
        break;
      }
      const localSize = fs.statSync(localFile).size;

      const alreadyExists = await checkRemoteExists(key, localSize);
      if (alreadyExists) {
        results.skipped++;
        results.verified++;
        continue;
      }

      if (isVerifyOnly) {
        console.error(`[publish-media] Missing remote object: ${key}`);
        allVariantsOk = false;
        results.failed++;
        break;
      }

      const ok = await uploadVariant(localFile, key);
      if (!ok) {
        allVariantsOk = false;
        results.failed++;
        break;
      }
      results.uploaded++;

      const verified = isDryRun
        ? true
        : await checkRemoteExists(key, localSize);
      if (verified) {
        results.verified++;
      } else {
        console.error(`[publish-media] Upload verification failed: ${key}`);
        allVariantsOk = false;
        results.failed++;
        break;
      }
    }

    if (!allVariantsOk) {
      console.warn(
        `[publish-media] Item ${item.id} not verified. Manifest unchanged.`
      );
    }
  }

  console.log('[publish-media] Publish completed successfully.');
  console.log('[publish-media] Summary:', results);
  return results;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  publishAll().catch((err) => {
    console.error('[publish-media] Fatal error:', err);
    process.exit(1);
  });
}
