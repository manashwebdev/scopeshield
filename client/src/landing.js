import { createOrbit } from './orbitEngine.js';
const DEMO = [['Atlas', 'red', .9, 15, '1 awaiting your decision'], ['Northstar', 'amber', .66, 11, 'Due in 2 days'], ['Kite Fit', 'red', .86, 17, '2 awaiting your decision'], ['Mira', 'open', .4, 12, 'In progress'], ['Zen', 'open', .46, 9, 'In progress'], ['Orbit', 'clear', .1, 10, 'Delivered'], ['Lumen', 'open', .36, 13, 'In progress']].map(([name, tone, u, size, sub]) => ({ id: name, name, tone, u, size, sub }));
const card = (n, t, d) => `<div class="ln-card panel rv"><span class="ln-num">${n}</span><h3>${t}</h3><p>${d}</p></div>`;
const HTML = `<div class="ln"><div class="ln-grid"></div>
<header class="ln-nav"><a class="ln-logo" href="#top"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg><b class="ln-name">Scope<span>Shield</span></b></a>
<nav><a href="#features">Features</a><a href="#how">How it works</a><button class="ln-ghost" data-go="login">Sign in</button></nav></header>
<section class="ln-hero" id="top"><div class="ln-copy"><span class="ln-pill"><i></i> Built for freelancers and small studios</span>
<h1>Turn every client deal into a <em>shared agreement.</em></h1><p>Write the scope once. Your client sees the same page, every change needs a yes from the other side, and nothing slips through as invisible work.</p>
<div class="ln-cta"><button class="ln-btn" data-go="register">Start free</button><a class="ln-btn dark" href="#how">See how it works</a></div><div class="ln-trust"><span>No credit card</span><span>Client needs no account</span><span>Live updates</span></div></div>
<div class="ln-device"><div class="ln-frame panel"><div class="ln-frame-top"><b>Client orbit</b><span><i></i> live</span></div><canvas id="heroOrbit"></canvas><div class="ln-legend"><span><i style="background:#ff5d73"></i>Needs you</span><span><i style="background:#ffb454"></i>Due soon</span><span><i style="background:#4fd8ff"></i>Open</span><span><i style="background:#5fe3a1"></i>Clear</span></div></div>
<div class="ln-float f1"><small>Client asked</small><b>Add case-study page</b><div><em>₹3,500</em><span class="approve-btn">✓ Approve</span></div></div><div class="ln-float f2"><small>Agreed by both</small><b>+₹1,200 added to deal</b></div></div></section>
<section class="ln-sec" id="features"><div class="ln-head rv"><span class="ln-kick">FEATURES</span><h2>Everything a scope needs, nothing it doesn't.</h2></div><div class="ln-cards">
${card('01', 'One shared agreement', 'Deliverables, exclusions, budget and dates in one page your client can open with a private link. No login for them.')}
${card('02', 'Two-sided approvals', 'Either of you can propose a change. Only the other side can approve it, so nothing is added to the deal by one person alone.')}
${card('03', 'Client orbit', 'Every project orbits you. Closer means more urgent. See at a glance who needs a decision before the deadline slips.')}
${card('04', 'Live and in sync', 'Both screens update within seconds. Everyone always sees what was agreed, what changed and what is still open.')}
${card('05', 'Export in one click', 'Download the full agreement with every approved change as a clean Markdown summary to attach to an invoice.')}
${card('06', 'Private by default', 'Secure sign in, your own workspace, and every project locked to its owner. Clients only see what you share.')}</div></section>
<section class="ln-sec" id="how"><div class="ln-head rv"><span class="ln-kick">HOW IT WORKS</span><h2>From first call to signed-off in three steps.</h2></div><div class="ln-steps">
<div class="ln-step rv"><b>1</b><h3>Write the scope</h3><p>Add what is included, what is not, the budget and the date.</p></div><div class="ln-step rv"><b>2</b><h3>Share the link</h3><p>Your client opens the same agreement on any device.</p></div><div class="ln-step rv"><b>3</b><h3>Agree every change</h3><p>New ask? The other side approves it. Budget and dates update for both.</p></div></div></section>
<section class="ln-sec"><div class="ln-final panel rv"><h2>Keep the project. <em>Protect the scope.</em></h2><p>Create your workspace in under a minute.</p><button class="ln-btn" data-go="register">Create free account</button></div></section>
<footer class="ln-foot"><span>ScopeShield</span><span>Scope, protected.</span></footer></div>`;

export function mountLanding(root, { onLogin, onRegister }) {
  root.innerHTML = HTML;
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => (b.dataset.go === 'login' ? onLogin : onRegister)());
  const orbit = createOrbit(root.querySelector('#heroOrbit')); orbit.setData(DEMO);
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
  root.querySelectorAll('.rv').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(el); });
  return () => { orbit.destroy(); io.disconnect(); };
}
