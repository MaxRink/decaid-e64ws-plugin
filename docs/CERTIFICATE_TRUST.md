# E64 certificate trust

The E64 serves a **self-signed** certificate for HTTPS (443) and WSS (9997).
Normal platform validation therefore fails, for example on Android with
`HandshakeException ... CERTIFICATE_VERIFY_FAILED: self signed certificate`.
The plugin never disables certificate verification on its own.

## Do not install the certificate as a trusted root

The certificate and its private key are static in the firmware image, so every
E64 serves the same one and anyone with an image has the key. Adding it to a
system or user root store lets that key vouch for connections your device makes
elsewhere. Do not import `webui.crt` into Keychain, `/usr/local/share/ca-certificates`,
Android's CA store or Windows' Trusted Root store.

## Recommended: pin the certificate per instance

Set `certSha256` on the instance in `InstancesJson`. The plugin passes it as
`tlsPinSha256` to the login request and the `wss` connection, and the Decaid
host accepts the connection only when the SHA-256 of the leaf certificate
(DER) matches. Nothing is added to any trust store.

Read the fingerprint from the grinder on your own network:

```sh
openssl s_client -connect <grinder-ip>:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256
```

Use the value after `sha256 Fingerprint=`. Colons are allowed and case does not
matter. Port 9997 serves the same certificate. Example only; use the value from
your own grinder:

```json
{
  "InstancesJson": "[{\"id\":\"one\",\"name\":\"E64\",\"host\":\"192.168.200.103\",\"port\":9997,\"scheme\":\"wss\",\"pollMs\":1000,\"certSha256\":\"91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B\"}]",
  "TokensJson": "{}",
  "MintTokens": "true",
  "PasswordsJson": "{\"one\":{\"host\":\"192.168.200.103\",\"password\":\"<owner-password>\"}}"
}
```

Because the certificate is fleet-wide, the pin proves that the peer holds an
E64 certificate, not that it is this grinder. The plugin combines it with the
host restriction: instances may only point at loopback, private, link-local
or `.local` addresses, and secure entries are bound to that host.

A Decaid host without pinning support ignores `tlsPinSha256` and falls back to
platform validation, which fails for the self-signed certificate. Use one of
the options below there.

## Alternatives on an owner-controlled LAN

### Static token minted with explicit insecure TLS

Mint the token on a trusted machine on the same LAN and paste it into the
secure `TokensJson` as `{"one":{"host":"<grinder-ip>","token":"<64-hex>"}}`.
Check the fingerprint first, then make the explicitly insecure call:

```sh
openssl s_client -connect <grinder-ip>:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256
curl -k -si https://<grinder-ip>/rest_api/login \
  -H 'content-type: application/json' \
  -d '{"userRole":"Owner","password":"<owner-password>"}' | grep -i '^authorization'
```

`-k` disables verification for that single request only. The token is
single-connection, so refresh it after every reconnect.

### Pinned local tunnel with `ws`

A local TLS tunnel can check the exact certificate without changing any trust
store. With stunnel in client mode, `verifyPeer = yes` accepts only a peer
whose certificate is listed in `CAfile`:

```ini
[e64]
client = yes
accept = 127.0.0.1:19997
connect = <grinder-ip>:9997
verifyPeer = yes
CAfile = /etc/stunnel/e64-webui.crt
```

Configure the instance as `"scheme":"ws","host":"127.0.0.1","port":19997` and
use a static token bound to `127.0.0.1`. The tunnel carries WebSocket traffic
only; minting still calls `https://<host>/rest_api/login`, so use a static
token with this setup.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` or similar global switches in a
production host. They disable verification for every plugin, not just E64.
