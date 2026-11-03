#!/usr/bin/env node
// loop.js: PreToolUse hook that stops an agent from running in circles.
// Constitution: 3 failed attempts -> stop and report. This hook catches the mechanical form of it:
//   - the same tool call (same tool, same input) LOOP_MAX times in a row (default 5), or
//   - a short cycle (2 or 3 different calls) repeated 3 times (A,B,A,B,A,B).
// On a hit the call is refused (exit 2) with a message that tells the agent to change approach, or stop and report.
// A different call in between resets a streak. State: one small file per session in the temp dir.
// Fails OPEN: a bug here must never trap a session. Bookkeeping tools (plan/task lists) are exempt: they repeat legitimately.
//   COMPANY_LOOP_MAX=<n>   same-call threshold (default 5; 0 turns the hook off)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MAX = Number(process.env.COMPANY_LOOP_MAX === undefined ? 5 : process.env.COMPANY_LOOP_MAX);
const KEEP = 24;
const EXEMPT = /^mcp__ccd_turn__|^TodoWrite$|^Task(Create|Update|List|Get|Output|Stop)$|^ScheduleWakeup$/;

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
const hashCall = (name, input) => crypto.createHash("sha1").update(name + "\u0000" + stableStringify(input || {})).digest("hex").slice(0, 16);

// Pure detector, exported for tests: history includes the current call as the last item.
function detect(history, max) {
  if (max > 0 && history.length >= max) {
    const tail = history.slice(-max);
    if (tail.every((h) => h === tail[0])) return { kind: "same", n: max };
  }
  for (const p of [2, 3]) {
    const need = p * 3;
    if (history.length < need) continue;
    const tail = history.slice(-need);
    const cyc = tail.slice(0, p);
    if (new Set(cyc).size > 1 && tail.every((h, i) => h === cyc[i % p])) return { kind: "cycle", n: p };
  }
  return null;
}
module.exports = { detect, hashCall };

if (require.main === module) {
  let buf = "";
  process.stdin.on("data", (d) => { buf += d; });
  process.stdin.on("end", () => {
    try {
      if (!(MAX > 0)) process.exit(0);
      const ev = JSON.parse(buf || "{}");
      const name = String(ev.tool_name || "");
      if (!name || EXEMPT.test(name)) process.exit(0);
      const sid = String(ev.session_id || "nosession").replace(/[^\w-]/g, "").slice(0, 64) || "nosession";
      const file = path.join(process.env.COMPANY_LOOP_DIR || os.tmpdir(), `company-loop-${sid}.json`);
      let hist = [];
      try { hist = JSON.parse(fs.readFileSync(file, "utf8")); if (!Array.isArray(hist)) hist = []; } catch { hist = []; }
      hist.push(hashCall(name, ev.tool_input)); hist = hist.slice(-KEEP);
      try { fs.writeFileSync(file, JSON.stringify(hist), { mode: 0o600 }); } catch { /* read-only temp: still evaluate */ }
      const hit = detect(hist, MAX);
      if (hit) {
        const what = hit.kind === "same" ? `aynı çağrı üst üste ${hit.n} kez` : `${hit.n} çağrılık döngü 3 kez tekrarlandı`;
        process.stderr.write(`BLOCKED by company loop guard: ${what} (${name}). Aynı şeyi tekrarlamak sonuç vermiyor. ` +
          "Farklı bir yaklaşım dene; olmuyorsa anayasa gereği dur, STATE.md'yi güncelle ve neyin başarısız olduğunu bildir.\n");
        process.exit(2);
      }
    } catch { /* fail open */ }
    process.exit(0);
  });
}
