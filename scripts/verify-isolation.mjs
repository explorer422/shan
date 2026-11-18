import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const PHOTO_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.tiff',
  '.heic',
  '.dng',
  '.raw',
  '.cr2',
  '.nef',
  '.arw',
]);

const ALLOWED_UI_ASSETS = new Set([
  'public/favicon.svg',
  'public/favicon.ico',
  'public/favicon-32x32.png',
  'public/apple-touch-icon.png',
]);

console.log('[verify-isolation] Starting Git & build isolation audit...');

// 1. Audit Git tracked & staged files
let trackedFiles = [];
try {
  const stdout = execSync('git ls-files', { encoding: 'utf-8' });
  trackedFiles = stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
} catch (err) {
  console.warn('[verify-isolation] Git repository not yet initialized.');
}

const leakedGitFiles = [];
for (const file of trackedFiles) {
  const normFile = file.replace(/\\/g, '/');
  if (ALLOWED_UI_ASSETS.has(normFile)) {
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  if (PHOTO_EXTS.has(ext)) {
    leakedGitFiles.push(file);
  }
}

if (leakedGitFiles.length > 0) {
  console.error(
    '[verify-isolation] FAIL: Prohibited photographic assets in Git:'
  );
  for (const f of leakedGitFiles) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log(
    '[verify-isolation] PASS: Zero photographic binaries tracked in Git.'
  );
}

// 2. Audit dist/ directory if present
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  const leakedDistFiles = [];

  function scanDist(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDist(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const rel = path
          .relative(ROOT, fullPath)
          .replace(/\\/g, '/');
        if (PHOTO_EXTS.has(ext)) {
          leakedDistFiles.push(rel);
        }
      }
    }
  }

  scanDist(distDir);

  if (leakedDistFiles.length > 0) {
    console.error(
      '[verify-isolation] FAIL: Photographic assets leaked into dist/:'
    );
    for (const f of leakedDistFiles) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  } else {
    console.log(
      '[verify-isolation] PASS: dist/ contains zero photographic binaries.'
    );
  }
} else {
  console.log(
    '[verify-isolation] SKIP: dist/ not yet generated. Run after build.'
  );
}

console.log('[verify-isolation] All isolation checks completed successfully.');
