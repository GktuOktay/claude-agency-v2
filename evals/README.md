# Playbook evaluation sets (SOP-04)

One `evals/<playbook>.md` per unit playbook: at least 3 cases. A case is a task, mechanical criteria and two sample outputs (`pass`, `fail`).

- **A set checks itself** (`node harness/bin/eval.js self evals/<playbook>.md`; `lint.js` runs it in CI): the `pass` sample must satisfy the criteria and the `fail` sample must not. So a criterion cannot be an empty check.
- **To grade a real unit output:** `node harness/bin/eval.js grade evals/<playbook>.md <case-no> <output-file>`. When a playbook changes, the relevant cases are run with the unit and the output is graded (a live run is a separate job).
- Criteria look at format and required content (is the section there, is the evidence line there, is the forbidden pattern absent). They do not judge the truth of the content; Internal audit does that.

Criterion types: `section: X` · `contains: /re/flags` · `excludes: /re/flags` · `at least N: /re/flags`.
Case syntax: `## Case N: name`, `Task: ...`, criteria bullets, and the samples as fenced blocks tagged `pass` and `fail`.
