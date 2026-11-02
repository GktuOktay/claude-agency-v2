#!/usr/bin/env node
// lint.js: validates the company's agents and playbooks (SOP-01, SOP-02, SOP-09) and the container settings.
// Zero dependencies. Exit 1 on any failure.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const REQUIRED_SECTIONS = ["Amaç", "Girdiler", "Yöntem", "Çıktı şablonu", "Kontrol listesi", "Yasaklar", "Araçlar ve izinler", "Durma ve yükseltme", "Örnekler"];
let failures = 0, checks = 0;
const fail = (m) => { failures++; console.log("FAIL  " + m); };
const ok = (m) => { checks++; console.log("ok    " + m); };

function frontmatter(file) {
  const t = fs.readFileSync(file, "utf8");
  const m = t.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {}; let listKey = null;
  for (const line of m[1].split("\n")) {
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && listKey) { fm[listKey].push(li[1].trim()); continue; }
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2] === "") { fm[kv[1]] = []; listKey = kv[1]; } else { fm[kv[1]] = kv[2]; listKey = null; }
  }
  return { fm, body: t.slice(m[0].length) };
}

const skillsDir = path.join(ROOT, ".claude", "skills");
const agentsDir = path.join(ROOT, ".claude", "agents");
const skillNames = new Set();

for (const d of fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir) : []) {
  const f = path.join(skillsDir, d, "SKILL.md");
  if (!fs.existsSync(f)) { fail(`skills/${d}: SKILL.md missing`); continue; }
  const p = frontmatter(f);
  if (!p) { fail(`skills/${d}: frontmatter missing`); continue; }
  if (p.fm.name !== d) fail(`skills/${d}: name '${p.fm.name}' must equal the folder name`);
  if (!p.fm.description || p.fm.description.length < 30) fail(`skills/${d}: description missing or too short`);
  const headings = [...p.body.matchAll(/^##\s+(.+)$/gm)].map((x) => x[1].trim());
  const missing = REQUIRED_SECTIONS.filter((s) => !headings.includes(s));
  const order = REQUIRED_SECTIONS.map((s) => headings.indexOf(s));
  const sorted = order.every((v, i) => i === 0 || v > order[i - 1]);
  if (missing.length) fail(`skills/${d}: missing sections: ${missing.join(", ")}`);
  else if (!sorted) fail(`skills/${d}: sections are not in the standard order`);
  else ok(`skills/${d}: standard playbook format`);
  if (!/- \[ \]/.test(p.body)) fail(`skills/${d}: checklist has no items`);
  skillNames.add(d);
}

for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md")) : []) {
  const p = frontmatter(path.join(agentsDir, f));
  const label = `agents/${f}`;
  if (!p) { fail(`${label}: frontmatter missing`); continue; }
  const { fm } = p;
  let bad = false;
  if (fm.name !== f.replace(/\.md$/, "")) { fail(`${label}: name must equal the file name`); bad = true; }
  if (!fm.description || fm.description.length < 40) { fail(`${label}: description missing or too short`); bad = true; }
  if (!fm.tools) { fail(`${label}: tools allowlist is required (no implicit inheritance)`); bad = true; }
  if (!fm.model) { fail(`${label}: model is required`); bad = true; }
  if (!fm.maxTurns) { fail(`${label}: maxTurns is required (quota guard)`); bad = true; }
  const tools = (fm.tools || "").split(",").map((s) => s.trim());
  if (tools.includes("Agent")) { fail(`${label}: Agent tool not allowed in v0 (flat delegation through the chief of staff)`); bad = true; }
  for (const s of fm.skills || []) if (!skillNames.has(s)) { fail(`${label}: skill '${s}' does not exist`); bad = true; }
  if (!(fm.skills || []).length) { fail(`${label}: every unit needs a playbook skill (SOP-01)`); bad = true; }
  // independence rules (AUD-01): reviewers/critics must have no write tools
  if (["internal-auditor", "spec-critic"].includes(fm.name)) {
    const write = tools.filter((t) => ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(t));
    if (write.length) { fail(`${label}: independent unit must not have write tools (${write.join(",")})`); bad = true; }
  }
  if (!bad) ok(`${label}: valid`);
}

try {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, "harness", "container-settings.json"), "utf8"));
  const deny = (s.permissions && s.permissions.deny) || [];
  const must = ["Bash(rm *)", "Bash(git push *)", "Bash(curl *)", "Read(~/.company/**)", "Write(approvals/**)", "Edit(approvals/**)"];
  const lacking = must.filter((m) => !deny.includes(m));
  if (lacking.length) fail("container-settings.json: deny rules missing: " + lacking.join(", "));
  else ok("container-settings.json: required deny rules present");
  const hook = JSON.stringify(s.hooks || {});
  if (!/gate\.js/.test(hook)) fail("container-settings.json: gate hook missing");
  else ok("container-settings.json: gate hook present");
} catch (e) { fail("container-settings.json: " + e.message); }

if (fs.existsSync(path.join(ROOT, "harness", "keys"))) {
  const bad = fs.readdirSync(path.join(ROOT, "harness", "keys")).filter((x) => !x.endsWith(".pub.pem") && x !== ".gitkeep");
  if (bad.length) fail("harness/keys contains non-public files: " + bad.join(", "));
  else ok("harness/keys: only public keys");
}

// --- web tools only where research is the job (prompt-injection surface stays small)
const WEB_OK = new Set(["product-manager", "scout"]);
for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md")) : []) {
  const p = frontmatter(path.join(agentsDir, f));
  if (!p) continue;
  const tools = (p.fm.tools || "").split(",").map((s) => s.trim());
  const web = tools.filter((t) => t === "WebFetch" || t === "WebSearch");
  if (web.length && !WEB_OK.has(p.fm.name)) fail(`agents/${f}: web tools (${web.join(",")}) only for ${[...WEB_OK].join(", ")}`);
}
ok("web tools limited to research units");

// --- host guard wired into project settings (envelope on the host)
try {
  const hs = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const pre = JSON.stringify((hs.hooks && hs.hooks.PreToolUse) || []);
  if (!/guard\.js/.test(pre)) fail(".claude/settings.json: guard hook (harness/guard.js) is not wired for Bash");
  else ok(".claude/settings.json: envelope guard wired for Bash");
} catch (e) { fail(".claude/settings.json: " + e.message); }

// --- visual standards (SOP: visual-standards)
const specT = path.join(ROOT, "templates", "spec-tam.md");
if (fs.existsSync(specT)) {
  const n = (fs.readFileSync(specT, "utf8").match(/```mermaid/g) || []).length;
  if (n < 4) fail(`templates/spec-tam.md: expected at least 4 mermaid diagram slots (UX flow, architecture, data, deployment), found ${n}`);
  else ok(`templates/spec-tam.md: ${n} diagram slots`);
}
const siteDir = path.join(ROOT, "site");
const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com"];
for (const f of fs.existsSync(siteDir) ? fs.readdirSync(siteDir).filter((x) => x.endsWith(".html")) : []) {
  const t = fs.readFileSync(path.join(siteDir, f), "utf8"), L = `site/${f}`;
  const problems = [];
  if (!/<meta\s+name="viewport"/.test(t)) problems.push("viewport meta missing");
  if (!/prefers-color-scheme:\s*dark/.test(t)) problems.push("no dark theme");
  if (!/<title>[^<]{3,}<\/title>/.test(t)) problems.push("title missing");
  for (const m of t.matchAll(/<svg\b([^>]*)>/g)) {
    const a = m[1];
    if (/aria-hidden="true"/.test(a)) continue;
    if (!/role="img"/.test(a)) problems.push("svg without role=img: " + a.slice(0, 50).trim());
    else if (!/aria-label="[^"]+"/.test(a) && !/<title>/.test(t.slice(m.index, m.index + 400))) problems.push("svg role=img without a label");
  }
  for (const m of t.matchAll(/<img\b([^>]*)>/g)) if (!/\balt=/.test(m[1])) problems.push("img without alt");
  for (const m of t.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
    let h = ""; try { h = new URL(m[1]).hostname; } catch {}
    if (h && !ALLOWED_HOSTS.includes(h)) problems.push("external host not allowed: " + h);
  }
  if (problems.length) fail(`${L}: ${[...new Set(problems)].join("; ")}`); else ok(`${L}: visual standards (viewport, dark theme, labelled svgs, hosts)`);
}
// graph output stays out of git
const gi = fs.existsSync(path.join(ROOT, ".gitignore")) ? fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8") : "";
if (!/graphify-out/.test(gi)) fail(".gitignore: graphify-out/ must be ignored (derived output)"); else ok(".gitignore: graphify-out/ ignored");

console.log(`\nLINT ${failures ? "FAILED" : "GREEN"}: ${checks} ok, ${failures} failed`);
process.exit(failures ? 1 : 0);
