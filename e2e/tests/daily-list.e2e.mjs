import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const TODAY = key(now);
const rowsInDb = (title) => page.evaluate((t) => new Promise((res) => {
  const q = indexedDB.open('todo-db');
  q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').getAll(); g.onsuccess = () => { q.result.close(); const n = g.result.find((x) => x.title === t && !x.deletedAt); res(n ? n.items : null); }; };
}), title);
const card = (title) => page.locator('ul li', { hasText: title });
const tick = (title) => card(title).locator('button[aria-pressed]');

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---- the form ----
await page.tap('button[aria-label="ახალი ნოტა"]');
await page.getByRole('button', { name: 'ყოველდღიური სია', exact: true }).tap();
const sheet = page.locator('dialog[open]');
await sheet.waitFor();
ok('the daily list is offered in the new-note menu and opens a form', (await sheet.innerText()).includes('რას აკეთებ ყოველდღე'));
ok('"create" waits until there is a name', await sheet.locator('button[type=submit]').isDisabled());
await sheet.locator('button:has-text("წამლის დალევა")').tap();
ok('a suggestion fills the name', (await sheet.locator('input').first().inputValue()) === 'წამლის დალევა');
await sheet.locator('button[aria-pressed]:has-text("14")').first().tap();
const summary1 = (await sheet.locator('[aria-live=polite]').innerText()).replace(/\n+/g, ' ');
console.log('   summary (14 days):', summary1);
ok('the summary says 14 rows', summary1.startsWith('14 ხაზი'));
await sheet.locator('button:has-text("შაბათ-კვირის გამოტოვება")').tap();
const summary2 = (await sheet.locator('[aria-live=polite]').innerText()).replace(/\n+/g, ' ');
console.log('   summary (no weekends):', summary2);
const skippedChips = await sheet.locator('button[aria-pressed=true][class*="skipped"]').count();
ok('skipping weekends marks two days and shortens the list', skippedChips === 2 && /^(9|10|11) ხაზი/.test(summary2));
await page.screenshot({ path: `${OUT}/dl-1-form.png` });
await sheet.locator('button[type=submit]').tap();

// ---- the note that was made ----
await page.waitForSelector('textarea', { timeout: 8000 });
await sleep(600);
const rows = await rowsInDb('წამლის დალევა');
const dates = rows.map((r) => r.date);
console.log('   rows:', rows.length, '| first:', rows[0].text, '| last:', rows.at(-1).text);
ok('the note opened with a row per day', rows.length >= 9 && rows.length <= 11);
ok('every row has its own day, starting today', dates.every(Boolean) && dates[0] === TODAY);
const weekdays = dates.map((d) => new Date(`${d}T12:00:00`).getDay());
ok('no Saturdays or Sundays among them', weekdays.every((w) => w !== 0 && w !== 6));
ok('nothing is ticked yet', rows.every((r) => !r.done));
const todayRow = page.locator('[data-today=true]');
const todayExists = (await todayRow.count()) === (weekdays[0] === 0 || weekdays[0] === 6 ? 0 : 1);
ok('today\'s row is marked in the editor', todayExists);
await page.screenshot({ path: `${OUT}/dl-2-editor.png` });
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');

// ---- one tap in the list ----
const isToday = rows.some((r) => r.date === TODAY);
if (isToday) {
  ok('the card has a round tick for today', (await tick('წამლის დალევა').count()) === 1);
  const text = (await card('წამლის დალევა').innerText()).replace(/\n+/g, ' | ');
  console.log('   card:', text);
  ok('the card says what today is, and the progress', text.includes(rows[0].text) && text.includes('0/'));
  await page.screenshot({ path: `${OUT}/dl-3-card.png` });
  await tick('წამლის დალევა').tap(); await sleep(500);
  ok('one tap ticks today without opening the note', (await page.locator('textarea').count()) === 0 && (await tick('წამლის დალევა').getAttribute('aria-pressed')) === 'true');
  const after = await rowsInDb('წამლის დალევა');
  ok('only today\'s row got ticked', after.filter((r) => r.done).length === 1 && after.find((r) => r.date === TODAY).done === true);
  ok('the progress moved to 1', (await card('წამლის დალევა').innerText()).includes('1/'));
  await page.screenshot({ path: `${OUT}/dl-4-ticked.png` });
  await tick('წამლის დალევა').tap(); await sleep(400);
  ok('a second tap takes it back', (await tick('წამლის დალევა').getAttribute('aria-pressed')) === 'false' && (await rowsInDb('წამლის დალევა')).every((r) => !r.done));
  await tick('წამლის დალევა').tap(); await sleep(400);

  await page.reload(); await page.waitForSelector('ul li');
  ok('after a reload today is still ticked', (await tick('წამლის დალევა').getAttribute('aria-pressed')) === 'true');

  // ---- in the editor the tick is the same row ----
  await card('წამლის დალევა').locator('a').first().tap(); await page.waitForSelector('textarea');
  const editorTick = await page.locator('[data-today=true] input[type=checkbox]').isChecked();
  ok('in the note, today\'s row shows as ticked too', editorTick);
  // and unticking it there shows in the list
  await page.locator('[data-today=true] input[type=checkbox]').evaluate((el) => el.click()); await sleep(900);
  await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
  ok('and the list follows', (await tick('წამლის დალევა').getAttribute('aria-pressed')) === 'false');
} else {
  console.log('   (today is a weekend in this run: the list starts on a weekday, so there is no tick today)');
  ok('today is a skipped day, so the card has no tick', (await tick('წამლის დალევა').count()) === 0);
}

// ---- a list that has not started yet has no tick today ----
await page.tap('button[aria-label="ახალი ნოტა"]');
await page.getByRole('button', { name: 'ყოველდღიური სია', exact: true }).tap();
const sheet2 = page.locator('dialog[open]'); await sheet2.waitFor();
await sheet2.locator('input').first().fill('მეცადინეობა');
const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
await sheet2.locator('input[type=date]').fill(key(nextWeek));
await sheet2.locator('button[aria-pressed]:has-text("7")').first().tap();
await sheet2.locator('button[type=submit]').tap();
await page.waitForSelector('textarea', { timeout: 8000 }); await sleep(600);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
ok('a list that starts next week has no tick today', (await card('მეცადინეობა').count()) === 1 && (await tick('მეცადინეობა').count()) === 0);

// ---- in "titles only" mode the tick stays and fits ----
await page.tap('button[aria-label="დახარისხება და ხედი"]'); await page.waitForSelector('[role=menu]');
await page.locator('[role=switch]').tap(); await sleep(250); await page.mouse.click(5, 600); await sleep(250);
if (isToday) {
  const fit = await card('წამლის დალევა').first().evaluate((li) => { const c = li.getBoundingClientRect(); const b = li.querySelector('button[aria-pressed]').getBoundingClientRect(); return b.top >= c.top && b.bottom <= c.bottom; });
  ok('in titles-only mode the tick is still there and fits', fit);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
