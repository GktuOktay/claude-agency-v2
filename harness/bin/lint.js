#!/usr/bin/env node
// lint.js: validates the company's agents and playbooks (SOP-01, SOP-02, SOP-09) and the container settings.
// Zero dependencies. Exit 1 on any failure.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = process.env.COMPANY_LINT_ROOT ? path.resolve(process.env.COMPANY_LINT_ROOT) : path.resolve(__dirname, "..", "..");
// A redirected lint says so on its first line (spec 0004, AC-6); harness/bin/check unsets the variable before it runs lint.
if (process.env.COMPANY_LINT_ROOT) console.log("LINT ROOT OVERRIDDEN: " + ROOT);
const REQUIRED_SECTIONS = ["Purpose", "Inputs", "Method", "Output template", "Checklist", "Prohibitions", "Tools and permissions", "Stop and escalate", "Examples"];
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
  if (["internal-auditor", "spec-critic", "appsec"].includes(fm.name)) {
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
for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md")) : []) {
  const p = frontmatter(path.join(agentsDir, f));
  if (!p) continue;
  const tools = (p.fm.tools || "").split(",").map((s) => s.trim());
  if (tools.some((t) => t === "WebFetch" || t === "WebSearch") && tools.includes("Bash")) fail(`agents/${f}: web tools and Bash together (web content could become commands)`);
}
ok("web tools limited to research units, never combined with Bash");

// --- host guard wired into project settings (envelope on the host)
try {
  const hs = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const pre = JSON.stringify((hs.hooks && hs.hooks.PreToolUse) || []);
  if (!/guard\.js/.test(pre)) fail(".claude/settings.json: guard hook (harness/guard.js) is not wired for Bash");
  else ok(".claude/settings.json: envelope guard wired for Bash");
  const stop = JSON.stringify((hs.hooks && hs.hooks.Stop) || []);
  if (!/stop\.js/.test(stop)) fail(".claude/settings.json: Stop hook (harness/stop.js) is not wired");
  else ok(".claude/settings.json: evidence (Stop) hook wired");
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
  if (!/<html[^>]*\blang=|documentElement\.lang\s*=/.test(t)) problems.push("page language not set (html lang)");
  for (const m of t.matchAll(/<svg\b([^>]*)>/g)) {
    const a = m[1];
    if (/aria-hidden="true"/.test(a)) continue;
    if (/role="group"/.test(a) && /aria-label="[^"]+"/.test(a)) continue; // interactive graphic with focusable, labelled children
    if (!/role="img"/.test(a)) problems.push("svg without role=img: " + a.slice(0, 50).trim());
    else if (!/aria-label="[^"]+"/.test(a) && !/<title>/.test(t.slice(m.index, m.index + 400))) problems.push("svg role=img without a label");
  }
  for (const m of t.matchAll(/<img\b([^>]*)>/g)) if (!/\balt=/.test(m[1])) problems.push("img without alt");
  // Loaded resources only (src=, and href= on <link>); plain navigation links (<a href>) load nothing (CEO 2026-11-15).
  const loaded = [...t.matchAll(/\bsrc="(https?:\/\/[^"]+)"/g), ...t.matchAll(/<link\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)];
  for (const m of loaded) {
    let h = ""; try { h = new URL(m[1]).hostname; } catch {}
    if (h && !ALLOWED_HOSTS.includes(h)) problems.push("external host not allowed: " + h);
  }
  if (problems.length) fail(`${L}: ${[...new Set(problems)].join("; ")}`); else ok(`${L}: visual standards (viewport, dark theme, labelled svgs, hosts)`);
}
// agent image: pinned versions, no floating tags (supply chain)
try {
  const df = fs.readFileSync(path.join(ROOT, "harness", "docker", "Dockerfile"), "utf8");
  const bad = [];
  if (!/ARG CLAUDE_CODE_VERSION=\d+\.\d+\.\d+/.test(df)) bad.push("Claude Code version not pinned");
  if (!/ARG GRAPHIFY_VERSION=\d+\.\d+\.\d+/.test(df)) bad.push("graphify version not pinned");
  if (/playwright/i.test(df) && !/ARG PLAYWRIGHT_VERSION=\d+\.\d+\.\d+/.test(df)) bad.push("Playwright version not pinned");
  if (/axe-core/i.test(df) && !/ARG AXE_PLAYWRIGHT_VERSION=\d+\.\d+\.\d+/.test(df)) bad.push("axe version not pinned");
  for (const m of df.matchAll(/^FROM\s+(\S+)/gm)) if (/:latest$|^[^:\s]+$/.test(m[1]) && !/^\w+$/.test(m[1])) bad.push("floating base image: " + m[1]);
  if (/\bsudo\b|--privileged/.test(df)) bad.push("privilege escalation in Dockerfile");
  if (bad.length) fail("harness/docker/Dockerfile: " + bad.join("; ")); else ok("harness/docker/Dockerfile: pinned versions, no floating tags");
} catch (e) { fail("harness/docker/Dockerfile: " + e.message); }

// container hardening flags: nothing weakens the agent container (AppSec review 2026-11-02)
{
  const binDir = path.join(ROOT, "harness", "bin"); const bad = [];
  for (const f of fs.readdirSync(binDir).filter((x) => x.endsWith(".sh"))) {
    const s = fs.readFileSync(path.join(binDir, f), "utf8").split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    if (/seccomp=unconfined|--privileged|--cap-add|--ipc=host|docker\.sock/.test(s)) bad.push(`${f}: weakening flag or docker socket`);
    if (/--no-sandbox/.test(s) && f !== "visual-check.sh") bad.push(`${f}: --no-sandbox only allowed in visual-check.sh`);
  }
  const vc = fs.existsSync(path.join(binDir, "visual-check.sh")) ? fs.readFileSync(path.join(binDir, "visual-check.sh"), "utf8") : "";
  if (vc && !(/--network none/.test(vc) && /:ro/.test(vc) && !/--env-file|HTTPS?_PROXY/.test(vc.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")))) bad.push("visual-check.sh: must run with --network none, read-only page dir, no env-file and no proxy");
  if (bad.length) fail("container flags: " + bad.join("; ")); else ok("container flags: no weakening flags, --no-sandbox only in the isolated visual container");
}

// CI workflows: pinned actions, minimal permissions, no dangerous triggers (supply chain)
{
  const wfDir = path.join(ROOT, ".github", "workflows"); const bad = [];
  for (const f of fs.existsSync(wfDir) ? fs.readdirSync(wfDir).filter((x) => /\.ya?ml$/.test(x)) : []) {
    const s = fs.readFileSync(path.join(wfDir, f), "utf8");
    const code = s.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    for (const m of code.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) if (!/^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}$/.test(m[1]) && !m[1].startsWith("./")) bad.push(`${f}: action not pinned to a commit SHA: ${m[1]}`);
    if (!/^permissions:/m.test(code)) bad.push(`${f}: top-level permissions block missing`);
    if (/permissions:[\s\S]{0,80}(write-all|contents:\s*write)/.test(code)) bad.push(`${f}: write permissions (CI must not publish or push)`);
    if (/pull_request_target/.test(code)) bad.push(`${f}: pull_request_target is forbidden`);
    if (/\$\{\{\s*github\.event\.(issue|pull_request|comment|head_commit)[^}]*\}\}/.test(code) && /run:/.test(code)) bad.push(`${f}: untrusted event text interpolated into a script`);
    if (/secrets\./.test(code)) bad.push(`${f}: CI check must not use secrets`);
  }
  if (!fs.existsSync(path.join(wfDir, "check.yml"))) bad.push("check.yml workflow missing");
  if (bad.length) fail("CI workflows: " + bad.join("; ")); else ok("CI workflows: actions pinned to SHAs, read-only permissions, no secrets, no dangerous triggers");
}

// playbook evaluation sets (SOP-04): every unit playbook has a set of >=3 cases that checks itself
{
  const evalMod = require("./eval.js"); const bad = [];
  const unitSkills = new Set();
  for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md")) : []) {
    const p = frontmatter(path.join(agentsDir, f)); if (p && (p.fm.skills || [])[0]) unitSkills.add(p.fm.skills[0]);
  }
  for (const s of unitSkills) {
    const file = path.join(ROOT, "evals", s + ".md");
    if (!fs.existsSync(file)) { bad.push(`evals/${s}.md missing`); continue; }
    for (const pr of evalMod.validate(file)) bad.push(`evals/${s}.md: ${pr}`);
  }
  if (bad.length) fail("evaluation sets: " + bad.join("; ")); else ok(`evaluation sets: ${unitSkills.size} unit playbooks, each with >=3 self-checking cases`);
}

// notification and enforcement-file hooks, and the templates the processes rely on
try {
  const hs = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const notif = JSON.stringify((hs.hooks && hs.hooks.Notification) || []);
  if (!/notify\.js/.test(notif)) fail(".claude/settings.json: Notification hook (harness/notify.js) is not wired"); else ok(".claude/settings.json: CEO notification hook wired");
  const pre = (hs.hooks && hs.hooks.PreToolUse) || [];
  if (!/loop\.js/.test(JSON.stringify(pre))) fail(".claude/settings.json: loop guard (harness/loop.js) is not wired"); else ok(".claude/settings.json: loop guard wired (all tools)");
  const cs = JSON.parse(fs.readFileSync(path.join(ROOT, "harness", "container-settings.json"), "utf8"));
  if (!/loop\.js/.test(JSON.stringify((cs.hooks && cs.hooks.PreToolUse) || []))) fail("container-settings.json: loop guard (loop.js) is not wired"); else ok("container-settings.json: loop guard wired");
  const fileGuard = pre.some((h) => /Write/.test(h.matcher || "") && /Edit/.test(h.matcher || "") && /guard\.js/.test(JSON.stringify(h.hooks || [])));
  if (!fileGuard) fail(".claude/settings.json: enforcement files are not protected (guard.js must also be wired for Write|Edit)"); else ok(".claude/settings.json: enforcement files protected (Write|Edit through the guard)");
} catch (e) { fail(".claude/settings.json: " + e.message); }
for (const t of ["scorecard.md", "uyum-kontrol.md", "olay-postmortem.md", "destek-triyaj.md"]) {
  if (!fs.existsSync(path.join(ROOT, "templates", t))) fail(`templates/${t} missing`);
}
ok("process templates present (scorecard, compliance, incident, support triage)");

// the intro page's node map is generated from the real agents: it must not drift
try {
  require("child_process").execFileSync("node", [path.join(__dirname, "site-data.js"), "--check"], { stdio: "pipe" });
  ok("site/index.html: node-map data matches the agents and relations");
} catch (e) { fail("site/index.html: node-map data is stale or invalid (run node harness/bin/site-data.js --write): " + String(e.stderr || e.message).trim().split("\n")[0]); }

// graph output stays out of git
const gi = fs.existsSync(path.join(ROOT, ".gitignore")) ? fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8") : "";
if (!/graphify-out/.test(gi)) fail(".gitignore: graphify-out/ must be ignored (derived output)"); else ok(".gitignore: graphify-out/ ignored");

// ---- spec 0004 rules. Each prints its rule id as the first word after "FAIL  " or "WARN  " (spec §9);
// harness/test/lint-rules.sh asserts the ids. A WARN line does not change the exit code.
const warn = (m) => console.log("WARN  " + m);
const q = (s) => JSON.stringify(String(s)).slice(0, 200);          // spec and glob text is chosen by an agent: always quoted

// unlocks-header, unlocks-row2 (AC-6, §7.3, Ruling R-10): an active spec fails, a draft only warns.
{
  let policy = null;
  try { policy = require(path.join(__dirname, "..", "policy.js")); } catch (e) { fail("unlocks-header harness/policy.js cannot be loaded: " + String(e.message).split("\n")[0]); }
  const SAMPLES = ["CLAUDE.md", ".mcp.json", ".claude/settings.json", ".claude/settings.local.json", ".claude/commands/x.md", ".github/workflows/check.yml",
    "harness/keys/ceo.pub.pem", "harness/container-settings.json",
    ...["approval", "gate", "guard", "loop", "notify", "policy", "stop"].map((n) => `harness/${n}.js`), "harness/x.js",
    ...["approve", "ceo-keygen", "company-run", "install-project", "install-global"].map((n) => `harness/bin/${n}.sh`)];
  const walk = (dir, rel, out) => {
    let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r, out); else out.push(r);
    }
    return out;
  };
  // Every path the policy puts in row 2: the files of the tree plus the fixed sample list. Each entry carries the
  // root-relative path and, for a nested root, the path relative to that root (globs are matched against both).
  let row2 = null;
  const enforcementPaths = () => {
    if (row2) return row2;
    row2 = [];
    const ctx = { root: ROOT, mainRoot: ROOT, mode: "host", cfgDirs: [], home: null, platform: process.platform };
    for (const rel of new Set([...SAMPLES, ...walk(ROOT, "", [])])) {
      let c; try { c = policy.classify(path.join(ROOT, rel), ctx); } catch { c = { row: 2, rel }; }   // unresolvable: counted (fail closed)
      if (c.row === 2) row2.push([...new Set([rel, c.rel])]);
    }
    return row2;
  };
  const dirs = [["active", fail], ["draft", warn]];
  for (const [kind, report] of dirs) {
    const dir = path.join(ROOT, "specs", kind);
    const files = policy && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];
    let badHeader = 0, badGlob = 0;
    for (const f of files) {
      const label = `specs/${kind}/${f}`;
      let h; try { h = policy.parseHeader(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { h = { unlocks: null, errors: ["not readable: " + e.message] }; }
      if (h.errors.length || !Array.isArray(h.unlocks)) { badHeader++; report(`unlocks-header ${q(label)}: invalid 'Unlocks:' header, the whole field is ignored: ${h.errors.join("; ")}`); continue; }
      // §7.3 as amended by the delta of 2026-11-22: an exact path may open an enforcement file, a glob never does.
      // Entry kinds come from the policy (unlockKinds, Ruling R-23), so lint, the gate and the signing preview agree.
      const hits = [];
      const kinds = policy.unlockKinds(h.unlocks, ROOT, { root: ROOT, mainRoot: ROOT, mode: "host", cfgDirs: [], home: null, platform: process.platform });
      const fold = (s) => String(s).normalize("NFC").toLowerCase();
      for (const g of h.unlocks) {
        if (/[*?]/.test(g)) {
          // Folded on every platform: a glob that reaches row 2 on darwin or win32 is refused everywhere (row 2 itself folds everywhere, R-14).
          const hit = enforcementPaths().find((names) => names.some((n) => policy.matchGlob(g, n, true)));
          if (hit) hits.push(`glob ${q(g)} matches enforcement path ${q(hit[0])}`);
        } else if (kinds.locked.includes(g)) {
          hits.push(`${q(g)} is a locked path: no header opens signatures, keys or git metadata`);
        } else if (kinds.enforcement.includes(g)) {
          // Ruling R-27: the gate compares with exact case, so an entry that differs from a known enforcement path only in case opens nothing its author meant.
          const known = enforcementPaths().flat();
          const twin = known.find((n) => fold(n) === fold(g));
          if (twin && !known.some((n) => n.normalize("NFC") === g.normalize("NFC"))) hits.push(`${q(g)} names enforcement path ${q(twin)} in another case (the exact path is required)`);
        }
      }
      if (hits.length) { badGlob++; report(`unlocks-row2 ${q(label)}: an exact path may open an enforcement file, a glob never does: ${hits.join("; ")}`); }
    }
    if (kind === "active" && policy) {
      if (!badHeader) ok(`unlocks-header: ${files.length} active spec(s), 'Unlocks:' header valid or absent`);
      if (!badGlob) ok("unlocks-row2: no glob of an active spec reaches an enforcement path, no literal entry is locked or wrongly cased");
    }
  }
}

// hook-wrapper (AC-11): a gate or guard hook that crashes or is missing must block (exit 2), a stop hook must not.
{
  const WRAPPED = /\|\| exit 2\s*$/;
  const commands = (file) => {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")); const out = [];
    for (const [event, entries] of Object.entries((s && s.hooks) || {})) {
      for (const e of Array.isArray(entries) ? entries : []) for (const h of (e && e.hooks) || []) if (h && typeof h.command === "string") out.push({ event, command: h.command });
    }
    return out;
  };
  const bad = [];
  try {
    for (const { event, command } of commands(path.join(".claude", "settings.json"))) {
      if (/\b(gate|guard)\.js\b/.test(command) && !WRAPPED.test(command)) bad.push(`.claude/settings.json: ${event} command for ${/gate\.js/.test(command) ? "gate.js" : "guard.js"} lacks the '|| exit 2' suffix`);
      if ((/\bstop\.js\b/.test(command) || /^(Stop|SubagentStop)$/.test(event)) && /\|\|\s*exit\s+2\b/.test(command)) bad.push(`.claude/settings.json: ${event} stop command carries '|| exit 2'`);
    }
  } catch (e) { bad.push(".claude/settings.json: " + e.message); }
  try {
    for (const { event, command } of commands(path.join("harness", "container-settings.json"))) {
      if (/\bgate\.js\b/.test(command) && !WRAPPED.test(command)) bad.push(`harness/container-settings.json: ${event} command for gate.js lacks the '|| exit 2' suffix`);
    }
  } catch (e) { bad.push("harness/container-settings.json: " + e.message); }
  if (bad.length) fail("hook-wrapper " + bad.join("; ")); else ok("hook-wrapper: gate and guard commands end with '|| exit 2', stop commands do not");
}

// fixture-sanitized (AC-13): the repository is public, so a recorded hook payload carries no home path and no session id.
{
  const dir = path.join(ROOT, "harness", "test", "fixtures");
  const PATTERNS = [["/Users/ path", /\/Users\//], ["/home/<name> path", /\/home\/[a-z]/], ["UUID", /[0-9a-f]{8}-[0-9a-f]{4}-/i]];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const bad = [];
  if (!files.length) bad.push("harness/test/fixtures: no fixture found");
  for (const f of files) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    try { JSON.parse(t); } catch { bad.push(`${f}: does not parse as JSON`); }
    for (const [name, re] of PATTERNS) if (re.test(t)) bad.push(`${f}: contains a ${name}`);   // the match itself is never printed
  }
  for (const f of ["pretooluse-main.json", "pretooluse-subagent.json", "subagentstop.json"]) {
    if (files.length && !files.includes(f)) warn(`fixture-sanitized harness/test/fixtures/${f} is missing (AC-13 names it; not captured in T-1)`);
  }
  if (bad.length) fail("fixture-sanitized " + bad.join("; ")); else ok(`fixture-sanitized: ${files.length} fixture(s) parse, no home path, no UUID`);
}

// texts-0004 (AC-14): string checks against the real files. This block holds the README and template parts (T-8).
// The CLAUDE.md rule 1 and .claude/rules/routing.md parts of AC-14 are added by T-9, together with the wiring those
// texts describe (REQ-32): a check for them here would fail on texts that task has not written yet.
{
  const bad = [];
  const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { bad.push(`${rel}: not readable`); return null; } };
  // The body of a level-2 section: the lines after the exact heading line, up to the next level-2 heading.
  const section = (text, heading) => {
    const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
    const i = lines.indexOf(heading); if (i < 0) return null;
    const j = lines.findIndex((l, k) => k > i && l.startsWith("## "));
    return lines.slice(i + 1, j < 0 ? undefined : j).join("\n");
  };
  const README = "harness/README.md";
  const ORDER = "hard-deny > enforcement > product-config > code > outside > free";                    // Ruling R-17
  const RULE = "classify both the lexical and the resolved path, stronger class wins";                 // the name §7.1.1 defines
  const EXACT = "an exact path may open an enforcement file, a glob never does";                       // the rule name §7.3 defines
  const BLOCK = "ENFORCEMENT FILES THIS SIGNATURE OPENS";                                              // the preview heading of §7.5
  const readme = read(README);
  if (readme !== null) {
    const gaps = section(readme, "## Bilinen boşluklar");
    if (gaps === null) bad.push(`${README}: section '## Bilinen boşluklar' missing`);
    else {
      const missing = [];
      // An id counts only where it opens its own entry (a table row or a list item): a mention such as "G-1..G-22" or "see G-21" is no entry.
      for (let n = 1; n <= 22; n++) if (!new RegExp(`^(\\| ?|[-*] )G-${n}(?![\\w-])`, "m").test(gaps)) missing.push("G-" + n);
      if (missing.length) bad.push(`${README}: '## Bilinen boşluklar' lacks ${missing.join(", ")}`);
    }
    const classes = section(readme, "## Yol sınıfları");
    if (classes === null) bad.push(`${README}: section '## Yol sınıfları' missing`);
    else {
      if (!classes.includes(ORDER)) bad.push(`${README}: '## Yol sınıfları' lacks the strength order '${ORDER}'`);
      if (!classes.includes(RULE)) bad.push(`${README}: '## Yol sınıfları' lacks the rule '${RULE}'`);
      if (!classes.includes(EXACT)) bad.push(`${README}: '## Yol sınıfları' lacks the rule '${EXACT}'`);
    }
    // Delta 2026-11-22 (T-8b, AC-14): where and how the CEO signs, the permission-mode section, and the amended G-1 row.
    const signing = section(readme, "## CEO nerede ve nasıl imzalar");
    if (signing === null) bad.push(`${README}: section '## CEO nerede ve nasıl imzalar' missing`);
    else if (!signing.includes(BLOCK)) bad.push(`${README}: '## CEO nerede ve nasıl imzalar' lacks '${BLOCK}'`);
    if (section(readme, "## İzin kipi ve onay penceresi") === null) bad.push(`${README}: section '## İzin kipi ve onay penceresi' missing`);
    if (gaps !== null) {
      const g1 = gaps.split("\n").find((l) => /^\| ?G-1(?![\w-])/.test(l));
      if (g1 !== undefined && !g1.includes("Unlocks:")) bad.push(`${README}: the G-1 row of '## Bilinen boşluklar' lacks 'Unlocks:'`);
    }
  }
  for (const rel of ["templates/spec-tam.md", "templates/spec-hizli.md"]) {
    const t = read(rel); if (t === null) continue;
    const lines = t.split("\n").map((l) => l.replace(/\r$/, ""));
    const end = lines.findIndex((l) => l.startsWith("## "));
    const n = (end < 0 ? lines : lines.slice(0, end)).filter((l) => /^- Unlocks: /.test(l)).length;   // header as in §7.3
    if (n !== 1) bad.push(`${rel}: the header must carry the optional '- Unlocks: ' line exactly once, found ${n}`);
  }
  if (bad.length) fail("texts-0004 " + bad.join("; "));
  else ok("texts-0004: harness/README.md names G-1..G-22, the class strength order and the two-path rule; both spec templates carry '- Unlocks:' (CLAUDE.md and routing texts: T-9)");
}

console.log(`\nLINT ${failures ? "FAILED" : "GREEN"}: ${checks} ok, ${failures} failed`);
process.exit(failures ? 1 : 0);
