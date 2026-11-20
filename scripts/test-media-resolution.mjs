import assert from 'node:assert/strict';
import stream from 'node:stream';
import { resolveMedia } from '../src/lib/media.ts';
import astroConfig from '../astro.config.mjs';
import { setupTestFixtures } from './test-fixture.mjs';

const { manifest } = await setupTestFixtures();

console.log('[test-media-resolution] Starting Media Resolution Suite...');

const g = globalThis;
const origEnv = {
  NODE_ENV: g.process.env.NODE_ENV,
  PUBLIC_MEDIA_BASE_URL: g.process.env.PUBLIC_MEDIA_BASE_URL,
};

try {
  // -------------------------------------------------------------------------
  // Case 1: Local Dev with local variant present on disk resolves to /media
  // -------------------------------------------------------------------------
  console.log('\n[Case 1] Local dev: Local variant on disk resolves to /media');
  g.process.env.NODE_ENV = 'development';
  g.process.env.PUBLIC_MEDIA_BASE_URL = 'https://media.shan.page';

  const localRes = resolveMedia('test/sample-story/cover');
  assert.ok(
    localRes.src.startsWith('/media/'),
    `Expected src to start with /media/, got: ${localRes.src}`
  );
  assert.ok(
    localRes.srcSet.includes('/media/test/sample-story/cover-400w-'),
    'Expected srcSet to contain /media/ keys'
  );
  assert.ok(
    localRes.thumbnailSrc.startsWith('/media/'),
    'Expected thumbnailSrc to start with /media/'
  );
  assert.equal(localRes.width, 1600);
  assert.equal(localRes.height, 1067);
  console.log('  ✓ Local variant resolved through /media during dev.');

  // -------------------------------------------------------------------------
  // Case 2: Local Dev with local variant absent on disk falls back to CDN
  // -------------------------------------------------------------------------
  console.log('\n[Case 2] Local dev: Missing local variant falls back to R2');
  const origCwd = g.process.cwd;
  g.process.cwd = () => '/tmp';
  try {
    const remoteFallback = resolveMedia('test/sample-story/cover');
    assert.ok(
      remoteFallback.src.startsWith('https://media.shan.page/'),
      `Expected CDN src, got: ${remoteFallback.src}`
    );
    console.log('  ✓ Missing local variant fell back to R2.');

    // Case 3: Local Dev with missing variant and unset base URL
    console.log('\n[Case 3] Local dev: Missing variant with unset base');
    delete g.process.env.PUBLIC_MEDIA_BASE_URL;
    const offlineFallback = resolveMedia('test/sample-story/cover');
    assert.ok(
      offlineFallback.src.startsWith('/media/'),
      `Expected /media/, got: ${offlineFallback.src}`
    );
    console.log('  ✓ Unconfigured dev safely fell back to /media.');
  } finally {
    g.process.cwd = origCwd;
    g.process.env.PUBLIC_MEDIA_BASE_URL = 'https://media.shan.page';
  }

  // -------------------------------------------------------------------------
  // Case 4: Production Mode always uses PUBLIC_MEDIA_BASE_URL
  // -------------------------------------------------------------------------
  console.log('\n[Case 4] Production mode: Always uses PUBLIC_MEDIA_BASE_URL');
  g.process.env.NODE_ENV = 'production';
  g.process.env.PUBLIC_MEDIA_BASE_URL = 'https://media.shan.page';

  const prodRes = resolveMedia('test/sample-story/cover');
  assert.ok(
    prodRes.src.startsWith('https://media.shan.page/'),
    `Expected prod src to start with CDN URL, got: ${prodRes.src}`
  );
  assert.ok(
    !prodRes.src.includes('/media/'),
    'Production src must not reference /media/'
  );
  assert.ok(
    !prodRes.srcSet.includes('/media/'),
    'Production srcSet must not reference /media/'
  );
  console.log('  ✓ Production mode correctly bound all assets to CDN URL.');

  // -------------------------------------------------------------------------
  // Case 5: Production Mode missing PUBLIC_MEDIA_BASE_URL throws error
  // -------------------------------------------------------------------------
  console.log('\n[Case 5] Production mode: Missing PUBLIC_MEDIA_BASE_URL');
  delete g.process.env.PUBLIC_MEDIA_BASE_URL;
  assert.throws(
    () => resolveMedia('test/sample-story/cover'),
    /PUBLIC_MEDIA_BASE_URL/,
    'Must throw error when PUBLIC_MEDIA_BASE_URL is missing in prod'
  );
  console.log('  ✓ Production guard threw error when base URL absent.');

  // -------------------------------------------------------------------------
  // Case 6: Production Mode missing media ID throws error
  // -------------------------------------------------------------------------
  console.log('\n[Case 6] Production mode: Missing media ID throws error');
  g.process.env.PUBLIC_MEDIA_BASE_URL = 'https://media.shan.page';
  assert.throws(
    () => resolveMedia('stories/non-existent/cover'),
    /Missing media ID/,
    'Must throw error when media ID is not in manifest'
  );
  console.log('  ✓ Production guard threw error on invalid media ID.');

  // -------------------------------------------------------------------------
  // Case 7: Vite Middleware Streaming & Redirect Fallback
  // -------------------------------------------------------------------------
  console.log('\n[Case 7] Vite local-media middleware verification');
  const plugin = astroConfig.vite?.plugins?.find(
    (p) => p && p.name === 'local-media-dev-server'
  );
  assert.ok(plugin, 'local-media-dev-server plugin must be in Vite');

  let middlewareHandler = null;
  plugin.configureServer({
    middlewares: {
      use(fn) {
        middlewareHandler = fn;
      },
    },
  });
  assert.ok(middlewareHandler, 'Middleware handler must be registered');

  // 7a. Local file exists: streams with Content-Type header
  const headers7a = {};
  const mockRes7a = new stream.Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  mockRes7a.setHeader = (k, v) => {
    headers7a[k] = v;
  };
  const testCover =
    `/media/${manifest.items['test/sample-story/cover'].variants.card800.key}`;
  const streamResult = middlewareHandler(
    { url: testCover },
    mockRes7a,
    () => {}
  );
  assert.equal(headers7a['Content-Type'], 'image/webp');
  assert.ok(streamResult, 'Readable stream must be returned for local file');
  console.log('  ✓ Middleware served local file with Content-Type.');

  // 7b. Local file absent: redirects (302) to remote CDN
  let status7b = null;
  let location7b = null;
  const mockRes7b = {
    writeHead(s, h) {
      status7b = s;
      location7b = h?.Location;
    },
    end() {},
  };
  g.process.env.PUBLIC_MEDIA_BASE_URL = 'https://media.shan.page';
  middlewareHandler(
    { url: '/media/missing-variant.webp' },
    mockRes7b,
    () => {}
  );
  assert.equal(status7b, 302, 'Expected 302 redirect for absent local media');
  assert.equal(
    location7b,
    'https://media.shan.page/missing-variant.webp',
    'Expected redirect location to point to remote CDN'
  );
  console.log('  ✓ Middleware redirected absent local media to R2.');
} finally {
  g.process.env.NODE_ENV = origEnv.NODE_ENV;
  if (origEnv.PUBLIC_MEDIA_BASE_URL !== undefined) {
    g.process.env.PUBLIC_MEDIA_BASE_URL = origEnv.PUBLIC_MEDIA_BASE_URL;
  } else {
    delete g.process.env.PUBLIC_MEDIA_BASE_URL;
  }
}

console.log(
  '\n[test-media-resolution] ALL RESOLUTION CHECKS PASSED SUCCESSFULLY! ✓'
);
