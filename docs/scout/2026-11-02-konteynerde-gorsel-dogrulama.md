Scout raporu: Konteynerde başsız tarayıcıyla ekran görüntüsü ve erişilebilirlik denetimi | Tarih: 2026-11-02 | İsteyen: React engineer birimi (konteynerde gözle doğrulama)

## İhtiyaç ve bağlam
React engineer birimi 375 px genişlikte, açık/koyu temada ve her UX durumunda (yükleniyor, boş, hata, başarı) ekranı göremiyor. Mevcut konteyner (harness/docker/Dockerfile, harness/bin/proxy-up.sh, harness/bin/company-run.sh): `mcr.microsoft.com/dotnet/sdk:10.0` tabanı (Dockerfile `userdel -r ubuntu` yaptığı için Ubuntu tabanlı görünüyor; sürüm doğrulanamadı) + Node 22, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, uid 1000, 4 GB bellek, `/tmp` 512 MB ve `/home/node` 1 GB tmpfs, ağ yalnızca vekil üzerinden (api.anthropic.com, api.nuget.org, registry.npmjs.org). İmaj "host üzerinde derlenir" (Dockerfile 2. satır); yani derleme anı vekil kısıtına tabi değildir.

## Kriterler
1. Lisans: ücretsiz, ticari kullanım serbest.
2. arm64 Linux'ta çalışır (ve x64).
3. İmaja eklenince boyut etkisi MB cinsinden, kaynaklı.
4. Tarayıcı binary'si için ek ağ adresleri ve indirme zamanı (derleme / çalışma anı) belli.
5. Bakım güncel (son 12 ay), bilinen açık yok.
6. Konteyner sertleştirmesiyle (salt-okunur kök, uid 1000, cap-drop ALL) çalışır; MCP ise yetki kapsamı dar.
7. İşlev: viewport 375 ve masaüstü, `colorScheme` light/dark, ekran görüntüsü, erişilebilirlik denetimi.

## Adaylar (karşılaştırma)

| Boyut | A. Playwright kütüphanesi (+ `@axe-core/playwright`) | B. Playwright resmi Docker imajı | C. Playwright MCP | D. Puppeteer | E. Chrome DevTools MCP | F. Lighthouse / pa11y (a11y odaklı) |
|---|---|---|---|---|---|---|
| Lisans | Apache-2.0 (playwright-core 1.64.1) [1]; axe eklentisi MPL-2.0 [2] | Apache-2.0 (aynı proje) [1]; imaj içeriği için ayrı lisans taraması yapılmadı | Apache-2.0 [3] | Apache-2.0 (25.16.0) [4] | Apache-2.0 (1.12.0) [5] | Lighthouse Apache-2.0 [6]; pa11y 10.0.0 LGPL-3.0-only [7] |
| arm64 Linux | Evet: `chromium-headless-shell` için linux-arm64 yolu kayıt kodunda var, yalnızca cdn.playwright.dev'den [8] | Üçüncü taraf yansıma amd64 ve arm64 özetlerini ayrı listeliyor (zayıf kanıt) [9] | Docker imajı yalnızca başsız Chromium destekler [3]; arm64 doğrulanamadı | Evet: Chrome for Testing 156.0.8078.80 linux-arm64 (chrome ve chrome-headless-shell) yayında [10]; 153.0.8001.0 öncesinde yoktu [11] | Yalnızca Google Chrome ve Chrome for Testing destekli [12]; arm64 için CfT linux-arm64 gerekir [10] | Puppeteer'a bağlı (pa11y) / Chrome gerekir |
| Boyut etkisi | npm: playwright-core 13,7 MB açık boyut [13]; Chromium indirmesi ~281 MB (Playwright'ın örneği) [14]; yalnızca `--only-shell` ile tam Chromium atlanır [15]; headless-shell tek başına MB değeri doğrulanamadı | Sıkıştırılmış ~853 MB (v1.57.0 amd64) ila ~895 MB (v1.61.1 arm64), üçüncü taraf yansıma, zayıf kanıt [9]. Bizim imaja eklenmez, ayrı imaj olur | @playwright/mcp 94 KB açık boyut [16] + Playwright + tarayıcı (A ile aynı) | puppeteer 43 KB, puppeteer-core ve @puppeteer/browsers bağımlı [17]; Chrome indirmesi MB değeri doğrulanamadı | 14,3 MB açık boyut [5] + Chrome (MB doğrulanamadı) | Lighthouse 19,4 MB açık boyut [18]; pa11y 105 KB + puppeteer [7] |
| Tarayıcı indirme / ağ | `cdn.playwright.dev`; kayıt kodunda `playwright.download.prss.microsoft.com` de geçer [8]; `PLAYWRIGHT_DOWNLOAD_HOST` ile yansıtılabilir [14] | İmajda hazır; MCR'dan çekilir (mcr.microsoft.com) [19] | A ile aynı | `storage.googleapis.com/chrome-for-testing-public/...` [10]; sürüm çözümlemesi için googlechromelabs.github.io kullanıldığı varsayımı doğrulanamadı | Kendi indirmez; Chrome sağlanmalı | Puppeteer ile aynı |
| Bakım | v1.64.1 14 Ekim, v1.64.0 7 Ekim, v1.63.0 4 Eylül (aylık ritim) [20]; yayımlanmış güvenlik danışmanlığı yok [21] | Her sürümle yayınlanır; Noble, Jammy, Resolute etiketleri [19] | 0.0.84; bağımlılığı alfa Playwright (1.65.0-alpha-2026-10-30) [16]; GitHub sayfasında 2 açık sorun görüldü [3] | 25.16.0 (Chrome 156 ile) [4][22]; yayımlanmış danışmanlık yok [23] | 1.12.0 [5] | Lighthouse 13.6.0 [18]; pa11y 10.0.0 [7] |
| Güvenlik | Bilinen açık: danışmanlık yok [21]. axe-core/axe-playwright için Snyk bilinen açık göstermiyor (önbellekli sayfa) [2] | Varsayılan root çalışır ve Chromium sandbox'ı kapatır; güvenilmeyen site için pwuser + özel seccomp önerilir [19] | Yetki: aşağıda | Danışmanlık yok [23] | Yetki: aşağıda | pa11y LGPL (kütüphane olarak bağlamak yerine araç olarak kullanım) |
| Konteyner uyumu | Tam kontrol: kendi betiğimiz. `--ipc=host`/yeterli `/dev/shm`, `--init` önerilir [19] | Bizim sertleştirilmiş kapsayıcı kalıbına uymaz (başka imaj, başka ağ/yetki) | Ek süreç + MCP yetkisi | Playwright ile benzer; arm64'te CfT kullanılabilir [10] | Chrome'a CDP bağlar | Yalnızca denetim, ekran görüntüsü kapsamı sınırlı |
| Çıkış maliyeti | Düşük: standart API, betik taşınabilir | Düşük | Düşük (araçlar Playwright üstünde) | Orta (API farklı, a11y yok kutudan) | Orta | Düşük |

### Erişilebilirlik denetimi katmanı
- `@axe-core/playwright` 4.14.0, MPL-2.0 (dosya düzeyinde copyleft: axe dosyalarını değiştirirsek o dosyalar açılır, uygulama kodu açılmaz; hukuk teyidi önerilir), tek bağımlılık `axe-core ~4.14.0`, 47,8 KB [2][24].
- Chrome DevTools MCP içindeki `lighthouse_audit` erişilebilirlik, SEO ve en iyi uygulama puanı verir (performans hariç) [25]. Lighthouse'un kendisi Node >=22.19 ister [18]; imajdaki Node 22 küçük sürümü doğrulanamadı.

### MCP adayları: yetki ve veri akışı
| | Playwright MCP | Chrome DevTools MCP |
|---|---|---|
| Kaynak kodu | Açık, Apache-2.0 depo görüldü [3] (kod satırları okunmadı, yalnızca README ve npm metaverisi) | Açık, Apache-2.0 [5] (kod okunmadı) |
| Yetki | Dosya erişimi çalışma kökü ile sınırlı, `file://` varsayılan engelli; `--allow-unrestricted-file-access` kaldırır. `--allowed-origins` "güvenlik sınırı değildir". `browser_run_code_unsafe` sunucu sürecinde keyfi JS çalıştırır (RCE eşdeğeri). Vision, PDF, network, storage, testing araçları `--caps` ile isteğe bağlı [3] | `evaluate_script`, `upload_file`, ağ istekleri/gövdeleri, çerez/tarayıcı içeriğini MCP istemcisine açar; çok sayıda araç `filePath` ile diske yazar [12][25] |
| Dış veri | Telemetri: README'de belirtilmiyor (doğrulanamadı) | Varsayılan açık kullanım istatistiği Google'a gider (`--no-usage-statistics` ile kapanır; `CI` ortam değişkeni de kapatır); performans araçları trace URL'lerini Google CrUX API'ye gönderebilir (`--no-performance-crux`); npm kayıt defterine periyodik güncelleme kontrolü [12] |
| Konteyner notu | Docker örneği `--no-sandbox` ve `0.0.0.0` bağlama kullanıyor [3] (bu kalıp kopyalanmamalı) | Docker/sandbox notu yok [12] |

Kural 6 gereği: MCP adaylarında kaynak kodu değil README/metaveri okundu; bu yüzden ikisi de bu iş için birincil öneri değildir (aşağıda).

## Ek ağ adresleri ve ne zaman indirilir
- **Önerilen yol (derleme anında, host üzerinde):** imaj host'ta derlenir (Dockerfile açıklaması), vekil kısıtı derlemeye uygulanmaz. Derleme sırasında gereken adresler: `registry.npmjs.org` (npm paketleri; zaten izinli), `cdn.playwright.dev` (ve kayıt kodunda geçen `playwright.download.prss.microsoft.com`) [8], ve Ubuntu apt aynaları (`npx playwright install --with-deps` sistem paketlerini apt ile kurar [14]; Ubuntu 24.04 desteklenir [19]). Tarayıcı `PLAYWRIGHT_BROWSERS_PATH` ile imaj içinde sabit bir yola (örn. `/opt/ms-playwright`) indirilirse salt-okunur kök ve uid 1000 çalışma anında sorun çıkarmaz [14].
- **Çalışma anı:** tarayıcı imajda hazırsa vekil izin listesine **hiçbir şey eklenmez**; test hedefi konteyner içindeki localhost geliştirme sunucusudur.
- **Çalışma anında indirme gerekirse (önerilmez):** Playwright için `cdn.playwright.dev` + `playwright.download.prss.microsoft.com`; Puppeteer için `storage.googleapis.com` [10]. Bu, vekil allowlist'ine yeni dış alan ekler ve tedarik zinciri yüzeyini büyütür. Başka sandbox'larda bu alanların engellenmesi sık raporlanmış [26], yani liste dışı kalırsa indirme 403 ile düşer.
- Chrome DevTools MCP: tarayıcı indirmez; Chrome/CfT sağlanmalı, ek olarak `registry.npmjs.org` güncelleme kontrolü (kapatılabilir) [12].

## Öneri
**DENE (küçük deneme önerilir) — Aday A: Playwright kütüphanesi (`playwright-core` + yalnızca `chromium-headless-shell`) + `@axe-core/playwright`, imaj derlemesinde host üzerinde indirilip pin'lenmiş sürümle imaja gömülür; MCP olmadan, betik olarak çalıştırılır.**
Gerekçe: Apache-2.0, aylık sürüm ritmi, yayımlanmış danışmanlık yok, linux-arm64 headless-shell resmi olarak üretiliyor, `colorScheme`, `viewport`, `deviceScaleFactor` yerleşik [27], tarayıcı derleme anında gömülünce vekil izin listesine ek adres gerekmiyor ve MCP'nin geniş yetki yüzeyi hiç eklenmiyor.

Diğerleri:
- B (resmi imaj): KULLANMA bu iş için. ~0,85-0,9 GB ayrı imaj (zayıf kanıt) [9], varsayılan root ve sandbox kapalı [19]; şirketin sertleştirilmiş tek imaj düzenine uymaz. Yalnızca CI'da ayrı iş olarak düşünülebilir.
- C (Playwright MCP): KULLANMA şimdilik. Aynı tarayıcıyı kullanır ama ekstra süreç, `browser_run_code_unsafe`, alfa Playwright bağımlılığı [16]; ajan zaten betik çalıştırabildiği için ek değer sınırlı.
- D (Puppeteer): alternatif/yedek. arm64'te CfT 153+ ile mümkün [10][11] ama ek a11y yok, Node >=22.12 gerekir [17]; A varken gerekçe yok.
- E (Chrome DevTools MCP): KULLANMA. Varsayılan Google'a kullanım istatistiği ve CrUX veri akışı [12], geniş yetki (keyfi JS, dosya yazma, yükleme) [25].
- F: pa11y KULLANMA (LGPL-3.0, Puppeteer bağımlılığı, ek değer az) [7]. Lighthouse yalnızca ek a11y puanı gerekirse sonradan değerlendirilir.

## Riskler
1. **Chromium sandbox çelişkisi (en büyük risk).** Konteyner `--cap-drop ALL` + `no-new-privileges` çalışıyor; Docker varsayılan seccomp'u kullanıcı ad alanı çağrılarını (`clone`, `setns`, `unshare`) kısıtlar, Playwright bu üç çağrıya izin veren özel seccomp profili öneriyor [19]. Özel seccomp kabul edilmezse tek yol `--no-sandbox` olur; bu, tarayıcı exploit'inde ek katmanı kaldırır. Azaltma: yalnızca localhost'taki kendi uygulamamızı aç, dış URL açma, ağ zaten vekile bağlı. Özel seccomp mu `--no-sandbox` mı kararı Tip 2 değil güvenlik kararıdır, AppSec/CEO'ya gider.
2. **Bellek ve paylaşımlı bellek.** `--ipc=host` olmadan Chromium bellek yetmezliği yaşayabilir [19]; `--ipc=host` zarf ve izolasyonu zayıflatır, onun yerine `--shm-size` veya `/dev/shm` tmpfs denenmeli. 4 GB sınırında Chromium davranışı ölçülmedi.
3. **Salt-okunur kök:** tarayıcı profil ve çıktı dizinleri yazılabilir tmpfs'e (`/tmp`, `/home/node`) yönlendirilmeli; `/tmp` yalnızca 512 MB, birçok tam sayfa ekran görüntüsü sığmayabilir.
4. **İmaj büyür:** Chromium ~281 MB [14] + sistem kütüphaneleri; headless-shell ve apt bağımlılıklarının net MB değeri ölçülmeden yazılmadı. Yeni bağımlılık Architecture board kararıdır.
5. **MPL-2.0 (axe)** dosya düzeyinde copyleft; değiştirmezsek pratik yükümlülük düşük ama hukuk teyidi gerekir [2].
6. **Tedarik zinciri:** npm paketi ve tarayıcı indirmesi (cdn.playwright.dev) host derlemesinde ağ egress'idir; sürümleri pin'le, lockfile ve sağlama toplamı doğrula.
7. **Yapan doğrulamaz (kural 3):** ekranı gözle bakacak olan yine React engineer ise bağımsız inceleme birimi aynı görüntülere bakmalı. Ayrıca depoya görüntü konmaz (visual-standards kanıt politikası): çıktılar `/tmp` gibi geçici dizinde kalmalı; kanıt metin/ölçüm olarak raporlanmalı.
8. **Başsız ekran görüntüsü gerçek tarayıcıyla farklı olabilir:** yeni/eski headless modu ekran görüntüsünü ve GPU/WebGL davranışını değiştirir [28].
9. **Sayfa talimatı:** incelenen sayfalarda talimat içeren içerik görülmedi.

## Doğrulanamayanlar
- chromium-headless-shell'in arm64 ve x64 için indirilen MB değeri; apt bağımlılıklarının imaja ek MB'si.
- Resmi `mcr.microsoft.com/playwright` imajının arm64 sürümünün kesin boyutu (yalnızca üçüncü taraf yansıma verisi var).
- Playwright'ın arm64 için `nativeDeps` anahtarları (sayfa özetinde yalnızca x64 anahtarları göründü; resmi dokümanda arm64 Linux açık bir cümleyle bulunamadı, kayıt kodundaki linux-arm64 yolu ve Docker imajı yansıması dolaylı kanıt).
- Playwright MCP Docker imajının arm64 desteği; Playwright MCP telemetrisi.
- Puppeteer'ın sürüm çözümlemesi için kullandığı ek host (googlechromelabs.github.io varsayımı).
- Mevcut imajdaki Ubuntu sürümü ve Node 22 küçük sürümü.
- Playwright/Puppeteer GitHub açık/kapalı sorun oranları (sayfalar yüklenemedi veya sayfa kısıtlıydı); npmjs.com sayfaları 403 verdi, sürüm verisi registry JSON'undan alındı.
- Chrome'un resmi arm64 Linux paketleri (Temmuz 2026) bir tek blog kaynağına dayanıyor (zayıf kanıt) [29]; gerekmediği için karara etkisi yok.

## Deneme önerisi
- **Ortam:** ayrı, atılabilir bir imaj dalı (`company-agent:visual-dev`), host'ta derlenir; hem arm64 hem x64 üzerinde. Çalıştırma mevcut sertleştirmeyle (`--read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --memory 4g`, tmpfs'ler). Deneme DevOps/SRE birimi tarafından, CEO onayıyla yapılır.
- **Ölçüt:** (a) imaj boyut farkı MB (öncesi/sonrası `docker image ls`); (b) `PLAYWRIGHT_BROWSERS_PATH` gömülü, çalışma anında sıfır ek ağ isteği (vekil logunda yalnızca izinli hostlar); (c) 375 px ve 1280 px, light/dark = 4 ekran görüntüsü başarıyla alınır; (d) `@axe-core/playwright` bir örnek sayfada ihlal listesi üretir; (e) Chromium şu üç yoldan hangisiyle açılıyor: varsayılan sandbox / özel seccomp / `--no-sandbox`, sonuç ve bellek tepe değeri (4 GB altında kalıyor mu); (f) 512 MB `/tmp` yeterli mi.
- **Süre:** 1 gün (derleme + ölçüm). Başarısızsa (sandbox çalışmıyor ve `--no-sandbox` kabul edilmiyorsa) seçenek: ağırlıklı olarak CI'da ayrı Playwright imajı (aday B), konteyner dışında.

## Kaynaklar (erişim: 2026-11-02)
1. https://registry.npmjs.org/playwright-core/latest (Apache-2.0, 1.64.1, 13,656,167 bayt)
2. https://snyk.io/advisor/npm-package/@axe-core/playwright (MPL-2.0, açık yok; önbellekli, zayıf)
3. https://github.com/microsoft/playwright-mcp (Apache-2.0, bayraklar, Docker, güvenlik notları)
4. https://registry.npmjs.org/puppeteer/latest (25.16.0, Apache-2.0)
5. https://registry.npmjs.org/chrome-devtools-mcp/latest (1.12.0, Apache-2.0, 14.282.149 bayt)
6. https://registry.npmjs.org/lighthouse/latest (13.6.0, Apache-2.0)
7. https://registry.npmjs.org/pa11y/latest (10.0.0, LGPL-3.0-only)
8. https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts (indirme hostları, linux-arm64 headless-shell yolu)
9. https://hub.docker.com/r/limesoda/playwright/tags (üçüncü taraf yansıma; boyutlar, zayıf kanıt; arama özeti)
10. https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json (156.0.8078.80 linux-arm64, storage.googleapis.com)
11. https://webdriver.io/docs/arm64-chromedriver (CfT linux-arm64 153.0.8001.0 ve sonrası)
12. https://github.com/ChromeDevTools/chrome-devtools-mcp (telemetri, CrUX, desteklenen tarayıcılar, güvenlik uyarısı)
13. https://registry.npmjs.org/playwright-core/latest (açık boyut)
14. https://playwright.dev/docs/browsers (PLAYWRIGHT_BROWSERS_PATH, DOWNLOAD_HOST, --with-deps, --only-shell, ~281 MB Chromium örneği, proxy)
15. https://playwright.dev/docs/browsers (aynı sayfa, chromium-headless-shell bölümü)
16. https://registry.npmjs.org/@playwright/mcp/latest (0.0.84, alfa Playwright bağımlılığı, 94.287 bayt)
17. https://registry.npmjs.org/puppeteer/latest (bağımlılıklar, Node >=22.12.0)
18. https://registry.npmjs.org/lighthouse/latest (19.351.495 bayt, Node >=22.19)
19. https://playwright.dev/docs/docker (imaj adı, Ubuntu tabanları, pwuser, seccomp, --ipc=host, --init)
20. https://github.com/microsoft/playwright/releases (v1.64.1, v1.64.0 Chromium 156.0.8078.4, v1.63.0)
21. https://github.com/microsoft/playwright/security/advisories (yayımlanmış danışmanlık yok)
22. https://pptr.dev/supported-browsers (Puppeteer 25.16.0, Chrome for Testing 156.0.8078.47)
23. https://github.com/puppeteer/puppeteer/security/advisories (yayımlanmış danışmanlık yok)
24. https://registry.npmjs.org/@axe-core/playwright/latest (4.14.0, MPL-2.0, 47.795 bayt)
25. https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md (araç listesi, lighthouse_audit, dosya yazan araçlar)
26. https://github.com/anthropics/claude-code/issues/15583 (cdn.playwright.dev ve Microsoft aynası allowlist dışında 403; başka ortam, dolaylı kanıt)
27. https://playwright.dev/docs/emulation (colorScheme, viewport, deviceScaleFactor)
28. https://github.com/microsoft/playwright/issues/33566 (headless shell ve yeni headless farkları)
29. https://omgubuntu.co.uk/2026/07/chrome-arm64-linux-available (tek kaynak, zayıf)
Yerel kaynaklar: /Users/goktugoktay/Desktop/ClaudeAgencyV2/harness/docker/Dockerfile, /Users/goktugoktay/Desktop/ClaudeAgencyV2/harness/bin/proxy-up.sh, /Users/goktugoktay/Desktop/ClaudeAgencyV2/harness/bin/company-run.sh
