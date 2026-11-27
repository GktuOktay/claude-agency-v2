# Metro --localhost ölçümü (T-31, AC-27)

## T-31 (AC-27) olumlu dal
Deneme deposu the trial repo, uygulama klasörü `app/`, `node_modules` mevcut: kurulum yapılmadı. Expo paketi sürümü 58.0.26. `git status --short` önce: boş (0 satır); sonra: boş.
Komut: `EXPO_NO_TELEMETRY=1 CI=1 ./node_modules/.bin/expo start --localhost` (npx yerine yerel ikili, aynı CLI; kurulum yok).
```
$ lsof -nP -iTCP:8081 -sTCP:LISTEN     (sunucu çalışırken)
node 20779 <user> 23u IPv4 0x28b22a0c593d0fd4 0t0 TCP 127.0.0.1:8081 (LISTEN)
$ lsof -nP -iTCP:8081 -sTCP:LISTEN     (durdurmadan sonra: pkill -f "expo start --localhost")
(boş)
```
Tek dinleyici 127.0.0.1; `[::1]` satırı görülmedi. Sunucu günlüğü: `Waiting on http://localhost:8081` ve `xcrun simctl` hatası (simülatör yok, konu dışı). Not: ham çıktı bu dosyada; `docs/kanit/0008-metro-localhost.md` yazma izni bu görevde yoktu, ana oturum oraya taşısın ve `rn-engineering` adım 3 satırını "127.0.0.1 only, Expo 58.0.26" olarak güncellesin.
