// Pre-renders the exported bundle pages so crawlers get real content in the
// initial HTML. For each page, headless Chrome runs the bundle runtime and we
// copy the rendered #dc-root into the page's loading shell. The bundle data
// and runtime stay untouched: on load the runtime still swaps in the live,
// interactive page, so the snapshot is only what shows (and what non-JS
// crawlers read) until then.
//
// Usage: node scripts/prerender-pages.mjs [page.html ...]   (default: all)
// Needs Chrome or Edge; set CHROME_PATH to override the lookup. Safe to rerun:
// the snapshot sits between prerender marker comments and is replaced.
// Rerun it after every re-export of a bundle page.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = 'assets/prerender';
const PAGES = [
  'index.html', 'about.html', 'contact.html', 'faq.html', 'industries.html', 'legal.html',
  'locations.html', 'portfolio.html', 'portfolio-websites.html', 'pricing.html', 'process.html',
  'web-development-agency-india.html', 'blog/website-cost-in-india.html',
];

// Tabbed sections whose non-default tabs should also be in the snapshot.
// Each extra tab's panel is captured and added after the default one as a
// `hidden` copy, so crawlers read every tab without changing the layout.
const TAB_PANELS = {
  'pricing.html': { tabs: 'button[role="tab"]', panel: 'section[data-screen-label="Pricing / Tiers"]' },
  'legal.html': { tabs: 'button[role="tab"]', panel: 'div[data-screen-label="Legal / Policy"]' },
};

const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap">';
// The snapshot is rendered at desktop width. SiteHeader picks its layout in
// JS (innerWidth < 900), so mirror that breakpoint in CSS for phones. The
// image-slot rules copy the element's own shadow-DOM :host styles.
const SNAPSHOT_CSS = [
  '@media (max-width: 899.98px) { #dc-root header nav { display: none !important; } }',
  'image-slot { display: block; position: relative; width: 100%; height: 100%; aspect-ratio: 3/2; overflow: hidden; }',
  'image-slot > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }',
].join('\n');
const HEAD_START = '<!-- prerender:head -->';
const HEAD_END = '<!-- /prerender:head -->';
const BODY_START = '<!-- prerender:body -->';
const BODY_END = '<!-- /prerender:body -->';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome/Edge not found; set CHROME_PATH');
  return found;
}

// Starts headless Chrome and returns a minimal DevTools Protocol client.
export async function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; !fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').includes('\n'); i++) {
    if (i > 100) throw new Error('Chrome did not start');
    await sleep(100);
  }
  const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket('ws://127.0.0.1:' + port + wsPath);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  async function openPage({ width = 1280, height = 900, mobile = false, scripts = true } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    const errors = [];
    listeners.push((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    await s('Runtime.enable');
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    if (!scripts) await s('Emulation.setScriptExecutionDisabled', { value: true });
    const evaluate = async (expression) => {
      const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return {
      errors,
      evaluate,
      navigate: (url) => s('Page.navigate', { url }),
      async waitFor(expression, timeout = 30000) {
        for (const end = Date.now() + timeout; Date.now() < end; await sleep(200)) {
          if (await evaluate(expression).catch(() => false)) return true;
        }
        return false;
      },
      async screenshot(file, fullPage = true) {
        const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  return {
    openPage,
    async close() {
      ws.close();
      proc.kill();
      await sleep(300);
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

// Waits for the runtime to finish, scrolls the page once so anything that
// reveals on scroll has run, and returns the rendered #dc-root (plus extra
// tab panels) and the page's <style> contents.
async function capture(chrome, name) {
  const page = await chrome.openPage();
  try {
    await page.navigate(pathToFileURL(path.join(ROOT, name)).href);
    const ready = await page.waitFor(`!!document.querySelector('#dc-root .sc-host') && !document.querySelector('.sc-placeholder') && document.fonts.status === 'loaded'`);
    if (!ready) throw new Error(name + ': page did not finish rendering');
    await page.evaluate(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await wait(120); }
      scrollTo(0, 0);
      await wait(2500);
    })()`);
    const tabs = TAB_PANELS[name];
    return await page.evaluate(`(async () => {
      const cfg = ${JSON.stringify(tabs || null)};
      const snap = document.querySelector('#dc-root').cloneNode(true);
      // <image-slot> draws its picture in shadow DOM, which doesn't survive
      // serialisation; give each one a plain <img> child instead.
      snap.querySelectorAll('image-slot[src]').forEach((slot, i) => {
        const img = document.createElement('img');
        img.src = slot.getAttribute('src');
        img.alt = slot.getAttribute('alt') || '';
        if (i > 0) img.loading = 'lazy';
        slot.appendChild(img);
      });
      if (cfg) {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const buttons = [...document.querySelectorAll(cfg.tabs)];
        const label = (b) => b.textContent.trim();
        let anchor = snap.querySelector(cfg.panel);
        if (!anchor || buttons.length < 2) throw new Error('tab panels not found');
        anchor.setAttribute('data-prerender-tab', label(buttons[0]));
        for (const b of buttons.slice(1)) {
          b.click();
          await wait(300);
          const p = document.querySelector(cfg.panel).cloneNode(true);
          // Keep one H1 per page: hidden tab copies get theirs as an H2.
          p.querySelectorAll('h1').forEach((h) => {
            const h2 = document.createElement('h2');
            for (const a of h.attributes) h2.setAttribute(a.name, a.value);
            h2.innerHTML = h.innerHTML;
            h.replaceWith(h2);
          });
          p.setAttribute('hidden', '');
          p.setAttribute('data-prerender-tab', label(b));
          anchor.after(p);
          anchor = p;
        }
        buttons[0].click();
      }
      return {
        root: snap.outerHTML,
        styles: [...document.head.querySelectorAll('style')].map((s) => s.textContent),
      };
    })()`);
  } finally {
    await page.close();
  }
}

// Moves inline data: images out of the snapshot into files under IMG_DIR so
// the snapshot doesn't duplicate the bundle's (often multi-MB) image data.
function extractImages(html) {
  return html.replace(/data:image\/(png|jpe?g|webp|gif|svg\+xml|avif);base64,([A-Za-z0-9+/=]+)/g, (m, type, b64) => {
    const buf = Buffer.from(b64, 'base64');
    const ext = { 'svg+xml': 'svg', jpeg: 'jpg' }[type] || type;
    const file = IMG_DIR + '/' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '.' + ext;
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, buf);
    }
    return '/' + file;
  });
}

// Returns [start, end] of the region to replace: the marked snapshot from a
// previous run, or else the original shell markup matched by `firstRun`.
function region(html, start, end, firstRun) {
  const i = html.indexOf(start);
  if (i >= 0) {
    const j = html.indexOf(end, i);
    return [i, j + end.length + (html[j + end.length] === '\n' ? 1 : 0)];
  }
  const m = firstRun.exec(html);
  return m ? [m.index, m.index + m[0].length] : null;
}

function splice(html, [i, j], text) {
  return html.slice(0, i) + text + html.slice(j);
}

async function prerender(chrome, name) {
  const file = path.join(ROOT, name);
  const shell = fs.readFileSync(file, 'utf8');
  const { root, styles } = await capture(chrome, name);

  const body = extractImages(root
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\s+data-dc-tpl="[^"]*"/g, ''));
  if (body.includes('blob:')) console.warn(name + ': snapshot still references blob: URLs');

  // Drop the @font-face blocks (they inline every font as a data: URI; the
  // snapshot loads Google Fonts instead).
  const css = extractImages(styles
    .map((s) => s.replace(/(\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}/g, '').trim())
    .filter(Boolean)
    .join('\n'));

  // First run replaces the shell's loader styles + noscript (head) and the
  // thumbnail + "Unpacking..." badge (body).
  const headAt = region(shell, HEAD_START, HEAD_END, /[ \t]*<style>[\s\S]*?<\/style>\s*<noscript>[\s\S]*?<\/noscript>\n?/);
  const bodyAt = region(shell, BODY_START, BODY_END, /[ \t]*<div id="__bundler_thumbnail">[\s\S]*?<\/div>\s*<div id="__bundler_loading">[\s\S]*?<\/div>\n?/);
  if (!headAt || !bodyAt || bodyAt[0] < headAt[1]) throw new Error(name + ': unexpected shell markup');

  const headHtml = [HEAD_START, FONT_LINK, '<style>', css, SNAPSHOT_CSS, '</style>', HEAD_END, ''].join('\n');
  const bodyHtml = [BODY_START, body, BODY_END, ''].join('\n');
  fs.writeFileSync(file, splice(splice(shell, bodyAt, bodyHtml), headAt, headHtml));
  console.log(name + ': ' + Math.round(body.length / 1024) + ' KB of rendered HTML');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const names = process.argv.slice(2);
  const chrome = await launchChrome();
  try {
    for (const name of names.length ? names : PAGES) await prerender(chrome, name);
  } finally {
    await chrome.close();
  }
}
