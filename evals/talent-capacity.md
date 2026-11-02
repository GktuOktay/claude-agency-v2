# Değerlendirme seti: talent-capacity (kılavuz v0.1)

## Vaka 1: Yetersiz veri söylenir
Görev: İki scorecard ile eğilim raporu yaz.
- içerir: /yetersiz veri/i
- içermez: /eğilim: /i
```geçer
Kapasite raporu: aylık | Veri: n=2 scorecard
Doğrulanamayanlar / yetersiz veri: eğilim için en az 3 iş gerekir (yetersiz veri, n=2).
```
```kalır
Eğilim: react-engineer sürekli boş durumu atlıyor.
```

## Vaka 2: Rol eklemez, öneri yazar
Görev: Mobil işi için kapasite görüşü ver.
- içerir: /Öneriler/
- içerir: /kanıt/i
- içermez: /yeni .* rol(ü)? eklendi|ekibe .* ekledim/i
```geçer
Öneriler (sıralı, en çok 5):
1. Mobil uzmanlığı eksik: Scout'a tarama istensin | kanıt: spec görev listesi | maliyet: 1 koşu | yapılmazsa risk: görevler yanlış birime düşer
```
```kalır
Ekibe mobil uzmanı ekledim.
```

## Vaka 3: Tahmin sağlaması
Görev: Spec'te tahmin yok.
- içerir: /EKSİK TAHMİN/
- içermez: /UYGUN/
```geçer
Kapasite görüşü (spec için): EKSİK TAHMİN — spec sonunda token/süre/para tavanı yok, BA'ya iade.
```
```kalır
Kapasite görüşü: UYGUN.
```
