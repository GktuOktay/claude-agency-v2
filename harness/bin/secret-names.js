#!/usr/bin/env node
// secret-names.js (spec 0010 REQ-5): lists every tracked or not-ignored file under <root> whose name is a scan name
// (keystores, profiles, key.properties, credentials.json, ...). Names only: no file content is read.
//   exit 0 clean · 1 finding (one path per line on stdout) · 2 usage error
// Only the exact path android/app/debug.keystore is allowed. Used by lint and by app repositories (their pre-commit part).
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const policy = require(path.join(__dirname, "..", "policy.js"));

const root = process.argv[2];
if (!root || process.argv.length !== 3) { console.error("usage: secret-names.js <root>"); process.exit(2); }
let base;
try { base = fs.realpathSync(path.resolve(root)); if (!fs.statSync(base).isDirectory()) throw new Error("not a directory"); }
catch { console.error("secret-names.js: not a directory: " + root); process.exit(2); }

let files = null;
if (fs.existsSync(path.join(base, ".git"))) {
  try {
    files = execFileSync("git", ["-C", base, "ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean);
  } catch { files = null; }
}
if (files === null) {                                              // no git: a directory walk that does not follow symlinks
  files = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r); else files.push(r);
    }
  };
  walk(base, "");
}
const hits = files.filter((f) => f !== "android/app/debug.keystore" && policy.scanName(path.posix.basename(f.split(path.sep).join("/"))) !== null
  && (() => { try { fs.lstatSync(path.join(base, f)); return true; } catch { return false; } })());
for (const h of hits) console.log(h);
process.exit(hits.length ? 1 : 0);
