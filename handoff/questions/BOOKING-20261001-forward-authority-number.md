# Guest booking authority needs a reserved forward migration

Actual native proof on least-privilege runtime rejected direct FOR SHARE on tenant
and permission rows (42501). Those locks require UPDATE rights, which the runtime
must not receive. Existing governed domain authority functions establish the
approved pattern: fixed SECURITY DEFINER owner helper, exact tenant GUC, runtime
session/role checks, live issuer scopes locked through settlement.

Founder/laptop delegation explicitly permits a forward migration if required.
The bounded order is amended for one function, no new table, existing file edits
or runtime privilege broadening. Its unnumbered reviewed proposal is
handoff/proposals/BOOKING-20261001-guest-booking-authority.sql. It is applied only
to the worker's owned synthetic guest-booking proof DB. Laptop must reserve the
next migration number before source publication/admission/full fresh setup.
This question requests source coordination, not a waiver or credential.

Resolved by explicit laptop handoff:0104 is reserved for this bounded owner
authority function. Canonical source is migrations/0104_guest_booking_authority.sql;
no laptop admission/application is inferred from the disposable native proof.
