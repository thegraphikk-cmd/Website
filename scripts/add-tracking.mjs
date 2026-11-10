// Adds Vercel Web Analytics + Speed Insights to every HTML page. Idempotent.
//
// Bundled pages replace their whole document with the template at load, so the
// tags go inside the template's <head> (inline or in assets/bundles/, see
// scripts/bundle-io.mjs). Plain pages (404, blog posts, landing pages) get them
// before the outer </head>. build-blog.mjs emits the same tags for pages it
// generates, so this only needs re-running after adding a new bundled or
// hand-written page.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openTemplate } from './bundle-io.mjs';

const TRACKING = '<script defer src="/_vercel/insights/script.js"></script><script defer src="/_vercel/speed-insights/script.js"></script>';
const MARK = '/_vercel/insights/script.js';

const files = [
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
];

for (const name of files) {
  const page = openTemplate(name);
  if (page) {
    if (page.template.includes(MARK)) { console.log(name + ': already tracked'); continue; }
    if (!page.template.includes('</head>')) throw new Error(name + ': template has no </head>');
    page.save(page.template.replace('</head>', TRACKING + '\n</head>'));
    console.log(name + ': template updated');
    continue;
  }
  const file = path.join(ROOT, name);
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(MARK)) { console.log(name + ': already tracked'); continue; }
  if (!text.includes('</head>')) throw new Error(name + ': no </head>');
  fs.writeFileSync(file, text.replace('</head>', TRACKING + '\n</head>'));
  console.log(name + ': head updated');
}
