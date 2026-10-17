"use client";
import { useEffect, useState } from 'react';

type Inquiry = { id: string; type: string; name: string; email: string; phone: string; relationship: string; postal_code: string; company_name: string; role: string; client_count: string; message: string; consent_at: string; created_at: string; coordinator_name: string | null; closed_at: string | null };
export function WebsiteInquiryOperations({ onChanged }: { onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<Inquiry[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch('/api/admin/website-inquiries');
      if (!r.ok) throw Error('Could not load website inquiries.');
      setItems((await r.json()).inquiries); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const id = new URLSearchParams(location.search).get('item'); if (id) document.getElementById(`inquiry-${id}`)?.scrollIntoView({ block: 'center' }); }, [items]);
  async function update(id: string, action: string) {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/admin/website-inquiries/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      if (!r.ok) throw Error('This inquiry changed. Refresh and try again.');
      await load(); await onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section aria-labelledby="website-inquiries-title">
    <div className="section-heading"><h2 id="website-inquiries-title">Website inquiries</h2><button className="app-secondary" onClick={load}>Refresh website inquiries</button></div>
    {error && <p role="alert">{error}</p>}
    {items.length ? items.map(p => <article className="account-card" id={`inquiry-${p.id}`} key={p.id}>
      <p>{p.type === 'care_company' ? 'Care company' : 'Website contact'}, {new Date(p.created_at).toLocaleDateString()}{p.closed_at ? ', closed' : ''}</p>
      <h3>{p.name}{p.company_name ? `, ${p.company_name}` : ''}</h3>
      <p>{p.email || 'No email'}{p.phone ? `, ${p.phone}` : ''}</p>
      {p.type === 'care_company' ? <p>Role: {p.role}. Approximate clients: {p.client_count || 'Not provided'}.</p> : <p>Help is for: {{ myself: 'Myself', parent_or_relative: 'A parent or relative', someone_else: 'Someone else' }[p.relationship] || p.relationship}. ZIP: {p.postal_code || 'Not provided'}.</p>}
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.message}</p>
      <p>Permission for MyIntel to contact this person: yes. Recorded {new Date(p.consent_at).toLocaleString()}.</p>
      {!p.closed_at && <><p>{p.coordinator_name ? `Coordinator: ${p.coordinator_name}` : 'Needs an owner'}</p><div className="inline-actions"><button className="app-secondary" disabled={busy} onClick={() => update(p.id, 'claim')}>Take responsibility</button><button className="app-secondary" disabled={busy} onClick={() => update(p.id, 'release')}>Return to queue</button><button className="app-secondary" disabled={busy} onClick={() => update(p.id, 'close')}>Close follow-up</button></div></>}
    </article>) : !error && <p>No website inquiries yet.</p>}
  </section>;
}
