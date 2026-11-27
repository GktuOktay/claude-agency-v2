// policy.js: the one shared write policy of the company hooks (spec 0004 §7.1, §7.1.1, §7.2, §7.3, §7.7).
// Used by gate.js (file tools) and guard.js (Bash writer targets); it prints nothing and never exits.
//   context(event, opts)        root, main worktree, home configuration, records and key locations
//   classify(absPath, ctx)      final path class: lexical and resolved path, stronger class wins (§7.1.1)
//   parseHeader(text)           the `- Unlocks:` list of a spec header (§7.3)
//   matchGlob(glob, rel, fold)  glob match against a root-relative POSIX path (§7.3)
//   decide(req, ctx)            allow | ask | deny | none for one write target
//   unlockKinds(unlocks, root, ctx)  entry kinds of a parsed list: enforcement | locked | other (§7.3, delta 2026-11-22)
// A reason is returned without the hook prefix: the hook adds "BLOCKED by company <gate|guard>: " or "CEO onayı gerekir: ".
// No side effects at load. approval.js is loaded only when a signature has to be checked.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

// Modes that may ask (spec 0004 Ruling R-11): `default`, `plan`, plus each mode the T-1 record shows a dialog for
// (docs/kanit/0004-t1.md: `acceptEdits`). `plan` is named by the signed spec; T-1 did not observe it.
// Any other reported mode turns an ask into a refusal; no reported mode asks (§7.7).
const ASK_MODES = Object.freeze(["default", "plan", "acceptEdits"]);

// Today's guard expression (guard.js ENFORCEMENT), compared case-insensitively (REQ-3): on the path as written and on its
// full case fold (`foldCase`). policy.sh asserts the two sources are equal.
const ENFORCEMENT = /(^|\/)(harness\/(guard|gate|stop|approval|loop)\.js|harness\/keys\/|harness\/container-settings\.json|\.claude\/settings(\.local)?\.json|approvals\/|\.github\/workflows\/|CLAUDE\.md$)/i;
// Row 2 members that hold anywhere on disk, tested on the case-folded (`foldCase`) absolute POSIX path.
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
// Full case fold (appsec recheck of 2026-11-23). A case-insensitive volume (APFS) matches names by Unicode full case
// folding, not by `toLowerCase`: U+017F long s = s, U+00DF sharp s = ss, U+FB01 fi ligature = fi. Every "without case"
// comparison of this file goes through this one function. lower -> upper -> lower reaches the full fold without a table:
// `toUpperCase` applies the multi-character mappings (sharp s -> SS, ligatures), the first `toLowerCase` brings U+1E9E to
// U+00DF before that. It is never narrower than the full fold (checked code point by code point against CaseFolding 15.1);
// it is wider for U+0131 dotless i (= i) and the Cherokee small letters, which can only add matches.
const foldCase = (s) => nfc(nfc(s).toLowerCase().toUpperCase().toLowerCase());
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
  for (let i = 0; i < b.length; i++) if (fold ? foldCase(a[i]) !== foldCase(b[i]) : a[i] !== b[i]) return null;
  return a.slice(b.length);
}

// realpath(nearest existing ancestor) + remaining segments. A dangling symlink is followed to its target.
// Only "does not exist" (ENOENT) lets the walk go on; any other error refuses the write (REQ-4).
// The resolved form is the file's true location (§7.1.1): a macOS alias that realpath leaves in place is undone or refused.
function resolvePath(p, fsx) { return unalias(walk(p, fsx, (x) => fsx.realpathSync(x)), p, fsx); }
// The walk of resolvePath before `unalias`, with the realpath function `rp`: the JS one keeps each name as it was written,
// the native one (`diskRealpath`) returns the spelling the volume stores for every segment that exists.
function walk(p, fsx, rp) {
  let cur = p; const rest = []; let hops = 0;
  if (ALIASES && isNamespace(p)) throw new ResolveError(p, { code: "EALIAS" });
  for (;;) {
    let real = null;
    try { real = nfc(path.join(rp(cur), ...rest)); }
    catch (e) {
      if (!e || e.code !== "ENOENT") throw new ResolveError(p, e);
      let st = null;
      try { st = fsx.lstatSync(cur); } catch (e2) { if (!e2 || e2.code !== "ENOENT") throw new ResolveError(p, e2); }
      if (st && st.isSymbolicLink()) {
        if (++hops > 40) throw new ResolveError(p, { code: "ELOOP" });
        try { cur = path.resolve(rp(path.dirname(cur)), fsx.readlinkSync(cur)); } catch (e3) { throw new ResolveError(p, e3); }
        continue;
      }
      const parent = path.dirname(cur);
      if (parent === cur) return nfc(path.join(cur, ...rest));
      rest.unshift(path.basename(cur)); cur = parent;
    }
    if (real !== null) return real;
  }
}
// The native realpath where the running system and the context's platform both fold names (darwin), else null. It
// answers with the on-disk spelling of each existing segment (`ws/src/a.js` for `WS/SRC/a.js`) and keeps a firmlink prefix.
function diskRealpath(fsx, platform) {
  const nat = ALIASES && foldFs(platform || process.platform) && fsx.realpathSync && fsx.realpathSync.native;
  return typeof nat === "function" ? (x) => nat(x) : null;
}

// macOS path aliases that realpath does not undo (appsec finding of 2026-11-23). Class membership follows the file, not
// the text of its path. Asked of the running system (process.platform), not of ctx.platform: it is a fact of this disk.
//   `/.vol/<dev>/<ino>/…` (volfs), `/.nofollow/…`, `/.resolve/<n>/…`: the text does not say where the file is, so the
//   path is refused as unresolvable (code EALIAS, the fail-closed path of REQ-4). Matched without case: never narrower.
//   `/System/Volumes/Data/<path>` (data-volume firmlink, any case): dropped when `/<path>` is the same file, that is the
//   same device and inode at the nearest existing ancestor of both; otherwise the text is no alias and stays as it is.
const ALIASES = process.platform === "darwin";
const DATA_VOLUME = "/System/Volumes/Data";
const NAMESPACE = /^\/\.(vol|nofollow|resolve)(\/|$)/i;
const isNamespace = (x) => { const s = posix(String(x)); return NAMESPACE.test(s) || NAMESPACE.test(foldCase(s)); };
function unalias(abs, p, fsx) {
  if (!ALIASES) return abs;
  const stat = (x) => {
    try { return ((fsx && fsx.statSync) || fs.statSync)(x, { bigint: true }); }
    catch (e) { if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return null; throw new ResolveError(p, e); }
  };
  let out = abs;
  for (;;) {
    if (isNamespace(out)) throw new ResolveError(p, { code: "EALIAS" });
    const below = segsUnder(out, DATA_VOLUME, true);        // per segment: a folded spelling of the prefix can differ in length
    if (!below || !below.length) return out;
    const direct = "/" + below.join("/");
    let a = out, b = direct, same = false;
    for (;;) {
      const sa = stat(a);
      if (sa) { const sb = stat(b); same = !!sb && sa.dev === sb.dev && sa.ino === sb.ino; break; }
      if (path.dirname(b) === b) break;
      a = path.dirname(a); b = path.dirname(b);
    }
    if (!same) return out;
    out = direct;
  }
}
// The forms a root can take in a classification: as written without its firmlink prefix (lexical), and resolved.
function rootForms(p, ctx) {
  const abs = nfc(path.resolve(p));
  let lexical = abs;
  try { lexical = unalias(abs, p, ctx.fs || fs); } catch { /* as written */ }
  return [lexical, safeReal(p, ctx)];
}

// Row 2 by a `<cfg>` or `<home>` member of §7.1 (home and session configuration). `env` holds both forms of each directory.
function homeMember(abs, env) {
  for (const c of env.cfgDirs) {
    const s = segsUnder(abs, c, true);
    if (!s || !s.length) continue;
    const first = foldCase(s[0]);
    if (s.length === 1 && (/^settings.*\.json$/.test(first) || first === ".claude.json")) return true;
    if (CFG_TREES.has(first)) return true;
  }
  for (const h of env.homes) {
    const s = segsUnder(abs, h, true);
    if (!s || !s.length) continue;
    const first = foldCase(s[0]);
    if ((s.length === 1 && first === ".claude.json") || first === ".company") return true;
  }
  return false;
}
// Home configuration is matched in both forms for both classifications: a write through an alias of ~/.claude is still row 2.
function homeEnv(ctx, fsx) {
  const disk = diskRealpath(fsx, ctx.platform);
  const both = (dirs) => {
    const set = new Set();
    for (const d of dirs || []) {
      if (!d) continue;
      set.add(nfc(path.resolve(d)));
      try { set.add(unalias(nfc(path.resolve(d)), d, fsx)); } catch { /* as written only */ }
      try { set.add(resolvePath(path.resolve(d), fsx)); } catch { /* lexical form only */ }
      if (disk) try { set.add(unalias(walk(path.resolve(d), fsx, disk), d, fsx)); } catch { /* the forms above */ }
    }
    return [...set];
  };
  return { platform: ctx.platform || process.platform, cfgDirs: both(ctx.cfgDirs), homes: both(ctx.home ? [ctx.home] : []) };
}

// Locked paths (§7.3 condition 3, Ruling R-21): no `Unlocks:` entry opens them, whatever the root. Tested on one absolute
// path, lexical or resolved: `approvals/` and `harness/keys/` at any depth, `.claude/settings.local.json`,
// `harness/bin/ceo-keygen.sh` (compared without case, as row 2 is), and every `<cfg>` or `<home>` member.
const LOCKED = /(^|\/)(approvals|harness\/keys)(\/|$)|(^|\/)(\.claude\/settings\.local\.json|harness\/bin\/ceo-keygen\.sh)$/;
const isLocked = (abs, env) => LOCKED.test(foldCase(posix(abs))) || homeMember(abs, env);

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
  const lrel = rel !== null ? foldCase(rel) : null;
  const fabs = foldCase(absPosix);
  const at = (dir, s) => s === dir || s.startsWith(dir + "/");

  // row 1, hard-deny
  if (root !== null && (at("approvals", lrel) || at(".git", lrel))) return out(1);
  // row 2, enforcement: anywhere on disk
  if (ENFORCEMENT.test(absPosix) || ENFORCEMENT.test(fabs) || ANYWHERE.test(fabs) || homeMember(abs, env)) return out(2);
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
  const env = homeEnv(ctx, fsx);
  // The lexical form keeps its symlinks but not a firmlink prefix: an alias of a path is classified as that path, in both
  // forms, so it gets exactly the decision of the direct path (never a weaker one: `lex(alias)` is the direct path's text).
  const lex = (x) => unalias(nfc(x), x, fsx);
  const lexical = classifyOne(lex(abs), lex(R), M && lex(M), env);
  const resolved = classifyOne(resolvePath(abs, fsx), resolvePath(R, fsx), M && resolvePath(M, fsx), env);
  let fin = STRENGTH[lexical.row] > STRENGTH[resolved.row] ? lexical : resolved;        // tie: the resolved path is reported
  // On-disk spelling (appsec recheck of 2026-11-23), where the volume folds names. `plain`: the path as written differs
  // from the spelling the volume stores by plain letter case at most; false for a spelling that reaches its file only
  // through the full fold (U+017F, U+00DF, a ligature), which a literal enforcement entry never opens (decide). And a
  // spelling that `foldCase` does not explain is classified by its on-disk name as well, the stronger class wins.
  let plain = true;
  const disk = diskRealpath(fsx, env.platform);
  if (disk) {
    const js = (x) => fsx.realpathSync(x);
    const pairs = [abs, R, M].filter(Boolean).map((x) => [walk(x, fsx, js), walk(x, fsx, disk)]);
    plain = pairs[0][0].toLowerCase() === pairs[0][1].toLowerCase();
    if (pairs.some(([a, b]) => foldCase(a) !== foldCase(b))) {
      const d = (x) => unalias(walk(x, fsx, disk), x, fsx);
      const onDisk = classifyOne(d(abs), d(R), M && d(M), env);
      if (STRENGTH[onDisk.row] > STRENGTH[fin.row]) fin = onDisk;
    }
  }
  return { row: fin.row, root: fin.root, rel: fin.rel, label: LABELS[fin.row], lexical, resolved, plain };
}

// ---- `Unlocks:` header (§7.3) ---------------------------------------------------------------
// A glob as printable ASCII: an entry that holds control, format or bidi characters must not reach a terminal or a dialog as it is.
const ascii = (s) => { const q = JSON.stringify(String(s)).replace(/[^\x20-\x7e]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0")); return q.length > 200 ? q.slice(0, 197) + "..." : q; };
function globError(g) {
  if (g === "") return "empty item";
  // Delta 2026-11-22, S-05: control, format and bidi characters, line and paragraph separators (a tightening, §7.3 change rule).
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(g)) return "control, format or separator character in " + ascii(g);
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

// unlockKinds(unlocks, root, ctx): the entry kinds of §7.3 for a parsed `Unlocks:` list of the spec of `root`.
// The one source for decide, the signing preview, the signing dialog and lint (Ruling R-23). A glob is always `other`.
// A literal entry E is classified as <root>/E: `locked` (no header opens it), `enforcement` (its lexical or its resolved
// class is row 2) or `other`. The list may hold an entry the gate will not open (a symlinked path), never the reverse.
function unlockKinds(unlocks, root, ctx) {
  ctx = ctx || {};
  const out = { enforcement: [], locked: [], other: [] };
  const base = path.resolve(String(root));
  const sub = { mode: ctx.mode, root: base, mainRoot: base, cfgDirs: ctx.cfgDirs, home: ctx.home, platform: ctx.platform, fs: ctx.fs };
  const env = homeEnv(sub, ctx.fs || fs);
  for (const e of Array.isArray(unlocks) ? unlocks : []) {
    if (/[*?]/.test(e)) { out.other.push(e); continue; }
    let c;
    try { c = classify(path.resolve(base, String(e)), sub); }
    catch (err) { if (!(err instanceof ResolveError)) throw err; out.locked.push(e); continue; }   // unresolvable: never authority
    if (c.row === 1 || [c.lexical, c.resolved].some((x) => isLocked(path.join(x.root, x.rel), env))) out.locked.push(e);
    else if (c.lexical.row === 2 || c.resolved.row === 2) out.enforcement.push(e);
    else out.other.push(e);
  }
  return out;
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
const MODE_TAIL = "Ask the CEO to switch to default mode or sign a spec that covers this path (code: a validly signed single active spec; product config: such a spec whose Unlocks: names the path; enforcement: such a spec whose Unlocks: names the exact path, file tools only; signatures, keys, .git: no spec covers them, default mode only).";
// Callers that may use a literal enforcement entry (§7.3 condition 6, S-01); an event without agent_type is the main session.
const UNLOCK_CALLERS = Object.freeze(["polyglot-engineer", "dotnet-engineer", "react-engineer", "devops-sre"]);

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
  const isRoot = rootForms(ctx.root, ctx).includes(c.root);
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
  // The condition of §7.3 "Literal enforcement entries" that a row-2 write does not meet (dialog text), or null when all six hold.
  const enforcementUnmet = () => {
    if (kind === "bash") return "kabuk komutuyla yazılıyor; Unlocks: yalnız dosya araçlarının yazmasını açar";                 // REQ-22
    const who = ctx.agentType;                                                                                               // 6. caller
    if (who !== undefined && who !== null && !UNLOCK_CALLERS.includes(who)) return "çağıran birim " + quote(who) + " zorlama dosyası düzenleyebilenler listesinde değil; Unlocks: bu çağırana açmaz";
    const lx = c.lexical, rs = c.resolved;
    const env = homeEnv(ctx, ctx.fs || fs);
    if ([lx, rs].some((x) => isLocked(path.join(x.root, x.rel), env))) return "kilitli yol (imza dizini, anahtarlar, oturum ve ev yapılandırması); hiçbir Unlocks: açamaz";   // 3. not locked
    // Spelled apart from the on-disk name by more than plain letter case: the entry opens the file's own spelling only (R-20).
    if (!c.plain) return "yol diskteki yazımından harf katlamasıyla ayrılıyor (U+017F, U+00DF, bitişik harf gibi); Unlocks: yalnız dosyanın kendi yazımını açar";
    if (lx.row === 2 && lx.root === path.parse(lx.root).root) return "çalışma kökünün dışında; hiçbir Unlocks: açamaz";       // 1. root: outside every root
    // 1. both row 2 against the same root (resolved.root === realpath(lexical.root), D-1); 2. the same root-relative path
    if (lx.row !== 2 || rs.row !== 2 || rs.root !== safeReal(lx.root, ctx) || nfc(lx.rel) !== nfc(rs.rel)) return "sembolik bağ üzerinden erişiliyor; Unlocks: yalnız dosyanın kendi yolunu açar";
    // 4. signature: the same lookup as for rows 4 and 6; a failed lookup gives no authority, not a refusal (Ruling R-22)
    if (!isDir(path.join(c.root, "specs"))) return "imzalı tek etkin spec yok (specs/ klasörü yok)";                           // REQ-11: no git lookup
    let approvalsDir = ctx.approvalsDir;
    const isMain = rootForms(ctx.mainRoot, ctx).includes(c.root);
    if (isRoot || isMain) {
      if (ctx.rootLookupFailed) return "imza doğrulanamadı (git araması başarısız)";
    } else {
      try { approvalsDir = path.join(mainWorktree(c.root, ctx.env), "approvals"); } catch { return "imza doğrulanamadı (git araması başarısız)"; }
    }
    if (!ctx.pubkeyPath) return "imza doğrulanamadı (harness anahtarı bulunamadı)";
    const a = authority(c.root, approvalsDir, ctx);
    if (!a.ok) return a.count === 1 ? "etkin spec imzalı değil (" + a.why + ")" : "tek etkin spec gerekir (bulunan: " + a.count + ")";
    // 5. entry: a literal entry of kind `enforcement` equal to the root-relative path, byte for byte after NFC, exact case everywhere
    if (!unlockKinds(a.unlocks, c.root, ctx).enforcement.some((e) => nfc(e) === nfc(rs.rel))) return "imzalı spec'in Unlocks: listesinde tam yoluyla yok (glob açmaz)";
    return null;
  };

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
  if (c.row === 2) {
    // Literal enforcement entries (§7.3, REQ-8): a host file-tool write is allowed only when all six conditions hold;
    // otherwise the unchanged ask (Ruling R-22), whose reason names the condition that is not met. Never in the container (REQ-17).
    const unmet = container ? "container" : enforcementUnmet();
    if (unmet === null) return res("allow", "", c);
    return ask("zorlama katmanı dosyası " + q + " (enforcement)" + where + ": " + unmet + ".", protectedWhy.replace("approvals and gate configuration", "enforcement files"));
  }
  if (c.row === 7) return container ? res("deny", "path is outside the workspace", c) : res("none", "", c);
  if (c.row === 5) return res(kind === "bash" && !container ? "none" : "allow", "", c);

  // rows 4 and 6: the signed single active spec of the class root decides
  let approvalsDir = ctx.approvalsDir;
  if (!container) {
    if (!isDir(path.join(c.root, "specs"))) return res("none", "", c);                    // Ruling R-3, before any git lookup (REQ-11)
    const isMain = rootForms(ctx.mainRoot, ctx).includes(c.root);
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

// ---- spec 0010 R-5: secret-file names and the allowed location, pure functions shared by guard.js and bin/secret-names.js ----
// No state, no shared RegExp object: names are compared as lower-case text.
const SECRET_SUFFIXES = Object.freeze([".jks", ".keystore", ".p12", ".p8", ".mobileprovision"]);
const SCAN_SUFFIXES = Object.freeze([...SECRET_SUFFIXES, ".pfx", ".pepk"]);
// The pattern (`*.jks`, `key.properties`, `credentials.json`) a bare file name matches as a scan name, else null (REQ-5).
function scanName(name) {
  const n = String(name).toLowerCase();
  for (const s of SCAN_SUFFIXES) if (n.endsWith(s)) return "*" + s;
  if (n === "key.properties") return "key.properties";
  if (n === "credentials.json") return "credentials.json";
  return null;
}
// The pattern a command word matches as a secret-file name (REQ-3): its last `/` segment, or the last `/` segment of the value
// after its last `=` (assignment, `-Pkey=value`, `--ks=value`); null when it is none. `credentials.json`, `*.pfx`, `*.pepk` are scan names only.
function secretFileName(word) {
  const w = String(word);
  const seg = (x) => x.slice(x.lastIndexOf("/") + 1).toLowerCase();
  const eq = w.lastIndexOf("=");
  for (const n of eq >= 0 ? [seg(w), seg(w.slice(eq + 1))] : [seg(w)]) {
    for (const s of SECRET_SUFFIXES) if (n.endsWith(s)) return "*" + s;
    if (n === "key.properties") return "key.properties";
  }
  return null;
}
// REQ-3 allowed location: a literal path whose written form (made absolute from `cwd`, no symlink followed) and whose resolved
// form are both `<root>/android/app/debug.keystore`, or both under the temp set. `opts.tempDirs` replaces the default temp set
// (tests only), `opts.fs` the file system. A word that is no literal path, or a path that cannot be resolved, is not allowed.
function allowedLocation(word, cwd, root, opts) {
  opts = opts || {}; const fsx = opts.fs || fs;
  const w = String(word);
  if (w === "" || /[$`*?\[{(\\]/.test(w) || w.startsWith("~") || w.includes("\x00")) return false;
  try {
    const written = nfc(path.resolve(cwd, w));
    const resolved = resolvePath(written, fsx);
    const R = path.resolve(root);
    if (written === nfc(path.join(R, "android", "app", "debug.keystore"))) return resolved === nfc(path.join(resolvePath(R, fsx), "android", "app", "debug.keystore"));
    const set = (opts.tempDirs || ["/tmp", "/private/tmp", "/var/folders", "/private/var/folders", os.tmpdir()]).map((d) => nfc(path.resolve(d)));
    const resolvedSet = set.slice();
    for (const d of set) { try { resolvedSet.push(resolvePath(d, fsx)); } catch { /* an unresolvable temp entry adds nothing */ } }
    const under = (p, dirs) => dirs.some((d) => p === d || p.startsWith(d.endsWith("/") ? d : d + "/"));
    return under(written, set) && under(resolved, resolvedSet);
  } catch { return false; }
}

module.exports = { context, classify, parseHeader, matchGlob, decide, unlockKinds, UNLOCK_CALLERS, quote, foldGlobs, mainWorktree, ResolveError, ASK_MODES, ENFORCEMENT, LABELS, scanName, secretFileName, allowedLocation };
