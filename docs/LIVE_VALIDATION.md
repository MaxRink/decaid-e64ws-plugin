# Live validation — 2026-11-18

Status: **read-only live runtime check. The shipped plugin published the
expected state; no action was sent.**

A reachable E64 WS at `https://192.168.200.103/index.php` was probed read-only
to test whether this plugin's assumptions could be promoted from static/QEMU
evidence to a physical capture.

## What was confirmed live

| Check | Result |
|---|---|
| Device identity | `GET/POST /rest_api/get_machine_info` → `{"grinderType":5,"grinderTypeName":"E64 WS","error":""}` |
| Firmware string | UI reports `V01.16 build #24 from 06.08.2026 (custom)` |
| WSS listener | `wss://192.168.200.103:9997/` accepts TLS; same static certificate as 443 |
| TLS certificate | SHA-256 `91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B` |
| No-token heartbeat | `{"ping":true}` → `{"pong":true}` |
| No-token command | `RequestDriverState` / `RequestNachineInfo` → close `1001`, reason `Connection closed` |
| Unknown type/action | close `1001`, reason `Connection closed` |
| Non-JSON text | ignored; the socket stays open |
| Historical DD range | the read-only database export's `grind_log.grind_ddd` values are 854–998, consistent with treating the raw coordinate as opaque rather than a 0–100 display value |
| `RequestDriverState` | `ddValueDum=854`, `ddSensorFailed=false`, `grindState="Idle"`, `overshootWeightGr=0.53696`, `fan1TachoRpm=0`, `fan1Duty=-1`, `ntc2Failed=true`, `setupWizardState="Completed"` |
| `RequestDriverConfig` | the documented field set is present; this unit's load-cell coefficients are `C0=2393.920401128173`, `C1=-0.07834534628643058` (per-device, not the fixture values) |
| `RequestNachineInfo` | returns `grinderType="E64 WS"` and a session id |
| Shipping plugin runtime | loaded in a Node WebSocket harness, published `{"state":"idle","observedSetting":"854 ddValueDum"}`, diagnostics 200 |
| Dev-only reads | `RequestLogMessages`, `RequestAdcConfig` and `RequestConfigManagerSettings` close `1001`, `Connection closed` |

The live state response means the plugin's observation rule would publish
`{"state":"idle","observedSetting":"854 ddValueDum"}`. The plugin itself was not
run, but the input contract it consumes is now confirmed on hardware.

The close frame is the exact live behavior the plugin's host transport surfaces
as a disconnect. `plugin.js` maps any `close` event to `E64 connection closed`
and calls `reportDisconnected()`; that path is consistent with the observed
frame, but the host transport, not the plugin, decodes the code/reason.

## Live plugin run

The shipped `plugin.js` was loaded in a Node VM with a WebSocket transport and
a fresh read-only token (`pollMs: 0`). It connected to
`wss://192.168.200.103:9997/` and published:

```json
{"state":"idle","observedSetting":"854 ddValueDum"}
```

The diagnostics reads `machineInfo` and `config` returned HTTP 200 with the
live responses. No `GrinderAction` was sent and `reportDisconnected` stayed
false.

The harness disabled TLS verification for the self-signed device certificate
(`NODE_TLS_REJECT_UNAUTHORIZED=0`), so this run does not validate the host's
trust-store path; the existing host TLS tests cover that boundary. The Decaid
host transport itself was not used — this was a Node WebSocket harness around
the shipped plugin.

## Clean-token addendum (Owner password set)

The owner later set an Owner password. A normal `POST /rest_api/login` with
`{"userRole":"Owner","password":"…"}` then returned a bearer token, and
`login.php` returned the HTTP 200 login form instead of the passwordless
redirect. The plugin's password-minting path (`MintTokens` + secure
`PasswordsJson`) was run against the live unit: it minted a token, connected,
published `817 ddValueDum`, and both diagnostics reads returned HTTP 200.

The earlier `854` reading and the later `817` reading are the same raw field at
different dial positions; the config was unchanged. The FW-01 no-password
workaround is no longer needed on this unit but remains available behind
`AllowNoPasswordWorkaround` for owner-controlled devices.

The database export does not contain a live `RequestDriverState` response. The
`grind_log.grind_ddd` range is supporting context for the "opaque ddValueDum"
decision, not a substitute for the state capture. The live state response above
is the physical counterpart.

## What was not confirmed

- The normal no-password UI path still does not deliver a token. The live token
  was minted through the documented FW-01 login-construction test (SELECT-only; no
  database row written), not through `login.php` or `rest_api/login` with an
  empty password.
- The Decaid host transport and the platform trust-store path were not
  exercised; the run used a Node WebSocket harness with TLS verification
  disabled. The plugin's state/diagnostics logic was executed and published the
  expected observation.
- The calibration/units/physical meaning of `ddValueDum` remain open; issue #9
  stays open.
- `AddBrewEvent` and all actions were not sent.
- `hasNtc1=false` coexists with a valid NTC1 at 34.32 °C, so it must not be used
  as an NTC1-presence flag.
- The CPU temperature reported `-88.59 °C` with `cpuTempFailed=false`; this is
  recorded as an anomaly.

## Token lifetime and reconnect

The live token was **single-connection**: the first socket served the three
always-on reads, a second socket with the same token closed `1001`, and a
freshly minted token worked. The plugin reuses `TokensJson[id]` on reconnect, so
a real deployment needs a token-refresh mechanism or a connection that stays up.
This matches the existing follow-up in the research `todo.md`.

## Safe next step

With an owner-set password or a short-lived token supplied out of band:

1. Mint a token with `POST /rest_api/login` (do not put it in shell history).
2. Connect the plugin with `pollMs` enabled and a single instance.
3. Record one `RequestDriverStateResult` and one `RequestDriverConfigResult`.
4. Compare `grindState`, `ddValueDum`, `ddSensorFailed`, `fan1TachoRpm`,
   `hasNtc1`/`ntc1Failed` and `hasNtc2`/`ntc2Failed` with the static/QEMU
   expectations in `docs/VM_TESTING.md` and Mahlkönig research
   `RE_ASSUMPTIONS.md`.
5. Keep the machine idle and do not send any `GrinderAction`.

Only after that comparison should the README's "no physical capture" statement
be narrowed.

## Evidence

The full read-only report, including the REST and WSS evidence, is in the
research repository:
`mahlkoenig-grinder-research/docs/LIVE_VALIDATION_2026-11-18.md`. No
credential, token, session cookie, serial number or MAC address is included
there.
