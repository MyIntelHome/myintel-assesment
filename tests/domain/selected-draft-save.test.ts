// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {saveSelectedDraft} from '../../src/lib/lead-client';
import {normalise} from '../../src/lib/case-store';
const home=normalise({id:'device',audience:'family',spaces:[{id:'room',type:'bathroom',label:'Example'}]});
const user={id:'alice',email:'alice@example.test'};
afterEach(()=>vi.unstubAllGlobals());
it('imports only the selected guest draft and preserves all existing account records with their revision',async()=>{
 const old=normalise({id:'existing',audience:'family'}),fetchMock=vi.fn(async(path:string,init?:RequestInit)=>({ok:true,json:async()=>path==='/api/account'?{user}:init?.method==='PUT'?{revision:9}:{revision:8,archive:{activeId:'existing',cases:[old]}}}));vi.stubGlobal('fetch',fetchMock);
 localStorage.setItem('myintel.cases.v1',JSON.stringify({activeId:'device',cases:[home,normalise({id:'other-device'})]}));const before=localStorage.getItem('myintel.cases.v1');
 expect(await saveSelectedDraft(home,user.email,undefined,'imported')).toBe('imported');const put=fetchMock.mock.calls.find(c=>c[1]?.method==='PUT')!,body=JSON.parse(String(put[1]?.body));expect(body).toMatchObject({ownerId:'alice',revision:8,archive:{activeId:'imported'}});expect(body.archive.cases.map((c:{id:string})=>c.id)).toEqual(['existing','imported']);expect(body.archive.cases[0]).toEqual(old);expect(localStorage.getItem('myintel.cases.v1')).toBe(before);
});
it('rejects an account switch and stale saves without changing the device draft',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({user})})));await expect(saveSelectedDraft(home,'other@example.test',undefined,'imported')).rejects.toThrow('Verify the email');await expect(saveSelectedDraft(home,user.email,'bob','imported')).rejects.toThrow('account changed');
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>({ok:init?.method!=='PUT',json:async()=>path==='/api/account'?{user}:init?.method==='PUT'?{error:'A newer version was saved elsewhere.'}:{revision:3,archive:null}})));await expect(saveSelectedDraft(home,user.email,undefined,'imported')).rejects.toThrow('newer version');
});
