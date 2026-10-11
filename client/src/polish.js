// Cursor spotlight: panels glow where the pointer is. One delegated listener, throttled with rAF.
let raf = 0;
document.addEventListener('pointermove', (e) => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const p = e.target.closest && e.target.closest('.panel');
    if (!p) return;
    const r = p.getBoundingClientRect();
    p.style.setProperty('--mx', e.clientX - r.left + 'px');
    p.style.setProperty('--my', e.clientY - r.top + 'px');
  });
}, { passive: true });
