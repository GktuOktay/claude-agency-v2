# Spec 0008 kapı raporları, 1. tur (2026-11-22)

Ana oturumun özeti; `spec-critic` ve `appsec` salt-okur birimlerdir, raporları sohbete döner, burada özetlendi. Mimari kurul görüşünün tamamı: `docs/architecture/gorus-0008-team-expansion-2026-11-22.md`. Bağımsız eksik-uzmanlık raporu: `docs/talent/2026-11-22-eksik-uzmanlik.md`. İncelenen sürüm: spec'in ilk taslağı (347 satır, 20 REQ, 24 AC).

## Sonuç

| Kapı | Hüküm | Ana bulgu |
|---|---|---|
| `spec-critic` | imzalanamaz: 5 engelleyici, 8+ "düzeltilmeli" | aşağıda |
| `appsec` | FAIL: 2 YÜKSEK, 4 ORTA, 1 DÜŞÜK; **yeni güven sınırı, lane 3** | aşağıda |
| `architecture-board` | koşullu onay, K1-K7 | görüş dosyasında |
| `talent-capacity` (bağımsız) | `ux-writer` birim olmasın, `marketing-brand` bölümü olsun | CEO "eksikse alalım" demişti; kurul "kalsın" dedi; spec'te hüküm olarak yazıldı |

## AppSec (kaynakta doğruladı; komutları deneme girdisiyle guard'a verdi, depo durumu değişmedi)

- **S-01 YÜKSEK:** mağaza yüklemesi zarf kancasına tam bağlı değil. `harness/guard.js:56-59`: `xcrun altool` ve `npx eas submit` soruyor; `xcrun iTMSTransporter`, `xcodebuild -exportArchive` (hedef yükleme ise), `npx eas-cli submit`, `./gradlew publishReleaseBundle`, `bundletool`, Play API betikleri **sormuyor**.
- **S-02 YÜKSEK:** ana makinede derleme, CEO'nun gerçek anahtar zincirinin yanında sınırsız koşar (Gradle/Pods betikleri kod çalıştırır; guard yalnız ajanın komutunu görür). `security export`, `cat release.jks`, `keytool` guard'dan sessiz geçti.
- **S-03 ORTA:** Metro'nun tüm arayüzleri dinlemesi yalnız metinde; `npx expo start` guard'dan geçti.
- **S-04 ORTA:** zarf yalnız "gönderim"i sayıyor; mağaza incelemesine cevap, test kullanıcısı daveti, kademeli yayın yüzdesi, veri güvenliği formu da dış mesaj ya da yayın.
- **S-05 ORTA:** "yazma alanı korunuyor" iddiası ana makinede yanlış: `guard.js:50` `.claude/agents|skills|rules`'u kapsamıyor.
- **S-06 ORTA:** sır taraması (`harness/bin/check:17`) `.jks/.keystore/.p12/.mobileprovision` ve `key.properties`'i kaçırır (ikili dosyalar `grep -I` ile atlanır); `.p8` ve servis hesabı JSON'unu yakalar. Taslağın Q4 metni bu ikisinde yanlıştı.
- **S-07 DÜŞÜK:** `lint.js` değişikliğinin kapsamı belirsiz.
- Taranmayan: Metro varsayılanı ve CVE iddiası (çalıştırılmadı), Gradle/Pods davranışı, 0004 kancalarının kurulum durumu.

## Spec critic engelleyicileri

1. Atıf yapılan kaynaklar bu dalda yok (deneme kanıtı, kurul mobil görüşü, Scout raporları, spec 0004).
2. "Tasarımcı, BA §4'ü sabitlemeden önce" sırası döngüsel ve yönlendirme metninde yok.
3. Swift/Flutter yönlendirmesi 1. aşamada tanımsız.
4. Yönlendirme metni kendi 900 B sınırını aşıyor (ölçüm: 1.424 B).
5. "Yalnız `docs/design/` yazar" kriteri denetlenemiyor.

## Ana oturumun hükümleri (2. tura girdi)

- Lane 2 → **lane 3** (kapı güven sınırı buldu; yönlendirme kuralı).
- 1. aşama ikiye bölündü: **1a** Bash'siz birimler (`product-designer`, `ux-writer`); **1b** `rn-engineer`, `mobile-common`, `store-release`.
- 1b için yeni sert bağımlılık **D2**: ayrı, CEO imzalı "mobil için guard sertleştirme" spec'i (S-01, S-05, S-06 kodu, K1). 0008'in parçası değil.
- İmza saklama kuralı: birimler yalnız debug ya da imzasız/geçici anahtarlı çıktı üretir; yayın imzası ve yükleme CEO'dadır.
- Mimar adımı D2 spec'inde yapılır (zorlama tasarımı orada).
