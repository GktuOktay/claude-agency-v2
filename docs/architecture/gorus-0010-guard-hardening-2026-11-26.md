# Mimari görüş: spec 0010 guard hardening (D2, lint fikstürü, kanca geçici kopyası) | Tarih: 2026-11-26 | Karar: CONDITIONAL APPROVE (tur 1) → APPROVE (tur 2; sondaki "Kapanış" bölümü)

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

## Kapanış: 2. tur yeniden denetim (2026-11-26) | Karar: APPROVE

Denetlenen metin: `specs/draft/0010-guard-hardening.md`, 2. tur, sha12 `84d549b1416c` (görev tanımından alındı; kurul hesaplayamaz), commit `c68867f`. Satır numaraları o metnindir. Yukarıdaki bölümler 1. tur metnini (`67532725bd3d`) anlatır ve değiştirilmedi. Hiçbir şey çalıştırılmadı; kaynak göndermeleri yeniden okundu (`harness/policy.js:184-209, 308-321, 330-337, 428-454, 479-500`, `harness/guard.js:51, 186-203, 297, 304-349`, `harness/test/host-gate.sh:318-326`, `harness/test/guard.sh:35, 88-89`, `.gitignore:16`): spec R-6'nın satır göndermeleri kaynakla uyuşuyor.

| Koşul | Durum | Kanıt (spec satırı) |
|---|---|---|
| GK-1 onarım biçimi ilk canlı `policy.js` yazmasından önce | **Karşılandı** | T-2 ilk uygulama görevi, tek başına, canlı `guard.js` yalnız onarım biçimiyle (173); `policy.js` T-3'te (174); §12 kural 3 (168); §10 adım 3 `node --check` ve W takımları (157); adım 5 "live since T-2" (159); bootstrap istisnası kalktı (203) |
| GK-2 gevşetmesiz seçenek tartılsın | **Karşılandı, (a) alındı** | §6 tablo satırı (72); R-6 (80); R-2 düştü (76); §10 usul (154-162); başlık: `shell.js` ve `hook-scratch.sh` yok, iki zorlama dosyası iç kökte de açılır (10); §13 "any scratch exemption … dropped" (196). `hook-scratch.sh` yerine §10 adım 7'nin üç git komutu geldi (161): kabul, bir dosya eksik |
| GK-3 sınıf değil karar; "aynı kök"; tam harf | **Konusu kalmadı** | İstisna yok (216); §7'de geçici kopya maddesi yok (82-114); yol politikası değişmiyor (80) |
| GK-4 R-1 olgu düzeltmesi, here-doc commit vakası | **Karşılandı** | R-1 altıncı adım: D2 opaklığı here-doc gövdeleri atılmış, çift tırnak içi korunmuş metinde; `guard.js:297` dokunulmaz (75); §7 D2-opaque listesi, `echo "$(fastlane deliver)"` vakasıyla (90); AC-1: here-doc gövdesinde `fastlane` geçen commit görüş almaz (52) |
| GK-5 düzenlenmemiş HEAD kopyası | **Karşılandı** | P = `.claude/worktrees/0010-head`, hiç düzenlenmez (154); kaynağı `HEAD` (155); bozuk `guard.js` → `Read` P, `Write` geri (159); her commit'ten sonra yeniden kurulur (160) |
| GK-6 §4 şeması ve metin | **Karşılandı** | Şemada K yalnız araç-sözcüğü kurallarında; REQ-3 ve REQ-7 doğrudan kip kuralına (36-47); metin eşdeğeri madde 3-4 (48); REQ-2 "any position, any wrapper, basename, no case; K applies" (22); K listesi (89). K'nın REQ-2'yi de kapsaması koşulun lafzından ("yalnız REQ-1") geniştir ama gerekçelidir ve koşulun kendi örneğiyle (`which codesign`) uyumludur (A-5, 236): kabul |

Öneriler: GÖ-1 işlendi (R-5: saf işlev, politikasız REQ-3 değerlendirilmez; 79). GÖ-2: G-26 cümleleri istisnayla düştü; ters bölü R-1'e girdi (75). GÖ-3 işlendi (A-1 "shown at signing", 232). GÖ-4 işlendi (§13, 185).

Yeni karar (tur 2): kanca kaynağı geri alma kuralı, REQ-7 (27), §7 "Hook-source word" (93), AC-5 (56), A-4 (235). Değerlendirme: APPROVE. Gerekçe var (S-05; §8 satır 122), alternatifler tartılmış (yol sözcüğü olmayan biçimler A-4'te bilinçli dışarıda), kip kuralı altında CEO kararı, onarım usulüyle çelişmiyor (§10'daki git komutlarının hiçbiri kurala takılmaz: `worktree`, `add`, `diff`, onarım biçimi). ADR 0002 Karar 3 (f) olarak kayda girdi.

İmzayı engellemeyen notlar (plana ve README metnine; spec değişikliği istemez):
- **GÖ-5** REQ-7 komut metnini okur: `git checkout -- .` ve `git restore .` bu harness'i kullanan her projede, `harness/` dizini olmasa da, `auto` kipte reddedilir. README "CEO'ya ait komutlar" başlığı bunu ve çıkışı (yolları adıyla yazmak) söylesin; külliyata bu biçimler konmasın.
- **GÖ-6** D2-opak bir komutta "önce here-doc gövdesi atılır, sonra tırnak içleri sözcük sözcük okunur" sırasını §7 tek cümleyle söylemiyor; sırayı AC-1 vakası sabitliyor (52, 90). Bulgu haritasının söz verdiği külliyat satırı (206) T-4 metninde (175) adıyla geçmiyor: plan taşısın.
- **GÖ-7** §6 bileşen şeması tasarıma bağlantıdır ve tasarımda artık olmayan parçalar durur (`shell.js`, `gate.js` değişikliği, geçici kopya betiği); spec bunu metinle söylüyor (66). README'ye girecek şema spec'in bileşen cümlesinden çizilsin.

Belge durumu:
- ADR 0002 2. tur metniyle eşitlendi: geçici kopya istisnası reddedilen seçeneklere taşındı; Karar 1 iç kök usulü (gevşetme yok); geri alma kuralı Karar 3 (f).
- `docs/architecture/adr/0001-path-class-taxonomy.md:8` gönderme satırı hâlâ "geçici kopya istisnası" diyor ve geri alma kuralını anmıyor; bu turda kurulun yazma izni iki dosyayla sınırlıydı, düzeltilmedi. Aynı dosyanın durum satırı (3) da eskidir (yukarıda bildirildi).

Doğrulanmayan: iç kök yolunun kanca adlı bir dosya için canlıda penceresiz geçtiği (kaynaktan okundu; mevcut test `CLAUDE.md` üzerinde). Spec bunu §10 adım 1'deki ilk yazmayla kanıtlıyor ve red hâlinde duruyor (80, 155); `auto` kipte uygulamanın kendi sınıflandırıcısı ikinci karar vericidir (A-6, 237). `harness/keys/**` gibi kanca kaynağı olmayan zorlama yollarının git ile geri alınması REQ-7'nin dışındadır (yalnız `harness`, `.` ve `harness/<x>.js` sözcükleri): `appsec`'in alanı, spec 0011 (B34 g'nin kalanı).

**Son karar: APPROVE.** Altı koşulun beşi karşılandı, biri (GK-3) konusuz kaldı; açık koşul yok. Yeni teknoloji, bağımlılık ya da zorlama dosyası yok: CEO'ya ayrıca gösterilecek teknoloji kararı yok. STACK.md değişmez. Geri dönüşü pahalı karar: ADR 0002 (Proposed), imzayla kabul sayılır. İmzadan sonra spec baytı değişirse bu karar o metni kapsamaz.
