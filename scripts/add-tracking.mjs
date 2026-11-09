// Adds Vercel Web Analytics + Speed Insights to every HTML page. Idempotent.
//
// Bundled pages replace their whole document with the JSON template at load,
// so the tags go inside the template's <head>. Plain pages (404, blog posts,
// landing pages) get them before the outer </head>. build-blog.mjs emits the
// same tags for pages it generates, so this only needs re-running after adding
// a new bundled or hand-written page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKING = '<script defer src="/_vercel/insights/script.js"></script><script defer src="/_vercel/speed-insights/script.js"></script>';
const MARK = '/_vercel/insights/script.js';
const TEMPLATE = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;

const files = [
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
];

for (const name of files) {
  const file = path.join(ROOT, name);
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(TEMPLATE);
  let out;
  if (m) {
    const tpl = JSON.parse(m[2]);
    if (tpl.includes(MARK)) { console.log(name + ': already tracked'); continue; }
    if (!tpl.includes('</head>')) throw new Error(name + ': template has no </head>');
    const encoded = JSON.stringify(tpl.replace('</head>', TRACKING + '\n</head>')).replace(/<\//g, '<\\u002F');
    out = text.replace(TEMPLATE, (all, a, b, c) => a + encoded + c);
  } else {
    if (text.includes(MARK)) { console.log(name + ': already tracked'); continue; }
    if (!text.includes('</head>')) throw new Error(name + ': no </head>');
    out = text.replace('</head>', TRACKING + '\n</head>');
  }
  fs.writeFileSync(file, out);
  console.log(name + (m ? ': template' : ': head') + ' updated');
}
