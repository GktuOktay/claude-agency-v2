# STATE — harness enforcement gaps and consistency cleanup

Spec: `specs/active/0004-harness-enforcement-gaps.md` (sha256 `9f1371e1ae39…`, re-signed 2026-11-21 after the REQ-37 delta; branch `harness/0004-host-enforcement`)   Plan: `plans/0004-plan.md` (Awaiting approval; delivery-manager, 2026-11-21)
Queue (drafts, unsigned): 0006 -> 0005 -> 0007 in `specs/draft/`
Last updated: 2026-11-21   Tokens used:

## Tasks (spec 0004, from `plans/0004-plan.md`; strictly sequential, `check` green after each)
| ID | Task | Status (waiting / in progress / done / PARK) | Commit | Note |
|---|---|---|---|---|
| T-0 | Prerequisites: findings folded, ADR synced, spec active and signed | done | 6951d7b | verify -> APPROVED. Open, not blocking: ADR header still `Status: Proposed` and draft spec path (architecture-board); branch has no upstream |
| T-1 | Host verification with the CEO; `docs/kanit/0004-t1.md`, 3 sanitized fixtures | waiting | - | NEXT. Manual, needs the CEO; checklist in the plan. 4 stop conditions |
| T-2 | `\|\| exit 2` wrapper: `.claude/settings.json` (2 guard commands), `harness/container-settings.json` | waiting | - | polyglot-engineer; 2 CEO dialogs minimum; after T-1 |
| T-3 | `harness/policy.js`, `policy-driver.js`, `policy.sh`, `check` lists | waiting | - | polyglot-engineer; 0 dialogs (G-11) |
| T-4 | `approval.js` (`verifyBuffer`, `--expect`), `approve.sh` (`--preview`, `--expect`), `run.sh` additions | waiting | - | polyglot-engineer; 1 dialog minimum; signing form changes live |
| T-5 | `gate.js` via policy (host + container), `host-gate.sh`, `run.sh` container cases | waiting | - | polyglot-engineer; 1 dialog minimum; live in the container |
| T-6 | `guard.js` (collector, writer targets, git options, signing dialog, mode rule), `guard.sh` + `policy.sh` additions | waiting | - | polyglot-engineer; 1 dialog minimum, likely several; live at next Bash call |
| T-7 | `lint.js` rules + `COMPANY_LINT_ROOT`, `lint-rules.sh`, `check` | waiting | - | polyglot-engineer; no dialog |
| T-8 | `harness/README.md` (Bilinen boşluklar G-1..G-22), spec templates, lint string checks | waiting | - | polyglot-engineer; no dialog |
| T-9 | Wiring: host gate in `.claude/settings.json`, one-owner lint rule, `install-project.sh`, `routing.md`, `CLAUDE.md` rule 1 | waiting | - | polyglot-engineer; 2 dialogs minimum; needs T-1 evidence; host gate live |
| T-10 | First run with the CEO (3 dialog observations, `host-gate.sh --bench` p95 < 150 ms) | waiting | - | manual, needs the CEO |
| T-11 | Verification: fresh `check`, 13 mutation probes, criterion map; appsec, internal-auditor, quality-office | waiting | - | qa-engineer -> appsec -> internal-auditor -> quality-office |

Waiting for the CEO: T-1 sitting; approval to push the branch and to open issues and a draft PR (public repository); plan approval.

## (history) pre-signature tasks
| ID | Task | Status | Commit | Note |
|---|---|---|---|---|
| 1 | Structure review, 12 findings reported to CEO | done | - | no file changed |
| 2 | Draft specs 0004 (items 1-5) and 0005 (items 6-12) | done | - | business-analyst |
| 3 | Gates round 1: spec-critic x2, appsec on 0004 | done | - | 0004: critic 1 Critical + 6 High, appsec FAIL as written; 0005: 4 High |
| 4 | Revise 0005 (fixable findings) | in progress | - | business-analyst |
| 5 | Redesign 0004 | in progress | - | CEO accepted the key risk (KARARLAR rev. 48); software-architect redesigning |
| 7 | Spec 0002 moved to specs/done unchanged (CEO 2026-11-21); QA r2b open items in docs/ACIK-ISLER.md B2 | done | - | specs/active is empty |
| 6 | Mobile engineer units | waiting | - | after 0004/0005 ship |

## Parked questions (for the CEO)
- DECIDED 2026-11-21: appsec S-01 (passphrase-less CEO key, regex-recognised signing command). CEO accepted the risk: the host gate stops accidents, not an adversarial agent with Bash. Recorded in `docs/KARARLAR.md` rev. 48.
- Still open: waiver vs per-edit dialog (0004 Q-1); should unsigned Bash writes to code ask; waiver breadth cap and revocation; QA write area; is spec 0002 finished (it blocks `approve.sh`, which needs exactly one active spec); post-merge handling of a signed spec.

## Assumptions (Type 3)
- This job goes before spec 0003. The Tower job that 0002/0003 call "0004" needs a new number.

## Reasons to stop
- None open. (Stopped once on appsec S-01; resolved by CEO risk acceptance. 0004 stays lane 3.)

## Decided 2026-11-21 (docs/KARARLAR.md rev. 48)
Q-1 exception = per-edit dialog only (no exception notes, signature v1 kept) · Q-3 QA writes only new test files / `repro/`, rule 3 reworded · Q-2 deny in `acceptEdits`/`auto`/`bypassPermissions` until proven, ask when mode is absent. business-analyst is rewriting 0004 and writing 0006 (`specs/draft/0006-harness-unit-areas-evidence.md`); order 0004 -> 0006 -> 0005; then gates round 2 and CEO signature.

## Status 2026-11-21, late
- 0006 revised after gates (13 AC, no open question). 0004 revision in progress (round-2 findings + guard `git -C` gap). 0005 must then be updated to 0004's final classes and take the `image.sh` test-14 fix (docs/ACIK-ISLER.md B28).
- 0007 `specs/draft/0007-agency-config-update.md` drafted (config update, lane 2). CEO answered its two questions: narrow push ask rule; `/ceo-sign` runs `approve.sh . --expect` itself. Spec text still shows them open: fix in its revision. Gates for 0007 (spec-critic, appsec, architecture-board for `actions/setup-node`) run after 0004/0006 are final.
- Mobile: RN + Expo recorded "dene" in STACK.md; `mobile-engineer` opens after the trial (ACIK-ISLER B26). Scout reports 0002, 0003.
- Container tests run fresh: e2e 18/18, python 4/4, image 14/15 (B28). Image `company-agent:dev` built locally; proxy stopped.
- Sign order: 0004 -> 0006 -> 0005 -> 0007. Nothing committed; work is in the working tree on `main`.

## SIGNED 2026-11-21: spec 0004
- CEO generated a new key in his own terminal (no passphrase; `harness/keys/ceo.pub.pem` changed) and signed through the permission dialog. `node harness/approval.js verify specs/active/0004-harness-enforcement-gaps.md approvals harness/keys/ceo.pub.pem` -> APPROVED. Record: `approvals/specs__active__0004-harness-enforcement-gaps.md.sig.json` (local, gitignored). The spec file must not be edited: any edit voids the signature.
- Next: delivery-manager writes `plans/0004-plan.md` from the spec's task table T-0..T-11; T-1 (host verification with the CEO) comes first; engineer starts after the plan.

## (history) blocked on signature earlier on 2026-11-21
- CEO said yes to signing 0004. Done: branch `harness/0004-host-enforcement`, spec moved to `specs/active/` (sha256 unchanged `a686d6dc68c3…`). `harness/bin/approve.sh .` answered `no CEO key: run harness/bin/ceo-keygen.sh first`: the private key `~/.company/keys/ceo.key.pem` is not on this machine. NOT signed. The CEO must restore the old key or run `./harness/bin/ceo-keygen.sh` in his own terminal (it rewrites `harness/keys/ceo.pub.pem`, an enforcement file: commit it on this branch), then re-run approve.
- 0007: appsec round 2 PASS WITH CONDITIONS (S-01..S-06, no high); spec-critic round 2 still running.

## RESUMED 2026-11-21
- The interrupted consistency pass was verified item by item by a fresh analyst: all 17 items (0004-1..8, 0006-1..3, 0005-1..6) are applied; no edit was needed. 0004 sha256 starts `a686d6dc68c3` (draft path). `./harness/bin/check`: CHECK GREEN (full).
- 0004 is ready for the CEO's signature. On a yes: branch, move `specs/draft/0004-*` to `specs/active/`, set the `Spec:` line here, run `harness/bin/approve.sh .` (guard dialog = signature), then delivery-manager.
- 0007 gates round 2 (spec-critic, appsec) running.

## (history) stopped earlier on 2026-11-21 at the usage limit
- Gates done: 0004 r3 (signable on severity), 0006 r2, final consistency read (0004 and 0006 signable; 0005 blocked by two text items), appsec r3 (0004/0006 PASS WITH CONDITIONS, applied), ADR `docs/architecture/adr/0001-path-class-taxonomy.md` synced to 0004.
- IN-FLIGHT, UNFINISHED: the last consistency pass on 0004/0006/0005 (business-analyst) stopped at its turn limit with no report. Some of these items may be half-applied: 0004-1..0004-8 (refusal text vs AC-10, REQ-35 qualifier, quoted `<rel>` in §7.5, raw-view carve-out, darwin/win32 and deny>ask wording, AC-12 "at least these entries", stale 0005 statements in §13/R-10, `lint.js:8` in §12 rule 2); 0006-1..3 (row-3 branch, gate-round labels, T-0 record retirement); 0005-1..6 (diagram: record moves to `approvals/retired/`; Q-A marked decided; `git add STATE.md` in T-1; AC-9 auto/manual; §7 lifecycle sentence; round labels). NEXT: have a fresh analyst verify each item against the files and finish the rest, then one short verification read, then present 0004 to the CEO for signature.
- 0007: worktree scope removed (CEO decision; now six items, 13 AC, B29 tracks isolation). Needs gates round 2 (spec-critic, appsec). Open point: after 0004 REQ-36 the "reduced" ask-rule set is a single rule; decide keep or drop rows.
- Nothing signed, nothing committed. No harness or code file changed. Sign order: 0004 -> 0006 -> 0005 -> 0007. Then mobile trial (B26), worktree spec (B29).

## Next step (superseded by the blocks above where they differ)
Design written: `docs/architecture/tasarim/0004-host-enforcement.md` (paper design, nothing run). `architecture-board`: APPROVE WITH CONDITIONS K1-K9 (`docs/architecture/gorus-0004-host-enforcement-2026-11-21.md`): keep signature v1 and drop projectId (v2 would break container BUILD mode: host path vs /work), per-edit dialog now and defer exception notes, unit areas as a constant, split 0004b, reorder tasks (wrapper before T5, single hook owns file tools), fix the "superset of ENFORCEMENT" claim. CEO to answer Q-1 (exception mechanism; architect recommends E = signed exception note, board recommends A = per-edit dialog only; main session now recommends A), then Q-2 (deny in unproven permission modes) and Q-3 (QA write rule). Then business-analyst revises 0004 from the design (likely split 0004a gate+signing / 0004b areas+stop+rule 3), gates round 2, CEO signs.
