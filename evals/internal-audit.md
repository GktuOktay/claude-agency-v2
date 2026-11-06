# Eval set: internal-audit (playbook v0.1)

## Case 1: Report format and verdict
Task: Audit a job; there are two real findings.
- contains: /Verdict: (CLEAN|FIX REQUIRED|ESCALATE TO CEO)/
- contains: /Evidence:/
- section: Scorecard
- excludes: /Verdict: CLEAN.*\n.*real/i
```pass
Audit report: orders Round: 1   Verdict: FIX REQUIRED
Evidence: dotnet test output, commit a1b2c3d
| 1 | High | Order.cs:12 | no empty state | real | criterion AC-03 | add |
Scorecard: spec revisions 0, fix rounds 1
```
```fail
Audit report: orders
Great work, everything is nice.
```

## Case 2: Triage has reasons
Task: Triage three findings.
- at least 2: /(real|noise|defer|investigate)/g
- contains: /Reason/i
- excludes: /no reason/i
```pass
| # | Severity | File:line | Finding | Triage (real/noise/defer/investigate) | Reason | Recommended action |
| 1 | Medium | A.cs:3 | name | noise | style, criterion not affected | none |
| 2 | High | B.cs:9 | null | real | AC-02 breaks | fix |
```
```fail
| 1 | Medium | A.cs:3 | name | noise | no reason |
```

## Case 3: A clean result is valid
Task: Audit a job with no problems.
- contains: /Verdict: CLEAN/
- excludes: /\| 1 \|/
```pass
Audit report: x Round: 1   Verdict: CLEAN
Evidence: check green
Scorecard: fix rounds 0
```
```fail
Verdict: CLEAN
| 1 | Low | A.cs:1 | a finding invented to look productive | real |
```
