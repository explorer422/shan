import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
export const FIXTURE_DIR = path.join(ROOT, 'scripts/fixtures');
export const FIXTURE_MANIFEST_PATH = path.join(
  FIXTURE_DIR,
  'test-manifest.json'
);
export const FIXTURE_MEDIA_DIR = path.join(ROOT, '.local-media');
export const FIXTURE_ORIGINALS_DIR = path.join(FIXTURE_MEDIA_DIR, 'fixtures');

export async function setupTestFixtures() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.mkdirSync(FIXTURE_ORIGINALS_DIR, { recursive: true });

  const samplePhotoPath = path.join(
    FIXTURE_ORIGINALS_DIR,
    'sample-photo.jpg'
  );

  // Generate deterministic master photo in git-ignored .local-media/
  if (!fs.existsSync(samplePhotoPath)) {
    const masterBuf = await sharp({
      create: {
        width: 1600,
        height: 1067,
        channels: 3,
        background: { r: 52, g: 73, b: 60 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    fs.writeFileSync(samplePhotoPath, masterBuf);
  }

  const masterBuf = fs.readFileSync(samplePhotoPath);
  const baseSharp = sharp(masterBuf).rotate();

  async function generateVariants(dirPrefix, name, isMoment = false) {
    const outSubDir = path.join(FIXTURE_MEDIA_DIR, dirPrefix);
    fs.mkdirSync(outSubDir, { recursive: true });

    // 1. thumb400
    let thumbPipe = baseSharp.clone();
    if (isMoment) {
      thumbPipe = thumbPipe.resize(400, 400, { fit: 'cover' });
    } else {
      thumbPipe = thumbPipe.resize(400);
    }
    const thumbBuf = await thumbPipe.webp({ quality: 85 }).toBuffer();
    const thumbSha = crypto
      .createHash('sha256')
      .update(thumbBuf)
      .digest('hex');
    const thumbFile = `${name}-400w-${thumbSha}.webp`;
    fs.writeFileSync(path.join(outSubDir, thumbFile), thumbBuf);

    // 2. card800
    const cardBuf = await baseSharp
      .clone()
      .resize(800)
      .webp({ quality: 85 })
      .toBuffer();
    const cardSha = crypto
      .createHash('sha256')
      .update(cardBuf)
      .digest('hex');
    const cardFile = `${name}-800w-${cardSha}.webp`;
    fs.writeFileSync(path.join(outSubDir, cardFile), cardBuf);

    // 3. full1600
    const fullBuf = await baseSharp
      .clone()
      .resize(1600)
      .webp({ quality: 85 })
      .toBuffer();
    const fullSha = crypto
      .createHash('sha256')
      .update(fullBuf)
      .digest('hex');
    const fullFile = `${name}-1600w-${fullSha}.webp`;
    fs.writeFileSync(path.join(outSubDir, fullFile), fullBuf);

    // 4. avif1600
    const avifBuf = await baseSharp
      .clone()
      .resize(1600)
      .avif({ quality: 75 })
      .toBuffer();
    const avifSha = crypto
      .createHash('sha256')
      .update(avifBuf)
      .digest('hex');
    const avifFile = `${name}-1600w-${avifSha}.avif`;
    fs.writeFileSync(path.join(outSubDir, avifFile), avifBuf);

    function seedMock(relKey, buf, sha, mime) {
      const dest = path.join(ROOT, '.mock-r2', relKey);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      fs.writeFileSync(
        `${dest}.meta.json`,
        JSON.stringify({
          sha256: sha,
          size: buf.length,
          contentType: mime,
          cacheControl: 'public, max-age=31536000, immutable',
        })
      );
    }

    const tKey = `${dirPrefix}/${thumbFile}`;
    const cKey = `${dirPrefix}/${cardFile}`;
    const fKey = `${dirPrefix}/${fullFile}`;
    const aKey = `${dirPrefix}/${avifFile}`;

    seedMock(tKey, thumbBuf, thumbSha, 'image/webp');
    seedMock(cKey, cardBuf, cardSha, 'image/webp');
    seedMock(fKey, fullBuf, fullSha, 'image/webp');
    seedMock(aKey, avifBuf, avifSha, 'image/avif');

    return {
      thumb400: {
        key: tKey,
        w: isMoment ? 400 : 400,
        h: isMoment ? 400 : 267,
      },
      card800: { key: cKey, w: 800, h: 534 },
      full1600: { key: fKey, w: 1600, h: 1067 },
      avif1600: { key: aKey, w: 1600, h: 1067 },
    };
  }

  const storyVariants = await generateVariants(
    'test/sample-story',
    'cover',
    false
  );
  const moment1Variants = await generateVariants(
    'test/sample-moment',
    'photo-01',
    true
  );
  const moment2Variants = await generateVariants(
    'test/sample-moment',
    'photo-02',
    true
  );

  const testManifest = {
    version: '2.0',
    generatedAt: '2026-11-20T00:00:00.000Z',
    items: {
      'test/sample-story/cover': {
        id: 'test/sample-story/cover',
        storageKeyPrefix: 'test/sample-story/cover',
        format: 'webp',
        width: 1600,
        height: 1067,
        aspectRatio: 1.5,
        contentHash: 'sha256-test-story-fixture-hash',
        variants: storyVariants,
        metadata: {
          captureDate: '2026-11-20T00:00:00.000Z',
          cameraModel: 'Fujifilm X-T5',
          lens: 'XF 23mm F1.4 R LM WR',
          focalLength: '23mm',
          aperture: 'f/2.8',
          shutterSpeed: '1/250s',
          iso: 160,
        },
      },
      'test/sample-moment/photo-01': {
        id: 'test/sample-moment/photo-01',
        storageKeyPrefix: 'test/sample-moment/photo-01',
        format: 'webp',
        width: 1600,
        height: 1067,
        aspectRatio: 1.5,
        contentHash: 'sha256-test-moment1-fixture-hash',
        variants: moment1Variants,
        metadata: {
          captureDate: '2026-11-20T00:00:00.000Z',
          cameraModel: 'Fujifilm X-T5',
          lens: 'XF 23mm F1.4 R LM WR',
          focalLength: '23mm',
          aperture: 'f/2.8',
          shutterSpeed: '1/250s',
          iso: 160,
        },
      },
      'test/sample-moment/photo-02': {
        id: 'test/sample-moment/photo-02',
        storageKeyPrefix: 'test/sample-moment/photo-02',
        format: 'webp',
        width: 1600,
        height: 1067,
        aspectRatio: 1.5,
        contentHash: 'sha256-test-moment2-fixture-hash',
        variants: moment2Variants,
        metadata: {
          captureDate: '2026-11-20T00:00:00.000Z',
          cameraModel: 'Fujifilm X-T5',
          lens: 'XF 23mm F1.4 R LM WR',
          focalLength: '23mm',
          aperture: 'f/2.8',
          shutterSpeed: '1/250s',
          iso: 160,
        },
      },
    },
  };

  fs.writeFileSync(
    FIXTURE_MANIFEST_PATH,
    JSON.stringify(testManifest, null, 2) + '\n'
  );

  globalThis.__SHAN_TEST_MANIFEST__ = testManifest;
  return {
    manifest: testManifest,
    samplePhotoPath,
    manifestPath: FIXTURE_MANIFEST_PATH,
  };
}
