# Question 126 — Order 077 schema-snapshot scope

## BLOCKED — ARCHITECT NEEDED

**Order:** 077  
**Raised by:** OpenAI Codex builder  
**Production edits made:** Order 077 implementation committed at `de74b21`; no status or handoff completion edits

The first standing schema-drift assertion ran against a fresh database migrated through the new
authorized `0006_rate_release_approval_lookup.sql` and failed exactly where the new index enters the
dump:

```text
Schema drift at line 2469
expected: -- Name: consumer_processed_age; Type: INDEX; Schema: public; Owner: -
actual:   -- Name: approval_request_rate_release_plan_cursor; Type: INDEX; Schema: public; Owner: -
```

Order 077 scoped the forward migration and required schema drift to pass, but omitted the derived
`tests/schema/expected.sql` snapshot from Scope. May Scope gain only that file so it can be regenerated
from the freshly migrated disposable database, reviewed to contain the one expected partial index,
and then checked byte-exactly? No existing migration, referee, application logic or assertion changes.

