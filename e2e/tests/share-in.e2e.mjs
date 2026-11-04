import { OUT, launchBrowser } from '../lib.mjs';
const browser = await launchBrowser();
const ok = (l, c) => console.log((c ? 'OK   ' : 'FAIL ') + l);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const BASE = 'http://127.0.0.1:4190';
const notes = (page) => page.evaluate(() => new Promise((res) => { const q = indexedDB.open('todo-db'); q.onsuccess = () => { const g = q.result.transaction('notes').objectStore('notes').getAll(); g.onsuccess = () => { q.result.close(); res(g.result.filter((n) => !n.deletedAt).map((n) => ({ title: n.title, body: n.body }))); }; }; }));
// What Android does when "Share → ToDo" is chosen: it opens the app at an address with the shared things in it.
async function share(params) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'ka-GE', serviceWorkers: 'block', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?${new URLSearchParams(params)}`);
  return { ctx, page };
}

// ---- the manifest tells Android the app can receive shares ----
{
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`); await page.waitForSelector('nav');
  const m = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  ok('the app declares itself a share target (GET, title/text/url)', m.share_target?.method === 'GET' && m.share_target.params?.text === 'text' && m.share_target.params?.url === 'url' && m.share_target.action === '/');
  await ctx.close();
}

// ---- a place shared from Maps ----
{
  const { ctx, page } = await share({ text: 'სასტუმრო თბილისი, რუსთაველი 5\nhttps://maps.app.goo.gl/AbC123' });
  await page.waitForSelector('textarea', { timeout: 8000 });
  ok('the note opens straight away', /#\/note\//.test(page.url()));
  ok('the address bar is cleaned (a reload will not make another note)', !page.url().includes('?'));
  const title = await page.locator('textarea').first().inputValue();
  const body = await page.locator('textarea[data-body]').inputValue();
  console.log('   title:', title, '| text:', body);
  ok('the place name is the title and the link is the text', title === 'სასტუმრო თბილისი, რუსთაველი 5' && body === 'https://maps.app.goo.gl/AbC123');
  ok('the link is already a button that opens the location', (await page.locator('ul[aria-label="ბმულები"] a[href^="https://maps.app.goo.gl"]').count()) === 1);
  await page.screenshot({ path: `${OUT}/si-1-maps.png` });
  ok('the keyboard is not forced open (nothing to type yet)', (await page.evaluate(() => document.activeElement?.tagName)) !== 'TEXTAREA');
  await page.reload(); await page.waitForSelector('ul li', { timeout: 8000 }).catch(() => {});
  ok('a reload makes no second note', (await notes(page)).length === 1);
  await page.goto(`${BASE}/#/`); await page.waitForSelector('ul li');
  ok('the list shows the new note', (await page.locator('ul li').allInnerTexts()).join().includes('სასტუმრო თბილისი'));
  await ctx.close();
}

// ---- "back" from a shared note lands on the list ----
{
  const { ctx, page } = await share({ text: 'ტელეფონი\n555 12 34 56' });
  await page.waitForSelector('textarea', { timeout: 8000 });
  await page.tap('button[aria-label="უკან"]');
  await page.waitForSelector('ul li');
  ok('back from a shared note shows the list of notes', new URL(page.url()).hash === '#/' && (await page.locator('ul li').allInnerTexts()).join().includes('ტელეფონი'));
  await ctx.close();
}

// ---- a web page: title and address ----
{
  const { ctx, page } = await share({ title: 'კარგი რეცეპტი', url: 'https://example.com/recipe' });
  await page.waitForSelector('textarea', { timeout: 8000 });
  const title = await page.locator('textarea').first().inputValue();
  const body = await page.locator('textarea[data-body]').inputValue();
  ok('a web page: its title and its address', title === 'კარგი რეცეპტი' && body === 'https://example.com/recipe');
  await ctx.close();
}

// ---- a phone number ----
{
  const { ctx, page } = await share({ text: 'გიორგი 555 12 34 56' });
  await page.waitForSelector('textarea', { timeout: 8000 });
  ok('a shared phone number becomes a call button', (await page.locator('ul[aria-label="ბმულები"] a[href="tel:+995555123456"]').count()) === 1);
  await ctx.close();
}

// ---- things that must NOT make a note ----
{
  const { ctx, page } = await share({ text: '   ' });
  await page.waitForSelector('nav'); await sleep(700);
  ok('an empty share makes no note and shows the list', (await notes(page)).length === 0 && !/#\/note\//.test(page.url()));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?utm_source=x&foo=bar`); await page.waitForSelector('nav'); await sleep(700);
  ok('other things in the address (not title/text/url) are ignored', (await notes(page)).length === 0);
  await ctx.close();
}

// ---- an enormous share is cut down ----
{
  const { ctx, page } = await share({ text: 'ა'.repeat(60000) });
  await page.waitForSelector('textarea', { timeout: 8000 });
  await sleep(500);
  const [n] = await notes(page);
  ok('a huge share is cut to a sensible size', n && n.body.length === 20000);
  await ctx.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
