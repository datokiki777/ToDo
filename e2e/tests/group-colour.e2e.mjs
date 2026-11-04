import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const editorColor = () => page.locator('div[data-color]').first().getAttribute('data-color');
const newNote = async (kind = 'ტექსტი') => { await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: kind, exact: true }).tap(); await page.waitForSelector('textarea:focus'); };
const back = async () => { await sleep(800); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li'); };

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---- a first note so the list is not empty ----
await newNote(); await page.keyboard.type('უჯგუფო'); await back();

// ---- create a group with a default note colour (red) ----
await page.tap('button[aria-label="ახალი ჯგუფი"]');
await page.fill('input[placeholder="მაგ. სამსახური"]', 'სამსახური');
const choice = page.locator('dialog[open] [role=radiogroup][aria-label="ნოტების ფერი ამ ჯგუფში"]');
ok('the sheet offers a note colour, "automatic" chosen at first', (await choice.locator('[role=radio][aria-checked=true]').getAttribute('aria-label')) === 'ავტომატური');
await page.screenshot({ path: `${OUT}/gc-1-sheet.png`, clip: { x: 0, y: 480, width: 360, height: 320 } });
const rowH = await choice.evaluate((el) => el.getBoundingClientRect().height);
ok('all nine choices fit on one line', rowH < 60);
await choice.locator('[aria-label="წითელი"]').tap();
await page.tap('dialog[open] button:has-text("შენახვა")');
await page.waitForSelector('button[aria-pressed="true"]:has-text("სამსახური")');

// ---- a new note in that group is red ----
await newNote();
ok('a new note made while the group is open is RED', (await editorColor()) === 'red');
await page.keyboard.type('წითელი ნოტა'); await sleep(700);
ok('and it belongs to the group', (await page.locator('button[aria-label="ჯგუფის არჩევა"]').innerText()).includes('სამსახური'));
await page.screenshot({ path: `${OUT}/gc-2-red-note.png` });

// ---- by hand it can still be changed, and stays changed ----
await page.tap('button[aria-label="მწვანე"]'); await sleep(400);
ok('changing the colour by hand works', (await editorColor()) === 'green');
await back(); await page.reload(); await page.waitForSelector('ul li');
await page.tap('button[aria-pressed]:has-text("სამსახური")'); await sleep(200);
await page.locator('ul li', { hasText: 'წითელი ნოტა' }).tap(); await page.waitForSelector('textarea');
ok('and it stays green after a reload (the group default does not undo it)', (await editorColor()) === 'green');
await back();

// ---- a colour filter wins, so the new note stays visible ----
await page.tap('button[aria-label="დახარისხება და ხედი"]'); await sleep(150);
await page.locator('[role=menu] button[aria-label="ლურჯი"]').tap(); await page.keyboard.press('Escape');
await page.mouse.click(5, 400); await sleep(200);
await newNote();
ok('with a BLUE filter on, a new note is blue (it must stay visible), not red', (await editorColor()) === 'blue');
await back().catch(() => {});

// ---- joining the group later: only an empty note takes its colour ----
await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('ul li');
await page.tap('button[aria-pressed]:has-text("ყველა")'); await sleep(150);
await newNote();
ok('an ungrouped new note starts yellow', (await editorColor()) === 'yellow');
await page.tap('button[aria-label="ჯგუფის არჩევა"]');
await page.locator('dialog[open]').getByRole('button', { name: /სამსახური/ }).tap(); await sleep(400);
ok('putting a still-empty note into the group makes it red', (await editorColor()) === 'red');
await page.tap('button[aria-label="უკან"]'); await sleep(500);

await newNote();
await page.keyboard.type('უკვე დაწერილი'); await sleep(700);
await page.tap('button[aria-label="ჯგუფის არჩევა"]');
await page.locator('dialog[open]').getByRole('button', { name: /სამსახური/ }).tap(); await sleep(400);
ok('a note that already has text keeps its colour when it joins', (await editorColor()) === 'yellow');
await back();

// ---- edit the group: back to automatic ----
await page.tap('button[aria-pressed]:has-text("სამსახური")'); await sleep(200);
await page.tap('button[aria-label="ჯგუფის რედაქტირება"]');
const choice2 = page.locator('dialog[open] [role=radiogroup][aria-label="ნოტების ფერი ამ ჯგუფში"]');
ok('editing shows the chosen colour (red)', (await choice2.locator('[role=radio][aria-checked=true]').getAttribute('aria-label')) === 'წითელი');
await choice2.locator('[aria-label="ავტომატური"]').tap();
await page.tap('dialog[open] button:has-text("შენახვა")'); await sleep(300);
await newNote();
ok('after switching to "automatic", new notes in the group are yellow again', (await editorColor()) === 'yellow');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
