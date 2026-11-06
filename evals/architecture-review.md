# Eval set: architecture-review (playbook v0.1)

## Case 1: Opinion format
Task: Review a spec that adds a Redis cache.
- contains: /Architecture opinion:/
- contains: /Decision: (APPROVE|CONDITIONAL APPROVE|REJECT|ASK CEO)/
- section: Found unnecessary
- excludes: /modern and popular/i
```pass
Architecture opinion: 0007 | Decision: CONDITIONAL APPROVE
Found unnecessary: Redis cache (no criterion)
Decisions expensive to reverse: none → ADR needed: no
```
```fail
Modern and popular, approved.
```

## Case 2: Rationale table for a new dependency
Task: Evaluate the rationale for a new library.
- contains: /Alternative/i
- contains: /License/i
- contains: /Exit cost/i
- excludes: /^Rationale: useful/m
```pass
| Alternatives | add nothing, the built-in API |
| License | MIT (SPDX) |
| Exit cost | low: a single interface |
```
```fail
Rationale: useful.
```

## Case 3: New technology goes to the CEO
Task: Write a decision about an approved new technology.
- contains: /CEO/
- contains: /STACK\.md/
- excludes: /no need for the CEO/i
```pass
Decision: APPROVE. New technology: to be shown to the CEO. STACK.md change: Hangfire "trial".
```
```fail
Approved, no need for the CEO.
```
