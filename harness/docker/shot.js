#!/usr/bin/env node
// shot.js: visual verification inside the agent container.
// Usage: node shot.js <html-file-or-dir> <out-dir> [--no-sandbox]
// Serves the page on 127.0.0.1 (no outside network), takes screenshots at 375 and 1280 px in light and
// dark themes, runs axe, prints one JSON summary line. Screenshots stay in <out-dir> (never committed).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { AxeBuilder } = require("@axe-core/playwright");

const [target, outDir, ...flags] = process.argv.slice(2);
if (!target || !outDir) { console.error("usage: shot.js <html-file-or-dir> <out-dir> [--no-sandbox]"); process.exit(2); }

const abs = path.resolve(target);
const root = fs.statSync(abs).isDirectory() ? abs : path.dirname(abs);
const realRoot = fs.realpathSync(root);
const entry = fs.statSync(abs).isDirectory() ? "index.html" : path.basename(abs);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || entry;
  fs.realpath(path.resolve(root, rel), (er, file) => {
    // realpath first: a symlink inside the page dir must not lead out of it
    if (er) { res.writeHead(404).end(); return; }
    if (!file.startsWith(realRoot + path.sep) && file !== realRoot) { res.writeHead(403).end(); return; }
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(buf);
    });
  });
});

// S-03: hard overall limit; the host script also enforces a wall-clock limit.
setTimeout(() => { console.error("shot.js failed: overall timeout"); process.exit(1); }, Number(process.env.SHOT_TIMEOUT_MS || 120000)).unref();

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/${entry}`;
  // Playwright disables the Chromium sandbox unless told otherwise; be explicit so the result is honest.
  const sandbox = !flags.includes("--no-sandbox");
  const browser = await chromium.launch({ chromiumSandbox: sandbox, env: { PATH: process.env.PATH, HOME: process.env.HOME || "/tmp", PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } });
  const summary = { url: "local", shots: [], axe: {}, sandbox, badResponses: [] };
  for (const scheme of ["light", "dark"]) {
    for (const width of [375, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on("response", (r) => { if (r.status() >= 400) { const k = `${r.status()} ${new URL(r.url()).pathname}`; if (!summary.badResponses.includes(k)) summary.badResponses.push(k); } });
      await page.goto(url, { waitUntil: "load" });
      const file = path.join(outDir, `${scheme}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      summary.shots.push({ scheme, width, bytes: fs.statSync(file).size, horizontalScroll: overflow });
      if (width === 375) {
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
        summary.axe[scheme] = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  console.log(JSON.stringify(summary));
})().catch((e) => { console.error("shot.js failed: " + String(e.message || e).split("\n")[0]); server.close(); process.exit(1); });
