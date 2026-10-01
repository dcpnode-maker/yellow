# Reviewed 9ff source and managed image checkpoint

Source: `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`. Tree: `4311a79c0c9ffc33877809162b1b38ae1b3c944a`.
The unchanged dated ZIP is 744,720 bytes, SHA-256 `642e11aa69f107252da14796710a8b58733792b2deb213c019ce991764ac49f0`.
Root independently verified all 25 exact members, CRC and digests, 145 guarded paths from e06, eight latest paths, both private-index reconstructions and the empty MCP replacement. No old MCP contents were read or exported. The source working tree, index and refs are unchanged.

The ZIP preserves its 09:28:55 pending CI snapshot. The current receipt outside the ZIP records run 36842043047 as successful, with all six required gates green. PR 98 remains draft and unmerged. This does not establish laptop integration or complete PMS, CRM or 18-phase acceptance.

Managed image `sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0` is built for linux/amd64, user bun, Bun 1.3.14. Independent execution verified all 272 runtime source files against Git. Its only build adapter change mounts managed CA trust for the frozen dependency install. The image is prepared; no app cutover occurred. It is not claimed byte-identical to the canonical CI image. No registry image was published.

The active VM app is older 937912 and synthetic. No public Yellow app hostname is verified. The laptop remains controller: preserve its local dirty work, select and review the integrated latest source, then provide a distinct secure app binding, tester restrictions and one data/config authority with a tested off-host restore. The phone coordinator must not serve Yellow app traffic. VM storage and these source artifacts do not back up business data or runtime secrets.

The GitHub settings PATCH returned HTTP 403; connected readback remains public. No credential copying, password login, paid fallback, router changes or Daybreak scan was performed. Separate home network documents require measurements and contain no measured results.

To reproduce the managed build, regenerate the pure-Git context from the exact committed paths in `managed-hosting/source-manifest-9ff27ad.json`, preserving each file's path, mode and bytes:

```sh
git archive --format=tar 9ff27ad8765dc75ebae9e083d4635c7a9b89fa62 -- <allowlisted paths>
```

The recorded tar is 9,953,280 bytes, SHA-256 `e1b67fb64117efc211f2dcfac537f58f6b3bcde5a0045f11d3a5fbc10b5c8119`. Before running the single-use runner, verify its source/context/adapter and managed Docker/proxy configuration and current plan quota. Do not copy authority files, the session CA or runtime secrets into the image or repository. The context tar is omitted because it can be reproduced.
