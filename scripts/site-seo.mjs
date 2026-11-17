// Keeps the crawler-visible <head> of every bundled page complete. Idempotent.
//
//   node scripts/site-seo.mjs
//
// Bundled pages show a pre-rendered snapshot and only swap in the live page on
// the first interaction, so search engines and AI crawlers read the outer HTML
// shell. This script makes sure that shell carries:
//   - structured data: the business (with sameAs profiles), founder, website,
//     the page itself and its breadcrumb, FAQ markup built from the FAQ page,
//     and any JSON-LD that previously lived only inside the page template;
//   - concise titles and descriptions (also updated in the template);
//   - the site social image instead of the blog one.
// Business details live in scripts/site-data.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, bundledPages, openTemplate } from './bundle-io.mjs';
import { SITE, ORG, FOUNDER, WEBSITE } from './site-data.mjs';

const OG_SITE = `${SITE}/assets/img/og-site.jpg`;
const OG_OLD = `${SITE}/assets/img/og-blog.png`;

// Breadcrumb label, optional page type, and optional new title/description.
const PAGES = {
  'index.html': { crumb: null },
  'about.html': { crumb: 'About', type: 'AboutPage' },
  'contact.html': { crumb: 'Contact', type: 'ContactPage' },
  'faq.html': { crumb: 'FAQ', type: 'FAQPage' },
  'industries.html': { crumb: 'Industries', title: 'Industries We Serve: Local, D2C & E-commerce — The Graphikk' },
  'legal.html': { crumb: 'Privacy, terms and cookies' },
  'locations.html': { crumb: 'Locations' },
  'portfolio.html': { crumb: 'Portfolio', type: 'CollectionPage', title: 'Portfolio: Website Design Projects — The Graphikk' },
  'portfolio-websites.html': { crumb: 'Portfolio websites', title: 'Portfolio Website Design for Individuals — The Graphikk' },
  'pricing.html': {
    crumb: 'Pricing', title: 'Website Design Pricing in India (INR) — The Graphikk',
    description: 'Fixed website prices in rupees: business websites from ₹40,000, online stores from ₹50,000, landing pages from ₹20,000. What each package includes, add-ons and terms.',
  },
  'process.html': { crumb: 'Process' },
  'web-development-agency-india.html': { crumb: 'Web development agency in India', title: 'Web Development Agency in India | The Graphikk' },
  'blog/website-cost-in-india.html': { crumb: 'How much does a website cost in India?', parent: ['Blog', '/blog'], image: `${SITE}/assets/img/blog/website-cost-in-india.jpg`, type: 'skip' },
};

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function faqFromSnapshot(html) {
  const body = html.slice(html.indexOf('<!-- prerender:body -->'), html.indexOf('<!-- /prerender:body -->'));
  return [...body.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, q, a]) => ({ q: text(q.replace(/<span[\s\S]*?<\/span>/g, '')), a: text(a) }))
    .filter((f) => f.q && f.a);
}

const changed = [];
for (const name of bundledPages()) {
  const cfg = PAGES[name];
  if (!cfg) { console.warn(name + ': no SEO config, skipped'); continue; }
  const file = path.join(ROOT, name);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const headEnd = html.indexOf('</head>');
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);

  const oldTitle = head.match(/<title>([^<]*)<\/title>/)[1];
  const oldDesc = head.match(/<meta name="description" content="([^"]*)"/)[1];
  const url = head.match(/<link rel="canonical" href="([^"]*)"/)[1];
  const title = cfg.title ? escAttr(cfg.title) : oldTitle;
  const desc = cfg.description ? escAttr(cfg.description) : oldDesc;
  const image = cfg.image || OG_SITE;

  // 1. Title, description and image in the shell head.
  head = head.split(oldTitle).join(title).split(oldDesc).join(desc).split(OG_OLD).join(image);

  // 2. The same in the template, so the live page matches after the swap.
  const page = openTemplate(name);
  let tpl = page.template;
  const tplJsonLd = [...tpl.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const nextTpl = tpl.split(oldTitle).join(title).split(oldDesc).join(desc).split(OG_OLD).join(image);
  if (nextTpl !== tpl) page.save(nextTpl);

  // 3. Structured data block.
  head = head.replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
  head = head.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->\n?/, '');
  const graph = [ORG, WEBSITE, FOUNDER].map((n) => ({ ...n }));
  if (cfg.type !== 'skip') {
    const node = {
      '@type': cfg.type || 'WebPage', '@id': `${url}#webpage`, url, name: decode(title), description: decode(desc),
      inLanguage: 'en-IN', isPartOf: { '@id': WEBSITE['@id'] }, about: { '@id': ORG['@id'] },
      primaryImageOfPage: { '@type': 'ImageObject', url: image },
    };
    if (cfg.crumb) node.breadcrumb = { '@id': `${url}#breadcrumb` };
    if (cfg.type === 'FAQPage') {
      const faq = faqFromSnapshot(html);
      if (!faq.length) throw new Error(name + ': no FAQ items found in snapshot');
      node.mainEntity = faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));
    }
    graph.push(node);
  }
  if (cfg.crumb) {
    const items = [['Home', SITE + '/']];
    if (cfg.parent) items.push([cfg.parent[0], SITE + cfg.parent[1]]);
    items.push([cfg.crumb, url]);
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u })) });
  }
  // JSON-LD that only existed inside the template (invisible to crawlers until now).
  for (const ld of tplJsonLd) {
    const nodes = ld['@graph'] || [ld];
    for (const n of nodes) {
      const t = [].concat(n['@type']);
      if (t.some((x) => ['ProfessionalService', 'Organization', 'LocalBusiness', 'WebSite'].includes(x))) continue;
      const { '@context': _, ...clean } = n;
      if (clean['@type'] === 'BreadcrumbList' && cfg.crumb) continue;
      graph.push(clean);
    }
  }
  const block = `<!-- seo:start -->\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/<\//g, '<\\/')}</script>\n<!-- seo:end -->\n`;
  head = head.replace('<!-- prerender:head -->', block + '<!-- prerender:head -->');

  html = head + rest;
  if (html !== before) { fs.writeFileSync(file, html); changed.push(name); }
  console.log(`${name}: ${graph.length} schema nodes${cfg.title ? ', new title' : ''}`);
}
console.log(changed.length ? 'updated: ' + changed.join(' ') : 'no changes');
