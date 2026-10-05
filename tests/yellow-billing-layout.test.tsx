import { afterAll, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{pathname:"/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today",search:""}}});
const reservationId="10000000-0000-4000-8000-000000000001", folioId="20000000-0000-4000-8000-000000000001";
const stay={reservationId,confirmationNo:"Y-101",status:"in_house",primaryGuestDisplayName:"Test guest",sellableUnitLabel:"101",channelCode:"DIRECT",sourceCode:"WEB",marketCode:"RETAIL"};
const statement={folio:{id:folioId,currency:"INR",windowNo:1,status:"open",folioNo:"F-101"},balanceMinor:"125000",siblingWindows:[],rows:[],transferGroups:[],chargeOptions:[],chargeAvailability:{allowed:false,reason:"No catalogue configured"}};
let selected=false;
mock.module("@tanstack/react-query",()=>({useQuery:(options:{queryKey:string[]})=>{
 const key=options.queryKey[0];const data=key==="cashier-reservation-board"?{reservations:[stay]}:
 key==="cashier-reservation"&&selected?{reservation:{...stay,folios:[],guests:[]}}:
 key==="cashier-folio-statement"?undefined:key==="cashier-receivable-targets"?[]:undefined;
 return {data,isLoading:false,isError:false,refetch:async()=>({data})};
},useQueryClient:()=>({setQueryData:()=>undefined,invalidateQueries:async()=>undefined})}));
const {CashierWorkbench}=await import("../frontend/yellow/src/workspaces/FinanceWorkspace");
afterAll(()=>{mock.restore();if(originalWindow)Object.defineProperty(globalThis,"window",originalWindow);else delete (globalThis as {window?:unknown}).window;});
test("actual billing entry presents guest search without requiring a payment or mutating a folio",()=>{
 selected=false;const html=renderToStaticMarkup(createElement(CashierWorkbench,{drawers:[],canMovePresentation:()=>true,initialReservationId:null}));
 expect(html).toContain("Find a guest or bill");expect(html).toContain("Test guest");expect(html).toContain('data-has-reservation="false"');
 expect(html).toContain("Find exact folio");expect(html).not.toContain("Post confirmed charge");expect(html).not.toContain("Company / direct billing</summary>");
});
test("a selected reservation without a folio keeps the real window-open action and no pretend payment control",()=>{
 selected=true;const html=renderToStaticMarkup(createElement(CashierWorkbench,{drawers:[],canMovePresentation:()=>true,initialReservationId:reservationId}));
 expect(html).toContain('data-has-reservation="true"');expect(html).toContain("Billing windows");expect(html).toContain("No folio windows exist for this reservation.");
 expect(html).not.toContain("Post confirmed charge");expect(html).not.toContain("Take payment");
});
test("cash custody is a closed, accessible disclosure and has a clear empty configuration state",()=>{
 const html=renderToStaticMarkup(createElement(CashierWorkbench,{drawers:[],canMovePresentation:()=>true,initialReservationId:null}));
 expect(html).toContain('<details class="billing-custody"><summary>Cash drawer &amp; shift status</summary>');
 expect(html).toContain("Cash drawer not configured");
});
