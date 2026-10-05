import { test, expect } from 'bun:test';
import { createAuthSession } from '../frontend/yellow/src/auth-session';
import { createApp } from '../src/app';
import { OperatorHttpApi } from '../src/http/operator';
import { BrowserSessionHttpApi } from '../src/http/browser-session';
import { AvailabilityService } from '../src/contexts/inventory';
import { LocalLoginService, Hs256TokenSigner, BearerTenantResolver } from '../src/contexts/identity';
const A='b2836978-73fe-58f9-b808-8b58cceac1c4', T='6d9b7ce2-2d14-5576-b8c3-80f06501a603', P='6081b544-22a1-534f-a86d-bb1ae0519e14';
const O='https://synthetic-review.example.invalid';
const jwt=(actor=A)=>`header.${btoa(JSON.stringify({sub:actor,tid:T}))}.synthetic`;
const login=(actor=A,ttl=900)=>({accessToken:jwt(actor),tokenType:'Bearer',expiresInSeconds:ttl,user:{id:actor,displayName:'Synthetic'}});
const props={properties:[{id:P,name:'Synthetic',timezone:'Asia/Calcutta'}]};
const res=(v:unknown,status=200)=>Response.json(v,{status});
function deferred<T>() { let resolve!:(value:T)=>void; const promise=new Promise<T>(r=>resolve=r); return {promise,resolve}; }

test('independent: preview cannot expose bearer before fresh grant IO; revoked or missing requested grants refuse',async()=>{
  for (const grants of [res({},403),res({properties:[]}),res(props)]) {
    const pending=deferred<Response>();let reached=deferred<void>();const calls:string[]=[];
    const auth=createAuthSession({automaticPreviewLogin:true,fetch:async url=>{
      calls.push(url);if(url.endsWith('resume'))return res({},401);if(url.endsWith('preview:enter'))return res(login());reached.resolve();return pending.promise;
    }});
    try {
      const attempt=auth.bootstrap('00000000-0000-0000-0000-000000000123');
      const denied=attempt.then(()=>null,error=>error);
      await reached.promise; await expect(auth.session()).rejects.toThrow();expect(auth.getSnapshot().principal).toBeNull();
      pending.resolve(grants);expect(await denied).toBeInstanceOf(Error);expect(auth.getSnapshot().status).toBe('anonymous');
      expect(calls).toEqual(['/api/v1/auth/browser/resume','/api/v1/auth/preview:enter','/api/v1/me/properties']);
    }finally{auth.dispose();}
  }
});

test('independent: preview expiry anchored before resume/login latency; original TTL cannot extend',async()=>{
  let time=10000;const auth=createAuthSession({automaticPreviewLogin:true,now:()=>time,fetch:async url=>{
    if(url.endsWith('resume')){time+=1000;return res({},401);}if(url.endsWith('preview:enter')){time+=1000;return res(login(A,2));}return res(props);
  }});
  try{await expect(auth.bootstrap()).rejects.toThrow('expired');await expect(auth.session()).rejects.toThrow();expect(auth.getSnapshot().status).toBe('anonymous');}finally{auth.dispose();}
});

test('independent: delayed preview cannot replace a newer manual principal or perform its grants read',async()=>{
  const pending=deferred<Response>(), reached=deferred<void>();const calls:string[]=[];const OTHER='00000000-0000-0000-0000-000000000123';
  const auth=createAuthSession({automaticPreviewLogin:true,fetch:async url=>{
    calls.push(url);if(url.endsWith('resume'))return res({},404);if(url.endsWith('preview:enter')){reached.resolve();return pending.promise;}if(url.endsWith('local:login'))return res(login(OTHER));return res(props);
  }});
  try{const old=auth.bootstrap();const stale=old.then(()=>null,error=>error);await reached.promise;
    await auth.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'});
    pending.resolve(res(login()));expect((await stale)?.message).toContain('newer');expect(auth.getSnapshot().principal?.actorId).toBe(OTHER);expect(await auth.session()).toBe(jwt(OTHER));
    expect(calls.filter(p=>p.endsWith('/properties'))).toHaveLength(1);
  }finally{auth.dispose();}
});

test('independent: logout during pending grant IO cannot publish token and clears cookie after login settled',async()=>{
  const pending=deferred<Response>(),reached=deferred<void>();const calls:string[]=[];
  const auth=createAuthSession({automaticPreviewLogin:true,fetch:async url=>{
    calls.push(url);if(url.endsWith('resume'))return res({},401);if(url.endsWith('preview:enter'))return res(login());if(url.endsWith('/properties')){reached.resolve();return pending.promise;}return new Response(null,{status:204});
  }});
  try{const old=auth.bootstrap();const stale=old.then(()=>null,error=>error);await reached.promise;await auth.logout();pending.resolve(res(props));expect((await stale)?.message).toContain('newer');
    await expect(auth.session()).rejects.toThrow();expect(auth.getSnapshot().status).toBe('anonymous');
    const prior=calls.length;await expect(auth.bootstrap()).rejects.toThrow('newer');expect(calls).toHaveLength(prior);
    expect(calls.at(-1)).toBe('/api/v1/auth/browser/logout');
  }finally{auth.dispose();}
});

test('independent: actual preview route refuses hostile admissions and body before ordinary login; cookies do not authorize writes',async()=>{
  const prior=Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN;let calls=0;let clock=1800000000;
  const signer=new Hs256TokenSigner('synthetic-independent-preview-secret-0001',{now:()=>clock,jtiFactory:()=> '00000000-0000-0000-0000-000000000987'});
  const token=await signer.issue({userId:A,tenantId:T,scopes:['inventory.space:read']});
  class Login extends LocalLoginService{constructor(){super({async reserve():Promise<never>{throw new Error('no DB');}},signer);}override async authenticate(){++calls;return {...login(),accessToken:token,expiresInSeconds:900 as const};}}
  const browser=new BrowserSessionHttpApi(signer,{async readActiveActor(){return{id:A,displayName:'Synthetic'};}},{httpsOrigins:[O]},()=>clock);
  const creds={tenant:'yellow-demo',email:'preview.operator@yellow.local',password:'synthetic-only'};
  const app=createApp({operatorApi:new OperatorHttpApi(new Login(),new AvailabilityService()),browserSessionApi:browser,tenantResolver:new BearerTenantResolver(signer),operatorPublicPreviewCredentials:creds});
  const request=(headers:Record<string,string>={},body='{}',suffix='')=>new Request(O+'/api/v1/auth/preview:enter'+suffix,{method:'POST',headers:{origin:O,'content-type':'application/json','x-yellow-browser-session':'v1',...headers},body});
  try{Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN='1';
    for(const header of [{origin:'null'},{origin:'https://attacker.example.invalid'},{'x-yellow-browser-session':'bad'},{'sec-fetch-site':'cross-site'},{'sec-fetch-mode':'navigate'}]){expect((await app.handle(request(header))).status).toBe(403);}expect(calls).toBe(0);
    expect((await app.handle(request({},'{}','?token=evil'))).status).toBe(403);
    for(const body of ['[]','{"tenant":"foreign"}','null'])expect((await app.handle(request({},body))).status).toBe(400);
    expect(calls).toBe(0);const accepted=await app.handle(request());expect(accepted.status).toBe(200);expect(calls).toBe(1);
    const cookie=accepted.headers.get('set-cookie')!;expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict; Max-Age=900');expect(accepted.headers.get('cache-control')).toBe('no-store');
    const write=await app.handle(new Request(O+'/api/v1/properties/'+P+'/operating-mode',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'}));expect(write.status).toBe(401);
    clock+=900;const expired=await browser.resume(new Request(O+'/api/v1/auth/browser/resume',{method:'POST',headers:{origin:O,'content-type':'application/json','x-yellow-browser-session':'v1',cookie},body:'{}'}),{});expect(expired.status).toBe(401);
    Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN='true';expect((await app.handle(request())).status).toBe(404);expect(calls).toBe(1);
  }finally{if(prior===undefined)delete Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN;else Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN=prior;}
});

test('independent: foreign configured preview identity and absent cookie policy cannot invoke local login',async()=>{
 const prior=Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN;let calls=0;
 class Login extends LocalLoginService{constructor(){super({async reserve():Promise<never>{throw new Error('no DB');}},{async issue():Promise<never>{throw new Error('no mint');}});}override async authenticate(){++calls;return null;}}
 try{Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN='1';for(const email of ['preview.operator@yellow.local','foreign@example.invalid']){
 const app=createApp({operatorApi:new OperatorHttpApi(new Login(),new AvailabilityService()),operatorPublicPreviewCredentials:{tenant:'yellow-demo',email,password:'synthetic'}});
 const response=await app.handle(new Request(O+'/api/v1/auth/preview:enter',{method:'POST',headers:{origin:O,'content-type':'application/json','x-yellow-browser-session':'v1'},body:'{}'}));expect(response.status).toBe(email.startsWith('foreign')?404:503);expect(calls).toBe(0);
 }}finally{if(prior===undefined)delete Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN;else Bun.env.YELLOW_PUBLIC_PREVIEW_AUTO_LOGIN=prior;}
});
