import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${OUT}/cal-${n}.png` });
const dateOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const TODAY = dateOf(today);
const target = new Date(today.getFullYear(), today.getMonth() + 2, 5, 12);
const TARGET = dateOf(target);
const TARGET_HEADER = `${['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'][target.getMonth()]} ${target.getFullYear()}`;

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
const nav = (await page.locator('nav a').allInnerTexts()).map((t) => t.trim());
console.log('   tabs:', JSON.stringify(nav));
ok('tabs are Notes, Calendar, Trash, Settings (no Archive)', nav.join(',') === 'ნოტები,კალენდარი,ნაგავი,პარამეტრები');

// ---- an old archived note must still be visible ----
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('დაარქივებული იყო'); await sleep(700);
await page.tap('button[aria-label="უკან"]');
await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('todo-db'); r.onsuccess = () => { const d = r.result; const tx = d.transaction('notes', 'readwrite'); const st = tx.objectStore('notes'); const g = st.getAll(); g.onsuccess = () => { for (const n of g.result) st.put({ ...n, archived: true, updatedAt: n.updatedAt + 1 }); }; tx.oncomplete = () => { d.close(); res(); }; }; }));
await page.reload(); await page.waitForSelector('ul li');
ok('a note that was archived earlier shows in Notes', (await page.locator('ul li').allInnerTexts()).join().includes('დაარქივებული იყო'));

// ---- give it a date from the editor ----
await page.locator('ul li', { hasText: 'დაარქივებული იყო' }).tap(); await page.waitForSelector('textarea');
const dateChip = page.locator('button[aria-label="ნოტის თარიღი"]');
ok('the editor has a date chip, empty at first: "თარიღი"', (await dateChip.innerText()).trim() === 'თარიღი');
await dateChip.tap();
await page.locator('dialog[open]').locator('button:has-text("დღეს")').tap();
await sleep(300);
const chipText = (await dateChip.innerText()).trim();
console.log('   chip now:', chipText);
ok('the chip now shows the chosen day', chipText !== 'თარიღი' && chipText.length > 4);
await shot('1-editor-chip');
await page.tap('button[aria-label="უკან"]');
const cardText = (await page.locator('ul li', { hasText: 'დაარქივებული იყო' }).innerText()).replace(/\n+/g, ' | ');
console.log('   card:', cardText);
ok('the card carries a small date badge', /\d/.test(cardText.replace(/\d{2}:\d{2}/, '')) );

// ---- the calendar ----
await page.tap('nav a:has-text("კალენდარი")'); await sleep(300);
const MONTHS = ['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'];
const header = (await page.locator('h1').innerText()).trim();
ok(`the calendar opens on this month: "${header}"`, header === `${MONTHS[today.getMonth()]} ${today.getFullYear()}`);
ok('42 day cells in six weeks', (await page.locator('[role=gridcell]').count()) === 42);
const todayCell = page.locator('[role=gridcell][aria-selected=true]');
ok('today is selected and the note is listed under it', (await page.locator('section ul li').allInnerTexts()).join().includes('დაარქივებული იყო'));
ok('today\'s cell has a coloured dot', (await todayCell.locator('i').count()) === 1);
await shot('2-calendar-today');

// ---- another day via the date input, then navigate ----
await page.tap('nav a:has-text("ნოტები")');
await page.locator('ul li', { hasText: 'დაარქივებული იყო' }).tap(); await page.waitForSelector('textarea');
await dateChip.tap();
await page.locator('dialog[open] input[type=date]').fill(TARGET);
await sleep(400);
ok(`picking any day works (${TARGET})`, (await dateChip.innerText()).includes('5') || (await dateChip.innerText()).includes('05'));
await page.tap('button[aria-label="უკან"]');
await page.tap('nav a:has-text("კალენდარი")'); await sleep(300);
ok('the note left today (today has no note any more)', (await page.locator('text=ამ დღეს ნოტები არ არის').count()) === 1);
await page.tap('button[aria-label="შემდეგი თვე"]'); await sleep(150);
await page.tap('button[aria-label="შემდეგი თვე"]'); await sleep(250);
ok(`two months on: ${TARGET_HEADER}`, (await page.locator('h1').innerText()).trim() === TARGET_HEADER);
await page.locator('[role=gridcell]', { hasText: /^5/ }).first().tap(); await sleep(250);
ok('tapping the 5th lists the note', (await page.locator('section ul li').allInnerTexts()).join().includes('დაარქივებული იყო'));
await shot('3-december');

// ---- a new note from the calendar gets that day ----
await page.tap('button[aria-label="ახალი ნოტა ამ დღეს"]');
await page.waitForSelector('textarea:focus'); await page.keyboard.type('კალენდრიდან'); await sleep(700);
const chip2 = (await page.locator('button[aria-label="ნოტის თარიღი"]').innerText()).trim();
ok('the new note already has the day chosen in the calendar', chip2 !== 'თარიღი');
await page.tap('button[aria-label="უკან"]');
await page.locator('section ul li', { hasText: 'კალენდრიდან' }).waitFor({ timeout: 4000 }).then(() => ok('and it appears under that day', true), () => ok('and it appears under that day', false));
await page.locator('[role=gridcell][aria-selected=true] i').count().then((n) => ok('the day now has two dots', n === 2));

// ---- "today" button, and removing a date ----
await page.tap('button[aria-label="დღეს"]'); await sleep(250);
ok('the Today button returns to this month', (await page.locator('h1').innerText()).trim() === `${MONTHS[today.getMonth()]} ${today.getFullYear()}`);
await page.tap('nav a:has-text("ნოტები")');
await page.locator('ul li', { hasText: 'კალენდრიდან' }).tap(); await page.waitForSelector('textarea');
await dateChip.tap(); await page.locator('dialog[open]').locator('button:has-text("თარიღის მოხსნა")').tap(); await sleep(300);
ok('the date can be removed', (await dateChip.innerText()).trim() === 'თარიღი');
await page.tap('button[aria-label="უკან"]');

// ---- survives a reload ----
await page.reload(); await page.waitForSelector('ul li');
await page.tap('nav a:has-text("კალენდარი")'); await sleep(200);
await page.tap('button[aria-label="შემდეგი თვე"]'); await page.tap('button[aria-label="შემდეგი თვე"]'); await sleep(250);
ok('after a reload the dated note is still on the 5th, two months on', (await page.locator('[role=gridcell]', { hasText: /^5/ }).first().locator('i').count()) === 1);

// old links to the removed archive tab do not break
await page.goto('http://127.0.0.1:4190/#/archive'); await page.waitForSelector('nav'); await sleep(300);
ok('an old #/archive link just opens Notes', new URL(page.url()).hash === '#/');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
