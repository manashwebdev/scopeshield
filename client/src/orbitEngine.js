// Framework-free orbit renderer: "You" in the centre, projects drift around you. Closer = more urgent.
export const TONES = { red: ['#ff5d73', 'Needs decision or overdue'], amber: ['#ffb454', 'Due within 3 days'], open: ['#4fd8ff', 'In progress'], clear: ['#5fe3a1', 'All clear'] };

export function createOrbit(cv, { onClick } = {}) {
  const ctx = cv.getContext('2d'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = { pl: [], W: 0, H: 0, mx: null, my: 0, px: 0, py: 0, hover: null, focus: null, raf: 0, last: 0 };
  const fit = () => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; S.W = r.width; S.H = r.height; cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  const maxR = () => Math.max(120, Math.min(S.W / 2 - 60, S.H / 2 - 36) * 1.02);
  const ro = new ResizeObserver(fit); ro.observe(cv); fit();

  function setData(items) {
    const old = new Map(S.pl.map(p => [p.id, p]));
    S.pl = items.map((it, i) => {
      const o = old.get(it.id), mr = Math.min(S.W / 2 - 60, 260);
      return { ...it, ang: o ? o.ang : (i / items.length) * Math.PI * 2 + i * .6, r: o ? o.r : 30, h: o ? o.h : 0, x: 0, y: 0,
        tr: 72 + (1 - it.u) * (Math.max(120, mr) - 72), spd: (.22 + it.u * .3) * (i % 2 ? -1 : 1) * .55, size: it.size };
    });
  }
  function frame(t) {
    const dt = Math.min(.05, (t - S.last) / 1000 || .016); S.last = t;
    const { W, H } = S, k = Math.min(1, dt * 3);
    ctx.clearRect(0, 0, W, H);
    const tx = S.mx == null ? 0 : (S.mx - W / 2) * .025, ty = S.mx == null ? 0 : (S.my - H / 2) * .025;
    S.px += (tx - S.px) * k; S.py += (ty - S.py) * k;
    const cx = W / 2 + S.px, cy = H / 2 + S.py, R = Math.min(W / 2 - 60, H / 2 / .82 - 30);
    ctx.setLineDash([3, 8]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.07)';
    [.4, .68, .96].forEach(f => { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(60, R * f), Math.max(50, R * f * .82), 0, 0, 7); ctx.stroke(); }); ctx.setLineDash([]);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100 + 8 * Math.sin(t / 900)); g.addColorStop(0, 'rgba(79,216,255,.4)'); g.addColorStop(1, 'rgba(79,216,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 110, 0, 7); ctx.fill();
    S.pl.forEach(p => {
      if (!reduced) p.ang += p.spd * dt * (S.hover === p ? .12 : 1);
      p.r += (p.tr - p.r) * k; p.h += ((S.hover === p ? 1 : 0) - p.h) * Math.min(1, dt * 9);
      p.x = cx + Math.cos(p.ang) * p.r * (R / 240 > 1 ? 1 : 1); p.y = cy + Math.sin(p.ang) * p.r * .82;
      const col = TONES[p.tone][0], dim = S.focus && S.focus !== p.tone ? .2 : 1;
      ctx.globalAlpha = dim; const lg = ctx.createLinearGradient(cx, cy, p.x, p.y); lg.addColorStop(0, 'rgba(255,255,255,.02)'); lg.addColorStop(1, col + '55');
      ctx.strokeStyle = lg; ctx.lineWidth = 1 + p.h; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.shadowColor = col; ctx.shadowBlur = 16 + 18 * p.h; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + .3 * p.h), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '600 11px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(236,239,250,.92)'; ctx.fillText(p.name, p.x, p.y + p.size + 15);
      if (p.h > .05) { ctx.globalAlpha = dim * p.h; ctx.font = '500 10px DM Sans, sans-serif'; ctx.fillStyle = col; ctx.fillText(p.sub, p.x, p.y + p.size + 29); }
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#4fd8ff'; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(cx, cy, 7 + Math.sin(t / 700), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.font = '600 11px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(200,205,225,.55)'; ctx.fillText('You', cx, cy + 24);
    S.raf = requestAnimationFrame(frame);
  }
  const pick = (x, y) => S.pl.reduce((b, p) => { const d = Math.hypot(p.x - x, p.y - y); return d < p.size + 16 && (!b || d < b.d) ? { p, d } : b; }, null)?.p || null;
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); S.mx = e.clientX - r.left; S.my = e.clientY - r.top; S.hover = pick(S.mx, S.my); cv.style.cursor = S.hover ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', () => { S.mx = null; S.hover = null; });
  cv.addEventListener('click', ev => { const r = cv.getBoundingClientRect(), p = pick(ev.clientX - r.left, ev.clientY - r.top); if (p && onClick) onClick(p.id); });
  S.raf = requestAnimationFrame(frame);
  return { setData, setFocus: f => { S.focus = f; }, destroy: () => { cancelAnimationFrame(S.raf); ro.disconnect(); } };
}
