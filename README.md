# Mahlkönig E64 Decaid plugin

[![CI](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml)

Read-only external `type: grinder` plugin for E64 devices exposing the local
WebSocket protocol. It is based on the closed Decaid #848 implementation and
uses the current runtime-v2 Grinder contract.

The plugin registers an independent Grinder device for each configured instance. It
publishes only the generic Grinder state (`idle`, `grinding`, `error`, or
`unknown`); vendor responses from `RequestDriverState`, `RequestDriverConfig`,
`RequestNachineInfo`, and `RequestLogMessages` are available through the
diagnostics surface. There are no motor, grind-setting, RPM, calibration, or
GBS writes. Configure `InstancesJson` and secure `TokensJson` in the plugin
settings. `pollMs` defaults to 1000 and may be set to 0 to disable polling.

`ws` is intended for a trusted network or simulator. `wss` uses the platform
trust store; the plugin deliberately has no self-signed certificate bypass.
The test suite includes a fake host transport and a real loopback WebSocket
fixture. No hardware validation is claimed. Multiple instances have independent sockets and protocol state,
but Decaid currently selects one connected Grinder for workflows.

## Installation

This plugin requires a Decaid build containing the runtime-v2 Grinder contract
and validated device surfaces (the current `main` line, after the work tracked
by Decaid #889/#896 and #949/#962). The stable `0.8.8` release has not been
validated with this plugin and should not be treated as compatible.

The current repository has no release asset. For a tracked installation, use
Decaid's GitHub-branch installer against the public `main` branch:

```bash
curl -X POST http://decaid-host:8080/api/v1/plugins/install/github-branch \
  -H 'content-type: application/json' \
  -d '{"repo":"MaxRink/decaid-e64ws-plugin","branch":"main"}'
```

When a tagged release later publishes exactly one `.zip` asset, the release
installer can be used instead. The tag must match the manifest version after
removing an optional `v` prefix, for example `v0.1.0` for version `0.1.0`:

```bash
curl -X POST http://decaid-host:8080/api/v1/plugins/install/github-release \
  -H 'content-type: application/json' \
  -d '{"repo":"MaxRink/decaid-e64ws-plugin"}'
```

The Decaid Plugins screen can also install the ZIP or folder as a local
snapshot. Local installs are not tracked for updates; the GitHub branch and
release paths are the supported update-aware choices.

The repository and release ZIP keep `manifest.json` and `plugin.js` at their
package root, as required by Decaid's plugin package resolver.

CI checks Node 22/24/26 and validates the repository root, generated local ZIP,
and GitHub source archive against Decaid `af4e99524ad7731dbdb7db4540cd272bc91da038`
using Flutter 3.44.2.

The host job also executes this repository's real source through QuickJS against
two loopback WebSocket peers, verifies diagnostics through the host HTTP bridge,
and runs the host's transport, permission and TLS rejection suites. The Linux
app job checks the normal installer, device APIs, error surfacing and lifecycle.
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

A failed initial connection surfaces through Decaid's native device connection
error and the REST `grinderConnectFailed` result. A malformed notification or
polling failure disconnects that instance; stale socket events cannot update a
replacement session. Configuration errors identify the invalid field without
including the token. Secure settings are returned by the host as `isSet` state,
not plaintext. Trust failures remain governed by the host's platform validation;
custom TOFU/pinning/reset support is a separate host proposal.
