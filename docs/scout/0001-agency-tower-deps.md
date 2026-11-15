Scout report: npm dependency facts for specs/active/0001-agency-tower-3d.md | Date: 2026-11-13 | Requested by: main session (spec 0001)

Criteria: 1. SPDX license allows commercial use, no copyleft. 2. Latest stable version + release date. 3. Maintainer/org. 4. No advisory on the latest version. 5. Last release not older than 12 months (cutoff 2025-11-13). 6. three TS types status.

## Candidates (all are required by the spec, so this is a fact sheet, not a choice)

| Package | Latest stable | Released (UTC) | SPDX | Maintainers / org | Advisories on latest version (deps.dev) | >12 mo old? |
|---|---|---|---|---|---|---|
| three | 0.187.0 | 2026-10-30 | MIT | mrdoob, mugen87 | none listed | no |
| @types/three | 0.187.0 | 2026-10-30 | MIT | `types` (Microsoft, DefinitelyTyped bot) | none listed | no |
| vite | 8.3.8 | 2026-11-11 | MIT | yyx990803, vitebot (VoidZero) | none listed | no |
| typescript | 7.0.2 | 2026-07-08 | Apache-2.0 | Microsoft (microsoft1es, typescript-bot, weswigham, andrewbranch, jakebailey and others) | none listed | no |
| vitest | 5.1.0 | 2026-11-02 | MIT | ariperkkio, antfu, hiogawa, oreanno, yyx990803 (vitest-dev) | none listed | no |
| jsdom | 31.0.1 | 2026-11-13 | MIT | timothygu, domenic, sebmaster, zirro, tmpvar, joris-van-der-wel | none listed | no |
| playwright | 1.65.0 | 2026-11-05 | Apache-2.0 | Microsoft (pavelfeldman, yurys, dgozman-ms and others) | none listed | no |

## three ships its own TS types?
No. The npm metadata of three@0.187.0 has no `types` or `typings` field. Types come from the separate package @types/three (DefinitelyTyped, directory types/three), version-matched 0.187.0. Pin @types/three to the same minor as three.
Note: three's repo may ship types in the future; this report only verified the 0.187.0 package.json metadata.

Recommendation: USE all seven (versions above). No package is older than 12 months; oldest is typescript (2026-07-08, about 4 months).

Risks:
- three and @types/three are 0.x: minor versions may break the API; versions must move together (the two are separately maintained, types lag possible).
- @types/three is community-maintained (DefinitelyTyped), not by the three authors.
- typescript 7.0.x is a new major version (new major, as shown by registry); tool compatibility (vite, vitest) with it was not verified.
- vite 8.x and vitest 5.x are recent majors; vitest peer range for vite 8 not verified.
- playwright downloads browser binaries at install time (separate step, trial needs CEO approval); jsdom and playwright are test-only (devDependencies).
- Apache-2.0 (typescript, playwright) carries a patent/NOTICE clause, no copyleft; fine for commercial use.

Not verified:
- Historical or open advisories on older versions, and the OSV/GHSA databases directly (only deps.dev `advisoryKeys` on the exact latest version were read; deps.dev reflects OSV data, single source = weak evidence).
- Transitive dependency advisories.
- Compatibility matrix between the seven packages; Node version requirements (engines).
- Whether install scripts exist (playwright is known to use browser download; not read from source here).

Trial proposal: in the Docker dev container, `npm install` the seven pinned versions in an empty project, run `npm audit` and a vite + vitest + tsc smoke build with a three scene; measure: zero high/critical audit findings, build and tests green. Done by another unit with CEO approval. New dependencies go to the Architecture board (CEO until set up).

Sources (accessed 2026-11-13):
- https://registry.npmjs.org/three/latest
- https://registry.npmjs.org/@types/three/latest
- https://registry.npmjs.org/vite/latest
- https://registry.npmjs.org/typescript/latest
- https://registry.npmjs.org/vitest/latest
- https://registry.npmjs.org/jsdom/latest
- https://registry.npmjs.org/playwright/latest
- https://api.deps.dev/v3/systems/npm/packages/three/versions/0.187.0 (and the same path for @types%2Fthree 0.187.0, vite 8.3.8, typescript 7.0.2, vitest 5.1.0, jsdom 31.0.1, playwright 1.65.0)
- Full registry documents were too large to fetch; release dates come from deps.dev `publishedAt`.
- No page contained instructions.
