#!/usr/bin/env node
// harness/test/policy-driver.js: calls harness/policy.js with an injected context (spec 0004 §7.2).
// Used by harness/test/policy.sh, which builds the temp tree (real symlinks, temp HOME) first.
//   matrix <T>            AC-1: classify the fixed matrix                     -> ok/FAIL lines
//   paths <T>             the matrix as "<class>\t<path>" lines (for the gate/guard consistency loop, T-6)
//   superset <T> <regex>  AC-2: never narrower than guard.js ENFORCEMENT       -> ok/FAIL lines
//   header                AC-6: parseHeader / matchGlob                        -> ok/FAIL lines
//   decide <T>            AC-6 (signed, then edited), decision table, modes    -> ok/FAIL lines
//   source                AC-11 source order, AC-10 "no allow" on the sources  -> ok/FAIL lines
//   literal <T>           AC-16: literal enforcement entries, unlockKinds      -> ok/FAIL lines
//   header-chars          §7.3 S-05: control and format characters in a glob  -> ok/FAIL lines
//   alias <T>             §7.1.1: macOS path aliases (firmlink prefix, volfs)   -> ok/FAIL lines (darwin only)
//   fold <T>              §7.1.1: spellings by full case folding (U+017F, U+00DF, U+FB01)  -> ok/FAIL lines (darwin only)
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
  // row 2 members that hold anywhere on disk and that no other row-2 rule catches (QA T-11: four surviving mutants):
  // outside every root only the anywhere list names notify.js and policy.js; inside a root only it lifts the two scripts out of row 4
  ["harness/notify.js outside every root",                "ws1", "@T/out/harness/notify.js",      "enforcement",    BOTH],
  ["harness/policy.js outside every root",                "ws1", "@T/out/harness/policy.js",      "enforcement",    BOTH],
  ["harness/bin/company-run.sh",                          "ws1", "harness/bin/company-run.sh",    "enforcement",    BOTH],
  ["harness/bin/install-global.sh",                       "ws1", "harness/bin/install-global.sh", "enforcement",    BOTH],
  ["harness/bin/company-run.sh outside every root",       "ws1", "@T/out/harness/bin/company-run.sh", "enforcement", BOTH],
  ["harness/bin/install-global.sh outside every root",    "ws1", "@T/out/harness/bin/install-global.sh", "enforcement", BOTH],
  ["HARNESS/Notify.js outside every root (case folded)",  "ws1", "@T/out/HARNESS/Notify.js",      "enforcement",    BOTH],
  ["harness/bin/other.sh outside every root (not a member)", "ws1", "@T/out/harness/bin/other.sh", "outside",       BOTH],
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

// AC-16 (delta 2026-11-22): literal enforcement entries. Tree built by policy.sh with the throwaway key:
//   <T>/lit1  signed, Unlocks: CLAUDE.md, harness/<NFD name>.js, .claude/settings.json, cfg/agents/x.md, templates/**
//   <T>/lit2  signed, Unlocks: claude.md          <T>/lit3  signed like lit1, then edited (one more literal entry)
function literal(T) {
  const KEYPUB = path.join(T, "dkeys", "ceo.pub.pem");
  const mk = (ws, o) => {
    const root = path.join(T, ws);
    const ev = { cwd: root, permission_mode: o.mode };
    if (o.agent !== undefined) ev.agent_type = o.agent;
    const env = Object.assign({ HOME: path.join(T, "home"), CLAUDE_PROJECT_DIR: root, PATH: process.env.PATH }, o.env || {});
    const ctx = policy.context(ev, { mode: o.container ? "container" : "host", env: o.container ? { COMPANY_PUBKEY: KEYPUB } : env, platform: o.platform || "linux", harnessDir: HARNESS });
    if (!o.container) Object.assign(ctx, { pubkeyPath: KEYPUB }, o.over || {});
    return ctx;
  };
  const d = (ws, target, o) => {
    o = o || {};
    const ctx = mk(ws, o);
    return policy.decide({ kind: o.kind || "file", target, event: { cwd: ctx.root, permission_mode: o.mode } }, ctx);
  };
  const dec = (ws, target, o) => d(ws, target, o).decision;
  const NFDJS = "harness/" + NFD.replace(/\.md$/, ".js"), NFCJS = NFDJS.normalize("NFC");
  t("unlockKinds is exported", "function", typeof policy.unlockKinds);
  if (typeof policy.unlockKinds !== "function") return;

  for (const platform of BOTH) {
    t(`[${platform}] named CLAUDE.md -> allow`, "allow", dec("lit1", "CLAUDE.md", { platform }));
    t(`[${platform}] claude.md against the entry CLAUDE.md -> ask`, "ask", dec("lit1", "claude.md", { platform }));
    t(`[${platform}] CLAUDE.md against the entry claude.md -> ask`, "ask", dec("lit2", "CLAUDE.md", { platform }));
    t(`[${platform}] claude.md against the entry claude.md -> allow (exact bytes)`, "allow", dec("lit2", "claude.md", { platform }));
    t(`[${platform}] an NFD-encoded entry opens its NFC-encoded target`, "allow", dec("lit1", NFCJS, { platform }));
    t(`[${platform}] the NFD-encoded target of that entry -> allow`, "allow", dec("lit1", NFDJS, { platform }));
    t(`[${platform}] kind bash on a named path -> ask`, "ask", dec("lit1", "CLAUDE.md", { platform, kind: "bash" }));
    t(`[${platform}] enforcement path not named -> ask`, "ask", dec("lit1", "harness/gate.js", { platform }));
    t(`[${platform}] agentType scout -> ask`, "ask", dec("lit1", "CLAUDE.md", { platform, agent: "scout" }));
    t(`[${platform}] agentType devops-sre -> allow`, "allow", dec("lit1", "CLAUDE.md", { platform, agent: "devops-sre" }));
  }
  t("NFD and NFC forms of the test name differ", true, NFDJS !== NFCJS);
  for (const agent of ["polyglot-engineer", "dotnet-engineer", "react-engineer", "devops-sre"]) t(`agentType ${agent} -> allow`, "allow", dec("lit1", "CLAUDE.md", { agent }));
  for (const agent of ["scout", "product-manager", "somethingNew", "", "Polyglot-Engineer", "polyglot-engineer "]) t(`agentType '${agent}' -> ask`, "ask", dec("lit1", "CLAUDE.md", { agent }));
  t("agentType absent (main session) -> allow", "allow", dec("lit1", "CLAUDE.md"));
  t("agentType null counts as absent -> allow", "allow", dec("lit1", "CLAUDE.md", { over: { agentType: null } }));
  // every mode: an unlocked enforcement file is allowed like signed code, an unmet condition follows §7.7
  for (const mode of ["default", "plan", "acceptEdits", "auto", "bypassPermissions", "somethingNew"]) {
    t(`mode ${mode}: named CLAUDE.md -> allow`, "allow", dec("lit1", "CLAUDE.md", { mode }));
  }
  t("mode auto: scout on a named path -> deny", "deny", dec("lit1", "CLAUDE.md", { mode: "auto", agent: "scout" }));
  t("mode auto: bash on a named path -> deny", "deny", dec("lit1", "CLAUDE.md", { mode: "auto", kind: "bash" }));
  const tail = "Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement: such a spec whose Unlocks: names the exact path, file tools only; signatures, keys, .git: no spec covers them, default mode only).";
  t("mode auto: the path text of 7.7 as amended", "the edit of \"harness/gate.js\" needs the CEO's dialog, but permission mode 'auto' is not proven to show it. " + tail, d("lit1", "harness/gate.js", { mode: "auto" }).reason);
  // signature (condition 4)
  t("spec edited after signing: named CLAUDE.md -> ask", "ask", dec("lit3", "CLAUDE.md"));
  t("unsigned workspace (no active spec): CLAUDE.md -> ask", "ask", dec("ws1", "CLAUDE.md"));
  t("no specs/ directory: CLAUDE.md -> ask", "ask", dec("ws3", "CLAUDE.md"));
  t("git lookup failed: named CLAUDE.md -> ask (no authority, R-22)", "ask", dec("lit1", "CLAUDE.md", { over: { rootLookupFailed: true } }));
  t("harness key lookup failed: named CLAUDE.md -> ask (no authority, R-22)", "ask", dec("lit1", "CLAUDE.md", { over: { pubkeyPath: null } }));
  t("another key: named CLAUDE.md -> ask", "ask", dec("lit1", "CLAUDE.md", { over: { pubkeyPath: path.join(T, "dkeys2", "ceo.pub.pem") } }));
  // a glob is never authority (dws: harness/**), a literal is none for another path
  t("glob harness/** does not open harness/gate.js", "ask", dec("dws", "harness/gate.js"));
  t("signed code is still allowed next to literal entries", "allow", dec("lit1", "src/a.cs"));
  t("product-config glob next to literal entries still unlocks", "allow", dec("lit1", "templates/x.md"));
  // symlinks (conditions 1 and 2): docs/l.md -> ../CLAUDE.md, src/gate-link.js -> ../harness/gate.js
  t("named CLAUDE.md reached through docs/l.md -> ask", "ask", dec("lit1", "docs/l.md"));
  // locked whatever the root (condition 3, D-2)
  t("named .claude/settings.json, home elsewhere -> allow (the lock follows the <cfg> member)", "allow", dec("lit1", ".claude/settings.json"));
  t("named .claude/settings.json, home = root -> ask", "ask", dec("lit1", ".claude/settings.json", { env: { HOME: path.join(T, "lit1") } }));
  t("named cfg/agents/x.md, no CLAUDE_CONFIG_DIR -> allow (code)", "allow", dec("lit1", "cfg/agents/x.md"));
  t("named cfg/agents/x.md, CLAUDE_CONFIG_DIR = <root>/cfg -> ask", "ask", dec("lit1", "cfg/agents/x.md", { env: { CLAUDE_CONFIG_DIR: path.join(T, "lit1", "cfg") } }));
  // container: never unlocked (REQ-17)
  t("container: named CLAUDE.md -> deny", "deny", dec("lit1", "CLAUDE.md", { container: true }));
  t("container: named .claude/settings.json -> deny", "deny", dec("lit1", ".claude/settings.json", { container: true }));
  // the ask reason keeps the class label and names the unmet condition (§4)
  const why = (ws, target, o) => d(ws, target, o).reason;
  const named = (name, re, r) => t("reason: " + name, true, r.includes("(enforcement)") && re.test(r));
  named("not named -> Unlocks:", /Unlocks:/, why("lit1", "harness/gate.js"));
  named("caller -> the quoted agent type", /"scout"/, why("lit1", "CLAUDE.md", { agent: "scout" }));
  named("Bash writer -> kabuk", /kabuk/, why("lit1", "CLAUDE.md", { kind: "bash" }));
  named("symlink -> bağ", /bağ/, why("lit1", "docs/l.md"));
  named("locked -> kilitli", /kilitli/, why("lit1", ".claude/settings.json", { env: { HOME: path.join(T, "lit1") } }));
  t("outside every root: CLAUDE.md of another directory -> ask", "ask", dec("lit1", path.join(T, "out", "CLAUDE.md")));
  named("outside every root -> dışında", /dışında/, why("lit1", path.join(T, "out", "CLAUDE.md")));
  named("no active spec -> the count 0", /bulunan: 0/, why("ws1", "CLAUDE.md"));
  named("edited spec -> imzalı değil", /imzalı değil/, why("lit3", "CLAUDE.md"));
  t("reason: the four differ (each names its own condition)", 4, new Set([why("lit1", "harness/gate.js"), why("lit1", "CLAUDE.md", { agent: "scout" }), why("lit1", "CLAUDE.md", { kind: "bash" }), why("lit1", "docs/l.md")].map((r) => r.replace(/"[^"]*"/, ""))).size);

  // unlockKinds (§7.2, §7.3 entry kinds)
  const root = path.join(T, "lit1");
  const LIST = ["CLAUDE.md", "harness/x.js", ".mcp.json", "approvals/x.json", ".git/config", "harness/keys/k.pem", "src/approvals/y.json", "templates/**", "harness/**", "src/a.cs",
    ".claude/settings.local.json", "harness/bin/ceo-keygen.sh", ".claude/settings.json", ".claude.json", ".company/x.json", "cfg/agents/x.md", "CLAUDE.m?", "harness/gate.j*"];
  const show = (k) => ["enforcement", "locked", "other"].map((n) => n + "=" + k[n].join(",")).join(" | ");
  for (const platform of BOTH) {
    const k = policy.unlockKinds(LIST, root, mk("lit1", { platform }));
    t(`[${platform}] unlockKinds, home elsewhere`, "enforcement=CLAUDE.md,harness/x.js,.mcp.json,.claude/settings.json | locked=approvals/x.json,.git/config,harness/keys/k.pem,src/approvals/y.json,.claude/settings.local.json,harness/bin/ceo-keygen.sh | other=templates/**,harness/**,src/a.cs,.claude.json,.company/x.json,cfg/agents/x.md,CLAUDE.m?,harness/gate.j*", show(k));
    const kh = policy.unlockKinds([".claude/settings.json", ".claude.json", ".company/x.json", "CLAUDE.md", "cfg/agents/x.md"], root, mk("lit1", { platform, env: { HOME: root } }));
    t(`[${platform}] unlockKinds, home = root`, "enforcement=CLAUDE.md | locked=.claude/settings.json,.claude.json,.company/x.json | other=cfg/agents/x.md", show(kh));
    const kc = policy.unlockKinds(["cfg/agents/x.md", "cfg/settings.json", "cfg/notes.md", "CLAUDE.md"], root, mk("lit1", { platform, env: { CLAUDE_CONFIG_DIR: path.join(root, "cfg") } }));
    t(`[${platform}] unlockKinds, CLAUDE_CONFIG_DIR = <root>/cfg`, "enforcement=CLAUDE.md | locked=cfg/agents/x.md,cfg/settings.json | other=cfg/notes.md", show(kc));
  }
  t("unlockKinds: upper-cased locked paths stay locked", "enforcement= | locked=APPROVALS/x.json,Harness/Keys/k.pem,src/Approvals/y.json,.CLAUDE/settings.local.json,HARNESS/BIN/CEO-KEYGEN.SH | other=",
    show(policy.unlockKinds(["APPROVALS/x.json", "Harness/Keys/k.pem", "src/Approvals/y.json", ".CLAUDE/settings.local.json", "HARNESS/BIN/CEO-KEYGEN.SH"], root, mk("lit1", {}))));
  t("unlockKinds: a literal that resolves into harness/keys is locked", "enforcement= | locked=src/lnk-keys/new.pem | other=", show(policy.unlockKinds(["src/lnk-keys/new.pem"], path.join(T, "ws1"), ctxFor(T, "ws1", "linux"))));
  t("unlockKinds: a literal whose resolved path is enforcement is listed (R-23)", "enforcement=docs/x.md | locked= | other=", show(policy.unlockKinds(["docs/x.md"], path.join(T, "ws1"), ctxFor(T, "ws1", "linux"))));
  t("unlockKinds: empty and null lists", "enforcement= | locked= | other=|enforcement= | locked= | other=", show(policy.unlockKinds([], root, mk("lit1", {}))) + "|" + show(policy.unlockKinds(null, root, mk("lit1", {}))));
  t("unlockKinds: a minimal context (as lint gives)", "enforcement=CLAUDE.md | locked=harness/keys/k.pem | other=templates/**", show(policy.unlockKinds(["CLAUDE.md", "harness/keys/k.pem", "templates/**"], root, { root, mainRoot: root, mode: "host", cfgDirs: [], home: null, platform: "linux" })));
}

// §7.3 (delta 2026-11-22, S-05): characters of category Cc, Cf, Zl and Zp are invalid in a glob.
function headerChars() {
  const H = (v) => "# Spec\n- Unlocks: " + v + "\n\n## 1. Intent\n";
  const BAD = [["U+202E right-to-left override (Cf)", "‮"], ["U+200B zero width space (Cf)", "​"], ["U+00AD soft hyphen (Cf)", "­"], ["U+2066 isolate (Cf)", "⁦"],
    ["U+0085 next line (C1, Cc)", "\u0085"], ["U+009B CSI (C1, Cc)", "\u009b"], ["U+0007 bell (Cc)", "\u0007"], ["U+001B escape (Cc)", "\u001b"], ["U+007F delete (Cc)", "\u007f"],
    ["U+2028 line separator (Zl)", " "], ["U+2029 paragraph separator (Zp)", " "], ["U+FEFF byte order mark (Cf)", "﻿"]];
  for (const [name, ch] of BAD) {
    for (const [where, g] of [["inside", "templates/a" + ch + "b.md"], ["in a literal enforcement entry", "CLAUDE" + ch + ".md"]]) {
      const r = policy.parseHeader(H("`templates/**`, `" + g + "`"));
      t(`${name} ${where}: field ignored`, "null", r.unlocks === null ? "null" : "list");
      t(`${name} ${where}: an error is returned`, true, r.errors.length > 0);
      t(`${name} ${where}: the error text is printable ASCII`, true, r.errors.every((e) => /^[\x20-\x7e]*$/.test(e)));
      t(`${name} ${where}: never matches`, false, policy.matchGlob(g, g, false));
    }
  }
  const okv = policy.parseHeader(H("`docs/café.md`, `docs/" + NFD + "`, `templates/中.md`, `docs/a b.md`"));
  t("letters outside ASCII, combining marks and a space stay valid", 4, okv.unlocks === null ? -1 : okv.unlocks.length);
  t("a tab between items is trimmed, not an error", "a|b", (policy.parseHeader(H("a,\tb")).unlocks || ["null"]).join("|"));
}

// Path aliases of macOS that realpath leaves in place (spec 0004 §7.1.1, appsec finding of 2026-11-23): the data-volume
// firmlink prefix names the same file, so it gets the class of the direct path; the `/.vol`, `/.nofollow` and `/.resolve`
// name spaces are refused. Runs on darwin only (policy.sh prints the skip line elsewhere); the temp tree and its HOME are scratch.
function alias(T) {
  if (process.platform !== "darwin") { console.log("skip (not darwin): path alias cases"); return; }
  const FL = "/System/Volumes/Data";
  const RT = fs.realpathSync(T);                                   // the firmlink form is built on the physical path
  const id = (p) => { const s = fs.statSync(p, { bigint: true }); return s.dev + "/" + s.ino; };
  const direct = (ws, p) => abs(RT, ws, p);
  const decision = (p, ctx) => policy.decide({ kind: "file", target: p, event: {} }, ctx).decision;
  t("setup: the firmlink form reaches the same file", id(direct("ws1", "src/a.cs")), id(FL + direct("ws1", "src/a.cs")));
  t("setup: the volfs form reaches the same file", id(direct("ws1", "src/a.cs")), id("/.vol/" + id(path.join(RT, "ws1")) + "/src/a.cs"));
  // [workspace, path, class of the direct path]; a `.company` member and `.claude.json` sit under the scratch HOME of the tree
  const CASES = [
    ["ws1", "src/a.cs", "code"], ["ws1", "src/new.cs", "code"], ["ws1", "newdir/sub/a.cs", "code"],
    ["ws1", ".git/config", "hard-deny"], ["ws1", ".git/hooks/pre-commit", "hard-deny"], ["ws1", "approvals/x.json", "hard-deny"],
    ["ws1", ".mcp.json", "enforcement"], ["ws1", "harness/new-hook.js", "enforcement"], ["ws1", ".claude/commands/x.md", "enforcement"],
    ["ws1", "CLAUDE.md", "enforcement"], ["ws1", ".claude/agents/x.md", "product-config"], ["ws1", "templates/x.md", "product-config"],
    ["ws1", "docs/real.md", "free"], ["ws1", ".claude/worktrees/w1/src/a.cs", "code"],
    ["ws1", "@H/.claude.json", "enforcement"], ["ws1", "@H/.company/keys/ceo.key.pem", "enforcement"], ["ws1", "@H/.company/x.json", "enforcement"],
    ["ws1", "@H/.claude/agents/x.md", "enforcement"], ["ws1", "@H/.claude/settings.json", "enforcement"],
    ["ws1", "@T/out/plain.txt", "outside"], ["ws1", "@T/ws3/src/b.cs", "outside"],
  ];
  const forms = [["firmlink", FL], ["firmlink in another case", "/system/volumes/DATA"]];
  for (const pf of BOTH) for (const [ws, p, want] of CASES) {
    const ctx = ctxFor(RT, ws, pf);
    t(`[${pf}] direct ${p} -> ${want}`, want, label(direct(ws, p), ctx));
    for (const [fname, pre] of forms) t(`[${pf}] ${fname} ${p} -> ${want}, as the direct path`, want, label(pre + direct(ws, p), ctx));
  }
  // decisions through the firmlink form equal the direct ones (ws1 has no active spec; no permission mode is reported)
  for (const [ws, p] of [["ws1", "src/a.cs"], ["ws1", ".git/config"], ["ws1", ".mcp.json"], ["ws1", ".claude/agents/x.md"], ["ws1", "@H/.claude.json"], ["ws1", "@H/.company/x.json"], ["ws1", "docs/real.md"], ["dws", "src/a.cs"], ["dws", "templates/x.md"]]) {
    const ctx = ctxFor(RT, ws, "darwin"); if (ws === "dws") ctx.pubkeyPath = path.join(RT, "dkeys", "ceo.pub.pem");
    const d = decision(direct(ws, p), ctx);
    t(`decide ${ws} ${p}: firmlink form decides as the direct path (${d})`, d, decision(FL + direct(ws, p), ctx));
    if (ws === "ws1" && p !== "docs/real.md") t(`decide ${ws} ${p}: the direct path is not waved through`, true, d === "ask" || d === "deny");
  }
  t("decide dws src/a.cs (signed): the direct path is allowed, so the firmlink case above is no over-block", "allow", (() => { const c = ctxFor(RT, "dws", "darwin"); c.pubkeyPath = path.join(RT, "dkeys", "ceo.pub.pem"); return decision(direct("dws", "src/a.cs"), c); })());
  // the root, the main root and the home themselves given in the firmlink form
  for (const pf of BOTH) {
    t(`[${pf}] root in the firmlink form, direct path -> code`, "code", label(direct("ws1", "src/a.cs"), ctxFor(RT, "ws1", pf, { root: FL + path.join(RT, "ws1"), mainRoot: FL + path.join(RT, "ws1") })));
    t(`[${pf}] main root (REQ-35): firmlink form of a main-tree file -> code`, "code", label(FL + direct("dws", "src/a.cs"), ctxFor(RT, "ws1", pf, { mainRoot: path.join(RT, "dws") })));
    t(`[${pf}] main root (REQ-35): firmlink form of the main tree's .mcp.json -> enforcement`, "enforcement", label(FL + direct("dws", ".mcp.json"), ctxFor(RT, "ws1", pf, { mainRoot: path.join(RT, "dws") })));
    t(`[${pf}] CLAUDE_CONFIG_DIR member in the firmlink form -> enforcement`, "enforcement", label(FL + path.join(RT, "cfg", "agents", "x.md"), ctxFor(RT, "ws1", pf, null, { CLAUDE_CONFIG_DIR: path.join(RT, "cfg") })));
    t(`[${pf}] home given in the firmlink form, direct .company member -> enforcement`, "enforcement", label(path.join(RT, "home", ".company", "x.json"), ctxFor(RT, "ws1", pf, { home: FL + path.join(RT, "home") })));
  }
  // a symlink inside the workspace that points at the firmlink form of an enforcement member
  const lk = path.join(RT, "ws1", "docs", "fl-mcp.md");
  try { fs.unlinkSync(lk); } catch { /* first run */ }
  fs.symlinkSync(FL + path.join(RT, "ws1", ".mcp.json"), lk);
  t("symlink in docs/ to the firmlink form of .mcp.json -> enforcement", "enforcement", label(lk, ctxFor(RT, "ws1", "darwin")));
  // name spaces that reach a file without naming where it is: refused (fail closed), whatever the class of the file
  const ws1 = path.join(RT, "ws1");
  const magic = [
    ["volfs of the workspace root + src/a.cs", "/.vol/" + id(ws1) + "/src/a.cs"],
    ["volfs of the file itself", "/.vol/" + id(path.join(ws1, "src", "a.cs"))],
    ["volfs of src + a new file name", "/.vol/" + id(path.join(ws1, "src")) + "/new.cs"],
    ["volfs of the workspace root + .git/config", "/.vol/" + id(ws1) + "/.git/config"],
    ["volfs of the workspace root + .mcp.json", "/.vol/" + id(ws1) + "/.mcp.json"],
    ["volfs of the workspace root + .claude/agents/x.md", "/.vol/" + id(ws1) + "/.claude/agents/x.md"],
    ["volfs of the scratch home + .claude.json", "/.vol/" + id(path.join(RT, "home")) + "/.claude.json"],
    ["volfs of the scratch home + .company/x.json", "/.vol/" + id(path.join(RT, "home")) + "/.company/x.json"],
    ["volfs of a file outside every root", "/.vol/" + id(path.join(RT, "out")) + "/plain.txt"],
    ["volfs of nothing", "/.vol/1/1/x"],
    ["/.nofollow + src/a.cs", "/.nofollow" + path.join(ws1, "src", "a.cs")],
    ["/.nofollow + firmlink + src/a.cs", "/.nofollow" + FL + path.join(ws1, "src", "a.cs")],
    ["/.resolve/1 + src/a.cs", "/.resolve/1" + path.join(ws1, "src", "a.cs")],
    ["/.resolve/1 + a new file name", "/.resolve/1" + path.join(ws1, "src", "new.cs")],
  ];
  for (const pf of BOTH) for (const [name, p] of magic) t(`[${pf}] ${name} -> refused`, "refused", label(p, ctxFor(RT, "ws1", pf)));
  for (const [name, p] of magic) t(`decide ${name} -> deny`, "deny", decision(p, ctxFor(RT, "ws1", "darwin")));
  const vl = path.join(ws1, "docs", "vol-link");
  try { fs.unlinkSync(vl); } catch { /* first run */ }
  fs.symlinkSync("/.vol/" + id(path.join(ws1, "src")), vl);
  t("symlink in docs/ to the volfs form of src, then a.cs -> refused", "refused", label(path.join(vl, "a.cs"), ctxFor(RT, "ws1", "darwin")));
  t("a root given in the volfs form -> refused", "refused", label(direct("ws1", "src/a.cs"), ctxFor(RT, "ws1", "darwin", { root: "/.vol/" + id(ws1), mainRoot: "/.vol/" + id(ws1) })));
}

// Spellings that reach a file only through the full case folding of a case-insensitive volume (spec 0004 §7.1.1, REQ-3,
// Ruling R-14; appsec recheck of 2026-11-23): U+017F long s = s, U+00DF sharp s = ss, U+FB01 fi ligature = fi. Each gets
// the class and the decision of the direct path; a named enforcement file is never opened through such a spelling.
// Runs on darwin only (policy.sh prints the skip line elsewhere). Tree <T>/sfiss, built by policy.sh; HOME and cfg are scratch.
function foldCases(T) {
  if (process.platform !== "darwin") { console.log("skip (not darwin): case-fold spelling cases"); return; }
  const RT = fs.realpathSync(T), X = path.join(RT, "sfiss"), FL = "/System/Volumes/Data";
  const id = (p) => { try { const s = fs.statSync(p, { bigint: true }); return s.dev + "/" + s.ino; } catch (e) { return "none:" + e.code; } };
  const SPELL = [["U+017F", (s) => s.replace(/s/g, "ſ")], ["U+00DF", (s) => s.replace(/ss/g, "ß")], ["U+FB01", (s) => s.replace(/fi/g, "ﬁ")]];
  const ctx = (ws, pf) => Object.assign(ctxFor(RT, path.join("sfiss", ws), pf, null, { HOME: path.join(X, "home"), CLAUDE_CONFIG_DIR: path.join(X, "cfg") }), { pubkeyPath: path.join(RT, "dkeys", "ceo.pub.pem") });
  const decision = (p, c, kind) => policy.decide({ kind: kind || "file", target: p, event: {} }, c).decision;
  const show = (s) => JSON.stringify(s).replace(/[^\x20-\x7e]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
  // [workspace, path below <T>/sfiss, class of the direct path, the file exists]
  const CASES = [
    ["fg", "fg/.git/config", "hard-deny", true], ["fw", "fw/approvals/x.json", "hard-deny", true], ["fw", "fw/approvals/sfiss/new.json", "hard-deny", false],
    ["fw", "fw/harness/keys/x.pem", "enforcement", true], ["fw", "fw/harness/stop.js", "enforcement", true], ["fw", "fw/.claude/settings.json", "enforcement", true],
    ["fw", "fw/.mcp.json", "enforcement", true], ["fw", "fw/harness/new.js", "enforcement", false], ["fw", "fw/newdir/harness/keys/sfiss.pem", "enforcement", false],
    ["fw", "home/.claude.json", "enforcement", true], ["fw", "home/.company/keys/x.pem", "enforcement", true], ["fw", "home/.claude/settings.json", "enforcement", true],
    ["fw", "home/.claude/agents/x.md", "enforcement", true], ["fw", "cfg/agents/sfiss.md", "enforcement", true], ["fw", "cfg/settings.json", "enforcement", true],
    ["fw", "fw/templates/sfiss.md", "product-config", true], ["fw", "fw/src/sfiss.cs", "code", true], ["fw", "fw/src/new-sfiss.cs", "code", false], ["fw", "fw/docs/sfiss.md", "free", true],
  ];
  let spelled = 0;
  for (const [ws, rel, want, exists] of CASES) {
    const direct = path.join(X, rel), c = ctx(ws, "darwin"), d = decision(direct, c);
    t(`[darwin] direct ${rel} -> ${want}`, want, label(direct, c));
    if (want !== "free") t(`decide direct ${rel}: not waved through`, true, d === "ask" || d === "deny");
    for (const [uname, sp] of SPELL) {
      // the root prefix respelled, the member respelled, and the data-volume firmlink prefix respelled (U+017F only: no "ss", no "fi" in it)
      const forms = [["root prefix", path.join(RT, sp("sfiss"), rel)], ["member", path.join(X, sp(rel))], ["firmlink prefix", sp("/System") + "/Volumes/Data" + direct]];
      for (const [fname, p] of forms) {
        if (p === direct || p === FL + direct) continue;
        spelled++;
        const name = `${uname} ${fname} ${show(path.relative(RT, p.startsWith(RT) ? p : p.slice(FL.length)))}`;
        if (exists) t(`setup ${name}: names the same file`, id(direct), id(p));
        t(`[darwin] ${name} -> ${want}, as the direct path`, want, label(p, c));
        t(`decide ${name}: as the direct path (${d})`, d, decision(p, c));
        // rows 1, 2 and 4 fold on every platform (Ruling R-14); a root is folded on darwin and win32 only
        if (fname === "member" && want !== "code" && want !== "free") t(`[linux] ${name} -> ${want}`, want, label(p, ctx(ws, "linux")));
      }
    }
  }
  t("the spelling loop is not vacuous (100+ spellings)", true, spelled >= 100);
  t("[linux] U+017F docs/ is not free (row 5 folds on darwin and win32 only)", "code", label(path.join(X, "fw", "docſ", "sfiss.md"), ctx("fw", "linux")));
  // other characters of the same kind: U+1E9E capital sharp s, U+FB06 st ligature, U+212A kelvin sign
  for (const [uname, p, plain] of [["U+1E9E", "fw/harneẞ/stop.js", "fw/harness/stop.js"], ["U+FB06", "fw/harness/ﬆop.js", "fw/harness/stop.js"],
    ["U+212A", "fw/harness/Keys/x.pem", "fw/harness/keys/x.pem"], ["U+FB06 firmlink prefix", null, "fw/harness/stop.js"]]) {
    const direct = path.join(X, plain);
    const sp = p === null ? "/Syﬆem/Volumes/Data" + direct : path.join(X, p);
    t(`setup ${uname}: names the same file`, id(direct), id(sp));
    t(`[darwin] ${uname} -> enforcement`, "enforcement", label(sp, ctx("fw", "darwin")));
    t(`decide ${uname}: as the direct path`, decision(direct, ctx("fw", "darwin")), decision(sp, ctx("fw", "darwin")));
  }
  // a spelling that existed before this fix keeps its class: plain upper case
  t("[darwin] upper-cased root prefix -> code (unchanged)", "code", label(path.join(RT, "SFISS", "fw/src/sfiss.cs"), ctx("fw", "darwin")));
  t("[linux] upper-cased root prefix -> outside (unchanged)", "outside", label(path.join(RT, "SFISS", "fw/src/sfiss.cs"), ctx("fw", "linux")));

  // a named enforcement file under a signed spec (fsig: harness/stop.js, .mcp.json): only its own spelling is opened (R-20)
  const sc = ctx("fsig", "darwin"), S = path.join(X, "fsig");
  t("signed: named harness/stop.js, direct -> allow", "allow", decision(path.join(S, "harness/stop.js"), sc));
  t("signed: named .mcp.json, direct -> allow", "allow", decision(path.join(S, ".mcp.json"), sc));
  t("signed: code, direct -> allow", "allow", decision(path.join(S, "src/sfiss.cs"), sc));
  const NOT = [["U+017F in harness", "harneſs/stop.js"], ["U+017F twice in harness", "harneſſ/stop.js"], ["U+00DF in harness", "harneß/stop.js"], ["U+1E9E in harness", "harneẞ/stop.js"],
    ["U+017F in stop.js", "harness/ſtop.js"], ["U+FB06 in stop.js", "harness/ﬆop.js"], ["U+017F in .js", "harness/stop.jſ"], ["U+017F in .mcp.json", ".mcp.jſon"],
    ["U+017F root prefix", "../../" + "ſfiss/fsig/harness/stop.js"], ["U+00DF root prefix", "../../sfiß/fsig/harness/stop.js"], ["U+FB01 root prefix", "../../sﬁss/fsig/harness/stop.js"],
    ["U+FB01 root prefix, .mcp.json", "../../sﬁss/fsig/.mcp.json"]];
  for (const [name, rel] of NOT) {
    const p = path.join(S, rel);
    t(`setup signed ${name}: names the named file`, id(path.join(S, rel.includes(".mcp") ? ".mcp.json" : "harness/stop.js")), id(p));
    t(`signed ${name}: enforcement`, "enforcement", label(p, sc));
    t(`signed ${name}: not opened by the entry -> ask`, "ask", decision(p, sc));
    t(`signed ${name}: Bash writer -> ask`, "ask", decision(p, sc, "bash"));
  }
  for (const pre of ["/Syſtem/Volumes/Data", "/Syﬆem/Volumes/Data"]) {
    t(`setup signed ${show(pre)}: names the named file`, id(path.join(S, "harness/stop.js")), id(pre + path.join(S, "harness/stop.js")));
    t(`signed ${show(pre)} + named harness/stop.js: not opened -> ask`, "ask", decision(pre + path.join(S, "harness/stop.js"), sc));
    t(`signed ${show(pre)} + code -> allow, as the direct path`, "allow", decision(pre + path.join(S, "src/sfiss.cs"), sc));
  }
  t("signed: the firmlink prefix in plain upper case still opens the named file (unchanged)", "allow", decision("/SYSTEM/VOLUMES/DATA" + path.join(S, "harness/stop.js"), sc));
  t("signed: the root prefix in plain upper case still opens the named file (unchanged)", "allow", decision(path.join(RT, "SFISS", "fsig/harness/stop.js"), sc));
  t("signed: HARNESS/stop.js against the entry harness/stop.js -> ask (unchanged)", "ask", decision(path.join(S, "HARNESS/stop.js"), sc));
  for (const [uname, sp] of SPELL) {
    t(`signed ${uname} code root prefix -> allow, as the direct path`, "allow", decision(path.join(RT, sp("sfiss"), "fsig/src/sfiss.cs"), sc));
    t(`signed ${uname} code member -> allow, as the direct path`, "allow", decision(path.join(S, sp("src/sfiss.cs")), sc));
    t(`signed ${uname} approvals/ member -> deny`, "deny", decision(path.join(S, sp("approvals/sfiss.json")), sc));
  }
  // an on-disk spelling that the fold does not explain (injected): the class of the on-disk name still holds, and nothing is opened
  const odd = (p) => p.split("zzz-unexplained").join("harness");
  const oddFs = Object.assign({}, fs, { realpathSync: Object.assign((p) => fs.realpathSync(p), { native: (p) => fs.realpathSync.native(odd(String(p))) }) });
  const oc = Object.assign(ctx("fsig", "darwin"), { fs: oddFs });
  t("injected on-disk spelling: zzz-unexplained/stop.js is harness/stop.js on disk -> enforcement", "enforcement", label(path.join(S, "zzz-unexplained/stop.js"), oc));
  t("injected on-disk spelling: not opened by the entry -> ask", "ask", decision(path.join(S, "zzz-unexplained/stop.js"), oc));
  t("without the injection the same text is code", "code", label(path.join(S, "zzz-unexplained/stop.js"), sc));
}

// Spec 0010 R-5 (AC-2): the secret-file name and allowed-location functions of policy.js. Throwaway tree under <T>/names.
function names(T) {
  const N = path.join(T, "names"); const R = path.join(N, "repo"); const TMP = path.join(N, "tmp");
  fs.mkdirSync(path.join(R, "android", "app"), { recursive: true }); fs.mkdirSync(path.join(R, "ios", "android", "app"), { recursive: true });
  fs.mkdirSync(path.join(TMP, "k"), { recursive: true }); fs.mkdirSync(path.join(N, "tmp-evil"), { recursive: true });
  for (const f of ["android/app/debug.keystore", "android/app/release.jks", "ios/android/app/debug.keystore"]) fs.writeFileSync(path.join(R, f), "x");
  fs.symlinkSync(path.join(R, "android", "app", "release.jks"), path.join(TMP, "link.jks"));
  fs.symlinkSync(path.join(TMP, "k"), path.join(N, "tmp-link"));
  const sec = (w) => policy.secretFileName(w);
  for (const [w, want] of [["release.jks", "*.jks"], ["a/b/Upload.KEYSTORE", "*.keystore"], ["x.p12", "*.p12"], ["x.p8", "*.p8"], ["x.mobileprovision", "*.mobileprovision"],
    ["key.properties", "key.properties"], ["android/key.properties", "key.properties"], ["X=release.jks", "*.jks"], ["-Pstore=upload.p12", "*.p12"], ["--ks=/a/b/Rel.JKS", "*.jks"],
    ["storeFile=../key.properties", "key.properties"], ["debug.keystore", "*.keystore"], ["my release.jks", "*.jks"]]) t("secretFileName " + w, want, sec(w));
  for (const w of ["x.jksx", "jks", "keyXproperties", "key.properties.bak", "a.pfx", "a.pepk", "credentials.json", "a.jks/b", "", "x=y", "docs/readme.md"]) t("secretFileName none: " + JSON.stringify(w), "null", String(sec(w)));
  for (const [w, want] of [["x.jks", "*.jks"], ["a.PFX", "*.pfx"], ["g.pepk", "*.pepk"], ["credentials.json", "credentials.json"], ["Credentials.JSON", "credentials.json"], ["key.properties", "key.properties"], ["d.p8", "*.p8"], ["e.mobileprovision", "*.mobileprovision"], ["c.p12", "*.p12"], ["x.keystore", "*.keystore"]])
    t("scanName " + w, want, String(policy.scanName(w)));
  for (const w of ["credentials.json.bak", "readme.md", "key.props", "xjks"]) t("scanName none: " + w, "null", String(policy.scanName(w)));
  const al = (w, cwd, over) => String(policy.allowedLocation(w, cwd || R, R, Object.assign({ tempDirs: [TMP] }, over || {})));
  t("allowed: relative debug.keystore", "true", al("android/app/debug.keystore"));
  t("allowed: absolute debug.keystore", "true", al(path.join(R, "android", "app", "debug.keystore")));
  t("allowed: ./ and .. spelling of debug.keystore", "true", al("./android/../android/app/debug.keystore"));
  t("not allowed: debug.keystore under another folder", "false", al("ios/android/app/debug.keystore"));
  t("not allowed: release.jks next to it", "false", al("android/app/release.jks"));
  t("not allowed: debug.keystore of a different root", "false", String(policy.allowedLocation(path.join(R, "android", "app", "debug.keystore"), R, path.join(N, "other"), { tempDirs: [TMP] })));
  t("allowed: keystore under the temp set", "true", al(path.join(TMP, "k", "x.jks")));
  t("allowed: relative to a cwd inside the temp set", "true", al("k/x.jks", TMP));
  t("not allowed: temp-set sibling sharing the prefix", "false", al(path.join(N, "tmp-evil", "x.jks")));
  t("not allowed: .. leaves the temp set", "false", al(path.join(TMP, "..", "repo", "android", "app", "release.jks")));
  t("not allowed: temp symlink to a keystore outside it", "false", al(path.join(TMP, "link.jks")));
  t("allowed: a temp folder that is a symlink inside the set (written and resolved form both inside)", "true", al(path.join(N, "tmp-link", "x.jks"), N, { tempDirs: [TMP, path.join(N, "tmp-link")] }));
  t("not allowed: written form outside the temp set", "false", al(path.join(N, "tmp-link", "x.jks")));
  t("not allowed: variable, glob, tilde, backslash, empty", "false,false,false,false,false", ["$H/x.jks", path.join(TMP, "*.jks"), "~/x.jks", "a\\b.jks", ""].map((w) => al(w)).join(","));
  t("default temp set holds /tmp and the resolved os.tmpdir()", "true,true", [policy.allowedLocation("/tmp/k/x.jks", "/", R), policy.allowedLocation(path.join(fs.realpathSync(require("os").tmpdir()), "k", "x.jks"), "/", R)].join(","));
  t("default temp set does not hold the home folder", "false", String(policy.allowedLocation("/Users/x/app/x.jks", "/", R)));
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "names") names(a);
else if (cmd === "matrix") matrix(a);
else if (cmd === "alias") alias(a);
else if (cmd === "fold") foldCases(a);
else if (cmd === "paths") for (const m of MATRIX) for (const pf of m[4]) console.log([m[3], pf, m[1], abs(a, m[1], m[2])].join("\t"));
else if (cmd === "superset") superset(a, b);
else if (cmd === "header") header();
else if (cmd === "decide") decide(a);
else if (cmd === "source") source();
else if (cmd === "literal") literal(a);
else if (cmd === "header-chars") headerChars();
else { console.error("usage: policy-driver.js matrix|paths|superset|header|decide|source"); process.exit(2); }
process.exit(failed ? 1 : 0);
