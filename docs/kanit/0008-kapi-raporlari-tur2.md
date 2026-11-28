# Spec 0008 kapı raporları, 2. tur (2026-11-22)

Ana oturumun özeti. İncelenen metin: 3. revizyon (commit `27abc52`); bulgular 4. revizyonda işlendi. 1. tur: `docs/kanit/0008-kapi-raporlari-tur1.md`.

| Kapı | Model | Hüküm |
|---|---|---|
| `architecture-board` | sonnet | **ONAY**; imzadan önce 3 düzeltme istedi, üçü de işlendi (görüş dosyası §7) |
| `appsec` | opus (lane 3) | **TAKİP MADDELERİYLE GEÇER**: YÜKSEK 0, ORTA 4+1, DÜŞÜK 3 |
| `spec-critic` | sonnet | 1. turun 5 engelleyicisi kapandı; tek düzenlemelik tutarlılık maddeleri, işlendi |

## AppSec: 1. tur bulgularının durumu

| Bulgu | Durum |
|---|---|
| S-01 mağaza yüklemesi zarfa bağlı değil | D2'ye (guard sertleştirme spec'i, B31) ertelendi; 1b D2 birleşmeden ve `appsec` komutları kurulu kancaya karşı sınamadan teslim edilmez (AC-24, AC-31) |
| S-02 ana makinede derleme anahtar zincirinin yanında | **kalan risk olarak kabul edilir** (REQ-7, R-13); ilk derlemeden önce kimlik denetimi (REQ-33, AC-32) |
| S-03 Metro | metinde kapandı; `--localhost` etkisi ilk RN işinde ölçülür (AC-27) |
| S-04 zarf kapsamı | metinde kapandı (REQ-8); `promote*` zorlaması D2'de |
| S-05 yazma alanları | D3'e (spec 0006) bağlandı; o zamana dek yalnız talimat |
| S-06 imza dosyası taraması | D2; `store-release` uygulama deposu için `.gitignore` ve pre-commit parçası verir |
| S-07 lint değişikliği | kapandı (yalnız ekleme, QA sınar; AC-11, AC-33) |

## AppSec: yeni bulgular (hepsi işlendi ya da D2 girdisi oldu)

- F-1 D2 kapısı içeriği denetlemiyordu → AC-24 madde madde izler, AC-31 sınama ister.
- F-2 guard'dan bugün sessiz geçen komutlar (deneme girdisiyle sınandı, durum değişmedi): `bundle exec fastlane pilot upload`, `npm exec eas-cli -- submit`, `pnpm dlx eas-cli submit`, `./gradlew promoteReleaseArtifact`, `security find-generic-password -w`, `security export`, `codesign -s`, `keytool -list`, `base64 -i release.jks`, `xcodebuild -allowProvisioningUpdates`. Neden: `bundle`, `npm exec`, `dlx` sarmalayıcı listesinde yok (`harness/guard.js:52-53`). → D2 asgari listesine eklendi.
- F-3 ilk ana makine derlemesinden önce anahtar zinciri ayrımı için kapı yoktu → REQ-33.
- F-4 spec 0004'te birim başına yazma alanı yok, o iş spec 0006'nın → D3.
- F-5 `Unlocks:` envanterden genişti → tek tek yollara daraltıldı; mevcut eval vakası silinemez (AC-33).
- F-6, F-7, F-8 (düşük): geçici anahtarlı çıktı yüklenemez, `--scan` ve satır içi parola yasak, kanıt günlükleri ayıklanır, CI'a mağaza sırrı girmez → REQ-35, 36, 37.

## CEO'nun imzayla kabul ettiği kalan risk (AppSec'in ifadesi, Türkçesi)

1a birimleri komut çalıştıramaz, dosya yazabilir. Yazma alanları (`docs/design/`, `docs/copy/`) yalnız talimatla tutulur; bu depoda `docs/`, `specs/`, `plans/` altına sorulmadan yazabilirler; `specs/` klasörü olmayan uygulama depolarında yazdıklarını hiçbir şey denetlemez. 1b'den sonra imza saklama, talimata ve senin kendi kurulumuna (ayrı macOS kullanıcısı ya da anahtar zinciri) dayanır: kancalar çıtayı yükseltir, ama derleme betiklerinin oturum anahtar zincirini okumasını durduramaz.

## Taranmayan

0004 kancalarının ana makinedeki kurulu hali (henüz birleşmedi), Metro `--localhost` davranışı, Gradle/Pods betik davranışı, bağımlılık denetimi (kapsamda uygulama kodu yok).
