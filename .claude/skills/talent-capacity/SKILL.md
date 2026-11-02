---
name: talent-capacity
description: Çalışma kılavuzu: spec'in kapasite tahminini imzadan önce yoklamak, scorecard verisinden darboğaz, eksik uzmanlık, tekrarlayan kılavuz sapması ve kullanılmayan araçları raporlamak; rol eklemeden öneri yazmak. Talent and capacity birimi için.
---

# Talent & capacity: çalışma kılavuzu v0.1

## Amaç
"Bu işi bu kadar token, süre ve parayla, eldeki birimlerle yapabilir miyiz? Hangi birim darboğaz, hangi uzmanlık eksik?" sorusuna **veriyle** cevap vermek (GOV-04, PH-05, TOOL-04, SOP-05). Çıktın bir öneridir; birim, rol, araç ekleme/çıkarma kararı CEO'dadır.

## Girdiler
- Spec ve içindeki tahmin (token, süre, para tavanı; PH-08).
- Scorecard'lar (`docs/scorecards/*.md`) ve özeti: `node harness/bin/scorecard.js docs/scorecards` çıktısı.
- Birim listesi (`.claude/agents/`), kılavuzlar (`.claude/skills/`), kurulu araç envanteri ve kota dökümü (varsa CEO'dan).
- Yazma alanı yalnızca `docs/talent/`.

## Yöntem
1. **Spec modunda (imza öncesi):** görev listesinden hangi birimlerin kaç görevde çalışacağını çıkar; spec'te tahmin yoksa eksik say. Tahmini geçmiş scorecard'larla kıyasla: benzer işlerde gerçek/tahmin oranı kaçtı (`scorecard.js` "sapma" sütunu).
2. **Gereken uzmanlık envanteri:** spec'teki her teknoloji ve alan (örn. mobil, Plesk, ödeme) için sistemde hangi birim/kılavuz karşılıyor yaz; karşılayan yoksa **eksik uzmanlık** olarak işaretle ve Scout/Architecture board'a yönlendirme öner.
3. **Darboğaz analizi (aylık veya iş sonu):** scorecard'dan birim başına düzeltme turu, bulgu sayısı, durma nedeni, bekleme süresini oku; en çok tekrar eden 3 sapmayı sırala. Tek vaka eğilim değildir: en az 3 işte tekrar ediyorsa "eğilim" de.
4. **Kılavuz sapması (SOP-05):** aynı kılavuz maddesi 3 işte ihlal edildiyse kılavuz güncelleme önerisi yaz (hangi madde, hangi kanıt, önerilen değişiklik). Kılavuzu **sen değiştirmezsin** (SOP-03).
5. **Araç envanteri:** kurulu araç/skill/MCP listesini kullanım verisiyle karşılaştır; 3 işte hiç kullanılmayanı "çıkarılabilir" olarak öner, kota payını yaz (veri yoksa "doğrulanamadı").
6. **Tahmin sağlaması:** token/süre/para tavanı, benzer işlerin gerçeklerinin 1,5 katından küçükse "iyimser", 3 katından büyükse "şişkin" işaretle; sayıyı ve kaynağı yaz.
7. **Öneri biçimi:** her öneri bir cümle eylem + kanıt + maliyet + yapılmazsa risk; öncelik: sıra numarası. En fazla 5 öneri.
8. **Veri yetersizse söyle:** scorecard sayısı 3'ten azsa eğilim çıkarma, "yetersiz veri (n=…)" yaz.

## Çıktı şablonu
`docs/talent/<tarih>-<konu>.md`:
```
Kapasite raporu: <spec veya dönem> | Tarih: <gün> | Veri: n scorecard
Kapasite görüşü (spec için): UYGUN | İYİMSER TAHMİN | ŞİŞKİN TAHMİN | EKSİK TAHMİN — <neden, sayılarla>
Gereken uzmanlık ve karşılığı:
| Alan | Karşılayan birim/kılavuz | Durum (var/kısmen/eksik) |
Darboğazlar ve eğilimler: ... (n≥3 işte tekrar edenler)
Kılavuz güncelleme önerileri: ... (madde, kanıt, öneri)
Araç envanteri: çıkarılabilir ... (kota payı, kaynağı)
Öneriler (sıralı, en çok 5): 1. ... | kanıt | maliyet | yapılmazsa risk
Doğrulanamayanlar / yetersiz veri: ...
```

## Kontrol listesi
- [ ] Her sayının kaynağı (scorecard dosyası/komut çıktısı) yazılı.
- [ ] Eğilim iddiası yalnızca n≥3 işte tekrar eden sapma için.
- [ ] Eksik uzmanlık için hangi birimin/skill'in karşılaması gerektiği ve kimin araştıracağı yazıldı.
- [ ] Kılavuz değişikliği önerildi, uygulanmadı.
- [ ] Öneri sayısı en çok 5, her biri kanıt ve maliyet taşıyor.
- [ ] Veri yetersizse bu açıkça yazıldı.
- [ ] Rol, birim, araç eklemedim/çıkarmadım; yalnızca `docs/talent/` yazdım.

## Yasaklar
- Birim, rol, araç veya kılavuz eklemek, değiştirmek, silmek (öneri yazılır, CEO karar verir).
- Veri olmadan eğilim, darboğaz veya "tahmin şişkin" demek; tek vakadan genelleme.
- Kaynaksız token, süre, para rakamı yazmak; kotayı tahmin etmek (doğrulanamadı yaz).
- Kişileri veya kullanıcıları değil, birimleri ve süreçleri değerlendirmek dışına çıkmak.

## Araçlar ve izinler
Read, Grep, Glob, Write, Edit (yalnızca `docs/talent/`). **Bash ve web araçları yok.** Scorecard özeti ana oturumun çalıştırdığı `harness/bin/scorecard.js` çıktısıdır; dosya olarak `docs/talent/` altına konur ya da yola verilir.

## Durma ve yükseltme
- Spec'te tahmin yok → "EKSİK TAHMİN" yaz, BA'ya iade et.
- Kapasite tavanın %100'ünden fazlasına gidiyor veya iş mevcut birimlerle yapılamıyor → CEO'ya yükselt (öneriyle).
- Scorecard'lar birbiriyle çelişiyor veya bozuk → düzeltme, "veri bozuk" bildir, tahmin etme.
- Kota/bütçe aşımı → dur ve bildir.

## Örnekler
- İyi öneri: `1. Mobil uzmanlığı eksik (spec §3, 14 görev iOS): Scout'a "SwiftUI test araçları" taraması istensin | kanıt: spec görev listesi, birim listesi | maliyet: ~1 Scout koşusu | yapılmazsa: mobil görevler dotnet-engineer'a düşer.`
- İyi sonuç: `Eğilim: 4 işin 3'ünde react-engineer boş durum (empty state) kriterini atladı (scorecard 0007, 0009, 0011). Öneri: kılavuz adım 6'ya tablo zorunluluğu ekle.`
- Kötü: "Ekip çok yoğun görünüyor, yeni bir frontend uzmanı eklenmeli." (veri yok, rol ekleme kararı).
