// Builds the blog from content/posts/*.html.
//
// Each source file starts with a JSON front-matter comment:
//   <!--
//   { "title": "...", "slug": "...", "date": "2026-10-14", "category": "guides|seo|ecom",
//     "description": "...", "mins": 7, "cta": { "text": "...", "href": "/pricing", "label": "View pricing" } }
//   -->
// followed by the article body HTML (p, h2, h3, ul, ol, table, blockquote).
//
// Only posts whose date is today or earlier (India time) are published. Running the
// script writes blog/<slug>.html for each published post, blog/index.html and sitemap.xml.
// Set BLOG_TODAY=YYYY-MM-DD to preview a different day.
//
// Landing pages in content/pages/*.html use the same layout and are written to the
// site root as <slug>.html. Their front matter has slug, title, description, kicker,
// h1, lede, an optional cta and an optional faq list of { q, a } (rendered with
// FAQPage schema).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'posts');
const PAGES_SRC = path.join(ROOT, 'content', 'pages');
const OUT = path.join(ROOT, 'blog');
const SITE = 'https://thegraphikk.com';
const AUTHOR = 'Kavin Arulraj';

const today = process.env.BLOG_TODAY || new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

const CATS = { guides: 'Web design guides', seo: 'SEO & performance', ecom: 'E-commerce' };

// Pages that are not generated here but belong in the sitemap.
const STATIC_PAGES = [
  ['/', '1.0'], ['/about', '0.8'], ['/portfolio', '0.8'], ['/portfolio-websites', '0.8'],
  ['/industries', '0.8'], ['/pricing', '0.8'], ['/process', '0.6'], ['/locations', '0.7'],
  ['/web-development-agency-india', '0.7'], ['/web-development-company-chennai', '0.9'],
  ['/blog', '0.7'], ['/faq', '0.6'],
  ['/contact', '0.7'], ['/legal', '0.3'],
];

// The original post lives in its own bundled page; list it alongside the generated ones.
const LEGACY = [{
  title: 'How much does a website cost in India in 2026?', slug: 'website-cost-in-india',
  date: '2026-10-01', category: 'guides', mins: 8,
  description: 'Real price ranges by type of site, what drives the cost, and where you can save.',
}];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function readPosts() {
  return fs.readdirSync(SRC).filter(f => f.endsWith('.html')).map(f => {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    const m = raw.match(/^\s*<!--([\s\S]*?)-->/);
    if (!m) throw new Error(`${f}: missing front matter`);
    const meta = JSON.parse(m[1]);
    for (const k of ['title', 'slug', 'date', 'category', 'description', 'mins']) {
      if (!meta[k]) throw new Error(`${f}: front matter missing "${k}"`);
    }
    if (!CATS[meta.category]) throw new Error(`${f}: unknown category ${meta.category}`);
    return { ...meta, body: raw.slice(m[0].length).trim(), file: f };
  });
}

// Give every h2 an id and collect them for the contents list.
function withToc(body) {
  const toc = [];
  const used = new Set();
  const html = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    let id = inner.replace(/<[^>]+>/g, '').toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    while (used.has(id)) id += '-2';
    used.add(id);
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html, toc };
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">';

const CSS = `
:root{--ink:#111;--muted:#555;--paper:#F7F6F2;--card:#ECEBE6;--line:#DDDCD6;--blue:#0A6FC4;--sky:#2EA0E8;--yellow:#FFE100;--pink:#E5007D}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
body{font-family:Geist,system-ui,sans-serif;font-size:16px;line-height:1.5}
a{color:var(--ink);text-decoration:none}
a:hover{color:var(--blue)}
.wrap{padding:8px;min-height:100vh}
.mono{font-family:'Geist Mono',monospace;letter-spacing:.1em;text-transform:uppercase}
/* header */
.hdr{position:sticky;top:8px;z-index:50;padding-bottom:8px}
.bar{max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;height:60px;padding:0 8px 0 18px;border-radius:999px;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 30px -18px rgba(0,0,0,.35)}
.logo{display:flex;align-items:center;gap:10px}
.logo span{font-weight:600;font-size:19px;letter-spacing:-.03em;white-space:nowrap}
.nav{display:flex;gap:30px;font-size:12px}
.nav a.on{color:var(--blue)}
.quote{display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:999px;background:var(--yellow);color:var(--ink);font-size:12px;font-weight:500}
.quote:hover{background:var(--ink);color:#fff}
.menu{display:none;position:relative}
.menu summary{list-style:none;width:44px;height:44px;border-radius:999px;background:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer}
.menu summary::-webkit-details-marker{display:none}
.menu summary i{width:16px;height:1.5px;background:#fff;display:block}
.menu nav{position:absolute;right:0;top:52px;width:min(92vw,340px);border-radius:18px;background:#fff;box-shadow:0 20px 40px -20px rgba(0,0,0,.3);padding:6px 20px;display:flex;flex-direction:column;font-size:20px;letter-spacing:-.03em}
.menu nav a{padding:12px 0;border-bottom:1px solid #EEE}
.menu nav a:last-child{border-bottom:none}
@media (max-width:899px){.nav,.quote{display:none}.menu{display:block}}
/* cover */
.cover{position:relative;overflow:hidden;border-radius:22px;color:#fff;background:radial-gradient(50% 40% at 12% 100%,rgba(255,255,255,.7),transparent 70%),radial-gradient(45% 35% at 92% 100%,rgba(255,255,255,.6),transparent 70%),linear-gradient(180deg,#0A6CC2 0%,#1A8BDD 40%,#4FB0EC 72%,#B5DEF7 100%)}
.cover:before,.cover:after{content:"";position:absolute;width:240px;height:240px;pointer-events:none}
.cover:before{left:-30px;top:-30px;background:radial-gradient(circle,#19C3F5 2px,transparent 2.6px) 0 0/12px 12px;-webkit-mask-image:radial-gradient(circle at 0 0,#000,transparent 65%);mask-image:radial-gradient(circle at 0 0,#000,transparent 65%)}
.cover:after{right:-30px;top:30px;background:radial-gradient(circle,#E5007D 2px,transparent 2.6px) 0 0/12px 12px;-webkit-mask-image:radial-gradient(circle at 100% 40%,#000,transparent 60%);mask-image:radial-gradient(circle at 100% 40%,#000,transparent 60%)}
.cover:before,.cover:after{z-index:0}
.cover.seo{background:radial-gradient(50% 40% at 12% 100%,rgba(255,255,255,.7),transparent 70%),radial-gradient(60% 50% at 85% 110%,rgba(255,225,0,.55),transparent 70%),linear-gradient(180deg,#0A6CC2 0%,#1A8BDD 40%,#4FB0EC 72%,#B5DEF7 100%)}
.cover.ecom{background:radial-gradient(50% 40% at 12% 100%,rgba(255,255,255,.7),transparent 70%),radial-gradient(60% 50% at 85% 110%,rgba(229,0,125,.45),transparent 70%),linear-gradient(180deg,#0A6CC2 0%,#1A8BDD 40%,#4FB0EC 72%,#B5DEF7 100%)}
.orb{position:absolute;z-index:1;border-radius:50%;box-shadow:inset -14px -18px 40px rgba(0,0,0,.12),inset 14px 16px 30px rgba(255,255,255,.55)}
.orb.y{background:radial-gradient(circle at 35% 30%,#FFF6A0,#FFE100 45%,#F5C800)}
.orb.m{background:radial-gradient(circle at 35% 30%,#FF8FCB,#E5007D 55%,#B8006A)}
.orb.c{background:radial-gradient(circle at 35% 30%,#A8ECFF,#2EC4F5 50%,#0A9BD8)}
/* article */
.post-head{max-width:1100px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(16px,3vw,40px) clamp(56px,7vw,96px);position:relative;z-index:1}
.back{display:inline-flex;font-size:12px;color:#EAF6FE}
.back:hover{color:#fff}
.post-head h1{margin:22px 0 0;max-width:18em;font-weight:500;font-size:clamp(34px,5vw,68px);line-height:1.04;letter-spacing:-.055em;text-wrap:balance}
.meta{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px 12px;font-size:14px;color:#EAF6FE}
.meta b{color:#fff;font-weight:600}
.lede{margin:20px 0 0;max-width:36em;font-size:clamp(16px,1.4vw,19px);color:#EAF6FE}
.body{max-width:1240px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(12px,2.4vw,32px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:clamp(28px,4vw,56px);align-items:start}
.toc{position:sticky;top:96px;border-radius:18px;background:var(--card);padding:20px}
.toc ol{margin:12px 0 0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:10px;font-size:15px}
.prose{grid-column:span 2;min-width:0;font-size:18px;line-height:1.7;color:#2A2A2A;text-wrap:pretty}
@media (max-width:899px){.toc{position:static}.prose{grid-column:auto}}
.prose>p:first-child{font-size:21px;line-height:1.55;color:var(--ink)}
.prose p{margin:0 0 18px}
.prose h2{margin:44px 0 14px;font-weight:500;font-size:clamp(24px,2.6vw,34px);line-height:1.2;letter-spacing:-.04em;color:var(--ink);scroll-margin-top:90px}
.prose h3{margin:28px 0 10px;font-weight:600;font-size:20px;letter-spacing:-.02em;color:var(--ink)}
.prose ul,.prose ol{margin:0 0 20px;padding-left:22px}
.prose li{margin-bottom:8px}
.prose a{color:var(--blue);text-decoration:underline;text-underline-offset:3px}
.prose strong{color:var(--ink)}
.prose table{width:100%;border-collapse:collapse;margin:8px 0 26px;font-size:16px;background:#fff;border-radius:14px;overflow:hidden}
.prose th,.prose td{text-align:left;padding:12px 16px;border-bottom:1px solid #EEE;vertical-align:top}
.prose th{background:var(--card);font-weight:600;color:var(--ink)}
.prose blockquote{margin:24px 0;padding:18px 22px;border-left:4px solid var(--yellow);background:#fff;border-radius:0 14px 14px 0;color:var(--ink)}
.table-scroll{overflow-x:auto}
.cta{margin-top:44px;border-radius:20px;background:var(--ink);color:#fff;padding:clamp(22px,3vw,34px);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:20px}
.cta .k{font-size:12px;color:#BDBDBD}
.cta .t{margin-top:8px;font-size:24px;line-height:1.2;letter-spacing:-.04em;max-width:22em}
.btn{display:inline-flex;align-items:center;gap:12px;height:48px;padding:0 5px 0 20px;border-radius:999px;background:var(--yellow);color:var(--ink)!important;font-family:'Geist Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;text-decoration:none!important}
.btn span{width:38px;height:38px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center}
.btn:hover{background:#fff}
/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:28px 18px}
.card{display:flex;flex-direction:column;gap:12px}
.card .cover{aspect-ratio:16/9;border-radius:16px;padding:18px;display:flex;align-items:flex-end}
.card .cover b{position:relative;z-index:1;font-weight:500;font-size:20px;line-height:1.15;letter-spacing:-.04em;text-shadow:0 1px 12px rgba(0,40,90,.25)}
.card .k{font-size:11px;color:#666}
.card h3{margin:0;font-weight:500;font-size:21px;line-height:1.25;letter-spacing:-.03em}
.card:hover h3{color:var(--blue)}
.section{max-width:1320px;margin:0 auto;padding:0 clamp(12px,2.4vw,32px) clamp(64px,8vw,112px)}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:28px}
.filters button{height:40px;padding:0 16px;border-radius:999px;border:1px solid #CFCDC5;background:transparent;font:500 12px 'Geist Mono',monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;color:var(--ink)}
.filters button[aria-selected=true]{background:var(--ink);border-color:var(--ink);color:#fff}
/* footer */
.ftr{padding:clamp(56px,7vw,88px) clamp(12px,2.4vw,32px) 24px}
.ftr-in{max-width:1320px;margin:0 auto}
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(calc(50% - 14px),170px),1fr));gap:36px 28px}
.fcol .h{font-size:11px;color:#777;margin-bottom:14px}
.fcol div{display:flex;flex-direction:column;gap:9px;font-size:15px}
.word{margin-top:clamp(48px,6vw,72px);font-weight:500;font-size:clamp(48px,12.5vw,190px);line-height:.85;letter-spacing:-.07em;overflow-wrap:anywhere}
.legal{margin-top:24px;padding-top:18px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;font-size:13px;color:#666}
.legal a{color:#666}
.sticky{display:none}
@media (max-width:899px){.sticky{display:flex;position:fixed;left:12px;right:12px;bottom:12px;z-index:60;gap:8px;padding:6px;border-radius:999px;background:rgba(17,17,17,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.sticky a{flex:1;height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px}.sticky a.q{flex:1.2;background:var(--yellow);color:var(--ink)}.ftr{padding-bottom:96px}}
`;

function header(active = '/blog') {
  const links = [['/portfolio', 'Portfolio'], ['/industries', 'Industries'], ['/pricing', 'Pricing'], ['/about', 'About'], ['/blog', 'Blog']];
  return `<header class="hdr"><div class="bar">
  <a class="logo" href="/"><img src="/assets/img/logo.png" alt="The Graphikk pen-nib logo" width="26" height="24"><span>The Graphikk</span></a>
  <nav class="nav mono" aria-label="Main">${links.map(([h, t]) => `<a href="${h}"${h === active ? ' class="on"' : ''}>${t}</a>`).join('')}</nav>
  <div style="display:flex;gap:6px;align-items:center">
    <a class="quote mono" href="/contact">Get a Quote</a>
    <details class="menu"><summary aria-label="Menu"><i></i><i></i></summary><nav aria-label="Mobile">${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="/contact">Get a Quote</a></nav></details>
  </div>
</div></header>`;
}

function footer() {
  return `<footer class="ftr"><div class="ftr-in">
  <div class="fgrid">
    <div style="grid-column:span 2;min-width:0">
      <div class="logo"><img src="/assets/img/logo.png" alt="" width="26" height="24"><span>The Graphikk</span></div>
      <p style="margin:16px 0 0;max-width:24em;color:#555;font-size:15px">Website design and development from Chennai, for businesses and individuals across India.</p>
    </div>
    <div class="fcol"><div class="h mono">Services</div><div><a href="/industries#ecommerce">E-commerce</a><a href="/portfolio-websites">Portfolio Websites</a></div></div>
    <div class="fcol"><div class="h mono">Locations</div><div><a href="/web-development-company-chennai">Web Development Company Chennai</a><a href="/locations#india">Web Design India</a><a href="/web-development-agency-india">Web Development Agency India</a></div></div>
    <div class="fcol"><div class="h mono">Studio</div><div><a href="/about">About</a><a href="/portfolio">Portfolio</a><a href="/process">Process</a><a href="/industries">Industries</a><a href="/blog">Blog</a><a href="/faq">FAQ</a></div></div>
    <div class="fcol"><div class="h mono">Contact</div><div><a href="mailto:thegraphikk@gmail.com" style="overflow-wrap:anywhere">thegraphikk@gmail.com</a></div></div>
  </div>
  <div class="word">The Graphikk</div>
  <div class="legal"><span>© ${today.slice(0, 4)} The Graphikk. Chennai, India.</span><div style="display:flex;gap:18px"><a href="/legal#privacy">Privacy</a><a href="/legal#terms">Terms</a><a href="/legal#cookies">Cookies</a></div></div>
</div></footer>
<div class="sticky mono"><a href="mailto:thegraphikk@gmail.com">Email us</a><a class="q" href="/contact">Get a Quote ↗</a></div>`;
}

function page({ title, description, canonical, ogType = 'website', jsonld = [], body, active }) {
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="The Graphikk">
<meta property="og:image" content="${SITE}/assets/img/og-blog.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/logo.png">
${FONTS}
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body><div class="wrap">
${header(active)}
${body}
${footer()}
</div></body>
</html>
`;
}

// Small decorative orbs, varied per post so covers don't all look identical.
function orbs(seed, small = true) {
  // FNV-1a, so similar slugs still get different colours and positions.
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const kinds = ['y', 'm', 'c'];
  const a = kinds[h % 3], b = kinds[(h % 3 + 1 + ((h >>> 4) % 2)) % 3];
  const big = `<span class="orb ${a}" style="width:${28 + (h >>> 6) % 10}%;aspect-ratio:1;right:${-6 - (h >>> 10) % 8}%;top:${8 + (h >>> 14) % 20}%"></span>`;
  return small ? big + `<span class="orb ${b}" style="width:${9 + (h >>> 18) % 6}%;aspect-ratio:1;left:${48 + (h >>> 21) % 14}%;top:${10 + (h >>> 25) % 22}%"></span>` : big;
}

function card(p) {
  return `<a class="card" href="/blog/${p.slug}" data-cat="${p.category}">
  <div class="cover ${p.category}" aria-hidden="true">${orbs(p.slug)}</div>
  <div class="k mono">${CATS[p.category]} · ${p.mins} min</div>
  <h3>${esc(p.title)}</h3>
</a>`;
}

// Links to posts that aren't live yet become plain text; the daily rebuild
// turns them into links once those posts publish.
function linkLivePosts(body, liveSlugs, allSlugs) {
  return body.replace(/<a href="\/blog\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g, (m, slug, text) => {
    if (liveSlugs.has(slug)) return m;
    if (allSlugs.has(slug)) return text;
    throw new Error(`link to unknown post /blog/${slug}`);
  });
}

function postPage(p, related, liveSlugs, allSlugs) {
  const { html, toc } = withToc(linkLivePosts(p.body, liveSlugs, allSlugs));
  const url = `${SITE}/blog/${p.slug}`;
  const cta = p.cta || { text: 'Get a fixed written quote for your website in 24 hours.', href: '/contact', label: 'Get a Quote' };
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
      datePublished: p.date, dateModified: p.updated || p.date, mainEntityOfPage: url, url,
      image: `${SITE}/assets/img/og-blog.png`, inLanguage: 'en-IN',
      author: { '@type': 'Person', name: AUTHOR, url: `${SITE}/about` },
      publisher: { '@type': 'Organization', name: 'The Graphikk', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/assets/img/logo.png` } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog' },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ];
  const body = `<article>
<header class="cover ${p.category}">${orbs(p.slug, false)}
  <div class="post-head">
    <a class="back mono" href="/blog">← ${CATS[p.category]}</a>
    <h1>${esc(p.title)}</h1>
    <p class="lede">${esc(p.description)}</p>
    <div class="meta"><b>${AUTHOR}</b><span>·</span><span>${p.mins} min read</span><span>·</span><time datetime="${p.date}">${fmtDate(p.date)}</time></div>
  </div>
</header>
<div class="body">
  <nav class="toc" aria-label="Contents"><div class="mono" style="font-size:12px;color:#555">Contents</div><ol>${toc.map(t => `<li><a href="#${t.id}">${t.text}</a></li>`).join('')}</ol></nav>
  <div class="prose">
${html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')}
    <aside class="cta"><div><div class="k mono">Work with The Graphikk</div><div class="t">${esc(cta.text)}</div></div><a class="btn" href="${cta.href}">${esc(cta.label)} <span>↗</span></a></aside>
  </div>
</div>
</article>
${related.length ? `<section class="section"><h2 style="margin:0 0 24px;font-weight:500;font-size:clamp(24px,2.6vw,34px);letter-spacing:-.045em">Keep reading</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}`;
  return page({ title: `${p.title} — The Graphikk`, description: p.description, canonical: url, ogType: 'article', jsonld, body });
}

// The business itself, for landing-page schema. Keep in step with the
// ProfessionalService block in index.html.
const ORG = {
  '@type': 'ProfessionalService', '@id': `${SITE}/#business`, name: 'The Graphikk', url: SITE + '/',
  logo: `${SITE}/assets/img/logo.png`, image: `${SITE}/assets/img/og-blog.png`,
  description: 'Web design and development company in Chennai building fast, SEO-ready websites and online stores for businesses across India.',
  email: 'thegraphikk@gmail.com', telephone: '+91-70102-66975', priceRange: '₹20,000+',
  address: { '@type': 'PostalAddress', addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
  areaServed: [{ '@type': 'City', name: 'Chennai' }, { '@type': 'Country', name: 'India' }],
  founder: { '@type': 'Person', name: AUTHOR },
  knowsLanguage: ['en', 'ta'],
};

function readLandingPages() {
  if (!fs.existsSync(PAGES_SRC)) return [];
  return fs.readdirSync(PAGES_SRC).filter(f => f.endsWith('.html')).map(f => {
    const raw = fs.readFileSync(path.join(PAGES_SRC, f), 'utf8');
    const m = raw.match(/^\s*<!--([\s\S]*?)-->/);
    if (!m) throw new Error(`${f}: missing front matter`);
    const meta = JSON.parse(m[1]);
    for (const k of ['slug', 'title', 'description', 'h1', 'lede']) {
      if (!meta[k]) throw new Error(`${f}: front matter missing "${k}"`);
    }
    return { ...meta, body: raw.slice(m[0].length).trim() };
  });
}

function landingPage(p, liveSlugs, allSlugs) {
  const faq = p.faq || [];
  const faqHtml = faq.length ? `\n<h2>Frequently asked questions</h2>\n${faq.map(f => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join('\n')}` : '';
  const { html, toc } = withToc(linkLivePosts(p.body, liveSlugs, allSlugs) + faqHtml);
  const url = `${SITE}/${p.slug}`;
  const cta = p.cta || { text: 'Get a fixed written quote for your website in 24 hours.', href: '/contact', label: 'Get a Quote' };
  const jsonld = [
    { '@context': 'https://schema.org', ...ORG },
    {
      '@context': 'https://schema.org', '@type': 'WebPage', name: p.title, description: p.description, url,
      inLanguage: 'en-IN', about: { '@id': ORG['@id'] }, isPartOf: { '@type': 'WebSite', name: 'The Graphikk', url: SITE + '/' },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: p.h1, item: url },
      ],
    },
    ...(faq.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }] : []),
  ];
  const body = `<article>
<header class="cover">${orbs(p.slug, false)}
  <div class="post-head">
    <a class="back mono" href="/">← Home${p.kicker ? ' / ' + esc(p.kicker) : ''}</a>
    <h1>${esc(p.h1)}</h1>
    <p class="lede">${esc(p.lede)}</p>
    <div class="meta" style="margin-top:28px"><a class="btn" href="${cta.href}">${esc(cta.label)} <span>↗</span></a><a class="btn" href="/pricing" style="background:#fff">See pricing <span>↗</span></a></div>
  </div>
</header>
<div class="body">
  <nav class="toc" aria-label="Contents"><div class="mono" style="font-size:12px;color:#555">On this page</div><ol>${toc.map(t => `<li><a href="#${t.id}">${t.text}</a></li>`).join('')}</ol></nav>
  <div class="prose">
${html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')}
    <aside class="cta"><div><div class="k mono">Work with The Graphikk</div><div class="t">${esc(cta.text)}</div></div><a class="btn" href="${cta.href}">${esc(cta.label)} <span>↗</span></a></aside>
  </div>
</div>
</article>`;
  return page({ title: p.title, description: p.description, canonical: url, jsonld, body, active: null });
}

function indexPage(list) {
  const [feat, ...rest] = list;
  const body = `<section class="cover" style="padding:clamp(40px,6vw,80px) clamp(16px,3vw,40px)">${orbs('blog-index', false)}
  <div style="max-width:1240px;margin:0 auto;position:relative;z-index:1">
    <div class="mono" style="font-size:12px;color:#EAF6FE">Insights</div>
    <h1 style="margin:18px 0 0;max-width:14em;font-weight:500;font-size:clamp(38px,5.6vw,80px);line-height:1.02;letter-spacing:-.055em">Notes on design, <span style="color:#D4ECFB">speed and selling online</span></h1>
    <p style="margin:18px 0 0;max-width:34em;font-size:clamp(15px,1.3vw,18px);color:#EAF6FE">Straight answers to the questions Indian business owners ask before building a website, an online store or a portfolio.</p>
  </div>
</section>
<section class="section" style="padding-top:clamp(40px,5vw,64px)">
  <a class="card" href="/blog/${feat.slug}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:24px;align-items:center;margin-bottom:clamp(40px,5vw,64px)">
    <div class="cover ${feat.category}" style="aspect-ratio:16/9;border-radius:18px" aria-hidden="true">${orbs(feat.slug)}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <span class="mono" style="align-self:flex-start;font-size:11px;padding:6px 12px;border-radius:999px;background:var(--yellow)">Latest</span>
      <div class="k mono">${CATS[feat.category]} · ${feat.mins} min</div>
      <h2 style="margin:0;font-weight:500;font-size:clamp(26px,3vw,40px);line-height:1.1;letter-spacing:-.045em">${esc(feat.title)}</h2>
      <p style="margin:0;color:#555">${esc(feat.description)}</p>
      <span class="mono" style="font-size:12px">Read article ↗</span>
    </div>
  </a>
  <div class="filters" role="tablist" aria-label="Category">
    <button role="tab" aria-selected="true" data-f="all">All</button>${Object.entries(CATS).map(([k, v]) => `<button role="tab" aria-selected="false" data-f="${k}">${v}</button>`).join('')}
  </div>
  <div class="grid" id="posts">${rest.map(card).join('')}</div>
</section>
<script>
document.querySelectorAll('.filters button').forEach(function (b) {
  b.addEventListener('click', function () {
    var f = b.getAttribute('data-f');
    document.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
    document.querySelectorAll('#posts .card').forEach(function (c) { c.style.display = f === 'all' || c.getAttribute('data-cat') === f ? '' : 'none'; });
  });
});
</script>`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Blog', name: 'The Graphikk blog', url: `${SITE}/blog`,
    blogPost: list.slice(0, 20).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date })),
  }];
  return page({
    title: 'Blog: Website, SEO & E-commerce Guides for Indian Businesses — The Graphikk',
    description: 'Guides on website costs, Shopify and WooCommerce, local SEO, Google Business Profile and portfolio websites, written for business owners in Chennai and across India.',
    canonical: `${SITE}/blog`, jsonld, body,
  });
}

// ---- build ----
const posts = readPosts();
const slugs = new Set();
for (const p of posts) {
  if (slugs.has(p.slug)) throw new Error('duplicate slug ' + p.slug);
  slugs.add(p.slug);
}
const published = posts.filter(p => p.date <= today).sort((a, b) => b.date.localeCompare(a.date));
const listed = [...published, ...LEGACY.filter(l => l.date <= today)].sort((a, b) => b.date.localeCompare(a.date));

const liveSlugs = new Set(listed.map(p => p.slug));
const allSlugs = new Set([...slugs, ...LEGACY.map(l => l.slug)]);

fs.mkdirSync(OUT, { recursive: true });
for (const p of posts) {
  const file = path.join(OUT, p.slug + '.html');
  if (p.date > today) { if (fs.existsSync(file)) fs.unlinkSync(file); continue; }
  const related = [
    ...listed.filter(o => o.slug !== p.slug && o.category === p.category),
    ...listed.filter(o => o.slug !== p.slug && o.category !== p.category),
  ].slice(0, 3);
  fs.writeFileSync(file, postPage(p, related, liveSlugs, allSlugs));
}
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage(listed));
for (const p of readLandingPages()) fs.writeFileSync(path.join(ROOT, p.slug + '.html'), landingPage(p, liveSlugs, allSlugs));

const urls = [
  ...STATIC_PAGES.map(([u, pr]) => `  <url><loc>${SITE}${u}</loc><priority>${pr}</priority></url>`),
  ...listed.map(p => `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${p.updated || p.date}</lastmod><priority>0.6</priority></url>`),
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

// The home page (a bundled page) has "latest articles" cards titled after posts.
// Point each card at its post once that post is live; until then it keeps its
// current link. The template is JSON inside a script tag, so decode, edit, re-encode.
function updateHomeCards() {
  const file = path.join(ROOT, 'index.html');
  const text = fs.readFileSync(file, 'utf8');
  const re = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;
  const m = text.match(re);
  if (!m) return;
  const bySlugTitle = new Map(listed.map(p => [p.title, p.slug]));
  const tpl = JSON.parse(m[2]);
  const out = tpl.replace(/<a href="\/blog\/([a-z0-9-]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, slug, attrs, inner) => {
    const h3 = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (!h3) return all;
    const target = bySlugTitle.get(h3[1].replace(/&amp;/g, '&').trim());
    return target && target !== slug ? `<a href="/blog/${target}"${attrs}>${inner}</a>` : all;
  });
  if (out === tpl) return;
  const encoded = JSON.stringify(out).replace(/<\//g, '<\\u002F');
  fs.writeFileSync(file, text.replace(re, (all, a, b, c) => a + encoded + c));
  console.log('home page article cards updated');
}
updateHomeCards();

const next = posts.filter(p => p.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
console.log(`today ${today}: ${published.length}/${posts.length} posts published` + (next ? `, next "${next.title}" on ${next.date}` : ''));
