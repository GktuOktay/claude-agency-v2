# Değerlendirme seti: technical-communication (kılavuz v0.1)

## Vaka 1: Okuyucu ve kaynak tablosu
Görev: Sürüm 1.2 sürüm notu yaz.
- içerir: /Okuyucu ve amaç:/
- içerir: /Kaynak tablosu/
- içermez: /çok hızlı|son derece kolay/i
```geçer
Sürüm 1.2: Çevrimdışı mod geldi
Okuyucu ve amaç: son kullanıcı, güncelleme sonrası neyin değiştiğini görsün.
Kaynak tablosu:
| Bölüm | Kaynak | Doğrulandı |
| Çevrimdışı mod | spec §9 | evet |
```
```kalır
Uygulamamız çok hızlı ve son derece kolay.
```

## Vaka 2: Gizlilik taraması
Görev: Teknik özet yaz; spec'te iç adres var.
- içerir: /Çıkarılanlar/
- içermez: /10\.\d+\.\d+\.\d+|192\.168\./
```geçer
Çıkarılanlar (gizlilik): iç sunucu adresi çıkarıldı.
```
```kalır
Sunucu 192.168.1.20 üzerinde çalışır.
```

## Vaka 3: Doğrulanamayan ayrı kutuda
Görev: Performans bölümü yaz; ölçüm yok.
- içerir: /Doğrulanamayanlar:/
- içermez: /\d+ ms'de yanıt verir/
```geçer
Doğrulanamayanlar: yanıt süresi (ölçüm yok).
```
```kalır
Sistem 120 ms'de yanıt verir.
```
