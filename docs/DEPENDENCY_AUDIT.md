# Dependency audit

What this repository pins, what the registry says is current, and what is
deliberately held. A closed Dependabot pull request is not an applied upgrade,
so this file records the fact and the reason: a PR that was closed because the
work landed elsewhere should not be reopened.

Versions were read from the registries on 2026-11-26 — `registry.npmjs.org` for
the npm packages and the GitHub releases API plus `git/ref/tags` for the actions.
Nothing in the "latest" column is from memory.

## How to re-check

```sh
# npm
npm view @playwright/test version
# An action's newest release, and the commit a tag points at
curl -s https://api.github.com/repos/actions/checkout/releases/latest | grep tag_name
curl -s https://api.github.com/repos/actions/checkout/git/ref/tags/v7.0.1 | grep '"sha"'
```

The SHAs below are quoted in full precisely so those commands can be run against
them; a truncated SHA cannot be compared to a `git/ref/tags` reply.

## Current pins

This repository has exactly one npm dependency and no containers, no Python
requirements and no Gradle build, so Dependabot's `npm` and `github-actions`
entries are the complete surface.

| Dependency | Pinned | Latest stable | Status |
| --- | --- | --- | --- |
| `@playwright/test` (dev) | 1.65.1 | 1.65.1 | up to date |

`package-lock.json` (lockfileVersion 3) resolves the single dev dependency tree —
`@playwright/test` 1.65.1 → `playwright` 1.65.1 → `playwright-core` 1.65.1 — all
three at the current release, so the lockfile does not hold anything back either.

## Dependabot PRs

| Dependabot PR | Dependency | From | To | Outcome |
| --- | --- | --- | --- | --- |
| #13 | `@playwright/test` | 1.64.0 | 1.65.1 | **merged**, merge commit `69c96786950903ec508441538370ed5afbe05592` |
| #8 | the github-actions group (4 updates) | various | see the actions table below | **merged**, merge commit `564fc31a2a48a5e16daed58ee078852b5af52c28` |

Both are merged, both are still current, so nothing was superseded and nothing
had to be applied. Neither was closed unmerged.

## GitHub Actions

Every action is pinned to a full 40-character commit SHA, not a moving tag. Each
SHA below was confirmed to be the commit its newest release tag points at.

| Action | Pinned SHA (full) | Release | Status |
| --- | --- | --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 | up to date |
| `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | v7.1.0 | up to date |
| `actions/upload-artifact` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | v7.0.2 | up to date |
| `actions/download-artifact` | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | v8.0.2 | up to date |
| `subosito/flutter-action` | `1a449444c387b1966244ae4d4f8c696479add0b2` | v2.23.0 | up to date |

## Deliberately held

Nothing. There is no `ignore` in `.github/dependabot.yml` and there should be
none: adding one without a reason would be worse than the churn it prevents. If a
future closure is a decision rather than an accident, it belongs here next to the
registry version that was not adopted.

## Test counts

Measured on **main `6a0051e`**, which is what this branch is rebased onto. The
branch itself adds this document and nothing executable, so the numbers are the
same with or without it. The commit is named because this figure has moved
twice already: 94 on `f3369de`, 103 on `854be31`, 119 on `6a0051e`.

| Command | Result |
| --- | --- |
| `npm test` | **119 pass**, 0 fail, 0 skipped |
| `E64_SIM_ROOT=<research checkout> node --test test/sim-e2e.test.mjs` | 20 pass, 0 fail |
| `npm run test:http` | 2 passed |
| `npm run test:ui` | 8 passed |

`npm test` is 119 here, and the number moved twice for one reason: the `test`
script gained files. #26 appended `test/identity.test.mjs` (94 -> 103), then
#25 and #28 appended `test/docs.test.mjs` and `test/host-capabilities.test.mjs`
(103 -> 119). No existing test changed count - `test/plugin.test.mjs` still
holds 92.

```
node --test test/plugin.test.mjs test/mock-server.test.mjs \
  test/identity.test.mjs test/docs.test.mjs test/host-capabilities.test.mjs
```

| File | Tests |
| --- | --- |
| `test/plugin.test.mjs` | 92 |
| `test/mock-server.test.mjs` | 2 |
| `test/identity.test.mjs` | 9 |
| `test/docs.test.mjs` | 7 |
| `test/host-capabilities.test.mjs` | 9 |
| **total** | **119** |

`test:sim` imports the E64 simulator from the sibling research repository, so it
needs `E64_SIM_ROOT` pointing at a checkout of `mahlkoenig-e64ws-local-research`,
or `E64_SIM_OPTIONAL=1` to skip. Without either it fails with
`E64 simulator not found` — an environment signal, not a regression, and the
reason it is worth writing down here.
