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

export function findProhibitedFiles(fileList) {
  const leaked = [];
  for (const file of fileList) {
    const normFile = file.replace(/\\/g, '/');
    if (ALLOWED_UI_ASSETS.has(normFile)) {
      continue;
    }
    const ext = path.extname(normFile).toLowerCase();
    if (PHOTO_EXTS.has(ext)) {
      leaked.push(normFile);
    }
  }
  return leaked;
}

export function scanDirectory(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }
  return files;
}

export function auditGitFiles() {
  let files = [];
  try {
    const tracked = execSync('git ls-files', { encoding: 'utf-8' });
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
    });
    files = Array.from(
      new Set(
        [...tracked.split('\n'), ...staged.split('\n')]
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  } catch {
    console.warn('[verify-isolation] Git query failed or not initialized.');
  }
  return findProhibitedFiles(files);
}

export function auditDistFiles() {
  const distDir = path.join(ROOT, 'dist');
  const allDist = scanDirectory(distDir);
  return findProhibitedFiles(allDist);
}

export function runNegativeLeakTest() {
  const dummyFile = 'dummy_test_leak_photo.jpg';
  const dummyPath = path.join(ROOT, dummyFile);
  try {
    fs.writeFileSync(dummyPath, 'fake-jpeg-data');
    execSync(`git add "${dummyFile}"`, { stdio: 'ignore' });
    const stagedProhibited = auditGitFiles();
    if (!stagedProhibited.includes(dummyFile)) {
      throw new Error('Negative leak test failed: dummy file was not caught');
    }
    return true;
  } finally {
    try {
      execSync(`git reset HEAD "${dummyFile}"`, { stdio: 'ignore' });
    } catch {}
    if (fs.existsSync(dummyPath)) {
      fs.unlinkSync(dummyPath);
    }
  }
}

// ponytail: CLI entry point
if (process.argv[1]?.endsWith('verify-isolation.mjs')) {
  console.log('[verify-isolation] Starting Git & build isolation audit...');

  const gitLeaks = auditGitFiles();
  if (gitLeaks.length > 0) {
    console.error(
      '[verify-isolation] FAIL: Prohibited photographic assets in Git:'
    );
    for (const f of gitLeaks) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    '[verify-isolation] PASS: Zero photographic binaries in Git.'
  );

  const distLeaks = auditDistFiles();
  if (distLeaks.length > 0) {
    console.error(
      '[verify-isolation] FAIL: Photographic assets leaked into dist/:'
    );
    for (const f of distLeaks) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    '[verify-isolation] PASS: dist/ contains zero photographic binaries.'
  );

  // Negative test verification
  try {
    runNegativeLeakTest();
    console.log(
      '[verify-isolation] PASS: Negative leak test verified detection.'
    );
  } catch (err) {
    console.error(
      `[verify-isolation] FAIL: Negative leak test: ${err.message}`
    );
    process.exit(1);
  }

  console.log('[verify-isolation] All isolation checks completed.');
}
