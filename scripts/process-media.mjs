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
  const thumbPath = path.join(outSubDir, `${parsed.name}-400w.webp`);
  const thumbKey = `${parsed.dir}/${parsed.name}-400w.webp`.replace(/^\//, '');
  if (isMoment) {
    await baseSharp
      .clone()
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(thumbPath);
  } else {
    await baseSharp
      .clone()
      .resize(400)
      .webp({ quality: 85 })
      .toFile(thumbPath);
  }

  // 2. card800: width 800px proportional
  const cardPath = path.join(outSubDir, `${parsed.name}-800w.webp`);
  const cardKey = `${parsed.dir}/${parsed.name}-800w.webp`.replace(/^\//, '');
  await baseSharp
    .clone()
    .resize(800)
    .webp({ quality: 85 })
    .toFile(cardPath);

  // 3. full1600: width 1600px proportional
  const fullPath = path.join(outSubDir, `${parsed.name}-1600w.webp`);
  const fullKey = `${parsed.dir}/${parsed.name}-1600w.webp`.replace(/^\//, '');
  await baseSharp
    .clone()
    .resize(1600)
    .webp({ quality: 85 })
    .toFile(fullPath);

  // 4. avif1600: width 1600px AVIF
  const avifPath = path.join(outSubDir, `${parsed.name}-1600w.avif`);
  const avifKey = `${parsed.dir}/${parsed.name}-1600w.avif`.replace(/^\//, '');
  await baseSharp
    .clone()
    .resize(1600)
    .avif({ quality: 75 })
    .toFile(avifPath);

  // Safe editorial metadata
  const editorialMeta = {
    captureDate: new Date().toISOString(),
    cameraModel: 'Fujifilm X-T5',
    lens: 'XF 23mm F1.4 R LM WR',
    focalLength: '23mm',
    aperture: 'f/2.8',
    shutterSpeed: '1/250s',
    iso: 160,
  };

  const thumbHeight = isMoment ? 400 : Math.round(400 / aspectRatio);

  manifest.items[logicalId] = {
    id: logicalId,
    storageKeyPrefix: `${parsed.dir}/${parsed.name}`,
    format: 'webp',
    width,
    height,
    aspectRatio,
    contentHash: `sha256-${hash.slice(0, 40)}`,
    variants: {
      thumb400: { key: thumbKey, w: 400, h: thumbHeight },
      card800: { key: cardKey, w: 800, h: Math.round(800 / aspectRatio) },
      full1600: { key: fullKey, w: 1600, h: Math.round(1600 / aspectRatio) },
      avif1600: { key: avifKey, w: 1600, h: Math.round(1600 / aspectRatio) },
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
