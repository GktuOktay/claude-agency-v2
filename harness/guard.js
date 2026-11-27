#!/usr/bin/env node
// guard.js: PreToolUse hook for Bash on the HOST (outside the container). Turns envelope actions into CEO decisions.
//   decision "ask"  -> the CEO is asked; in headless (-p) runs nobody can answer, so the call is refused.
//   exit 2          -> hard block (e.g. --no-verify).
//   no output       -> no opinion; normal permission rules apply.
// Envelope (constitution rule 4): push/merge to main, releases, repo changes, deletions, history rewriting.
// Fail closed: unreadable input or an internal error blocks (exit 2).
"use strict";
process.on("uncaughtException", (e) => { process.stderr.write("BLOCKED by company guard: internal error (fail closed): " + e.message + "\n"); process.exit(2); });
const { execFileSync } = require("child_process");
// The shared write policy (spec 0004 §7.1) decides Bash writer targets. A load failure does not block Bash: the guard asks for
// each call instead, so the CEO can allow one repair command (REQ-29); every rule that needs no policy keeps working.
let policy = null; let policyError = null;
try { policy = require("./policy.js"); } catch (e) { policyError = e instanceof Error ? e : new Error(String(e)); }

const PROTECTED = (process.env.COMPANY_PROTECTED_BRANCHES || "main,master").split(",").map((s) => s.trim()).filter(Boolean);
const isProtected = (b) => PROTECTED.includes(b.replace(/^refs\/heads\//, "").replace(/^.*:/, ""));
// Destination of a push refspec (REQ-36): drop one leading "+", take the part after the last ":", drop a leading refs/heads/.
const refDst = (r) => r.replace(/^\+/, "").replace(/^.*:/, "").replace(/^refs\/heads\//, "");

// Lookups always run `git` and `gh` from PATH, never the word written in the command (REQ-37).
// `pre`: the -C / --git-dir / --work-tree options of the judged command, and no other option (REQ-34).
function currentBranch(cwd, pre) {
  try { return execFileSync("git", [...(pre || []), "symbolic-ref", "--short", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim(); }
  catch { return null; }
}
function prBase(arg, cwd) {
  if (process.env.COMPANY_PR_BASE) return process.env.COMPANY_PR_BASE;
  try {
    const a = ["pr", "view"]; if (arg) a.push(arg); a.push("--json", "baseRefName", "-q", ".baseRefName");
    return execFileSync("gh", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).trim() || null;
  } catch { return null; }
}

// CI state of a PR as a list of check results (conclusion, or status while running); null when unknown.
// COMPANY_PR_CI="SUCCESS,FAILURE" overrides for tests.
function prChecks(arg, cwd) {
  if (process.env.COMPANY_PR_CI !== undefined) return process.env.COMPANY_PR_CI.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const a = ["pr", "view"]; if (arg) a.push(arg);
    a.push("--json", "statusCheckRollup", "-q", '[.statusCheckRollup[] | (.conclusion // .status)] | join(",")');
    return execFileSync("gh", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).trim().split(",").filter(Boolean);
  } catch { return null; }
}
const fs = require("fs"); const path = require("path");
const GOOD_CHECK = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);

// Remove heredoc bodies and quoted strings so words inside commit messages do not trigger rules.
function strip(cmd) {
  let s = cmd.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1(?=\s|$)/g, " ");
  s = s.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return s;
}
function segments(s) { return s.split(/&&|\|\||;|\||\n/).map((x) => x.trim()).filter(Boolean); }
function tokens(seg) { return seg.split(/\s+/).filter(Boolean).filter((t) => !/^\w+=/.test(t)); }

// The files that enforce the envelope. A session that can rewrite them can lift its own limits (B11): changes need the CEO.
const ENFORCEMENT = /(^|\/)(harness\/(guard|gate|stop|approval|loop)\.js|harness\/keys\/|harness\/container-settings\.json|\.claude\/settings(\.local)?\.json|approvals\/|\.github\/workflows\/|CLAUDE\.md$)/;
const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const WRAPPERS = new Set(["sudo", "env", "time", "nohup", "command", "exec", "nice", "npx", "bunx"]);
const baseCmd = (t) => { const c = t.find((x) => !WRAPPERS.has(x) && !x.startsWith("-")); return c ? path.basename(c) : ""; };
const FILE_WRITERS = new Set(["cp", "mv", "rm", "ln", "chmod", "chown", "tee", "truncate", "dd", "install"]);
// Deploy, publish, store and remote-access tools (B13). Each call is an envelope action: the CEO approves one by one.
const REMOTE_BIN = new Set(["ssh", "scp", "sftp", "rsync", "sendmail", "mail", "mutt", "fastlane", "altool", "notarytool", "iTMSTransporter", "transporter",
  "aws", "az", "gcloud", "vercel", "netlify", "firebase", "flyctl", "fly", "heroku", "wrangler", "cloudflared", "kubectl", "helm", "terraform", "pulumi", "eas", "appcenter"]);
const PUBLISH = [["npm", "publish"], ["pnpm", "publish"], ["yarn", "publish"], ["dotnet", "nuget", "push"], ["nuget", "push"], ["twine", "upload"], ["cargo", "publish"],
  ["docker", "push"], ["docker", "login"], ["xcrun", "altool"], ["xcrun", "notarytool"]];
const LOCAL_HOST = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])([:\/]|$)/i;

const ask = (why) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "CEO onayı gerekir: " + why } }));
  process.exit(0);
};
const deny = (why) => { process.stderr.write("BLOCKED by company guard: " + why + "\n"); process.exit(2); };

// ---- spec 0004 T-6: the Bash branch (§7.4, §7.5, §7.7, §7.8) ---------------------------------
// Text taken from the event or from a spec appears in a reason as a JSON string literal, cut to 200 characters (§7.8).
const quote = (s) => { const q = JSON.stringify(String(s)); return q.length > 200 ? q.slice(0, 199) + "…" : q; };
// Modes proven to show a hook dialog (§7.7). Without the policy module only the two modes the signed spec names remain.
const ASK_MODES = policy && Array.isArray(policy.ASK_MODES) ? policy.ASK_MODES : ["default", "plan"];
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1(?=\s|$)/g;                           // the expression of strip()
// Writer view: the body is data, the rest of the heredoc's own line (its redirect, a pipe) stays command text.
const HEREDOC_LINE = /<<-?\s*['"]?(\w+)['"]?([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\1(?=\s|$)/g;
const MARK = /\x01(\d+)\x02/g;

// strip() with a memory: every quoted string becomes one opaque word (\x01<n>\x02) that maps back to its content (Ruling R-7).
function stripMap(cmd, heredoc, keepLine) {
  const q = [];
  const back = (s) => s.replace(MARK, (_, n) => q[+n].raw);
  let s = cmd.replace(heredoc, keepLine ? (_, w, rest) => " " + rest + " " : " ");
  s = s.replace(/'[^']*'/g, (m) => { q.push({ k: "s", raw: m, text: m.slice(1, -1) }); return "\x01" + (q.length - 1) + "\x02"; });
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, (m) => { const raw = back(m); q.push({ k: "d", raw, text: raw.slice(1, -1) }); return "\x01" + (q.length - 1) + "\x02"; });
  return { s, q, back, clean: (x) => x.replace(MARK, (_, n) => (q[+n].k === "s" ? "''" : '""')) };
}
// One word of a mapped view: its unquoted text, and whether that text is a literal path (§7.4 Resolution).
function unq(word, q) {
  const whole = /^\x01(\d+)\x02$/.exec(word);
  if (whole) { const e = q[+whole[1]]; return { text: e.text, literal: e.k === "s" || !/[$`\\]/.test(e.text), quoted: true }; }
  if (word.includes("\x01")) return { text: word.replace(MARK, (_, n) => q[+n].text), literal: false, quoted: true };
  return { text: word, literal: !/[$`*?\[{(\\]/.test(word), quoted: false };
}

const REDIRECT = /(?:&|(?<![^\s])\d+)?>>?[ \t]*(&?[^\s<>]*)/g;
const DEVICE = /^\/dev\/(null|stdout|stderr|tty|fd\/.*)$/;
const SHELLS = new Set(["sh", "bash", "zsh"]);
const INSTALLERS = new Set(["install-global.sh", "install-project.sh"]);
const W_LAST = new Set(["cp", "install", "ln"]);
const W_EVERY = new Set(["mv", "rm", "touch", "unlink", "tee", "truncate"]);
const W_AFTER_FIRST = new Set(["chmod", "chown"]);
const W_VALUE_OPTS = { truncate: ["-s", "-r"], touch: ["-t", "-d", "-r"], install: ["-m", "-o", "-g"], mv: ["-S"], cp: ["-S"], ln: ["-S"] };

// Segments of the writer view: command word, operands and redirect words, each with its unquoted text.
function parseSegments(full) {
  const m = stripMap(full, HEREDOC_LINE, true);
  return segments(m.s).map((seg) => {
    const redirects = [];
    const body = seg.replace(REDIRECT, (_, wd) => { if (wd && !wd.startsWith("&")) redirects.push(unq(wd, m.q)); return " "; });
    const words = body.split(/\s+/).filter(Boolean);
    const ws = words.map((x) => unq(x, m.q));
    const ci = words.findIndex((x, j) => !/^\w+=/.test(x) && !WRAPPERS.has(ws[j].text) && !ws[j].text.startsWith("-"));   // as baseCmd reads it
    const cmd = ci < 0 ? "" : path.basename(ws[ci].text);
    const ops = ci < 0 ? [] : ws.slice(ci + 1);
    // `sh <script> ...`: the script is the command of the segment for the installer and signing rules
    let script = cmd; let args = ops;
    if (SHELLS.has(cmd)) {
      const si = ops.findIndex((o) => !o.text.startsWith("-"));
      if (si >= 0) { script = path.basename(ops[si].text); args = ops.slice(si + 1); }
    }
    return { raw: m.back(seg), cmd, ops, script, args, redirects };
  });
}

// Write targets and all operands of a recognised writer (§7.4); null when the command is not one.
function writerOperands(cmd, ops) {
  const isSed = cmd === "sed", isPerl = cmd === "perl", isDd = cmd === "dd";
  if (!(isSed || isPerl || isDd || W_LAST.has(cmd) || W_EVERY.has(cmd) || W_AFTER_FIRST.has(cmd))) return null;
  if (isDd) {
    const strip = (o) => Object.assign({}, o, { text: o.text.replace(/^\w+=/, "") });
    return { targets: ops.filter((o) => o.text.startsWith("of=")).map(strip), operands: ops.map(strip) };
  }
  const operands = []; const targets = [];
  let end = false; let inPlace = false; let scriptGiven = false;
  for (let j = 0; j < ops.length; j++) {
    const x = ops[j].text;
    if (!end && x === "--") { end = true; continue; }
    if (!end && x.length > 1 && x.startsWith("-")) {
      if (isSed) {
        if (/^(-[a-zA-Z]*i|--in-place)/.test(x)) {
          inPlace = true;
          // an empty word right after -i / --in-place is the BSD backup suffix, not an operand (Ruling R-19)
          if ((x === "--in-place" || /^-[a-zA-Z]*i$/.test(x)) && ops[j + 1] && ops[j + 1].text === "") { j++; continue; }
        }
        if (/^-[a-zA-Z]*[ef]$/.test(x) || x === "--expression" || x === "--file") { scriptGiven = true; j++; }
        else if (/^--(expression|file)=/.test(x)) scriptGiven = true;
      } else if (isPerl) {
        if (/^-[a-zA-Z0-9]*i/.test(x)) inPlace = true;
        if (/^-[a-zA-Z0-9]*[eE]$/.test(x)) { scriptGiven = true; j++; }
      } else if (x === "-t" || x === "--target-directory") { if (ops[j + 1]) targets.push(ops[j + 1]); j++; }
      else if ((W_VALUE_OPTS[cmd] || []).includes(x)) j++;
      continue;
    }
    if (x === "-") continue;
    operands.push(ops[j]);
  }
  if (isSed || isPerl) {
    if (!inPlace) return null;
    targets.push(...(scriptGiven ? operands : operands.slice(1)));
  } else if (W_LAST.has(cmd)) { if (operands.length >= 2) targets.push(operands[operands.length - 1]); }
  else if (W_EVERY.has(cmd)) targets.push(...operands);
  else targets.push(...operands.slice(1));
  return { targets, operands };
}

const SIGNING = /\.company\b|ceo\.key|approval\.js\s+(sign|keygen)|\bapprove\.sh\b|ceo-keygen/;
const SIGNING_REST = /\.company\b|ceo\.key|approval\.js\s+(sign|keygen)|ceo-keygen/;                 // a segment whose approve.sh call is judged on its own
const SIGNING_WHY = "CEO imzası, CEO anahtarı veya ajan belirteci. Bu penceredeki onay, imzanın kendisidir.";
const PREVIEW_FIRST = "run harness/bin/approve.sh <ws> --preview first";
const GIT_VALUE_OPTS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--super-prefix", "--config-env"]);
const GIT_CONFIG_KEY = /hooksPath|core\.editor|credential|^alias\./i;
const GIT_CONFIG_WHY = "git yapılandırması (kanca yolu/kimlik/takma ad).";
const GIT_ENV = /^(GIT_DIR|GIT_WORK_TREE|GIT_EXEC_PATH|GIT_CONFIG_\w*)=/;

// Spec 0010 REQ-8: the repair shape, matched on the whole command before any other rule. It only returns hook sources to the
// content of HEAD, so it gets no opinion in every mode and for every caller, also when policy.js cannot be loaded.
const REPAIR_SHAPE = /^git restore --source=HEAD -- harness\/[A-Za-z0-9_-]+\.js( harness\/[A-Za-z0-9_-]+\.js)*$/;

// ---- spec 0010 T-4: the D2 view (Ruling R-1), the store, signing and key rules (REQ-1..3) and the rollback rule (REQ-7) ----
// One view of the command for these rules only; the older rules keep their own views. It reads the visible words of every
// command part; words built at run time, scripts and abbreviations are not seen (README G-23, G-24).
const D2_S = new Set(["fastlane", "eas", "eas-cli", "altool", "notarytool", "itmstransporter", "transporter", "appcenter", "appcenter-cli", "firebase", "firebase-tools", "bundletool"]);
const D2_S_SHOWN = { itmstransporter: "iTMSTransporter" };
const D2_F = new Set(["-exportarchive", "-exportnotarizedapp", "-allowprovisioningupdates", "-allowprovisioningdeviceregistration"]);
const D2_G = /^(:?[\w.-]+:)*:?(publish|promote|appdistributionupload)/i;
const D2_K = new Set("cd ls cat head tail grep rg find which type man echo printf mkdir rm cp mv touch chmod wc diff stat test [".split(" "));
const D2_K_GIT = new Set("status diff log show add commit mv rm grep blame ls-files checkout switch restore stash branch".split(" "));
const D2_SHELL = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const D2_ROLLBACK = new Set(["restore", "checkout", "reset", "stash", "apply", "am", "read-tree", "checkout-index"]);
const D2_MSG_SUB = new Set(["commit", "tag", "merge", "stash", "notes"]);
const D2_EDGE = /^[(){}!$`<>;&|"']+|[(){}!$`<>;&|"']+$/g;
const d2base = (s) => path.basename(String(s)).toLowerCase();
// The subcommand of the git word at index i and the index of the word after it; global options skipped as gitRules does.
function d2GitSub(o, i) {
  let k = i + 1;
  while (k < o.length && o[k].startsWith("-")) k += GIT_VALUE_OPTS.has(o[k]) ? 2 : 1;
  return { sub: o[k], at: k };
}
// A pathspec word that may name a hook source: a glob character, `:/`, a leading dot (`.`, `./harness`, `.claude/...`), `harness`,
// `<x>/harness`, `harness/<x>.js` or a path deeper in `harness/` (a branch name such as `harness/0010-x` has one segment and does not count).
const d2Hook = (w) => {
  const s = w.replace(/\/+$/, "");
  if (/[*?\[]/.test(w) || w.startsWith(":/") || w.startsWith(".")) return true;
  return s === "harness" || s.endsWith("/harness") || /(^|\/)harness\/[^/]+\.js$/.test(s) || /^harness\/[^/]+\//.test(s);
};
const D2_SUBST = /\$\(|`/;
const d2DirOpt = (x) => ["cd", "pushd"].includes(d2base(x)) || x === "-C" || ["--chdir", "--directory", "--git-dir", "--work-tree"].includes(x) || /^--(chdir|directory|git-dir|work-tree)=/.test(x);

// -> [{ kind: "store"|"signing"|"secret"|"rollback", tool }]
function d2Scan(full, cwd, rootOf) {
  const hits = []; const add = (kind, tool) => { if (!hits.some((h) => h.kind === kind && h.tool === tool)) hits.push({ kind, tool }); };
  // continuation lines joined; here-doc bodies dropped, except a body fed to a shell word (read as words)
  const bodies = [];
  let text = full.replace(/\\\r?\n/g, "").replace(HEREDOC, (m, tag, off, whole) => {
    const before = whole.slice(0, off); const nl = m.indexOf("\n");
    if (/(?:^|[\s|&;(])(?:\S*\/)?(?:sh|bash|zsh|dash|ksh)(?=\s|$)/.test(before.slice(before.lastIndexOf("\n") + 1) + m.slice(0, nl))) bodies.push(m.slice(nl + 1));
    return " ";
  });
  if (bodies.length) text += "\n" + bodies.join("\n");
  const mp = stripMap(text, /(?!)/g, false);
  // opacity is tested with double-quoted content kept and single-quoted content blanked
  let opaque = bodies.length > 0 || /\$\(|`|<\(|>\(/.test(mp.s.replace(MARK, (_, n) => (mp.q[+n].k === "s" ? "''" : mp.q[+n].text)));
  const parts = mp.s.split(/&&|\|\||;|\||\n|(?<![<>&])&(?![>&])/).map((x) => x.trim()).filter(Boolean).map((raw) => {
    const words = [];
    for (const w of raw.split(/\s+/).filter(Boolean)) {
      const u = unq(w, mp.q); const whole = /^\x01\d+\x02$/.test(w);
      let t = whole ? u.text : u.text.replace(/\\(.)/g, "$1").replace(D2_EDGE, "");
      if (t !== "") words.push({ t, q: u.quoted, msg: false });
    }
    return { raw, words };
  });
  // triggers of the D2-opaque list (§7); `-c` is case-sensitive
  for (const p of parts) {
    const o = p.words.map((w) => w.t); const lc = o.map(d2base);
    const ci = o.findIndex((x) => !/^\w+=/.test(x));
    const later = (i, f) => o.slice(i + 1).some(f);
    if (lc.some((x) => x === "eval" || x === "xargs") || (ci >= 0 && (lc[ci] === "source" || lc[ci] === "."))) opaque = true;
    lc.forEach((b, i) => {
      if (D2_SHELL.has(b) && (i === ci || later(i, (x) => /^-[A-Za-z]*c[A-Za-z]*$/.test(x)) || /<<</.test(p.raw) || /<</.test(p.raw))) opaque = true;
      if (b === "env" && later(i, (x) => /^-[A-Za-z]*S/.test(x))) opaque = true;
      if ((b === "npx" || b === "pnpm" || b === "su" || (b === "npm" && later(i, (x) => x === "exec"))) && later(i, (x) => x === "-c" || x === "--call")) opaque = true;
      if (b === "osascript" && later(i, (x) => x === "-e")) opaque = true;
      if (b === "find" && later(i, (x) => ["-exec", "-execdir", "-ok", "-okdir"].includes(x))) opaque = true;
      if (b === "git" && i >= 0 && !o[i].startsWith("-")) {
        if (later(i, (x) => x === "-c" || x === "--exec" || x.startsWith("--exec=") || x === "-x" || x === "rebase" || x === "filter-branch")) opaque = true;
        const bi = o.indexOf("bisect", i); const si = o.indexOf("submodule", i);
        if ((bi >= 0 && o[bi + 1] === "run") || (si >= 0 && o[si + 1] === "foreach")) opaque = true;
      }
    });
  }
  const trim = (s) => s.replace(D2_EDGE, "");
  for (const p of parts) {
    // git message values (-m, --message) of commit, tag, merge, stash and notes are data (REQ-3)
    const o0 = p.words.map((w) => w.t);
    const gi = o0.findIndex((x, i) => d2base(x) === "git" && !x.startsWith("-") && !/^\w+=/.test(x));
    if (gi >= 0) {
      const { sub, at } = d2GitSub(o0, gi);
      if (D2_MSG_SUB.has(sub)) for (let j = at + 1; j < p.words.length; j++) {
        const t = p.words[j].t;
        if ((t === "-m" || t === "--message" || /^-[A-Za-z]*m$/.test(t)) && p.words[j + 1]) p.words[j + 1].msg = !D2_SUBST.test(p.words[j + 1].t);   // a substitution in the message is no plain data
        else if (t.startsWith("--message=")) p.words[j].msg = !D2_SUBST.test(t);
      }
    }
    p.flat = !opaque ? p.words : p.words.flatMap((w) => (w.q ? [w, ...w.t.split(/[\s;&|]+/).map(trim).filter(Boolean).map((t) => ({ t, q: false, msg: w.msg }))] : [w]));
    const o = p.words.map((w) => w.t); const ci = o.findIndex((x) => !/^\w+=/.test(x));
    p.cmd = ci >= 0 ? d2base(o[ci]) : "";
    let k = D2_K.has(p.cmd);
    if (p.cmd === "git") k = D2_K_GIT.has(d2GitSub(o, ci).sub);
    else if (p.cmd === "brew") k = ["info", "list", "search"].includes(o[ci + 1]);
    else if (p.cmd === "gem") k = o[ci + 1] === "list";
    else if (p.cmd === "npm") k = ["ls", "view"].includes(o[ci + 1]);
    p.inert = k && !opaque;
  }
  // `cd`, `pushd` or a directory option (-C, --chdir, ...) makes a relative word point somewhere else: no temp-set trust
  const hasCd = parts.some((p) => p.flat.some((w) => d2DirOpt(w.t)));
  const revPath = (x) => /^[^/]*:/.test(x);                      // <rev>:path names a blob, not a file of the working directory
  const tempOnly = (v) => !!policy && !hasCd && policy.allowedLocation(v, cwd, rootOf()) && path.resolve(cwd, v) !== path.join(path.resolve(rootOf()), "android", "app", "debug.keystore");
  for (const p of parts) {
    const f = p.flat.map((w) => w.t); const lc = f.map((x) => x.toLowerCase());
    if (!p.inert) {
      // REQ-1: tool words
      for (const w of f) {
        const cands = [w]; const eq = w.lastIndexOf("="); if (eq >= 0) cands.push(trim(w.slice(eq + 1)));
        for (const c of cands) {
          const b = d2base(c).replace(/(.)@[^@/]*$/, "$1");
          if (D2_S.has(b)) add("store", D2_S_SHOWN[b] || b); else if (/^bundletool.*\.jar$/.test(b)) add("store", "bundletool");
        }
        if (w.toLowerCase().includes("androidpublisher")) add("store", "androidpublisher");
        if (w.toLowerCase().includes("api.appstoreconnect.apple.com")) add("store", "api.appstoreconnect.apple.com");
      }
      if (f.some((x) => d2base(x) === "xcodebuild") && lc.some((x) => D2_F.has(x) || x.startsWith("-authenticationkey"))) add("store", "xcodebuild");
      f.forEach((x, i) => { if (["gradlew", "gradlew.bat", "gradle"].includes(d2base(x)) && f.slice(i + 1).some((y) => D2_G.test(y) && !/tomavenlocal$/i.test(y))) add("store", "gradle"); });
      // REQ-2: signing material
      f.forEach((x, i) => {
        const b = d2base(x); const next = lc[i + 1]; const rest = f.slice(i + 1);
        if (b === "security" && next !== undefined && next !== "find-identity" && next !== "help") add("signing", "security");
        if (b === "keytool" && next !== undefined && !["-genkeypair", "-genkey", "-help"].includes(next)) add("signing", "keytool");
        if (b === "codesign") {
          let sign = false; let adhoc = true;
          rest.forEach((y, j) => {
            let val = null;
            if (y.startsWith("--sign")) { sign = true; val = y.startsWith("--sign=") ? y.slice(7) : y === "--sign" ? rest[j + 1] : "?"; }
            else if (/^-[A-Za-z0-9]+$/.test(y) && y.includes("s")) { sign = true; const tail = y.slice(y.indexOf("s") + 1); val = tail !== "" ? tail : rest[j + 1]; }
            if (val !== null && val !== "-") adhoc = false;
          });
          if (sign && !adhoc) add("signing", "codesign");
        }
        if (b === "apksigner" && next === "sign") {
          const ks = rest.findIndex((y) => y === "--ks" || y.startsWith("--ks="));
          const v = ks < 0 ? null : rest[ks].startsWith("--ks=") ? rest[ks].slice(5) : rest[ks + 1];
          if (!(v && tempOnly(v))) add("signing", "apksigner");
        }
        if (b === "jarsigner") {
          const ks = rest.indexOf("-keystore");
          if (!(ks >= 0 && rest[ks + 1] && tempOnly(rest[ks + 1]))) add("signing", "jarsigner");
        }
      });
    }
    // REQ-7: rollback of hook sources by a plain git command (no inert set, no exceptions)
    p.flat.forEach((w, i) => {
      if (d2base(w.t) !== "git" || w.t.startsWith("-") || /^\w+=/.test(w.t)) return;
      const { sub, at } = d2GitSub(f, i);
      if (D2_ROLLBACK.has(sub) && p.flat.slice(at + 1).some((x) => !x.msg && d2Hook(x.t))) add("rollback", sub);
    });
    // REQ-3: secret-file names (the inert set does not apply)
    if (policy && !(!opaque && ["ls", "stat", "test", "["].includes(p.cmd))) {
      for (const w of p.flat) {
        if (w.msg) continue;
        const pat = policy.secretFileName(w.t);
        if (!pat) continue;
        const eq = w.t.lastIndexOf("=");
        if (!hasCd && !revPath(w.t) && (policy.allowedLocation(w.t, cwd, rootOf()) || (eq >= 0 && policy.allowedLocation(w.t.slice(eq + 1), cwd, rootOf())))) continue;
        add("secret", pat);
      }
    }
  }
  return hits;
}

function bashBranch(ev) {
  if (REPAIR_SHAPE.test(String((ev.tool_input && ev.tool_input.command) || ""))) process.exit(0);
  const full = String((ev.tool_input && ev.tool_input.command) || "").replace(/[\x01\x02]/g, "\x03");
  const cwd = ev.cwd || process.cwd();
  const cleaned = strip(full);
  const noHeredoc = full.replace(HEREDOC, " ");

  // Decision collector (Ruling R-16): every rule records, one decision is emitted at the end (deny > ask > none).
  const found = [];
  const note = (d, why) => { if (!found.some((x) => x.d === d && x.why === why)) found.push({ d, why }); };
  const envelope = (why) => note("ask", why);                    // envelope and raw-view asks: every permission mode, as before
  const refuse = (why) => note("deny", why);
  // Permission-mode rule (§7.7), applied here without the policy module to the signing, key, installer and repair asks.
  const mode = ev.permission_mode;
  const modeAsks = mode === undefined || mode === null || ASK_MODES.includes(mode);
  const pathless = (why) => {
    if (modeAsks) return note("ask", why);
    const shown = String(mode).replace(/[^\x20-\x7e]/g, "?").slice(0, 40);
    refuse("this command needs the CEO's dialog, but permission mode '" + shown + "' is not proven to show it. Ask the CEO to switch to default mode or run the command in his own terminal (no hook runs there).");
  };

  if (!policy) pathless("yol politikası (policy.js) yüklenemedi (" + quote(policyError.message) + "): yazma hedefleri denetlenemiyor. Yalnız onarım komutuna izin verin.");

  const home = process.env.HOME || process.env.USERPROFILE || "";
  const expand = (o) => (o.quoted || !home ? o.text : o.text === "~" ? home : o.text.startsWith("~/") ? path.join(home, o.text.slice(2)) : o.text);
  const segs = parseSegments(full);

  // --- signing and key commands (§7.5) ---------------------------------------------------------
  const judged = new Set();
  for (const sg of segs) {
    if (sg.script !== "approve.sh") continue;
    const texts = sg.args.map((o) => o.text);
    const preview = texts.includes("--preview"); const ei = texts.indexOf("--expect");
    if (!preview && ei < 0) continue;                                            // the generic signing ask below (Ruling R-2)
    judged.add(sg);
    if (SIGNING_REST.test(sg.raw)) pathless(SIGNING_WHY);
    if (preview && ei >= 0) { refuse("use either --preview or --expect"); continue; }
    if (preview) continue;                                                       // reads no key: no opinion for this segment
    const want = sg.args[ei + 1];
    const wsArgs = sg.args.filter((o, j) => j !== ei && j !== ei + 1 && !o.text.startsWith("-"));
    let dialog = null;
    if (policy && want && want.literal && wsArgs.length === 1 && wsArgs[0].literal && wsArgs[0].text !== "") {
      try {
        const wsRoot = path.resolve(cwd, expand(wsArgs[0]));
        const dir = path.join(wsRoot, "specs", "active");
        const names = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("."));
        if (names.length === 1) {
          const buf = fs.readFileSync(path.join(dir, names[0]));                 // one read: sha12 and header from the same bytes
          const sha12 = require("crypto").createHash("sha256").update(buf).digest("hex").slice(0, 12);
          const h = policy.parseHeader(buf.toString("utf8"));
          if (sha12 === want.text && !h.errors.length) {
            // Entry kinds from the policy (Ruling R-23), as the preview prints them: enforcement entries apart, a locked
            // entry denies like an unequal sha12 (§7.5). An entry never reaches the dialog outside printable ASCII (S-05).
            const kinds = policy.unlockKinds(h.unlocks, wsRoot, policy.context({ cwd: wsRoot }, { mode: "host", env: process.env, harnessDir: __dirname }));
            const entry = (s) => { const q = JSON.stringify(String(s)).replace(/[^\x20-\x7e]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0")); return q.length > 200 ? q.slice(0, 199) + "…" : q; };
            if (!kinds.locked.length) {
              dialog = "CEO imzası: " + quote("specs/active/" + names[0]) + " · sha " + sha12 + " · Unlocks: " + (kinds.other.length ? kinds.other.map(entry).join(", ") : "yok")
                + (kinds.enforcement.length ? " · Zorlama dosyalarını açar: " + kinds.enforcement.map(entry).join(", ") : "") + ". Bu penceredeki onay, imzanın kendisidir.";
            }
          }
        }
      } catch { dialog = null; }
    }
    if (dialog) pathless(dialog); else refuse(PREVIEW_FIRST);
  }
  if (judged.size === 0) { if (SIGNING.test(noHeredoc)) pathless(SIGNING_WHY); }
  else if (SIGNING.test(segs.filter((sg) => !judged.has(sg)).map((sg) => sg.raw).join("\n"))) pathless(SIGNING_WHY);
  // heredoc bodies are data (a script or a message), not arguments: only the command line itself can carry the flag
  if (/--no-verify\b/.test(noHeredoc) && /\bgit\b/.test(noHeredoc)) refuse("--no-verify yasak: kancaları ve CI'ı atlatmak anayasaya aykırı.");

  // --- installers (§7.4, REQ-22) ---------------------------------------------------------------
  for (const sg of segs) {
    const name = INSTALLERS.has(sg.cmd) ? sg.cmd : INSTALLERS.has(sg.script) ? sg.script : null;
    if (name) pathless("kurulum betiği (" + name + "): betik içinden <cfg> bağlantılarını veya başka bir projenin .claude/settings.json dosyasını yazar.");
  }

  // --- raw view (rows 1-2 only): writes to the enforcement files through the shell, today's test on the raw word text ---
  for (const seg of segments(noHeredoc.replace(/["'`]/g, " "))) {
    const t = tokens(seg); const cmd = baseCmd(t);
    const writes = FILE_WRITERS.has(cmd) || (cmd === "sed" && t.some((a) => /^(-[a-zA-Z]*i|--in-place)/.test(a))) || (cmd === "perl" && t.some((a) => /^-[a-zA-Z]*i/.test(a)));
    if (writes && t.slice(1).some((a) => ENFORCEMENT.test(a))) envelope("zorlama katmanı dosyasını değiştirme.");
    for (const m of seg.matchAll(/>>?\s*(\S+)/g)) if (ENFORCEMENT.test(m[1])) envelope("zorlama katmanı dosyasına yönlendirme.");
  }

  // --- strip view: writer targets go to the shared policy (§7.4, REQ-21, REQ-22) -------------------
  if (policy) {
    let ctx = null;
    const context = () => ctx || (ctx = policy.context(ev, { mode: "host", env: process.env, harnessDir: __dirname }));
    const record = (abs) => {
      const r = policy.decide({ kind: "bash", target: abs, event: ev }, context());
      if (r.decision === "ask") note("ask", r.reason);
      else if (r.decision === "deny") refuse(r.reason || "no decision for this path (fail closed)");
    };
    // A write target with a literal text gets the policy's decision. Any other operand of a writer, and a non-literal
    // target, counts only when its text taken as a literal path falls in rows 1-2 (Ruling R-7, REQ-23).
    const judge = (o, isTarget) => {
      if (o.text === "" || DEVICE.test(o.text)) return;
      const abs = path.resolve(cwd, expand(o));
      if (isTarget && o.literal) return record(abs);
      let c;
      // A path alias that names no location (EALIAS: volfs, /.nofollow, /.resolve) could be any file, rows 1-2 included: refused, as a target is.
      try { c = policy.classify(abs, context()); } catch (e) { if (e instanceof policy.ResolveError) return e.code === "EALIAS" ? record(abs) : undefined; throw e; }
      if (c.row === 1 || c.row === 2) record(abs);
    };
    for (const sg of segs) {
      for (const r of sg.redirects) judge(r, true);
      const wr = writerOperands(sg.cmd, sg.ops);
      if (!wr) continue;
      for (const o of wr.targets) judge(o, true);
      for (const o of wr.operands) if (!wr.targets.includes(o)) judge(o, false);
    }
  }

  // --- envelope rules -----------------------------------------------------------------------------
  // Commands that run other commands hide intent: scan the raw text too.
  const opaque = /\b(?:bash|sh|zsh)\s+-c\b|\beval\b|\bxargs\b|\$\(|`/.test(cleaned);
  // First view: strip() with a memory, so the value of a git directory option can be read back from its quotes.
  // The raw view drops quote and substitution characters so a command wrapped in quotes still splits into tokens.
  const map = stripMap(full, HEREDOC, false);
  const views = opaque ? [map.s, full.replace(/["'`()]/g, " ").replace(/\$\s/g, " ")] : [map.s];
  const branch = currentBranch(cwd);

  const gitRules = (w, wm, i) => {
    // global options before the subcommand (REQ-34)
    const look = []; const keys = []; let dirUnknown = false; let k = i + 1;
    while (k < w.length && w[k].startsWith("-")) {
      const a = w[k]; const eq = a.indexOf("=");
      const name = a.startsWith("--") && eq > 0 ? a.slice(0, eq) : a;
      if (GIT_VALUE_OPTS.has(name)) {
        let val = null;
        if (name !== a) val = unq(wm[k].slice(eq + 1), map.q); else { k++; if (k < w.length) val = unq(wm[k], map.q); }
        if (name === "-C" || name === "--git-dir" || name === "--work-tree") {
          if (!val || !val.literal || val.text === "") dirUnknown = true;
          else if (name === "-C") look.push("-C", expand(val)); else look.push(name + "=" + expand(val));
        } else if ((name === "-c" || name === "--config-env") && val) keys.push(val.text.split("=")[0]);
      }
      k++;
    }
    const sub = w[k]; const args = w.slice(k + 1);
    // the branch of the directory the options name; several -C combine as git combines them
    const br = dirUnknown ? null : look.length ? currentBranch(cwd, look) : branch;
    if (w.slice(0, i).some((x) => GIT_ENV.test(x))) envelope("git ortam değişkeni geçersiz kılma.");
    if (keys.some((key) => GIT_CONFIG_KEY.test(key))) envelope(GIT_CONFIG_WHY);
    if (sub === "push") {
      const specs = args.filter((a) => !a.startsWith("-")).slice(1);                // [remote, refspec...]
      const cluster = (a) => /^-[A-Za-z]{2,}$/.test(a) && /[fd]/.test(a);            // -uf, -fu, -df (REQ-37)
      const force = args.some((a) => /^(-f|--force|--force-with-lease(=.*)?|--delete|-d|--mirror|--prune)$/.test(a) || cluster(a));
      const emptySource = specs.some((r) => /^\+?:./.test(r));                       // `:x` deletes the remote branch
      const byHead = specs.some((r) => /^\+?(HEAD|@)$/.test(r));                     // judged by the current branch, as a bare push
      const toProtected = specs.some((r) => PROTECTED.includes(refDst(r)));
      const bare = specs.length === 0;
      if (force || emptySource) envelope("force/silme push'u geri alınamaz.");
      if (toProtected) envelope("korumalı dala (main) push.");
      if (args.some((a) => a === "--all" || a === "--branches")) envelope("tüm dalların push'u: korumalı dal da güncellenebilir.");
      if (args.some((a) => a === "--tags" || a === "--follow-tags")) envelope("etiket yayını (sürüm).");
      if (bare && (br === null || isProtected(br))) envelope("hedef belirtilmemiş push ve geçerli dal main veya bilinmiyor.");
      if (byHead && (br === null || isProtected(br))) envelope("HEAD push'u ve geçerli dal main veya bilinmiyor.");
    }
    if (sub === "merge" && (br === null || isProtected(br))) envelope("main dalına birleştirme.");
    if (sub === "commit" && br !== null && isProtected(br)) envelope("doğrudan main dalına commit.");
    if (sub === "commit" && dirUnknown) envelope("commit: hedef dizin okunamadı, dal doğrulanamadı.");
    if (sub === "reset" && args.includes("--hard")) envelope("git reset --hard geri alınamaz.");
    if (sub === "clean" && args.some((a) => /^-[a-z]*f/.test(a))) envelope("git clean -f geri alınamaz.");
    if (sub === "rebase") envelope("geçmişi yeniden yazmak.");
    if (sub === "branch" && args.some((a) => a === "-D" || a === "--delete" && args.includes("--force"))) envelope("dal silme.");
    if (sub === "config" && args.some((a) => GIT_CONFIG_KEY.test(a))) envelope(GIT_CONFIG_WHY);
    if (sub === "tag" || sub === "update-ref") envelope("etiket/ref değiştirme (sürüm yayını).");
  };
  const ghRules = (a) => {
    if (a[0] === "pr" && a[1] === "merge") {
      const target = a.slice(2).find((x) => !x.startsWith("-"));
      // Branch protection is unavailable on this plan, so the guard is the merge gate: no merge unless CI is green.
      const checks = prChecks(target, cwd);
      // A repo with CI workflows but no reported checks yet (PR just opened) is NOT green: wait for the first run.
      if (checks && checks.length === 0 && fs.existsSync(path.join(cwd, ".github", "workflows"))) refuse("CI henüz sonuç bildirmedi (kontrol listesi boş): ilk koşu bitmeden birleştirilmez.");
      if (checks && checks.length && checks.some((c) => !GOOD_CHECK.has(c.toUpperCase()))) refuse("CI yeşil değil (" + [...new Set(checks)].map(quote).join(", ") + "): kırmızı veya sürmekte olan PR birleştirilmez.");
      const base = prBase(target, cwd);
      if (base === null) envelope("PR'ın taban dalı doğrulanamadı (fail closed).");
      else if (isProtected(base)) envelope("main'e giden PR birleştirme.");
    }
    if (a[0] === "release") envelope("sürüm yayını.");
    if (a[0] === "repo" && ["delete", "archive", "rename", "edit", "transfer", "create", "fork"].includes(a[1])) envelope("depo yönetimi.");
    if (a[0] === "issue" && a[1] === "delete") envelope("issue silme.");
    if (a[0] === "workflow" && a[1] === "run") envelope("iş akışı tetikleme.");
    if (a[0] === "secret" || a[0] === "auth" || a[0] === "ssh-key" || a[0] === "gpg-key") envelope("kimlik/sır yönetimi.");
    if (a[0] === "api" && a.some((x, i) => /^(-X|--method)$/.test(x) && /^(POST|PUT|PATCH|DELETE)$/i.test(a[i + 1] || ""))) envelope("GitHub API yazma/silme çağrısı.");
  };

  for (const view of views) {
    const v = map.clean(view);
    for (const segm of segments(view)) {
      const seg = map.clean(segm);
      const wm = segm.split(/\s+/).filter(Boolean);                 // words with the quote memory
      const w = wm.map(map.clean);                                  // the same words as strip() shows them
      const t = w.filter((x) => !/^\w+=/.test(x));                  // = tokens(seg)
      const bin = baseCmd(t); const rest = t.slice(t.findIndex((x) => path.basename(x) === bin) + 1);
      if (REMOTE_BIN.has(bin)) envelope("canlıya/uzak sisteme erişim veya dağıtım aracı (" + bin + ").");
      for (const p of PUBLISH) if (bin === p[0] && p.slice(1).every((x, i) => rest[i] === x)) envelope("paket/imaj yayını veya kayıt oturumu (" + p.join(" ") + ").");
      if (bin === "curl" || bin === "wget") {
        const writeCall = rest.some((a, i) => (/^(-X|--request)$/.test(a) && /^(POST|PUT|PATCH|DELETE)$/i.test(rest[i + 1] || "")) || /^(-d|--data(-\w+)?|-F|--form|-T|--upload-file|--json|--post-data|--post-file)(=|$)/.test(a));
        const urls = rest.filter((a) => /^(https?:\/\/|[\w.-]+\.\w{2,}(\/|$))/.test(a) || LOCAL_HOST.test(a));
        if (writeCall && urls.some((u) => !LOCAL_HOST.test(u))) envelope("dış adrese veri gönderen/yazan HTTP çağrısı.");
      }
      // The git and gh rules are tried at every word whose basename is `git` or `gh` (REQ-37); an option or an assignment is never one.
      for (let i = 0; i < w.length; i++) {
        if (w[i].startsWith("-") || /^\w+=/.test(w[i])) continue;
        const b = path.basename(w[i]);
        if (b === "git") gitRules(w, wm, i); else if (b === "gh") ghRules(w.slice(i + 1));
      }
      if (bin === "rm" && rest.some((x) => /^-[a-zA-Z]*[rR]/.test(x) || x === "--recursive")) envelope("özyinelemeli silme.");
      if (/\b(curl|wget)\b/.test(seg) && /\|\s*(sh|bash|zsh)\b/.test(v)) envelope("indirilen betiği doğrudan çalıştırma.");
    }
  }

  // --- spec 0010: store, signing, secret-name and hook-rollback rules (REQ-1..4, REQ-7); the mode rule applies ---------------
  {
    const shown = String(mode).replace(/[^\x20-\x7e]/g, "?").slice(0, 40);
    const rootOf = () => policy.context(ev, { mode: "host", env: process.env, harnessDir: __dirname }).root;
    const RULE = { store: "store upload or release signing", signing: "signing material", secret: "secret file name", rollback: "hook source rollback" };
    const ASK = { store: "mağaza yükleme veya sürüm imzası", signing: "imza malzemesi", secret: "gizli dosya adı", rollback: "kanca kaynağını geri alma" };
    const HINT = { secret: " To list names use ls, stat or the Glob tool.", rollback: ' Only "git restore --source=HEAD -- harness/<name>.js" stays open.' };
    for (const h of d2Scan(full, cwd, rootOf)) {
      const label = h.kind === "rollback" ? "git " + h.tool : h.tool;
      if (modeAsks) {
        if (h.kind === "store" && found.some((x) => x.d === "ask" && x.why.includes("(" + h.tool + ")"))) continue;   // the remote rule already asks (R-3)
        note("ask", ASK[h.kind] + " (" + label + "): bu komutu yalnız CEO çalıştırır.");
      } else {
        refuse(RULE[h.kind] + " (" + label + ") is the CEO's alone, and permission mode '" + shown + "' is not proven to show his dialog. The CEO runs this command in his own terminal (no hook runs there); no spec opens it. Do not rewrite the command to get around this refusal." + (HINT[h.kind] || ""));
      }
    }
  }

  // --- one decision: deny > ask > none; the reason names every rule that produced it (REQ-33) -----
  const whys = (d) => found.filter((x) => x.d === d).map((x) => x.why);
  if (whys("deny").length) deny(whys("deny").join(" · "));
  if (whys("ask").length) ask(whys("ask").join(" · "));
  process.exit(0);
}

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let ev;
  try { ev = JSON.parse(raw); } catch { deny("unreadable hook input (fail closed)"); }
  if (FILE_TOOLS.has(ev.tool_name)) {
    const ti = ev.tool_input || {}; const p = String(ti.file_path || ti.notebook_path || "");
    if (p && ENFORCEMENT.test(path.resolve(ev.cwd || process.cwd(), p))) ask("zorlama katmanı dosyası (" + path.basename(p) + "): bunu değiştirmek kendi sınırlarını değiştirmektir.");
    process.exit(0);
  }
  if (ev.tool_name !== "Bash") process.exit(0);
  bashBranch(ev);
});
