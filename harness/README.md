# harness/

Şirketin zorlama katmanı. Kurallar burada araçla zorlanır.

| Dosya | Görev |
|---|---|
| `approval.js` | `keygen`, `sign`, `verify`: ed25519 imza, spec içeriğinin SHA-256 özetine bağlı. Bağımlılıksız Node. |
| `gate.js` | `PreToolUse` kapısı: imzasız kod yazımını, korumalı yolları (`approvals/`, `.claude/`, `.git/`) ve çalışma alanı dışını engeller. Kapalı-başarısızdır (bozuk girdi veya hata = engel). |
| `container-settings.json` | Konteynerde `--settings` ile verilen izinler (Q11 listesi) ve kapı hook'u. |
| `docker/` | Ajan imajı ve çıkış vekili. |
| `bin/` | `check`, `lint.js`, anahtar üretimi, imzalama, vekil, imaj, çalıştırma. |
| `test/run.sh` | Onay aracı ve kapı için davranış testleri. |
| `keys/` | **Yalnızca genel anahtar** (`ceo.pub.pem`). Özel anahtar `~/.company/keys/` altındadır ve hiçbir konteynere bağlanmaz. |

## Ajan belirteci (konteynerdeki Claude için)

1. Kendi terminalinde `claude setup-token` çalıştır. Belirteç bir yıl geçerlidir, ayrı bir kimlik değil abonelik hesabına bağlıdır ve yalnızca model isteği atabilir.
2. `~/.company/agent.env` dosyasına `CLAUDE_CODE_OAUTH_TOKEN=<belirteç>` yaz, mod 600.
3. Belirteç **sohbete, repoya, loga girmez.** İş bitince `rm ~/.company/agent.env`.

Belirteci terminal çıktısından ayıklarken sonuna fazladan karakter yapışabilir: geçerli bir belirteç `sk-ant-oat01-` ile başlar ve 108 karakterdir (bu makinede doğrulandı); yanlışsa API "401 OAuth access token is invalid" döner.

## Bilinen sınırlar

- Hook yalnızca `Write`, `Edit`, `MultiEdit`, `NotebookEdit` üstündedir. `Bash` ile yazma yolunu kapatan şey Docker bağlama modudur (imzasızken çalışma alanı salt-okunur). İkisi birlikte gerekir.
- Çalışma alanındaki `.git/config` yazılabilir; doğrulayıcı betikler çalışma alanının dışında olduğu için etkilenmez.
- Konteynerdeki ajan, ortam değişkeninden belirteci teorik olarak okuyabilir (bkz. SEC-10).
- Vekil yalnızca ana ad ve portu görür, TLS içeriğini görmez.
- Başsız (`-p`) çalışmada onay verecek kimse yoktur: izin listesi dışındaki veya bileşik `Bash` komutları ajanı durdurur.
