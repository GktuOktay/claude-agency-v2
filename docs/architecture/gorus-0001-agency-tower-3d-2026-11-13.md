# Mimari görüş: spec 0001 Agency Tower 3D | Tarih: 2026-11-13 | Karar: CONDITIONAL APPROVE

Kapsam: `specs/active/0001-agency-tower-3d.md` §6 (mimari, bağımlılıklar), §8 (tedarik zinciri satırı), §7 (veri sözleşmesi, yalnız izolasyon açısından). Spec değiştirilmedi. Web erişimim yok: lisans, bakım, zafiyet geçmişi ve ağaç boyutu **doğrulanmadı** (Scout raporu yok; `docs/scout/` altında bu spec için dosya bulunmuyor).

## Kararlar ve değerlendirme

| # | Karar | Gerekçe var mı? | Alternatif | Risk | Sonuç |
|---|---|---|---|---|---|
| D1 | Vanilla Three.js + DOM katmanı, çalışma zamanında tek bağımlılık (`three`) | Evet (§6 tablo A-E, "hiçbir şey ekleme" dahil) | R3F+React, Babylon, video, CDN | Three 0.x sürümleri sık kırar; sahne kodu three'ye kilitli (çıkış maliyeti yüksek, ama CEO seçti ve kapsam küçük) | APPROVE; sürüm tam sabit |
| D2 | `vite`, `typescript` | Evet, yığında zaten "benimse" | esbuild tek başına | Yok | APPROVE |
| D3 | `vitest` + `jsdom` | Kısmen (yalnız "birim ve DOM testi") | `node:test`, happy-dom, Playwright ile her şey | jsdom geniş ağaç (dev-only); WebGL yok, spec sahne modelini ayrı test ediyor | APPROVE (dev-only) |
| D4 | `@types/three` | Kısmen ("gerekmezse çıkar") | Paketli tür varsa çıkar | three ile sürüm uyumsuzluğu; paketli türün olup olmadığı doğrulanmadı | CONDITIONAL (C4) |
| D5 | `playwright` (host) | Kısmen | Harness imajındaki Playwright 1.64.1 (konteyner); Vitest browser modu | STACK.md "yalnız izole konteynerde" ile çelişir; tarayıcı indirmesi `npm ci` dışında, sabitlenmemiş CDN indirmesi | CONDITIONAL (C2) |
| D6 | Elle yazılmış frontmatter ayrıştırıcı (R-2), YAML bağımlılığı yok | Evet | `yaml` | Kenar durumlar; spec "yüksek sesle başarısız" diyor | APPROVE |
| D7 | Prosedürel geometri, glTF/doku yok (R-1) | Evet | glTF | Yok | APPROVE |

## İzolasyon (showcase/agency-tower/ ↔ ajans): sağlam, üç not
Kanıt: `install-global.sh` yalnız `.claude/agents/*.md`, `.claude/skills/*/`, `.claude/rules/*.md` bağlar (satır 30-32); `install-project.sh` yalnız `.claude/settings.json` yazar. `harness/bin/check` ve `lint.js` sabit dizinleri okur (`.claude/*`, `templates`, `site`, `harness/*`); showcase'e dokunmaz. CI tek komut `harness/bin/check`. Kopya zinciri yok: showcase kuruluma ulaşamaz. Çalışma zamanı bağı sıfır; tek bağ, yalnız-okuma build-time betiği (spec diyagramı ile metin tutarlı).
- N1 Kök `harness/bin/check` sırlar taraması (`grep -rIl`, yalnız `node_modules` hariç) showcase altındaki `dist/`, `coverage/` ve önbellekleri de tarar; yerel build sonrası yanlış pozitif riski düşük ama sıfır değil. Gürültü çıkarsa çözüm showcase içinde (çıktıyı repo dışına yazmak), kök dosya değil.
- N2 REQ-3 "harness'e dize başvurusu yok" ile REQ-8 varsayılan `../../.claude/agents` yolu ve README "izolasyon kuralları" bölümü birbirini tetikleyebilir. `check-isolation.mjs` kapsamını (kaynak, README dahil mi) ve tek izinli yol dizesini spec'te/betikte açıkça tanımlayın.
- N3 graphify (anayasa kural 8) repoyu dizinler; showcase kodu ajansın grafiğine karışır. Kök ignore dosyası REQ-2 ile yasak. Kalıntı risk olarak CEO'ya bildirilir; showcase içinde yerel ignore desteği varsa orada çözülür (desteği doğrulanmadı).
- A-4 (showcase testleri CI/`check` dışında) kabul: `roster:check` otomatik koşmadığı için yeni ajan eklenince showcase sessizce eskir. README'de yazılsın; CEO'nun bilgisi olsun.
- Q-1 (git clone klasörü içerir) CEO kararı; kurul görüşü: klasör REQ-7 ile bağımsız olduğundan repoda kalması Phase 1 için yeterli, ayrı repo sonradan ucuz.

## Tedarik zinciri kontrolleri: iskelet iyi, boşluklar var
Var: tam sürüm sabitleme, lockfile commit, `ignore-scripts=true`, `npm audit` AppSec incelemesi, liste dışı bağımlılık yok (delta spec), çalışma zamanı ağı yok + CSP. Eksik:
- Node sürümü sabitlenmemiş (ajan imajı node:22). `engines` + `.nvmrc` + `engine-strict` yok.
- `.npmrc` yalnız `ignore-scripts` adlandırıyor; `save-exact` ve açık `registry=` yok.
- Lockfile içeriği doğrulanmıyor: `resolved` yalnız `registry.npmjs.org`, `integrity` her kayıtta var, git/http/file bağımlılığı yok. `check-isolation.mjs` içine eklenebilir.
- `npm audit` eşiği ve kaydı tanımsız (kim, ne zaman, hangi seviye bloklar).
- Playwright tarayıcı indirmesi (`playwright install`) `ignore-scripts` kapsamı dışı, açık bir komut; spec'te yok, README'de yazılmalı ve `npm ci`/AC-6 hızlı profilinden ayrı olmalı.
- Geçişli bağımlılık sayısı spec'te yok (vite + vitest + jsdom + playwright dev ağacı tek çalışma zamanı paketine göre geniş; dist'e girmez, ama dist'in yalnız `three` içerdiği AC-42 ile ve `THIRD-PARTY-NOTICES` ile doğrulanmalı). Sayı Scout/lockfile'dan alınmalı: doğrulanmadı.
- Yerel geliştirme Docker'da (anayasa) ama §10 `npm run dev` host'ta. `npm ci` ajan imajında koşarsa host'a hiç yükleme ulaşmaz. En azından Ruling olarak yazılmalı.

## Gereksiz bulundu (kriter yok)
Yok. Her paketin bir AC'si var (Playwright: AC-19, 35, 36, 38-41, 44; jsdom: AC-12, 20, 21, 29, 34). Eksik alternatif notu: "vanilla Three + React yalnız DOM katmanı" seçeneği tabloda yok; seçim A zaten bir bağımlılık daha eklemediği için doğru, bu yalnız gerekçe tamlığı.

## Geri dönüşü pahalı kararlar
Veri modeli/ortak sözleşme/kimlik/depolama/çok kiracılık: yok (iki yerel JSON, sunucu yok). Three seçimi sahne koduna işler ama CEO kararı ve izole klasör. ADR gerekli: hayır.

## Koşullar
- C1 (imzadan önce) Scout, 6 paket için lisans (SPDX), son sürüm tarihi, bakımcılar, OSV/GitHub advisory, lockfile'dan geçişli paket sayısını kaynakla raporlasın; kurul "doğrulanmadı"yı kapatana dek bağımlılıklar CEO'ya yalnız "değerlendir" olarak gösterilir. 12 aydan eski sürüm = risk.
- C2 Playwright: tarayıcı testleri ya harness agent imajında (aynı 1.64.1 sürümüne sabit) koşar ya da CEO, STACK.md kapsamını "showcase, host" için açıkça genişletir. Tarayıcı indirmesi README'de açık komut olarak yazılır, sürüm sabit.
- C3 `.npmrc`: `ignore-scripts=true`, `save-exact=true`, `registry=https://registry.npmjs.org/`, `engine-strict=true`; `package.json` `engines.node` (22) ve `.nvmrc`. `check-isolation.mjs` lockfile kontrolünü yapar (resolved/integrity/URL türü). `npm audit` sonucu QA raporuna yazılır; high/critical bloklar.
- C4 `three` ve `@types/three` aynı minor'a birlikte sabitlenir; üç paketli tür varsa `@types/three` düşer (doğrulanmadı). OrbitControls/CSS2D kullanımı netleşir: REQ-16, 39 ve AC-10, 35 özel kamera denetleyicisi ve ekran izdüşümü anlatıyor, §6 ise addon'ları sayıyor. Hangisi olduğu spec/uygulamada tek cümleyle yazılsın; paket eklenmez.
- C5 N2 çözülür (isolation tarama kapsamı + tek izinli yol dizesi). N1, N3, A-4 CEO'ya kalıntı risk olarak raporlanır.
- C6 Her sürüm yükseltmesi bağımlılık değişikliğidir: delta spec veya CEO bilgisi; Dependabot/otomatik yükseltme yok.

## STACK.md değişikliği
Eklendi: `three` (değerlendir), `vitest` + `jsdom` (değerlendir), `Playwright (showcase, host)` (değerlendir, C2'ye bağlı). `vite`, `typescript` mevcut "React + TypeScript + Vite" satırıyla kapsanır. Hepsi CEO'ya gösterilir; kurul tek başına "benimse" yapmaz.

## Cevaplanmamış sorular
- Q-A Scout raporu (C1): kim ne zaman? Q-B Playwright konteyner mi host mu (C2, CEO). Q-C graphify kapsam dışı bırakma yolu (N3).
- Doğrulanmadı: three'nin paketli TypeScript türü, `three/addons` yolları, bundle boyutunun 500 KB gzip bütçesine sığdığı, tüm lisans/bakım/advisory iddiaları.
