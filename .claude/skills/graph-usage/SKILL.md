---
name: graph-usage
description: Shared standard: query the graphify graph before reading code; impact analysis; keep the graph current. For all code-working units.
---

# Graphify usage: shared standard v0.2

## Purpose
Query the codebase from a persistent graph (graphify) instead of rescanning it: fewer reads, less quota, impact visible before the code. The graph is a hint, not evidence.

## Inputs
`graphify-out/graph.json` and `GRAPH_REPORT.md` if present; the tool `graphify` (host, v0.9.54); the question or the symbol to change.

## Method
1. **Graph first.** Read `GRAPH_REPORT.md`, then `graphify query "<q>" --budget 1500`, `explain "<node>"`, `path "<A>" "<B>"`. No graph and 50+ source files: propose setup to the Chief of Staff; meanwhile use `Grep`/`Glob`.
2. **Impact before the plan.** `graphify affected "<symbol>"`; put the files into the plan and the task's file ownership. Delivery uses it to find tasks touching the same node.
3. **Edge confidence.** `EXTRACTED` comes from code. `INFERRED`/`AMBIGUOUS` are guesses: verify in the source before using. Audit evidence is always `file:line`.
4. **Terms.** `query` matches substrings; take words from real labels, do not invent synonyms.
5. **Current.** After code changes `graphify update <path>` (code only, free). If the graph disagrees with the source, trust the source.
6. **Quota.** Default code only. Semantic extraction or `--mode deep` only with CEO approval (it spends tokens).
7. **Safety.** Build on source dirs (`src/`, `docs/`), never the project root (secrets). Graph output with a secret: delete, tell the CEO. `graphify-out/` stays out of git. Hook or `CLAUDE.md` installs: Chief of Staff, host, CEO approval.

## Output template
Cite graph facts: `(graph: EXTRACTED, <file>)`, `(graph: INFERRED, verified: <file:line>)` or `(graph: INFERRED, not verified)`.

## Checklist
- [ ] Graph/report tried first for a code question (if present).
- [ ] `affected` ran before the change; the plan's file list matches.
- [ ] INFERRED/AMBIGUOUS facts verified or marked "not verified".
- [ ] Semantic extraction only with CEO approval.
- [ ] No secret in graph scope; `graphify-out/` outside git.

## Prohibitions
Treating the graph as evidence · building at the project root · semantic extraction without quota · committing graph output · installing hooks without CEO approval.

## Tools and permissions
`graphify` (`query`, `explain`, `path`, `affected`, `god-nodes`, `update`) via `Bash` on the host; `Read` for the report. Not in the container image (ENV-10): there, read `graph.json` read-only or ask the Chief of Staff for a query.

## Stop and escalate
Stale or broken graph → use the source, ask for `update`. Quota overrun → ask the CEO. A secret file in the graph → security finding: stop and report.

## Examples
- Good: "`affected "OrderService"` → 6 files; `ReportJob.cs` INFERRED, verified at `ReportJob.cs:41`; added to the plan."
- Bad: "The graph says PaymentService depends on Billing, so I did not touch it." (INFERRED, unverified.)
