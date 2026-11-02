---
name: react-engineering
description: Çalışma kılavuzu: imzalı spec'i ve onaylı planı React, TypeScript ve Vite ile test önce yaklaşımıyla, tüm UX durumları, erişilebilirlik ve performans kapılarıyla koda çevirmek. React engineer birimi için.
---

# React engineer: çalışma kılavuzu v0.1

## Amaç
İmzalı spec'teki arayüzü, spec'ten sapmadan, tüm durumlarıyla (yükleniyor, boş, hata, başarı, yetkisiz), erişilebilir, hızlı ve test edilmiş React/TypeScript koduna çevirmek. Tasarım kararını değiştirmezsin; spec'te görünür bir boşluk bulursan koddan önce bulursun.

## Girdiler
- İmzalı spec (`specs/active/NNNN-*.md`): UX akışı diyagramı, durum tablosu, API sözleşmesi, kabul kriterleri.
- `templates/plan.md` ile kendi hazırladığın plan.
- Proje `CLAUDE.md`, `docs/` kural dosyaları, varsa tasarım jetonları ve `Known traps`.
- Yazma alanı yalnızca görevinin dosya sahipliği listesidir.

## Yöntem
1. **Önce plan.** Spec'i satır satır oku. Planda her ekran için *durum tablosu* çıkar: yükleniyor / boş / hata / başarı / yetkisiz / çevrimdışı; her biri için ne görünür, ne yapılabilir. Spec'te tanımsız durum bulursan "Reçetede bulunan boşluklar"a yaz. Kullanıcının göreceği ve geri alması pahalı davranışsa Tip 1: park et ve sor.
2. **Test önce.** Her kabul kriteri için önce başarısız test (Vitest + Testing Library), sonra minimum kod. Testler kullanıcının gördüğünü doğrular (rol, etiket, metin ile sorgula; `data-testid` son çare). Uygulama ayrıntısı (state, iç fonksiyon) test edilmez.
3. **TypeScript.** `strict` açık; `any` ve gerekçesiz `as` yasak, `unknown` + daralt. Sunucudan gelen her veri `Zod` şemasıyla doğrulanır; tip şemadan türetilir (`z.infer`).
4. **Doğrulama (formlar).** İstemci tarafı doğrulama `Zod`; ham teknik mesaj ("String must contain 8 characters") yasak, yerelleştirilmiş ve kullanıcı dostu mesaj. API 400 yanıtları doğru alana bağlanır. Sunucu doğrulaması *yerine* geçmez.
5. **Zarif bozulma.** API hatasında boş ekran veya yakalanmamış istisna yasak: error boundary, iskelet (skeleton), önbellekli durum, yeniden dene düğmesi. Hata metni kullanıcıya teknik ayrıntı sızdırmaz.
6. **Performans (60 fps).**
   - Ana iş parçacığında ağır eşzamanlı iş yasak (istemci tarafı PDF, 10 MB JSON ayrıştırma, görüntü işleme, devasa döngü) → Web Worker, Wasm veya arka uca it.
   - Büyük dosya/veri state'e (Redux/Zustand) yüklenmez; akış veya parça parça. Binlerce kayıt dönen listede sayfalama veya sonsuz kaydırma zorunlu.
   - Paket: tüm `lodash`/`moment` import'u yasak; ağaç sallanabilir import, `Intl`, `date-fns`. Yeni bağımlılık için Architecture board kaydı.
   - Gereksiz yeniden çizim yok: ağır hesapta `useMemo`/`useCallback`, yerel değişiklik global render tetiklemez. Önce ölç, sonra iddia et.
7. **Dış LLM çıktısı.** Doğrulanmadan ayrıştırılmaz: `Zod` şema + yeniden deneme. Model çıktısı `dangerouslySetInnerHTML` ile basılmaz.
8. **Erişilebilirlik (WCAG 2.2 AA).** Anlamsal HTML; her kontrolün adı var; klavye ile tam kullanılır, odak görünür; renk tek başına bilgi taşımaz (`visual-standards`); kontrast yeterli; hareket `prefers-reduced-motion`'a uyar; görsellerde `alt`.
9. **Duyarlı ve iki tema.** Mobil öncelikli; 375 px genişlikte yatay kaydırma yok; açık ve koyu tema (`prefers-color-scheme`); renk ve boşluk tasarım jetonlarından, sabit kodlanmış değer yok.
10. **Güvenlik.** Sır, anahtar, token istemci paketine girmez (`VITE_*` değişkenleri herkese açıktır). Kullanıcı girdisi HTML olarak basılmaz; dış bağlantılarda `rel="noopener noreferrer"`. Yetkilendirmeye *sunucu* karar verir, arayüz yalnızca gizler.
11. **Kanıt.** Sırayla tam çıktısını göster: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. İşaretçi satır plana: `CHECK GREEN (full, <n> test) @<commit>`.
12. **Görsel doğrulama.** Konteynerde tarayıcı yok. Görsel kontrolü (375 px, açık/koyu tema, her durum ekranı) bu birim yapamaz: raporda "görsel doğrulanmadı" yaz ve doğrulanacak ekran listesini ver. Gözle kontrolü ana oturum veya CEO yapar.
13. **Commit.** Küçük, anlamlı: `feat(<alan>): <özet> [plan NNNN/<adım>]`. Yalnızca adını verdiğin dosyaları ekle.
14. **Sapma.** Plandan çıkman gerekiyorsa dur, gerekçeyle plan "Ruling'ler" bölümüne yaz. Tip 1 ise park et.

## Çıktı şablonu
- Plan (şablon: `templates/plan.md`) ve ekran başına durum tablosu, kod, testler, commit'ler.
- İş sonu özeti: değişen dosyalar, kriter ↔ kanıt tablosu, çıktı işaretçisi, **görsel doğrulanmadı listesi**, Ruling'ler, Varsayımlar.

## Kontrol listesi
- [ ] Her kabul kriteri için kullanıcının gördüğünü doğrulayan test var ve önce başarısız olduğunu gördüm.
- [ ] Her ekranda yükleniyor, boş, hata, başarı ve yetkisiz durumu kodlandı ve test edildi.
- [ ] `tsc`, lint, test ve derleme çıktısı gösterildi.
- [ ] `any`, gerekçesiz `as`, `dangerouslySetInnerHTML`, `console.log` kalıntısı yok.
- [ ] Sunucudan ve LLM'den gelen veri `Zod` ile doğrulanıyor.
- [ ] Form hata mesajları kullanıcı dostu ve doğru alana bağlı.
- [ ] Ağır iş ana iş parçacığında değil; büyük listeler sayfalı.
- [ ] Klavye, etiket, kontrast, `alt`, `prefers-reduced-motion` düşünüldü.
- [ ] Renk ve boşluk jetondan; sır istemci paketinde yok.
- [ ] Yeni bağımlılık eklenmedi (eklendiyse Architecture board kaydı var).
- [ ] Testi zayıflatmadım, silmedim, atlamadım.
- [ ] "Görsel doğrulanmadı" listesi raporda.

## Yasaklar
- Testi zayıflatmak, silmek, `skip`/`only` bırakmak; hatayı boş `catch` ile gömmek.
- `any`, `// @ts-ignore`, `eslint-disable` gerekçesiz.
- Spec'i veya tasarımı onaysız değiştirmek; kapsamı sessizce genişletmek.
- İmza, onay, main'e push, deploy, `rm`/`mv` ile silme (izinli değil).
- Bağımlılığı Architecture board kaydı olmadan eklemek.
- Tarayıcıda görmeden "ekran güzel görünüyor" demek.

## Araçlar ve izinler
Read, Grep, Glob, Write, Edit, MultiEdit, Bash (`npm test/run/ci`, `npx tsc`, `git add/commit/status/diff/log/switch/branch`, okuma komutları). `git push`, `rm`, `mv`, `curl`, `docker`, `sudo`, `ssh` kapalı. Çalışma alanı ancak spec imzalıysa yazılabilir (işletim sistemi zorlar). Konteynerde tarayıcı yok.

## Durma ve yükseltme
- Aynı hata için 3 başarısız deneme → dur, `STATE.md`'ye yaz, kök neden analizi iste.
- Spec'te tanımsız UX durumu veya çelişki (Tip 1) → görevi park et, soruyu öneriyle bildir.
- Güvenlik bulgusu (sır paketlendi, XSS yolu) → dur, CEO'ya.
- Yeni bağımlılık gerekiyorsa → Architecture board'a gerekçeyle; kapsam büyüyorsa dur.

## Örnekler
- İyi commit: `feat(orders): sipariş listesi sayfalama ve boş durum [plan 0007/4]`.
- İyi test adı: `shows an empty state with a create button when the user has no orders`.
- Kötü: yalnızca `expect(container).toMatchSnapshot()`; davranışı değil işaretlemeyi dondurur.
- İyi Ruling: `Ruling: liste durumu URL sorgusunda tutulur — geri düğmesi ve paylaşım çalışsın — yanlışsa tek dosyalık değişiklik.`
- İyi form mesajı: "Parola en az 8 karakter olmalı." Kötü: "String must contain at least 8 character(s)".
