# Kole Jain resources — verified access and Yellow adaptation

Order678, 24 September2026. Research/design specification, not a deployed UI change.
GPT-6 Astra (`/root/astra_kole_design_research`, requested explicitly by founder) performed the bounded creator/resource assessment and reviewed the existing full interaction study. Root checked official catalogue/browser access, Dribbble cross-link and the current Yellow components. No claim that the calling task's model switched.

## Resource provenance and actual outcome

| Surface | Verification | Outcome |
|---|---|---|
| [Official website](https://www.kolejain.com/) and [resource catalogue](https://www.kolejain.com/resources) | Site displays24 resource collections; describes Figma components associated with creator lessons. | Catalogue and publicly visible catalogue imagery reviewed; gated Preview assets were not accessed. Complete earlier24-transcript/timecode ledger retained in [KOLE-INTERACTION-SYSTEM.md](KOLE-INTERACTION-SYSTEM.md); not retranscribed this pass. |
| [YouTube](https://www.youtube.com/@kolejain), [Instagram](https://www.instagram.com/uiuxdailytips/), [LinkedIn](https://www.linkedin.com/in/kolejain/) | Outbound links from the official site. | Identity references, not repositories or permission to acquire private work. |
| [Dribbble](https://dribbble.com/kolejain/about) | Creator profile links back to kolejain.com. Root separately read this cross-link. | Verified design-profile reference; no shot assets imported. |
| Figma resources | Official site associates the collections with Figma. Root clicked the visible Every UI Concept Preview on24September; email/newsletter gate appeared again. | Resource access remains unconfirmed. No new signup/consent submission, download, CAPTCHA or bypass. Astra earlier tried three embedded references, which returned inaccessible; those are not evidence of asset access. Do not reuse hidden references to evade the visible gate. |
| GitHub | No creator-owned repository was verified through official links and targeted identity research. | **No repository cloned.** This is not proof none exists; a verified URL is required before cloning rather than acquiring an unrelated person's work. |
| Canva / Adobe / Behance | No official creator-owned profile or source collection verified in this pass. | No access or acquisition claimed. |
| Reuse licence | No explicit component/code reuse licence found in the inspected catalogue. | Free access does not establish redistribution or incorporation rights. Public lessons may inform original implementations; actual source/assets require their own terms before import. |

The bounded scope is public creator research, not a promise to obtain every work ever published or private client files. No third-party repository was executed, installed, mirrored into Yellow or presented as original work. No subscriptions, private-account access or new model/runtime service.

## What changes in the design, not the domain model

The founder's latest priority is three linked but independent dimensions:

1. **Guest journey:** Pre-arrival → Arrivals → In-house → Departures → Post-departure.
2. **Room operations:** assigned/unassigned, cleaning/inspection, occupancy and outages are distinct facts; readiness is a governed result, not a cosmetic state.
3. **Commercial attribution:** client-configured business-source, market-segment/group, company/agent/salesperson and product relationships. Never hard-code an assumed hierarchy or count one fact repeatedly because it has multiple mappings.

There is one **Front Office** department destination. The journey stages are its inner ribbon, not five separate left-menu destinations. Other departments reuse the authorized journey context where relevant. The left vertical ribbon groups departments above shared functions. Preserve the accepted neutral shell, compact white selected capsule, universal search and existing role/recovery guards.

## Compact table tools — proposed reusable pattern

One line: `View title / result count · Filter [n] · Sort [n] · Group · Columns`.
Group appears as a working control only after a tested grouping implementation exists. Numeric badges represent active rules/levels, not an invented data count. Do not add a second global guest-search control. Keep any table-only text condition explicitly scoped to the table, reachable through Filter or an in-table find affordance.

| Control | Icon + visible label | Behavior |
|---|---|---|
| Filter | Funnel + Filter | One anchored editor; merge existing Stay criteria here. Field/condition/value with type-appropriate controls, Add condition, individual removal and Clear filters. Stage a draft; Apply commits the view, Cancel discards it. Show compact removable summaries only when active. |
| Sort | A–Z/up-down ordering + Sort | Ordered Sort by / Then by rows; direction, remove, Move up/down, Add level. Unique fields preserve precedence; changes do not mutate records. |
| Group | Stacked rows + Group | Proposed ordered grouping, expand/collapse and real counts. Source/business mappings drive available hierarchy; distinguish simple display grouping from governed revenue aggregation. No duplicate revenue from many-to-many links. |
| Columns | Vertical columns + Columns | Visibility choices categorized by Identity, Stay, Room, Commercial and Finance. Internal column-picker search; ordering/pinning only when implemented. Missing backend values are not filled from mockup data. |

Only one panel open at a time; all four use the same editor surface. On phones use a full-height sheet with the same choices, sticky Apply/Cancel,44px touch targets and adequate text size. Compress simultaneous controls and padding, not readability or capability. Use one consistent outline icon family and retain short visible labels; tooltips help, but do not replace names or touch access. Icon-only remove/close/reorder controls need accessible names. Colour cannot be the only status signal.

Column headers retain direct Excel-like menus. Show actual sort direction/priority and an active filter indicator with an accessible description. Clearing one column never resets other columns. A value picker describes its dataset coverage (currently loaded authorized rows), not all hotel values unless the query proves that coverage. New numeric/date operators, multiselect OR or nested condition groups require query-model implementation and proof; labels alone must not imply support.

Keep property, selected stay, scroll position, filters and return context across in-place stage changes. Update the selected capsule immediately; use a short optional content dissolve, not a full-table slide or a delay before a command. Honour reduced motion; never use animation as proof a mutation succeeded. Hotel operating date must be resolved from the authoritative operational-day model: transaction time in property timezone is calendar context, not sufficient proof of the rolled business day.

## Existing code versus work still needed

| Existing component | Verified source behavior | Follow-through |
|---|---|---|
| `ui/OperatorHeader.tsx` | Shared collapsible sidebar/mobile drawer; Operate/Business/System sections; labels include Today, Reservations and Front desk. | Reconcile into founder's department-first navigation without losing routes/actions; not a blind label replacement. |
| `ui/SegmentedRibbon.tsx` | Moving selection, keyboard arrows/Home/End, optional disclosure and shared content ID. | Reuse for stage navigation; five-stage classification/date semantics need independent focused acceptance. |
| `ui/TableControls.tsx` | One large Filters & sorting disclosure, table search, filter rows and reorderable sort rows. | Split discovery into compact labelled controls over one shared draft editor. Preserve existing capabilities. |
| `ui/MovementTableControls.tsx` | Separate Columns and Stay criteria disclosures, per-lane filters/columns, active column-filter chips. | Consolidate Stay criteria into Filter; harmonize combined rule counts/summaries and reset semantics. |
| `ui/TableColumnMenu.tsx` | Header dialog, sort priority, column-specific filter, loaded-value chooser and clear operations. | Keep direct header access; improve type-aware editors, indicator/icon consistency and mobile sheet. |
| `table-query.ts` | Arbitrary-count AND filters; contains/equality/emptiness conditions; ordered unique sorts; exact bigint comparison; unsupported fields fail closed. | No existing nested OR/groups/group-by/pinning/saved-view contract. Add separately with tests rather than claiming present. |

## Next implementation acceptance, not completed here

- Same existing application and shared primitives; no duplicate app or framework change.
- Filter/Sort drafts Apply/Cancel correctly, per-column clearing and unique priorities preserved; six filters/four sorts regression retained.
- Compound stay criteria and generic filter rules have unambiguous combined semantics. Unauthorized/missing fields stay unavailable; empty and unavailable states differ.
- Department/ribbon navigation preserves unsaved edits and uncertain-command locks; browser back/forward works.
- Desktop/mobile keyboard/focus/escape, reduced motion and no page overflow; no hidden mobile capabilities.
- Date-boundary/overdue/cancelled/no-show cases proved before changing journey classification.
- Relevant tests, typechecks and browser interaction proof; benchmark local interaction and data retrieval separately. No universal50ms claim from a visual design.

Design-system skill influenced this specification: audit existing primitives first, reuse shared variants/state/accessibility contracts, and distinguish proposed behavior from deployed coverage. This document and the founder addendum are the only design changes in Order678.
