import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newNote = async (title, body, kind = 'ტექსტი') => { await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: kind, exact: true }).tap(); await page.waitForSelector('textarea:focus'); await page.keyboard.type(title); if (body) { await page.keyboard.press('Enter'); await page.keyboard.type(body); } await sleep(800); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li'); };
const card = (title) => page.locator('ul li', { hasText: title });
const height = async (title) => (await card(title).first().boundingBox()).height;
const toggle = () => page.locator('[role=switch]');
const openMenu = async () => { await page.tap('button[aria-label="დახარისხება და ხედი"]'); await page.waitForSelector('[role=menu]'); };

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await newNote('ერთი სათაური', 'ეს არის პირველი ხაზი ტექსტიდან, რომელიც ახლა ჩანს');
await newNote('საყიდლები', 'პური', 'ჩეკლისტი');
await newNote('ბმულიანი', 'https://maps.app.goo.gl/AbC123');

const hFull = await height('ერთი სათაური');
ok('to begin with the first line is shown', (await card('ერთი სათაური').innerText()).includes('პირველი ხაზი'));
console.log('   card height, full:', Math.round(hFull), 'px');
await page.screenshot({ path: `${OUT}/co-1-full.png` });

// ---- the switch ----
await openMenu();
ok('the menu has a switch "მხოლოდ სათაურები", off at first', (await toggle().getAttribute('aria-checked')) === 'false' && (await toggle().innerText()).includes('მხოლოდ სათაურები'));
await page.screenshot({ path: `${OUT}/co-2-menu-off.png` });
await toggle().tap(); await sleep(250);
ok('the switch turns on and the menu stays open', (await toggle().getAttribute('aria-checked')) === 'true' && (await page.locator('[role=menu]').count()) === 1);
await page.screenshot({ path: `${OUT}/co-3-menu-on.png` });
await page.mouse.click(5, 700); await sleep(250);   // close the menu by tapping outside

const hCompact = await height('ერთი სათაური');
console.log('   card height, titles only:', Math.round(hCompact), 'px');
ok('the first line is gone, the title stays', !(await card('ერთი სათაური').innerText()).includes('პირველი ხაზი') && (await card('ერთი სათაური').innerText()).includes('ერთი სათაური'));
ok('the card is lower (about one line)', hFull - hCompact > 15 && hFull - hCompact < 40);
// nothing is cut off: the footer (date) sits fully inside the card
const fit = await card('ერთი სათაური').first().evaluate((li) => { const c = li.getBoundingClientRect(); const t = li.querySelector('time').getBoundingClientRect(); const ti = li.querySelector('span').getBoundingClientRect(); return { footInside: t.bottom <= c.bottom + 0.5, noOverlap: ti.bottom <= t.top + 1 }; });
ok('the date line is not cut off and does not overlap the title', fit.footInside && fit.noOverlap);
ok('a checklist note keeps its progress badge', (await card('საყიდლები').innerText()).includes('0/1'));
// the single big link button on a note that is only an address still fits
const open = await card('ბმულიანი').first().evaluate((li) => { const c = li.getBoundingClientRect(); const a = li.querySelector('a[href^="http"]').getBoundingClientRect(); return a.bottom <= c.bottom && a.top >= c.top; });
ok('the quick-open button of a link note fits in the lower card', open);
await page.screenshot({ path: `${OUT}/co-4-compact.png` });
const total = await page.locator('ul li').count();
const fits = await page.evaluate(() => [...document.querySelectorAll('ul li')].reduce((s, li) => s + li.getBoundingClientRect().height, 0));
console.log('   notes:', total, ' total list height:', Math.round(fits));

// ---- it is remembered ----
await page.reload(); await page.waitForSelector('ul li');
ok('after a reload it is still titles-only', Math.round(await height('ერთი სათაური')) === Math.round(hCompact));

// ---- grid view ----
await openMenu(); await page.locator('[role=menuitemradio]:has-text("ბადე")').tap(); await sleep(250);
await page.screenshot({ path: `${OUT}/co-5-grid.png` });
const gridFit = await card('ერთი სათაური').first().evaluate((li) => { const c = li.getBoundingClientRect(); const t = li.querySelector('time').getBoundingClientRect(); return t.bottom <= c.bottom + 0.5; });
ok('in the grid view the cards are low and tidy as well', gridFit);

// ---- calendar uses the same cards ----
await openMenu(); await page.locator('[role=menuitemradio]:has-text("სია")').first().tap(); await sleep(200);

// ---- the trash keeps its first line, so deleted notes stay recognisable ----
await card('ერთი სათაური').first().tap(); await page.waitForSelector('textarea');
await page.tap('button[aria-label="ნაგავში გადატანა"]'); await sleep(500);
await page.tap('nav a:has-text("ნაგავი")'); await page.waitForSelector('ul li');
ok('in the trash the first line is still shown', (await page.locator('ul li').first().innerText()).includes('პირველი ხაზი'));
await page.tap('nav a:has-text("ნოტები")');

// ---- and off again ----
await openMenu(); await toggle().tap(); await sleep(250);
await page.mouse.click(5, 700); await sleep(250);
ok('switching it off brings the first line back, with the original height', Math.round(await height('საყიდლები')) === Math.round(hFull) && (await card('ბმულიანი').innerText()).includes('maps'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
