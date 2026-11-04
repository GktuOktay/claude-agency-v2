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
- [x] **A8. GitHub koruması:** GitHub dal koruması bu planda yok (özel depo: GitHub Pro veya herkese açık depo gerekir; ikisi de CEO kararı). Yerine `guard.js` kırmızı/sürmekte olan CI ile `gh pr merge`'i reddeder (PR #12). Kalan boşluk: GitHub arayüzünden elle birleştirme. İstersen sonra: GitHub Pro (para harcama, CEO).
- [ ] **A9. Denenecek adaylar:** Cloudflare güvenlik denetimi, Impeccable, taste-skill, Emil, REA (savunmacı), context7, Playwright/Chrome DevTools MCP. Hiçbiri denenmedi. Proje üzerinde çalışırken sırası gelince.
- [x] **A10. Pilot iş:** ertelendi. CEO projeler üzerinde zamanla deneyecek.

## B. Yapılacak (asistan), önerilen sıra

- [x] **B1. Ajan imajı:** .NET 10 SDK + Node + Claude Code 2.1.316 + graphify 0.9.54, etiket `:dev`; 9 imaj testi yeşil (PR #2). NuGet için yalnızca `api.nuget.org` yetti.
- [x] **B2. `Stop` hook'u:** `harness/stop.js` + 11 test (PR #3). Sınırı: Bash ile yapılan düzenlemeleri ve testin geçip geçmediğini görmez.
- [x] **B3. Kalan birimler:** Architecture board, Talent & capacity, Quality office, Marketing, Tech comms yazıldı (16 birim). Kılavuzlar gerçek işte denenmedi.
- [x] **B4. CI:** `.github/workflows/check.yml` (PR #11), ilk koşu yeşil. Kırmızı CI birleştirmeyi henüz **engellemiyor**: dal koruması A8.
- [ ] **B5. `company-run.sh` uçtan uca koşu.** Kısmen yapıldı: `harness/test/e2e.sh` bütün ana makine→konteyner yolunu sahte `claude` ile 18 testte doğruluyor (imza→bağlama kipi, imza sonrası spec değişirse plan kipine dönüş, approvals salt-okunur, token geçişi, vekil, doğrudan internet kapalı, çıkış kodu, gevşek token izni reddi). **Model davranışı doğrulanmadı:** gerçek token ve gerçek ajan koşusu hâlâ yok; token'ı yalnızca senin terminalin üretebilir (A3).
- [x] **B6. Kılavuz değerlendirme setleri:** `evals/` altında 16 set, her biri 3 vaka; set kendini sınar (`eval.js self`, `lint.js` CI'da çalıştırır). Gerçek birim çıktısını notlama (`eval.js grade`) canlı koşu gerektirir (B5 sonrası).
- [x] **B7. Durma bildirimi:** `harness/notify.js` (`Notification` kancası + `company-run.sh` koşu sonu); macOS bildirimi, metin argüman olarak geçer, başarısızlıkta sessiz. Gerçek masaüstünde görsel bildirim denenmedi (testte sahte `osascript`).
- [ ] **B8. Kota bekle-devam doğrulaması.** Gerçek kota dolumu gerektirir: canlı test, yapılmadı. Çıkış mesajı biçimi bilinmeden kod yazmak tahmin olurdu.
- [x] **B9. Scorecard otomasyonu:** `templates/scorecard.md` (makine okur) + `harness/bin/scorecard.js` (özet, sapma, gürültü oranı, bozuk dosyada hata). Internal audit hâlâ scorecard'ı iş sonunda elle doldurur; otomatik doldurma yok.
- [x] **B10. Yazım araçları:** `writing-standards` kılavuzu (kısa konuşma sınırı, Türkçe kalıplar) + `harness/bin/humanize-check.js` (mutlak iddia HATA, boş kalıp UYARI). MCP/plugin danışmanlığı Scout'ta zaten var. Sınır: kalıp listesi küçük, temiz çıkması metnin iyi olduğunu kanıtlamaz.
- [x] **B11. Ana makine sertleştirmesi:** `guard.js` artık `Write|Edit` ve Bash yazmalarında zorlama dosyalarını (guard/gate/stop/approval.js, keys, container-settings, `.claude/settings*.json`, CLAUDE.md, approvals, CI iş akışları) CEO onayına bağlar. Bilinen açık: `python -c` veya `node -e` ile satır içi yazma yakalanmaz.
- [ ] **B12. Kancanın etkileşimli yolu:** "sor" der, sen "evet" dersin. Gerçek oturumda denemek gerekir: canlı test, yapılmadı (kancanın JSON çıktısı birim testlerle doğrulandı).
- [x] **B13. Deploy ve mağaza gönderimi araçları:** `guard.js` ssh/scp/rsync, docker push, npm/nuget yayın, bulut CLI'ları, kubectl/terraform, fastlane/altool, dış adrese POST ve posta komutlarını tek tek CEO onayına bağlar. Gerçek deploy aracı yok (DevOps paket hazırlar). Kapsam listesi isme dayalı; yeni araç eklenince listeye girmeli.
- [x] **B15. Konteynerde görsel doğrulama:** denendi ve uygulandı (`harness/bin/visual-check.sh`, ayrı ağsız konteyner, AppSec seçenek C2; 12 imaj testi yeşil). **CEO onayladı (2026-11-02):** (1) Playwright + Chromium + axe yeni bağımlılığı ve ~+630 MB imaj, (2) sandbox'sız Chromium yalnızca ayrı konteynerde. Sonuç: `docs/ops/2026-11-02-gorsel-dogrulama-deneme.md`. Kalan: x64'te ölçüm, özel seccomp (D) isteğe bağlı, axe MPL-2.0 hukuk teyidi.
- [x] **B16. Tanıtım sayfası erişilebilirliği:** `html-has-lang` ve `color-contrast` düzeltildi; `visual-check.sh` ile iki temada axe 0 ihlal; eski parola ve test sayısı metinleri güncellendi. Ayrıca Playwright/Chromium yama takvimi (S-04).
- [x] **B14. Hukuk/Uyum ve Operasyon süreçleri:** `docs/surecler/` (iki akış diyagramlı belge) + şablonlar (`uyum-kontrol`, `olay-postmortem`, `destek-triyaj`) + Kalite ofisi birimi. İzleme/uyarı aracı ve gerçek olay denemesi yok.

- [x] **B17. Döngü engelleyici:** `harness/loop.js` (aynı çağrı 5 kez veya 2-3 çağrılık döngü 3 tur → ajana "farklı yol dene ya da dur"); ana makine ve konteynerde bağlı; 16 test. Sınır: yalnızca çağrı girdisine bakar, sonucu görmez; hatalı ama her seferinde farklı girdili tekrar yakalanmaz (onu `maxTurns` ve "3 başarısız deneme" kuralı sınırlar).
- [x] **B18. Tanıtım sayfası derinleştirme:** teknik bölümler (iş yolu, kancalar, konteyner/bağlama kipleri, imza kaydı, doğrulama ve sınırlar) ve etkileşimli düğüm haritası; harita verisi `site-data.js` ile ajan dosyalarından üretilir, `lint.js` bayatlamayı yakalar.
- [x] **B19. Sistem haritası (tanıtım sayfası):** referans olarak verilen agency-map sayfasının kapsamı (kancalar, kapılar, birimler, kılavuzlar, altyapı, düğüm haritası, arama) bizim sistemimiz için; 28 kapı seviye etiketiyle (14 zorlanan, 7 denetlenen, 7 yalnızca talimat), her biri dayandığı dosyaya bağlı (dosya yoksa lint kırmızı). Kancalar ayar dosyalarından, birimler ajan dosyalarından, kılavuzlar skill dosyalarından, test sayıları test dosyalarından üretilir.
- [x] **B20. Kapsam genişletme (yazılım mimarı, çok yığınlı mühendis, DevOps):** `software-architect` (çözüm ve göç tasarımı, Bash yok, onaylamaz) ve `polyglot-engineer` (Django, Vue, PHP vb. okuma, davranış envanteri, imzadan sonra port) eklendi (18 birim, 21 kılavuz); DevOps kılavuzuna çok yığınlı kalıp tablosu; `STACK.md`'ye Python/Django, Vue, PHP, Java, Go "benimse (ikincil)" olarak (tercih .NET/React, kısıt değil; revizyon 20). Python 3.12 imajda zaten vardı; PyPI vekil izin listesine eklendi (CEO onayı, revizyon 21), `harness/test/python.sh` 4 test yeşil. Açık: PHP, Java, Go imajda yok; bunlar için imaj genişletmesi ve paket kaynağı (Packagist, Maven) CEO kararıdır.

## C. Bilinen sınırlar ve riskler

- Ana makinede oturumdaki ajan CEO anahtarını rastgele kodla okuyabilir (parolasız anahtar kararının bedeli); "CEO gözetimindeki oturum güvenilir" varsayımı.
- Konteynere verilen Claude belirteci ajan tarafından teorik olarak okunabilir; belirteç yalnızca model isteği atar, bir yıl geçerlidir.
- Çalışma alanındaki `.git/config` yazılabilir. Vekil yalnızca ana ad ve portu görür. Docker Desktop VM yalıtımı çekirdek açıklarına karşı sınır değildir.
- Denemeler küçük modelle ve basit görevlerle yapıldı.
- graphify: yalnızca kod grafiği (`graphify update`, LLM'siz) `.env` ve `secrets.yml` içeriğini ve adlarını çıktıya almadı (2026-11-02, deneme). Doküman/anlamsal çıkarım yolu sır dosyalarında denenmedi; o yol kota harcar ve kurala göre yalnızca bütçeyle çalışır.
- Deny kurallarının dolanılabilirliği (T-E) çalıştırılmadı.

## D. Temizlik

- [x] `docker rmi company-agent:test` yapıldı.
