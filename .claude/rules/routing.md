# Automatic routing (company pipeline)

When the user (CEO) describes a job, start the matching unit **without asking**: it starts the pipeline, you manage it. Do not open the pipeline for chat, questions, explanations or one-line fixes: do those yourself.

Cost rule: the pipeline's weight must match the job's risk. A heavier lane than needed is a defect, the same as a lighter one.

## Unit table

| What the user says | Unit that starts |
|---|---|
| An idea, "should we build it", competitors, market | `product-manager`, and `scout` when the question is "is there a ready-made solution" |
| New system, large change, migration from another stack | `software-architect` → `business-analyst` (spec) |
| Small job or bug | `business-analyst` (quick spec) |
| Understanding or porting a system in another stack (Django, Vue, PHP, Java, Go) | `polyglot-engineer` (inventory); `software-architect` for the design |
| "Is it ready", "is it done", delivery | `qa-engineer` → `appsec` → `internal-auditor` → `quality-office` (what the lane requires, see below) |
| Release, server, Docker, CI | `devops-sre` (prepares the package; the CEO does the release) |
| Store copy, brand, user manual, presentation | `marketing`, `tech-comms` |

## Lanes (pick the lightest lane that fits; say which one in one line)

| Lane | Job | Path |
|---|---|---|
| **0** | Chat, question, one-line or obvious fix, rename, typo, config tweak | Main session does it. Show fresh test/build output. No spec, no units. |
| **1** | Small job or bug. No new data model, auth, external call, dependency or user-visible redesign | `spec-hizli` (quick spec, about 10 lines) → CEO signs in chat → one engineer → **one** independent review (`qa-engineer` covers qa and audit together; the maker never reviews). No pre-signature gates, no `delivery-manager`, no `quality-office`. |
| **2** | Medium feature: several files or modules, visible behavior, no new trust boundary | Spec (`spec-tam` or a long `spec-hizli`) → gate: `spec-critic` only. Add `appsec` only if it touches auth, user input, secrets, files or an external call. Add `architecture-board` only for a new dependency or technology. → CEO signs → engineer → `qa-engineer` → `internal-auditor`. `delivery-manager` only if work spans more than one session. |
| **3** | New system, migration, data-loss or security-sensitive change, anything public or paid | Full pipeline: `software-architect` → spec → `spec-critic`, `appsec`, `architecture-board`, `talent-capacity` in parallel → CEO signs → `delivery-manager` → engineer → `qa-engineer` → `appsec` → `internal-auditor` → `quality-office`. |

Escalate a lane when a gate finds a trust-boundary, data or security issue. Never de-escalate to skip a finding. If unsure between two lanes, take the lower one and say the risk in the spec's Assumptions; the gates catch the rest.

**Invariants in every lane (never skipped):**
1. A spec exists and the CEO signed it before code (lane 0 excepted).
2. The maker never verifies.
3. "Done" needs fresh build/test output.
4. The envelope: prod deploy, push/merge to main, store submission, public release, external message, spending money and permanent deletion always need CEO approval, every time.

## Pipeline order (lanes 2 and 3)

1. A spec is written (`business-analyst`; for a large job `software-architect` designs first).
2. Before signature, the gates the lane names run in parallel. Findings are folded into the spec once.
3. Only the CEO signs the spec. No signature, no code.
4. After signature: plan (lane 3: `delivery-manager`; lane 2: the engineer plans inline); `dotnet-engineer`, `react-engineer` or `polyglot-engineer` implements; then the lane's delivery chain.
5. Run the delivery chain once, at the end of the job, not after each task.

## Model and effort by volume

The `model` and `effort` in each agent's frontmatter are the cheap default. Override per call with the Agent tool's `model` parameter. Use the smallest model that can do the unit's job.

| Lane / situation | Default | Escalate to `opus` when |
|---|---|---|
| 0 | Main session as is | Never delegated |
| 1 | `sonnet` for everything | Never; a lane 1 job that needs opus is lane 2 or 3 |
| 2 | `sonnet` for spec, gates, engineer, qa, audit | The gate is `appsec` on auth/crypto/payment code; the engineer is stuck after 2 failed attempts (counts toward the 3-attempt stop) |
| 3 | `opus` for `software-architect`, `business-analyst` (spec), `appsec`, `internal-auditor`; `sonnet` for engineers, qa, delivery, comms | Engineer on a hard algorithm or migration core |
| Any | `haiku` for `talent-capacity`, file listings, mechanical edits, grep-style fan-out (use `Explore`) | Never |

Context: use a fork only when the unit truly needs this conversation. Independent gates (`spec-critic`) read from the file alone, so give them a fresh context and the path, not a retelling. Give each unit the spec path and the exact question, not the whole history. Parallel units go in one message.

## Caveman and terse output

- Main chat: terse mode (`terse-mode.md`), on by default.
- Every brief to a unit ends with: "Report in caveman style: findings and evidence only, no preamble, no recap. Max 25 lines unless the output is a file."
- Unit reports are for the main session, not the CEO: the main session rewrites the result for the CEO in terse Turkish, in full where `terse-mode.md` says terse is off.
- Reviews use `caveman-review` (one line per finding: location, problem, fix). Commit messages use `caveman-commit`.
- Caveman is off for: specs, security findings, legal and compliance text, customer-facing and public text, irreversible-action confirmations, and whenever the CEO is confused or says "explain". Files written to disk (specs, plans, evidence) are written plainly, not in caveman.

## Reminder

To say done, show fresh build/test output. The default stack is .NET + React but it is a preference, not a restriction; if a spec names another stack, work in it. The signature gate and the guard are enforced only in projects set up with `harness/bin/install-project.sh`; in other projects follow the same pipeline by instruction and get the spec approval from the CEO in chat.
