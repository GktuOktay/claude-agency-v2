#!/usr/bin/env node
// PreToolUse gate. Reads the tool call JSON from stdin.
// exit 2 + stderr  => the call is blocked and the reason is fed back to Claude.
// Rules: (1) approvals/, .claude/ and the harness are never writable by the agent;
//        (2) specs/ and docs/ are always writable (drafting);
//        (3) anything else is "code" and needs a valid CEO approval for the active spec.
"use strict";
process.on("uncaughtException", (e) => { process.stderr.write("BLOCKED by company gate: internal error (fail closed): " + e.message + "\n"); process.exit(2); });
const fs = require("fs");
const path = require("path");
const { verify } = require("./approval.js");

const HARNESS = process.env.COMPANY_HARNESS_DIR || __dirname;
const PUB = process.env.COMPANY_PUBKEY || path.join(HARNESS, "keys", "ceo.pub.pem");

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let ev;
  try { ev = JSON.parse(raw); } catch { process.stderr.write("BLOCKED by company gate: unreadable hook input (fail closed)\n"); process.exit(2); }
  const tool = ev.tool_name || "";
  const root = path.resolve(ev.cwd || process.cwd());
  const input = ev.tool_input || {};
  const block = (msg) => { process.stderr.write("BLOCKED by company gate: " + msg + "\n"); process.exit(2); };

  if (!["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) process.exit(0);
  const target = path.resolve(root, input.file_path || input.notebook_path || "");
  const rel = path.relative(root, target);
  const within = (dir) => rel === dir || rel.startsWith(dir + path.sep);

  if (rel.startsWith("..")) block("path is outside the workspace");
  if (within("approvals") || within(".claude") || within(".git")) block(rel + " is protected; only the CEO changes approvals and gate configuration");
  if (within("specs") || within("docs")) process.exit(0);

  const dir = path.join(root, "specs", "active");
  let specs = [];
  try { specs = fs.readdirSync(dir).filter((f) => f.endsWith(".md")); } catch {}
  const wanted = process.env.COMPANY_SPEC ? [process.env.COMPANY_SPEC] : specs;
  if (wanted.length !== 1) block("exactly one active spec is required (found " + wanted.length + ")");
  const spec = path.join(dir, wanted[0]);
  const [ok, why] = verify(spec, path.join(root, "approvals"), PUB, root);
  if (!ok) block("no code before the CEO signs the spec (" + why + "). Ask the CEO to run the approve command.");
  process.exit(0);
});
