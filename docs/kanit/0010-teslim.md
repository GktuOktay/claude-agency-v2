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
