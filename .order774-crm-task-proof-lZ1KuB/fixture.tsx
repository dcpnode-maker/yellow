
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import OperationalHub from "C:\\Users\\astha\\yellow-fast-20261005\\crm-tasks\\frontend\\yellow\\src\\workspaces\\OperationalHub.tsx";
import {configureYellowApi} from "C:\\Users\\astha\\yellow-fast-20261005\\crm-tasks\\frontend\\yellow\\src\\yellow-api.tsx";
import {reactAuthSession} from "C:\\Users\\astha\\yellow-fast-20261005\\crm-tasks\\frontend\\yellow\\src\\auth-session.ts";
const propertyId='00000000-0000-4000-8000-000000000001', actor='00000000-0000-4000-8000-000000000002', tenant='00000000-0000-4000-8000-000000000003';
const matchedStay={reservationId:'reservation-one',confirmationNo:'CONF-ONE',primaryGuestDisplayName:'Returned Guest One',sellableUnitLabel:'Room 101'};
const empty={data:[],isLoading:false,isError:false};
const rows=[
 {requestId:'request-one',reservationId:'reservation-one',segmentId:'segment-one',spaceId:'room-one',serviceKind:'luggage_pickup',parentRequestId:null,targetRoleId:'role-one',targetRoleName:'Bell desk',proposalStatus:'confirmed',version:7,expiresAt:'2026-10-05T12:00:00Z',departureAt:'2026-10-05T10:00:00Z',dueAt:null,dueLocal:null,timezone:'UTC',taskId:'task-one',taskStatus:'assigned',assigneePartyId:'staff-one',outcome:null,completedAt:null,eligibleActions:['start']},
 {requestId:'request-two',reservationId:'reservation-outside-view',segmentId:'segment-two',spaceId:'room-two',serviceKind:'minibar_check',parentRequestId:null,targetRoleId:'role-two',targetRoleName:'Housekeeping',proposalStatus:'confirmed',version:3,expiresAt:'2026-10-05T12:00:00Z',departureAt:'2026-10-05T10:00:00Z',dueAt:null,dueLocal:null,timezone:'UTC',taskId:'task-two',taskStatus:'open',assigneePartyId:null,outcome:null,completedAt:null,eligibleActions:['assign']},
];
const staff=[{partyId:'staff-one',name:'Returned Staff One'}],openCalls=[];
window.fetch=async(input,init)=>{const url=String(input),method=init?.method||'GET';const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(url.includes('/auth/local:login'))return json({accessToken:'synthetic.'+btoa(JSON.stringify({sub:actor,tid:tenant}))+'.signature',tokenType:'Bearer',expiresInSeconds:900,user:{id:actor,displayName:'Synthetic staff'}});
 if(url.includes('/me/properties'))return json({properties:[{id:propertyId,name:'Synthetic property',timezone:'UTC'}]});
 if(url.endsWith('/operating-mode'))return json({},503);
 if(url.includes('/reservations/')){const reservationId=url.split('/reservations/')[1].split('/')[0];return json({reservationId,reservationStatus:'confirmed',timezone:'UTC',evidence:null,roles:[],staff,requests:rows.filter(row=>row.reservationId===reservationId)});}
 if(method==='POST')return json({request:rows.find(row=>url.includes(row.requestId)),replayed:false});
 if(url.endsWith('/departure-services'))return json({requests:rows});
 return json({},404);
};
const query=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
const rootNode=createRoot(document.getElementById('root'));
configureYellowApi(propertyId);
const onOpenReservation=stay=>openCalls.push(stay);
(async()=>{
 await reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'},propertyId);
 flushSync(()=>rootNode.render(React.createElement(QueryClientProvider,{client:query},React.createElement(OperationalHub,{
   propertyName:'Synthetic property',initialView:'tasks',arrivals:{...empty,data:[matchedStay]},departures:empty,rooms:empty,blocks:empty,
   onNavigate:()=>{},onOpenReservation
 }))));
 const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
 const wait=async(predicate)=>{for(let n=0;n<250;n++){if(predicate())return;await tick()}throw new Error('Timed out waiting for mounted task details: '+document.body.textContent.slice(-700))};
 await wait(()=>document.querySelectorAll('tbody tr').length===2);
 document.querySelector('[data-request-id="request-one"] summary').click();
 await wait(()=>document.querySelector('.department-task-selected')?.textContent.includes('Returned Guest One') || !!document.querySelector('.department-task-open-reservation'));
 const selected=document.querySelector('.department-task-selected');
 if(!selected?.textContent.includes('luggage pickup')||!selected.textContent.includes('assigned')||!selected.textContent.includes('Returned Staff One')||!selected.textContent.includes('Due time unavailable')) throw new Error('Selected task details did not use the returned task/staff fields and preserve unknown due time');
 const openButton=selected.querySelector('.department-task-open-reservation');
 if(!openButton||openButton.textContent.trim()!=='Open linked reservation →') throw new Error('Matching task reservation action missing');
 openButton.click();
 if(openCalls.length!==1||openCalls[0]!==matchedStay) throw new Error('Reservation callback did not receive the exact loaded OperationalStay object');
 document.querySelector('[data-request-id="request-two"] summary').click();
 await wait(()=>selected.textContent.includes('minibar check')&&selected.textContent.includes('reservation-outside-view'));
 if(selected.querySelector('.department-task-open-reservation')) throw new Error('Unmatched reservation received a fabricated navigation action');
 if(!selected.textContent.includes('not present in the currently loaded arrivals or departures')) throw new Error('Unmatched reservation explanation missing');
 if(selected.querySelector('a[href]')) throw new Error('Task details exposed an unsupported reservation URL');
 window.crmTaskProof={passed:true,checks:['selected task uses returned DTO and unknown due stays unknown','matching reservation opens through the exact existing callback DTO','unmatched reservation has explanation and no fabricated link'],openCalls:openCalls.length};
})().catch(error=>window.crmTaskProof={passed:false,error:String(error),body:document.body.textContent.slice(-1600)});
