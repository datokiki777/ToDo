import { OUT, getJson, launchBrowser } from '../lib.mjs';
await getJson('http://127.0.0.1:4190/__cloud/reset');
const UID = 'uid-me@example.com';
const browser = await launchBrowser();
const errors = [];
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 10000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(150); } return false; }
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('nav');
  return { ctx, page, name };
}
const account = (d) => d.page.locator('section[aria-labelledby="account-heading"]');
const backups = (d) => d.page.locator('section[aria-labelledby="snapshots-heading"]');
async function signIn(d) {
  await d.page.click('nav a:has-text("პარამეტრები")');
  await account(d).locator('button:has-text("ან ელფოსტით")').click();
  await account(d).locator('input[name=email]').fill('me@example.com');
  await account(d).locator('input[name=password]').fill('correct-horse-9');
  await account(d).getByRole('button', { name: 'ანგარიშის შექმნა', exact: true }).click();
  await account(d).locator('text=შესული ხარ').waitFor();
  await account(d).locator('text=სინქრონიზებულია').first().waitFor({ timeout: 8000 });
}
async function newNote(d, title, body = '') {
  await d.page.click('nav a:has-text("ნოტები")').catch(() => {}); await d.page.waitForSelector('button[aria-label="ახალი ნოტა"]');
  await d.page.click('button[aria-label="ახალი ნოტა"]'); await d.page.getByRole('button', { name: 'ტექსტი', exact: true }).click();
  await d.page.waitForSelector('textarea:focus'); await d.page.keyboard.type(title);
  if (body) { await d.page.keyboard.press('Enter'); await d.page.keyboard.type(body); }
  await sleep(700); await d.page.click('button[aria-label="უკან"]'); await d.page.waitForSelector('ul li');
}
const openSettings = async (d) => { if (!(await d.page.locator('section[aria-labelledby="snapshots-heading"]').count())) await d.page.click('nav a:has-text("პარამეტრები")'); };
const titles = async (d) => { await d.page.click('nav a:has-text("ნოტები")').catch(() => {}); await sleep(150); return (await d.page.locator('ul li').allInnerTexts()).map((t) => t.replace(/\n+/g, ' | ')); };

const A = await device('A');
await newNote(A, 'ერთი', 'ძველი ტექსტი');
await newNote(A, 'ორი', 'მნიშვნელოვანი');
await signIn(A);

// ---- the first backup of the day appears by itself ----
await backups(A).locator('button:has-text("ასლის გაკეთება ახლა")').click();
const auto = await waitFor(async () => (await getJson(`http://127.0.0.1:4190/__cloud/snap/list?uid=${UID}`)).length === 1, 12000);
ok('a backup for today was made ("back up now")', auto);
await backups(A).locator('button:has-text("ასლების ჩვენება")').click();
await backups(A).locator('ul li').first().waitFor();
console.log('   list:', JSON.stringify((await backups(A).locator('ul li').allInnerTexts()).map((t) => t.replace(/\n+/g, ' | '))));
ok('the list shows today with its counts', (await backups(A).locator('ul li').first().innerText()).includes('2 ნოტა'));
await A.page.screenshot({ path: `${OUT}/b-1-list.png` });

// ---- change things after the backup ----
await A.page.click('nav a:has-text("ნოტები")');
await A.page.locator('ul li', { hasText: 'ერთი' }).click(); await A.page.waitForSelector('textarea');
await A.page.locator('textarea').nth(1).fill('ახალი ტექსტი');
await sleep(800); await A.page.click('button[aria-label="უკან"]');
await A.page.locator('ul li', { hasText: 'ორი' }).click(); await A.page.waitForSelector('textarea');
await A.page.click('button[aria-label="ნაგავში გადატანა"]'); await sleep(500);
await A.page.click('nav a:has-text("ნაგავი")'); await A.page.locator('ul li').first().click();
await A.page.click('button:has-text("სამუდამოდ წაშლა")'); await A.page.locator('dialog[open] button:has-text("სამუდამოდ წაშლა")').click(); await sleep(600);
await newNote(A, 'მესამე', 'შეიქმნა მერე');
console.log('   before restore:', JSON.stringify(await titles(A)));

// ---- a second device that follows ----
const B = await device('B');
await signIn(B);
ok('B sees the changed state', await waitFor(async () => (await titles(B)).join().includes('მესამე')));

// ---- restore the whole app to today's backup ----
await openSettings(A);
await backups(A).locator('button:has-text("ასლების ჩვენება"), button:has-text("სიის განახლება")').first().click();
await backups(A).locator('ul li').first().click();
await A.page.locator('dialog[open]').locator('text=დაბრუნდება').waitFor();
const detail = (await A.page.locator('dialog[open]').innerText()).replace(/\n+/g, ' | ');
console.log('   preview:', detail.slice(0, 260));
ok('the preview says what will happen', detail.includes('დაბრუნდება: 1') && detail.includes('შეიცვლება: 1') && detail.includes('ნაგავში გადავა: 1'));
await A.page.screenshot({ path: `${OUT}/b-2-detail.png` });
await A.page.locator('dialog[open] button:has-text("აპის აღდგენა")').click();
await A.page.locator('dialog[open] button:has-text("აღდგენა")').last().click();
await A.page.locator('text=აპი აღდგა').waitFor({ timeout: 8000 });
ok('restore finished with a message', true);

const afterA = await titles(A);
console.log('   after restore, A:', JSON.stringify(afterA));
ok('A: the note I deleted for good is back', afterA.some((t) => t.startsWith('ორი')));
ok('A: the edited note has its old text again', afterA.some((t) => t.includes('ძველი ტექსტი')));
ok('A: the note made later is no longer in the list', !afterA.some((t) => t.startsWith('მესამე')));
await A.page.click('nav a:has-text("ნაგავი")'); await sleep(200);
ok('A: that later note is in the trash (not destroyed)', (await A.page.locator('body').innerText()).includes('მესამე'));
ok('B: follows the restore (old text, deleted note back)', await waitFor(async () => { const t = await titles(B); return t.some((x) => x.startsWith('ორი')) && t.some((x) => x.includes('ძველი ტექსტი')) && !t.some((x) => x.startsWith('მესამე')); }));

// ---- undo the restore from the safety copy ----
await openSettings(A);
await backups(A).locator('button:has-text("ასლების ჩვენება"), button:has-text("სიის განახლება")').first().click();
await backups(A).locator('ul li').first().waitFor();
const rows = await backups(A).locator('ul li').allInnerTexts();
console.log('   list after restore:', JSON.stringify(rows.map((t) => t.replace(/\n+/g, ' | '))));
ok('a "before restore" copy is listed', rows.some((t) => t.includes('აღდგენამდე')));
await backups(A).locator('ul li', { hasText: 'აღდგენამდე' }).first().click();
await A.page.locator('dialog[open]').locator('text=დაბრუნდება').waitFor();
await A.page.locator('dialog[open] button:has-text("აპის აღდგენა")').click();
await A.page.locator('dialog[open] button:has-text("აღდგენა")').last().click();
await A.page.locator('text=აპი აღდგა').first().waitFor({ timeout: 8000 });
const undone = await titles(A);
console.log('   after undo, A:', JSON.stringify(undone));
ok('the restore was undone: later note and new text are back', undone.some((t) => t.startsWith('მესამე')) && undone.some((t) => t.includes('ახალი ტექსტი')));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
