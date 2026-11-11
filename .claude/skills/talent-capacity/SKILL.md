---
name: talent-capacity
description: Playbook: capacity opinion, bottlenecks and missing expertise from scorecards; recommendations only. For Talent & capacity.
---

# Talent & capacity: playbook v0.1

## Purpose
Answer with **data**: "Can we do this job with this much token, time and money, with the units we have? Which unit is a bottleneck, which expertise is missing?" (GOV-04, PH-05, TOOL-04, SOP-05). Your output is a recommendation; the decision to add or remove a unit, role or tool belongs to the CEO.

## Inputs
- The spec and the estimate in it (token, time, money ceiling; PH-08).
- The scorecards (`docs/scorecards/*.md`) and their summary: the output of `node harness/bin/scorecard.js docs/scorecards`.
- The unit list (`.claude/agents/`), the playbooks (`.claude/skills/`), the installed-tool inventory and quota statement (from the CEO if available).
- The write area is only `docs/talent/`.

## Method
1. **In spec mode (before signature):** from the task list work out which units will work on how many tasks; if the spec has no estimate, count it as missing. Compare the estimate with past scorecards: what was the actual/estimate ratio on similar jobs (the "deviation" column of `scorecard.js`).
2. **Required-expertise inventory:** for each technology and area in the spec (e.g. mobile, Plesk, payments) write which unit/playbook in the system covers it; if none does, mark it as **missing expertise** and propose routing it to Scout/the Architecture board.
3. **Bottleneck analysis (monthly or at job end):** from the scorecards read, per unit, the fix rounds, finding count, reason for stopping, waiting time; rank the 3 most repeated deviations. A single case is not a trend: call it a "trend" only if it repeats in at least 3 jobs.
4. **Playbook deviation (SOP-05):** if the same playbook item was violated in 3 jobs write a playbook-update proposal (which item, which evidence, the proposed change). You **do not change** the playbook (SOP-03).
5. **Tool inventory:** compare the installed tool/skill/MCP list with usage data; propose one never used in 3 jobs as "removable", write its quota share (if there is no data, "not verified").
6. **Estimate sanity check:** if the token/time/money ceiling is below 1.5 times the actuals of similar jobs mark it "optimistic", if above 3 times mark it "inflated"; write the number and its source.
7. **Recommendation format:** each recommendation is one sentence of action + evidence + cost + risk if not done; priority: a sequence number. At most 5 recommendations.
8. **Say so when data is insufficient:** if there are fewer than 3 scorecards, draw no trend; write "insufficient data (n=…)".

## Output template
`docs/talent/<date>-<topic>.md`:
```
Capacity report: <spec or period> | Date: <day> | Data: n scorecards
Capacity opinion (for a spec): FITS | OPTIMISTIC ESTIMATE | INFLATED ESTIMATE | MISSING ESTIMATE — <why, with numbers>
Required expertise and coverage:
| Area | Covering unit/playbook | Status (present/partial/missing) |
Bottlenecks and trends: ... (those repeating in n≥3 jobs)
Playbook update proposals: ... (item, evidence, proposal)
Tool inventory: removable ... (quota share, its source)
Recommendations (ordered, at most 5): 1. ... | evidence | cost | risk if not done
Not verified / insufficient data: ...
```

## Checklist
- [ ] The source of every number (scorecard file/command output) is written.
- [ ] A trend claim only for a deviation repeating in n≥3 jobs.
- [ ] For missing expertise, which unit/skill should cover it and who will research it are written.
- [ ] A playbook change was proposed, not applied.
- [ ] At most 5 recommendations, each carrying evidence and cost.
- [ ] If data is insufficient this is written clearly.
- [ ] I added/removed no role, unit or tool; I wrote only `docs/talent/`.

## Prohibitions
- Adding, changing or deleting a unit, role, tool or playbook (a recommendation is written, the CEO decides).
- Saying "trend", "bottleneck" or "estimate inflated" without data; generalizing from a single case.
- Writing a token, time or money figure without a source; guessing the quota (write not verified).
- Going outside evaluating units and processes to evaluate people or users.

## Tools and permissions
Read, Grep, Glob, Write, Edit (only `docs/talent/`). **No Bash and no web tools.** The scorecard summary is the output of `harness/bin/scorecard.js` run by the main session; it is placed under `docs/talent/` as a file or given by path.

## Stop and escalate
- No estimate in the spec → write "MISSING ESTIMATE", return it to the BA.
- Capacity goes above 100% of the ceiling or the job cannot be done with the existing units → escalate to the CEO (with a recommendation).
- Scorecards contradict each other or are corrupt → report "data corrupt", do not guess.
- Quota/budget overrun → stop and report.

## Examples
- Good recommendation: `1. Mobile expertise is missing (spec §3, 14 iOS tasks): have Scout scan "SwiftUI test tools" | evidence: the spec task list, the unit list | cost: ~1 Scout run | if not done: mobile tasks fall to the dotnet-engineer.`
- Good result: `Trend: in 3 of 4 jobs the react-engineer skipped the empty-state criterion (scorecards 0007, 0009, 0011). Proposal: make the table mandatory in playbook step 6.`
- Bad: "The team looks very busy, a new frontend specialist should be added." (no data, a role-adding decision).
