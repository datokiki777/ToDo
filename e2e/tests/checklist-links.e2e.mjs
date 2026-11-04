import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true, colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('ვერქშტატები');
const lines = [
  'კოდს რო გაძლევს +4915114000029 https://maps.app.goo.gl/KbG3rmbSwsZqqEFFA',
  'ჰერფორდში, კალონკაზე +4917674898684 https://maps.app.goo.gl/WKydrZFa8UxJDmA19',
  'ვერთაში  +4917684315078',
  'პადერბრონში  +495254 9478378 https://maps.app.goo.gl/zfLLJHVTSLDjC2vs6',
];
// paste the four lines at once into the first row: each line becomes a row
await page.keyboard.press('Enter');
await page.locator('[data-list] textarea[data-field]').first().fill(lines.join('\n'));
await sleep(900);
const rows = page.locator('[data-list] > div > div');   // each checklist row
const n = await page.locator('[data-list] textarea[data-field]').count();
console.log('   rows:', n);
const rowLinks = async (i) => page.locator('[data-list] textarea[data-field]').nth(i).evaluate((ta) => [...ta.closest('div').querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target') })));
const r0 = await rowLinks(0), r1 = await rowLinks(1), r2 = await rowLinks(2), r3 = await rowLinks(3);
console.log('   row 1:', JSON.stringify(r0));
ok('row 1: BOTH a call button and a map button', r0.length === 2 && r0[0].href === 'tel:+4915114000029' && r0[1].href.startsWith('https://maps.app.goo.gl/KbG3'));
ok('row 2: both', r1.length === 2 && r1[0].href.startsWith('tel:') && r1[1].href.includes('WKyd'));
ok('row 3 (only a number): just the call button', r2.length === 1 && r2[0].href === 'tel:+4917684315078');
ok('row 4 (a number written with a space, and a map): both', r3.length === 2 && r3[0].href === 'tel:+4952549478378' && r3[1].href.includes('zfLLJ'));
ok('call buttons stay in the app, map buttons open a new tab', [...r0, ...r1, ...r2, ...r3].every((l) => (l.href.startsWith('tel:') ? l.target === null : l.target === '_blank')));
await page.screenshot({ path: `${OUT}/rows-1.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
