# Order689 — shared search for persisted groups, live increment

24 September2026. Implementer ecosystem_journey_gaps, independent non-implementer
order679_independent_review, root release/public QA. Uses the same688 image
a42f0b25dcecc575ade0321635bc2bb292e72c728bd362553c7ffd6e4076ed46 and sole app.
No serving DB writes/migrations, no new group records created for public QA.

## Delivered

Group name/code search executes parameterized literal filtering before pagination,
scoped to tenant/property and current read authority. Search dialog has Groups
filter, bounded loading/error/retry and stale-query guards. Result opens exact
existing group detail even if not in the first list page. Invalid links clear
detail; stale/failed selection cannot leave another group's detail selected.
Shared hotel search catalogue remains beta with accurate partial-coverage copy.

## Independent proof

See handoff/reviews/689-universal-group-search.md for reviewer-executed commands,
findings and corrections. Disposable PG18 tmpfs `yellow-order689-proof` only:
101/101 migrations, canonical referee11pass/0fail; real runtime-role integration
7pass/0fail/36 assertions proves >50-group filtering, literal percent/underscore,
cross-tenant/property exclusion and existing group command invariants. Pure/HTTP/
UI-model/routing32pass/0fail/182; types and boundaries/readiness15pass/0fail/279.
First rerun exposed fixed-ID test collision6/1, not a product fault; fixture made
run-unique and independently rerun green on the same DB. Error is not omitted.
Root final combined native-enabled suite51pass/1complementaryskip/0fail/240,
strict types and208boundaries green. UI-model tests are not mounted browser tests.

## Actual read-only public UI

- Desktop universal search from native map: Horizon -> profile and group results;
  Horizon Family Wedding -> canonical `reservations?view=groups&group=af5365ee-42e1-4002-a046-c7c4363a8d09`,
  correct group heading and four associated reservation links. Existing block
  group stays view-only with unavailable allotment/pickup stated, not invented.
- Responsive390x844: exactcode LOC-SOC-0928 -> Groups1 -> exact same detail.
  Name and code lookup, result filter, destination metadata and mobile bottom
  sheet visually verified. D:/Yellow/temp/order689-live-search-mobile.png and
  D:/Yellow/temp/order689-live-group-mobile.png are actual screenshots.
- Impossible search string -> zero matches with useful correction copy; invalid
  `group=invalid` -> invalid-link alert, Refresh groups and no stale group detail.
- Calendar button clears group parameter, renders loaded7-date grid; Individual
  renders134reservations with existing Filter/Sort/Columns controls. All Ecosystem
  card now states group names/codes while keeping Beta. No relevant browser
  error/warn entries or framework overlay; page title/URL matched.

No public >50-group fixture was created; that case is actual SQL plus exact-detail
source/model proof, not public mounted-browser coverage. No production permission
revocation, endpoint outage or timing-race injection was performed; isolated HTTP/
DB proofs and source guards cover these boundaries. Label before search still
mentions stays/profiles while footer/results explicitly include groups: minor
copy follow-up, not a coverage-complete claim. Folio/task/catalogue and complete
room-history indexes remain missing; true room-block operations remain missing.

After both agents released the proof target, coordinator verified exact name,
tmpfs and no mounts before removing `yellow-order689-proof`; disposable synthetic
data is intentionally gone and reproducible. Stopped fixture8321. Live database,
cache/tunnel unchanged. Inherited ready503/build-revision debt remains; see688
receipt. No full ecosystem, CI or production-readiness assertion.
