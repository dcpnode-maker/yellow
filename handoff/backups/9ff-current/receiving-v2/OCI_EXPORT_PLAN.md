# Existing 9ff image OCI export plan

This directory contains an offline converter and synthetic proof. No real image
archive was created or read while preparing these artifacts. The parent must review
the converter before using it with the task-owned image.

The expected config image ID from the parent-selected Docker inspect is
`sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0`.
The selected local inspect reported source tag
`yellow-managed:9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`, source commit
`9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`, and image size 195,955,407 bytes.
Its ordered `RootFS.Layers` diff IDs are passed to the converter exactly as reported:

```text
sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0
sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa
sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737
sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0
sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637
sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784
sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84
sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11
sha256:62a99645d033b7c1dc411c85064e0b940519cea36a50120ac270e0833d6611a9
sha256:357202e048be5e1a9cb55c7dee3c6a21374cd3ac5c1e0c2604b39b8dbf54c7a0
sha256:cc5b9c2168d091be119bba2598b036189a0d8caaabef315faf89fe2eb1d60597
```

The parent-controlled export step may create one task-owned Docker-save tar. Inspect
only archive member names/types and manifest shape first. Do not print config bytes,
decode or display `Config.Env`, or export to a shared/published location. If the archive
is not exactly a supported single-image Docker-save manifest or one OCI image
manifest, stop and report its format without inventing a selection.

Example invocation after parent review, with the archive and new output directory in
the task-owned receiving location (repeat `--expected-diff-id` in the listed order):

```sh
python3 docker_save_to_oci.py \
  --input ./task-owned-image.tar \
  --output ./task-owned-oci-layout \
  --expected-config-id sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0 \
  --expected-diff-id sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0 \
  --expected-diff-id sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa \
  --expected-diff-id sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737 \
  --expected-diff-id sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0 \
  --expected-diff-id sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637 \
  --expected-diff-id sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784 \
  --expected-diff-id sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84 \
  --expected-diff-id sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11 \
  --expected-diff-id sha256:62a99645d033b7c1dc411c85064e0b940519cea36a50120ac270e0833d6611a9 \
  --expected-diff-id sha256:357202e048be5e1a9cb55c7dee3c6a21374cd3ac5c1e0c2604b39b8dbf54c7a0 \
  --expected-diff-id sha256:cc5b9c2168d091be119bba2598b036189a0d8caaabef315faf89fe2eb1d60597
```

The converter accepts only an absent output path or an existing empty directory. It
does not overwrite or delete existing entries. Input archive and aggregate member
bytes are capped at 2 GiB, config bytes at 16 MiB, 4,096 archive members, 1,024 path
bytes, and 64 layers. Every archive member path must be safe and unique; only regular
files and directories are allowed. Referenced config and layer files must be regular.
Each raw layer is SHA-256 checked against its ordered expected diff ID, then encoded
as deterministic gzip (`mtime=0`, empty filename) in `application/vnd.oci.image.layer.v1.tar+gzip`.
The config bytes are copied unchanged and their hash must equal the selected image ID.
Config inspection scans JSON boundaries and decodes only `rootfs.diff_ids`; all other
config values, including `Env`, remain opaque.

The final output is an OCI image layout with one canonical OCI manifest. The 9ff
revision annotation is emitted only when both the expected config ID and the exact
11 expected diff IDs match the parent-selected image; generic or foreign conversions
receive no source annotation and report a null source revision. If `manifest.json`
and OCI layout metadata coexist, the converter validates and selects exactly one
Docker manifest against the expected config ID and diff IDs, and reports that mixed
format explicitly. A Docker manifest takes precedence over embedded OCI index
metadata; without `manifest.json`, only a single direct OCI image manifest is accepted.
`index.json` is written last. A missing index means the conversion did not complete.
After conversion, the parent independently hashes and reconstructs config bytes,
compressed layer blobs, uncompressed layer diff IDs, manifest, `oci-layout`, and
`index.json`; OCI output digest remains distinct from the config image ID. No
registry digest or publishable runtime config is inferred from these artifacts.

Known deliberate format limits: multi-image Docker manifests, multi-entry OCI
indexes, OCI indexes whose root points to an index/manifest list, links, special tar
entries, non-SHA256 descriptors, unsupported compression (including zstd), and
unrecognized media types are rejected. A Docker manifest in an archive is selected
only when it has exactly one image and its config/layers match the supplied expected
values. A current Docker exporter using another structure requires a new reviewed
implementation decision before conversion.
