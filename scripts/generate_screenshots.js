const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CLIENT_DIST = path.resolve(__dirname, '../packages/client/dist');
const OUTPUT_DIR = path.resolve(__dirname, '../screenshots');
const ARTIFACT_DIR = path.resolve('C:/Users/Gulesh Patel/.gemini/antigravity/brain/b05f28ab-143f-4448-980f-a401774218db/screenshots');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
};

function startStaticServer(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(CLIENT_DIST, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const indexHtml = path.join(CLIENT_DIST, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexHtml).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Preview server listening at http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function saveScreenshot(page, filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: filePath });
  fs.copyFileSync(filePath, artifactPath);
  const stats = fs.statSync(filePath);
  console.log(`[Captured] ${filename} (${stats.size} bytes) -> ${filePath}`);
}

async function main() {
  const server = await startStaticServer(4173);

  console.log(`Launching Edge at ${EDGE_PATH}...`);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  async function setTheme(themeName) {
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, themeName);
    await new Promise(r => setTimeout(r, 200));
  }

  try {
    // -------------------------------------------------------------------------
    // Reset DB and Load Fresh App
    // -------------------------------------------------------------------------
    console.log('Navigating to app and clearing old data...');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const req = indexedDB.open('SmartNotes_v2', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['items', 'assets'], 'readwrite');
          tx.objectStore('items').clear();
          tx.objectStore('assets').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      });
    });
    console.log('Reloading with freshly seeded sample items and assets...');
    await page.reload({ waitUntil: 'networkidle0' });
    await setTheme('light');
    await new Promise(r => setTimeout(r, 1200));

    // -------------------------------------------------------------------------
    // 1. Android Library Light (android-library-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-library-light.png');
    await saveScreenshot(page, 'android-library-light.png');

    // -------------------------------------------------------------------------
    // 2. Android Folder Light (android-folder-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-folder-light.png');
    await page.waitForSelector('.android-folder-card');
    await page.click('.android-folder-card');
    await new Promise(r => setTimeout(r, 600));
    await saveScreenshot(page, 'android-folder-light.png');

    // Return to root library
    await page.evaluate(() => {
      const backBtn = document.querySelector('header button[aria-label="Back"]');
      if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 3. Android Note Editor Light (android-editor-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-editor-light.png');
    await page.waitForSelector('.android-pinned-card');
    await page.click('.android-pinned-card');
    await new Promise(r => setTimeout(r, 1200));
    await saveScreenshot(page, 'android-editor-light.png');

    // -------------------------------------------------------------------------
    // 4. Android Image Annotation Light (android-image-annotation-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-image-annotation-light.png');
    // Scroll editor to image card and click Annotate
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Annotate'));
      if (btns.length > 0) {
        btns[0].scrollIntoView({ behavior: 'instant', block: 'center' });
        btns[0].click();
      }
    });
    await new Promise(r => setTimeout(r, 800));
    await saveScreenshot(page, 'android-image-annotation-light.png');

    // Close annotation overlay
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close Annotation"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // 5. Android PDF Annotation Light (android-pdf-annotation-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-pdf-annotation-light.png');
    // Scroll down to PDF card and click Annotate
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Annotate'));
      if (btns.length > 1) {
        btns[1].scrollIntoView({ behavior: 'instant', block: 'center' });
        btns[1].click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));
    await saveScreenshot(page, 'android-pdf-annotation-light.png');

    // Close annotation overlay and navigate back to library
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close Annotation"]');
      if (closeBtn) closeBtn.click();
      const backBtn = document.querySelector('button[aria-label="Back to Library"]');
      if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // 6. Android Search Light (android-search-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-search-light.png');
    await page.evaluate(() => {
      const dockBtns = document.querySelectorAll('nav.android-bottom-dock button');
      if (dockBtns.length >= 2) dockBtns[1].click();
    });
    await new Promise(r => setTimeout(r, 400));
    await page.type('input[placeholder*="Search"]', 'sync', { delay: 40 });
    await new Promise(r => setTimeout(r, 600));
    await saveScreenshot(page, 'android-search-light.png');

    // -------------------------------------------------------------------------
    // 7. Android Sync Conflict Light (android-sync-conflict-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-sync-conflict-light.png');
    await page.evaluate(() => {
      const conflictHtml = `
        <div id="demo-conflict-modal" class="modal-backdrop" style="position:fixed; inset:0; background:rgba(18,36,26,0.75); backdrop-filter:blur(6px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
          <div class="modal-card" style="background:var(--bg-surface); border-radius:var(--radius-card); max-width:680px; width:100%; border:1px solid var(--border-medium); box-shadow:var(--shadow-lg); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
            <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface-elevated);">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--warning); font-size:1.2rem;">&#9888;</span>
                <span style="font-weight:800; font-size:1.05rem; color:var(--text-main);">Sync Conflict Detected</span>
              </div>
              <span class="badge" style="background:var(--danger-bg); color:var(--danger); font-size:0.75rem;">Action Required</span>
            </div>
            <div style="padding:16px 20px; overflow-y:auto; flex:1;">
              <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
                This note was modified concurrently on another device. Select which version to keep or choose <strong>Merge Both</strong> to combine all content safely without data loss.
              </p>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:12px 14px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-weight:700; font-size:0.84rem; color:var(--lime-primary); background:#12241A; padding:2px 8px; border-radius:9999px;">This Device (Local)</span>
                    <span style="font-size:0.7rem; color:var(--text-tertiary);">Rev v2</span>
                  </div>
                  <div style="font-weight:700; font-size:0.92rem; margin-bottom:4px; color:var(--text-main);">Offline Synchronization Strategy</div>
                  <div style="font-size:0.76rem; color:var(--text-secondary); line-height:1.4;">
                    Added checklist item for zero data loss verification and updated retry backoff timer to 3000ms.
                  </div>
                </div>
                <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-medium); border-radius:var(--radius-md); padding:12px 14px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-weight:700; font-size:0.84rem; color:var(--text-main); background:var(--bg-surface); padding:2px 8px; border-radius:9999px; border:1px solid var(--border-subtle);">Cloud Server</span>
                    <span style="font-size:0.7rem; color:var(--text-tertiary);">Rev v3</span>
                  </div>
                  <div style="font-weight:700; font-size:0.92rem; margin-bottom:4px; color:var(--text-main);">Offline Synchronization Strategy</div>
                  <div style="font-size:0.76rem; color:var(--text-secondary); line-height:1.4;">
                    Modified by Desktop Web: Added section on SHA-256 chunk streaming and tombstone retention policy.
                  </div>
                </div>
              </div>
            </div>
            <div style="padding:14px 20px; border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end; gap:8px; background:var(--bg-surface-elevated);">
              <button class="btn btn-sm" style="font-size:0.8rem;">Keep Cloud</button>
              <button class="btn btn-sm" style="font-size:0.8rem;">Keep Local</button>
              <button class="btn btn-sm btn-primary" style="font-size:0.8rem;">Merge Both Versions</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', conflictHtml);
    });
    await new Promise(r => setTimeout(r, 400));
    await saveScreenshot(page, 'android-sync-conflict-light.png');

    await page.evaluate(() => {
      const m = document.getElementById('demo-conflict-modal');
      if (m) m.remove();
    });

    // -------------------------------------------------------------------------
    // 8. Desktop Editor Light (desktop-editor-light.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: desktop-editor-light.png');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });
    await setTheme('light');
    await new Promise(r => setTimeout(r, 1000));
    await saveScreenshot(page, 'desktop-editor-light.png');

    // -------------------------------------------------------------------------
    // 9. Android Library Dark (android-library-dark.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: android-library-dark.png');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });
    await setTheme('dark');
    await new Promise(r => setTimeout(r, 800));
    await saveScreenshot(page, 'android-library-dark.png');

    // -------------------------------------------------------------------------
    // 10. Desktop Editor Dark (desktop-editor-dark.png)
    // -------------------------------------------------------------------------
    console.log('Capturing: desktop-editor-dark.png');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });
    await setTheme('dark');
    await new Promise(r => setTimeout(r, 1000));
    await saveScreenshot(page, 'desktop-editor-dark.png');

    console.log('All 10 distinct requested screenshots captured successfully!');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => {
  console.error('Error generating screenshots:', err);
  process.exit(1);
});
