# Değerlendirme seti: application-security (kılavuz v0.1)

## Vaka 1: Sorgu birleştirme kritik bulgudur
Görev: `OrderRepository.cs:42` kullanıcı girdisini SQL metnine ekliyor. Durak B raporu yaz.
- bölüm: AppSec raporu
- içerir: /Karar: GEÇMEZ/
- içerir: /S-01 \[(KRİTİK|YÜKSEK)\]/
- içermez: /Karar: GEÇER/
```geçer
AppSec raporu: sipariş-api | Durak: B (kod) | Taban: a1b2c3d
Özet: KRİTİK 0 · YÜKSEK 1 · ORTA 0 · DÜŞÜK 0 · BİLGİ 0
Karar: GEÇMEZ
S-01 [YÜKSEK] SQL enjeksiyonu | OrderRepository.cs:42 | Kanıt: sorgu string birleştirme | Etki: veri sızar | Öneri: parametreli sorgu
Taranmayanlar: yok
```
```kalır
AppSec raporu: sipariş-api
Karar: GEÇER
Kod genel olarak güvenli görünüyor.
```

## Vaka 2: Her bulgu kanıt taşır
Görev: Üç bulgu içeren bir kod için rapor yaz.
- içerir: /Kanıt:/
- en az 2: /\w+\.\w+:\d+/g
- içermez: /muhtemelen|sanırım|olabilir gibi/i
```geçer
AppSec raporu: x | Durak: B | Taban: b
Karar: GEÇMEZ
S-01 [YÜKSEK] Sır kodda | Config.cs:10 | Kanıt: sabit anahtar | Etki: sızıntı | Öneri: ortam değişkeni
S-02 [ORTA] CORS açık | Startup.cs:55 | Kanıt: AllowAnyOrigin | Etki: kötüye kullanım | Öneri: izin listesi
```
```kalır
S-01 [YÜKSEK] Muhtemelen bir sır var
S-02 [ORTA] Sanırım CORS açık
```

## Vaka 3: Temiz kodda bulgu uydurulmaz
Görev: Güvenlik açığı olmayan küçük bir kod için rapor yaz.
- içerir: /Karar: GEÇER/
- içerir: /Taranmayanlar:/
- içermez: /S-01/
```geçer
AppSec raporu: x | Durak: B | Taban: c
Özet: KRİTİK 0 · YÜKSEK 0 · ORTA 0 · DÜŞÜK 0 · BİLGİ 0
Karar: GEÇER
Taranmayanlar: çalışma zamanı yapılandırması (erişilemedi)
```
```kalır
Karar: GEÇER
S-01 [BİLGİ] Verimlilik için bir bulgu uydurdum
```
