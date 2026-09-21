import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateIcons() {
  const svgPath = path.resolve('public/icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const targets = [
    { file: 'public/pwa-512x512.png', size: 512, input: 'public/icon.svg' },
    { file: 'public/pwa-maskable-512x512.png', size: 512, input: 'public/icon.svg' },
    { file: 'public/pwa-192x192.png', size: 192, input: 'public/icon.svg' },
    { file: 'public/apple-touch-icon.png', size: 180, input: 'public/icon.svg' },
    { file: 'public/favicon.ico', size: 64, input: 'public/icon.svg' },
    { file: 'public/camposol-emblem.png', size: 512, input: 'public/camposol-emblem.svg' },
  ];

  for (const { file, size, input } of targets) {
    const buf = fs.readFileSync(path.resolve(input));
    await sharp(buf)
      .resize(size, size)
      .png()
      .toFile(path.resolve(file));
    console.log(`Generated: ${file} (${size}x${size})`);
  }

  // Generate banner png
  const bannerBuf = fs.readFileSync(path.resolve('public/camposol-banner.svg'));
  await sharp(bannerBuf)
    .resize(600, 300)
    .png()
    .toFile(path.resolve('public/camposol-banner.png'));
  console.log('Generated: public/camposol-banner.png (600x300)');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
