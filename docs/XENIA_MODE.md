# Xenia mode

The plugin can present the Decaid host as a **Xenia** coffee machine to the
E64's stock `CmXeniaDriver`. The E64 then polls Decaid for brew state and sends
its grind result and start-brew request, which is the same local HTTP loop a
real Xenia uses.

This is a **stock E64 path**: no root, no development unlock and no firmware
write. Only the E64 M2M host field changes.

## Why a sidecar

The E64 calls:

```text
http://<host>/api/v2/mako
http://<host>/api/v2/machine
http://<host>/api/v2/brewratio
http://<host>/api/v2/scripts/execute
```

on **TCP port 80 with no path prefix**. A Decaid plugin serves under
`http://<decaid>:8080/api/v1/plugins/<id>/<endpoint>`, so a plugin alone cannot
answer those URLs. `tools/xenia_bridge.py` is a small host-side sidecar that
listens on `:80` and forwards the four routes to the plugin.

```text
E64 CmXeniaDriver
   │  http://<decaid-host>/api/v2/*
   ▼
tools/xenia_bridge.py  :80
   │  http://127.0.0.1:8080/api/v1/plugins/mahlkoenig-e64.reaplugin/xenia-*
   ▼
Decaid E64 plugin
   ├─ xenia-mako             status JSON
   ├─ xenia-machine          MA_TYPE/MA_SN/FW identity
   ├─ xenia-brewratio        SYNC_BEVERAGE_WEIGHT/SYNC_FILTER echo
   └─ xenia-scripts-execute  200 ack, started:false
```

## Setup

1. Install plugin **0.4.0** or newer and configure a static token or
   `MintTokens` + secure `PasswordsJson` (see the main README).
2. Start the sidecar on the Decaid host:

```sh
sudo python3 tools/xenia_bridge.py \
  --decaid http://127.0.0.1:8080 \
  --plugin-id mahlkoenig-e64.reaplugin \
  --bind 0.0.0.0 --port 80
```

`--port 80` needs root or a container with the port mapped. For a local test,
use `--port 8081` and call it directly.

3. On the E64, enable M2M/cloud and set the Xenia host to the Decaid host's IP.
   Use manual host entry; Xenia 3.87 auto-discovery does not work with this
   mock.
4. Verify with:

```sh
curl http://<decaid-host>/api/v2/mako
curl http://<decaid-host>/api/v2/machine
```

The E64 should begin polling `/api/v2/mako`. No brew starts automatically.

## What the plugin maps

| Xenia field | Source |
|---|---|
| `MA_STATUS` | `3` while Decaid substate is `preparingForShot`/`preinfusion`/`pouring`, `4` for `pouringDone`, otherwise `1` |
| `MA_EXTRACTION_STATUS` | `1` while serving, `0` otherwise |
| `REAL_EXTRACTION_TIME_MS` | time since the serving state began |
| `PU_SENS_FLOW_METER_FLOWRATE` | Decaid `flow` |
| `PU_SENS_FLOW_METER_VOLUME` | integrated `flow` over the serving interval |
| `BG_SET_TEMP` / `BG_SENS_TEMP` | Decaid `targetGroupTemperature` / `groupTemperature` |
| `TANK_LEVEL` | `0` for `needsWater`, otherwise `1` |
| `script` | `Decaid` |
| `MA_TYPE`/`MA_SN`/FW | fixed Decaid identity |

The plugin requires the `events.machine` permission to receive
`stateUpdate` events.

`MA_TYPE` and `MA_SN` are placeholders (`Xenia`, `DECAID-XENIA`). The first
live run should confirm the E64 accepts them; if it rejects the identity,
adjust to the value recovered from the real Xenia `/api/v2/machine/type` route
or the scanner probe expectations.

## Safety and limits

- `POST /api/v2/scripts/execute` is **acknowledged only**:
  `{"ok":true,"started":false}`. It does not start a real brew. A physical
  brew start needs a separate owner-approved hook.
- The sidecar has no authentication, like the Xenia route it mimics. Bind it
  only on an isolated LAN or loopback.
- Port 80 requires privilege. On macOS/Linux use `sudo` or a container with
  `--net=host`; do not expose it to an untrusted network.
- `REAL_EXTRACTION_TIME_MS` reaching GbS and moving the dial is still unproven;
  it needs a physical 15 s/25 s shot A/B.
- The E64 M2M/cloud flag is a stock UI setting. Do not confuse this with the
  dev-only WSS `AddBrewEvent` path.
