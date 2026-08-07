import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SCREENSHOT_URL || 'http://127.0.0.1:3000';
const outDir = path.resolve('docs/screenshots');

const captures = [
  {
    file: '01-dashboard-header.png',
    description: 'Dashboard header with key metrics and navigation',
    selector: 'header'
  },
  {
    file: '02-lead-queue-table.png',
    description: 'AI-scored lead queue with scoring and deal readiness',
    selector: 'section:nth-of-type(1)'
  },
  {
    file: '03-followup-tasks.png',
    description: 'Follow-up task queue and recent activity',
    selector: 'section:nth-of-type(2)'
  },
  {
    file: '04-activity-log.png',
    description: 'Recent activity and engagement timeline',
    selector: 'section:nth-of-type(3)'
  },
  {
    file: '00-full-page.png',
    description: 'Full-page portfolio demo screenshot',
    fullPage: true
  }
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.emulateMedia({ colorScheme: 'light' });

const manifest = [];
for (const capture of captures) {
  const outputPath = path.join(outDir, capture.file);
  if (capture.fullPage) {
    await page.screenshot({ path: outputPath, fullPage: true });
  } else {
    try {
      const element = page.locator(capture.selector).first();
      await element.waitFor({ timeout: 5000 });
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await element.screenshot({ path: outputPath });
    } catch (e) {
      console.warn(`Warning: Could not capture ${capture.file}: ${e.message}`);
      continue;
    }
  }
  manifest.push({ file: `docs/screenshots/${capture.file}`, description: capture.description });
}

await browser.close();
console.log(JSON.stringify({ ok: true, baseUrl, screenshots: manifest }, null, 2));
