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
  { id: "ceo", col: "top", row: 0, label: "Approver (insan)", kind: "kişi", role: "Karar verir: spec'i imzalar, main'e birleştirmeyi, deploy'u ve yayını tek tek onaylar.", tech: "Anahtar ~/.company/keys altında, repoda yalnızca genel anahtar. İmza = onay penceresindeki tıklama." },
  { id: "cos", col: "top", row: 1, label: "Orchestrator (ana oturum)", kind: "kişi", role: "Bu oturum. Birimleri görevlendirir, sonuçları toplar, kanıtı gösterir; CEO ile konuşan tek arayüz.", tech: "CLAUDE.md proje talimatlarını (system prompt) okur. Ana makinede guard, loop, stop ve notify kancaları onun oturumunda çalışır." },
  { id: "approval", col: "h", row: 0, label: "approval.js", kind: "zorlama", role: "Spec'in SHA-256 özetini ed25519 ile imzalar ve doğrular; imza kaydını approvals/ altına yazar.", tech: "keygen | sign | verify. Bağımlılıksız Node. Özel anahtar hiçbir konteynere bağlanmaz.", file: "harness/approval.js" },
  { id: "gate", col: "h", row: 1, label: "gate.js", kind: "zorlama", role: "Konteynerde kod yazımını imza yoksa engeller; approvals/, .claude/, .git/ ve çalışma alanı dışı hep kapalı.", tech: "PreToolUse (Write, Edit, MultiEdit, NotebookEdit). Engel: çıkış kodu 2. Hata veya bozuk girdide kapalı kalır (fail closed). 20 test.", file: "harness/gate.js" },
  { id: "guard", col: "h", row: 2, label: "guard.js", kind: "zorlama", role: "Ana makinede zarf eylemlerini CEO kararına çevirir: main push/merge, deploy ve yayın araçları, silme, imza, zorlama dosyalarına yazma. CI yeşil değilse merge'ü reddeder.", tech: "PreToolUse (Bash ve Write/Edit). Çıktı: JSON 'ask' (onay penceresi) veya çıkış kodu 2. Fail closed. 85 test.", file: "harness/guard.js" },
  { id: "stop", col: "h", row: 3, label: "stop.js", kind: "zorlama", role: "Tur kod değiştirdi ve sonrasında derleme/test/check çalışmadıysa turu bir kez geri çevirir: 'bitti = taze kanıt'.", tech: "Stop kancası; transkripti okur. decision: block, stop_hook_active ile döngüsüz. Fail open. 11 test.", file: "harness/stop.js" },
  { id: "loop", col: "h", row: 4, label: "loop.js", kind: "zorlama", role: "Aynı çağrıyı 5 kez üst üste veya kısa bir döngüyü 3 kez tekrarlayan ajanı durdurur; 'farklı yol dene ya da dur ve bildir' der.", tech: "PreToolUse (tüm araçlar). Çağrı özeti (araç + girdi, anahtar sırasından bağımsız) oturum başına geçici dosyada. Plan/görev araçları muaf. Fail open. 16 test.", file: "harness/loop.js" },
  { id: "notify", col: "h", row: 5, label: "notify.js", kind: "zorlama", role: "CEO'nun dikkati gerekince (onay bekleniyor, koşu bitti veya durdu) masaüstü bildirimi gönderir.", tech: "Notification kancası ve company-run.sh. Metin kabuğa değil argüman olarak gider. Fail open.", file: "harness/notify.js" },
  { id: "runner", col: "h", row: 6, label: "Runner + konteyner", kind: "zorlama", role: "İmzaya bakıp bağlama kipini seçer (build: çalışma alanı yazılabilir; plan: salt-okunur) ve sertleştirilmiş konteynerde claude -p çalıştırır.", tech: "--read-only, --cap-drop ALL, no-new-privileges, uid 1000, 4 GB bellek, 512 pid. Ağ: yalnızca izinli listeli vekil. approvals/ her kipte salt-okunur.", file: "harness/bin/company-run.sh" },
  { id: "check", col: "h", row: 7, label: "check + CI", kind: "zorlama", role: "Tek doğrulama komutu: kılavuz biçimi, imza-kapı, guard, stop, loop, araç testleri ve sır taraması. Aynısı her PR'da GitHub Actions'ta koşar.", tech: "harness/bin/check (214 kontrol), .github/workflows/check.yml (SHA'ya sabit action, salt-okuma yetki, sır yok).", file: "harness/bin/check" },
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
  ["check", "evals", "denetim", "kılavuz setlerini kendini sınatır"], ["check", "guard", "denetim", "87 testle sınar"], ["check", "gate", "denetim", "20 testle sınar"],
  ["check", "delivery-manager", "denetim", "CI yeşil olmadan merge reddedilir"], ["evals", "internal-auditor", "denetim", "kılavuz uyumunu ölçmeye yarar"],
  ["runner", "notify", "akis", "koşu bitince bildirim tetikler"], ["devops-sre", "check", "akis", "CI hattını hazırlar"],
];


const WRITE = {
  "product-manager": "docs/product/", "business-analyst": "specs/, docs/", "spec-critic": "yok", "scout": "docs/scout/", "delivery-manager": "plans/, STATE.md, docs/",
  "dotnet-engineer": "imzalıysa çalışma alanı", "react-engineer": "imzalıysa çalışma alanı", "qa-engineer": "yalnız test dosyaları", "devops-sre": "ops/, docs/ops/, Dockerfile, CI",
  "marketing": "docs/marka/", "tech-comms": "docs/dis/", "internal-auditor": "yok", "appsec": "yok", "architecture-board": "docs/architecture/", "talent-capacity": "docs/talent/",
  "quality-office": "docs/kalite/, docs/uyum/",
};
const GROUP = { u1: "Ürün hattı", u2: "Üretim", u3: "Kapılar ve yönetişim" };

// script -> what it is; tests are counted from the test files (a `t "..."` line is one test)
const HOOK_META = {
  "gate.js": { role: "İmza yoksa kod yazımını, korumalı yolları ve çalışma alanı dışını engeller.", decision: "çıkış kodu 2 = engel", fail: "kapalı", tests: ["test/run.sh", /^t "/] },
  "guard.js": { role: "Zarf eylemlerini (main, deploy, yayın, silme, imza, zorlama dosyaları) CEO onayına çevirir; CI yeşil değilse merge'ü reddeder.", decision: "JSON ask (onay penceresi) veya çıkış kodu 2", fail: "kapalı", tests: ["test/guard.sh", /^t "/] },
  "stop.js": { role: "Kod değişti ve sonrasında derleme/test/check çalışmadıysa turu bir kez geri çevirir.", decision: "decision: block (bir kez)", fail: "açık", tests: ["test/stop.sh", /^t "/] },
  "loop.js": { role: "Aynı çağrıyı 5 kez veya kısa bir döngüyü 3 tur tekrarlayan ajanı durdurur.", decision: "çıkış kodu 2", fail: "açık", tests: ["test/loop.sh", /^t "/] },
  "notify.js": { role: "CEO'nun dikkati gerekince masaüstü bildirimi gönderir.", decision: "yalnızca bildirim", fail: "açık", tests: ["test/tools.sh", /^t "notify:/] },
};

// level: Enforced (a tool blocks) | Validated (a script/CI detects) | Documented (instruction only). evidence: files that must exist.
const GATES = [
  ["G01", "Spec eleştirisi", "Plan", "spec-critic", "birim", "Documented", "Cevapsız soru sıfırlanmadan imzaya gidilmez.", [".claude/skills/spec-criticism/SKILL.md", "evals/spec-criticism.md"]],
  ["G02", "Mimari görüş", "Plan", "architecture-board", "birim", "Documented", "Gerekçesiz yeni teknoloji ve bağımlılık; kriteri olmayan katman.", [".claude/skills/architecture-review/SKILL.md", "docs/architecture/STACK.md"]],
  ["G03", "Kapasite görüşü", "Plan", "talent-capacity", "birim", "Documented", "Tahminsiz veya gerçekçi olmayan token/süre/para tavanı.", [".claude/skills/talent-capacity/SKILL.md"]],
  ["G04", "Tehdit modeli (AppSec durak A)", "Plan", "appsec", "birim", "Documented", "Tehdit modeli olmayan veya kritik/yüksek açığı olan spec.", [".claude/skills/application-security/SKILL.md"]],
  ["G05", "CEO imzası", "İmza", "approval.js + company-run.sh", "araç", "Enforced", "İmzasız spec'ten kod üretimi (çalışma alanı salt-okunur kalır).", ["harness/approval.js", "harness/bin/company-run.sh", "harness/test/run.sh", "harness/test/e2e.sh"]],
  ["G06", "İmza spec özetine bağlı", "İmza", "approval.js", "araç", "Enforced", "İmzadan sonra değişen spec: imza düşer, kapı kapanır.", ["harness/approval.js", "harness/test/run.sh"]],
  ["G07", "İmzasız kod yazımı kapısı", "Yürütme", "gate.js + bağlama kipi", "kanca", "Enforced", "Plan kipinde src/ ve kod alanına her yazma.", ["harness/gate.js", "harness/test/run.sh"]],
  ["G08", "Korumalı yollar", "Yürütme", "gate.js", "kanca", "Enforced", "approvals/, .claude/, .git/ ve çalışma alanı dışına yazma; imza kaydı sahteciliği.", ["harness/gate.js", "harness/test/run.sh"]],
  ["G09", "Kılavuzlar salt-okunur", "Yürütme", "company-run.sh", "araç", "Enforced", "Ajanın kendi kılavuzunu veya proje talimatlarını (CLAUDE.md) değiştirmesi (SOP-03).", ["harness/bin/company-run.sh", "harness/test/e2e.sh"]],
  ["G10", "Ağ çıkışı izinli liste", "Yürütme", "proxy.js + internal ağ", "araç", "Enforced", "İzinli üç ad dışındaki her dış bağlantı.", ["harness/docker/proxy.js", "harness/bin/proxy-up.sh", "harness/test/image.sh"]],
  ["G11", "Döngü engeli", "Yürütme", "loop.js", "kanca", "Enforced", "Aynı çağrıyı 5 kez veya kısa döngüyü 3 tur tekrarlama.", ["harness/loop.js", "harness/test/loop.sh"]],
  ["G12", "Kanıtsız bitti denmez", "Teslim", "stop.js", "kanca", "Enforced", "Kod değişip derleme/test çalışmadan biten tur (bir kez geri çevirir; Bash düzenlemelerini görmez).", ["harness/stop.js", "harness/test/stop.sh"]],
  ["G13", "Kriter ↔ kanıt tablosu", "Teslim", "qa-engineer", "birim", "Documented", "Kanıtsız kabul kriteri; kanıt olmayan test.", [".claude/skills/qa-verification/SKILL.md", "evals/qa-verification.md"]],
  ["G14", "Kod ve bağımlılık güvenliği (AppSec durak B)", "Teslim", "appsec", "birim", "Documented", "Kritik veya yüksek bulgu: GEÇMEZ.", [".claude/skills/application-security/SKILL.md", "evals/application-security.md"]],
  ["G15", "Bağımsız iç denetim", "Teslim", "internal-auditor", "birim", "Enforced", "Denetçi ve eleştirmenin yazma aracı yok (bağımsızlık araçla zorlanır, bulgu kalitesi talimata bağlı).", [".claude/skills/internal-audit/SKILL.md", "harness/bin/lint.js"]],
  ["G16", "Uyum kontrolü (KVKK, lisans, mağaza)", "Teslim", "quality-office", "birim", "Documented", "Hukuki görüş vermeden avukat gerektiren maddeyi işaretler; açık madde varsa 'uyum hazır' denmez.", [".claude/skills/quality-compliance/SKILL.md", "templates/uyum-kontrol.md"]],
  ["G17", "CI yeşil olmadan birleştirme yok", "Teslim", "guard.js + check.yml", "kanca", "Enforced", "Kırmızı, sürüyor ya da henüz hiç sonuç vermemiş CI ile gh pr merge (GitHub arayüzü hariç).", ["harness/guard.js", ".github/workflows/check.yml"]],
  ["G18", "main'e birleştirme: CEO", "Çıkış", "guard.js", "kanca", "Enforced", "main'e push/merge, force, tag, release, silme: her seferinde onay penceresi.", ["harness/guard.js", "harness/test/guard.sh"]],
  ["G19", "Deploy, yayın, uzak erişim: CEO", "Çıkış", "guard.js", "kanca", "Enforced", "ssh/scp/rsync, docker push, npm publish, bulut CLI'ları, kubectl/terraform, fastlane/altool, dış POST.", ["harness/guard.js", "harness/test/guard.sh"]],
  ["G20", "Zorlama dosyası koruması", "Çıkış", "guard.js", "kanca", "Enforced", "guard/gate/stop/approval/loop, anahtarlar, ayarlar, CLAUDE.md, CI dosyalarına onaysız yazma (satır içi yorumlayıcı yazması hariç).", ["harness/guard.js", "harness/test/guard.sh"]],
  ["G21", "Kanca atlatma bayrağı yasak", "Çıkış", "guard.js", "kanca", "Enforced", "Kancaları ve CI'ı atlatan git bayrağı (commit/push için).", ["harness/guard.js"]],
  ["G22", "Kılavuz biçimi ve değerlendirme setleri", "Süreklilik", "lint.js + eval.js", "CI", "Validated", "9 başlıklı standart bozulursa, bir kılavuzun seti yoksa veya ölçütler ayırt etmiyorsa.", ["harness/bin/lint.js", "harness/bin/eval.js", "evals/README.md"]],
  ["G23", "Tek doğrulama komutu her PR'da", "Süreklilik", "check + check.yml", "CI", "Validated", "Biçim, tüm testler, sır taraması; PR'da kırmızıysa merge kapısı kapanır.", ["harness/bin/check", ".github/workflows/check.yml"]],
  ["G24", "Sır taraması", "Süreklilik", "check", "CI", "Validated", "Repoda token veya özel anahtar deseni.", ["harness/bin/check"]],
  ["G25", "Konteyner sertleştirme kuralları", "Süreklilik", "lint.js", "CI", "Validated", "seccomp=unconfined, --privileged, --cap-add, docker.sock; --no-sandbox yalnız izole görsel konteynerde.", ["harness/bin/lint.js", "harness/bin/visual-check.sh"]],
  ["G26", "Web ve Bash birlikte olamaz", "Süreklilik", "lint.js", "CI", "Validated", "Web içeriğinin komuta dönüşebileceği birim tanımı; web araçları yalnız Product ve Scout'ta.", ["harness/bin/lint.js"]],
  ["G27", "Görsel ve erişilebilirlik", "Süreklilik", "lint.js + visual-check.sh", "CI", "Validated", "Viewport, koyu tema, etiketsiz svg, izinsiz dış kaynak; axe 375 px iki temada (elle çalışır).", ["harness/bin/lint.js", "harness/bin/visual-check.sh"]],
  ["G28", "Yazım denetimi (müşteri metni)", "Süreklilik", "humanize-check.js", "araç", "Validated", "Mutlak/kanıtlanamaz iddia (HATA) ve boş kalıplar (UYARI); araç elle çalıştırılır.", ["harness/bin/humanize-check.js", ".claude/skills/writing-standards/SKILL.md"]],
];

const INFRA = [
  ["Claude Code 2.1.316", "Ajan çalışma zamanı; konteyner imajında sabit sürüm (lint doğrular).", "harness/docker/Dockerfile"],
  ["Ajan imajı", "node:22-bookworm-slim + .NET SDK 10 + graphify 0.9.54 + Playwright 1.64.1 / axe 4.14.0; kullanıcı uid 1000.", "harness/docker/Dockerfile"],
  ["company-int ağı + vekil", "Internal Docker ağı; yalnızca api.anthropic.com, api.nuget.org, registry.npmjs.org için CONNECT vekili.", "harness/docker/proxy.js"],
  ["Görsel doğrulama konteyneri", "Ayrı, ağsız, token'sız; sayfa salt-okunur; sandbox'sız Chromium yalnız burada.", "harness/bin/visual-check.sh"],
  ["GitHub + Actions", "Depo, PR'lar, check.yml (SHA'ya sabit action, salt-okuma yetki, sır yok).", ".github/workflows/check.yml"],
  ["graphify", "Kod tabanı bilgi grafiği; yalnızca kod, anlamsal çıkarım bütçeyle.", ".claude/skills/graph-usage/SKILL.md"],
  ["CEO anahtarı", "ed25519; özel anahtar ~/.company/keys altında, repoda yalnızca genel anahtar.", "harness/keys/ceo.pub.pem"],
  ["Ajan token'ı", "~/.company/agent.env (mod 600), --env-file ile verilir; iş bitince silinir.", "harness/README.md"],
];

function countTests(file, re) { const t = fs.readFileSync(path.join(ROOT, "harness", file), "utf8"); return (t.match(new RegExp(re.source, "gm")) || []).length; }

function hooks() {
  const out = [];
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
  const add = (scope, cfg) => {
    for (const [event, groups] of Object.entries(cfg.hooks || {})) for (const g of groups) for (const h of g.hooks || []) {
      const script = (String(h.command).match(/([\w-]+\.js)/) || [])[1]; const m = HOOK_META[script];
      if (!m) throw new Error(`hook script '${script}' (${scope}, ${event}) has no entry in HOOK_META`);
      out.push({ scope, event, matcher: g.matcher || "tüm araçlar", script, role: m.role, decision: m.decision, fail: m.fail, tests: countTests(m.tests[0], m.tests[1]), file: "harness/" + script });
    }
  };
  add("ana makine", read(".claude/settings.json")); add("konteyner", read("harness/container-settings.json"));
  return out;
}

function skills(agents) {
  const { parseSet } = require("./eval.js"); const dir = path.join(ROOT, ".claude", "skills"); const out = [];
  for (const d of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, d, "SKILL.md"); if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8"); const meta = fm(f); const owners = agents.filter((a) => (a.skills || []).includes(d)).map((a) => a.id);
    const ev = path.join(ROOT, "evals", d + ".md");
    out.push({ id: d, desc: String(meta.description || "").replace(/^(Çalışma kılavuzu|Ortak standart):\s*/, ""), kind: (meta.description || "").startsWith("Ortak standart") ? "ortak standart" : "birim kılavuzu",
      sections: [...t.matchAll(/^## (.+)$/gm)].map((x) => x[1]), lines: t.split("\n").length, owners, cases: fs.existsSync(ev) ? parseSet(fs.readFileSync(ev, "utf8")).cases.length : 0, file: `.claude/skills/${d}/SKILL.md` });
  }
  return out;
}

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
  const unitInfo = nodes.map((n) => ({ id: n.id, group: GROUP[n.col], label: n.label, role: n.role, write: WRITE[n.id], file: n.file }));
  nodes.push(...OTHER);
  const ids = new Set(nodes.map((n) => n.id));
  for (const [a, b] of EDGES) if (!ids.has(a) || !ids.has(b)) throw new Error(`edge ${a} -> ${b} references an unknown node`);
  const edges = EDGES.map(([from, to, kind, label]) => ({ from, to, kind, label }));
  const agentFm = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) { const a = fm(path.join(dir, f)); agentFm[a.name] = a; }
  const agents = unitInfo.map((u) => { const a = agentFm[u.id]; return { id: u.id, label: u.label, group: u.group, role: u.role, model: a.model, effort: a.effort || "", maxTurns: a.maxTurns,
    tools: (a.tools || "").split(",").map((x) => x.trim()), skills: a.skills || [], write: u.write, file: u.file,
    feeds: edges.filter((e) => e.from === u.id).map((e) => ({ to: e.to, label: e.label, kind: e.kind })), fed: edges.filter((e) => e.to === u.id).map((e) => ({ from: e.from, label: e.label, kind: e.kind })) }; });
  const gates = GATES.map(([id, name, phase, runner, mechanism, level, blocks, evidence]) => {
    for (const ev of evidence) if (!fs.existsSync(path.join(ROOT, ev))) throw new Error(`gate ${id}: evidence file '${ev}' does not exist`);
    return { id, name, phase, runner, mechanism, level, blocks, evidence };
  });
  for (const i of INFRA) if (!fs.existsSync(path.join(ROOT, i[2]))) throw new Error(`infra '${i[0]}': file '${i[2]}' does not exist`);
  return { nodes, edges, agents, hooks: hooks(), gates, skills: skills(agents), infra: INFRA.map(([name, what, file]) => ({ name, what, file })) };
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
