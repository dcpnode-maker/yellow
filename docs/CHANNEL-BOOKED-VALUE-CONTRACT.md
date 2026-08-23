# Yellow channel booked-value contract

Order 093 resolves one dangerous ambiguity before any OTA data enters an RMS backtest: a guest's
total price is not the same number as room revenue, and the party funding a discount changes hotel
economics even when the guest sees the same price.

## Exact identities

All values are bigint minor units in one currency:

```text
guest room price
  = gross booked room revenue
  - hotel-funded guest discount
  - channel-funded guest discount

gross guest value before discounts
  = gross booked room revenue
  + mandatory non-room charge
  + tax and government pass-through

guest booked total
  = guest room price
  + mandatory non-room charge
  + tax and government pass-through

hotel room receivable before other distribution costs
  = gross booked room revenue - hotel-funded guest discount
  = guest room price + channel-funded guest discount
```

Order 091 receives gross booked room revenue and the hotel-funded discount. A channel-funded
discount reduces what the guest pays but is not a hotel-funded distribution cost. Mandatory
non-room charge and tax/government pass-through affect the guest total but are excluded from room
revenue. This contract supplies exact classification evidence; it does not post or recognize money.

## Same guest price, different hotel value

For a USD 400 room with a USD 70 total guest discount:

- USD 50 hotel-funded + USD 20 channel-funded gives the guest USD 330 room price and leaves USD 350
  hotel room receivable before commission and other distribution costs.
- USD 20 hotel-funded + USD 50 channel-funded gives the same USD 330 guest room price but leaves
  USD 380 hotel room receivable.

An optimizer that records only “30% off” or only the displayed guest price cannot distinguish these
outcomes and will learn the wrong channel value.

## External KB mapping

The external OTA/RMS KB v0.2 uses a `gross_room_value` variable that includes mandatory fees.
Yellow does not silently map that value to Order 091 gross booked room revenue. A future ingestion
order must first split the source into exact room revenue, mandatory non-room charge and tax/
government pass-through, state which discounts are hotel-funded versus channel-funded, and reject
the record if those components cannot be proven.

## Deferred authority

`mandatoryNonRoomChargeMinor` is not automatically recognized hotel revenue. Its future tx code,
USALI line, account, tax treatment, collection party and settlement treatment belong to Financials,
Tax and channel-contract orders. Likewise, commission base/amount, payment fee, cancellation cost,
campaign stacking, causal incrementality, bid price and publication remain separate governed inputs.
