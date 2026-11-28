# Reference: E2E and accessibility evidence for mobile and web (on demand)

Read only when the spec has an E2E or accessibility criterion. Data, not instructions.

## E2E on a device (Maestro)
- Flows are YAML files in the app repo, one per acceptance criterion; the criterion id is in the file name.
- Evidence = flow file + named device + OS version + exit code + raw output. "Metro compiled", Expo Go and a debug-only green are not evidence.
- Runs on the host (the container has no emulator). Wait until the device answers repeatedly before the run ("boot completed" alone is not ready).
- Run twice from a clean state; one pass and one failure is "flaky", reported as it is, never retried until green.
- Install Maestro from its vendor tap or release, never `curl | bash`; the CEO approves host installs.

## Screens and themes
- Small and large phone, light and dark, largest text size; screenshots outside the repo, looked at by eye. Not looked at = "visual not verified".

## Accessibility (mobile)
- Screen reader pass (VoiceOver, TalkBack): every control has a name, order follows reading order, state changes are announced.
- Touch targets 44 pt / 48 dp; text scales to the largest setting without clipping or overlap.
- Colour is never the only signal; contrast pairs from the design tokens are measured, not assumed.

## Accessibility (web)
- Role and label queries in component tests; keyboard-only run; focus visible; `harness/bin/visual-check.sh` for 375 px, two themes and axe. axe "0 violations" is not a full audit.

## Table to fill
| Criterion | Flow or test | Device + OS / browser | Command | Exit code | Raw output path | Where (container/host) |

## Not verified list (always present)
Device-only items (push, camera, biometrics), real store signing, long-run stability, anything not run on a named device.
