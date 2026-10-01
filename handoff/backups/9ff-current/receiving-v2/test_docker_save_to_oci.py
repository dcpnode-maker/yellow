import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest

import docker_save_to_oci as converter


def sha(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


class ConverterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.raw_layers = [b"layer-one\n", b"layer-two\n"]
        self.diffids = [sha(x) for x in self.raw_layers]
        self.config = json.dumps({
            "architecture": "amd64", "os": "linux",
            "rootfs": {"type": "layers", "diff_ids": self.diffids},
            "config": {"Env": ["SECRET_TEST_SENTINEL=do-not-read"]},
        }, separators=(",", ":")).encode()
        self.config_id = sha(self.config)
        self.docker_tar = self.root / "docker-save.tar"
        self._make_docker(self.docker_tar)

    def tearDown(self):
        self.tmp.cleanup()

    def _make_docker(self, path, layers=None, config=None, manifest_override=None,
                     extra_members=()):
        layers = self.raw_layers if layers is None else layers
        config = self.config if config is None else config
        entries = {"config.json": config}
        refs = []
        for i, layer in enumerate(layers):
            ref = f"{i}/layer.tar"
            refs.append(ref)
            entries[ref] = layer
        manifest = [{"Config": "config.json", "RepoTags": ["yellow-managed:test"], "Layers": refs}]
        if manifest_override is not None:
            manifest = manifest_override
        entries["manifest.json"] = json.dumps(manifest).encode()
        entries.update(dict(extra_members))
        with tarfile.open(path, "w") as tf:
            for name, body in entries.items():
                info = tarfile.TarInfo(name)
                info.size = len(body)
                tf.addfile(info, io.BytesIO(body))

    def _convert(self, out, input_path=None, config_id=None, diffids=None):
        return converter.convert(input_path or self.docker_tar, out,
                                 config_id or self.config_id,
                                 self.diffids if diffids is None else diffids)

    def test_valid_conversion_is_reproducible_and_reconstructs_contents(self):
        out1, out2 = self.root / "out1", self.root / "out2"
        result1 = self._convert(out1)
        result2 = self._convert(out2)
        self.assertEqual(result1["manifestDigest"], result2["manifestDigest"])
        self.assertEqual(result1["indexSha256"], result2["indexSha256"])
        index = json.loads((out1 / "index.json").read_bytes())
        self.assertNotIn("annotations", index["manifests"][0])
        self.assertIsNone(result1["sourceRevision"])
        manifest_desc = index["manifests"][0]
        manifest_bytes = (out1 / "blobs/sha256" / manifest_desc["digest"][7:]).read_bytes()
        self.assertEqual(sha(manifest_bytes), manifest_desc["digest"])
        manifest = json.loads(manifest_bytes)
        config_desc = manifest["config"]
        config_bytes = (out1 / "blobs/sha256" / config_desc["digest"][7:]).read_bytes()
        self.assertEqual(config_bytes, self.config)
        self.assertEqual(sha(config_bytes), self.config_id)
        for desc, expected in zip(manifest["layers"], self.raw_layers):
            encoded = (out1 / "blobs/sha256" / desc["digest"][7:]).read_bytes()
            self.assertEqual(desc["mediaType"], converter.OCI_LAYER_GZIP)
            self.assertEqual(gzip.decompress(encoded), expected)
            self.assertEqual(sha(gzip.decompress(encoded)), self.diffids[manifest["layers"].index(desc)])
            self.assertEqual(encoded, (out2 / "blobs/sha256" / desc["digest"][7:]).read_bytes())
        self.assertNotIn(b"SECRET_TEST_SENTINEL", json.dumps(result1).encode())

    def test_accepts_oci_input_and_revalidates_descriptors(self):
        converted = self.root / "first"
        self._convert(converted)
        archive = self.root / "oci.tar"
        with tarfile.open(archive, "w") as tf:
            for path in sorted(converted.rglob("*")):
                name = path.relative_to(converted).as_posix()
                if path.is_dir():
                    info = tarfile.TarInfo(name + "/")
                    info.type = tarfile.DIRTYPE
                    tf.addfile(info)
                else:
                    tf.add(path, arcname=name)
        result = self._convert(self.root / "from-oci", archive)
        self.assertEqual(result["sourceFormat"], "oci-archive")
        self.assertEqual(result["manifestDigest"], self._convert(self.root / "again")["manifestDigest"])

    def test_rejects_config_digest_and_diff_id_order_mismatch_without_index(self):
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "bad-config", config_id="sha256:" + "0" * 64)
        self.assertFalse((self.root / "bad-config/index.json").exists())
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "bad-order", diffids=list(reversed(self.diffids)))
        self.assertFalse((self.root / "bad-order/index.json").exists())

    def test_rejects_multiple_images(self):
        path = self.root / "multiple.tar"
        self._make_docker(path, manifest_override=[
            {"Config": "config.json", "Layers": ["0/layer.tar"]},
            {"Config": "config.json", "Layers": ["0/layer.tar"]},
        ])
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "multiple-out", path)
        self.assertFalse((self.root / "multiple-out/index.json").exists())

    def test_rejects_path_traversal_duplicate_and_link_entries(self):
        path = self.root / "unsafe.tar"
        self._make_docker(path, extra_members=[("../escape", b"x")])
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "unsafe-out", path)
        path2 = self.root / "link.tar"
        self._make_docker(path2)
        with tarfile.open(path2, "a") as tf:
            info = tarfile.TarInfo("linked")
            info.type = tarfile.SYMTYPE
            info.linkname = "config.json"
            tf.addfile(info)
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "link-out", path2)
        path3 = self.root / "duplicate.tar"
        self._make_docker(path3)
        with tarfile.open(path3, "a") as tf:
            info = tarfile.TarInfo("config.json")
            info.size = len(self.config)
            tf.addfile(info, io.BytesIO(self.config))
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "duplicate-out", path3)

    def test_rejects_truncated_tar_and_bad_layer_digest(self):
        truncated = self.root / "truncated.tar"
        tar_bytes = self.docker_tar.read_bytes()
        truncated.write_bytes(tar_bytes[:2048])
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "truncated-out", truncated)
        corrupt = self.root / "corrupt.tar"
        self._make_docker(corrupt, layers=[b"changed", self.raw_layers[1]])
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "corrupt-out", corrupt)

    def test_refuses_populated_output_and_never_overwrites(self):
        out = self.root / "occupied"
        out.mkdir()
        sentinel = out / "keep.txt"
        sentinel.write_text("preserve")
        with self.assertRaises(converter.ConversionError):
            self._convert(out)
        self.assertEqual(sentinel.read_text(), "preserve")
        target = self.root / "empty-target"
        target.mkdir()
        link = self.root / "output-link"
        link.symlink_to(target, target_is_directory=True)
        with self.assertRaises(converter.ConversionError):
            self._convert(link)
        self.assertEqual(list(target.iterdir()), [])

    def test_accepts_gzipped_docker_layer_tar_bytes(self):
        path = self.root / "docker-gzip.tar"
        self._make_docker(path, layers=[gzip.compress(x, mtime=15) for x in self.raw_layers])
        result = self._convert(self.root / "gzip-out", path)
        self.assertEqual(result["sourceFormat"], "docker-save-manifest")
        manifest = json.loads((self.root / "gzip-out/blobs/sha256" / result["manifestDigest"][7:]).read_bytes())
        for layer, expected in zip(manifest["layers"], self.raw_layers):
            encoded = (self.root / "gzip-out/blobs/sha256" / layer["digest"][7:]).read_bytes()
            self.assertEqual(gzip.decompress(encoded), expected)

    def test_rejects_config_layers_count_mismatch(self):
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "count-out", diffids=self.diffids[:1])
        self.assertFalse((self.root / "count-out/index.json").exists())

    def _archive_tree(self, source, target, index_bytes=None):
        with tarfile.open(target, "w") as tf:
            for path in sorted(source.rglob("*")):
                name = path.relative_to(source).as_posix()
                if path.is_dir():
                    info = tarfile.TarInfo(name + "/")
                    info.type = tarfile.DIRTYPE
                    tf.addfile(info)
                elif name == "index.json" and index_bytes is not None:
                    info = tarfile.TarInfo(name)
                    info.size = len(index_bytes)
                    tf.addfile(info, io.BytesIO(index_bytes))
                else:
                    tf.add(path, arcname=name)

    def test_rejects_nonobject_oci_index_and_boolean_descriptor_size(self):
        bad_object = self.root / "bad-index-object.tar"
        with tarfile.open(bad_object, "w") as tf:
            for name, body in (("oci-layout", b'{"imageLayoutVersion":"1.0.0"}'), ("index.json", b"[]")):
                info = tarfile.TarInfo(name)
                info.size = len(body)
                tf.addfile(info, io.BytesIO(body))
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "bad-index-object-out", bad_object)

        valid_layout = self.root / "valid-layout"
        self._convert(valid_layout)
        valid_index = json.loads((valid_layout / "index.json").read_bytes())
        valid_index["manifests"][0]["size"] = True
        bad_size = self.root / "bad-index-size.tar"
        self._archive_tree(valid_layout, bad_size, json.dumps(valid_index).encode())
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "bad-index-size-out", bad_size)

    def test_rejects_nested_oci_index_and_prefers_bound_docker_manifest(self):
        valid_layout = self.root / "valid-layout-for-nested"
        self._convert(valid_layout)
        nested_index = json.loads((valid_layout / "index.json").read_bytes())
        nested_index["manifests"][0]["mediaType"] = "application/vnd.oci.image.index.v1+json"
        nested_tar = self.root / "nested-index.tar"
        self._archive_tree(valid_layout, nested_tar, json.dumps(nested_index).encode())
        with self.assertRaises(converter.ConversionError):
            self._convert(self.root / "nested-index-out", nested_tar)

        mixed = self.root / "docker-plus-oci.tar"
        oci_metadata = (("oci-layout", b'{"imageLayoutVersion":"1.0.0"}'),
                        ("index.json", b'{"schemaVersion":2,"manifests":[]}'))
        self._make_docker(mixed, extra_members=oci_metadata)
        result = self._convert(self.root / "docker-plus-oci-out", mixed)
        self.assertEqual(result["sourceFormat"], "docker-save-manifest+oci-metadata")
        self.assertIsNone(result["sourceRevision"])

    def test_foreign_image_conversion_does_not_claim_9ff_provenance(self):
        out = self.root / "foreign-image"
        result = self._convert(out)
        index = json.loads((out / "index.json").read_bytes())
        self.assertNotIn("annotations", index["manifests"][0])
        self.assertIsNone(result["sourceRevision"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
