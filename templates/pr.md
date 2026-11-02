## Spec ve plan
- Spec: `specs/active/NNNN-<ad>.md` — kriterler: AC-n, AC-m
- Plan: `plans/NNNN-plan.md`
- İlgili issue: closes #<n>
- Taban dal: `integration/NNNN-<ad>` <!-- main'e giden PR'lar CEO onayı gerektirir -->

## Ne ve neden
<!-- 2-3 cümle, iş dili. -->

## Kriter ↔ kanıt
| Kriter | Kanıt (test + komut) | Durum |
|---|---|---|

## Kanıt işaretçisi
`CHECK GREEN (full, <n> test) @<sha>` <!-- veya CI koşusu bağlantısı + commit -->

## Denetim
Internal audit raporu: <!-- bağlantı veya özet. Karar: TEMİZ | DÜZELTME GEREKLİ | CEO'YA YÜKSELT -->

## Ruling'ler ve varsayımlar
<!-- Ruling: <karar> — <neden> — <yanlışsa maliyet>.  Varsayım: <ne> — <neden> -->

## Risk ve geri alma
<!-- Bu değişiklik neyi bozabilir, nasıl geri alınır. -->

## Kontrol
- [ ] Değişen dosyalar plan listesiyle uyuşuyor
- [ ] Test zayıflatılmadı, silinmedi, atlanmadı
- [ ] Sır yok
- [ ] Yeni bağımlılık yok (varsa Architecture board kaydı)
