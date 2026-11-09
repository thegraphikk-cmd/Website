// Renders a branded thumbnail for every blog post from content/thumbs.json and
// the stock photo in content/stock/<slug>.jpg (Unsplash, free licence).
//
//   node scripts/build-thumbs.mjs            # all posts
//   node scripts/build-thumbs.mjs slug ...   # just these
//
// Writes assets/img/blog/<slug>.webp (1600x900), <slug>-800.webp (cards) and
// <slug>.jpg (1200x675, for og:image). Needs local Chrome and ffmpeg on PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChrome } from './prerender-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/img/blog');
const CATS = { guides: 'Web design guides', seo: 'SEO & performance', ecom: 'E-commerce' };
const ORB = { guides: 'c', seo: 'y', ecom: 'm' };
const GLOW = { guides: 'rgba(46,196,245,.45)', seo: 'rgba(255,225,0,.55)', ecom: 'rgba(229,0,125,.45)' };

const thumbs = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/thumbs.json'), 'utf8'));
const posts = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'content/posts')).filter(f => f.endsWith('.html')).map(f => {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/posts', f), 'utf8').match(/^\s*<!--([\s\S]*?)-->/)[1]);
  return [meta.slug, meta];
}));

function html(slug, t, p) {
  const photo = pathToFileURL(path.join(ROOT, 'content/stock', slug + '.jpg')).href;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Geist+Mono:wght@500&family=Noto+Sans+Tamil:wght@600&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;overflow:hidden}
body{position:relative;font-family:Geist,'Noto Sans Tamil',sans-serif;color:#fff;
  background:radial-gradient(50% 45% at 8% 105%,rgba(255,255,255,.75),transparent 70%),radial-gradient(55% 50% at 70% 115%,${GLOW[p.category]},transparent 70%),linear-gradient(180deg,#0A6CC2 0%,#1A8BDD 42%,#4FB0EC 74%,#B5DEF7 100%)}
.dots{position:absolute;width:520px;height:520px;pointer-events:none}
.dots.c{left:-60px;top:-60px;background:radial-gradient(circle,#19C3F5 4px,transparent 5px) 0 0/24px 24px;-webkit-mask-image:radial-gradient(circle at 0 0,#000,transparent 65%)}
.dots.m{right:-40px;top:-40px;width:640px;height:640px;z-index:3;background:radial-gradient(circle,#E5007D 4px,transparent 5px) 0 0/24px 24px;-webkit-mask-image:radial-gradient(circle at 100% 20%,#000 10%,transparent 60%)}
.frame{position:absolute;left:720px;top:72px;width:812px;height:756px;border-radius:40px;overflow:hidden;z-index:2;box-shadow:0 40px 80px -30px rgba(0,30,80,.55);background:#0A3D78}
.frame img{width:100%;height:100%;object-fit:cover;object-position:${t.pos || 'center'};filter:url(#duo)}
.frame:after{content:"";position:absolute;inset:0;background:linear-gradient(200deg,transparent 55%,rgba(10,60,130,.35))}
.orb{position:absolute;border-radius:50%;z-index:4;box-shadow:inset -28px -36px 80px rgba(0,0,0,.14),inset 28px 32px 60px rgba(255,255,255,.55),0 30px 60px -20px rgba(0,30,80,.45)}
.orb.y{background:radial-gradient(circle at 35% 30%,#FFF6A0,#FFE100 45%,#F5C800)}
.orb.m{background:radial-gradient(circle at 35% 30%,#FF8FCB,#E5007D 55%,#B8006A)}
.orb.c{background:radial-gradient(circle at 35% 30%,#A8ECFF,#2EC4F5 50%,#0A9BD8)}
.big{width:200px;height:200px;left:628px;top:628px}
.small{width:74px;height:74px;left:1440px;top:40px}
.copy{position:absolute;left:84px;top:84px;bottom:84px;width:600px;display:flex;flex-direction:column;z-index:5}
.chip{align-self:flex-start;font:500 22px/1 'Geist Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:14px 22px;border-radius:999px;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.45);backdrop-filter:blur(6px)}
h1{margin:auto 0 0;max-width:520px;white-space:nowrap;font-weight:600;font-size:${t.size || 104}px;line-height:.98;letter-spacing:-.055em;text-shadow:0 2px 30px rgba(0,40,100,.25)}
.brand{margin-top:40px;font:500 20px/1 'Geist Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#0A3D78;opacity:.85}
</style></head><body>
<svg width="0" height="0" style="position:absolute"><filter id="duo" color-interpolation-filters="sRGB">
<feColorMatrix type="matrix" values=".33 .5 .17 0 0 .33 .5 .17 0 0 .33 .5 .17 0 0 0 0 0 1 0"/>
<feComponentTransfer><feFuncR type="table" tableValues="0.02 0.06 0.32 0.94"/><feFuncG type="table" tableValues="0.16 0.42 0.73 0.97"/><feFuncB type="table" tableValues="0.38 0.76 0.95 1"/></feComponentTransfer>
</filter></svg>
<div class="dots c"></div><div class="dots m"></div>
<div class="frame"><img src="${photo}"></div>
<span class="orb ${ORB[p.category]} big"></span><span class="orb ${ORB[p.category] === 'y' ? 'm' : 'y'} small"></span>
<div class="copy"><span class="chip">${CATS[p.category]}</span><h1>${t.label}</h1><div class="brand">The Graphikk · Blog</div></div>
<script>document.fonts.ready.then(() => { const h = document.querySelector('h1'); let s = parseFloat(getComputedStyle(h).fontSize);
  while (h.scrollWidth > 520 && s > 60) h.style.fontSize = (s -= 2) + 'px'; document.body.dataset.fit = 1; });</script>
</body></html>`;
}

const only = process.argv.slice(2);
const slugs = Object.keys(thumbs).filter(s => !s.startsWith('_') && (!only.length || only.includes(s)));
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbs-'));
const chrome = await launchChrome();
try {
  for (const slug of slugs) {
    // Legacy posts (not in content/posts) give their category in thumbs.json.
    const p = posts[slug] || (thumbs[slug].category && { category: thumbs[slug].category });
    if (!p) throw new Error(`thumbs.json: no post with slug ${slug}`);
    if (!fs.existsSync(path.join(ROOT, 'content/stock', slug + '.jpg'))) throw new Error(`missing content/stock/${slug}.jpg`);
    const file = path.join(tmp, slug + '.html');
    fs.writeFileSync(file, html(slug, thumbs[slug], p));
    const page = await chrome.openPage({ width: 1600, height: 900 });
    await page.navigate(pathToFileURL(file).href);
    await page.waitFor(`document.readyState === 'complete' && document.body.dataset.fit && document.querySelector('.frame img').complete`);
    const png = path.join(tmp, slug + '.png');
    await page.screenshot(png, false);
    await page.close();
    const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, ...args], { stdio: 'inherit' });
    ff(['-c:v', 'libwebp', '-quality', '80', path.join(OUT, slug + '.webp')]);
    ff(['-vf', 'scale=800:-1:flags=lanczos', '-c:v', 'libwebp', '-quality', '78', path.join(OUT, slug + '-800.webp')]);
    ff(['-vf', 'scale=1200:-1:flags=lanczos', '-q:v', '4', path.join(OUT, slug + '.jpg')]);
    console.log(slug);
  }
} finally {
  await chrome.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
