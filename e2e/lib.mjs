import { mkdirSync } from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';

/** Where screenshots go (not committed). */
export const OUT = process.env.E2E_OUT ?? 'e2e/.out';
mkdirSync(OUT, { recursive: true });

/** GET a URL and parse the JSON answer (used to look into the test "cloud"). */
export const getJson = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve(JSON.parse(b)));
      })
      .on('error', reject);
  });

/**
 * Starts the browser. In CI the one Playwright installed is used; on a machine with its own
 * Chromium, point E2E_CHROMIUM at it.
 */
export function launchBrowser() {
  return chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined, args: ['--no-sandbox'] });
}
