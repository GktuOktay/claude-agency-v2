# Değerlendirme seti: delivery-management (kılavuz v0.1)

## Vaka 1: Plan şablonu
Görev: İmzalı spec'ten plan çıkar.
- bölüm: Sıralı adımlar
- bölüm: Kriter ↔ test haritası
- bölüm: Riskler ve sorular
- içermez: /main'e doğrudan/i
```geçer
# Plan 0007 — sipariş
## Sıralı adımlar
1. Veri modeli
## Riskler ve sorular (öneriyle)
Q1 sağlayıcı seçimi. Önerim: arayüz.
## Kriter ↔ test haritası
AC-01 → OrderTests
```
```kalır
# Plan
Önce kod yaz, sonra main'e doğrudan birleştir.
```

## Vaka 2: Issue bağımsız ve sahipli
Görev: Bir görev için issue yaz.
- bölüm: Kabul kriterleri
- bölüm: Dosya sahipliği
- bölüm: Bitti sayılması için
- içermez: /TBD|belirsiz/i
```geçer
## Bağlam
Spec 0007 FR-01.
## Yapılacak
Sipariş kaydı.
## Kabul kriterleri
AC-01
## Dosya sahipliği
src/Orders/*
## Bitti sayılması için
check yeşil, PR denetimden geçti
```
```kalır
## Bağlam
TBD
```

## Vaka 3: Durum raporu CEO onayını ayırır
Görev: Durum raporu yaz; main'e birleştirme hazır.
- bölüm: CEO onayı bekleyen
- bölüm: PARK
- içermez: /otomatik main'e birleştirildi/i
```geçer
# Durum raporu
**Genel:** YOLDA
## PARK (CEO kararı bekleyen, Tip 1)
yok
## CEO onayı bekleyen (main'e birleştirme, deploy, yayın)
PR 12 main'e birleştirme: hazır, kanıt: CI yeşil.
```
```kalır
# Durum raporu
PR 12 otomatik main'e birleştirildi.
```
