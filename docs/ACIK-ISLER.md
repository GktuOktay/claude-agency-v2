# Açık işler

Son güncelleme: 2026-11-02. Tek takip yeri bu dosya. İş bitince `[x]` yapılır ve karar defterine (docs/KARARLAR.md) bir satır düşülür.

## A. Senin kararın veya eylemin gerekenler

- [x] **A1. Dalı gönder, PR aç, birleştir.** Bitti: PR #1, main 0cce459. CEO talimatı: asistan yapar. Birleştirme `main`'e gittiği için onay penceresi çıkar; "Evet" demen yeterli.
- [x] **A2. CEO anahtarını üret.** Bitti (2026-11-02); genel anahtar PR #2'de. Parola yok. Kendi terminalinde tek komut: `./harness/bin/ceo-keygen.sh`. (Asistanın üretmesi otomatik mod sınıflandırıcısı tarafından engellendi.) Sonra üretilen `harness/keys/ceo.pub.pem` dosyası depoya eklenir; bunu asistan yapar.
- [ ] **A3. Ajan belirteci** (yalnızca otonom koşu denemesi için): `~/.company/agent.env`, mod 600. Şu an yok. Gerektiğinde yeniden üretilir; iş bitince silinir.
- [ ] **A4. Eski `claude-agency` reposu:** arşivlensin mi, README'sine "yerini `claude-agency-v2` aldı" notu düşülsün mü?
- [ ] **A5. Eski global kurulum:** `~/.claude` içindeki eski orchestrator ve skill'ler (32 adet, yedek `~/.claude-backup-2026-11-01`) devre dışı bırakılsın mı; yeni birimler her projede kullanılsın mı?
- [x] **A6. Paket kayıtlarına çıkış:** CEO "bu sorunu çöz" dedi; karar: NuGet ve npm varsayılan açık, `COMPANY_REGISTRIES=none` ile kapanır (B1 PR'ında).
- [ ] **A7. Docker Desktop güncellemesi:** sunucu sürümü 20.10.22 (2022).
- [ ] **A8. GitHub koruması:** `main` dal koruması ve CI.
- [ ] **A9. Denenecek adaylar:** Cloudflare güvenlik denetimi, Impeccable, taste-skill, Emil, REA (savunmacı), context7, Playwright/Chrome DevTools MCP. Hiçbiri denenmedi. Proje üzerinde çalışırken sırası gelince.
- [x] **A10. Pilot iş:** ertelendi. CEO projeler üzerinde zamanla deneyecek.

## B. Yapılacak (asistan), önerilen sıra

- [x] **B1. Ajan imajı:** .NET 10 SDK + Node + Claude Code 2.1.316 + graphify 0.9.54, etiket `:dev`; 9 imaj testi yeşil (PR #2). NuGet için yalnızca `api.nuget.org` yetti.
- [ ] **B2. `Stop` hook'u:** "kanıtsız bitti denmez" şu an yalnızca talimat.
- [ ] **B3. Kalan birimler:** React engineer (eski `~/.claude/rules/frontend.md` kalite kapılarını temel alır), AppSec, DevOps/SRE, Scout, Architecture board, Talent & capacity, Quality office, Marketing, Tech comms.
- [ ] **B4. CI:** GitHub Actions ile `harness/bin/check`.
- [ ] **B5. `company-run.sh` uçtan uca koşu** (belirteç + anahtar sonrası).
- [ ] **B6. Kılavuz değerlendirme setleri** (SOP-04).
- [ ] **B7. Durma bildirimi:** masaüstü bildirimi mekanizması.
- [ ] **B8. Kota bekle-devam doğrulaması.**
- [ ] **B9. Scorecard otomasyonu.**
- [ ] **B10. Yazım araçları:** kısa konuşma modu sınırları, Türkçe humanizer, MCP/plugin danışmanlığı (Scout).
- [ ] **B11. Ana makine sertleştirmesi:** `.claude/settings.json` ve `harness/` oturumdaki ajan tarafından düzenlenebilir.
- [ ] **B12. Kancanın etkileşimli yolu:** "sor" der, sen "evet" dersin. Bu oturumda ilk kez yaşandı (push ve birleştirme sırasında), ama sistematik test edilmedi.
- [ ] **B13. Deploy ve mağaza gönderimi araçları** (guard yalnızca git/gh için).
- [ ] **B14. Hukuk/Uyum ve Operasyon süreçleri.**

## C. Bilinen sınırlar ve riskler

- Ana makinede oturumdaki ajan CEO anahtarını rastgele kodla okuyabilir (parolasız anahtar kararının bedeli); "CEO gözetimindeki oturum güvenilir" varsayımı.
- Konteynere verilen Claude belirteci ajan tarafından teorik olarak okunabilir; belirteç yalnızca model isteği atar, bir yıl geçerlidir.
- Çalışma alanındaki `.git/config` yazılabilir. Vekil yalnızca ana ad ve portu görür. Docker Desktop VM yalıtımı çekirdek açıklarına karşı sınır değildir.
- Denemeler küçük modelle ve basit görevlerle yapıldı.
- graphify'ın sır dosyalarını dışlayan ayarı doğrulanmadı.
- Deny kurallarının dolanılabilirliği (T-E) çalıştırılmadı.

## D. Temizlik

- [x] `docker rmi company-agent:test` yapıldı.
