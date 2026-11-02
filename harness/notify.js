#!/usr/bin/env node
// notify.js: desktop notification when the company needs the CEO (B7).
//   Hook mode  (Notification event, JSON on stdin): wired in .claude/settings.json.
//   CLI mode   node notify.js "<title>" "<message>"   (used by company-run.sh when a run ends).
// Fails open and never blocks: a broken notifier must not stop work. Text goes to the OS as arguments, never through a shell.
// COMPANY_NOTIFY=off silences it. Zero dependencies.
"use strict";
const { spawnSync } = require("child_process");

const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

function notify(title, message) {
  if (process.env.COMPANY_NOTIFY === "off") return "off";
  title = clean(title, 80) || "Şirket"; message = clean(message, 200) || "CEO dikkati gerekiyor";
  if (process.platform === "darwin") {
    const r = spawnSync("osascript", ["-e", "on run argv", "-e", "display notification (item 1 of argv) with title (item 2 of argv)", "-e", "end run", message, title], { timeout: 5000, stdio: "ignore" });
    return r.status === 0 ? "sent" : "failed";
  }
  const r = spawnSync("notify-send", [title, message], { timeout: 5000, stdio: "ignore" });
  if (r.status === 0) return "sent";
  process.stderr.write(`[notify] ${title}: ${message}\n`);
  return "stderr";
}

module.exports = { notify, clean };

if (require.main === module) {
  if (process.argv.length > 2) { notify(process.argv[2], process.argv[3]); process.exit(0); }
  let buf = "";
  process.stdin.on("data", (d) => { buf += d; });
  process.stdin.on("end", () => {
    try {
      const ev = JSON.parse(buf || "{}");
      const kind = ev.notification_type || "";
      const title = /permission/i.test(kind) ? "Şirket: onayın gerekiyor" : /idle/i.test(kind) ? "Şirket: seni bekliyor" : "Şirket: bildirim";
      notify(title, ev.message || "Oturum senden bir şey bekliyor.");
    } catch { /* fail open */ }
    process.exit(0);
  });
}
