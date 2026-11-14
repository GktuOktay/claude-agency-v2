# Ajans Kulesi (Agency Tower 3D)

Ajansın robotlarla dolu altı katlı bir ofis kulesi olarak 3B sunumu. Yalnızca sunum içindir; ajansın kendisinden tamamen yalıtılmıştır. Spec: `specs/active/0001-agency-tower-3d.md`. Bu sürüm Milestone 1 ve 2'yi kapsar: kule, katlar, asansör, robotlar ve kart (M1); organizasyon şeması, gündüz/gece döngüsü, mobil düzen ve azaltılmış hareket (M2). Görünüm: izometrik "ofis dioraması" (meşe zemin, cam odalar, yuvarlatılmış mobilya); tüm geometri ve dokular kodla üretilir, görsel dosyası yoktur.

## Çalıştırma

Node 22 gerekir (`.nvmrc`; `engine-strict` açıktır, Node 23/25 kurulumu reddeder).

```
npm ci
npm run dev        # geliştirme sunucusu
npm run build      # dist/ üretir (commit edilmez)
npm run preview    # build çıktısını yerelde gösterir
npm test           # yalnızca commit edilmiş JSON ve fixture'larla çalışır
npm run roster:check
```

WebGL2 gerekir. URL parametreleri: `?quality=low|high`, `?debug=1` (fps göstergesi). Kısayollar: `0`–`5` kat, `O` organizasyon şeması, `Esc` kartı kapat (kart yoksa org modundan çık); araç çubuğundan kapatılabilir.

## Kullanım

- **Kat seçimi:** soldaki panel (telefonda üstte numaralı şerit) veya `0`–`5`. Asansör kabini kamerayla birlikte gider.
- **Robot kartı:** robota tıklayın/dokunun veya klavyeyle birim listesinde Enter. Kamera robota yaklaşır, robot el sallar; kart 768 px altında alttan açılan sayfadır.
- **Organizasyon şeması:** araç çubuğundaki düğme veya `O`. Bina saydamlaşır, robotlar yerinde durur, her birimden bağlı olduğu birime sabit bir çizgi çizilir (bağımsız birim kesik çizgi; açıklama ekranda). Kapatınca önceki görünüm ve kat geri gelir.
- **Gündüz / Gece / Otomatik:** varsayılan Otomatik; 90 saniyelik döngü öğle saatinden başlar. Gece pencereler, zemin ışıkları ve lambalar yanar.
- **Dokunmatik:** tek parmak döndürür, iki parmak yakınlaştırır, dokunma seçer; sayfa kaymaz.
- **Azaltılmış hareket:** işletim sisteminde açıksa kamera ve asansör geçişleri anlık olur, robotlar sabit pozda durur (el sallamak yerine kol kalkık), ekranlar kaymaz, gün ışığı Gündüz'de kalır ve Otomatik seçeneği kapanır (Gündüz/Gece elle seçilebilir). Sayfa yenilenmeden uygulanır.
- **Kalite:** dokunmatik cihazlar `low` (gölge yok, DPR 1), diğerleri `high` ile başlar.

## Kadro verisi ve bayatlama uyarısı

`src/data/roster.generated.json` `.claude/agents/*.md` dosyalarından `node scripts/build-roster.mjs` ile üretilir (salt okunur; yalnızca ad, açıklama, araçlar, model). `src/data/hierarchy.json` elle yazılmış katman, kat ve Türkçe rol verisidir.

**Uyarı:** bir ajan eklendiğinde veya değiştiğinde üretilen JSON bayatlar; `roster:check` otomatik çalışmaz (CI'a bağlı değildir). Ajan değişikliğinden sonra `npm run roster:check` çalıştırın, bayatsa `node scripts/build-roster.mjs` ile yenileyin ve overlay'e yeni birimi ekleyin. `roster:check` yalnızca depo içinde çalışır; `npm test` ajan klasörüne hiç dokunmaz.

## Yalıtım kuralları

- Tüm dosyalar `showcase/agency-tower/` altındadır; `harness/`, `.claude/`, `site/`, `templates/` içinden hiçbir şey import edilmez.
- Çalışma zamanında klasör dışına bağımlılık yoktur; sayfa yüklendikten sonra ağ isteği yapılmaz.
- Tek istisna: `scripts/build-roster.mjs` içindeki varsayılan ajan klasörü sabiti (yalnızca yeniden üretimde, salt okunur).
- `npm run isolation:check` bu kuralları denetler (`src/`, `scripts/`, `index.html`, `vite.config.*` taranır).
- Bu klasörü kuran ajans yüklemesine bir şey eklemez; `harness/` ve CI showcase testlerini çalıştırmaz.

## Faz 2 (kapsam dışı)

Playwright tarayıcı testleri, örnek iş/hat akışı tekrarı, canlı veri, kartlarda hat üyeliği, ay ve yıldızlar, açık/koyu arayüz teması, ses, yayınlama. Görsel kontrol (ekran görüntüsü, iki tema, telefon) göz ile yapılır; ekran görüntüleri depoya girmez.
