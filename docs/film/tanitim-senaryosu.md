# Tanıtım filmi senaryosu: "Bir işin yolculuğu"

- **Süre:** yaklaşık 2,5 dakika (140–170 s; CEO: önce "daha hızlı bir çekim istiyorum", sonra "hızı da biraz düşür"). Tablodaki sahne süreleri ilk taslaktır; güncel tutma süreleri `src/film/script.ts` içindedir.
- **Biçim:** 3840×2160 (16:9) ve 2160×3840 (9:16), 30 fps. Filmde arayüz görünmez; yalnız alt yazı, sahne başlığı ve isim etiketleri görünür.
- **Kaynak:** `?film=1` modu. Kayıt uygulamanın kendi senaryolu işinden alınır. Videoyu CEO'ya doğrudan veririz, GitHub'a yüklenmez.
- **Kural:** filmde gerçek şirket adı, logo ya da ürün geçmez. Şirketin adı filmde "Yazılım Evi"dir; "Ajans" denmez.

## Hikâye
**Seçilen iş: GökRota**, dronla paket teslimatını canlı yöneten platform (web paneli, mobil uygulama, API).
Neden: teknik müşteriye heyecan verir ve her birime doğal bir iş çıkarır: canlı harita, dron telemetrisi, komut güvenliği, rota çakışması gibi test edilmesi gereken somut riskler. Sağlık ve finans alanları, yasal vaat riski taşıdığı için seçilmedi.

CEO sabah 08:00'de Yazılım Evi'ne gelir ve büyük bir iş getirir: **GökRota**. Müşteri paketini haritada canlı izler; operatör dronlara web panelinden rota verir; dronlar aynı API'ye bağlanır. Lane 3 bir iş: şirketteki **her birim** bir aşamada görev alır.
- Ürün Yöneticisi pazarı, Keşifçi hazır rota kütüphanesini araştırır.
- Mimar canlı veri için yeni bir bağımlılık önerir, Mimari Kurul gerekçe ister.
- Spec Eleştirmeni ve AppSec, batarya ve komut güvenliği sorularıyla spec'i geri gönderir.
- Dört mühendis aynı anda çalışır: .NET (API), React (web paneli), Çok Dilli (dron telemetrisi ve mobil), DevOps (altyapı).
- QA, iki drona aynı rotanın verilebildiğini yakalar.
- Denetim, kalite, pazarlama ve teknik iletişim işi kapatır; CEO kanıtla teslim alır.

Film, zarfın CEO'dan çıkıp teslime kadar izlediği yolu anlatır.

Gün hızı yürüme, bekleme ve sabah gelişinde 6×, masa işinde 3×, kilit anlarda 1×. CEO geliyor sahnesi kısa bir lobi çekimi ve CEO'ya kesmeyle geçer. Kamera her sahnede işi taşıyan robota keser.

| # | Sahne | Yer | Görünenler | Alt yazı | Süre |
|---|---|---|---|---|---|
| 1 | Açılış | Şehir → kule, sabah ışığı | Genel tur, otoparka lüks araç girer | "Saat 08:00. 19 yapay zekâ uzmanı ve bir CEO işbaşında." | 10 s |
| 2 | CEO geliyor | Lobi → asansör → penthouse | CEO lobiden geçer, güvenlik selam verir, asansör; penthouse'ta ekip karşılar | "Kapıdan yeni bir iş giriyor." | 10 s |
| 3 | İş zarfı | Penthouse imza masası | CEO zarfı Chief of Staff'a verir | "GökRota: dronla teslimatı canlı yöneten platform." | 8 s |
| 4 | Araştırma | 4. kat | Ürün Yöneticisi ve Keşifçi masada; ekranlarda pazar grafikleri | "Kod yok henüz. Önce pazarı ve hazır çözümleri tarıyoruz." | 12 s |
| 5 | Mimari | 4. kat | Yazılım Mimarı çizer; Mimari Kurul'a çağrı | "Mimari çiziliyor. Her seçeneğin bedeli kâğıtta." | 10 s |
| 6 | Spec | 4. kat | İş Analisti spec kağıdını yazar | "Spec: ne yapılacağı ve nasıl test edileceği, tek belgede." | 8 s |
| 7 | Toplantı odası | 3. kat toplantı | Spec Eleştirmeni, AppSec ve Mimari Kurul masada; beyaz tahta dolar | "Üç uzman aynı spec'e aynı anda saldırıyor." | 15 s |
| 8 | Ret ve düzeltme | 3. kat | Eleştirmen ↺ ile geri gönderir; analist düzeltir | "Açık bulundu. Kodda değil, kâğıtta; düzeltmesi ucuz." | 8 s |
| 9 | İmza | Penthouse | CEO masada "ONAY" mührünü basar | "Onay mührü basılmadan tek satır kod yazılmaz." | 8 s |
| 10 | Plan | 2. kat | Teslimat Yöneticisi işleri böler; zarflar dağılır | "İş parçalara bölünüyor. Her parçanın bir sahibi var." | 8 s |
| 11 | Kodlama | 1. kat mühendislik | .NET, React, Çok Dilli ve DevOps aynı anda çalışır; ekranlarda kod; biri kahve alır | "Dört mühendis, dört dal, tek ürün." | 18 s |
| 12 | Ar-Ge | Kampüs Ar-Ge | Ar-Ge'de stand-up, beyaz tahta | "Ar-Ge tahtasında yarının fikirleri." | 8 s |
| 13 | Mola | Spor ve kahve | Koşu bandı, dambıl, kahve kuyruğu, tepsi | "Kahve, koşu bandı, beş dakika nefes." | 10 s |
| 14 | QA | 2. kat | QA Mühendisi testi kırar: kırmızı lamba → düzeltme → yeşil | "QA kodu bilerek bozuyor. Hata size ulaşmadan yakalanıyor." | 12 s |
| 15 | Güvenlik ve denetim | 2. kat | AppSec inceler, İç Denetçi kanıtı okur, Kalite Ofisi listeyi işaretler | "Kodu yazan onaylamaz. Güvenlik ve denetim ayrı ekipte." | 12 s |
| 16 | İletişim | 4. kat | Pazarlama ve Teknik İletişim metinleri yazar; Yetenek ve Kapasite raporu | "Kılavuz ve tanıtım metni ürünle birlikte hazır." | 8 s |
| 17 | Teslim | Penthouse | Chief of Staff kanıtla gelir; CEO onaylar; iş şeridinde "bitti" | "Söz değil, kanıt: testler yeşil, denetim temiz." | 8 s |
| 18 | Kapanış | Çatı bahçesi → genel, altın saat | Kamera geri çekilir, şehir akşam ışığında | "Yazılım Evi. Fikri siz getirin, gerisi kanıtıyla gelir." | 10 s |

## Teknik notlar
- Film işi, rastgele iş havuzuna girmeyen özel bir senaryodur (`film-flagship`, lane 3). Yalnız `?film=1` ile başlar.
- Her birim en az bir adımda yer alır. Senaryo testi bunu doğrular.
- Kamera, sahne geçişlerini senaryo adımlarına bağlı yapar: bir adım başlayınca kamera o adımın robotuna keser. Böylece film iş akışıyla senkron kalır.
- Alt yazı alttan üçte birlik, okunaklı ve Türkçe. Arka plan yarı saydam. En fazla 2 satır. Alt yazılar en çok 60 karakterdir; dikey çekimde 2 satıra sığar.
- Kayıt sabit adımlıdır: her kare simülasyonu 1/30 s ilerletir, ffmpeg ile mp4'e çevrilir.
- Video GitHub'a yüklenmez.

## Diyaloglar
Her sahnede konuşan robotun başının üstünde kısa bir balon çıkar. En fazla 2 balon aynı anda görünür. Bir replik en çok 2.5 s ekranda kalır. Replikler en çok 55 karakterdir.

**Ton**
- Kendinden emin, övünmeyen: her iddiayı ekranda görünen bir adım taşır.
- Gündelik konuşma Türkçesi, kısa cümle; mizah hafif ve işi küçümsemez.
- Spec, QA, AppSec gibi terimler kalır; ne işe yaradıkları sahnede görünür.

| # | Konuşan → dinleyen | Replik |
|---|---|---|
| 2 | Güvenlik → CEO | "Günaydın! Asansörünüz hazır." |
| 2 | CEO → Güvenlik | "Günaydın. Bugün ekibe uçan bir iş getirdim." |
| 2 | Chief of Staff → CEO (penthouse, yeni) | "Hoş geldiniz! Kahveniz masada, ekip hazır." |
| 2 | Ürün Yöneticisi → CEO (penthouse, yeni) | "Günaydın! O zarf epey dolu görünüyor." |
| 2 | Teslimat Yöneticisi → CEO (penthouse, yeni) | "Hoş geldiniz. Takvimde yer açtım bile." |
| 3 | CEO → Chief of Staff | "Dronla teslimat. Her uçuş canlı izlenecek." |
| 3 | Chief of Staff → CEO | "Bu iş herkese dokunuyor. Tüm ekibi çağırıyorum." |
| 4 | Ürün Yöneticisi → Keşifçi | "Müşteri paketini haritada canlı görmek istiyor." |
| 4 | Keşifçi → Ürün Yöneticisi | "Rota motorunun hazırı var, sıfırdan yazmayalım." |
| 5 | Yazılım Mimarı → Mimari Kurul | "Tek API. Web, mobil ve dronlar aynı kapıdan." |
| 5 | Mimari Kurul → Yazılım Mimarı | "Canlı veri için yeni kütüphane mi? Gerekçeni getir." |
| 6 | İş Analisti → Chief of Staff | "Spec hazır: 14 madde, her biri test edilebilir." |
| 7 | Spec Eleştirmeni → İş Analisti | "Batarya yolda biterse dron nereye iniyor?" |
| 7 | AppSec → İş Analisti | "Biri dronun komutunu ele geçirirse ne olur?" |
| 8 | İş Analisti → Spec Eleştirmeni | "Acil iniş noktalarını ekledim, testini de yazdım." |
| 8 | Spec Eleştirmeni → İş Analisti | "Tamam. Artık açık göremiyorum." |
| 9 | CEO → Chief of Staff | "Okudum, imzaladım. Hadi bakalım." |
| 10 | Teslimat Yöneticisi → Mühendisler | "Dört parça, dört sahip. İlk iş testler." |
| 11 | React Mühendisi → .NET Mühendisi | "Canlı konum servisi ne âlemde? Harita bekliyor." |
| 11 | .NET Mühendisi → React Mühendisi | "Test yeşile dönüyor. Beş dakikaya sende." |
| 11 | Çok Dilli Mühendis → React Mühendisi (yeni) | "Siz konuşun, dron telemetrisi akmaya başladı." |
| 11 | DevOps → Çok Dilli Mühendis | "İmaj hazır. Herkes aynı ortamda çalışıyor." |
| 11 | DevOps → Mühendisler (yeni) | "Kimse 'bende çalışıyordu' demesin, Docker'da dene." |
| 11 | React Mühendisi → DevOps (yeni) | "Tamam tamam, kahveler benden." |
| 12 | Ar-Ge lideri → ekip | "Ya rüzgârı tahmin edip rotayı önceden çizsek?" |
| 13 | Çaycı → Mühendis | "Çaylar taze, demini ben bilirim." |
| 13 | Mühendis → Mühendis | "Son set. Sonra harita ekranına dönüyorum." |
| 14 | QA Mühendisi → .NET Mühendisi | "İki drona aynı rotayı verdim, sistem kabul etti!" |
| 14 | .NET Mühendisi → QA Mühendisi | "Haklısın, kilidi ekledim. Bir daha dene." |
| 14 | QA Mühendisi → .NET Mühendisi | "Yeşil. Ama gözüm üstünde." |
| 15 | AppSec → İç Denetçi | "Komutlar imzalı, kodda tek bir sır yok." |
| 15 | İç Denetçi → Kalite Ofisi | "14 madde, 14 kanıt. Eksik yok." |
| 16 | Pazarlama → Teknik İletişim | "Slogan: Paketin gökte, gözün haritada." |
| 17 | Chief of Staff → CEO | "Testler yeşil, denetim temiz. Kanıtlar ekte." |
| 17 | CEO → herkes | "Teslim edelim. Ellerinize sağlık!" |

---

