# QA final: agency-tower (commit 981d497, branch feat/agency-tower-3d)
Spec: specs/active/0001-agency-tower-3d.md. Prior: docs/qa/0001-agency-tower-m1.md.
Notes: CEO by-eye accepted look 2026-11-13. AC-12 fps = host reading pending.

## Step log
- S1 (node 22.23.5): tsc clean; vitest 19 files/179 tests pass; build ok (650.89 kB js); roster OK; isolation OK; npm audit 0 vulns; git status clean (dist ignored).
- S2: harness/bin/check -> "CHECK GREEN (full)". (stderr noise from a harness loop-guard test eval of malformed JS; its 16 tests pass; unrelated to showcase.)
- S3 (AC-1): diff outside showcase/agency-tower/: STACK.md, gorus-...md, scout md, spec md, docs/qa/0001-agency-tower-m1.md (+docs/qa allowed). approvals record not in diff (subset of allow-list, ok). PASS.
- S4 (scratch copy $S/mutfinal): M1 org exit pose->overview: m2.test 'leaving restores pose' FAILS (caught). M2 model.setOrg(off) not restoring view: m2.test 'off restores exact previous state' FAILS (caught). M3 sceneApp loop 'if(!orgOn) sim.step' removed: 179/179 PASS = NOT caught (AC-14 freeze/idle-pose only at sceneApp wiring).
- S4 cont. (scratch copy, isolated reruns): night threshold >=0.5 -> >0.5: m2.test 'night exactly for [0.5,1)' FAILS (caught); `<=1` upper bound: not caught but equivalent (phase wraps %1, never 1). Reduced motion: camera cut disabled -> 2 m2 tests FAIL; activity setStatic noop -> 'no robot walks or waves' FAILS; autoAvailable forced true -> 'Otomatik disabled' FAILS (caught); removing only the setMode('auto') guard in daynight.ts: not caught (redundant with UI disabled; low). Bubble cap: MAX_BUBBLES 4->5, `active.length<MAX` removed, and even cap=1: all 12 activity tests PASS = NOT caught (test only asserts <=4, scheduler never nears 4). AC-17 "<=4" is vacuous. Note: one earlier concurrent-load run showed unrelated timing failures (flaky under load, see 15 s timeout drift).
- S5 drift (Type 3 unless noted): faint skyline (model.ts:414, low ground-line silhouette; spec says "procedural city skyline") = Type 3 ok, CEO accepted look. Canvas textures (textures.ts, CanvasTexture, procedural, no asset/loader/network) vs R-1 "no textures" = Type 3 ok but spec text conflict: add one-line note to spec R-1 (procedural canvas textures allowed), no re-sign needed if CEO agrees; AC-13 no-network holds. Smooth vs "flat shaded" (spec line 104; no flatShading anywhere) = Type 3 ok (art direction CEO-directed); needs CEO note in KARARLAR. FOV widen during zoom (CamPose.fov, camera.ts:317) = Type 3 ok, invisible to ACs, 179 tests pass. testTimeout 5s->15s (vite.config.ts:10; towers ~0.3 s each, CPU contention) = Type 3 ok; load-flake seen in my concurrent run, consistent with it. No delta/re-sign required.

## AC table (S6)
| AC | Evidence | Status |
| 1 | S2, S3; check-isolation.test.ts | PASS |
| 2 | S1 clean tree; outside-repo copy proven in M1, skipped | PASS (M1) |
| 3,4 | build-roster.test, loader.test, roster:check OK | PASS |
| 5 | bootstrap.test | PASS |
| 6,9 | scene-model.test, art-direction.test | PASS; look CEO by-eye accepted |
| 7,8,11 | camera/floor-panel/keymap tests | PASS; drag/wheel CEO by-eye accepted |
| 10 | selection.test, card.test | PASS |
| 12 | quality/visibility unit tests pass | PASS unit; fps reading PENDING host (UNPROVEN) |
| 13 | security-grep.test; grep src empty | PASS; Network tab CEO by-eye |
| 14 | m2.test; org restore mutations caught | PASS; org-freeze wiring (sceneApp:380) not caught by any test |
| 15,16 | m2.test; mutations caught | PASS; 375px by-eye CEO accepted |
| 17 | activity.test | PASS, but "<=4 bubbles" vacuous (cap 4->1 uncaught) |
| 18 | CEO by-eye accepted 2026-11-13 | by-eye accepted |
Result: UNPROVEN CRITERIA: AC-12 fps (host reading). Weak tests: bubble cap (AC-17), org freeze (AC-14).

## AC-12 host reading (2026-11-14)
CEO read the `?debug=1` overlay on the host Mac in overview: >= 30 fps. AC-12 PASS. All ACs closed.
