import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const samples = [
  {
    path: 'stories/forest-time/cover.jpg',
    color: { r: 52, g: 73, b: 60 },
  },
  {
    path: 'stories/tokyo-walk/cover.jpg',
    color: { r: 180, g: 140, b: 90 },
  },
  {
    path: 'stories/digital-garden/cover.jpg',
    color: { r: 120, g: 90, b: 70 },
  },
  {
    path: 'stories/mountain-light/cover.jpg',
    color: { r: 70, g: 85, b: 110 },
  },
  {
    path: 'moments/cedar-morning/photo-01.jpg',
    color: { r: 60, g: 85, b: 70 },
  },
  {
    path: 'moments/cedar-morning/photo-02.jpg',
    color: { r: 80, g: 105, b: 85 },
  },
  {
    path: 'moments/cedar-morning/photo-03.jpg',
    color: { r: 45, g: 65, b: 50 },
  },
  {
    path: 'moments/tokyo-evening/photo-01.jpg',
    color: { r: 140, g: 80, b: 70 },
  },
  {
    path: 'moments/tokyo-evening/photo-02.jpg',
    color: { r: 60, g: 60, b: 90 },
  },
  {
    path: 'moments/above-clouds/photo-01.jpg',
    color: { r: 90, g: 115, b: 140 },
  },
  {
    path: 'moments/above-clouds/photo-02.jpg',
    color: { r: 110, g: 135, b: 155 },
  },
  {
    path: 'moments/slow-sunday/photo-01.jpg',
    color: { r: 160, g: 130, b: 100 },
  },
  {
    path: 'moments/green-details/photo-01.jpg',
    color: { r: 75, g: 110, b: 75 },
  },
  {
    path: 'moments/green-details/photo-02.jpg',
    color: { r: 95, g: 125, b: 90 },
  },
  {
    path: 'moments/lake-notes/photo-01.jpg',
    color: { r: 65, g: 95, b: 120 },
  },
  {
    path: 'moments/lake-notes/photo-02.jpg',
    color: { r: 85, g: 110, b: 130 },
  },
];

async function main() {
  for (const s of samples) {
    const fullPath = path.join(process.cwd(), 'media/originals', s.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await sharp({
      create: {
        width: 1600,
        height: 1067,
        channels: 3,
        background: s.color,
      },
    })
      .jpeg({ quality: 90 })
      .toFile(fullPath);
  }
  console.log(`Generated ${samples.length} sample original photos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
