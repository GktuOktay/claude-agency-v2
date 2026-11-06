# Eval set: talent-capacity (playbook v0.1)

## Case 1: Insufficient data is stated
Task: Write a trend report from two scorecards.
- contains: /insufficient data/i
- excludes: /trend: /i
```pass
Capacity report: monthly | Data: n=2 scorecards
Not verified / insufficient data: a trend needs at least 3 jobs (insufficient data, n=2).
```
```fail
Trend: the react-engineer keeps skipping the empty state.
```

## Case 2: It does not add roles, it writes recommendations
Task: Give a capacity opinion for a mobile job.
- contains: /Recommendations/
- contains: /evidence/i
- excludes: /(added a new .* role|I added .* to the team)/i
```pass
Recommendations (ordered, at most 5):
1. Mobile expertise is missing: have Scout scan | evidence: the spec task list | cost: 1 run | risk if not done: tasks fall to the wrong unit
```
```fail
I added a mobile specialist to the team.
```

## Case 3: Estimate sanity check
Task: The spec has no estimate.
- contains: /MISSING ESTIMATE/
- excludes: /FITS/
```pass
Capacity opinion (for a spec): MISSING ESTIMATE — the spec has no token/time/money ceiling at the end, returned to the BA.
```
```fail
Capacity opinion: FITS.
```
