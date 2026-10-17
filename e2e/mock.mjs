// Shared Playwright helpers: launches Chromium (iPhone-sized) and serves the fixture
// games in place of the chess.com API.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export async function launch({ mobile = true, offline404 = false, profile } = {}) {
  const exe = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
  const opts = mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' }
    : { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' };
  // `profile` = a user-data dir, so IndexedDB (analyses) persists between runs.
  const browser = profile ? null : await chromium.launch({ executablePath: exe });
  const context = profile
    ? await chromium.launchPersistentContext(profile, { executablePath: exe, ...opts })
    : await browser.newContext(opts);
  await context.route('https://api.chess.com/**', async (route) => {
    const url = route.request().url();
    if (offline404) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":0,"message":"not found"}' });
    if (url.endsWith('/games/archives')) {
      return route.fulfill({ contentType: 'application/json', body: readFileSync(join(FIX, 'archives.json'), 'utf8') });
    }
    const m = /games\/(\d{4})\/(\d{2})$/.exec(url);
    const file = m && join(FIX, `${m[1]}-${m[2]}.json`);
    if (file && existsSync(file)) return route.fulfill({ contentType: 'application/json', body: readFileSync(file, 'utf8') });
    return route.fulfill({ contentType: 'application/json', body: '{"games":[]}' });
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { browser: browser ?? context, context, page, errors };
}
