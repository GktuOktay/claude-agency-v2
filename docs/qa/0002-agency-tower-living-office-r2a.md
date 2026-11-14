# QA 0002 — tur 2, A bölümü (spec kriterleri ve mutasyonlar)

- Yapan: `qa-engineer` (opus). Ana oturum kaydetti.
- HEAD `7abf371`, Node v22.23.5. Kanıt temiz HEAD kopyasında alındı (`git archive` ile birebir aynılık doğrulandı).
- **Sonuç: 2 BAŞARISIZ (AC-1, AC-15), 3 KANITSIZ (AC-17, AC-18 ve göz kontrolü gereken kısımlar), 7 mutasyon kaçtı.**

## Taze koşular
- `tsc` çıkış 0 · `vitest` 79 dosya / 835 test geçti (57 s) · build OK, giriş dosyası 972 106 B · `budget:check` OK (1 000 000 sınırı, Rev 35) · `isolation:check` OK · `roster:check` OK · `harness/bin/check` "CHECK GREEN (full)".
- Kararsız testler: yük ortalaması 42'de 2 zaman aşımı (`activity.test` aynı-seed testi 23 s, sınır 15 s; `staff-sim` ayak izi 45 s). Tek başına geçiyorlar; neden CPU yükü.
- harness'teki 3 `SyntaxError` satırı Node 22'de de çıkıyor; tur 1'deki "Node 25 kaynaklı" notu yanlıştı. Testler geçiyor.

## Kriter → kanıt
| AC | Kanıt | Durum |
|---|---|---|
| 1 | `git diff --name-only dfb7413...HEAD` izin listesi dışında 5 yol veriyor: `.claude/launch.json`, kök `.gitignore`, `docs/qa/0002…`, `specs/done/0001…`, `specs/draft/0003…`. Lockfile değişmedi; `package.json`'da yalnız `scripts` değişti. | **FAILED** (harfiyen okumayla) |
| 4 | 600 s izi varsayılan nav hareketiyle koşuyor; R-3 oracle'ı zamanlı yer tutucuyla | PASS; R-3(1) mutasyonu kaçtı |
| 7 | `director.test.ts:141` mühür `signTable()` 0.05 u | PASS (gri tonlama göz kontrolü açık) |
| 10 | `job-strip.test.ts:319` çağıran seçimi | PASS (375 px göz kontrolü açık) |
| 13 | elevator-sim + nav-movement; 3/3 mutasyon yakalandı | PASS |
| 14 | grant-order (tutulmuş oda), `scenarios.test:140` | PASS; koltuk koşulu test dışı |
| 15 | Motor tarafı `sim-clock` testleriyle geçiyor. Ambient tarafı için tekrar üretim testi: `tests/qa-0002-r2-ac15-ambient-pause.test.ts` (kırmızı) | **FAILED** |
| 16 | `reduced-motion-workflow.test.ts` ve tur 1 tekrar üretimi yeşil; 2/2 mutasyon yakalandı | PASS (göz kontrolü açık) |
| 17 | `limits.test.ts`; pencere 115.8–146.3 s (Rev 36); bütçe sapması (Rev 31/35) | KANITSIZ: fps göz kontrolü yok |
| 18 | göz kontrolü | KANITSIZ |
| 2, 3, 5, 6, 8, 9, 11, 12 | ilgili testler yeşil | PASS (yeniden denetlenmedi) |

**AC-15 hatası:**
- `sceneApp.ts:636` ambient simülasyonu kare süresiyle ilerletiyor ve yalnızca org modunda duruyor.
- `paused` bayrağı yalnızca molaları durduruyor (`activity.ts:412`).
- `sceneApp.ts:766` balonları kare süresiyle ilerletiyor.
- Sonuç: "Hareketi durdur" açıkken 30 s içinde 77 ambient olay ve 36 balon çekimi oluyor.

## Mutasyonlar (scratch kopyada)
| Mutasyon | Sonuç |
|---|---|
| R-3: önce oda tutan iş kuralı kaldırıldı / en eski bekleyen ilk sırası ters çevrildi | YAKALANDI / YAKALANDI |
| Kilitlenme: yer yüzünden bloklu adım birimleri sahipleniyor | **KAÇTI** |
| Duraklatma: saat gerekçeyi yok sayıyor | YAKALANDI |
| Duraklatmada çekim: runtime `step(0)`, motor `dt=0`'da çekiyor | **KAÇTI** |
| `setStatic` çekim yapıyor / azaltılmış harekette ambient duruyor | YAKALANDI / YAKALANDI |
| `MAX_BUBBLES` = 5 / `<` yerine `<=` | YAKALANDI / YAKALANDI |
| Ekilen `import('./nav')`, `fetch(` | YAKALANDI |
| `import /*c*/ (`, `navigator.sendBeacon`, `import.meta.glob`, `.js` dosyasında `fetch(` | **4 KAÇTI** |
| Bütçe: `>=` / +1000 B / +999 B | YAKALANDI / YAKALANDI / kaçtı (fikstür adımı) |
| R-11: eşlik uzatılmıyor / geçişte de uzatılıyor | YAKALANDI / YAKALANDI |
| Zorunlu geçişte çekim / senaryolu sonuçta çekim | YAKALANDI / YAKALANDI |
| Oda: koltuk kontrolü kaldırıldı / lider de koltuk sayıldı | **KAÇTI / KAÇTI** |
| Oda: tutulmuş oda kontrolü kaldırıldı | YAKALANDI |
| Asansör: LIFO / yeniden kuyruğa en başa / kapı yarı açıkken biniş | YAKALANDI ×3 |

## Tur 1 bulguları
AC-16 kapandı · mühür kapandı · çağıran testi kapandı · AC-4 kapandı · AC-17 kısmen (test var; fps göz kontrolü açık) · AC-15 kayma testi hâlâ zamanlı yer tutucuyla.

## Açık
1. AC-15: ambient döngü ve balonlar simülasyon saatini izlemeli.
2. AC-1: karar ya da temizlik.
3. Test boşlukları:
   - R-3(1) için bloklu eski adım ile daha genç adım fikstürü;
   - duraklatmada çekimsizlik `simRuntime` üzerinden;
   - koltuk koşulunu bağlayan bir fikstür;
   - grep testi tüm uzantıları taramalı, `sendBeacon` ve `import.meta.glob` eklenmeli.
4. AC-17/18 göz kontrolleri ve fps kaydı.
5. Uzun testlerin zaman aşımları yük altında yetmiyor.
