# Şirket (CEO + Claude)

Tek kişilik yazılım şirketinin işletim sistemi: uzun ve itirazlı bir plan konuşması, CEO imzası, sonra zarf içinde otonom yürütme. İşi yapan her birimin yazılı bir çalışma kılavuzu (playbook) vardır; kapılar araçla zorlanır, talimatla değil.

Anayasa: [CLAUDE.md](CLAUDE.md) · Gereksinimler: [docs/GEREKSINIM-ANALIZI.md](docs/GEREKSINIM-ANALIZI.md) · Kararlar: [docs/KARARLAR.md](docs/KARARLAR.md)

## Akış

```
Tartışma ve araştırma → Spec paketi + eleştiri + ön görüş → CEO İMZASI → Plan, issue, PR
→ Otonom yürütme (Docker) → Bağımsız denetim → CEO ONAYI (deploy/yayın, tek tek) → Canlı ve işletim
```

İki insan kapısı: **imza** ve **deploy/yayın onayı**. Arası otonom; belirsizlikte "park et", kota veya 3 başarısızlıkta "dur ve bildir".

## Neyin zorlandığı (dürüst tablo)

| Kural | Seviye | Nasıl |
|---|---|---|
| İmzasız kod yok | **Enforced** | Konteyner bağlama modu imzaya göre seçilir (imzasız: çalışma alanı salt-okunur, yalnız `specs/` ve `docs/` yazılabilir) + `PreToolUse` kapısı |
| Ajan imza atamaz | **Enforced** (konteynerde), kısmen (ana makinede) | ed25519 imza; özel anahtar ne repoda ne konteynerde. **Parola yok:** imza, `guard.js`'in gösterdiği onay penceresine CEO'nun tıklamasıdır, başsız çalışma imzalayamaz. Ana makinede anahtarı okumak/imzalamak `ask`, `Read(~/.company/**)` yasak; ama rastgele kodla okumak tamamen engellenemez: ana makine oturumu CEO gözetiminde güvenilir kabul edilir |
| İmzalı spec değişirse imza düşer | **Enforced** | İmza spec içeriğinin özetine bağlı |
| Ağ çıkışı | **Enforced** | `--internal` Docker ağı + izinli listeli vekil: `api.anthropic.com`, varsayılan olarak `api.nuget.org` ve `registry.npmjs.org` (`COMPANY_REGISTRIES=none` kapatır) |
| Ajan kendi kılavuzunu değiştiremez | **Enforced** | `.claude/agents`, `.claude/skills` konteynerde salt-okunur bağlanır |
| Yapan doğrulamaz | **Enforced** | `internal-auditor` ve `spec-critic` birimlerinin yazma aracı yok (`lint.js` denetler) |
| Kılavuz biçimi standart | **Validated** | `harness/bin/lint.js` |
| "Bitti = taze kanıt" | **Enforced** (kısmen) | `harness/stop.js` `Stop` kancası: tur kod dosyası değiştirdiyse ve sonrasında derleme/test/check çalışmadıysa turu bir kez geri çevirir; ya doğrula ya "doğrulanmadı" de. Sınır: `sed -i` gibi Bash ile yapılan düzenlemeleri görmez; kanıtın *geçtiğini* değil çalıştığını arar. Denetçi kılavuzu ikinci katman |
| Zarf (main'e push/merge, release, silme, geri alınamaz git) | **Enforced** (kısmen) | Ana makinede `harness/guard.js` kancası bunları CEO onayına çevirir; başsız çalışmada reddedilir. Gerçek Claude'da `allow` kuralı varken bile engelledi (T-O, `docs/GEREKSINIM-ANALIZI.md` §12.2). Deploy ve mağaza gönderimi için henüz komut/araç yok |
| Grafik ve görsel kullanımı | **Validated** (kısmen) | `lint.js`: spec şablonunda 4 diyagram yuvası, `site/*.html` için viewport, koyu tema, etiketli svg, izinli kaynaklar; `graphify-out/` git dışı. Gözle kontrol ve "kaynaksız sayı yok" talimat seviyesinde |

## Hızlı başlangıç

```bash
./harness/bin/check              # tek doğrulama komutu: biçim, testler, gizli bilgi taraması
./harness/bin/ceo-keygen.sh      # BİR KEZ: CEO anahtarı (parola yok; --passphrase ile korumalı varyant)
docker build -t company-agent:dev harness/docker   # ajan imajı: .NET 10 SDK + Node + Claude Code + graphify (sürümler sabit)
sh harness/test/image.sh         # imaj doğrulaması (9 test; 6-8 için önce proxy-up.sh)
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
| `qa-engineer` | sonnet | yalnız test dosyaları | `qa-verification` |
| `internal-auditor` | opus | yok | `internal-audit` |
| `product-manager` | sonnet | yalnız `docs/product/` | `product-management` |
| `delivery-manager` | sonnet | `plans/`, `STATE.md`, `docs/` | `delivery-management` |

Ortak standartlar (tüm ilgili birimlere yüklenir): `graph-usage` (graphify), `visual-standards` (görsel dil).

## Henüz yapılmadı

- AppSec, DevOps/SRE, Architecture board, Scout, Marketing, Quality office, Tech comms, Talent & capacity birimleri.
- `company-run.sh` uçtan uca bu depodaki haliyle henüz çalıştırılmadı (belirteç silindi); önceki denemedeki sürümü çalıştı, bu sürümün sözdizimi ve bağımlı bileşenleri `check` ile doğrulandı.
- Ana makine oturumlarında kılavuz/kancaları ajanın kendi değiştirmesini engelleyen ayar (`.claude/settings.json` ve `harness/` şu an ajan tarafından düzenlenebilir; yalnızca CEO onaylı oturumlarda güvenli).
- Kendi kılavuzlarımız için değerlendirme setleri (SOP-04).
