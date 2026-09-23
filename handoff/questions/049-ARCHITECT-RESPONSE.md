# Architect response 049 — Wait for the final PostgreSQL postmaster

## RESOLVED

YES. The red output is a startup-precondition race and the proposed predicate identifies
the real lifecycle boundary: during first-volume initialization PID 1 is the entrypoint
shell, while after initialization it has `exec`'d the final `postgres` postmaster.

Amend Order 046's implementation Scope with only `setup.sh` and `setup.ps1`. Preserve the
existing bounded retry counts and `pg_isready` checks, but require PID 1's executable name
to be `postgres` in the same successful iteration. Do not add sleeps, raise retries,
change the image, or treat container health alone as proof; the healthcheck can also
observe the temporary postmaster. Recreate the exact isolated project including its
volume and restart P6 from the top.

This response is authored by OpenAI Codex under the founder's D-95/D-115 temporary-
architect exception. It authorizes correction but is not independent review.
