# Naming and identity

Status: decided in this change. Applies to the plugin's display surface only —
the persisted identity (id, driver ids, surface endpoints, setting keys) is
deliberately unchanged. Read [The id is a historical
artefact](#the-id-is-a-historical-artefact) before proposing a rename of any id.

The plugin's display name is **"Mahlkönig WebSocket grinders"**.

## Why the old name understated the scope

The plugin was called `Mahlkönig E64`, which reads as one model. The code does
not test for a model anywhere: it speaks one local protocol and registers one
device per configured instance. What that protocol reaches is the
[compatibility table](../README.md#compatible-grinders), which is the authority
for every claim in this document:

| Grinder                       | Table verdict                                        |
| ----------------------------- | ---------------------------------------------------- |
| E64 WS                        | supported and tested on a real unit                   |
| E64 TS                        | expected to work, **untested**                        |
| E65T/E65W/E80T/E80W GbS (NG2) | likely to connect, **untested, not supported yet**     |
| EK Omnia                      | not compatible                                        |
| X54, X64 SD                   | not compatible                                        |
| E65S GbW, E80S GbW, EK43, K30, Peak, K60, Vario | not compatible         |

So "E64" names the one model that is *proven*, while the plugin's reach is a
family of at least six models. The old name was accurate about evidence and
wrong about scope, which is the confusion the rename fixes.

The research repository's `docs/FLEET_FIRMWARE.md` and
`docs/FIRMWARE_DIFF_HSG_vs_NG2.md` explain why the family hangs together: HSG
(E64 WS) and NG2 (the four GbS models) share the SoC and board, Buildroot, Qt,
the partition map, a config-identical PHP web root and the same static TLS key,
and both run the `NgxUiApp`/`libNgxUi` HMI. EK Omnia runs the same
STM32MP15x board but a different application (`EkxUI`/`EkxWsServer`) and has no
PHP web app, and the remaining models publish no firmware at all.

## Names considered

| Candidate                                | Claim the name makes                          | Verdict |
| ---------------------------------------- | --------------------------------------------- | ------- |
| `Mahlkönig E64` (current)                | one model                                     | **Rejected.** Understates: six models are in scope and the code is model-neutral. |
| `Mahlkönig grinders`                     | every Mahlkönig grinder                       | **Rejected.** Overstates: EK Omnia, X54, X64 SD, E65S GbW, E80S GbW, EK43, K30, Peak, K60 and Vario are not compatible. |
| `Mahlkönig E64/E65/E80`                  | support for E65 and E80                       | **Rejected.** Overstates: the NG2 GbS row is untested *and* not supported yet. |
| `Mahlkönig NG2 grinders`                 | the untested line                             | **Rejected.** Names exactly the models the table refuses, and drops the tested one. |
| `Mahlkönig HSG grinders`                 | one firmware line                             | **Rejected.** Same understatement as the old name, with a label fewer owners recognise. |
| `Mahlkönig touch-display grinders`       | any Mahlkönig with a touch display            | **Rejected.** Overstates: EK Omnia has one (`EkxUI`) and is not compatible. |
| `Mahlkönig STM32MP15x grinders`          | any grinder on that platform                  | **Rejected.** Overstates: EK Omnia shares the SoC and board. |
| `Mahlkönig Local API grinders`           | the vendor's local API                        | **Rejected.** Collides with this plugin's own "Local API v1" feature (`UseLocalApi`, `ApiTokensJson`): the name would not say which API it means. |
| `Mahlkönig HSG/NG2 grinders`             | exactly the two firmware lines                | **Rejected, but it is the precise one.** Zero false inclusions and zero false exclusions, at the cost of two names owners cannot map their own grinder to, and it goes stale with the next firmware line. |
| `Mahlkönig WebSocket grinders`           | grinders with a local WebSocket grinder API   | **Chosen.** See below. |

## The chosen wording

"Mahlkönig WebSocket grinders" makes the breadth explicit without naming a
model, so it cannot claim a model the table refuses.

What it claims: the plugin targets Mahlkönig grinders that expose a local
WebSocket interface — the JSON WSS API on port 9997 plus the PHP web root on
443 that logs in for a token. What it does not claim: support for E64 TS or for
the NG2 GbS models. Three surfaces say so next to the name:

- the manifest description: "Read-only Mahlkönig grinder telemetry over the
  local JSON WebSocket API. Only the E64 WS is tested; the E64 TS and NG2 GbS
  models are untested.";
- the statement at the top of the [README](../README.md), which names the
  tested model and marks the rest expected and untested;
- the unchanged compatibility table, where every untested and incompatible row
  keeps its wording.

**The known cost, stated plainly.** EK Omnia is *not* excluded by having no
socket. It runs `EkxWsServer` and serves a WebSocket file service on **9988**;
what it lacks is a JSON grinder API — no JSON WSS commands on 9997, no PHP web
app, no login and token flow, so the plugin cannot talk to it. The bare word
"WebSocket" therefore does include EK Omnia, and this name is broader than the
code on its own.

What actually excludes it is the qualifier, not the noun: the manifest
description says *JSON* WebSocket API, and the plugin's first requirement is
that API on 9997. The table's EK Omnia row keeps its own "Not compatible"
wording, so a reader who starts from the name and checks the table gets the
correct answer. Nothing here relies on the claim that EK Omnia has no socket.

If the owner prefers a name with no false inclusion at all — one whose wording
is as narrow as the code — the precise choice is `Mahlkönig HSG/NG2 grinders`:
it names exactly the two firmware lines in scope, excludes EK Omnia by
construction rather than by qualifier, and was rejected above on readability
alone, not on accuracy.

## Display surfaces changed in this rename

| Surface                          | Before                                  | After                                          |
| -------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `manifest.json` `name`           | `Mahlkönig E64`                          | `Mahlkönig WebSocket grinders`                  |
| `manifest.json` `description`    | `Read-only Mahlkönig E64 grinder telemetry over WebSocket.` | names the API and the tested/untested split |
| README title                     | `# Mahlkönig E64 Decaid plugin`          | `# Mahlkönig WebSocket grinders — Decaid plugin` |
| Setup page title and heading     | `Set up the Mahlkönig E64`               | `Set up Mahlkönig WebSocket grinders`           |
| Setup notification               | `Mahlkönig E64 needs setup: …`           | `Setup needed for Mahlkönig WebSocket grinders: …` |
| Default instance name (wizard)   | `Mahlkönig E64`                          | `Mahlkönig grinder`                             |
| Certificate copy (wizard)        | `Standard Mahlkönig E64 certificate.`    | `Standard Mahlkönig certificate.`               |
| Diagnostics surface label (×3)   | `E64 diagnostics`                        | `Grinder diagnostics`                           |
| Diagnostics page titles (×2)     | `E64 diagnostics`                        | `Grinder diagnostics`                           |
| `InstancesJson` label            | `E64 instances`                          | `Grinder instances`                             |
| `TokensJson` label               | `E64 session tokens`                     | `Grinder session tokens`                        |
| `PasswordsJson` label            | `E64 Owner passwords`                    | `Grinder Owner passwords`                       |
| `ApiTokensJson` label            | `E64 Local API tokens`                   | `Grinder Local API tokens`                      |
| README, Local API section        | `the Mahlkönig E64 settings dialog`      | `the Mahlkönig WebSocket grinders settings dialog` |
| `InstancesJson` description      | `pinned SHA-256 of the E64 certificate`  | `pinned SHA-256 of the grinder certificate`     |
| `docs/VM_TESTING.md` title       | `Testing the E64 plugin …`               | `Testing the plugin …`                          |
| Release title (workflow)         | `E64 WS <tag>`                           | `Mahlkönig WebSocket grinders <tag>`            |

The setup notification needed a new sentence, not just a new string: the name
is plural, so "Mahlkönig WebSocket grinders needs setup" would not parse.

`UseLocalApi` and `ApiTokensJson` were declared by #23, after the first attempt
at this rename; their labels are renamed here now that the keys exist. A
`UseLocalApi` label needs no change — "Use the Local API" never named a model.

The default instance name moved to `Mahlkönig grinder` because the wizard
pre-fills it for every model, and pre-filling `Mahlkönig E64` re-created the
same narrowing for an NG2 owner. It only affects drafts the wizard creates;
existing `InstancesJson` entries keep whatever name they have.

## What the rename deliberately does not touch

Nothing below is left over by accident. Each one is either an id the host
persists, a protocol fact, or a separate decision.

| Kept as-is | Why |
| ---------- | --- |
| `manifest.json` `id` = `mahlkoenig-e64.reaplugin` | Persisted namespace. See below. |
| Driver ids `e64`, `e64-control` | They appear inside device ids the host stores: `plugin:mahlkoenig-e64.reaplugin:e64:<instance>`. |
| Surface ids `setup`, `diagnostics` and endpoints `setup`, `e64-diagnostics` | The endpoint is part of a URL path the host routes and the README documents. |
| Setting keys (`InstancesJson`, `TokensJson`, `PasswordsJson`, …) | The host stores and validates settings by key; a new key is a new setting with no value. Only labels and descriptions changed. |
| `package.json` `name` = `mahlkoenig-e64-reaplugin` | A private, unpublished name that mirrors the frozen id (`<id>` with `.reaplugin` → `-reaplugin`). Renaming it would edit the lockfile twice for no user-visible effect and would break the correspondence with the id. |
| Diagnostics bundle `schema: "e64-diagnostics/1"` | A versioned wire field in bundles users attach to bug reports, not the plugin's name. |
| Grinder record defaults `Mahlkönig E64 WS`, `64 mm flat (stock)` | Describes the *grinder record* this plugin creates, and the README already tells E64 TS and NG2 owners to rename it in Decaid. |
| `PopulateGrinderRecord` description: "an existing E64 record adopted" | Still literally true: the adoption rule matches records whose model contains `E64`. Generalising the sentence would describe behaviour the code does not have. |
| Error prefixes (`E64 configuration error`, `E64 connection failed`, `E64 unavailable`, …) | Protocol-scoped diagnostics text, not a display name; roughly two dozen strings and their assertions. Candidate for a separate change. |
| Repository name `decaid-e64ws-plugin` | Renaming the GitHub repository would break the README badge, the installer URLs documented in the README, the research repository's cross-links and the CI references. Separate decision. |

## The id is a historical artefact

`mahlkoenig-e64.reaplugin` stays. It now encodes the *first* supported model,
not the scope of the plugin, and the plugin id is best read as an opaque
namespace token that happens to contain a model number.

Keeping it is the safe choice because the id is not a label. It is the key for
everything the host already stored for an install:

- **Settings.** Secure settings live under `plugin.settings.secure.<id>`, and
  ordinary settings under the same per-id scope. A new id starts empty: every
  existing install would lose its `InstancesJson` (hosts, ports, pins) and its
  `TokensJson`, `PasswordsJson` and `ApiTokensJson` values, and each user would
  have to re-enter the WSS token and the Owner password for every grinder.
- **Device identity.** Devices register as
  `plugin:<id>:<driverId>:<instanceId>`. A new id changes every device id: the
  workflow's grinder link and any stored device id would point at a device that
  no longer registers.
- **Grinder records.** The plugin marks records it owns with
  `extras.source = <id>` and adopts a record whose model contains `E64`. With a
  new id it would no longer own them and would create duplicates.
- **Shot metadata.** `annotations.extras[<id>]` and `context.extras[<id>]` key
  the grind details already written onto shots. Those keys do not migrate.
- **HTTP routes.** `/api/v1/plugins/<id>/grind-events`, `/service-log`,
  `/setup`, `/e64-diagnostics` and `/xenia-*` are documented and used by the
  Xenia bridge and by scripts in the research repository.

None of that is affected by this change, because only labels moved. The guard
in [`test/identity.test.mjs`](../test/identity.test.mjs) fails if the id, the
driver ids, the surface endpoints or the setting keys drift, so a future
partial rename cannot happen quietly.

### If the id ever has to change

It cannot be done silently, and it cannot be done with a single release under
the new id. The host scopes settings by plugin id, so the new id cannot read the
old namespace; a plugin can only write its own `/api/v1/plugins/<id>/settings`.
An upgrade path therefore needs:

1. a shim release under the **old** id that reads its settings and writes them
   into the new plugin's settings route, once the host permits that write
   (unverified — it has not been attempted in this repository), or
2. documented manual re-entry of the instance list, the WSS token and the Owner
   password per grinder, plus manual repair of the grinder records the plugin
   could not adopt.

Either way the change needs a major version, a migration section in the README,
a release note that says what is lost, and the same edits in the research
repository and the Decaid fork that bundle a copy of this manifest.

## Cross-references

- [README](../README.md) — scope statement and the compatibility table.
- [`docs/CERTIFICATE_TRUST.md`](CERTIFICATE_TRUST.md) — why the pinned certificate proves "a Mahlkönig HMI certificate", not one model.
- [`docs/LIVE_VALIDATION.md`](LIVE_VALIDATION.md) — the read-only pass that is the basis of the "tested" claim.
- [`docs/DEBUG_MODE.md`](DEBUG_MODE.md) — the development image the optional control needs.
- [`test/identity.test.mjs`](../test/identity.test.mjs) — the assertions that keep these strings consistent.
