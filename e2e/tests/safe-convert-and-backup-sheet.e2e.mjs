import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
await getJson('http://127.0.0.1:4190/__cloud/reset');
const ctx = await browser.newContext({ viewport: { width: 360, height: 700 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notesDb = () => page.evaluate(() => new Promise((res) => { const q = indexedDB.open('todo-db'); q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').getAll(); g.onsuccess = () => { q.result.close(); res(g.result.filter((n) => !n.deletedAt)); }; }; }));
const byTitle = async (t) => (await notesDb()).filter((n) => n.title.startsWith(t));
const convertBtn = () => page.locator('button[aria-label="ტექსტად გადაქცევა"]');

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---- a daily list, with today ticked ----
await page.tap('button[aria-label="ახალი ნოტა"]');
await page.getByRole('button', { name: 'ყოველდღიური სია', exact: true }).tap();
const sheet = page.locator('dialog[open]'); await sheet.waitFor();
await sheet.locator('input').first().fill('წამალი');
await sheet.locator('button[aria-pressed]:has-text("7")').first().tap();
await sheet.locator('button[type=submit]').tap();
await page.waitForSelector('textarea', { timeout: 8000 }); await sleep(500);
await page.locator('[data-list] input[type=checkbox]').first().evaluate((el) => el.click()); await sleep(900);
const original = (await byTitle('წამალი'))[0];
ok('the daily list has days and one tick', original.items.every((i) => i.date) && original.items.filter((i) => i.done).length === 1);

// ---- 2. converting asks first, because ticks and days would be lost ----
await convertBtn().tap();
const dlg = page.locator('dialog[open]'); await dlg.waitFor();
const warn = (await dlg.innerText()).replace(/\n+/g, ' | ');
console.log('   warning:', warn);
ok('turning it into text asks first and says what is lost', warn.includes('გადავაკეთო ტექსტად') && warn.includes('მონიშვნები: 1') && warn.includes('დღეები: 7'));
await page.screenshot({ path: `${OUT}/sc-1-warning.png` });
await dlg.locator('button:has-text("გაუქმება")').tap(); await sleep(400);
ok('"cancel" changes nothing', (await page.locator('[data-list]').count()) === 1 && JSON.stringify((await byTitle('წამალი'))[0].items) === JSON.stringify(original.items));

// ---- confirm, then "undo" brings everything back exactly ----
await convertBtn().tap(); await dlg.waitFor();
await dlg.locator('button:has-text("გადაკეთება")').tap(); await sleep(1100);
let now = (await byTitle('წამალი'))[0];
ok('after "convert" it is plain text, as before', now.items.length === 0 && now.body.includes('ნოემბერი'));
ok('a message offers "undo"', (await page.locator('[role=status]').innerText()).includes('გადაკეთდა'));
await page.screenshot({ path: `${OUT}/sc-2-converted.png` });
await page.locator('[role=status] button:has-text("დაბრუნება")').last().tap(); await sleep(1100);
now = (await byTitle('წამალი'))[0];
ok('"undo" puts back every row, every day and the tick', JSON.stringify(now.items) === JSON.stringify(original.items) && now.body === '');

// ---- a plain checklist with nothing ticked converts without asking, with undo ----
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('მარტივი'); await page.keyboard.press('Enter'); await page.keyboard.type('ა'); await page.keyboard.press('Enter'); await page.keyboard.type('ბ'); await sleep(700);
await convertBtn().tap(); await sleep(500);
ok('an unticked plain list converts without a question', (await page.locator('dialog[open]').count()) === 0 && (await page.locator('textarea[data-body]').count()) === 1);
await page.locator('[role=status] button:has-text("დაბრუნება")').last().tap(); await sleep(500);
ok('and can be undone too', (await page.locator('[data-list]').count()) === 1 && (await page.locator('textarea[data-body]').count()) === 0);
await sleep(900); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');

// ---- recovery: the daily list is lost, a backup still has it ----
await page.tap('nav a:has-text("პარამეტრები")');
const acc = page.locator('section[aria-labelledby="account-heading"]');
await acc.locator('button:has-text("ან ელფოსტით")').click();
await acc.locator('input[name=email]').fill('me@example.com'); await acc.locator('input[name=password]').fill('correct-horse-9');
await acc.getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
await acc.locator('text=სინქრონიზებულია').first().waitFor({ timeout: 10000 });
const bk = page.locator('section[aria-labelledby="snapshots-heading"]');
await bk.locator('button:has-text("ასლის გაკეთება ახლა")').click(); await sleep(900);
// now the accident: convert and CONFIRM, and leave
await page.tap('nav a:has-text("ნოტები")'); await page.waitForSelector('ul li');
await page.locator('ul li', { hasText: 'წამალი' }).locator('a').first().tap(); await page.waitForSelector('textarea');
await convertBtn().tap(); await page.locator('dialog[open] button:has-text("გადაკეთება")').tap(); await sleep(1200);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
ok('after the accident the note is plain text with no days', (await byTitle('წამალი'))[0].items.length === 0);

await page.tap('nav a:has-text("პარამეტრები")');
await bk.locator('button:has-text("ასლების ჩვენება")').click(); await bk.locator('ul li').first().waitFor();
await bk.locator('ul li').first().tap();
const bs = page.locator('dialog[open]'); await bs.waitFor();
await bs.locator('button:has-text("ნოტები ამ ასლში")').waitFor();   // the sheet has loaded
ok('the backup\'s sheet has its own "close" button at the bottom', (await bs.locator('button:has-text("დახურვა")').count()) >= 1);
await bs.locator('button:has-text("ნოტები ამ ასლში")').tap();
const rowsInBackup = await bs.locator('li').allInnerTexts();
console.log('   notes in the backup:', JSON.stringify(rowsInBackup.map((t) => t.replace(/\n+/g, ' '))));
ok('the notes of the backup are listed, with the list\'s progress', rowsInBackup.some((t) => t.includes('წამალი') && t.includes('1/7')));
await page.screenshot({ path: `${OUT}/sc-3-backup.png` });
await bs.locator('li', { hasText: 'წამალი' }).locator('button:has-text("ასლად აღდგენა")').tap(); await sleep(1000);
const afterRestore = await byTitle('წამალი');
console.log('   notes called წამალი now:', afterRestore.map((n) => `${n.title} [rows ${n.items.length}, ticked ${n.items.filter((i) => i.done).length}]`).join(' ; '));
const copy = afterRestore.find((n) => n.title.includes('ასლიდან'));
ok('a copy appeared with every day and the tick', copy && JSON.stringify(copy.items.map((i) => [i.text, i.done, i.date])) === JSON.stringify(original.items.map((i) => [i.text, i.done, i.date])));
ok('the note as it is now (text) was not touched', afterRestore.some((n) => n.title === 'წამალი' && n.items.length === 0));
ok('a message offers to open the copy', (await page.locator('[role=status]').innerText()).includes('აღდგა ასლად'));
await page.locator('[role=status] button:has-text("გახსნა")').tap(); await page.waitForSelector('textarea', { timeout: 6000 });
ok('"open" shows the copy, with its daily rows', (await page.locator('[data-list]').count()) === 1 && /#\/note\//.test(page.url()));

// ---- the sheet header stays reachable with very large text ----
await page.tap('button[aria-label="უკან"]'); await sleep(400);
if ((await page.locator('section[aria-labelledby="snapshots-heading"]').count()) === 0) await page.tap('nav a:has-text("პარამეტრები")');   // "back" may already land on Settings
await page.addStyleTag({ content: 'html { font-size: 26px !important; }' });
await bk.locator('button:has-text("ასლების ჩვენება")').click(); await bk.locator('ul li').first().waitFor();
await bk.locator('ul li').first().tap();
const big = page.locator('dialog[open]'); await big.waitFor(); await sleep(300);
await big.evaluate((d) => { d.scrollTop = d.scrollHeight; }); await sleep(250);
const closeVisible = await big.evaluate((d) => { const b = [...d.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'დახურვა'); const r = b.getBoundingClientRect(); const dr = d.getBoundingClientRect(); return r.top >= dr.top - 1 && r.bottom <= dr.bottom + 1; });
ok('with very large text, scrolled to the bottom, the ✕ is still in view', closeVisible);
await page.screenshot({ path: `${OUT}/sc-4-big-text.png` });
await big.locator('button:has-text("დახურვა")').last().tap(); await sleep(300);
ok('and the bottom "close" button closes it', (await page.locator('dialog[open]').count()) === 0);
await bk.locator('button:has-text("სიის დამალვა")').tap(); await sleep(200);
ok('the list of backups can be hidden again', (await bk.locator('ul li').count()) === 0);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
