import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    "packager", Path(__file__).resolve().parents[1] / "scripts/package-plugin.py"
)
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in packager.FILES:
            (self.root / name).write_text("runtime " + name)
        for name in ("manifest.json", "package.json"):
            (self.root / name).write_text(json.dumps({"version": "0.3.0"}))
        (self.root / "docs").mkdir()
        (self.root / "docs/plot.svg").write_text("not runtime")

    def test_minimal_archive_is_deterministic_and_round_trips_runtime(self):
        archive = packager.build(self.root, "v0.3.0")
        first = archive.read_bytes()
        self.assertEqual(first, packager.build(self.root, "0.3.0").read_bytes())
        with zipfile.ZipFile(archive) as package:
            self.assertEqual(set(package.namelist()), set(packager.FILES))
            for name in packager.FILES:
                self.assertEqual(package.read(name), (self.root / name).read_bytes())

    def test_mismatched_tag_is_rejected_before_archive_creation(self):
        with self.assertRaisesRegex(ValueError, "release tag"):
            packager.build(self.root, "v0.4.0")
        self.assertFalse((self.root / "dist").exists())

    def test_mismatched_package_version_is_rejected(self):
        (self.root / "package.json").write_text('{"version":"0.4.0"}')
        with self.assertRaisesRegex(ValueError, "package and manifest"):
            packager.build(self.root)

    def test_prerelease_and_leading_zero_versions_are_rejected(self):
        for version in ("0.4.0-rc.1", "00.4.0"):
            with self.subTest(version=version):
                (self.root / "manifest.json").write_text(json.dumps({"version": version}))
                with self.assertRaisesRegex(ValueError, "stable semantic version"):
                    packager.build(self.root)

    def test_version_change_removes_only_older_plugin_archives(self):
        previous = packager.build(self.root)
        unrelated = self.root / "dist/unrelated.zip"
        unrelated.write_bytes(b"keep")
        for name in ("manifest.json", "package.json"):
            (self.root / name).write_text(json.dumps({"version": "0.4.0"}))
        current = packager.build(self.root)
        self.assertFalse(previous.exists())
        self.assertTrue(current.exists())
        self.assertEqual(unrelated.read_bytes(), b"keep")

    def test_missing_runtime_file_does_not_leave_an_archive(self):
        (self.root / "plugin.js").unlink()
        with self.assertRaises(FileNotFoundError):
            packager.build(self.root)
        self.assertFalse((self.root / "dist").exists())


if __name__ == "__main__":
    unittest.main()
