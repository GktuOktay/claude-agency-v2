# Eval set: application-security (playbook v0.1)

## Case 1: String concatenation in a query is a critical finding
Task: `OrderRepository.cs:42` concatenates user input into SQL text. Write a stop B report.
- section: AppSec report
- contains: /Verdict: FAIL/
- contains: /S-01 \[(CRITICAL|HIGH)\]/
- excludes: /Verdict: PASS/
```pass
AppSec report: orders-api | Stop: B (code) | Base: a1b2c3d
Summary: CRITICAL 0 · HIGH 1 · MEDIUM 0 · LOW 0 · INFO 0
Verdict: FAIL
S-01 [HIGH] SQL injection | OrderRepository.cs:42 | Evidence: string concatenation in the query | Impact: data leaks | Recommendation: parameterized query
Not scanned: none
```
```fail
AppSec report: orders-api
Verdict: PASS
The code looks generally safe.
```

## Case 2: Every finding carries evidence
Task: Write a report for code that has three findings.
- contains: /Evidence:/
- at least 2: /\w+\.\w+:\d+/g
- excludes: /probably|I think|might be/i
```pass
AppSec report: x | Stop: B | Base: b
Verdict: FAIL
S-01 [HIGH] Secret in code | Config.cs:10 | Evidence: hard-coded key | Impact: leak | Recommendation: environment variable
S-02 [MEDIUM] CORS open | Startup.cs:55 | Evidence: AllowAnyOrigin | Impact: abuse | Recommendation: allowlist
```
```fail
S-01 [HIGH] There is probably a secret
S-02 [MEDIUM] I think CORS is open
```

## Case 3: No finding is invented for clean code
Task: Write a report for a small piece of code with no vulnerability.
- contains: /Verdict: PASS/
- contains: /Not scanned:/
- excludes: /S-01/
```pass
AppSec report: x | Stop: B | Base: c
Summary: CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0 · INFO 0
Verdict: PASS
Not scanned: runtime configuration (unreachable)
```
```fail
Verdict: PASS
S-01 [INFO] I invented a finding to look productive
```

## Case 4: A mobile token in plain storage and a public build variable are findings
Task: an Expo app stores the refresh token with AsyncStorage at `src/auth/session.ts:18`, and `app.config.ts:9` sets `EXPO_PUBLIC_API_SECRET`. Write a stop B report.
- section: AppSec report
- contains: /Verdict: FAIL/
- contains: /\[(CRITICAL|HIGH)\].*(session\.ts:18|app\.config\.ts:9)/
- contains: /(secure store|Keychain|Keystore)/i
- excludes: /Verdict: PASS/
```pass
AppSec report: rn-app | Stop: B (code) | Base: a1b2c3d
Summary: CRITICAL 0 · HIGH 2 · MEDIUM 0 · LOW 0 · INFO 0
Verdict: FAIL
S-01 [HIGH] Refresh token in plain storage | src/auth/session.ts:18 | Evidence: AsyncStorage.setItem of the token | Impact: readable on a rooted device or from a backup | Recommendation: platform secure store (Keychain/Keystore-backed), cleared on sign-out
S-02 [HIGH] Secret in a public build variable | app.config.ts:9 | Evidence: EXPO_PUBLIC_* ships in the bundle (value not shown) | Impact: anyone can extract it | Recommendation: move it server-side, rotate it
Not scanned: device runtime (no device)
```
```fail
AppSec report: rn-app
Verdict: PASS
Tokens are stored locally, which is fine for mobile.
```
