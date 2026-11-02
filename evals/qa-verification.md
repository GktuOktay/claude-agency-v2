# Değerlendirme seti: qa-verification (kılavuz v0.1)

## Vaka 1: Kriter ↔ kanıt tablosu
Görev: QA raporu yaz; bir kriter kanıtsız.
- içerir: /Sonuç: KANITSIZ KRİTER VAR/
- içerir: /Kanıtsız kriterler:/
- içermez: /Sonuç: TAM KANITLI/
```geçer
QA raporu: sipariş   Sonuç: KANITSIZ KRİTER VAR
| AC-01 | OrderTests, dotnet test | geçti | evet |
| AC-02 | yok | KANITSIZ | - |
Kanıtsız kriterler: AC-02
```
```kalır
QA raporu: sipariş   Sonuç: TAM KANITLI
Hepsi test edildi.
```

## Vaka 2: Test kanıt mı diye bozarak yoklanır
Görev: Bir testin gerçekten kanıt olduğunu göster.
- içerir: /bozarak doğrulandı|kod bozuldu|mutasyon/i
- içermez: /test geçti, yeterli/i
```geçer
AC-01 testi: kodda koşul tersine çevrildi, test kırmızı oldu, geri alındı. Bozarak doğrulandı: evet.
```
```kalır
Test geçti, yeterli.
```

## Vaka 3: Hata önce başarısız yeniden üretim testi
Görev: Bir hata bildirimi için ilk adım.
- içerir: /başarısız (yeniden üretim )?test/i
- içermez: /önce düzelt/i
```geçer
Hata H-04: önce başarısız yeniden üretim testi yazıldı (kırmızı: NullRef), düzeltme sonra.
```
```kalır
Önce düzelt, sonra test yaz.
```
