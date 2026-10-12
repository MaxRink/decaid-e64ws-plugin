#!/usr/bin/env python3
"""Build the minimal plugin archive accepted by Decaid's installer."""
import argparse
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ("manifest.json", "plugin.js", "README.md", "NOTICE", "LICENSE")


def build(root, tag=None):
    version = json.loads((root / "manifest.json").read_text())["version"]
    if not re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version):
        raise ValueError("manifest version must be a stable semantic version")
    if json.loads((root / "package.json").read_text())["version"] != version:
        raise ValueError("package and manifest versions must match")
    lock = json.loads((root / "package-lock.json").read_text())
    if lock.get("version") != version or lock.get("packages", {}).get("", {}).get("version") != version:
        raise ValueError("lockfile and manifest versions must match")
    if tag is not None and tag.removeprefix("v") != version:
        raise ValueError("release tag must match the manifest version")
    contents = {name: (root / name).read_bytes() for name in FILES}
    output = root / "dist"
    output.mkdir(exist_ok=True)
    archive = output / f"decaid-e64ws-plugin-{version}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
        for name, content in contents.items():
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, content)
    with zipfile.ZipFile(archive) as package:
        if set(package.namelist()) != set(FILES) or package.testzip() is not None:
            raise ValueError("invalid plugin archive")
    for stale in output.glob("decaid-e64ws-plugin-*.zip"):
        if stale != archive:
            stale.unlink()
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Require this release tag to match the manifest")
    args = parser.parse_args()
    print(build(ROOT, args.tag))
