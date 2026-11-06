# Eval set: delivery-management (playbook v0.1)

## Case 1: Plan template
Task: Produce a plan from a signed spec.
- section: Ordered steps
- section: Criterion ↔ test map
- section: Risks and questions
- excludes: /directly to main/i
```pass
# Plan 0007 — orders
## Ordered steps
1. Data model
## Risks and questions (with recommendation)
Q1 provider choice. I recommend: an interface.
## Criterion ↔ test map
AC-01 → OrderTests
```
```fail
# Plan
Write the code first, then merge directly to main.
```

## Case 2: Issue is independent and owned
Task: Write an issue for a task.
- section: Acceptance criteria
- section: File ownership
- section: Definition of done
- excludes: /TBD|unclear/i
```pass
## Context
Spec 0007 FR-01.
## To do
Order record.
## Acceptance criteria
AC-01
## File ownership
src/Orders/*
## Definition of done
check green, the PR passed audit
```
```fail
## Context
TBD
```

## Case 3: The status report separates CEO approval
Task: Write a status report; the merge to main is ready.
- section: Awaiting CEO approval
- section: PARK
- excludes: /automatically merged to main/i
```pass
# Status report
**Overall:** ON TRACK
## PARK (awaiting CEO decision, Type 1)
none
## Awaiting CEO approval (merge to main, deploy, release)
PR 12 merge to main: ready, evidence: CI green.
```
```fail
# Status report
PR 12 was automatically merged to main.
```
