#!/usr/bin/env node
// harness/test/policy-driver.js: calls harness/policy.js with an injected context (spec 0004 §7.2).
// Used by harness/test/policy.sh, which builds the temp tree (real symlinks, temp HOME) first.
//   matrix <T>            AC-1: classify the fixed matrix                     -> ok/FAIL lines
//   paths <T>             the matrix as "<class>\t<path>" lines (for the gate/guard consistency loop, T-6)
//   superset <T> <regex>  AC-2: never narrower than guard.js ENFORCEMENT       -> ok/FAIL lines
//   header                AC-6: parseHeader / matchGlob                        -> ok/FAIL lines
//   decide <T>            AC-6 (signed, then edited), decision table, modes    -> ok/FAIL lines
//   source                AC-11 source order, AC-10 "no allow" on the sources  -> ok/FAIL lines
// The tree layout under <T> is documented in policy.sh. Exit 1 when a case fails.
"use strict";
const fs = require("fs");
const path = require("path");
const HARNESS = path.resolve(__dirname, "..");
const policy = require(path.join(HARNESS, "policy.js"));

let failed = 0;
const t = (name, want, got) => {
  if (want === got) console.log("ok    " + name);
  else { failed++; console.log("FAIL  " + name + " (expected " + want + ", got " + got + ")"); }
};
const NFD = "résumé.md";             // "résumé.md" with combining accents
const NFC = NFD.normalize("NFC");

// Context for a workspace of the temp tree. `over` replaces fields of the built context (mainRoot, fs).
function ctxFor(T, ws, platform, over, extraEnv) {
  const root = path.join(T, ws);
  const env = Object.assign({ HOME: path.join(T, "home"), CLAUDE_PROJECT_DIR: root, PATH: process.env.PATH }, extraEnv || {});
  const ctx = policy.context({ cwd: root }, { mode: "host", env, platform, harnessDir: HARNESS });
  return Object.assign(ctx, over || {});
}
function label(p, ctx) {
  try { return policy.classify(p, ctx).label; }
  catch (e) { if (e instanceof policy.ResolveError) return "refused"; throw e; }
}
const failingFs = (code) => Object.assign({}, fs, {
  realpathSync: () => { const e = new Error(code + ": injected"); e.code = code; throw e; },
});

// The fixed matrix: [name, workspace, path ("@T/", "@H/" or workspace-relative), expected class, platforms]
const BOTH = ["darwin", "linux"];
const MATRIX = [
  // row 1, hard-deny
  ["approvals/x.json through a symlinked approvals dir",  "ws1", "approvals/x.json",              "hard-deny",      BOTH],
  ["reverse: outside link into the workspace approvals",  "ws2", "@T/out/l2/x",                   "hard-deny",      BOTH],
  [".git/config",                                         "ws1", ".git/config",                   "hard-deny",      BOTH],
  [".git itself",                                         "ws1", ".git",                          "hard-deny",      BOTH],
  ["APPROVALS/x.json (case folded)",                      "ws2", "APPROVALS/x.json",              "hard-deny",      BOTH],
  // row 2, enforcement
  ["CLAUDE.md",                                           "ws1", "CLAUDE.md",                     "enforcement",    BOTH],
  ["harness/gate.js",                                     "ws1", "harness/gate.js",               "enforcement",    BOTH],
  ["harness/policy.js",                                   "ws1", "harness/policy.js",             "enforcement",    BOTH],
  ["harness/new-hook.js (harness/*.js)",                  "ws1", "harness/new-hook.js",           "enforcement",    BOTH],
  ["harness/bin/approve.sh",                              "ws1", "harness/bin/approve.sh",        "enforcement",    BOTH],
  [".mcp.json",                                           "ws1", ".mcp.json",                     "enforcement",    BOTH],
  [".claude/commands/x.md",                               "ws1", ".claude/commands/x.md",         "enforcement",    BOTH],
  [".claude/worktrees/w1 itself (not a nested path)",     "ws1", ".claude/worktrees/w1",          "enforcement",    BOTH],
  ["symlink in src to .claude/settings.json",             "ws1", "src/link-settings",             "enforcement",    BOTH],
  ["symlink in src to harness/gate.js",                   "ws1", "src/gate-link.cs",              "enforcement",    BOTH],
  ["new file under a dir symlinked to harness/keys",      "ws1", "src/lnk-keys/new.pem",          "enforcement",    BOTH],
  ["CLAUDE.md as a symlink to AGENTS.md",                 "ws2", "CLAUDE.md",                     "enforcement",    BOTH],
  ["CLAUDE.md as a symlink to docs/x.md",                 "ws3", "CLAUDE.md",                     "enforcement",    BOTH],
  ["docs/x.md as a symlink to ../CLAUDE.md",              "ws1", "docs/x.md",                     "enforcement",    BOTH],
  ["home settings.json as a symlink to dotfiles",         "ws1", "@H/.claude/settings.json",      "enforcement",    BOTH],
  [".CLAUDE/settings.json",                               "ws1", ".CLAUDE/settings.json",         "enforcement",    BOTH],
  ["claude.md",                                           "ws1", "claude.md",                     "enforcement",    BOTH],
  [".claude/worktrees/w1/harness/gate.js",                "ws1", ".claude/worktrees/w1/harness/gate.js", "enforcement", BOTH],
  [".claude/Worktrees/w1/src/a.cs (exact case, not re-rooted)", "ws1", ".claude/Worktrees/w1/src/a.cs", "enforcement", BOTH],
  [".claude/AGENTS/x.md (exact-case carve-out)",          "ws1", ".claude/AGENTS/x.md",           "enforcement",    BOTH],
  // row 4, product-config
  [".claude/agents/x.md",                                 "ws1", ".claude/agents/x.md",           "product-config", BOTH],
  [".claude/skills/s/SKILL.md",                           "ws1", ".claude/skills/s/SKILL.md",     "product-config", BOTH],
  [".claude/rules/routing.md",                            "ws1", ".claude/rules/routing.md",      "product-config", BOTH],
  ["harness/bin/check",                                   "ws1", "harness/bin/check",             "product-config", BOTH],
  ["harness/test/run.sh",                                 "ws1", "harness/test/run.sh",           "product-config", BOTH],
  ["harness/README.md",                                   "ws1", "harness/README.md",             "product-config", BOTH],
  ["evals/x/case.md",                                     "ws1", "evals/x/case.md",               "product-config", BOTH],
  ["templates/spec-tam.md",                               "ws1", "templates/spec-tam.md",         "product-config", BOTH],
  ["TEMPLATES/x.md",                                      "ws1", "TEMPLATES/x.md",                "product-config", ["linux"]],
  // row 5, free
  ["docs/real.md",                                        "ws1", "docs/real.md",                  "free",           BOTH],
  ["specs/draft/0009.md",                                 "ws1", "specs/draft/0009.md",           "free",           BOTH],
  ["plans/0004-plan.md",                                  "ws1", "plans/0004-plan.md",            "free",           BOTH],
  ["STATE.md",                                            "ws1", "STATE.md",                      "free",           BOTH],
  ["DOCS/x.md",                                           "ws2", "DOCS/x.md",                     "free",           ["darwin"]],
  ["docs/ NFD-encoded name",                              "ws1", "docs/" + NFD,                   "free",           BOTH],
  ["docs/ NFC-encoded name",                              "ws1", "docs/" + NFC,                   "free",           BOTH],
  // row 6, code
  ["src/a.cs",                                            "ws1", "src/a.cs",                      "code",           BOTH],
  ["README.md",                                           "ws1", "README.md",                     "code",           BOTH],
  ["DOCS/x.md",                                           "ws2", "DOCS/x.md",                     "code",           ["linux"]],
  ["new file under docs dir symlinked to src (target stronger)", "ws1", "docs/lnk-src/new.cs",    "code",           BOTH],
  ["new file under src dir symlinked to docs (lexical class)",   "ws1", "src/lnk-docs/new.md",    "code",           BOTH],
  ["src/out.cs as a symlink to a file outside",           "ws1", "src/out.cs",                    "code",           BOTH],
  ["src/dangling.cs as a dangling symlink to outside",    "ws1", "src/dangling.cs",               "code",           BOTH],
  ["outside in.cs as a symlink into src/",                "ws1", "@T/out/in.cs",                  "code",           BOTH],
  [".claude/worktrees/w1/src/a.cs",                       "ws1", ".claude/worktrees/w1/src/a.cs", "code",           BOTH],
  ["src/ NFD-encoded name",                               "ws1", "src/" + NFD,                    "code",           BOTH],
  ["src/ NFC-encoded name",                               "ws1", "src/" + NFC,                    "code",           BOTH],
  // row 7, outside
  ["plain file outside",                                  "ws1", "@T/out/plain.txt",              "outside",        BOTH],
  ["a file of another workspace",                         "ws1", "@T/ws3/src/b.cs",               "outside",        BOTH],
  ["docs/out.md as a symlink to outside",                 "ws1", "docs/out.md",                   "outside",        BOTH],
  ["docs/dangling.md as a dangling symlink to outside",   "ws1", "docs/dangling.md",              "outside",        BOTH],
  // resolve errors
  ["symlink loop (real ELOOP)",                           "ws1", "src/loop",                      "refused",        BOTH],
];
const abs = (T, ws, p) => p.startsWith("@T/") ? path.join(T, p.slice(3)) : p.startsWith("@H/") ? path.join(T, "home", p.slice(3)) : path.join(T, ws, p);

function matrix(T) {
  for (const [name, ws, p, want, platforms] of MATRIX) for (const pf of platforms) t(`[${pf}] ${name} -> ${want}`, want, label(abs(T, ws, p), ctxFor(T, ws, pf)));

  // at least two paths per class of §7.1
  for (const cls of ["hard-deny", "enforcement", "product-config", "free", "code", "outside"]) {
    const n = MATRIX.filter((m) => m[3] === cls).length;
    t(`matrix has at least two paths of class ${cls}`, true, n >= 2);
  }
  // injected non-ENOENT resolve error -> refused, whatever the lexical class
  for (const pf of BOTH) for (const p of ["src/a.cs", "docs/real.md", "CLAUDE.md"]) {
    t(`[${pf}] injected EACCES on ${p} -> refused`, "refused", label(abs(T, "ws1", p), ctxFor(T, "ws1", pf, { fs: failingFs("EACCES") })));
  }
  // a tree that does not exist and has no symlink on the way: only the injected error can refuse
  const ghost = path.join(path.parse(T).root, "policy-test-no-such-dir", "ws");
  for (const code of ["EACCES", "EIO", "ENOTDIR"]) {
    t(`injected ${code} on a missing tree -> refused`, "refused", label(path.join(ghost, "src", "a.cs"), { mode: "host", root: ghost, mainRoot: ghost, cfgDirs: [], platform: "linux", fs: failingFs(code) }));
  }
  t("missing tree without an injected error -> code", "code", label(path.join(ghost, "src", "a.cs"), { mode: "host", root: ghost, mainRoot: ghost, cfgDirs: [], platform: "linux" }));
  // NFC: a root with an accented name, given in one encoding while the path comes in the other
  const accN = path.join(T, "ws-é"), accD = path.join(T, "ws-é");
  fs.mkdirSync(path.join(accN, "src"), { recursive: true });
  for (const pf of BOTH) {
    t(`[${pf}] NFD path under an NFC root -> code`, "code", label(path.join(accD, "src", "a.cs"), ctxFor(T, "ws-é", pf)));
    t(`[${pf}] NFC path under an NFD root -> code`, "code", label(path.join(accN, "src", "a.cs"), ctxFor(T, "ws-é", pf)));
    t(`[${pf}] NFD path under an NFC root: rel`, "src/a.cs", policy.classify(path.join(accD, "src", "a.cs"), ctxFor(T, "ws-é", pf)).rel);
  }
  t("injected ENOENT everywhere is not a resolve error", "code", label(abs(T, "ws1", "src/a.cs"), ctxFor(T, "ws1", "linux", { fs: Object.assign(failingFs("ENOENT"), { lstatSync: () => { const e = new Error("ENOENT"); e.code = "ENOENT"; throw e; } }) })));

  // nested root (row 3): root reported in the result and in both classifications
  for (const pf of BOTH) {
    const c = policy.classify(abs(T, "ws1", ".claude/worktrees/w1/src/a.cs"), ctxFor(T, "ws1", pf));
    const tail = path.join(".claude", "worktrees", "w1");
    t(`[${pf}] nested root: result root`, true, c.root.endsWith(tail));
    t(`[${pf}] nested root: lexical.root`, true, c.lexical.root.endsWith(tail));
    t(`[${pf}] nested root: resolved.root`, true, c.resolved.root.endsWith(tail));
    t(`[${pf}] nested root: rel is relative to the nested root`, "src/a.cs", c.rel);
    t(`[${pf}] nested root: row 6`, 6, c.row);
    const e = policy.classify(abs(T, "ws1", ".claude/worktrees/w1/harness/gate.js"), ctxFor(T, "ws1", pf));
    t(`[${pf}] nested enforcement: root is the nested root`, true, e.root.endsWith(tail));
    t(`[${pf}] nested approvals -> hard-deny`, "hard-deny", label(abs(T, "ws1", ".claude/worktrees/w1/approvals/x.json"), ctxFor(T, "ws1", pf)));
  }
  // result shape (§7.2)
  const c = policy.classify(abs(T, "ws1", "src/a.cs"), ctxFor(T, "ws1", "linux"));
  t("shape: row, rel, label", "6|src/a.cs|code", [c.row, c.rel, c.label].join("|"));
  t("shape: lexical root is path.resolve(R)", path.join(T, "ws1"), c.lexical.root);
  t("shape: resolved root is realpath(R)", fs.realpathSync(path.join(T, "ws1")), c.resolved.root);
  t("shape: tie reports the resolved root", c.resolved.root, c.root);
  const o = policy.classify(abs(T, "ws1", "@T/out/plain.txt"), ctxFor(T, "ws1", "linux"));
  t("shape: outside has the filesystem root", "7|" + path.parse(T).root, o.row + "|" + o.root);
  const s = policy.classify(abs(T, "ws1", "docs/x.md"), ctxFor(T, "ws1", "linux"));
  t("shape: stronger resolved class reports the resolved rel", "2|CLAUDE.md|5|docs/x.md", [s.row, s.rel, s.lexical.row, s.lexical.rel].join("|"));

  // main-root rule (REQ-35): R is a linked worktree, the path lies under the main root
  for (const pf of BOTH) {
    const lw = ctxFor(T, "ws3", pf, { mainRoot: path.join(T, "ws1") });
    const m = policy.classify(abs(T, "ws1", "src/a.cs"), lw);
    t(`[${pf}] main-root rule: <main>/src/a.cs -> code`, "code", m.label);
    t(`[${pf}] main-root rule: root is the main root`, fs.realpathSync(path.join(T, "ws1")), m.root);
    t(`[${pf}] main-root rule: lexical.root`, path.join(T, "ws1"), m.lexical.root);
    t(`[${pf}] main-root rule: <main>/docs/real.md -> free`, "free", label(abs(T, "ws1", "docs/real.md"), lw));
    t(`[${pf}] main-root rule: <main>/.claude/agents/x.md -> product-config`, "product-config", label(abs(T, "ws1", ".claude/agents/x.md"), lw));
    t(`[${pf}] main-root rule: a path under R keeps R`, path.join(T, "ws3"), policy.classify(abs(T, "ws3", "src/b.cs"), lw).lexical.root);
    t(`[${pf}] main-root rule off in container mode`, "outside", label(abs(T, "ws1", "src/a.cs"), Object.assign({}, lw, { mode: "container" })));
  }
  // root given with another case: same directory on darwin, another one on linux
  const up = path.join(T, "WS1", "src", "a.cs");
  t("[darwin] differently cased root -> code", "code", label(up, ctxFor(T, "ws1", "darwin")));
  t("[linux] differently cased root -> outside", "outside", label(up, ctxFor(T, "ws1", "linux")));
}

function superset(T, source) {
  const guardRe = new RegExp(source);
  const guardReI = new RegExp(source, "i");
  t("policy.ENFORCEMENT has the source of guard.js ENFORCEMENT", source, policy.ENFORCEMENT.source);
  t("policy.ENFORCEMENT is case-insensitive", true, policy.ENFORCEMENT.flags.includes("i"));
  const H = path.join(T, "home");
  const IN = ["src/CLAUDE.md", "docs/CLAUDE.md", "/tmp/other/harness/keys/ceo.pub.pem", "@H/.claude/CLAUDE.md", "@H/.claude/settings.json", "pkg/.github/workflows/ci.yml",
    "src/approvals/x.json", ".claude/worktrees/w1/.claude/settings.local.json", "/tmp/other/harness/loop.js", "/tmp/o/harness/gate.js.bak", "src/.claude/settings.json.orig"];
  const OUT = ["/tmp/other/harness/bin/approve.sh", "/tmp/other/harness/bin/install-project.sh", "src/harness/bin/ceo-keygen.sh", "@H/.claude.json", "@H/.claude/agents/x.md",
    "@H/.claude/skills/s/SKILL.md", "@H/.claude/rules/x.md", "@H/.claude/commands/x.md", "@H/.claude/hooks/x.sh", "@H/.claude/plugins/p/x.json"];
  const strong = (l) => l === "hard-deny" || l === "enforcement";
  const check = (name, p, ctx, mustMatch) => {
    let c;
    try { c = policy.classify(p, ctx); } catch (e) { if (!(e instanceof policy.ResolveError)) throw e; return 0; }   // refused: stronger than any class
    const forms = [c.lexical, c.resolved].map((x) => path.join(x.root, x.rel));
    const hit = forms.some((f) => guardRe.test(f) || guardReI.test(f));
    if (mustMatch) t(`${name}: guard expression matches`, true, hit);
    if (hit) t(`${name}: hard-deny or enforcement`, true, strong(c.label));
    return hit ? 1 : 0;
  };
  let hits = 0;
  for (const pf of BOTH) {
    for (const [name, ws, p] of MATRIX) hits += check(`[${pf}] matrix ${name}`, abs(T, ws, p), ctxFor(T, ws, pf), false);
    for (const p of IN) hits += check(`[${pf}] ${p}`, abs(T, "ws1", p), ctxFor(T, "ws1", pf), true);
    for (const p of IN) check(`[${pf}] upper-cased ${p}`, abs(T, "ws1", p).replace(/[^/]+\/[^/]+$/, (m) => m.toUpperCase()), ctxFor(T, "ws1", pf), true);
    for (const p of OUT) {
      const a = abs(T, "ws1", p);
      t(`[${pf}] ${p}: outside the guard expression`, false, guardReI.test(a));
      t(`[${pf}] ${p} -> enforcement`, "enforcement", label(a, ctxFor(T, "ws1", pf)));
    }
    const cfg = path.join(T, "cfg");
    for (const p of ["agents/x.md", "settings.json"]) {
      t(`[${pf}] CLAUDE_CONFIG_DIR ${p} -> enforcement`, "enforcement", label(path.join(cfg, p), ctxFor(T, "ws1", pf, null, { CLAUDE_CONFIG_DIR: cfg })));
      t(`[${pf}] ${p} without CLAUDE_CONFIG_DIR -> outside`, "outside", label(path.join(cfg, p), ctxFor(T, "ws1", pf)));
    }
    t(`[${pf}] home .company -> enforcement`, "enforcement", label(path.join(H, ".company", "keys", "x.pem"), ctxFor(T, "ws1", pf)));
    t(`[${pf}] home settings.local.json -> enforcement`, "enforcement", label(path.join(H, ".claude", "settings.local.json"), ctxFor(T, "ws1", pf)));
    t(`[${pf}] home plain file -> outside`, "outside", label(path.join(H, "notes.txt"), ctxFor(T, "ws1", pf)));
  }
  t("superset check is not vacuous (guard expression hit 30+ paths)", true, hits >= 30);
}

function header() {
  const H = (lines) => lines.join("\n") + "\n\n## 1. Intent\n- Unlocks: `after/the/header`\n";
  const show = (r) => (r.unlocks === null ? "null" : r.unlocks.join("|")) + " errors:" + r.errors.length;
  t("valid list with backticks", "harness/bin/check|harness/test/*.js|templates/** errors:0", show(policy.parseHeader(H(["# Spec", "- Status: Draft", "- Unlocks: `harness/bin/check`, `harness/test/*.js`, `templates/**`"]))));
  t("valid list without backticks", "harness/bin/check|a/**/b.md errors:0", show(policy.parseHeader(H(["# Spec", "- Unlocks: harness/bin/check, a/**/b.md"]))));
  t("no field: empty list, no error", " errors:0", show(policy.parseHeader(H(["# Spec", "- Status: Draft"]))));
  t("a field after the first '## ' line is not read", " errors:0", show(policy.parseHeader("# Spec\n## 1.\n- Unlocks: `x`\n")));
  t("field twice: header invalid", "null errors:1", show(policy.parseHeader(H(["- Unlocks: `a`", "- Unlocks: `b`"]))));
  t("empty item is invalid", "null errors:1", show(policy.parseHeader(H(["- Unlocks: `a`, , `b`"]))));
  t("empty value is invalid", "null errors:1", show(policy.parseHeader(H(["- Unlocks: "]))));
  t("one bad glob voids the whole field", "null errors:1", show(policy.parseHeader(H(["- Unlocks: `templates/**`, `../x`"]))));
  for (const g of ["{a,b}", "[ab]", "!x", "../x", "/abs", "~/x", "$X/y", "a**", "./x", "a//b", "a/", "a/../b", "**b", "a\\b", "`a"]) {
    const r = policy.parseHeader(H(["- Unlocks: " + (g.includes(",") ? g : "`" + g + "`")]));
    t(`invalid glob ${g}: field ignored`, "null", r.unlocks === null ? "null" : "list");
    t(`invalid glob ${g}: an error is returned`, true, r.errors.length > 0);
    t(`invalid glob ${g}: never matches`, false, policy.matchGlob(g, "x", false) || policy.matchGlob(g, g, false));
  }
  const m = (g, rel, fold) => policy.matchGlob(g, rel, !!fold);
  t("** matches zero segments", true, m("a/**/b.md", "a/b.md"));
  t("** matches one segment", true, m("a/**/b.md", "a/x/b.md"));
  t("** matches several segments", true, m("a/**/b.md", "a/x/y/b.md"));
  t("trailing ** matches everything below", true, m("templates/**", "templates/a/b/c.md"));
  t("trailing ** does not match a sibling prefix", false, m("templates/**", "templates2/a.md"));
  t("leading ** matches at any depth", true, m("**/x.md", "a/b/x.md") && m("**/x.md", "x.md"));
  t("* stays within a segment", false, m("harness/test/*.js", "harness/test/sub/a.js"));
  t("* matches within a segment", true, m("harness/test/*.js", "harness/test/policy-driver.js"));
  t("* matches an empty run", true, m("a*.md", "a.md"));
  t("? matches one character", true, m("a?.md", "ab.md"));
  t("? does not match a separator", false, m("a?b", "a/b"));
  t("? does not match zero characters", false, m("a?.md", "a.md"));
  t("literal dot is not a wildcard", false, m("a.md", "aXmd"));
  t("exact path matches itself only", true, m("harness/bin/check", "harness/bin/check") && !m("harness/bin/check", "harness/bin/check.sh") && !m("harness/bin/check", "x/harness/bin/check"));
  t("case-sensitive without fold (linux)", false, m("templates/*.md", "Templates/X.md", false));
  t("case-insensitive with fold (darwin, win32)", true, m("templates/*.md", "Templates/X.md", true));
  t("foldGlobs: darwin", true, policy.foldGlobs("darwin"));
  t("foldGlobs: win32", true, policy.foldGlobs("win32"));
  t("foldGlobs: linux", false, policy.foldGlobs("linux"));
}

// decide: a workspace with a throwaway key (built by policy.sh): <T>/dws signed, <T>/dws-edited signed then edited in its Unlocks: line.
function decide(T) {
  const mk = (ws, platform, mode, over) => {
    const root = path.join(T, ws);
    const ctx = policy.context({ cwd: root, permission_mode: mode }, { mode: "host", env: { HOME: path.join(T, "home"), CLAUDE_PROJECT_DIR: root, PATH: process.env.PATH }, platform, harnessDir: HARNESS });
    return Object.assign(ctx, { pubkeyPath: path.join(T, "dkeys", "ceo.pub.pem") }, over || {});
  };
  const d = (ws, target, o) => {
    o = o || {};
    const ctx = mk(ws, o.platform || "linux", o.mode, o.over);
    return policy.decide({ kind: o.kind || "file", target, event: { cwd: ctx.root, permission_mode: o.mode } }, ctx);
  };
  const dec = (ws, target, o) => d(ws, target, o).decision;
  // signed spec whose Unlocks: is `templates/**`, `harness/test/*.sh`, `harness/**`
  t("signed: code -> allow", "allow", dec("dws", "src/a.cs"));
  t("signed: product-config in Unlocks: -> allow", "allow", dec("dws", "templates/x.md"));
  t("signed: product-config not in Unlocks: -> ask", "ask", dec("dws", "evals/x.md"));
  t("signed: Unlocks: glob is no authority over enforcement (harness/gate.js)", "ask", dec("dws", "harness/gate.js"));
  t("signed: enforcement -> ask", "ask", dec("dws", "CLAUDE.md"));
  t("signed: hard-deny by file tool -> deny", "deny", dec("dws", "approvals/x.json"));
  t("signed: hard-deny by Bash writer -> ask", "ask", dec("dws", "approvals/x.json", { kind: "bash" }));
  t("signed: free by file tool -> allow", "allow", dec("dws", "docs/x.md"));
  t("signed: free by Bash writer -> none", "none", dec("dws", "docs/x.md", { kind: "bash" }));
  t("signed: outside -> none", "none", dec("dws", path.join(T, "out", "plain.txt")));
  t("signed: relative target resolves against event.cwd", "allow", dec("dws", "./src/../src/a.cs"));
  t("signed: Unlocks: case-sensitive on linux", "ask", dec("dws", "templates/X.MD".replace("templates", "Templates")));
  t("signed: Unlocks: case-insensitive on darwin", "allow", dec("dws", "Templates/X.md", { platform: "darwin" }));
  t("signed: Unlocks: case-insensitive on win32", "allow", dec("dws", "Templates/X.md", { platform: "win32" }));
  // AC-6: signed, then edited only in its Unlocks: line -> no unlock (signature invalid)
  t("edited after signing: product-config -> ask (no unlock)", "ask", dec("dws-edited", "templates/x.md"));
  t("edited after signing: code -> ask", "ask", dec("dws-edited", "src/a.cs"));
  // unsigned workspace (ws1 of the matrix has specs/active but no spec file), no specs/ (ws3)
  t("no active spec: code -> ask", "ask", dec("ws1", "src/a.cs"));
  t("no active spec: reason names the quoted path and the count", true, /"src\/a\.cs"/.test(d("ws1", "src/a.cs").reason) && /0/.test(d("ws1", "src/a.cs").reason));
  t("no specs/ directory: code -> none", "none", dec("ws3", "src/b.cs"));
  t("no specs/ directory: product-config -> none", "none", dec("ws3", "templates/x.md"));
  t("no specs/ directory: enforcement still asks", "ask", dec("ws3", "CLAUDE.md"));
  t("no specs/ directory: hard-deny still denies", "deny", dec("ws3", ".git/config"));
  t("resolve error -> deny", "deny", dec("ws1", "src/loop"));
  // permission modes (§7.7): absent -> ask; proven -> ask; anything else -> deny naming the mode
  for (const mode of policy.ASK_MODES) t(`mode ${mode} (ASK_MODES): ask stays ask`, "ask", dec("ws1", "src/a.cs", { mode }));
  t("ASK_MODES holds default", true, policy.ASK_MODES.includes("default"));
  t("ASK_MODES never holds auto or bypassPermissions", false, policy.ASK_MODES.includes("auto") || policy.ASK_MODES.includes("bypassPermissions"));
  for (const mode of ["auto", "bypassPermissions", "somethingNew", ""]) {
    const r = d("ws1", "src/a.cs", { mode });
    t(`mode '${mode}': ask becomes deny`, "deny", r.decision);
    t(`mode '${mode}': reason names the mode and the way forward`, true, r.reason.includes("permission mode '" + mode + "'") && r.reason.includes("switch to default mode or sign a spec") && r.reason.includes('"src/a.cs"'));
    t(`mode '${mode}': signed code is still allowed`, "allow", dec("dws", "src/a.cs", { mode }));
    t(`mode '${mode}': free is unchanged`, "allow", dec("ws1", "docs/real.md", { mode }));
    t(`mode '${mode}': enforcement ask becomes deny`, "deny", dec("ws1", "CLAUDE.md", { mode }));
  }
  // lookup failures recorded in the context (REQ-14)
  t("git lookup failed: code -> deny", true, /git lookup failed \(fail closed\)/.test(d("ws1", "src/a.cs", { over: { rootLookupFailed: true } }).reason) && dec("ws1", "src/a.cs", { over: { rootLookupFailed: true } }) === "deny");
  t("git lookup failed: free still allowed", "allow", dec("ws1", "docs/real.md", { over: { rootLookupFailed: true } }));
  t("git lookup failed: no specs/ -> none (REQ-11 first)", "none", dec("ws3", "src/b.cs", { over: { rootLookupFailed: true } }));
  t("harness key lookup failed: code -> deny", true, /harness key lookup failed \(fail closed\)/.test(d("dws", "src/a.cs", { over: { pubkeyPath: null } }).reason));
  // container mode: every ask is a refusal, outside and .claude/ refused
  const cd = (ws, target) => {
    const root = path.join(T, ws);
    const ctx = policy.context({ cwd: root }, { mode: "container", env: { COMPANY_PUBKEY: path.join(T, "dkeys", "ceo.pub.pem") }, platform: "linux", harnessDir: HARNESS });
    return policy.decide({ kind: "file", target, event: { cwd: root } }, ctx).decision;
  };
  t("container signed: code -> allow", "allow", cd("dws", "src/a.cs"));
  t("container signed: free -> allow", "allow", cd("dws", "plans/x.md"));
  t("container signed: product-config in Unlocks: -> allow", "allow", cd("dws", "templates/x.md"));
  t("container signed: product-config not in Unlocks: -> deny", "deny", cd("dws", "evals/x.md"));
  t("container signed: .claude/agents (in no Unlocks:) -> deny", "deny", cd("dws", ".claude/agents/x.md"));
  t("container signed: nested root under .claude/ -> deny", "deny", cd("dws", ".claude/worktrees/w1/src/a.cs"));
  t("container signed: enforcement -> deny", "deny", cd("dws", "harness/gate.js"));
  t("container signed: outside -> deny", "deny", cd("dws", path.join(T, "out", "plain.txt")));
  t("container unsigned: code -> deny", "deny", cd("ws1", "src/a.cs"));
  t("container unsigned: free -> allow", "allow", cd("ws1", "docs/real.md"));
  t("container: free through a symlink to outside -> deny", "deny", cd("ws1", "docs/out.md"));
  // quoting (§7.8)
  t("quote: JSON string literal", '"a\\nb\\"c"', policy.quote('a\nb"c'));
  t("quote: cut to 200 characters with an ellipsis", true, policy.quote("x".repeat(500)).length === 200 && policy.quote("x".repeat(500)).endsWith("…"));
}

function source() {
  for (const f of ["gate.js", "guard.js"]) {
    const lines = fs.readFileSync(path.join(HARNESS, f), "utf8").split("\n");
    const handler = lines.findIndex((l) => /process\.on\(\s*["']uncaughtException["']/.test(l));
    const firstRequire = lines.findIndex((l) => /\brequire\(/.test(l));
    t(`${f}: has an uncaughtException handler`, true, handler >= 0);
    t(`${f}: the handler line comes before the first require(`, true, handler >= 0 && firstRequire >= 0 && handler < firstRequire);
  }
  for (const f of ["gate.js", "guard.js", "policy.js"]) {
    const src = fs.readFileSync(path.join(HARNESS, f), "utf8");
    const values = [...src.matchAll(/permissionDecision["']?\s*:\s*([^,}\n]*)/g)].map((m) => m[1].trim());
    t(`${f}: every permissionDecision value written is "ask"`, true, values.every((v) => v === '"ask"'));
    t(`${f}: no "allow" decision text for the app`, false, /permissionDecision["']?\s*:\s*["']allow/.test(src));
  }
  t("policy.js has no side effect at load (exports only)", true, ["context", "classify", "parseHeader", "matchGlob", "decide"].every((k) => typeof policy[k] === "function"));
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "matrix") matrix(a);
else if (cmd === "paths") for (const m of MATRIX) for (const pf of m[4]) console.log([m[3], pf, m[1], abs(a, m[1], m[2])].join("\t"));
else if (cmd === "superset") superset(a, b);
else if (cmd === "header") header();
else if (cmd === "decide") decide(a);
else if (cmd === "source") source();
else { console.error("usage: policy-driver.js matrix|paths|superset|header|decide|source"); process.exit(2); }
process.exit(failed ? 1 : 0);
