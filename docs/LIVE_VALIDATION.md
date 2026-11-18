# Live validation — 2026-11-18

Status: **transport-only live check. The plugin's state and observation
contract was not exercised on physical hardware.**

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

The close frame is the exact live behavior the plugin's host transport surfaces
as a disconnect. `plugin.js` maps any `close` event to `E64 connection closed`
and calls `reportDisconnected()`; that path is consistent with the observed
frame, but the host transport, not the plugin, decodes the code/reason.

The database export does not contain a live `RequestDriverState` response. The
`grind_log.grind_ddd` range is supporting context for the "opaque ddValueDum"
decision, not a substitute for the missing state capture.

## What was not confirmed

The plugin needs a WSS bearer token in `TokensJson`. No usable token could be
minted without changing the device:

- `GET /login.php` auto-creates an Owner session because the
  `Role.Owner.LoginData` row is present and empty.
- `POST /rest_api/login` with `{"userRole":"Owner","password":""}` returns
  HTTP 400 `Wrong password!` on the same unit.
- The `login.php` response header is the literal
  `Authorization: Bearer $sessionToken` (single-quoted PHP string), so the UI
  path does not deliver a token either.

No password was guessed, no password was set, and no token was obtained.
Consequently:

- `RequestDriverState` was never executed with a valid token;
- `ddValueDum`, `ddSensorFailed`, `grindState`, `fan1TachoRpm`, `ntc1*`,
  `ntc2*` and the diagnostics payloads remain uncaptured on physical hardware;
- the "501 ddValueDum" observation rule and the `fan1TachoRpm` non-RPM caveat
  remain static/QEMU claims, not physical measurements;
- issue #9 remains open.

This matches the repository's existing boundary: the VM integration is real,
but it is not a physical capture.

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
`mahlkoenig-e64ws-local-research/docs/LIVE_VALIDATION_2026-11-18.md`. No
credential, token, session cookie, serial number or MAC address is included
there.
