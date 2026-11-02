# Kılavuz değerlendirme setleri (SOP-04)

Her birim kılavuzu için `evals/<kılavuz>.md`: en az 3 vaka. Bir vaka bir görev, mekanik ölçütler ve iki örnek çıktı içerir (`geçer`, `kalır`).

- **Set kendini sınar** (`node harness/bin/eval.js self evals/<kılavuz>.md`, CI'da `lint.js` çalıştırır): `geçer` örneği ölçütleri geçmeli, `kalır` örneği kalmalı. Böylece ölçüt boş bir kontrol olamaz.
- **Gerçek birim çıktısını notlamak** için: `node harness/bin/eval.js grade evals/<kılavuz>.md <vaka-no> <çıktı-dosyası>`. Kılavuz değiştiğinde ilgili vakalar birimle çalıştırılır ve çıktı notlanır (canlı koşu, ayrı iştir; açık iş B5 sonrası).
- Ölçütler biçime ve zorunlu içeriğe bakar (bölüm var mı, kanıt satırı var mı, yasak kalıp yok mu). İçeriğin doğruluğunu yargılamaz; onu Internal audit yapar.

Ölçüt türleri: `bölüm: X` · `içerir: /re/bayrak` · `içermez: /re/bayrak` · `en az N: /re/bayrak`.
