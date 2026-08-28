# EXTENSIONS.md — Extension Registry content schemas

Extensible configuration types and instances live in `extension` rows, validated
against the JSON Schema registered in `extension_type.json_schema`. **One lifecycle for
extension config** (draft → active → retired, bitemporal via fact_log). Adding a
vertical, a tax regime, a policy kind, or a statutory country is DATA, not code — unless
it needs an adapter (Tier C).

Core property runtime choices that are attributes of the property itself remain in the
typed `org_node.config` envelope and are changed only through audited domain commands;
they are not plugin instances. Inventory currently defines
`inventory.oos_sellability` as `blocked | allowed`, defaulting to `blocked` when absent.

Rate authoring uses three related tenant extensions. `rate_plan_model` records the selected guided,
expert or AI-authored model family; `rate_plan_target` records physical and commercial applicability;
and `rate_plan_release` is the only atomic activation unit. Its strict content binds the exact model
and target draft ids/versions, the canonical evaluator and composition ASTs, and an optional
`undo_of_version`. Its required `rms_binding` is nullable; the reserved strict object contains only
adapter key/version, maximum recommendation age and `local_evaluator` outage fallback. Order 069
accepts only null, while Order 070 owns every proof required before the object form can be used.
Bigint minor units inside the ASTs are JSON encoded as exact tagged decimal objects. No release
instance is seeded: hotels create tenant drafts, simulate them, obtain approval and publish a latest
version through the rates context.

`rate_plan_release` lifecycle status is operational metadata (`draft → active → retired`); its
content is immutable. Reverting means copying a prior active or retired snapshot into a newer draft
that follows the same approval path. The release does not own availability, restrictions, OOO/OOS,
tax, fiscal or journal truth, so hotel-selectable pricing cannot disable those controls.

Schemas below are the launch set. Claude Code: when implementing, load these into
`extension_type` in the Phase-1 seed migration, exactly as written.

---

## 1. `vertical_profile` — what makes a hostel not a hotel

```json
{ "$id": "pms:vertical_profile:1", "type": "object", "required": ["terminology","claim_mode_default","features"],
  "properties": {
    "terminology": { "type":"object", "additionalProperties":{"type":"string"} },
    "claim_mode_default": { "enum": ["exclusive","positional"] },
    "features": { "type":"object", "properties": {
      "dorm_beds":{"type":"boolean"}, "hourly_slots":{"type":"boolean"},
      "long_stay_billing":{"type":"boolean"}, "owner_statements":{"type":"boolean"},
      "kiosk_checkin":{"type":"boolean"}, "meal_plans":{"type":"boolean"} } },
    "default_policies": { "type":"array", "items":{"type":"string"} },
    "housekeeping_cadence": { "enum":["daily","on_departure","weekly","custom"] },
    "default_unit_types": { "type":"array", "items":{ "type":"object",
      "required":["code","name","claim_mode"], "properties":{
        "code":{"type":"string"},"name":{"type":"string"},
        "claim_mode":{"enum":["exclusive","positional"]},
        "capacity":{"type":"integer","minimum":1} } } }
  } }
```

Launch instances (seed these four):

```json
{ "key":"hotel", "content": { "terminology":{"space":"Room","unit_type":"Room Type"},
  "claim_mode_default":"exclusive",
  "features":{"dorm_beds":false,"hourly_slots":false,"long_stay_billing":false,
    "owner_statements":false,"kiosk_checkin":true,"meal_plans":true},
  "default_policies":["flex_24h","deposit_first_night"],
  "housekeeping_cadence":"daily",
  "default_unit_types":[{"code":"STD","name":"Standard","claim_mode":"exclusive","capacity":2},
    {"code":"DLX","name":"Deluxe","claim_mode":"exclusive","capacity":3}] } }

{ "key":"hostel", "content": { "terminology":{"space":"Room","unit_type":"Bed Category"},
  "claim_mode_default":"positional",
  "features":{"dorm_beds":true,"hourly_slots":false,"long_stay_billing":false,
    "owner_statements":false,"kiosk_checkin":true,"meal_plans":false},
  "default_policies":["flex_24h"],
  "housekeeping_cadence":"daily",
  "default_unit_types":[
    {"code":"DORM6","name":"6-Bed Mixed Dorm","claim_mode":"positional","capacity":6},
    {"code":"DORM6F","name":"6-Bed Female Dorm","claim_mode":"positional","capacity":6},
    {"code":"PRIV","name":"Private Room","claim_mode":"exclusive","capacity":2}] } }

{ "key":"serviced_apartment", "content": { "terminology":{"space":"Apartment","unit_type":"Apartment Type"},
  "claim_mode_default":"exclusive",
  "features":{"dorm_beds":false,"hourly_slots":false,"long_stay_billing":true,
    "owner_statements":true,"kiosk_checkin":false,"meal_plans":false},
  "default_policies":["long_stay_30d","deposit_one_month"],
  "housekeeping_cadence":"weekly",
  "default_unit_types":[{"code":"STU","name":"Studio","claim_mode":"exclusive","capacity":2},
    {"code":"1BR","name":"1 Bedroom","claim_mode":"exclusive","capacity":3}] } }

{ "key":"str", "content": { "terminology":{"space":"Property","unit_type":"Listing"},
  "claim_mode_default":"exclusive",
  "features":{"dorm_beds":false,"hourly_slots":false,"long_stay_billing":false,
    "owner_statements":true,"kiosk_checkin":true,"meal_plans":false},
  "default_policies":["str_strict_5d","deposit_damage"],
  "housekeeping_cadence":"on_departure",
  "default_unit_types":[{"code":"UNIT","name":"Entire Unit","claim_mode":"exclusive","capacity":6}] } }
```

---

## 2. `tax_jurisdiction` — regime as data

```json
{ "$id": "pms:tax_jurisdiction:1", "type":"object",
  "required":["country","taxes"],
  "properties": {
    "country": {"type":"string","pattern":"^[A-Z]{2}$"},
    "region": {"type":"string"},
    "price_display": {"enum":["tax_inclusive","tax_exclusive"]},
    "rounding": {"enum":["line","document"], "default":"line"},
    "taxes": {"type":"array","items":{"type":"object",
      "required":["code","name","mode"],
      "properties":{
        "code":{"type":"string"}, "name":{"type":"string"},
        "mode":{"enum":["percent","fixed_per_night","fixed_per_person_night","slab_percent"]},
        "rate":{"type":"number"},
        "amount_minor":{"type":"integer"},
        "applies_to":{"type":"array","items":{"type":"string"}},
        "slabs":{"type":"array","items":{"type":"object",
          "required":["upto_minor","rate"],
          "properties":{
            "upto_minor":{"type":["integer","null"]},
            "rate":{"type":"number"},
            "itc_eligible":{"type":"boolean"} }}},
        "slab_basis":{"enum":["declared_tariff_per_night","transaction_value"]},
        "compound_on":{"type":"array","items":{"type":"string"}} } } }
  } }
```

Order 237 evaluates this content as a pure positive-charge rule value. For that
evaluator, `price_display` and `rounding` must be supplied explicitly; the schema's
rounding default is an authoring hint, not a hidden runtime default. Rates must be
finite, non-negative and exactly convertible to integer basis points. Money and
intermediate values are exact bounded `bigint` minor units; JavaScript-number money is
never admitted.

The four modes have these exact v1 meanings:

- `percent` applies one configured basis-point rate to each matching attributable
  component;
- `fixed_per_night` and `fixed_per_person_night` multiply `amount_minor` only by the
  caller's explicit non-negative integer quantity;
- `slab_percent` is whole-band, not progressive: each explicit room-night component
  selects the first ordered inclusive `upto_minor`, with exactly one final null band.
  Stay-average selection is forbidden.

`applies_to` matches only explicit revenue-group values. `compound_on` may name only
earlier unique tax codes and is rejected when missing, duplicated, forward, self or
cyclic. Positive half-up rounding is the engine convention: `line` rounds each
attributable component, while `document` sums exact rational components and rounds
once per tax code without allocating residual minor units to lines. Inclusive display
extracts tax from the supplied gross; exclusive display adds tax to the supplied base.
This convention is calculation behavior, not jurisdiction certification.

Room-night evaluation retains ordered per-night components, including mixed slab
rates. Line-rounded compounding consumes those already-rounded earlier components.
Document-rounded compounding is rejected because v1 has no authorized allocation of a
rounded document tax back to attributable lines. Collection sizes and rational
representation complexity are bounded and hostile oversized values fail closed.

The evaluator does not read extensions or assignments, infer guest categories/dates,
or decide precedence against `rate_plan.tax_inclusive`. Negative corrections,
person-category rules, document residual allocation, progressive slabs and India
CGST/SGST/IGST place-of-supply decomposition require later versioned contracts.
Aggregate `GST_ROOM` output is not a legally final invoice and authorizes no posting,
document number/hash or fiscal submission.

India GST launch instance (CBIC 15/2025 slabs, slab on transaction value per night):

```json
{ "key":"in-gst-lodging", "content": { "country":"IN",
  "price_display":"tax_exclusive", "rounding":"document",
  "taxes":[{ "code":"GST_ROOM", "name":"GST on accommodation", "mode":"slab_percent",
    "slab_basis":"transaction_value", "applies_to":["room_revenue"],
    "slabs":[
      {"upto_minor":100000,  "rate":0,    "itc_eligible":false},
      {"upto_minor":750000,  "rate":0.05, "itc_eligible":false},
      {"upto_minor":null,    "rate":0.18, "itc_eligible":true}] },
   { "code":"GST_FNB", "name":"GST on F&B (restaurant in hotel)", "mode":"percent",
     "rate":0.05, "applies_to":["fnb_revenue"] }] } }
```

KSA and AE launch instances: flat `percent` VAT 0.15 / 0.05 on all revenue groups,
`price_display":"tax_inclusive"`.

---

## 3. `policy` — cancellation / deposit / guarantee / no-show

```json
{ "$id":"pms:policy:1", "type":"object", "required":["kind"],
  "properties":{
    "kind":{"enum":["cancellation","deposit","guarantee","no_show"]},
    "rules":{"type":"array","items":{"type":"object","properties":{
      "before_hours":{"type":"integer"},
      "penalty":{"type":"object","properties":{
        "basis":{"enum":["nights","percent","fixed"]},
        "value":{"type":"number"}}}}}},
    "deposit":{"type":"object","properties":{
      "basis":{"enum":["first_night","percent","fixed","one_month"]},
      "value":{"type":"number"},
      "due":{"enum":["at_booking","days_before_arrival"]},
      "days_before":{"type":"integer"}}},
    "guarantee":{"enum":["card_on_file","deposit_paid","company_letter","none"]},
    "no_show_charge":{"type":"object","properties":{
      "basis":{"enum":["first_night","full_stay","fixed"]},"value":{"type":"number"}}}
  } }
```

Seed: `flex_24h`, `flex_48h`, `str_strict_5d`, `non_refundable`, `deposit_first_night`,
`deposit_one_month`, `deposit_damage`, `long_stay_30d`.

---

## 4. `statutory_adapter` — guest registration per country (Tier B config / Tier C code)

```json
{ "$id":"pms:statutory_adapter:1", "type":"object",
  "required":["country","adapter_key","schedule"],
  "properties":{
    "country":{"type":"string","pattern":"^[A-Z]{2}$"},
    "adapter_key":{"type":"string"},
    "schedule":{"enum":["on_checkin","daily_batch","within_24h"]},
    "required_identity_fields":{"type":"array","items":{"type":"string"}},
    "transport":{"enum":["sftp","https_form","soap","rest"]},
    "credential_ref":{"type":"string"},
    "format":{"type":"string"}
  } }
```

Launch instances: `it-alloggiati` (within_24h, 168-char fixed-width, https_form),
`pt-siba` (daily_batch, sftp), `in-form-c` (on_checkin for foreign nationals, rest,
e-FRRO), `hr-evisitor` (on_checkin, rest). `adapter_key` maps to a registered adapter
module; countries with no mandate simply have no row.

---

## 5. `fiscal_provider` — clearance routing (the 5-pattern port)

```json
{ "$id":"pms:fiscal_provider:1", "type":"object",
  "required":["jurisdiction","mode","provider_key"],
  "properties":{
    "jurisdiction":{"type":"string"},
    "mode":{"enum":["none","in_house_clearance","in_house_reporting","provider_routed","peppol"]},
    "provider_key":{"type":"string"},
    "document_formats":{"type":"array","items":{"type":"string"}},
    "chain":{"type":"object","properties":{
      "hash_algo":{"enum":["sha256"]},
      "pih_required":{"type":"boolean"},
      "qr":{"enum":["tlv_base64","none"]}}},
    "endpoints":{"type":"object","additionalProperties":{"type":"string"}},
    "credential_ref":{"type":"string"}
  } }
```

Launch instances:

```json
{ "key":"sa-zatca", "content":{ "jurisdiction":"SA", "mode":"in_house_clearance",
  "provider_key":"zatca-phase2", "document_formats":["ubl21_xadhes"],
  "chain":{"hash_algo":"sha256","pih_required":true,"qr":"tlv_base64"},
  "credential_ref":"vault:sa-zatca" } }

{ "key":"in-irp", "content":{ "jurisdiction":"IN", "mode":"in_house_reporting",
  "provider_key":"india-irp", "document_formats":["irp_json_1_1"],
  "chain":{"hash_algo":"sha256","pih_required":false,"qr":"none"},
  "credential_ref":"vault:in-irp" } }

{ "key":"ae-asp", "content":{ "jurisdiction":"AE", "mode":"provider_routed",
  "provider_key":"ae-asp:tbd", "document_formats":["pint_ae"],
  "credential_ref":"vault:ae-asp" } }
```

UAE note: PINT AE must flow through an Accredited Service Provider — in-house clearance
is not a legal option there. `provider_key` `ae-asp:<vendor>` is chosen at onboarding.

---

## 6. `automation_action` — the action vocabulary (CONTRACTS §6 AST targets)

```json
{ "$id":"pms:automation_action:1", "type":"object",
  "required":["action","params_schema"],
  "properties":{
    "action":{"type":"string"},
    "params_schema":{"type":"object"},
    "idempotent":{"type":"boolean"},
    "allowed_triggers":{"type":"array","items":{"type":"string"}}
  } }
```

Launch action set (each row registers one action + its params schema):

| action | params | typical trigger |
|---|---|---|
| `route_charge` | `{tx_code_group, to_folio_role}` | posting.created |
| `post_scheduled_charge` | `{tx_code, amount|rate_ref, cadence}` | day.rolled |
| `send_message` | `{template, channel, to_role}` | reservation.* |
| `create_task` | `{kind, queue, due_offset_h}` | reservation.checked_out |
| `apply_deposit_schedule` | `{policy_key}` | reservation.confirmed |
| `set_restriction` | `{restriction, scope, period}` | occupancy.threshold |
| `owner_statement_accrual` | `{split_percent}` | posting.created (owner spaces) |
| `escalate_approval` | `{approval_kind, role}` | adjustment.requested |

Rules: actions are the ONLY thing automations may do (no arbitrary code); every action
implementation is idempotent on `(automation_id, trigger_event_id)`; new verticals add
actions by registering rows + one handler module.

---

## 7. `rate_model` — registered pricing-model catalogue

`rate_model` is platform-global product configuration. It tells guided, expert and future AI
authoring which model families exist; it does not calculate or publish a price.

```json
{ "$id":"pms:rate_model:1", "type":"object",
  "required":["version","label","description","capabilities"],
  "additionalProperties":false,
  "properties":{
    "version":{"type":"integer","minimum":1},
    "label":{"type":"string"},
    "description":{"type":"string"},
    "capabilities":{"type":"array","items":{"type":"string"}}
  } }
```

Launch keys are exact: `simple-fixed`, `calendar`, `bar-ladder`, `derived`,
`room-matrix`, `occupancy-los`, `contract-negotiated`, `package`, `rms-api-managed`
and `expert-composition`. Catalogue entries are active platform rows at version 1. Adding a key
does not add an evaluator; executable behavior remains a separately reviewed rates-context change.

---

## 8. `rate_plan_model` — immutable tenant draft selection

This tenant extension attaches a versioned, non-monetary model choice to an existing active
`rate_plan`. The key is always server-derived as `rate-plan:<rate-plan-uuid>`.

```json
{ "$id":"pms:rate_plan_model:1", "type":"object",
  "required":["property_node","rate_plan_id","model_key","model_version",
    "authoring_mode","component_model_keys"],
  "additionalProperties":false,
  "properties":{
    "property_node":{"type":"string","pattern":"^[0-9a-f-]{36}$"},
    "rate_plan_id":{"type":"string","pattern":"^[0-9a-f-]{36}$"},
    "model_key":{"enum":["simple-fixed","calendar","bar-ladder","derived",
      "room-matrix","occupancy-los","contract-negotiated","package",
      "rms-api-managed","expert-composition"]},
    "model_version":{"type":"integer","minimum":1},
    "authoring_mode":{"enum":["guided","expert","ai"]},
    "component_model_keys":{"type":"array","items":{"type":"string"}}
  } }
```

Order 065 creates only `draft` rows and one fact per version. It stores no amount, percentage,
date rule, target or formula. Expert composition is a bounded list of registered non-expert keys.
Activation, approval, publication and undo use later orders and the existing
`extension.activated` event.

---

## 9. `rate_plan_target` — immutable applicability and commercial targeting

This tenant extension records who and what an existing active rate plan is intended for. It is a
draft input to later simulation and publication; it does not itself change a price or sellability.

```json
{
  "$id": "pms:rate_plan_target:1",
  "property_node": "uuid",
  "rate_plan_id": "uuid",
  "authoring_mode": "guided | expert | ai",
  "rules": [{
    "key": "stable-rule-key",
    "effect": "include | exclude",
    "priority": 0,
    "physical": { "kind": "property | class | unit_type | sellable" },
    "commercial": {}
  }]
}
```

Physical scope is exact: sellable beats unit type, which beats a hotel-defined class snapshot,
which beats property. A class contains a canonical hotel code and a sorted immutable list of exact
property-owned unit-type ids; changing membership requires a new draft version. Commercial fields
are conjunctive and may target company, market group, market, source, channel, segment, agent and
campaign. Company, agent and source ids are active tenant party roles. The remaining codes are
bounded case-sensitive hotel vocabulary until a later publish/distribution boundary validates any
external mapping.

Within one physical rank, more constrained commercial fields win, followed by one uniquely higher
explicit priority. Equal top rank/count/priority is returned as a conflict, never resolved by row,
array, JSON-key or rule-key order. Broad `include` plus a narrower `exclude` gives explicit
inheritance and exceptions. Creation is insert-only, audited, emits no event and stores no price,
date condition, policy formula or publish state.

---

## Tier map (recap)

- **Tier A** — most countries: tax_jurisdiction row only, or nothing. No code.
- **Tier B** — config-only statutory/fiscal variation: extension rows, existing adapters.
- **Tier C** — clearance/registration mandates needing code: ZATCA, India IRP,
  UAE ASP, Alloggiati/SIBA/Form-C/eVisitor. Each is one adapter module conforming to
  the FiscalDocumentProvider / StatutoryAdapter port. Never touch the core.
