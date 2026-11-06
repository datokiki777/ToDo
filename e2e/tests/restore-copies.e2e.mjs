import { OUT, getJson, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
await getJson('http://127.0.0.1:4190/__cloud/reset');
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = 'uid-me@example.com';
const snaps = () => getJson(`http://127.0.0.1:4190/__cloud/snap/list?uid=${UID}`);
const bk = page.locator('section[aria-labelledby="snapshots-heading"]');
const setBody = async (text) => { await page.tap('nav a:has-text("ნოტები")'); await page.waitForSelector('ul li'); await page.locator('ul li', { hasText: 'ნოტა' }).first().tap(); await page.waitForSelector('textarea'); await page.locator('textarea').nth(1).fill(text); await sleep(900); await page.tap('button[aria-label="უკან"]'); await page.waitForSelector('ul li'); };
const toSettings = async () => { if ((await bk.count()) === 0) await page.tap('nav a:has-text("პარამეტრები")'); };   // a second tap would close Settings again
const restoreFirst = async () => {
  await toSettings();
  await bk.locator('button:has-text("ასლების ჩვენება"), button:has-text("სიის განახლება")').first().click();
  await bk.locator('ul li').first().waitFor();
  await bk.locator('ul li').first().tap();
  const d = page.locator('dialog[open]'); await d.waitFor();
  await d.locator('button:has-text("აპის აღდგენა")').tap();
  await d.locator('button:has-text("აღდგენა")').last().tap();   // confirm
  await page.locator('text=აპი აღდგა').first().waitFor({ timeout: 8000 });
  await sleep(500);
};

await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('text=ნოტები ჯერ არ არის');
await page.tap('button[aria-label="ახალი ნოტა"]'); await page.getByRole('button', { name: 'ტექსტი', exact: true }).tap();
await page.waitForSelector('textarea:focus'); await page.keyboard.type('ნოტა'); await page.keyboard.press('Enter'); await page.keyboard.type('ორიგინალი'); await sleep(900);
await page.tap('button[aria-label="უკან"]');
await page.tap('nav a:has-text("პარამეტრები")');
const acc = page.locator('section[aria-labelledby="account-heading"]');
await acc.locator('button:has-text("ან ელფოსტით")').click();
await acc.locator('input[name=email]').fill('me@example.com'); await acc.locator('input[name=password]').fill('correct-horse-9');
await acc.getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
await acc.locator('text=სინქრონიზებულია').first().waitFor({ timeout: 10000 });
await bk.locator('button:has-text("ასლის გაკეთება ახლა")').click(); await sleep(900);
const days0 = (await snaps()).filter((m) => m.kind === 'day').map((m) => m.id).sort();

// a change, then restore the same day's copy FOUR times in a row (what the screenshot showed)
await setBody('შეცვლილი ტექსტი');
for (let i = 0; i < 4; i += 1) await restoreFirst();
const after = await snaps();
const safety = after.filter((m) => m.kind === 'before-restore');
console.log('   copies after 4 restores:', JSON.stringify(after.map((m) => m.kind)));
ok('four restores of the same copy made ONE safety copy (not four)', safety.length === 1);
ok('the daily copies are exactly the same as before', JSON.stringify(after.filter((m) => m.kind === 'day').map((m) => m.id).sort()) === JSON.stringify(days0));

await toSettings();
await bk.locator('button:has-text("სიის განახლება"), button:has-text("ასლების ჩვენება")').first().click();
await bk.locator('ul li').first().waitFor();
const listText = (await bk.locator('ul li').allInnerTexts()).join(' | ').replace(/\n+/g, ' ');
console.log('   main list:', listText);
ok('the main list shows only the day, no "before restore" rows', !listText.includes('აღდგენამდე') && (await bk.locator('ul li').count()) === 1);
ok('the safety copy sits in its own folded group', (await bk.locator('button:has-text("აღდგენამდე ასლები (1)")').count()) === 1);
await sleep(9000);   // let the four "restored" messages go
await bk.locator('button:has-text("აღდგენამდე ასლები")').click(); await sleep(300);
await page.screenshot({ path: `${OUT}/rc-1-list.png`, clip: { x: 0, y: 280, width: 360, height: 500 } });

// a real change in between IS saved, so nothing is ever lost
await setBody('ახალი, ძვირფასი ტექსტი');
await restoreFirst();
ok('a change made after a restore is saved before the next restore (a second safety copy)', (await snaps()).filter((m) => m.kind === 'before-restore').length === 2);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
