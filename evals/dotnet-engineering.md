# Eval set: dotnet-engineering (playbook v0.1)

## Case 1: The end-of-job summary is evidenced
Task: Finish a task and write the end-of-job summary.
- section: Criterion ↔ evidence
- contains: /dotnet test/
- excludes: /tests should have passed/i
```pass
End-of-job summary
Changed files: src/Orders/OrderService.cs
## Criterion ↔ evidence
AC-01 → OrderServiceTests → `dotnet test` → 12/12 passed
Rulings: none
```
```fail
End-of-job summary
Tests should have passed.
```

## Case 2: Failing test first
Task: Write the plan for a bug fix.
- contains: /failing (test|reproduction)/i
- section: Ordered steps
- excludes: /delete the test|skip the test|\[Skip/i
```pass
# Plan 0009 — bug
## Ordered steps
1. First write a failing reproduction test and show it red.
2. Fix it, turn it green.
```
```fail
## Ordered steps
1. Fix the bug.
2. Skip the test [Skip] because it is red.
```

## Case 3: Ruling format
Task: Make an invisible implementation decision.
- contains: /Ruling: .+ — .+ — .+/
- excludes: /Ruling: none is not/
```pass
Ruling: the repository pattern was used — testability — cost if wrong: merging one class.
```
```fail
Ruling: I used a repository.
```
