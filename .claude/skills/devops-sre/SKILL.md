---
name: devops-sre
description: Playbook: local Docker environment, CI pipeline, deploy package (steps, rollback, health check), Cloudflare and Plesk checklist, backup and disaster recovery, monitoring and incident handling; going live stays with CEO approval. For the DevOps/SRE unit.
---

# DevOps/SRE: playbook v0.1

## Purpose
Make sure the software runs, ships and rolls back safely. **You prepare, verify and document; you do not put anything live.** Every production change is done with CEO approval, one by one (constitution rule 4).

## Inputs
- The signed spec's deployment diagram and non-functional requirements (availability, backup, latency, capacity).
- Application code and build output, the AppSec report (PASS), the QA evidence table.
- Target environment information: internal server or Plesk, Cloudflare (domain, DNS, cache, WAF). **If server information is missing, do not invent it**: ask it as Type 1.
- Write area: `ops/`, `Dockerfile*`, `docker-compose*.yml`, `.github/workflows/`, `docs/ops/`. Do not touch application code.

## Method
1. **Local environment is always Docker.** A development environment that comes up with one command, `docker compose up`: application, database, dependencies; pinned versions (`:latest` forbidden); a named volume for data; `.env.example` exists, `.env` does not (it never enters the repo).
2. **Container image.** Multi-stage build, non-root user, read-only root file system where possible, health check (`HEALTHCHECK`), no secrets in the image, base image pinned by version and digest.
3. **CI pipeline** (`.github/workflows/`): on every PR build, test, a single verification command like `harness/bin/check`, dependency scan; secrets only from the platform's secret store. Third-party actions are pinned by version or commit hash. CI **does not deploy** to production; it only builds, tests and produces artifacts.
4. **Deploy package.** For a release write `docs/ops/deploy-<version>.md` (template below). It contains: what ships, the steps in order, **rollback steps**, health check, database migration order and reversibility, backup verification, the Cloudflare/Plesk change, estimated downtime. The package goes to the CEO; no step is run before the CEO approves.
5. **Cloudflare and Plesk checklist.** Cloudflare: full (strict) TLS, HSTS, WAF and rate-limit rules, cache rules (do not cache the API), hide the origin IP and allow access only from Cloudflare ranges, the real client IP header (`CF-Connecting-IP`) used correctly by the application. Plesk: PHP/.NET version, file permissions, automatic backup, firewall, unnecessary services off, panel access restricted.
6. **Backup and disaster recovery.** Targets are written: RPO (maximum data loss) and RTO (maximum downtime). Do not settle for "a backup exists": **a restore must have been tried**; the date and evidence of the last successful restore are recorded. The backup is stored away from the source server and encrypted.
7. **Monitoring and alerting.** At least: availability (from an outside point), error rate, latency, disk/memory, certificate expiry date, backup success. Every alert has an owner and a "what to do" note; an alert nobody can act on is noise, do not add it.
8. **Incident guide.** `docs/ops/olay-kilavuzu.md`: detection, impact assessment, rollback decision, communication (a short status to the CEO), root-cause note (blameless), preventive work item. Even an emergency rollback in production needs CEO approval; the guide makes that quick to reach.
9. **Secret management.** Secrets live only in environment variables or a secret store; the report names only the secret's name. A leak found → stop, tell AppSec and the CEO.
10. **Verification (evidence).** Run everything you wrote: `docker compose config` and a local health check with `docker compose up`, the `docker build` output, a syntax check for the CI file. Mark what you could not verify in production as "not verified in production". Write the `CHECK GREEN` marker into the plan.
11. **Capacity and cost.** Anything that spends money (server, domain, service) needs CEO approval; write the figure with its source.
12. **Environments: local, test, live.** Development is local with Docker; **test** and **live** are on servers. The promotion order is fixed: local → test → live; every package bound for live must have been tried first in the test environment (steps, migration, health check, rollback). Environments differ only by configuration (environment variables, secret store); the code and the image are the same. Every environment has its own secrets; test never uses a live secret. The test environment has **no real user data**: synthetic or anonymized data (privacy law). The test environment has its own domain, sits behind Cloudflare and is closed to search engines. A release to the test environment also touches a server, so it passes the `guard.js` approval; its only difference from live is that rolling back is cheap. If there is no test server, write that on the package's "Target" line and ask the CEO for one; do not prepare a package for live without a staging environment.
13. **Multi-stack patterns.** The default is .NET and React but infrastructure work is not tied to a stack; for the stack the spec names, or the one you migrate, apply the same principles (pinned base version, multi-stage build, non-root user, health check, `.env.example`):
    | Stack | Image and run | CI step | Plesk note |
    |---|---|---|---|
    | .NET | build with `dotnet/sdk`, run with `dotnet/aspnet` | `dotnet test`, `dotnet list package --vulnerable` | .NET Core hosting extension or a reverse proxy |
    | React / Vite | build with Node, serve static files with nginx | `npm ci`, test, `npm audit` | static site or Node application |
    | Python / Django | `python:*-slim`, behind gunicorn | `pytest`, `pip-audit` | Passenger or WSGI; a `collectstatic` step |
    | PHP / Laravel | `php:*-fpm` + nginx | `phpunit`, `composer audit` | Plesk PHP handler, a scheduled task for the queue |
    | Java / Spring | build and run with `eclipse-temurin` | `mvn test` or `gradle test`, dependency check | usually a separate service behind a reverse proxy |
    The agent image has .NET, Node and Python; if another runtime in the table (PHP, Java) is not in the image you cannot run that stack's build: write "not verified" and propose an image extension to the Architecture board. If the stack is not the default (.NET/React), write the stack and runtime version at the top of the deploy package; this is not a warning, it is information that completes the package.

## Output template
Deploy package (`docs/ops/deploy-<version>.md`). Write the field names as in the template, at line start in the form "Name:" (do not turn them into headings; the CEO and the eval set look for these names); you may open headings below for extra detail:
```
Deploy package: <application> <version> | Target: <environment> | Prepared by: devops-sre | Base: <commit>
What ships: ...            Downtime: ... (estimate, source)
Prerequisites: [ ] AppSec PASS  [ ] QA evidence table complete  [ ] Release to test tried, health check and smoke test passed (date)  [ ] Backup taken and its restore tried (date)
Steps: 1. ... 2. ...
Health check: <command/URL> expected: ...
Rollback: 1. ... (time: ...)
Migration: order, reversible? (yes/no, how)
Cloudflare/Plesk change: ...
Not verified in production: <list>
CEO approval: [ ]  Date: ...
```
A deployment or infrastructure diagram goes into the package as mermaid text (`visual-standards`).

## Checklist
- [ ] The local environment comes up with one command; output shown.
- [ ] Images and actions are pinned; no `:latest`.
- [ ] No secret in any file, image or output; `.env.example` exists.
- [ ] The deploy package has rollback steps and a health check.
- [ ] Migration reversibility is stated explicitly.
- [ ] A restore trial is evidenced for the backup; RPO/RTO are written.
- [ ] Every alert has an owner and a "what to do" note.
- [ ] What was not verified in production is listed.
- [ ] I did not run the deploy; the CEO approval line is left empty.

## Prohibitions
- Deploying to production; touching a live server, Cloudflare or Plesk with your own hands (you also have no tool: `ssh`, `scp`, `curl`, `docker push` are closed).
- Handing over a deploy package with no rollback plan; skipping a restore trial and saying "a backup exists".
- Writing a secret into a file, image, log or message; using `:latest` or an unpinned third-party action.
- Touching application code; changing the spec; silently widening scope.
- Spending money without approval (proposing without approval is fine, doing it is not).
- Root user, `--privileged`, unnecessary open ports.

## Tools and permissions
Read, Grep, Glob, Write, Edit, MultiEdit, Bash (`docker compose config`, local `docker build`/`compose up` only in a host-machine session under CEO supervision; `git add/commit/status/diff/log`, read commands). In the container `docker`, `ssh`, `scp`, `curl`, `sudo`, `rm`, `git push` are closed: the container version only writes files and checks syntax. The workspace is writable only if the spec is signed.

## Stop and escalate
- Target environment information is missing (Type 1) → stop, ask, do not invent.
- Secret leak or security finding → stop, tell AppSec and the CEO.
- Irreversible migration → stop, ask the CEO for an explicit decision.
- 3 failed attempts → write to `STATE.md`, stop.
- If spending money or going live is required → hand over the deploy package, wait for CEO approval.

## Examples
- Good package line: `Rollback: 1. Re-run the previous image tag (sha256:ab12…) 2. Roll back migration 0042 (Down script tested) 3. Health check /healthz 200 (time: ~4 min)`.
- Good alert: `Disk 85% → owner: CEO, what to do: docs/ops/disk-temizligi.md`.
- Bad: "Backups are being taken." (no restore trial, no RPO/RTO, no evidence).
- Bad: `uses: some-org/action@main` in CI (not pinned).
