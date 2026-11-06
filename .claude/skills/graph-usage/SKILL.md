---
name: graph-usage
description: Shared standard: ask codebase and architecture questions to the graphify knowledge graph first, do impact analysis, keep the graph current and safe. For every unit that works with the codebase.
---

# Graphify usage: shared standard v0.1

## Purpose
Query the codebase from a persistent knowledge graph (graphify) instead of scanning it from scratch every time: fewer files read, less quota, and the impact area visible before the code. The graph is a **map of hints, not evidence**.

## Inputs
- In the project, `graphify-out/graph.json` and `GRAPH_REPORT.md` (if present). Tool: `graphify` (installed on the host machine, v0.9.54 verified).
- A question or change: a symbol, module or flow name.

## Method
1. **Report and graph first.** For a codebase or architecture question, if a graph exists, look first at `GRAPH_REPORT.md`, then at `graphify query "<question>" --budget 1500`, `graphify explain "<node>"`, `graphify path "<A>" "<B>"`. If there is no graph and the project is large (50+ source files), propose setting it up to the Chief of Staff; do not wait for the graph, continue with `Grep`/`Glob`.
2. **Impact analysis before the plan.** Before changing a symbol run `graphify affected "<symbol>"`; fold the resulting files into the plan's "Files" section and the task's file-ownership table. Delivery uses this to check whether two tasks touch the same node.
3. **Read edge confidence.** An `EXTRACTED` edge comes from source code and is reliable. `INFERRED` and `AMBIGUOUS` edges are guesses: they are not used as a decision, report or finding without verifying in the source file. The evidence of an audit finding is always `file:line`, never the graph.
4. **Term mismatch.** `query` does substring matching; it cannot find a synonym or a term in another language. First pull words from the real labels in the graph, then query; do not invent words.
5. **Keep it current.** When code changes, `graphify update <path>` (code only, no LLM, free). If a graph shows a node whose source has changed as stale, trust the source.
6. **Quota.** Semantic extraction for documents, images or papers starts a sub-agent and takes from the subscription quota. Default: code only. Semantic extraction and `--mode deep` only if the spec writes a quota share or the CEO asked.
7. **Safety.** Build the graph not at the project root but in source directories (`src/`, `docs/`); keep `.env`, key and certificate files out of scope. (graphify has no verified separate exclusion setting, so you choose the path.) If graph output contains a secret, delete it and tell the CEO.
8. **Output is derived.** `graphify-out/` does not enter the repo (`.gitignore`); it can be regenerated. The git hook (`graphify hook install`) and `graphify claude install` change project settings: only the Chief of Staff, on the host machine, with CEO approval.
9. **Feedback (optional).** For a useful query `graphify save-result --outcome useful`, for a misleading one `--outcome corrected --correction "<the right answer>"`; `graphify reflect` produces a lessons list from these.

## Output template
When you use information from the graph, state its source: `(graph: EXTRACTED, <file>)` or `(graph: INFERRED, verified: <file:line>)`. If unverified: `(graph: INFERRED, not verified)`.

## Checklist
- [ ] For a code question the graph/report was tried first (if present).
- [ ] `affected` ran before the change and the plan's file list matches it.
- [ ] INFERRED/AMBIGUOUS information was verified in the source or marked "not verified".
- [ ] A quota share is written for semantic extraction (if not, only code was extracted).
- [ ] The graph scope contains no secret and `graphify-out/` is outside git.

## Prohibitions
- Treating the graph as evidence; saying "there is/isn't a dependency" on the strength of an INFERRED edge.
- Building a graph blindly at the project root (secret files fall into scope).
- Semantic extraction or `--mode deep` without a quota share.
- Committing graph output to the repo.
- Installing the git hook or the `CLAUDE.md` section without CEO approval.

## Tools and permissions
`graphify` commands (`query`, `explain`, `path`, `affected`, `god-nodes`, `update`) on the host machine with `Bash`; `GRAPH_REPORT.md` with `Read`. graphify is not yet in the container image (ENV-10): an agent in the container cannot query the graph; it can read `graph.json` read-only, or the Chief of Staff runs the query on the host and hands it over as text.

## Stop and escalate
- If the graph looks stale or broken (an existing file is not found), return to the source and ask the Chief of Staff for an `update`.
- If semantic extraction would exceed the quota, stop and ask the CEO.
- If a file containing a secret entered the graph, count it as a security finding: stop and report.

## Examples
- Good: "`graphify affected "OrderService"` → 6 files. 4 are EXTRACTED; `ReportJob.cs` is INFERRED, I opened it and verified: it really calls it (`ReportJob.cs:41`). I added it to the plan's file list."
- Bad: "The graph says `PaymentService` is tied to `Billing`, so I did not touch it." (INFERRED, unverified.)
