# PR93 merge-path clarification

The actual PR92-base merge reports15 conflicts, not the earlier14-path estimate.
The newer base's Market evidence frame and PR93's research catalog map also use
the same two paired-test filenames despite different contracts. Dropping either
implementation or its tests would lose scope. Before code, PR-FIX-003 explicitly
admits both existing map contracts and two renamed research-map paired tests;
there is no product-policy, tenant-authority or live-runtime change.
