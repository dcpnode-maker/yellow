# Independent b9 image and OCI review

**Result: bounded image-content review passed.** The reviewed checkout is commit
`b9ba702a074a487feeafa056abb49abcdcf01ba8`, tree
`9446a6735d712ccfd30c6957ea511fb0e3b644cf`. `git status --short` was empty. The
v2 build-input manifest SHA-256 is
`6ace3aecb185a71dc63ad293b19a2694c0a40649681644320bb5c6e38f096d4e`, matching
the manifest hash recorded by `LINUX_IMAGE_BUILD_PROOF.json`.

I independently ran `python3 verify_b9_oci_export.py`. It passed and its parsed
stdout exactly equals the saved `B9_OCI_CONTENT_PROOF.json`. It verifies opaque
config bytes against image ID `sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9`, the 11 compressed OCI blobs, all 11 reconstructed uncompressed diff IDs in order, manifest and index descriptors, and the archive hash. The OCI manifest digest is
`sha256:bbd2acbe6175765ad5fc36562d8a1e6156396d87b82b291c013ab595a5746ded`; the
index SHA-256 is `b812ad99a46246c5d2ba25e67b41243375712b5440d1f8c87c13b96d3e74063a`.
The Docker-save archive is 202,605,568 bytes with SHA-256
`d5224edffda0892d15025c313551b1ffe8abff656de5f1cc5df8ae95879c2200`.

The image metadata independently reports the same immutable image ID, revision
label `b9ba702a074a487feeafa056abb49abcdcf01ba8`, Linux/amd64, user `bun`, command
`bun run start`, and the exact 11 diff IDs in the build and selected-image proofs.
`RepoDigests` is empty. The OCI output uses `docker-save-manifest+oci-metadata` and
has no revision annotation; the OCI content digest is not a registry digest.

The v2 manifest records 260 exact source entries under `src/`, `package.json`, and
`bun.lock`, plus 31 fresh Linux Vite outputs under `public/yellow-next/`. Each
manifest entry matched both the exact source checkout (for source entries) and
private build context. I copied those four bounded paths from one stopped image
container and compared them to the same manifest rows. All 291 image files matched
by path, byte count, and SHA-256; no expected paths were missing, no extras or
symlinks were present, and there were zero mismatches. The UI outputs were checked
against the fresh-output entries in the context manifest, not treated as tracked
source files. The private context’s CA adapter hash is
`7140f4c927df646cda538e5167c25292363c08154d8354db5763fc31efe929bb`.

The initial v1 verifier failure remains preserved: `KeyError annotations`, caused
by asserting a 9ff-specific annotation on the generic b9 conversion. The original
verifier SHA-256 is `713885e2b733be18837fca65fadda0b6ae8523de68c9d057b915f046b99fe781`;
the corrected v2 verifier SHA-256 is
`8fbf8730cd306c913ab515b09bbe1c4582852e01ea9d6b1b5fdd0f67149136c8`. V2 correctly
accepts the absent revision annotation while independently checking image config
and layer content. The initial failure receipt SHA-256 is
`333e376acf124aa7e2d456df1d8b75dfb4e1da821327f8d5380ed4ee58bbd961`.

For file-level image checks, I created exactly one container from the immutable
image, with `--network none` and owner/nonce labels. Its inspected state was
`created`; it was never started. Immediately before cleanup, its CID, image ID,
owner label, nonce, and `created` state were verified. I removed only that CID, then
confirmed Docker returned `No such object` for it. The extracted files are retained
under `private-b9-image-review-e8b42ca1e50c48d6/` for review.

The exact Docker commands were:

```sh
docker --host unix:///var/run/docker.sock image inspect sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9 --format '{{json .Id}} {{json .RepoDigests}} {{json .Os}} {{json .Architecture}} {{json .Config.User}} {{json .Config.Cmd}} {{json .RootFS.Layers}} {{json (index .Config.Labels "org.opencontainers.image.revision")}}'
docker --host unix:///var/run/docker.sock create --network none --name b9-image-review-e8b42ca1e50c48d6 --label yellow.review.owner=independent-b9-image-oci-review --label yellow.review.nonce=e8b42ca1e50c48d602954a8fae47810e sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9
docker --host unix:///var/run/docker.sock inspect a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55 --format '{{.Id}} {{.Image}} {{.State.Status}} {{index .Config.Labels "yellow.review.owner"}} {{index .Config.Labels "yellow.review.nonce"}}'
docker --host unix:///var/run/docker.sock cp a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55:/app/src private-b9-image-review-e8b42ca1e50c48d6/app/
docker --host unix:///var/run/docker.sock cp a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55:/app/package.json private-b9-image-review-e8b42ca1e50c48d6/app/
docker --host unix:///var/run/docker.sock cp a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55:/app/bun.lock private-b9-image-review-e8b42ca1e50c48d6/app/
docker --host unix:///var/run/docker.sock cp a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55:/app/public/yellow-next private-b9-image-review-e8b42ca1e50c48d6/app/public/
docker --host unix:///var/run/docker.sock inspect a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55 --format '{{.Id}} {{.Image}} {{.State.Status}} {{index .Config.Labels "yellow.review.owner"}} {{index .Config.Labels "yellow.review.nonce"}}'
docker --host unix:///var/run/docker.sock rm a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55
docker --host unix:///var/run/docker.sock inspect a0ff72ccfec7da7d43b960632106a539ad447d23cb5fd5f9e4a59fbac4066f55 --format '{{.Id}} {{.State.Status}}'
```

The source identity and status commands were:

```sh
git -C /workspace/yellow-receiving-b9 rev-parse HEAD
git -C /workspace/yellow-receiving-b9 rev-parse 'HEAD^{tree}'
git -C /workspace/yellow-receiving-b9 status --short
```

For the source/context/image comparison, the exact Python audit was:

```sh
python3 - <<'PY'
import hashlib,json
from pathlib import Path
art=Path('/workspace/yellow-coordination/release-20261001/receiving-b9-linux-v1')
source=Path('/workspace/yellow-receiving-b9')
context=art/'private-image-build-v2/context'
image_root=art/'private-b9-image-review-e8b42ca1e50c48d6/app'
manifest=json.loads((art/'BUILD_INPUT_MANIFEST_V2.json').read_text())
rows=manifest['files']
expected={}
counts={'source':0,'ui':0}
errors=[]
def verify(base, rel, row, label):
 p=base/rel
 if not p.is_file() or p.is_symlink():
  errors.append(f'{label} missing/nonregular {rel}'); return
 digest=hashlib.sha256(p.read_bytes()).hexdigest()
 if digest!=row['sha256'] or p.stat().st_size!=row['bytes']:
  errors.append(f'{label} digest/size mismatch {rel}')
for row in rows:
 rel=row['path']
 is_source=rel.startswith('src/') or rel in ('package.json','bun.lock')
 is_ui=rel.startswith('public/yellow-next/')
 if not (is_source or is_ui): continue
 expected[rel]=row
 verify(context,rel,row,'context')
 verify(image_root,rel,row,'image')
 if is_source:
  verify(source,rel,row,'source'); counts['source']+=1
 else: counts['ui']+=1
actual=set()
for p in image_root.rglob('*'):
 if p.is_symlink(): errors.append(f'image symlink {p.relative_to(image_root).as_posix()}')
 elif p.is_file(): actual.add(p.relative_to(image_root).as_posix())
missing=sorted(set(expected)-actual)
extra=sorted(actual-set(expected))
if missing: errors.append('missing image paths '+repr(missing[:10]))
if extra: errors.append('extra image paths '+repr(extra[:10]))
print(json.dumps({'sourceFiles':counts['source'],'freshUiFiles':counts['ui'],'expectedTotal':len(expected),'imageActualFiles':len(actual),'missingCount':len(missing),'extraCount':len(extra),'mismatchCount':len(errors),'mismatches':errors[:30]},indent=2))
if errors: raise SystemExit(1)
PY
```

The verifier-to-saved-proof equality check was:

```sh
python3 - <<'PY'
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path('.')
p=subprocess.run([sys.executable,'verify_b9_oci_export.py'],cwd=root,text=True,capture_output=True,check=True)
actual=json.loads(p.stdout)
saved=json.loads((root/'B9_OCI_CONTENT_PROOF.json').read_text())
assert actual==saved
print('verifier output equals saved B9 content proof:',actual==saved)
print('verifier stdout sha256:',hashlib.sha256(p.stdout.encode()).hexdigest())
print('manifest sha256:',hashlib.sha256((root/'BUILD_INPUT_MANIFEST_V2.json').read_bytes()).hexdigest())
print('verifier sha256:',hashlib.sha256((root/'verify_b9_oci_export.py').read_bytes()).hexdigest())
print('original verifier sha256:',hashlib.sha256((root/'verify_b9_oci_export_original.py').read_bytes()).hexdigest())
print('archive sha256:',hashlib.sha256((root/'private-oci-export-b9-v1/docker-save.tar').read_bytes()).hexdigest())
print('OCI index sha256:',hashlib.sha256((root/'private-oci-export-b9-v1/oci-layout/index.json').read_bytes()).hexdigest())
PY
```

The final inspect returned `No such object`, as expected after exact-CID removal.
The identity and copy commands omitted `Config.Env`; the config was never decoded.

| Evidence file | SHA-256 |
|---|---|
| `ORDER.md` | `ec94579054752a0286cdf9e73ca3ae869c44851173fc5326625fe1ebd4246ac4` |
| `BUILD_INPUT_MANIFEST_V2.json` | `6ace3aecb185a71dc63ad293b19a2694c0a40649681644320bb5c6e38f096d4e` |
| `LINUX_IMAGE_BUILD_PROOF.json` | `c1f2f47b158025dbb5a3d11eb34ecb2518f0a0ef0a186d96b1261f733080944a` |
| `B9_OCI_CONTENT_PROOF.json` | `2f800327af873496138e5a0976af67261d250cb05f5be21acfc680d2bb255ef6` |
| `OCI_VERIFIER_INITIAL_FAILURE.json` | `333e376acf124aa7e2d456df1d8b75dfb4e1da821327f8d5380ed4ee58bbd961` |
| `verify_b9_oci_export.py` | `8fbf8730cd306c913ab515b09bbe1c4582852e01ea9d6b1b5fdd0f67149136c8` |
| `verify_b9_oci_export_original.py` | `713885e2b733be18837fca65fadda0b6ae8523de68c9d057b915f046b99fe781` |
| Docker-save archive | `d5224edffda0892d15025c313551b1ffe8abff656de5f1cc5df8ae95879c2200` |
| OCI `index.json` | `b812ad99a46246c5d2ba25e67b41243375712b5440d1f8c87c13b96d3e74063a` |

No image was launched. This review does not test migrations 101–103 against a
database, runtime readiness, the old service, phone builds, a public URL, registry
publication, laptop binary backup, or production recovery. It makes no deployment
or database authority claim.
