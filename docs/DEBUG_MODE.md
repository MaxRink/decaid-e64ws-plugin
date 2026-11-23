# Grinder control and the development image

Reading the E64 needs nothing beyond the normal WebSocket token. The optional
control features (start/stop, grind-setting writes, backlight sync and brew
events) use commands that the stock firmware only accepts on a grinder running
a **development image that its owner has enabled**. On a shipped image the
grinder refuses those commands by closing the WebSocket without a reply.

This repository contains no unlock tooling or instructions. Whether and how an
owner enables a development image on their own grinder is outside this plugin.

## How the plugin decides

Control is off unless `AllowControl` is `"true"`. With it enabled, the plugin
probes each instance once per load:

1. It logs in for a separate token (this needs `MintTokens`; a static
   single-connection token is never spent on a probe).
2. It opens a throwaway WebSocket and sends `RequestLogMessages`, a read-only
   development command without side effects. The reply is discarded.
3. A reply means control is available. A closed socket means the grinder is
   locked. No answer within 3 s counts as unknown.

Only an available grinder is registered through the `e64-control` driver, which
declares the `startStop` and `grindSetting` capabilities. Every other result
registers the read-only `e64` driver, so a locked grinder never shows controls
in Decaid and the main session never sends a command the grinder would refuse.
Decaid declares capabilities per driver, so the device ID differs between the
two drivers (`plugin:mahlkoenig-e64.reaplugin:e64:<id>` and
`…:e64-control:<id>`). The probe runs again when the plugin reloads, for
example after a settings change. `GET <diagnostics>?read=control` reports
`debugMode` (`disabled`, `unprobed-static-token`, `available`, `locked` or
`unknown`), `probedAt`, the adjustment owner, and the last action and brew-event
results.

## What the plugin sends

The plugin can only send these `GrinderAction` types, and a unit test enforces
the list: `StartGrindGbw`, `Stop`, `SetAgsaTargetDdValue`, `AddBrewEvent` and
`SetBacklightBrightness`. It never sends calibration, fan, ESP, input-injection,
language, setup-wizard or configuration-write commands.

- **Start** grinds by weight with the grinder's own current target
  (`grindTargetWeightGr`). Without a target it refuses; it never starts an
  unbounded manual grind remotely.
- **Grind setting** is in whole micrometres, the value the grinder displays.
  It needs `AdjustmentOwner` `"decaid"` and must stay within 10 µm of the current
  reading per command, because the firmware's range limits are variant-specific
  and have not been recovered. The plugin sends
  `SetAgsaTargetDdValue {targetDdValue: value × 10}`.
- **Backlight sync** (`SyncBacklight`) sets brightness 0 when the espresso
  machine reports `sleeping` and 100 when it wakes. The grinder's previous
  brightness cannot be read, so it restores to 100.
- **Brew events** (`AdjustmentOwner` `"grinder"`) report a finished Decaid shot
  to the grinder's grind-by-sync. Each shot needs a brew time over 10 s, a
  weight, and a successful grind that completed at most 5 minutes before the
  shot started (or up to 1 minute after, for clock skew), the same rule as the
  assisted dial-in plugin; each grind is linked to one shot. The event uses the grind's UUID from the grinder's own
  grind log (see "Grind events" in the README). On a Decaid host without binary
  `fetch` support the UUID is unknown, brew events stop at
  `grind uuid unavailable`, and nothing is sent.

A failed control action raises a Decaid notification for that instance, which
is withdrawn after the next successful action.

## Risks

- A development image enables every development command, not only the ones this
  plugin uses. Anything else on the network that holds a token can use them.
- Remote start moves the motor. Only enable control where nobody can be hurt by
  a grind started from Decaid.
- `SetAgsaTargetDdValue` moves the burrs. The 10 µm step limit reduces, but does
  not remove, the risk of a wrong setting.
- In development mode the grinder reports `grinderType` `"Unknown"` from
  `RequestNachineInfo`, and the same value drives product-specific behaviour in
  the firmware.
- A firmware update replaces the image. The grinder returns to the shipped,
  locked state and the plugin falls back to read-only after its next probe.
