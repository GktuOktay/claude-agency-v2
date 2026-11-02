// Minimal CONNECT-only egress proxy with a hostname allowlist. No dependencies.
const http = require("http");
const net = require("net");
const ALLOW = (process.env.ALLOW_HOSTS || "api.anthropic.com").split(",").map((s) => s.trim());
const log = (...a) => console.log(new Date().toISOString(), ...a);
const server = http.createServer((req, res) => { res.writeHead(405); res.end("CONNECT only\n"); });
server.on("connect", (req, client, head) => {
  const [host, port] = req.url.split(":");
  if (!ALLOW.includes(host) || port !== "443") {
    log("DENY", req.url);
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const up = net.connect(443, host, () => {
    log("ALLOW", req.url);
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    up.write(head); up.pipe(client); client.pipe(up);
  });
  up.on("error", () => client.destroy());
  client.on("error", () => up.destroy());
});
server.listen(3128, () => log("proxy up; allow =", ALLOW.join(",")));
