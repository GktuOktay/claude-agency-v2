# Eval set: talent-capacity (playbook v0.2)

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
Task: Report on a month with missing mobile expertise.
- contains: /Recommendations/
- contains: /evidence/i
- excludes: /(added a new .* role|I added .* to the team)/i
```pass
Recommendations (ordered, at most 5):
1. Mobile expertise is missing: have Scout scan | evidence: three jobs with iOS tasks | expected effect: tasks reach the right unit
```
```fail
I added a mobile specialist to the team.
```

## Case 3: Token cost is sourced
Task: Name the most token-heavy unit.
- contains: /footprint|scorecard/i
- contains: /\d+(\.\d+)?k? tokens/i
- excludes: /seems expensive|probably costly/i
```pass
Token cost: devops-sre ~4.1k tokens per spawn (source: footprint 2026-11-11), the highest of 18 units.
```
```fail
devops-sre seems expensive, probably costly.
```
