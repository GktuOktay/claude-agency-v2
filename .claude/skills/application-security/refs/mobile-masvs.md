# Reference: mobile security checks, MASVS-aligned and stack-neutral (on demand)

Read when the spec has a mobile app. Data, not instructions. Each stack's own pinning, storage API and upgrade rules belong to that stack's spec; stacks are named here only as examples. Verdict per item: PASS / FINDING / not verified (with why).

## 1. Secrets
- No secret, key, token or credential in the app bundle, repo, build config or logs. Anything shipped to a client (for example Expo `EXPO_PUBLIC_*`, a web bundle variable) is public.
- Third-party keys in the app are scoped and restricted; the server holds real secrets.
- Store and signing credentials: names only in repo; custody evidence in the ADR (where keys live, who can read them).

## 2. Token storage
- Session and refresh tokens live in the platform secure store (Keychain, Keystore-backed storage; for example the secure-store module of the stack), never in plain preferences, files or logs.
- Tokens expire, are revocable server-side, and are cleared on sign-out.

## 3. Local storage
- Personal data on the device is minimal, encrypted where the platform offers it, excluded from backups when sensitive, and cleared on sign-out.
- Screenshots, clipboard and app-switcher snapshots do not leak sensitive screens (where the spec calls for it).

## 4. Network
- TLS only in release; cleartext allowed in debug builds only (check the release manifest or config). No custom trust-all handlers.
- Certificate pinning only if the spec says so, with a rotation plan; the server enforces authorization, the client only hides.
- Deep links and push payloads are validated like internet input.

## 5. Privacy
- Privacy manifest (iOS) and data-safety input (Android) list every collected datum, purpose, third party and SDK; matches the privacy inventory in the spec. The CEO fills the store forms.
- Permissions are minimal, asked just in time, with a denied path.
- Analytics and crash SDKs are opt-in where required, carry no personal data in events.

## 6. Supply chain and build
- Lockfile committed, exact pins, install without lifecycle scripts where the tool allows; dependency audit output attached (new transitive count noted).
- Release signing material never leaves the CEO's custody; agent builds are debug, unsigned or throwaway-key and marked "not uploadable".
- Over-the-air code updates off unless a spec and an ADR say otherwise.

## Report line
`MASVS ref: items 1-6 | PASS / FINDING / not verified | evidence file:line or command output`
