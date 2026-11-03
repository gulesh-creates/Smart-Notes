const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PUBLIC_DIR = path.resolve(__dirname, '../packages/client/public');

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Lime Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C5F840" />
      <stop offset="100%" stop-color="#9AE215" />
    </linearGradient>

    <!-- Note Body Dark Gradient -->
    <linearGradient id="noteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#182A1D" />
      <stop offset="100%" stop-color="#0E1A12" />
    </linearGradient>

    <!-- Drop Shadow for Document -->
    <filter id="docShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0B160E" flood-opacity="0.32" />
    </filter>

    <!-- Soft Sparkle Glow -->
    <filter id="sparkleGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Squircle Base Canvas -->
  <rect x="16" y="16" width="480" height="480" rx="124" fill="url(#bgGrad)" />
  <rect x="16" y="16" width="480" height="480" rx="124" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="6" />

  <!-- Note Card with Elevation -->
  <g filter="url(#docShadow)">
    <!-- Document Body with Fold Cutout -->
    <path d="M 152 96
             H 296
             L 372 172
             V 380
             C 372 400 356 416 336 416
             H 152
             C 132 416 116 400 116 380
             V 132
             C 116 112 132 96 152 96 Z"
          fill="url(#noteGrad)" />

    <!-- Folded Corner Flap -->
    <path d="M 296 96
             V 152
             C 296 163 305 172 316 172
             H 372 Z"
          fill="#B9F32A" />

    <!-- 3 Note Content Lines -->
    <rect x="162" y="212" width="162" height="24" rx="12" fill="#B9F32A" />
    <rect x="162" y="264" width="136" height="24" rx="12" fill="#B9F32A" opacity="0.85" />
    <rect x="162" y="316" width="98" height="24" rx="12" fill="#B9F32A" opacity="0.65" />
  </g>

  <!-- Smart 4-Point Sparkle Star on Top Right Corner -->
  <g filter="url(#sparkleGlow)">
    <path d="M 404 54
             C 404 84 418 96 444 100
             C 418 104 404 116 404 146
             C 404 116 390 104 364 100
             C 390 96 404 84 404 54 Z"
          fill="#FFFFFF" />
  </g>
</svg>`;

// Helper function to build a multi-icon ICO file from PNG buffers
function createIco(images) {
  // images: array of { width, height, buffer }
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const dirEntries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map(img => img.buffer)]);
}

async function generateFavicons() {
  // 1. Write favicon.svg
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgContent, 'utf8');
  console.log('Written favicon.svg');

  // 2. Render PNGs using Puppeteer & Edge
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { width: 100%; height: 100%; overflow: hidden; background: transparent; }
          svg { width: 100%; height: 100%; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `;
  await page.setContent(htmlContent);

  async function renderPng(size) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    return await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size }
    });
  }

  const buf16 = await renderPng(16);
  const buf32 = await renderPng(32);
  const buf48 = await renderPng(48);
  const buf180 = await renderPng(180);
  const buf192 = await renderPng(192);
  const buf512 = await renderPng(512);

  await browser.close();

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), buf16);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), buf32);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), buf180);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'android-chrome-192x192.png'), buf192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'android-chrome-512x512.png'), buf512);

  // 3. Create multi-resolution favicon.ico (16, 32, 48)
  const icoBuf = createIco([
    { width: 16, height: 16, buffer: buf16 },
    { width: 32, height: 32, buffer: buf32 },
    { width: 48, height: 48, buffer: buf48 }
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuf);
  console.log('Generated all favicon assets and favicon.ico in packages/client/public/');

  // 4. Create site.webmanifest
  const manifest = {
    name: "Smart Notes",
    short_name: "SmartNotes",
    icons: [
      {
        src: "./android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "./android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    theme_color: "#B9F32A",
    background_color: "#F6F7F3",
    display: "standalone"
  };
  fs.writeFileSync(path.join(PUBLIC_DIR, 'site.webmanifest'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Written site.webmanifest');
}

generateFavicons().catch(err => {
  console.error(err);
  process.exit(1);
});
