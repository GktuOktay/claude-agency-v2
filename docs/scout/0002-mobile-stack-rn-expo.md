# Scout raporu: mobil yığın (React Native + Expo) | Tarih: 2026-11-21 | İsteyen: Mimari kurul / `mobile-engineer` birimi

Erişim tarihi: aksi belirtilmedikçe tüm kaynaklar 2026-11-21'de okundu. Hiçbir şey kurulmadı veya çalıştırılmadı. Sayfalarda talimat bulunmadı ("page contains instructions" yok). Bazı WebFetch özetleri araç tarafından kısaltıldı; ilgili yerde belirtildi.

## Ölçütler
1. Yerel CLI ile iOS + Android derleme, ücretli servis zorunluluğu yok (ajan macOS ana makinede, IDE düğmesine basamaz).
2. Başsız (headless) test: birim, bileşen, E2E simülatör/emülatörde CLI ile.
3. Ticari kullanıma izin veren lisans (MIT/Apache gibi).
4. Mevcut yığınla örtüşme (TypeScript, React) ve .NET API ile tip paylaşımı.
5. Tek kişilik bakım yükü ve mağaza uyumu (Apple/Google gereklilikleri).
6. Her ücretli adım tek tek CEO onayına uygun (harici servis ücretsiz katmanda kalabilmeli).

## 1. Sürümler ve destek durumu
| Konu | Bulgu | Kaynak |
|---|---|---|
| Güncel Expo SDK | SDK 58.0.0; RN 0.88, React 19.3.0, Node 22.13+, Xcode 26.4+, iOS 16.4+, Android 7+ (compileSdk 37, targetSdk 36) | https://docs.expo.dev/versions/latest/ |
| SDK 58 tarihi | 15 Eki 2026 (beta 15 Eyl 2026); SDK 57: 30 Haz 2026; SDK 56: 21 May 2026 | https://expo.dev/changelog |
| Node (SDK 58) | 22.13+ (22 hattı), 24.3+ (24 hattı), 26+; tek sayılı sürümler (23, 25) desteklenmez | https://expo.dev/changelog/sdk-58 |
| Güncel RN | 0.88 stabil; 0.77-0.87 için doküman var; 0.60-0.76 desteksiz arşiv | https://reactnative.dev/versions |
| RN destek politikası | Son sürüm + önceki iki minor korunur; sabit süre (ay/yıl) verilmemiş | https://github.com/reactwg/react-native-releases/blob/main/docs/support.md |
| RN yayın ritmi | Yılda 6 sürüm, hedef: kırıcı değişiklik yok | https://docs.expo.dev/versions/latest/ |
| New Architecture | RN 0.76'dan beri varsayılan; RN 0.82 eski mimariyi kapatılamaz yaptı; Expo SDK 55+ (RN 0.83) her zaman açık, kapatılamaz; SDK 54 kapatılabilen son sürüm | https://reactnative.dev/docs/the-new-architecture/landing-page ; https://reactnative.dev/blog/2025/10/08/react-native-0.82 ; https://docs.expo.dev/guides/new-architecture/ |
| Expo SDK ömrü | "yaklaşık bir yıl"; SDK 54 (Eyl 2025) bir sonraki SDK'ya kadar yalnız kritik düzeltme alır; politika yeniden gözden geçirilebilir | https://expo.dev/changelog/sdk-57 |
| Expo yayın ritmi | Geçmişte yılda 3 SDK; SDK 57'de araya kırıcı olmayan ara sürüm "deneniyor" (kesin değil) | https://expo.dev/changelog/sdk-57 |
| SDK başına RN | Her SDK tek bir RN sürümünü hedefler | https://docs.expo.dev/versions/latest/ |
| Resmi SDK sona erme tarihi tablosu | bulunamadı | (3 arama) |

## 2. Ücretsiz/yerel derleme ve EAS maliyeti
- `expo run:ios` / `expo run:android`: yerel Xcode / Android SDK ile derler, yoksa `prebuild` çalıştırır. Sayfa Expo hesabından söz etmiyor (hesap gereksinimi "bulunamadı", yani yok denemez; doğrulama için deneme öneriliyor). Kaynak: https://docs.expo.dev/guides/local-app-development/
- `eas build --local`: Expo hesabı GEREKLİ (`eas login` veya `EXPO_TOKEN`); sunucular yalnız proje `@account/slug` doğrulaması ve yönetilen kimlik bilgisi indirme için kullanılır. Tek platform, önbellek yok, "Secret" görünürlüklü env desteklenmez, iOS için fastlane + CocoaPods, Android için SDK + NDK gerekir; macOS ve Linux destekli. Kaynak: https://docs.expo.dev/build-reference/local-builds/
- Saf `xcodebuild` / Gradle: prebuild sonrası üretilen `ios/` ve `android/` klasörleriyle mümkün (kaynak: yukarıdaki local-app-development sayfası, prebuild üretimi). Doğrudan `xcodebuild` komutu için ayrı kaynak: bulunamadı.
- EAS fiyatları (https://expo.dev/pricing): Free $0 (15 Android + 15 iOS build/ay, 45 dk zaman aşımı, düşük öncelikli kuyruk, 1.000 güncelleme MAU, macOS eşzamanlılık 1); Starter $19 + kullanım ($45 kredi, 3.000 MAU); Production $199 + kullanım ($225 kredi, 50.000 MAU). Aşım: iOS medium $2 / large $4, Android medium $1 / large $2 build başına; Free planda güncelleme aşım ücreti yok. Submit (App Store / Play) tüm planlarda dahil.
- Hesap/bulut gerektiren kesin liste: `eas build` (bulut), `eas build --local` (oturum), EAS Update (barındırma), EAS Submit. Zorunlu olmayan: Expo Updates için özel sunucu (protokol uygulanırsa EAS hesabı gerekmiyor, https://docs.expo.dev/versions/latest/sdk/updates/).
- Expo Go: SDK 58'de projeyi Expo Go'da çalıştırmak için giriş zorunlu (3 Eyl 2026 duyurusu; ayrıntı okunmadı, başlık düzeyinde, https://expo.dev/changelog). Yeni Expo Go yalnız SDK 58'i destekler. Ajan için development build / simülatör yolu önerilir.
- Apple Developer Program ve Google Play kayıt ücretleri: bulunamadı (bu oturumda doğrulanmadı). Mağaza gönderimi zaten CEO onayında.

## 3. Test (başsız)
| Araç | CLI / simülatör | Bakım | Lisans | Kaynak |
|---|---|---|---|---|
| Jest + jest-expo | Node içinde, cihaz gerekmez; SDK 58+ Jest 30 ister | Expo resmi önerisi | MIT (jest-expo için lisans ayrıca okunmadı: bulunamadı) | https://docs.expo.dev/develop/unit-testing/ |
| React Native Testing Library | Jest ile; `react-test-renderer` yerine (React 19 desteklemiyor) | Son sürüm tarihi bulunamadı; v14 React 18'i bırakıyor | MIT | https://github.com/callstack/react-native-testing-library |
| Maestro | CLI; Android emülatör + iOS simülatör; fiziksel iOS cihaz yok; Java 17+; v2.6.0 25 May 2026 | Aktif (zayıf kanıt: 3. taraf özet); Expo'nun tercih ettiği E2E | Apache-2.0 | https://github.com/mobile-dev-inc/Maestro ; https://maestro.dev/blog/maestro-cli-v2-6-0 (arama özeti) ; https://docs.expo.dev/develop/unit-testing/ |
| Detox | iOS simülatör + Android emülatör; resmi RN 0.77-0.84 + New Arch; iOS gerçek cihaz yok | 20.47-20.50 Oca-Mar 2026 (zayıf: 3. taraf blog); RN 0.88 desteği bulunamadı | MIT | https://github.com/wix/Detox |
- Maestro iOS için idb-companion/Xcode gerektiği tek bir 3. taraf öğreticiden (zayıf kanıt). Maestro Cloud ücretli ayrı üründür; CLI'dan bağımsız (zayıf kanıt).

## 4. Kod paylaşımı (web + .NET)
- Gerçekçi paylaşım: TypeScript tipleri, doğrulama şemaları, API istemcisi, iş kuralı fonksiyonları (monorepo paketi). Paylaşılmayan: UI (RN bileşenleri React DOM değil; `react-native-web` 0.21.0 SDK 58 ile gelir ama bu ayrı bir karardır). Kaynak: https://docs.expo.dev/versions/latest/ (react-native-web sürümü). "UI paylaşılmaz" yargısı bu raporun çıkarımıdır, tek kaynakla doğrulanmadı.
- OpenAPI'den tip üretimi: openapi-typescript (MIT, OpenAPI 3 -> TS tipleri; openapi-fetch istemcisi), 8,4k yıldız ama yıldız bakım kanıtı değil; commit 1.679, açık issue 210, changeset + renovate var. Son sürüm tarihi bulunamadı. Kaynak: https://github.com/openapi-ts/openapi-typescript
- .NET tarafında OpenAPI üretimi (Swashbuckle / yerleşik): bu oturumda bakılmadı, bulunamadı.

## 5. Mağaza kuralları ve uyum
- OTA: Apple 2.5.2 indirilen/yürütülen kodun uygulama özelliklerini değiştirmesini yasaklar (metin JavaScript'ten adıyla söz etmiyor); yorum gerektirir. Kaynak: https://developer.apple.com/app-store/review/guidelines/ (sayfanın son 14k karakteri okunmadı). EAS Update yalnız JS/stil/görsel gibi native olmayan parçaları günceller; native kod, izinler, SDK sürümü yeni binary ister; mağaza kurallarına uymak geliştiricinin sorumluluğu. Kaynak: https://docs.expo.dev/eas-update/introduction/. Apple/Google'ın RN OTA'sına resmi onay metni: bulunamadı. Öneri: OTA'yı yalnız hata düzeltmeyle sınırla; özellik değişikliği mağazadan.
- Gizlilik manifesti: Apple 1 May 2024'ten beri required-reason API gerekçelerini ister (3. taraf SDK dahil). Expo paketleri PrivacyInfo içerir ama bazı statik CocoaPods eksik kalabilir; `ios.privacyManifests` ile elle eklenir; eksikse Apple e-posta atar. Kaynaklar: https://developer.apple.com/news/upcoming-requirements/ ; https://docs.expo.dev/guides/apple-privacy/
- Apple derleme gereği: 28 Nis 2026'dan beri Xcode 26+ / iOS 26 SDK; 9 Eyl 2026'dan beri iOS 13+ hedef (geçti). Kaynak: https://developer.apple.com/news/upcoming-requirements/ . Expo SDK 56-58 zaten Xcode 26.4+ ister.
- Google Play: 31 Ağu 2026'dan beri yeni uygulama/güncellemeler Android 16 (API 36) hedeflemeli; uzatma talebi 1 Kas 2026'ya kadar (geçti). Kaynak: https://developer.android.com/google/play/requirements/target-sdk . SDK 58 targetSdk 36; bir sonraki yıl için gelecek API 37 tarihi: bulunamadı, sdk'yi yılda en az bir kez yükseltmek gerekir (çıkarım).

## 6. Lisanslar
- React Native: MIT (Meta) — https://github.com/facebook/react-native/blob/main/LICENSE
- Expo: MIT (650 Industries) — https://github.com/expo/expo/blob/main/LICENSE
- Hermes: MIT (Meta) — https://github.com/facebook/hermes/blob/main/LICENSE
- Maestro: Apache-2.0; Detox: MIT; RNTL: MIT; openapi-typescript: MIT (yukarıdaki bağlantılar). Jest / jest-expo lisansı okunmadı: bulunamadı.
- EAS servisi barındırılan ücretli üründür; açık kaynak lisansı bu hizmeti kapsamaz.

## 7. Karşılaştırma
| Boyut | RN + Expo | Flutter (kısa) | Native Swift + Kotlin (kısa) |
|---|---|---|---|
| Dil örtüşmesi | TS/React: yüksek (web ile) | Dart: yok | Swift + Kotlin: yok (iki kod tabanı) |
| Yerel CLI derleme | Evet: prebuild/run/Gradle/xcodebuild; `eas build --local` hesap ister | Flutter 3.47 (12 Ağu 2026) resmi; `flutter build` komutu bu oturumda doğrulanmadı, bilgi tabanından | Xcode + Gradle CLI mümkün (doğrulanmadı) |
| Başsız test | Jest, RNTL, Maestro, Detox | bulunamadı | bulunamadı (XCTest/Espresso, doğrulanmadı) |
| Ajan dostu | Metin config (app.json, eas.json, package.json); IDE gerektirmez; yine de Xcode/Android SDK kurulumu şart | bulunamadı | Xcode proje dosyası (pbxproj) metin ama kırılgan (doğrulanmadı) |
| Tek kişi bakım | Orta: yılda ~3 SDK yükseltmesi, ~1 yıl SDK ömrü | bulunamadı | Yüksek: iki platform |
| Bilinen risk | Bkz. bölüm 8 | bulunamadı | bulunamadı |
Flutter ve native satırları bu oturumda derinlemesine araştırılmadı; kaynaksız hücreler "bulunamadı/doğrulanmadı" olarak işaretli (kapsam gereği kısa tutuldu).

## 8. Risk ve kırıcı değişiklik geçmişi (son 2 yıl)
- SDK 52 (yeni mimari yeni projelerde varsayılan), SDK 53-54 (varsayılan açık), SDK 55 (eski mimari kaldırıldı; SDK 54 son sürüm). Kaynak: https://docs.expo.dev/guides/new-architecture/ . 3. taraf kütüphane uyumsuzlukları örnekleri: react-native-maps, @stripe/react-native >= 0.45.0 (aynı kaynak).
- SDK 54: Android edge-to-edge tüm uygulamalarda zorunlu, kapatılamaz. Kaynak: https://expo.dev/changelog/sdk-54-beta (arama özeti).
- SDK 58 (Eki 2026): RN 0.86'dan 0.88'e atlar; Strict TypeScript varsayılan; `InteractionManager` vb. API kaldırıldı; iOS scene-tabanlı yaşam döngüsü (SceneDelegate, elle düzenlenmiş AppDelegate için göç); NODE_ENV/.env davranışı değişti; Android R8 release'te varsayılan açık; expo-sqlite libSQL kaldırıldı; macOS desteği kaldırıldı. Kaynak: https://expo.dev/changelog/sdk-58
- Yeni Expo Go yalnız en son SDK'yı destekler; Expo Go'da giriş zorunlu (Eyl 2026). Kaynaklar: https://expo.dev/changelog/sdk-58 ; https://expo.dev/changelog
- SDK ömrü ~1 yıl: tek kişi/ajan için en az yılda bir zorunlu yükseltme (https://expo.dev/changelog/sdk-57). Yükseltme sırasında Apple (Xcode) ve Google (targetSdk) eşikleri ayrı hareket eder.
- Tek tedarikçi bağımlılığı (Expo): MIT ve özel güncelleme sunucusu seçeneği çıkış maliyetini düşürür; `prebuild` (CNG) native klasörlerin elle düzenlenmesini zorlaştırır (SDK 58 SceneDelegate notu bunu gösterir).
- Detox için RN 0.88 desteği doğrulanmadı (resmi liste 0.77-0.84). Maestro daha güvenli varsayılan, ama tek şirket destekli.

## Öneri
**TRY (küçük deneme önerilir)** — RN + Expo (TypeScript), ücretsiz yerel yol: `expo prebuild` + `expo run:*` + Jest/jest-expo + RNTL + Maestro. Gerekçe: TS/React örtüşmesi, MIT lisanslar, metin tabanlı yapılandırma ve başsız test araçları kaynaklarla doğrulandı; kapı: yerel derlemenin hesapsız çalıştığı ve Maestro'nun iOS simülatörde ajanla başsız çalıştığı deneyle doğrulanmalı.
Karar Mimari kurula/CEO'ya aittir.

## Riskler (DON'T USE gerekçeleri)
- `eas build --local` ve Expo Go Expo hesabı/girişi ister: "ücretsiz ve hesapsız" varsayımı yalnız `expo run:*` yolu için geçerli olabilir.
- Yılda ~3 SDK, ~1 yıl destek: zorunlu yükseltme yükü; SDK 58 gibi sürümler kırıcı değişiklik taşır.
- Ücretsiz katman sınırı: ayda 15+15 build, düşük öncelik, 45 dk zaman aşımı; aşımda iOS build $2-4 (https://expo.dev/pricing). Her ücretli geçiş CEO onayı ister.
- OTA güncelleme Apple 2.5.2 yorum riski taşır.
- Ajan Xcode ve Android SDK/NDK kurulumunu (kurulum IDE düğmeleri gerektirebilir) kendi başına yapamayabilir: doğrulanmadı.

## Doğrulanmadı
- Hesapsız `expo run:*` ve gerçek `xcodebuild`/Gradle akışı; Xcode/SDK lisans kabulü ve imzalama adımlarının başsız yapılabilirliği.
- RN minimum iOS/Android (RN tarafı), Hermes sürüm/lisans ayrıntısı (yalnız lisans doğrulandı), Detox/RNTL/jest-expo güncel sürüm tarihleri, Jest lisansı.
- Flutter/native satırları (araştırılmadı), Apple Developer ($/yıl) ve Google Play kayıt ücretleri, .NET OpenAPI üretimi.
- Araç özetleri (WebFetch/WebSearch) üçüncü taraf model özetidir; kritik rakamlar (SDK 58 gereksinimleri, fiyatlar) uygulama kararından önce resmi sayfadan tekrar okunmalı.

## Deneme önerisi
Ortam: ana makine (macOS) dışında izole bir geçici dizin/yeni boş proje, CEO onayıyla, `create-expo-app` SDK 58 şablonu. Ölçüt: (1) `expo run:ios` ve `run:android` hesapsız, tek komutla derleme; (2) 1 Jest + 1 RNTL + 1 Maestro akışı simülatörde başsız yeşil; (3) `eas build --local` ile bir iOS/Android çıktısı (Expo oturumu ücretsiz, ayrı onay). Süre: 1 oturum. Başarısızlıkta Flutter ve native için ayrı keşif.

## Kaynaklar (erişim 2026-11-21)
- https://docs.expo.dev/versions/latest/
- https://expo.dev/changelog ; /sdk-57 ; /sdk-58
- https://expo.dev/pricing
- https://reactnative.dev/versions ; /docs/the-new-architecture/landing-page ; /blog/2025/10/08/react-native-0.82 ; /blog/2026/06/11/react-native-0.86
- https://github.com/reactwg/react-native-releases/blob/main/docs/support.md
- https://docs.expo.dev/guides/new-architecture/ ; /guides/local-app-development/ ; /build-reference/local-builds/ ; /develop/unit-testing/ ; /eas-update/introduction/ ; /versions/latest/sdk/updates/ ; /guides/apple-privacy/
- https://developer.apple.com/news/upcoming-requirements/ ; https://developer.apple.com/app-store/review/guidelines/
- https://developer.android.com/google/play/requirements/target-sdk
- https://github.com/mobile-dev-inc/Maestro ; https://github.com/wix/Detox ; https://github.com/callstack/react-native-testing-library ; https://github.com/openapi-ts/openapi-typescript
- https://github.com/facebook/react-native/blob/main/LICENSE ; https://github.com/expo/expo/blob/main/LICENSE ; https://github.com/facebook/hermes/blob/main/LICENSE
- Web aramaları (özet, zayıf kanıt): Maestro CLI v2.6.0 (https://maestro.dev/blog/maestro-cli-v2-6-0), Detox 20.47-20.50 (yrkan.com), Flutter 3.47 (https://docs.flutter.dev/whats-new)
