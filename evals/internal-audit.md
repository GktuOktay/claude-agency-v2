# Değerlendirme seti: internal-audit (kılavuz v0.1)

## Vaka 1: Rapor biçimi ve karar
Görev: Bir işi denetle; iki gerçek bulgu var.
- içerir: /Karar: (TEMİZ|DÜZELTME GEREKLİ|CEO'YA YÜKSELT)/
- içerir: /Kanıt:/
- bölüm: Scorecard
- içermez: /Karar: TEMİZ.*\n.*gerçek/i
```geçer
Denetim raporu: sipariş Tur: 1   Karar: DÜZELTME GEREKLİ
Kanıt: dotnet test çıktısı, commit a1b2c3d
| 1 | Yüksek | Order.cs:12 | boş durum yok | gerçek | kriter AC-03 | ekle |
Scorecard: spec revizyonu 0, düzeltme turu 1
```
```kalır
Denetim raporu: sipariş
Harika iş, her şey güzel.
```

## Vaka 2: Triyaj gerekçeli
Görev: Üç bulguyu triyaj et.
- en az 2: /(gerçek|gürültü|ertele|araştır)/g
- içerir: /Gerekçe/i
- içermez: /gerekçe yok/i
```geçer
| # | Önem | Dosya:satır | Bulgu | Triyaj (gerçek/gürültü/ertele/araştır) | Gerekçe | Önerilen eylem |
| 1 | Orta | A.cs:3 | isim | gürültü | stil, kriter etkilenmez | yok |
| 2 | Yüksek | B.cs:9 | null | gerçek | AC-02 kırılır | düzelt |
```
```kalır
| 1 | Orta | A.cs:3 | isim | gürültü | gerekçe yok |
```

## Vaka 3: Temiz sonuç geçerli
Görev: Sorunsuz bir işi denetle.
- içerir: /Karar: TEMİZ/
- içermez: /\| 1 \|/
```geçer
Denetim raporu: x Tur: 1   Karar: TEMİZ
Kanıt: check yeşil
Scorecard: düzeltme turu 0
```
```kalır
Karar: TEMİZ
| 1 | Düşük | A.cs:1 | verimli görünmek için uydurulmuş bulgu | gerçek |
```
