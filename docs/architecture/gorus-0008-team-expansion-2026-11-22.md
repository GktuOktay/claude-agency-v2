# Mimari görüş: spec 0008 ekip genişletme | Tarih: 2026-11-22 | Karar: CONDITIONAL APPROVE (K1-K7)

Kapsam: `specs/draft/0008-team-expansion.md`, önceki görüş `gorus-mobil-rn-expo-2026-11-21.md` (C1-C5), `docs/KARARLAR.md` Revizyon 49, `docs/architecture/tasarim/0004-host-enforcement.md`, `harness/bin/{lint,footprint,check}`, `harness/guard.js`, Scout 0002/0003. Web ve Bash yok; doğrulayamadığım şey "doğrulanmadı". Spec ve STACK.md değiştirilmedi.

## 1. Kararlar ve değerlendirme
| # | Karar | Gerekçe var mı | Alternatif | Risk | Sonuç |
|---|---|---|---|---|---|
| 1 | Yığın başına kod birimi (`rn-/swift-/flutter-engineer`) + isteğe bağlı kılavuzlar (§6.1 A) | Evet, tablo var | B tek `mobile-engineer`; C dikey birimler; "ekleme" yok | Düşük; git ile geri alınır | Onay |
| 2 | `product-designer`, `ux-writer` kod dışı birimler | Evet | `marketing-brand` bölümü (talent-capacity) | Düşük | Onay |
| 3 | 5 yeni kılavuz P1'de, 3'ü P4'te tembel | Evet (A-01 uygulanmış) | hepsi şimdi | Yeni kılavuz = her sohbette bir açıklama satırı | Onay |
| 4 | STACK satırları: RN+Expo dene; Flutter, Swift değerlendir | Kısmen (K4) | - | Birim açmak "benimse" sayılmasın | Koşullu |
| 5 | Kanıt bölünmesi konteyner/ana makine (§6.4) | Evet, RN için | - | Swift/Flutter için eksik (K6) | Koşullu |
| 6 | `store-release`: hazırlar, göndermez | Evet | birim yok | Saklama ve dolaşma yolları (K3) | Koşullu |
| 7 | 0004'e bağlı sıralama, 4 aşama | Evet | - | 0004 tablosu ve `Unlocks:` (K1, K2) | Koşullu |
| 8 | Token kapları (§6.6) | Evet | - | Çoğu `check`'te zorlanmıyor (K7) | Koşullu |

## 2. Cevaplar

**Soru 1, yapı: sağlam.** Üç yığın birimi + isteğe bağlı kılavuz mevcut desenle (`dotnet-/react-/polyglot-engineer`) aynı; seçim A doğru. Dikkat:
- Seçenek B'nin ret gerekçesi yanlış kurulmuş: "isteğe bağlı Read lint'i bozar ve atlanması kolay" diyor, oysa seçilen A `mobile-common`, `store-release`, `data-design`, `ai-integration` için aynı Read yolunu kullanıyor ve R-3 lint'i zaten düzeltiyor. Doğru gerekçeler: yığın başına "Never" listeleri ve ana makine ön koşulları farklı (`flutter` komutu CEO onayından önce yasak, CocoaPods, `EXPO_PUBLIC_*`), aşamalar ayrı ayrı gelir, B'de üç kılavuz önyüklenirse ~7,5k. Spec metni düzeltilsin (sonuç değişmez).
- Kılavuz olması gereken birim yok. Tersi yok. `ux-writer` kılavuza en yakın olan (talent-capacity); CEO kuralı "çıktısı kod değil" buna izin veriyor, bedeli bir açıklama satırı. Kabul; scorecard ile yeniden bak (Q3 önerisine katılırım).
- `store-release` P1'de, ama ilk mağaza işine kadar kriteri yok ve denemede hiç sınanmadı (deneme mağaza, hesap, cihaz imzasını dışarıda bıraktı). CEO açıkça istedi; kalsın, başlığında "doğrulanmadı: mağaza işi koşulmadı" yazsın (K3).

**Soru 2, yığınlar ve C1-C5.** Satırlar tutarlı: RN+Expo dene, Flutter ve Swift değerlendir, "birim benimse yapmaz" (REQ-15). Taşınan: C1 (REQ-14, AC-21), C4 (REQ-19, "Never" listesi), C5 kısmen (§8, AC-18). **Taşınmayan veya zayıf:**
- C2 ikinci yarısı: "benimse" ölçütü hiçbir yerde yazılı değil (deneme listesi kanıtla kapanır + Scout boşlukları + ADR). REQ-15 yalnız "değişmez" diyor; Swift/Flutter için "deneme geçti" tanımsız, AC-21 yalnız `xcodebuild test` ister (K4).
- C3: spec §2 yalnız Scout 0002'yi anıyor; 0003 (alternatifler) var, atıf yok. Scout 0003: Swift lisansı "bulunamadı" (resmi sayfa 403).
- C5: "ilk mobil spec'te appsec" yazılmış; Swift Keychain ve Flutter güvenli depolama RN'den farklı, her yığının ilk spec'inde appsec şart olmalı (K5). MASVS dosyası (AC-18) yalnız RN'e değil yığından bağımsız yazılsın.
- Önceki görüşteki test yığını satırı (Jest + jest-expo, RNTL, Maestro: dene) spec'in STACK satırlarında yok (K4). Deneme spec'i (`mobil-deneme-rn-expo/specs/active/0001-rn-expo-trial.md`) var; CEO imzası kayıt dışı, "dene" satırı ona atıf yapmalı (doğrulanmadı).
- C2'nin ilk yarısı ("açma") Revizyon 49 ile CEO tarafından kaldırıldı; geçerli.

**Soru 3, kanıt ve `store-release`: RN için doğru, Swift/Flutter için eksik (K6); imzalama sınırı eksik (K3).**
- RN tablosu önceki görüşün §3(3) maddesini tam taşıyor (sürüm yapılandırması, kimlik, adlandırılmış cihaz, kanıt-dışı Expo Go).
- Swift: SwiftUI/Xcode testleri Linux'ta koşmaz. Flutter: SDK ajan imajında yok; eklemek Dockerfile değişikliği (lint: sabit sürüm), board+CEO ister. "Koşulabildiği yerde" belirsiz; Swift/Flutter'de konteyner kanıtı fiilen yok, `check` bu yığınları kapılamaz, GitHub macOS runner para (zarf).
- Ana makinede Bash'li ajan: 0004 tasarımı (satır 9) "Bash'li ajan korumayı aşmaya çalışırsa durdurmaz" diyor. Derleme betikleri (Gradle, CocoaPods, Xcode build phase, npm) kullanıcı yetkisiyle koşar; imzalama kimlikleri oturum anahtarlığındaysa kullanılabilir. "Sırlar repoda yok" yetmez; saklama yeri ve ajanın erişemeyişi yazılmalı.
- Gönderme yolları: `guard.js:56-57` `fastlane/altool/notarytool/transporter/eas` içeriyor; Gradle yayın eklentisi, `bundletool`, Play API çağrıları yok (Q4 doğru). Ek olarak (bilgimden, doğrulanmadı): `xcodebuild -exportArchive` ExportOptions'ta `destination=upload` yüklemeyi build aracı içinden yapar; `-allowProvisioningUpdates` Apple hesabında sertifika/profil oluşturabilir. İkisi de guard'a takılmaz.
- Q4'ün "tarama yalnız özel anahtar bloğu" ifadesi kısmen yanlış: `check:17` deseni `BEGIN (RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY` içeriyor, yani `.p8` ve servis hesabı JSON'u (private_key alanı) yakalanır; ama `grep -I` ikilileri atlar, `.jks/.p12/.mobileprovision` yakalanmaz.
- Güncel mağaza kurallarını "resmi sayfadan yeniden oku" diyor (§11); `devops-sre`'nin web aracı yok. Sahibi Scout olmalı.

**Soru 4, sıralama ve ADR.**
- 0004 öncesi sıra CEO kararı (Rev 48); teknik bağımlılık yalnız Bash'li birimlerde (`rn-engineer`); docs-yazan birimler beklemeyebilir. Seçenek olarak CEO'ya yazılır, koşul değil.
- **Gerçek sıralama sorunu 1:** 0004 yazma alanı tablosu `policy.js`'te sabit kodlu (tasarım satır 88-105); `product-designer` ve `ux-writer` satırı yok, bilinmeyen `agent_type` "alan sınırı yok, yalnız sınıf kuralları" demek. İmzalı spec varken bu iki birim koda yazabilir; spec §8 "Write areas" satırı ve AC-16 zorlanmıyor, yalnız yönerge. `policy.js` enforcement dosyası, §13 değiştirmeyi yasaklıyor (K1). "Gelecekteki mobil birimler" satırı (`**`) rn/swift/flutter için yeterli.
- **Sorun 2:** 0004 sınıf tablosu (satır 74): `.claude/agents|skills|rules/**`, `harness/bin/**`, `evals/**` imzalı spec'in `Unlocks:` satırını ister. Spec başlığında `Unlocks:` yok; 0004 sonrası ana oturumun her yazması sorar (K2). Ana oturum yazımı R-1 ile uyumlu.
- ADR bugün gerekmez: 0008'in kararları dosya düzenidir, `git revert` ile geri alınır; veri ve sözleşme yok. ADR gerekli: (a) her yığın "benimse"de (çerçeve, derleme yolu, imza saklama, OTA kapalı); (b) her uygulamanın ilk mağaza işinde: bundle/uygulama ID sahipliği, imza anahtarı saklama, Play App Signing kararı (geri dönüşsüz, uygulama başına).

**Soru 5, token kuralları.** Ölçülebilir ve ölçüme bağlı: `footprint.js` agent+skill açıklamaları ve tüm `rules/` dosyalarını sayar (satır 22-25), harcama tahmini chars/4. P1 tahminim: 3x~43 + 5x~35 + routing ≤900 B (~225) ≈ 530 < 700; AC-6 makul, payı dar. **Zorlanamayan:**
- Boyut kapları `lint.js`'te yok: lint yalnız açıklama alt sınırı (30/40) ve `maxTurns` bakar (satır 39, 58, 61). AC-2/3 "lint valid" + elle `wc -c`; merge sonrası kap sessizce aşılır (K7).
- REQ-5/REQ-8 "yüklenmez": hiçbir ölçüm gerçek yüklemeyi görmez; yalnız AC-8 (`skills:` listesinde yok) ve brief kuralı var. Yönerge olarak yazılsın, test gibi sunulmasın.
- AC-7 (≤4k/spawn) isteğe bağlı kılavuzları kapsamaz: en kötü iş = ~4k + mobile-common (~1,5k) + data-design + ai-integration (~3k) ≈ 8,5k. PR kaydı en kötü durumu da yazsın.
- 1.100 B birim dosyasına §6.2'nin "Never" listesi sığmayabilir; liste önyüklenen kılavuza taşınsın, birim dosyasında işaretçi kalsın.

## 3. Gereksiz bulundu (kriter yok)
Yok. P4 kılavuzları (`data-design`, `ai-integration`, `graphic-design`) bugün kriter-sız, spec bunu zaten tembel tutuyor (Q1): öneriye katılırım. `payments-billing`, ayrı vertical birimler ve teklif birimi doğru çıkarılmış.

## 4. Koşullar
- **K1** `product-designer` (`docs/design/**`) ve `ux-writer` (`docs/copy/**`) satırları 0004 yazma alanı tablosuna 0004 birleşmeden eklensin (0004 sahibiyle koordinasyon, CEO onaylı enforcement dosyası), ya da §8 ve AC-16 "yalnız yönerge, bilinen boşluk" diye düzeltilsin.
- **K2** Spec başlığına `Unlocks:` satırı: `.claude/agents/**`, `.claude/skills/**`, `.claude/rules/**`, `evals/**`, `harness/bin/lint.js`, `harness/bin/site-data.js` (imza buna kapsar).
- **K3** `store-release`: (a) imza malzemesinin yeri ve ajan erişimi: ajan oturumunda yalnız debug/geçici imza; yayın imzası ve yükleme CEO adımı, ayrı anahtarlık/kasa; (b) yasaklar: ExportOptions `destination=upload`, `-allowProvisioningUpdates`, Gradle yayın eklentisi, `bundletool` yükleme, Play API; (c) Q4 guard/check sertleştirmesi ilk Play/App Store işinden önce tamam ya da o işin spec'inde "CEO elle" adımı; (d) kural sayfası yeniden okuma sahibi Scout; (e) başlıkta "doğrulanmadı". Ayrıca Q4 metnindeki tarama iddiası düzeltilsin.
- **K4** REQ-15'e "benimse = deneme listesi kanıtla + Scout 0003 boşlukları + ADR" yazılsın; §2 Scout 0003'e atıf versin; Swift/Flutter deneme asgarisi: ana makine ön koşulu başsız mı, sürüm yapılandırmasında derleme, başsız test + çıkış kodu, tedarik zinciri (SwiftPM `Package.resolved`, `pubspec.lock` sabitleme, geçişli lisans, advisory), yükseltme provası. Swift denemesi "kurulum yok" diyor: simülatör çalışma zamanı kurulu mu doğrulanmadı; indirme gerekiyorsa CEO onayı (REQ-14). STACK'e test yığını satırı (Jest+jest-expo, RNTL, Maestro: dene) ve RN satırına deneme spec'i atfı.
- **K5** `rn-engineering` önceki görüş §3(4)'ü taşısın: SDK tam sürüm sabit, yükseltme ayrı lane-2 işi (≤12 ay, tek adım), yeni yerel kütüphane ön kontrolü, `EXPO_PUBLIC_*`, OTA kapalı, üç ayda bir mağaza gereklilikleri; AC-13'e bir eval vakası. Swift/Flutter kılavuzlarında karşılığı. Her yığının ilk spec'inde `appsec`.
- **K6** Kanıt matrisi yığın başına yazılsın (P2/P3 girişi, denemeden): konteynerde ne koşar (Swift: yok/yalnız SwiftPM mantığı; Flutter: imaj değişmedikçe yok), ana makinede ne koşar, "kalan risk". "Koşulabildiği yerde" ifadesi kalksın.
- **K7** `lint.js`'e (T-2 ile) kap kontrolleri: yeni birim ≤1.100 B, açıklama ≤170, kılavuz kapları; ya da `footprint.js --check`. REQ-5/8 ifadesi "önyüklenmez + brief kuralı"na çevrilsin; PR kaydı en kötü iş maliyetini yazsın.

## 5. STACK.md değişikliği
Ben düzenlemedim (talimat). Kabul edilen satırlar (T-11 ekler): RN+Expo "dene" (atıf: deneme spec'i, görüş, Scout 0002/0003; benimse'de ADR); Flutter "değerlendir"; Swift "değerlendir"; test yığını (Jest+jest-expo, RNTL, Maestro) "dene" (K4). Yeni teknoloji CEO'ya gösterilir: yığınları CEO seçti (Rev 49), satırlar bilgi içindir, "benimse" ayrı karardır.

## 6. Cevapsız / doğrulanmadı
- Deneme spec'inin CEO imzası; `RAPOR.md` deneme dizininde bulunamadı (T-6'nın girdisi).
- Swift simülatör çalışma zamanı kurulu mu.
- ExportOptions `destination=upload` ve `-allowProvisioningUpdates` davranışı bilgimden; Scout/appsec doğrulasın.
- Token sayıları chars/4 tahmini; gerçek ölçüm AC-6/7 ile.

## 7. 2. tur (revize spec 0008, 2026-11-22) | Karar: APPROVE (aşağıdaki 3 küçük düzeltme imzadan önce işlenirse; bloklayıcı değil)
| Koşul | Durum | Kanıt (spec satırı) |
|---|---|---|
| K1 yazma alanı satırları | Karşılandı (ikinci yol) | 207 (D2 içeriği), 249 ve 351 (R-10): "yalnız yönerge, bilinen boşluk" açık yazılı; AC-2/12 gövdede alan adı ister |
| K2 `Unlocks:` | Karşılandı | 8: agents, skills, routing, evals, lint.js, site-data.js, site, STACK; satır 74 tablosundaki tüm 0008 yolları kapsıyor |
| K3 imza ve gönderme | Karşılandı, küçük boşluk | REQ-7/8/26 (30-31, 49), AC-16 (75), D2 (207), Q4 düzeltmesi (207, 247). Boşluk: `-allowProvisioningUpdates` (hesapta sertifika/profil açar) hiçbir listede adıyla yok |
| K4 benimse, Scout 0003, deneme asgarisi | Kısmen | 41, 214-220, 21 tamam. Eksik: yükseltme provası ve başsız ön koşul/simülatör çalışma zamanı denetimi asgari listede yok (219, 82); satır 200 hâlâ "yalnız Xcode yeter"; RN satırı deneme spec'ine atıf vermiyor (80) |
| K5 SDK kuralları, appsec/yığın | Kısmen | RN tamam: 48, 179, 47, 76. Swift/Flutter'de SDK kuralı karşılığı (Xcode/Swift sürüm sabiti, Flutter kanalı sabiti) AC-22'de (82) istenmiyor; MASVS dosyası (78) yığından bağımsız yazılsın demiyor |
| K6 yığın başına kanıt | Karşılandı | 158-166, 82, REQ-16 (39) |
| K7 token kapları | Kısmen (kabul) | Kaplar `wc -c` ile, lint'te değil: R-12 (353), 60. Bilinçli sapma; kalan risk: birleşme sonrası kap sessizce aşılır. REQ-5 (28) yönerge olarak dürüst yazılmış, en kötü iş AC-7'de (64), taban ölçümleri 181 |

Yeni mimari sorunlar:
1. **Boşluk penceresi (gerçek):** Swift/Flutter durdurma satırı 1b'de geliyor (211, REQ-1 satır 24), 1b ise D2 bekliyor (43). 1a ile 1b arasında (D2 uzun sürebilir, ayrı spec, sahibi/tarihi yok) RN, Swift ve Flutter işi mevcut "başka yığın" satırıyla `polyglot-engineer`'a gider; REQ-1'in yasakladığı şey tam bu. Düzeltme: durdurma satırı 1a yönlendirme metnine taşınsın (AC-9 bayt payı var: 1.424 B ölçüldü, 1.700 kap).
2. **REQ-7 mutlak ifade:** "bir birimin erişiminde asla" (30). 0004 tasarımı satır 9 ve 11 ana makine kontrolleri için mutlak ifadeyi yasaklıyor (Bash'li ajan korumayı atlayabilir); ayrı anahtarlık CEO'nun kurulumudur, hiçbir AC doğrulamıyor. Düzeltme: ifade "oturum içinde kullanılamaz kılınır, kontroller kazayı durdurur" biçimine yumuşasın; ilk mağaza ADR'sinde (218) saklama yeri ve oturum kilidi kanıtı istensin.
3. **1a'da sarkan başvuru:** `product-designer` isteğe bağlı `mobile-common` (141) ve `graphic-design` (153) yükler; ikisi 1a'da yok (1b, 4). REQ-21 "dosya tetikten önce yok" ile çakışır. Birim gövdesi bu adları 1b/4 gelene kadar anmasın.
Sorun olmayanlar: (a) D2'nin 2 ve 3'ü de kapılaması doğru (Bash'li birimler, 43, 200-201); tek yan etki 1b'nin ilk gerçek mobil işi geciktirmesi, bu CEO kararı (R-3) ve spec'te yazılı. (b) 1a'da hafif zincir (198) kabul: Bash yok, ana makine derlemesi yok, trust sınırı yok. Tek istisna `lint.js` düzenlemesi: ek (additive) ve AC-11 sondalı; 18 mevcut "Playbook:" skill (hepsi birimlerin ilk skill'i, eval zorunluydu) etkilenmez, `check` yeşil kalır (ben saydım). Yine de QA'nın sondası zincirde yazılı kalsın; ayrı appsec şart değil. (c) Evre sayıları (20/23, 21/26, 22/27, 23/28, 23/31) tutarlı. (d) AC-6 1a payı: 2 açıklama (~86) + 2 skill (~70) + 1a yönlendirme payı (<~150) ≈ 300 < 500.
Son karar: APPROVE. İmza öncesi işlenecekler: sorun 1 (durdurma satırı 1a'ya), sorun 2 (REQ-7 ifadesi), sorun 3 (gövde başvuruları), K3 `-allowProvisioningUpdates` ve K4/K5 eksikleri D2 ve deneme spec'lerine girdi olarak yazılması yeterli. STACK.md satırları değişmedi (T-17, AC-21 ile uyumlu); yeni teknoloji CEO'ya gösterildi (Rev 49).
