# Routing (company pipeline)

When the CEO describes a job, start the matching unit without asking. Chat, questions and one-line fixes: do them yourself. Pipeline weight matches risk; heavier than needed is a defect too.

| CEO says | Unit |
|---|---|
| idea, market, competitors | `product-manager` (+ `scout`: ready-made solution?) |
| new system, large change, migration | `software-architect` → `business-analyst` |
| small job, bug | `business-analyst` (quick spec) |
| other stack (Django, Vue, PHP, Java, Go) | `polyglot-engineer`; design: `software-architect` |
| "ready?", "done?" | `qa-engineer` → `appsec` → `internal-auditor` → `quality-office` (as the lane requires) |
| release, server, Docker, CI | `devops-sre` (prepares; CEO releases) |
| store copy, brand, manual | `marketing`, `tech-comms` |

## Lanes (pick the lightest that fits; name it in one line)
- **0** chat, trivial fix, rename, config tweak: main session; show fresh test/build output. No spec, no units.
- **1** small job/bug; no new data model, auth, external call, dependency or visible redesign: quick spec → CEO signs in chat → one engineer → one review by `qa-engineer` (QA + audit). No gates, no delivery-manager, no quality-office.
- **2** medium feature, visible behavior, no new trust boundary: spec → `spec-critic` (+ `appsec` if auth, input, secrets, files or external calls; + `architecture-board` if a new dependency) → CEO signs → engineer → `qa-engineer` → `internal-auditor`. `delivery-manager` only if work spans sessions.
- **3** new system, migration, data-loss or security-sensitive, public or paid: `software-architect` → spec → `spec-critic`, `appsec`, `architecture-board` in parallel → CEO signs → `delivery-manager` → engineer → `qa-engineer` → `appsec` → `internal-auditor` → `quality-office`.

Escalate when a gate finds a trust-boundary, data or security issue; never de-escalate to skip a finding. Unsure: take the lower lane and note the risk under Assumptions. Run the delivery chain once, at the end.

**Every lane:** spec signed by the CEO before code (lane 0 excepted) · the maker never verifies · done = fresh build/test output · envelope actions (prod deploy, push/merge to main, store, public release, external message, money, permanent deletion) need CEO approval each time.

## Models
Smallest model that can do the job; override per call with the Agent `model` parameter.
- Lane 1: `sonnet` for everything. Lane 2: `sonnet`; `opus` only for `appsec` on auth/crypto/payment or an engineer stuck after 2 attempts.
- Lane 3: `opus` for architect, spec, `appsec`, `internal-auditor`; `sonnet` for engineers, qa, delivery, comms.
- `haiku` (or `Explore`) for `talent-capacity`, listings, mechanical edits, grep fan-out.

## Briefs and reports
- Give a unit the spec path and the exact question, not the history. Independent gates get a fresh context. Parallel units in one message. Fork only if the unit needs this conversation.
- End every brief with: "Report caveman style: findings and evidence only, max 25 lines unless the output is a file."
- Rewrite unit reports for the CEO in terse Turkish (full text where `terse-mode.md` says off). Reviews: `caveman-review`; commits: `caveman-commit`. Files on disk are written plainly.

Default stack .NET + React, a preference not a restriction. The signature gate and guard are enforced only where `harness/bin/install-project.sh` ran; elsewhere follow the pipeline by instruction and get spec approval in chat.
