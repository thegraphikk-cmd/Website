// Tells IndexNow search engines (Bing, Yandex, Naver, Seznam…) that pages are
// new or updated, so they're crawled within hours instead of days. Bing's index
// also feeds ChatGPT search and Microsoft Copilot.
//
//   node scripts/indexnow.mjs https://thegraphikk.com/blog/some-post ...
//   node scripts/indexnow.mjs --changed     # URLs for pages changed in the last commit
//   node scripts/indexnow.mjs --all         # every URL in sitemap.xml
//
// The key file (<key>.txt at the site root) proves we own the domain.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'thegraphikk.com';
const SITE = 'https://' + HOST;
const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow key file not found at the site root');
const KEY = fs.readFileSync(path.join(ROOT, keyFile), 'utf8').trim();

// Map a changed file to its public URL (clean URLs, no .html).
function urlFor(file) {
  if (file === 'index.html') return SITE + '/';
  if (file === 'blog/index.html') return SITE + '/blog';
  if (/^(blog\/)?[a-z0-9-]+\.html$/.test(file) && file !== '404.html') return SITE + '/' + file.replace(/\.html$/, '');
  return null;
}

let urls = process.argv.slice(2).filter((a) => a.startsWith('http'));
if (process.argv.includes('--all')) {
  urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} else if (process.argv.includes('--changed')) {
  const out = execFileSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  urls = out.split('\n').map((f) => urlFor(f.trim())).filter(Boolean);
}
urls = [...new Set(urls)];
if (!urls.length) { console.log('IndexNow: nothing to submit'); process.exit(0); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${keyFile}`, urlList: urls }),
});
// 200 = accepted, 202 = accepted (key validation pending). Anything else is an error.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} URL(s)`);
if (![200, 202].includes(res.status)) { console.log(await res.text()); process.exitCode = 1; }
