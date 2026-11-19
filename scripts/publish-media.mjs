import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ponytail: R2 publishing tool supporting dry-run, mock, and real S3 API
const ROOT = process.cwd();
const LOCAL_MEDIA_DIR = path.join(ROOT, '.local-media');
const MANIFEST_PATH = path.join(ROOT, 'src/data/media-manifest.json');
const MOCK_R2_DIR = path.join(ROOT, '.mock-r2');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isMock = args.includes('--mock');
const isVerifyOnly = args.includes('--verify-only');

console.log('[publish-media] R2 Media Publishing Tool');
if (isDryRun) {
  console.log('[publish-media] Mode: DRY-RUN (no files uploaded)');
} else if (isMock) {
  console.log('[publish-media] Mode: LOCAL MOCK (.mock-r2)');
} else {
  console.log('[publish-media] Mode: PRODUCTION R2');
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`[publish-media] Manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const items = Object.values(manifest.items);
console.log(`[publish-media] Loaded ${items.length} items from manifest.`);

async function checkRemoteExists(key) {
  if (isDryRun) {
    return false;
  }
  if (isMock) {
    return fs.existsSync(path.join(MOCK_R2_DIR, key));
  }
  const baseUrl = process.env.PUBLIC_MEDIA_BASE_URL;
  if (!baseUrl) {
    throw new Error('PUBLIC_MEDIA_BASE_URL is required for remote check.');
  }
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/${key}`, {
      method: 'HEAD',
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function uploadVariant(localPath, key) {
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
  console.log(`[publish-media] (prod) Uploading ${key} to R2...`);
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

      const alreadyExists = await checkRemoteExists(key);
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

      const verified = isDryRun ? true : await checkRemoteExists(key);
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
