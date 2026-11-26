"""What the release artefact set must look like before it is published.

`release.yml` used to assert that exactly one archive existed and that every
entry of it matched the repository byte for byte. Since #28 one source tree is
cut into two artefacts, so that guarantee has to be stated per channel rather
than once — and the "matches the tested source" half has to compare against the
*channel-transformed* contents, because the upstream manifest is deliberately
rewritten (no top-level `surfaces`, pin clause pointing at the fork build).

The checks live here instead of inline in the workflow so the packaging tests
can exercise them offline: see `test/release_assets_test.py`. The workflow calls
`verify()` and `release_notes()`, so the published set is the set the tests
describe.

Two channels are the same source plus one build-time constant, so they are kept
distinguishable by filename *and* by the `PLUGIN_CHANNEL` marker inside each
archive; `verify()` refuses a set where either disagrees.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CHANNELS = ("upstream", "fork")
ARTEFACT = "decaid-e64ws-plugin-{version}{suffix}.zip"
CHANNEL_MARKER = re.compile(r'const PLUGIN_CHANNEL = "(upstream|fork)";')


def load_packager(root=ROOT):
    """Load `scripts/package-plugin.py`, which is a script rather than a package."""
    path = Path(root) / "scripts" / "package-plugin.py"
    spec = importlib.util.spec_from_file_location("release_assets_packager", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def archive_name(version, channel, packager=None):
    """The filename `package-plugin.py` gives `channel` at `version`."""
    packager = packager or load_packager()
    return ARTEFACT.format(version=version, suffix="" if channel == "upstream" else "-fork")


def expected_contents(root, channel, packager=None):
    """The contents `channel` must have, computed from the tested source tree."""
    root = Path(root)
    packager = packager or load_packager(root)
    files = {name: (root / name).read_bytes() for name in packager.FILES}
    contents, _suffix = packager.apply_channel(files, channel)
    return contents


def assert_documented_manifest_diff(upstream, fork, packager=None):
    """The only two differences two channels may have in `manifest.json`.

    #28 documented exactly these: the upstream artefact drops the top-level
    `surfaces` block that no Decaid build parses, and its `InstancesJson`
    description says pinning works on the fork build. Any further drift between
    the channels is a release error rather than a detail, so it is asserted
    instead of assumed.
    """
    packager = packager or load_packager()
    if "surfaces" in upstream:
        raise ValueError(
            "the upstream artefact must not ship a top-level surfaces block: no Decaid build parses one"
        )
    if "surfaces" not in fork:
        raise ValueError("the fork artefact must keep the surfaces block the source tree declares")

    def outside_settings(manifest):
        return {key: value for key, value in manifest.items() if key not in ("surfaces", "settings")}

    upstream_rest, fork_rest = outside_settings(upstream), outside_settings(fork)
    differing = sorted(key for key in set(upstream_rest) | set(fork_rest) if upstream_rest.get(key) != fork_rest.get(key))
    if differing:
        raise ValueError("the two artefacts differ outside settings in: " + ", ".join(differing))

    upstream_settings, fork_settings = upstream.get("settings", {}), fork.get("settings", {})
    if set(upstream_settings) != set(fork_settings):
        raise ValueError("the two artefacts declare different settings keys")
    for key in upstream_settings:
        if key == "InstancesJson":
            continue
        if upstream_settings[key] != fork_settings[key]:
            raise ValueError(f"the two artefacts differ in the {key} setting")

    upstream_instance = dict(upstream_settings.get("InstancesJson", {}))
    fork_instance = dict(fork_settings.get("InstancesJson", {}))
    upstream_description = upstream_instance.pop("description", None)
    fork_description = fork_instance.pop("description", None)
    if upstream_instance != fork_instance:
        raise ValueError("the two artefacts differ in the InstancesJson setting beyond its description")
    rewrite = packager.PIN_CLAUSE.sub(packager.PIN_CLAUSE_UPSTREAM, fork_description or "")
    if upstream_description != rewrite:
        raise ValueError(
            "the upstream InstancesJson description is not the documented rewrite of the fork one "
            "(the pin clause must point at the fork build)"
        )


def verify(dist, root=ROOT):
    """Return one entry per channel, or raise. Publishing depends on this.

    Each archive must be exactly what this source tree produces for its channel,
    carry the `PLUGIN_CHANNEL` its filename claims, and hold a manifest whose
    version is the manifest version. Both channels are required: a release that
    promises two artefacts but attaches one is refused here rather than noticed
    afterwards.
    """
    root, dist = Path(root), Path(dist)
    packager = load_packager(root)
    version = json.loads((root / "manifest.json").read_text())["version"]
    archives = sorted(dist.glob("*.zip"))
    if len(archives) != 2:
        found = ", ".join(archive.name for archive in archives) or "none"
        raise ValueError(
            f"a release must attach exactly two archives, one per channel; found {len(archives)} ({found})"
        )

    by_name = {archive.name: archive for archive in archives}
    entries, manifests = [], {}
    for channel in CHANNELS:
        name = archive_name(version, channel, packager)
        if name not in by_name:
            raise ValueError(f"the {channel} channel artefact {name} is missing from {dist}")
        archive = by_name[name]
        contents = expected_contents(root, channel, packager)
        with zipfile.ZipFile(archive) as package:
            names = package.namelist()
            if sorted(names) != sorted(packager.FILES):
                raise ValueError(f"{name} carries {sorted(names)}, expected {sorted(packager.FILES)}")
            if package.testzip() is not None:
                raise ValueError(f"{name} is not a readable ZIP archive")
            marker = CHANNEL_MARKER.search(package.read("plugin.js").decode("utf-8"))
            if marker is None:
                raise ValueError(f"{name} carries no PLUGIN_CHANNEL marker")
            if marker.group(1) != channel:
                raise ValueError(
                    f"{name} is baked for the {marker.group(1)} channel but its filename claims {channel}"
                )
            manifest = json.loads(package.read("manifest.json"))
            if manifest.get("version") != version:
                raise ValueError(f"{name} reports version {manifest.get('version')}, not {version}")
            for entry, expected in contents.items():
                if package.read(entry) != expected:
                    raise ValueError(
                        f"{name}: {entry} is not what this source tree produces for the {channel} channel"
                    )
        manifests[channel] = manifest
        entries.append({
            "name": name,
            "channel": channel,
            "size": archive.stat().st_size,
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        })

    assert_documented_manifest_diff(manifests["upstream"], manifests["fork"], packager)
    return entries


def release_notes(entries, version):
    """The release body, generated from the verified entries rather than by hand."""
    by_channel = {entry["channel"]: entry for entry in entries}
    upstream, fork = by_channel["upstream"], by_channel["fork"]
    return (
        "Install **one** of the two ZIPs below through Decaid's plugin installer, or point the "
        "installer at this repository.\n\n"
        f"- `{upstream['name']}` — for **upstream Decaid** (`decentespresso/decaid`). It carries no "
        "fork-only facility: no `tlsPinSha256`, no `responseType`, no setup-surface block.\n"
        f"- `{fork['name']}` — for the **fork** (`MaxRink/decaid`), which honours certificate pinning "
        "and the machine-log ZIP download.\n\n"
        f"The tag matches manifest version {version}. Both archives were cut from this one tag, and "
        "each one's `PLUGIN_CHANNEL` constant, filename and contents were checked against the tree "
        "that passed CI. The two manifests differ only in the documented way: the upstream artefact "
        "drops the top-level `surfaces` block and points the `certSha256` clause at the fork build.\n\n"
        "Physical hardware and firmware compatibility remain unvalidated; CI uses synthetic devices "
        "and cannot establish physical-device support.\n\n"
        f"SHA-256 (`{upstream['name']}`): `{upstream['sha256']}`\n\n"
        f"SHA-256 (`{fork['name']}`): `{fork['sha256']}`\n"
    )
