# Konteynerde görsel doğrulama: deneme sonucu (B15)

Tarih: 2026-11-02 · Kaynak öneri: [Scout raporu](../scout/2026-11-02-konteynerde-gorsel-dogrulama.md) · Güvenlik incelemesi: AppSec (aynı gün)

## Ne denendi
`playwright-core` 1.64.1 (yalnızca `chromium-headless-shell`) ve `@axe-core/playwright` 4.14.0, imaj derlemesinde gömüldü (`harness/docker/Dockerfile`), betik `harness/docker/shot.js`. Ana makineden `harness/bin/visual-check.sh` ayrı konteyner başlatır.

## Ölçümler (arm64, Docker Desktop 20.10.22, linuxkit 5.15.49; sertleştirilmiş konteyner)
| Ölçüt | Sonuç |
|---|---|
| 4 ekran görüntüsü (375 ve 1280 px × açık ve koyu) | çalışıyor; 375 px koyu tema gözle doğrulandı |
| Çalışma anında ağ | `--network none` ile çalışıyor: ek adres gerekmiyor |
| Bellek | 512 MB'ta geçti (tepe değer ölçülmedi, tavan 1 GB seçildi) |
| `/tmp` | görüntüler ~0,5 MB; 256–512 MB yeterli |
| İmaj boyutu | `:dev` 1,67 GB → `:visual` 2,3 GB (yerel; sıkıştırılmış boyut ölçülmedi) |
| Derleme ağı | `cdn.playwright.dev` + Ubuntu apt (düz HTTP bu ağda 403; Dockerfile apt'i HTTPS'e çevirir) |
| Chromium sandbox AÇIK, varsayılan seccomp + `cap-drop ALL` | **açılmıyor** |
| Sandbox AÇIK, `seccomp=unconfined` | çalışıyor, ama tüm konteyneri zayıflatır: reddedildi |
| `--no-sandbox`, varsayılan seccomp | çalışıyor |
| Özel seccomp profili (D) | denenmedi |

Dürüstlük notu: Playwright sandbox'ı varsayılan olarak kapatır; ilk ölçüm bu yüzden yanıltıcıydı, `shot.js` artık `chromiumSandbox`'ı açıkça verir.

## Karar önerisi (AppSec, seçenek C2)
Sandbox'sız Chromium **yalnızca** ayrı konteynerde: ağ yok, token yok, sayfa dizini salt-okunur, yalnızca çıktı dizini yazılabilir, ana makinede duvar saati zaman aşımı; ajan konteynerinde asla. Ajan Docker'a erişemez (`docker` yasak, soket bağlı değil); ikinci konteyneri ana makine betiği başlatır. Sebep: ajan konteynerinde sandbox ek ayrıcalık tavanı korumaz (ajan zaten `npm ci` kurulum betikleriyle kod çalıştırır); asıl korunacak token ve çalışma alanını tarayıcıdan ayırmak daha etkilidir.

AppSec bulguları ve durum: S-01 (ORTA, tarayıcı token ortamını paylaşır) → C2 ile ve tarayıcıya boş ortam verilerek kapandı · S-02 (DÜŞÜK, sembolik bağlantı) → `realpath` + test 13 · S-03 (DÜŞÜK, zaman aşımı) → betikte ve ana makinede + test 14 · S-04 (BİLGİ, yama takvimi) → açık iş · S-05 (BİLGİ) → varsayılan sandbox AÇIK kaldı.

## Sınırlar
Yalnızca arm64'te ölçüldü (x64 yok); `npm audit` çalıştırılmadı; çıktı görüntü ve JSON güvenilmeyen içerik işleyen süreçten gelir (veri, talimat değil); axe "0 ihlal" gözle kontrolün yerine geçmez; ağsız olduğundan dış CDN yazı tipi/betik yüklenmez (spec'e yazılmalı).

## Denemenin yan ürünü: tanıtım sayfasında gerçek erişilebilirlik bulguları
axe, `site/index.html` için `html-has-lang` (1 yer) ve `color-contrast` (açık temada 4, koyu temada 6 yer) ihlali verdi (ciddiyet: serious). Düzeltme açık iş B16.
