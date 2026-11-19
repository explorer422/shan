import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();
const ORIGINALS_DIR = path.join(ROOT, 'media/originals');
const OUTPUT_DIR = path.join(ROOT, '.local-media');
const MANIFEST_PATH = path.join(ROOT, 'src/data/media-manifest.json');

console.log('[process-media] Scanning media/originals for master photos...');

if (!fs.existsSync(ORIGINALS_DIR)) {
  console.log('[process-media] No media/originals directory found. Exiting.');
  process.exit(0);
}

function findImages(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findImages(full, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.tiff', '.webp'].includes(ext)) {
        fileList.push(full);
      }
    }
  }
  return fileList;
}

const imageFiles = findImages(ORIGINALS_DIR);
console.log(`[process-media] Found ${imageFiles.length} master images.`);

// Load existing manifest if present
let manifest = {
  version: '2.0',
  generatedAt: new Date().toISOString(),
  items: {},
};

if (fs.existsSync(MANIFEST_PATH)) {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (err) {
    console.warn('[process-media] Resetting malformed media manifest.');
  }
}

async function processImage(imagePath) {
  const relPath = path.relative(ORIGINALS_DIR, imagePath);
  const parsed = path.parse(relPath);
  // Logical ID: "stories/forest-time/cover" or "moments/cedar/photo-01"
  const logicalId = path
    .join(parsed.dir, parsed.name)
    .replace(/\\/g, '/');

  console.log(`[process-media] Processing: ${logicalId}`);

  const buffer = fs.readFileSync(imagePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Sharp pipeline with auto-orientation (.rotate())
  const baseSharp = sharp(buffer).rotate();
  const meta = await baseSharp.metadata();

  const width = meta.width || 1600;
  const height = meta.height || 1067;
  const aspectRatio = Number((width / height).toFixed(3));

  // Destination directory inside .local-media/
  const outSubDir = path.join(OUTPUT_DIR, parsed.dir);
  fs.mkdirSync(outSubDir, { recursive: true });

  const isMoment = logicalId.startsWith('moments/');

  // 1. thumb400: square crop for moments, proportional for stories
  let thumbPipe = baseSharp.clone();
  if (isMoment) {
    thumbPipe = thumbPipe.resize(400, 400, { fit: 'cover' });
  } else {
    thumbPipe = thumbPipe.resize(400);
  }
  const thumbBuffer = await thumbPipe.webp({ quality: 85 }).toBuffer();
  const thumbMeta = await sharp(thumbBuffer).metadata();
  const thumbSha = crypto
    .createHash('sha256')
    .update(thumbBuffer)
    .digest('hex');
  const thumbFilename = `${parsed.name}-400w-${thumbSha}.webp`;
  const thumbPath = path.join(outSubDir, thumbFilename);
  const thumbKey = path
    .join(parsed.dir, thumbFilename)
    .replace(/\\/g, '/')
    .replace(/^\//, '');

  // 2. card800: width 800px proportional
  const cardBuffer = await baseSharp
    .clone()
    .resize(800)
    .webp({ quality: 85 })
    .toBuffer();
  const cardMeta = await sharp(cardBuffer).metadata();
  const cardSha = crypto
    .createHash('sha256')
    .update(cardBuffer)
    .digest('hex');
  const cardFilename = `${parsed.name}-800w-${cardSha}.webp`;
  const cardPath = path.join(outSubDir, cardFilename);
  const cardKey = path
    .join(parsed.dir, cardFilename)
    .replace(/\\/g, '/')
    .replace(/^\//, '');

  // 3. full1600: width 1600px proportional
  const fullBuffer = await baseSharp
    .clone()
    .resize(1600)
    .webp({ quality: 85 })
    .toBuffer();
  const fullMeta = await sharp(fullBuffer).metadata();
  const fullSha = crypto
    .createHash('sha256')
    .update(fullBuffer)
    .digest('hex');
  const fullFilename = `${parsed.name}-1600w-${fullSha}.webp`;
  const fullPath = path.join(outSubDir, fullFilename);
  const fullKey = path
    .join(parsed.dir, fullFilename)
    .replace(/\\/g, '/')
    .replace(/^\//, '');

  // 4. avif1600: width 1600px AVIF
  const avifBuffer = await baseSharp
    .clone()
    .resize(1600)
    .avif({ quality: 75 })
    .toBuffer();
  const avifMeta = await sharp(avifBuffer).metadata();
  const avifSha = crypto
    .createHash('sha256')
    .update(avifBuffer)
    .digest('hex');
  const avifFilename = `${parsed.name}-1600w-${avifSha}.avif`;
  const avifPath = path.join(outSubDir, avifFilename);
  const avifKey = path
    .join(parsed.dir, avifFilename)
    .replace(/\\/g, '/')
    .replace(/^\//, '');

  // Remove stale variant files if keys have changed
  if (manifest.items[logicalId]?.variants) {
    for (const v of Object.values(manifest.items[logicalId].variants)) {
      if (
        v.key &&
        v.key !== thumbKey &&
        v.key !== cardKey &&
        v.key !== fullKey &&
        v.key !== avifKey
      ) {
        const oldFile = path.join(OUTPUT_DIR, v.key);
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      }
    }
  }

  // Write new variant files
  fs.writeFileSync(thumbPath, thumbBuffer);
  fs.writeFileSync(cardPath, cardBuffer);
  fs.writeFileSync(fullPath, fullBuffer);
  fs.writeFileSync(avifPath, avifBuffer);

  // Safe editorial metadata
  const editorialMeta = manifest.items[logicalId]?.metadata || {
    captureDate: new Date().toISOString(),
    cameraModel: 'Fujifilm X-T5',
    lens: 'XF 23mm F1.4 R LM WR',
    focalLength: '23mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/250s',
    iso: 160,
  };

  manifest.items[logicalId] = {
    id: logicalId,
    storageKeyPrefix: `${parsed.dir}/${parsed.name}`.replace(/\\/g, '/'),
    format: 'webp',
    width,
    height,
    aspectRatio,
    contentHash: `sha256-${hash.slice(0, 40)}`,
    variants: {
      thumb400: { key: thumbKey, w: thumbMeta.width, h: thumbMeta.height },
      card800: { key: cardKey, w: cardMeta.width, h: cardMeta.height },
      full1600: { key: fullKey, w: fullMeta.width, h: fullMeta.height },
      avif1600: { key: avifKey, w: avifMeta.width, h: avifMeta.height },
    },
    metadata: editorialMeta,
  };
}

async function main() {
  for (const img of imageFiles) {
    await processImage(img);
  }

  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  const count = Object.keys(manifest.items).length;
  console.log(`[process-media] Manifest written: ${count} items.`);
}

main().catch((err) => {
  console.error('[process-media] Error:', err);
  process.exit(1);
});
