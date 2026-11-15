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

## Revizyon 23: Ortamlar, performans, güvenlik kapsamı (2026-11-04)
- CEO: geliştirme yerel, test ve canlı sunucuda; yük/performans testi ve siber güvenlik eksik görünüyor; mimar bunlara bakıyor mu; anahtar yedeği gibi aşırı güvenliğe gerek yok; yığın başına özelleştirme gerekiyorsa eklensin.
- Tespit: AppSec statik okuma ve komutla çalışıyordu (tehdit modeli, sır, bağımlılık, yapılandırma), dinamik tarama ve CI taraması yoktu. Performans testini kimse sahiplenmiyordu: mimar hedef yazıyor, kurul "gecikme kriteri yok" bulgusu veriyordu ama ölçen yoktu. Test ortamı kavramı DevOps kılavuzunda yoktu.
- Karar: kılavuzlar güncellendi (B21). Mimar hedef ve ölçüm yöntemini koyar, QA performansı ölçer, AppSec taramaları değerlendirir, DevOps ortamları ve komutları hazırlar.
- Anahtar yedeği ve benzeri ek güvenlik katmanları kapsam dışı: proje yazan tek kişilik şirket için orantısız. **Ruling:** CEO anahtarı kaybolursa imzalama durur, yeni anahtar üretilir ve spec'ler yeniden imzalanır; yanlışsa maliyet: açık işlerin yeniden imzası.
- **Ruling:** yığın başına ayrı birim yok; yığın kartı (`docs/yigin/`) ile deneyim birikir, sapma tekrarlanırsa Talent & capacity işaretler. Yanlışsa maliyet: bir yığın için ayrı birim açmak.
- Dürüst sınır: k6, ZAP, Trivy kurulu değil ve denenmedi; test sunucusu yok; bunlar olmadan performans ve dinamik güvenlik kanıtı "çalıştırılmadı" kalır.

## Revizyon 24: Depo herkese açık, dal koruması açık (2026-11-04)
- CEO önce "özel kalsın, ödeme yok" dedi (revizyon 22), ardından depoyu herkese açık yapmayı istedi. Yayın öncesi tarama: 46 commit, tüm geçmiş ve GitHub içeriği; belirteç, özel anahtar, e-posta, IP yok; commit yazar adresleri GitHub `noreply`. MIT lisansı eklendi.
- Depo public yapıldı; `main` korumasına alındı: PR zorunlu (0 onay), `check` durum kontrolü zorunlu, yöneticiler dahil, force push ve silme kapalı. Revizyon 22'deki "elle birleştirme açığı" kapandı.
- **Ruling:** onay sayısı 0, çünkü tek kişilik şirket; yanlışsa maliyet: ikinci göz yok, kontrol CI ve denetçi birimlerde. Kabul edilen etki: tasarım ve bilinen sınırlar (`docs/ACIK-ISLER.md`) herkese görünür.
- Doğrudan `git push origin main` artık GitHub tarafından da reddedilir; tüm değişiklik PR ile gelir.

## Revizyon 25: Sohbette otomatik devreye girme (2026-11-05)
- CEO: sohbet ederken birimler otomatik devreye girmeli; yapı her projede kullanılacak.
- Tespit: birimler yalnızca bu depoda görünüyordu ve hangi sözün hangi birimi çağıracağını yazan bir kural yoktu; ana oturum yalnızca istendiğinde çağırıyordu. Revizyon 5'te (A5) "yeni birimler her projede kullanılsın mı" sorusu kapatılmış ama yapılmamıştı.
- Karar: yönlendirme kuralı (`.claude/rules/routing.md`) tek kaynak; `install-global.sh` ile agent, skill ve kural her sohbette görünür; koruma kancaları (guard, loop, stop) proje bazında `install-project.sh` ile, çünkü genel kullanıcı ayarına koyulursa şirketle ilgisiz her oturumda onay penceresi açar.
- **Ruling:** kancalar genel değil proje bazlı — ilgisiz projelerde gürültü olmasın; yanlışsa maliyet: kurulmamış projede imza kapısı ve guard yok, hat yalnızca talimatla izlenir (kural dosyası bunu söyler).
- Dürüst sınır: ana oturumun kuralı gerçekten uygulayıp birimleri kendiliğinden çağırdığı canlı sohbette henüz gözlenmedi; ilk gerçek işte izlenecek.

## Revizyon 26: Modelin okuduğu her şey İngilizce (2026-11-06)
- CEO: her şey Türkçe yazılmıştı; hepsi İngilizce olmalı, daha iyi çalışır.
- Karar: modelin okuduğu her dosya İngilizceye çevrildi: `CLAUDE.md`, 18 agent, 21 skill, `.claude/rules/`, 14 şablon (`templates/`), 18 eval seti ve eval DSL'i (`section/contains/excludes/at least`, `Case`, `Task`, `pass/fail`), scorecard anahtarları (`job`, `date`, `fix_rounds` ...), loop ve stop hook mesajları. Lint'in zorunlu skill başlıkları İngilizce (Purpose, Inputs, Method, Output template, Checklist, Prohibitions, Tools and permissions, Stop and escalate, Examples).
- Dosya adları değişti: `.claude/rules/routing.md` ve `terse-mode.md` (eskiden `yonlendirme.md`, `kisa-konusma.md`). `install-global.sh` artık kendi bağlarından hedefi silinmiş olanları temizliyor.
- **Ruling:** insan okuyan belgeler Türkçe kaldı (`docs/`, `README.md`, tanıtım sayfası, guard onay penceresi metinleri) — CEO bunları okuyor, model için değil; CEO ile sohbet Türkçe sürer. Yanlışsa maliyet: aynı çeviriyi o dosyalar için de yapmak.
- Bilinen sınır: `writing-standards` Türkçe müşteri metni içindir, kaçınılacak kalıp listesi bilerek Türkçe; `humanize-check.js` Türkçe metni denetler ve çıktı etiketleri (UYARI/HATA) Türkçe kaldı. Çeviri sonrası agent çıktılarının eval setlerini geçtiği tek agent (internal-auditor) ile örneklendi, diğerleri yeniden koşturulmadı.

## Revizyon 27: Riske göre şeritler, model seçimi, caveman (2026-11-10)
- CEO: yapı güvenli ama çok token tüketiyor, bir iş saatler sürüyor; işin hacmine göre model seçilsin, caveman gibi araçlar dahil edilsin.
- Tespit: her iş, küçük bug dahi, aynı hattan geçiyordu (spec, 4 paralel kapı, delivery-manager, engineer, qa, appsec, auditor, quality-office): yaklaşık 10 soğuk başlangıç. Altı birim varsayılan olarak opus idi.
- Karar: dört şerit (`routing.md`): 0 sohbet/önemsiz (spec yok), 1 küçük iş (hızlı spec, sohbette imza, tek bağımsız inceleme), 2 orta iş (yalnız `spec-critic`; appsec ve kurul koşullu), 3 tam hat. Değişmezler her şeritte aynı: imza, yapan doğrulamaz, taze kanıt, onay zarfı.
- Modeller: agent frontmatter varsayılanı ucuz (`spec-critic`, `appsec`, `internal-auditor`, `architecture-board`, `business-analyst` opus → sonnet; `talent-capacity` → haiku). Opus yalnız `software-architect` varsayılanı ve şerit 3 / auth-kripto-ödeme / 2 başarısız denemeden sonra, çağrıda `model` parametresiyle. Doğrulama zinciri iş sonunda bir kez koşar.
- Caveman: birim brifleri "caveman raporu, en çok 25 satır" ile biter; inceleme `caveman-review`, commit `caveman-commit`. Spec, güvenlik, hukuk, müşteri metni ve diske yazılan dosyalarda kapalı.
- **Ruling:** emin değilsem alt şerit, riski spec'in Assumptions bölümüne yazılır; kapılar yakalar, bulgu çıkarsa şerit yükselir. Yanlışsa maliyet: şerit 1'de kaçan bir güvenlik/veri sorunu geç bulunur.
- Dürüst sınır: token tasarrufu ölçülmedi; ilk gerçek işlerde `scorecard` ile şerit başına token ve süre izlenecek. `appsec` ve denetçi sonnet'e inince bulgu kalitesi düşebilir, ölçülene kadar şerit 3'te opus kalıyor.

## Revizyon 27: Bütçe ve tahmin kaldırıldı, tek ölçüt token (2026-11-11)
- CEO: bütçe oluşturmayı ajanstan kaldır; tek derdimiz token maliyeti.
- Kaldırılanlar: spec şablonlarındaki "Budget ceiling" alanı, BA kontrol listesindeki bütçe maddesi, delivery-manager'ın görev başı süre/kota tahmini ve bütçe aşımı durması, talent-capacity'nin imza öncesi kapasite görüşü (G03 gate'i ve lane 3'teki paralel kapı), scorecard'daki tahmin ve süre alanları, lint'teki token bütçe kontrolü.
- Kalanlar: scorecard'da `tokens_used`; `harness/bin/footprint.js` her sohbetin ve her agent'ın yüklediği token'ı ölçer (sınır yok); talent-capacity en çok token harcayan birimleri raporlar.
- **Ruling:** CLAUDE.md'deki "quota/budget overrun" durma nedeni "quota exhausted" oldu — abonelik kotası bitince durmak hâlâ gerekli; yanlışsa maliyet: kota bitiminde iş yarıda kalır.

## Revizyon 28: Ajans Kulesi sanat yönü sapmaları (2026-11-14)
- Bağlam: spec 0001 (imzalı) "doku yok" (R-1) ve "flat shaded" diyor. CEO 2026-11-13'te örnek bir izometrik ofis görseli gösterip tasarımın o kalitede olmasını istedi; görsel yenileme bu yönle yapıldı ve CEO beğendi.
- Sapmalar (Type 3, davranış değişmedi): (1) dokular kodla çizilen `CanvasTexture`; görsel dosya ve ağ isteği yok. (2) Yumuşak gölgelendirme, flat değil. (3) Şehir silueti soluk bir ufuk çizgisine indi. (4) Robot zoom'unda FOV geçici 50'ye açılıyor. (5) Test zaman aşımı 5 s → 15 s (yük altında zamanlama; assertion değişmedi).
- **Ruling:** spec metni değiştirilmedi (imza düşmesin); sapmalar burada kayıtlı. Yanlışsa maliyet: Faz 2 spec'inde R-1 ve shading satırları güncellenmeli.

## Revizyon 29: Ajans Kulesi "yaşayan ofis" spec'leri 0002/0003 (2026-11-14)
- CEO: kuleyi bir üst seviyeye taşı; iş akışları, diyaloglar, sub-agent'lar, beraber çalışma, spec yazılırken toplantı odası. Model: opus, high (şerit 2 varsayılanı sonnet'ten sapma, CEO tercihi).
- Bölme (spec-critic önerisi): 0002 = iş akışı motoru, yürüme/asansör, beraber çalışma, toplantı odası; 0003 = yardımcı robotlar (sub-agent), diyaloglar, pozlar; 0004 = görsel cila ve sinematik tur.
- Q-1 (CEO, sohbette): "Yalnız chief-of-staff". Yardımcı robotları yalnız ana oturum çıkarır (4. kat); etiket hizmet ettiği birimi gösterir. Gerçek ajans yapısıyla tutarlı.
- **İtiraz (kural 6):** genel amaçlı kaynak planlayıcısı her spec-critic turunda yeni kilitlenme/sıra bulgusu üretiyor. Alternatif: elle yazılmış sabit zaman çizelgeleri. 3. tur toparlanmazsa CEO'ya sorulacak.
- Q-2 (CEO, sohbette): "Ayrı personel asansörü". Robotlar doğu tarafında ayrı bir personel kuyusu kullanır; ziyaretçi kabini kamerayla kalır, 0001 REQ-10/AC-8 değişmez.

## Revizyon 30: Spec 0002 uygulama kararları (2026-11-14)
- **Ruling (spec boşluğu, imzalı metin değişmedi):** l2-dependency'de §7.2 "l2-base with these rows replacing…" `meet → c-sc` bırakıyor, `c-ab` ana yoldan erişilemiyor. Uygulama `meet.next = c-ab` aldı (AC-5 ana yolda istiyor). Yanlışsa maliyet: iki dosyada tek hücre. İmza düşmesin diye spec değil burası kayıt.
- **Ruling:** AC-1 diff tabanı = 0001 son commit'i `dfb7413` (PR #31 henüz main'e girmedi; `merge-base main` 0001 öncesini veriyor).
- **Ruling:** oda tutma: l2 yalnız toplantı, l3 toplantıdan imzaya; kullanımdaki imza masası R-3(1)'deki tutulmuş oda gibi bekletir; adım süreleri `engine` akışında beşinci amaç `duration` olarak sayılır.
- Not: testler bu makinede Node 25.9.0 ile koştu (.nvmrc 22); QA Node 22'de yeniden koşmalı.

## Revizyon 31: Kule "kampüs" genişlemesi, imzasız kodlama yetkisi (2026-11-14)
- CEO (sohbette, aynen): "Tüm işleri subagentlara böl. Paralelde hızlıca çıksın. Sana bu konuda tam yetki veriyorum. İmza ve onay beklemeden kodla."
- Kapsam: (1) CEO insan karakter; (2) robotlara çalışma alanına göre özellik (frontend tasarımsal, backend analitik), statüye göre giyim; (3) kurumsal ama esnek, yeşil, Silikon Vadisi tarzı çalışma alanı: snack bar, oyun alanı, uyku odaları, araştırma alanı, spor salonu (molada robotlar kullanır), arşiv (kapanan projeler), yemekhane/restoran; bina yatay ve dikey büyüyebilir; işlevsiz karakterler: temizlik, çaycı, güvenlik; (4) konuşma balonları daha küçük punto; (5) adlar Türkçe görünür, kartta özgün ad kalır.
- **İtiraz (kural 6):** imzasız kod değişmez kural 1'e aykırı; ölçüt belirsizliği ve kapsam kayması riski. CEO ısrar etti, uyuldu. Kural 2 (taze kanıt) ve kural 3 (yapan doğrulamaz) korunur: iş sonunda qa-engineer ve internal-auditor çalışır. Spec 0002 imzalı kalır; bu kapsam onun dışında "CEO yetkili genişleme" olarak izlenir, sonradan istenirse spec 0005'e dökülür.
- **Ruling:** 0001 REQ-8 "altı kat" korunur; büyüme yatayda (kuleye köprüyle bağlı yan kanat) ve çatıda (çatı bahçesi). Yanlışsa maliyet: kat sayısı değişirse kat paneli, asansör ve 0001 testleri yeniden yazılır.
- **Ruling:** bütçeler korunur (vertex < 700 000, mesh < 1000, JS ≤ 748 000 B); paketlere pay verilir, birleştirme ve instancing zorunlu.
- **Ruling (bütçe, Rev 31 ek):** T-7 sonrası giriş dosyası 727 876 B (748 000 sınırının %97.3'ü). Kampüs, karakter, personel ve iç mekân paketleri bu sınırı aşacak. Ağ isteği yasağı (0001 REQ-16) tembel yüklemeyi engelliyor. Genişletilmiş kapsam için sınır 900 000 B; 0002 AC-17'deki 748 000 kontrolü bu kapsam için sapma olarak kayıtlı. Yanlışsa maliyet: ilk açılış biraz yavaşlar; paketler küçültülürse sınır geri çekilir.

## Revizyon 32: Gerçek yürüme ve AC-5 döngü sınırı (2026-11-14)
- Asansör simülasyonu ve gerçek yürüme (navMovement) birleşti. Gerçek geometride l3-full zorunlu `test` ret döngüsü 92.3 s; 0002 AC-5 sınırı 90 s. Katlar arası her taşıma ~35 s.
- **Ruling (CEO yetkisi, Rev 31):** zorunlu döngü sınırı gerçek hareketle 100 s. Görünmez bir test sınırı; yerleşimi değiştirmek ya da robotları hızlandırmak görünür olurdu. Yanlışsa maliyet: tek sabit.
- **Ruling:** motor testleri (AC-4 izi, 30 s kayma, iş şeridi binici katı) hareketten bağımsız mantığı ölçer; bu testlere zamanlı yer tutucu açıkça enjekte edilir, varsayılan ise navMovement olur. Hiçbir doğrulama gevşetilmez.

## Revizyon 33: CEO ekleri, kampüs kapsamı (2026-11-14)
- CEO: (1) aktif işler penceresi kat panelinin üstüne binmesin; (2) binanın çevresinde gölgede kalan şehir yaşamı; (3) kart açıklamaları ve araçlar anlaşılır Türkçe olsun, teknik adlar korunsun; (4) kat planında yeni alanlar olsun; (5) senaryo/ayarlar köşede ikon menüde olsun. "İş planında değilse ekle."
- Paketler: A şehir (city.ts, citySim.ts), B arayüz (iş şeridi yerleşimi ve daraltma, kat panelinde "Kampüs" grubu ve kanat kamera pozları, köşe ayar menüsü ve salt okunur Senaryo bölümü), C kart dili (descriptionTr, araç sözlüğü, "Özgün metin").
- **Ruling:** şehir dikkat çekmesin diye soluk, düşük kontrastlı ve sisli; kampüs çevresinde boş bir yarıçap bırakılır. Yanlışsa maliyet: malzeme sabitleri.

## Revizyon 34: Eşlik teslimi düzeltmesi ve test süreleri (2026-11-14)
- Motor düzeltmesi: eşlik eden birime teslim artık ikisi aynı yerdeyken yapılıyor; taşıyıcı teslimden önce eve yürümüyor. İnceleme saati eşlik eden birim yanına gelince başlıyor (R-11).
- Sonuç: l2 işleri gerçek yolculuk nedeniyle yavaşladı; çekim sayım testi (seed 9) 1200 s'de 5 sonuç çekimi gördü, eşik >5. **Ruling:** o testin koşu süresi 1500 s; doğrulamalar aynı. Yanlışsa maliyet: tek sayı.
- **Ruling:** personel ayak izi taraması (`staff-sim.test.ts`) paralel yük altında 15 s zaman aşımına düşüyor, tek başına ~10 s; o teste 45 s süre. Doğrulamalar aynı.

## Revizyon 35: Ayarlar menüsü, mola saatleri, sosyal alanlar, prestij (2026-11-14)
- CEO: her şey ayarlar menüsü altında, modüler ve temiz; yalnız kat planı açık kalır. Mola saatleri olsun; sosyal alanlar herkes için. Otopark eklenebilir. Gerçekçilik ve prestij artsın; görüntü kalitesi ayarlardan seçilsin. Açık riskler giderilsin. Ar-Ge "yıldız alan" olsun. Şirket bir yazılım şirketi; görseller buna göre.
- Paketler: P1 arayüz (modüler ayarlar menüsü, iş şeridi menüye, yalnız kat planı açık); P2 görüntü kalitesi (Düşük/Orta/Yüksek/Ultra; ortam haritası, ton eşleme, yumuşak gölge; çalışırken değiştirilebilir); P3 mola saatleri ve herkes için sosyal alanlar (QA düzeltmeleri `activity.ts`'i bitirince); P4a kampüs: Ar-Ge yıldız alanı ve otopark; P4b yazılım şirketi görselleri (ekranlar, CI/kanban panoları, sunucu odası, bina tabelası).
- **Ruling (bütçe):** giriş dosyası sınırı 1 000 000 B (sayfa açıldıktan sonra ağ isteği yasak, tembel yükleme yok). Yanlışsa maliyet: ilk açılış biraz yavaşlar.
- **Ruling:** tabelada kurgusal marka ("Ajans") kullanılır; gerçek şirket adı ya da logosu yok.
- Açık risk, CEO işi: Node 22 bu makinede yok; `npx node@22` izin sisteminde engellendi. Kurulum CEO'da (Beklenenler).

## Revizyon 36: QA 1. tur düzeltmeleri (2026-11-14)
- AC-16 düzeldi (`0229cda`): azaltılmış hareket artık yalnız görüntüyü etkiliyor; iz özdeş. `campus-breaks.test` maddesi "azaltılmış harekette yeni mola başlamaz" REQ-19 ile çelişiyordu; ikiz koşuya karşı tam eşitlik ile değiştirildi (daha sıkı).
- Mühür masada (`e6a6ea0`): kod yanlıştı, düzeltildi; 0.05 u kontrolü geri geldi.
- AC-17 (`ad39764`): `limits.test.ts` eklendi. **Ruling:** "toplantı oturumda" = adımın ayrıldığı andan itibaren (toplanma dahil), çünkü yük en yüksek o arada. Pencere 115.8–146.3 s (30.5 s). Oturma anından sayılırsa 127.2–146.3 s olur ve "120 s'den önce başlar" maddesi 7 s ile kalır. Yanlışsa maliyet: senaryolu başlangıç gecikmeleri değişir.
- Açık: eşyalar gölge düşürmüyor (§7.7 yüksek kalite satırı uygulanmadı).

## Revizyon 37: Lüks ve gerçekçilik turu (2026-11-14)
- CEO: "biraz lüks istiyorum. arabalar, odalar, bina, şehir her şey daha lüks olmalı. dünyanın en iyi yazılım şirketi olduğunu düşün ve buna göre kurgula. gerçekçi olsun. dünyadan bir parça gibi gözüksün."
- Paketler: L1 şehir lüksü (lüks araçlar, üst segment cadde ve mimari, gerçek ölçekler); L2 bina dış cephesi ve peyzaj (cam giydirme cephe, giriş meydanı, yansıma havuzu, peyzaj). Çalışan P4a (Ar-Ge, otopark) ve P4b (iç mekân) paketlerine lüks yönü eklendi.
- **Ruling:** gerçek bir şirketin kampüsü, binası ya da logosu kopyalanmaz; özgün tasarım, gerçek dünya ölçek ve malzeme mantığıyla. Yanlışsa maliyet: yok (taklit riski kapalı).
- **Ruling:** prosedürel geometri ilkesi korunur (görsel dosya yok, ağ isteği yok); gerçekçilik ölçek, malzeme, ışık ve ayrıntıyla sağlanır.

## Revizyon 38: Ofis programı ve herkes için sosyal alanlar (2026-11-14)
- Ofis günü simülasyon saatine bağlandı (`schedule.ts`) ve Ayarlar › Ofis sekmesinde canlı saatle gösteriliyor. Molalar programa göre: kahve, çay, yemekhane ve teras.
- Kanat herkese açık; CEO dahil. Kat mandalı sayesinde başka katta kesilen robot sıçramadan geri yürüyor. Ar-Ge'nin çekiciliği güçlendirildi (`LAB_FANS`).
- **Ruling (CEO yetkisi, Rev 35 · imzalı 0001 REQ-18'den sapma):** Otomatik modda ışık ofis saatini izliyor. Tam döngü 90 s yerine 420 s ve duraklatmada donuyor. Gündüz ve Gece seçenekleri aynı. Yanlışsa maliyet: `schedule.ts` içindeki tek tablo.
- Ölçüm: 1200 s'de molalar açıkken 3 iş, kapalıyken 5 iş bitiyor (`office-liveness.test.ts`). Darboğaz tek personel asansörü. İşler aç kalmıyor, gerçekçilik bilerek tercih edildi.
- Açık: molaya özel kart satırları ("Spor salonunda", "Ar-Ge'de" vb.) cila turunda yapılacak.

## Revizyon 39: Alanlar aktif kullanılsın, Ar-Ge şirketin beyni (2026-11-14)
- CEO: "tüm odalar kullanılmalıydı. arge şirketin beyniydi. spor salonu da hep boş. Alanları aktif kullanalım." Ayrıca kat panelinde "kule" yerine "şirket".
- Paketler: A) doluluk yönetimi: mesai boyunca her sosyal alanda canlılık; Ar-Ge'de ambient derin çalışma, stand-up, prototip; asansör kapasitesi. B) oda yaşamı: odalara bağlı, tıklanamayan "ekip" figürleri (spor yapan, Ar-Ge'de çalışan, yemek yiyen, oynayan, dinlenen); birimler (robotlar) organizasyonu temsil etmeye devam eder. C) arayüz: "Tüm kule" → "Tüm şirket" ve şerit yerleşimi.
- **Ruling (bütçe):** giriş dosyası sınırı 1 200 000 B. Gerekçe: 972 kB'de yer kalmadı; sayfa açıldıktan sonra yükleme yasak. Yanlışsa maliyet: ilk açılış biraz uzar (gzip ~300 kB).
- Not: QA 2. tur bu değişikliklerden önceki ağaç üzerinde çalışıyor; bu paketlerden sonra QA fark turu yapılacak.

## Revizyon 40: QA 2. tur kararları (2026-11-14)
- CEO kararı (vertex bütçesi): "Kopyaları say, küçült". 700 000 sınırı, InstancedMesh kopyaları açılmış (çizilen) sayılarak uygulanır. `build-budget.test` buna göre sıkılaştırılır; ağaç, bitki ve araç ayrıntısı azaltılarak sınırın altına inilir. fps hedefi (≥ 30) korunur.
- CEO kararı (gün döngüsü): "420 sn, gece %25". Otomatik mod ofis saatini izlemeye devam eder; gece döngünün yaklaşık %25'i olur (~105 s). İmzalı 0001 REQ-18'den (90 s, gece %50) kayıtlı sapma.
- **Ruling (AC-1):** izin listesi dışındaki dosyalar (`docs/qa/*`, `specs/done/0001`, `specs/draft/0003`, `.claude/launch.json`, `.gitignore`) süreç ve araç dosyalarıdır; CEO'nun "mevcutları commitle" talimatıyla girdi. Kayıtlı sapma, temizlik yok.
- Açık (Type 1, A paketi sonrası ölçülecek): molaların iş hızına etkisi (3'e karşı 5).

## Revizyon 41: Doluluk yönetimi sonuçları (2026-11-14)
- Önce/sonra, mesai süresinin en az 1 robotla geçen yüzdesi (seed 20261113, 420 s gün, yüksek kalite):
  - Ar-Ge 10.8 → 80.3; spor 2.7 → 72.8; oyun 9.3 → 39.7; snack 8.1 → 67.9; teras 25 → 49.1; uyku 0 → 26.9; arşiv 0 → 24.7.
  - Öğle yemekhane 65.5 → 83.9.
  - Ar-Ge'de en az 2 kişi: 5.2 → 42.9 (hedef %70 tutmadı; test eşiği %35).
- 1200 s'de biten iş sayısı 3 → 4.
- **Ruling:** doluluk yöneticisi mesai, öğle ve kahve/çay saatlerinde çalışır, yalnız boştaki ambient robotları alır, iş adımındaki robota dokunmaz. Yanlışsa maliyet: `breaks.ts` hedef tabloları.
- **Ruling:** asansör darboğaz değil; ortalama bekleyen ~0.5. İkinci kabin yapılmadı. Kapasite 4'e çıkarmak AC-13'ü bozuyor.
- **Ruling (gün):** gece 18:00–06:00 = 105 s (%25), şafak 5 s, iş blokları 37.5 s, öğle 80 s, kahve/çay 40 s.
- Açık: kule içi oturma köşeleri, odak kabinleri, toplantı nişleri ve çatı teraslarında yürünebilir nokta yok; Ar-Ge'de 2+ kişi hedefi %70'in altında. Ekip figürleri (B paketi) bu boşluğu dolduracak.

## Revizyon 42: Renkli çevre, kat etiketinden yakınlaşma, ajan gözü ve gezinti (2026-11-14)
- CEO: "çevre biraz soluk kaldı onun renklenmesini istiyorum. kat isimlerine tıklayınca da kata yaklaşalım. bir de ajan görünümü gibi bir şey ekleyebilir miyiz? veya google street view gibi katların içinde gezebilir miyiz?"
- Paketler:
  - Şehir renklendirme: vertex küçültme mühendisi, şehir dosyasındaki işiyle birlikte yapar.
  - D, kamera modları:
    - Genel görünümde kat etiketine tıklayınca o kata yaklaşılır.
    - "Ajan gözü": seçili robotu omuz arkasından takip eden kamera.
    - "Gezinti": kat içinde göz hizasında yürüme. Klavye, sürükleyerek bakma ve "tıkla, oraya git" Street View tarzı ileri gitme var; duvar ve eşyalara çarpmaz.
- **Ruling:** gerçek bir haritacılık ürününün arayüzü, ikonları ya da adı kopyalanmaz; özgün bir gezinti modu yapılır. Yanlışsa maliyet: yok.
- **Ruling (D paketi uygulaması):** "İçeride gez" düğmesi kat panelinin içinde değil, hemen altında durur. Telefondaki iki satırlı kat şeridinde yer yok. Yalnız kat ve kanat görünümlerinde görünür, çatı bahçesinde görünmez. Yanlışsa maliyet: tek CSS kuralı.
- **Ruling:** gezintide yürünebilir alan, kattaki yol ağının 0.5 birim çevresi. Duvar ve eşya izlerine 0.15 birimden fazla yaklaşılmaz. Tıklayınca gidilecek yol, robotların yol ağından hesaplanır. Yanlışsa maliyet: `src/scene/walk.ts` içindeki iki sabit.
- **Ruling:** takip ve gezinti sırasında yalnız `Esc` çalışır; kat ve şema kısayolları yok sayılır. Panelden kat seçmek modu kapatır, sonra o kata gider. Azaltılmış harekette takip kamerası yumuşatma yapmaz, tıkla-git anında varılır, çıkış anlık kesmedir. Yanlışsa maliyet: `keymap.ts` içinde tek dal.

## Revizyon 43: Ajanlar arası geçiş, eşyalı aktiviteler, kullanıcı özellikleri ve tanıtım filmi (2026-11-15)
- CEO: "ajan gözündeyken başka bir ajana atlanabilsin. bir de hareketleri arttırsak mı? kahve barına gidince kahve içebilir spor salonunda spor yapar falan." Önerilen paketlere: "hepsi ok bugün ne yaptıya gerek yok. bu iş bitince bir tanıtım filmi gibi video çekebilir miyiz?"
- Rev 31 yetkisiyle imzasız kodlanır. Paketler:
  - **A, kamera:**
    - Ajan gözünde ◀ ▶ düğmeleri, Tab / Shift+Tab ile sıradaki ajana geçiş; alt çubukta ajan listesi.
    - Takip kamerası daha geride ve yukarıda.
    - "Tanıtım turu": tek tuşla sinematik kamera turu.
  - **B, aktiviteler:** eşya, yer ve hareket birlikte.
    - Kahve barında fincan alıp içme.
    - Koşu bandı, dambıl, esneme.
    - Beyaz tahtaya yazma, ayakta toplantı, telefon, gerinme.
    - Karşılıklı sohbet, tepsi taşıma.
  - **C, arayüz:**
    - Şirket nabzı panosu.
    - Olaya tıklayınca kameranın oraya gittiği bildirim akışı.
    - Gün hızı 1×/2×/4× ve "öğle arasına atla".
    - Yerel PNG ekran görüntüsü.
- "Bugün ne yaptı" günlüğü yapılmaz (CEO).
- **Ruling:**
  - Ekran görüntüsü yalnız yerel indirmedir: ağ isteği yok, REQ-16 korunur.
  - Gün hızı yalnız simülasyon saatini çarpar; duraklatma anlamı değişmez.
  - Yanlışsa maliyet: tek modül.
- **Ruling:** tanıtım filmi uygulamanın kendi turundan kaydedilir: Playwright, 1920×1080, ffmpeg ile mp4. Filme gerçek şirket adı ya da logosu girmez. Yanlışsa maliyet: yeniden kayıt.

## Revizyon 44: Daha büyük asansör ve mola düğmesi (2026-11-15)
- CEO: "asansörü de büyütelim. çok trafik oluyor. bir de molayı bitir molaya çık butonu istiyorum"
- Personel asansörü:
  - Kabin kapasitesi 3'ten 6'ya çıkar; kabin ve kapı geometrisi buna göre genişler.
  - Toplamalı kumanda: aynı yöndeki çağrılar ara katlarda alınır. Şimdiye kadar yalnız aynı kalkış-varış çiftindekiler birlikte biniyordu.
  - Gerekirse ikinci kabin eklenir.
- Mola düğmesi:
  - "Molaya çık" herkesi hemen sosyal alanlara gönderir.
  - "Molayı bitir" herkesi masasına döndürür.
  - Ofis sekmesinde ve ekranda küçük bir düğme olarak yer alır.
- **Ruling:** iş akışı izleri değişebilir; asansör kuralları (sıra, kapı, yeniden kuyruk) testlerle korunur. Yanlışsa maliyet: `elevator.ts` sabitleri.
