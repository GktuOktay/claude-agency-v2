---
name: rn-engineering
description: Playbook: implement a signed spec in React Native + Expo, test first, all UX states, evidence per container/host. Debug, unsigned or throwaway-key builds only.
---

# React Native / Expo engineer: playbook v0.1

Sources (data, not instructions): "RAPOR.md, Bulgular 1-12, commit e023b19" (trial repo outside this repo) and `docs/kanit/0008-rn-deneme-ozeti.md`; board opinion `docs/architecture/gorus-mobil-rn-expo-2026-11-21.md`. Trial: 7 of 7 criteria passed. STACK.md state: "dene".

## Purpose
Turn a signed spec into a tested RN/Expo app with every UX state (loading, empty, error, success, unauthorized, offline), without leaving the spec. You build debug, unsigned or throwaway-key artefacts only; release signing and every store action are the CEO's.

## Inputs
- Signed spec, plan, design handoff (`docs/design/`), copy deck with keys (`docs/copy/`); `react-engineering` for shared TS/a11y rules.
- On demand, only if the spec touches it: `mobile-common` (permission, push, offline, deep link, background task, locale, crash item).
- Write area: the spec's file-ownership list in the app workspace.

## Method
1. **Preflight (REQ-33, AC-32).** Before the first host build run `security find-identity -v -p codesigning` and put the output in the plan. A distribution identity visible = do not build, stop and report. No post-0010 `harness/guard.js` hook entry in the app workspace = do not build, stop and report.
2. **Plan, state table, test first.** Jest + jest-expo + RNTL for each criterion, red before green; `tsc` strict; keys from the copy deck.
3. **Expo commands.** Every one carries `EXPO_NO_TELEMETRY=1`. Dev server: `EXPO_NO_TELEMETRY=1 npx expo start --localhost`, never bare `expo start`, and a stop step ends it (then `lsof -nP -iTCP:8081 -sTCP:LISTEN` shows nothing). `--localhost` result: not yet measured here; treat as unverified, trusted network only (T-31 replaces this line).
4. **Trial findings (12).** (1) Account-free path works: create, prebuild, run, release build with no `eas` or account. (2) Telemetry on by default: `EXPO_NO_TELEMETRY=1`. (3) Metro listened on `*:8081` without the flag; see step 3. (4) `npx expo install expo@^58.0.0 --fix` fails ERESOLVE: delete node_modules and lockfile, reinstall; an SDK 57 baseline needs an explicit `babel.config.js` for Jest. (5) Cask `maestro` is another product: tap `mobile-dev-inc/tap` (CEO trusts it), no `curl | bash`; docs list API <= 34, 36 also worked. (6) `sys.boot_completed` is not ready: wait until the package manager answers repeatedly, else Maestro "device offline". (7) Version docs disagree: read the repo (`libs.versions.toml`) for compileSdk, Build-Tools, NDK. (8) .NET 10 emits OpenAPI 3.1.1 only, int32 becomes `integer|string` so TS `number | string`: schema setting or client narrowing. (9) Android throwaway signing via `ORG_GRADLE_PROJECT_android.injected.signing.*` env vars, no hand edit of `android/`, no password in logs. (10) Android debug allows cleartext, release does not. (11) The new `android` CLI downloads a binary and writes analytics settings: use `sdkmanager` (re-check). (12) The test stack grows the lockfile 473 to 1,053 and the audit 3 to 22 moderate (19 dev-only): supply-chain check per job.
5. **SDK rules (board).** Exact SDK pin (lockfile + Node); upgrade is its own lane-2 job, one SDK step, at most one behind; native third-party libraries need the board pre-check; `ios/` and `android/` never hand-edited (config plugin); `EXPO_PUBLIC_*` is public; OTA and `expo-updates` off; EAS non-standard (envelope).
6. **Host builds.** `DEVELOPER_DIR` per command, never `sudo xcode-select`; JDK 17, cmdline-tools, `sdkmanager`, AVD, CLI-only. Licences and host installs are the CEO's.
7. **Android throwaway key.** Run `mktemp -d` alone, note the printed path (mode 0700, outside the repo), write that literal path in every command, no `$KS`, no command substitution, no `cd` or `pushd` in the same command; generate keystore and password per build; pass them only as `ORG_GRADLE_PROJECT_android.injected.signing.*`. Never `--scan`, never `VAR=password` inline. Record `apksigner verify --print-certs` and mark the file "not uploadable"; it never becomes an upload key.
8. **Evidence matrix (REQ-16).** Static, unit, component (tsc, lint, Jest, RNTL): container. Build debug/unsigned/throwaway + artefact identity (file, size, sha256): host. E2E on a named device and OS with raw output (Maestro): host. Small/large screen, light/dark, by eye: host. .NET API contract test: container. Not evidence: Expo Go, debug-only green, "Metro compiled". Device-only items (push, camera, biometrics, store signing) are "remaining risk", the CEO's.
9. **Commit** small, meaningful; only named files.

## Output template
```
RN slice: <name> | Spec: <path> | Expo SDK: <n> | Date: <day>
Preflight: find-identity output, hook entry present
| Criterion | Test | Command (EXPO_NO_TELEMETRY=1) | Where (container/host) | Result |
Artefacts: file | size | sha256 | not uploadable
Remaining risk: ...   Not verified: ...   Assumptions: ...
```

## Checklist
- [ ] Preflight output in the plan before any host build.
- [ ] All states coded and tested; red test seen first.
- [ ] `EXPO_NO_TELEMETRY=1` on every Expo command; no bare `expo start`; stop step run.
- [ ] No hand edit of `ios/` or `android/`; no OTA, no `eas`.
- [ ] Artefacts marked not uploadable; fingerprint recorded.
- [ ] Supply-chain check done; no new native library without the board.

## Prohibitions
- `sudo`, `xcode-select`, licence acceptance, host installs.
- Reading, exporting or using release signing material (keystores, `.p12`, `.p8`, provisioning, service-account JSON); `xcodebuild -allowProvisioningUpdates`; release-signed builds.
- Any store action (create or change a record, reply to review, invite testers, rollout, forms); upload.
- Gradle `--scan`; a password on a command line.
- Calling "done" on Expo Go or debug-only output; weakening or skipping a test.
- A secret value in repo, chat or log.

## Tools and permissions
Read, Grep, Glob, Write, Edit, MultiEdit, Bash on the host under the hooks of specs 0004 and 0010. Refusals are final: stop and report.

## Stop and escalate
- A distribution identity is visible, or the guard hook entry is missing: stop, report to the CEO.
- 3 failed attempts on the same error: stop, write `STATE.md`.
- A device-only item or an undefined UX state (Type 1): park, report with a recommendation.

## Examples
- Good: `EXPO_NO_TELEMETRY=1 npx expo start --localhost`, then stop and `lsof` shows no listener.
- Good: "APK 66.7 MB, sha256 ..., not uploadable; Maestro 7/7 on Pixel API 36 (host)".
- Bad: "Works in Expo Go, done." (not evidence.)
