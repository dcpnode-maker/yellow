import { createHash } from "node:crypto";
import type { Tx } from "../../kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
type Row=Readonly<Record<string,unknown>>;

export interface IndiaFinalComponentTaxFiscalSourceInput { readonly tenantId:string; readonly propertyNode:string; readonly reservationId:string; readonly folioId:string; readonly journalId:string }
export interface IndiaFinalComponentTaxFiscalSourceRoomNight { readonly ordinal:string; readonly businessDate:string; readonly transactionValueMinor:string; readonly slabUptoMinor:string|null; readonly aggregateRateBasisPoints:number; readonly itcEligible:boolean; readonly taxMinor:string }
export interface IndiaFinalComponentTaxFiscalSourceComponent { readonly roomNightOrdinal:number; readonly componentOrdinal:number; readonly componentIdentity:"igst"|"cgst"|"sgst"|"utgst"; readonly rateBasisPoints:number; readonly taxAmountMinor:string }
export interface IndiaFinalComponentTaxFiscalSourceJournalLine { readonly id:string; readonly seq:number; readonly accountId:string; readonly accountRole:string; readonly folioId:string|null; readonly txCode:string; readonly description:string; readonly amountMinor:string; readonly quantity:string; readonly businessDate:string; readonly currency:"INR"; readonly taxDetail:unknown|null }
export interface IndiaFinalComponentTaxFiscalSourceResult {
  readonly state:"eligible_current_posted_source"; readonly postingBindingId:string; readonly journalId:string;
  readonly taxId:string; readonly taxGeneration:number; readonly taxEvidenceHash:string; readonly valuationId:string;
  readonly valuationGeneration:number; readonly finalValuationEvidenceHash:string; readonly applicabilityId:string;
  readonly applicabilityEvidenceHash:string; readonly reservationId:string; readonly folioId:string; readonly guestAccountId:string;
  readonly propertyNode:string; readonly businessDate:string; readonly currency:"INR"; readonly transactionValueMinor:string;
  readonly taxMinor:string; readonly grandTotalMinor:string; readonly componentFamily:"igst"|"cgst_sgst"|"cgst_utgst";
  readonly predecessorHashes:Readonly<{section14:string;levyComponentIdentity:string;reservationLineage:string;attributionSnapshot:string}>;
  readonly roomNights:readonly IndiaFinalComponentTaxFiscalSourceRoomNight[];
  readonly components:readonly IndiaFinalComponentTaxFiscalSourceComponent[];
  readonly journalLines:readonly IndiaFinalComponentTaxFiscalSourceJournalLine[]; readonly sourceEvidenceHash:string;
}

export interface IndiaFinalComponentTaxNativeFiscalSourceInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly postingBindingId: string;
}

export interface IndiaFinalComponentTaxNativeConsiderationSource {
  readonly postingRootId: string;
  readonly journalId: string;
  readonly currentAmountMinor: string;
  readonly txCode: string;
  readonly currentFragmentSetHash: string;
}

export interface IndiaFinalComponentTaxNativeFiscalSourceResult {
  readonly state: "eligible_current_native_accounted_source";
  readonly sourceKind: "native_component_tax_delta";
  readonly postingBindingId: string;
  readonly accountingEvidenceHash: string;
  readonly nativeTimingId: string;
  readonly nativeTimingEvidenceHash: string;
  readonly journalId: string | null;
  readonly taxId: string;
  readonly taxGeneration: number;
  readonly taxEvidenceHash: string;
  readonly valuationId: string;
  readonly valuationGeneration: number;
  readonly finalValuationEvidenceHash: string;
  readonly applicabilityId: string;
  readonly applicabilityEvidenceHash: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly guestAccountId: string;
  readonly buyerPartyId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly currency: "INR";
  readonly transactionValueMinor: string;
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly componentFamily: "igst" | "cgst_sgst" | "cgst_utgst";
  readonly rateSelectionKind: "ordinary_section13_single_version" | "genuine_section14_rate_change";
  readonly predecessorHashes: Readonly<{
    readonly nativeTiming: string;
    readonly nativeRateSelection: string;
    readonly finalValuation: string;
    readonly quotedRateApplicability: string;
    readonly levyComponentIdentity: string;
    readonly reservationLineage: string;
    readonly attributionSnapshot: string;
    readonly serviceProvisionRecording: string;
    readonly paymentReceiptRecording: string;
    readonly ordinaryRegimeRecording: string;
    readonly requestEventPayload: string;
    readonly nativeRoute: string;
  }>;
  readonly nativeSourceBasisHash: string;
  readonly nativeConsiderationBasisHash: string;
  readonly considerationAccountIds: readonly string[];
  readonly considerationRootIds: readonly string[];
  readonly considerationSources: readonly IndiaFinalComponentTaxNativeConsiderationSource[];
  readonly roomNights: readonly IndiaFinalComponentTaxFiscalSourceRoomNight[];
  readonly components: readonly IndiaFinalComponentTaxFiscalSourceComponent[];
  readonly journalLines: readonly IndiaFinalComponentTaxFiscalSourceJournalLine[];
  readonly sourceEvidenceHash: string;
}
export class IndiaFinalComponentTaxFiscalSourceValidationError extends Error { constructor(m:string){super(m);this.name="IndiaFinalComponentTaxFiscalSourceValidationError"} }
export class IndiaFinalComponentTaxFiscalSourceNotFoundError extends Error { constructor(m:string){super(m);this.name="IndiaFinalComponentTaxFiscalSourceNotFoundError"} }
export class IndiaFinalComponentTaxFiscalSourceConflictError extends Error { constructor(m:string){super(m);this.name="IndiaFinalComponentTaxFiscalSourceConflictError"} }

function exact(v:unknown,keys:readonly string[]):Row{if(typeof v!=="object"||v===null||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype||Object.getOwnPropertySymbols(v).length)throw new IndiaFinalComponentTaxFiscalSourceValidationError("input must be an exact plain object");const d=Object.getOwnPropertyDescriptors(v),a=Object.keys(d).sort(),e=[...keys].sort();if(a.length!==e.length||a.some((k,i)=>k!==e[i])||Object.values(d).some(x=>x.get||x.set||!x.enumerable||!("value" in x)))throw new IndiaFinalComponentTaxFiscalSourceValidationError("input shape is invalid");return v as Row}
function id(v:unknown,n:string):string{if(typeof v!=="string"||!UUID.test(v))throw new IndiaFinalComponentTaxFiscalSourceValidationError(`${n} must be a lowercase UUID`);return v}
function str(v:unknown,n:string):string{if(typeof v!=="string")throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return v}
function hash(v:unknown,n:string):string{const x=str(v,n);if(!HASH.test(x))throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return x}
function num(v:unknown,n:string):number{const x=Number(v);if(!Number.isSafeInteger(x)||x<0)throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return x}
function freeze<T>(v:T):T{if(v&&typeof v==="object"&&!Object.isFrozen(v)){for(const x of Object.values(v as Record<string,unknown>))freeze(x);Object.freeze(v)}return v}
function digest(v:unknown):string{return createHash("sha256").update(JSON.stringify(v)).digest("hex")}
function keys(v:Row|undefined,expected:readonly string[]):boolean{return !!v&&Object.keys(v).sort().join("\0")===[...expected].sort().join("\0")}
function storedId(v:unknown,n:string):string{if(typeof v!=="string"||!UUID.test(v))throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return v}
function storedMinor(v:unknown,n:string,allowZero=true):bigint{const x=str(v,n);if(!/^(?:0|-?[1-9]\d*)$/.test(x))throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);const value=BigInt(x);if(value<-(1n<<63n)||value>(1n<<63n)-1n||(!allowZero&&value===0n))throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return value}
function storedDate(v:unknown,n:string):string{const x=str(v,n),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(x);if(!m)throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]),leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];if(year<1||month<1||month>12||day<1||day>(days[month-1]??0))throw new IndiaFinalComponentTaxFiscalSourceConflictError(`invalid stored ${n}`);return x}
export class IndiaFinalComponentTaxFiscalSourceService {
 async resolve(tx:Tx,raw:IndiaFinalComponentTaxFiscalSourceInput):Promise<IndiaFinalComponentTaxFiscalSourceResult>{
  if(typeof tx!=="function")throw new IndiaFinalComponentTaxFiscalSourceValidationError("tenant transaction is unavailable");
  const x=exact(raw,["tenantId","propertyNode","reservationId","folioId","journalId"]),tenant=id(x.tenantId,"tenantId"),property=id(x.propertyNode,"propertyNode"),reservation=id(x.reservationId,"reservationId"),folio=id(x.folioId,"folioId"),journal=id(x.journalId,"journalId");
  const bindings=await tx<Row[]>`SELECT id::text FROM public.india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${tenant}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid AND property_node=${property}::uuid AND reservation_id=${reservation}::uuid AND folio_id=${folio}::uuid AND journal_id=${journal}::uuid`;
  if(bindings.length===0)throw new IndiaFinalComponentTaxFiscalSourceNotFoundError("fiscal source was not found");
  if(bindings.length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("fiscal source binding is ambiguous");
  const roots=await tx<Row[]>`SELECT b.id::text posting_binding_id,b.tax_id::text,b.tax_generation,b.tax_evidence_hash,b.valuation_id::text,b.valuation_generation,b.applicability_id::text,b.reservation_id::text,b.folio_id::text,b.guest_account_id::text,b.property_node::text,b.business_date::text,b.currency::text,t.generation current_tax_generation,t.evidence_hash current_tax_evidence_hash,t.transaction_value_minor::text,t.tax_minor::text,t.grand_total_minor::text,t.component_family,t.selected_extension_id::text,t.selected_extension_version,t.section14_evidence_hash,t.levy_component_identity_evidence_hash,t.reservation_lineage_evidence_hash,t.attribution_snapshot_evidence_hash,t.final_valuation_evidence_hash,t.quoted_rate_applicability_evidence_hash,v.evidence_hash valuation_evidence_hash,v.generation valuation_current_generation,v.property_node::text valuation_property,v.reservation_id::text valuation_reservation,v.folio_id::text valuation_folio,v.folio_account_id::text valuation_account,v.currency::text valuation_currency,v.disposition,a.evidence_hash applicability_evidence_hash,a.selected_content_hash,a.property_node::text applicability_property,a.reservation_id::text applicability_reservation,a.folio_id::text applicability_folio,a.final_valuation_id::text applicability_valuation,a.component_family applicability_family,j.kind journal_kind,j.reverses::text journal_reverses,j.source journal_source,j.property_node::text journal_property,j.business_date::text journal_business_date,j.currency::text journal_currency,fa.property_node::text account_property,fa.currency::text account_currency,fa.role account_role,f.account_id::text folio_account,r.property_node::text reservation_property FROM public.india_gst_accommodation_final_component_tax_journal_binding b JOIN public.india_gst_accommodation_final_component_tax t ON t.tenant_id=b.tenant_id AND t.id=b.tax_id JOIN public.india_gst_accommodation_final_valuation v ON v.tenant_id=t.tenant_id AND v.id=t.valuation_id JOIN public.india_gst_accommodation_quoted_rate_applicability a ON a.tenant_id=t.tenant_id AND a.id=t.applicability_id JOIN public.journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id JOIN public.folio f ON f.tenant_id=b.tenant_id AND f.id=b.folio_id JOIN public.account fa ON fa.tenant_id=f.tenant_id AND fa.id=f.account_id JOIN public.reservation r ON r.tenant_id=b.tenant_id AND r.id=b.reservation_id WHERE b.tenant_id=${tenant}::uuid AND b.tenant_id=current_setting('app.tenant_id',true)::uuid AND b.property_node=${property}::uuid AND b.reservation_id=${reservation}::uuid AND b.folio_id=${folio}::uuid AND b.journal_id=${journal}::uuid`;
  if(roots.length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("fiscal source ancestry is incomplete or ambiguous");const r=roots[0]!;
  const taxId=id(r.tax_id,"tax id"),valuationId=id(r.valuation_id,"valuation id"),applicabilityId=id(r.applicability_id,"applicability id"),guestAccount=id(r.guest_account_id,"guest account id");
  const taxGeneration=num(r.tax_generation,"tax generation"),valuationGeneration=num(r.valuation_generation,"valuation generation"),taxHash=hash(r.tax_evidence_hash,"tax evidence hash"),valuationHash=hash(r.final_valuation_evidence_hash,"valuation evidence hash"),appHash=hash(r.quoted_rate_applicability_evidence_hash,"applicability evidence hash");
  if(Number(r.current_tax_generation)!==taxGeneration||r.current_tax_evidence_hash!==taxHash||r.property_node!==property||r.reservation_id!==reservation||r.folio_id!==folio||r.valuation_property!==property||r.valuation_reservation!==reservation||r.valuation_folio!==folio||r.applicability_property!==property||r.applicability_reservation!==reservation||r.applicability_folio!==folio||r.reservation_property!==property||r.account_property!==property||r.valuation_account!==guestAccount||r.folio_account!==guestAccount||r.account_role!=="guest"||r.currency!=="INR"||r.valuation_currency!=="INR"||r.account_currency!=="INR"||r.journal_currency!=="INR"||r.journal_property!==property||r.journal_business_date!==r.business_date||r.journal_kind!=="charge"||r.journal_reverses!==null||r.disposition!=="ordinary_final"||r.applicability_valuation!==valuationId||r.applicability_family!==r.component_family||r.valuation_evidence_hash!==valuationHash||r.applicability_evidence_hash!==appHash||Number(r.valuation_current_generation)!==valuationGeneration)throw new IndiaFinalComponentTaxFiscalSourceConflictError("persisted fiscal-source lineage is inconsistent");
  const source=r.journal_source as Row;if(!source||source.interface!=="financials.india-final-component-tax.post"||source.tax_id!==taxId||Object.keys(source).length!==2)throw new IndiaFinalComponentTaxFiscalSourceConflictError("journal source is inconsistent");
  const stale=await tx<Row[]>`SELECT (EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax s WHERE s.tenant_id=${tenant}::uuid AND s.supersedes_tax_id=${taxId}::uuid) OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation s WHERE s.tenant_id=${tenant}::uuid AND s.supersedes_valuation_id=${valuationId}::uuid) OR EXISTS(SELECT 1 FROM public.india_gst_final_component_tax_journal_reversal_binding z WHERE z.tenant_id=${tenant}::uuid AND z.original_journal_id=${journal}::uuid)) stale`;
  if(stale[0]?.stale!==false)throw new IndiaFinalComponentTaxFiscalSourceConflictError("fiscal source is no longer current or has been reversed");
  const nightsRaw=await tx<Row[]>`SELECT ordinal,business_date::text,final_value_minor::text,slab_upto_minor::text,aggregate_rate_basis_points,itc_eligible,tax_minor::text FROM public.india_gst_accommodation_final_component_tax_room_night WHERE tenant_id=${tenant}::uuid AND tax_id=${taxId}::uuid ORDER BY ordinal`;
  if(nightsRaw.length<1||nightsRaw.length>366)throw new IndiaFinalComponentTaxFiscalSourceConflictError("room-night evidence is incomplete");
  const nights=nightsRaw.map((n,i)=>{if(Number(n.ordinal)!==i)throw new IndiaFinalComponentTaxFiscalSourceConflictError("room-night ordinals are not contiguous");return {ordinal:String(n.ordinal),businessDate:str(n.business_date,"business date"),transactionValueMinor:str(n.final_value_minor,"night value"),slabUptoMinor:n.slab_upto_minor===null?null:str(n.slab_upto_minor,"slab"),aggregateRateBasisPoints:num(n.aggregate_rate_basis_points,"aggregate rate"),itcEligible:n.itc_eligible===true,taxMinor:str(n.tax_minor,"night tax")}});
  const compsRaw=await tx<Row[]>`SELECT room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor::text FROM public.india_gst_accommodation_final_component_tax_component WHERE tenant_id=${tenant}::uuid AND tax_id=${taxId}::uuid ORDER BY room_night_ordinal,component_ordinal`;
  const storedFamily=r.component_family;if(storedFamily!=="igst"&&storedFamily!=="cgst_sgst"&&storedFamily!=="cgst_utgst")throw new IndiaFinalComponentTaxFiscalSourceConflictError("component family is invalid");const family:IndiaFinalComponentTaxFiscalSourceResult["componentFamily"]=storedFamily;const ids=family==="igst"?["igst"]:family==="cgst_sgst"?["cgst","sgst"]:["cgst","utgst"];
  if(compsRaw.length!==nights.length*ids.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("component evidence is incomplete");
  const comps=compsRaw.map((c,i)=>{const night=Math.floor(i/ids.length),ord=i%ids.length;if(Number(c.room_night_ordinal)!==night||Number(c.component_ordinal)!==ord||c.component_identity!==ids[ord])throw new IndiaFinalComponentTaxFiscalSourceConflictError("component topology is inconsistent");return {roomNightOrdinal:night,componentOrdinal:ord,componentIdentity:c.component_identity as "igst"|"cgst"|"sgst"|"utgst",rateBasisPoints:num(c.rate_basis_points,"component rate"),taxAmountMinor:str(c.tax_amount_minor,"component tax")}});
  let tv=0n,tax=0n;for(const [i,n] of nights.entries()){const cs=comps.filter(c=>c.roomNightOrdinal===i);const nt=cs.reduce((s,c)=>s+BigInt(c.taxAmountMinor),0n);if(nt!==BigInt(n.taxMinor)||cs.some(c=>c.rateBasisPoints*ids.length!==n.aggregateRateBasisPoints))throw new IndiaFinalComponentTaxFiscalSourceConflictError("component amounts or rates do not reconcile");tv+=BigInt(n.transactionValueMinor);tax+=nt}
  if(tv.toString()!==r.transaction_value_minor||tax.toString()!==r.tax_minor||(tv+tax).toString()!==r.grand_total_minor)throw new IndiaFinalComponentTaxFiscalSourceConflictError("tax totals do not reconcile");
  const roomJson=nights.map((n,i)=>({ordinal:n.ordinal,businessDate:n.businessDate,transactionValueMinor:n.transactionValueMinor,slab:{uptoMinor:n.slabUptoMinor===null?null:Number(n.slabUptoMinor),aggregateRateBasisPoints:n.aggregateRateBasisPoints,components:comps.filter(c=>c.roomNightOrdinal===i).map(c=>({identity:c.componentIdentity,rateBasisPoints:c.rateBasisPoints,taxMinor:c.taxAmountMinor}))},taxMinor:n.taxMinor}));
  const canonicalTaxHash=digest({tenant,property,reservation,folio,valuationId,generation:valuationGeneration,roomNights:roomJson,taxMinor:String(r.tax_minor),grandTotalMinor:String(r.grand_total_minor),predecessorHashes:{finalValuation:valuationHash,quotedRateApplicability:appHash,section14:hash(r.section14_evidence_hash,"section14 hash"),levyComponentIdentity:hash(r.levy_component_identity_evidence_hash,"levy hash"),reservationLineage:hash(r.reservation_lineage_evidence_hash,"lineage hash"),attributionSnapshot:hash(r.attribution_snapshot_evidence_hash,"attribution hash")}});
  if(canonicalTaxHash!==taxHash)throw new IndiaFinalComponentTaxFiscalSourceConflictError("component-tax evidence does not byte-match persisted truth");
  const linesRaw=await tx<Row[]>`SELECT l.id::text,l.seq,l.account_id::text,a.role account_role,l.folio_id::text,l.tx_code,l.description,l.amount_minor::text,l.quantity::text,l.business_date::text,l.currency::text,l.tax_detail FROM public.posting_line l JOIN public.account a ON a.tenant_id=l.tenant_id AND a.id=l.account_id WHERE l.tenant_id=${tenant}::uuid AND l.journal_id=${journal}::uuid ORDER BY l.seq,l.id`;
  const lines=linesRaw.map((l,i)=>{if(Number(l.seq)!==i+1||l.business_date!==r.business_date||l.currency!=="INR")throw new IndiaFinalComponentTaxFiscalSourceConflictError("journal line topology is inconsistent");return {id:id(l.id,"line id"),seq:i+1,accountId:id(l.account_id,"line account"),accountRole:str(l.account_role,"account role"),folioId:l.folio_id===null?null:id(l.folio_id,"line folio"),txCode:str(l.tx_code,"tx code"),description:str(l.description,"line description"),amountMinor:str(l.amount_minor,"line amount"),quantity:str(l.quantity,"line quantity"),businessDate:str(l.business_date,"line date"),currency:"INR" as const,taxDetail:l.tax_detail??null}});
  const positiveIdentities=new Set(comps.filter(c=>BigInt(c.taxAmountMinor)>0n).map(c=>c.componentIdentity));
  if(lines.length!==2+positiveIdentities.size||lines[0]?.accountId!==guestAccount||lines[0]?.folioId!==folio||lines[0]?.amountMinor!==r.grand_total_minor||lines.slice(1).some(l=>l.folioId!==null||l.taxDetail!==null)||lines.reduce((s,l)=>s+BigInt(l.amountMinor),0n)!==0n)throw new IndiaFinalComponentTaxFiscalSourceConflictError("journal is not the exact balanced posting topology");
  if(lines.filter(l=>l.taxDetail!==null).length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical tax detail must exist only on the guest root");
  const detail=lines[0]!.taxDetail as Row;
  const dTax=detail?.tax as Row,dVal=detail?.valuation as Row,dApp=detail?.applicability as Row,dPosting=detail?.posting as Row,dTotals=detail?.totals as Row,dJurisdiction=detail?.jurisdiction as Row,dRevenue=detail?.revenueRoute as Row,dComponents=detail?.components;
  if(!keys(detail,["schemaVersion","tax","valuation","applicability","posting","totals","componentFamily","jurisdiction","revenueRoute","components"])||!keys(dTax,["taxId","taxGeneration","evidenceHash"])||!keys(dVal,["valuationId","valuationGeneration","evidenceHash"])||!keys(dApp,["applicabilityId","evidenceHash"])||!keys(dPosting,["propertyNode","reservationId","folioId","journalId","currency"])||!keys(dTotals,["transactionValueMinor","taxMinor","grandTotalMinor"])||!keys(dJurisdiction,["extensionId","ownerTenantId","key","version","contentHash"])||!keys(dRevenue,["mappingId","semanticCode","txCode","creditAccountId"])||detail?.schemaVersion!=="india_accommodation_component_tax_v1"||dTax?.taxId!==taxId||Number(dTax?.taxGeneration)!==taxGeneration||dTax?.evidenceHash!==taxHash||dVal?.valuationId!==valuationId||Number(dVal?.valuationGeneration)!==valuationGeneration||dVal?.evidenceHash!==valuationHash||dApp?.applicabilityId!==applicabilityId||dApp?.evidenceHash!==appHash||dPosting?.propertyNode!==property||dPosting?.reservationId!==reservation||dPosting?.folioId!==folio||dPosting?.journalId!==journal||dPosting?.currency!=="INR"||dTotals?.transactionValueMinor!==r.transaction_value_minor||dTotals?.taxMinor!==r.tax_minor||dTotals?.grandTotalMinor!==r.grand_total_minor||detail?.componentFamily!==family||dJurisdiction?.extensionId!==r.selected_extension_id||dJurisdiction?.ownerTenantId!==null||dJurisdiction?.key!=="in-gst-lodging"||Number(dJurisdiction?.version)!==Number(r.selected_extension_version)||dJurisdiction?.contentHash!==r.selected_content_hash||!Array.isArray(dComponents)||dRevenue?.semanticCode!=="room_revenue"||dRevenue?.creditAccountId!==lines[1]?.accountId||dRevenue?.txCode!==lines[1]?.txCode||lines[1]?.amountMinor!==(-tv).toString()||lines[1]?.accountRole!=="revenue")throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical tax detail is inconsistent");
  const totals=new Map<string,bigint>();for(const c of comps)totals.set(c.componentIdentity,(totals.get(c.componentIdentity)??0n)+BigInt(c.taxAmountMinor));
  if(dComponents.length!==ids.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical component route set is incomplete");let lineIndex=2;
  type RouteExpectation=Readonly<{mappingId:string;semanticKind:"revenue"|"tax";semanticCode:string;txCode:string;creditAccountId:string;accountRole:"revenue"|"tax_payable"}>;
  const routeExpectations:RouteExpectation[]=[{mappingId:id(dRevenue.mappingId,"revenue mapping id"),semanticKind:"revenue",semanticCode:"room_revenue",txCode:str(dRevenue.txCode,"revenue tx code"),creditAccountId:id(dRevenue.creditAccountId,"revenue credit account"),accountRole:"revenue"}];
  for(const [i,identity] of ids.entries()){const dc=dComponents[i] as Row,amount=totals.get(identity)??0n,semantic=identity.toUpperCase(),route=dc?.route as Row|null;if(!keys(dc,["componentIdentity","semanticCode","amountMinor","route"])||dc?.componentIdentity!==identity||dc?.semanticCode!==semantic||dc?.amountMinor!==amount.toString())throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical component detail is inconsistent");if(amount===0n){if(route!==null)throw new IndiaFinalComponentTaxFiscalSourceConflictError("zero component has a route");continue}const line=lines[lineIndex++];if(!route||!keys(route,["mappingId","semanticCode","txCode","creditAccountId"])||route.semanticCode!==semantic||route.creditAccountId!==line?.accountId||route.txCode!==line?.txCode||line?.amountMinor!==(-amount).toString()||line?.accountRole!=="tax_payable")throw new IndiaFinalComponentTaxFiscalSourceConflictError("component credit route is inconsistent");routeExpectations.push({mappingId:id(route.mappingId,"component mapping id"),semanticKind:"tax",semanticCode:semantic,txCode:str(route.txCode,"component tx code"),creditAccountId:id(route.creditAccountId,"component credit account"),accountRole:"tax_payable"})}
  if(new Set(routeExpectations.map(route=>route.mappingId)).size!==routeExpectations.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical route mappings are duplicated");
  const routeRows=await tx<Row[]>`SELECT m.id::text,m.semantic_kind,m.semantic_code,m.tx_code,tr.credit_account_id::text,a.role account_role FROM public.tax_semantic_route m JOIN public.tx_code_route tr ON tr.tenant_id=m.tenant_id AND tr.property_node=m.property_node AND tr.currency=m.currency AND tr.tx_code=m.tx_code JOIN public.account a ON a.tenant_id=tr.tenant_id AND a.id=tr.credit_account_id AND a.property_node=m.property_node AND a.currency=m.currency WHERE m.tenant_id=${tenant}::uuid AND m.property_node=${property}::uuid AND m.currency='INR' AND m.jurisdiction_extension_id=${String(r.selected_extension_id)}::uuid AND m.jurisdiction_owner_tenant_id IS NULL AND m.jurisdiction_key='in-gst-lodging' AND m.jurisdiction_version=${Number(r.selected_extension_version)} AND m.jurisdiction_content_hash=${String(r.selected_content_hash)} AND m.id IN (SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(routeExpectations.map(route=>route.mappingId))}::jsonb))`;
  if(routeRows.length!==routeExpectations.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical route set is incomplete");
  const actualRoutes=new Map(routeRows.map(row=>[String(row.id),row]));
  for(const expected of routeExpectations){const actual=actualRoutes.get(expected.mappingId);if(!actual||actual.semantic_kind!==expected.semanticKind||actual.semantic_code!==expected.semanticCode||actual.tx_code!==expected.txCode||actual.credit_account_id!==expected.creditAccountId||actual.account_role!==expected.accountRole)throw new IndiaFinalComponentTaxFiscalSourceConflictError("canonical route binding is inconsistent")}
  // PostgreSQL jsonb does not preserve the producer's insertion order. Rebuild
  // the already shape- and value-authenticated detail in the canonical order
  // required by downstream exact-record consumers before freezing or hashing it.
  const canonicalTaxDetail={
    schemaVersion:detail.schemaVersion,
    tax:{taxId:dTax.taxId,taxGeneration:dTax.taxGeneration,evidenceHash:dTax.evidenceHash},
    valuation:{valuationId:dVal.valuationId,valuationGeneration:dVal.valuationGeneration,evidenceHash:dVal.evidenceHash},
    applicability:{applicabilityId:dApp.applicabilityId,evidenceHash:dApp.evidenceHash},
    posting:{propertyNode:dPosting.propertyNode,reservationId:dPosting.reservationId,folioId:dPosting.folioId,journalId:dPosting.journalId,currency:dPosting.currency},
    totals:{transactionValueMinor:dTotals.transactionValueMinor,taxMinor:dTotals.taxMinor,grandTotalMinor:dTotals.grandTotalMinor},
    componentFamily:detail.componentFamily,
    jurisdiction:{extensionId:dJurisdiction.extensionId,ownerTenantId:dJurisdiction.ownerTenantId,key:dJurisdiction.key,version:dJurisdiction.version,contentHash:dJurisdiction.contentHash},
    revenueRoute:{mappingId:dRevenue.mappingId,semanticCode:dRevenue.semanticCode,txCode:dRevenue.txCode,creditAccountId:dRevenue.creditAccountId},
    components:dComponents.map((component)=>{const route=component.route as Row|null;return {componentIdentity:component.componentIdentity,semanticCode:component.semanticCode,amountMinor:component.amountMinor,route:route===null?null:{mappingId:route.mappingId,semanticCode:route.semanticCode,txCode:route.txCode,creditAccountId:route.creditAccountId}}}),
  };
  const canonicalLines=lines.map((line,index)=>index===0?{...line,taxDetail:canonicalTaxDetail}:line);
  const predecessors={section14:hash(r.section14_evidence_hash,"section14 hash"),levyComponentIdentity:hash(r.levy_component_identity_evidence_hash,"levy hash"),reservationLineage:hash(r.reservation_lineage_evidence_hash,"lineage hash"),attributionSnapshot:hash(r.attribution_snapshot_evidence_hash,"attribution hash")};
  const body={state:"eligible_current_posted_source" as const,postingBindingId:id(r.posting_binding_id,"binding id"),journalId:journal,taxId,taxGeneration,taxEvidenceHash:taxHash,valuationId,valuationGeneration,finalValuationEvidenceHash:valuationHash,applicabilityId,applicabilityEvidenceHash:appHash,reservationId:reservation,folioId:folio,guestAccountId:guestAccount,propertyNode:property,businessDate:str(r.business_date,"business date"),currency:"INR" as const,transactionValueMinor:str(r.transaction_value_minor,"transaction value"),taxMinor:str(r.tax_minor,"tax total"),grandTotalMinor:str(r.grand_total_minor,"grand total"),componentFamily:family,predecessorHashes:predecessors,roomNights:nights,components:comps,journalLines:canonicalLines};
  return freeze({...body,sourceEvidenceHash:digest({tenantId:tenant,...body})});
 }

  /**
   * Reads the native source in the same transaction that ran the governed
   * accounting-event handler. The private closure reader authenticates the
   * binding hash against a fresh, complete financial-source reconstruction;
   * this projection then independently rereads and matches the selected typed
   * timing, tax, valuation, consideration, component and journal rows.
   */
 async resolveNative(tx:Tx,raw:IndiaFinalComponentTaxNativeFiscalSourceInput):Promise<IndiaFinalComponentTaxNativeFiscalSourceResult>{
  if(typeof tx!=="function")throw new IndiaFinalComponentTaxFiscalSourceValidationError("tenant transaction is unavailable");
  const x=exact(raw,["tenantId","propertyNode","reservationId","folioId","postingBindingId"]);
  const tenant=id(x.tenantId,"tenantId"),property=id(x.propertyNode,"propertyNode"),reservation=id(x.reservationId,"reservationId"),folio=id(x.folioId,"folioId"),bindingId=id(x.postingBindingId,"postingBindingId");
  const roots=await tx<Row[]>`SELECT
    b.id::text posting_binding_id,b.accounting_kind,b.invoice_source_kind,b.native_timing_id::text,
    b.journal_id::text,b.tax_id::text,b.tax_generation,b.tax_evidence_hash,b.valuation_id::text,
    b.valuation_generation,b.applicability_id::text,b.reservation_id::text,b.folio_id::text,
    b.guest_account_id::text,b.property_node::text,b.business_date::text,b.currency::text,
    b.native_source_basis_hash,b.native_consideration_basis_hash,b.native_tax_minor::text,
    b.request_event_seq,b.request_event_id::text,b.request_event_payload_hash,
    b.native_route_evidence_hash,b.evidence_hash accounting_evidence_hash,b.posted_by::text,b.posted_at::text,
    native_journal.id::text native_journal_id,native_journal.kind native_journal_kind,
    native_journal.reverses::text native_journal_reverses,native_journal.property_node::text native_journal_property,
    native_journal.business_date::text native_journal_business_date,
    native_journal.currency::text native_journal_currency,native_journal.source native_journal_source,
    native_journal.created_by::text native_journal_created_by,native_journal.created_at::text native_journal_created_at,
    n.evidence_hash native_timing_evidence_hash,n.native_source_basis_hash timing_source_basis_hash,
    n.native_consideration_basis_hash timing_consideration_basis_hash,
    n.service_provision_evidence_hash,n.payment_receipt_evidence_hash,n.ordinary_regime_evidence_hash,
    n.accounting_binding_id::text timing_binding_id,n.tax_id::text timing_tax_id,
    n.applicability_id::text timing_applicability_id,n.valuation_id::text timing_valuation_id,
    n.valuation_generation timing_valuation_generation,n.folio_account_id::text timing_account_id,
    n.buyer_party_id::text timing_buyer_party_id,
    n.invoice_issue_date::text timing_business_date,n.transaction_timestamp::text timing_timestamp,
    (n.issuing_transaction_id=pg_catalog.pg_current_xact_id()
      AND n.transaction_timestamp=pg_catalog.transaction_timestamp()) same_transaction,
    EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
     WHERE origin.tenant_id=n.tenant_id AND origin.native_timing_id=n.id
       AND origin.native_accounting_binding_id=b.id AND origin.document_id=n.prospective_document_id
       AND origin.source_kind='native_current_transaction_graph' AND origin.source_version=2
       AND origin.source_journal_id IS NOT DISTINCT FROM b.journal_id
       AND origin.native_source_basis_hash=n.native_source_basis_hash
       AND document.kind='invoice' AND document.status='issued'
       AND document.business_date=n.invoice_issue_date
       AND document.issued_at=n.transaction_timestamp) completed_origin,
    t.generation current_tax_generation,t.evidence_hash current_tax_evidence_hash,
    t.transaction_value_minor::text,t.tax_minor::text,t.grand_total_minor::text,t.component_family,
    t.rate_selection_kind,t.invoice_source_kind tax_source_kind,t.valuation_basis_kind tax_valuation_basis,
    t.native_timing_id::text tax_timing_id,t.native_timing_evidence_hash tax_timing_evidence_hash,
    t.native_rate_selection_evidence_hash,t.native_consideration_basis_hash tax_consideration_basis_hash,
    t.final_valuation_evidence_hash,t.quoted_rate_applicability_evidence_hash,
    t.levy_component_identity_evidence_hash,t.reservation_lineage_evidence_hash,
    t.attribution_snapshot_evidence_hash,
    a.evidence_hash current_applicability_evidence_hash,a.invoice_source_kind applicability_source_kind,
    a.rate_selection_kind applicability_rate_kind,a.valuation_basis_kind applicability_valuation_basis,
    a.native_timing_id::text applicability_timing_id,a.native_timing_evidence_hash applicability_timing_evidence_hash,
    a.native_rate_selection_evidence_hash applicability_rate_evidence_hash,
    a.native_consideration_basis_hash applicability_consideration_basis_hash,
    v.generation current_valuation_generation,v.evidence_hash current_valuation_evidence_hash,
    v.native_consideration_basis_hash valuation_consideration_basis_hash,v.basis_kind,
    v.disposition,v.transaction_value_minor::text valuation_transaction_value_minor,
    v.native_source_count,v.folio_account_id::text valuation_account_id,v.buyer_party_id::text buyer_party_id,
    f.account_id::text folio_account_id,f.reservation_id::text folio_reservation_id,
    ga.property_node::text account_property,ga.currency::text account_currency,ga.role account_role,
    r.property_node::text reservation_property,
    EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor
      WHERE successor.tenant_id=t.tenant_id AND successor.supersedes_tax_id=t.id) tax_has_successor,
    EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
      WHERE successor.tenant_id=v.tenant_id AND successor.supersedes_valuation_id=v.id) valuation_has_successor,
    EXISTS(SELECT 1 FROM public.journal reversal
      WHERE reversal.tenant_id=b.tenant_id AND reversal.reverses=b.journal_id) journal_has_reversal
   FROM public.india_gst_accommodation_final_component_tax_journal_binding b
   JOIN public.india_gst_native_invoice_timing n ON n.tenant_id=b.tenant_id AND n.id=b.native_timing_id
   JOIN public.india_gst_accommodation_final_component_tax t ON t.tenant_id=b.tenant_id AND t.id=b.tax_id
   JOIN public.india_gst_accommodation_quoted_rate_applicability a ON a.tenant_id=b.tenant_id AND a.id=b.applicability_id
   JOIN public.india_gst_accommodation_final_valuation v ON v.tenant_id=b.tenant_id AND v.id=b.valuation_id
   LEFT JOIN public.journal native_journal ON native_journal.tenant_id=b.tenant_id AND native_journal.id=b.journal_id
   JOIN public.folio f ON f.tenant_id=b.tenant_id AND f.id=b.folio_id
   JOIN public.account ga ON ga.tenant_id=f.tenant_id AND ga.id=f.account_id
   JOIN public.reservation r ON r.tenant_id=b.tenant_id AND r.id=b.reservation_id
  WHERE b.tenant_id=${tenant}::uuid AND b.tenant_id=current_setting('app.tenant_id',true)::uuid
    AND b.id=${bindingId}::uuid AND b.property_node=${property}::uuid
    AND b.reservation_id=${reservation}::uuid AND b.folio_id=${folio}::uuid`;
  if(roots.length===0)throw new IndiaFinalComponentTaxFiscalSourceNotFoundError("native fiscal source was not found");
  if(roots.length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native fiscal source ancestry is incomplete or ambiguous");
  const r=roots[0]!;
  const timingId=storedId(r.native_timing_id,"native timing id"),journalId=r.journal_id===null?null:storedId(r.journal_id,"native journal id"),taxId=storedId(r.tax_id,"native tax id"),valuationId=storedId(r.valuation_id,"native valuation id"),applicabilityId=storedId(r.applicability_id,"native applicability id"),guestAccountId=storedId(r.guest_account_id,"native guest account id"),buyerPartyId=storedId(r.buyer_party_id,"native buyer party id");
  const taxGeneration=num(r.tax_generation,"native tax generation"),valuationGeneration=num(r.valuation_generation,"native valuation generation"),transactionValue=storedMinor(r.transaction_value_minor,"native transaction value",false),tax=storedMinor(r.tax_minor,"native tax"),grand=storedMinor(r.grand_total_minor,"native grand total",false),nativeTax=storedMinor(r.native_tax_minor,"native binding tax");
  const accountingEvidenceHash=hash(r.accounting_evidence_hash,"native accounting evidence hash"),timingEvidenceHash=hash(r.native_timing_evidence_hash,"native timing evidence hash"),taxEvidenceHash=hash(r.tax_evidence_hash,"native tax evidence hash"),valuationEvidenceHash=hash(r.final_valuation_evidence_hash,"native valuation evidence hash"),applicabilityEvidenceHash=hash(r.quoted_rate_applicability_evidence_hash,"native applicability evidence hash"),nativeSourceBasisHash=hash(r.native_source_basis_hash,"native source basis hash"),nativeConsiderationBasisHash=hash(r.native_consideration_basis_hash,"native consideration basis hash");
  const requestEventSeq=num(r.request_event_seq,"native request event sequence");
  const requestEventId=storedId(r.request_event_id,"native request event id"),postedBy=storedId(r.posted_by,"native accounting actor id");
  if(requestEventSeq<=0||r.posting_binding_id!==bindingId||r.accounting_kind!=="native_component_tax_delta"||r.invoice_source_kind!=="native_current_transaction"||r.property_node!==property||r.reservation_id!==reservation||r.folio_id!==folio||r.currency!=="INR"||r.account_role!=="guest"||r.account_currency!=="INR"||r.account_property!==property||r.reservation_property!==property||r.folio_account_id!==guestAccountId||r.folio_reservation_id!==reservation||r.valuation_account_id!==guestAccountId||r.timing_account_id!==guestAccountId||r.timing_buyer_party_id!==buyerPartyId||r.timing_binding_id!==bindingId||r.timing_tax_id!==taxId||r.timing_applicability_id!==applicabilityId||r.timing_valuation_id!==valuationId||Number(r.timing_valuation_generation)!==valuationGeneration||r.tax_timing_id!==timingId||r.applicability_timing_id!==timingId||r.tax_source_kind!=="native_current_transaction"||r.applicability_source_kind!=="native_current_transaction"||r.tax_valuation_basis!=="native_consideration"||r.applicability_valuation_basis!=="native_consideration"||r.basis_kind!=="native_consideration"||r.disposition!=="ordinary_final"||(r.same_transaction!==true&&r.completed_origin!==true)||r.tax_has_successor!==false||r.valuation_has_successor!==false||r.journal_has_reversal!==false)throw new IndiaFinalComponentTaxFiscalSourceConflictError("persisted native fiscal-source lineage is inconsistent");
  if(Number(r.current_tax_generation)!==taxGeneration||r.current_tax_evidence_hash!==taxEvidenceHash||Number(r.current_valuation_generation)!==valuationGeneration||r.current_valuation_evidence_hash!==valuationEvidenceHash||r.current_applicability_evidence_hash!==applicabilityEvidenceHash||r.tax_evidence_hash!==taxEvidenceHash||r.valuation_transaction_value_minor!==transactionValue.toString()||r.timing_business_date!==r.business_date||r.timing_timestamp!==r.posted_at||r.timing_source_basis_hash!==nativeSourceBasisHash||r.timing_consideration_basis_hash!==nativeConsiderationBasisHash||r.tax_consideration_basis_hash!==nativeConsiderationBasisHash||r.applicability_consideration_basis_hash!==nativeConsiderationBasisHash||r.valuation_consideration_basis_hash!==nativeConsiderationBasisHash||r.tax_timing_evidence_hash!==timingEvidenceHash||r.applicability_timing_evidence_hash!==timingEvidenceHash||r.applicability_rate_evidence_hash!==r.native_rate_selection_evidence_hash||nativeTax!==tax||grand!==transactionValue+tax||tax<0n||transactionValue<=0n||grand<=0n)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native fiscal-source hashes or totals are inconsistent");
  const businessDate=storedDate(r.business_date,"native business date");
  const nativeJournalSource=r.native_journal_source as Row;
  if(journalId===null){if(r.native_journal_id!==null)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native zero-tax binding unexpectedly resolves a journal")}
  else if(r.native_journal_id!==journalId||r.native_journal_kind!=="charge"||r.native_journal_reverses!==null||r.native_journal_property!==property||r.native_journal_business_date!==businessDate||r.native_journal_currency!=="INR"||r.native_journal_created_by!==postedBy||r.native_journal_created_at!==r.posted_at||!keys(nativeJournalSource,["interface","native_timing_id","tax_id","request_event_id"])||nativeJournalSource.interface!=="financials.india-native-component-tax.post"||nativeJournalSource.native_timing_id!==timingId||nativeJournalSource.tax_id!==taxId||nativeJournalSource.request_event_id!==requestEventId)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component-tax journal header is inconsistent");
  const familyValue=r.component_family;
  if(familyValue!=="igst"&&familyValue!=="cgst_sgst"&&familyValue!=="cgst_utgst")throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component family is invalid");
  const family:IndiaFinalComponentTaxNativeFiscalSourceResult["componentFamily"]=familyValue;
  const rateKindValue=r.rate_selection_kind;
  if(rateKindValue!=="ordinary_section13_single_version"&&rateKindValue!=="genuine_section14_rate_change"||r.applicability_rate_kind!==rateKindValue)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native rate-selection branch is inconsistent");
  const rateSelectionKind:IndiaFinalComponentTaxNativeFiscalSourceResult["rateSelectionKind"]=rateKindValue;

  const closureRows=await tx<Row[]>`SELECT posting_binding_id::text,accounting_evidence_hash,
    source_closure FROM public.read_india_native_accounting_source_closure(
      ${tenant}::uuid,${bindingId}::uuid)`;
  if(closureRows.length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("authenticated native consideration closure is unavailable");
  const closureRow=closureRows[0]!;
  if(!keys(closureRow,["posting_binding_id","accounting_evidence_hash","source_closure"])
    ||closureRow.posting_binding_id!==bindingId||closureRow.accounting_evidence_hash!==accountingEvidenceHash)
    throw new IndiaFinalComponentTaxFiscalSourceConflictError("authenticated native consideration closure has the wrong binding");
  const authenticatedClosure=closureRow.source_closure as Row;
  if(!keys(authenticatedClosure,["accountId","accountIds","rootIds","sources"])
    ||authenticatedClosure.accountId!==guestAccountId
    ||!Array.isArray(authenticatedClosure.accountIds)||!Array.isArray(authenticatedClosure.rootIds)
    ||!Array.isArray(authenticatedClosure.sources))
    throw new IndiaFinalComponentTaxFiscalSourceConflictError("authenticated native consideration closure is malformed");

  const nightsRaw=await tx<Row[]>`SELECT ordinal,business_date::text,final_value_minor::text,
    slab_upto_minor::text,aggregate_rate_basis_points,itc_eligible,tax_minor::text
   FROM public.india_gst_accommodation_final_component_tax_room_night
  WHERE tenant_id=${tenant}::uuid AND tax_id=${taxId}::uuid ORDER BY ordinal`;
  if(nightsRaw.length<1||nightsRaw.length>366)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native room-night evidence is incomplete");
  const nights=nightsRaw.map((night,index)=>{
    if(Number(night.ordinal)!==index||typeof night.itc_eligible!=="boolean")throw new IndiaFinalComponentTaxFiscalSourceConflictError("native room-night topology is inconsistent");
    const value=storedMinor(night.final_value_minor,"native room-night value",false),nightTax=storedMinor(night.tax_minor,"native room-night tax");
    if(value<=0n||nightTax<0n)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native room-night amount is invalid");
    return {ordinal:String(index),businessDate:storedDate(night.business_date,"native room-night date"),transactionValueMinor:value.toString(),slabUptoMinor:night.slab_upto_minor===null?null:storedMinor(night.slab_upto_minor,"native room-night slab",false).toString(),aggregateRateBasisPoints:num(night.aggregate_rate_basis_points,"native room-night rate"),itcEligible:night.itc_eligible,taxMinor:nightTax.toString()};
  });
  const componentsRaw=await tx<Row[]>`SELECT room_night_ordinal,component_ordinal,component_identity,
    rate_basis_points,tax_amount_minor::text
   FROM public.india_gst_accommodation_final_component_tax_component
  WHERE tenant_id=${tenant}::uuid AND tax_id=${taxId}::uuid
  ORDER BY room_night_ordinal,component_ordinal`;
  const identities=family==="igst"?["igst"] as const:family==="cgst_sgst"?["cgst","sgst"] as const:["cgst","utgst"] as const;
  if(componentsRaw.length!==nights.length*identities.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component evidence is incomplete");
  const components=componentsRaw.map((component,index)=>{const roomNightOrdinal=Math.floor(index/identities.length),componentOrdinal=index%identities.length,identity=identities[componentOrdinal]!;if(Number(component.room_night_ordinal)!==roomNightOrdinal||Number(component.component_ordinal)!==componentOrdinal||component.component_identity!==identity)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component topology is inconsistent");const amount=storedMinor(component.tax_amount_minor,"native component tax");const rate=num(component.rate_basis_points,"native component rate");if(amount<0n||rate<=0)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component amount or rate is invalid");return {roomNightOrdinal,componentOrdinal,componentIdentity:identity,rateBasisPoints:rate,taxAmountMinor:amount.toString()}});
  let nightValueTotal=0n,nightTaxTotal=0n;
  for(const [index,night] of nights.entries()){const child=components.filter(component=>component.roomNightOrdinal===index),childTax=child.reduce((sum,component)=>sum+BigInt(component.taxAmountMinor),0n);if(childTax!==BigInt(night.taxMinor)||child.some(component=>component.rateBasisPoints*identities.length!==night.aggregateRateBasisPoints))throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component amounts or rates do not reconcile");nightValueTotal+=BigInt(night.transactionValueMinor);nightTaxTotal+=childTax}
  if(nightValueTotal!==transactionValue||nightTaxTotal!==tax)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native room-night totals do not reconcile");

  const sourcesRaw=await tx<Row[]>`SELECT s.posting_root_id::text,s.current_amount_minor::text,
    s.tx_code,s.current_fragment_set_hash,root.journal_id::text,root.seq root_seq,
    root.account_id::text root_account_id,root.amount_minor::text root_amount_minor,
    root.tx_code root_tx_code,root.currency::text root_currency,root.tax_detail root_tax_detail,
    header.kind header_kind,header.reverses::text header_reverses,header.source header_source,
    header.currency::text header_currency,
    counterpart.account_id::text counterpart_account_id,counterpart_account.role counterpart_account_role,
    counterpart_account.property_node::text counterpart_account_property,
    counterpart_account.currency::text counterpart_account_currency,
    counterpart.amount_minor::text counterpart_amount_minor,counterpart.folio_id::text counterpart_folio_id,
    counterpart.tx_code counterpart_tx_code,counterpart.currency::text counterpart_currency,
    counterpart.tax_detail counterpart_tax_detail,
    (SELECT count(*)::int FROM public.posting_line line
      WHERE line.tenant_id=root.tenant_id AND line.journal_id=root.journal_id) header_line_count,
    (SELECT sum(line.amount_minor)::text FROM public.posting_line line
      WHERE line.tenant_id=root.tenant_id AND line.journal_id=root.journal_id) header_balance,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'folioId',allocation.folio_id::text,'amountMinor',allocation.amount_minor::text)
      ORDER BY allocation.folio_id) FROM (SELECT fragment.folio_id,sum(fragment.amount_minor) amount_minor
       FROM public.posting_line fragment WHERE fragment.tenant_id=root.tenant_id
        AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=root.id
       GROUP BY fragment.folio_id HAVING sum(fragment.amount_minor)<>0) allocation),'[]'::jsonb) allocations
   FROM public.india_gst_accommodation_valuation_source s
   JOIN public.posting_line root ON root.tenant_id=s.tenant_id AND root.id=s.posting_root_id
   JOIN public.journal header ON header.tenant_id=root.tenant_id AND header.id=root.journal_id
   LEFT JOIN public.posting_line counterpart ON counterpart.tenant_id=root.tenant_id
    AND counterpart.journal_id=root.journal_id AND counterpart.seq=2
   LEFT JOIN public.account counterpart_account ON counterpart_account.tenant_id=counterpart.tenant_id
    AND counterpart_account.id=counterpart.account_id
  WHERE s.tenant_id=${tenant}::uuid AND s.valuation_id=${valuationId}::uuid
    AND s.basis_kind='native_consideration' ORDER BY s.posting_root_id`;
  if(sourcesRaw.length<1||sourcesRaw.length>500||Number(r.native_source_count)!==sourcesRaw.length)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration-source membership is incomplete");
  const considerationSources:IndiaFinalComponentTaxNativeConsiderationSource[]=[],accountIds=new Set<string>([guestAccountId]),rootIds=new Set<string>(),sourceJournalIds=new Set<string>(),reverses:string[]=[];
  let sourceTotal=0n;
  for(const source of sourcesRaw){const postingRootId=storedId(source.posting_root_id,"native posting root id"),sourceJournalId=storedId(source.journal_id,"native consideration journal id"),rootAccountId=storedId(source.root_account_id,"native root account id"),counterpartAccountId=storedId(source.counterpart_account_id,"native counterpart account id"),currentAmount=storedMinor(source.current_amount_minor,"native source amount",false),rootAmount=storedMinor(source.root_amount_minor,"native root amount",false),counterpartAmount=storedMinor(source.counterpart_amount_minor,"native counterpart amount",false),fragmentHash=hash(source.current_fragment_set_hash,"native fragment-set hash"),headerSource=source.header_source as Row,ordinaryCharge=source.header_kind==="charge"&&source.header_reverses===null&&keys(headerSource,["interface"])&&headerSource.interface==="financials.charge.post",ordinaryCorrection=source.header_kind==="adjustment"&&source.header_reverses!==null&&keys(headerSource,["interface"])&&headerSource.interface==="financials.charge.reverse";if(rootIds.has(postingRootId)||sourceJournalIds.has(sourceJournalId)||rootAccountId!==guestAccountId||source.root_seq!==1&&Number(source.root_seq)!==1||source.root_tx_code!==source.tx_code||source.root_currency!=="INR"||source.header_currency!=="INR"||source.root_tax_detail!==null||(!ordinaryCharge&&!ordinaryCorrection)||Number(source.header_line_count)!==2||source.header_balance!=="0"||source.counterpart_account_role!=="revenue"||source.counterpart_account_property!==property||source.counterpart_account_currency!=="INR"||source.counterpart_folio_id!==null||source.counterpart_tx_code!==source.tx_code||source.counterpart_currency!=="INR"||source.counterpart_tax_detail!==null||counterpartAmount!==-rootAmount||currentAmount!==rootAmount)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration journal or source is inconsistent");const allocations=source.allocations;if(!Array.isArray(allocations)||allocations.length!==1)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration allocation is split or missing");const allocation=allocations[0] as Row;if(!keys(allocation,["folioId","amountMinor"])||allocation.folioId!==folio||storedMinor(allocation.amountMinor,"native current allocation",false)!==currentAmount)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration allocation differs from valuation");if(source.header_reverses!==null)reverses.push(storedId(source.header_reverses,"native reversed journal id"));rootIds.add(postingRootId);sourceJournalIds.add(sourceJournalId);accountIds.add(counterpartAccountId);sourceTotal+=currentAmount;considerationSources.push({postingRootId,journalId:sourceJournalId,currentAmountMinor:currentAmount.toString(),txCode:str(source.tx_code,"native source tx code"),currentFragmentSetHash:fragmentHash})}
  if(sourceTotal!==transactionValue||reverses.some(reversed=>!sourceJournalIds.has(reversed)))throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration closure is incomplete");
  const considerationRootIds=[...rootIds].sort(),considerationAccountIds=[...accountIds].sort();
  if(considerationAccountIds.length>501)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native consideration account bound is exceeded");
  const authenticatedAccountIds=authenticatedClosure.accountIds.map((value,index)=>storedId(value,`authenticated native account ${index}`));
  const authenticatedRootIds=authenticatedClosure.rootIds.map((value,index)=>storedId(value,`authenticated native root ${index}`));
  const authenticatedSources=authenticatedClosure.sources.map((value,index)=>{
    const source=value as Row;
    if(!keys(source,["postingRootId","journalId","currentAmountMinor","txCode","currentFragmentSetHash"]))
      throw new IndiaFinalComponentTaxFiscalSourceConflictError("authenticated native consideration source is malformed");
    return {postingRootId:storedId(source.postingRootId,`authenticated native source root ${index}`),journalId:storedId(source.journalId,`authenticated native source journal ${index}`),currentAmountMinor:storedMinor(source.currentAmountMinor,`authenticated native source amount ${index}`,false).toString(),txCode:str(source.txCode,`authenticated native source tx code ${index}`),currentFragmentSetHash:hash(source.currentFragmentSetHash,`authenticated native fragment-set hash ${index}`)};
  });
  if(JSON.stringify(authenticatedAccountIds)!==JSON.stringify(considerationAccountIds)
    ||JSON.stringify(authenticatedRootIds)!==JSON.stringify(considerationRootIds)
    ||JSON.stringify(authenticatedSources)!==JSON.stringify(considerationSources))
    throw new IndiaFinalComponentTaxFiscalSourceConflictError("selected native consideration rows differ from authenticated closure");

  let journalLines:IndiaFinalComponentTaxFiscalSourceJournalLine[]=[];
  if(journalId!==null){const linesRaw=await tx<Row[]>`SELECT line.id::text,line.seq,line.account_id::text,
      account.role account_role,account.property_node::text account_property,account.currency::text account_currency,
      line.folio_id::text,line.tx_code,line.description,
      line.amount_minor::text,line.quantity::text,line.business_date::text,line.currency::text,line.tax_detail
      ,EXISTS(SELECT 1 FROM public.tx_code code WHERE code.code=line.tx_code AND code.grp='tax') tax_code
     FROM public.posting_line line JOIN public.account account
       ON account.tenant_id=line.tenant_id AND account.id=line.account_id
    WHERE line.tenant_id=${tenant}::uuid AND line.journal_id=${journalId}::uuid ORDER BY line.seq,line.id`;
    journalLines=linesRaw.map((line,index)=>{if(Number(line.seq)!==index+1||line.currency!=="INR"||line.business_date!==businessDate||line.tax_detail!==null||line.quantity!=="1.000"||line.account_property!==property||line.account_currency!=="INR"||line.tax_code!==true)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component-tax journal line is inconsistent");return {id:storedId(line.id,"native journal line id"),seq:index+1,accountId:storedId(line.account_id,"native journal line account"),accountRole:str(line.account_role,"native journal line account role"),folioId:line.folio_id===null?null:storedId(line.folio_id,"native journal line folio"),txCode:str(line.tx_code,"native journal line tx code"),description:str(line.description,"native journal line description"),amountMinor:storedMinor(line.amount_minor,"native journal line amount",false).toString(),quantity:"1.000",businessDate,currency:"INR",taxDetail:null}});
  }
  const componentTotals=identities.map(identity=>components.filter(component=>component.componentIdentity===identity).reduce((sum,component)=>sum+BigInt(component.taxAmountMinor),0n));
  const positiveComponents=identities.map((identity,index)=>({identity,amount:componentTotals[index]!})).filter(component=>component.amount>0n);
  if(tax===0n){if(journalId!==null||journalLines.length!==0||positiveComponents.length!==0)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native zero-tax source has a journal")}
  else {if(journalId===null||journalLines.length!==positiveComponents.length*2)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component-tax journal is incomplete");for(const [index,component] of positiveComponents.entries()){const debit=journalLines[index*2],credit=journalLines[index*2+1],description=`${component.identity.toUpperCase()} on accommodation`;if(!debit||!credit||debit.accountId!==guestAccountId||debit.accountRole!=="guest"||debit.folioId!==folio||BigInt(debit.amountMinor)!==component.amount||credit.accountRole!=="tax_payable"||credit.folioId!==null||BigInt(credit.amountMinor)!==-component.amount||debit.txCode!==credit.txCode||debit.description!==description||credit.description!==description)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component-tax journal is not the exact balanced delta topology")}}
  if(journalLines.reduce((sum,line)=>sum+BigInt(line.amountMinor),0n)!==0n||journalLines.filter(line=>line.accountRole==="guest").reduce((sum,line)=>sum+BigInt(line.amountMinor),0n)!==tax)throw new IndiaFinalComponentTaxFiscalSourceConflictError("native component-tax journal does not reconcile");

  const predecessors={nativeTiming:timingEvidenceHash,nativeRateSelection:hash(r.native_rate_selection_evidence_hash,"native rate-selection hash"),finalValuation:valuationEvidenceHash,quotedRateApplicability:applicabilityEvidenceHash,levyComponentIdentity:hash(r.levy_component_identity_evidence_hash,"native levy-component hash"),reservationLineage:hash(r.reservation_lineage_evidence_hash,"native reservation-lineage hash"),attributionSnapshot:hash(r.attribution_snapshot_evidence_hash,"native attribution hash"),serviceProvisionRecording:hash(r.service_provision_evidence_hash,"native service recording hash"),paymentReceiptRecording:hash(r.payment_receipt_evidence_hash,"native payment recording hash"),ordinaryRegimeRecording:hash(r.ordinary_regime_evidence_hash,"native ordinary-regime recording hash"),requestEventPayload:hash(r.request_event_payload_hash,"native request-event payload hash"),nativeRoute:hash(r.native_route_evidence_hash,"native route hash")};
  const body={state:"eligible_current_native_accounted_source" as const,sourceKind:"native_component_tax_delta" as const,postingBindingId:bindingId,accountingEvidenceHash,nativeTimingId:timingId,nativeTimingEvidenceHash:timingEvidenceHash,journalId,taxId,taxGeneration,taxEvidenceHash,valuationId,valuationGeneration,finalValuationEvidenceHash:valuationEvidenceHash,applicabilityId,applicabilityEvidenceHash,reservationId:reservation,folioId:folio,guestAccountId,buyerPartyId,propertyNode:property,businessDate,currency:"INR" as const,transactionValueMinor:transactionValue.toString(),taxMinor:tax.toString(),grandTotalMinor:grand.toString(),componentFamily:family,rateSelectionKind,predecessorHashes:predecessors,nativeSourceBasisHash,nativeConsiderationBasisHash,considerationAccountIds,considerationRootIds,considerationSources,roomNights:nights,components,journalLines};
  return freeze({...body,sourceEvidenceHash:digest({tenantId:tenant,...body})});
 }
}
