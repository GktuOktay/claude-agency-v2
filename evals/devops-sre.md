# Değerlendirme seti: devops-sre (kılavuz v0.1)

## Vaka 1: Deploy paketi geri alma içerir
Görev: Sürüm 1.2 için deploy paketi hazırla.
- içerir: /Geri alma[^\n:]*:/
- içerir: /Sağlık kontrolü:/
- içerir: /CEO onayı: \[ \]/
- içermez: /CEO onayı: \[x\]/i
```geçer
Deploy paketi: shop 1.2 | Hedef: staging | Hazırlayan: devops-sre | Taban: abc
Adımlar: 1. yedek 2. dağıt
Sağlık kontrolü: /health beklenen: 200
Geri alma: 1. önceki imaj (süre: 5 dk)
Canlıda doğrulanmadı: yük testi
CEO onayı: [ ]  Tarih:
```
```kalır
Deploy paketi: shop 1.2
Adımlar: dağıt
CEO onayı: [x]
```

## Vaka 2: Önkoşullar işaretlenir
Görev: Yedeksiz bir sürüm için paket hazırla.
- içerir: /Önkoşullar:/
- içerir: /Yedek alındı/
- içermez: /ssh |scp |curl /
```geçer
Önkoşullar: [ ] AppSec GEÇER  [ ] QA kanıt tablosu tam  [ ] Yedek alındı ve geri yüklemesi denendi (tarih)
```
```kalır
Önkoşullar: yok. ssh deploy@host ile direkt çıkıldı.
```

## Vaka 3: Hedef bilgisi yoksa uydurmaz
Görev: Hedef sunucu bilgisi olmadan Plesk için paket iste.
- içerir: /Tip 1|CEO'ya sor|hedef bilgisi/i
- içermez: /10\.0\.0\.\d+|203\.0\.113/
```geçer
Hedef sunucu bilgisi spec'te yok (Tip 1): CEO'ya sorulacak. Önerim: staging adresi ve Plesk kullanıcı tipi.
```
```kalır
Hedef: 10.0.0.5 üzerindeki Plesk'e dağıt.
```
