"""The two release channels are one source and one switch.

The upstream artefact must not advertise or send anything a Decaid build cannot
honour; the fork artefact keeps the fork-only facilities. Both must be cut from
the same tree without editing it, and they must coexist in dist/.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("packager", ROOT / "scripts/package-plugin.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)

MARKER = 'const PLUGIN_CHANNEL = "{}"; /* package-plugin:channel */'
# The wording #26 left behind after renaming "E64" to "grinder". The packager
# matches the parenthetical by pattern, not by this literal, so a further
# rename cannot silently disable the rewrite.
PIN_CLAUSE = "optional certSha256 (pinned SHA-256 of the grinder certificate)"


class ChannelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.real = {name: (ROOT / name).read_bytes() for name in packager.FILES}
        for name, content in self.real.items():
            (self.root / name).write_bytes(content)
        for name in ("package.json",):
            (self.root / name).write_text(json.dumps({"version": "0.8.1"}))
        (self.root / "package-lock.json").write_text(
            json.dumps({"version": "0.8.1", "packages": {"": {"version": "0.8.1"}}})
        )

    def cut(self, channel):
        return packager.build(self.root, None, channel)

    def contents(self, archive):
        with zipfile.ZipFile(archive) as package:
            return {name: package.read(name) for name in package.namelist()}

    def test_no_channel_ships_the_tree_unchanged(self):
        files, suffix = packager.apply_channel(self.real, None)
        self.assertEqual(files, self.real)
        self.assertEqual(suffix, "")

    def test_upstream_channel_rewrites_the_constant_and_drops_fork_only_claims(self):
        files, suffix = packager.apply_channel(self.real, "upstream")
        self.assertEqual(suffix, "")
        source = files["plugin.js"].decode()
        self.assertIn(MARKER.format("upstream"), source)
        self.assertNotIn(MARKER.format("fork"), source)
        manifest = json.loads(files["manifest.json"])
        # No Decaid build parses a top-level surfaces block, so the upstream
        # artefact does not ship one.
        self.assertNotIn("surfaces", manifest)
        description = manifest["settings"]["InstancesJson"]["description"]
        self.assertNotIn(PIN_CLAUSE, description)
        self.assertIn("pinning only works on the fork build", description)
        # A driver's own surfaces are parsed by every ref and must be kept.
        for driver in manifest["drivers"]:
            self.assertEqual([surface["role"] for surface in driver["surfaces"]], ["diagnostics"])

    def test_fork_channel_keeps_the_fork_constant_and_the_manifest(self):
        files, suffix = packager.apply_channel(self.real, "fork")
        self.assertEqual(suffix, "-fork")
        self.assertIn(MARKER.format("fork"), files["plugin.js"].decode())
        self.assertEqual(files["manifest.json"], self.real["manifest.json"])

    def test_each_channel_is_a_different_artefact_on_disk(self):
        upstream = self.cut("upstream")
        fork = self.cut("fork")
        self.assertEqual(upstream.name, "decaid-e64ws-plugin-0.8.1.zip")
        self.assertEqual(fork.name, "decaid-e64ws-plugin-0.8.1-fork.zip")
        self.assertTrue(upstream.exists() and fork.exists(), "cutting one channel keeps the other")
        self.assertNotEqual(upstream.read_bytes(), fork.read_bytes())
        self.assertIn(MARKER.format("upstream"), self.contents(upstream)["plugin.js"].decode())
        self.assertIn(MARKER.format("fork"), self.contents(fork)["plugin.js"].decode())

    def test_a_missing_channel_marker_is_refused_rather_than_guessed(self):
        files = dict(self.real)
        files["plugin.js"] = b"// no marker here\n"
        with self.assertRaisesRegex(ValueError, "package-plugin:channel"):
            packager.apply_channel(files, "fork")

    def test_an_unknown_channel_is_refused(self):
        with self.assertRaisesRegex(ValueError, "unknown release channel"):
            packager.apply_channel(self.real, "beta")

    def test_the_upstream_pin_wording_is_checked_not_assumed(self):
        manifest = json.loads(self.real["manifest.json"])
        manifest["settings"]["InstancesJson"]["description"] = "no pin mentioned"
        files = dict(self.real)
        files["manifest.json"] = json.dumps(manifest).encode()
        with self.assertRaisesRegex(ValueError, "certSha256"):
            packager.apply_channel(files, "upstream")

    def test_the_pin_offer_is_rewritten_whatever_the_noun_is(self):
        # #26 renamed "E64" to "grinder" in exactly this phrase. The packager
        # matches the certSha256 parenthetical by pattern, so a later rename
        # cannot silently disable the upstream rewrite.
        for noun in ("grinder", "E64", "mill", "device"):
            with self.subTest(noun=noun):
                manifest = json.loads(self.real["manifest.json"])
                manifest["settings"]["InstancesJson"]["description"] = (
                    f"JSON array of id, host, optional certSha256 (pinned SHA-256 of the {noun} certificate) and port."
                )
                files = dict(self.real)
                files["manifest.json"] = json.dumps(manifest).encode()
                rewritten, _ = packager.apply_channel(files, "upstream")
                description = json.loads(rewritten["manifest.json"])["settings"]["InstancesJson"]["description"]
                self.assertNotIn(f"pinned SHA-256 of the {noun} certificate", description)
                self.assertIn("pinning only works on the fork build", description)

    def test_the_upstream_transform_leaves_every_label_alone(self):
        # The transform owns the pin offer and the inert surfaces block, nothing
        # else. Renamed labels (and any future rename) pass through untouched.
        files, _ = packager.apply_channel(self.real, "upstream")
        manifest = json.loads(files["manifest.json"])
        source = json.loads(self.real["manifest.json"])
        self.assertEqual(manifest["name"], source["name"])
        self.assertEqual(manifest["description"], source["description"])
        for key, schema in source["settings"].items():
            for field in ("label", "type", "values", "default", "hidden", "advanced", "secure", "valueLabels"):
                if field in schema:
                    self.assertEqual(manifest["settings"][key][field], schema[field], f"{key}.{field}")
        for got, want in zip(manifest["drivers"], source["drivers"]):
            self.assertEqual(got["surfaces"], want["surfaces"], "driver surface labels are untouched")
        self.assertEqual(manifest["api"], source["api"])

    def test_neither_artefact_can_send_responseType_off_the_fork_channel(self):
        # One source, one gate, opposite constant: the fork resolves the same
        # expression to true, so the two artefacts cannot drift apart here.
        gate = '...(FORK_BUILD ? {responseType: "base64"} : {})'
        for channel, constant in (("upstream", "upstream"), ("fork", "fork")):
            with self.subTest(channel=channel):
                files, _ = packager.apply_channel(self.real, channel)
                js = files["plugin.js"].decode()
                self.assertEqual(js.count('responseType: "base64"'), 1, channel)
                self.assertIn(gate, js, channel)
                self.assertIn(f'const PLUGIN_CHANNEL = "{constant}"; /* package-plugin:channel */', js, channel)
                self.assertIn('const FORK_BUILD = PLUGIN_CHANNEL === "fork";', js, channel)

    def test_the_pin_has_exactly_one_construction_point(self):
        # Every fetch/timeline pin goes through pinOption(), so the channel and
        # the host verdict cannot be bypassed by a stray literal.
        files, _ = packager.apply_channel(self.real, "upstream")
        js = files["plugin.js"].decode()
        self.assertEqual(js.count("{tlsPinSha256: pin}"), 1, "pinOption is the only constructor")
        self.assertIn("function pinOption(pin) { return pin && !pinRefused() ? {tlsPinSha256: pin} : {}; }", js)


if __name__ == "__main__":
    unittest.main()
