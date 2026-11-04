import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => page.locator('[data-list] textarea[data-field]');
const texts = async () => (await rows().evaluateAll((els) => els.map((e) => e.value))).filter((t) => t !== '');
const boxes = () => page.locator('[data-list] input[type=checkbox]');
const ticked = async () => boxes().evaluateAll((els) => els.filter((e) => e.checked).length);
const tick = async (...indexes) => { for (const i of indexes) { await boxes().nth(i).evaluate((el) => el.click()); await sleep(80); } };
const clearBtn = () => page.locator('button:has-text("მონიშნულების წაშლა")');
const untickBtn = () => page.locator('button:has-text("ყველას მოხსნა")');
const undo = async () => { await page.locator('[role=status] button:has-text("დაბრუნება")').last().tap(); await sleep(250); };

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('საყიდლები');
for (const t of ['პური', 'რძე', 'ყველი', 'კვერცხი']) { await page.keyboard.press('Enter'); await page.keyboard.type(t); }
await sleep(300);
ok('four rows, nothing ticked: the tidy-up buttons are hidden', (await texts()).length === 4 && (await clearBtn().count()) === 0 && (await untickBtn().count()) === 0);

// ---- tick two rows: the buttons appear, with the number ----
await tick(0, 2);
ok('two ticked', (await ticked()) === 2);
ok('the buttons appear, counting the ticked rows', (await clearBtn().innerText()).includes('(2)') && (await untickBtn().count()) === 1);
await page.screenshot({ path: `${OUT}/ct-1-buttons.png` });

// ---- delete ticked, then undo ----
await clearBtn().tap(); await sleep(300);
ok('the ticked rows are gone, the others stay in order', (await texts()).join() === 'რძე,კვერცხი');
ok('a message says how many were deleted, with "undo"', (await page.locator('[role=status]').innerText()).includes('წაიშალა 2 პუნქტი'));
ok('the buttons are gone again (nothing is ticked)', (await clearBtn().count()) === 0);
await undo();
ok('undo puts both rows back in their old places', (await texts()).join() === 'პური,რძე,ყველი,კვერცხი');
ok('and they are still ticked', (await ticked()) === 2);

// ---- untick all, then undo ----
await untickBtn().tap(); await sleep(250);
ok('untick all clears every tick', (await ticked()) === 0 && (await texts()).length === 4);
await undo();
ok('undo ticks the same rows again', (await ticked()) === 2 && (await boxes().nth(0).isChecked()) && (await boxes().nth(2).isChecked()));

// ---- typing in between does not get lost by undo ----
await clearBtn().tap(); await sleep(250);
await page.locator('button:has-text("პუნქტის დამატება")').tap(); await sleep(200);
await page.keyboard.type('ახალი');
await undo();
const afterMix = await texts();
ok('undo keeps what was typed meanwhile', afterMix.includes('ახალი') && afterMix.includes('პური') && afterMix.includes('ყველი'));

// ---- everything ticked: deleting them leaves a row to type in, and undo leaves no stray blank row ----
await sleep(900);
await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('ul li');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ჩეკლისტი', exact: true }).tap();
await page.waitForSelector('textarea:focus');
await page.keyboard.type('სულ ორი'); await page.keyboard.press('Enter'); await page.keyboard.type('ა'); await page.keyboard.press('Enter'); await page.keyboard.type('ბ');
await sleep(200);
await tick(0, 1);
await clearBtn().tap(); await sleep(300);
ok('deleting every row leaves one empty row to type in', (await rows().count()) === 1 && (await rows().first().inputValue()) === '');
await undo();
ok('undo brings the two rows back and no extra empty row', (await rows().count()) === 2 && (await texts()).join() === 'ა,ბ');

// ---- it is saved like any other change ----
await sleep(900);
await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li');
await page.locator('ul li', { hasText: 'სულ ორი' }).tap(); await page.waitForSelector('textarea');
ok('after leaving and coming back the list is as it was left', (await texts()).join() === 'ა,ბ' && (await ticked()) === 2);

// ---- the trash is read-only: no tidy-up buttons ----
await page.tap('button[aria-label="ნაგავში გადატანა"]'); await sleep(500);
await page.tap('nav a:has-text("ნაგავი")'); await page.waitForSelector('ul li');
await page.locator('ul li').first().tap(); await page.waitForSelector('textarea');
ok('a note in the trash has no tidy-up buttons', (await clearBtn().count()) === 0 && (await untickBtn().count()) === 0);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
