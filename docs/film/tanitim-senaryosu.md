# Tanıtım filmi senaryosu: "Bir işin yolculuğu"

- **Süre:** yaklaşık 3 dakika.
- **Biçim:** 1920×1080, 30 fps. Filmde arayüz görünmez; yalnız alt yazı ve sahne başlığı görünür.
- **Kaynak:** `?film=1` modu. Kayıt uygulamanın kendi senaryolu işinden alınır. Videoyu CEO'ya doğrudan veririz, GitHub'a yüklenmez.
- **Kural:** filmde gerçek şirket adı, logo ya da ürün geçmez.

## Hikâye
CEO sabah şirkete gelir ve büyük bir iş getirir: **"Kooperatif Pazarı"**. Bu, küçük üreticilerin ürünlerini satacağı bir web ve mobil uygulama. Lane 3 bir iş: şirketteki **her birim** bir aşamada görev alır. Film zarfın CEO'dan çıkıp teslime kadar izlediği yolu anlatır.

Gün hızı yürüme ve bekleme anlarında 4×, kilit anlarda 1×. Kamera her sahnede işi taşıyan robota keser.

| # | Sahne | Yer | Görünenler | Alt yazı | Süre |
|---|---|---|---|---|---|
| 1 | Açılış | Şehir → kule, sabah ışığı | Genel tur, otoparka lüks araç girer | "Sabah 08:30. Şirket uyanıyor." | 10 s |
| 2 | CEO geliyor | Lobi → asansör → penthouse | CEO lobiden geçer, güvenlik selam verir, asansör | "CEO yeni bir işle geldi." | 10 s |
| 3 | İş zarfı | Penthouse imza masası | CEO zarfı Chief of Staff'a verir | "Kooperatif Pazarı: web, mobil ve API." | 8 s |
| 4 | Araştırma | 4. kat | Ürün Yöneticisi ve Keşifçi masada; ekranlarda pazar grafikleri | "Ürün: pazar ve rakipler. Keşifçi: hazır çözüm var mı?" | 12 s |
| 5 | Mimari | 4. kat | Yazılım Mimarı çizer; Mimari Kurul'a çağrı | "Mimari: seçenekler ve ödünleşimler." | 10 s |
| 6 | Spec | 4. kat | İş Analisti spec kağıdını yazar | "İş Analisti imzalanabilir spec'i yazıyor." | 8 s |
| 7 | Toplantı odası | 3. kat toplantı | Spec Eleştirmeni, AppSec ve Mimari Kurul masada; beyaz tahta dolar | "Üç kapı aynı anda: eleştiri, güvenlik, mimari." | 15 s |
| 8 | Ret ve düzeltme | 3. kat | Eleştirmen ↺ ile geri gönderir; analist düzeltir | "Açık bulundu. Spec düzeltiliyor." | 8 s |
| 9 | İmza | Penthouse | CEO masada "ONAY" mührünü basar | "İmza yoksa kod da yok." | 8 s |
| 10 | Plan | 2. kat | Teslimat Yöneticisi işleri böler; zarflar dağılır | "Teslimat: plan, dallar, iş listesi." | 8 s |
| 11 | Kodlama | 1. kat mühendislik | .NET, React, Çok Dilli ve DevOps aynı anda çalışır; ekranlarda kod; biri kahve alır | "Dört mühendis paralel kodluyor." | 18 s |
| 12 | Ar-Ge | Kampüs Ar-Ge | Ar-Ge'de stand-up, beyaz tahta | "Ar-Ge: şirketin beyni." | 8 s |
| 13 | Mola | Spor ve kahve | Koşu bandı, dambıl, kahve kuyruğu, tepsi | "Öğle arası. Herkes için." | 10 s |
| 14 | QA | 2. kat | QA Mühendisi testi kırar: kırmızı lamba → düzeltme → yeşil | "QA kodu bozarak dener." | 12 s |
| 15 | Güvenlik ve denetim | 2. kat | AppSec inceler, İç Denetçi kanıtı okur, Kalite Ofisi listeyi işaretler | "Güvenlik, denetim, kalite." | 12 s |
| 16 | İletişim | 4. kat | Pazarlama ve Teknik İletişim metinleri yazar; Yetenek ve Kapasite raporu | "Kullanım kılavuzu ve tanıtım metni hazır." | 8 s |
| 17 | Teslim | Penthouse | Chief of Staff kanıtla gelir; CEO onaylar; iş şeridinde "bitti" | "Kanıt var, iş bitti." | 8 s |
| 18 | Kapanış | Çatı bahçesi → genel, altın saat | Kamera geri çekilir, şehir akşam ışığında | "Ajans. Her iş, uçtan uca." | 10 s |

## Teknik notlar
- Film işi, rastgele iş havuzuna girmeyen özel bir senaryodur (`film-flagship`, lane 3). Yalnız `?film=1` ile başlar.
- Her birim en az bir adımda yer alır. Senaryo testi bunu doğrular.
- Kamera, sahne geçişlerini senaryo adımlarına bağlı yapar: bir adım başlayınca kamera o adımın robotuna keser. Böylece film iş akışıyla senkron kalır.
- Alt yazı alttan üçte birlik, okunaklı ve Türkçe. Arka plan yarı saydam. En fazla 2 satır.
- Kayıt: Chrome, `canvas.captureStream` ile alınır, gökyüzü gradyanıyla birleştirilir, ffmpeg ile mp4'e çevrilir.
- Video GitHub'a yüklenmez.
