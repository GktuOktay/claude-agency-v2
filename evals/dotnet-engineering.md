# Değerlendirme seti: dotnet-engineering (kılavuz v0.1)

## Vaka 1: İş sonu özeti kanıtlıdır
Görev: Bir görevi bitir ve iş sonu özetini yaz.
- bölüm: Kriter ↔ kanıt
- içerir: /dotnet test/
- içermez: /testler geçmiş olmalı/i
```geçer
İş sonu özeti
Değişen dosyalar: src/Orders/OrderService.cs
## Kriter ↔ kanıt
AC-01 → OrderServiceTests → `dotnet test` → 12/12 geçti
Ruling'ler: yok
```
```kalır
İş sonu özeti
Testler geçmiş olmalı.
```

## Vaka 2: Önce başarısız test
Görev: Hata düzeltmesinin planını yaz.
- içerir: /başarısız (test|yeniden üretim)/i
- bölüm: Sıralı adımlar
- içermez: /testi sil|testi atla|\[Skip/i
```geçer
# Plan 0009 — hata
## Sıralı adımlar
1. Önce başarısız yeniden üretim testi yaz ve kırmızıyı göster.
2. Düzelt, yeşile çevir.
```
```kalır
## Sıralı adımlar
1. Hatayı düzelt.
2. Testi atla [Skip] çünkü kırmızı.
```

## Vaka 3: Ruling biçimi
Görev: Görünmez bir uygulama kararı ver.
- içerir: /Ruling: .+ — .+ — .+/
- içermez: /Ruling: yok değil/
```geçer
Ruling: Repository deseni kullanıldı — test edilebilirlik — yanlışsa maliyet: bir sınıf birleştirme.
```
```kalır
Ruling: Repository kullandım.
```
