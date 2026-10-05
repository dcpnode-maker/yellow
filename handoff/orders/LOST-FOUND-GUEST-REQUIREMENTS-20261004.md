# Founder Lost & Found requirements, 2026-10-04

Founder explicitly requested reservation/history linkage, photo or video notification, and private visibility in the guest's Yellow account. This is approved product intent; this document does not declare a built backend, notification connector or live feature.

Proposed flow: staff records found item and secure media; staff confirms the reservation/guest link; notify that linked guest once; show the item and claim/return progress in the authenticated Yellow guest account. Unknown ownership remains unlinked, not broadcast. Add claim verification, storage/custody, handover and return history, retention policy and sensitive-content controls. Notification channels come from enabled connectors and configured guest preferences; queue only after committed confirmed linkage. Keep failed delivery/retries visible and deduplicated.

Authorization: guest gets only their linked item/media/status. Staff-only custody notes and other reservations are excluded. Changing linkage invalidates previous guest/media access. Media URLs must be short-lived and authorized, not public bucket links. Same group reservation does not imply all group guests own an item. Keep reservation linkage and authenticated guest-account ownership distinct; match does not widen property or tenant grants.

Backend scope required before implementation: authoritative item+custody state, tenant/property/reservation/guest grants, versioned link/correction command, transactional outbox, audited media handling and guest-portal read API. Independent executable two-tenant and cross-guest privacy proof plus notification replay/failed-delivery proof before publication. No fictitious local-storage save, public photos or notifications in this layout release.
