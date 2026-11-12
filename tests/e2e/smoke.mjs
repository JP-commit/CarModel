import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/google/chrome/chrome',
];

const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Chromium binary found for Playwright smoke test.');
  process.exit(1);
}

const server = spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], {
  stdio: 'pipe',
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Preview server startup timeout')), 12000);
  server.stdout.on('data', (chunk) => {
    if (String(chunk).includes('4179')) {
      clearTimeout(timeout);
      resolve();
    }
  });
  server.stderr.on('data', (chunk) => {
    const msg = String(chunk);
    if (msg.includes('4179')) {
      clearTimeout(timeout);
      resolve();
    }
  });
});

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:4179/?car=coupe', { waitUntil: 'networkidle' });
  await page.waitForSelector('.loader-banner.is-done');
  await page.waitForSelector('.rail-btn[data-system-id="transmission"]');

  // 1. Select Transmission on coupe, verify CVT is available, switch variant -> DCT
  await page.click('.rail-btn[data-system-id="transmission"]');
  await page.waitForSelector('.variant-seg-btn[data-variant-id="cvt"]');
  await page.waitForSelector('.variant-seg-btn[data-variant-id="dct"]');
  await page.click('.variant-seg-btn[data-variant-id="dct"]');
  await page.waitForFunction(() => document.querySelector('#panel-title')?.textContent?.includes('Dual-Clutch'));

  // Test CVT selection cleanly in Lesson 2 too
  await page.click('.variant-seg-btn[data-variant-id="cvt"]');
  await page.waitForFunction(() => document.querySelector('#panel-title')?.textContent?.includes('CVT'));

  // 2. Enter Lesson (starts in Outline mode at 0% explode), toggle Solid <-> Outline mid-animation cleanly
  await page.click('#btn-start-animation');
  await page.waitForSelector('#lesson-side-panel:not(.is-hidden)');
  const lessonExplodeInit = await page.locator('#lesson-explode').inputValue();
  if (lessonExplodeInit !== '0') {
    throw new Error(`Expected lesson explode to start at 0%, got ${lessonExplodeInit}%`);
  }
  await page.waitForSelector('#lesson-live-telemetry:not([hidden])');
  await page.click('.render-mode-btn[data-render-mode="solid"]');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-render-mode') === 'solid');
  await page.click('.render-mode-btn[data-render-mode="outline"]');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-render-mode') === 'outline');

  // Switch transmission type inside Lesson directly to AT & test component explode slider
  await page.click('#lesson-side-panel .variant-seg-btn[data-variant-id="at"]');
  await page.waitForFunction(() =>
    document.querySelector('#lesson-side-panel .panel-title')?.textContent?.includes('Planetary Automatic'),
  );
  await page.locator('#lesson-explode').fill('75');
  await page.locator('#lesson-explode').dispatchEvent('input');
  await page.click('#btn-lesson-back');

  // 3. Open Engine, test Home Exploded slider BEFORE Start animation (explodes car parts!), switch to V8, enter lesson & check Engine Stats Panel
  await page.click('.rail-btn[data-system-id="engine"]');
  await page.locator('#home-explode-slider').fill('50');
  await page.locator('#home-explode-slider').dispatchEvent('input');
  // Hotspots remain car-system pins when exploding car parts before Start animation
  const hotspotCount = await page.locator('#label-layer .hotspot-dot-btn').count();
  if (hotspotCount === 0) {
    throw new Error('Expected car system hotspots to remain active during Home car-parts explode');
  }
  await page.locator('#home-explode-slider').fill('0');
  await page.locator('#home-explode-slider').dispatchEvent('input');
  await page.waitForSelector('.variant-seg-btn[data-variant-id="v8"]');
  await page.click('.variant-seg-btn[data-variant-id="v8"]');
  await page.click('#btn-start-animation');
  await page.waitForSelector('#engine-firing-strip .firing-cyl-pill');
  const cylCount = await page.locator('#engine-firing-strip .firing-cyl-pill').count();
  if (cylCount !== 8) throw new Error(`Expected 8 firing-order pills for V8, got ${cylCount}`);
  await page.click('#btn-lesson-back');

  // 4. Open Learning Lab Modal (Drive Sim, Faults, Challenges, Paths)
  await page.click('#btn-open-lab');
  await page.waitForSelector('#lab-modal-card');
  await page.click('.lab-tab-btn[data-tab="faults"]');
  await page.waitForSelector('.lab-fault-launch');
  await page.click('#lab-close-btn');

  // 5. Switch to Compare -> Transmissions
  await page.click('.mode-seg-btn[data-view-mode="compare"]');
  await page.waitForSelector('.compare-cat-btn[data-cat="transmissions"]');
  await page.click('.compare-cat-btn[data-cat="transmissions"]');
  await page.waitForSelector('.compare-slot-btn[data-slot="dct"]');
  await page.click('#compare-back-btn');

  // 6. Switch to EV car (Alpine A390) and ensure incompatible ICE pickers are hidden
  await page.click('#btn-car-picker');
  await page.waitForSelector('.car-card[data-car-id="alpine-a390"]');
  await page.click('.car-card[data-car-id="alpine-a390"]');
  await page.waitForFunction(() => document.querySelector('#car-picker-name')?.textContent?.includes('Alpine'));
  await page.waitForSelector('.loader-banner.is-done');
  await page.click('.rail-btn[data-system-id="engine"]');
  const variantCountEv = await page.locator('#home-variant-slot .variant-seg-btn').count();
  if (variantCountEv !== 0) throw new Error(`Expected 0 engine variants on EV, got ${variantCountEv}`);

  // 7. Mobile viewport check (dropdown variant selector visible)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4179/?car=sedan', { waitUntil: 'networkidle' });
  await page.waitForSelector('.loader-banner.is-done');
  await page.waitForSelector('.swipe-card[data-system-id="transmission"]');
  await page.click('.swipe-card[data-system-id="transmission"]');
  await page.waitForSelector('#home-variant-select');

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Console/Page errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  }

  console.log('Playwright smoke verification PASSED (0 console errors, 0 page errors).');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

