"""The publish step must attach one archive per channel, each the tested one.

These exercise `scripts/release_assets.py` offline, plus the shape of
`.github/workflows/release.yml` and `ci.yml`, so a future edit cannot quietly go
back to publishing a single archive or to an archive whose `PLUGIN_CHANNEL`
disagrees with its filename.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

try:
    import yaml
except ImportError:  # the text-level guards below still run without it
    yaml = None

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_assets", ROOT / "scripts/release_assets.py")
release_assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_assets)
packager = release_assets.load_packager(ROOT)
WORKFLOW = (ROOT / ".github/workflows/release.yml").read_text()
CI = (ROOT / ".github/workflows/ci.yml").read_text()


class ReleaseSetTests(unittest.TestCase):
    """Every case builds a real tree, so the expected contents are never guessed."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in packager.FILES:
            (self.root / name).write_bytes((ROOT / name).read_bytes())
        self.version = json.loads((self.root / "manifest.json").read_text())["version"]
        for name in ("package.json",):
            (self.root / name).write_text(json.dumps({"version": self.version}))
        (self.root / "package-lock.json").write_text(
            json.dumps({"version": self.version, "packages": {"": {"version": self.version}}})
        )
        (self.root / "scripts").mkdir()
        shutil.copy(ROOT / "scripts/package-plugin.py", self.root / "scripts/package-plugin.py")
        self.dist = self.root / "dist"
        self.dist.mkdir()

    def cut(self, channel):
        return packager.build(self.root, None, channel)

    def cut_both(self):
        return self.cut("upstream"), self.cut("fork")

    def rewrite(self, archive, name, content):
        """Replace one entry, leaving a valid ZIP that no longer matches the tree."""
        with zipfile.ZipFile(archive) as package:
            entries = {entry: package.read(entry) for entry in package.namelist()}
        entries[name] = content
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
            for entry, value in entries.items():
                package.writestr(entry, value)

    def test_both_channels_verify_with_their_own_marker(self):
        self.cut_both()
        entries = release_assets.verify(self.dist, self.root)
        self.assertEqual(len(entries), 2, "one entry per channel")
        self.assertEqual([entry["channel"] for entry in entries], ["upstream", "fork"])
        for entry in entries:
            self.assertEqual(entry["name"], release_assets.archive_name(self.version, entry["channel"], packager))
            archive = self.dist / entry["name"]
            self.assertEqual(entry["size"], archive.stat().st_size)
            self.assertRegex(entry["sha256"], r"^[0-9a-f]{64}$")
            self.assertIn(f"PLUGIN_CHANNEL = \"{entry['channel']}\"", zipfile.ZipFile(archive).read("plugin.js").decode())

    def test_a_single_archive_is_refused(self):
        self.cut("upstream")
        with self.assertRaisesRegex(ValueError, "exactly two archives"):
            release_assets.verify(self.dist, self.root)

    def test_a_missing_fork_archive_is_refused(self):
        _upstream, fork = self.cut_both()
        fork.unlink()
        self.cut("upstream")
        with self.assertRaisesRegex(ValueError, "exactly two archives"):
            release_assets.verify(self.dist, self.root)

    def test_an_archive_baked_for_the_other_channel_is_refused(self):
        upstream, fork = self.cut_both()
        fork.write_bytes(upstream.read_bytes())
        with self.assertRaisesRegex(ValueError, "is baked for the upstream channel but its filename claims fork"):
            release_assets.verify(self.dist, self.root)

    def test_an_archive_that_differs_from_the_tested_source_is_refused(self):
        _upstream, fork = self.cut_both()
        self.rewrite(fork, "README.md", b"not the tested README\n")
        with self.assertRaisesRegex(ValueError, "README.md is not what this source tree produces"):
            release_assets.verify(self.dist, self.root)

    def test_a_manifest_version_from_another_tree_is_refused(self):
        _upstream, fork = self.cut_both()
        manifest = json.loads(zipfile.ZipFile(fork).read("manifest.json"))
        manifest["version"] = "9.9.9"
        self.rewrite(fork, "manifest.json", json.dumps(manifest).encode())
        with self.assertRaisesRegex(ValueError, "reports version 9.9.9, not"):
            release_assets.verify(self.dist, self.root)

    def test_a_zip_with_an_extra_entry_is_refused(self):
        _upstream, fork = self.cut_both()
        with zipfile.ZipFile(fork, "a") as package:
            package.writestr("debug.log", b"noise")
        with self.assertRaisesRegex(ValueError, "carries"):
            release_assets.verify(self.dist, self.root)


class DocumentedManifestDiffTests(unittest.TestCase):
    """The two channels may differ in exactly two manifest places, and no more."""

    def manifests(self):
        return (
            json.loads(release_assets.expected_contents(ROOT, "upstream", packager)["manifest.json"]),
            json.loads(release_assets.expected_contents(ROOT, "fork", packager)["manifest.json"]),
        )

    def test_the_shipped_tree_only_differs_in_the_documented_way(self):
        upstream, fork = self.manifests()
        release_assets.assert_documented_manifest_diff(upstream, fork, packager)

    def test_a_drift_outside_settings_is_named(self):
        upstream, fork = self.manifests()
        fork["permissions"] = [*fork["permissions"], "network.http"]
        with self.assertRaisesRegex(ValueError, "differ outside settings in: permissions"):
            release_assets.assert_documented_manifest_diff(upstream, fork, packager)

    def test_a_drift_in_another_setting_is_named(self):
        upstream, fork = self.manifests()
        fork["settings"]["MintTokens"]["default"] = "true"
        with self.assertRaisesRegex(ValueError, "differ in the MintTokens setting"):
            release_assets.assert_documented_manifest_diff(upstream, fork, packager)

    def test_a_pin_clause_that_is_not_the_documented_rewrite_is_refused(self):
        upstream, fork = self.manifests()
        upstream["settings"]["InstancesJson"]["description"] = "pinning works everywhere"
        with self.assertRaisesRegex(ValueError, "documented rewrite"):
            release_assets.assert_documented_manifest_diff(upstream, fork, packager)

    def test_an_upstream_artefact_that_keeps_the_setup_surface_is_refused(self):
        upstream, fork = self.manifests()
        upstream["surfaces"] = fork["surfaces"]
        with self.assertRaisesRegex(ValueError, "must not ship a top-level surfaces block"):
            release_assets.assert_documented_manifest_diff(upstream, fork, packager)


class ReleaseNotesTests(unittest.TestCase):
    def test_the_notes_name_both_artefacts_and_which_host_each_is_for(self):
        entries = [
            {"name": "decaid-e64ws-plugin-0.8.0.zip", "channel": "upstream", "size": 1, "sha256": "a" * 64},
            {"name": "decaid-e64ws-plugin-0.8.0-fork.zip", "channel": "fork", "size": 2, "sha256": "b" * 64},
        ]
        notes = release_assets.release_notes(entries, "0.8.0")
        for entry in entries:
            self.assertIn(entry["name"], notes)
            self.assertIn(entry["sha256"], notes)
        self.assertIn("upstream Decaid", notes)
        self.assertIn("fork", notes)
        self.assertIn("0.8.0", notes)

    def test_both_hashes_published_come_from_the_verified_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in packager.FILES:
                (root / name).write_bytes((ROOT / name).read_bytes())
            version = json.loads((root / "manifest.json").read_text())["version"]
            (root / "package.json").write_text(json.dumps({"version": version}))
            (root / "package-lock.json").write_text(
                json.dumps({"version": version, "packages": {"": {"version": version}}})
            )
            (root / "scripts").mkdir()
            shutil.copy(ROOT / "scripts/package-plugin.py", root / "scripts/package-plugin.py")
            packager.build(root, None, "upstream")
            packager.build(root, None, "fork")
            entries = release_assets.verify(root / "dist", root)
        notes = release_assets.release_notes(entries, version)
        for entry in entries:
            self.assertIn(entry["sha256"], notes)


class WorkflowShapeTests(unittest.TestCase):
    """Text-level guards on the workflows, because a workflow is not importable."""

    def test_the_release_publishes_every_archive_the_checks_uploaded(self):
        self.assertIn("gh release create \"$GITHUB_REF_NAME\" dist/*.zip", WORKFLOW)
        self.assertIn("release_assets.verify", WORKFLOW)
        self.assertNotIn("len(archives) == 1", WORKFLOW, "publish must not assume a single archive")
        self.assertNotIn("exactly one plugin ZIP is required", WORKFLOW)

    def test_the_node_job_cuts_both_channels_before_uploading(self):
        self.assertIn("npm run package -- --channel fork", CI)
        upload = CI.index("name: decaid-e64ws-plugin-${{ github.sha }}")
        self.assertLess(CI.index("--channel fork"), upload, "both cuts happen before the upload")
        self.assertIn("path: dist/*.zip", CI)

    def test_the_publish_step_asserts_the_tag_matches_the_manifest(self):
        self.assertIn("removeprefix('v') == version", WORKFLOW)

    def test_ci_runs_the_release_asset_tests(self):
        self.assertIn("release_assets_test.py", CI)

    def test_ci_reuses_the_same_module_on_pull_requests(self):
        self.assertIn("release_assets.verify", CI, "upstream-channel runs the publish check on every PR")


@unittest.skipIf(yaml is None, "PyYAML is absent; the publish step is still checked textually above")
class PublishStepRuntimeTests(unittest.TestCase):
    """Runs the workflow's own publish script against a stub `gh`.

    The text guards above prove the workflow says the right thing; this proves the
    script it would execute attaches two archives when handed two, because the
    assertion is the module and the module is what this test cuts from.
    """

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in packager.FILES:
            (self.root / name).write_bytes((ROOT / name).read_bytes())
        version = json.loads((self.root / "manifest.json").read_text())["version"]
        self.version = version
        (self.root / "package.json").write_text(json.dumps({"version": version}))
        (self.root / "package-lock.json").write_text(
            json.dumps({"version": version, "packages": {"": {"version": version}}})
        )
        (self.root / "scripts").mkdir()
        for name in ("package-plugin.py", "release_assets.py"):
            shutil.copy(ROOT / "scripts" / name, self.root / "scripts" / name)
        packager.build(self.root, None, "upstream")
        packager.build(self.root, None, "fork")

    def publish_script(self):
        workflow = yaml.safe_load(WORKFLOW)
        return workflow["jobs"]["publish"]["steps"][-1]["run"]

    def test_the_publish_step_attaches_both_archives(self):
        record = self.root / "gh-argv.txt"
        stub_dir = self.root / "bin"
        stub_dir.mkdir()
        stub = stub_dir / "gh"
        stub.write_text(f'#!/usr/bin/env bash\nprintf "%s\\n" "$@" > {record}\n')
        stub.chmod(0o755)
        env = dict(os.environ, PATH=f"{stub_dir}{os.pathsep}{os.environ['PATH']}", GITHUB_REF_NAME=f"v{self.version}")
        result = subprocess.run(
            ["bash"], input=self.publish_script(), text=True, capture_output=True, cwd=self.root, env=env
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        attached = sorted(
            Path(arg).name for arg in record.read_text().splitlines() if arg.endswith(".zip")
        )
        self.assertEqual(
            attached,
            sorted(
                release_assets.archive_name(self.version, channel, packager) for channel in ("upstream", "fork")
            ),
            "the publish command must attach one archive per channel",
        )
        self.assertEqual(record.read_text().splitlines()[:2], ["release", "create"])
        notes = (self.root / "release-notes.md").read_text()
        for name in attached:
            self.assertIn(name, notes, "the generated notes name every attached archive")

    def test_the_publish_step_refuses_a_single_archive(self):
        (self.root / "dist" / release_assets.archive_name(self.version, "fork", packager)).unlink()
        stub_dir = self.root / "bin"
        stub_dir.mkdir()
        stub = stub_dir / "gh"
        stub.write_text("#!/usr/bin/env bash\nexit 0\n")
        stub.chmod(0o755)
        env = dict(os.environ, PATH=f"{stub_dir}{os.pathsep}{os.environ['PATH']}", GITHUB_REF_NAME=f"v{self.version}")
        result = subprocess.run(
            ["bash"], input=self.publish_script(), text=True, capture_output=True, cwd=self.root, env=env
        )
        self.assertNotEqual(result.returncode, 0, "publishing must stop when a channel is missing")
        self.assertIn("exactly two archives", result.stderr)
        self.assertFalse((self.root / "release-notes.md").exists(), "nothing is written for a partial set")


if __name__ == "__main__":
    unittest.main()
