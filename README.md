# Mahlkönig E64 Decaid plugin

[![CI](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml)

Read-only external `type: grinder` plugin for E64 devices exposing the local
WebSocket protocol. It is based on the closed Decaid #848 implementation and
uses the current runtime-v2 Grinder contract.

The plugin registers an independent Grinder device for each configured instance. It
publishes the generic Grinder state (`idle`, `grinding`, `error`, or
`unknown`) and a read-only setting observation; vendor responses from `RequestDriverState`, `RequestDriverConfig`,
`RequestNachineInfo`, and `RequestLogMessages` are available through the
diagnostics surface. There are no motor, grind-setting, RPM, calibration, or
GBS writes. Configure `InstancesJson` and secure `TokensJson` in the plugin
settings. `pollMs` defaults to 1000 and may be set to 0 to disable polling.

The setting comes only from a `RequestDriverStateResult` containing a
nonnegative safe-integer `ddValueDum` and an explicit `ddSensorFailed: false`.
It is published as the opaque string `501 ddValueDum`, for example. This retains
the device's raw coordinate without presenting it as a calibrated display value,
particle size, recipe target or physical dose record. No conversion to micrometres
is performed. Missing or invalid values clear the observation on the next state
response. Each reading expires after five seconds, including with polling
disabled; diagnostics retain their labelled last-known copy. A successful new
state read refreshes that window independently for each instance. Configuration
reads do not refresh it.

Native `grindState` takes precedence over legacy `state`/`status`/`mode` aliases;
unrecognized state values remain `unknown`, and `grindFailure: true` reports
`error`. No grinder RPM observation is declared: cooling-fan tachometer values
are not grinder motor RPM. The field mapping is based on static protocol evidence,
not a physical capture. Comparing the raw setting with the actual firmware and
display, establishing its calibration/units, and any future grinder-RPM mapping
remain hardware-validation work tracked in issue #9. No private research source,
firmware code, device capture or credentials are included in this package.

`ws` is intended for a trusted network or simulator. By default, `wss` uses the platform
trust store. An instance may explicitly set `"tlsTrust": "tofu"` with `"scheme": "wss"`
to use Decaid's host-managed certificate trust. This requires a host exposing
`context.transport.openStoredIdentity`; older hosts are rejected before any connection
is opened, with no automatic downgrade to ordinary TLS.

Approve the device certificate in Decaid's native plugin trust settings before
reconnecting. Verify that the endpoint is your grinder. The host keeps trust
scoped to this plugin and endpoint, blocks a changed certificate, and provides
a dedicated reset button. Reset only after verifying an intentional device or
certificate change. The URL token is withheld until the host has checked the
actual connection's certificate. Trust failures show safe next steps without
repeating tokens, URLs or native error text. This development feature depends
on the accompanying Decaid #979 implementation; it is not supported by stable
0.8.8 and has not been validated on real E64 hardware.
The test suite includes a fake host transport and a real loopback WebSocket
fixture. No hardware validation is claimed. Multiple instances have independent sockets and protocol state,
but Decaid currently selects one connected Grinder for workflows.

## Installation

Version 0.3.0 requires a Decaid build containing the read-only Grinder observation
contract from #973, such as revision `bafa9b3f2b90e65334e990b0b9601a9965cf979b`,
in addition to runtime-v2 and validated device surfaces. The stable `0.8.8` release has not been
validated with this plugin and should not be treated as compatible.

Use Decaid's GitHub-release installer for stable installations. Each release
contains one installable ZIP, and its tag matches the manifest version:

```bash
curl -X POST http://decaid-host:8080/api/v1/plugins/install/github-release \
  -H 'content-type: application/json' \
  -d '{"repo":"MaxRink/decaid-e64ws-plugin"}'
```

For development builds, the GitHub-branch installer tracks the public `main`
branch:

```bash
curl -X POST http://decaid-host:8080/api/v1/plugins/install/github-branch \
  -H 'content-type: application/json' \
  -d '{"repo":"MaxRink/decaid-e64ws-plugin","branch":"main"}'
```

The Decaid Plugins screen can also install the ZIP or folder as a local
snapshot. Local installs are not tracked for updates; the GitHub branch and
release paths are the supported update-aware choices.

The repository and release ZIP keep `manifest.json` and `plugin.js` at their
package root, as required by Decaid's plugin package resolver.

CI checks Node 22/24/26 and validates the repository root, generated local ZIP,
and GitHub source archive against Decaid `bafa9b3f2b90e65334e990b0b9601a9965cf979b`
using Flutter 3.44.2.

HTTP API contract checks use the repository mock fixture and Playwright's request
client. They run in Node without launching a browser and do not require E64 hardware:

```bash
npm ci
npm run test:http
```

The HTTP suite covers state publication and transition, live diagnostics, and
rejection of unsupported controls. CI runs it on Node 24 alongside the native
Node matrix. `npm run test:browser` remains a compatibility alias for `test:http`.

The host job also executes this repository's real source through QuickJS against
two loopback WebSocket peers, verifies diagnostics through the host HTTP bridge,
and runs the host's transport, permission and TLS rejection suites. The Linux
app job checks the normal installer, device APIs, error surfacing and lifecycle.
The loader's secure-settings tests and encrypted credential-store persistence
tests cover the storage boundary using synthetic credentials and temporary files.
All of these checks run without hardware. `--no-account` app smoke uses volatile
secure settings; it proves redaction and in-process reload, not secure-token
persistence across an app restart.

License: GPL-3.0-or-later; the complete text is in `LICENSE`. Protocol and
test behavior is derived from decentespresso/decaid pull request #848, with
the original Decaid attribution retained in `NOTICE`.

## Public mock fixture

`tools/e64-mock-server.mjs` is a dependency-free WebSocket fixture for local
and CI checks. It implements the read-only request/reply contract, synthetic
query-token authentication, state changes, disconnects, and malformed
notifications:

```bash
node tools/e64-mock-server.mjs --id one --port 9997 --token token-one
curl -X POST http://127.0.0.1:9997/control \
  -H 'content-type: application/json' --data '{"state":"grinding"}'
```

The fixture is test infrastructure only, not a production E64 emulator. It
does not weaken `wss` certificate validation in the plugin. The Linux CI job
builds the pinned Decaid host, runs it under Xvfb with fresh XDG directories,
installs this public branch through the normal host installer, connects a
pair of synthetic instances and exercises the versioned `scripts/run-dev-smoke.sh`
scenario. It checks state publication, instance selection, diagnostics, unsupported
controls, token redaction, authentication failures, timeouts, malformed messages,
reconnects, settings reload and unload/re-enable. Runtime CI must pass at the
exact installed source revision before these checks count as verified evidence.

## Diagnostics and errors

The diagnostics surface accepts `GET` with the host `deviceId`. With no `read`
parameter it returns last-known observations, which may remain available after
disconnection. Reconnecting starts a fresh observation set. `read=config`,
`read=machineInfo` and `read=logs` require a connected instance and validate the
reply before returning it. Unsupported reads return 400, unknown instances 404,
unsupported methods 405, and disconnected, timed-out or invalid read replies 503.

Responses include `X-E64-Observation-State` (`live`, `last-known`, or `none`).
`live` identifies a successful fresh read; cached observations are always
`last-known`, including while a session remains connected. When present,
`X-E64-Observation-Time` is the plugin receive time of the most recent valid
observation. It is not a vendor timestamp, per-field capture time, or proof
that the value was copied into shot history. Failed, malformed, and timed-out
reads do not advance it; a new session clears it until a valid observation is
received.

A failed initial connection surfaces through Decaid's native device connection
error and the REST `grinderConnectFailed` result. A malformed notification or
polling failure disconnects that instance; stale socket events cannot update a
replacement session. Configuration errors identify the invalid field without
including the token. Secure settings are returned by the host as `isSet` state,
not plaintext. Trust failures remain governed by the host's platform validation;
custom TOFU/pinning/reset support is a separate host proposal.

## Releases

Install the latest [GitHub release](https://github.com/MaxRink/decaid-e64ws-plugin/releases)
through Decaid’s plugin installer. Each release has exactly one flat ZIP with the
manifest, runtime plugin and licence notices. The tag must match the manifest
version. Subsequent releases require a version bump in the manifest, package and
lockfile.

The tag-triggered release workflow reruns the complete repository CI and publishes
the tested archive only after all jobs pass. `npm run package` produces a
deterministic archive under `dist/`; documentation, mocks and CI fixtures remain
in the repository. CI proves synthetic software behavior, not physical hardware
or firmware compatibility.
