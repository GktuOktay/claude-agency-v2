# Spec 0008 teslim kaydı (yazım görevleri)

Spec: `specs/active/0008-team-expansion.md` (sha12 85a45bd6185f, CEO imzalı). Dal: `spec/0008-team-expansion`. Yazan: polyglot-engineer (ana oturumdan devir). Doğrulama burada yok; ayrı birimlerin işi.

## Ruling
Ruling: yazım görevleri token ekonomisi için polyglot-engineer'a devredildi — ana oturum yazma alanını (`.claude/**`, `evals/**`, `harness/bin/*`, `site/**`) imzalı spec'in `Unlocks:` listesi içinde kullandı; doğrulama qa-engineer, appsec, internal-auditor ve architecture-board'da kalır — yanlışsa maliyet: doğrulayıcı yeniden yazım ister.

## T-0 (AC-24)
- D1 `b46e144` ve D2 (0010 birleştirmesi `fd2836e`) `origin/main` günlüğünde var; `git merge-base --is-ancestor fd2836e HEAD` çıkış 0.
- `specs/active/` yalnız `0008-team-expansion.md` içeriyor.
- D2 izleme tablosu (`specs/done/0010-guard-hardening.md` §7) D2-1..D2-15 satırları §6.7 listesiyle aynı sırada: xcodebuild exportArchive, allowProvisioningUpdates, authenticationKey, iTMSTransporter, eas, gradlew publish, promote, bundletool, Play API, sarmalayıcılar, security, codesign, keytool, keystore cat/base64, ad taraması. Satır satır eşleşme okunarak yapıldı; delivery-manager doğrular.

## T-1 taban çizgisi (0010 birleştirmesinden sonra, bu dalda)
- Always loaded 3093 est. token (agent 494, skill 589, rules 2010). Önceki rapor edilen 2910 mutlak sınır 0010/0004 sonrası geçersiz; delta sınırları bu tabana göre.
- `routing.md` 4252 B.

## Görevler (yazıldı)
| Görev | Commit konusu | Kanıt |
|---|---|---|
| T-2 | lint: her `Playbook:` skill eval ister | önce kırmızı: `lint-rules.sh` eski lint ile 3 FAIL; sonra `LINT RULE TESTS GREEN: 546 passed, 0 failed` |
| T-3 | product-design, ux-writing + eval | 3619 B, 3404 B (sınır 5000); `eval.js self` OK (3 vaka) |
| T-4 | product-designer, ux-writer | 894 B, 767 B (sınır 1100); Bash yok, model sonnet |
| T-5 | marketing açıklaması, marketing-brand işaretçisi | 1 satır eklendi, 0 silindi (160 B) |
| T-6 | routing 1a | +526 B |
| T-7 | site 1a | `site-data.js --check` güncel; 20 agent / 23 skill |
| T-11 | mobile-common, store-release + eval | 4130 B, 5214 B (sınır 6000); eval 3 ve 8 vaka OK |
| T-12 | rn-engineering + eval | 6716 B (sınır 10000); eval 6 vaka OK; 12 bulgu, SDK kuralları, telemetri, Metro, kanıt matrisi, ön kontrol |
| T-13 | rn-engineer | 949 B; skills: rn-engineering, graph-usage |
| T-14 | qa ref, MASVS ref, işaretçiler | 1832 B, 2503 B (sınır 3000); işaretçiler 99, 88 B (sınır 300) |
| T-15 | devops-sre işaretçisi | 168 B, REQ-7/8 kuralı satırda |
| T-16 | routing 1b | toplam ekleme 864 B (sınır 1700) |
| T-18 | site 1b | `--check` güncel; 21 agent / 26 skill |
| T-29 | product-designer `mobile-common` işaretçisi | tek satır |

## Ölçümler (footprint.js)
- Always loaded: 1a sonrası 3358 → 1b sonrası 3589; taban 3093: +496 (sınır +850; 1a payı +265 sınır +500, ara ölçüm skill açıklamaları 1b dosyalarıyla birlikte).
- Spawn: ux-writer 2910, rn-engineer 2599, product-designer 2572 (sınır 4090). Kötü durum rn-engineer + mobile-common ≈ 3630.

## Açık (ana oturum / ilgili birim)
- T-8, T-19: smoke işleri ve QA'nın "Adversarial (QA)" vakaları (AC-4); henüz hiçbir eval setinde yok.
- T-9, T-20: doğrulama zincirleri (qa-engineer, appsec, internal-auditor, quality-office).
- T-14 devamı: qa-verification ve application-security eval setlerine +1 vaka (QA ve appsec taslak yazar, ana oturum işler; AC-19).
- T-17: STACK.md satırları (architecture-board).
- T-31: Metro `--localhost` ölçümü; `rn-engineering` adım 3'teki satır "ölçülmedi, güvenilir ağ" olarak duruyor, ölçümden sonra ana oturum günceller.
- T-32: appsec guard probu; T-33: `security find-identity` kaydı (REQ-33).
- Görsel kontrol (`visual-check.sh`, iki tema, 375 px): Docker imajı bu oturumda çalıştırılmadı, "visual not verified" (AC-13).
- AC-5 smoke notları ve AC-11 QA yoklaması yapılmadı.

## Varsayımlar
- `rn-engineering` Metro satırı spec §6.5 bulgu 3 ve AC-27 olumsuz/ölçülemedi dalıyla uyumlu geçici metin; T-31 ile değişir.
- `store-release` ön-commit parçacığındaki hizmet hesabı denetimi `git grep --cached -q` kullanır (yalnız dosya adı/çıkış kodu, içerik basılmaz).
- Deneme deposu `RAPOR.md` bu oturumda okunmadı; 12 bulgu spec §6.5 tablosundan alındı.

## Denetim 1. tur kapanışları (ana oturum, 2026-11-27)
- AC-13: `visual-check.sh` çalışmadı (Docker kapalı). Yerine uygulama içi tarayıcı: 375 px, açık ve koyu tema, yatay kaydırma yok (scrollWidth 375), "21 agent" metni. axe taraması yapılmadı.
- AppSec raporu `docs/kanit/0008-appsec.md`; S-02 için metin değişikliği geri alındı (REQ-7 imzalı haliyle), açık iş B35.
- Ruling: yazar işleri ana oturum yerine `polyglot-engineer`'a verildi — token ekonomisi — yanlışsa yeniden yazım gerekmez, yalnız rol sapması; doğrulayıcı ayrı birimler.
