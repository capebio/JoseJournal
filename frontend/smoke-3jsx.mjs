import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const seed = JSON.parse(readFileSync('public/seed.json', 'utf8'));
const B = 'http://localhost:5280', API = 'http://localhost:3000';
const tok = (await (await fetch(API + '/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: 'smoke-ed', accountId: 'acct:klak', assurance: 'certified', roles: ['editor', 'steward', 'reviewer', 'author'], name: 'A. Klak' }) })).json()).token;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1340, height: 900 } });
await ctx.addInitScript((t) => localStorage.setItem('jose.token', t), tok);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('5984') && !t.includes('401') && !t.includes('Unauthorized') && !t.includes('404')) errors.push('console: ' + t.slice(0, 90)); });

// ── MAP ──
await p.goto(`${B}/map/${encodeURIComponent(seed.koId)}`, { waitUntil: 'networkidle', timeout: 20000 });
await p.waitForSelector('.mp-h-title', { timeout: 15000 });
await p.waitForTimeout(800);
const cellCounts = await p.locator('.mp-cell text').allInnerTexts();
const pendingCards = await p.locator('.po-card').count();
await p.screenshot({ path: 'shot-Map-qds.png' });

// precise-grant flow (editor can grant → policy engine serves in-session)
await p.getByRole('button', { name: /Precise/ }).click();
await p.waitForTimeout(300);
const reqCard = await p.locator('.mp-reqcard').count();
await p.locator('.mp-reqcard button.grant').click();
await p.waitForTimeout(2500);
const granted = await p.locator('.mp-grant').count();
const exactPoints = await p.locator('svg circle[fill="#A83A2C"]').count();
const exactWarn = await p.getByText('exact coordinates', { exact: false }).count();
await p.screenshot({ path: 'shot-Map-precise.png' });

// ── REVIEW ──
await p.goto(`${B}/review/${encodeURIComponent(seed.koId)}`, { waitUntil: 'networkidle', timeout: 20000 });
await p.waitForSelector('.rr-card', { timeout: 15000 });
await p.waitForTimeout(500);
const readyOk = await p.locator('.rr-check.ok').count();
const readyNo = await p.locator('.rr-check.no').count();
const warn = await p.locator('.rr-check.warn').count();
const releaseEnabled = await p.locator('.rr-btn').isEnabled();
await p.screenshot({ path: 'shot-Review-ready.png' });

console.log(JSON.stringify({
  map: { cells: cellCounts.length, cellCounts, pendingCards, reqCardOpened: reqCard, granted, exactPoints, exactWarn },
  review: { readyOk, readyNo, warn, releaseEnabled },
  errors,
}, null, 2));
await b.close();
