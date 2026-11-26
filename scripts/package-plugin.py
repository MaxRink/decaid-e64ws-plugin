#!/usr/bin/env python3
"""Build the minimal plugin archive accepted by Decaid's installer.

Two release channels are cut from this one source tree:

  --channel upstream (default)  the artefact that runs on decentespresso/decaid.
                                It carries no fork-only facility: the plugin
                                never sends tlsPinSha256 and the manifest does
                                not advertise certificate pinning.
  --channel fork                the same code with the fork-only facilities
                                enabled, as a separate file.

Neither channel changes behaviour at runtime: the channel is a build-time
constant rewritten in plugin.js, so a fork-only capability is an explicit
artefact rather than a hidden switch. See docs/UPSTREAM_COMPATIBILITY.md.
"""
import argparse
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ("manifest.json", "plugin.js", "README.md", "NOTICE", "LICENSE")

CHANNELS = ("upstream", "fork")
CHANNEL_MARKER = 'const PLUGIN_CHANNEL = "{}"; /* package-plugin:channel */'

# The one phrase in the manifest that offers certificate pinning. Match the
# `certSha256 (...)` parenthetical rather than the whole sentence, so a rename
# such as #26 ("E64 certificate" -> "grinder certificate") cannot silently break
# the upstream artefact. On the upstream channel the offer must not read as a
# facility the host provides.
PIN_CLAUSE = re.compile(r"optional certSha256 \([^)]*\)")
PIN_CLAUSE_UPSTREAM = (
    "optional certSha256 (SHA-256 of the grinder certificate; pinning only works "
    "on the fork build, see docs/UPSTREAM_COMPATIBILITY.md)"
)


def _rewrite_channel(source, channel):
    """Return plugin.js with its single channel marker set to `channel`."""
    marker = CHANNEL_MARKER.format
    found = [name for name in CHANNELS if marker(name) in source]
    if len(found) != 1:
        raise ValueError(
            "plugin.js must carry exactly one package-plugin:channel marker, "
            f"found {found}"
        )
    return source.replace(marker(found[0]), marker(channel))


def _upstream_manifest(raw):
    """Return the manifest an upstream host must see."""
    manifest = json.loads(raw)
    # No Decaid build parses a top-level `surfaces` block (only a driver's own
    # surfaces are read), so shipping one advertises a setup surface that is
    # never rendered. Drop it instead of implying it works.
    manifest.pop("surfaces", None)
    instance = manifest.get("settings", {}).get("InstancesJson", {})
    description = instance.get("description", "")
    if not PIN_CLAUSE.search(description):
        raise ValueError("the InstancesJson description no longer offers certSha256")
    # Rewrite every matching parenthetical, so a duplicated clause cannot slip through.
    instance["description"] = PIN_CLAUSE.sub(PIN_CLAUSE_UPSTREAM, description)
    return (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def apply_channel(files, channel):
    """Return (contents, filename suffix) for `channel`.

    `channel=None` ships the tree exactly as it is, which is what the packaging
    tests assert; the CLI always passes an explicit channel.
    """
    if channel is None:
        return dict(files), ""
    if channel not in CHANNELS:
        raise ValueError(f"unknown release channel: {channel}")
    contents = dict(files)
    source = contents["plugin.js"].decode("utf-8")
    contents["plugin.js"] = _rewrite_channel(source, channel).encode("utf-8")
    if channel == "upstream":
        contents["manifest.json"] = _upstream_manifest(contents["manifest.json"])
    return contents, "" if channel == "upstream" else "-fork"


def build(root, tag=None, channel=None):
    version = json.loads((root / "manifest.json").read_text())["version"]
    if not re.fullmatch(r"(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2}", version):
        raise ValueError("manifest version must be a stable semantic version")
    if json.loads((root / "package.json").read_text())["version"] != version:
        raise ValueError("package and manifest versions must match")
    lock = json.loads((root / "package-lock.json").read_text())
    if lock.get("version") != version or lock.get("packages", {}).get("", {}).get("version") != version:
        raise ValueError("lockfile and manifest versions must match")
    if tag is not None and tag.removeprefix("v") != version:
        raise ValueError("release tag must match the manifest version")
    contents, suffix = apply_channel(
        {name: (root / name).read_bytes() for name in FILES}, channel
    )
    output = root / "dist"
    output.mkdir(exist_ok=True)
    archive = output / f"decaid-e64ws-plugin-{version}{suffix}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
        for name, content in contents.items():
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, content)
    with zipfile.ZipFile(archive) as package:
        if set(package.namelist()) != set(FILES) or package.testzip() is not None:
            raise ValueError("invalid plugin archive")
    # Keep both channels on disk: a release cut for one channel must not delete
    # the other channel's artefact.
    for stale in output.glob("decaid-e64ws-plugin-*.zip"):
        if stale == archive:
            continue
        if suffix == "" and stale.name.endswith("-fork.zip"):
            continue
        if suffix == "-fork" and not stale.name.endswith("-fork.zip"):
            continue
        stale.unlink()
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tag", help="Require this release tag to match the manifest")
    parser.add_argument(
        "--channel",
        choices=CHANNELS,
        default="upstream",
        help="Release channel to cut (default: upstream)",
    )
    args = parser.parse_args()
    print(build(ROOT, args.tag, args.channel))
