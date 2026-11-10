// Moves each bundled page's inline bundle data into assets/bundles/ so the HTML
// only carries the pre-rendered snapshot plus a small loader. Idempotent: pages
// that are already split are skipped.
//
//   node scripts/split-bundles.mjs
//
// Why: the home page shipped ~1 MB of manifest + template JSON in the HTML. The
// browser had to download all of it before the page counted as painted, and the
// bundle runtime could only start once it had arrived. Now the snapshot paints
// from a ~70 KB document while the data downloads in parallel.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BUNDLE_DIR, KINDS, INLINE, bundleKey, bundledPages } from './bundle-io.mjs';

const OPEN = "document.addEventListener('DOMContentLoaded', async function() {";

function bootstrap(key) {
  // The pre-rendered snapshot is the page people see first. The bundle data is
  // fetched straight away, but the live page is only swapped in on the first
  // interaction (scroll, pointer, key): Google stops measuring LCP at the first
  // input, so the swap's repaint no longer counts as a late LCP. `?live` swaps
  // at once (used by scripts/prerender-pages.mjs).
  return `<script>
(function () {
  var kinds = ${JSON.stringify(KINDS)}, data = null;
  // Download the data after the snapshot's images (load event) so it doesn't
  // compete with them for bandwidth, or sooner if the visitor interacts first.
  function getData() {
    return data || (data = Promise.all(kinds.map(function (k) {
      return fetch('/${BUNDLE_DIR}/${key}.' + k + '.json').then(function (r) {
        if (!r.ok) throw new Error(k + ': HTTP ' + r.status);
        return r.text();
      });
    })));
  }
  if (document.readyState === 'complete') getData(); else addEventListener('load', function () { getData(); });
  // Only inputs that also end LCP measurement (mouse move does not).
  var started = false, timer = 0, events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'];
  function run() {
    if (started) return;
    started = true;
    events.forEach(function (e) { removeEventListener(e, trigger, true); });
    var y = 0;
    getData().then(function (texts) {
      kinds.forEach(function (k, i) {
        var s = document.createElement('script');
        s.type = '__bundler/' + k;
        s.textContent = texts[i];
        document.body.appendChild(s);
      });
      y = scrollY; // where the visitor is right before the document is replaced
      return window.__bundleRun();
    }).then(function () {
      if (y) { scrollTo(0, y); requestAnimationFrame(function () { scrollTo(0, y); }); }
    }).catch(function (e) { console.error('[bundle] could not load page data; showing static copy', e); });
  }
  // Clicks and keys: swap right after the browser paints the response to the
  // input. Scrolling: wait until it pauses, so the swap doesn't cut it short.
  function trigger(e) {
    if (started) return;
    clearTimeout(timer);
    if (e.type === 'scroll' || e.type === 'wheel' || e.type === 'touchstart') timer = setTimeout(run, 200);
    else requestAnimationFrame(function () { setTimeout(run, 0); });
  }
  if (/[?&]live\\b/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  } else {
    events.forEach(function (e) { addEventListener(e, trigger, { capture: true, passive: true }); });
  }
})();
</script>`;
}
const BOOTSTRAP = /<script>\n\(function \(\) \{\n  var kinds = [\s\S]*?<\/script>/;

fs.mkdirSync(path.join(ROOT, BUNDLE_DIR), { recursive: true });
for (const name of bundledPages()) {
  const file = path.join(ROOT, name);
  let html = fs.readFileSync(file, 'utf8');
  const key = bundleKey(name);
  if (html.includes('window.__bundleRun')) {
    // Already split: just refresh the loader to the current version.
    if (!BOOTSTRAP.test(html)) throw new Error(name + ': loader block not found');
    const next = html.replace(BOOTSTRAP, () => bootstrap(key));
    if (next !== html) fs.writeFileSync(file, next);
    console.log(name + (next !== html ? ': loader refreshed' : ': loader up to date'));
    continue;
  }

  // 1. Pull out each data block verbatim.
  for (const kind of KINDS) {
    const m = html.match(INLINE(kind));
    if (!m) throw new Error(`${name}: no __bundler/${kind} block`);
    fs.writeFileSync(path.join(ROOT, BUNDLE_DIR, `${key}.${kind}.json`), m[2].trim());
    html = html.replace(new RegExp(`[ \\t]*<script type="__bundler/${kind}">[\\s\\S]*?</script>\\n?`), '');
  }

  // 2. Turn the runtime's DOMContentLoaded handler into a callable function.
  const i = html.indexOf(OPEN);
  if (i < 0) throw new Error(`${name}: runtime entry point not found`);
  const end = html.indexOf('</script>', i);
  const close = html.lastIndexOf('});', end);
  if (close < i) throw new Error(`${name}: runtime end not found`);
  html = html.slice(0, i) + 'window.__bundleRun = async function() {' + html.slice(i + OPEN.length, close) + '};' + html.slice(close + 3);

  // 3. Add the loader right after the runtime.
  const after = html.indexOf('</script>', i) + '</script>'.length;
  html = html.slice(0, after) + '\n' + bootstrap(key) + html.slice(after);

  const before = fs.statSync(file).size;
  fs.writeFileSync(file, html);
  console.log(`${name}: ${Math.round(before / 1024)} KB -> ${Math.round(html.length / 1024)} KB`);
}
