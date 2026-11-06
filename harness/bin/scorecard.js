#!/usr/bin/env node
// scorecard.js: aggregates per-job scorecards (AUD-03, AUD-04, SOP-05). Zero dependencies.
//   node scorecard.js <dir> [--json]
// Each scorecard is a Markdown file (docs/scorecards/NNNN-<name>.md, template: templates/scorecard.md) with lines "- key: value".
// Exit 1 if any file is malformed (missing key or non-numeric number) so bad data never feeds a decision.
"use strict";
const fs = require("fs");
const path = require("path");

const NUM = ["spec_revisions", "fix_rounds", "findings_real", "findings_noise", "findings_deferred", "regressions", "escaped_defects", "estimate_tokens", "actual_tokens", "estimate_minutes", "actual_minutes"];
const REQUIRED = ["job", "date", ...NUM];

function parse(text) {
  const kv = {};
  for (const l of text.split("\n")) { const m = l.match(/^- ([a-z_]+):\s*(.*)$/); if (m) kv[m[1]] = m[2].trim(); }
  return kv;
}
function validate(kv) {
  const p = [];
  for (const k of REQUIRED) if (!(k in kv) || kv[k] === "" || /^<.*>$/.test(kv[k])) p.push(`missing ${k}`);
  for (const k of NUM) if (k in kv && kv[k] !== "" && !/^\d+(\.\d+)?$/.test(kv[k])) p.push(`${k} is not a number (${kv[k]})`);
  if (kv.date && !/^\d{4}-\d{2}-\d{2}$/.test(kv.date)) p.push(`date must be YYYY-MM-DD (${kv.date})`);
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
    rows.push({ file: f, job: kv.job, date: kv.date, fixRounds: n("fix_rounds"), revisions: n("spec_revisions"), real: n("findings_real"), noise: n("findings_noise"),
      regressions: n("regressions"), escaped: n("escaped_defects"), tokenRatio: ratio(n("actual_tokens"), n("estimate_tokens")), timeRatio: ratio(n("actual_minutes"), n("estimate_minutes")), stop: kv.stop_reason || "none" });
  }
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const avg = (k) => { const v = rows.map((r) => r[k]).filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const stops = {}; rows.forEach((r) => { if (r.stop !== "none") stops[r.stop] = (stops[r.stop] || 0) + 1; });
  const noise = sum("real") + sum("noise") ? sum("noise") / (sum("real") + sum("noise")) : null;
  return { n: rows.length, rows, bad, totals: { real: sum("real"), noise: sum("noise"), regressions: sum("regressions"), escaped: sum("escaped"), fixRounds: sum("fixRounds") },
    avgTokenRatio: avg("tokenRatio"), avgTimeRatio: avg("timeRatio"), noiseRate: noise, stops };
}

module.exports = { parse, validate, summarize };

if (require.main === module) {
  const dir = process.argv[2]; const json = process.argv.includes("--json");
  if (!dir) { console.error("usage: scorecard.js <dir> [--json]"); process.exit(2); }
  const s = summarize(dir);
  if (json) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`Scorecard summary: ${s.n} jobs${s.n < 3 ? " (insufficient data: at least 3 jobs are needed for a trend)" : ""}`);
    if (s.n) {
      console.log("| Job | Date | Fix rounds | Real findings | Noise | Regressions | Escaped defects | Token ratio | Time ratio | Stop |");
      console.log("|---|---|---|---|---|---|---|---|---|---|");
      for (const r of s.rows) console.log(`| ${r.job} | ${r.date} | ${r.fixRounds} | ${r.real} | ${r.noise} | ${r.regressions} | ${r.escaped} | ${fmt(r.tokenRatio)} | ${fmt(r.timeRatio)} | ${r.stop} |`);
      console.log(`\nTotals: real findings ${s.totals.real}, noise ${s.totals.noise}, regressions ${s.totals.regressions}, escaped defects ${s.totals.escaped}`);
      console.log(`Average ratio (actual/estimate): token ${fmt(s.avgTokenRatio)}, time ${fmt(s.avgTimeRatio)}; noise rate ${s.noiseRate === null ? "-" : Math.round(s.noiseRate * 100) + "%"}`);
      const st = Object.entries(s.stops).sort((a, b) => b[1] - a[1]); if (st.length) console.log("Stop reasons: " + st.map(([k, v]) => `${k} ×${v}`).join(", "));
    }
    for (const b of s.bad) console.log(`MALFORMED  ${b.file}: ${b.problems.join("; ")}`);
  }
  process.exit(s.bad.length ? 1 : 0);
}
