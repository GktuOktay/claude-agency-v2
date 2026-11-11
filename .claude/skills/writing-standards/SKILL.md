---
name: writing-standards
description: Shared standard: avoid AI-voice patterns in Turkish customer text; terse-mode limits; humanize-check. For all text-producing units.
---

# Writing standard: playbook v0.1

## Purpose
Make text that goes to a customer, the public or a decision maker sound **human, clear and verifiable** (WR-02). Ready-made tools built on English patterns are not enough for Turkish; here there is a Turkish rule set and a mechanical check. The patterns to avoid below are Turkish phrases because the text being checked is Turkish.

## Inputs
- The text to write/check and its reader (customer, public, CEO).
- The brand guide (`docs/marka/marka-kilavuzu.md`) if present, for voice examples.
- The mechanical check: `node harness/bin/humanize-check.js <file>` (the main session runs it).

## Method
1. **Limit of short (caveman) mode:** only in chat with the CEO and in status messages. It is **off** in specs, security reports, legal/compliance, customer/marketing/store copy, error messages, external documents and commit/PR descriptions (full sentences, full meaning). The constitution already says so; this playbook is an implementation note.
2. **Turkish AI-voice patterns (avoid):**
   - Empty openings/closings: a pile-up of "Günümüzün hızla değişen dünyasında", "dijital çağda", "Sonuç olarak", "Özetle", "Bu bağlamda".
   - Exaggeration and inflation: "devrim niteliğinde", "çığır açan", "benzersiz", "eşsiz", "kusursuz", "hayatınızı kolaylaştıran", "en iyi çözüm".
   - Empty phrases: "önemli bir rol oynar", "büyük önem taşır", "dikkat çekmektedir", "söz konusudur", "göz önünde bulundurulmalıdır".
   - Passive pile-up: "yapılmaktadır", "sağlanmaktadır", "gerçekleştirilmektedir" one after another; name the subject and the action.
   - Triple lists and the "not only X but also Y" pattern, and a run of equally structured sentences.
   - Needless long dashes (—) and decoration with emoji; the same heading-bullet structure in every paragraph.
   - Imitation Q&A ("Peki bu ne anlama geliyor?").
3. **What to write instead:** a concrete subject + action + a number/example. "Giriş ekranı artık parolayı hatırlıyor." > "Kullanıcı deneyimi iyileştirilmiştir."
4. **Before writing, decide the reader and the single message**; the text's first sentence is that message.
5. **Mechanical check:** after writing the text to a file, take the `humanize-check.js` output; fix the WARN (`UYARI`) lines; no ERROR (`HATA`, an absolute/unprovable claim) may remain. The tool is a limited pattern list: a clean result does not prove the text is good, it only shows that the known patterns are absent.
6. **Reading test:** read the text as if aloud to a stranger; split or delete the sentence you stumble on.
7. **Special cases outside short mode:** command-line output and code blocks are not translated; a technical term may stay in English but is explained in Turkish at first mention.

## Output template
Under the checked text or in your report:
```
Writing check: <file> | Tool: humanize-check.js | Result: CLEAN | WARN n | ERROR n
Fixed: ...
Left on purpose (why): ...
```

## Checklist
- [ ] The reader and the single message are clear; the first sentence is that message.
- [ ] Short (caveman) mode is off for this text.
- [ ] `humanize-check.js` was run; no ERROR, WARNs fixed or left with a reason.
- [ ] No absolute or unprovable claim ("best", "100%", "guaranteed").
- [ ] Passive pile-up and empty phrases were cleaned; sentences are concrete.
- [ ] Technical terms were explained at first mention.

## Prohibitions
- Short (caveman) mode in customer, public or legal text.
- Declaring the text "good" because the tool came out clean; changing words to get around the tool and breaking the meaning.
- An unprovable superlative/absolute claim; copying another author's text.
- Adding a fake signature or a fake review to make the text look human-written.

## Tools and permissions
Read and write tools (in the producing unit's own area). The mechanical check `harness/bin/humanize-check.js`: no network, it only reads the file and matches it against the pattern list; the main session runs it.

## Stop and escalate
- The reader or the message is unclear (Type 1) → stop, ask with a recommendation.
- The text has a legal/contractual nature → "LAWYER REQUIRED", route to the Quality office.
- An ERROR remains in the check and fixing it would change the meaning → ask the CEO; fix the text, not the tool.

## Examples
- Bad: "Günümüzün hızla değişen dünyasında uygulamamız devrim niteliğinde bir deneyim sunmaktadır."
- Good: "Uygulama, bağlantı koptuğunda yazdıklarını saklar ve bağlantı gelince gönderir."
- Bad error text: "İşlem gerçekleştirilememiştir." Good: "Kaydedilemedi. Bağlantını kontrol edip tekrar dene."
