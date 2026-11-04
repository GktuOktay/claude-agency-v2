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

## Revizyon 7: Stop kancası (2026-11-02)
- Kural 2 ("bitti = taze kanıt") artık araçla zorlanıyor: `harness/stop.js`. Tur kod dosyası değiştirdiyse ve son değişiklikten sonra derleme/test/check komutu çalışmadıysa tur bir kez geri çevrilir. Çıkış yolu dürüstlük: son mesajda "doğrulanmadı" demek serbest.
- **Ruling:** kanca açık-başarısız (bozuk kanca oturumu kilitlememeli) ve `stop_hook_active` ile döngüsüz — yanlışsa maliyet: nadiren kanıtsız bitiş geçer; denetçi ikinci katman.
- Bilinen sınır: Bash ile düzenleme (`sed -i`, yönlendirme) görülmez; testin geçtiği değil çalıştığı aranır.

## Revizyon 8: React engineer (2026-11-02)
- Yeni birim `react-engineer` (sonnet) + `react-engineering` kılavuzu. Eski `~/.claude/rules/frontend.md` kapıları (Zod doğrulama, kullanıcı dostu form mesajı, zarif bozulma, 60 fps, paket boyutu, LLM çıktısı doğrulama) kılavuza taşındı; üstüne ekran başına durum tablosu (yükleniyor/boş/hata/başarı/yetkisiz), erişilebilirlik, iki tema ve 375 px, istemci paketinde sır yok eklendi.
- **Ruling:** Konteynerde tarayıcı yok, bu yüzden birim görsel doğrulama yapamaz; raporunda "görsel doğrulanmadı" listesi verir, gözle kontrolü ana oturum veya CEO yapar — yanlışsa maliyet: görsel hata geç yakalanır. Çözüm ileride: imaja Playwright eklemek (Architecture board kararı).

## Revizyon 9: AppSec (2026-11-02)
- Yeni birim `appsec` (opus, **yazma aracı yok**, `lint.js` bağımsızlık kuralına eklendi) + `application-security` kılavuzu. İki durak: (A) imzadan önce spec tehdit modeli (STRIDE, güven sınırları, kötüye kullanım), (B) teslimden önce kod, bağımlılık, sır, yapılandırma (OWASP ASVS/Top 10). Kanıtsız bulgu yok; sır değeri raporda gösterilmez; KRİTİK/YÜKSEK → GEÇMEZ ve dur-ve-bildir.
- Konteyner izin listesine `dotnet list package *` ve `npm audit *` eklendi (salt-okuma, kayıt adresleri vekilden).
- **Ruling:** AppSec, Internal audit ile aynı "Yönetişim ve kapılar" grubunda gösterilir (bağımsız denetçi). Üretim hattına girmez — yanlışsa maliyet: yalnızca şema yerleşimi.
- Bilinen sınır: gerçek bir kod tabanında henüz denenmedi; bulgu kalitesi ilk işte ölçülecek.

## Revizyon 10: DevOps/SRE (2026-11-02)
- Yeni birim `devops-sre` (sonnet) + `devops-sre` kılavuzu: Docker yerel ortam, CI, **deploy paketi** (adımlar, geri alma, sağlık kontrolü, migration sırası), Cloudflare/Plesk kontrol listesi, yedek ve felaket kurtarma (RPO/RTO, geri yükleme denenmiş olmalı), izleme ve olay kılavuzu.
- **Birim deploy etmez.** Canlı sunucuya/Cloudflare'a/Plesk'e dokunacak aracı yok (`ssh`, `scp`, `curl`, `docker push` kapalı); deploy paketi hazırlar, CEO tek tek onaylar (kural 4). Deploy ve mağaza gönderimi için gerçek araç ve zorlama hâlâ açık iş (B13).
- **Ruling:** Hedef sunucu bilgisi yokken uydurmak yasak, Tip 1 olarak sorulur — yanlışsa maliyet: yanlış hedefe hazırlanmış paket.
- Bilinen sınır: gerçek bir Plesk/Cloudflare kurulumunda denenmedi; ilk gerçek yayında kılavuz düzeltilecek.

## Revizyon 11: Scout (2026-11-02)
- Yeni birim `scout` (sonnet) + `scouting` kılavuzu: ihtiyacı ölçülebilir kriterlere çevirir, en az 3 adayı en az 2 kaynak türünden tarar, her adayı aynı tabloyla (uyum, lisans, bakım, güvenlik, maliyet, yığın uyumu, çıkış maliyeti) kaynaklı değerlendirir; MCP/plugin/skill adaylarında yetki ve veri akışını yazar. Çıktı: `docs/scout/` raporu, `KULLAN / DENE / KULLANMA / SIFIRDAN YAZ`.
- **Scout hiçbir şey kurmaz, indirmez, çalıştırmaz: Bash'i yok.** Yeni kural `lint.js`'te: web araçları olan birimde Bash olamaz (web içeriği komuta dönüşmesin). Web araçları yalnızca Product ve Scout'ta.
- **Ruling:** Yazma yeri `docs/scout/` ile sınırlı, bu talimat + imzasız kipte `docs/` dışı salt-okunur olması ile sağlanıyor; araç düzeyinde alt klasör kısıtı yok — yanlışsa maliyet: rapor başka bir `docs/` yoluna yazılabilir (düşük).
- Bilinen sınır: ilk gerçek taramada (ör. ücretsiz API arama) kalitesi ölçülecek.

## Revizyon 12: Görsel doğrulama (2026-11-02, CEO onayladı)
- Scout önerisi (Playwright + axe) denendi; Chromium sandbox'ı sertleştirilmiş ajan konteynerinde açılmıyor. AppSec seçenek C2'yi önerdi, uygulandı: sandbox'sız Chromium **yalnızca** ana makinenin başlattığı ayrı konteynerde (`harness/bin/visual-check.sh`: ağ yok, token yok, sayfa salt-okunur, zaman aşımı). `seccomp=unconfined` ajan konteynerinde reddedildi (YÜKSEK).
- Zorlama: `lint.js` `seccomp=unconfined`, `--privileged`, `--cap-add`, `--ipc=host`, `docker.sock` ve `visual-check.sh` dışında `--no-sandbox` kullanımını yasaklar.
- **Ruling:** React engineer tarayıcıyı kendisi çalıştırmaz; ana oturum `visual-check.sh` ile çalıştırır — yanlışsa maliyet: bir adım daha. **CEO kararı gereken:** yeni bağımlılık (Playwright/Chromium/axe, +~630 MB) ve sandbox'sız Chromium'un ayrı konteynerde kullanımı.
- **CEO kararı (2026-11-02):** yeni bağımlılık (Playwright/Chromium/axe) ve sandbox'sız Chromium'un yalnızca ayrı konteynerde kullanımı onaylandı.

## Revizyon 13: CI ve birleştirme kapısı (2026-11-02)
- CI: `.github/workflows/check.yml` her PR'da ve main'e push'ta `harness/bin/check` çalıştırır (salt-okuma yetki, sır yok, action commit SHA'sına sabit; `lint.js` zorlar). İlk koşu yeşil.
- GitHub dal koruması özel depoda ücretsiz planda yok (API 403). **Ruling:** para harcamak (Pro) ve depoyu herkese açmak CEO kararı olduğu için yapılmadı; yerine ana makine kapısı: `guard.js` kontrolleri yeşil olmayan PR'ın `gh pr merge`'ünü reddeder (deny; main'e giden birleştirme ayrıca CEO onayı ister). Yanlışsa maliyet: GitHub arayüzünden elle birleştirme hâlâ mümkün.

## Revizyon 14: Kadro tamamlandı, araçlar ve sertleştirme (2026-11-02)
- Beş yeni birim ve kılavuzu: `architecture-board` (opus; ortak karar: yeni teknoloji CEO'ya da gösterilir), `talent-capacity` (veriyle konuşur, n<3 ise eğilim çıkarmaz, rol eklemez), `quality-office` (izlenebilirlik + uyum, hukuki hüküm yok), `marketing` (iddia tablosu, yayın CEO), `tech-comms` (dış doküman kaynağı, biçim dönüşümü ana oturumda). Ortak standart `writing-standards`. Toplam 16 birim; hiçbirinde `Agent` aracı yok; web araçları yalnız Product ve Scout'ta; yeni birimlerin hiçbirinde web+Bash birlikte yok.
- SOP-04: `evals/` altında 16 değerlendirme seti. **Ruling:** ölçütler mekanik (bölüm, regex, sayı) ve set kendini sınar (geçer örneği geçmeli, kalır örneği kalmalı); içeriğin doğruluğunu yargılamaz, onu Internal audit yapar — yanlışsa maliyet: ölçüt biçime bakar, kötü ama biçimli çıktı geçebilir.
- B9, B10: `scorecard.js` ve `humanize-check.js` (kalıp listesi küçük; temiz çıkış kalite kanıtı değil).
- B7: `notify.js` (`Notification` kancası + koşu sonu). B13: `guard.js` deploy/yayın/uzak erişim araçlarını tek tek CEO onayına bağlar. B11: zorlama dosyalarına yazma (Write/Edit ve Bash yönlendirme/sed -i/cp/mv/rm) CEO onayı ister.
- **Ruling (Tip 2):** B11'de korunan liste yalnızca zorlama katmanı; `.claude/agents` ve `skills` korunmadı (ana oturum bunları sürekli düzenler, her seferinde onay istemek CEO'ya yük; konteynerde zaten salt-okunur). Yanlışsa maliyet: ana makinede bir kılavuz sessizce değişebilir; denetimi PR ve CI yapar.
- Bilinen açıklar: satır içi yorumlayıcı yazmaları (`python -c`, `node -e`) yakalanmaz; deploy araç listesi isme dayalı. Canlı testler yapılmadı: B5, B8, B12.
- **Not:** `.claude/settings.json` değişikliği (Write|Edit kancası ve Notification) bu oturumda yeniden başlatılana kadar geçerli olmayabilir.

## Revizyon 15: Uçtan uca yolun sahte ajanla doğrulanması (2026-11-02)
- `harness/test/e2e.sh`: `company-run.sh` bir `claude` yer tutucusuyla çalıştırılır (geçici anahtar, sahte token, geçici çalışma alanı; gerçek CEO anahtarına ve gerçek token'a dokunulmaz). 18 test yeşil: imzasızken kod alanı salt-okunur, imzalıyken yazılabilir, imzadan sonra spec değişirse plan kipine döner, `approvals/` her kipte salt-okunur, doğrudan internet kapalı, hata çıkış koduna yansır.
- **Ruling:** bu test CI'a konmadı (Docker ve ~2 GB imaj gerekir); `check` yalnızca söz dizimini denetler — yanlışsa maliyet: yol bozulursa CI yakalamaz, elle çalıştırmak gerekir.
- Kalan: model davranışı (B5 canlı kısmı), B8, B12. Bunlar gerçek token, gerçek kota ve etkileşimli oturum ister.

## Revizyon 16: Doğrulama notları (2026-11-02)
- `npm audit` Playwright ve axe paketlerinde (`/opt/visual`, konteynerde, vekil üzerinden): 0 açık. B15'in açık maddesi kapandı. x64 ölçümü ve axe MPL-2.0 hukuk teyidi açık.
- graphify kod grafiği `.env` ve `secrets.yml` içeriğini almadı (sahte sırlarla deneme). Anlamsal yol denenmedi.

## Revizyon 17: Döngü engelleyici ve tanıtım sayfası derinleştirme (2026-11-03)
- CEO: eksikler risk değil; döngü engellemeyi yapalım. `loop.js`: aynı araç + aynı girdi 5 kez üst üste ya da 2-3 çağrılık döngü 3 tur → çıkış kodu 2. **Ruling (Tip 2):** hata durumunda açık (bozuk bir döngü denetçisi oturumu kilitlememeli); plan/görev araçları muaf (aynı `advance` çağrısı meşru); eşik `COMPANY_LOOP_MAX` ile değişir. Yanlışsa maliyet: meşru bir tekrar (ör. kasıtlı yoklama) bir kez engellenir, ajan farklı çağrıyla devam eder. `loop.js` zorlama dosyası listesine girdi.
- Tanıtım sayfası: teknik bölümler + düğüm haritası (34 düğüm, 54 bağ). Harita verisi elle değil `harness/bin/site-data.js` ile `.claude/agents/` ve elle yazılmış ilişki listesinden üretilir; `lint.js --check` ile bayatlık CI'da yakalanır. **Ruling:** ilişki listesi elle bakımlı (hangi birim kimi besliyor kaynaktan çıkarılamaz); yeni birim eklenince `site-data.js` UNITS tablosuna girmezse build hata verir.

## Revizyon 18: Sistem haritası (2026-11-03)
- CEO, referans olarak başka bir proje haritası gösterdi (her şeyin ayrıntısı: ne neye bağlı, hangi kapı, hangi kanca). Tanıtım sayfasına sekmeli sistem haritası eklendi: Akış, Kancalar, Kapılar, Birimler, Kılavuzlar, Altyapı, Düğüm haritası; arama (Ctrl/⌘ K), seviye ve aşama süzgeçleri, kataloglar arası atlama. Tasarım korundu.
- **Ruling:** 28 kapı listesi elle bakımlı ama her kapı en az bir dayanak dosyaya bağlı ve dosya yoksa üretim hata verir (`site-data.js`); seviye etiketi (Zorlanıyor / Denetleniyor / Yalnızca talimat) kasıtlı olarak abartılmaz. Yanlışsa maliyet: yeni bir kapı listeye girmezse sayfada görünmez (lint yakalamaz).
- Bulgu ve düzeltme: `guard.js` komut metnindeki heredoc gövdesinde geçen `--no-verify` yazısını git bayrağı sanıyordu (yanlış alarm). Artık yalnızca komut satırındaki bayrak sayılır; tırnaklı bayrak hâlâ reddedilir. 2 test eklendi.

## Revizyon 19: Kapsam genişletme (2026-11-04)
- CEO: DevOps ve yazılım mimarı eksik görünüyor; .NET ve React ile sınırlamak Django, Vue gibi kaynaklardan göçleri dışarıda bırakıyor, uzmanlaşma korunurken diğer alanlar kaybolmamalı.
- Tespit: DevOps/SRE ve Architecture board vardı ama mimari yalnızca denetliyordu (tasarlayan yoktu) ve DevOps kılavuzu yığın-bağımsız değildi.
- Karar: iki birim eklendi. `software-architect` tasarlar (opus, Bash yok, yazma yalnızca `docs/architecture/tasarim/`); denetimi Architecture board verir, yani yapan doğrulamaz kuralı korunur. `polyglot-engineer` standart dışı yığınları okur ve port eder (kip A imzadan önce salt-okuma, kip B imzalı spec ve ADR ile). DevOps kılavuzuna yığın tablosu eklendi. `STACK.md`: varsayılan .NET/React kalır, diğer yığınlar "dene/değerlendir" ile desteklenir.
- **Ruling:** her dil için ayrı birim açılmadı, tek çok yığınlı birim ve yığın tablosu kullanıldı — birim sayısı ve bakım yükü artmasın; yanlışsa maliyet: tek birim bir yığında yetersiz kalırsa o yığın için ayrı birim açılır.
- Bilinen sınır: ajan imajında yalnızca .NET ve Node var, ağ izin listesi yalnızca NuGet ve npm; Python/PHP/Java kodu çalıştırmak imaj genişletmesi ve izin listesi değişikliği gerektirir (CEO kararı). O zamana kadar kip A (okuma, envanter) çalışır, kip B bu yığınlarda "doğrulanamadı" üretir.

## Revizyon 20: Tercih kısıt değildir (2026-11-04)
- CEO: .NET yazıyor diye diğer diller sınırlı olmamalı; tercih .NET olmalı. Revizyon 19'daki sınırlayıcı kısımlar yanlıştı: diğer yığınlara "dene/değerlendir" demek ve standart dışı yığında kod için ADR şartı koşmak tercihi kısıta çevirmişti.
- Düzeltme: `STACK.md` "tercih kısıt değildir" der; Python/Django, Vue, PHP, Java, Go "benimse (ikincil)". Spec bir yığını adlandırıyorsa orada tam geliştirme yapılır; imzalı spec CEO kararıdır, ADR ön koşul değildir (yalnızca geri dönüşü pahalı seçimlerde önerilir). Architecture board görüş verir, engellemez. Spec yığın adlandırmıyorsa varsayılan .NET/React önerilir ve CEO'ya sorulur.
- **Ruling:** yığın seçimi spec'te CEO imzasıyla yapılır, ayrıca ADR kapısı yok — gereksiz bürokrasiyi önler; yanlışsa maliyet: kötü bir yığın seçimi imzadan sonra fark edilir, o zaman delta plan ve yeniden imza gerekir.
- Kalan gerçek sınır teknik, politika değil: ajan imajında yalnızca .NET ve Node var, ağ izin listesi yalnızca NuGet ve npm.

## Revizyon 21: Python çalıştırma ve PyPI izni (2026-11-04)
- CEO onayladı: Python eklensin. Tespit: ajan imajında Python 3.12 ve venv zaten vardı (graphify için); eksik olan PyPI erişimiydi, "imajda Python yok" demek yanlıştı.
- Değişiklik: `proxy-up.sh` varsayılanı `nuget,npm,pypi`; izin listesine `pypi.org` ve `files.pythonhosted.org` eklendi (yalnızca 443). `COMPANY_REGISTRIES=none` hepsini kapatır. `harness/test/python.sh` gerçek konteynerde dener: venv ve `pip` ile paket iner, listede olmayan adres ve vekilsiz doğrudan çıkış engelli kalır (4 test, Docker gerektirir, CI'da yok).
- Bulgu: konteynerde `/tmp` ve `/home/node` `noexec`; venv betikleri (`v/bin/pip`) çalışmaz, `python -m pip` çalışır. Kılavuza yazıldı.
- **Ruling:** PyPI varsayılan açık, NuGet ve npm ile aynı model — indirilen paket sertleştirilmiş konteynerde çalışır (agent tokenından başka sır yok, başka çıkış yok), üretime denetimsiz gitmez; yanlışsa maliyet: kötü niyetli bir paket konteyner içinde kod çalıştırabilir, kapatmak `COMPANY_REGISTRIES=nuget,npm`.
- Yapılmadı: imaj yeniden kurulmadı (Docker Hub'a bu ortamdan erişilemedi); gerek de olmadı, imaj değişmedi. PHP, Java, Go hâlâ imajda yok.

## Revizyon 22: Main koruması (2026-11-04)
- CEO: depo özel kalsın, ödeme yok. GitHub Pro alınmıyor, depo herkese açılmıyor; GitHub'ın kendi dal koruması kullanılmayacak.
- **Ruling:** main'i `guard.js` (CI yeşil değilse `gh pr merge` reddedilir, main'e push/merge CEO onayı ister) ve CI koruyor; yeni araç gerekmez. Yanlışsa maliyet: GitHub arayüzünden elle yapılan merge veya doğrudan push guard'ı atlar. Bu açık bilinen sınır olarak kalır; kapatmak için Pro veya herkese açık depo gerekir.
