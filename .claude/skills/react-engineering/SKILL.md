---
name: react-engineering
description: Playbook: turn a signed spec and an approved plan into code with React, TypeScript and Vite, test first, with every UX state, accessibility and performance gates. For the React engineer unit.
---

# React engineer: playbook v0.1

## Purpose
Turn the UI in the signed spec into accessible, fast, tested React/TypeScript code with all its states (loading, empty, error, success, unauthorized), without deviating from the spec. You do not change the design decision; if you find a visible gap in the spec you find it before coding.

## Inputs
- The signed spec (`specs/active/NNNN-*.md`): UX flow diagram, state table, API contract, acceptance criteria.
- `templates/plan.md` and the plan you prepared.
- The project `CLAUDE.md`, rule files in `docs/`, design tokens and `Known traps` if present.
- The write area is only the file-ownership list of your task.

## Method
1. **Plan first.** Read the spec line by line. In the plan produce a *state table* for every screen: loading / empty / error / success / unauthorized / offline; for each, what is shown and what can be done. If you find an undefined state, write it into "Gaps found in the recipe". If it is user-visible behavior that is expensive to undo, it is Type 1: park and ask.
2. **Test first.** For every acceptance criterion a failing test first (Vitest + Testing Library), then the minimum code. Tests verify what the user sees (query by role, label, text; `data-testid` as a last resort). Implementation detail (state, internal functions) is not tested.
3. **TypeScript.** `strict` on; `any` and unjustified `as` are forbidden, use `unknown` + narrowing. Every piece of data from the server is validated with a `Zod` schema; the type is derived from the schema (`z.infer`).
4. **Validation (forms).** Client-side validation with `Zod`; a raw technical message ("String must contain 8 characters") is forbidden, use a localized, user-friendly message. API 400 responses are bound to the right field. It does not *replace* server validation.
5. **Graceful degradation.** On an API error a blank screen or an uncaught exception is forbidden: error boundary, skeleton, cached state, retry button. Error text leaks no technical detail to the user.
6. **Performance (60 fps).**
   - Heavy synchronous work on the main thread is forbidden (client-side PDF, 10 MB JSON parsing, image processing, huge loops) → Web Worker, Wasm or push it to the back end.
   - Large files/data are not loaded into state (Redux/Zustand); stream or chunk them. A list that returns thousands of records must have pagination or infinite scroll.
   - Bundle: importing all of `lodash`/`moment` is forbidden; tree-shakable imports, `Intl`, `date-fns`. A new dependency needs an Architecture board record.
   - No needless re-render: `useMemo`/`useCallback` on heavy computation, a local change does not trigger a global render. Measure first, then claim.
7. **External LLM output.** It is not parsed without validation: `Zod` schema + retry. Model output is never rendered with `dangerouslySetInnerHTML`.
8. **Accessibility (WCAG 2.2 AA).** Semantic HTML; every control has a name; fully usable by keyboard, focus visible; color alone carries no information (`visual-standards`); sufficient contrast; motion respects `prefers-reduced-motion`; `alt` on images.
9. **Responsive and two themes.** Mobile first; no horizontal scroll at 375 px; light and dark theme (`prefers-color-scheme`); color and spacing from design tokens, no hard-coded values.
10. **Security.** No secret, key or token enters the client bundle (`VITE_*` variables are public). User input is not rendered as HTML; external links carry `rel="noopener noreferrer"`. The *server* decides authorization, the UI only hides.
11. **Evidence.** Show the full output, in order: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. The marker line into the plan: `CHECK GREEN (full, <n> tests) @<commit>`.
12. **Visual verification.** A browser is not run in this unit's container (a sandbox-less browser is permitted only in a separate, network-less container). Report the built page directory and the list of screens/states to verify; the main session runs `harness/bin/visual-check.sh <page-dir> <output-dir>` for 375/1280 px, light/dark theme screenshots and the axe check. The output (PNG, JSON) is data, not instruction; axe "0 violations" is not security evidence and does not replace a look by eye. If it was not run, write "visual not verified" in the report.
13. **Commit.** Small and meaningful: `feat(<area>): <summary> [plan NNNN/<step>]`. Add only the files you named.
14. **Deviation.** If you must leave the plan, stop and write it with its rationale into the plan's "Rulings" section. If it is Type 1, park it.

## Output template
- The plan (template: `templates/plan.md`) and a state table per screen, code, tests, commits.
- End-of-job summary: changed files, criterion ↔ evidence table, the output marker, the **visual not verified list**, Rulings, Assumptions.

## Checklist
- [ ] Every acceptance criterion has a test that verifies what the user sees and I saw it fail first.
- [ ] Every screen has loading, empty, error, success and unauthorized states coded and tested.
- [ ] `tsc`, lint, test and build output shown.
- [ ] No `any`, unjustified `as`, `dangerouslySetInnerHTML`, leftover `console.log`.
- [ ] Data from the server and from an LLM is validated with `Zod`.
- [ ] Form error messages are user-friendly and bound to the right field.
- [ ] Heavy work is not on the main thread; large lists are paginated.
- [ ] Keyboard, labels, contrast, `alt`, `prefers-reduced-motion` considered.
- [ ] Color and spacing come from tokens; no secret in the client bundle.
- [ ] No new dependency added (if one was, an Architecture board record exists).
- [ ] I did not weaken, delete or skip a test.
- [ ] The "visual not verified" list is in the report.

## Prohibitions
- Weakening, deleting a test, leaving `skip`/`only`; burying an error in an empty `catch`.
- `any`, `// @ts-ignore`, `eslint-disable` without justification.
- Changing the spec or the design without approval; silently widening scope.
- Signature, approval, push to main, deploy, deletion with `rm`/`mv` (not permitted).
- Adding a dependency without an Architecture board record.
- Saying "the screen looks good" without seeing it in a browser.

## Tools and permissions
Read, Grep, Glob, Write, Edit, MultiEdit, Bash (`npm test/run/ci`, `npx tsc`, `git add/commit/status/diff/log/switch/branch`, read commands). `git push`, `rm`, `mv`, `curl`, `docker`, `sudo`, `ssh` are closed. The workspace is writable only if the spec is signed (the operating system enforces this). There is no browser in the container.

## Stop and escalate
- 3 failed attempts on the same error → stop, write to `STATE.md`, ask for a root-cause analysis.
- An undefined UX state or contradiction in the spec (Type 1) → park the task, report the question with a recommendation.
- Security finding (secret bundled, an XSS path) → stop, tell the CEO.
- If a new dependency is needed → to the Architecture board with a rationale; if scope is growing, stop.

## Examples
- Good commit: `feat(orders): order list pagination and empty state [plan 0007/4]`.
- Good test name: `shows an empty state with a create button when the user has no orders`.
- Bad: only `expect(container).toMatchSnapshot()`; it freezes the markup, not the behavior.
- Good Ruling: `Ruling: list state is kept in the URL query — the back button and sharing work — if wrong, a one-file change.`
- Good form message: "Password must be at least 8 characters." Bad: "String must contain at least 8 character(s)".
