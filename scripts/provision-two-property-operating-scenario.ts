import { SQL, type ReservedSQL } from "bun";
import { SEED_TENANT } from "./seed";
import { REVIEW_EMAIL, REVIEW_ROLE_NAME } from "./seed-review";
import { uuidV5 } from "./lib/uuid-v5";

export const TWO_PROPERTY_SCENARIO_KEY = "yellow-two-property-operating-v3";

const NAMES = [
  "Aarav Mehta", "Amira Khan", "Noah Williams", "Priya Nair", "Oliver Hughes", "Sara Al Harbi",
  "Kabir Malhotra", "Maya Thompson", "Zain Abdullah", "Anika Rao", "Theo Martin", "Layla Hassan",
  "Rohan Kapoor", "Ella Clarke", "Omar Siddiqui", "Meera Iyer", "Arthur Collins", "Nora Ahmed",
  "Ishaan Shah", "Sophia Bennett", "Yusuf Rahman", "Tara Menon", "Henry Wilson", "Aisha Kareem",
] as const;

type PropertyPlan = Readonly<{
  key: "locanda" | "london";
  name: string;
  path: string;
  timezone: string;
  currency: "SAR" | "GBP";
  rooms: number;
  types: readonly Readonly<{ code: string; name: string; rooms: number; capacity: number }>[];
  budgetAdrMinor: number;
  forecastAdrMinor: number;
}>;

const PROPERTIES: readonly PropertyPlan[] = Object.freeze([
  { key: "locanda", name: "Locanda Homes · Jareed Riyadh", path: "yellow_demo.locanda_jareed_v3", timezone: "Asia/Riyadh", currency: "SAR", rooms: 20,
    types: [{ code: "L1BR", name: "One Bedroom Residence", rooms: 6, capacity: 2 }, { code: "L2BR", name: "Two Bedroom Residence", rooms: 8, capacity: 4 }, { code: "LPH", name: "Penthouse Residence", rooms: 6, capacity: 6 }],
    budgetAdrMinor: 72000, forecastAdrMinor: 74500 },
  { key: "london", name: "The Harrington London", path: "yellow_demo.harrington_london_v3", timezone: "Europe/London", currency: "GBP", rooms: 40,
    types: [{ code: "KING", name: "King Room", rooms: 18, capacity: 2 }, { code: "DLX", name: "Deluxe King", rooms: 14, capacity: 2 }, { code: "STE", name: "London Suite", rooms: 8, capacity: 3 }],
    budgetAdrMinor: 28500, forecastAdrMinor: 29800 },
]);

function addDays(value: string, days: number): string { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function localDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day) throw new Error("business date unavailable");
  return `${values.year}-${values.month}-${values.day}`;
}
async function id(suffix: string): Promise<string> { return uuidV5(SEED_TENANT.id, `${TWO_PROPERTY_SCENARIO_KEY}/${suffix}`); }
async function withTransaction<T>(pool: SQL, run: (tx: ReservedSQL) => Promise<T>): Promise<T> {
  const tx = await pool.reserve(); let open = false;
  try { await tx.unsafe("BEGIN"); open = true; await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`; const value = await run(tx); await tx.unsafe("COMMIT"); open = false; return value; }
  catch (error) { if (open) await tx.unsafe("ROLLBACK"); throw error; } finally { tx.release(); }
}
async function evidence(tx: ReservedSQL, propertyId: string, actorId: string, businessDate: string, suffix: string, entityType: string, entityId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  const body = { scenario: TWO_PROPERTY_SCENARIO_KEY, ...payload };
  await tx`INSERT INTO fact_log (id,tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES (${await id(`fact/${suffix}`)}::uuid,${SEED_TENANT.id}::uuid,${entityType},${entityId}::uuid,${eventType},transaction_timestamp(),${businessDate}::date,${actorId}::uuid,${JSON.stringify(body)}::text::jsonb)`;
  await tx`INSERT INTO outbox (id,tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
    VALUES (${await id(`event/${suffix}`)}::uuid,${SEED_TENANT.id}::uuid,${propertyId}::uuid,${businessDate}::date,${entityType},${entityId}::uuid,${eventType},${actorId}::uuid,${await id(`correlation/${propertyId}`)}::uuid,${JSON.stringify(body)}::text::jsonb)`;
}

export async function provisionTwoPropertyOperatingScenario(options: Readonly<{ databaseUrl: string }>): Promise<readonly Readonly<{ id: string; name: string; rooms: number; occupiedTonight: number }>[] > {
  const pool = new SQL(options.databaseUrl, { max: 1, prepare: false });
  try {
    return await withTransaction(pool, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${TWO_PROPERTY_SCENARIO_KEY}, 505))`;
      const identity = (await tx<Array<{ user_id: string; role_id: string }>>`SELECT u.id user_id,r.id role_id FROM app_user u JOIN role r ON r.tenant_id=u.tenant_id WHERE u.tenant_id=${SEED_TENANT.id}::uuid AND u.email=${REVIEW_EMAIL} AND u.status='active' AND r.name=${REVIEW_ROLE_NAME}`)[0];
      if (!identity) throw new Error("review operator is unavailable");
      const output: Array<{ id: string; name: string; rooms: number; occupiedTonight: number }> = [];
      for (const property of PROPERTIES) {
        const propertyId = await id(`property/${property.key}`); const businessDate = localDate(property.timezone);
        const existing = await tx<Array<{ id: string }>>`SELECT id FROM org_node WHERE tenant_id=${SEED_TENANT.id}::uuid AND (id=${propertyId}::uuid OR path=${property.path}::ltree) FOR UPDATE`;
        if (existing.length) {
          const counts = (await tx<Array<{ rooms: number; occupied: number; stats: number }>>`SELECT
            (SELECT count(*)::int FROM space WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid) rooms,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status IN ('in_house','due_out')) occupied,
            (SELECT count(*)::int FROM stats_daily WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid) stats`)[0];
          if (!counts || counts.rooms !== property.rooms || counts.occupied !== Math.round(property.rooms * .7) || counts.stats < 700) throw new Error(`${property.key} scenario is not canonical`);
          output.push({ id: propertyId, name: property.name, rooms: counts.rooms, occupiedTonight: counts.occupied }); continue;
        }
        const config = { scenario: TWO_PROPERTY_SCENARIO_KEY, privacy_safe: true, public_showcase: true,
          operating_plan: { budget_occupancy_basis_points: 7400, forecast_occupancy_basis_points: 7200,
            budget_adr_minor: property.budgetAdrMinor, forecast_adr_minor: property.forecastAdrMinor } };
        await tx`INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency,config) VALUES (${propertyId}::uuid,${SEED_TENANT.id}::uuid,${property.path}::ltree,'property',${property.name},${property.timezone},${property.currency},${JSON.stringify(config)}::text::jsonb)`;
        await tx`INSERT INTO user_role (tenant_id,user_id,role_id,scope_node) VALUES (${SEED_TENANT.id}::uuid,${identity.user_id}::uuid,${identity.role_id}::uuid,${propertyId}::uuid)`;
        await evidence(tx, propertyId, identity.user_id, businessDate, `${property.key}/property`, "property", propertyId, "scenario.property.provisioned", { privacy_safe: true });
        const roomRows: Array<{ spaceId: string; sellableId: string; unitTypeId: string; code: string; capacity: number }> = [];
        const unitTypes: Array<{ id: string; rooms: number }> = []; let roomNo = property.key === "locanda" ? 101 : 201;
        for (const type of property.types) {
          const unitTypeId = await id(`${property.key}/unit-type/${type.code}`); unitTypes.push({ id: unitTypeId, rooms: type.rooms });
          await tx`INSERT INTO unit_type (id,tenant_id,property_node,code,name,profile_key,base_occupancy,max_occupancy,attrs,sort_order) VALUES (${unitTypeId}::uuid,${SEED_TENANT.id}::uuid,${propertyId}::uuid,${type.code},${type.name},'hotel',1,${type.capacity},${JSON.stringify({ scenario: TWO_PROPERTY_SCENARIO_KEY })}::text::jsonb,${property.types.indexOf(type)+1})`;
          await evidence(tx, propertyId, identity.user_id, businessDate, `${property.key}/unit-type/${type.code}`, "unit_type", unitTypeId, "unit_type.created", { code: type.code });
          for (let index=0; index<type.rooms; index++) {
            const code=String(roomNo++); const spaceId=await id(`${property.key}/space/${code}`); const sellableId=await id(`${property.key}/sellable/${code}`);
            await tx`INSERT INTO space (id,tenant_id,property_node,code,profile_key,capacity,floor,attrs,status) VALUES (${spaceId}::uuid,${SEED_TENANT.id}::uuid,${propertyId}::uuid,${code},'hotel',1,${code[0]},${JSON.stringify({ scenario:TWO_PROPERTY_SCENARIO_KEY })}::text::jsonb,'active')`;
            await tx`INSERT INTO sellable_unit (id,tenant_id,unit_type_id,name,status) VALUES (${sellableId}::uuid,${SEED_TENANT.id}::uuid,${unitTypeId}::uuid,${`${type.name} ${code}`} ,'active')`;
            await tx`INSERT INTO sellable_unit_space (tenant_id,sellable_unit_id,space_id,claim_mode) VALUES (${SEED_TENANT.id}::uuid,${sellableId}::uuid,${spaceId}::uuid,'exclusive')`;
            await tx`INSERT INTO unit_condition (tenant_id,space_id,condition,updated_by) VALUES (${SEED_TENANT.id}::uuid,${spaceId}::uuid,${index%7===0?'dirty':index%5===0?'clean':'inspected'},${identity.user_id}::uuid)`;
            roomRows.push({ spaceId, sellableId, unitTypeId, code, capacity: type.capacity });
          }
        }
        const ratePlanId=await id(`${property.key}/rate-plan/BAR`);
        await tx`INSERT INTO rate_plan (id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES (${ratePlanId}::uuid,${SEED_TENANT.id}::uuid,${propertyId}::uuid,'BAR','Best Available Rate',${property.currency},true,'active')`;
        const inHouse=Math.round(property.rooms*.6), dueOut=Math.round(property.rooms*.1), dueIn=Math.round(property.rooms*.1);
        const stays: Array<{ status:string; segmentStatus:string; roomIndex:number|null; unitTypeId?:string; from:number; to:number; prefix:string }> = [];
        for(let i=0;i<inHouse;i++) stays.push({status:'in_house',segmentStatus:'in_house',roomIndex:i,from:-2-(i%4),to:2+(i%4),prefix:'IH'});
        for(let i=0;i<dueOut;i++) stays.push({status:'due_out',segmentStatus:'in_house',roomIndex:inHouse+i,from:-2-(i%3),to:0,prefix:'DO'});
        for(let i=0;i<dueIn;i++) stays.push({status:'due_in',segmentStatus:'booked',roomIndex:inHouse+i,from:0,to:2+(i%3),prefix:'DI'});
        const targetForDay=(day:number)=>Math.max(1,Math.round(property.rooms*(.70-.60*(day-1)/55)));
        const unitTypeForStay=(stay:(typeof stays)[number])=>stay.unitTypeId??(stay.roomIndex===null?unitTypes[0]!.id:roomRows[stay.roomIndex]!.unitTypeId);
        const activeAt=(day:number)=>stays.filter((stay)=>stay.status!=='checked_out'&&day>=stay.from&&day<stay.to);
        for(let day=1;day<=56;day++){
          while(activeAt(day).length<targetForDay(day)){
            let scheduled=false;
            for(const type of unitTypes){
              for(let duration=4;duration>=1;duration--){
                const to=Math.min(57,day+duration);
                let valid=true;
                for(let night=day;night<to;night++){
                  const active=activeAt(night);
                  if(active.length>=targetForDay(night)||active.filter((stay)=>unitTypeForStay(stay)===type.id).length>=type.rooms){valid=false;break;}
                }
                if(valid){stays.push({status:'reserved',segmentStatus:'booked',roomIndex:null,unitTypeId:type.id,from:day,to,prefix:'FU'});scheduled=true;break;}
              }
              if(scheduled)break;
            }
            if(!scheduled)throw new Error(`${property.key} future curve cannot be scheduled within unit-type inventory`);
          }
        }
        for(let i=0;i<10;i++) stays.push({status:'checked_out',segmentStatus:'departed',roomIndex:i%property.rooms,from:-30-i*3,to:-28-i*3,prefix:'HX'});
        for (const [index, stay] of stays.entries()) {
          const confirmation=`${property.key==='locanda'?'L3R':'T3L'}-${stay.prefix}-${String(index+1).padStart(4,'0')}`;
          const partyId=await id(`${property.key}/party/${index}`), reservationId=await id(`${property.key}/reservation/${confirmation}`), segmentId=await id(`${property.key}/segment/${confirmation}`);
          const room=stay.roomIndex===null?null:roomRows[stay.roomIndex]; if(stay.roomIndex!==null&&!room) throw new Error("scenario room missing");
          const displayName=NAMES[(index+(property.key==='london'?7:0))%NAMES.length]!;
          await tx`INSERT INTO party (id,tenant_id,kind,display_name,legal_name,attrs,status) VALUES (${partyId}::uuid,${SEED_TENANT.id}::uuid,'person',${displayName},${displayName},${JSON.stringify({ scenario:TWO_PROPERTY_SCENARIO_KEY, privacy_safe:true, contact_free:true })}::text::jsonb,'active')`;
          await tx`INSERT INTO party_role (tenant_id,party_id,role,detail) VALUES (${SEED_TENANT.id}::uuid,${partyId}::uuid,'guest','{}'::jsonb)`;
          await tx`INSERT INTO reservation (id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,market_code,source_code,currency,notes) VALUES (${reservationId}::uuid,${SEED_TENANT.id}::uuid,${propertyId}::uuid,${confirmation},${stay.status},${partyId}::uuid,${index%3===0?'airbnb':index%3===1?'booking.com':'direct'},${index%4===0?'corporate':'leisure'},${index%3===2?'website':'ota'},${property.currency},'Privacy-safe production-like operating scenario')`;
          const from=addDays(businessDate,stay.from),to=addDays(businessDate,stay.to);
          const adults=Math.min(room?.capacity??property.types[0]!.capacity,1+index%3);
          await tx`INSERT INTO reservation_segment (id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES (${segmentId}::uuid,${SEED_TENANT.id}::uuid,${reservationId}::uuid,1,${unitTypeForStay(stay)}::uuid,${room?.sellableId??null}::uuid,tstzrange(${`${from}T15:00:00Z`}::timestamptz,${`${to}T11:00:00Z`}::timestamptz,'[)'),${adults},'[]'::jsonb,${ratePlanId}::uuid,${stay.segmentStatus})`;
          await tx`INSERT INTO reservation_guest (tenant_id,reservation_id,party_id,role) VALUES (${SEED_TENANT.id}::uuid,${reservationId}::uuid,${partyId}::uuid,'primary')`;
          await evidence(tx,propertyId,identity.user_id,businessDate,`${property.key}/reservation/${confirmation}`,"reservation",reservationId,"reservation.scenario_seeded",{status:stay.status});
          if(stay.status!=='checked_out'&&room){ const recorded=(await tx<Array<{id:string}>>`SELECT record_occupancy(${SEED_TENANT.id}::uuid,${room.spaceId}::uuid,tstzrange(${`${from}T15:00:00Z`}::timestamptz,${`${to}T11:00:00Z`}::timestamptz,'[)'),${segmentId}::uuid,'segment',true) id`)[0]; if(!recorded) throw new Error("occupancy not recorded"); }
        }
        const firstDate=`${Number(businessDate.slice(0,4))-1}-01-01`, lastDate=addDays(businessDate,56); let cursor=firstDate; let dayIndex=0;
        while(cursor<=lastDate){ const future=cursor>businessDate; const scenarioNight=cursor>=businessDate; const lastYear=cursor.slice(0,4)!==businessDate.slice(0,4); const daysAhead=scenarioNight?Math.round((dateValue(cursor)-dateValue(businessDate))/86400000):0;
          const historicalOccupancy=Math.max(0,Math.min(10000,(lastYear?6600:7000)+((dayIndex%7)-3)*120));
          const historicalSold=Math.round(property.rooms*historicalOccupancy/10000); let remaining=historicalSold;
          for(const [typeIndex,type] of unitTypes.entries()){ const sold=scenarioNight
              ? activeAt(daysAhead).filter((stay)=>unitTypeForStay(stay)===type.id).length
              : typeIndex===unitTypes.length-1?remaining:Math.min(remaining,Math.round(historicalSold*type.rooms/property.rooms));
            if(!scenarioNight)remaining-=sold; const adr=BigInt(Math.round((future?property.forecastAdrMinor:property.budgetAdrMinor)*(1+((dayIndex%9)-4)/100)));
            await tx`INSERT INTO stats_daily (tenant_id,property_node,business_date,unit_type_id,market_code,source_code,channel_code,rooms_available,rooms_sold,arrivals,departures,no_shows,room_revenue_minor,fnb_revenue_minor,other_revenue_minor) VALUES (${SEED_TENANT.id}::uuid,${propertyId}::uuid,${cursor}::date,${type.id}::uuid,'all','all','all',${type.rooms},${sold},0,0,0,${(BigInt(sold)*adr).toString()}::bigint,0,0)`; }
          cursor=addDays(cursor,1); dayIndex++; }
        output.push({id:propertyId,name:property.name,rooms:property.rooms,occupiedTonight:inHouse+dueOut});
      }
      return Object.freeze(output.map((item) => Object.freeze({
        id: item.id,
        name: item.name,
        rooms: item.rooms,
        occupiedTonight: item.occupiedTonight,
      })));
    });
  } finally { await pool.close({timeout:0}); }
}

function dateValue(value:string):number{return new Date(`${value}T00:00:00.000Z`).getTime();}

if(import.meta.main){const databaseUrl=process.env.YELLOW_DEPLOY_DATABASE_URL??process.env.DATABASE_URL;if(!databaseUrl)throw new Error("database URL required");console.log(await provisionTwoPropertyOperatingScenario({databaseUrl}));}
