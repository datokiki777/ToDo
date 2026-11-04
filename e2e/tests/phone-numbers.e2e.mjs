import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newNote = async (kind) => { await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: kind, exact: true }).tap(); await page.waitForSelector('textarea:focus'); };
const back = async () => { await sleep(800); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li'); };

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---- a note full of numbers: only the real phone numbers become buttons ----
await newNote('ტექსტი');
await page.keyboard.type('კონტაქტები'); await page.keyboard.press('Enter');
await page.keyboard.type('გიორგი +995 555 12 34 56 და ოფისი (032) 2 12 34 56\nთარიღი 12.05.2026, ფასი 5000.50, კოდი 01001012345, ბარათი 1234 5678 9012 3456\nკოორდინატები 41.7151, 44.8271\nhttps://maps.app.goo.gl/AbCd123');
await sleep(900);
const links = page.locator('ul[aria-label="ბმულები"] a');
const info = await links.evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), text: a.innerText.replace(/\n+/g, ' | ') })));
console.log('   links:', JSON.stringify(info));
ok('three buttons: two phone numbers and the map', info.length === 3);
ok('the numbers dial the right international numbers', info.some((i) => i.href === 'tel:+995555123456') && info.some((i) => i.href === 'tel:+995322123456'));
ok('phone buttons do not open a new tab (they hand over to the dialer)', info.filter((i) => i.href.startsWith('tel:')).every((i) => i.target === null));
ok('the map link still opens in a new tab', info.find((i) => i.href.includes('maps.app'))?.target === '_blank');
ok('a phone button says what it does ("დარეკვა")', info.find((i) => i.href.startsWith('tel:')).text.includes('დარეკვა'));
ok('dates, prices, ID codes, cards and coordinates are NOT turned into buttons', info.every((i) => !/05\.2026|5000|0100101|1234 5678|41\.7151/.test(i.href + i.text)));
await page.screenshot({ path: `${OUT}/ph-1-editor.png` });
await back();
const multi = await page.locator('ul li', { hasText: 'კონტაქტები' }).innerText();
ok('the card shows how many links there are (3), no single quick button', /3/.test(multi) && (await page.locator('ul li', { hasText: 'კონტაქტები' }).locator('a[href^="tel:"]').count()) === 0);

// ---- a note that is only a number ----
await newNote('ტექსტი');
await page.keyboard.type('555 12 34 56'); await back();
const only = page.locator('ul li', { hasText: '555 12 34 56' });
ok('the card is titled with the number', (await only.locator('a').first().innerText()).includes('555 12 34 56'));
const call = only.locator('a[href="tel:+995555123456"]');
ok('and has one big call button, not opening a tab', (await call.count()) === 1 && (await call.getAttribute('target')) === null);
ok('whose label tells it will call', (await call.getAttribute('aria-label')).includes('დარეკვა'));
await page.screenshot({ path: `${OUT}/ph-2-list.png` });

// ---- a checklist row with a number ----
await newNote('ჩეკლისტი');
await page.keyboard.type('დასარეკი'); await page.keyboard.press('Enter');
await page.keyboard.type('მეწარმე 598 11 22 33'); await sleep(500);
ok('a checklist row with a number gets its own call button', (await page.locator('[data-list] a[href="tel:+995598112233"]').count()) === 1);
await back();
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
