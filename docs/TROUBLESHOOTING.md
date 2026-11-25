# Troubleshooting: which stage failed?

A connection runs through seven checkpoints, and a failed connect now names the
stage it stopped at. The useful question is never "why did it fail" but **which
checkpoint does not pass**, because each one has a different owner and a
different fix.

| # | Checkpoint | Stages it produces | Answer it with |
| --- | --- | --- | --- |
| 1 | The plugin is installed and loaded | — (the host owns this) | `GET /api/v1/plugins` |
| 2 | Its settings validate | `config` | `GET …/setup?status=1` |
| 3 | The grinder answers on the network at all | `dns`, `refused`, `unreachable`, `timeout` | `ping`, `curl -k …/rest_api/ping` |
| 4 | The certificate is the one that was pinned | `tls`, `certificate`, `fingerprint` | The assistant's certificate step, `openssl`, the bundle's `tls` block |
| 5 | Login and token | `auth`, `upgrade`, `backoff` | `GET …?read=connection` |
| 6 | The session answers requests | `protocol` | `GET …?read=config`, `?read=machineInfo` |
| 7 | Readings reach Decaid | — (the plugin and the host) | The diagnostics page rows |

Work down the list and stop at the first checkpoint that fails: a later symptom
is almost never new information, because checkpoint *n+1* was not attempted.
§ 8 covers the grind and service logs, which are optional and separate from the
connection: a log that never arrives says nothing about whether Decaid is
connected.

The examples use three shell variables:

```bash
DECAID=http://decaid-host:8080/api/v1/plugins/mahlkoenig-e64.reaplugin
GRINDER=192.168.1.40            # your grinder's address
DEVICE=plugin:mahlkoenig-e64.reaplugin:e64:e64   # …:e64:<instance id>
```

## The stage is the first thing to read

The plugin keeps a staged record of every connect and reports the first failure
as a **stage**. Three places show it, all from the same record:

- `GET …?read=connection` reports `diagnosis.stage` and a one-sentence message.
- Decaid raises a notification for that instance, with the same sentence. It is
  withdrawn after the next successful connect.
- `GET …?read=stages` lists every step with its timing, and `&verbose=1` adds
  the underlying error.

A staged failure names the stage, what it **expected**, what it **observed**, one
next step, and a code where the platform gave one. Read the stage first; the
rest of the sentence is detail. The stage vocabulary is fixed, the sentences are
not — match on the stage name, never on the prose.

Before this existed, a failed connect produced one generic message — "check the
Owner password, certSha256 and the grinder address" — and nothing to act on. That
is [issue #16](https://github.com/MaxRink/decaid-e64ws-plugin/issues/16), and the
staged reporting described here is the work that closes it
([PR #19](https://github.com/MaxRink/decaid-e64ws-plugin/pull/19)). On a build
without it, this page still applies: the checkpoints below are the same ones the
plugin now names for you, they just have to be walked by hand.

## 1. Is the plugin installed and loaded?

```bash
curl -sS http://decaid-host:8080/api/v1/plugins | jq '.[] | {id, version, loaded}'
```

You want `mahlkoenig-e64.reaplugin` with a version. No entry means the install
did not land (wrong repo path, no GitHub access, a ZIP without `manifest.json`
and `plugin.js` at its root). An entry that is present but not loaded means the
plugin is installed and disabled, or it threw while loading — in Decaid, open
**Settings → Plugins**, and use the card's **Load**; a load failure is reported
on the card, not on the grinder.

**Do not debug the grinder before this passes.** Everything below is reachable
without a grinder at all, which is why this checkpoint comes first.

## 2. Do the settings validate?

```bash
curl -sS "$DECAID/setup?status=1" | jq
```

`needsSetup` is a boolean; when it is `true`, the accompanying `message` is the
plugin's own first validation error, and the stage is `config`. The boolean is
stable, the wording is not: read it, do not match on it.

The usual causes are ordinary: `host` outside loopback/private/ULA/link-local/
`.local`, a `TokensJson` or `PasswordsJson` entry whose `host` no longer matches
the instance it belongs to (the plugin refuses to load rather than send a secret
to a new address), or JSON that no longer parses. Re-running the assistant
(§ [SETUP.md](SETUP.md#4-open-the-setup-assistant)) repairs all three, because
it rewrites the whole `InstancesJson` entry and the matching secrets.

## 3. Does the grinder answer on the network?

From the machine running Decaid — not from your laptop, unless that is the same
machine:

```bash
ping -c 3 "$GRINDER"
curl -sS -k -o /dev/null -w '%{http_code}\n' "https://$GRINDER/rest_api/ping"
```

This checkpoint owns four stages, and which one you get tells you where to look:

| Stage | What it means | What to do |
| --- | --- | --- |
| `dns` | The grinder's name does not resolve. Nothing was sent. | Use the IP address. `.local` names need mDNS, which many networks block. |
| `refused` | The address answers, nothing listens on that port. | Check the port: WSS is 9997, the HTTPS login is 443 (`restPort`). |
| `unreachable` | This device has no route to that network. | Join the same network or VPN. A wrong subnet looks exactly like this. |
| `timeout` | Nothing answered at all. | Wake the grinder, check power and the access point, then look for a firewall that drops instead of refusing. |

Any HTTP status, including `401`, proves the TCP connection and the TLS
handshake completed against something. It says nothing about checkpoint 4 —
whether that certificate is the one the plugin pinned. A timeout or "no route to
host" is not a plugin problem. `-k` is right here: this is a one-off
reachability probe from your shell, not the plugin's own TLS behaviour, which
never bypasses verification.

## 4. Is the certificate the one that was pinned?

Three stages live here: `tls` (the handshake failed), `certificate` (verification
of the grinder's certificate ran and failed) and `fingerprint` (it verified, but
not the one `certSha256` names). Two cheap observations:

- In the assistant's certificate step, the banner reads **Recognised** (the
  fleet certificate) or **Check** (anything else). A **Check** banner after a
  firmware update is expected; a **Check** banner on a grinder that worked
  yesterday is worth investigating before you accept it.
- `GET …?read=diagnostics` reports the pin as the `tls` block: what was
  expected, whether the host actually enforced the pin, and the exact command
  for this instance in `fingerprintCommand`.

### Verify the fingerprint yourself

Run this on a machine on the same network, against the port you pinned
(`restPort`, 443 by default):

```sh
openssl s_client -connect 192.168.1.40:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256
```

The output looks like:

```
sha256 Fingerprint=91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B
```

Paste the value after `=`. The pin is stored as exactly 64 hex characters: the
parser accepts an optional `sha256 Fingerprint=` label, upper or lower case, and
colons, spaces or hyphens between the bytes. Anything else is refused with the
reason — including a 40-character SHA-1 fingerprint, which can never match, and
a value of the wrong length — rather than silently repaired into something that
might verify the wrong certificate. Port 9997 serves the same certificate; if
the two differ, something between you and the grinder intercepts one of them.

Pinning proves "an E64 certificate", not "your E64" — all units share one
certificate. What that does and does not buy you is in
[`CERTIFICATE_TRUST.md`](CERTIFICATE_TRUST.md).

## 5. Did login work, and which token do we have?

```bash
curl -sS "$DECAID/e64-diagnostics?read=connection&deviceId=$DEVICE" | jq
```

Three stages land here: `upgrade` (TLS worked, the WebSocket handshake did not),
`auth` (the login request reached the grinder and was refused) and `backoff`
(see below). Read the fields, not the wording:

| Field | Tells you |
| --- | --- |
| `connected` | Checkpoint 6: whether the WebSocket session is up |
| `tokenSource` | Which token path is in use: `password` (minted), `static`, `workaround`, or `none` |
| `lastMintError` | The plugin's own **category** for the last failed login — never device text |
| `lastMintDiagnosis` | The staged sentence for the same failure, including the stage |
| `mintBackoffUntil` | A failed login backs off (5 s, doubling to 5 min); a connect inside the window fails without contacting the grinder |
| `staticToken`, `mintTokens` | Which settings are actually in force |

`upgrade` with a `401` or `403` is a token problem, not a certificate problem: a
live token lasts five minutes and allows one connection. `auth` with `HTTP 429`
means the grinder rate-limited the login: wait for the `Retry-After` it reports.

`backoff` is not a failure of the grinder: the previous login failed and the
plugin waits before retrying (5 s, doubling to 5 min, reset by a successful
login). `mintBackoffUntil` in the future means the plugin has not contacted the
grinder at all — wait it out rather than re-entering the password, because
repeated attempts only extend it.

### Mint a token by hand, to prove the login works

If you want to separate "the password is wrong" from "the plugin cannot get
there", fetch a token outside the plugin. `webui.crt` is the certificate you
read from the grinder with
`openssl s_client -showcerts -connect 192.168.1.40:443 </dev/null 2>/dev/null`:

```sh
curl -sS --cacert webui.crt -i \
  -H 'Content-Type: application/json' \
  -d '{"userRole":"Owner","password":"<owner-password>"}' \
  https://192.168.1.40/rest_api/login \
  | grep -i '^authorization:'
```

A `Bearer` value here proves the password and the network, and nothing about
`certSha256`. Prefer minting from the stored Owner password over keeping a
static token: [SETUP.md § 7](SETUP.md#7-tokensjson-where-the-token-actually-goes)
has the three paths and where each one lives.

## 6. Is the session up, and does the grinder answer requests?

```bash
curl -sS -D- -o /dev/null "$DECAID/e64-diagnostics?read=config&deviceId=$DEVICE"
curl -sS "$DECAID/e64-diagnostics?read=machineInfo&deviceId=$DEVICE" | jq
```

`X-E64-Observation-State: live` means the reply came from the grinder during
this request. `last-known` means the socket is down and you are seeing the
previous answer. A `503` means the request was attempted and failed. A stage of
`protocol` means the reply was JSON but not the E64 schema: confirm this is an
E64 on that port, and attach the diagnostics bundle below.

## 7. Are readings reaching Decaid?

Open the diagnostics page and read the rows top to bottom —
[`SETUP.md § 10`](SETUP.md#10-connect-and-confirm-it-works) explains what each
row should say. Two rows answer most questions:

- **Display** — a number in µm means a `RequestDriverState` reply with a valid
  `ddValueDum` arrived. Empty while **Connected** is `yes` means the reply came
  without that field, or the sensor reported a failure; the raw payload is in
  the state view, and the rule is in [README](../README.md).
- **Grind events** — grows after each grind. If it does not, the grinder never
  left the grind cycle as far as the plugin could see, which is a checkpoint-6
  problem, not a Decaid one.

## 8. The log path (optional)

**Grind log** is the only row that involves a second protocol, and the only one
that is not part of the connection itself:

- The default is the vendor ZIP: the plugin asks the grinder for the log archive
  over the same logged-in session and parses the CSVs. It needs a token, which
  is what `needs-mint-tokens` means — the instance has nothing to log in with.
- With `UseLocalApi` on and the module deployed, the same two logs come from two
  read-only routes instead. [SETUP.md § 12](SETUP.md#12-local-api-optional) is
  the setup; this is the check.
- When it fails, the ZIP path is the fallback, so "no log" is rarer than "a log
  from the fallback path".

Read the fields, not the prose: `GET …/grind-events?deviceId=$DEVICE` returns
the same `log` object the page shows, with `status`, `lastError`, `failures` and
the next attempt time. Status classes, retry timing and the error text are
documented once, in the README's log section — do not copy the text into a
report, and do not match on it.

## The staged record and the verbose log

The record is always kept in memory. `GET …?read=stages` lists every step with
its timing and outcome; `&verbose=1` adds the underlying error class, message
and code for the last failure. Tokens, Owner passwords, auth headers and
certificate bodies are removed at both levels.

For a persistent verbose log, switch on **Verbose connection diagnostics**
(`DebugLog`, hidden among the advanced settings, Off by default) and reload. It
is declared in the manifest, so the host saves it; any value other than
`true`/`false` is refused at load. Use `&verbose=1` when you want one request
verbose without changing a setting.

## Attach the diagnostics bundle

`GET …?read=diagnostics` returns the JSON bundle, and `GET …?ui=1` shows the
same bundle in a collapsible block at the bottom of the page. It contains the
plugin version and platform, the endpoint host and ports, the TLS/pin summary
with the expected fingerprint and whether the host enforced it, the exact
`openssl` command for this instance, the staged steps with timings, and the
error class with its expected/observed/next fields.

`tls.comparison` says what the plugin sends and what a host that enforces pinning
compares; `tls.enforcedByHost` says whether this host was seen to enforce it —
`enforced`, `not enforced`, or an `unknown …` value that names the reason. The
plugin cannot verify the peer itself: it forwards `tlsPinSha256` and observes
whether the connection it asked for succeeds.

The bundle never contains a token, an Owner password, an auth header or a
certificate body — the redaction is done before anything is returned, not by
you. Paste it whole; it is the most useful thing in a report.

## Common causes of "it will not connect"

- **The host ignores `tlsPinSha256`.** The plugin sets the pin; only the host can
  enforce it, and the Decaid builds inspected so far drop it, because a plugin
  `fetch()` forwards only `url`, `method`, `headers` and `body`. Without
  enforcement the connection falls back to platform validation, which fails for
  the self-signed E64 certificate. `?read=diagnostics` reports
  `tls.hostPinSupport` (`unknown`, `honoured` or `ignored`) and
  `tls.enforcedByHost`, and the setup assistant distinguishes "not a pin the host
  honoured" from "a different certificate".
- **The password is bound to the address.** Changing `host` in `InstancesJson`
  makes the plugin refuse the stored `PasswordsJson` entry, on purpose.
  Re-enter the password for the new address.
- **`host` is not local.** Only loopback, private, link-local, IPv6 ULA and
  `.local` addresses are accepted, so a token or password cannot leave the LAN.
- **The token expired.** A live token lasts five minutes and one connection;
  refresh `TokensJson` or use the Owner password.
- **The clock is wrong.** Certificate validity is checked against the host
  clock; a device that booted without a time source can fail verification for a
  certificate that is perfectly valid.

Nothing here quotes the plugin's failure sentences. They are generated from a
fixed set of stages and can be reworded without changing what you have to do;
the stage name is the contract.

## What to include in a report

| Include | Why it is safe |
| --- | --- |
| The `?read=diagnostics` bundle | Built to be pasted: no token, password, auth header or certificate body |
| Output of `…?read=connection` | Only `tokenSource`, a category and a stage |
| Output of `…?read=config`, `…?read=machineInfo` | Read-only device configuration; no credentials |
| `curl -sS "$DECAID/settings" \| jq -r '.InstancesJson \| fromjson \| map(del(.certSha256))'` | Address, ports and scheme; the pin is dropped |
| Checkpoint results: which of the seven passed | Turns "does not work" into a bisected failure |
| Grinder firmware version and whether it runs a development image | Changes which behaviour is expected |
| Decaid version/commit and plugin version | Host compatibility is version-sensitive |

**Never include** a token, a password, a full `TokensJson`/`PasswordsJson`/
`ApiTokensJson` value, or a screenshot of a field that contains one. Secure
settings are not returned by any read — so anything that looks like a token in a
report was copied by hand, and a pasted token should be treated as compromised
and replaced.
