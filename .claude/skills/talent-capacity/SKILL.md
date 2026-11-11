---
name: talent-capacity
description: Playbook: bottlenecks, missing expertise, recurring playbook deviations, unused tools and token-heavy units from scorecards; recommendations only. For Talent & capacity.
---

# Talent & capacity: playbook v0.2

## Purpose
Answer with **data** from finished jobs: which unit is a bottleneck, which expertise is missing, which playbook item keeps being broken, which unit or tool spends the most tokens (GOV-04, TOOL-04, SOP-05). Your output is a recommendation; adding or removing a unit, role or tool is the CEO's decision.

## Inputs
- The scorecards (`docs/scorecards/*.md`) and their summary (`node harness/bin/scorecard.js docs/scorecards`).
- The unit list (`.claude/agents/`), the playbooks (`.claude/skills/`), the installed tool list.
- The footprint table (`node harness/bin/footprint.js`): what each unit loads.
- The write area is only `docs/talent/`.

## Method
1. **Bottlenecks:** per unit, fix rounds, finding count, stop reason; rank the 3 most repeated deviations. A trend needs at least 3 jobs.
2. **Missing expertise:** for each technology or area that came up (e.g. mobile, Plesk, payments), which unit/playbook covers it; if none, mark it **missing** and propose routing it to Scout or the Architecture board.
3. **Playbook deviation (SOP-05):** the same item broken in 3 jobs → propose a playbook change (item, evidence, change). You do not change the playbook (SOP-03).
4. **Token cost:** from `tokens_used` in the scorecards and the footprint table, name the units and playbooks that cost the most and propose how to cut them (a shorter playbook, a smaller model, a lighter lane).
5. **Unused tools:** a tool/skill/MCP unused in 3 jobs is proposed as "removable".
6. **Recommendation format:** one sentence of action + evidence + expected effect; ordered; at most 5.
7. **Insufficient data:** fewer than 3 scorecards → no trend; write "insufficient data (n=…)".

## Output template
`docs/talent/<date>-<topic>.md`:
```
Capacity report: <period> | Date: <day> | Data: n scorecards
Bottlenecks and trends: ... (repeating in n≥3 jobs)
Missing expertise: | Area | Covering unit/playbook | Status (present/partial/missing) |
Playbook update proposals: ... (item, evidence, proposal)
Token cost: highest units/playbooks ... (source: scorecard, footprint)
Recommendations (ordered, at most 5): 1. ... | evidence | expected effect
Not verified / insufficient data: ...
```

## Checklist
- [ ] Every number has a source (scorecard file or command output).
- [ ] A trend only for a deviation repeating in n≥3 jobs.
- [ ] Missing expertise names who should cover and who researches it.
- [ ] Playbook changes proposed, not applied.
- [ ] At most 5 recommendations, each with evidence.
- [ ] Insufficient data stated plainly.
- [ ] I added/removed nothing; I wrote only `docs/talent/`.

## Prohibitions
- Adding, changing or deleting a unit, role, tool or playbook.
- Claiming a trend or bottleneck without data; generalizing from one case.
- Writing a number without a source.
- Evaluating people instead of units and processes.

## Tools and permissions
Read, Grep, Glob, Write, Edit (only `docs/talent/`). No Bash and no web tools; the main session runs `scorecard.js` and `footprint.js` and passes the output.

## Stop and escalate
- Scorecards are corrupt or contradict each other → report "data corrupt", do not guess.
- The job cannot be done with the existing units → escalate to the CEO with a recommendation.

## Examples
- Good: `1. devops-sre loads ~4.1k tokens per spawn (footprint), the most of any unit | evidence: footprint 2026-11-11 | effect: trimming its playbook by a third saves ~1k tokens per call.`
- Good: `Trend: in 3 of 4 jobs react-engineer skipped the empty-state criterion (scorecards 0007, 0009, 0011). Proposal: make the state table mandatory in playbook step 1.`
- Bad: "The team looks busy, add a frontend specialist." (no data, a role decision).
