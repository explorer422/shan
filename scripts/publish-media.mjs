import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEnvConfig,
  getMimeType,
  sendS3Request,
  computeFileSha256,
} from './lib/r2-client.mjs';

// ponytail: R2 publishing tool with SHA-256 metadata integrity verification
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

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
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
}

// ponytail: Parses repeated --item <id> or --item=<id> CLI options
export function parseScopeArgs(argv = process.argv.slice(2)) {
  const scoped = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--item') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw new Error('--item requires a media ID argument.');
      }
      scoped.push(argv[i + 1]);
      i++;
    } else if (argv[i].startsWith('--item=')) {
      const val = argv[i].slice('--item='.length).trim();
      if (!val) {
        throw new Error('--item requires a media ID argument.');
      }
      scoped.push(val);
    }
  }
  return scoped;
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`[publish-media] Manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

let targetItems = [];
if (isMain) {
  let scopedItemIds = [];
  try {
    scopedItemIds = parseScopeArgs(args);
  } catch (err) {
    console.error(`[publish-media] Error: ${err.message}`);
    process.exit(1);
  }

  if (scopedItemIds.length > 0) {
    const uniqueIds = Array.from(new Set(scopedItemIds));
    for (const id of uniqueIds) {
      if (!manifest.items[id]) {
        console.error(
          `[publish-media] Error: Media ID '${id}' not found in manifest.`
        );
        process.exit(1);
      }
    }
    targetItems = uniqueIds.map((id) => manifest.items[id]);
    console.log(
      `[publish-media] Scope: ${targetItems.length} item(s) ` +
        `(${uniqueIds.join(', ')})`
    );
  } else {
    targetItems = Object.values(manifest.items);
    console.log(
      `[publish-media] Loaded ${targetItems.length} items from manifest.`
    );
  }
} else {
  targetItems = Object.values(manifest.items);
}

export async function checkRemoteExists(
  key,
  expectedSha256,
  options = {}
) {
  const mockMode = options.isMock ?? isMock;
  const dryMode = options.isDryRun ?? isDryRun;

  if (mockMode) {
    const dest = path.join(MOCK_R2_DIR, key);
    if (!fs.existsSync(dest)) {
      return { exists: false };
    }
    const metaPath = `${dest}.meta.json`;
    let remoteSha256 = null;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        remoteSha256 = meta.sha256;
      } catch {}
    }
    if (!remoteSha256) {
      remoteSha256 = computeFileSha256(dest);
    }
    const match = remoteSha256 === expectedSha256;
    return {
      exists: true,
      match,
      remoteSha256,
      expectedSha256,
      verifiedBy: 'mock-meta',
    };
  }

  if (dryMode) {
    return { exists: false };
  }

  if (!r2Config.isConfigured) {
    throw new Error(
      'R2 credentials are required for remote operations in production mode.'
    );
  }

  try {
    const res = await sendS3Request('HEAD', key, {}, r2Config);
    if (res.status === 404) {
      return { exists: false };
    }
    if (res.status !== 200) {
      throw new Error(`Unexpected HEAD status ${res.status} for ${key}`);
    }

    const remoteSha256 = res.headers.get('x-amz-meta-sha256');
    if (remoteSha256) {
      const match = remoteSha256 === expectedSha256;
      return {
        exists: true,
        match,
        remoteSha256,
        expectedSha256,
        verifiedBy: 'metadata',
      };
    }

    // Fallback: Metadata missing on existing object. GET and verify checksum.
    console.warn(
      `[publish-media] Object ${key} missing checksum header. ` +
        'Issuing GET fallback...'
    );
    const getRes = await sendS3Request('GET', key, {}, r2Config);
    if (!getRes.ok) {
      throw new Error(`GET fallback failed for ${key}: HTTP ${getRes.status}`);
    }
    const arrayBuf = await getRes.arrayBuffer();
    const downloadedSha256 = crypto
      .createHash('sha256')
      .update(Buffer.from(arrayBuf))
      .digest('hex');
    const match = downloadedSha256 === expectedSha256;
    return {
      exists: true,
      match,
      remoteSha256: downloadedSha256,
      expectedSha256,
      verifiedBy: 'get-fallback',
    };
  } catch (err) {
    console.error(
      `[publish-media] Remote check error for ${key}:`,
      err.message
    );
    throw err;
  }
}

export async function uploadVariant(localPath, key, expectedSha256) {
  if (isDryRun) {
    console.log(`[publish-media] (dry-run) Would upload: ${key}`);
    return true;
  }

  const fileData = fs.readFileSync(localPath);
  const contentType = getMimeType(localPath);
  const cacheControl = 'public, max-age=31536000, immutable';

  if (isMock) {
    const dest = path.join(MOCK_R2_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    const metaPath = `${dest}.meta.json`;
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          sha256: expectedSha256,
          size: fileData.length,
          contentType,
          cacheControl,
        },
        null,
        2
      )
    );
    console.log(`[publish-media] (mock) Stored: ${key} (${fileData.length} B)`);
    return true;
  }

  if (!r2Config.isConfigured) {
    throw new Error('R2 credentials are not configured in .env');
  }

  console.log(
    `[publish-media] (prod) Uploading ${key} ` +
      `(${fileData.length} B, sha256:${expectedSha256.slice(0, 8)})...`
  );
  const res = await sendS3Request(
    'PUT',
    key,
    {
      body: fileData,
      extraHeaders: {
        'content-type': contentType,
        'cache-control': cacheControl,
        'x-amz-meta-sha256': expectedSha256,
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

export async function publishAll(itemsToPublish = targetItems) {
  const results = {
    uploaded: 0,
    skipped: 0,
    verified: 0,
    failed: 0,
    collisions: 0,
  };

  for (const item of itemsToPublish) {
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
      const expectedSha256 = computeFileSha256(localFile);

      let check;
      try {
        check = await checkRemoteExists(key, expectedSha256);
      } catch {
        allVariantsOk = false;
        results.failed++;
        break;
      }

      if (check.exists) {
        if (check.match) {
          // Already uploaded with matching cryptographic checksum
          results.skipped++;
          results.verified++;
          continue;
        } else {
          // COLLISION / MISMATCH: Remote file exists with different content!
          console.error(
            `[publish-media] COLLISION DETECTED for ${key}!\n` +
              `  Expected SHA-256: ${expectedSha256}\n` +
              `  Remote SHA-256:   ${check.remoteSha256}\n` +
              '  Refusing to overwrite existing remote object.'
          );
          allVariantsOk = false;
          results.failed++;
          results.collisions++;
          break;
        }
      }

      if (isVerifyOnly) {
        console.error(`[publish-media] Missing remote object: ${key}`);
        allVariantsOk = false;
        results.failed++;
        break;
      }

      const ok = await uploadVariant(localFile, key, expectedSha256);
      if (!ok) {
        allVariantsOk = false;
        results.failed++;
        break;
      }
      results.uploaded++;

      const postCheck = isDryRun
        ? { exists: true, match: true }
        : await checkRemoteExists(key, expectedSha256);

      if (postCheck.exists && postCheck.match) {
        results.verified++;
      } else {
        console.error(`[publish-media] Verification failed after PUT: ${key}`);
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

if (isMain) {
  publishAll().catch((err) => {
    console.error('[publish-media] Fatal error:', err);
    process.exit(1);
  });
}
