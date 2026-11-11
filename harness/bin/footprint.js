#!/usr/bin/env node
// footprint.js: static token footprint of the company setup. Zero dependencies.
//   node footprint.js            print the table (largest first)
// Tokens are estimated as chars / 4 (an approximation, good enough to catch growth).
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const tok = (s) => Math.ceil(s.length / 4);
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const list = (dir, f) => fs.readdirSync(path.join(ROOT, dir)).filter(f).sort();
const fm = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---\n/); return m ? m[1] : ""; };
const desc = (text) => (fm(text).match(/^description:\s*(.*)$/m) || [])[1] || "";
const skillsOf = (text) => [...fm(text).matchAll(/^\s+-\s+(\S+)$/gm)].map((m) => m[1]);

function measure() {
  const agents = list(".claude/agents", (f) => f.endsWith(".md")).map((f) => ({ name: f.replace(/\.md$/, ""), text: read(`.claude/agents/${f}`) }));
  const skills = {};
  for (const d of list(".claude/skills", (d) => fs.existsSync(path.join(ROOT, ".claude/skills", d, "SKILL.md")))) skills[d] = read(`.claude/skills/${d}/SKILL.md`);
  const rules = list(".claude/rules", (f) => f.endsWith(".md")).map((f) => ({ name: f, text: read(`.claude/rules/${f}`) }));
  const always = {
    "agent descriptions": agents.reduce((a, x) => a + tok(desc(x.text)), 0),
    "skill descriptions": Object.values(skills).reduce((a, t) => a + tok(desc(t)), 0),
    rules: rules.reduce((a, r) => a + tok(r.text), 0),
  };
  const spawn = agents.map((a) => ({ name: a.name, tokens: tok(a.text.replace(/^---\n[\s\S]*?\n---\n/, "")) + skillsOf(a.text).reduce((s, k) => s + (skills[k] ? tok(skills[k]) : 0), 0) }));
  return { always, alwaysTotal: Object.values(always).reduce((a, b) => a + b, 0), claudeMd: tok(read("CLAUDE.md")), rules: rules.map((r) => ({ name: r.name, tokens: tok(r.text) })), spawn };
}

module.exports = { measure };

if (require.main === module) {
  const m = measure();
  console.log(`Always loaded in every chat (est. tokens): ${m.alwaysTotal}`);
  for (const [k, v] of Object.entries(m.always)) console.log(`  ${k}: ${v}`);
  for (const r of m.rules) console.log(`    ${r.name}: ${r.tokens}`);
  console.log(`CLAUDE.md (this project only): ${m.claudeMd}`);
  console.log("Per agent spawn (body + its skills):");
  for (const s of m.spawn.sort((a, b) => b.tokens - a.tokens)) console.log(`  ${s.name}: ${s.tokens}`);
}
