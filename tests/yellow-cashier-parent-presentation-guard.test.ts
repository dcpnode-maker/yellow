// Actual extracted source predicates/effects; synthetic refs, no browser or financial writes.
import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const finance=readFileSync(new URL('../frontend/yellow/src/workspaces/FinanceWorkspace.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../frontend/yellow/src/App.tsx',import.meta.url),'utf8');
const parent=app.match(/const canNavigateWorkspace = useMemo\(\(\) => (\(\) =>[\s\S]*?), \[\]\);/)![1]!;
const permit=finance.match(/const presentationPermitted = (\(\) => \{[\s\S]*?\n  \});/)![1]!;
const current=finance.match(/const stillCurrent = (\(\) =>[\s\S]*?);\n    void \(async/)![1]!;
const layout=finance.match(/useLayoutEffect\(\(\) => \{([\s\S]*?)\}, \[mobileBillView\]\);/)![1]!;
const ret=finance.match(/useLayoutEffect\(\(\) => \{\n    const request = pendingReturn.current;([\s\S]*?)\}, \[returnRequest\]\);/)![1]!;
const expression=(s:string,e:any)=>new Function('env','with(env){return ('+s+');}')(e);
const body=(s:string,e:any)=>new Function('env','with(env){'+s+'}')(e);
function fixture(){
 const auth={status:'authenticated',properties:[{id:'property'}]},selectedWindow={id:'window'},pending={generation:7,window:selectedWindow,href:'http://fixture/cashiers',auth,reservationId:'reservation'};
 const count={focus:0,scroll:0,cancel:0,view:true,notice:'pending' as string|null};const target={isConnected:true,focus(){count.focus++;},scrollIntoView(){count.scroll++;}};
 const e:any={disposed:false,pending,selectedWindow,pendingHandoff:{current:pending},handoffGeneration:{current:7},propertyId:'property',window:{location:{href:pending.href},matchMedia:()=>({matches:true})},reactAuthSession:{getSnapshot:()=>auth},presentationState:{current:{locked:false,matches:true,reservationId:'reservation',folioId:'window'}},depositMutationLease:{current:false},childLifecycleLease:{current:false},reservationLifecycleBusyRef:{current:false},voiceTransferRecoveryLockedRef:{current:false},propertyModeNavigationLockedRef:{current:false},mobileBillView:true,billHeading:{current:target},setMobileBillView:(v:boolean)=>{count.view=v;},setHandoffNotice:(v:string|null)=>{count.notice=v;},pendingReturn:{current:{generation:7,auth,href:pending.href,billView:true}},searchOrigin:{current:target},searchHeading:{current:null}};
 const canNavigate=expression(parent,e);e.parentPresentationGuard={current:canNavigate};
 e.cancelHandoff=()=>{count.cancel++;e.handoffGeneration.current++;e.pendingHandoff.current=null;e.readyHandoff.current=null;};
 e.presentationPermitted=expression(permit,e);e.readyHandoff={current:expression(current,e)};
 return{e,count,canNavigate,stillCurrent:e.readyHandoff.current};
}
for(const name of ['reservationLifecycleBusyRef','voiceTransferRecoveryLockedRef','propertyModeNavigationLockedRef']){
 test('latest actual parent '+name+' terminally vetoes async selection and unlock cannot revive it',()=>{const f=fixture();expect(f.stillCurrent()).toBe(true);f.e[name].current=true;expect(f.canNavigate()).toBe(false);expect(f.stillCurrent()).toBe(false);expect(f.e.pendingHandoff.current).toBeNull();expect(f.e.pendingReturn.current).toBeNull();expect(f.count.notice).toBeNull();f.e[name].current=false;expect(f.canNavigate()).toBe(true);expect(f.stillCurrent()).toBe(false);expect(f.count.focus).toBe(0);expect(f.count.scroll).toBe(0);});
 test('latest parent '+name+' blocks committed bill effect',()=>{const f=fixture();f.e[name].current=true;body(layout,f.e);expect(f.count.focus).toBe(0);expect(f.count.scroll).toBe(0);expect(f.count.view).toBe(false);expect(f.e.pendingHandoff.current).toBeNull();});
 test('latest parent '+name+' consumes Return without movement and preserves previous compact view',()=>{const f=fixture();f.e[name].current=true;body('const request = pendingReturn.current;'+ret,f.e);expect(f.count.focus).toBe(0);expect(f.count.scroll).toBe(0);expect(f.count.view).toBe(true);expect(f.e.pendingReturn.current).toBeNull();f.e[name].current=false;body('const request = pendingReturn.current;'+ret,f.e);expect(f.count.focus).toBe(0);expect(f.count.scroll).toBe(0);});
}
test('latest replacement callback rather than captured callback controls handoff',()=>{const f=fixture();expect(f.stillCurrent()).toBe(true);f.e.parentPresentationGuard.current=()=>false;expect(f.stillCurrent()).toBe(false);expect(f.e.pendingHandoff.current).toBeNull();});
test('readonly veto never settles existing deposit or child leases',()=>{const f=fixture();f.e.depositMutationLease.current=true;f.e.childLifecycleLease.current=true;f.e.reservationLifecycleBusyRef.current=true;expect(f.e.presentationPermitted()).toBe(false);expect(f.e.depositMutationLease.current).toBe(true);expect(f.e.childLifecycleLease.current).toBe(true);expect(f.e.reservationLifecycleBusyRef.current).toBe(true);});
test('current auth and URL mismatches remain rejected',()=>{const f=fixture();f.e.reactAuthSession.getSnapshot=()=>({status:'expired',properties:[]});expect(f.canNavigate()).toBe(false);expect(f.stillCurrent()).toBe(false);const g=fixture();g.e.window.location.href='http://fixture/other';expect(g.stillCurrent()).toBe(false);});
test('both actual Finance mounts and navigation share exact stable callback; Finance forwards required callback',()=>{const mounts=app.match(/<FinanceWorkspace\b[\s\S]*?\/>/g)!;expect(mounts).toHaveLength(2);for(const mount of mounts){expect(mount).toContain('canMovePresentation={canNavigateWorkspace}');expect(mount).toContain('onLifecycleBusyChange={setReservationLifecycleFlight}');}expect(app).toContain('canNavigate: canNavigateWorkspace');expect(finance.match(/canMovePresentation: \(\) => boolean;/g)).toHaveLength(2);expect(finance).toContain('parentPresentationGuard.current = canMovePresentation');expect(finance).toContain('canMovePresentation={canMovePresentation}');});
test('valid fresh unlocked committed bill and Return still move exactly once',()=>{const f=fixture();body(layout,f.e);expect(f.count.focus).toBe(1);expect(f.count.scroll).toBe(1);const g=fixture();body('const request = pendingReturn.current;'+ret,g.e);expect(g.count.focus).toBe(1);expect(g.count.scroll).toBe(1);expect(g.e.pendingReturn.current).toBeNull();});
