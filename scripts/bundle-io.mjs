// Read and write the page template of a bundled page, wherever it lives.
//
// Bundled pages used to carry their data inline in <script type="__bundler/...">
// tags (~1 MB on the home page). scripts/split-bundles.mjs moves that data to
// assets/bundles/<key>.<kind>.json so the HTML stays small and paints at once.
// Build scripts that edit the template use this module so they work either way.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUNDLE_DIR = 'assets/bundles';
export const KINDS = ['manifest', 'ext_resources', 'page_order', 'template'];
const INLINE = (kind) => new RegExp(`(<script type="__bundler/${kind}">\\s*)([\\s\\S]*?)(\\s*</script>)`);

// "blog/website-cost-in-india.html" -> "blog-website-cost-in-india"
export const bundleKey = (name) => name.replace(/\.html$/, '').replace(/[\\/]/g, '-');
export const bundleFile = (name, kind) => path.join(ROOT, BUNDLE_DIR, `${bundleKey(name)}.${kind}.json`);
export const encodeTemplate = (tpl) => JSON.stringify(tpl).replace(/<\//g, '<\\u002F');

// Returns { template, save(newTemplate) } or null if the page is not a bundle.
export function openTemplate(name) {
  const file = path.join(ROOT, name);
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(INLINE('template'));
  if (m) {
    return {
      template: JSON.parse(m[2]),
      save: (tpl) => fs.writeFileSync(file, html.replace(INLINE('template'), (all, a, b, c) => a + encodeTemplate(tpl) + c)),
    };
  }
  const ext = bundleFile(name, 'template');
  if (!html.includes('window.__bundleRun') || !fs.existsSync(ext)) return null;
  return {
    template: JSON.parse(fs.readFileSync(ext, 'utf8')),
    save: (tpl) => fs.writeFileSync(ext, encodeTemplate(tpl)),
  };
}

// Every bundled page in the site (inline or split).
export function bundledPages() {
  const names = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    ...fs.readdirSync(path.join(ROOT, 'blog')).filter((f) => f.endsWith('.html')).map((f) => 'blog/' + f),
  ];
  return names.filter((n) => {
    const html = fs.readFileSync(path.join(ROOT, n), 'utf8');
    return INLINE('template').test(html) || html.includes('window.__bundleRun');
  });
}

export { INLINE };
