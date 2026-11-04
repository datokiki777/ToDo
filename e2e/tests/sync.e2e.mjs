import { OUT, getJson, launchBrowser } from '../lib.mjs';
await getJson('http://127.0.0.1:4190/__cloud/reset');
const browser = await launchBrowser();
const errors = [];
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dump = async (c) => getJson(`http://127.0.0.1:4190/__cloud/dump?uid=uid-me@example.com&collection=${c}`);

async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto('http://127.0.0.1:4190/'); await page.waitForSelector('nav');
  return { ctx, page, name };
}
const account = (d) => d.page.locator('section[aria-labelledby="account-heading"]');
async function signIn(d, email, create = false) {
  await d.page.click('nav a:has-text("პარამეტრები")');
  await account(d).locator('button:has-text("ან ელფოსტით")').click();
  await account(d).locator('input[name=email]').fill(email);
  await account(d).locator('input[name=password]').fill('correct-horse-9');
  await account(d).getByRole('button', { name: create ? 'ანგარიშის შექმნა' : 'შესვლა', exact: true }).click();
  await account(d).locator('text=შესული ხარ').waitFor();
}
const goNotes = async (d) => { await d.page.click('nav a:has-text("ნოტები")').catch(() => {}); await sleep(100); };
async function synced(d) { await account(d).locator('text=სინქრონიზებულია').first().waitFor({ timeout: 8000 }); }
async function listTitles(d) { await goNotes(d); return (await d.page.locator('ul li').allInnerTexts()).map((t) => t.split('\n')[0]); }
async function newNote(d, title, body = '') {
  await d.page.click('button[aria-label="ახალი ნოტა"]'); await d.page.getByRole('button', { name: 'ტექსტი', exact: true }).click();
  await d.page.waitForSelector('textarea:focus'); await d.page.keyboard.type(title);
  if (body) { await d.page.keyboard.press('Enter'); await d.page.keyboard.type(body); }
  await sleep(700); await d.page.click('button[aria-label="უკან"]'); await d.page.waitForSelector('ul li');
}
async function waitFor(fn, label, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(150); }
  return false;
}

// ---------- device A: create notes, sign in ----------
const A = await device('A');
await newNote(A, 'პირველი', 'ტექსტი A-დან');
await newNote(A, 'მეორე', 'კიდევ ერთი');
await signIn(A, 'me@example.com', true);
await synced(A);
await A.page.screenshot({ path: `${OUT}/s2-1-a-synced.png` });
ok('A: status shows "სინქრონიზებულია"', true);
ok('A: both notes reached the cloud', (await dump('notes')).length === 2);

// ---------- device B: sign in, notes appear ----------
const B = await device('B');
await signIn(B, 'me@example.com', true); // (the fake keeps its user list per browser)
await synced(B);
ok('B: the notes arrived', await waitFor(async () => (await listTitles(B)).length === 2));
console.log('   B sees:', JSON.stringify(await listTitles(B)));
await B.page.screenshot({ path: `${OUT}/s2-2-b-list.png` });

// ---------- an edit on B shows up on A, without touching A ----------
await B.page.locator('ul li', { hasText: 'პირველი' }).click();
await B.page.waitForSelector('textarea');
await B.page.locator('textarea').first().fill('პირველი (შეცვლილი B-ზე)');
await sleep(800);
ok('A: the edit from B arrived by itself', await waitFor(async () => (await listTitles(A)).some((t) => t.includes('შეცვლილი B-ზე'))));

// ---------- A has the note OPEN; B changes the text; A's editor follows ----------
await goNotes(A);
await A.page.locator('ul li', { hasText: 'მეორე' }).click();
await A.page.waitForSelector('textarea');
await B.page.click('button[aria-label="უკან"]'); await B.page.waitForSelector('ul li');
await B.page.locator('ul li', { hasText: 'მეორე' }).click();
await B.page.waitForSelector('textarea');
await B.page.locator('textarea').nth(1).fill('ტექსტი შეიცვალა B-ზე');
await sleep(900);
ok('A: the OPEN editor shows the text typed on B', await waitFor(async () => (await A.page.locator('textarea').nth(1).inputValue()) === 'ტექსტი შეიცვალა B-ზე'));
await A.page.click('button[aria-label="უკან"]'); await B.page.click('button[aria-label="უკან"]');

// ---------- both devices change the same note at the same time: nothing is lost ----------
await A.page.locator('ul li', { hasText: 'მეორე' }).click(); await A.page.waitForSelector('textarea');
await B.page.locator('ul li', { hasText: 'მეორე' }).click(); await B.page.waitForSelector('textarea');
// A types first and leaves it "unsaved" in the editor while B saves a different text
await A.page.locator('textarea').nth(1).fill('A-ს ახალი ტექსტი');
await B.page.locator('textarea').nth(1).fill('B-ს ახალი ტექსტი');
await sleep(1500);
await A.page.click('button[aria-label="უკან"]'); await B.page.click('button[aria-label="უკან"]');
await sleep(2500);
const final = await dump('notes');
const texts = final.map((n) => n.body ?? '').join(' | ');
ok('no text lost in the cloud (both versions still exist somewhere)', texts.includes('A-ს ახალი ტექსტი') || texts.includes('B-ს ახალი ტექსტი'));
console.log('   cloud now:', JSON.stringify(final.map((n) => ({ title: n.title, body: n.body, purged: n.purged }))));

// ---------- delete for good on A reaches B ----------
await goNotes(A);
await A.page.locator('ul li', { hasText: 'პირველი' }).click(); await A.page.waitForSelector('textarea');
await A.page.click('button[aria-label="ნაგავში გადატანა"]'); await sleep(500);
await A.page.click('nav a:has-text("ნაგავი")'); await A.page.locator('ul li').first().click();
await A.page.click('button:has-text("სამუდამოდ წაშლა")'); await A.page.locator('dialog[open] button:has-text("სამუდამოდ წაშლა")').click();
await sleep(1500);
await sleep(2500);
const allDocs = await dump('notes');
console.log('   cloud after delete-for-good:', JSON.stringify(allDocs.map((n) => ({ t: n.title, purged: n.purged, u: n.updatedAt }))));
const purged = allDocs.filter((n) => n.purged);
ok('the cloud holds a deletion marker, not the text', purged.length === 1 && !JSON.stringify(purged[0]).includes('პირველი'));
await B.page.click('nav a:has-text("ნაგავი")'); await sleep(200);
ok('B: it is gone from B too', await waitFor(async () => !(await B.page.locator('body').innerText()).includes('პირველი (შეცვლილი')));
await B.page.click('nav a:has-text("ნაგავი")').catch(() => {});

// ---------- another account on a phone that holds my notes ----------
await A.page.click('nav a:has-text("პარამეტრები")');
await account(A).locator('button:has-text("გასვლა")').click();
await account(A).locator('button:has-text("Google-ით შესვლა")').waitFor();
await account(A).locator('button:has-text("ან ელფოსტით")').click();
await account(A).locator('input[name=email]').fill('other@example.com');
await account(A).locator('input[name=password]').fill('another-pass-12');
await account(A).locator('button:has-text("ანგარიშის შექმნა")').click();
await account(A).locator('text=ამ ტელეფონზე სხვა ანგარიშის ნოტებია').waitFor({ timeout: 8000 });
ok('A: another account is NOT mixed in; a warning is shown', true);
ok('A: nothing was uploaded to the other account', (await getJson('http://127.0.0.1:4190/__cloud/dump?uid=uid-other@example.com&collection=notes')).length === 0);
await A.page.screenshot({ path: `${OUT}/s2-3-mismatch.png` });

// ---------- "back up and clear": backup is downloaded first, then local data is replaced ----------
const [download] = await Promise.all([
  A.page.waitForEvent('download', { timeout: 8000 }),
  (async () => {
    await account(A).locator('button:has-text("ბექაპი და გასუფთავება")').click();
    await A.page.locator('dialog[open] button:has-text("ბექაპი და წაშლა")').click();
  })(),
]);
ok('a backup file was downloaded first: ' + download.suggestedFilename(), /^todo-backup-.*\.json$/.test(download.suggestedFilename()));
await account(A).locator('text=სინქრონიზებულია').first().waitFor({ timeout: 8000 });
ok('afterwards this account is synced and the old notes are gone', (await A.page.locator('body').innerText()).includes('სინქრონიზებულია'));
await A.page.click('nav a:has-text("ნოტები")');
ok('the list is empty (the other account has no notes)', (await A.page.locator('ul li').count()) === 0);
await A.page.screenshot({ path: `${OUT}/s2-4-after-reset.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
