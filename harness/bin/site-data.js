#!/usr/bin/env node
// site-data.js: builds the node-map data of the intro page (site/index.html) from the real repository.
//   node site-data.js --write   regenerate the data block inside site/index.html
//   node site-data.js --check   exit 1 if the page's data block is stale (lint runs this, so the page cannot drift)
// Units come from .claude/agents/*.md (model, tools, skills); relations and one-line roles are curated below.
// Zero dependencies.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PAGE = path.join(ROOT, "site", "index.html");
const START = '<script type="application/json" id="map-data">';
const END = "</script><!--/map-data-->";

function fm(file) {
  const t = fs.readFileSync(file, "utf8"); const m = t.match(/^---\n([\s\S]*?)\n---\n/); const o = {}; let key = null;
  for (const l of m[1].split("\n")) {
    const li = l.match(/^\s+-\s+(.*)$/); if (li && key) { o[key].push(li[1].trim()); continue; }
    const kv = l.match(/^([A-Za-z][\w-]*):\s*(.*)$/); if (!kv) continue;
    if (kv[2] === "") { o[kv[1]] = []; key = kv[1]; } else { o[kv[1]] = kv[2]; key = null; }
  }
  return o;
}

// column, row, label, role (what it does, one sentence)
const UNITS = {
  "product-manager":   ["u1", 0, "Product", "Kaynaklı piyasa araştırması yapar, yap / yapma / farklı yap kararı ve yol haritası çıkarır."],
  "business-analyst":  ["u1", 1, "Business analyst", "CEO'nun anlatımını imzalanabilir, kelimesi kelimesine teknik spec'e çevirir."],
  "spec-critic":       ["u1", 2, "Spec critic", "Spec'i yazarın bağlamını bilmeden düşmanca okur, cevapsız soruları sıralar. Yazma aracı yok."],
  "scout":             ["u1", 3, "Scout", "Hazır çözüm arar (API, depo, MCP, plugin), kaynaklı karşılaştırır. Kurmaz: Bash'i yok."],
  "delivery-manager":  ["u1", 4, "Delivery", "İmzalı spec'ten plan, issue, branch ve PR üretir, CI'ı izler. main'e gideni CEO'ya bırakır."],
  "dotnet-engineer":   ["u2", 0, ".NET engineer", "İmzalı spec'i C# / ASP.NET Core / EF Core ile test önce yaklaşımıyla koda çevirir."],
  "react-engineer":    ["u2", 1, "React engineer", "İmzalı spec'i React, TypeScript, Vite ile tüm ekran durumlarıyla (yükleniyor, boş, hata, başarı) koda çevirir."],
  "qa-engineer":       ["u2", 2, "QA engineer", "Her kabul kriterini bir kanıta eşler, testleri kodu bozarak yoklar. Üretim kodu yazmaz."],
  "devops-sre":        ["u2", 3, "DevOps / SRE", "Deploy paketi (adım, geri alma, sağlık kontrolü), CI, yedek ve izleme hazırlar. Deploy etmez."],
  "marketing":         ["u2", 4, "Marketing", "Mağaza ve ürün metni, marka kılavuzu, varlık brifi yazar. İddiaları kaynağa bağlar; yayınlamaz."],
  "tech-comms":        ["u2", 5, "Tech comms", "Kullanım kılavuzu, sürüm notu, yönetici özeti gibi dış doküman kaynağını hazırlar."],
  "internal-auditor":  ["u3", 0, "Internal audit", "İşi yapandan bağımsız denetler, bulguları gerekçeyle triyaj eder, scorecard doldurur. Yazma aracı yok."],
  "appsec":            ["u3", 1, "AppSec", "İmzadan önce tehdit modelini, teslimden önce kodu ve bağımlılıkları OWASP'a göre denetler. Yazma yok."],
  "architecture-board":["u3", 2, "Architecture board", "Mimariyi ve yeni teknoloji gerekçesini imzadan önce denetler; standart yığın kaydını tutar."],
  "talent-capacity":   ["u3", 3, "Talent & capacity", "Scorecard verisinden darboğaz ve eksik uzmanlığı raporlar; kapasite tahminini yoklar. Rol eklemez."],
  "quality-office":    ["u3", 4, "Quality office", "Gereksinim → test → kanıt izlenebilirliğini ve uyum listesini (KVKK, lisans) tutar. Hukuki görüş vermez."],
};

const OTHER = [
  { id: "ceo", col: "top", row: 0, label: "CEO (sen)", kind: "kişi", role: "Karar verir: spec'i imzalar, main'e birleştirmeyi, deploy'u ve yayını tek tek onaylar.", tech: "Anahtar ~/.company/keys altında, repoda yalnızca genel anahtar. İmza = onay penceresindeki tıklama." },
  { id: "cos", col: "top", row: 1, label: "Chief of Staff", kind: "kişi", role: "Bu oturum. Birimleri görevlendirir, sonuçları toplar, kanıtı gösterir; CEO ile konuşan tek arayüz.", tech: "CLAUDE.md anayasasını okur. Ana makinede guard, loop, stop ve notify kancaları onun oturumunda çalışır." },
  { id: "approval", col: "h", row: 0, label: "approval.js", kind: "zorlama", role: "Spec'in SHA-256 özetini ed25519 ile imzalar ve doğrular; imza kaydını approvals/ altına yazar.", tech: "keygen | sign | verify. Bağımlılıksız Node. Özel anahtar hiçbir konteynere bağlanmaz.", file: "harness/approval.js" },
  { id: "gate", col: "h", row: 1, label: "gate.js", kind: "zorlama", role: "Konteynerde kod yazımını imza yoksa engeller; approvals/, .claude/, .git/ ve çalışma alanı dışı hep kapalı.", tech: "PreToolUse (Write, Edit, MultiEdit, NotebookEdit). Engel: çıkış kodu 2. Hata veya bozuk girdide kapalı kalır (fail closed). 20 test.", file: "harness/gate.js" },
  { id: "guard", col: "h", row: 2, label: "guard.js", kind: "zorlama", role: "Ana makinede zarf eylemlerini CEO kararına çevirir: main push/merge, deploy ve yayın araçları, silme, imza, zorlama dosyalarına yazma. CI yeşil değilse merge'ü reddeder.", tech: "PreToolUse (Bash ve Write/Edit). Çıktı: JSON 'ask' (onay penceresi) veya çıkış kodu 2. Fail closed. 85 test.", file: "harness/guard.js" },
  { id: "stop", col: "h", row: 3, label: "stop.js", kind: "zorlama", role: "Tur kod değiştirdi ve sonrasında derleme/test/check çalışmadıysa turu bir kez geri çevirir: 'bitti = taze kanıt'.", tech: "Stop kancası; transkripti okur. decision: block, stop_hook_active ile döngüsüz. Fail open. 11 test.", file: "harness/stop.js" },
  { id: "loop", col: "h", row: 4, label: "loop.js", kind: "zorlama", role: "Aynı çağrıyı 5 kez üst üste veya kısa bir döngüyü 3 kez tekrarlayan ajanı durdurur; 'farklı yol dene ya da dur ve bildir' der.", tech: "PreToolUse (tüm araçlar). Çağrı özeti (araç + girdi, anahtar sırasından bağımsız) oturum başına geçici dosyada. Plan/görev araçları muaf. Fail open. 16 test.", file: "harness/loop.js" },
  { id: "notify", col: "h", row: 5, label: "notify.js", kind: "zorlama", role: "CEO'nun dikkati gerekince (onay bekleniyor, koşu bitti veya durdu) masaüstü bildirimi gönderir.", tech: "Notification kancası ve company-run.sh. Metin kabuğa değil argüman olarak gider. Fail open.", file: "harness/notify.js" },
  { id: "runner", col: "h", row: 6, label: "Runner + konteyner", kind: "zorlama", role: "İmzaya bakıp bağlama kipini seçer (build: çalışma alanı yazılabilir; plan: salt-okunur) ve sertleştirilmiş konteynerde claude -p çalıştırır.", tech: "--read-only, --cap-drop ALL, no-new-privileges, uid 1000, 4 GB bellek, 512 pid. Ağ: yalnızca izinli listeli vekil. approvals/ her kipte salt-okunur.", file: "harness/bin/company-run.sh" },
  { id: "check", col: "h", row: 7, label: "check + CI", kind: "zorlama", role: "Tek doğrulama komutu: kılavuz biçimi, imza-kapı, guard, stop, loop, araç testleri ve sır taraması. Aynısı her PR'da GitHub Actions'ta koşar.", tech: "harness/bin/check (212 kontrol), .github/workflows/check.yml (SHA'ya sabit action, salt-okuma yetki, sır yok).", file: "harness/bin/check" },
  { id: "spec", col: "a", row: 0, label: "Spec + imza", kind: "kayıt", role: "Dondurulan sözleşme: 14 bölüm, EARS gereksinimler, kabul kriterleri, tehdit modeli, görev listesi. İmza içeriğine bağlıdır; değişirse düşer.", tech: "specs/active/NNNN-ad.md + approvals/*.sig.json (sürüm, yol, sha256, imza).", file: "specs/active/" },
  { id: "plan", col: "a", row: 1, label: "Plan + STATE", kind: "kayıt", role: "İmzalı spec'ten çıkan sıralı adımlar, kriter ↔ test haritası ve ilerleme defteri; oturum çökse iş buradan sürer.", tech: "plans/NNNN-plan.md, STATE.md, issue ve PR'lar (templates/).", file: "plans/" },
  { id: "evidence", col: "a", row: 2, label: "Kanıt tablosu", kind: "kayıt", role: "Her kabul kriteri için test + komut + sonuç; bozarak doğrulandı mı. 'Bitti' ancak bununla söylenir.", tech: "QA raporu; derleme/test çıktısı taze olmalı (stop.js bunu arar).", file: "QA raporu" },
  { id: "scorecard", col: "a", row: 3, label: "Scorecard", kind: "kayıt", role: "İş sonu ölçümü: düzeltme turu, bulgular, regresyon, kaçan hata, tahmin/gerçek sapma.", tech: "templates/scorecard.md (makine okur) → harness/bin/scorecard.js özet çıkarır.", file: "docs/scorecards/" },
  { id: "evals", col: "a", row: 4, label: "Değerlendirme setleri", kind: "kayıt", role: "Her birim kılavuzu için 3 vaka: mekanik ölçütler ve geçer/kalır örnekleri. Kılavuz bozulursa yakalanır.", tech: "evals/*.md (16 set); harness/bin/eval.js self|grade; lint CI'da kendini sınatır.", file: "evals/" },
  { id: "stack", col: "a", row: 5, label: "Yığın kaydı + ADR", kind: "kayıt", role: "Standart teknoloji listesi (benimse / dene / değerlendir / çıkar) ve geri dönüşü pahalı kararların gerekçesi.", tech: "docs/architecture/STACK.md, templates/ADR.md.", file: "docs/architecture/" },
  { id: "deploy", col: "a", row: 6, label: "Deploy paketi", kind: "kayıt", role: "Adımlar, sağlık kontrolü, geri alma, migration sırası; CEO onayı kutusu boş gelir. Canlıya çıkışı yalnızca CEO yapar.", tech: "docs/ops/deploy-<sürüm>.md (devops-sre kılavuzu).", file: "docs/ops/" },
  { id: "compliance", col: "a", row: 7, label: "Uyum ve izlenebilirlik", kind: "kayıt", role: "Gereksinim → test → kanıt zinciri ve uyum listesi (kişisel veri, lisans, mağaza kuralları); avukat gerektirenleri işaretler.", tech: "docs/kalite/, docs/uyum/, templates/uyum-kontrol.md.", file: "docs/uyum/" },
];

// [from, to, kind, label]   kind: "akis" (work or data flows) | "denetim" (checks, blocks, approvals)
const EDGES = [
  ["ceo", "cos", "akis", "konuşur, karar verir"],
  ["cos", "product-manager", "akis", "fikri araştırtır"], ["product-manager", "business-analyst", "akis", "karar notu spec girdisi olur"],
  ["cos", "business-analyst", "akis", "işi spec'e çevirtir"], ["business-analyst", "spec", "akis", "spec'i yazar"],
  ["scout", "business-analyst", "akis", "hazır çözüm raporu verir"], ["scout", "architecture-board", "akis", "teknoloji adayını gerekçelendirir"],
  ["spec-critic", "spec", "denetim", "okur, cevapsız soruları çıkarır"], ["spec-critic", "business-analyst", "denetim", "boşlukları geri bildirir"],
  ["architecture-board", "spec", "denetim", "mimari görüşü verir (kapı)"], ["talent-capacity", "spec", "denetim", "kapasite tahminini yoklar (kapı)"],
  ["appsec", "spec", "denetim", "tehdit modelini denetler (durak A)"], ["architecture-board", "stack", "akis", "yığın kaydını günceller"],
  ["ceo", "approval", "denetim", "imza penceresinde onaylar"], ["approval", "spec", "denetim", "özet üzerinden imza kaydı yazar"],
  ["gate", "spec", "denetim", "imzayı her yazımda doğrular"], ["runner", "approval", "denetim", "imzayı doğrulayıp kipi seçer"],
  ["cos", "runner", "akis", "birimi konteynerde çalıştırır"], ["gate", "dotnet-engineer", "denetim", "imzasız kod yazımını engeller"], ["gate", "react-engineer", "denetim", "imzasız kod yazımını engeller"],
  ["spec", "dotnet-engineer", "akis", "uygulanacak sözleşme"], ["spec", "react-engineer", "akis", "uygulanacak sözleşme"],
  ["cos", "delivery-manager", "akis", "planı ve PR'ları yönettirir"], ["delivery-manager", "plan", "akis", "plan, issue, durum raporu yazar"], ["plan", "dotnet-engineer", "akis", "adımları verir"],
  ["dotnet-engineer", "qa-engineer", "akis", "kod ve testleri teslim eder"], ["react-engineer", "qa-engineer", "akis", "kod ve testleri teslim eder"],
  ["qa-engineer", "evidence", "akis", "kriter ↔ kanıt tablosunu yazar"], ["evidence", "internal-auditor", "denetim", "denetimin ana girdisi"],
  ["appsec", "internal-auditor", "denetim", "durak B raporu (kod, bağımlılık)"], ["internal-auditor", "scorecard", "akis", "scorecard'ı doldurur"],
  ["internal-auditor", "cos", "denetim", "TEMİZ veya düzeltme gerekli bildirir"], ["scorecard", "talent-capacity", "akis", "darboğaz analizinin verisi"],
  ["talent-capacity", "ceo", "akis", "kapasite ve kılavuz önerileri"], ["quality-office", "evidence", "denetim", "izlenebilirlik için okur"],
  ["quality-office", "compliance", "akis", "uyum ve izlenebilirlik kaydı yazar"], ["quality-office", "ceo", "denetim", "avukat gerektirenleri işaretler"],
  ["devops-sre", "deploy", "akis", "deploy paketini hazırlar"], ["deploy", "ceo", "denetim", "tek tek onay bekler"], ["qa-engineer", "devops-sre", "denetim", "önkoşul: kanıt tam"],
  ["marketing", "ceo", "denetim", "yayın paketi onay bekler"], ["tech-comms", "cos", "akis", "doküman kaynağı verir, dönüşüm ana oturumda"],
  ["guard", "ceo", "denetim", "onay penceresi açar (main, deploy, yayın)"], ["guard", "cos", "denetim", "tehlikeli komutu reddeder veya sorar"],
  ["stop", "cos", "denetim", "kanıtsız bitirmeyi geri çevirir"], ["loop", "cos", "denetim", "tekrar eden döngüyü keser"], ["notify", "ceo", "akis", "masaüstü bildirimi"],
  ["check", "evals", "denetim", "kılavuz setlerini kendini sınatır"], ["check", "guard", "denetim", "85 testle sınar"], ["check", "gate", "denetim", "20 testle sınar"],
  ["check", "delivery-manager", "denetim", "CI yeşil olmadan merge reddedilir"], ["evals", "internal-auditor", "denetim", "kılavuz uyumunu ölçmeye yarar"],
  ["runner", "notify", "akis", "koşu bitince bildirim tetikler"], ["devops-sre", "check", "akis", "CI hattını hazırlar"],
];

function build() {
  const dir = path.join(ROOT, ".claude", "agents"); const nodes = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
    const a = fm(path.join(dir, f)); const meta = UNITS[a.name];
    if (!meta) throw new Error(`agent '${a.name}' has no entry in site-data.js UNITS (add its label and role)`);
    const tools = (a.tools || "").split(",").map((s) => s.trim());
    const write = tools.some((t) => ["Write", "Edit", "MultiEdit"].includes(t));
    nodes.push({ id: a.name, col: meta[0], row: meta[1], label: meta[2], kind: "birim", role: meta[3],
      tech: `Model: ${a.model} · araçlar: ${tools.join(", ")} · ${write ? "yazabilir" : "yazma aracı yok"}${tools.includes("Bash") ? "" : " · Bash yok"} · kılavuz: ${(a.skills || [])[0]} (evals/${(a.skills || [])[0]}.md)`,
      file: `.claude/agents/${f}` });
  }
  for (const u of Object.keys(UNITS)) if (!nodes.find((n) => n.id === u)) throw new Error(`UNITS lists '${u}' but no agent file exists`);
  nodes.push(...OTHER);
  const ids = new Set(nodes.map((n) => n.id));
  for (const [a, b] of EDGES) if (!ids.has(a) || !ids.has(b)) throw new Error(`edge ${a} -> ${b} references an unknown node`);
  return { nodes, edges: EDGES.map(([from, to, kind, label]) => ({ from, to, kind, label })) };
}

const block = () => START + JSON.stringify(build()).replace(/</g, "\\u003c") + END;
function current(html) { const i = html.indexOf(START), j = html.indexOf(END); return i < 0 || j < 0 ? null : html.slice(i, j + END.length); }

module.exports = { build };
if (require.main === module) {
  const html = fs.readFileSync(PAGE, "utf8"); const cur = current(html);
  if (cur === null) { console.error("map-data block not found in site/index.html"); process.exit(2); }
  if (process.argv.includes("--write")) { fs.writeFileSync(PAGE, html.replace(cur, () => block())); console.log("site map data written"); process.exit(0); }
  if (process.argv.includes("--check")) { if (cur === block()) { console.log("site map data is current"); process.exit(0); } console.error("site map data is STALE: run node harness/bin/site-data.js --write"); process.exit(1); }
  console.error("usage: site-data.js --write | --check"); process.exit(2);
}
