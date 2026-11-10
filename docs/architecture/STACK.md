# Standart yığın kaydı

Tutan: Architecture board (GOV-02). Durumlar: **benimse** (varsayılan seçim), **dene** (küçük denemede), **değerlendir** (karar bekliyor), **çıkar** (yenisinde kullanma).
**Tercih kısıt değildir:** gerekçe aksini göstermedikçe seçim .NET ve React'tır (derin uzmanlık buradan gelir). Başka yığın yasak veya "ikinci sınıf" değildir: spec yığını adlandırıyorsa (imzalı spec CEO kararıdır) o yığında tam geliştirme yapılır; Architecture board görüş verir, engellemez.
Yeni teknoloji veya bağımlılık bu kayda ancak gerekçeyle ve CEO bilgisiyle girer (anayasa).

| Teknoloji | Durum | Gerekçe | Tarih | ADR |
|---|---|---|---|---|
| .NET 10 (ASP.NET Core, EF Core) | benimse | Öncelikli backend yığını (CEO'nun uzmanlık alanı) | 2026-11-02 | - |
| React + TypeScript + Vite | benimse | Öncelikli ön yüz yığını | 2026-11-02 | - |
| Docker (yerel geliştirme) | benimse | Yerel geliştirme her zaman Docker | 2026-11-02 | - |
| Plesk / iç sunucu, önde Cloudflare | benimse | Canlı hedef | 2026-11-02 | - |
| GitHub Actions (`harness/bin/check`) | benimse | Tek doğrulama komutu CI'da (PR #11) | 2026-11-02 | - |
| Playwright + axe (yalnız izole konteynerde) | benimse | Görsel ve erişilebilirlik doğrulaması (B15, CEO onayladı) | 2026-11-02 | - |
| graphify | benimse | Kod tabanı grafiği (anayasa kural 8) | 2026-11-02 | - |
| Python / Django | benimse (ikincil) | Mevcut sistemlerin kaynağı ve uygun işlerde hedefi; okuma, port ve yeni kod (polyglot-engineer). Ajan imajında Python 3.12 ve PyPI erişimi hazır | 2026-11-04 | - |
| Vue | benimse (ikincil) | Mevcut arayüzlerde ve spec adlandırırsa yeni işte kullanılır; yeni arayüzde tercih React | 2026-11-04 | - |
| PHP (Laravel), Java (Spring), Go | benimse (ikincil) | Okuma, port ve spec adlandırırsa geliştirme; çalıştırmak için ajan imajında ilgili çalışma zamanı gerekir | 2026-11-04 | - |
| k6 (yük testi) | değerlendir | Performans kriterlerini ölçmek için aday; henüz kurulu veya denenmiş değil, Scout raporu ve CEO bilgisi gerekir | 2026-11-04 | - |
| OWASP ZAP baseline (DAST) | değerlendir | Test ortamına karşı pasif güvenlik taraması için aday; henüz kurulu veya denenmiş değil | 2026-11-04 | - |
| Trivy (imaj ve bağımlılık tarama) | değerlendir | CI'da imaj taraması için aday; henüz kurulu veya denenmiş değil | 2026-11-04 | - |
| Mesaj kuyruğu, ikinci veritabanı, mikroservis ayrımı | değerlendir | Kabul kriteri gerektirmedikçe eklenmez | 2026-11-02 | - |
| SQLite (EF Core Sqlite sağlayıcısı) | değerlendir | Proje Masası Portalı: kullanıcı ve ekle-yalnız onay denetimi için gömülü depo (ek konteyner yok). Board koşullu onay; lisans/bakım Scout T-09, CEO bilgisi bekliyor. Docker Desktop'ta bind mount değil named volume | 2026-11-07 | ADR-P05 (taslak bekleniyor) |
| HtmlSanitizer (mganss, NuGet) | değerlendir | Proje Masası Portalı: BookStack HTML'inin sunucuda allowlist temizliği (REQ-11). Tek bakımcı riski; geçmiş XSS advisory'leri var (AppSec/Scout doğrulasın); sürüm sabitlenir, zafiyet taraması CI'da | 2026-11-07 | - |
| TanStack Query, React Router | değerlendir | React SPA veri önbelleği ve yönlendirme; SR.IMS ön yüzünde kullanılıyor (tasarım iddiası), kayda alınıyor; lisans MIT (Scout doğrulasın) | 2026-11-07 | - |
