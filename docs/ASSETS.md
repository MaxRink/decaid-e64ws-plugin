# Image provenance

Every PNG under `docs/assets/` is listed here with the way it was produced and
whether it may be redistributed, and `test/docs.test.mjs` fails when one is added
without a row. That check is the point: the sentence above is only worth making
if something enforces it.

Three classes exist, and none of them is redrawn by hand:

1. **Screenshots of this plugin's own pages** (`docs/assets/setup/`), captured by
   `tools/capture-doc-shots.mjs` from the committed `plugin.js`.
2. **Renders of the grinder's UI** (`docs/assets/grinder/`), copied from the
   research repository's QML stub harness.
3. **Vendor-UI screenshots from the QEMU virtual grinder** (`docs/assets/*.png`),
   framebuffer captures of the vendor HMI running in the from-SWU VM. They predate
   this guide and document `docs/VM_TESTING.md`; one is no longer referenced.

## How to re-capture the screenshots

```bash
npm ci
npx playwright install chromium
node tools/capture-doc-shots.mjs          # writes docs/assets/setup/*.png
```

Re-running it reproduces the files byte for byte except in two known places,
both of which are live state rather than layout:

- `02-device-address.png` — the text caret's blink phase. The address, focus ring
  and layout are identical; the caret may or may not be in frame, so some re-runs
  match and some do not.
- `07-diagnostics.png` — the **Staged steps** row prints the millisecond timings of
  that run. Every re-run differs, always inside that one row (y 214–231); the
  right edge moves with the digits, reaching x 602, and the pixel count varies
  with them: 491 in the pre-rename round, then 651, 810, 973, 1043 and 1123 in
  re-runs since. Treat those as examples, not as a bound.

The images were captured from this branch's `plugin.js`, which is `main` plus
this documentation change: the certificate step names the enforced pin, the
diagnostics page carries the **Last failure**, **Staged steps** and
**Fingerprint** rows plus the bundle block, and the assistant and diagnostics
headings carry the display name `Mahlkönig WebSocket grinders` from the rename.
They were re-captured after that rename; the assistant's default instance name
in `07` is `Mahlkönig grinder`, the same default `plugin.js` writes.

The script is the provenance: it loads `plugin.js` from this repository into a
Node `vm` with a stand-in for Decaid's plugin host (a settings store, the
endpoint router, and a reload-on-save, the same surface `test/wizard-ui.test.mjs`
uses), serves the plugin's pages over loopback, and drives Chromium. The setup
assistant's certificate probe and login test talk to a fake host `fetch` that
returns the fleet fingerprint; the diagnostics page talks to this repository's
own mock grinder, `tools/e64-mock-server.mjs`, over a real WebSocket.

Two consequences worth stating plainly:

- The page contents are real — the HTML, CSS and JS come from `plugin.js` as
  committed. The **host around them is not Decaid**: there is no Decaid window,
  menu bar or title bar in any image.
- No image contains a real credential. See [Synthetic values](#synthetic-values-in-the-images).

## The table

| Image | What it shows | Exact source | Redistributable? |
| --- | --- | --- | --- |
| `docs/assets/setup/01-before-you-start.png` | Setup assistant, step 1 of 7 | `node tools/capture-doc-shots.mjs` → element screenshot of `main#page` (736 px wide; 355–926 px tall depending on the step) in Chromium via Playwright 1.65.1, theme `light` | Yes — this repository's own GPL-3.0-or-later work |
| `docs/assets/setup/02-device-address.png` | Step 2, address field | same script, address field filled with the placeholder `192.168.1.40` | Yes — same |
| `docs/assets/setup/03-trust-certificate.png` | Step 3, certificate recognised | same script, after the fake host `fetch` accepted the fleet pin | Yes — same |
| `docs/assets/setup/04-owner-password.png` | Step 4, masked password and "Password accepted" | same script, password field filled with `SYNTHETIC-owner-password-not-a-real-one`, rendered as dots | Yes — same |
| `docs/assets/setup/05-grind-and-workflow.png` | Step 5, adjustment owner and the three switches | same script | Yes — same |
| `docs/assets/setup/06-review-and-save.png` | Step 7, review summary | same script, reached by clicking through steps 1–7 | Yes — same |
| `docs/assets/setup/07-diagnostics.png` | Diagnostics page, one connected instance | same script, `plugin.js` connected to `tools/e64-mock-server.mjs` (loopback, mock grinder type "E64 WS mock one") | Yes — same |
| `docs/assets/grinder/main-menu.png` | The grinder's main menu | copied from `MaxRink/mahlkoenig-grinder-research` at commit `395cb32388d09c691d306569bf2bd3365b986dc8`, file `tools/qml/shots/MainMenu.png` | No — vendor-derived, see below |
| `docs/assets/grinder/grind-screen.png` | The grinder's grind screen | same commit, `tools/qml/shots/GrindScreen.png` | No — vendor-derived, see below |
| `docs/assets/grinder/recipe-statistics.png` | The grinder's recipe statistics | same commit, `tools/qml/shots/StatisticsMenu.png` | No — vendor-derived, see below |
| `docs/assets/grinder/connectivity.png` | The grinder's Connectivity screen | same commit, `tools/qml/shots/ConnectivityMenu.png` | No — vendor-derived, see below |
| `docs/assets/home-screen.png` | The QEMU grinder's idle HMI screen (1200 µm, 10.0 s) | committed in `c400420` ("test(vm): real QEMU grinder integration and guide") together with `docs/VM_TESTING.md`; a framebuffer capture of the vendor HMI running in the from-SWU QEMU virtual grinder (research repository, `tools/virtual-grinder`). Used by `docs/VM_TESTING.md:25` | No — vendor-derived, see below |
| `docs/assets/machine-to-machine.png` | The HMI's "GBS COFFEE MACHINES" screen (Enable Cloud Device / Enable Xenia) | same commit, same harness. Used by `docs/VM_TESTING.md:65` | No — vendor-derived, see below |
| `docs/assets/m2m-bindings.png` | The HMI's "SYNC SCALE BINDINGS" screen ("Cloud is not connected!") | same commit, same harness. Not referenced by any document today | No — vendor-derived, see below |

## The QEMU virtual-grinder screenshots

The three files directly under `docs/assets/` are older than this guide and are
not produced by anything in this repository. They are framebuffer captures of the
**vendor HMI** running in the from-SWU QEMU virtual grinder described by
[`VM_TESTING.md`](VM_TESTING.md): the same class as the QML renders in
`docs/assets/grinder/` — Mahlkönig's interface, captured by first-party tooling —
but from the real vendor binaries rather than the stub harness. Two of them
illustrate `VM_TESTING.md`; `m2m-bindings.png` is no longer referenced by any
document and is kept because removing another page's asset is not this guide's
job.

They cannot be re-captured from this repository alone: the VM, the SWU and the
capture steps live in the research repository (`tools/virtual-grinder`), the same
dependency `npm run test:sim` already has. They are listed here so the inventory
is complete and so nobody has to guess what they are — and they carry the same
**no redistribution** verdict as the QML renders, for the same reason.

## Synthetic values in the images

| Value | Where it appears | What it is |
| --- | --- | --- |
| `192.168.1.40` | `02`, `06` | A placeholder LAN address. It is not a device belonging to this project. |
| `SYNTHETIC-owner-password-not-a-real-one` | `04`, masked | A placeholder, typed only so the field is not empty in the picture. No grinder accepts it; the login result comes from the capture script's stand-in host. |
| `synthetic-mock-token` | not visible in any image | The mock grinder's query token, used for the loopback connection in `07`. No page echoes a token; `test/plugin.test.mjs` asserts that no surface does. |

Nothing in this guide shows a real token, a real password, a serial number or a
session identifier: not the seven plugin pages, and not the three QEMU
screenshots, which show the idle screen and two machine-to-machine menus.

## The grinder renders: what they are, and what you may do with them

These four PNGs were **not** produced in this repository. They come from the
research repository, where the vendor's Qt Quick UI is rendered from the
firmware image by first-party tooling:

```sh
# in mahlkoenig-e64ws-local-research, per tools/qml/README.md
python3 tools/qml/bin/qres_extract.py .tools/firmware-1.16-24/app-tree/bin/libNgxUi.so -o /tmp/qml-recon/qrc
python3 tools/qml/bin/moc_parse.py   .tools/firmware-1.16-24/app-tree/bin/libNgxUi.so -o tools/qml/work/moc.json
python3 tools/qml/bin/contract.py    tools/qml/work/moc.json -o tools/qml/work/contract.json
python3 tools/qml/bin/gen_stub.py    tools/qml/work/contract.json -o /tmp/qml-recon/build
bash tools/qml/bin/build_stub.sh && bash tools/qml/bin/run_vm.sh && bash tools/qml/bin/capture.sh
```

So the presentation layer is the vendor's own QML, unforked, running in QEMU
against a stub backend; the **behaviour and data behind it are stubbed**, which
is why the screens show empty counters and sparse content. They are honest
renders of the grinder's UI, not photographs of a grinder, and not mock-ups.

Redistribution, stated as plainly as it can be:

- The **screenshots as files** are our own capture output, produced by this
  project's tooling. The repository's GPL-3.0-or-later licence covers that
  capture work.
- What they **depict** is Mahlkönig's interface, including its strings, fonts
  and layout from firmware `HEM-HSG-HMI-S01` V01.16-24. No licence from us can
  grant rights in that material, and none is claimed. They are included the same
  way the research repository includes them: for technical documentation of an
  interface the user already owns, with attribution. Do not reuse them in
  promotional, commercial or comparative material, and do not treat them as
  vendor-approved screenshots.
- The research repository deliberately does **not** commit the vendor QML itself.
  These four renders and the three QEMU screenshots listed above are the only
  vendor-derived images in this repository.

### Vendor manual extracts are not included

The research repository also holds `docs/assets/manual-*.png`, cropped extracts
from Mahlkönig's printed manual. They are vendor material and are **not
redistributable**; none of them is copied here, and this guide does not need
them. If you want the manual's own pictures, use the manual you received with
the grinder.

## What is missing from the pictures, and why

Decaid's own windows are not shown anywhere in this guide. The capture machine
could not build or run the host app:

- `flutter build macos --debug` fails with `Xcode not installed; this is
  necessary for iOS and macOS development.` — the machine has only the Command
  Line Tools (`xcodebuild -version` refuses for the same reason).
- `flutter build apk --debug` fails before compiling any project code, on an
  unreadable Gradle transform cache (`Could not read workspace metadata from
  ~/.gradle/caches/8.14.3/transforms/…/metadata.bin`). Clearing that cache is a
  machine-wide change to a shared build cache, which was not done for a
  documentation task.
- No Linux desktop runtime is available on macOS, which is the target Decaid's
  own CI uses for its app smoke test.

Rather than substitute a render of the app's widgets and call it a screenshot,
the host-side steps are written as click paths — see
[SETUP.md § 4](SETUP.md#4-open-the-setup-assistant) and § 3. If you can run
Decaid, the two screens worth photographing for this guide are **Settings →
Plugins** (the plugin card, its check mark, and the `Set up` / `Settings`
actions) and the plugin's settings dialog. A future capture run can add them
without changing anything else here.
