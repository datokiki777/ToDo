import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `${OUT}/m2-${n}.png` });
const body = () => page.locator('textarea[data-body]');
const rows = () => page.locator('[data-list] textarea[data-field]');
const convertBtn = () => page.locator('button[aria-label="ჩეკლისტად გადაქცევა"], button[aria-label="ტექსტად გადაქცევა"]');

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');

// ---------- a TEXT note gets a checklist ----------
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('შეკვეთა'); await page.keyboard.press('Enter');
await page.keyboard.type('ხვალ მივიტანოთ მასალა ობიექტზე');
ok('a text note offers "add a checklist" (and not "add text")', (await page.getByRole('button', { name: 'ჩეკლისტის დამატება' }).count()) === 1 && (await page.getByRole('button', { name: 'ტექსტის დამატება' }).count()) === 0);
ok('the convert button is there while it holds only text', (await convertBtn().count()) === 1);
await shot('1-text-only');
await page.getByRole('button', { name: 'ჩეკლისტის დამატება' }).tap();
await sleep(200);
ok('a checklist appeared below the text, with the cursor in it', (await rows().count()) === 1 && (await page.evaluate(() => document.activeElement?.closest('[data-list]') !== null)));
await page.keyboard.type('ცემენტი'); await page.keyboard.press('Enter');
await page.keyboard.type('ქვიშა'); await page.keyboard.press('Enter');
await page.keyboard.type('წყალი');
await rows().first().evaluate((el) => el.closest('[data-list]').querySelector('input[type=checkbox]').click());
await sleep(900);
ok('the text is still there', (await body().inputValue()) === 'ხვალ მივიტანოთ მასალა ობიექტზე');
ok('three checklist rows', (await rows().count()) >= 3);
ok('both parts shown: no "add" buttons left', (await page.locator('button:has-text("დამატება")').filter({ hasText: /ჩეკლისტის დამატება|ტექსტის დამატება/ }).count()) === 0);
ok('no convert button for a note with both (it would be ambiguous)', (await convertBtn().count()) === 0);
await shot('2-both');
await page.tap('button[aria-label="უკან"]');

// ---------- the card shows both ----------
const card = page.locator('ul li', { hasText: 'შეკვეთა' });
const cardText = (await card.innerText()).replace(/\n+/g, ' | ');
console.log('   card:', cardText);
ok('card previews the text first and the rows after it', cardText.includes('ხვალ მივიტანოთ') && cardText.includes('ცემენტი'));
ok('card shows checklist progress (1/3)', cardText.includes('1/3'));

// ---------- reload: still both ----------
await page.reload(); await page.waitForSelector('ul li');
await page.locator('ul li', { hasText: 'შეკვეთა' }).tap(); await page.waitForSelector('textarea');
ok('after a reload the note still has its text AND its checklist', (await body().inputValue()).includes('მასალა') && (await rows().count()) >= 3);
await page.tap('button[aria-label="უკან"]');

// ---------- a CHECKLIST note gets text ----------
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('საყიდლები'); await page.keyboard.press('Enter');
await page.keyboard.type('პური'); await page.keyboard.press('Enter'); await page.keyboard.type('რძე');
ok('a checklist note offers "add text" (and not "add a checklist")', (await page.getByRole('button', { name: 'ტექსტის დამატება' }).count()) === 1 && (await page.getByRole('button', { name: 'ჩეკლისტის დამატება' }).count()) === 0);
await page.getByRole('button', { name: 'ტექსტის დამატება' }).tap();
await sleep(200);
ok('a text area appeared ABOVE the list, with the cursor in it', (await body().count()) === 1 && (await page.evaluate(() => document.activeElement?.hasAttribute('data-body'))));
await page.keyboard.type('მაღაზია 24 საათიანია');
await sleep(900);
const order = await page.evaluate(() => { const b = document.querySelector('[data-body]'); const l = document.querySelector('[data-list]'); return b && l ? !!(b.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) : false; });
ok('the text is above the checklist', order);
await shot('3-checklist-plus-text');
await page.tap('button[aria-label="უკან"]');

// ---------- convert still works for single-part notes ----------
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('სია'); await page.keyboard.press('Enter');
await page.keyboard.type('ერთი\nორი\nსამი');
await convertBtn().tap(); await sleep(300);
ok('convert: text lines became checklist rows', (await rows().count()) >= 3 && (await body().count()) === 0);
await convertBtn().tap(); await sleep(300);
ok('convert back: rows became text lines', (await body().inputValue()).includes('ორი') && (await rows().count()) === 0);
await page.tap('button[aria-label="უკან"]');

// ---------- share sends both ----------
await page.locator('ul li', { hasText: 'შეკვეთა' }).tap(); await page.waitForSelector('textarea');
const shared = await page.evaluate(async () => {
  let out = null; navigator.share = async (d) => { out = d; };
  document.querySelector('button[aria-label="გაზიარება"]').click();
  await new Promise((r) => setTimeout(r, 200)); return out;
});
console.log('   shared:', JSON.stringify(shared?.text));
ok('share sends the text and the checklist', shared?.text.includes('ხვალ მივიტანოთ') && shared?.text.includes('☑ ცემენტი'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
