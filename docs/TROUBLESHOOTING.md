# Troubleshooting a connection

The plugin no longer answers a failed connect with "check the Owner password,
certSha256 and grinder address". Every failure names the stage it stopped at,
the value it expected, what it saw and one next step.

A failed connect now produces two messages:

* a Decaid notification for that instance, for example

  ```
  E64 Kitchen: E64 connection failed at DNS lookup. login dns. The login request
  did not complete: it failed at DNS lookup. Expected 192.168.1.40 to resolve on
  this network. Observed: the name lookup failed (getaddrinfo ENOTFOUND
  e64.local). Next: check the address for typos, then use the grinder's IP
  address instead of a name; this device must be on the same network
  [code: ENOTFOUND]
  ```

  and
* the same text as the error the device handler returns, plus the staged record
  (`token`, `websocket`, `state`) with timings on the diagnostics surface.

The notification is withdrawn after the next successful connect.

## Stage by stage

The `stage` is the first thing to read. `GET <diagnostics>?read=connection`
reports it as `diagnosis.stage`, and `?read=stages` logs every step.

| Stage | What the message says | What it means | What to do |
| --- | --- | --- | --- |
| `dns` | `Expected <host> to resolve on this network` | The grinder's name does not resolve. Nothing was sent. | Use the grinder's IP address. `.local` names need mDNS, which many networks block. |
| `refused` | `Expected something listening on <host>:<port>` | The address answers, but nothing listens on that port. | Check the port: WSS is 9997, the HTTPS login is 443 (`restPort`). |
| `unreachable` | `Expected a route from this device to the grinder` | This device has no route to that network. | Join the same network/VPN. A wrong subnet looks like this. |
| `timeout` | `Expected an answer from <host>:<port> within the connect timeout` | Nothing answered. | Wake the grinder, check its power and the access point, then check for a firewall that drops rather than refuses. |
| `tls` | `Expected a TLS handshake before the request is sent` | The port is not speaking TLS, or something intercepts it. | `scheme` must be `wss` for 9997 and the login port must be HTTPS. A plain-HTTP proxy on the path also lands here. |
| `certificate` | `Expected leaf SHA-256 fingerprint <pin> via certSha256` | Verification of the grinder's certificate ran and failed. | Pin the fingerprint (below), or fix the host clock if the certificate looks expired. A host without `tlsPinSha256` support drops the pin and falls back to platform validation, which fails for the self-signed E64 certificate. |
| `fingerprint` | `Expected leaf SHA-256 fingerprint <pin> via certSha256` | The certificate did not match `certSha256`. | Compare `certSha256` with the value from the command below. Re-run it against the port you pinned. |
| `upgrade` | `Expected an HTTP 101 Switching Protocols upgrade` | TLS worked, the WebSocket handshake did not. | 401/403: mint a fresh token or check the Owner password; a live token lasts five minutes and allows one connection. Otherwise check that the port is 9997, not the web interface. |
| `auth` | `Expected HTTP 2xx and a session token for the Owner password` | The login request reached the grinder and was refused. | Re-enter the Owner password. `HTTP 429` means rate limited: wait for the reported `Retry-After`. |
| `protocol` | `Expected an E64 reply with the documented fields` | The reply is JSON but not the E64 schema. | Confirm this is an E64 on that port. Attach the diagnostics bundle to a bug report. |

`login backoff` is not a failure of the grinder: the previous login failed and
the plugin waits before retrying (5 s, doubling to 5 min, reset by a
successful login).

## Verify the certificate fingerprint yourself

Run this on a machine on the same network as the grinder, against the port you
pinned (`restPort`, 443 by default):

```sh
openssl s_client -connect 192.168.1.40:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256
```

The output looks like:

```
sha256 Fingerprint=91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B
```

Use the value after `=`. Port 9997 serves the same certificate; if the two
differ, something between you and the grinder is intercepting one of them.

`-sha1` is not accepted as a pin. A SHA-1 fingerprint is 40 hex characters and
is rejected with a message that says so, because a SHA-1 value can never match
the SHA-256 the host compares.

The pin is stored as exactly 64 hex characters. The parser accepts an optional
`sha256 Fingerprint=` label, upper or lower case, and colons, spaces or hyphens
between the bytes; anything else is refused with the reason (how many hex
characters it found) rather than silently repaired.

## Obtain a TokenJson

The WebSocket listener needs a five-minute bearer token. Three options, in
order of preference:

1. **Owner password (recommended).** Set `MintTokens` to `"true"` and the
   current Owner password in the secure setting:

   ```json
   {"one":{"host":"192.168.1.40","password":"<owner-password>"}}
   ```

   The plugin calls `POST https://<host>:443/rest_api/login` on each connect and
   uses the returned `Authorization: Bearer` value. This is what the setup
   assistant produces for you.

2. **Static token.** `TokensJson` takes a token you obtained elsewhere:

   ```json
   {"one":{"host":"192.168.1.40","token":"<64-hex-token>"}}
   ```

   A live token is single-connection, so supply a fresh one for every reconnect.
   To fetch one by hand:

   ```sh
   curl -sS --cacert webui.crt -i \
     -H 'Content-Type: application/json' \
     -d '{"userRole":"Owner","password":"<owner-password>"}' \
     https://192.168.1.40/rest_api/login \
     | grep -i '^authorization:'
   ```

   `webui.crt` is the certificate you read from the grinder with
   `openssl s_client -showcerts -connect 192.168.1.40:443 </dev/null 2>/dev/null`.
   Prefer option 1: it does not require trusting that file, and a static token
   has to be replaced after every close.

3. **No-password workaround (gated).** Only for an owner-controlled device with
   no Owner password: `MintTokens` `"true"` and
   `AllowNoPasswordWorkaround` `"true"`. See
   [DEBUG_MODE.md](DEBUG_MODE.md) for what that does and does not unlock.

`GET <diagnostics>?read=connection` reports `tokenSource`, `lastMintError` (a
fixed category such as `login HTTP 401`), `lastMintDiagnosis` (the full staged
sentence) and `mintBackoffUntil`. It never returns the token or the password.

## Turn on the verbose log

The staged record is always kept in memory; the verbose level adds the
underlying error message and code.

* Per request, no restart: `GET <diagnostics>?read=stages&verbose=1`.
* Persistently: switch on **Verbose connection diagnostics** (`DebugLog`, Off by
  default) and reload. It is declared in the manifest, so the host can save it;
  any value other than `"true"`/`"false"` is refused at load.

The quiet level prints stage, outcome, class and timing; the verbose level adds
`last error: <class> <message> [code: <code>]`. Tokens, Owner passwords, auth
headers and certificate bodies are removed at both levels.

## Attach the diagnostics bundle

`GET <diagnostics>?read=diagnostics` returns the JSON bundle, and the same
bundle is shown in a collapsible block on `GET <diagnostics>?ui=1`: version,
platform, endpoint host and ports, the TLS/pin summary with the expected
fingerprint and whether it was confirmed, the staged steps with timings, and the
error class.

The bundle never contains a token, an Owner password, an auth header or a
certificate body. When you paste it into an issue, also state the grinder's
firmware version and whether the grinder is on a development image.

`tls.comparison` says what the plugin sends and what a host that enforces pinning
compares; `tls.enforcedByHost` says whether this host was seen to enforce it
(`unknown`, `enforced`, `not enforced`). The plugin itself cannot verify the
peer: it can only forward `tlsPinSha256` and observe whether the connection it
asked for succeeds.

## Common causes of "it will not connect"

* **The host ignores `tlsPinSha256`.** The plugin sets the pin; only the host can
  enforce it, and the Decaid builds inspected so far drop it, because a plugin
  `fetch()` forwards only `url`, `method`, `headers` and `body`. The setup
  assistant proves it by probing with a pin that cannot match any certificate: a
  host that accepts that probe reports `pin-unsupported` instead of naming a
  fingerprint it never verified. Once an instance for that address exists,
  `?read=diagnostics` reports the result as `tls.hostPinSupport` (`unknown`,
  `honoured` or `ignored`) and `tls.enforcedByHost`.
* **The password is bound to the address.** Changing `host` in `InstancesJson`
  makes the plugin refuse the stored `PasswordsJson` entry, on purpose.
  Re-enter the password for the new address.
* **`host` is not local.** Only loopback, private, link-local, IPv6 ULA and
  `.local` addresses are accepted, so a token or password cannot leave the LAN.
* **The token expired.** A live token lasts five minutes and one connection.
