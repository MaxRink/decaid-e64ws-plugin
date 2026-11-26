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
curl -s https://api.github.com/repos/actions/checkout/git/ref/tags/v7.0.1 | grep sha
```

## Current pins

This repository has exactly one npm dependency and no containers, no Python
requirements and no Gradle build, so Dependabot's `npm` and `github-actions`
entries are the complete surface.

| Dependency | Pinned | Latest stable | Status |
| --- | --- | --- | --- |
| `@playwright/test` (dev) | 1.65.1 | 1.65.1 | up to date |

`package-lock.json` (lockfileVersion 3) resolves the single dev dependency tree —
`@playwright/test` 1.65.1 → `playwright` 1.65.1 → `playwright-core` 1.65.1 — all
at the current release, so the lockfile does not hold anything back either.

## GitHub Actions

Every action is pinned to a full 40-character commit SHA, not a moving tag. Each
SHA below was confirmed to be the commit the newest release tag points at.

| Action | Pinned SHA | Release | Status |
| --- | --- | --- | --- |
| `actions/checkout` | `3d3c42e5…` | v7.0.1 | up to date |
| `actions/setup-node` | `949feb24…` | v7.1.0 | up to date |
| `actions/upload-artifact` | `cf430e03…` | v7.0.2 | up to date |
| `actions/download-artifact` | `9000827c…` | v8.0.2 | up to date |
| `subosito/flutter-action` | `1a449444…` | v2.23.0 | up to date |

## Deliberately held

Nothing. Neither Dependabot pull request in this repository was closed without
being merged — both arrived and both are reflected above — so there is no
suppression in `.github/dependabot.yml` and there should be none. If a future
closure is a decision rather than an accident, it belongs here with the registry
version that was not adopted.

## The 2026-11-26 audit

The audit that produced this file found no outstanding upgrade. The two
Dependabot PRs this repository has received were both merged:

| PR | Dependency | From | To | Outcome |
| --- | --- | --- | --- | --- |
| #13 | `@playwright/test` | 1.64.0 | 1.65.1 | merged |
| #8 | the github-actions group (4 updates) | various | see table above | merged |

Both are still current, so there was nothing to supersede and nothing to apply.

## Test counts at the time of the audit

The repository's own suites, run against this checkout:

| Command | Result |
| --- | --- |
| `npm test` | 94 pass, 0 fail, 0 skipped |
| `node --test test/sim-e2e.test.mjs` (`npm run test:sim`) | 20 pass, 0 fail — needs `E64_SIM_ROOT` |
| `npm run test:http` | 2 passed |
| `npm run test:ui` | 8 passed |

`npm run test:sim` imports the E64 simulator from the sibling research
repository, so it needs `E64_SIM_ROOT` pointing at a checkout of
`mahlkoenig-e64ws-local-research`, or `E64_SIM_OPTIONAL=1` to skip. Without
either it fails with `E64 simulator not found` — an environment signal, not a
regression, and the reason it is worth writing down here.
