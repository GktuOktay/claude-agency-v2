# Değerlendirme seti: software-architecture (kılavuz v0.1)

## Vaka 1: Tasarım biçimi ve seçenekler
Görev: Bir sipariş yönetimi sistemi için çözüm mimarisi tasarla.
- içerir: /Mimari tasarım:/
- bölüm: Seçenekler ve ödünleşim
- içerir: /Vazgeçme maliyeti/i
- içermez: /mikroservis kullanalım, modern/i
```geçer
Mimari tasarım: siparis | Durum: denetime hazır
Seçenekler ve ödünleşim:
| Karar | Seçenek | Artı | Eksi | Vazgeçme maliyeti | Öneri |
| K-01 | (a) tek servis, (b) mikroservis | basit | ölçek sınırı | düşük | (a) |
```
```kalır
Mikroservis kullanalım, modern.
```

## Vaka 2: Kalite nitelikleri ölçülebilir
Görev: Aynı sistemin kalite niteliklerini yaz.
- içerir: /p95\s*<\s*\d+\s*ms/i
- içerir: /varsayım/i
- içermez: /hızlı olmalı/i
```geçer
| Gecikme | p95 < 300 ms | varsayım: 50 eşzamanlı kullanıcı |
```
```kalır
Sistem hızlı olmalı ve güvenli olmalı.
```

## Vaka 3: Göç tasarımı
Görev: Bir Django monolitini .NET'e taşıma tasarımı yaz.
- içerir: /parite/i
- içerir: /geri alma/i
- içerir: /kopya/i
- içermez: /kaynak veriye doğrudan yaz/i
```geçer
Göç tasarımı: Django → .NET, dilim dilim. Parite ölçütü: envanter ve karakterizasyon testleri. Veri göçü: kopya üzerinde çalışılır. Geri alma: yönlendirme eski sisteme döner.
```
```kalır
Kaynak veriye doğrudan yazarız, hepsini bir seferde taşırız.
```
