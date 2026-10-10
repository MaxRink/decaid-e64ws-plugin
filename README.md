# Mahlkönig E64 Decaid plugin

Read-only external `type: grinder` plugin for E64 devices exposing the local
WebSocket protocol. It is based on the closed Decaid #848 implementation and
uses the current runtime-v2 Grinder contract.

The plugin registers one host-selected Grinder per configured instance. It
publishes only the generic Grinder state (`idle`, `grinding`, `error`, or
`unknown`); vendor responses from `RequestDriverState`, `RequestDriverConfig`,
`RequestNachineInfo`, and `RequestLogMessages` are available through the
diagnostics surface. There are no motor, grind-setting, RPM, calibration, or
GBS writes. Configure `InstancesJson` and secure `TokensJson` in the plugin
settings. `pollMs` defaults to 1000 and may be set to 0 to disable polling.

`ws` is intended for a trusted network or simulator. `wss` uses the platform
trust store; the plugin deliberately has no self-signed certificate bypass.
The automated tests use a fake host transport; there is no real loopback
simulator in this package and no hardware validation claim. Multiple instances have independent sockets and protocol state,
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

License: GPL-3.0-or-later; the complete text is in `LICENSE`. Protocol and
test behavior is derived from decentespresso/decaid pull request #848, with
the original Decaid attribution retained in `NOTICE`.
