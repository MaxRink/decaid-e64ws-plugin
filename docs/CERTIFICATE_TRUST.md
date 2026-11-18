# Trusting the E64 web certificate

The E64 serves a **self-signed** certificate for HTTPS and WSS. The Decaid
plugin uses the host platform trust store for both `fetch()` and `wss`; it
deliberately does not disable certificate verification. Password-based token
minting therefore needs the E64 certificate trusted by the Decaid host.

Public certificate fingerprint:

```text
SHA-256 91:B4:12:EE:01:4F:21:C3:BB:24:45:43:0B:6A:3D:77:90:33:34:A1:30:0A:D8:4F:19:80:AB:2C:5F:53:62:0B
```

The certificate and private key are static in the firmware image. Trusting it
authenticates this vendor image, not the individual machine. Prefer per-device
pinning or a real PKI if the host supports it.

## macOS

1. Open **Keychain Access** → **System** → **System Roots** or **System**.
2. Import `webui.crt` (exported from `/db/webui.crt` or the firmware image).
3. Open the certificate → **Trust** → **When using this certificate: Always
   Trust**.
4. Or from a terminal:

```sh
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain webui.crt
```

Restart Decaid after changing the trust store.

## Linux

```sh
sudo cp webui.crt /usr/local/share/ca-certificates/e64-webui.crt
sudo update-ca-certificates
```

For browsers or runtimes with their own NSS store, also import it there. Verify:

```sh
curl --cacert webui.crt https://192.168.200.103/index.php -o /dev/null -w '%{http_code}\n'
```

## Android

**Settings → Security → Encryption & credentials → Install a certificate →
CA certificate**, then select `webui.crt`. Android shows a permanent user-CA
warning; that is expected. Some apps ignore user CAs; Decaid's Flutter HTTP
client generally follows the platform store.

## Windows

Import `webui.crt` into **Trusted Root Certification Authorities** with
`certmgr.msc`, then restart Decaid.

## If trust is not possible

Use a static token in `TokensJson`:

1. Mint a token on a machine that can reach the E64 with TLS verification
   disabled (for example the research client with `--insecure`).
2. Paste the 64-hex token into the plugin's secure `TokensJson`.
3. Because the token is single-connection, refresh it after every reconnect.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` in a production host. That disables
verification for every plugin, not just E64.

## Verification

With the certificate trusted and an Owner password set:

```json
{
  "InstancesJson": "[{\"id\":\"one\",\"name\":\"E64\",\"host\":\"192.168.200.103\",\"port\":9997,\"scheme\":\"wss\",\"pollMs\":1000}]",
  "TokensJson": "{}",
  "MintTokens": "true",
  "PasswordsJson": "{\"one\":\"<owner-password>\"}"
}
```

The plugin should connect, publish `state` and `observedSetting`, and
`read=connection` should report `tokenSource: "password"`.
