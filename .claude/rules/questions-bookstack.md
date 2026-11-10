# CEO'ya sorular BookStack üzerinden (tüm projeler)

CEO'ya her yeni karar sorusu, projenin BookStack rafındaki **"Sorular"** sayfasına (**Sorular** kitabı) yazılır. Sohbette tek başına sorulmaz; sohbette yalnız "Sorular sayfasına işledim" denir. Yeni bir onay sayfası açılmaz: onay, push izni, silme izni dahil her soru bu tabloya girer.

## Prensip: sorular ve kararlar ayrı kitaplarda (tüm projeler, CEO kararı 2026-11-09)

- **Sorular** kitabı: CEO'dan cevap ya da iş bekleyen her şey (`Sorular`, `Beklenenler`, soru turu sayfaları, S-n soru sayfaları). CEO yalnız bu kitabı izler.
- **Kararlar** kitabı: verilmiş kararlar (Karar Kaydı, spec karar özetleri). Yalnız eklenir, aksiyon beklemez.
- ADR'ler **Mimari Kararlar (ADR)** kitabındadır.
- İkisi aynı kitapta birleştirilmez. Yeni proje `masa-proje.py init` ile bu iki kitapla açılır (standart: `proje-masasi/altlik/ALTLIK.md`).

- Sayfa adı tam olarak `Sorular` olmalı. Üst çubuktaki zil adı `Sorular` olan tüm sayfaları otomatik bulur.
- Yeni soru, `## Cevap bekleyenler` tablosuna `| # | Soru | Öneri | Kaynak | Durum |` biçiminde, Durum = `Açık` ile eklenir. Soru numarası projede benzersizdir (S-n, D-n, T-n).
- Her yeni satırın Kaynak sütununun sonuna eklenme zamanı yazılır: `· 2026-11-08 22:10` (İstanbul saati). Zil bunu okur.
- CEO sayfaya yorum yazdığı an, o yorumdan önce eklenmiş tüm açık sorular zilden düşer (numara gerekmez). Yorumdan sonra eklenen sorular açık kalır.
- Cevaplanan soru işlenince tablodan `## Cevaplananlar`a taşınır, Durum = `Karar`, Kararlar kitabındaki Karar Kaydı'na işlenir.
- Projenin rafı yoksa önce raf ve `Sorular` sayfası açılır (şablon: TwitterAnalytic › Sorular).
- Kaynak: `~/Desktop/Projects/proje-masasi/bookstack/custom-head.html` (zil betiği), `bin/bs_apply_theme.sh` ile uygulanır.

## İkinci bildirim: "Beklenenler" (senden beklenen işler)

- Karar sorusu → `Sorular` sayfası (zil). CEO'nun yapması gereken iş (arşiv iste, güncelle, indir, onay dışı bir eylem) → Sorular kitabında **`Beklenenler`** sayfası (ayrı rozet, turuncu pano simgesi). İkisi karıştırılmaz.
- Satır biçimi `Sorular` ile aynı: `| # | Ne yapılacak | Nasıl / öneri | Kaynak · eklenme zamanı | Durum |`, Durum = `Açık`, numara `B-n`.
- CEO sayfaya yorum yazınca ("yaptım"), yorumdan önce eklenmiş tüm açık işler düşer; işlenince `## Yapılanlar`a taşınır.
