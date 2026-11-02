# Şirket Kuruluş Kararları (2026-11-01)

Patron: Göktuğ. Çalışan: Claude. Hedef: plan fazı uzun ve sert, yürütme fazı tam otonom.

## Onaylanan kararlar
| # | Konu | Karar |
|---|---|---|
| 1 | Otonomi zarfı | Geri alınamaz/dışa dönük eylemler onaylı: prod deploy, main'e push, mail/mesaj, para harcama, kalıcı silme. Geri kalan her şey otonom. |
| 2 | Plan fazı | Tartışma, dondurulmuş spec, patron imzası. Yürütmede spec boşluğu çıkarsa dur ve sor; tahmin yok. |
| 3 | Çalışma yeri | Yerel Claude Code + git worktree + PR. Bildirimle haber verir. |
| 4 | Durma kuralı | 3 başarısız deneme, bütçe aşımı, spec boşluğu, güvenlik bulgusu, zarf dışı eylem. Dururken bildirim + durum dosyası. |
| 5 | Kalite kapısı | Stop hook (build/test/lint/secret) + işi yazmayan bağımsız Denetim subagent'ı. |
| 6 | Müdürlük formu | Hibrit: bağımsız iş yapanlar subagent, bilgi/prosedür/şablon skill. Ana oturum koordinatör (subagent içinden subagent çağrılamaz). |
| 7 | Hafıza | Repo içi dosyalar + git: docs/spec/, STATE.md, DECISIONS.md. |
| 8 | Bütçe | İş başına süre/token tavanı, spec sonunda belirlenir. Aşılırsa dur. |
| 9 | İtiraz protokolü | Claude itiraz eder, DECISIONS.md'ye yazar; patron ısrar ederse uygular. İstisna: güvenlik açığı, gizli anahtar, veri kaybı riski. Orada reddeder, alternatif sunar. |
| 10 | Spec kademesi | Büyük iş: tam paket. Küçük iş/hata: tek sayfa hızlı spec. Kademeyi Claude önerir, patron onaylar. |
| 11 | Model dağılımı | En güçlü model: plan, mimari, güvenlik, denetim. Sonnet: uygulama. Haiku: tarama/araştırma. |
| 12 | Kurulum sırası | Anayasa + zorlayıcı hook'lar + Denetim, sonra İş Analizi, Yazılım, Planlama, Dokümantasyon, Pazarlama, İK ve Teknik GMY. Her adımda gerçek küçük iş ile test. |

## Müdürlükler
1. Planlama (piyasa araştırması)
2. İş Analizi (uçtan uca, kelimesi kelimesine reçete)
3. Yazılım (kod, sunucu, siber güvenlik, test, felaket senaryosu, devops)
4. Pazarlama ve Sosyal Medya (metin, görsel dil, tasarım, medya)
5. Teknik Dokümantasyon ve Raporlama (iç: SPICE/ISO, kalite kapıları; dış: müşteri/sunum)
6. Denetim GMY
7. İK GMY
8. Teknik GMY

## Düzenlenmiş organizasyon önerisi (patron notları havuz; sıralama ve iyileştirme Claude'da)
Akış: Planlama -> İş Analizi -> Teknik GMY ve İK GMY ön onayı -> imza -> Yazılım || Pazarlama -> Dokümantasyon -> Denetim -> patron.
- Denetim GMY patrona doğrudan bağlı, hiçbir müdürlüğe bağlı değil (bağımsızlık).
- Teknik GMY ve İK GMY kod değil, spec aşamasında kapıdır.
- Yazılım Müdürlüğü içinde alt birimler: Geliştirme, Kalite/Test, Güvenlik, Altyapı/DevOps/DR.
- Onaylanan eklemeler: Hukuk/Uyum (KVKK, GDPR, lisans, App Store kuralları), Operasyon/Destek (yayın sonrası izleme, olay yönetimi, geri bildirim).
- Pazarlama kapsamı (patron düzeltmesi): sosyal medya + ürün tanıtımı + App Store yayın hazırlığı ve yükleme + iç görsel ve metinler + tasarım + medya. Sosyal medya "ertelenir" önerisi geri çekildi.
- App Store gönderimi ve herkese açık yayın "dışa dönük eylem" olduğu için varsayılan olarak patron onayı ister (karar 1). Hazırlık (metadata, ekran görüntüsü, metin, build) tamamen otonom.

## Patron kararları (devam)
- Deploy her zaman patron onayına tabi.
- Pazarlama ve sosyal medya tek müdürlük (Pazarlama ve Tanıtım).

## Uzmanlaşma ilkesi (öneri)
Üç katman: müdürlük = koordinasyon skill'i; uzman = subagent; prosedür = skill referansı.
Bir uzmanı ayırma ölçütü: (1) farklı araç/izin gerekiyor, (2) tek context'e sığmıyor, (3) bağımsız denetim gerekiyor, (4) farklı çalışma ritmi var. Unvan farkı tek başına yetmez.
Başlangıç: yaklaşık 12 subagent. Büyüme kanıta bağlı: İK GMY darboğaz raporlarına göre bölme önerir.

## Müdürlük listesi (güncel, 10 birim)
Planlama, İş Analizi, Yazılım (Geliştirme, Kalite/Test, Güvenlik, Altyapı/DevOps/DR), Pazarlama ve Tanıtım, Dokümantasyon (İç kalite, Dış sunum), Hukuk/Uyum, Operasyon/Destek, Denetim GMY, İK GMY, Teknik GMY.

## Revizyon 2: sektör jargonuyla organizasyon (taslak, onay bekliyor)
CEO: Göktuğ. Chief of Staff: ana Claude oturumu (koordinasyon, subagent çağırma).
- Internal Audit (CEO'ya doğrudan bağlı, yazma izni yok): spec uyumu, kaynak kullanımı, kapı ihlalleri.
- Architecture Review Board / Chief Architect: teknoloji uygunluğu, gereksiz teknoloji engeli, sürdürülebilirlik. Spec aşamasında kapı.
- Talent & Capacity (CHRO): kaynak yeterliliği, yeni rol/uzman önerisi. Spec aşamasında kapı.
- Product: Product Strategy & Discovery (piyasa/rakip araştırması, yol haritası, ürün geleceği, proaktif ürün tasarımı önerileri, müşteri geri bildirimi), Product Manager.
- Business Analysis & Solution Design: teknik iş analisti, teknoloji önerisi, spec ("reçete"), spec eleştirmeni.
- Engineering: Development, QA, Application Security, Platform/DevOps/SRE (deployment, release engineering, App Store yükleme, izleme, olay yönetimi, DR, destek mühendisliği). Deploy her zaman CEO onayında.
- Marketing & Brand: içerik/metin, sosyal medya, ASO ve mağaza listesi içeriği, yaratıcı stüdyo (marka, görsel, medya). Teknik değil. Yükleme işi Platform/DevOps'ta.
- Quality & Compliance Office: QMS (SPICE/ISO), hukuk/regülasyon (KVKK, GDPR, lisans, App Store kuralları).
- Technical Communications: müşteri/sunum dokümanları, raporlar.

## ANEW (engindemirog/ai-native-engineering-workspace) çıkarımları
Alınacak: 3 mekanik kanal (otomatik yüklenen bağlam, tek doğrulama komutu, aşılamaz kurallar); kural seviyeleri Documented/Validated/Enforced; scripts/check tek sözleşme (--fast iterasyon, tam koşu tek kanıt); üretici != doğrulayıcı (reviewer subagent'ında Edit/Write yok); shipped spec değiştirilemez (PreToolUse hook, stdin JSON, exit 2); proposal rule (her soru kendi önerisiyle gelir); recovery kataloğu R-01..R-13; lite/strict; AGENTS.md kısa işaret tahtası.
Uyarlanacak: ANEW her segmentte durur ve bulguları insana triyaj ettirir; biz insan kapısını spec+plan imzasında topluyoruz, bulguları Internal Audit triyaj eder, insan yalnız durma tetikleyicilerinde devreye girer.
Eklenecek: release/deploy (ANEW kapsam dışı bırakmış), Claude Code'a özel yapı, şirket katmanı.

## Yedek
Eski kurulum: ~/.claude-backup-2026-11-01 (silme işlemi henüz yapılmadı).

## Açık sorular
- SPICE hangisi (ISO/IEC 33000, Automotive SPICE, genel)?
- Teknoloji standart yığını (.NET, Swift, React?)
- Eski orchestrator/agent içeriğini ham madde olarak taşıma kapsamı
- Caveman modu kalıcı mı?
- Proje bazlı CLAUDE.md ile şirkete bağlanma

## Revizyon 3: kuruluş başladı (2026-11-01)
- Q11 onaylandı: konteynerde izinli `Bash`: okuma komutları, `git status/diff/log/show/add/commit/switch/branch`, `dotnet build/test/restore/format`, `npm test/run/ci`, `npx tsc`. Yasak: `rm`, `mv`, `sudo`, `curl`, `wget`, `ssh`, `scp`, `docker`, `git push/reset/rebase/clean`. Liste `harness/container-settings.json` içinde.
- Depo: `Desktop/ClaudeAgencyV2`, dal `kurulum/temel`. Kaynak gerçek: bu depo.
- Yapı: `CLAUDE.md` (anayasa, kısa) · `templates/` · `.claude/agents` (birim kimliği, araç, model) + `.claude/skills` (çalışma kılavuzu, standart 9 bölüm) · `harness/` (zorlama).
- Bulgu: yalnızca `Write`/`Edit` hook'u yetmez (Bash ile yazma yolu gerçek ajanda denendi). Çözüm: imzaya göre konteyner bağlama modu (ENV-07). Hook kapalı-başarısız yapıldı (ENV-08).
- İlk beş birim: business-analyst, spec-critic, dotnet-engineer, qa-engineer, internal-auditor.
- Açık: .NET SDK'lı imaj; paket kaydı çıkış izni (supply-chain); `Stop` hook'u; kalan birimler.

## Revizyon 4: Product, Delivery, graphify ve görsel standartlar (2026-11-02)
- Yeni birimler: `product-manager` (kaynaklı karar, web araçları yalnızca bu birimde ve ileride Scout'ta) ve `delivery-manager` (plan, issue, PR, CI, durum; kod yazmaz).
- Zarf ana makinede de zorlanıyor: `harness/guard.js` (Bash kancası) `main`'e push/merge, force push, release, depo yönetimi, geri alınamaz git komutlarını CEO onayına çevirir; `--no-verify` tümden yasak. Kanca kapalı-başarısız. Gerçek Claude ile doğrulandı: `allow` kuralı olsa bile force push ve main'e push engellendi.
- Entegrasyon dalı düzeni (DEL-05): görev PR'ları `integration/NNNN-<ad>` dalına otonom, oradan `main`'e CEO onayıyla.
- İki ortak standart (kural 8 ve 9): `graph-usage` (graphify: önce grafik, INFERRED kenar kanıt değil, yalnızca kod çıkarımı kota dostu, çıktı git dışı, sır dosyaları kapsam dışı) ve `visual-standards` (diyagram ne zaman zorunlu, anlamsal renk, iki tema, ikili görsel depoda yok, her sayı kaynaklı, sayfa gözle görülür).
- Açık: graphify ve görsel araçlar ajan imajında yok (ENV-10); `.claude/settings.json` ve `harness/` ana makinede ajan tarafından düzenlenebilir (CEO onaylı oturum varsayımı).

## Revizyon 5: CEO talimatları (2026-11-02)
- **A1:** Push, PR ve birleştirmeyi CEO'ya bırakmadan asistan yapar. Birleştirme `main`'e gittiği için `guard.js` onay penceresi gösterir; CEO'nun sohbetteki açık talimatı bunun gerekçesidir, kancayı aşmak yok.
- **A2: parola yok.** Spec imzası için parola girilmeyecek. Yeni model: özel anahtar parolasız (`~/.company/keys/ceo.key.pem`, mod 600, repo ve konteyner dışı); imza komutları ve anahtara dokunan her komut `guard.js` ile CEO kararına bağlı (uygulama onay penceresi = tek tık). Başsız çalışma imzalayamaz. Taviz: ana makinedeki oturum anahtarı rastgele kodla okuyabilir; bu risk "CEO gözetimindeki ana oturum güvenilir" varsayımıyla kabul edildi. Daha sıkı yol (sonradan): `ceo-keygen.sh --passphrase` veya Touch ID.
- **A10:** Pilot iş şimdi yok; CEO projeler üzerinde zamanla deneyecek.
- Not: gerçek CEO anahtarı üretimi otomatik mod sınıflandırıcısı tarafından engellendi; anahtar CEO'nun kendi komutuyla üretilecek.

## Revizyon 6: Ajan imajı (2026-11-02)
- İmaj yeniden kuruldu: `mcr.microsoft.com/dotnet/sdk:10.0` tabanı + Node 22 + Claude Code 2.1.316 + graphify 0.9.54 (hepsi sabit sürüm; `lint.js` denetler). Çözülen hata: tabanda uid 1000 `ubuntu`'ya aitti, silinip `node` kullanıcısı açıldı. Konteyner root değil, kök dosya sistemi salt-okunur.
- **A6:** NuGet ve npm çıkışı varsayılan açık (`COMPANY_REGISTRIES`, varsayılan `nuget,npm`; `none` kapatır). Deneyle doğrulandı: NuGet için yalnızca `api.nuget.org`, npm için `registry.npmjs.org` gerekti; diğer adresler kapalı kaldı. Risk: indirilen paket konteynerde çalışır; sınır: konteynerde belirteçten başka sır yok, başka çıkış yok, canlıya denetim ve CEO onayı olmadan hiçbir şey çıkmaz.
- GFY-07 / ENV-10 / ENV-11 kapandı: graphify ve .NET artık imajda.
- CEO anahtarı üretildi (A2); genel anahtar `harness/keys/ceo.pub.pem`.
