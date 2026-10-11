import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Orbit } from 'lucide-react';
import { createOrbit, TONES } from './orbitEngine.js';

const daysTo = d => d ? Math.ceil((new Date(`${d}T00:00:00`) - new Date()) / 864e5) : 99;
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Turns each project into a planet: colour = situation, distance = urgency, size = budget.
export function orbitItems(projects) {
  const max = Math.max(...projects.map(p => p.budget || 0), 1);
  return projects.map(p => {
    const waiting = (p.changes || []).filter(c => c.status === 'Pending' && c.proposedBy !== 'freelancer').length, d = daysTo(p.dueDate);
    const done = p.status === 'Completed';
    const tone = done ? 'clear' : waiting || d < 0 ? 'red' : d <= 3 ? 'amber' : 'open';
    const u = { red: .9, amber: .66, open: .4, clear: .1 }[tone] + Math.min(.08, waiting * .03);
    const sub = done ? 'Delivered' : waiting ? `${waiting} awaiting your decision` : d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d <= 3 ? `Due in ${d} day${d === 1 ? '' : 's'}` : `${money(p.budget)} · due in ${d}d`;
    return { id: p.id, name: (p.client || p.name).split(' ').slice(0, 2).join(' '), sub, tone, u, size: 7 + 9 * Math.sqrt((p.budget || 0) / max), project: p };
  });
}

export default function OrbitPanel({ projects, onOpen }) {
  const ref = useRef(null), eng = useRef(null), [focus, setFocus] = useState(null);
  const items = useMemo(() => orbitItems(projects), [projects]);
  const byId = useRef({}); byId.current = Object.fromEntries(items.map(i => [i.id, i.project]));
  useEffect(() => { eng.current = createOrbit(ref.current, { onClick: id => byId.current[id] && onOpen(byId.current[id]) }); return () => eng.current.destroy(); }, []);
  useEffect(() => { eng.current?.setData(items); }, [items]);
  useEffect(() => { eng.current?.setFocus(focus); }, [focus]);
  const urgent = items.slice().sort((a, b) => b.u - a.u).slice(0, 4);
  return <section className="orbit-grid">
    <div className="panel orbit-panel"><div className="panel-top"><div><div className="section-kicker">YOUR PORTFOLIO</div><h2>Client orbit</h2></div><div className="pill-live"><span /> LIVE</div></div>
      <canvas ref={ref} aria-label="Projects orbiting you. Closer means more urgent." />
      <div className="orbit-legend">{Object.entries(TONES).map(([k, [c, label]]) => <button key={k} className={focus === k ? 'on' : ''} onClick={() => setFocus(focus === k ? null : k)}><i style={{ background: c, boxShadow: `0 0 10px ${c}` }} />{label}</button>)}</div>
      <p className="fine orbit-hint">Closer to you means more urgent. Click a planet to open it, or a legend item to focus.</p></div>
    <div className="panel orbit-side"><div className="panel-top"><div><div className="section-kicker">WHO NEEDS YOU</div><h2>Closest to you</h2></div><Orbit size={18} color="#a897ff" /></div>
      <div className="orbit-list">{urgent.map(i => <button key={i.id} className="orbit-item" onClick={() => onOpen(i.project)}><i style={{ background: TONES[i.tone][0], boxShadow: `0 0 12px ${TONES[i.tone][0]}` }} /><span><strong>{i.project.name}</strong><small>{i.sub}</small></span><ArrowUpRight size={15} /></button>)}</div></div>
  </section>;
}
