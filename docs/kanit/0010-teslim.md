# Spec 0010 delivery evidence (polyglot-engineer, running record)

## T-2 (guard.js: repair shape only)
- Step 1 baseline: W `harness/bin/check` green (`CHECK GREEN (full)`); file-tool `Edit` of `<W>/harness/guard.js` and `<W>/harness/test/guard.sh` passed in `auto` (R-6 proven for a hook-source name).
- Red first: `sh harness/test/guard.sh` in W, 4 FAIL (the AC-6 no-opinion cases with a broken policy), 869 passed.
- Green in W after the edit: `GUARD TESTS GREEN: 873 passed, 0 failed`; `node --check` ok.
- Live write (one complete `Write` of `harness/guard.js`): `cmp` main vs W identical; canaries: `git status --short` ran; `echo git --no-verify` blocked by the guard; this `Write` to `docs/kanit/0010-teslim.md` passed.
- Main root `./harness/bin/check`: `CHECK GREEN (full)`.

## T-3 (policy.js: scanName, secretFileName, allowedLocation)
- Red first: the new `names` driver cases against the pristine policy.js crash (functions missing); green in W: `0010 R-5 secret names, allowed location: 54 cases, 0 failed`, `POLICY TESTS GREEN: 1420 passed, 0 failed`.
- Live write (one complete `Write` of `harness/policy.js`): `cmp` main vs W identical; canaries: `git status --short` ran, `echo git --no-verify` blocked, a write under `docs/kanit/` passed (this note).
- Main root `./harness/bin/check`: `CHECK GREEN (full)`.

## T-4 (guard.js: D2 view, REQ-1..4, REQ-7, refusal text)
- Red first: the new D2, rollback, AC-3 and corpus cases run against the pristine guard.js of P through the `GUARD=` override: 191 of the new cases FAIL (the rest of that run's failures are the old signed-workspace cases, which cannot load P's key; not counted). A direct copy of P's guard.js into a scratch folder was refused by the hook (path named harness/guard.js) and was not worked around.
- Green in W and in the main root: `GUARD TESTS GREEN: 1171 passed, 0 failed` (with `--bench`); the 244 added lines of `guard.sh` are the only change to existing tests (`git diff` shows 0 removed lines).
- Corpus: 85 ordinary single-line commands, all no opinion in a signed workspace in `auto`; bench: `p95 33 ms per Bash call (200 calls)` on this Mac.
- Live write (one complete `Write` of `harness/guard.js`): `cmp` main vs W identical; canaries: `git status --short` ran, `echo git --no-verify` blocked, a write under `docs/kanit/` passed (this note).
- Main root `./harness/bin/check`: `CHECK GREEN (full)`.

## T-5 (secret-names.js, lint rules secret-names and texts-0010, lint-rules fixture, README)
- Files reached the main root by file tools (Edit, one Write for the new script); `cmp` against W identical. `lint-rules.sh`: `LINT RULE TESTS GREEN: 542 passed, 0 failed`; existing test lines unchanged (0 removed lines in `git diff harness/test`).
- A first main `check` failed in "no secrets in the repo": a new test line spelled the key marker literally; fixed to a neutral text (test of mine, not weakened).
- Main root `./harness/bin/check`: `CHECK GREEN (full)`.

## AC-7 empty-active copy (§10 step 7)
- `git worktree add --detach .claude/worktrees/0010-empty HEAD`, spec file removed, `specs/active/` removed: its `harness/bin/check` printed `CHECK GREEN (full)` and `LINT RULE TESTS GREEN: 542 passed, 0 failed` (same 542 cases as in the repository). Copy removed with `--force`.
- Not done by this unit (T-6 and §10 step 8, main session): qa/appsec/audit chain, live `auto` record per family, W/P removal, ACIK-ISLER marks.

## AppSec conditions S-01..S-04 (guard.js, guard.sh, README)
- Red first in W: 12 new cases FAIL (`GUARD TESTS FAILED: 1174 passed, 12 failed`); green after the fix: `GUARD TESTS GREEN: 1186 passed, 0 failed`; W and main `check` green.
- S-01 pathspec words with a glob character, `:/`, a leading dot or a path deeper in `harness/` count as hook words (a one-segment branch name `harness/0010-x` still has no opinion, AC-5). S-02 a message value holding `$(` or a backtick is no longer exempt. S-03 `-C`, `--chdir`, `--directory`, `--git-dir`, `--work-tree`, `cd`, `pushd` and `<rev>:path` void the relative temp-set trust. S-04 and the G-26 scope note are in README G-23 and G-26.
- Live write of `harness/guard.js`: `cmp` identical to W; canaries `git status --short` ran, `echo git --no-verify` blocked, this note written.
