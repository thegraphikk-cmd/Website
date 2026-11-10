// Re-encodes oversized PNG photos embedded in bundled pages as WebP.
//
//   node scripts/optimize-bundle-images.mjs     # then: node scripts/prerender-pages.mjs <pages>
//
// The page templates inline images as base64 data URIs. A photo exported as PNG
// can weigh 2 MB+, which made the home page take ~30 s to paint on mobile.
// Images whose WebP is not at least 30% smaller are left alone (logos, flat art).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundledPages, openTemplate } from './bundle-io.mjs';

const MIN_BYTES = 200 * 1024;
const MAX_WIDTH = 1800;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-img-'));

const changed = [];
for (const name of bundledPages()) {
  const page = openTemplate(name);
  const tpl = page.template;
  const out = tpl.replace(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g, (all, b64) => {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < MIN_BYTES) return all;
    const src = path.join(tmp, 'in.png'), dst = path.join(tmp, 'out.webp');
    fs.writeFileSync(src, buf);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale='min(${MAX_WIDTH},iw)':-2`, '-c:v', 'libwebp', '-quality', '82', dst]);
    const webp = fs.readFileSync(dst);
    if (webp.length > buf.length * 0.7) return all;
    console.log(`${name}: ${Math.round(buf.length / 1024)} KB png -> ${Math.round(webp.length / 1024)} KB webp`);
    return 'data:image/webp;base64,' + webp.toString('base64');
  });
  if (out === tpl) continue;
  page.save(out);
  changed.push(name);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(changed.length ? 'changed: ' + changed.join(' ') : 'nothing to optimise');
