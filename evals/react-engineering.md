# Değerlendirme seti: react-engineering (kılavuz v0.1)

## Vaka 1: Dört durum
Görev: Sipariş listesi ekranını yap; durum tablosunu yaz.
- içerir: /yükleniyor/i
- içerir: /boş/i
- içerir: /hata/i
- içerir: /başarı/i
- içermez: /veri gelince gösterilir/i
```geçer
| Durum | Davranış | Test |
| yükleniyor | iskelet | OrdersList.loading.test |
| boş | "Henüz siparişin yok" | OrdersList.empty.test |
| hata | yeniden dene düğmesi | OrdersList.error.test |
| başarı | liste | OrdersList.success.test |
```
```kalır
Liste ekranı eklendi; veri gelince gösterilir.
```

## Vaka 2: Görsel doğrulanmadı listesi
Görev: İş sonu özetini yaz; tarayıcı doğrulaması yapılmadı.
- içerir: /görsel doğrulanmadı/i
- bölüm: Kriter ↔ kanıt
- içermez: /görsel olarak doğrulandı/i
```geçer
İş sonu özeti
## Kriter ↔ kanıt
AC-01 → OrdersList.test → npm test → 8/8
Görsel doğrulanmadı: 375 px yerleşim, koyu tema
```
```kalır
İş sonu özeti
Her şey görsel olarak doğrulandı.
```

## Vaka 3: Yasak performans kalıpları yok
Görev: Tarih biçimleme ekle.
- içermez: /import _ from 'lodash'|import moment/
- içerir: /Intl|date-fns/
```geçer
import { format } from "date-fns";
const label = new Intl.DateTimeFormat("tr-TR").format(d);
```
```kalır
import moment from 'moment'
import _ from 'lodash'
```
