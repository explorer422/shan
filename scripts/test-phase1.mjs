import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('[test-phase1] Running Phase 1 verification suite...');

const distDir = path.join(process.cwd(), 'dist');
assert(fs.existsSync(distDir), 'dist/ directory must exist');

// 1. Verify 6 required static pages exist
const expectedPages = [
  'index.html',
  'stories/index.html',
  'moments/index.html',
  'about/index.html',
  'tags/index.html',
  '404.html',
];

for (const page of expectedPages) {
  const filePath = path.join(distDir, page);
  assert(fs.existsSync(filePath), `Expected static page missing: ${page}`);
  const html = fs.readFileSync(filePath, 'utf-8');
  assert(html.includes('<header'), `${page} must contain <header>`);
  assert(html.includes('<footer'), `${page} must contain <footer>`);
  assert(html.includes('id="main"'), `${page} must contain <main id="main">`);
  assert(html.includes('shan-theme'), `${page} must contain theme script`);
}
console.log('✓ All 6 static HTML pages verified with shell layout.');

// 2. Verify UI asset presence
const faviconSvgPath = path.join(distDir, 'favicon.svg');
const faviconIcoPath = path.join(distDir, 'favicon.ico');
const favicon32Path = path.join(distDir, 'favicon-32x32.png');
const appleTouchPath = path.join(distDir, 'apple-touch-icon.png');
assert(fs.existsSync(faviconSvgPath), 'Favicon SVG must be present in dist');
assert(fs.existsSync(faviconIcoPath), 'Favicon ICO must be present in dist');
assert(fs.existsSync(favicon32Path), 'Favicon 32 must be present in dist');
assert(fs.existsSync(appleTouchPath), 'Apple touch icon must be in dist');
console.log('✓ Approved UI assets (SVG/ICO/PNG icons) copied to dist/.');

// 3. Verify zero photographic binaries in dist/
const photoExts = ['.jpg', '.jpeg', '.webp', '.avif', '.heic', '.tiff'];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      assert(
        !photoExts.includes(ext),
        `Photographic binary found in dist: ${full}`
      );
    }
  }
}
scan(distDir);
console.log('✓ Zero photographic binaries in dist/ verified.');

// 4. Verify accessibility & design token elements
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
assert(indexHtml.includes('class="skip"'), 'Skip to content link required');
assert(
  indexHtml.includes('aria-label="Main"'),
  'Accessible nav label required'
);
assert(indexHtml.includes('aria-expanded="false"'), 'aria-expanded required');
assert(
  !indexHtml.includes('fonts.googleapis.com'),
  'Must not load external Google Fonts'
);
console.log('✓ Accessibility & self-hosted font requirements verified.');

console.log('[test-phase1] ALL PHASE 1 CHECKS PASSED SUCCESSFULLY!');
