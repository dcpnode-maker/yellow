# Order721 local receipt — guest billing, compact controls

Implemented guest-first cashier composition, four-action ribbon above statement,
add/edit/search icons, compact14px microphone (44px touch/32px fine-pointer target),
explicit reservation/checkout entry, smaller bill selectors and mobile two-column
guest/bill context. Order716 physical cash drawers are deferred and absent from the
active Finance bundle; isolated source/tests are retained. No new finance API,
fee, money arithmetic, migration, payment or lifecycle command was introduced.

## Verification

Root final focused18pass/0fail/122assertions:721 guest-billing and compact-mic,
716deferral,672folio-workbench,714integration. Full types pass;208boundaries pass.
Independent reviewer guest_contract709 personally executed focused18/0/122,
adjacent39/0/301, isolated deferred716client/workbench19/0/146; final721/714
visual-refinement suite25/0/174 and full types. See independent review721.
Tests include SSR/source and pure/controller checks; do not call those mounted QA.

Root IAB browser on real loopback3010, seeded OmarL3R-DI-0015 / L3R-FOL-1 SAR25:
- Blocked `*cashier-sessions*` at browser network layer, reloaded; actual135stays
  and real selected statement loaded without a drawer query/permission dependency.
- Typed charge amount12500, switched to Direct billing then back. CDP remote DOM
  object confirmed SAME input node, isConnected=true, value12500; hidden panel
  children and drafts really remained mounted. No charge POST/confirmation.
- Add bill window→Conference extras→Review→Edit retained name→Cancel. Checkout,
  bill selector, ribbon and shell navigation locked during that draft and released
  on Cancel. This is pre-submit draft/review proof, not a live unknown-write test.
- Browser exposed shared deposit lease opening an unrelated Deposits panel;
  corrected its forced-open condition to exclude the additional-window owner.
  Recheck: checkoutLocked=true, deposits aria-expanded=false during Add window.
- Reservation/checkout entry opened SAME reservationUUID fbe1dc20-456e-5345-8d7d-
  420b41685955. Server readiness visibly blocks checkout: folio window unsettled,
  folio window nonzero; confirmation disabled. No settle/checkout POST.
-390px: page width390, panels362px, final guest context231.7px, action ribbon
  starts603.7px, mic glyph14px/tap44px;320px: page320, no horizontal page overflow,
  four action buttons about61px×60px. Table alone may horizontally scroll.
-1440px desktop: final table828.8px within830.4px container, entire seven-column
  statement fits, dates do not break; selected surface rgb(241,255,220), panelswhite.
- Microphone click showed privacy disclosure; Start microphone not pressed. No
  audio capture/vendor permission was requested. Cancel works.
- Restored network blocking and viewport overrides afterward. No hotel data writes.

## Visual fidelity ledger

Concept docs/design/721-guest-billing-concept.png, built-in ImageGen; prompt and
intentional scope deviations summarized in docs/design/721-guest-billing.md.
Root used view_image on concept and final D:/Yellow/temp/order721-desktop.png in
the same QA pass. Browser/IAB first, no alternate Playwright/CDP browser driver.

1. Layout: narrow guest/window context + broad statement preserved; full-width
   compact search disclosure intentionally retains Yellow navigation semantics.
2. Density: removed large balance cards, repeated headings and cash drawer panel;
   final desktop ribbon and statement visible together. Mobile guest context now
   two columns rather than a tall stack.
3. Palette: white content, pale green selected bill and neutral ribbon. Fixed an
   existing theme token override that was making the selected bill gray.
4. Typography/headers:24px title,21px statement heading,12px compact actions;
   wrapped long financial headers fixed the desktop horizontal overflow; seven
   canonical columns retained instead of fictional five-column concept.
5. Icons: outline16px action icons,14px mic; add/edit icons apply only to drafts.
6. Behavior: panel switch retains actual DOM/draft; locks remain. No decorative
   nonfunctional payment/checkout controls or fabricated guest values were added.
7. Copy diff: removed decorative FRONT DESK FINANCE/step headings, retained exact
   financial consent/recovery and original-order ledger caveat; fictional concept
   shell, hotel, rows and metadata deliberately not copied into production.

Native-size screenshot limitation: concept generated1505×1045; DOM breakpoints
checked1440×1000,390×844,320×780. IAB/Windows125% capture scaling produces cropped
or downscaled mobile raster captures despite correct DOM bounds. Native phone not
connected; no pixel-identical/native-phone claim. Final desktop saved screenshot
is legible and inspected; temporary misleading mobile capture is not a deliverable.
The implementation follows the scoped concept with listed intentional adaptations;
it is not an exact pixel clone of the generated concept or of Airbnb/Kole material.

## Local candidate and remaining work

Loopback app image yellow-public-demo-app:order721-local-qa:
sha256:5c5315697f877cb8f8a1966eb54f5c01eac5218c96344bd26986ec53f7ee5778.
Vite559modules; index-BpC3YhHE.js, FinanceWorkspace-u8MGd01u.js / CI24yO9w.css.
App-only replacement; retained713base and717rollback, database/cache unchanged,
public tunnel exited/OFF. No public-live/PR/merge or ecosystem-complete claim.
Inherited readiness503/build_revision_unavailable remains outside this UI order.

Finance source SHA12CFA2B543133F138C95B74BFC9601BA76074AE02544D7736DF27401CDAC1D5A;
ribbon52CE2C9589B6FEADE629050DBDF8ED5EAE1D8A4DAA98D62894386BCFF23BF933;
CSS85A398825D1493C559404AEF7A69D477FF8DE6237465A240B6897231A92677A3;
VoiceFieldE01A6BB6D288BB3CD02652C47AC5787C01D2210418A4C3DB8C294E7316D19D5E.

Still not delivered: automatic cancellation/no-show charges, manual no-show command,
one-screen embedded payment/settlement/checkout composition, full-market dataset,
RMS calendar editing and wider ecosystem. Existing cancellation waiver policy is
not automatic penalty posting; the current demo session has no payment access.
