# Mimari görüş: spec 0010 guard hardening (D2, lint fikstürü, kanca geçici kopyası) | Tarih: 2026-11-26 | Karar: CONDITIONAL APPROVE

Kapsam: `specs/draft/0010-guard-hardening.md` (sha12 `67532725bd3d`, görev tanımından alındı; kurul hesaplayamaz) ve tasarım `docs/architecture/tasarim/0010-guard-hardening.md`. Okunan kaynak: `harness/guard.js`, `harness/policy.js`, `.claude/settings.json`, `harness/gate.js` (yükleme satırları), `harness/test/guard.sh:84-91`, `harness/test/policy-driver.js:60-89, 200-202, 444-451`, `harness/test/host-gate.sh:318-326`, `harness/README.md:156-164`, `.gitignore`, `docs/ACIK-ISLER.md:51`, ADR 0001. Bash ve web aracı yok: **hiçbir şey çalıştırılmadı**, her kod iddiası kaynaktan okundu. Spec değiştirilmedi. Kapsam kesintisi (spec §13) tartışılmadı, kesilen kalemler geri istenmiyor. Koşullar `GK-`, öneriler `GÖ-`.

## Karar özeti
Yön doğru: yeni bağımlılık yok, yeni zorlama dosyası yok, D2 ailesi `auto` kipte görünür ret alıyor, iki gevşetme dar ve açıkça adlandırılmış. İmzayı altı metin koşulu bekletiyor. Ağır olan ikisi: (1) işin en riskli canlı yazması (`policy.js`, T-2) onarım biçimi gelmeden ve denenmeden yapılıyor, yani 0004'ün kilidi aynı adımda yeniden mümkün; (2) gevşetme 1'in gerekçesinde, sözleşmede zaten duran gevşetmesiz yol tartılmamış. Hiçbir koşul kod ya da kapsam eklemez.

## Kararlar ve değerlendirme
| # | Karar | Gerekçe var mı? | Alternatif | Risk | Sonuç |
|---|---|---|---|---|---|
| D-1 | R-1: `shell.js` yok; D2 görünümünde dört adım, `guard.js` içinde | Var | Tasarım B (ön geçiş + tetik teli), A (biçim biçim) | Kesilen kapsamda genel ön geçişi isteyen ölçüt yok; bedel yazılı (G-23: bilinmeyen yazım sessiz geçer). R-1'in dayandığı bir olgu yanlış | APPROVE; GK-4 |
| D-2 | R-2: dar geçici kopya istisnası (gevşetme 1) | Eksik | İç kök kopyası (tartılmamış); geniş biçim; yalnız talimat | Sözleşmede ad koruması bir biçimde kalkar; imza ve çağıran koşulu yok | KOŞULLU: GK-2, GK-3 |
| D-3 | Onarım biçimi (gevşetme 2) | Var | Yalnız kurtarma yolu R; kapı HEAD yükler | Sağlam politikada komut bugün de görüş almıyor (G-5); tek fark politika yüklenemezken | APPROVE; sırası GK-1 |
| D-4 | Bootstrap istisnası (§12 kural 3) | Yetersiz | Önce onarım biçimi; iç kök kopyası | Denenmemiş canlı `policy.js` yazması, oturum içi onarım yolu henüz yok | KOŞULLU: GK-1 |
| D-5 | R-3: D2 eşleşmesi kip kuralında (kesin ret değil) | Var | Her kipte ret; bugünkü "sor" | Kanıtlı kipte tek tık (CEO kararıdır, kural 4); `auto`'da zarf iki katmanlı kalır | APPROVE |
| D-6 | R-5: sır adı kalıbı `policy.js` dışa aktarımı | Var | `guard.js` + eşitlik testi; `secret-names.js`; yeni modül | `guard.js` yüklenince çıkış yapar, `require` edilemez; ürün-ayarı dosyasına bağımlı zorlama dosyası olmaz. Politika yüklenemezse REQ-3 işlemez (o durumda her Bash zaten ret) | APPROVE; GÖ-1 |
| D-7 | R-4: kapı ön denetimi yok, `gate.js` kapalı kalır | Var | `vm.Script` ön denetimi | Kilit riski usule kalır: GK-1, GK-5 | APPROVE |
| D-8 | Yeni bağımlılık yok (Node yerleşikleri, POSIX sh, `git`) | Var (§6) | - | - | APPROVE |

## Kod ile karşılaştırma
| İddia (spec) | Sonuç |
|---|---|
| R-1: substitution, `eval`, `xargs`, `sh -c` "zaten" ham ikinci görünümü alır (`guard.js:297-301`) | **Kısmen yanlış.** `opaque`, `strip()` çıktısında sınanır (`guard.js:186`, `:297`); `strip` çift tırnak içini boşaltır (`:51`). `echo "$(fastlane deliver)"` → `echo ""`: opak sayılmaz, K kümesi açık kalır. AC-1'in bu vakası dört adımla kırmızı kalır |
| §10 adım 5: bozuk `policy.js` onarım biçimiyle döner | **T-2 boyunca yanlış.** Onarım biçimi T-3'te gelir. O ana kadar politika yüklenemezse `auto` kipte her Bash ret (`guard.js:197-203`), dosya araçları kapalı (`gate.js:11`): yalnız kurtarma yolu R |
| §10 adım 5: bozuk `guard.js`, dosya araçları açık, "kopyadaki HEAD sürümü" geri yazılır | İlk yarı doğru (`.claude/settings.json:20-35`). İkinci yarı tutmaz: kopya adım 2'de düzenlenmiştir, Bash kapalıyken yeni kopya da alınamaz |
| R-2: geniş biçim mevcut vakaları çevirir, dar biçim çevirmez | Doğru (`policy-driver.js:76-82`, `:200-201`, `:448-449`: `@T/out/…`, `/tmp/other/…`; dizin adı uymaz) |
| Onarım biçimi sağlam politikada bugünkü kararını alır (görüş yok) | Doğru (`guard.js:325-348` içinde `restore` kuralı yok) |
| §6: "linked worktree (needs B29)" | **Eksik.** B29'un açık soruları yalıtım içindir. Kopya olarak iç kök bugün çalışır: aynı imzalı spec'i taşıyan `.claude/worktrees/<ad>` içinde tam yoluyla yazılı zorlama dosyası dosya araçlarına açıktır (ADR 0001 "İç kökte kopya (D-8)"; `policy.js:191-193, 441-453`; test `host-gate.sh:318-326`; `.gitignore:16`) |
| §4 şeması | Metinle çelişir: K kümesi bütün D2 kurallarına uygulanmış; REQ-3 `cat release.jks` ve `cp a.p12 b` komutlarını reddeder (`cat`, `cp` K'dadır) |

## Koşullar (imzadan önce; hepsi yalnız spec metni)
- **GK-1 [Sıra: onarım biçimi ilk canlı `policy.js` yazmasından önce]** Bugünkü sırayla T-2'deki bootstrap yazması bozulursa oturum kilitlenir ve §10 adım 5 o anda yanlıştır (yukarıda). İstenen: yalnız onarım biçimini taşıyan küçük `guard.js` değişikliği önce canlıya girsin (bozulursa Bash kapanır, dosya araçları açık kalır, önceki içerik geri yazılır), `policy.js` ondan sonra; ya da GK-2 (a) ile bootstrap istisnası tümden kalksın. Bootstrap kalacaksa kapsamı tek cümleyle sınırlansın: yalnız istisna ve ona gereken geçici küme; sır adı kalıbı kopyada geliştirilir.
- **GK-2 [Gevşetme 1'in gerekçesi eksik]** "Hiçbir şey ekleme" seçeneği tartılmamış: (a) kopya, ayrık HEAD'li bir iç kök olsun (`git worktree add --detach .claude/worktrees/<ad>`; guard'da kuralı yok). Kazanç: REQ-8, bootstrap istisnası ve geçici küme lint kuralı düşer; `policy.js` ilk canlı yazmadan önce kopyada sınanır; yetki imza ve çağıran koşulu altında kalır. AC-7'nin boş `specs/active/` kopyası için `hook-scratch.sh` yine gerekir. Bu, tasarımın L-8 kalemi değildir (canlı kancalar yine çalışma ağacından yüklenir). Ya (a) alınsın (kurulun önerisi; mühendis ilk adımda tek bir yazmayla doğrular), ya da (b) R-2 kalsın ve neden (a) olmadığı §6 tablosuna kanıtıyla yazılsın. Kaynaktan okundu, çalıştırılmadı.
- **GK-3 [Sınıf değil karar; "aynı kök"; tam harf]** (R-2 kalırsa.) §7 "Then the class is outside" cümlesi koşul 4 ile çelişir: sınıf yalnız yolun işlevidir (`policy.js:223`), araç türünü bilmez. İstisna, 2026-11-22 kuralı gibi, satır 2 üzerinde bir **karar** istisnası olarak yazılsın ("no opinion"; `classify()` değişmez; AC-5 "keeps today's decision"). "Aynı geçici kök S" ADR 0001 koşul 1 tanımıyla (`çözülmüş S === realpath(yazılan S)`, aynı S-göreli yol) ve karşılaştırma tam harfle yazılsın.
- **GK-4 [R-1 olgu düzeltmesi]** R-1 metni düzeltilsin: D2 görünümü kendi opaklık sınamasını, here-doc gövdeleri atılmış ama çift tırnak içi korunmuş metinde yapar; `guard.js:297` ifadesine dokunulmaz (REQ-11). Külliyata bir satır: `git commit -m "$(cat <<'EOF' … fastlane … EOF)"` görüş almaz (oturumun olağan commit biçimi; tasarımda N-2 ve N-10 idi, R-1'de yok).
- **GK-5 [Düzenlenmemiş HEAD kopyası]** §10 adım 1 ve 5, canlı `guard.js` yazmasından önce dosya araçlarıyla okunabilen, düzenlenmemiş bir HEAD kopyasının yerini adlandırsın; REQ-7 kopyanın kaynağını söylesin (HEAD içeriği mi, çalışma ağacı mı).
- **GK-6 [Şema ve metin]** §4 şeması düzeltilsin: K kümesi yalnız REQ-1 içindir; REQ-3'ün kendi dört komutluk istisnası vardır; REQ-2'nin "her sözcükte mi, komut sözcüğünde mi" denendiği bir cümleyle yazılsın (`sudo security dump-keychain`, `which codesign`).

## Öneriler (imzayı engellemez)
- **GÖ-1** R-5: kalıp paylaşılan bir `RegExp` nesnesi yerine saf bir işlev olarak dışa aktarılsın (bayraklı ifade durum taşır). Bir Ruling: politika yüklenemezse REQ-3 değerlendirilmez, mevcut ret kapsar; REQ-1 ve REQ-2 sabitleri `guard.js` içinde kalır ve politikasız da çalışır.
- **GÖ-2** G-26 metnine iki cümle: dizin adı köken kanıtı değildir; istisna imzaya ve çağırana bakmaz. G-23'e: sözcük içi ters bölü (`\fastlane`) dört adımın dışındadır.
- **GÖ-3** A-1 imzada açıkça gösterilsin: `fastlane deliver` reddedilirken `npm publish`, `gh release create` ve `main`'e push `auto` kipte uygulamanın sınıflandırıcısına kalır. Tasarımda Tip 1 soruydu (Q-1); ana oturum dar seçeneği seçti.
- **GÖ-4** Spec 0011 D2 kurallarını genel ön geçişe taşısın; iki sözcük normalleştiricisi kalmasın (ADR 0002 tetikleyicisi).

## Gereksiz bulundu (kriter yok)
Teknoloji ya da katman: yok. `harness/shell.js` bu kapsamda ölçütsüzdür, spec onu zaten çıkarmış (R-1 doğru). Gevşetme 1, GK-2 (a) tutarsa gereksizdir.

## Geri dönüşü pahalı kararlar
Yol sınıfı sözleşmesi ve izin-kipi kapsamı: ADR gerekli, **yazıldı**: `docs/architecture/adr/0002-hook-scratch-and-mobile-envelope.md` (Proposed; üç karar, reddedilen seçenekler, GK-2 "açık" olarak). ADR 0001'e tek satırlık gönderme eklendi. Üç karar da geri alması ucuzdur (bir koşul bloğu, bir satır, bir kural kümesi); pahalı olan yön genişletmedir. `Unlocks:` dilbilgisi değişmez: başka spec'in yeniden imzası gerekmez. R-1 ve R-5 ucuzdur, ADR gerekmez.

## STACK.md değişikliği
Yok.

## Cevapsız sorular ve doğrulanmayanlar
- İç kök yolunun canlıda penceresiz geçtiği bu görev için gözlenmedi (test vakası var, `CLAUDE.md` üzerinde); `auto` kipte uygulamanın kendi kararı ikinci karar vericidir.
- `policy-driver.js` içindeki `@T` kökünün adı okunmadı; R-2'nin "vaka çevrilmez" iddiası `out` ve `other` dizin adlarına dayanır.
- ADR 0001 durumu hâlâ "Proposed (0004 yeniden imzasını bekliyor)"; 0004 kapandı (commit `10aa039`). Kurul bu turda yalnız gönderme satırını ekledi; durum satırı ayrı düzeltme ister.
- Güven sınırı, K kümesi, REQ-3'ün yanlış retleri (`git rm --cached release.jks`, `grep "\.jks"`) ve iki izinli anahtar deposu konumu `appsec` ile `spec-critic`'in alanıdır; bu görüş onların yerine geçmez.
- CEO'ya gösterilecek yeni teknoloji ya da bağımlılık yok.
