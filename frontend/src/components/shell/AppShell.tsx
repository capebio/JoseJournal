import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, QUICK_LOGINS } from '../../core/auth/auth';
import { useOnline } from '../../core/offline/offline';

const NAV = [
  { to: '/explore', label: 'Discovery', ic: '◎' },
  { to: '/reader', label: 'Reader', ic: '❑' },
  { to: '/builder', label: 'Builder', ic: '✎' },
  { to: '/review', label: 'Review', ic: '◷' },
  { to: '/map', label: 'Distribution', ic: '◰' },
  { to: '/capture', label: 'Capture', ic: '✛' },
  { to: '/profile', label: 'Profile', ic: '◐' },
];

/** App shell: left nav + account chip (dev-login switcher) + offline badge (§2, §8). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { principal, login, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const online = useOnline();

  return (
    <div className="jose">
      <div className="shell">
        <nav className="shell-nav" aria-label="Primary">
          <div className="shell-mark">JOSE<span className="dot">.</span></div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `shell-navitem ${isActive ? 'active' : ''}`}>
              <span className="ni">{n.ic}</span>
              {n.label}
            </NavLink>
          ))}
          <div className="shell-acct">
            {!online && <div style={{ color: '#c8772a', fontSize: 11, marginBottom: 6 }}>● offline — public cache</div>}
            {principal ? (
              <>
                <div>{principal.accountId.replace('acct:', '')}</div>
                <span className={principal.assurance === 'certified' ? 'cert' : ''}>{principal.assurance}</span>
                <br />
                <button className="link" onClick={() => setMenu((m) => !m)}>switch ▾</button>
                <button className="link" onClick={logout} style={{ marginLeft: 10 }}>sign out</button>
              </>
            ) : (
              <button className="link" onClick={() => setMenu((m) => !m)}>sign in (dev) ▾</button>
            )}
            {menu && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {QUICK_LOGINS.map((q) => (
                  <button
                    key={q.sub}
                    className="jose-btn"
                    style={{ fontSize: 11, padding: '5px 8px' }}
                    onClick={async () => { await login(q); setMenu(false); }}
                  >
                    {q.name} · {q.assurance}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
