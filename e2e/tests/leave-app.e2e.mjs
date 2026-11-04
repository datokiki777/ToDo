import { OUT, getJson, launchBrowser } from '../lib.mjs';
await getJson('http://127.0.0.1:4190/__cloud/reset');
const UID = 'uid-me@example.com';
const list = () => getJson(`http://127.0.0.1:4190/__cloud/snap/list?uid=${UID}`);
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 900 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(150); } return false; }
const leave = () => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const comeBack = () => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const waitingCount = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('todo-db'); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('pendingSnapshots')) { d.close(); return res(-1); } const g = d.transaction('pendingSnapshots').objectStore('pendingSnapshots').getAll(); g.onsuccess = () => { d.close(); res(g.result.map((x) => x.id)); }; }; }));

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('nav');
await page.click('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).click();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('დღის ნოტა'); await sleep(700);
await page.click('button[aria-label="უკან"]');
await page.click('nav a:has-text("პარამეტრები")');
const acc = page.locator('section[aria-labelledby="account-heading"]');
await acc.locator('button:has-text("ან ელფოსტით")').click();
await acc.locator('input[name=email]').fill('me@example.com');
await acc.locator('input[name=password]').fill('correct-horse-9');
await acc.getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
await acc.locator('text=სინქრონიზებულია').first().waitFor({ timeout: 8000 });
await sleep(4500);
ok('using the app does NOT create backups by itself during the day', (await list()).length === 0);

// ---- leaving the app with no connection: copy waits on the device ----
await page.route('**/__cloud/snap/write', (route) => route.abort());
await leave();
ok('the copy is kept on the device', await waitFor(async () => (await waitingCount()).length === 1));
await sleep(500);
ok('nothing reached the cloud (no connection)', (await list()).length === 0);
const bk = page.locator('section[aria-labelledby="snapshots-heading"]');
ok('the screen says a backup is waiting', await waitFor(async () => (await bk.innerText()).includes('ელოდება გაგზავნას')));
await page.screenshot({ path: `${OUT}/l2-1-waiting.png` });
ok('and it is not shown as an error', (await bk.locator('[role=alert]').count()) === 0);

// ---- connection back, app opened again: it uploads ----
await page.unroute('**/__cloud/snap/write');
await comeBack();
ok('it uploads when the app is opened again', await waitFor(async () => (await list()).length === 1));
const [only] = await list();
console.log('   uploaded:', JSON.stringify({ id: only.id, date: only.date, notes: only.noteCount }));
ok('and nothing is left waiting', await waitFor(async () => (await waitingCount()).length === 0));

// ---- a second time, nothing changed: no new copy ----
const writesBefore = (await list())[0].takenAt;
await leave(); await sleep(800); await comeBack(); await sleep(500);
ok('leaving again with no changes makes no new copy', (await list())[0].takenAt === writesBefore);

// ---- change something, leave: the day holds the NEW last state ----
await page.click('nav a:has-text("ნოტები")');
await page.locator('ul li', { hasText: 'დღის ნოტა' }).click(); await page.waitForSelector('textarea');
await page.locator('textarea').nth(1).fill('საღამოს ტექსტი'); await sleep(900);
await leave();
ok('the day\'s copy is replaced with the last state of the day', await waitFor(async () => { const l = await list(); return l.length === 1 && l[0].takenAt !== writesBefore; }));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
