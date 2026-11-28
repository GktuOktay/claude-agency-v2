# Spec 0008 girdisi: RN + Expo ana makine denemesinden (B26) bulgu özeti

Tarih: 2026-11-22. Yazan: ana oturum (özet; ham kanıt değil). Kaynak: deneme oturumunun devir notu ve deneme deposundaki kanıt dosyaları (`~/Desktop/Projects/mobil-deneme-rn-expo/evidence/`, ajans deposunun dışında). Deneme raporu (`RAPOR.md`) bu özet yazılırken **henüz yoktu**; `rn-engineering` kılavuzu son rapordan yazılır, bu özet yalnız spec'in atıf yapabilmesi içindir. Ana oturum kanıt dosyalarının başlıklarına baktı, koşuları kendisi tekrarlamadı.

## Durum (devir notu, 2026-11-22 01:50)

| Kontrol | Sonuç | Kanıt dosyası |
|---|---|---|
| Hesapsız `prebuild` ve `expo run:android` | geçti (170 sn, Expo hesabı ve token yok) | `CB-2-prebuild.txt`, `CB-2-run-android.txt` |
| Sürüm derlemesi, iki platform | geçti: iOS Release simülatör 46 sn; Android `assembleRelease` 3 dk 3 sn, APK 66,7 MB, geçici anahtar | `CB-3-ios-release-1.txt`, `CB-3-android-release-1.txt`, `CB-3-keystore.txt` |
| Jest + RNTL | sıfırdan iki kez yeşil (ios + android önayarı) | `CB-4-jest-rntl.txt` |
| Maestro, Android API 36 | 1. koşu 7/7 adım (API çağrısı 10.0.2.2 üzerinden); 2. koşu, API 34 ve iOS koşuları not yazılırken bekliyordu | `CB-4-android-api36-1.txt` |
| Tedarik zinciri | `npm ci --ignore-scripts` çalışıyor; 1053 kilit girdisi (boş şablon 473); tamamı registry.npmjs.org + sha512; yalnız-GPL lisans yok; audit 3 orta (çalışma zamanı) | `CB-5.txt`, `CB-5-blank-template.txt` |
| .NET sözleşmesi | .NET 10 yalnız OpenAPI 3.1.1 üretir; `openapi-typescript` 7.13.0 tipleri `tsc`'den geçer; Metro kardeş ortak paketi çözer | `CB-6-contract.txt`, `CB-6-metro-shared.txt` |
| SDK 57 → 58 yükseltme | resmi komut başarısız, tek elle düzeltmeyle yeşil, 117 sn | `CB-7-upgrade-attempt1.txt`, `CB-7-upgrade.txt` |

## Kılavuza taşınacak tuzaklar

1. Homebrew `maestro` cask'ı başka bir üründür. Doğrusu `mobile-dev-inc/tap/maestro` formülü (tap'e güven onayı ister; CEO onayladı). `CB-1-A11-maestro.txt`, `CB-1-brew-info.txt`.
2. `npx expo install expo@^58.0.0 --fix` npm ERESOLVE ile düşer. Düzeltme: `node_modules` ve kilit dosyasını sil, yeniden kur. `CB-7-upgrade-attempt1.txt`.
3. SDK 57 tabanında Jest için açık `babel.config.js` gerekti. `CB-7-upgrade.txt`.
4. Metro `*:8081` dinler (tüm arayüzler). `CB-2-run-android.txt` ve Metro günlüğü.
5. `sudo xcode-select` yerine komut başına `DEVELOPER_DIR`. `CB-1-A1-A4-xcode.txt`.
6. Android kurulumu yalnız komut satırıyla yapılabilir (resmi belgeler Android Studio arayüzünü varsayar): JDK, komut satırı araçları, `sdkmanager`, AVD. Lisans kabulü CEO'nundur. `CB-1-A5-jdk.txt` … `CB-1-A9-avd.txt`.
7. Maestro belgeleri Android API'yi 34'e kadar listeler; API 36'da 1. koşu geçti.
8. .NET 10 `int32` alanını `integer|string` olarak yayar; TypeScript tipi `number | string` olur. `CB-6-contract.txt`.
9. RN community CLI (CVE-2025-11953) bağımlılık ağacında yok. `CB-2-rn-cli-cve.txt`.

## Ana makine (devir notu)

Xcode 27.2 ve iOS 27.2 çalışma zamanı (CEO kurdu), JDK, Android SDK paketleri ve 2 AVD (CEO onayıyla), CocoaPods, Maestro CLI 2.12.1. Node 26.13.1, npm 11.20.0, .NET 10.0.404.

## Ek (2026-11-22, rapor kesinleşti)

Deneme raporu artık var: `~/Desktop/Projects/mobil-deneme-rn-expo/RAPOR.md` (deneme deposu commit `e023b19`, QA incelemesi `evidence/QA-review.md`). CB-1..CB-7 geçti, CB-8 kısmi. Rapor bu özetin önüne geçer; yukarıdaki tablo devir notundandır. Spec 0008'in atıf yaptığı rapor bölümleri:

- **"Bulgular (playbook'a girecekler)" 1-12:** yukarıdaki tuzaklara ek olarak: Expo CLI telemetrisi varsayılan açık, `EXPO_NO_TELEMETRY=1` her komutta zorunlu (2); `sys.boot_completed` emülatörün hazır olduğunu göstermez (6); RN ve Expo belgeleri SDK sürümlerinde uyumsuz, kaynak `libs.versions.toml` (7); Android release imzası `ORG_GRADLE_PROJECT_android.injected.signing.*` ortam değişkenleriyle verilebilir, parola loga düşmez (9); Android debug yapıda cleartext açık, release'te kapalı (10); yeni `android` CLI ilk çağrıda ikili indirir ve analitik ayarı yazar (11); test yığını kilit girdisini 473'ten 1053'e çıkarır (12).
- **"Doğrulanamayanlar":** gerçek cihaz, cihaz imzası, provisioning, TestFlight / Play yüklemesi, mağaza incelemesi; Metro `--localhost` bayrağının etkisi (**ölçülmedi**; tüm koşular bayraksızdı); telemetri içeriği; bildirim, derin bağlantı, izinler, uygulama içi satın alma; release yapıda HTTPS; Maestro'nun uzun süreli kararlılığı (5 başarılı, 1 başarısız koşu).
- **"Riskler":** ana makinede derleme CEO'nun kullanıcı hesabıyla, gerçek anahtar zincirinin yanında sınırsız koşar; Gradle ve CocoaPods için `--ignore-scripts` eşdeğeri yok. Raporun önerisi: derleme için ayrı macOS kullanıcısı ya da ayrı makine. Android çıktısı yeniden üretilebilir değil.
- **"Öneri" 3:** mağaza çıkışı ve gerçek cihaz adımları ayrı bir denemeyle (hesap ve ücret onayıyla) doğrulanmadan `store-release` kılavuzu "kanıtlı" sayılmaz.
