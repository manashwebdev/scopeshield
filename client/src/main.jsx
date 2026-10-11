import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ClientPortal from './ClientPortal.jsx';
import { mountLanding } from './landing.js';
import { mountAuth } from './authCard.js';
import { authenticate, clearAuth, currentUser } from './auth.js';
import './styles.css';
import './polish.css';
import './landing.css';
import './polish.js';

// Runs one of the framework-free modules (landing page, auth card) inside React.
function Mount({ fn, props }) {
  const ref = useRef(null);
  useEffect(() => { const stop = fn(ref.current, props); return typeof stop === 'function' ? stop : undefined; }, []);
  return <div ref={ref} />;
}

function Gate() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [view, setView] = useState(['login', 'register'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'landing');
  useEffect(() => { currentUser().then(u => setUser(u || null)); }, []);
  const go = v => { setView(v); window.scrollTo(0, 0); };
  const logout = () => { clearAuth(); setUser(null); go('landing'); };
  if (user === undefined) return <div className="app-shell"><div className="ambient ambient-one" /></div>;
  if (user) return <App user={user} onLogout={logout} />;
  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    {view === 'landing'
      ? <Mount fn={mountLanding} props={{ onLogin: () => go('login'), onRegister: () => go('register') }} />
      : <Mount key={view} fn={mountAuth} props={{ mode: view, onSwitch: go, onBack: () => go('landing'), onSubmit: async (mode, v) => setUser(await authenticate(mode, v)) }} />}
  </div>;
}

const share = new URLSearchParams(location.search).get('share');
createRoot(document.getElementById('root')).render(<React.StrictMode>{share ? <ClientPortal token={share} /> : <Gate />}</React.StrictMode>);
