import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

// ---- 1. a phone that already has the OLD saved setting: sort "date", settings version 0 ----
await page.goto('http://127.0.0.1:4190/manifest.webmanifest');
await page.evaluate(() => localStorage.setItem('todo.settings', JSON.stringify({ state: { language: 'ka', theme: 'system', viewMode: 'list', sortBy: 'date', compactCards: false }, version: 0 })));
// three notes with different creation and change times (indexeddb seeded like a used app)
await page.evaluate((DAY) => new Promise((resolve, reject) => {
  const req = indexedDB.open('todo-db', 50);
  req.onupgradeneeded = () => { const d = req.result;
    const notes = d.createObjectStore('notes', { keyPath: 'id' }); for (const k of ['updatedAt', 'deletedAt', 'color', 'groupId']) notes.createIndex(k, k);
    const groups = d.createObjectStore('groups', { keyPath: 'id' }); for (const k of ['updatedAt', 'deletedAt']) groups.createIndex(k, k);
    d.createObjectStore('sync', { keyPath: 'key' }); d.createObjectStore('tombstones', { keyPath: 'key' }); d.createObjectStore('pendingSnapshots', { keyPath: 'id' }); };
  req.onsuccess = () => { const d = req.result; const tx = d.transaction('notes', 'readwrite'); const now = Date.now();
    const mk = (id, title, color, createdAgo, changedAgo) => ({ id, kind: 'text', title, body: 'ტექსტი', items: [], color, groupId: null, date: null, pinned: false, archived: false, createdAt: now - createdAgo, updatedAt: now - changedAgo, deletedAt: null });
    // OLD: made 9 days ago, changed an hour ago.  MIDDLE: made 6 days ago, changed 6 days ago.  NEW: made 2 days ago, changed 2 days ago.
    tx.objectStore('notes').put(mk('old', 'ძველად შექმნილი', 'red', 9 * DAY, 3600000));
    tx.objectStore('notes').put(mk('mid', 'შუა', 'yellow', 6 * DAY, 6 * DAY));
    tx.objectStore('notes').put(mk('new', 'ახლად შექმნილი', 'red', 2 * DAY, 2 * DAY));
    tx.oncomplete = () => { d.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
}), DAY);

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('ul li');
const order = async () => (await page.locator('ul li').allInnerTexts()).map((t) => t.split('\n')[0]);
const openMenu = async () => { await page.tap('button[aria-label="დახარისხება და ხედი"]'); await page.waitForSelector('[role=menu]'); };
const radio = (name) => page.locator(`[role=menuitemradio]:has-text("${name}")`);

await openMenu();
const labels = await page.locator('[role=menuitemradio]').allInnerTexts();
console.log('   sort options + view options:', JSON.stringify(labels.map((l) => l.trim())));
ok('three sort options: last changed, date created, colour', ['ბოლო შეცვლით', 'შექმნის თარიღით', 'ფერით'].every((l) => labels.some((x) => x.trim() === l)));
ok('the OLD saved choice ("date") became "last changed", still selected', (await radio('ბოლო შეცვლით').getAttribute('aria-checked')) === 'true');
await page.screenshot({ path: `${OUT}/so-1-menu.png`, clip: { x: 0, y: 0, width: 360, height: 500 } });
await page.mouse.click(5, 600); await sleep(250);
const modified = await order();
console.log('   last changed order:', JSON.stringify(modified));
ok('LAST CHANGED: the note edited an hour ago is first, although it was made long ago', modified.join() === 'ძველად შექმნილი,ახლად შექმნილი,შუა');
const dateOld = (await page.locator('ul li', { hasText: 'ძველად შექმნილი' }).locator('time').innerText()).trim();
console.log('   its card shows (last changed):', dateOld);

// ---- 2. date created ----
await openMenu(); await radio('შექმნის თარიღით').tap(); await sleep(300);
const created = await order();
console.log('   date created order:', JSON.stringify(created));
ok('DATE CREATED: newest note first, whatever was edited since', created.join() === 'ახლად შექმნილი,შუა,ძველად შექმნილი');
const dateOldCreated = (await page.locator('ul li', { hasText: 'ძველად შექმნილი' }).locator('time').innerText()).trim();
console.log('   its card shows (date created):', dateOldCreated);
ok('the card now shows the creation date instead (so the order does not look random)', dateOldCreated !== dateOld);
await page.screenshot({ path: `${OUT}/so-2-created.png`, clip: { x: 0, y: 0, width: 360, height: 520 } });

// ---- 3. it is remembered ----
await page.reload(); await page.waitForSelector('ul li');
ok('after a reload the choice (date created) is kept', (await order()).join() === 'ახლად შექმნილი,შუა,ძველად შექმნილი');

// ---- 4. editing an old note: moves up by last changed, but not by date created ----
await page.locator('ul li', { hasText: 'შუა' }).tap(); await page.waitForSelector('textarea');
await page.locator('textarea').nth(1).fill('შევცვალე ახლა'); await sleep(900); await page.tap('button[aria-label="უკან"]'); await sleep(300);
ok('by date created the edited note does NOT jump up', (await order()).join() === 'ახლად შექმნილი,შუა,ძველად შექმნილი');
await openMenu(); await radio('ბოლო შეცვლით').tap(); await sleep(300);
ok('by last changed the edited note is now first', (await order())[0] === 'შუა');

// ---- 5. colour still works ----
await openMenu(); await radio('ფერით').tap(); await sleep(300);
ok('by colour: yellow first, then the red ones', (await order())[0] === 'შუა');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
