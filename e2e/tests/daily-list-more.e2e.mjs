import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbRows = (title) => page.evaluate((t) => new Promise((res) => {
  const q = indexedDB.open('todo-db');
  q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').getAll(); g.onsuccess = () => { q.result.close(); const n = g.result.find((x) => x.title === t && !x.deletedAt); res(n ? n.items : null); }; };
}), title);
const card = (title) => page.locator('ul li', { hasText: title });

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---- 3. the new-note menu: daily list is the last one, at the bottom ----
await page.tap('button[aria-label="ახალი ნოტა"]');
await page.waitForSelector('button.pill, [class*="pill"]');
const pills = (await page.locator('[class*="pill"]').allInnerTexts()).map((t) => t.trim());
const ys = await page.locator('[class*="pill"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
console.log('   menu top→bottom:', JSON.stringify(pills));
ok('the menu order is checklist, text, daily list', pills.join('|') === 'ჩეკლისტი|ტექსტი|ყოველდღიური სია');
ok('and the daily list is the lowest one', ys[2] > ys[1] && ys[1] > ys[0]);
await page.screenshot({ path: `${OUT}/dm-1-menu.png`, clip: { x: 0, y: 380, width: 360, height: 420 } });
await page.getByRole('button', { name: 'ყოველდღიური სია', exact: true }).tap();
const sheet = page.locator('dialog[open]'); await sheet.waitFor();
await sheet.locator('input').first().fill('წამალი');
await sheet.locator('button[aria-pressed]:has-text("14")').first().tap();
await sheet.locator('button:has-text("შაბათ-კვირის გამოტოვება")').tap();
await sheet.locator('button[type=submit]').tap();
await page.waitForSelector('textarea', { timeout: 8000 }); await sleep(600);
const before = await dbRows('წამალი');

// ---- 4. +30 days ----
const more = page.locator('button:has-text("კიდევ 30 დღის დამატება")');
ok('a daily list shows "add 30 more days"', (await more.count()) === 1);
const lastBefore = before.at(-1).date;
await more.scrollIntoViewIfNeeded(); await more.tap(); await sleep(600);
const after = await dbRows('წამალი');
const added = after.slice(before.length);
console.log('   rows before:', before.length, '| after:', after.length, '| new range:', added[0]?.date, '→', added.at(-1)?.date);
ok('rows were added after the last day', after.length > before.length && added[0].date > lastBefore);
const wd = (d) => new Date(`${d}T12:00:00`).getDay();
ok('the weekend is still left out', added.every((r) => wd(r.date) !== 0 && wd(r.date) !== 6));
ok('it covers about 30 days (21-22 weekdays)', added.length >= 20 && added.length <= 23);
ok('the days follow on without a gap or a repeat', after.every((r, i) => i === 0 || r.date > after[i - 1].date));
ok('what was there before is untouched', JSON.stringify(after.slice(0, before.length)) === JSON.stringify(before));
ok('a message says how many rows were added, with "undo"', (await page.locator('[role=status]').innerText()).includes('დაემატა') );
await page.screenshot({ path: `${OUT}/dm-2-extended.png` });
await page.locator('[role=status] button:has-text("დაბრუნება")').last().tap(); await sleep(500);
ok('undo takes the added rows away again', (await dbRows('წამალი')).length === before.length);
await more.tap(); await sleep(500); await more.tap(); await sleep(500);
const twice = await dbRows('წამალი');
ok('pressing it again continues after the new end (60 days in all)', twice.length > before.length + 35 && new Set(twice.map((r) => r.date)).size === twice.length);

// ---- a plain checklist has no such button ----
await sleep(900); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('ჩვეულებრივი'); await page.keyboard.press('Enter'); await page.keyboard.type('ა'); await sleep(500);
ok('an ordinary checklist has no "add 30 days"', (await page.locator('button:has-text("კიდევ 30 დღის დამატება")').count()) === 0);
await sleep(700); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');

// ---- 1. the date sheet explains what it does ----
await card('წამალი').locator('a').first().tap(); await page.waitForSelector('textarea');
await page.tap('button[aria-label="ნოტის თარიღი"]');
const ds = page.locator('dialog[open]'); await ds.waitFor();
const dtext = (await ds.innerText()).replace(/\n+/g, ' | ');
console.log('   date sheet:', dtext.slice(0, 260));
ok('the date sheet says what the date does (the calendar)', dtext.includes('კალენდარში') && dtext.includes('არაფერს ახსენებს'));
ok('for a daily list it says the date is not needed', dtext.includes('ყოველდღიური სიაა'));
ok('the empty field shows a hint instead of a blank box', dtext.includes('შეეხე და აირჩიე დღე'));
await page.screenshot({ path: `${OUT}/dm-3-datesheet.png`, clip: { x: 0, y: 380, width: 360, height: 420 } });
await ds.locator('button:has-text("დღეს")').tap(); await sleep(300);
await page.tap('button[aria-label="ნოტის თარიღი"]');
const ds2 = page.locator('dialog[open]'); await ds2.waitFor();
ok('once a day is chosen the hint is gone', !(await ds2.innerText()).includes('შეეხე და აირჩიე დღე'));
await ds2.locator('button:has-text("თარიღის მოხსნა")').tap(); await sleep(300);
await sleep(500); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');

// ---- 2. smaller round buttons on the cards ----
const dims = async (sel) => card('წამალი').locator(sel).first().evaluate((el) => {
  const b = el.getBoundingClientRect(); const cs = getComputedStyle(el, '::before');
  return { box: Math.round(b.width), circle: Math.round(parseFloat(cs.width)) };
});
const tickBtn = await dims('button[aria-pressed]');
console.log('   tick button: tap area', tickBtn.box, 'px, drawn circle', tickBtn.circle, 'px');
ok('the tick on the card is a smaller circle (28 px, was 44)', tickBtn.circle >= 26 && tickBtn.circle <= 30);
ok('while the area you can tap stays big enough (40 px)', tickBtn.box >= 40);
// a note that is only a link
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('https://example.com/page'); await sleep(900);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
const linkCard = page.locator('ul li', { hasText: 'example.com' });
const linkBtn = await linkCard.locator('a[href^="https://example.com"]').first().evaluate((el) => { const b = el.getBoundingClientRect(); return { box: Math.round(b.width), circle: Math.round(parseFloat(getComputedStyle(el, '::before').width)) }; });
console.log('   link button: tap area', linkBtn.box, 'px, drawn circle', linkBtn.circle, 'px');
ok('the link-open button is smaller too', linkBtn.circle >= 26 && linkBtn.circle <= 30 && linkBtn.box >= 40);
await page.screenshot({ path: `${OUT}/dm-4-cards.png`, clip: { x: 0, y: 0, width: 360, height: 360 } });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
