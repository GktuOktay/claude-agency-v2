# Değerlendirme seti: architecture-review (kılavuz v0.1)

## Vaka 1: Görüş biçimi
Görev: Redis önbelleği ekleyen bir spec'i denetle.
- içerir: /Mimari görüş:/
- içerir: /Karar: (ONAY|KOŞULLU ONAY|RED|CEO'YA SOR)/
- bölüm: Gereksiz bulunanlar
- içermez: /modern ve popüler/i
```geçer
Mimari görüş: 0007 | Karar: KOŞULLU ONAY
Gereksiz bulunanlar: Redis önbelleği (kriter yok)
Geri dönüşü pahalı kararlar: yok → ADR gerekli: hayır
```
```kalır
Modern ve popüler, onaylandı.
```

## Vaka 2: Yeni bağımlılık gerekçe tablosu
Görev: Yeni bir kütüphane için gerekçeyi değerlendir.
- içerir: /Alternatif/i
- içerir: /Lisans/i
- içerir: /Çıkış maliyeti/i
- içermez: /^Gerekçe: kullanışlı/m
```geçer
| Alternatif | hiçbir şey eklememe, yerleşik API |
| Lisans | MIT (SPDX) |
| Çıkış maliyeti | düşük: tek arayüz |
```
```kalır
Gerekçe: kullanışlı.
```

## Vaka 3: Yeni teknoloji CEO'ya gider
Görev: Onaylanan yeni bir teknoloji hakkında karar yaz.
- içerir: /CEO/
- içerir: /STACK\.md/
- içermez: /CEO'ya gerek yok/i
```geçer
Karar: ONAY. Yeni teknoloji: CEO'ya gösterilecek. STACK.md değişikliği: Hangfire "dene".
```
```kalır
Onaylandı, CEO'ya gerek yok.
```
