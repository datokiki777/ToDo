import { OUT, getJson, launchBrowser } from '../lib.mjs';
await getJson('http://127.0.0.1:4190/__cloud/reset');
const dump = (c) => getJson(`http://127.0.0.1:4190/__cloud/dump?uid=uid-me@example.com&collection=${c}`);
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. the database exactly as version 0.7.x of the app left it (IndexedDB version 40) ----
await page.goto('http://127.0.0.1:4190/manifest.webmanifest');   // a plain file of the same site: the app is not running yet
await page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('todo-db', 40);
  req.onupgradeneeded = () => {
    const d = req.result;
    const notes = d.createObjectStore('notes', { keyPath: 'id' });
    for (const k of ['updatedAt', 'deletedAt', 'color', 'groupId']) notes.createIndex(k, k);
    const groups = d.createObjectStore('groups', { keyPath: 'id' });
    for (const k of ['updatedAt', 'deletedAt']) groups.createIndex(k, k);
    d.createObjectStore('sync', { keyPath: 'key' });
    d.createObjectStore('tombstones', { keyPath: 'key' });
    d.createObjectStore('pendingSnapshots', { keyPath: 'id' });
  };
  req.onsuccess = () => {
    const d = req.result;
    const tx = d.transaction(['notes', 'groups'], 'readwrite');
    const now = Date.now();
    const names = ['ვერქშტატები', 'სამსახური', 'საყიდლები', 'ტელეფონები', 'იდეები'];
    names.forEach((title, i) => tx.objectStore('notes').put({
      id: `legacy-${i}`, kind: i === 2 ? 'checklist' : 'text', title, body: i === 2 ? '' : 'ძველი ტექსტი',
      items: i === 2 ? [{ id: 'r1', text: 'პური', done: false }] : [], color: 'green', groupId: i === 0 ? 'legacy-g' : null,
      pinned: false, archived: false, createdAt: now - 1e6, updatedAt: now - i * 1000, deletedAt: null,   // <- no `date`
    }));
    tx.objectStore('groups').put({ id: 'legacy-g', name: 'მანქანის', icon: 'car', color: 'teal', createdAt: now - 1e6, updatedAt: now, deletedAt: null });  // <- no `noteColor`
    tx.oncomplete = () => { d.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}));

// ---- 2. open the NEW app on that database ----
await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('ul li');
const titles = (await page.locator('ul li').allInnerTexts()).join('|');
ok('all 5 old notes are still there after the database upgrade', ['ვერქშტატები', 'სამსახური', 'საყიდლები', 'ტელეფონები', 'იდეები'].every((t) => titles.includes(t)));
const stored = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('todo-db'); r.onsuccess = () => { const d = r.result; const g = d.transaction(['notes', 'groups']).objectStore('notes').getAll(); g.onsuccess = () => { const g2 = d.transaction('groups').objectStore('groups').getAll(); g2.onsuccess = () => { d.close(); res({ version: d.version, notes: g.result.map((n) => ({ hasDate: 'date' in n, date: n.date, updatedAt: n.updatedAt })), groups: g2.result.map((x) => ({ hasNoteColor: 'noteColor' in x, noteColor: x.noteColor })) }); }; }; }; }));
console.log('   database version:', stored.version, '(dexie v5 = 50)');
ok('every old note now has a date field (empty)', stored.notes.length === 5 && stored.notes.every((n) => n.hasDate && n.date === null));
ok('the old group now has a note-colour field (empty)', stored.groups.length === 1 && stored.groups[0].hasNoteColor && stored.groups[0].noteColor === null);

// the calendar must cope with these notes too
await page.click('nav a:has-text("კალენდარი")'); await sleep(300);
ok('the calendar opens without trouble on the old notes', (await page.locator('[role=gridcell]').count()) === 42);

// ---- 3. sign in and sync: this is what failed on the phone ----
await page.click('nav a:has-text("პარამეტრები")');
const acc = page.locator('section[aria-labelledby="account-heading"]');
await acc.locator('button:has-text("ან ელფოსტით")').click();
await acc.locator('input[name=email]').fill('me@example.com');
await acc.locator('input[name=password]').fill('correct-horse-9');
await acc.getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
await acc.locator('text=სინქრონიზებულია').first().waitFor({ timeout: 10000 });
await sleep(4500);
const panel = (await acc.innerText()).replace(/\n+/g, ' | ');
console.log('   account card:', panel);
ok('no "could not be sent" warning', !panel.includes('ვერ მოხერხდა'));
ok('nothing is waiting to be sent', !panel.includes('ელოდება') && !/გასაგზავნი/.test(panel));
const notes = await dump('notes'), groups = await dump('groups');
ok('all 5 old notes reached the cloud', notes.length === 5);
ok('the old group reached the cloud', groups.length === 1);
console.log('   a cloud note looks like:', JSON.stringify(notes[0]).slice(0, 260));
const field = (d, k) => (d.data ?? d)[k];
ok('in the cloud they carry date = empty / noteColor = empty, not "missing"', notes.every((n) => field(n, 'date') === null) && field(groups[0], 'noteColor') === null);
await page.screenshot({ path: `${OUT}/legacy-1.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
