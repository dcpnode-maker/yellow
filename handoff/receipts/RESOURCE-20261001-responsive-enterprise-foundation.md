# RESOURCE-20261001 — responsive enterprise foundation receipt

Date: 2026-10-01  
Order: `handoff/orders/RESOURCE-20261001-responsive-enterprise-foundation.md`  
Design basis: `docs/design/DEVICE-ENTERPRISE-ONBOARDING-20261001.md`

Added `viewport-fit=cover` to the web viewport. Kept the shell and main `vh` declarations as fallbacks and added `dvh` overrides behind feature support checks. The operator shell now derives its header height from the safe-area top inset; desktop navigation and main viewport height use that same header value. Desktop navigation content also pads around left, right, and bottom safe areas without changing its width or local scrolling. Workspace content adds only the horizontal safe-area clearance not already supplied by the expanded sidebar, and mobile workspace gutters include their left/right inset once. At 980px, the header, full-screen navigation drawer, dialog, and main viewport account for safe-area insets while retaining legacy sizing fallbacks and the existing breakpoint/layout behavior.

## Proof

- Current header/navigation/theme checks: **24 passed, 0 failed, 446 assertions** across six files (`order707-mobile-navigation`, `order673-theme`, `operator-material-themes`, `material-theme-skins`, `order684-navigation-ribbon`, `order694-navigation-table`).
- `bun run typecheck`: exit 0.
- Isolated Vite frontend build: exit 0, output at `E:\YellowWorkspace\Data\BuildArtifacts\yellow-laptop-20261001-RESOURCEresponsive-v1\frontend`.
- `git diff --check` on the three source files and this receipt: exit 0.
- The broader eight-file legacy compatibility selection is retained as RED evidence: **27 passed, 3 failed, 484 assertions**. Its remaining failures are source-string checks expecting the older `App.tsx` mobile-navigation and ribbon/OptionsDrawer contracts (`Open Guests`, a reduced-motion implementation, and a literal `role="dialog"` attribute). The current app uses `OperatorHeader` and a native `<dialog>`; these test expectations were outside the authorized file scope. Logs are `legacy-compatibility-audit.log` and `.stderr.log` in the isolated artifact directory.

## Acceptance still pending

Root independently inspected the isolated changed selectors and verified source SHA-256s: index `60e8956cb1e4f9f686e7f4d87ec453a71c7ba78ab3a1d01fbfbb2178b9edbd26`, styles `c4ab9ea8704d32e76c375dbb7b561e3461fe8752a523bc6237fcf8008914cfe3`, reference-theme `06a9cfe8366f361c7d5f2bb0af36ce527ec0975bab48332439467b49fb8656f1`. Root personally ran the six-file current navigation/theme checks24/0/446, root/frontend typecheck and scoped diff check, all exit0. Root then independently compiled the current frontend successfully to the isolated `root-reviewed-frontend` directory. Root logs are `root-responsive-checks.log`, `root-responsive-typecheck.log` and `root-responsive-build.log` in the same artifact directory. Existing unrelated dirty CSS was preserved; chunk-budget warnings remain.

The root-authored device/enterprise design received separate read-only authority review. Its showcase-filter wording was corrected to distinguish source/fixture evidence from undocumented product policy. This is design/source review, not executable tenant or portfolio acceptance.

Root review subsequently found missing horizontal/bottom insets for the desktop-style sidebar and workspace when navigation is collapsed. The worker corrected only the authorised reference stylesheet and receipt. Root inspected the revised selector geometry, verified final reference-theme hash `06f80608a2211c1d0ff49fbe49d628dafaae578ce0e5a07b53fa4cba2639221e`, personally reran the same six-file checks24/0/446 and diff check, and independently compiled the final source to `root-final-frontend`. Logs: `root-final-insets-checks.log` and `root-final-insets-build.log`. The earlier hash/output above is retained as an earlier proof snapshot, not the final serving source.

No browser, keyboard-open, rotation, safe-area visual, screen-reader, Android device, or iOS device proof was performed. The saved CUA browser permission check remains blocked; source tests and compilation do not establish interactive layout acceptance. No native-app, OS-version compatibility, or full enterprise onboarding completion is claimed.
