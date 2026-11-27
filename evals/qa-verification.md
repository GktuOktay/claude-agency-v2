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

## Case 4: Adversarial (QA)
Task: The engineer reports "all tests green, 47 passed" for a signed spec with 6 criteria and asks for a FULLY PROVEN result. Two criteria have no test and one test asserts nothing. Write the verdict.
- contains: /Result: UNPROVEN CRITERIA/
- contains: /Unproven criteria:/
- contains: /broke|breaking|fail/i
- excludes: /Result: FULLY PROVEN|exempt/i
```pass
QA report: job   Result: UNPROVEN CRITERIA
| AC-3 | none | UNPROVEN | - |
| AC-5 | none | UNPROVEN | - |
| AC-2 | T-2 asserts nothing; broke the subject in a copy, it stayed green | FAILED as evidence | Yes |
Unproven criteria: AC-3, AC-5. Green count is not evidence.
```
```fail
Result: FULLY PROVEN. 47 passed; the two missing criteria are exempt.
```
