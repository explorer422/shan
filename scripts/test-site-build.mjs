import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

console.log('[test-site-build] Running Site Build & Static Asset Suite...');

const distDir = path.join(process.cwd(), 'dist');
assert.ok(fs.existsSync(distDir), 'dist/ directory must exist');

// 1. Verify 6 required static pages exist with core layout
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
  assert.ok(fs.existsSync(filePath), `Expected static page missing: ${page}`);
  const html = fs.readFileSync(filePath, 'utf-8');
  assert.ok(html.includes('<header'), `${page} must contain <header>`);
  assert.ok(html.includes('<footer'), `${page} must contain <footer>`);
  assert.ok(
    html.includes('id="main"'),
    `${page} must contain <main id="main">`
  );
  assert.ok(html.includes('shan-theme'), `${page} must contain theme script`);
}
console.log('✓ All 6 static HTML pages verified with shell layout.');

// 2. Verify UI asset presence
const faviconSvgPath = path.join(distDir, 'favicon.svg');
const faviconIcoPath = path.join(distDir, 'favicon.ico');
const favicon32Path = path.join(distDir, 'favicon-32x32.png');
const appleTouchPath = path.join(distDir, 'apple-touch-icon.png');
assert.ok(fs.existsSync(faviconSvgPath), 'Favicon SVG must be in dist');
assert.ok(fs.existsSync(faviconIcoPath), 'Favicon ICO must be in dist');
assert.ok(fs.existsSync(favicon32Path), 'Favicon 32 must be in dist');
assert.ok(fs.existsSync(appleTouchPath), 'Apple touch icon must be in dist');
console.log('✓ Approved UI assets (SVG/ICO/PNG icons) confirmed in dist/.');

// 3. Verify accessibility & self-hosted fonts
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
assert.ok(indexHtml.includes('class="skip"'), 'Skip to content required');
assert.ok(
  indexHtml.includes('aria-label="Main"'),
  'Accessible nav label required'
);
assert.ok(
  indexHtml.includes('aria-expanded="false"'),
  'aria-expanded required'
);
assert.ok(
  !indexHtml.includes('fonts.googleapis.com'),
  'Must not load external Google Fonts'
);
console.log('✓ Accessibility & self-hosted font requirements verified.');

console.log('[test-site-build] ALL SITE BUILD CHECKS PASSED! ✓');
