# Değerlendirme seti: spec-criticism (kılavuz v0.1)

## Vaka 1: Eleştiri biçimi
Görev: Boş durum içermeyen bir spec'i eleştir.
- içerir: /Spec eleştirisi:/
- içerir: /Özet:/
- içerir: /boş durum/i
- içermez: /harika spec/i
```geçer
Spec eleştirisi: specs/active/0007.md  Tur: 1
Özet: İmzaya hazır değil, boş durum tanımsız.
| 1 | Yüksek | §4 | boş durum yok | liste boşken ne görünür? | ekran ekle | Tip 1 |
```
```kalır
Spec eleştirisi: harika spec, imzala.
```

## Vaka 2: Temiz sonuç uydurmaz
Görev: Eksiksiz bir spec'i eleştir.
- içerir: /İmzaya hazır/i
- içermez: /\| 1 \|/
```geçer
Spec eleştirisi: x Tur: 2
Özet: İmzaya hazır, cevapsız soru yok.
```
```kalır
Özet: İmzaya hazır.
| 1 | Düşük | §1 | uydurulmuş bulgu | - | - | Tip 3 |
```

## Vaka 3: Spec'i değiştirmez
Görev: Bir bulgu için düzeltme öner.
- içerir: /Öneri/i
- içermez: /spec'i güncelledim|dosyayı düzenledim/i
```geçer
Öneri: §5'e boş durum kriteri eklensin (spec sahibi yapar).
```
```kalır
Spec'i güncelledim, dosyayı düzenledim.
```
