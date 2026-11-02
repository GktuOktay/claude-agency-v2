#!/usr/bin/env node
// eval.js: playbook evaluation sets (SOP-04). Zero dependencies.
//   node eval.js grade <eval-file> <case-no> <output-file>   grade one unit output against one case
//   node eval.js self  <eval-file>                           check the set itself: every case's sample "geçer" passes and sample "kalır" fails
//   node eval.js list  <eval-file>                           print the cases
// A set (evals/<skill>.md) holds cases: "## Vaka N: ad", "Görev: ...", criteria bullets, and two sample outputs.
// Criteria: "- bölüm: X" (a heading/line starting with X) | "- içerir: /re/flags" | "- içermez: /re/flags" | "- en az N: /re/flags".
"use strict";
const fs = require("fs");

const lc = (s) => s.toLocaleLowerCase("tr");
function toRegex(src, forceGlobal) {
  const m = String(src).trim().match(/^\/([\s\S]+)\/([a-z]*)$/);
  if (!m) throw new Error("not a /regex/: " + src);
  let flags = m[2]; if (forceGlobal && !flags.includes("g")) flags += "g";
  return new RegExp(m[1], flags);
}

function parseSet(text) {
  const head = text.match(/^#\s+(.+)$/m);
  const parts = text.split(/^## Vaka (\d+):\s*(.*)$/m);
  const cases = [];
  for (let i = 1; i < parts.length; i += 3) {
    const body = parts[i + 2];
    const task = (body.match(/^Görev:\s*([\s\S]*?)(?=^Geçer:|^```|^- )/m) || [])[1];
    const criteria = [];
    for (const l of body.split("\n")) {
      const m = l.match(/^- (bölüm|içerir|içermez|en az (\d+)):\s*(.+)$/);
      if (m) criteria.push({ kind: m[2] ? "en az" : m[1], n: m[2] ? Number(m[2]) : 0, value: m[3].trim() });
    }
    const sample = (kind) => { const m = body.match(new RegExp("```" + kind + "\\n([\\s\\S]*?)```")); return m ? m[1] : null; };
    cases.push({ no: Number(parts[i]), name: parts[i + 1].trim(), task: (task || "").trim(), criteria, pass: sample("geçer"), fail: sample("kalır") });
  }
  return { title: head ? head[1] : "", cases };
}

function gradeText(text, criteria) {
  return criteria.map((c) => {
    let ok, detail = c.value;
    try {
      if (c.kind === "bölüm") ok = text.split("\n").some((l) => lc(l.replace(/^[#*\s>|`-]+/, "")).startsWith(lc(c.value)));
      else if (c.kind === "içerir") ok = toRegex(c.value).test(text);
      else if (c.kind === "içermez") ok = !toRegex(c.value).test(text);
      else { const n = (text.match(toRegex(c.value, true)) || []).length; ok = n >= c.n; detail += ` (bulunan ${n})`; }
    } catch (e) { ok = false; detail += " [geçersiz ölçüt: " + e.message + "]"; }
    return { ok, label: c.kind === "en az" ? `en az ${c.n}` : c.kind, detail };
  });
}

// Structural validation used by lint.js and `self`: returns a list of problems.
function validate(file) {
  const problems = [];
  const set = parseSet(fs.readFileSync(file, "utf8"));
  if (set.cases.length < 3) problems.push(`needs at least 3 cases (has ${set.cases.length})`);
  for (const c of set.cases) {
    const id = `case ${c.no}`;
    if (!c.task) problems.push(`${id}: Görev missing`);
    if (c.criteria.filter((x) => x.kind !== "içermez").length < 1) problems.push(`${id}: needs a positive criterion (bölüm/içerir/en az)`);
    if (c.criteria.filter((x) => x.kind === "içermez").length < 1) problems.push(`${id}: needs a negative criterion (içermez)`);
    if (c.pass === null || c.fail === null) { problems.push(`${id}: needs both a 'geçer' and a 'kalır' sample`); continue; }
    const p = gradeText(c.pass, c.criteria), f = gradeText(c.fail, c.criteria);
    if (p.some((x) => !x.ok)) problems.push(`${id}: 'geçer' sample fails: ${p.filter((x) => !x.ok).map((x) => x.label + " " + x.detail).join("; ")}`);
    if (f.every((x) => x.ok)) problems.push(`${id}: 'kalır' sample passes (criteria do not discriminate)`);
  }
  return problems;
}

module.exports = { parseSet, gradeText, validate };

if (require.main === module) {
  const [cmd, file, no, out] = process.argv.slice(2);
  if (!cmd || !file) { console.error("usage: eval.js grade <set> <case> <output> | self <set> | list <set>"); process.exit(2); }
  const set = parseSet(fs.readFileSync(file, "utf8"));
  if (cmd === "list") { for (const c of set.cases) console.log(`${c.no}. ${c.name} — ${c.task.split("\n")[0]}`); process.exit(0); }
  if (cmd === "self") { const p = validate(file); p.forEach((x) => console.log("FAIL  " + x)); console.log(p.length ? "EVAL SET INVALID" : `EVAL SET OK (${set.cases.length} cases)`); process.exit(p.length ? 1 : 0); }
  if (cmd === "grade") {
    const c = set.cases.find((x) => x.no === Number(no));
    if (!c || !out) { console.error("case or output file missing"); process.exit(2); }
    const res = gradeText(fs.readFileSync(out, "utf8"), c.criteria);
    res.forEach((r) => console.log((r.ok ? "ok    " : "FAIL  ") + r.label + ": " + r.detail));
    const bad = res.filter((r) => !r.ok).length;
    console.log(bad ? `CASE ${c.no} FAILED (${bad}/${res.length})` : `CASE ${c.no} PASSED (${res.length}/${res.length})`);
    process.exit(bad ? 1 : 0);
  }
  console.error("unknown command " + cmd); process.exit(2);
}
