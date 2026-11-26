# Spec 0009, kapı bulguları, 1. tur (2026-11-22)

Taslak: `specs/draft/0009-approval-cadence.md` (commit `b290cbf`). `spec-critic`: imzalanamaz (3 kritik, 4 yüksek). `appsec`: FAIL (1 yüksek, 5 orta, 2 düşük). Ana oturumun özeti; birimlerin tam raporları oturum kaydındadır. Bulgu metinleri birimlerin okuması için İngilizce bırakıldı.

## spec-critic (C-n)
- C-1 Critical. REQ-26/AC-6 freeze every `guard.sh` case present at the 0004 merge, but 0004 AC-9 mandates "no opinion" for `git push origin +feat/0007-x` and `HEAD:refs/heads/feat/0007-x`; plain-push rules P-2/P-3 flip them. List the flips as pre-approved expected-value changes or narrow P-2/P-3.
- C-2 Critical, trust boundary. `Bash(git push origin *)` also matches main, force and delete pushes; guard asks are emitted in every mode and are not refused in unproven modes; sessions run in `auto` where a hook ask opens no dialog (B-1). An irreversible push can pass with no CEO decision. Same as appsec S-01.
- C-3 Critical. Q-1 open; 0009:17 restates the uncorrected item 2; 0009:6 must cite the correction line in `docs/KARARLAR.md`.
- C-4 High. Addendum class `assumption` admits visible behaviour not in the signed spec, unbounded. Bound it: fills a gap inside an existing REQ/AC only, with an undo-cost threshold.
- C-5 High. `spec-critic` judges against lists in `harness/README.md` (Turkish, product-config, edited by other specs). Put the closed list and re-sign list in English in the playbook or `templates/spec-ek.md`; lint exact strings.
- C-6 High. `Checked:` is written by the main session with no artefact of the `spec-critic` run; AC-5 uncheckable; `pending` only WARNs. Add verdict reference and timestamp; commits cite A-n; FAIL on `pending` at job end.
- C-7 High. Draft-PR values with `$(...)`, backticks, `$VAR` in `--title/--body/--base/--head` are not asked; `--head` accepts any branch or fork. Same family as appsec S-04.
- C-8..C-18 Med/Low: REQ-19 promises more than the two prefixes deliver; AC-12 probe matches no allow entry; REQs 2, 3, 6, 7, 9, 13, 28 lack ACs and a REQ-AC map; rule 5 "nothing else" contradicts 0004 dialogs and Beklenenler; Beklenenler row rewrite vs `questions-bookstack.md`; spec templates keep statuses and in-spec Assumptions that would drop a signature (add templates to scope); parked signed specs can be activated by `mv` (new authority path, G-21 family); addendum numbering after re-sign undefined, `addendum-authority` regex undefined; rule-1 sentence makes absolute claims 0004 forbids; threat row cites AC-7 for detached HEAD with no such case; small wording mismatches.

## appsec (S-n)
- S-01 HIGH. In `auto` the allow entries leave no judge for push to main, force push, delete push. Fix: outside `ASK_MODES` the guard denies every non-plain `git push <remote> ...` and every draft creation outside the standing form; probe each mode. Defence in depth (CEO action): GitHub ruleset on `main` blocking force push and deletion, requiring a PR.
- S-02 MEDIUM, exists in today's guard. `guard.js:42` deletes the rest of a `<<` line and `guard.js:47` drops every `word=` token anywhere, so `git push origin feat/x <<E +w:main --force` and `git push origin feat/x a=b:main` get no opinion while the shell passes those words to git. Fix: a push or draft-creation segment containing `<`, `>` or `&` asks; skip assignment words only before the command word.
- S-03 MEDIUM. `git config push.default upstream`, `git branch --set-upstream-to=origin/main`, `pushurl`, `url.*`, nested clone: git state can redirect a plain push; guard sees none. Fix: read config at decision time and ask unless the push-relevant keys are unset or safe and the toplevel is the project root or its worktree.
- S-04 MEDIUM. `gh pr create --draft --body "$ANTHROPIC_API_KEY"` gets no opinion; with an allow entry nobody sees it; public repo. Fix: draft creation containing `$`, backtick or `<(` asks, except a quoted-delimiter heredoc body.
- S-05 MEDIUM. Batching: nothing ties the previewed sha12 to the bytes the gates passed; every parked signed spec is a standing authorisation reachable by a silent `mv` into `specs/active/`. Fix: queue row and gate reports carry the reviewed sha12, sitting stops on mismatch; guard asks on any move or write targeting `specs/active/*.md`, or the CEO accepts the gap by name.
- S-06 MEDIUM. Lane 3, not lane 2: the decision point for publishing to a public repository moves from a human dialog to guard text parsing; rules 1, 4, 5 change; `spec-critic` gains authority over signature scope.
- S-07 LOW. Addendum verdict not bound to entry text; `Checked:` should carry a sha12 of the entry lines, lint recomputes.
- S-08 LOW. A plain push publishes every commit to a public repo unchecked; list as accepted residual or ask when the range touches `.env*`, `*.pem`, `*.key`.
- I-01 verified by running a scratch copy of the 8161606 guard: `git push origin "main"` and `'main'` return no opinion today; unquoted `main` asks (`guard.js:43`, `:117-119`).
- I-02: `internal-auditor` lists Bash although texts say it has no write tool; `.claude/settings.local.json` allows `./harness/bin/check`, which runs agent-editable scripts with no hook.

## Ana oturumun değerlendirmesi
- S-01, S-02, S-03, S-04 ve C-2'nin hepsi tek kaynaktan doğuyor: kalıcı izni `permissions.allow` girdisiyle vermek. Girdi olmazsa (yalnız metin değişikliği: "özellik dalına push ve taslak PR için sohbette sorulmaz") yeni güven sınırı doğmaz, iş lane 2'de kalır.
- S-02 ve I-01 bugünkü guard'ın açıklarıdır, 0009'dan bağımsızdır; 0004 imzalı kapsamında değildir. Ayrı bir guard düzeltme işi olarak izlenir (`docs/ACIK-ISLER.md`).
