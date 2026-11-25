# Mahlkönig E64 Decaid plugin

[![CI](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/MaxRink/decaid-e64ws-plugin/actions/workflows/ci.yml)

External `type: grinder` plugin for E64 devices exposing the local WebSocket
protocol. It is read-only by default; optional control needs a grinder running
an owner-enabled development image (see [Grinder control](#grinder-control)). It is based on the closed Decaid #848 implementation and
uses the current runtime-v2 Grinder contract.

The plugin registers an independent Grinder device for each configured instance. It
publishes the generic Grinder state (`idle`, `grinding`, `error`, or
`unknown`) and a read-only setting observation; an allowlisted subset of the
vendor `RequestDriverState`, `RequestDriverConfig` and `RequestNachineInfo`
replies is available through the diagnostics surface. Without `AllowControl`
there are no motor, grind-setting, RPM, calibration or GBS writes. Configure `InstancesJson` and secure `TokensJson` in the plugin
settings. For automatic token minting, also set `MintTokens` to `true` and put
the current Owner password in the secure `PasswordsJson`; `TokensJson` entries
may then be empty. The gated `AllowNoPasswordWorkaround` setting can use the
documented FW-01 SELECT-only login construction when no Owner password is set.
`pollMs` defaults to 1000 and may be set to 0 to disable polling. `scheme`
defaults to `wss`; an explicit `"ws"` keeps working for simulators, tunnels and
trusted networks. `host` must be a loopback, RFC 1918, link-local (IPv4
`169.254/16`, IPv6 `fe80::/10`), IPv6 ULA (`fc00::/7`) or `.local` address;
other hosts are rejected so a token or password is never sent off the LAN.

Secure `TokensJson` and `PasswordsJson` entries carry the host they were saved
for: `{"one":{"host":"192.168.200.103","token":"<token>"}}` and
`{"one":{"host":"192.168.200.103","password":"<owner-password>"}}`. The
plugin refuses to load while an entry's `host` differs from the instance
`host` in the ordinary `InstancesJson`, so changing the instance host cannot
redirect a stored secret. After moving an instance, re-enter its secure
entries for the new host. Plain-string entries from 0.4.1 and earlier must be
re-saved in this form.

The setting comes only from a `RequestDriverStateResult` containing a
nonnegative safe-integer `ddValueDum` and an explicit `ddSensorFailed: false`.
It is published as the value the grinder shows on its own display: `ddValueDum`
is in deci-micrometres (0.1 µm), and the HMI converts it to whole micrometres
with `AbstractAgsaDdSensor::ddValueUm()` in `libNgxUi.so` V01.16-24, which
computes `(ddValueDum + 5) / 10` with integer division, rounding halves up.
`827` is therefore published as the bare string `"83"` (82.7 µm), matching the
display on a live unit; `825` gives `"83"` and `824` gives `"82"`. The research
notes record the unit (`Dum` = deci-micrometres, `500 Dum = 50.0 µm`, and the
database migration from 1 µm to 0.1 µm resolution). The HMI's separate
`QmlHelpers::roundToMicrometers` helper truncates instead; it is not what the
grinder displays for this value. The number is the grinder's dial reading, not a
particle size, recipe target or calibrated burr gap, and Streamline's Follow
Grinder reads it as a plain integer. The raw `ddValueDum` stays available in
the diagnostics state view. Missing or invalid values clear the observation on
the next state response. Each reading expires after five seconds, including with polling
disabled; diagnostics retain their labelled last-known copy. A successful new
state read refreshes that window independently for each instance. Configuration
reads do not refresh it.

Native `grindState` takes precedence over legacy `state`/`status`/`mode` aliases;
unrecognized state values remain `unknown`, and `grindFailure: true` reports
`error`. No grinder RPM observation is declared: cooling-fan tachometer values
are not grinder motor RPM. The field mapping is based on static protocol
evidence, QEMU fixtures and a 2026-11-18 physical read pass. That pass reached
an `E64 WS` (`V01.16 build #24`, `custom`), confirmed the HTTPS/WSS transport,
the static TLS certificate and the WSS token gate, and used a normal read-only
token to capture `RequestDriverState`, `RequestDriverConfig` and
`RequestNachineInfo`. The live state returned `ddValueDum=854`,
`grindState=idle`, `overshootWeightGr=0.53696`, both fan tachos `0` and NTC2
absent. The shipped plugin was also run against the live unit through a Node
WebSocket harness and published `{"state":"idle","observedSetting":"854
ddValueDum"}` (the pre-0.4.4 format; now `"85"`); diagnostics `machineInfo` and `config` returned HTTP 200.
Calibration/units and any future grinder-RPM mapping remain
hardware-validation work tracked in issue #9. The live token was
single-connection, so a reconnect needs a fresh token. See
[`docs/LIVE_VALIDATION.md`](docs/LIVE_VALIDATION.md). No private research
source, firmware code, device capture or credentials are included in this
package.

`ws` is intended for a trusted network, tunnel or simulator. `wss` uses the
per-instance `certSha256` pin when set, otherwise the platform trust store; the
plugin deliberately has no self-signed certificate bypass.
The test suite includes a fake host transport, a real loopback WebSocket
fixture, and a real-QEMU integration guide (`docs/VM_TESTING.md`). The plugin
also passes the upstream Decaid host-runtime test. No physical
action or calibration validation is claimed; the 2026-11-18 pass was read-only
and ran the plugin through a WebSocket harness, not Decaid's host transport.
Multiple instances have independent sockets and protocol state, but Decaid
currently selects one connected Grinder for workflows.

## Compatible grinders

The plugin speaks the local API of Mahlkönig's STM32MP15x touch-display
platform: WSS on port 9997 (token from an Owner login on 443) and the
lighttpd/PHP REST routes on 443. Which products carry that API follows from the
published firmware (see the research repo's `docs/FLEET_FIRMWARE.md` and
`docs/FIRMWARE_DIFF_HSG_vs_NG2.md`).

| Grinder | Firmware line | Status |
|---|---|---|
| E64 WS | HSG (`HEM-HSG-HMI-S01`, tested on V01.16-24) | **Supported and tested** on a real unit. |
| E64 TS | HSG (same image; `grinderType` 6) | **Expected to work, untested.** Same firmware and API; the Decaid grinder record is still named "Mahlkönig E64 WS" and gets the E64 burr default, so rename it in Decaid. |
| E65T GbS, E65W GbS, E80T GbS, E80W GbS | NG2 (`HEM-NG2-HMI-S01`, V01.36-2; one image for all four) | **Likely to connect, untested, not supported yet.** NG2 runs the same HMI application family (`NgxUiApp`/`libNgxUi`), the same WSS :9997 server, a byte-identical PHP web root and the same static TLS key, so login, token and pinning should work. Not verified: the individual WSS commands, the Owner password check (NG2 uses its own role check with a different default), the displayed grind value (the plugin assumes the E64's `ddValueDum ÷ 10` scale), and Grind-by-Sync dosing. The plugin also labels the grinder record "E64 WS" with 64 mm burrs. |
| EK Omnia | EKX (`Hemro-EK-Omnia-Firmware`) | **Not compatible.** Same board, different application (`EkxUI`): no JSON WSS API on 9997 and no PHP web app; its only WebSocket is a file service on 9988. |
| X54, X64 SD | none published | **Not compatible.** No local network API on this platform; app/cloud only. |
| E65S GbW, E80S GbW, EK43, K30, Peak, K60, Vario and other non-networked models | none | **Not compatible.** No network interface for the plugin to use. |

The plugin's "Xenia mode" is not a Xenia integration: it lets the E64 treat
Decaid as a Xenia espresso machine for Brew-by-Sync. It does not control a
Xenia.

If you own one of the NG2 grinders, a read-only check helps: open
`https://<grinder>/rest_api/get_machine_info` in a browser (accept the certificate) and
report the `grinderTypeName` together with the plugin's diagnostics page.

## Setup

Open **Decaid > Settings > Plugins > Mahlkönig E64 > Set up** (the plugin's
`setup` page; `ui?view=setup` is an alias for skins). A fresh install, or a
configuration that no longer validates, loads in a "needs setup" state with a
Decaid notice instead of failing, so the assistant is always reachable. It walks
through the grinder's address (local network only), trusting its certificate
(one tap for the standard E64 certificate; any other fingerprint must be
entered and confirmed twice), the Owner password with a test login (at most one
attempt every 3 s, nothing stored until you save), how Decaid and the grinder
work together, optional grinder control, and a review. Saving writes the
existing settings once through Decaid's settings route and then shows the live
status. The raw JSON settings are hidden from Decaid's settings form; the
no-password workaround stays available as an advanced setting and is not offered
by the assistant. Decaid has no network search for plugins yet, so the address
is entered by hand. `GET <diagnostics>?ui=1` shows the diagnostics as a page. Without a `deviceId`
(as the plugin-level diagnostics surface opens it) a single instance is shown
directly; with several the page offers a picker, and a JSON request gets `400`
with the list of `deviceId`s.

## Grind events

When the grinder's state leaves the grind cycle (`Grind`, `GbwPostGrind` and the
manual and timed start states) the plugin records a grind event: completion time
as observed by the plugin, target and result weight, overshoot, motor run time,
the mode (`GbW`/`GbT`, when the grind states showed it) and the displayed setting. The latest 20 per instance are returned by
`GET /api/v1/plugins/mahlkoenig-e64.reaplugin/grind-events?deviceId=<deviceId>`
and appear as `grindEvents` in the default diagnostics view, with no serial
number or session ID.

With `MintTokens`, the plugin reads the grinder's own logs from
`POST /rest_api/download_machine_logs` (pinned, on `restPort`) with its own ZIP,
DEFLATE and CSV reader. From the `GrindLogs` CSV it takes the newest unused row
whose `recipe_amount` matches the observed target (±0.5 g) and whose
`grind_date_time` is within 10 minutes of the observed completion, and adds
`grindUuid`, a `log` block (grind weight, duration, displayed setting from
`grind_ddd`, success) and a `recipe` block (index, UUID, mode, type, dose,
displayed coarseness, brew time and weight). Weights are read in the firmware's
10⁻³ g encoding. This needs a Decaid host whose plugin `fetch` supports
`responseType: "base64"`; on older hosts the plugin detects that once, marks the
log `unsupported-host` and keeps `grindUuid` `null`.

Every download writes a ZIP to the grinder's `/tmp` and checkpoints its SQLite
WAL, so downloads are deliberately rare:

- after a completed grind, at most one download per 10 minutes; grinds in
  between wait for the next download and are matched together;
- otherwise one refresh per 6 hours while connected (the first one 60 s after
  connecting when none ran in the last 6 hours);
- a failed attempt also waits 10 minutes; three failures in a row mark the log
  `suspended`, which only stretches the next attempt to the 6-hour idle refresh,
  so one later success resets the counter without reconnecting;
- every log request is abandoned after 20 s, so a stalled socket cannot leave
  the status at `downloading` or skip the next scheduled attempt.

When the Local API is enabled it is tried first; if it fails, the vendor ZIP
still gets one attempt before the download counts as a failure, and the Local
API reason is the one reported in `lastError`.

Downloads reuse the Owner session the plugin already opened to mint the
connection's WebSocket token. Only when the grinder refuses that session does
the plugin log in once more and retry. The grinder records a `LogIn` service
event for each login, so expect one per connection plus one per download whose
session had expired; the firmware's own session lifetime decides how often that
is.

`GET /api/v1/plugins/mahlkoenig-e64.reaplugin/service-log?instance=<id>` (or
`deviceId=`; optional `after=<event_id>`) returns the `ServiceLogs` rows from the
same downloads in ascending `event_id` order: `id`, `eventTypeId`, `eventType`,
`eventDateTime` and `details`. Serial numbers, IP and MAC addresses, Wi-Fi names
and passwords, session IDs, tokens, long hexadecimal IDs and email addresses are
redacted from the text. Both endpoints report the download status under `log`:
`status` (`ok`, `downloading`, `failed`, `suspended`, `unsupported-host`,
`needs-mint-tokens`, or a Local API refusal - `unauthorized`, `forbidden`),
`lastAt`, `lastAttemptAt`, `lastError`, and the Local API classification
`errorClass` (`unauthorized`, `forbidden`, `conflict`, `unprocessable`,
`rate-limited`, `unavailable` or `failed`), `retryable` and `retryAfterMs`. A
401 or 403 sets `retryable` false, so the log stops attempting until the next
connection rather than counting failures against a token that cannot work; a 429
carries the device's `Retry-After` (delta-seconds or HTTP-date, capped at one
hour) in `retryAfterMs`. `lastError` only ever carries the plugin's own fixed
prefixes, capped at 160 characters: device-supplied error text is truncated to
120 characters, stripped of control characters and redacted like the service
log before it is appended to `local api <route>: `. A rejection from a queued
download is caught, so it can neither surface as an unhandled rejection nor
leave the status at `downloading`. Everything is
held in memory only and bounded: 20 grind events and 500 service rows per
instance. The plugin persists nothing and never keeps the ZIP or the CSV.

## Grinder inventory

With `PopulateGrinderRecord` (default `"true"`) each successful connection keeps
one Decaid grinder record per instance, so stored shots name this grinder:

- The plugin looks for its own record (`extras.source` =
  `mahlkoenig-e64.reaplugin` and `extras.instanceId` = the instance id). Without
  one it adopts an existing, non-archived record whose model contains `E64` and
  that no other plugin owns; otherwise it creates `Mahlkönig E64 WS` (or the
  `E64…` type the grinder reports, never the development-image `Unknown`) with
  `64 mm flat (stock)` burrs, numeric settings and steps 1/10 in the displayed
  micrometres.
- After creation or adoption the record belongs to the user. The plugin never
  changes its model, burrs, notes, steps or archive state, and only rewrites its
  own `extras` (`source`, `instanceId`, `unit`, `deviceId`, `lastSeenAt` at most
  once a day). No serial number or network detail is stored. An archived record
  is left archived and not recreated.
- With `LinkWorkflowGrinder` (default `"true"`) the plugin sets the workflow's
  `grinderId` and `grinderModel` only when the workflow names no grinder, through
  a partial `PUT /api/v1/workflow` that leaves every other field unchanged.

`GET <diagnostics>?read=inventory` reports `status` (`created`, `adopted`,
`linked`, `archived`, `disabled` or `error`), `grinderId`, `model`, `archived`,
`workflowLink` (`linked`, `kept-existing` or `disabled`), `duplicates` (extra records this
instance owns, for example after a reload raced a creation; the oldest is used and
none is deleted) and `lastError`. The
grind-events response includes `grinderId`.

## Shot metadata

Decaid copies the active workflow into each shot when it is stored, so with
`SyncWorkflowGrinder` (default `"true"`) the plugin keeps the workflow's grinder
fields current while this grinder is the workflow's grinder (or links it when the
workflow names none and `LinkWorkflowGrinder` allows it):

- `grinderModel` and `grinderBurrs` follow the Decaid grinder record, read again
  before every write, so your edits to the record win;
- `grinderSetting` follows the grinder's display (for example `"83"`) once the
  reading has been stable for 3 s. A value the plugin did not write, such as a
  planned setting you or another plugin entered, is kept for 10 minutes unless
  the dial moves away from the reading it had when that value appeared.
  Streamline's "Follow Grinder" writes the same value, which needs no write;
- `context.extras["mahlkoenig-e64.reaplugin"]` holds `ddValueDum`,
  `displayedSetting`, `unit` and `lastGrind` (completion time, target and result
  weight, motor run time, and the mode `GbW`/`GbT` when the grind states showed
  it), updated once per completed grind. Decaid's workflow update merges
  `extras` deeply, so other plugins' keys are untouched.

Writes are partial `PUT /api/v1/workflow` calls that contain only the changed
fields. There is at most one every 3 seconds, none while the espresso machine is
pulling a shot, steaming, dispensing hot water or flushing (deferred until it is
done), and none when nothing changed, so plugins reacting to `workflowUpdated`
are not driven into a loop. With `SyncWorkflowGrinder` `"false"` the plugin only
links an empty workflow, as `LinkWorkflowGrinder` did in 0.6.

## Grind dose

`RecordGrindDose` (default `"false"`; the setup page's "Record each grind as the
shot's dose" switch) stores what the grinder actually ground with each shot. It
applies only while this grinder is the workflow's grinder:

- After a grind-by-weight grind (`GbW`) the workflow's `targetDoseWeight` becomes
  the grinder's target, through the same deferred, partial workflow write as the
  setting (so it needs `SyncWorkflowGrinder`). Only a new grind writes it: a
  dose you change afterwards is kept until the next grind. `targetYield` is not
  touched.
- When Decaid stores a shot whose workflow names this grinder and that started
  at most 5 minutes after a grind (or up to 1 minute before it, for clock skew),
  the plugin writes the shot's `annotations.actualDoseWeight` as the ground weight
  (rounded to 0.1 g) and `annotations.extras["mahlkoenig-e64.reaplugin"].grind`
  with `completedAt`, `secondsBeforeShot`, `mode`, `targetWeightGr`,
  `resultWeightGr`, `deviationGr`, `overshootWeightGr`, `portafilterWeightGr`,
  `motorRunTimeMs`, `setting` and, once the grinder log has been read, `grindUuid`,
  `grindDurationMs`, `successful`, `trigger` and `recipe`. A grind the log marks
  as failed is not used.
- `trigger` is how the grind started, as the grinder logs it: `StartButton`,
  `PortafilterSwitch` or `PortafilterDetection`. `portafilterRecognized` is true
  for `PortafilterDetection` (the grinder recognized the portafilter by its
  weight and chose the recipe linked to it), false for the others, and null when
  the grinder's log has no trigger column. `portafilterWeightGr` is the load the
  grinder weighed before grinding, which is the empty portafilter (rounded to
  0.1 g; null when the grinder reported none), so it tells your portafilters
  apart. The grinder's registered portafilter list (id, stored weight and
  tolerance) is only in its database, whose download checkpoints and
  re-permissions the database file, so the plugin does not read it.
- `recipe` is the grinder recipe the grind used: slot `index`, `uuid`, `mode`,
  `type`, `icon`, `amountGr`, `setting` (coarseness in displayed µm), brew time
  and weight, and `gbsEnabled` (Grind-by-Sync). `doseApplied` says whether the
  weighed result is within 0.5 g of the recipe dose, `settingApplied` whether
  the logged setting equals the recipe coarseness (null when the recipe sets
  none).
- The grinder log is read when a grind completes, at most every 10 minutes. When
  it arrives after the shot was stored, the plugin updates only the shot's grind
  block, so a dose you corrected in the meantime is kept.
  The shot start comes from the machine's state stream; the shot record's own
  timestamp is the fallback.

Decaid merges the update into the shot, so other annotations and other plugins'
`extras` stay. The Visualizer plugin uploads a shot 5 s after it ends and sends
later edits as updates, so Visualizer's dose is the ground weight too. The
diagnostics page's "Dose recording" row shows the last result.

## Grinder control

Control is off by default and needs `AllowControl` `"true"`, `MintTokens`, and a
grinder running a development image that its owner has enabled. The plugin
probes this once per load on a separate connection and registers start/stop and
grind-setting control only when the grinder accepts it; a locked grinder stays
read-only. `AdjustmentOwner` (`off`, `grinder` or `decaid`) decides who adjusts
the grind: `decaid` allows grind-setting writes from Decaid, while `grinder` sends
finished Decaid shots to the grinder's grind-by-sync as brew events.
`SyncBacklight` switches the grinder backlight off while the espresso machine
sleeps. `GET <diagnostics>?read=control` reports the probe result and the last
actions. Behaviour, limits and risks are described in
[docs/DEBUG_MODE.md](docs/DEBUG_MODE.md); this repository contains no unlock
instructions.

## Token acquisition

The E64 WSS listener needs a five-minute bearer token. There are three ways to
provide it:

1. **Static token (default).** Put a token in `TokensJson`:
   `{"one":{"host":"<instance host>","token":"<64-hex-token>"}}`. The live token is single-connection; supply a
   fresh one for every reconnect.
2. **Owner password (recommended).** Set `MintTokens` to `"true"` and put the
   device's current Owner password in the secure `PasswordsJson`:
   `{"one":{"host":"<instance host>","password":"<owner-password>"}}`. On each
   connect the plugin calls `POST https://<host>/rest_api/login` and uses the
   returned bearer token. The password is never logged.
3. **No-password workaround (gated).** If the device has no Owner password,
   set `MintTokens` to `"true"` and `AllowNoPasswordWorkaround` to `"true"`.
   The plugin uses the documented FW-01 SELECT-only login construction to mint
   a normal session token. This is an authentication bypass; enable it only on
   an owner-controlled device. The database is not written.

The E64 serves a self-signed certificate, so platform validation fails with
`CERTIFICATE_VERIFY_FAILED`. Set the optional per-instance `certSha256` (64 hex
characters, colons allowed) to pin it: the plugin passes it as `tlsPinSha256`
to the login `fetch()` and the `wss` transport, and the host compares it with
the SHA-256 of the leaf certificate. Without `certSha256` the plugin uses the
host's platform trust store and does not bypass TLS. Hosts without pinning
support ignore the option, so validation then falls back to the platform store.
The E64 serves the same certificate on every unit, with its private key in the
firmware image: the pin proves "an E64 certificate", not this grinder, and is
combined with the private-host restriction above. Do not install the
certificate as a trusted root. Login always uses HTTPS on port 443, the only
E64 REST listener (HTTP 80 redirects), whatever the WebSocket `scheme`. See
[docs/CERTIFICATE_TRUST.md](docs/CERTIFICATE_TRUST.md) for pinned and
owner-LAN options.

A clean Owner-password login was confirmed on 2026-11-18. The live unit served
`ddValueDum=854` in the first session and `817` in a later clean-token session
after the dial moved; the plugin minted a token from the password and published
`817 ddValueDum` (now published as `"82"`).

Dynamic tokens are cleared on disconnect and re-minted on the next connect.
A failed login backs off before the next attempt: 5 s, doubling per failure
up to 5 min, reset by a successful login. A connect inside the backoff window
fails with `login backoff` without contacting the grinder.
`GET <diagnostics>?read=connection` reports `connected`, `tokenSource`,
`lastMintAt`, `lastMintError`, `mintBackoffUntil`, `staticToken` and
`mintTokens`; it never returns the token or password. `lastMintError` is a
fixed category (`login HTTP <status>`, `login returned no bearer token` or
`login request failed`) and never echoes device response text. Static `TokensJson` values are reused, so a static token
must be refreshed manually after a single-connection close.

## Local API v1 (dev-mode devices)

On **dev-mode devices only** (development image where the first word of `/etc/issue` is `development`), the plugin can use the Local Owner HTTP API v1 for more efficient log retrieval. This API provides direct access to SQLite tables without requiring the vendor's ZIP download mechanism.

To enable Local API support:

1. **Deploy the Local API module** to the device using `e64root api deploy` (see [mahlkoenig-e64ws-local-research/docs/LOCAL_API.md](https://github.com/MaxRink/mahlkoenig-e64ws-local-research/blob/main/docs/LOCAL_API.md))
2. **Configure the plugin**:
   - Set `UseLocalApi` to `"true"` in the plugin settings
   - Put the owner token in `ApiTokensJson`: `{"one":{"host":"<instance host>","token":"<local-api-token>"}}`

The Local API token is **separate** from the WSS token. It authorizes read-only access to:
- `grind_log` - grind history with recipe data
- `service_log` - event/service log
- `alert_log` - alert history
- `portafilters` - portafilter calibration data
- `recipes` - recipe definitions
- `settings` - machine settings (redacted)
- `config` - machine configuration (redacted)
- `file` - whitelisted file access
- `ws_token` - fresh WSS token minting

When `UseLocalApi` is enabled and a valid token is configured, the plugin will:
- Use Local API endpoints for grind log and service log retrieval
- Fall back to the vendor's `download_machine_logs` ZIP if Local API is unavailable
- Continue using the standard WSS connection for real-time state updates

**Security notes:**
- Local API requires both a vendor REST session AND the owner token
- Sensitive data (Wi-Fi passwords, role credentials, cloud URLs) is redacted by the Local API module
- The Local API is **read-only** - no motor, calibration, or state-changing actions are exposed
- Only works on dev-mode devices

See [mahlkoenig-e64ws-local-research/docs/LOCAL_API.md](https://github.com/MaxRink/mahlkoenig-e64ws-local-research/blob/main/docs/LOCAL_API.md) for the full API contract.

## Xenia mode

The plugin can present the Decaid host as a local **Xenia** to the E64's stock
M2M client. The E64 calls `http://<host>/api/v2/*` on port 80, so a small
host-side sidecar (`tools/xenia_bridge.py`) forwards those routes to the plugin
endpoints. No E64 root or firmware change is involved; only the M2M host field
changes. `scripts/execute` is acknowledged but does not start a brew. Brew
ratio and script state are kept per instance; with several instances, run one
bridge per E64 with `--instance <id>`.

See [docs/XENIA_MODE.md](docs/XENIA_MODE.md).

## Installation

Version 0.7.6 requires a Decaid build containing the read-only Grinder observation
contract from #973 and the plugin `notifications` permission (#1003), and tracks upstream Decaid
`main` (verified against `1d74fbf7` on 2026-11-23), in addition to runtime-v2 and validated device
surfaces. `certSha256` pinning needs a host with `tlsPinSha256` support; older hosts ignore it. The stable `0.8.8` release has not been
validated with this plugin and should not be treated as compatible.

A failing login also raises a Decaid notification for that instance, withdrawn
after the next successful login. `MintTokens` and `AllowNoPasswordWorkaround`
are `"true"`/`"false"` choices, so existing values carry over. `restPort`
overrides the HTTPS login port (default 443) for tunnels and simulators.

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
and GitHub source archive against upstream Decaid `main` using Flutter 3.47.9,
the version Decaid's own CI pins; the Linux app smoke pins upstream main `1d74fbf7` with Flutter 3.47.9,
the first pinned host that accepts the `notifications` permission.

## Simulator end-to-end tests

`npm run test:sim` runs the plugin against the E64 WS simulator from the
private research repository, located through `E64_SIM_ROOT` (default
`../mahlkoenig-e64ws-local-research`; its `.venv/bin/python` is used when
present, or `E64_SIM_PYTHON`). Nothing from that repository is copied here; a
self-signed certificate is generated per run. The suite covers:

| Area | Simulator path |
| --- | --- |
| Static token, wrong token | `ws` with `--token` |
| Owner-password minting | `/rest_api/login` over HTTPS with `restPort` and a `certSha256` pin |
| FW-01 no-password workaround | `--fw01-login` |
| WSS pinning, missing and wrong pins | `--tls-cert`, `--http-tls-cert` |
| DD and grind state | `/sim/action` `SetAgsaTargetDdValue`, `StartGrindManual`, `Stop` |
| Real 2026-11-19 grind replay | `--replay` with the sanitized capture, `/sim/replay/seek` |
| Diagnostics allowlist | simulator state, config and machine-info payloads |
| Failed-login notice and backoff | wrong password |
| Reconnect | simulator restart on the same ports |
| Xenia routes | `tools/xenia_bridge.py --instance` against the plugin |

The tests fail when the simulator is missing unless `E64_SIM_OPTIONAL=1`.
`ci/host_sim_test.dart` runs the same login, pinning and DD path inside the
Decaid host; CI's `sim-e2e` job runs both when the `RESEARCH_REPO_SSH_KEY`
deploy key is available and otherwise reports that it was skipped.

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

## Real VM test

`docs/VM_TESTING.md` describes the optional integration against the from-SWU
QEMU grinder: mint a local WSS token, run `tools/ws-bridge.py` in front of the
VM's TLS WSS, and execute `test/vm-integration.mjs` with the actual
`plugin.js`. The verified run published `{"state":"idle","observedSetting":"0"}`
after DD calibration and read live `machineInfo`/`config`
diagnostics.

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

The diagnostics surface accepts `GET` with the host `deviceId`. The supported
`read` values are none, `config`, `machineInfo`, `connection`, `control`, `inventory` and `xenia`.
With no `read` parameter it returns last-known observations, including the
latest polled `state`, which may remain available after disconnection; there is
no separate `read=state`. Reconnecting starts a fresh observation set.
`read=config` and `read=machineInfo` require a connected instance and validate
the reply before returning it. All diagnostics, including the last-known state, contain only an
allowlist of operational fields (`plugin.js` `exposed`): serial numbers,
session ids, Wi-Fi credentials, cloud URLs and log messages are dropped, and
there is no `read=logs`. Unsupported reads return 400, unknown instances and
endpoints 404, unsupported methods 405, and disconnected, timed-out or invalid
read replies 503.

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
or firmware compatibility. The 2026-11-18 live pass is a read-only runtime
check; see [`docs/LIVE_VALIDATION.md`](docs/LIVE_VALIDATION.md).
