# Order702 receipt — hover preview and compact creation

25September2026. Scope is interaction corrections within approved neutral ribbon,
not a new design/application. Existing active source remains
D:/Yellow/git-live-order611-source-v2; unrelated dirty-worktree files preserved.

Implemented transient hover/focus capsule preview separately from committed tab
selection. Mouse leave/cancel restores the selected/focused item; touch does not
create hover. Today movement cards likewise preserve keyboard focus after pointer
exit. The calendar-plus creation control is44px with explicit New reservation
accessible name, tooltip and visible touch helper, beside the reservation family.
The existing creating/busy guards and draft callback remain unchanged.

Root reproduced the old live defect before release: while In house was selected,
hovering Arrivals left the indicator at x517.8/width125 rather than following
Arrivals at x249.8/width120.2. This was actual physical browser input, not source
inference. Independent reviewer found one Today focus/leave defect in the first
patch; root corrected it before approval.

Root focused702/696/700:11pass/0fail,71assertions. Root full frontend/backend
typecheck passed after final Today state split. Independent review is recorded
in handoff/reviews/702-ribbon-hover.md with personally run commands and limitations.
No reservation, occupancy, finance or database mutation was made.

## Combined live release and root browser proof

Orders702/703 are now served by image ba4633c0fca6d70462fecc9393c22fdb2879e738f1d98862b57cbd6c2554513f.
Root physically hovered Arrivals while In house was committed: the capsule moved
to x249.8/width120, while aria-selected and the in_house URL stayed unchanged.
Pointer exit restored the capsule to In house at x517.8/width125. Keyboard Home
committed Arrivals and changed the URL to due_in. These are live browser results,
not source-only assertions. At390px responsive width, the44px calendar-plus
control remained inside the reservation family container; opening and closing
the existing draft form worked without submitting a reservation.

Root viewed the supplied neutral capsule reference and live desktop/phone-width
screenshots: rounded gray grouping retained, white active capsule retained,
compact icon aligned with its family, hover separated from committed selection,
and controls wrap/scroll without document-width overflow. This is the approved
interaction slice, not a claim that every reference design has been reproduced.
Browser emulation is not native Android proof; touch injection is unavailable in
the connected browser backend. No physical-phone touch test is claimed.
