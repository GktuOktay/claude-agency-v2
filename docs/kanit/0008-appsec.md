# Spec 0008, appsec teslim incelemesi (T-32 / AC-31), 2026-11-27

Ana oturumun özeti; birim raporundan. Base: `origin/main` fd2836e..26dab60.

- Karar: PASS WITH CONDITIONS; kritik 0, yüksek 0, orta 0, düşük 2.
- Kanca: çalışma ağacı `harness/guard.js`, `git hash-object` 20b0ff9ee0ef31148e4f9a25ed40ac1b072ee07b = `git rev-parse origin/main:harness/guard.js` (yerel `main` bir commit geride, karşılaştırma tabanı `origin/main`). 0010 birleşmesi fd2836e HEAD'in atası (rc=0).
- Prob: 0010 §7 "Refused in `auto`" sütunu (D2-1..D2-14, ekler, D2-opak durumlar) 79/79 exit 2, stderr `BLOCKED by company guard:`; hiç `ask` yok. Komşular 23/23 görüş yok (`security find-identity -v -p codesigning` dahil). D2-15: lint `ok    secret-names` ve `secret-names.js .` rc=0 (kanca ile denenemez, alıntı).
- Zarf: `rn-engineer`, `rn-engineering`, `store-release`, `mobile-common`, `devops-sre` işaretçisi mağaza gönderimini, release imzayı, provisioning güncellemesini, eas/OTA'yı ve sır yazımını yasaklıyor. `rn-engineer` `UNLOCK_CALLERS` içinde değil (`harness/policy.js:379`). Eklenen satırlarda sır deseni 0.
- Şart S-01 (düşük): AC-31'deki `main:` ifadesi yerel `main` eskiyken yanıltır. Kapanış: kanıt `origin/main` ile kaydedildi (bu dosya).
- Şart S-02 (düşük): atılık anahtar parolasının izinli bir geçiş yolu yok (env değişkeni Bash çağrıları arasında taşınmaz; satır içi yasak). Kapanış: imzalı REQ-7 metni değiştirilmedi; açık iş olarak `docs/ACIK-ISLER.md`'ye yazıldı, sonraki spec revizyonunda ele alınacak. Atılık anahtar yüklenemez, etkisi düşük.
- AC-19 appsec vakası `evals/application-security.md` Case 4 olarak işlendi.
