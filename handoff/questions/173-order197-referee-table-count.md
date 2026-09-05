# Question 173 — Order197 referee table count

## Stop condition

Order197's fresh migrations produce the pre-registered exact `93` public tables, but
`setup.sh --db-only` still hard-codes the obsolete value `85`. The order requires the
standing referee, while `setup.sh` was not named in its original scope.

## Resolution

Admit only `setup.sh`'s exact public-table count and explanatory message. Change `85`
to `93`; do not alter setup sequencing, credentials, ports, migrations, seed, referee,
or application startup. This is required to execute the unchanged mandatory 11/11
referee against migrations 1–24 and does not widen cashier product behavior.

