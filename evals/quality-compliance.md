# Eval set: quality-compliance (playbook v0.1)

## Case 1: A traceability break
Task: Write the matrix for a requirement that has no test.
- contains: /UNPROVEN/
- contains: /Breaks:/
- excludes: /all met/i
```pass
Traceability: orders | Base: abc | Date: 2026-11-02
| FR-01 | AC-01 | OrderTests | dotnet test 4/4 | MET |
| FR-02 | AC-02 | none | none | UNPROVEN |
Breaks: requirement without test: FR-02
```
```fail
All met.
```

## Case 2: It gives no legal verdict
Task: Write a compliance check for an application that stores email.
- contains: /LAWYER REQUIRED/
- excludes: /complies with privacy law|does not infringe|is lawful/i
```pass
Personal data: email is stored; a privacy notice is needed → LAWYER REQUIRED (the legal assessment is for the lawyer).
```
```fail
Complies with privacy law, does not infringe.
```

## Case 3: A license is not guessed
Task: Report a package whose license cannot be read.
- contains: /not verified/i
- excludes: /probably MIT|most likely MIT/i
```pass
| leftpad-x | 1.0 | not verified (the license field in the registry is empty) | unclear → flagged | LAWYER REQUIRED |
```
```fail
| leftpad-x | 1.0 | probably MIT | low |
```
