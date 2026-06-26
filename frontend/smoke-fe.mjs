import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1320, height: 880 } });
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await p.goto('http://localhost:5280/', { waitUntil: 'networkidle', timeout: 20000 });
await p.waitForSelector('.jose-title', { timeout: 20000 });
const title = (await p.textContent('.jose-title'))?.trim();

// AC 11.1 — lens change updates the URL (shareable composed view)
const urlBefore = p.url();
const lensbar = p.locator('.jose-lensbar');
await lensbar.getByRole('button', { name: 'Provenance', exact: true }).click();
await p.waitForTimeout(250);
const urlProv = p.url();
await lensbar.getByRole('button', { name: 'Popular' }).click();
await p.waitForTimeout(300);
const urlPop = p.url();

// claim → evidence reveal
const claim = p.locator('.jose-claim-marker').first();
const claimCount = await claim.count();
// back to academic so the claim marker is present, then expand
await lensbar.getByRole('button', { name: 'Academic' }).click();
await p.waitForTimeout(200);
const c2 = p.locator('.jose-claim-marker').first();
if (await c2.count()) { await c2.click(); await p.waitForTimeout(200); }
const evidence = await p.locator('.jose-evidence').count();

// reviewer overlay (default on) shows dispositions
const revCount = await p.locator('.jose-rev').count();

await p.screenshot({ path: 'fe-smoke.png' });
console.log(JSON.stringify({
  title,
  ac_11_1_url_changes_on_lens: { urlBefore: urlBefore.includes('annotations') , urlProv: urlProv.includes('provenance'), urlPop: urlPop.includes('register=popular') },
  claimCount, evidence, revCount, errors,
}, null, 2));
await b.close();
