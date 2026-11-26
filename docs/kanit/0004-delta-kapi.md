# Spec 0004, delta 2026-11-22 (her zaman `auto`), kapı bulguları

Reviewed bytes: `specs/active/0004-harness-enforcement-gaps.md` sha12 `8e3fff972daf` (çalışma ağacı, imzasız). `spec-critic` 5. tur (yalnız delta): "delta signable" (kritik/yüksek yok; 4 orta, 4 düşük). `appsec`: PASS WITH CONDITIONS (kritik/yüksek yok; 3 orta, 3 düşük, 3 bilgi). Ana oturumun özeti; bulgu metinleri birimlerin okuması için İngilizce. Ana oturumun kararı: hepsi imzadan önce metne işlenir.

## spec-critic (D-n)
- D-1 Medium. §7.3 cond. 1, R-20, §7.2: "same root" undefined across the two forms (`lexical.root` = `path.resolve(R)`, `resolved.root` = `realpath(R)`; differ when R is behind a symlink, e.g. macOS temp). Fix: define as `resolved.root === realpath(lexical.root)` (as `policy.js:287` does for `isRoot`); two AC-16 cases: R behind a symlinked parent → no output; equal rel, lexical under R, resolved under main → ask.
- D-2 Medium (= appsec S-04). "Keys never" holds for `<home>/.company/**` and `<cfg>` only because they are outside every root; if a root contains them (R = home, or `CLAUDE_CONFIG_DIR` under R) `policy.js:110-115` gives row 2 under R and a literal entry opens it; R-23 ignores that cfg members depend on env. Fix: lock is root-independent: any path that is row 2 by a `<cfg>`/`<home>` member (`<cfg>/…`, `<home>/.claude.json`, `<home>/.company/**`) is `locked` in cond. 3 and in `unlockKinds`; also locked: `.claude/settings.local.json`, `harness/bin/ceo-keygen.sh`. One AC-16 case each (temp HOME = workspace root).
- D-3 Medium. The app's `auto` classifier is a second decider with no specified outcome (before T-9 guard-ask → classifier; after T-9 "proceeds" is an app claim). Fix §12 rule 4: "app refuses → stop and report; no Bash or interpreter workaround; fallback: the CEO applies the shown diff in his terminal". Word REQ-8 and §4 as "the hooks give no opinion". Add a `CLAUDE.md` add/remove-line probe to AC-15 (d).
- D-4 Medium. T-8b rewrites three README sections but not "Bilinen boşluklar" though G-1, G-9, G-11, G-21 and the instruction-only line changed; `harness/README.md:127`, `:167` stale; §10 "CEO can allow one repair command" unreachable in `auto`. Fix: add those rows, the instruction-only list and one §10 sentence to T-8b; one `texts-0004` string check (G-1 row contains `Unlocks:`).
- D-5 Low (= appsec I-01). §7.3 l.280 and §13 l.495: two false statements about draft 0009 ("product-config entries only", "keeps Q-1 open"); correct both.
- D-6 Low. §7.5, R-23, AC-17: state that a locked entry never appears on the `Unlocks:` line; assert it; assert the dialog for an enforcement-only header.
- D-7 Low. §9 removed-lines evidence diffs `harness/test/` only; add `harness/bin/lint.js harness/bin/check` to the `0df2c8f` diff and name the expected removals.
- D-8 Low. Nested root with a byte-identical copy of the signed spec validates with the main record and opens that worktree's copies: state it for row 2 in §8, one AC-16 pair (identical signed spec in nested root → no output; different spec → ask).

## appsec (S-n)
- S-01 Medium. Authority is per path, not per caller: units with no Bash (`scout`, `product-manager`: web tools + Write/Edit) get it too; one Edit by a web-reading unit could rewrite `CLAUDE.md` or `harness/gate.js` while 0004 is signed. Fix: §7.3 condition 6 "Caller: `event.agent_type` is absent (main session) or one of `polyglot-engineer`, `dotnet-engineer`, `react-engineer`, `devops-sre` (fixed list in `policy.js`); else the unchanged ask"; AC-16 case `agent_type: scout` on a named `CLAUDE.md` → ask; one mutation probe; amend the "`agent_type` has no effect" sentence; AC-15 adds (e): a non-engineer unit's Edit of a named file is refused.
- S-02 Medium. The unlocked window has no written bound; diff-showing is instruction-only and happens after the edit is live. Fix: (a) drop `harness/container-settings.json` from the `Unlocks:` and enforcement lists (T-2 only, done): eight entries; (b) new AC-18 (check, run by qa-engineer and appsec in T-11, quoted in each task report): `git status --short -- <named enforcement files>` prints nothing at task end, and `git log --oneline <re-sign commit>..HEAD -- <those files>` lists only the T-8a, T-8b, T-9 and named fix commits; (c) G-1: "the diff is shown after the edit is already live".
- S-03 Medium. Record replay re-opens the brakes after the job (`specs/**` free; validity is content hash only; `*.sig.json` git-ignored); retirement was left to spec 0005. Fix: T-12 in this spec: at ship, when the spec moves to `specs/done/`, the CEO deletes this spec's record in his own terminal (envelope: permanent deletion); AC: `ls approvals/` lists no 0004 record; G-21 names T-12.
- S-05 Low. Header grammar accepts C1 and bidi characters; preview escapes C0/DEL only. Fix (tightening): §7.3 Invalid adds "any character of Unicode category Cc, Cf, Zl or Zp"; §7.5 "non-ASCII in an entry is printed as `\uXXXX`"; one AC-17 case.
- S-06 Low. Re-signature happens with the flat preview. Condition: before the CEO signs, the main session prints the literal row-2 entries computed by the committed `policy.js` (`parseHeader` + `classify`, entries without `*`/`?` whose row ≤ 2) and `git status --short -- harness` (expect empty), and the CEO compares that list with the header; record it as a step before T-8a.
- I-02. R-24: no weakening; `mkdir -p` may leave an empty `.claude/worktrees/`: remove it too. I-03 (not delta): `gate.js:26` `file_path || notebook_path` precedence; sha12 is 48 bits.

## İmza öncesi adım (S-06), ana oturum, 2026-11-22
Bulgular metne işlendikten sonra spec sha12 `bd8e0c01ddf8` (işlenmiş metin yeniden kapıya sokulmadı; öneriler yazıldığı gibi uygulandı). Commit'li `harness/policy.js` ile (`parseHeader` + `classify`, `*`/`?` içermeyen ve satırı ≤ 2 olan girdiler): hata yok, 21 girdi, sekizi zorlama dosyası:

```
CLAUDE.md
.claude/settings.json
harness/policy.js
harness/gate.js
harness/guard.js
harness/approval.js
harness/bin/approve.sh
harness/bin/install-project.sh
```

`git status --short -- harness`: boş. `node harness/bin/lint.js`: 62 ok, 1 FAIL (`unlocks-row2`, bu sekiz girdi; R-25 gereği T-8a'ya kadar beklenen tek hata). Gizli anahtar taraması: temiz.
