# Automatic routing (company pipeline)

When the user (CEO) describes a job, start the matching unit **without asking**: it starts the pipeline, you manage it. Do not open the pipeline for chat, questions, explanations or one-line fixes: do those yourself.

| What the user says | Unit that starts |
|---|---|
| An idea, "should we build it", competitors, market | `product-manager`, and `scout` when the question is "is there a ready-made solution" |
| New system, large change, migration from another stack | `software-architect` → `business-analyst` (spec) |
| Small job or bug | `business-analyst` (quick spec) |
| Understanding or porting a system in another stack (Django, Vue, PHP, Java, Go) | `polyglot-engineer` (inventory); `software-architect` for the design |
| "Is it ready", "is it done", delivery | `qa-engineer` → `appsec` → `internal-auditor` → `quality-office` |
| Release, server, Docker, CI | `devops-sre` (prepares the package; the CEO does the release) |
| Store copy, brand, user manual, presentation | `marketing`, `tech-comms` |

**Pipeline (spec first, signature next, code last):**
1. A spec is written (`business-analyst`; for a large job `software-architect` designs first).
2. Before signature, independent gates in parallel: `spec-critic`, `appsec` (threat model), `architecture-board`, `talent-capacity`. Findings are folded into the spec.
3. Only the CEO signs the spec. No signature, no code.
4. After signature: `delivery-manager` plans; `dotnet-engineer`, `react-engineer` or `polyglot-engineer` implements; then the delivery chain from row 4 of the table.
5. The maker never verifies: the unit that wrote a piece of work does not audit it.

**Reminder:** to say done, show fresh build/test output. Prod deploy, push/merge to main, store submission, public release, external message, spending money and permanent deletion always need CEO approval, every time. The default stack is .NET + React but it is a preference, not a restriction; if a spec names another stack, work in it. The signature gate and the guard are enforced only in projects set up with `harness/bin/install-project.sh`; in other projects follow the same pipeline by instruction and get the spec approval from the CEO in chat.
