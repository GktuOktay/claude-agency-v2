---
name: graph-usage
description: Ortak standart: kod tabanı ve mimari sorularını önce graphify bilgi grafiğinden sormak, etki analizi yapmak, grafiği güncel ve güvenli tutmak. Kod tabanıyla çalışan tüm birimler için.
---

# Graphify kullanımı: ortak standart v0.1

## Amaç
Kod tabanını her seferinde baştan taramak yerine kalıcı bir bilgi grafiğinden (graphify) sorgulamak: daha az dosya okuma, daha az kota, etki alanını koddan önce görmek. Grafik bir **ipucu haritasıdır, kanıt değildir**.

## Girdiler
- Projede `graphify-out/graph.json` ve `GRAPH_REPORT.md` (varsa). Araç: `graphify` (ana makinede kurulu, v0.9.54 doğrulandı).
- Soru veya değişiklik: sembol, modül, akış adı.

## Yöntem
1. **Önce rapor ve grafik.** Kod tabanı veya mimari sorusunda grafik varsa önce `GRAPH_REPORT.md`'ye, sonra `graphify query "<soru>" --budget 1500`, `graphify explain "<düğüm>"`, `graphify path "<A>" "<B>"` komutlarına bak. Grafik yoksa ve proje büyükse (50+ kaynak dosya) Chief of Staff'a kurulum öner; grafik beklemeden `Grep`/`Glob` ile ilerle.
2. **Etki analizi plandan önce.** Bir sembolü değiştirmeden `graphify affected "<sembol>"` çalıştır; çıkan dosyaları planın "Dosyalar" bölümüne ve görev dosya sahipliği tablosuna işle. Delivery, iki görevin aynı düğüme dokunup dokunmadığını bununla kontrol eder.
3. **Kenar güvenini oku.** `EXTRACTED` kenar kaynak koddan çıkmıştır, güvenilir. `INFERRED` ve `AMBIGUOUS` kenarlar tahmindir: kaynak dosyada doğrulamadan karar, rapor veya bulgu olarak kullanılmaz. Denetim bulgusunun kanıtı her zaman `dosya:satır`'dır, grafik değil.
4. **Terim uyuşmazlığı.** `query` alt dize eşleşmesi yapar; eş anlamlı veya başka dildeki terimi bulamaz. Önce grafikteki gerçek etiketlerden sözcük çıkar, sonra sorgula; sözcük uydurma.
5. **Güncel tut.** Kod değişince `graphify update <yol>` (yalnızca kod, LLM'siz, ücretsiz). Bir grafik, kaynağı değişmiş düğümü eski gösteriyorsa kaynağa güven.
6. **Kota.** Doküman, görsel veya makale için anlamsal çıkarım alt ajan başlatır ve abonelik kotasından yer. Varsayılan: yalnızca kod. Anlamsal çıkarım ve `--mode deep` yalnızca spec'te kota payı yazılıysa ya da CEO istediyse.
7. **Güvenlik.** Grafiği proje kökünde değil, kaynak dizinlerinde (`src/`, `docs/`) kur; `.env`, anahtar ve sertifika dosyaları kapsam dışında kalsın. (graphify'ın ayrı bir dışlama ayarı doğrulanmadı, bu yüzden yolu sen seçersin.) Grafik çıktısı sır içeriyorsa sil ve CEO'ya bildir.
8. **Çıktı türetilmiştir.** `graphify-out/` depoya girmez (`.gitignore`); yeniden üretilebilir. Git hook'u (`graphify hook install`) ve `graphify claude install` proje ayarını değiştirir: yalnızca Chief of Staff, ana makinede, CEO onayıyla.
9. **Geri bildirim (isteğe bağlı).** Faydalı çıkan sorgu için `graphify save-result --outcome useful`, yanıltan için `--outcome corrected --correction "<doğrusu>"`; `graphify reflect` bunlardan ders listesi üretir.

## Çıktı şablonu
Grafikten gelen bilgiyi kullanırken kaynağını belirt: `(graf: EXTRACTED, <dosya>)` veya `(graf: INFERRED, doğrulandı: <dosya:satır>)`. Doğrulanmamışsa: `(graf: INFERRED, doğrulanmadı)`.

## Kontrol listesi
- [ ] Kod sorusunda önce grafik/rapor denendi (varsa).
- [ ] Değişiklik öncesi `affected` çalıştı, plan dosya listesi buna uyuyor.
- [ ] INFERRED/AMBIGUOUS bilgi kaynakta doğrulandı ya da "doğrulanmadı" diye işaretlendi.
- [ ] Anlamsal çıkarım için kota payı yazılı (yoksa yalnızca kod çıkarıldı).
- [ ] Grafik kapsamı sır içermiyor, `graphify-out/` git dışında.

## Yasaklar
- Grafiği kanıt saymak; INFERRED kenara dayanıp "bağımlılık var/yok" demek.
- Proje kökünde körlemesine grafik kurmak (sır dosyaları kapsama girer).
- Kota payı olmadan anlamsal çıkarım veya `--mode deep`.
- Grafik çıktısını depoya commit etmek.
- Git hook'unu veya `CLAUDE.md` bölümünü CEO onayı olmadan kurmak.

## Araçlar ve izinler
`graphify` komutları (`query`, `explain`, `path`, `affected`, `god-nodes`, `update`) ana makinede `Bash` ile; `Read` ile `GRAPH_REPORT.md`. Konteyner imajında graphify henüz yok (ENV-10): konteynerdeki ajan grafiği sorgulayamaz, `graph.json`'u salt-okunur okuyabilir ya da Chief of Staff sorguyu ana makinede çalıştırıp metin olarak verir.

## Durma ve yükseltme
- Grafik eski veya bozuk görünüyorsa (var olan dosya bulunmuyor) kaynağa dön ve Chief of Staff'a `update` iste.
- Anlamsal çıkarım kotayı aşacaksa dur ve CEO'ya sor.
- Sır içeren dosya grafiğe girdiyse güvenlik bulgusu say: dur ve bildir.

## Örnekler
- İyi: "`graphify affected "OrderService"` → 6 dosya. 4'ü EXTRACTED; `ReportJob.cs` INFERRED, açıp doğruladım: gerçekten çağırıyor (`ReportJob.cs:41`). Plan dosya listesine ekledim."
- Kötü: "Grafik `PaymentService`'in `Billing`'e bağlı olduğunu söylüyor, bu yüzden dokunmadım." (INFERRED, doğrulanmamış.)
