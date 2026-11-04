import { launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const saved = () => page.evaluate(() => new Promise((res) => {
  const q = indexedDB.open('todo-db');
  q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').getAll(); g.onsuccess = () => { q.result.close(); res(g.result.map((n) => (n.title + ' ' + n.body).trim())); }; };
}));

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');

// ---- typing that never pauses (a key every 120 ms for ~7 seconds) ----
const sentence = 'ა'.repeat(60);
const typing = page.keyboard.type(sentence, { delay: 120 });
await sleep(4200);
const midway = (await saved()).join('|');
console.log('   saved while still typing:', midway.length, 'of', sentence.length, 'characters');
ok('while typing goes on without a pause, what is typed so far is already saved', midway.length > 10 && midway.length < sentence.length);
await typing;
await sleep(700);
ok('and everything is saved at the end', (await saved()).join('|').length === sentence.length);

// ---- the usual way: stop typing, it is saved within a moment ----
await page.keyboard.type(' ბ'); await sleep(900);
ok('a short pause saves too', (await saved()).join('|').endsWith('ბ'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
