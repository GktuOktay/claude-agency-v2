# Standart yığın kaydı

Tutan: Architecture board (GOV-02). Durumlar: **benimse** (varsayılan seçim), **dene** (küçük denemede), **değerlendir** (karar bekliyor), **çıkar** (yenisinde kullanma).
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
| Mesaj kuyruğu, ikinci veritabanı, mikroservis ayrımı | değerlendir | Kabul kriteri gerektirmedikçe eklenmez | 2026-11-02 | - |
