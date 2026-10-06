import {stableStringify} from '../domain/visit-review';
import {normalise} from './case-store';
import type {CaseState} from './case-store';
import {createUuid} from './ids';
import type {AccountUser} from '../domain/services';
export async function postJson(path:string,value:unknown){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const d=await r.json();if(!r.ok)throw Error(d.error||'We could not save this. Please try again.');return d;}
export async function verifiedAccount(email?:string):Promise<AccountUser>{const r=await fetch('/api/account',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Your account service is temporarily unavailable. Your draft is still here.');if(!d.user||email&&d.user.email.toLowerCase()!==email.trim().toLowerCase())throw Error('Verify the email shown on this form before saving.');return d.user;}
/** Import only this selected family draft, with explicit consent, without changing the original device record. */
export async function saveSelectedDraft(state:CaseState,email:string,accountOwnerId:string|undefined,importedId:string):Promise<string>{
 const user=await verifiedAccount(email);if(accountOwnerId&&accountOwnerId!==user.id)throw Error('Your account changed. Reopen your home check before saving.');
 const r=await fetch('/api/cases',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Your account could not be opened. Your device draft is still here.');
 if(accountOwnerId){const found=d.archive?.cases.find((c:CaseState)=>c.id===state.id&&!c.deletedAt);if(!found||stableStringify({...normalise(found),updatedAt:null})!==stableStringify({...normalise(state),updatedAt:null}))throw Error('Wait for your latest answers to finish saving, then try again.');return state.id;}
 if(d.archive?.cases.some((c:CaseState)=>c.id===importedId))return importedId;
 const {familyContact,...draft}=state;void familyContact;
 const selected={...draft,id:importedId,audience:'family',updatedAt:new Date().toISOString()};
 const saved=await fetch('/api/cases',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerId:user.id,revision:d.revision,archive:{activeId:importedId,cases:[...(d.archive?.cases??[]),selected]}})});
 const result=await saved.json();if(!saved.ok)throw Error(result.error||'Your check could not be saved. The device draft is still here.');return importedId;
}
export function newImportId(){return `case_${createUuid()}`}
