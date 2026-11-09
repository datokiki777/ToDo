import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const box = () => page.locator('[role=group][aria-label*="სულ"]');
const boxText = async () => (await box().innerText()).replace(/\n+/g, ' ');
const width = async () => box().locator('[aria-hidden=true] > div').evaluate((el) => Math.round(el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width * 100));
const tick = async (i) => { await page.locator('[data-list] input[type=checkbox]').nth(i).evaluate((el) => el.click()); await sleep(450); };   // the bar fills over a quarter of a second

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('საყიდლები');
ok('no box while there is nothing in the list', (await box().count()) === 0);
await page.keyboard.press('Enter'); await page.keyboard.type('პური');
ok('one row: the box shows 0 / 1', (await box().count()) === 1 && (await boxText()).includes('0 / 1'));
ok('and there is no move button for a single row', (await page.locator('button[aria-label^="გადაადგილება: სახელურების"]').count()) === 0);
for (const t of ['რძე', 'ყველი', 'კვერცხი']) { await page.keyboard.press('Enter'); await page.keyboard.type(t); }
await sleep(250);
ok('four rows: 0 / 4', (await boxText()).includes('0 / 4'));
ok('the move button appears with two or more rows', (await page.locator('button[aria-label^="გადაადგილება: სახელურების"]').count()) === 1);
await tick(0); await tick(2);
ok('two ticked: 2 / 4 and the bar is half full', (await boxText()).includes('2 / 4') && (await width()) === 50);
await page.screenshot({ path: `${OUT}/cc-1-half.png` });
await tick(1); await tick(3);
ok('all ticked: the box says so', (await boxText()).includes('4 / 4') && (await boxText()).includes('ყველა მონიშნულია') && (await width()) === 100);
await page.screenshot({ path: `${OUT}/cc-2-all.png` });
// a blank row waiting for typing does not count
await page.locator('button:has-text("პუნქტის დამატება")').tap(); await sleep(200);
ok('a new blank row is not counted', (await boxText()).includes('4 / 4'));
await page.keyboard.type('ახალი'); await sleep(250);
ok('once it has words it is counted: 4 / 5', (await boxText()).includes('4 / 5') && !(await boxText()).includes('ყველა'));
// deleting the ticked rows updates it
await page.locator('button:has-text("მონიშნულების წაშლა")').tap(); await sleep(300);
ok('after deleting the ticked rows only the new one is left: 0 / 1', (await boxText()).includes('0 / 1'));

// a daily list shows it too
await sleep(900); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ყოველდღიური სია', exact: true }).tap();
const sheet = page.locator('dialog[open]'); await sheet.waitFor();
await sheet.locator('input').first().fill('წამალი'); await sheet.locator('button[aria-pressed]:has-text("7")').first().tap();
await sheet.locator('button[type=submit]').tap(); await page.waitForSelector('textarea', { timeout: 8000 }); await sleep(500);
ok('a daily list shows the box too (0 / 7)', (await boxText()).includes('0 / 7'));
await tick(0);
ok('and follows a tick (1 / 7)', (await boxText()).includes('1 / 7'));
await sleep(900);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
ok('the card in the list agrees: 1/7', (await page.locator('ul li', { hasText: 'წამალი' }).innerText()).includes('1/7'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
