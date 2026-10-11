import React, { useEffect, useState } from 'react';
import { Check, Clock3, Handshake, Plus, ShieldCheck, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
const currency = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const call = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// What the client sees: the same agreement, live, plus the power to ask for changes and answer proposals.
export default function ClientPortal({ token }) {
  const [p, setP] = useState(null), [err, setErr] = useState(''), [form, setForm] = useState({ title: '', description: '', cost: '', days: '0' }), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const load = () => call(`/share/${token}`).then(setP).catch(e => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [token]);
  const decide = async (c, status) => { try { await call(`/share/${token}/changes/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); } catch (e) { setErr(e.message); } };
  const send = async e => { e.preventDefault(); setBusy(true); try { await call(`/share/${token}/changes`, { method: 'POST', body: JSON.stringify(form) }); setForm({ title: '', description: '', cost: '', days: '0' }); setOpen(false); setErr(''); load(); } catch (x) { setErr(x.message); } setBusy(false); };
  if (!p) return <div className="app-shell"><div className="content-wrap"><div className="panel empty-state"><strong>{err || 'Loading your shared project...'}</strong></div></div></div>;
  const approved = p.changes.filter(c => c.status === 'Approved').reduce((s, c) => s + c.cost, 0);
  const mine = p.changes.filter(c => c.status === 'Pending' && c.proposedBy === 'freelancer').length;
  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <div className="content-wrap" style={{ maxWidth: 940 }}>
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SHARED AGREEMENT · CLIENT VIEW</div><h1>{p.name}</h1><p className="heading-sub">You and your freelancer see exactly the same scope. Anything new is a request the other side has to agree to. Updates appear here automatically.</p></div><button className="primary-btn" onClick={() => setOpen(!open)}><Plus size={16} /> Request a change</button></div>
      {err && <div className="panel" style={{ padding: 14, marginBottom: 14, color: '#f18b9b', fontSize: 12 }}>{err}</div>}
      {open && <form className="panel modal-form" onSubmit={send} style={{ marginBottom: 16 }}><div className="form-grid">
        <label className="span-two">What would you like to change or add?<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Add a blog page" required /></label>
        <label className="span-two">Details<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Anything that helps the freelancer price it" /></label>
        <label>Your budget for it (INR, optional)<input type="number" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></label>
        <label>Extra days you can allow<input type="number" min="0" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} /></label></div>
        <div className="modal-footer"><span><Handshake size={14} /> Your freelancer will approve or decline it.</span><button className="primary-btn" disabled={busy}>Send request</button></div></form>}
      <div className="detail-stats"><div className="panel detail-stat"><span>Agreed budget</span><strong>{currency(p.budget)}</strong><small>Original agreement</small></div><div className="panel detail-stat"><span>Agreed extras</span><strong className="mint-text">+{currency(approved)}</strong><small>Both sides said yes</small></div><div className="panel detail-stat"><span>Waiting for you</span><strong className="amber-text">{mine}</strong><small>Proposals to answer</small></div><div className="panel detail-stat"><span>Target delivery</span><strong>{p.dueDate || 'Not set'}</strong><small>Status: {p.status}</small></div></div>
      <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel detail-main-panel"><div className="panel-top"><div><div className="section-kicker">WHAT WE AGREED</div><h2>Scope of work</h2></div><div className="signed-indicator"><ShieldCheck size={15} /> Shared</div></div><p className="scope-description">{p.summary}</p>
          <div className="scope-column included"><div className="scope-column-head"><div><Check size={15} /></div><strong>Included</strong></div><ul>{p.deliverables.map((d, i) => <li key={i}><Check size={14} />{d}</li>)}</ul></div>
          <div className="scope-column excluded" style={{ marginTop: 12 }}><div className="scope-column-head"><div><X size={15} /></div><strong>Not included</strong></div><ul>{p.exclusions.map((d, i) => <li key={i}><X size={14} />{d}</li>)}</ul></div></div>
        <div className="panel detail-changes-panel"><div className="panel-top"><div><div className="section-kicker">WHAT CHANGED</div><h2>Shared change log</h2></div></div><div className="detail-change-list">
          {p.changes.map(c => { const fromMe = c.proposedBy !== 'freelancer'; return <div className="detail-change" key={c.id}><div className={`change-timeline-dot ${c.status.toLowerCase()}`} /><div className="detail-change-content"><div className="detail-change-top"><strong>{c.title}</strong><span className={`status-badge ${c.status.toLowerCase()}`}><i />{c.status}</span></div><p>{c.description}</p><div className="detail-change-meta"><span className={`by-tag ${fromMe ? 'me' : ''}`}>{fromMe ? 'You asked' : 'Freelancer proposed'}</span><b>{currency(c.cost)}</b><span>+{c.days} day{c.days === 1 ? '' : 's'}</span></div>
            {c.status === 'Pending' && (fromMe ? <div className="inline-decision"><span className="waiting-tag"><Clock3 size={13} /> Waiting for freelancer</span></div> : <div className="inline-decision"><button className="approve-btn" onClick={() => decide(c, 'Approved')}><Check size={13} /> Agree</button><button className="decline-btn" onClick={() => decide(c, 'Declined')}>Decline</button></div>)}</div></div>; })}</div></div></div>
    </div></div>;
}
