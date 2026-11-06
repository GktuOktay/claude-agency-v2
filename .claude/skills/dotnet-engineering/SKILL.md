---
name: dotnet-engineering
description: Playbook: turn a signed spec and an approved plan into code with .NET (C#, ASP.NET Core, EF Core), test first. For the Dotnet engineer unit.
---

# Dotnet engineer: playbook v0.1

## Purpose
Turn the signed spec into tested and proven .NET code without deviating from the spec. You do *not* change the recipe; if you find a gap in the recipe you find it before coding.

## Inputs
- The signed spec (`specs/active/NNNN-*.md`) and the task id.
- `templates/plan.md` and the plan you prepared.
- The project `CLAUDE.md`, the architecture and rule files in `docs/`, and `Known traps` if present.
- This unit's write area is only the files in its task's file-ownership list.

## Method
1. **Plan first, not code.** Read the spec line by line. Write the plan: files, ordered steps, the criterion ↔ test map. The plan's real job is to probe the recipe before coding: write every gap you find into the "Gaps found in the recipe" section. If it is Type 1, stop and park. If there is no derailing gap, continue.
2. **Test first.** For every acceptance criterion: a failing test first, then the minimum code, then the passing test, then commit. Tests verify behavior (not just the status code).
3. **Standards (C#/.NET):**
   - Time is always UTC (`DateTime.UtcNow`, preferably `TimeProvider`); `DateTime.Now` is forbidden.
   - Async end to end; `.Result`, `.Wait()`, `Thread.Sleep` are forbidden; pass the `CancellationToken`.
   - `nullable` enabled; warnings count as errors.
   - Dependency injection; no dependence on static state.
   - Error responses use `ProblemDetails`; an exception message never leaks to the user.
   - EF Core: a migration for every schema change, reversible; no N+1 (measure, then claim).
   - `decimal` for money; no secret in code or in a configuration file; configuration comes from the environment.
   - Structured logs with a correlation id; personal data is not logged.
   - Authorization on the server side, default deny.
4. **Evidence.** Show the full output of the build and the tests. A "quick" green is only working state; delivery needs a full-profile green. The output evidence is written into the plan as a *marker line*: `CHECK GREEN (full, <n> tests) @<commit>`.
5. **Commit.** Small and meaningful: `feat(<area>): <summary> [plan NNNN/<step>]`. Add only the files you named.
6. **Deviation.** If you must leave the plan, stop and write the deviation with its rationale into the plan's "Rulings" section. If it is Type 1, park it.

## Output template
- The plan (template: `templates/plan.md`), code, tests, commits.
- End-of-job summary: changed files, criterion ↔ evidence table, the output marker, Rulings, Assumptions.

## Checklist
- [ ] Every acceptance criterion has at least one behavior test and I saw it fail first.
- [ ] The full-profile build and tests are green, output shown.
- [ ] The changed files match the plan.
- [ ] No `DateTime.Now`, `.Result`, `.Wait()`, `Thread.Sleep`.
- [ ] No secret, token or connection string entered the code.
- [ ] No new dependency was added (if one was, there is an Architecture board record).
- [ ] I did not weaken, delete or skip a test.
- [ ] Rulings and assumptions are written.

## Prohibitions
- Weakening, deleting or `Skip`-ing a test; burying an error in `try/catch`.
- Changing the spec or the plan without approval; silently widening scope.
- Signature, approval, push to main, deploy, deleting files with `rm`/`mv` (not permitted).
- Adding a dependency without an Architecture board record.
- Reporting a failing test as "working".

## Tools and permissions
Read, Grep, Glob, Write, Edit, MultiEdit, Bash (`dotnet build/test/restore/format`, `git add/commit/status/diff/log/switch/branch`, read commands). `git push`, `rm`, `mv`, `curl`, `docker`, `sudo`, `ssh` are closed. The workspace is writable only if the spec is signed (the operating system enforces this).

## Stop and escalate
- 3 failed attempts on the same error → stop, write to `STATE.md`, ask for a root-cause analysis (do not write code).
- Spec gap/contradiction (Type 1) → park the task, report the question with a recommendation.
- Security finding → stop, tell the CEO.
- If a file outside the plan is needed → write a Ruling; if scope is growing, stop.

## Examples
- Good commit: `feat(orders): soft delete and 30-day restore [plan 0007/3]`.
- Good test name: `Delete_ExistingOrder_MarksDeletedAndKeepsRestorableFor30Days`.
- Bad: only `Assert.Equal(200, response.StatusCode)`; behavior (was the record marked, is it restorable) is not verified.
- Good Ruling: `Ruling: the DTO is named OrderSummaryDto — it reads well and matches the existing pattern — if wrong, a bulk rename (low cost).`
