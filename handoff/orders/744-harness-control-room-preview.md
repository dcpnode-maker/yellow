# Order744 — company harness design preview only

Read PROJECT.md, AGENTS.md and this order. Work in
D:/Yellow/git-live-order611-source-v2. Founder asks to SEE and understand proposed
Paperclip-like company management + universal execution harness BEFORE backend.
Do not implement real execution, scheduler, model calls, credentials or OS actions.
Root state ritual already failed WSL missingbash, no retry. Phase7 unchanged.

Gemini writes ONLY:
- docs/previews/harness-control-room.html
- handoff/receipts/744-harness-control-room-preview.md
Root owns questions/744.md, this order, docs/HARNESS-CONTROL-ROOM.md,
handoff/reviews/744-harness-control-room-preview.md, PROJECT-STATUS and LEDGER.
Root may add exact preview read/write permissions to existing backed-up strict
Antigravity config; preserve all denials. No dependency or application edits.

Deliver one self-contained HTML/CSS/JS clickable concept, no packages/network,
no external fonts/images, no storage or filesystem access, no fake live data.
Persistent visible notice: 'Design preview · sample data · no agents running'.
No source/backend/deploy function. All changing buttons simulate local UI only.

Visual direction: refined professional white/very pale grey control room with
black ink, restrained neon green accent #B8F76A, thin borders, subtle inset ribbon
containers, 12–14px system UI text, compact humane spacing. Segoe UI/system fonts.
Consistent small inline SVG icons, no emoji, no giant hero/stat cards, no gradients.
At desktop1440px: slim leftsidebar200px, header56px, mainworklist and inspector340px.
Horizontal segmented ribbon uses sliding white selected/hover plate and green
small status dot. Left nav same ribbon language, collapse to52pxiconrail; bottom
dock position toggle for collapsedrail. Tooltips and accessible names, visible
keyboard focus, escape close, reducedmotion, text not just color for all statuses.
At390px: no global horizontal overflow; use compactheader, scrollable maincontent,
sidebar closed, bottomnav; taskdetail as sheet with scrolling and close. Optional
'Phone preview' control on desktop shows390pxwide contained layout or linkedmode.

Working title 'Yellow Control' — company workspace name, not hotel PMS screen.
Left Company section: Overview, Goals, Work(active), Agents, Models & harnesses,
Approvals, Activity; bottom Settings. Nav changes main content via local state.
Top globalsearch filters tasks; status Free-only routing, Pause queue (simulated
toggle), New task (localmodal validates title and adds sampletask).

Default Work page: title 'Work' / 'Yellow / Product development', ribbon All,
Queued, Running, Review, Done. Compact list/table six SAMPLE taskrows with title,
status, owner, worker and evidence. Selectrowopensinspectorinsidepage. Example:
Calendar interactions / In review; Resume-safe queue / Running; Model adapters /
Queued; Reservation flow / Queued; Permission boundaries / Needs approval;
Window session helper / Done. Sample statuses NOTactualYellowprogress; noticeclear.
Inspector shows scope, dependency, worker choice, token/request budget(no claimed
spend), checkpoints, proof tabs ('Plan','Changes','Checks'), lastsampleactivity.
No 'Approved' until user clicks simulated approve, with preview toast.

Overview: restrained mission title 'One company. One accountable work queue.',
compact Goals→Tasks→Workers→Evidence diagram, counts derived from SAMPLEtasks only,
needsattention list; not huge blank dashboard or decorative KPI cards.
Agents: compact hierarchy Founder→Coordinator→Builder/Reviewer/Researcher, scope,
runtime,label indicating example role notrunning. Models & harnesses: distinguish
runtime Antigravity(included-plan lane, not running), DeepSeekHarness(adapterplanned),
Goose(adapterplanned), FreeLLMAPI(gatewaynotconnected), Local/Phone/VPS(notconnected).
No free-token guarantees. Settings simple free-only policy, maxparallel1, permission
scope and approvalgates shown explicitly as preview, not real device authorization.
Approvals: requestrow with Review details, Approve preview/Reject preview, no execution.
Activity chronologicalsampleevents; Goals nestedcompany→Yellow→reservations/calendar.

Keep concise implementation around500–750lines max, semantic accessible controls,
reusable rendering helpers, textContent for user titles rather than unsafeHTML.
UI input limited300chars, no secrets requested. Demonstrate sample filtering,
details, routingselection display, nav, collapse/dock, newtask and previewpause.
Receipt honestly states no browser/tests executed if worker commands blocked.
No testshell, tools outside write_file/read_file; root will open and verify.
