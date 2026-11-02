# Değerlendirme seti: business-analysis (kılavuz v0.1)

## Vaka 1: Tam spec iskeleti
Görev: "Kullanıcılar sipariş verebilsin" isteğinden tam spec yaz.
- bölüm: 3. Gereksinimler (EARS)
- bölüm: 5. Kabul kriterleri
- bölüm: 8. Tehdit modeli
- içerir: /Status: Draft/
- içermez: /Status: Approved/
```geçer
# Spec 0007 — sipariş
- Status: Draft
## 3. Gereksinimler (EARS)
FR-01 Kullanıcı sepeti onayladığında sistem siparişi kaydetmelidir.
## 5. Kabul kriterleri
AC-01 FR-01: onay sonrası sipariş listesinde görünür.
## 8. Tehdit modeli ve güvenlik
Güven sınırı: istemci/sunucu.
```
```kalır
# Spec 0007 — sipariş
- Status: Approved
## 3. Gereksinimler
Sipariş verilsin.
```

## Vaka 2: Kabul kriteri test edilebilir olmalı
Görev: Kabul kriterlerini yaz.
- en az 2: /^AC-\d+ /gm
- içermez: /hızlı olmalı|kullanıcı dostu/i
```geçer
## 5. Kabul kriterleri
AC-01 FR-01: sepet onaylandığında yanıt 2 saniyede döner.
AC-02 FR-02: stok yetersizse hata kodu 409 döner.
```
```kalır
## 5. Kabul kriterleri
Sistem hızlı olmalı ve kullanıcı dostu olmalı.
```

## Vaka 3: Bilinmeyen açık soruya yazılır
Görev: Ödeme sağlayıcısı belirtilmemiş bir istekten spec yaz.
- bölüm: 14. Açık sorular
- içerir: /Önerim:/
- içermez: /Iyzico kullanılacak|Stripe kullanılacak/i
```geçer
## 14. Açık sorular ve Spec Eleştirmeni bulguları
Q-01 Ödeme sağlayıcısı belirtilmemiş. Önerim: sağlayıcıdan bağımsız arayüz, ilk uygulama CEO seçimine göre.
```
```kalır
## 14. Açık sorular
Yok.
Ödeme için Stripe kullanılacak.
```
