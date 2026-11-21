# Mimari görüş: spec 0004 ana makine (host) zorlaması | Tarih: 2026-11-21 | Karar: CONDITIONAL APPROVE

Kapsam: `docs/architecture/tasarim/0004-host-enforcement.md` (software-architect). Spec değiştirilmedi. İncelenen kaynak: `harness/gate.js`, `guard.js`, `approval.js`, `stop.js`, `harness/bin/approve.sh`, `install-project.sh`, `company-run.sh`, `harness/test/run.sh`, `.claude/settings.json`, `harness/container-settings.json`. Web ve Bash erişimim yok: Claude Code kanca sözleşmesi (çıkış kodu 1 = bloklamayan hata, yalnız 2 bloklar) **doğrulanmadı**, belgeye dayanıyor; T1'de denenmeli (koşul K6). Eşik: KARARLAR rev. 48 (parolasız anahtar kabul) yeniden tartışılmadı; kontroller kazayı durdurur, kötü niyetli ajanı değil.

Yeni bağımlılık: **yok**. Kullanılanlar Node yerleşikleri (`fs`, `path`, `crypto`, `child_process`, `String.normalize`, `fs.realpathSync.native`) ve POSIX sh; `git` zaten `guard.js:16` kullanıyor. Tek not: `git rev-parse --path-format=absolute` git >= 2.31 ister; host git sürümü doğrulanmadı (T1 kaydetsin). STACK.md değişmez.

## Mevcut davranış iddiaları (kod ile karşılaştırma)
| İddia | Sonuç |
|---|---|
| gate yalnız konteynerde (`container-settings.json:26-31`), host'ta yalnız guard (`.claude/settings.json:19-36`) | Doğru |
| `install-project.sh:15` gate'i bağlamıyor; routing.md son satırı yanlış | Doğru |
| guard dosya aracı dalı yalnız ENFORCEMENT regex (`guard.js:50,73-77`); gate `.claude/` tamamını engelliyor (`gate.js:32`) | Doğru |
| `appr*.sh .` regex'i atlatır (`guard.js:90` literal `approve.sh` arar) | Doğru |
| `stop.js:10-11` NON_CODE / EVIDENCE alanları | Doğru |
| `qa-engineer` araçları Write, Edit, Bash | Doğru (`qa-engineer.md:4`) |
| Satır 80: yeni row 2 desenleri ENFORCEMENT regex'inin **üst kümesi** | **Yanlış.** Regex `CLAUDE\.md$`, `approvals/`, `harness/keys/`, `.github/workflows/` desenlerini her derinlikte ve mutlak yolda yakalıyor; row 2 bunları yalnız kök-göreli sayıyor, row 7 "outside" ise host'ta görüş bildirmiyor. Alt dizin `CLAUDE.md` ve başka projenin `harness/keys/` yolu daha önce soruluyordu, artık sessiz. |
| Bildirilen "kanca betiği çöker → hata kodu 1 → çağrı sürer" | Kısmen. `gate.js:8` ve `guard.js:9` `uncaughtException` işleyicisini **her `require`dan önce** kuruyor: çalışma zamanı hatası ve bozuk modül zaten exit 2. Açık yalnız giriş dosyasının söz dizimi hatası, eksik dosya, boş `$CLAUDE_PROJECT_DIR`. Sarmalayıcı bu kümeyi kapatır. |

## Kararlar ve değerlendirme
| # | Karar | Gerekçe var mı? | Alternatif | Risk | Sonuç |
|---|---|---|---|---|---|
| D-1 | Anlaşmalı istisna notu (E) | Var, ama eşiği aşmıyor | A: olay başına diyalog (zaten var) | 2. başlık grammar'ı, süre alanları, lint, şablon, imzalı not yaşam döngüsü; kazayı önlemeye katkısı A'dan fazla değil | Ertele; bu işte A. Sürtünme kanıtlanırsa ayrı işte E |
| D-2 | Önizleme + `--expect` | Var | Tıklama sonrası yazdırma | Düşük | APPROVE (kazada gerçekten işe yarar: yanlış baytları imzalamayı önler) |
| D-3 | Bash yazıcılar için ask | Var | Boşluk olarak bırak | Tokenizer büyük | APPROVE, kapsam daraltılarak (K4) |
| D-4b | Çözümlenmiş yol + sha256 ile imza betiği tespiti | Zayıf: kanıt "appr*.sh atlatır" kötü niyet senaryosu | Metin regex (var) + G-4 | Rev. 48 altında sınır değil, yalnız uzatma; kod ve yanlış pozitif maliyeti | REDDET; regex kalsın, G-4 açık boşluk |
| D-5a | Kancalar çalışma ağacından | Var | Sabitlenmiş kopya | Yok | APPROVE |
| D-6a | `agent_type` + `write-areas.json` | Kısmen; alan `agent_type` henüz gözlenmedi (U-1) | `policy.js` içinde sabit | Ayrı dosya = ek hata kipi ("arama başarısız" dalı, satır 111) | Sabite çevir ve 0004b'ye böl (K3) |
| D-7b | ask yalnız `default`/`plan`, diğer kipte deny | Var | Her kipte ask | Alt ajan olaylarında `permission_mode` yoksa tüm düzenlemeler reddedilir | APPROVE koşullu (K7) |
| D-8a | QA yalnız yeni test dosyası | Var | Salt-okunur QA | G-9 kalıntısı dürüstçe yazılı | APPROVE (0004b) |
| D-9a | SubagentStop → stop.js | Var | Frontmatter hook | Düşük | APPROVE (0004b) |
| İmza biçimi v2 + `projectId` | **Gerekçe yetersiz** | v1 mesajı zaten `rel` + hash bağlıyor | v1 aynen | Aşağıda bulgu B1 | REDDET (K1) |
| `policy.js` ortak modül | Var: sorun tam da gate/guard ayrışması | İki kopya | Tek sınıflandırma kaynağı | APPROVE |
| Konteyner = host ile aynı tablo, ask→deny | Var | Ayrı tablo | Delta tablosu sınıfların sonucu, özel durum değil | APPROVE; delta tablosunu "ask→deny + unit alanı yok + env çözümü" tek kuralına indir |

## Bulgular
- **B1 [Kusur, konteyner] `projectId` konteynerde doğrulanamaz.** `company-run.sh:28` host'ta `verify` çalıştırır (host yolu hash'i); konteyner içi gate çalışma alanını `/work` olarak görür (`company-run.sh:33,35`). Tasarım "doğrulama kuralları" 7. madde yalnız host kipi için; konteyner kipinde `project == projectId` ne olacağı yazılı değil. Olduğu gibi uygulanırsa host'ta BUILD görünüp konteynerde her kod yazımı reddedilir. `run.sh` bunu yakalamaz (geçici dizin, `.git` yok, `M = R0` her iki tarafta aynı). Yol-türevli kimlik ayrıca taşıma/yeniden klonlamada imzaları geçersiz kılar. Ödediği bedelin karşılığı yok: çapraz-proje imza tekrarı kaza değil.
- **B2 [Yeşil sıra] T3 ile T4 bağlı.** `gate.js` `verify(spec, dir, PUB, root)` çağırıyor (`gate.js:41`), `run.sh` v1'i CLI ile imzalayıp gate'e veriyor (`run.sh:20-21`). T3'te `approval.js` v2 olursa T4'e kadar `check` kırmızı kalır. K1 uygulanırsa sorun ortadan kalkar.
- **B3 [Yeşil sıra] T5 ile T8 arasındaki boşluk.** guard zaten kablolu (`.claude/settings.json:24`), sarmalayıcısız: T5'te `guard.js`'e söz dizimi hatası sızarsa Bash çağrıları sessizce geçer. Sarmalayıcı T8'de. Ayrıca T5'te guard dosya aracı dalı hâlâ kablolu; T8'de gate de `Write|Edit` için bağlanınca iki kanca aynı olayda ask üretir (çift diyalog, öncelik yazılı değil).
- **B4 [Kurtarma] R yolu sağlam, iki düzeltme.** (a) "oturumu yeniden başlat" gereksiz: kanca betikleri her çağrıda diskten yükleniyor (tasarım satır 21); gerekçe yoksa ifade silinmeli. (b) Hiç commit edilmemiş bozuk `policy.js` için `git checkout -- harness/` dosyayı silmez; fakat `guard.js` HEAD'e dönünce `policy.js`'i `require` etmez, yol yine çalışır. Bunu R metnine yaz. Giriş dosyası söz dizimi hatasında oturum içi onarım yok: tek kullanıcılı şirkette kabul edilebilir, README'ye yazılsın.
- **B5 [Aşırı mühendislik]** `projectId`, v2 biçimi, `issuedAt` skew kuralı, `Expires - issuedAt <= 24 h`, `specs/exceptions/`, `write-areas.json`, `$TMPDIR` eşleme, literal `cd` takibi, `-t/--target-directory` ayrıştırması, glob geniş-kapsam kuralları (20 glob, ilk segment sabit, `*/**` geçersiz). Hiçbiri bu işin kabul ölçütüne (host'ta imzasız kod düzenlemesi sessiz kalmasın) gerekli değil.
- **B6 [Belirsizlik]** Worktree satırı 3 ve git ortak-dizin kontrolü U-2'ye (alt ajan worktree'de hangi `CLAUDE_PROJECT_DIR`) bağlı; T1 kanıtı olmadan sabitlenmemeli.

## Koşullar (tasarım düzenlemesi olarak)
- **K1** `approval.js` v1 mesajını ve kayıt biçimini olduğu gibi tut; `projectId`, `issuedAt`, v2 ve migrasyon bölümü tasarımdan çıkar. Başlık alanı yalnız `Unlocks:`. T3'ten "CEO v2 ile yeniden imzalar" adımı kalkar. `approval.js sign` içinde `--expect` isteğe bağlı kalsın (`run.sh` değişmeden geçsin); zorunluluk `approve.sh` + guard yolunda olsun.
- **K2** Q-1 önerisini E yerine "A bu işte; E, lane-0 tıklama gürültüsü ölçülünce ayrı iş" yap. E'de kalınırsa 24 saat sınırı imza anında `approval.js sign` içinde zorunlansın, kayıt biçimi değişmesin.
- **K3** `write-areas.json` yerine `policy.js` içinde sabit tablo; birim alanları ve `stop.js`/kural 3 işleri 0004b'ye bölünsün (tasarım madde 14 ile uyumlu); 0004a = policy, gate, guard sınıflandırması, imza önizlemesi, kablolama.
- **K4** Bash yazıcı tespiti için mevcut `segments/tokens` (`guard.js:46-47,95-100`) üzerine kur: yönlendirme hedefi + `FILE_WRITERS` + `sed/perl -i` hedeflerini `policy.classify` ile sınıfla. `cd` takibi, `$TMPDIR`, `-t` ve `git checkout` yolları sonraya; belirsiz hedef = görüş yok + G-8. D-4b çıkar.
- **K5** Sıra düzeltmesi: guard için `|| exit 2` sarmalayıcısı T5'ten **önce** ayrı adım (yalnız `.claude/settings.json`, `check` yeşil). T8'de gate sarmalayıcısı eklenirken guard'ın `Write|Edit` eşleşmesi kaldırılsın (dosya aracı kararı tek kancada) ya da çift ask önceliği yazılsın. T5'e kadar guard dosya aracı dalı regex'te kalır.
- **K6** T1'e ekle: sahte giriş dosyası (söz dizimi hatası ve eksik dosya) ile `--settings` altında çıkış 1'in gerçekten bloklamadığını ve sarmalayıcı ile bloklandığını kanıtla; `$CLAUDE_PROJECT_DIR` boşken davranışı kaydet; host git sürümünü kaydet. Değişmez ilke: `uncaughtException` işleyicisi her `require`dan önce kurulur (gate, guard), testle kilitlensin.
- **K7** D-7b: `permission_mode` alanı alt ajan olaylarında yoksa deny yerine ask; T8 yalnız Q-2 T1 kanıtıyla çözülünce yayınlansın.
- **K8** Row 2 "üst küme" iddiasını düzelt: `CLAUDE.md`, `approvals/`, `harness/keys/`, `.github/workflows/` her derinlikte ve mutlak yolda row 2 olsun (regex eşdeğeri), ya da daralma Bilinen boşluklara yazılsın. `policy.sh` matrisine alt dizin `CLAUDE.md` ve başka-proje `harness/keys` satırı eklensin.
- **K9** R metnini B4'e göre düzelt; worktree/nested-root kuralı (row 3) T1 bulgusuna göre daralt.

## ADR
- Kaydedilecek: **yol sınıfı taksonomisi** (gate, guard, stop, lint, şablonlar, konteyner ve host'un paylaştığı sözleşme; `Unlocks:` başlık grammar'ı, "konteyner = host, ask→deny" ve "kanca kapanır" `|| exit 2` ilkesi ile). Geri dönüşü pahalı: sözleşme birçok bileşene dağılıyor.
- Kaydedilmeyecek: "İmzalı kayıt v2 ve başlık grammar'ı" (K1 ile v2 kalkar; başlık grammar'ı ucuz geri alınır ve taksonomi ADR'sine girer). CEO v2'yi tutarsa bu ADR zorunlu olur ve B1/B2 önce çözülmeli.

## Gereksiz bulundu (kriter yok)
`projectId`, v2 biçimi, `issuedAt` kuralları, `specs/exceptions/` ve `Expires`/`Exception` alanları, `write-areas.json`, D-4b. Yok olanlar: yeni çalışma zamanı bağımlılığı, ikinci biçim kütüphanesi.

## Geri dönüşü pahalı kararlar
Yol sınıfı sözleşmesi (ADR: evet). İmza biçimi: K1 ile değişmiyor, ADR: hayır. Alan/istisna yeri: ucuz.

## STACK.md değişikliği
Yok (yeni teknoloji yok). CEO'ya gösterilecek yeni bağımlılık yok.

## Cevapsız sorular
`agent_type`, `permission_mode`, `agent_transcript_path` alanları ve çıkış-1 davranışı gözlemlenmedi (T1); host git sürümü; U-2 worktree davranışı; Q-2 CEO'nun normal izin kipi.
