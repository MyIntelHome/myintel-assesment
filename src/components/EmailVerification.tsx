"use client";
import {useState} from 'react';
import {postJson} from '../lib/lead-client';
export function EmailVerification({email,onVerified}:{email:string;onVerified:()=>void}){
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState('');
 async function run(verify:boolean){setBusy(true);setError('');try{await postJson(`/api/auth/${verify?'verify-code':'request-code'}`,verify?{email,code}:{email});if(verify)onVerified();else setSent(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="email-verification" aria-label="Verify your email"><h3>One last step, check your email</h3><p>We will send a one-time code to {email}. No password needed. Keep this page open.</p>{sent&&<label>Code from your email<input autoComplete="one-time-code" inputMode="numeric" maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}{error&&<p role="alert">{error}</p>}<button type="button" className="app-primary" disabled={busy||sent&&code.length<6} onClick={()=>run(sent)}>{busy?'Please wait...':sent?'Verify email':'Send me a code'}</button>{sent&&<button type="button" className="app-secondary" disabled={busy} onClick={()=>run(false)}>Send a new code</button>}</section>;
}
