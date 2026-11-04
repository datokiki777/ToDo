import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => page.locator('[data-list] textarea[data-field]');
const texts = async () => (await rows().evaluateAll((els) => els.map((e) => e.value))).filter((t) => t !== '');
const handle = (i) => page.locator('[data-list] button[aria-label^="გადაადგილება"]').nth(i);
const cdp = await ctx.newCDPSession(page);
// A real finger: touch events go in at a low level, and the browser turns them into pointer events.
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function dragHandle(from, toY, steps = 12) {
  const start = await centre(handle(from));
  await touch('touchStart', start.x, start.y); await sleep(60);
  for (let i = 1; i <= steps; i += 1) { await touch('touchMove', start.x, start.y + ((toY - start.y) * i) / steps); await sleep(16); }
  return start;
}

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('რიგი');
for (const t of ['ა', 'ბ', 'გ', 'დ']) { await page.keyboard.press('Enter'); await page.keyboard.type(t); }
await sleep(300);

ok('four rows, each with a grip', (await texts()).length === 4 && (await page.locator('[data-list] button[aria-label^="გადაადგილება"]').count()) === 4);
await page.screenshot({ path: `${OUT}/ro-1-grips.png` });

// ---- drag the first row down below the third (a finger) ----
const rowH = (await rows().first().boundingBox()).height;
const start = await dragHandle(0, (await centre(handle(0))).y + rowH * 2.2);
const mid = await page.locator('[data-dragging=true]').count();
ok('while dragging, the row is lifted and follows the finger', mid === 1);
const lifted = await page.locator('[data-dragging=true] textarea').inputValue();
await page.screenshot({ path: `${OUT}/ro-2-dragging.png` });
await touch('touchEnd', start.x, start.y);
await sleep(300);
console.log('   order after the drag:', JSON.stringify(await texts()));
ok('the first row now sits after the second and third', (await texts()).join() === 'ბ,გ,ა,დ' && lifted === 'ა');
ok('nothing is lifted any more', (await page.locator('[data-dragging=true]').count()) === 0);

// ---- drag the last row up to the top ----
const top = (await rows().first().boundingBox()).y;
const s2 = await dragHandle(3, top - 10);
await touch('touchEnd', s2.x, s2.y); await sleep(300);
ok('the last row moved to the top', (await texts()).join() === 'დ,ბ,გ,ა');

// ---- a drag that goes nowhere changes nothing ----
const s3 = await dragHandle(1, (await centre(handle(1))).y + 6, 3);
await touch('touchEnd', s3.x, s3.y); await sleep(250);
ok('a tiny drag leaves the order alone', (await texts()).join() === 'დ,ბ,გ,ა');

// ---- a cancelled drag (the system takes the touch away) changes nothing ----
const s4 = await dragHandle(0, (await centre(handle(0))).y + rowH * 2.5);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await sleep(300);
ok('a cancelled drag changes nothing', (await texts()).join() === 'დ,ბ,გ,ა' && (await page.locator('[data-dragging=true]').count()) === 0);

// ---- the arrow keys on the grip ----
await handle(0).focus();
await page.keyboard.press('ArrowDown'); await sleep(150);
ok('arrow down on the grip moves the row down one place', (await texts()).join() === 'ბ,დ,გ,ა');
ok('and the grip keeps the focus, so it can go on', await handle(1).evaluate((el) => el === document.activeElement));
await page.keyboard.press('ArrowDown'); await sleep(150); await page.keyboard.press('ArrowDown'); await sleep(150);
ok('down to the bottom', (await texts()).join() === 'ბ,გ,ა,დ');
await page.keyboard.press('ArrowDown'); await sleep(150);
ok('past the bottom does nothing', (await texts()).join() === 'ბ,გ,ა,დ');
await page.keyboard.press('ArrowUp'); await sleep(150);
ok('arrow up moves it back up', (await texts()).join() === 'ბ,გ,დ,ა');

// ---- ticks and text travel with the row ----
await page.locator('[data-list] input[type=checkbox]').nth(2).evaluate((el) => el.click());   // tick "დ"
await sleep(200);
await handle(2).focus(); await page.keyboard.press('ArrowUp'); await sleep(150);
const ticks = await page.locator('[data-list] input[type=checkbox]').evaluateAll((els) => els.map((e) => e.checked));
ok('a tick stays with its row when it moves', (await texts()).join() === 'ბ,დ,გ,ა' && ticks.join() === 'false,true,false,false');

// ---- it is saved ----
await sleep(900);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.locator('ul li', { hasText: 'რიგი' }).tap(); await page.waitForSelector('textarea');
ok('after leaving and coming back the new order is still there', (await texts()).join() === 'ბ,დ,გ,ა');

// ---- no grips where nothing can move ----
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
ok('a list with one row has no grip', (await page.locator('[data-list] button[aria-label^="გადაადგილება"]').count()) === 0);
await page.keyboard.type('ცარიელი'); await page.keyboard.press('Enter'); await page.keyboard.type('ა'); await sleep(900);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.locator('ul li', { hasText: 'ცარიელი' }).tap(); await page.waitForSelector('textarea');
await page.tap('button[aria-label="ნაგავში გადატანა"]'); await sleep(500);
await page.tap('nav a:has-text("ნაგავი")'); await page.locator('h1:has-text("ნაგავი")').waitFor();
await page.locator('ul li', { hasText: 'ცარიელი' }).tap(); await page.waitForSelector('textarea');
ok('a note in the trash has no grips', (await page.locator('[data-list] button[aria-label^="გადაადგილება"]').count()) === 0);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
