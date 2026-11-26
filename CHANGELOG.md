# Changelog

Every release of this plugin, newest first. The version here is the version in
`manifest.json`, and a release tag must be that version with a `v` prefix —
`scripts/package-plugin.py --tag` refuses anything else, so a tag cannot
describe a different build than the one it publishes.

## 0.8.0 — 2026-11-26

A feature release, not a patch: the Local API log path becomes usable rather
than merely present, a failed connect becomes diagnosable stage by stage instead
of one catch-all sentence, and one source tree now cuts two release channels.
Nothing was removed and no setting key moved.

**Upgrading from 0.7.6.** The plugin's display name changes from "Mahlkönig E64"
to **"Mahlkönig WebSocket grinders"**, so it appears under the new name in
Decaid's plugin list, in the settings path and in notifications. Your
configuration is untouched: the manifest id stays `mahlkoenig-e64.reaplugin`,
every setting key is unchanged (`InstancesJson`, `TokensJson`, `PasswordsJson`,
`MintTokens`, `AllowNoPasswordWorkaround`, `AllowControl`, `SyncBacklight`,
`AdjustmentOwner`, `PopulateGrinderRecord`, `LinkWorkflowGrinder`,
`SyncWorkflowGrinder`, `RecordGrindDose`), and every driver id, surface endpoint
and device id is the same, so instances, tokens, passwords and device history
carry over without re-entry. Some setting *labels* now say "Grinder" instead of
"E64" for the same reason as the rename; the keys behind them did not move.

**Two artefacts, one source.** This release is published as two ZIPs cut from
the same commit by `scripts/package-plugin.py --channel`:

| Channel | Artefact | Use it when |
| --- | --- | --- |
| `upstream` | `decaid-e64ws-plugin-0.8.0.zip` | you run `decentespresso/decaid`. It carries no fork-only facility: the plugin never sends `tlsPinSha256`, the manifest ships no top-level `surfaces` block, and the instance description says pinning needs the fork build. |
| `fork` | `decaid-e64ws-plugin-0.8.0-fork.zip` | you run the fork, which honours `tlsPinSha256`, `responseType` and `requestCancellation`. |

The channel is a build-time constant rewritten into `plugin.js`, not a runtime
switch, so a fork-only capability is an explicit artefact rather than a hidden
setting. Install the one that matches your host; both declare the same `api`
endpoints and permissions.

### Added

- **The Local API log path is reachable** (#23). The service already read
  `UseLocalApi` and `ApiTokensJson`, but the manifest declared neither, and the
  host saves settings only through declared keys — `savePluginSettings` rejects
  any other key with `Setting "<key>" not defined in plugin manifest`, and
  undeclared keys are dropped on load — so no install could turn the path on or
  supply a token. `UseLocalApi` is an ordinary enum toggle like `MintTokens`;
  `ApiTokensJson` is a secure string like `TokensJson` and `PasswordsJson`, so
  the Local API token stays in the secret store instead of the ordinary
  preferences. The Local API token is separate from the WSS token.
- **Staged connect diagnostics for every failure stage** (#24, issue #16).
  DNS failure, refused connection, connect timeout, TLS handshake failure,
  certificate verification failure and a pin mismatch each report their own
  stage, expected value and one next step, instead of the single "login request
  failed. Check the Owner password, certSha256 and grinder address." that all of
  them produced before.
- **A diagnostics bundle for a bug report**: `?read=diagnostics` returns
  version, platform, endpoint, a TLS/pin summary including the expected
  fingerprint, the staged steps with timings and the error class;
  `?read=stages` returns the staged log, verbose with `&verbose=1` or
  `"DebugLog": "true"`.
- **`DebugLog` setting** ("Verbose connection diagnostics") to keep the
  underlying error message and code of every stage. Secrets stay redacted at
  both levels.
- **`docs/TROUBLESHOOTING.md`**: every stage mapped to a cause and a remedy,
  with copy-paste `openssl` commands, how to obtain a token, and what to attach
  to a report.
- **An illustrated setup walkthrough**: `docs/SETUP.md`, thirteen numbered
  sections with seven screenshots re-captured from the renamed plugin, plus
  `docs/ASSETS.md`, which records the provenance and redistribution verdict of
  all fourteen committed images and is now enforced by a test that walks
  `docs/assets` recursively.
- **`docs/UPSTREAM_COMPATIBILITY.md`**: the host-facility matrix, every row cited
  at a pinned ref with the command that re-checks it, and the recipe for cutting
  each release channel.
- **A second release channel** (#28), with `PLUGIN_CHANNEL` as the single
  build-time switch; `pinOption()` is the only place a pin can be attached and
  returns nothing on the upstream channel or once the host is known not to
  honour pinning.
- **New gates**: `npm run check:docs`, `test/identity.test.mjs`,
  `test/docs.test.mjs`, `test/host-capabilities.test.mjs`,
  `test/package_channels_test.py` and the `upstream-channel` CI job, which greps
  the pinned upstream ref for `tlsPinSha256`, `responseType` and
  `requestCancellation` and fails once that ref gains any of them.
- **The publish-step tests execute rather than skip**: PyYAML is an explicit dev
  dependency (`requirements-dev.txt`, installed by the `node` CI job before the
  suite), and `PublishStepRuntimeTests` now fails without it instead of quietly
  skipping, so the two tests that run the release's own publish script against a
  stub `gh` cannot stop guarding the pair of archives unnoticed.
- `tools/check-doc-links.mjs` and `tools/capture-doc-shots.mjs`.

### Changed

- **The plugin is now called "Mahlkönig WebSocket grinders"** (#26, supersedes
  #22). The old name said "E64" while one local protocol covers the E64 WS (the
  only model tested on hardware), the E64 TS and the four NG2 GbS models. The
  rename is display-only: the manifest id, driver ids, surface endpoints and
  setting keys are frozen because the host persists settings and devices under
  them, and changing one would cost every install its configuration.
  `docs/NAMING.md` records the decision, the rejected names and what a future id
  change would require. `test/identity.test.mjs` fails if the display name, the
  README title, the emitted strings and the frozen ids drift apart.
- Setting labels that named one model now say "Grinder": instances, session
  tokens, Owner passwords, Local API tokens, and the diagnostics label in both
  drivers and the top-level block. The manifest description now states which
  models are tested and which are untested.
- **The upstream artefact does not ship a top-level `surfaces` block** — no
  Decaid build parses one, so shipping it advertised a setup surface that is
  never rendered. The fork artefact keeps it. Both channels keep identical `api`
  endpoints and permissions.
- **Certificate failure wording was backwards** and is corrected: verification
  ran and failed, so the stage now reads "verification of the grinder's
  certificate failed" rather than "the host did not verify the grinder's
  certificate", in the code, the diagnostics and the troubleshooting table.
- **Pinning is reported as a host property, not an assumption.** Since
  `plugin_manager._performFetch` forwards only `url`, `method`, `headers` and
  `body`, a host that ignores `tlsPinSha256` used to accept a pin without ever
  comparing it. The capability probe now asks with a malformed pin and reports
  `pin-unsupported`; the bundle reports `tls.enforcedByHost` as unknown,
  enforced or not enforced instead of asserting a comparison that never happens.
- **A release now attaches both artefacts.** The publish step verifies the pair
  instead of assuming one archive: each ZIP's entry set, manifest version, its
  own `PLUGIN_CHANNEL` marker against its filename, the contents this tree
  produces for that channel, and the single documented manifest difference
  between the two (`scripts/release_assets.py`). Installation needs the ZIP that
  matches the host, so a release that shipped one while claiming two would have
  made the CHANGELOG wrong.
- `npm test` now runs five suites (plugin, mock-server, identity, docs,
  host-capabilities) instead of two.
- `README.md`: new compatibility section, the upstream/fork install choice, and
  the corrected Local API and log-refresh description (the retry schedule is the
  6-hour idle refresh, bringable-forward by a completed grind but never inside
  the 10-minute minimum interval).

### Fixed

- **The Local API log path is hardened** (#17):
  - Every log request, vendor ZIP and Local API alike, is raced against a 20 s
    deadline and aborts through `AbortController` where the host exposes one, so
    a socket that never answers can no longer leave the status at "downloading"
    forever and starve the reschedule.
  - A Local API refusal now falls back to the vendor ZIP once instead of being
    thrown straight into the failure counter, and a suspended log still probes
    once per idle refresh, so a later success can reset the counter.
  - Statuses are classified — 401/403/409/422/429/503 as unauthorized,
    forbidden, conflict, unprocessable, rate-limited and unavailable — with
    401/403 non-retryable, and `Retry-After` (delta-seconds or HTTP-date, capped
    at one hour) honoured as both the next attempt and a floor a grind-triggered
    attempt cannot jump.
  - Device error text is sanitised before it reaches `lastError`: C0/DEL/C1
    mapped to spaces, zero-width and bidi characters dropped, capped at 120
    characters by code point, with `lastError` itself capped at 160. The queued
    download is caught instead of becoming an unhandled rejection.
- **The connect diagnostics survive hostile input** (#24): `redactForReport` is
  keyed case-insensitively at any length (an upper-cased token and a
  three-character password used to leak), redacts a bare `Basic <base64>` as well
  as a header line, and redacts a PEM block truncated before its END line; every
  embedded host/device string is capped at `DIAG_TEXT_MAX` and every composed
  sentence at `DIAG_MESSAGE_MAX`, so a 100 kB device error cannot produce a
  100 kB notification or bundle.
- **The declared-settings sweep** (#21) replaces an assertion about the ignored
  `hidden` flag: every key the service reads through `jsonSetting()`, a direct
  lookup or `boundSecret()` must be declared in the manifest, and every
  `boundSecret()` key must be secure. It fails naming each key the service reads
  but the manifest omits — exercised against `cb7b9ce`, where `plugin.js` already
  read both Local API keys and the manifest declared neither — so it catches the
  class of defect that made the Local API unreachable above.
- Documentation errors found in review are corrected rather than carried into a
  tag: four citation and measurement errors in the compatibility matrix (the
  invented `hidden`-asserting test, a `surfaces` pin cited at a TLS test line,
  the fork's machine-control route at `:73` instead of `:77`, and an overstated
  "`hidden` appears in no `lib/` file" claim that the measurement contradicts),
  and the ASSETS.md live-diff band, which is now described as examples rather
  than a bound.
