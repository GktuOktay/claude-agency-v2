# Şirket (CEO + Claude)

Tek kişilik yazılım şirketinin işletim sistemi: uzun ve itirazlı bir plan konuşması, CEO imzası, sonra zarf içinde otonom yürütme. İşi yapan her birimin yazılı bir çalışma kılavuzu (playbook) vardır; kapılar araçla zorlanır, talimatla değil.

Anayasa: [CLAUDE.md](CLAUDE.md) · Gereksinimler: [docs/GEREKSINIM-ANALIZI.md](docs/GEREKSINIM-ANALIZI.md) · Kararlar: [docs/KARARLAR.md](docs/KARARLAR.md)

**Tanıtım:** [Şirketin tanıtım sayfası](https://claude.ai/artifact/U7NQCbyuULXMuogp5jbj78) (kaynak: [site/index.html](site/index.html)) · **Canlı demo:** [Yazılım Evi Kulesi](https://claude.ai/artifact/DsxQrs1c8ihHACL7RH8XMc): şirketin ajanlarının çalıştığı 3D kule, tarayıcıda çalışır ([kaynak](showcase/agency-tower)).

## Akış

```
Tartışma ve araştırma → Spec paketi + eleştiri + ön görüş → CEO İMZASI → Plan, issue, PR
→ Otonom yürütme (Docker) → Bağımsız denetim → CEO ONAYI (deploy/yayın, tek tek) → Canlı ve işletim
```

İki insan kapısı: **imza** ve **deploy/yayın onayı**. Arası otonom; belirsizlikte "park et", kota veya 3 başarısızlıkta "dur ve bildir".

## Şeritler

Hattın ağırlığı işin riskine göre seçilir (`.claude/rules/routing.md`). En hafif uygun şerit kullanılır; gerekenden ağır hat da kusur sayılır.

| Şerit | Ne zaman | Hat |
|---|---|---|
| 0 | Sohbet, küçük düzeltme, yeniden adlandırma | Ana oturum yapar, taze test/build çıktısı gösterir. Spec yok. |
| 1 | Küçük iş veya hata; yeni veri modeli, yetki, dış çağrı, bağımlılık yok | Hızlı spec → CEO onayı → bir mühendis → `qa-engineer` incelemesi |
| 2 | Orta özellik, görünür davranış | Spec → `spec-critic` (+ gerekirse `appsec`, `architecture-board`) → CEO imzası → mühendis → `qa-engineer` → `internal-auditor` |
| 3 | Yeni sistem, göç, veri kaybı ya da güvenlik riski, herkese açık veya ücretli iş | Mimar → spec → paralel kapılar → CEO imzası → teslimat → QA → AppSec → denetim → kalite ofisi |

## Neyin zorlandığı (dürüst tablo)

| Kural | Seviye | Nasıl |
|---|---|---|
| İmzasız kod yok | **Enforced** | Konteyner bağlama modu imzaya göre seçilir (imzasız: çalışma alanı salt-okunur, yalnız `specs/` ve `docs/` yazılabilir) + `PreToolUse` kapısı |
| Ajan imza atamaz | **Enforced** (konteynerde), kısmen (ana makinede) | ed25519 imza; özel anahtar ne repoda ne konteynerde. **Parola yok:** imza, `guard.js`'in gösterdiği onay penceresine CEO'nun tıklamasıdır, başsız çalışma imzalayamaz. Ana makinede anahtarı okumak/imzalamak `ask`, `Read(~/.company/**)` yasak; ama rastgele kodla okumak tamamen engellenemez: ana makine oturumu CEO gözetiminde güvenilir kabul edilir |
| İmzalı spec değişirse imza düşer | **Enforced** | İmza spec içeriğinin özetine bağlı |
| Ağ çıkışı | **Enforced** | `--internal` Docker ağı + izinli listeli vekil: `api.anthropic.com`, varsayılan olarak `api.nuget.org`, `registry.npmjs.org`, `pypi.org` ve `files.pythonhosted.org` (`COMPANY_REGISTRIES=none` kapatır) |
| Ajan kendi kılavuzunu değiştiremez | **Enforced** | `.claude/agents`, `.claude/skills` konteynerde salt-okunur bağlanır |
| Yapan doğrulamaz | **Enforced** | `internal-auditor` ve `spec-critic` birimlerinin yazma aracı yok (`lint.js` denetler) |
| Kılavuz biçimi standart | **Validated** | `harness/bin/lint.js` |
| "Bitti = taze kanıt" | **Enforced** (kısmen) | `harness/stop.js` `Stop` kancası: tur kod dosyası değiştirdiyse ve sonrasında derleme/test/check çalışmadıysa turu bir kez geri çevirir; ya doğrula ya "doğrulanmadı" de. Sınır: `sed -i` gibi Bash ile yapılan düzenlemeleri görmez; kanıtın *geçtiğini* değil çalıştığını arar. Denetçi kılavuzu ikinci katman |
| Kırmızı CI birleştirilmez | **Enforced** (ana makinede) | `guard.js`: `gh pr merge` için PR'ın kontrolleri başarılı değilse (kırmızı, sürüyor ya da CI tanımlı olduğu halde henüz hiç sonuç yok) reddeder. Ek olarak depo herkese açık olduğundan GitHub dal koruması açık: `main` için PR ve `check` zorunlu, yöneticiler dahil, force push yok |
| Zarf (main'e push/merge, release, silme, geri alınamaz git) | **Enforced** (kısmen) | Ana makinede `harness/guard.js` kancası bunları CEO onayına çevirir; başsız çalışmada reddedilir. Gerçek Claude'da `allow` kuralı varken bile engelledi (T-O, `docs/GEREKSINIM-ANALIZI.md` §12.2). Deploy ve yayın araçları (ssh/scp/rsync, docker push, npm/nuget yayın, bulut CLI'ları, kubectl/terraform, fastlane/altool, dış POST) da tek tek onaya bağlı; liste isme dayalı |
| Tarayıcı yalıtımı | **Enforced** | Sandbox'sız Chromium yalnızca `visual-check.sh`'in başlattığı ayrı konteynerde (`--network none`, token yok, sayfa salt-okunur); `lint.js` `seccomp=unconfined`, `--privileged`, `--cap-add`, `docker.sock` ve başka yerde `--no-sandbox` kullanımını yasaklar |
| Grafik ve görsel kullanımı | **Validated** (kısmen) | `lint.js`: spec şablonunda 4 diyagram yuvası, `site/*.html` için viewport, koyu tema, etiketli svg, izinli kaynaklar; `graphify-out/` git dışı. Gözle kontrol ve "kaynaksız sayı yok" talimat seviyesinde |

## Hızlı başlangıç

```bash
./harness/bin/check              # tek doğrulama komutu: biçim, testler, gizli bilgi taraması
./harness/bin/ceo-keygen.sh      # BİR KEZ: CEO anahtarı (parola yok; --passphrase ile korumalı varyant)
docker build -t company-agent:dev harness/docker   # ajan imajı: .NET 10 SDK + Node + Claude Code + graphify (sürümler sabit)
sh harness/test/e2e.sh           # ana makine→konteyner yolu, sahte claude ile (18 test; Docker ve vekil gerekir)
sh harness/test/image.sh         # imaj doğrulaması (14 test; 6-8 için önce proxy-up.sh)
./harness/bin/visual-check.sh <sayfa-dizini> <çıktı-dizini>   # ayrı, ağsız konteynerde ekran görüntüsü + axe
./harness/bin/proxy-up.sh        # internal ağ + izinli listeli çıkış vekili
./harness/bin/approve.sh <proje> # CEO bir projenin aktif spec'ini imzalar
./harness/bin/company-run.sh <proje> "<görev>" [birim]
./harness/bin/proxy-down.sh      # işin bitince her şeyi kapat
```

Ajan belirteci (`~/.company/agent.env`, mod 600) için `harness/README.md`'ye bakın. Belirteç repoya girmez, iş bitince silinir.

## Birimler (şu an)

| Birim | Model | Yazma | Kılavuz |
|---|---|---|---|
| `business-analyst` | opus | `specs/`, `docs/` | `business-analysis` |
| `spec-critic` | opus | yok | `spec-criticism` |
| `dotnet-engineer` | sonnet | imzalıysa çalışma alanı | `dotnet-engineering` |
| `react-engineer` | sonnet | imzalıysa çalışma alanı | `react-engineering` |
| `appsec` | opus | yok | `application-security` |
| `devops-sre` | sonnet | `ops/`, `docs/ops/`, Dockerfile, CI | `devops-sre` |
| `scout` | sonnet | yalnız `docs/scout/` (Bash yok, web araçları var) | `scouting` |
| `qa-engineer` | sonnet | yalnız test dosyaları | `qa-verification` |
| `internal-auditor` | opus | yok | `internal-audit` |
| `product-manager` | sonnet | yalnız `docs/product/` | `product-management` |
| `delivery-manager` | sonnet | `plans/`, `STATE.md`, `docs/` | `delivery-management` |
| `software-architect` | opus | yalnız `docs/architecture/tasarim/` (Bash yok) | `software-architecture` |
| `polyglot-engineer` | sonnet | `docs/port/`, `docs/yigin/`; imzalıysa çalışma alanı | `polyglot-engineering` |
| `architecture-board` | opus | yalnız `docs/architecture/` (Bash yok) | `architecture-review` |
| `talent-capacity` | sonnet | yalnız `docs/talent/` (Bash yok) | `talent-capacity` |
| `quality-office` | sonnet | `docs/kalite/`, `docs/uyum/` (Bash salt-okuma) | `quality-compliance` |
| `marketing` | sonnet | yalnız `docs/marka/` (Bash ve web yok; yayın CEO) | `marketing-brand` |
| `tech-comms` | sonnet | yalnız `docs/dis/` (Bash ve web yok) | `technical-communication` |

Ortak standartlar (tüm ilgili birimlere yüklenir): `graph-usage` (graphify), `visual-standards` (görsel dil), `writing-standards` (Türkçe yazım, `humanize-check.js`). Her birim kılavuzunun `evals/` altında kendini sınayan değerlendirme seti vardır.

## Vitrin

- **Yazılım Evi Kulesi** (`showcase/agency-tower`): şirketin 18 agent'ının robot olarak çalıştığı 3D ofis kulesi. Şirketin ilk gerçek projesi; spec 0001 ve 0002 bu hattan geçti. Çalıştırma: `showcase/agency-tower/README.md`.
- **Tanıtım sayfası** (`site/index.html`): şirketin sunumu. Rakamlar `harness/bin/site-data.js` ile depodan üretilir; `check` eskiyse kırmızı verir.

## Henüz yapılmadı

- Birim kılavuzlarının değerlendirme setleriyle canlı notlanması (`eval.js grade`).
- `company-run.sh` uçtan uca bu depodaki haliyle henüz çalıştırılmadı (belirteç silindi); önceki denemedeki sürümü çalıştı, bu sürümün sözdizimi ve bağımlı bileşenleri `check` ile doğrulandı.
- Canlı testler: `company-run.sh` uçtan uca (B5), onay penceresinin gerçek oturumda denemesi (B12), kota bekle-devam (B8).

## Lisans

MIT, bkz. [LICENSE](LICENSE). Üçüncü taraf araçlar (Playwright Apache-2.0, axe-core MPL-2.0 vb.) kendi lisanslarıyla gelir ve bu depoya kopyalanmaz; yalnızca konteyner imajında kurulur.

## Her projede ve her sohbette kullanım

- **Birimleri her yerde açmak:** `sh harness/bin/install-global.sh` agent, skill ve yönlendirme kuralını `~/.claude` altına sembolik bağlarla bağlar. Tek kaynak bu depo kalır, `git pull` her projeyi günceller. Geri almak: `--uninstall`.
- **Kısa konuşma (caveman) modu:** `.claude/rules/terse-mode.md` sohbette ve durum mesajlarında kısa konuşmayı varsayılan yapar; spec, güvenlik, hukuk ve müşteri metninde kapalıdır. Kullanıcının kendi `caveman` skill'leri ayrıdır ve `~/.claude/skills/` altında kalır (kaynak ve lisansı belirsiz olduğu için bu depoya kopyalanmadı).
- **Yönlendirme:** `.claude/rules/routing.md` hangi sözün hangi birimi devreye soktuğunu ve hattı (spec önce, imza sonra, kod en son) yazar; sohbet sırasında ana oturum bunu sormadan uygular.
- **Koruma katmanını bir projeye eklemek:** `sh harness/bin/install-project.sh <proje-klasörü>` guard, loop, stop ve notify kancalarını o projenin `.claude/settings.json` dosyasına ekler (mevcut ayar varsa dokunmaz).

