#!/usr/bin/env node
// PreToolUse gate for the file tools (Write, Edit, MultiEdit, NotebookEdit). Reads the tool call JSON from stdin.
// Every decision comes from the shared path policy (policy.js, spec 0004 §7.1); this file only does the hook I/O (§7.8):
//   deny       => exit 2 + stderr "BLOCKED by company gate: ..." (the call is blocked, the reason is fed back to Claude)
//   ask        => exit 0 + the ask JSON on stdout (host only: the CEO's permission dialog)
//   allow/none => exit 0, no output
// Modes: `gate.js --host` on the CEO's machine (root from CLAUDE_PROJECT_DIR, COMPANY_* test variables ignored);
//        `gate.js` in the container (root is the call's cwd, nobody to ask: every ask is a refusal).
"use strict";
process.on("uncaughtException", (e) => { process.stderr.write("BLOCKED by company gate: internal error (fail closed): " + e.message + "\n"); process.exit(2); });
const policy = require("./policy.js");

const HOST = process.argv.slice(2).includes("--host");
const FILE_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit"];
const block = (msg) => { process.stderr.write("BLOCKED by company gate: " + msg + "\n"); process.exit(2); };

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let ev;
  try { ev = JSON.parse(raw); } catch { block("unreadable hook input (fail closed)"); }
  if (ev === null || typeof ev !== "object" || Array.isArray(ev)) block("unreadable hook input (fail closed)");
  if (!FILE_TOOLS.includes(ev.tool_name || "")) process.exit(0);

  const input = ev.tool_input || {};
  let target = input.file_path || input.notebook_path || "";
  if (typeof target !== "string") block("the write target is not a path (fail closed)");
  // Host: a file-tool call without a target cannot be classified. Container: as before, an empty target is the workspace root itself.
  if (HOST && target === "") block("the tool call names no file_path (fail closed)");

  const ctx = policy.context(ev, { mode: HOST ? "host" : "container", env: process.env, harnessDir: __dirname });
  const r = policy.decide({ kind: "file", target, event: ev }, ctx);
  if (r.decision === "allow" || r.decision === "none") process.exit(0);
  if (r.decision === "ask" && HOST) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "CEO onayı gerekir: " + r.reason } }));
    process.exit(0);
  }
  block(r.reason || "no decision for this path (fail closed)");
});
