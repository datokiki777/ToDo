import { launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noteCount = () => page.evaluate(() => new Promise((res) => { const q = indexedDB.open('todo-db'); q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').count(); g.onsuccess = () => { q.result.close(); res(g.result); }; }; }));

// ---- the manifest offers the shortcuts Android shows when the app icon is pressed and held ----
await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('nav');
const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
const shortcuts = manifest.shortcuts ?? [];
console.log('   shortcuts:', JSON.stringify(shortcuts.map((s) => [s.short_name, s.url])));
ok('two shortcuts: new note and new checklist', shortcuts.length === 2 && shortcuts[0].url === '/#/new/text' && shortcuts[1].url === '/#/new/checklist');
ok('they sit inside the app scope and have icons', shortcuts.every((s) => s.url.startsWith(manifest.scope) && s.icons?.length > 0));

// ---- opening the "new note" shortcut, as the phone does: a fresh start at that address ----
const fresh = await ctx.newPage();
fresh.on('pageerror', (e) => errors.push(e.message));
await fresh.goto('http://127.0.0.1:4190/#/new/text');
await fresh.waitForSelector('textarea:focus', { timeout: 8000 });
ok('the editor opens straight away, cursor ready', true);
ok('it is a text note (no checklist yet)', (await fresh.locator('[data-list]').count()) === 0 && (await fresh.locator('textarea[data-body]').count()) === 1);
await sleep(500);
ok('exactly one note was made (not one per render)', (await noteCount()) === 1);
ok('the address is the note, not the shortcut (so a reload does not make another)', /#\/note\//.test(fresh.url()));
await fresh.keyboard.type('სწრაფი ნოტა'); await sleep(900);

// ---- "back" goes to the list instead of leaving the app ----
await fresh.tap('button[aria-label="უკან"]');
await fresh.waitForSelector('ul li');
ok('back from the note shows the list of notes', new URL(fresh.url()).hash === '#/' && (await fresh.locator('ul li').allInnerTexts()).join().includes('სწრაფი ნოტა'));

// ---- and the checklist shortcut ----
await fresh.goto('http://127.0.0.1:4190/#/new/checklist');
await fresh.waitForSelector('[data-list]', { timeout: 8000 });
ok('the checklist shortcut opens a checklist with a row ready', (await fresh.locator('[data-list] textarea[data-field]').count()) >= 1);
await fresh.keyboard.type('ჩეკ'); await sleep(900);
await fresh.tap('button[aria-label="უკან"]'); await fresh.waitForSelector('ul li');
ok('and back lands on the list again', new URL(fresh.url()).hash === '#/');

// ---- an empty note made by a shortcut disappears if nothing is written ----
const before = await noteCount();
await fresh.goto('http://127.0.0.1:4190/#/new/text'); await fresh.waitForSelector('textarea:focus');
await sleep(400);
await fresh.tap('button[aria-label="უკან"]'); await fresh.waitForSelector('ul li'); await sleep(500);
ok('a shortcut note left empty is not kept', (await noteCount()) === before);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
