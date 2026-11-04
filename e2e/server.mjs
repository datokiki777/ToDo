// A small web server for the browser tests: serves the built app and plays the part of the cloud.
// The cloud keeps everything in memory and, like Firestore, refuses what Firestore would refuse.
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(process.env.E2E_ROOT ?? '.e2e-dist');
const PORT = Number(process.env.E2E_PORT ?? 4190);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

const cloud = new Map(); // `${uid}/${collection}` -> Map(id -> { data, serverTime })
const snaps = new Map(); // uid -> Map(id -> { meta, chunks })
let lastTime = 0;
const bucket = (uid, c) => { const k = `${uid}/${c}`; if (!cloud.has(k)) cloud.set(k, new Map()); return cloud.get(k); };
const snapBucket = (uid) => { if (!snaps.has(uid)) snaps.set(uid, new Map()); return snaps.get(uid); };
const body = (req) => new Promise((res) => { let s = ''; req.on('data', (d) => (s += d)); req.on('end', () => res(s ? JSON.parse(s) : {})); });
const json = (res, data, code = 200) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const q = (k) => url.searchParams.get(k);

  if (url.pathname === '/__cloud/changes') {
    const since = q('since');
    const out = [];
    for (const [id, v] of bucket(q('uid'), q('collection'))) {
      if (since === '' || since === null || v.serverTime >= Number(since)) out.push({ id, data: v.data, serverTime: v.serverTime });
    }
    return json(res, out);
  }
  if (url.pathname === '/__cloud/write' && req.method === 'POST') {
    const { uid, items } = await body(req);
    lastTime = Math.max(lastTime + 1, Date.now());
    for (const it of items) bucket(uid, it.collection).set(it.id, { data: it.data, serverTime: lastTime });
    return json(res, { ok: true });
  }
  if (url.pathname === '/__cloud/dump') return json(res, [...bucket(q('uid'), q('collection'))].map(([id, v]) => ({ id, ...v.data })));
  if (url.pathname === '/__cloud/snap/write' && req.method === 'POST') {
    const { uid, meta, chunks } = await body(req);
    snapBucket(uid).set(meta.id, { meta, chunks });
    return json(res, { ok: true });
  }
  if (url.pathname === '/__cloud/snap/list') return json(res, [...snapBucket(q('uid')).values()].map((v) => v.meta));
  if (url.pathname === '/__cloud/snap/read') {
    const v = snapBucket(q('uid')).get(q('id'));
    return v ? json(res, { chunks: v.chunks }) : json(res, {}, 404);
  }
  if (url.pathname === '/__cloud/snap/remove' && req.method === 'POST') {
    const { uid, ids } = await body(req);
    for (const id of ids) snapBucket(uid).delete(id);
    return json(res, { ok: true });
  }
  if (url.pathname === '/__cloud/reset') { cloud.clear(); snaps.clear(); return json(res, { ok: true }); }

  let file = join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}).listen(PORT, '127.0.0.1', () => console.log(`e2e server on http://127.0.0.1:${PORT} serving ${ROOT}`));
