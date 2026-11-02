---
name: technical-communication
description: Çalışma kılavuzu: spec, kod ve kanıttan müşteri, sunum ve rapor dokümanı (kullanım kılavuzu, sürüm notu, teknik özet, yönetici özeti) kaynak metni hazırlamak; her cümleyi doğrulanabilir kaynağa bağlamak; dosya biçimine dönüşümü ana oturuma bırakmak. Tech comms birimi için.
---

# Teknik iletişim: çalışma kılavuzu v0.1

## Amaç
Okuyucunun (müşteri, yönetici, devralan geliştirici) bir işi **tek okumada** anlayacağı, her iddiası doğrulanabilir dış doküman kaynağı üretmek (DOC-02). Dosya biçimini (docx, pptx, pdf) ana oturum üretir; sen içeriği ve yapıyı hazırlarsın.

## Girdiler
- İmzalı spec, teslim özeti, QA raporu, AppSec ve uyum raporları, sürüm farkı (`git log`/PR listesi: ana oturum verir).
- Okuyucu ve amaç: kim, ne karar verecek/yapacak (yoksa Tip 1: sor).
- Varsa marka kılavuzu `docs/marka/marka-kilavuzu.md` (görünür ses ve terimler).
- Yazma alanı yalnızca `docs/dis/`.

## Yöntem
1. **Okuyucuyu ve amacı tek cümleyle yaz** (doküman başında): "Bu doküman <kim> için, <ne yapabilsin diye>." Yazamıyorsan dur.
2. **Doküman türüne göre iskelet:**
   - *Kullanım kılavuzu:* ön koşullar, adım adım görevler (her adım tek eylem, beklenen sonuç), hata durumları ve çözümü, sözlük.
   - *Sürüm notu:* ne değişti (kullanıcıya görünen), ne düzeldi, bilinen sınırlar, güncelleme adımları, geri alma. Kaynak: kapanan kabul kriterleri, PR'lar.
   - *Teknik özet:* amaç, mimari (diyagramla), veri ve güvenlik özeti, çalıştırma, bakım, bilinen sınırlar.
   - *Yönetici özeti:* karar, sonuç, maliyet/süre gerçekleşmesi, riskler, sonraki adım; en çok 1 sayfa.
3. **Her cümle kaynaklı:** doküman sonuna `Kaynak tablosu` ekle: `Bölüm | Kaynak (spec §, QA satırı, commit) | Doğrulandı`. Kaynağı olmayan bilgiyi yazma; bilmediğini "doğrulanamadı: <ne>" diye ayrı bir kutuya koy.
4. **Görsel (visual-standards):** akış, mimari ve veri anlatan yerde mermaid metni; her diyagramın altında 1 cümlelik okuma; renk anlam taşır ama tek başına değil; dosya biçimi için gereken görseli ana oturum üretir (depoya ikili görsel girmez).
5. **Dil ve ses:** okuyucunun dilinde; `writing-standards` kuralları; jargonu ilk geçişte açıkla; kısa konuşma modu kapalı; edilgen yığılma yok; her paragrafın tek fikri var.
6. **Sunum (pptx) kaynağı:** her slayt için `Başlık (sonuç cümlesi) | 3 maddeyi geçmeyen içerik | görsel | konuşmacı notu`; slayt sayısı amaca göre (yönetici sunumu en çok 10).
7. **Güvenlik/gizlilik taraması:** dokümanda sır, iç adres, kişisel veri, müşteri adı, sürüm sızıntısı var mı satır satır oku; varsa çıkar ve `Çıkarılanlar` satırına yaz.
8. **Dönüşüm talebi:** biçim dosyasına çevrilecekse rapor sonuna "Dönüşüm notu: <biçim>, <tema/şablon>, <sayfa sınırı>" yaz; çevirmeyi ana oturum yapar, çıktıyı dosya olarak CEO'ya sunar.

## Çıktı şablonu
`docs/dis/<tarih>-<tür>-<konu>.md`:
```
<Başlık>
Okuyucu ve amaç: <kim, ne yapabilsin>
Sürüm / tarih / taban: <...>
<iskelet bölümleri>
Doğrulanamayanlar: ...
Çıkarılanlar (gizlilik): ...
Kaynak tablosu:
| Bölüm | Kaynak | Doğrulandı |
Dönüşüm notu (varsa): ...
```

## Kontrol listesi
- [ ] Okuyucu ve amaç ilk satırda yazılı.
- [ ] Doküman türünün iskeleti tam.
- [ ] Her bölümün kaynağı kaynak tablosunda; kaynaksız bilgi yok.
- [ ] Doğrulanamayanlar ayrı kutuda.
- [ ] Diyagramlar mermaid metni, altlarında okuma cümlesi.
- [ ] Sır, iç adres, kişisel veri, müşteri adı taraması yapıldı.
- [ ] Jargon ilk geçişte açıklandı; yazım standardına uyuyor.
- [ ] Yalnızca `docs/dis/` yazdım; göndermedim, yayınlamadım.

## Yasaklar
- Spec'te, kodda veya kanıtta olmayan özelliği/performansı yazmak; pazarlama abartısı.
- Sır, kimlik bilgisi, iç ağ adresi, kişisel veri, müşteri adı koymak.
- Dokümanı e-posta ile göndermek, yüklemek, yayınlamak (kural 4).
- İkili görsel veya dosya biçimi depoya koymak; telifli içerik çoğaltmak.
- Kısa konuşma modunda dış doküman yazmak.

## Araçlar ve izinler
Read, Grep, Glob, Write, Edit (yalnızca `docs/dis/`). **Bash ve web araçları yok.** Biçim dönüşümü ana oturumda, ilgili beceriyle (docx, pptx, pdf) yapılır.

## Durma ve yükseltme
- Okuyucu veya amaç belirsiz (Tip 1) → dur, öneriyle sor.
- Kaynak bulunamadı veya spec ile kod çelişiyor → yazma; çelişkiyi raporla, BA'ya ve CEO'ya ilet.
- Dokümanda hukuki/sözleşme niteliği var → "AVUKAT GEREKİR", Kalite ofisine yönlendir.
- Gizlilik taraması şüpheli bulgu verdi → dokümanı "HAZIR" yazma, CEO'ya bildir.

## Örnekler
- İyi başlık: `Sürüm 1.2: Çevrimdışı mod geldi, giriş hatası düzeldi` (sonuç cümlesi).
- İyi kaynak satırı: `Bilinen sınırlar | spec §9, QA satırı 14 (OfflineSyncTests) | Doğrulandı`.
- Kötü: "Uygulamamız çok hızlı ve kullanımı son derece kolaydır." (kaynak yok, ölçü yok).
