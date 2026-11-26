#!/usr/bin/env node
// harness/test/qa-0004-reason-separator.js: failing reproduction (QA, spec 0004 T-11). Not in harness/bin/check.
// Run: node harness/test/qa-0004-reason-separator.js   (exit 1 while the finding is open)
// Spec 0004 §7.1 (REQ-33, Ruling R-16): when one Bash command triggers several rules, the guard emits one decision
// "with the reasons of every rule at that level joined by ` · `". guard.js:397-398 joins them with " | ".
// AC-9 asserts only that both reasons are present, so no case of guard.sh sees the separator.
// The command below triggers two envelope rules and no writer rule (a feature repo without specs/), so the test runs the
// guard of this harness directly: no signature and no key is read.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const HERE = path.resolve(__dirname, "..");
const T = fs.mkdtempSync(path.join(os.tmpdir(), "qa-sep-"));
let pass = 0, fail = 0;
const t = (name, want, got) => { if (want === got) { pass++; console.log("ok    " + name); } else { fail++; console.log(`FAIL  ${name} (expected ${want}, got ${got})`); } };
try {
  const F = path.join(T, "feat"); fs.mkdirSync(F);
  cp.execFileSync("git", ["-C", F, "init", "-q"], { stdio: "ignore" });
  cp.execFileSync("git", ["-C", F, "checkout", "-q", "-b", "feat/0001-x"], { stdio: "ignore" });
  const ev = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push origin main; rm -rf build" }, cwd: F });
  const r = cp.spawnSync(process.execPath, [path.join(HERE, "guard.js")], { input: ev, encoding: "utf8", env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: F }) });
  let reason = "";
  try { reason = JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason; } catch { /* no ask JSON */ }
  t("setup: one ask (exit 0)", 0, r.status);
  t("setup: the reason names the push to main", true, reason.includes("korumalı dala (main) push."));
  t("setup: the reason names the recursive deletion", true, reason.includes("özyinelemeli silme."));
  t("REQ-33 the two reasons are joined by ' · ' (spec 7.1)", true, reason.includes("korumalı dala (main) push. · özyinelemeli silme."));
} finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log("\n" + (fail === 0 ? `QA REASON-SEPARATOR REPRO GREEN: ${pass} passed, 0 failed` : `QA REASON-SEPARATOR REPRO FAILED: ${pass} passed, ${fail} failed`));
process.exit(fail === 0 ? 0 : 1);
