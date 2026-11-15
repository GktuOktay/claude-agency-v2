# QA 0002 — Ajans Kulesi "yaşayan ofis" (tur 1)

- Dal: `feat/agency-tower-living-office`, HEAD `d59f7c7`
- Yapan: `qa-engineer` (opus). Dosyayı ana oturum kaydetti; birim kendi kurallarına göre depoya rapor yazamıyor.
- Sonuç: **KANITSIZ KRİTERLER VAR, 1 BAŞARISIZ.**

## Taze kontroller (Node v25.9.0; `.nvmrc` 22 — Node 22 kanıt boşluğu)
- `tsc` çıkış 0 · `vitest` 56 dosya / 634 test geçti (tekrar üretim testi eklenmeden önce).
- Build: giriş dosyası 869 393 B; `budget:check` OK (900 000 sınırı, Rev 31). Spec'in 748 000 sınırı aşıldı → kayıtlı sapma.
- `isolation:check` OK · `roster:check` OK · `harness/bin/check` "CHECK GREEN (full)" (Node 25'te loop-guard testleri 3 `SyntaxError` satırı basıyor, testler geçiyor; harness tarafı gürültü).

## Başarısız
- **AC-16** (azaltılmış hareketle ambient iz aynı olmalı): `bindReducedMotion` (`src/app/motion.ts:20`) `sim.setStatic(true)` çağırıyor; `activity.ts:338` `sim.time += dt` öncesinde dönüyor, ambient simülasyon duruyor. Aynı seed, 120 s: azaltılmış `{"time":0,"events":[]}` / normal `{"time":119.99…,"events":[…]}`. Tekrar üretim testi: `tests/qa-0002-ac16-ambient-trace.test.ts` (bilerek kırmızı). Spec §9'daki `reduced-motion-workflow.test.ts` yok.

## Kriter → kanıt
| AC | Kanıt | Durum |
|---|---|---|
| 1 | check + isolation + CLAUDE.md/docs testi | PASS; yol filtresi (taban dfb7413), lockfile, agents klasörsüz koşu denetlenmedi |
| 2, 3, 6, 8, 9, 11, 13 | ilgili test dosyaları yeşil | PASS; fikstür bazında denetlenmedi |
| 4 | workflow, grant-order | PASS; zamanlı yer tutucuyla (Rev 32) — varsayılan nav hareketinde 600 s özdeş iz kanıtlanmadı |
| 5 | pipeline-fidelity | PASS, 100 s sınırı (Rev 32; ölçülen 92.3 s) |
| 7 | birim kısmı | PASS; lane-3 mühür doğrulaması gevşetilmiş (aşağıda); gri tonlama göz kontrolü açık |
| 10 | job-strip (jsdom) | PASS; 375 px göz kontrolü açık |
| 12 | nav + nav-movement 600 s | PASS |
| 14 | whiteboard, scene-model | PASS |
| 15 | sim-clock | PASS; 30 s kayma ve seed-13 koşusu yer tutucuyla |
| 16 | — | **FAILED** |
| 17 | `limits.test.ts` yok; maks. yük penceresi testi yok; fps göz | KANITSIZ |
| 18 | göz | KANITSIZ |
| Rev 31/33 genişleme | test dosyaları var (name-tr, campus-breaks, city, staff, settings-menu, tools-tr, card) | yalnız dosya adına göre eşlendi |

## Test gevşetme incelemesi (2698383'ten beri 52 commit)
- **Gevşetilmiş:** `1d4e4c3` `director.test.ts` — lane-3 CEO mührü "`signTable()`'a 0.05 u içinde" iken "MEETING_ROOM sınırları içinde herhangi bir yer" oldu. AC-7/AC-14 masada diyor.
- Uygun: koşu süresi/zaman aşımı değişiklikleri, 748k→900k (Rev 31), 90→100 s (Rev 32), 9.6→11 px, city-sim toplu `toEqual([])`, etiket yeniden adlandırmaları.
- Not: `job-strip` seçim testi genelleşti ama artık çağıran (`kind !== 'call'`) seçmiyor; çağıran maddesi orada test dışı.

## Mutasyonlar
Çalıştırılmadı (tur sınırı). Sıra/kilitlenme, duraklatma/çekimsizlik, balon sınırı, ağ yasağı ve bütçe karşılaştırıcısı bozarak kanıtlanmadı.

## CEO göz kontrol listesi (localhost:5173)
1. `?debug=1`, yüksek kalite: ilk 120 s'de 3 iş çalışırken ve 3. katta toplantı varken genel ve 3. kat görünümünde fps ≥ 30.
2. 375 px: yatay kaydırma yok; iş şeridi kat panelini ve kartı kapatmıyor; dokunma hedefleri ≥ 44 px.
3. 3. kat: beyaz tahta kameraya dönük; lane-3'te CEO masada mühür basıyor.
4. Gri tonlama: "ONAY" mührü ve lamba ✓/✗ ayırt ediliyor.
5. #1 işi (spec-critic reddi, ↺ 1) ve #2 işi (QA kırmızı) şeritten sahneye izlenebiliyor.
6. Rev 31/33: insan CEO, kıyafetler, kampüs kanadı ve molalar, personel, şehir, 11 px balonlar, Türkçe adlar ve kartta özgün ad, köşe ayar menüsü ve Senaryo, kat panelinde "Kampüs".
7. macOS "Hareketi azalt" açık: robotlar yalnız bacak sonlarında sıçrıyor; tahta tam bölümlerle doluyor.

## Açık
AC-16 düzeltmesi, AC-17 pencere testi, mühür doğrulamasının geri alınması, mutasyonlar, Node 22 ile yeniden koşu.
