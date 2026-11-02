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

const PROTECTED = (process.env.COMPANY_PROTECTED_BRANCHES || "main,master").split(",").map((s) => s.trim()).filter(Boolean);
const isProtected = (b) => PROTECTED.includes(b.replace(/^refs\/heads\//, "").replace(/^.*:/, ""));

function currentBranch(cwd) {
  try { return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim(); }
  catch { return null; }
}
function prBase(arg, cwd) {
  if (process.env.COMPANY_PR_BASE) return process.env.COMPANY_PR_BASE;
  try {
    const a = ["pr", "view"]; if (arg) a.push(arg); a.push("--json", "baseRefName", "-q", ".baseRefName");
    return execFileSync("gh", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).trim() || null;
  } catch { return null; }
}

// Remove heredoc bodies and quoted strings so words inside commit messages do not trigger rules.
function strip(cmd) {
  let s = cmd.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1(?=\s|$)/g, " ");
  s = s.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return s;
}
function segments(s) { return s.split(/&&|\|\||;|\||\n/).map((x) => x.trim()).filter(Boolean); }
function tokens(seg) { return seg.split(/\s+/).filter(Boolean).filter((t) => !/^\w+=/.test(t)); }

const ask = (why) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "CEO onayı gerekir: " + why } }));
  process.exit(0);
};
const deny = (why) => { process.stderr.write("BLOCKED by company guard: " + why + "\n"); process.exit(2); };

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let ev;
  try { ev = JSON.parse(raw); } catch { deny("unreadable hook input (fail closed)"); }
  if (ev.tool_name !== "Bash") process.exit(0);
  const full = String((ev.tool_input && ev.tool_input.command) || "");
  const cwd = ev.cwd || process.cwd();
  const cleaned = strip(full);

  // Commands that run other commands hide intent: scan the raw text too.
  const opaque = /\b(?:bash|sh|zsh)\s+-c\b|\beval\b|\bxargs\b|\$\(|`/.test(cleaned);
  // The raw view drops quote and substitution characters so a command wrapped in quotes still splits into tokens.
  const views = opaque ? [cleaned, full.replace(/["'`()]/g, " ").replace(/\$\s/g, " ")] : [cleaned];
  const branch = currentBranch(cwd);

  if (/--no-verify\b/.test(full) && /\bgit\b/.test(full)) deny("--no-verify yasak: kancaları ve CI'ı atlatmak anayasaya aykırı.");

  for (const v of views) for (const seg of segments(v)) {
    const t = tokens(seg);
    const gi = t.indexOf("git"); const ghi = t.indexOf("gh");
    if (gi >= 0) {
      const sub = t[gi + 1]; const args = t.slice(gi + 2);
      if (sub === "push") {
        const force = args.some((a) => /^(-f|--force|--force-with-lease(=.*)?|--delete|-d|--mirror|--prune)$/.test(a));
        const refs = args.filter((a) => !a.startsWith("-"));            // [remote, refspec...]
        const specs = refs.slice(1);
        const toProtected = specs.some((r) => isProtected(r));
        const bare = specs.length === 0;
        if (force) ask("force/silme push'u geri alınamaz.");
        if (toProtected) ask("korumalı dala (main) push.");
        if (bare && (branch === null || isProtected(branch))) ask("hedef belirtilmemiş push ve geçerli dal main veya bilinmiyor.");
      }
      if (sub === "merge" && (branch === null || isProtected(branch))) ask("main dalına birleştirme.");
      if (sub === "commit" && branch !== null && isProtected(branch)) ask("doğrudan main dalına commit.");
      if (sub === "reset" && args.includes("--hard")) ask("git reset --hard geri alınamaz.");
      if (sub === "clean" && args.some((a) => /^-[a-z]*f/.test(a))) ask("git clean -f geri alınamaz.");
      if (sub === "rebase") ask("geçmişi yeniden yazmak.");
      if (sub === "branch" && args.some((a) => a === "-D" || a === "--delete" && args.includes("--force"))) ask("dal silme.");
      if (sub === "config" && args.some((a) => /hooksPath|core\.editor|credential/i.test(a))) ask("git yapılandırması (kanca yolu/kimlik).");
      if (sub === "tag" || sub === "update-ref") ask("etiket/ref değiştirme (sürüm yayını).");
    }
    if (ghi >= 0) {
      const a = t.slice(ghi + 1);
      if (a[0] === "pr" && a[1] === "merge") {
        const target = a.slice(2).find((x) => !x.startsWith("-"));
        const base = prBase(target, cwd);
        if (base === null) ask("PR'ın taban dalı doğrulanamadı (fail closed).");
        else if (isProtected(base)) ask("main'e giden PR birleştirme.");
      }
      if (a[0] === "release") ask("sürüm yayını.");
      if (a[0] === "repo" && ["delete", "archive", "rename", "edit", "transfer", "create", "fork"].includes(a[1])) ask("depo yönetimi.");
      if (a[0] === "issue" && a[1] === "delete") ask("issue silme.");
      if (a[0] === "workflow" && a[1] === "run") ask("iş akışı tetikleme.");
      if (a[0] === "secret" || a[0] === "auth" || a[0] === "ssh-key" || a[0] === "gpg-key") ask("kimlik/sır yönetimi.");
      if (a[0] === "api" && a.some((x, i) => /^(-X|--method)$/.test(x) && /^(POST|PUT|PATCH|DELETE)$/i.test(a[i + 1] || ""))) ask("GitHub API yazma/silme çağrısı.");
    }
    if (t[0] === "rm" && t.some((x) => /^-[a-zA-Z]*[rR]/.test(x))) ask("özyinelemeli silme.");
    if (/\b(curl|wget)\b/.test(seg) && /\|\s*(sh|bash|zsh)\b/.test(v)) ask("indirilen betiği doğrudan çalıştırma.");
  }
  process.exit(0);
});
