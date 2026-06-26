import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const seed = JSON.parse(readFileSync('public/seed.json', 'utf8'));
const B = 'http://localhost:5280';
const API = 'http://localhost:3000';

// dev-login as a certified editor (all roles) so role-gated UI is exercised
const tok = (await (await fetch(API + '/auth/dev-login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sub: 'smoke-ed', accountId: 'acct:klak', assurance: 'certified', roles: ['editor', 'steward', 'reviewer', 'author', 'contributor'], name: 'A. Klak' }),
})).json()).token;

const routes = [
  { path: '/explore', key: 'Discovery' },
  { path: '/builder', key: 'Builder' },
  { path: '/review', key: 'Review' },
  { path: '/map', key: 'Map' },
  { path: '/capture', key: 'Capture' },
  { path: '/profile', key: 'Profile' },
  { path: '/m/demo', key: 'Lightbox' },
  { path: `/s/${encodeURIComponent(seed.snippetId)}`, key: 'SnippetViewer' },
];

const b = await chromium.launch();
const results = [];
for (const r of routes) {
  const ctx = await b.newContext({ viewport: { width: 1320, height: 880 } });
  await ctx.addInitScript((t) => localStorage.setItem('jose.token', t), tok);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('5984') && !t.includes('401') && !t.includes('Unauthorized')) errors.push('console: ' + t.slice(0, 90)); });
  try { await p.goto(B + r.path, { waitUntil: 'networkidle', timeout: 20000 }); } catch (e) { errors.push('goto: ' + e.message); }
  await p.waitForTimeout(1400);
  const text = (await p.locator('.shell-main').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 130);
  await p.screenshot({ path: `shot-${r.key}.png` });
  results.push({ key: r.key, url: p.url().replace(B, ''), pageerrors: errors.filter((e) => e.startsWith('PAGEERROR')).length, errs: errors.slice(0, 2), text });
  await ctx.close();
}
await b.close();
for (const r of results) console.log(`${r.key.padEnd(14)} pageerr=${r.pageerrors} ${r.errs.length ? JSON.stringify(r.errs) : ''}\n   ${r.text}`);
