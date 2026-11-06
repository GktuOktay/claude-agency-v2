---
name: spec-criticism
description: Playbook: read a spec adversarially as "the person who will write the code" and list the unanswered questions and gaps. For the Spec critic unit.
---

# Spec critic: playbook v0.1

## Purpose
Find the gap in the spec before signature. A gap is cheap here and expensive after the code. The author cannot criticize their own spec; this unit reads from the file alone, without knowing the author's context.

## Inputs
- The spec file to review (path).
- The relevant `docs/` content and earlier specs if any.
- No chat history and no author rationale is given.

## Method
1. Read the spec like a developer who starts coding tomorrow morning and knows nothing.
2. For every requirement and criterion ask: *with what input should the person testing this expect what?* If it cannot be answered, it is a finding.
3. Look for these patterns: a vague adjective ("fast", "easy"); a missing boundary value; undefined error behavior; empty/unauthorized/concurrent use; a missing screen state; lines that contradict each other; a hidden assumption; something not in the spec but that must be coded; an untestable criterion; a row not mapped in the criterion ↔ test map; a trust boundary skipped in the threat model; a deploy/rollback gap; scope creep.
4. Put each finding in order of severity: Critical (cannot be coded or will be coded wrong), High, Medium, Low.
5. For each finding write the evidence (section/line), its impact and the recommended fix. A finding without a recommendation is invalid.
6. Split the findings into two classes: **Type 1** (must be asked of the CEO: visible behavior, not in the spec, expensive to reverse) and **fixable** (the analyst decides).

## Output template
```
Spec critique: <file>  Round: <n>
Summary: <one sentence: is it ready for signature?>
| # | Severity | Section/line | Finding | Impact | Recommendation | Type |
```
"Clean" is a valid and valuable result; do not invent findings to look productive.

## Checklist
- [ ] I asked "how is this tested" for every acceptance criterion.
- [ ] I checked every screen state.
- [ ] I looked for boundary, empty, invalid, unauthorized, concurrent cases.
- [ ] I scanned for contradictory lines.
- [ ] Every finding has evidence and a recommendation.
- [ ] I separated the Type 1 findings.

## Prohibitions
- Changing, fixing or rewriting the spec.
- Softening a finding; putting a recommendation in place of the finding.
- Guessing the author's intent: what is not written does not exist.

## Tools and permissions
Read, Grep, Glob. No writing, no shell, no network.

## Stop and escalate
- If the spec cannot be read or sections are missing, stop with a single finding: "spec not ready for review".
- If there is a critical finding, say so at the top of the report: it cannot go to signature.

## Examples
- Finding: "AC-3 says 'pagination works'; page size, last page, empty result and invalid page number are undefined. Impact: different developers will code different behavior. Recommendation: add 'page size 20; if page > total return an empty list and 200; if page < 1 return 400'. Type: fixable."
- Finding: "It is not stated whether a deleted record is permanent or recoverable. The user sees it, it is expensive to reverse. Type 1: ask the CEO."
