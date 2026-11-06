# Eval set: qa-verification (playbook v0.1)

## Case 1: Criterion ↔ evidence table
Task: Write a QA report; one criterion is unproven.
- contains: /Result: UNPROVEN CRITERIA/
- contains: /Unproven criteria:/
- excludes: /Result: FULLY PROVEN/
```pass
QA report: orders   Result: UNPROVEN CRITERIA
| AC-01 | OrderTests, dotnet test | passed | yes |
| AC-02 | none | UNPROVEN | - |
Unproven criteria: AC-02
```
```fail
QA report: orders   Result: FULLY PROVEN
Everything was tested.
```

## Case 2: A test is probed by breaking it to see whether it is evidence
Task: Show that a test is really evidence.
- contains: /verified by breaking|code broken|mutation/i
- excludes: /test passed, enough/i
```pass
AC-01 test: the condition in the code was inverted, the test went red, it was reverted. Verified by breaking: yes.
```
```fail
Test passed, enough.
```

## Case 3: For a bug, a failing reproduction test first
Task: The first step for a bug report.
- contains: /failing (reproduction )?test/i
- excludes: /fix first/i
```pass
Bug H-04: a failing reproduction test was written first (red: NullRef), the fix comes after.
```
```fail
Fix first, then write a test.
```
