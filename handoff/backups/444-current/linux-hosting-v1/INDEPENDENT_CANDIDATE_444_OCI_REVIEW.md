# Independent candidate 444 offline OCI review

**Result: pass.** I ran `verify_candidate_oci.py` against the supplied OCI layout
and expected candidate image ID with the 11 ordered diff IDs from the public proof.
It passed. I also independently recomputed the config digest as opaque bytes, OCI
index and manifest hashes, each compressed layer digest/size, and each gzip-decoded
diff ID/size. All 11 compressed layer blobs are byte-for-byte identical to the
verified b9 OCI layer blobs; all ordered diff IDs also match b9. The layout has no
missing or extra blobs. The candidate config hash is
`sha256:265557572fb06f6699b85fd2732ebcacd12bc5e9299feacbe5ece2f0883dafce`, the
manifest digest is
`sha256:b49279345112336b02fcf51024ef1f04ee29a5a3b0fad96a9c6c543941fd9160`, and
the index SHA-256 is
`c0484f91a21c06d5d0876cd676265f8f85f666d11c92998f73107ec2a0932d0e`.

I independently compared Git tree entries for `src`, `frontend`, `migrations`,
`scripts`, `Dockerfile`, `package.json`, and `bun.lock` between b9 revision
`b9ba702a074a487feeafa056abb49abcdcf01ba8` and candidate revision
`444072ffdff2b7745345d88f71b603c17e11ace6`. All 459 entries have identical path,
mode, object type, and object ID; no product path differs. The eight changed paths
match the public equivalence proof and are test files. Both source checkouts are
clean. The canonical tree-entry map hash from this independent comparison is
`df4038b1b837af1a68aa7a7209a1bc51205f2c37ffca6d6b81392f572f59c53b`.

The private Dockerfile is a config-only repackage from the verified b9 image. It
contains `FROM`, a candidate build-SHA `ENV`, and candidate `LABEL` metadata; it has
no `RUN`, `COPY`, or `ADD`. The OCI config bytes differ from b9 and hash to the
candidate image ID. I did not decode the config or inspect `Env`; the candidate
index also carries no 9ff revision annotation. The candidate changes its config
identity while reusing the exact b9 filesystem layers; it is not a separate source
build.

The verifier command was:

```sh
python3 verify_candidate_oci.py --layout private-candidate-444-v2/oci-layout --expected-image-id sha256:265557572fb06f6699b85fd2732ebcacd12bc5e9299feacbe5ece2f0883dafce --expected-diff-id sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0 --expected-diff-id sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa --expected-diff-id sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737 --expected-diff-id sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0 --expected-diff-id sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637 --expected-diff-id sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784 --expected-diff-id sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84 --expected-diff-id sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11 --expected-diff-id sha256:2cfbf35b5f39e58c0e271f4e4211192b643e614daf9ed30829ad66c8d210397f --expected-diff-id sha256:c768036e3683227bc2dbbda3c2886a372eeff193f0186ba9d0ed677bbaab4068 --expected-diff-id sha256:64022fcc6881f35e088f90d624fbff2525318464faaac9b8f5a730509d6e9805
```

Key evidence hashes:

| Evidence | SHA-256 |
|---|---|
| `CANDIDATE_444_IMAGE_EXPORT_PROOF_V2.json` | `87f0960d33e32074fffd8a27ab14ef86b35b9e9f6952b5bb939bada37bb02211` |
| `verify_candidate_oci.py` | `defba6c26ad8503ff34056ccefed668cbbd0ec37ace8b1333df142c64de79691` |
| `PRODUCT_SOURCE_EQUIVALENCE_444.json` | `7c1c2579ba7541135e3ece429986869974375af8e7275e2fd1ad2b27e40223a8` |
| B9 `B9_OCI_CONTENT_PROOF.json` | `2f800327af873496138e5a0976af67261d250cb05f5be21acfc680d2bb255ef6` |
| candidate private Dockerfile | `c566effba57fb3f2a65d0df6de7840e6b240a902ac24e4926fbb79c7b9347f73` |
| candidate Docker-save archive | `d0ebe8397c468afabe20e96e00bb24fe9c8e99de027911795b36221f718b2ce3` |

This offline review did not use Docker or network access and did not start the
candidate. It does not prove database migration state, runtime readiness, public
routing, registry publication, or deployment. The candidate image is an
identity-only repackage of the reviewed b9 filesystem layers.
