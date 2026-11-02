#!/usr/bin/env node
// scorecard.js: aggregates per-job scorecards (AUD-03, AUD-04, SOP-05). Zero dependencies.
//   node scorecard.js <dir> [--json]
// Each scorecard is a Markdown file (docs/scorecards/NNNN-<ad>.md, template: templates/scorecard.md) with lines "- key: value".
// Exit 1 if any file is malformed (missing key or non-numeric number) so bad data never feeds a decision.
"use strict";
const fs = require("fs");
const path = require("path");

const NUM = ["spec_revizyonu", "duzeltme_turu", "bulgu_gercek", "bulgu_gurultu", "bulgu_ertelenen", "regresyon", "kacan_hata", "tahmin_token", "gercek_token", "tahmin_sure_dk", "gercek_sure_dk"];
const REQUIRED = ["is", "tarih", ...NUM];

function parse(text) {
  const kv = {};
  for (const l of text.split("\n")) { const m = l.match(/^- ([a-z_]+):\s*(.*)$/); if (m) kv[m[1]] = m[2].trim(); }
  return kv;
}
function validate(kv) {
  const p = [];
  for (const k of REQUIRED) if (!(k in kv) || kv[k] === "" || /^<.*>$/.test(kv[k])) p.push(`missing ${k}`);
  for (const k of NUM) if (k in kv && kv[k] !== "" && !/^\d+(\.\d+)?$/.test(kv[k])) p.push(`${k} is not a number (${kv[k]})`);
  if (kv.tarih && !/^\d{4}-\d{2}-\d{2}$/.test(kv.tarih)) p.push(`tarih must be YYYY-MM-DD (${kv.tarih})`);
  return p;
}
const ratio = (a, b) => (b > 0 ? a / b : null);
const fmt = (x) => (x === null ? "-" : x.toFixed(2));

function summarize(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort() : [];
  const rows = [], bad = [];
  for (const f of files) {
    const kv = parse(fs.readFileSync(path.join(dir, f), "utf8")); const p = validate(kv);
    if (p.length) { bad.push({ file: f, problems: p }); continue; }
    const n = (k) => Number(kv[k]);
    rows.push({ file: f, is: kv.is, tarih: kv.tarih, duzeltme: n("duzeltme_turu"), revizyon: n("spec_revizyonu"), gercek: n("bulgu_gercek"), gurultu: n("bulgu_gurultu"),
      regresyon: n("regresyon"), kacan: n("kacan_hata"), tokenSapma: ratio(n("gercek_token"), n("tahmin_token")), sureSapma: ratio(n("gercek_sure_dk"), n("tahmin_sure_dk")), durma: kv.durma_nedeni || "yok" });
  }
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const avg = (k) => { const v = rows.map((r) => r[k]).filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const stops = {}; rows.forEach((r) => { if (r.durma !== "yok") stops[r.durma] = (stops[r.durma] || 0) + 1; });
  const noise = sum("gercek") + sum("gurultu") ? sum("gurultu") / (sum("gercek") + sum("gurultu")) : null;
  return { n: rows.length, rows, bad, totals: { gercek: sum("gercek"), gurultu: sum("gurultu"), regresyon: sum("regresyon"), kacan: sum("kacan"), duzeltme: sum("duzeltme") },
    avgTokenSapma: avg("tokenSapma"), avgSureSapma: avg("sureSapma"), noiseRate: noise, stops };
}

module.exports = { parse, validate, summarize };

if (require.main === module) {
  const dir = process.argv[2]; const json = process.argv.includes("--json");
  if (!dir) { console.error("usage: scorecard.js <dir> [--json]"); process.exit(2); }
  const s = summarize(dir);
  if (json) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`Scorecard özeti: ${s.n} iş${s.n < 3 ? " (yetersiz veri: eğilim için en az 3 iş gerekir)" : ""}`);
    if (s.n) {
      console.log("| İş | Tarih | Düzeltme turu | Gerçek bulgu | Gürültü | Regresyon | Kaçan hata | Token sapma | Süre sapma | Durma |");
      console.log("|---|---|---|---|---|---|---|---|---|---|");
      for (const r of s.rows) console.log(`| ${r.is} | ${r.tarih} | ${r.duzeltme} | ${r.gercek} | ${r.gurultu} | ${r.regresyon} | ${r.kacan} | ${fmt(r.tokenSapma)} | ${fmt(r.sureSapma)} | ${r.durma} |`);
      console.log(`\nToplam: gerçek bulgu ${s.totals.gercek}, gürültü ${s.totals.gurultu}, regresyon ${s.totals.regresyon}, kaçan hata ${s.totals.kacan}`);
      console.log(`Ortalama sapma (gerçek/tahmin): token ${fmt(s.avgTokenSapma)}, süre ${fmt(s.avgSureSapma)}; gürültü oranı ${s.noiseRate === null ? "-" : Math.round(s.noiseRate * 100) + "%"}`);
      const st = Object.entries(s.stops).sort((a, b) => b[1] - a[1]); if (st.length) console.log("Durma nedenleri: " + st.map(([k, v]) => `${k} ×${v}`).join(", "));
    }
    for (const b of s.bad) console.log(`BOZUK  ${b.file}: ${b.problems.join("; ")}`);
  }
  process.exit(s.bad.length ? 1 : 0);
}
