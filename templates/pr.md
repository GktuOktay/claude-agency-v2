## Spec and plan
- Spec: `specs/active/NNNN-<name>.md` — criteria: AC-n, AC-m
- Plan: `plans/NNNN-plan.md`
- Related issue: closes #<n>
- Base branch: `integration/NNNN-<name>` <!-- PRs bound for main need CEO approval -->

## What and why
<!-- 2-3 sentences, business language. -->

## Criterion ↔ evidence
| Criterion | Evidence (test + command) | Status |
|---|---|---|

## Evidence marker
`CHECK GREEN (full, <n> tests) @<sha>` <!-- or the CI run link + commit -->

## Audit
Internal audit report: <!-- link or summary. Verdict: CLEAN | FIX REQUIRED | ESCALATE TO CEO -->

## Rulings and assumptions
<!-- Ruling: <decision> — <why> — <cost if wrong>.  Assumption: <what> — <why> -->

## Risk and rollback
<!-- What this change could break, how it is rolled back. -->

## Check
- [ ] The changed files match the plan list
- [ ] No test was weakened, deleted or skipped
- [ ] No secret
- [ ] No new dependency (if there is one, an Architecture board record)
