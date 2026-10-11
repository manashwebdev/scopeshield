// Framework-free sign in / create account card. onSubmit(mode, {name,email,password}) must reject with an Error to show a message.
export function mountAuth(root, { mode = 'login', onSubmit, onSwitch, onBack }) {
  const reg = mode === 'register';
  root.innerHTML = `<div class="au-wrap"><div class="au-card panel"><button class="back-link au-back" type="button">← Back</button>
  <div class="au-logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg></div>
  <h1>${reg ? 'Create your workspace' : 'Welcome back'}</h1><p class="au-sub">${reg ? 'Protect your scope and share every deal with your clients.' : 'Sign in to your ScopeShield dashboard.'}</p>
  <form novalidate>${reg ? '<label>Your name<input name="name" autocomplete="name" placeholder="Kavita Sharma"></label>' : ''}
  <label>Email<input name="email" type="email" autocomplete="email" placeholder="you@studio.com"></label>
  <label>Password<span class="au-pw"><input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 8 characters' : 'Your password'}"><button type="button" class="au-eye" aria-label="Show password">Show</button></span></label>
  <div class="au-err" role="alert" hidden></div><button class="primary-btn au-submit" type="submit">${reg ? 'Create account' : 'Sign in'}</button></form>
  <p class="au-foot">${reg ? 'Already have an account?' : 'New to ScopeShield?'} <button type="button" class="au-link">${reg ? 'Sign in' : 'Create an account'}</button></p></div></div>`;
  const $ = s => root.querySelector(s), form = $('form'), err = $('.au-err'), btn = $('.au-submit');
  const fail = m => { err.textContent = m; err.hidden = false; $('.au-card').classList.remove('shake'); void $('.au-card').offsetWidth; $('.au-card').classList.add('shake'); };
  $('.au-back').onclick = () => onBack && onBack(); $('.au-link').onclick = () => onSwitch && onSwitch(reg ? 'login' : 'register');
  $('.au-eye').onclick = e => { const i = $('[name=password]'); i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? 'Show' : 'Hide'; };
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true; const v = Object.fromEntries(new FormData(form)); v.email = (v.email || '').trim();
    if (reg && (v.name || '').trim().length < 2) return fail('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return fail('Please enter a valid email address.');
    if (!v.password || (reg && v.password.length < 8)) return fail(reg ? 'Password must be at least 8 characters.' : 'Please enter your password.');
    btn.disabled = true; btn.textContent = reg ? 'Creating…' : 'Signing in…';
    try { await onSubmit(mode, v); } catch (x) { fail(x.message || 'Something went wrong.'); btn.disabled = false; btn.textContent = reg ? 'Create account' : 'Sign in'; }
  };
  setTimeout(() => $('input')?.focus(), 80);
}
