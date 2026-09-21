const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create directory if not exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00843D" />
      <stop offset="100%" stop-color="#006830" />
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84BD00" />
      <stop offset="100%" stop-color="#00843D" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  
  <!-- Rounded Base Background -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)"/>
  
  <!-- Camposol Sun / Leaf subtle arc -->
  <path d="M 380 70 C 440 130 440 220 380 280 C 330 220 330 130 380 70 Z" fill="#FFB81C" opacity="0.9"/>
  <path d="M 400 90 C 450 140 450 210 400 260 C 360 210 360 140 400 90 Z" fill="#84BD00" opacity="0.8"/>

  <!-- Bus Icon Container -->
  <g filter="url(#shadow)" transform="translate(106, 120)">
    <!-- Bus Body -->
    <rect x="15" y="20" width="270" height="230" rx="36" fill="#FFFFFF"/>
    
    <!-- Windshield / Top Window -->
    <rect x="35" y="45" width="230" height="80" rx="16" fill="#173B56"/>
    
    <!-- Windshield Divider -->
    <rect x="145" y="45" width="10" height="80" rx="4" fill="#00843D"/>
    
    <!-- Route sign above windshield -->
    <rect x="90" y="28" width="120" height="10" rx="5" fill="#E8F5EF"/>
    
    <!-- Passenger lower line/bumper banner -->
    <rect x="15" y="165" width="270" height="28" fill="#E8F5EF"/>
    <text x="150" y="184" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#00843D" text-anchor="middle" letter-spacing="2">CAMPOSOL</text>
    
    <!-- Headlights -->
    <circle cx="55" cy="215" r="14" fill="#FFB81C"/>
    <circle cx="245" cy="215" r="14" fill="#FFB81C"/>
    <rect x="110" y="210" width="80" height="10" rx="5" fill="#CBD5E1"/>
    
    <!-- Wheels -->
    <rect x="40" y="240" width="45" height="30" rx="10" fill="#0F2435"/>
    <rect x="215" y="240" width="45" height="30" rx="10" fill="#0F2435"/>
  </g>
  
  <!-- App Label Badge at bottom -->
  <rect x="96" y="420" width="320" height="44" rx="22" fill="#FFFFFF" opacity="0.95"/>
  <text x="256" y="448" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="19" fill="#00843D" text-anchor="middle" letter-spacing="1">TRANSPORTE</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');

// Function to generate PNG raster files with proper dimensions and drawn graphics
function createBusPng(size, isMaskable = false) {
  const w = size;
  const h = size;
  const rowSize = 1 + w * 4;
  const buffer = Buffer.alloc(h * rowSize);

  // Colors
  const cBg = [0, 132, 61, 255];       // #00843D
  const cWhite = [255, 255, 255, 255]; // #FFFFFF
  const cDark = [23, 59, 86, 255];     // #173B56
  const cYellow = [255, 184, 28, 255]; // #FFB81C
  const cLightGreen = [232, 245, 239, 255]; // #E8F5EF

  function setPixel(x, y, color) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * rowSize + 1 + x * 4;
    buffer[idx] = color[0];
    buffer[idx + 1] = color[1];
    buffer[idx + 2] = color[2];
    buffer[idx + 3] = color[3];
  }

  function fillRect(rx, ry, rw, rh, color) {
    for (let py = Math.floor(ry); py < Math.floor(ry + rh); py++) {
      for (let px = Math.floor(rx); px < Math.floor(rx + rw); px++) {
        setPixel(px, py, color);
      }
    }
  }

  function fillCircle(cx, cy, r, color) {
    const r2 = r * r;
    for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
      for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          setPixel(px, py, color);
        }
      }
    }
  }

  // Fill solid background
  for (let y = 0; y < h; y++) {
    buffer[y * rowSize] = 0; // PNG filter None
    for (let x = 0; x < w; x++) {
      setPixel(x, y, cBg);
    }
  }

  // Scale coordinates inside safe area
  const scale = size / 512;
  const padding = isMaskable ? 0.2 : 0.08;
  const innerScale = (1 - padding * 2);
  const ox = size * padding;
  const oy = size * padding;

  function tx(x) { return ox + (x * scale * innerScale * (512 / 300)); }
  function ty(y) { return oy + (y * scale * innerScale * (512 / 300)); }

  // Draw Bus body
  const busX = ox + size * innerScale * 0.15;
  const busY = oy + size * innerScale * 0.18;
  const busW = size * innerScale * 0.7;
  const busH = size * innerScale * 0.55;

  fillRect(busX, busY, busW, busH, cWhite);

  // Windows
  const winX = busX + busW * 0.08;
  const winY = busY + busH * 0.12;
  const winW = busW * 0.84;
  const winH = busH * 0.35;
  fillRect(winX, winY, winW, winH, cDark);

  // Center window divider
  fillRect(winX + winW * 0.48, winY, winW * 0.04, winH, cBg);

  // Green brand stripe
  const stripeY = busY + busH * 0.60;
  const stripeH = busH * 0.12;
  fillRect(busX, stripeY, busW, stripeH, cLightGreen);

  // Headlights
  const lightR = busW * 0.06;
  fillCircle(busX + busW * 0.18, busY + busH * 0.82, lightR, cYellow);
  fillCircle(busX + busW * 0.82, busY + busH * 0.82, lightR, cYellow);

  // Wheels
  const wheelW = busW * 0.18;
  const wheelH = busH * 0.12;
  fillRect(busX + busW * 0.12, busY + busH, wheelW, wheelH, cDark);
  fillRect(busX + busW * 0.70, busY + busH, wheelW, wheelH, cDark);

  // Sun accent
  fillCircle(size * (1 - padding * 1.3), size * (padding * 1.4), size * 0.08, cYellow);

  // Deflate and wrap chunk
  const compressed = zlib.deflateSync(buffer);

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
      }
    }
    return ~c >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createBusPng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createBusPng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createBusPng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createBusPng(180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createBusPng(48, false));

console.log('Icons generated successfully in public/');
