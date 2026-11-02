#!/usr/bin/env node
// stop.js: Stop hook. Enforces constitution rule 2 ("done = fresh evidence").
// If this turn edited code files and no build/test/check command ran after the last edit, the turn
// may not end silently: it is sent back once to verify, or to say plainly that it is unverified.
// Fails OPEN (a broken Stop hook must never trap a session); stop_hook_active prevents loops.
"use strict";
const fs = require("fs");

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const NON_CODE = /\.(md|txt)$|(^|\/)(docs|specs|plans|templates|approvals)\//;
const EVIDENCE = /harness\/bin\/check|harness\/test\/|\bdotnet\s+(build|test|format)\b|\bnpm\s+(test|run\s+(test|build|lint)|ci)\b|\bnpx\s+tsc\b|\bnode\s+--check\b|\bsh\s+-n\b|\bpytest\b|\bgo\s+test\b|\bcargo\s+(test|build)\b|\bmake\s+(test|check)\b/;
const HONEST = /doğrulanmadı|doğrulanamadı|doğrulamadım|çalıştırmadım|not verified|unverified|did not run/i;

function allow() { process.exit(0); }

function main(stdin) {
  let input;
  try { input = JSON.parse(stdin || "{}"); } catch { return allow(); }
  if (input.stop_hook_active) return allow();
  const tp = input.transcript_path;
  if (!tp || !fs.existsSync(tp)) return allow();

  const rows = [];
  for (const line of fs.readFileSync(tp, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* skip torn line */ }
  }
  const isUserText = (r) => r.type === "user" && r.message && (
    typeof r.message.content === "string" ||
    (Array.isArray(r.message.content) && r.message.content.some((b) => b.type === "text")));
  let start = 0;
  for (let i = rows.length - 1; i >= 0; i--) if (isUserText(rows[i])) { start = i + 1; break; }
  const turn = rows.slice(start);

  let lastEdit = -1, lastEvidence = -1, finalText = "";
  turn.forEach((r, i) => {
    const c = r.message && r.message.content;
    if (r.type !== "assistant" || !Array.isArray(c)) return;
    for (const b of c) {
      if (b.type === "text") finalText = b.text || finalText;
      if (b.type !== "tool_use") continue;
      const inp = b.input || {};
      if (EDIT_TOOLS.has(b.name)) {
        const p = String(inp.file_path || inp.notebook_path || "");
        if (p && !NON_CODE.test(p)) lastEdit = i;
      } else if (b.name === "Bash" && EVIDENCE.test(String(inp.command || ""))) lastEvidence = i;
    }
  });

  if (lastEdit < 0 || lastEvidence > lastEdit || HONEST.test(finalText)) return allow();
  const reason = "Bu turda kod dosyaları değişti ama sonrasında derleme/test/check çalıştırılmadı. Anayasa kural 2: bitti = taze kanıt. " +
    "Ya doğrulamayı şimdi çalıştır (ör. ./harness/bin/check, dotnet test) ve çıktıyı göster, ya da son mesajında değişikliğin 'doğrulanmadı' olduğunu açıkça yaz.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

let buf = "";
process.stdin.on("data", (d) => { buf += d; });
process.stdin.on("end", () => { try { main(buf); } catch { allow(); } });
