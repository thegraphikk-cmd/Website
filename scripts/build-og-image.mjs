// Renders the site-wide social preview image (assets/img/og-site.jpg, 1200x630)
// used by the main pages' og:image and the business schema. Needs local Chrome
// and ffmpeg.  node scripts/build-og-image.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChrome } from './prerender-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logo = pathToFileURL(path.join(ROOT, 'assets/img/logo.png')).href;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Geist+Mono:wght@500&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:Geist,sans-serif;color:#fff;
  background:radial-gradient(50% 50% at 8% 108%,rgba(255,255,255,.8),transparent 70%),radial-gradient(45% 50% at 88% 112%,rgba(255,225,0,.5),transparent 70%),linear-gradient(180deg,#0A6CC2 0%,#1A8BDD 42%,#4FB0EC 74%,#B5DEF7 100%)}
.dots{position:absolute;pointer-events:none}
.c{left:-40px;top:-40px;width:420px;height:420px;background:radial-gradient(circle,#19C3F5 3.5px,transparent 4.5px) 0 0/20px 20px;-webkit-mask-image:radial-gradient(circle at 0 0,#000,transparent 65%)}
.m{right:-30px;top:-30px;width:520px;height:520px;background:radial-gradient(circle,#E5007D 3.5px,transparent 4.5px) 0 0/20px 20px;-webkit-mask-image:radial-gradient(circle at 100% 20%,#000 10%,transparent 62%)}
.orb{position:absolute;border-radius:50%;box-shadow:inset -24px -30px 70px rgba(0,0,0,.14),inset 24px 28px 50px rgba(255,255,255,.55),0 30px 60px -20px rgba(0,30,80,.45)}
.y{width:260px;height:260px;right:90px;top:250px;background:radial-gradient(circle at 35% 30%,#FFF6A0,#FFE100 45%,#F5C800)}
.p{width:120px;height:120px;right:330px;top:120px;background:radial-gradient(circle at 35% 30%,#FF8FCB,#E5007D 55%,#B8006A)}
.cy{width:70px;height:70px;right:60px;top:90px;background:radial-gradient(circle at 35% 30%,#A8ECFF,#2EC4F5 50%,#0A9BD8)}
.copy{position:absolute;left:72px;top:64px;bottom:64px;width:780px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-weight:600;font-size:30px;letter-spacing:-.03em}
.brand img{width:44px;height:auto;filter:brightness(0) invert(1)}
h1{margin:auto 0 0;font-weight:600;font-size:66px;white-space:nowrap;line-height:1;letter-spacing:-.055em;text-shadow:0 2px 30px rgba(0,40,100,.25)}
h1 span{color:#E3F4FF}
.sub{margin-top:26px;font:500 21px/1.3 'Geist Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#0A3D78}
</style></head><body>
<div class="dots c"></div><div class="dots m"></div>
<span class="orb y"></span><span class="orb p"></span><span class="orb cy"></span>
<div class="copy">
  <div class="brand"><img src="${logo}" alt="">The Graphikk</div>
  <h1>Websites that look sharp<br><span>and actually sell</span></h1>
  <div class="sub">Web design &amp; development · Chennai, India</div>
</div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const file = path.join(tmp, 'og.html');
fs.writeFileSync(file, html);
const chrome = await launchChrome();
try {
  const page = await chrome.openPage({ width: 1200, height: 630 });
  await page.navigate(pathToFileURL(file).href);
  await page.waitFor(`document.readyState === 'complete' && document.fonts.status === 'loaded'`);
  await new Promise((r) => setTimeout(r, 300));
  const png = path.join(tmp, 'og.png');
  await page.screenshot(png, false);
  await page.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '3', path.join(ROOT, 'assets/img/og-site.jpg')], { stdio: 'inherit' });
  console.log('assets/img/og-site.jpg');
} finally {
  await chrome.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
