# QA report: spec 0001 Agency Tower 3D, milestone M1

Result: UNPROVEN CRITERIA (automated parts PASSED; by-eye and browser parts pending)
Date: 2026-11-13. Node 22.23.5 (engineer's binary, scratchpad), cwd showcase/agency-tower/.

## Fresh evidence (run by QA)
- `npm test`: 15 files, 137 tests passed.
- `npm run build` (tsc --noEmit + vite build): OK, dist 593 kB js / 152 kB gzip.
- `npm run roster:check`: roster OK. `npm run isolation:check`: isolation OK. `npm audit`: 0 vulnerabilities.
- `harness/bin/check`: CHECK GREEN (full).
- Outside-repo copy (no node_modules/dist, in scratchpad): `npm ci && build && test` OK, 137 passed (agents dir absent).
- `git status --short`: only docs/architecture/STACK.md (M, +3 lines, dependency entries), 2 untracked gate reports, showcase/, specs/. `git diff --name-only main...HEAD` empty (nothing committed). `approvals/` record exists, gitignored. No other writes found; `dist/` ignored.
- grep innerHTML|outerHTML|insertAdjacentHTML|eval(|new Function in src/: none; no fetch/XHR/http URL in src/.

## Criterion table
| AC | Evidence | Status | Broken? |
|---|---|---|---|
| AC-1 | git status within allow-list; check-isolation.test.ts (planted import, 4 denied segments, `website` ok, constant in other file, tests/README ignored); harness/bin/check green | PASSED (committed-diff form `main...HEAD` is empty until commit; re-run after commit) | Yes: substring match -> "merely containing" test failed |
| AC-2 | outside-repo copy run; .npmrc/.gitignore/.nvmrc/engines verified; build leaves git status unchanged | PASSED | no |
| AC-3 | build-roster.test.ts (byte-equal, ignored keys, hash, CRLF, invalid-file CLI, fixture untouched) | PASSED | no (read only) |
| AC-4 | build-roster.test.ts check cases; loader.test.ts rejects list | PASSED | Yes: loosened id regex -> `__proto__` test failed. Cycle check removal made vitest hang (infinite loop), killed; no clean failure but the test cannot pass |
| AC-5 | bootstrap.test.ts (loading, invalid+no WebGL2, invalid+WebGL2, valid+no WebGL2, no renderer built) | PASSED | no |
| AC-6 | scene-model.test.ts (floors, robots, props, glass, opacities, picking). By-eye (tower reads as tower) | tests PASSED; by-eye PENDING | Yes: GHOST 0.08->0.3 failed; pick all floors failed |
| AC-7 | camera.test.ts (clamps, 5/6 px). By-eye orbit/zoom | tests PASSED; by-eye PENDING | no |
| AC-8 | camera.test.ts + floor-panel.test.ts (rideDuration, re-target, cabin/camera sync, doors) | PASSED | Yes: ride clamp 3.0->9 failed |
| AC-9 | scene-model.test.ts scale/marker. By-eye grayscale | tests PASSED; by-eye PENDING | no |
| AC-10 | selection.test.ts, card.test.ts (M1 parts; org-mode path is M2) | PASSED | no |
| AC-11 | keymap.test.ts | PASSED | Yes: removing modifier ignore failed |
| AC-12 | app-config.test.ts (quality, coarse pointer, hidden). fps >= 30 on CEO Mac not read | tests PASSED; perf UNPROVEN (not measured) | no |
| AC-13 | card.test.ts (text-only render), security-grep.test.ts, app-config invalid params. Network tab by-eye not done | tests PASSED; by-eye PENDING | no |
| AC-17 | activity.test.ts (seed, transitions, ranges, desks, 500->100 ms, bubbles over 300 s) | PASSED | Yes: MAX_STEP 100->500 failed |
| AC-18 | by-eye only | PENDING | n/a |

## Unproven criteria
- AC-12 fps value (host, `?debug=1`), AC-18, by-eye parts of AC-6/7/9/13. No browser screenshots captured by QA in this run (UI state gallery: none). Needs host browser pass; CEO or QA with browser.
- AC-1 literal command `git diff --name-only main...HEAD` is empty because nothing is committed; working-tree equivalent passes.

## Tests that verify implementation instead of behavior
- None blatant. Gap: `src/app/sceneApp.ts` (313 lines: wiring of loop, bubbles DOM, fps overlay, screens, card flow) has no direct test; its behavior (REQ-21 bubble DOM, REQ-15 debug overlay, wave facing camera) is covered only through the pure modules, so wiring defects show only by eye.

## Spec vs implementation drift (audit)
- Spec header `Status: Draft` while an approval record exists in approvals/ (gitignored); confirm signature matches current spec hash.
- keymap ignores Shift too; spec says "any modifier key": consistent.
- STACK.md also adds a Playwright row; Playwright is not in package.json (spec allow-list covers STACK.md; no drift in code). tests use jsdom only, so no real-browser test exists.
- Build warns bundle 593 kB (three, expected); no spec limit.
- No drift found in REQ-2/3/4/16 behaviors; phrases max 33 chars (<= 48); 20 units match §4 floor table.
