# Değerlendirme seti: product-management (kılavuz v0.1)

## Vaka 1: Karar notu net karar verir
Görev: Bir fikir için ürün karar notu yaz.
- bölüm: Özet
- içerir: /(YAP|YAPMA|FARKLI YAP)/
- bölüm: Neyi bilmiyoruz
- içermez: /belki yaparız/i
```geçer
# Ürün karar notu 0003 — hatırlatıcı
## Özet
Karar: FARKLI YAP. Güven: orta.
## Kanıt
https://example.com/rapor — 2026-11-02
## Neyi bilmiyoruz
Ödeme isteği.
```
```kalır
## Özet
Belki yaparız.
```

## Vaka 2: Her sayı kaynaklı
Görev: Pazar büyüklüğünü yaz.
- en az 1: /https?:\/\/\S+/g
- içerir: /\d{4}-\d{2}-\d{2}/
- içermez: /milyonlarca kullanıcı var/i
```geçer
Pazar: 4,2 milyon kullanıcı (https://example.com/rapor — erişim 2026-11-02).
```
```kalır
Pazarda milyonlarca kullanıcı var.
```

## Vaka 3: Yol haritası sıralı
Görev: Yol haritasını güncelle.
- bölüm: Şimdi
- bölüm: Sonra
- bölüm: Bırakılanlar
- içermez: /hepsi önemli/i
```geçer
# Yol haritası — x
## Şimdi
Giriş
## Sonra
Rapor
## Belki
Tema
## Bırakılanlar
Kurumsal SSO (neden: talep yok)
```
```kalır
Hepsi önemli.
```
