// policy.js: the one shared write policy of the company hooks (spec 0004 §7.1, §7.1.1, §7.2, §7.3, §7.7).
// Used by gate.js (file tools) and guard.js (Bash writer targets); it prints nothing and never exits.
//   context(event, opts)        root, main worktree, home configuration, records and key locations
//   classify(absPath, ctx)      final path class: lexical and resolved path, stronger class wins (§7.1.1)
//   parseHeader(text)           the `- Unlocks:` list of a spec header (§7.3)
//   matchGlob(glob, rel, fold)  glob match against a root-relative POSIX path (§7.3)
//   decide(req, ctx)            allow | ask | deny | none for one write target
// A reason is returned without the hook prefix: the hook adds "BLOCKED by company <gate|guard>: " or "CEO onayı gerekir: ".
// No side effects at load. approval.js is loaded only when a signature has to be checked.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

// Modes in which a hook "ask" is proven to reach the CEO as a dialog (T-1 record, docs/kanit/0004-t1.md).
// Any other reported mode turns an ask into a refusal; no reported mode asks (§7.7).
const ASK_MODES = Object.freeze(["default", "acceptEdits"]);

// Today's guard expression (guard.js ENFORCEMENT), compared case-insensitively (REQ-3). policy.sh asserts the two sources are equal.
const ENFORCEMENT = /(^|\/)(harness\/(guard|gate|stop|approval|loop)\.js|harness\/keys\/|harness\/container-settings\.json|\.claude\/settings(\.local)?\.json|approvals\/|\.github\/workflows\/|CLAUDE\.md$)/i;
// Row 2 members that hold anywhere on disk, tested on the lower-cased absolute POSIX path.
const ANYWHERE = /(^|\/)(claude\.md|approvals(\/.*)?|harness\/keys(\/.*)?|\.github\/workflows(\/.*)?|harness\/(approval|gate|guard|loop|notify|policy|stop)\.js|harness\/container-settings\.json|harness\/bin\/(approve|ceo-keygen|company-run|install-project|install-global)\.sh|\.claude\/settings\.json|\.claude\/settings\.local\.json)$/;
const CFG_TREES = new Set(["agents", "skills", "rules", "commands", "hooks", "plugins"]);

const LABELS = { 1: "hard-deny", 2: "enforcement", 4: "product-config", 5: "free", 6: "code", 7: "outside" };
// hard-deny > enforcement > product-config > code > outside > free (Ruling R-17)
const STRENGTH = { 1: 6, 2: 5, 4: 4, 6: 3, 7: 2, 5: 1 };

class ResolveError extends Error {
  constructor(p, cause) {
    super("cannot resolve " + quote(p) + " (" + ((cause && cause.code) || "error") + ")");
    this.name = "ResolveError"; this.code = (cause && cause.code) || "ERESOLVE";
  }
}

const nfc = (s) => String(s).normalize("NFC");
const posix = (p) => (path.sep === "/" ? p : p.split(path.sep).join("/"));
const foldFs = (platform) => platform === "darwin" || platform === "win32";
const foldGlobs = foldFs;
// Every path, glob or mode text taken from an event or a spec appears in a reason as a JSON string literal, cut to 200 characters (§7.8).
function quote(s) {
  const q = JSON.stringify(String(s));
  return q.length > 200 ? q.slice(0, 199) + "…" : q;
}

// Segments of `p` below `root`, [] when equal, null when not under it. Compared per segment, so folding never shifts a cut.
function segsUnder(p, root, fold) {
  const split = (x) => posix(x).split("/").filter(Boolean);
  const a = split(p), b = split(root);
  if (path.parse(p).root.toLowerCase() !== path.parse(root).root.toLowerCase() || a.length < b.length) return null;
  for (let i = 0; i < b.length; i++) if (fold ? a[i].toLowerCase() !== b[i].toLowerCase() : a[i] !== b[i]) return null;
  return a.slice(b.length);
}

// realpath(nearest existing ancestor) + remaining segments. A dangling symlink is followed to its target.
// Only "does not exist" (ENOENT) lets the walk go on; any other error refuses the write (REQ-4).
function resolvePath(p, fsx) {
  let cur = p; const rest = []; let hops = 0;
  for (;;) {
    try { return nfc(path.join(fsx.realpathSync(cur), ...rest)); }
    catch (e) {
      if (!e || e.code !== "ENOENT") throw new ResolveError(p, e);
      let st = null;
      try { st = fsx.lstatSync(cur); } catch (e2) { if (!e2 || e2.code !== "ENOENT") throw new ResolveError(p, e2); }
      if (st && st.isSymbolicLink()) {
        if (++hops > 40) throw new ResolveError(p, { code: "ELOOP" });
        try { cur = path.resolve(fsx.realpathSync(path.dirname(cur)), fsx.readlinkSync(cur)); } catch (e3) { throw new ResolveError(p, e3); }
        continue;
      }
      const parent = path.dirname(cur);
      if (parent === cur) return nfc(path.join(cur, ...rest));
      rest.unshift(path.basename(cur)); cur = parent;
    }
  }
}

// One classification (lexical or resolved): first matching row of the §7.1 table, top to bottom.
// R: workspace root, M: main worktree root when the main-root rule applies (else null); both in the same form as `abs`.
function classifyOne(abs, R, M, env) {
  const fold = foldFs(env.platform);
  let root = null;
  let segs = segsUnder(abs, R, fold);
  if (segs) root = R;
  else if (M && (segs = segsUnder(abs, M, fold))) root = M;                 // main-root rule (REQ-35)
  // row 3, nested root (exact case): re-root, never final
  while (root !== null && segs.length >= 4 && segs[0] === ".claude" && segs[1] === "worktrees") {
    root = path.join(root, ".claude", "worktrees", segs[2]); segs = segs.slice(3);
  }
  const absPosix = posix(abs);
  const out = (row) => (root !== null
    ? { row, root, rel: segs.join("/") }
    : { row, root: path.parse(abs).root, rel: posix(path.relative(path.parse(abs).root, abs)) });
  const rel = root !== null ? segs.join("/") : null;
  const lrel = rel !== null ? rel.toLowerCase() : null;
  const at = (dir, s) => s === dir || s.startsWith(dir + "/");

  // row 1, hard-deny
  if (root !== null && (at("approvals", lrel) || at(".git", lrel))) return out(1);
  // row 2, enforcement: anywhere on disk
  if (ENFORCEMENT.test(absPosix) || ANYWHERE.test(absPosix.toLowerCase())) return out(2);
  for (const c of env.cfgDirs) {
    const s = segsUnder(abs, c, true);
    if (!s || !s.length) continue;
    const first = s[0].toLowerCase();
    if (s.length === 1 && (/^settings.*\.json$/.test(first) || first === ".claude.json")) return out(2);
    if (CFG_TREES.has(first)) return out(2);
  }
  for (const h of env.homes) {
    const s = segsUnder(abs, h, true);
    if (!s || !s.length) continue;
    const first = s[0].toLowerCase();
    if ((s.length === 1 && first === ".claude.json") || first === ".company") return out(2);
  }
  if (root === null) return out(7);
  // row 2, R-relative; the carve-outs to row 4 match with exact case (Ruling R-14)
  if (/^harness\/[^/]*\.js$/.test(lrel) || lrel === ".mcp.json") return out(2);
  if (at(".claude", lrel)) {
    if (rel.startsWith(".claude/agents/") || rel.startsWith(".claude/skills/") || rel.startsWith(".claude/rules/")) return out(4);
    return out(2);
  }
  // row 4, product-config
  if (at("harness", lrel) || at("evals", lrel) || at("templates", lrel)) return out(4);
  // row 5, free: folded on darwin and win32 only
  const frel = fold ? lrel : rel;
  if (at("specs", frel) || at("docs", frel) || at("plans", frel) || frel === (fold ? "state.md" : "STATE.md")) return out(5);
  return out(6);
}

// classify(absPath, ctx): §7.1.1. Throws ResolveError (-> deny) when the path cannot be resolved.
function classify(absPath, ctx) {
  const fsx = ctx.fs || fs;
  const abs = path.resolve(String(absPath));
  const R = path.resolve(ctx.root);
  const M = ctx.mode !== "container" && ctx.mainRoot && path.resolve(ctx.mainRoot) !== R ? path.resolve(ctx.mainRoot) : null;
  // Home configuration is matched in both forms for both classifications: a write through an alias of ~/.claude is still row 2.
  const both = (dirs) => {
    const set = new Set();
    for (const d of dirs || []) {
      if (!d) continue;
      set.add(nfc(path.resolve(d)));
      try { set.add(resolvePath(path.resolve(d), fsx)); } catch { /* lexical form only */ }
    }
    return [...set];
  };
  const env = { platform: ctx.platform || process.platform, cfgDirs: both(ctx.cfgDirs), homes: both(ctx.home ? [ctx.home] : []) };
  const lexical = classifyOne(nfc(abs), nfc(R), M && nfc(M), env);
  const resolved = classifyOne(resolvePath(abs, fsx), resolvePath(R, fsx), M && resolvePath(M, fsx), env);
  const fin = STRENGTH[lexical.row] > STRENGTH[resolved.row] ? lexical : resolved;      // tie: the resolved path is reported
  return { row: fin.row, root: fin.root, rel: fin.rel, label: LABELS[fin.row], lexical, resolved };
}

// ---- `Unlocks:` header (§7.3) ---------------------------------------------------------------
function globError(g) {
  if (g === "") return "empty item";
  if (/[{}\[\]!~$\\`]/.test(g)) return "character not allowed in " + quote(g);
  if (g.startsWith("/")) return "absolute glob " + quote(g);
  for (const seg of g.split("/")) {
    if (seg === "") return "empty segment in " + quote(g);
    if (seg === "." || seg === "..") return "'.' or '..' segment in " + quote(g);
    if (seg !== "**" && seg.includes("**")) return "'**' inside a segment in " + quote(g);
  }
  return null;
}

function parseHeader(text) {
  const lines = String(text).split("\n");
  const end = lines.findIndex((l) => l.startsWith("## "));
  const fields = (end < 0 ? lines : lines.slice(0, end)).map((l) => l.replace(/\r$/, "")).filter((l) => l.startsWith("- Unlocks:"));
  if (fields.length === 0) return { unlocks: [], errors: [] };
  if (fields.length > 1) return { unlocks: null, errors: ["'- Unlocks:' appears " + fields.length + " times in the header"] };
  const m = /^- Unlocks: (.*)$/.exec(fields[0]);
  if (!m) return { unlocks: null, errors: ["malformed '- Unlocks:' line (one space after the colon)"] };
  const unlocks = [], errors = [];
  for (const item of m[1].split(",")) {
    let g = item.trim();
    if (g.length >= 2 && g.startsWith("`") && g.endsWith("`")) g = g.slice(1, -1).trim();
    const err = globError(g);
    if (err) errors.push(err); else unlocks.push(g);
  }
  return errors.length ? { unlocks: null, errors } : { unlocks, errors: [] };
}

const segRegex = (seg, fold) => new RegExp("^" + seg.replace(/[.+^$()|{}\[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$", fold ? "i" : "");
function matchGlob(glob, rel, fold) {
  glob = nfc(glob); rel = nfc(rel);
  if (globError(glob)) return false;
  const gs = glob.split("/"), ps = rel.split("/");
  if (rel === "" || ps.some((s) => s === "")) return false;
  const res = gs.map((g) => (g === "**" ? null : segRegex(g, fold)));
  const go = (i, j) => {
    if (i === gs.length) return j === ps.length;
    if (res[i] === null) { for (let k = j; k <= ps.length; k++) if (go(i + 1, k)) return true; return false; }
    return j < ps.length && res[i].test(ps[j]) && go(i + 1, j + 1);
  };
  return go(0, 0);
}

// ---- context (§7.2) -------------------------------------------------------------------------
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const hasGit = (dir) => { try { fs.lstatSync(path.join(dir, ".git")); return true; } catch { return false; } };

// Main worktree of `dir` (Ruling R-4). No git metadata in `dir` -> `dir` itself, without a git call. Throws when the lookup fails.
function mainWorktree(dir, env) {
  if (!hasGit(dir)) return dir;
  const out = execFileSync("git", ["-C", dir, "rev-parse", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000, env: env || process.env }).trim();
  if (!out) throw new Error("git lookup failed");
  const common = path.resolve(dir, out);
  return path.basename(common) === ".git" ? path.dirname(common) : dir;
}

function context(event, opts) {
  event = event || {}; opts = opts || {};
  const env = opts.env || {};
  const mode = opts.mode === "container" ? "container" : "host";
  const platform = opts.platform || process.platform;
  const harnessDir = path.resolve(opts.harnessDir || __dirname);
  const cwd = path.resolve(event.cwd || process.cwd());
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const cfgDirs = [path.join(home, ".claude")];
  if (env.CLAUDE_CONFIG_DIR) cfgDirs.push(path.resolve(cwd, env.CLAUDE_CONFIG_DIR));
  const ctx = { mode, root: cwd, mainRoot: cwd, cfgDirs, home, approvalsDir: null, pubkeyPath: null, platform,
    permissionMode: event.permission_mode, agentType: event.agent_type, env, harnessDir, rootLookupFailed: false, specOverride: null };
  if (mode === "container") {                                   // today's environment handling (Ruling R-13), no git lookup
    ctx.approvalsDir = path.join(cwd, "approvals");
    ctx.pubkeyPath = env.COMPANY_PUBKEY || path.join(env.COMPANY_HARNESS_DIR || harnessDir, "keys", "ceo.pub.pem");
    ctx.specOverride = env.COMPANY_SPEC || null;
    return ctx;
  }
  ctx.root = env.CLAUDE_PROJECT_DIR ? path.resolve(cwd, env.CLAUDE_PROJECT_DIR) : cwd;
  ctx.mainRoot = ctx.root;
  if (isDir(path.join(ctx.root, "specs"))) {                    // REQ-11: no git lookup without specs/
    try { ctx.mainRoot = mainWorktree(ctx.root, env); } catch { ctx.rootLookupFailed = true; }
  }
  ctx.approvalsDir = path.join(ctx.mainRoot, "approvals");
  // The CEO public key comes from the main worktree of the harness in use (REQ-13); looked up on first use, null when the lookup fails (REQ-14).
  let pub;
  Object.defineProperty(ctx, "pubkeyPath", { enumerable: true, configurable: true,
    get() {
      if (pub === undefined) {
        try { pub = path.join(mainWorktree(path.dirname(harnessDir), env), "harness", "keys", "ceo.pub.pem"); } catch { pub = null; }
      }
      return pub;
    },
    set(v) { pub = v; } });
  return ctx;
}

// ---- decide (§7.1 table, §7.7) --------------------------------------------------------------
const MODE_TAIL = "Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement, signatures, .git: no spec covers them, default mode only).";

// Signature state of the single active spec of `root`. Records come from `approvalsDir`, the header from the verified bytes (REQ-19).
function authority(root, approvalsDir, ctx) {
  const dir = path.join(root, "specs", "active");
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { /* no active directory */ }
  if (ctx.specOverride) names = [ctx.specOverride];
  if (names.length !== 1) return { ok: false, count: names.length, why: "active spec count " + names.length };
  const spec = path.join(dir, names[0]);
  const approval = require("./approval.js");
  let buf;
  try { buf = fs.readFileSync(spec); } catch { return { ok: false, count: 1, why: "spec not readable" }; }
  let ok, why;
  if (typeof approval.verifyBuffer === "function") [ok, why] = approval.verifyBuffer(path.relative(root, spec), buf, approvalsDir, ctx.pubkeyPath);
  else {
    [ok, why] = approval.verify(spec, approvalsDir, ctx.pubkeyPath, root);
    if (ok && !fs.readFileSync(spec).equals(buf)) { ok = false; why = "spec changed during the check"; }
  }
  return ok ? { ok: true, count: 1, why, unlocks: parseHeader(buf.toString("utf8")).unlocks } : { ok: false, count: 1, why };
}

function decide(req, ctx) {
  const event = req.event || {};
  const kind = req.kind === "bash" ? "bash" : "file";
  const container = ctx.mode === "container";
  const target = path.resolve(event.cwd || ctx.root, String(req.target));
  const res = (decision, reason, c) => ({ decision, reason: reason || "", row: c ? c.row : null, rel: c ? c.rel : posix(path.relative(ctx.root, target)) });
  let c;
  try { c = classify(target, ctx); }
  catch (e) {
    if (!(e instanceof ResolveError)) throw e;
    return res("deny", "the path " + quote(req.target) + " cannot be resolved (" + e.code + ", fail closed)");
  }
  const q = quote(c.rel);
  const realRoot = safeReal(ctx.root, ctx);
  const isRoot = c.root === nfc(path.resolve(ctx.root)) || c.root === realRoot;
  // A root other than the workspace root (nested root, main root, or none) is named in the dialog.
  const where = isRoot ? "" : ", kök " + quote(c.root);
  // An ask reaches the CEO only in a mode proven to show the dialog (§7.7); the container has nobody to ask.
  const ask = (why, containerWhy) => {
    if (container) return res("deny", containerWhy, c);
    const mode = ctx.permissionMode;
    if (mode === undefined || mode === null || ASK_MODES.includes(mode)) return res("ask", why, c);
    const shown = String(mode).replace(/[^\x20-\x7e]/g, "?").slice(0, 40);
    return res("deny", "the edit of " + q + " needs the CEO's dialog, but permission mode '" + shown + "' is not proven to show it. " + MODE_TAIL, c);
  };
  const protectedWhy = quote(posix(path.relative(ctx.root, target))) + " is protected; only the CEO changes approvals and gate configuration";

  if (container) {
    const lex = segsUnder(nfc(target), nfc(path.resolve(ctx.root)), false);
    if (lex === null) return res("deny", "path is outside the workspace", c);
    if (lex.length && lex[0].toLowerCase() === ".claude") return res("deny", protectedWhy, c);
    const real = segsUnder(path.join(c.resolved.root, c.resolved.rel), realRoot, false);
    if (real && real.length && real[0].toLowerCase() === ".claude") return res("deny", protectedWhy, c);
  }
  if (c.row === 1) {
    if (kind === "bash" && !container) return ask("imza dizini veya git verisi " + q + " (hard-deny)" + where + ": kabuk komutuyla değiştiriliyor.");
    return res("deny", container ? protectedWhy : q + " is protected (signatures and git metadata): no tool call changes it; only the CEO does, outside the session", c);
  }
  if (c.row === 2) return ask("zorlama katmanı dosyası " + q + " (enforcement)" + where + ": her düzenleme CEO onayı ister, imza ya da Unlocks: kapsamaz.", protectedWhy.replace("approvals and gate configuration", "enforcement files"));
  if (c.row === 7) return container ? res("deny", "path is outside the workspace", c) : res("none", "", c);
  if (c.row === 5) return res(kind === "bash" && !container ? "none" : "allow", "", c);

  // rows 4 and 6: the signed single active spec of the class root decides
  let approvalsDir = ctx.approvalsDir;
  if (!container) {
    if (!isDir(path.join(c.root, "specs"))) return res("none", "", c);                    // Ruling R-3, before any git lookup (REQ-11)
    const isMain = c.root === nfc(path.resolve(ctx.mainRoot)) || c.root === safeReal(ctx.mainRoot, ctx);
    if (isRoot || isMain) {
      if (ctx.rootLookupFailed) return res("deny", "git lookup failed (fail closed): the main worktree of the workspace is unknown, so the signature of " + q + " cannot be checked", c);
    } else {                                                                              // nested root: the main worktree's approvals/
      try { approvalsDir = path.join(mainWorktree(c.root, ctx.env), "approvals"); }
      catch { return res("deny", "git lookup failed (fail closed): the main worktree of " + quote(c.root) + " is unknown", c); }
    }
    if (!ctx.pubkeyPath) return res("deny", "harness key lookup failed (fail closed): the main worktree of the harness is unknown, so the signature of " + q + " cannot be checked", c);
  }
  const a = authority(c.root, approvalsDir, ctx);
  if (!a.ok) {
    const missing = a.count === 1 ? "etkin spec imzalı değil (" + a.why + ")" : "tek etkin spec gerekir (bulunan: " + a.count + ")";
    return ask(q + " (" + LABELS[c.row] + ")" + where + ": " + missing + ".",
      a.count === 1 ? "no code before the CEO signs the spec (" + a.why + "). Ask the CEO to run the approve command." : "exactly one active spec is required (found " + a.count + ")");
  }
  if (c.row === 6) return res("allow", "", c);
  const fold = foldGlobs(ctx.platform);
  if (a.unlocks && a.unlocks.some((g) => matchGlob(g, c.rel, fold))) return res("allow", "", c);
  return ask(q + " (product-config)" + where + ": imzalı spec'in Unlocks: listesinde yok.", q + " is product configuration and the signed spec's Unlocks: does not name it");
}

function safeReal(p, ctx) { try { return resolvePath(path.resolve(p), ctx.fs || fs); } catch { return nfc(path.resolve(p)); } }

module.exports = { context, classify, parseHeader, matchGlob, decide, quote, foldGlobs, mainWorktree, ResolveError, ASK_MODES, ENFORCEMENT, LABELS };
