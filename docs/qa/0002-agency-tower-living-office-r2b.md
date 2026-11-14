# QA 0002 — Tur 2, B bölümü (CEO yetkili genişleme: Rev 31/33/35/37/38)

- Yapan: `qa-engineer` (opus). Raporu ana oturum kaydetti.
- Branch `feat/agency-tower-living-office` @ `7abf371`, Node v22.23.5.
- **Sonuç: KANITSIZ KRİTERLER VAR.** 4 hata tekrar üretildi. Bir okumaya göre bütçe aşıldı. 2 sapma için CEO kararı gerekiyor.

## Taze koşular
- **vitest:** 1. koşuda 835 testten 2'si zaman aşımına düştü (city-scene 16.97 s, reduced-motion-workflow 16.31 s). Aynı dosyalar tek başına 0.94 s ve 1.22 s sürüyor. 2. koşu 835/835 geçti.
- **Diğer kontroller:** build OK · budget OK · isolation OK.

## Gereksinim → kanıt
- **Rev 31:**
  - İnsan CEO, alan görünümleri, statü kıyafetleri, kanat olanakları, yeşillik, personel, Türkçe ad + özgün id, 11 px balonlar: testleri var, PASS.
- **Rev 33:**
  - Şehir yaşamı, şeridin kat paneliyle çakışmaması, kat planında kampüs, köşe menüsü + Senaryo, Türkçe açıklamalar ve araç açıklamaları: PASS.
- **Rev 35:**
  - Modüler menü, mola programı, herkes için sosyal alanlar, otopark, Ar-Ge yıldız, görüntü kalitesi, yazılım şirketi görselleri: PASS.
  - Gerçekçilik ve prestij: yalnız gözle.
- **Rev 37:**
  - Lüks araçlar ve şehir, bina: PASS.
  - Odalar: PASS, ama metal parlaklığı FAIL.
  - "Gerçekçi": yalnız gözle.
- **Rev 38:**
  - Program ve Ofis sekmesi, kanadın herkese açılması ve kat mandalı: PASS.
  - Otomatik döngü 420 s: PASS, ama REQ-18'den sapma (aşağıda).

## Bütçeler
- **Giriş dosyası:** 972 106 B, 1 000 000'ün %97.2'si. PASS.
- **Vertex, yalnız kule:** 637 271 (instance bir kez sayılınca) / 707 202 (instance'lar açılınca; 40 InstancedMesh, 1711 instance).
- **Vertex, tüm uygulama sahnesi:** 645 816 / 715 747.
- **Mesh:** 819 kule, 845 uygulama sahnesi. PASS.
- **Okuma:** 0001 spec metninde vertex sayısı yok. 700 000, `build-budget.test.ts:10` ve 0002 REQ-20'den geliyor. REQ-20 bütçeyi 30 fps hedefine bağlıyor; GPU maliyeti çizilen (açık) vertex sayısıyla artıyor. Bu yüzden açık okuma daha savunulabilir. O okumayla bütçe 7–16 bin aşılıyor. **CEO kararı gerekli.**

## Test gevşetme incelemesi (`e4a5699`'dan beri)
- **Gevşetilmiş:**
  - `budget-check.test.ts` sınırı 900 000 → 1 000 000 (Rev 35; CEO imzası yok).
  - `campus-breaks.test.ts:268-302`: ikiz koşu karşılaştırması daha sıkı, ama son durum yalnız "en az bir kez kahveye ulaştı".
- **Sıfır pay:** `office-liveness.test.ts:46` `on.done >= off.done - 2`, ölçülen 3'e 5'te tam sınırda geçiyor.
- **Sıkılaştırılmış:** `director.test.ts:138`, `whiteboard.test.ts:171`.
- **Gereksinim değiştiği için değişen:** `ui-hud.test.ts:78`, `campus.test.ts:76`, `settings-menu.test.ts:18`.

## Bilinen riskler
1. **Zemin kat çakışması: DOĞRULANDI.** `flexOffice.ts:309-310` ayakta çalışma masaları güvenlik masası ve turnike dolaplarıyla çakışıyor. Tekrar üretim testi: `tests/qa-r2b-lobby-overlap.test.ts` (FAIL, 3 çakışma).
2. **Görüş engelleme:** Ahşap çıta tavan zemin katın %3.1'ini (masaüstü) ve %2.2'sini (telefon) kapatıyor; bu kabaca resepsiyonun tamamı. Sarkıt lambalar %0.1, taç %0. Bunu ölçen test yok; göz kontrolü gerekli.
3. **Parlaklık: DOĞRULANDI.** `bakeStatic`, metal, pirinç ve mermeri `vertexColored()` malzemesine katlıyor (metalness 0, roughness 0.75). Pirinç zaten metalness 0 ile tanımlanmış. Tekrar üretim testi: `tests/qa-r2b-metal-sheen.test.ts` (FAIL 2/2).
4. **Molalar:** 1200 s'de molalarla 3 iş, molasız 5 iş bitiyor (−%40). Görünür davranış, **Type 1: CEO kararı.**
5. **Otomatik 420 s, REQ-18'den sapma:**
   - Döngü 419.4 s; spec 90 ± 1 s.
   - Gece döngünün %13.3'ü; spec %50.
   - Duraklatmada donuyor.
   - `m2.test.ts:158` uygulamanın Otomatik modda artık kullanmadığı `createDayNight` kodunu test ediyor.
6. **Yalıtım: PASS.** `dist` içindeki tek `fetch(` Vite'ın modulepreload desteği. `check-isolation.mjs` yalnız yolları denetliyor; ağ yasağını `security-grep.test` taşıyor.
7. **Erişilebilirlik:**
   - Diyalog, sekmeler, Esc, yalnız metin düğümleri ve azaltılmış hareket: PASS.
   - **44 px: FAIL.** `.card-close` 34 px; "Özgün metin" özetinin boyutu tanımlı değil. Tekrar üretim testi: `tests/qa-r2b-card-targets.test.ts` (FAIL 2/2).

## CEO göz kontrol listesi (localhost:5173)
1. Zemin kat: güvenlik masası ve turnikede masa çakışması var mı? Resepsiyon çıtaların altından görünüyor mu?
2. 0, 4 ve 5. katlarda sarkıt lambalar robotları gizliyor mu? AJANS tabelası camın dışında kalıyor mu?
3. Lobi mermeri ve pirinci yansıma veriyor mu, yoksa mat mı?
4. Ayarlar › Görünüm: kaliteyi Düşük'ten Ultra'ya çalışırken geçir; görüntü değişiyor ve donma olmuyor mu?
5. Otomatik: gece kısa mı (yaklaşık 1 dk)? Duraklatmada saat donuyor mu?
6. Ekranda yalnız kat planı kalıyor mu? Sekmeler arasında klavyeyle geçiliyor mu, Esc menüyü kapatıyor mu?
7. Kart: Türkçe ad + id, açıklama, "Özgün metin", araç açıklamaları görünüyor mu? Telefonda × ve özet kolay basılıyor mu?
8. 12:30'da robotlar ve CEO kanada gidiyor mu? İş listesi akmaya devam ediyor mu?
9. Kampüs: Ar-Ge ★, otopark, şehir trafiği, temizlikçi, çaycı ve güvenlik görünüyor mu?
10. `?debug=1`, yüksek kalite, genel görünüm: ≥ 30 fps mi? Değeri kaydet.
11. DevTools › Network: sayfa yüklendikten sonra istek var mı? Beklenen: yok.
12. macOS Hareketi azalt açıkken: yürüme animasyonu yok, şehir donuk, panel kayarak açılmıyor mu?
