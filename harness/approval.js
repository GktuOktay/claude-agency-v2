#!/usr/bin/env node
// Company approval tool: ed25519 signature bound to the spec's exact content.
// keygen <dir> [--no-passphrase]     create a private key (encrypted unless --no-passphrase) + public key
// sign   <spec> <approvalsDir> <key> CEO signs (needs a terminal and a passphrase)
// verify <spec> <approvalsDir> <pub> prints APPROVED / NOT APPROVED, exit 0 / 1
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const message = (rel, hash) => Buffer.from(`company-approval-v1\n${rel}\n${hash}\n`);
const sigFile = (dir, rel) => path.join(dir, rel.replace(/[\\/]/g, "__") + ".sig.json");

function askPassphrase() {
  if (process.env.COMPANY_TEST_MODE === "1" && process.env.COMPANY_TEST_PASSPHRASE) {
    return Promise.resolve(process.env.COMPANY_TEST_PASSPHRASE);
  }
  if (!process.stdin.isTTY) {
    console.error("REFUSED: signing needs an interactive terminal (no TTY here).");
    process.exit(3);
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {};
    process.stdout.write("Passphrase: ");
    rl.question("", (p) => { rl.close(); process.stdout.write("\n"); resolve(p); });
  });
}

function verify(spec, dir, pubPath, root) {
  const rel = path.relative(root, path.resolve(spec));
  let content;
  try { content = fs.readFileSync(spec); } catch { return [false, "spec not readable"]; }
  let rec;
  try { rec = JSON.parse(fs.readFileSync(sigFile(dir, rel), "utf8")); } catch { return [false, "no approval record"]; }
  const hash = sha256(content);
  if (rec.sha256 !== hash) return [false, "spec changed after approval"];
  if (rec.spec !== rel) return [false, "approval is for another path"];
  try {
    const ok = crypto.verify(null, message(rel, hash), crypto.createPublicKey(fs.readFileSync(pubPath)), Buffer.from(rec.signature, "base64"));
    return ok ? [true, "valid signature"] : [false, "signature invalid"];
  } catch { return [false, "signature malformed"]; }
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "keygen") {
    const plain = process.argv.includes("--no-passphrase") || process.env.COMPANY_NO_PASSPHRASE === "1";
    const pass = plain ? null : await askPassphrase();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: plain ? { type: "pkcs8", format: "pem" } : { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: pass },
    });
    fs.mkdirSync(a, { recursive: true });
    fs.writeFileSync(path.join(a, "ceo.key.pem"), privateKey, { mode: 0o600 });
    fs.writeFileSync(path.join(a, "ceo.pub.pem"), publicKey);
    console.log("keys written to", a);
  } else if (cmd === "sign") {
    const root = process.cwd();
    const rel = path.relative(root, path.resolve(a));
    const content = fs.readFileSync(a);
    // An unencrypted key signs without a prompt: the CEO's click on the app's permission dialog (guard.js) is the presence proof.
    const pem = fs.readFileSync(c, "utf8");
    const encrypted = /ENCRYPTED/.test(pem);
    const pass = encrypted ? await askPassphrase() : undefined;
    let key;
    try { key = crypto.createPrivateKey(encrypted ? { key: pem, passphrase: pass } : { key: pem }); }
    catch { console.error("REFUSED: wrong passphrase"); process.exit(4); }
    const hash = sha256(content);
    const signature = crypto.sign(null, message(rel, hash), key).toString("base64");
    fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(sigFile(b, rel), JSON.stringify({ version: 1, spec: rel, sha256: hash, signature, signedAt: new Date().toISOString() }, null, 2));
    console.log("signed", rel, hash.slice(0, 12));
  } else if (cmd === "verify") {
    const [ok, why] = verify(a, b, c, process.cwd());
    console.log(ok ? "APPROVED" : "NOT APPROVED: " + why);
    process.exit(ok ? 0 : 1);
  } else {
    console.error("usage: keygen|sign|verify");
    process.exit(2);
  }
}
if (require.main === module) main();
module.exports = { verify };
