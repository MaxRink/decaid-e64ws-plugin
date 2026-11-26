# Upstream Decaid compatibility

What this plugin may rely on, what it may not, and how each answer was
established. The short version: **anything that only works on the fork ships as
a separate release artefact, and anything fork-only is detected at runtime
rather than assumed.**

## The rule

**Every host claim is verified against a pinned ref with `git show` or
`git grep`. Never against the working tree, and never from memory or from a
code comment.**

This rule exists because of a real incident in this repository. The `hidden`
flag was declared on a plugin setting and shipped as a way to keep raw JSON out
of the settings dialog. No Decaid build has ever read it — `hidden` appears in
no `lib/` file at any pinned ref, and the settings dialog maps *every* declared
entry into one flat form. The claim had to be withdrawn later, in `faaf493`
("drop the unsupported hidden flag from the DebugLog declaration"), whose own
message reads: *"The pinned host refs never read 'hidden' … Shipping it would be
another dead-metadata claim."*

A second instance of the same failure mode is still live and is called out in
the matrix below: five settings still declare `"hidden": true`, which no host
honours. Removing it is the manifest owner's call (it is asserted by an
existing test), so it is documented here rather than quietly changed.

## Pinned refs

| Alias | Ref | Commit | Why this ref |
| --- | --- | --- | --- |
| **upstream main** | `origin/main` | `c1ebc6289b0d058bf468d80446401dea3d93c3ee` | `.github/workflows/ci.yml:78-79` |
| **upstream pin** | — | `1d74fbf7a5eb3a5ba5208b4147aea136726a4909` | `.github/workflows/ci.yml:136` |
| **fork pin** | `MaxRink/decaid` | `a0dede246cd5a65601bf24bc79b77d5778b78fc6` | `.github/workflows/ci.yml:268-269` |

These three refs were re-verified on 2026-11-26 for the release that introduced
this document: `decentespresso/decaid` `main` was still `c1ebc628`, and both
pinned commits were unchanged. Every row below was re-checked with `git show`
and `git grep` against those refs on that date, not against a working tree.

`a0dede246cd5a65601bf24bc79b77d5778b78fc6` is **not** reachable from the
`MaxRink/decaid-fork` remote; it lives in `MaxRink/decaid`, which is exactly the
repository CI pins. Verify a ref is present before trusting a claim about it:

```sh
git cat-file -t a0dede246cd5a65601bf24bc79b77d5778b78fc6   # commit, or "could not get object info"
```

## Capability matrix

`both` = usable on every ref. `fork` = fork pin only. `neither` = no ref
implements it, so the plugin must not depend on it.

| # | Host facility | upstream main | upstream pin | fork pin | Plugin behaviour |
| --- | --- | --- | --- | --- | --- |
| 1 | Settings dialog maps every declared entry | **both** | **both** | **both** | Renders all entries; nothing is dropped, so every setting is reachable |
| 2 | `hidden: true` honoured by the dialog | **neither** | **neither** | **neither** | Declared, not honoured. Raw JSON settings are visible in the dialog |
| 3 | `advanced: true` honoured | **neither** | **neither** | **neither** | Declared, not honoured; every entry is shown at the same level |
| 4 | `valueLabels` honoured | **neither** | **neither** | **neither** | Declared, not honoured; enums show raw `true`/`false`/`off` |
| 5 | `secure: true` + credential store | **both** | **both** | **both** | Honoured; falls back to process memory when no OS keyring is present |
| 6 | Plugin setup surface (`role: "setup"`) | **neither** | **neither** | **neither** | Never rendered. Only a driver's own `surfaces` are parsed |
| 7 | `tlsPinSha256` on `fetch()` | **fork** | **fork** | **fork** | Gated: fork channel sends it, upstream channel never does; probe detects a host that drops it |
| 8 | `tlsPinSha256` on transport/`wss` open | **fork** | **fork** | **fork** | Same gate as row 7 |
| 9 | `responseType: "base64"` + `response.base64()` | **fork** | **fork** | **fork** | Gated; support is read off the response, not assumed |
| 10 | Host `fetch` timeout | **both** | **both** | **both** | 30 s, rejected as `fetch timeout`; the plugin's own deadline is a fallback |
| 11 | `requestCancellation` | **neither** | **neither** | **neither** | Never used. Reported as `unused` in diagnostics |
| 12 | `assets` in the plugin manifest | **neither** | **neither** | **neither** | Not declared and not packaged; the UI ships inside `plugin.js` |
| 13 | `permissions` | **both** | **both** | **both** | All five declared permissions are known to every ref |
| 14 | `api` HTTP endpoints reachable by URL | **both** | **both** | **both** | `/api/v1/plugins/<id>/<endpoint>` and `/ws/v1/plugins/<id>/<endpoint>` |
| 15 | Machine-control grant route/switch | **fork** | **fork** | **fork** | Unused: this is a read-only grinder plugin |

### Do label renames change any row?

No. #26 ("Mahlkönig WebSocket grinders") renamed the plugin's display name, four
setting **labels**, the three diagnostics surface **labels** and the manifest
description. Labels are strings the dialog renders; they are not host facilities.
The matrix keys on the *persisted* identity — manifest id, driver ids, surface
ids and endpoints, setting **keys** — and `docs/NAMING.md:135` records that those
are frozen precisely because "the host stores and validates settings by key".
`test/identity.test.mjs` enforces the same split. So every row above still reads
the same, and the only part of this change that a rename *could* break is the
packaging transform, which now matches the `certSha256 (...)` parenthetical by
pattern rather than by the sentence #26 edited (see *Cutting a release, per
channel* in the README).

## Evidence, row by row

Line numbers are at the **upstream pin** unless the row is fork-only.

**1 — the dialog maps every declared entry.** `lib/src/settings/plugins_settings_view.dart:981`
reads `manifest.settings`, and `:1049` iterates `settingsSchema.entries.map(...)`
with no filter. Verified by reading the render loop at both refs; the fork's file
adds a machine-control switch (`:426`, `:433`, `:1108`) but the loop is the same.

**2, 3, 4 — `hidden`, `advanced`, `valueLabels`.** `git grep -c "'hidden'" <ref> -- lib/`
returns 2 hits at every ref, both in `lib/src/models/data/profile_record.dart`
(`:14`, `:24`), unrelated to plugins. `'advanced'` and `'valueLabels'` return
**zero** hits in `lib/` at all three refs. The dialog's schema readers are
`secure` (`:1022`, `:1096`), `type`, `enum` and `default` only.

**5 — secure settings and the credential store.** `lib/src/plugins/plugin_loader_service.dart:735`
keys secure values under `plugin.settings.secure.<id>`; `:927` is
`_writeSecureSettings`, which at `:931` checks `_credentialStore == null` and
falls back to `_volatileSecureSettings` (process memory, lost on restart). The
fork has the same code at its own offsets — `plugin_loader_service.dart:811`
(`_secureSettingsKey`), `:1003` (`_writeSecureSettings`), `:1007`
(`_credentialStore == null`). So `secure` is real on both, but the
durability of a secret depends on the machine having an OS keyring.

**6 — the setup surface.** This is the row most worth reading twice. No ref
parses a top-level manifest `surfaces` block. `lib/src/plugins/plugin_manifest.dart:227`
reads `json['surfaces']` **inside a driver**, and the allowed roles at `:79` are
`{'settings', 'diagnostics'}` — `setup` is rejected outright. The manifest
`toJson` at `:267-268` only re-emits driver surfaces. `git grep "role.*setup" -- lib/`
returns nothing at any ref. The plugin's top-level `"surfaces": [{... "role":
"setup"}]` is therefore inert on every host; `test/plugin.test.mjs:1605` still
asserts it exists (see *Ownership* below). The setup page itself stays reachable
because it is an `api` endpoint (row 14).

**7, 8 — `tlsPinSha256`.** Upstream `_performFetch` reads only four keys —
`lib/src/plugins/plugin_manager.dart:3540-3543` (`url`, `method`, `headers`,
`body`) — and `lib/src/plugins/plugin_transport_service.dart` contains no
`tlsPin` at all, so the option is **silently dropped, with no error**. The fork
forwards it (`plugin_manager.dart:1092`) and validates it in
`lib/src/plugins/plugin_tls_pin.dart:9` (`parseTlsPinSha256`), called at
`plugin_manager.dart:3723` — *before* the pinned client is built at `:3727`.
That ordering is what makes the runtime probe possible: a malformed pin is
refused before any socket is opened, so a host that reaches the network with a
malformed pin provably does not implement the option. Transport pinning:
`plugin_transport_service.dart:105`, `:324`, `:329`, `:417`.

**9 — `responseType` / base64.** Absent upstream (zero hits); fork
`plugin_manager.dart:1093` forwards it, `:3711` switches on it, `:3715` rejects
anything but `base64`, and `:1115` is the "use base64()" guard.

**10 — host fetch timeout.** `plugin_manager.dart:119` declares `fetchTimeout`,
`:175` defaults it to 30 s, `:3523` arms `Timer(fetchTimeout, ...)` and rejects
with `fetch timeout`. The fork has the same at `:182` and `:3690`.

**11 — `requestCancellation`.** `git grep requestCancellation <ref> -- lib/`
returns zero at all three refs. The only occurrence anywhere is a *plugin-side*
feature flag inside the fork's bundled `assisted-dialin` plugin
(`assets/plugins/assisted-dialin.reaplugin/plugin.js:2632`), which is not a host
capability. This plugin never sends it.

**12 — `assets`.** The manifest declares none, and no ref reads a plugin
`assets` key (the `json['assets']` hits are the Android updater and the webui
release feed). The UI is inlined in `plugin.js` as `PLUGIN_UI`.

**13 — `permissions`.** `plugin_manifest.dart:307` parses them and the enum at
`:355` is byte-identical at all three refs; `api`, `network.websocket`,
`events.machine`, `events.shots` and `notifications` are all present. An unknown
permission throws `FormatException`, so this is a hard gate, not a hint.

**14 — `api` endpoints.** `lib/src/services/webserver/plugins_handler.dart:143`
(`/ws/v1/plugins/<id>/<endpoint>`) and `:144`
(`/api/v1/plugins/<id>/<endpoint>`). Same at all refs.

**15 — machine control.** Fork-only: `plugins_handler.dart:73` adds
`/api/v1/plugins/<id>/machine-control`, and the settings view adds
`_buildMachineControlSwitch` (`plugins_settings_view.dart:426`). This plugin
declares the `api` permission, so the fork shows that switch, but the plugin
never calls the route.

## How to re-verify a row

```sh
HOST=/Users/<you>/git/GitHub/decentespresso/decaid
UP=1d74fbf7a5eb3a5ba5208b4147aea136726a4909
FORK=a0dede246cd5a65601bf24bc79b77d5778b78fc6
git -C "$HOST" grep -n "tlsPinSha256" "$UP" -- lib/     # empty
git -C "$HOST" grep -n "tlsPinSha256" "$FORK" -- lib/   # the fork's implementation
git -C "$HOST" grep -n "'hidden'" "$UP" -- lib/         # only profile_record.dart
```

The working tree of that checkout is **not** evidence: it sits on an unrelated
feature branch. Always pass the ref.

## What the plugin does about it

| Facility | Upstream channel artefact | Fork channel artefact |
| --- | --- | --- |
| `tlsPinSha256` | Never sent. One notice names the build that supports it | Sent; a probe classifies the host as `supported`/`unsupported` |
| `responseType` | Never sent. Degrades to the Local API with a stated reason | Sent; support read off `response.base64` |
| `requestCancellation` | Unused | Unused |
| Setup surface | Not claimed; the page is documented as URL-only | Not claimed |
| `hidden`/`advanced`/`valueLabels` | Not promised to the user | Not promised to the user |

The pin verdict is established in one place and shared. `probeCertificate()` in
`plugin.js` (the setup assistant's probe, which already sent an unmatchable
fingerprint before this change) records the host's verdict, and the capability
layer consumes it: `ignored` disables pinning for every later connect, `honoured`
leaves it on. The connect path's own probe exists for the case the assistant
never ran, and asks with a *malformed* pin, which a supporting host rejects
before opening a socket. A host that cannot pin never answers "recognised",
because it would accept any certificate.

Runtime state is exposed for support under the diagnostics `connection` read:

```sh
curl -s 'http://127.0.0.1:8080/api/v1/plugins/mahlkoenig-e64.reaplugin/e64-diagnostics?read=connection' \
  | jq .capabilities
# { "channel": "upstream", "tlsPinSha256": "channel-off",
#   "responseTypeBase64": "unchecked", "requestCancellation": "unused",
#   "setupSurface": "unrendered", "messages": { ... } }
```

## Ownership

Two rows cannot be corrected here without touching work another PR owns:

- `manifest.json` still declares `"hidden": true` on five settings (rows 2, 3),
  and `test/plugin.test.mjs:1604` asserts it. Removing it belongs with the
  manifest PRs (#18/#19), not this one.
- The inert top-level `surfaces` block (row 6) is kept in the source tree
  because `test/plugin.test.mjs:1605` asserts it. The **upstream-channel
  artefact** drops it at packaging time instead of editing the shared manifest.
