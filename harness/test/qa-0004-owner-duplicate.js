#!/usr/bin/env node
// harness/test/qa-0004-owner-duplicate.js: failing reproduction (QA, spec 0004 T-11). Not in harness/bin/check.
// Run: node harness/test/qa-0004-owner-duplicate.js   (exit 1 while the finding is open)
// AC-12: lint fails (FAIL  host-gate-owner) "when any other PreToolUse entry with a file-tool matcher runs gate.js or
// guard.js (one owner)". A second entry that runs `gate.js --host` for a tool the first entry already covers passes lint
// today (lint.js:240 leaves host-gate commands out of `others`; lint-rules.sh:299 pins that reading). The gate then runs
// twice for one edit: two refusals in `auto`, two dialogs in a proven mode (AC-15 expects one).
// Fixture rule of AC-6: a temp copy of the tracked tree plus only the change under test.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const HERE = path.resolve(__dirname, ".."), REPO = path.dirname(HERE);
const T = fs.mkdtempSync(path.join(os.tmpdir(), "qa-owner-"));
let pass = 0, fail = 0;
const t = (name, want, got) => { if (want === got) { pass++; console.log("ok    " + name); } else { fail++; console.log(`FAIL  ${name} (expected ${want}, got ${got})`); } };
const lint = (root) => {
  const r = cp.spawnSync(process.execPath, [path.join(HERE, "bin", "lint.js")], { encoding: "utf8", env: Object.assign({}, process.env, { COMPANY_LINT_ROOT: root }) });
  return { rc: r.status, out: (r.stdout || "") + (r.stderr || "") };
};
try {
  const C = path.join(T, "c");
  for (const f of cp.execFileSync("git", ["-C", REPO, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean)) {
    const from = path.join(REPO, f), to = path.join(C, f);
    let st; try { st = fs.lstatSync(from); } catch { continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (st.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to); else if (st.isFile()) fs.copyFileSync(from, to);
  }
  t("baseline fixture: exit 0", 0, lint(C).rc);

  // the change under test: the tracked host gate entry, copied as one more PreToolUse entry (same matcher, same command)
  const sf = path.join(C, ".claude", "settings.json");
  const j = JSON.parse(fs.readFileSync(sf, "utf8"));
  const isGate = (e) => (e.hooks || []).some((h) => /gate\.js" --host/.test(h.command || ""));
  j.hooks.PreToolUse.push(JSON.parse(JSON.stringify(j.hooks.PreToolUse.find(isGate))));
  fs.writeFileSync(sf, JSON.stringify(j, null, 2) + "\n");
  t("setup: two PreToolUse entries run gate.js --host for the four file tools", 2, j.hooks.PreToolUse.filter(isGate).length);

  const r = lint(C);
  t("AC-12 a second entry running gate.js for the same file tools: exit 1", 1, r.rc);
  t("AC-12 a second entry running gate.js for the same file tools: FAIL  host-gate-owner", true, /^FAIL {2}host-gate-owner( |:|$)/m.test(r.out));
} finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log("\n" + (fail === 0 ? `QA OWNER-DUPLICATE REPRO GREEN: ${pass} passed, 0 failed` : `QA OWNER-DUPLICATE REPRO FAILED: ${pass} passed, ${fail} failed`));
process.exit(fail === 0 ? 0 : 1);
