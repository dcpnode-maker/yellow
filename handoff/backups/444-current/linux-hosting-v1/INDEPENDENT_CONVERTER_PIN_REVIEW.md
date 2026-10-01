# Independent converter pin review

**Result: the corrected converter SHA-256 pin is supported by the published artifact packet and the actual file.** The local converter bytes hash to `d4b9f325581404c5782ab81ebfedc1ca974a0bb55da24fd1dedabdbe372767f8`. Independently computing the Git blob over those same bytes gives `1dbdbf52e5added3f92c3019012b896f24beab9b`. Both values match the sole converter entry in `publication-inputs-v3/ARTIFACT_MANIFEST.json`.

`FINAL_PUBLICATION_RECEIPT.json` binds the 72-file packet to commit `a1fbcabf7f2caaeb0e666a281931a557c04f26cc` and records that all 72 Git and SHA-256 hashes were verified after normal fetch. The preserved `ADMISSION_FAILURE_PIN_CORRECTION.json` records the previous stale-pin admission failure, with `docker_build_started=false` and `private_output_created=false`. The current builder pins the verified hash at line 27.

This verifies the narrow pin value only. I did not run the builder or Docker, change source, or validate/export an image.
