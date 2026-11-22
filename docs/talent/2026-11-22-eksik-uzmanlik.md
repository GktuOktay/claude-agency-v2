# Eksik uzmanlık raporu (bağımsız ön inceleme)

Tarih: 2026-11-22 | Kapsam: 18 birim (`.claude/agents/`), 21 playbook (`.claude/skills/`), `routing.md` | Veri: **insufficient data** (n=0 tarama; bu yığınlar için bitmiş iş ve scorecard yok)

Yöntem: Önce birimler, playbook başlıkları ve yönlendirme okundu; yaşam döngüsü boşlukları kanıtla çıkarıldı. Sonra `KARARLAR.md` "Revizyon 49" okundu ve karşılaştırıldı. `footprint.js` çalıştırılamadı (Bash yok); token ölçüsü yerine satır sayısı kullanıldı.

## 1. Yaşam döngüsü boşlukları (mevcut durum)

| Aşama | Durum | Kanıt (dosya:satır) |
|---|---|---|
| Fikir / pazar | present | `routing.md` L7: `product-manager` + `scout` |
| Tasarım (mimari) | present | `software-architect`, `architecture-review`, `software-architecture` |
| Tasarım (UX/ekran/akış) | partial | `react-engineering` L9: "You do not change the design decision"; `business-analysis` L20 mobil için "outcomes" sorusu soruyor ama sahip birim yok |
| Spec | present | `business-analyst`, `spec-critic` |
| Yapım: .NET, React | present | `dotnet-engineer`, `react-engineer` |
| Yapım: RN/Expo, Swift, Flutter | missing | `routing.md` L10 "other stack" yalnız Django/Vue/PHP/Java/Go; `polyglot-engineer` açıklaması (agents L3) bu üçünü içermez |
| Yapım: AI özellik | partial | `react-engineering` L28 yalnız "External LLM output" doğrulama; AI entegrasyon/değerlendirme playbook'u yok |
| Veri modeli | partial | `software-architecture` §7-8 (genel); veri tasarımı kılavuzu yok |
| Test | partial | `qa-verification` var; cihaz/emülatör, mobil E2E yok (mobil terim aramasında `qa` dosyasında eşleşme yok) |
| Güvenlik | partial | `application-security` L14, L21 web/sunucu bağlamı; mobil depolama, token saklama, deep link yok (mobil terim aramasında eşleşme yok) |
| Yayın (sunucu) | present | `devops-sre` L21 deploy paketi, rollback zorunlu (agents L14) |
| Yayın (mağaza) | missing (kısmi kontrol var) | `quality-compliance` L23 yalnız kural kontrolü (privacy label, hesap silme); gönderim, imzalama, TestFlight/Play test izi yok |
| Mağaza metni | present | `marketing` (agents L3), `marketing-brand` |
| Operasyon: sunucu | present | `devops-sre` L24 izleme, L25 olay kılavuzu |
| Operasyon: mobil çökme/telemetri | missing | `devops-sre` L24 yalnız dışarıdan erişilebilirlik, hata oranı; mobil çökme raporu yok |
| Geri bildirim | present | `product-management` L26 |
| Ödeme | missing (bilinçli ertelendi) | `appsec` L38: ödeme için insan uzmanı gerekir; `KARARLAR` Rev. 49 `payments-billing` ertelendi |
| Yerelleştirme (TR/EN) | missing | `react-engineering` L21 "localized message" diyor; i18n mühendisliği (anahtar, çoğul) sahibi yok |

Mobil terimleri (`expo|react native|flutter|swift|app store|play store|testflight|mobile`) `.claude/` altında yalnız `quality-compliance` L23 ve `business-analysis` L20 ile geçiyor (`marketing` ve `routing` dışında). Mobil uzmanlık yok.

## 2. Proposal (Revizyon 49) ile karşılaştırma

### (a) Proposal'ın kaçırdığı boşluklar

| Boşluk | Neden önemli | Kanıt | Öneri |
|---|---|---|---|
| Mobil sürüm geri alınamazlığı (mağaza sürümü geri çekilemez; eski istemci API'yi kullanır) | `devops-sre` L14 "rollback planı olmayan paket teslim edilmez" kuralı mobilde işlemez | agents `devops-sre` L14 | `store-release` içine API sürümleme ve eski istemci kuralı |
| Mobil çökme ve telemetri | Mağazadan sonra hata görünmez | `devops-sre` L24 yalnız sunucu | `mobile-common` içine; gizlilik için `quality-office` ile bağ |
| Mobil erişilebilirlik (VoiceOver, TalkBack) | `react-engineering` L29 yalnız web WCAG | `react-engineering` L29 | `mobile-common` |
| i18n mühendisliği (anahtar, çoğul, RTL-hazır) | `ux-writer` metin yazar, kod tarafını yazmaz | `react-engineering` L21 | `mobile-common` ve web için ortak kılavuz |
| AI değerlendirme (eval) ve istek başına maliyet | AI üründe regresyon ve token maliyeti izlenmeli | `react-engineering` L28 yalnız çıktı doğrulama | `ai-integration` kapsamına eklenmeli |
| Mağaza incelemesine cevap (dış mesaj) | Dış mesaj zarf işidir; sahibi yok | `routing.md` L23 zarf listesi | `marketing`'e tanımlı, CEO onaylı akış |
| Mobil güvenlik (token saklama, sertifika sabitleme, deep link) | `appsec` mobil bağlam içermiyor | `appsec` playbook bağlamında mobil yok (grep) | `appsec`'e mobil bölüm (kılavuz) |

### (b) Gereksiz veya çakışan öneriler

| Öneri | Değerlendirme | Kanıt | Karar önerisi |
|---|---|---|---|
| `ux-writer` (birim) | `marketing-brand` L22 zaten "in-product copy" ve hata metnini kapsıyor. Çakışma kısmi. TR/EN hacmi bilinmiyor. | `marketing-brand` L22; `marketing` agents L3 | Birim değil, `marketing-brand` içinde bölüm olarak başlasın. Hacim kanıtlanınca ayrılsın. Veri: insufficient data. |
| `data-design` (kılavuz) | `software-architecture` §7-8 ile örtüşüyor | `software-architecture` L24-25 | Kılavuz kalsın, yalnız veri modeli iş dokununca yüklensin |
| `ai-integration` (kılavuz) | `react-engineering` L28 ile kısmi örtüşme (çıktı doğrulama) | `react-engineering` L28 | Örtüşme metne atıf olsun, tekrar yazılmasın |
| `store-release` (kılavuz) | `quality-compliance` L23 ile rol ayrımı var (kural kontrolü vs gönderim) | `quality-compliance` L23 | Uygun; iki dosyanın sınırı açıkça yazılsın |
| `mobile-common` | `react-engineering` ile kısmi (durumlar, doğrulama) | `react-engineering` L9, L21, L29 | Yalnız mobile özgü kısım |
| `product-designer` | Boşluk gerçek (tasarım sahibi yok) | `react-engineering` L9 | Uygun |
| `rn-engineer`, `swift-engineer`, `flutter-engineer` | Boşluk gerçek; CEO kararı | `routing.md` L10 | Uygun; her biri deneme sonrası |

### (c) Token maliyeti (satır sayısı; `footprint.js` çalışmadı, bayt/token verisi yok)

| Birim/playbook | Satır | Ne zaman yüklenir | Not |
|---|---|---|---|
| `polyglot-engineering` | 87 | Yalnız diğer yığın işinde | Ağır; yeni birimler bunu örnek almasın |
| `devops-sre` | 79 | Her yayın ve CI işinde | Zaten en ağır; `store-release` ayrı kılavuz olmalı, buraya gömülmemeli |
| `software-architecture` | 74 | Tasarımda | Veri kılavuzu ile örtüşme |
| `scouting` | 69 | Çözüm aramada | Mobil kıyas için ek yük |
| `react-engineering` | 67 | Her web/React işinde | Mobil bölüm buraya eklenmesin |
| `application-security` | 67 | Lane 2+ ve auth/girdi işinde | Mobil bölüm kılavuz olsun |
| `qa-verification` | 48 | Lane 1 dahil her doğrulamada (sık) | Mobil cihaz testi kılavuzda olsun |
| `quality-compliance` | 57 | Lane 2+ | Sık değil, uygun |
| Birimler (agents) | 12-14 satır her biri | Her çağrıda | Düşük; asıl maliyet playbook |

Sık yüklenecek eklemeler: `qa-engineer`, `appsec`, `quality-office` (her lane'de). Bu üçüne mobil içerik gömülürse her çağrı pahalanır. Mobil ve AI içerik ayrı kılavuzda, yalnız iş dokununca yüklenmeli (Revizyon 49 bu ilkeyi zaten yazıyor).

Nadir yüklenecek: `payments-billing` (ertelendi), `data-design`, `ai-integration`, `product-designer` (istek üzerine).

Sık yüklenecek (mobil iş başına): `rn-engineer` + `mobile-common` + `store-release` (üç dosya, yayın işinde).

## 3. Öneriler (en fazla 5, sıralı)

1. **`store-release` kılavuzuna mobil sürüm kuralı ekle:** API sürümleme, eski istemci desteği, geri alınamaz sürüm için rollback yerine "önceki sürümle uyum" planı. Kanıt: `devops-sre` L14, mağaza sürümü geri çekilemez. Etki: rollback planı mobilde de anlamlı kalır, teslim eksik çıkmaz. Veri: insufficient data (mobil yayın geçmişi yok).
2. **`ux-writer`'ı birim olarak açmadan önce `marketing-brand` L22'yi genişlet:** kanıt `marketing-brand` L22 ve `marketing` L3 çakışması. Etki: bir birim daha az, yaklaşık bir birim-yükleme maliyeti tasarrufu. TR/EN hacmi kanıtlanana kadar birim açılmasın.
3. **`mobile-common` içine şunları koy:** çökme/telemetri, mobil erişilebilirlik, i18n mühendisliği. Kanıt: `devops-sre` L24 yalnız sunucu; `react-engineering` L29 yalnız web. Etki: üç boşluk tek kılavuzda kapanır, yeni birim gerekmez.
4. **Ana playbook'lara (`qa-verification`, `application-security`, `quality-compliance`) mobil içerik ekleme; yalnız bir satırlık işaretçi ekle:** kanıt: bu üçü her lane'de yüklenir. Etki: her çağrıda token tasarrufu; mobil içerik yalnız mobil işte yüklenir.
5. **`ai-integration` kılavuzuna eval regresyonu ve istek başına maliyet izleme ekle:** kanıt: `react-engineering` L28 yalnız çıktı doğrulama. Etki: AI özellikli ürünlerde kalite ve maliyet görünür olur. Veri: insufficient data (AI iş geçmişi yok).

## 4. Yorum notları (kural 6, itiraz yok)

- Revizyon 49 "üç yığın" ve "yetenekler kılavuzda" ilkesi token açısından doğru. Tek itirazım `ux-writer` birimi (öneri 2).
- Proposal'da `mobile-common` ile `react-engineer` arasında dosya sınırı yazılmamış. Sınır olmazsa iki kılavuz aynı konuyu tekrarlar.

## Not doğrulanmadı / insufficient data

- Token sayıları: `footprint.js` çalıştırılamadı; yalnız satır sayısı var. Bayt ve token maliyeti yok.
- Scorecard: mobil, AI, ödeme yığınları için bitmiş iş yok (n=0). Trend ya da darboğaz iddiası yok.
- Mobil ana makine denemesi (`mobil-deneme-rn-expo`) bu oturumda okunmadı; yalnız `KARARLAR.md` Rev. 49 özeti kullanıldı.
- Mağaza kuralları ve Apple/Google güncel gereksinimleri doğrulanmadı (web aracı yok; kaynak Scout'tan gelmeli).
- Hiçbir birim, kılavuz, kural veya playbook değiştirilmedi. Yalnız bu dosya yazıldı.
