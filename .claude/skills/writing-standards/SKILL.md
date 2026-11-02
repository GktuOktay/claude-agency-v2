---
name: writing-standards
description: Ortak standart: müşteriye ve kamuya dönük Türkçe metinde "yapay zeka sesi" kalıplarını önlemek, kısa konuşma (caveman) modunun sınırlarını belirlemek ve metni harness/bin/humanize-check.js ile denetletmek. Metin üreten tüm birimler için.
---

# Yazım standardı: çalışma kılavuzu v0.1

## Amaç
Müşteriye, kamuya ve karar vericiye giden metnin **insan sesiyle, açık ve doğrulanabilir** olması (WR-02). İngilizce kalıplara dayalı hazır araçlar Türkçede yetmez; burada Türkçe kural seti ve mekanik denetim vardır.

## Girdiler
- Yazılacak/denetlenecek metin ve okuyucusu (müşteri, kamu, CEO).
- Marka kılavuzu (`docs/marka/marka-kilavuzu.md`) varsa ses örnekleri.
- Mekanik denetim: `node harness/bin/humanize-check.js <dosya>` (ana oturum çalıştırır).

## Yöntem
1. **Kısa konuşma modunun sınırı:** yalnızca CEO ile sohbette ve durum mesajlarında. Spec, güvenlik raporu, hukuk/uyum, müşteri/pazarlama/mağaza metni, hata mesajı, dış doküman ve commit/PR açıklamasında **kapalı** (tam cümle, tam anlam). Anayasa bunu zaten böyle söyler; bu kılavuz uygulama notudur.
2. **Türkçe yapay-ses kalıpları (kaçın):**
   - Boş giriş/kapanış: "Günümüzün hızla değişen dünyasında", "dijital çağda", "Sonuç olarak", "Özetle", "Bu bağlamda" yığılması.
   - Abartı ve şişirme: "devrim niteliğinde", "çığır açan", "benzersiz", "eşsiz", "kusursuz", "hayatınızı kolaylaştıran", "en iyi çözüm".
   - Boş kalıp: "önemli bir rol oynar", "büyük önem taşır", "dikkat çekmektedir", "söz konusudur", "göz önünde bulundurulmalıdır".
   - Edilgen yığılma: "yapılmaktadır", "sağlanmaktadır", "gerçekleştirilmektedir" üst üste; özneyi ve eylemi söyle.
   - Üçlü liste ve "sadece X değil, aynı zamanda Y" kalıbı ile eş yapılı cümleler dizisi.
   - Gereksiz uzun tire (—) ve emoji ile süsleme; her paragrafta aynı yapıda başlık-madde.
   - Soru-cevap taklidi ("Peki bu ne anlama geliyor?").
3. **Yerine ne yaz:** somut özne + eylem + sayı/örnek. "Giriş ekranı artık parolayı hatırlıyor." > "Kullanıcı deneyimi iyileştirilmiştir."
4. **Yazıdan önce okuyucuyu ve tek mesajı belirle**; metnin ilk cümlesi o mesajdır.
5. **Mekanik denetim:** metni dosyaya yazdıktan sonra `humanize-check.js` çıktısını al; "UYARI" satırlarını düzelt; "HATA" (mutlak/kanıtlanamaz iddia) kalmamalı. Araç sınırlı bir kalıp listesidir: temiz çıkması metnin iyi olduğunu kanıtlamaz, yalnızca bilinen kalıpların yokluğunu gösterir.
6. **Okuma testi:** metni bir yabancıya yüksek sesle okur gibi oku; takıldığın cümleyi böl veya sil.
7. **Kısa konuşma dışı özel durumlar:** komut satırı çıktısı ve kod blokları çevrilmez; teknik terim İngilizce kalabilir ama ilk geçişte Türkçe açıklanır.

## Çıktı şablonu
Denetlenen metnin altına veya raporuna:
```
Yazım denetimi: <dosya> | Araç: humanize-check.js | Sonuç: TEMİZ | UYARI n | HATA n
Düzeltilenler: ...
Bilinçli bırakılanlar (neden): ...
```

## Kontrol listesi
- [ ] Okuyucu ve tek mesaj belli; ilk cümle o mesaj.
- [ ] Kısa konuşma modu bu metinde kapalı.
- [ ] `humanize-check.js` çalıştırıldı; HATA yok, UYARI'lar düzeltildi ya da gerekçeli bırakıldı.
- [ ] Mutlak ve kanıtlanamaz iddia yok ("en iyi", "%100", "garantili").
- [ ] Edilgen yığılma ve boş kalıp temizlendi; cümleler somut.
- [ ] Teknik terimler ilk geçişte açıklandı.

## Yasaklar
- Müşteri, kamu veya hukuk metninde kısa konuşma modu.
- Araç temiz çıktı diye metni "iyi" ilan etmek; aracı atlatmak için kelime değiştirip anlamı bozmak.
- Kanıtlanamayan üstünlük/mutlak iddia; başka yazarın metnini çoğaltmak.
- Metni insan yazmış gibi göstermek için sahte imza veya sahte yorum eklemek.

## Araçlar ve izinler
Okuma ve yazma araçları (metni üreten birimin kendi alanı). Mekanik denetim `harness/bin/humanize-check.js`: ağ yok, yalnızca dosyayı okur, kalıp listesiyle eşleştirir; ana oturum çalıştırır.

## Durma ve yükseltme
- Okuyucu veya mesaj belirsiz (Tip 1) → dur, öneriyle sor.
- Metin hukuki/sözleşme niteliğinde → "AVUKAT GEREKİR", Kalite ofisine yönlendir.
- Denetimde HATA kalıyor ve düzeltme anlamı değiştiriyor → CEO'ya sor, aracı değil metni düzelt.

## Örnekler
- Kötü: "Günümüzün hızla değişen dünyasında uygulamamız devrim niteliğinde bir deneyim sunmaktadır."
- İyi: "Uygulama, bağlantı koptuğunda yazdıklarını saklar ve bağlantı gelince gönderir."
- Kötü hata metni: "İşlem gerçekleştirilememiştir." İyi: "Kaydedilemedi. Bağlantını kontrol edip tekrar dene."
