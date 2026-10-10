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

License: GPL-3.0-or-later; the complete text is in `LICENSE`. Protocol and
test behavior is derived from decentespresso/decaid pull request #848, with
the original Decaid attribution retained in `NOTICE`.
