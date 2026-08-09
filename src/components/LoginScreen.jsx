import { useState } from 'react';
import { sb, setRememberMe } from '../lib/supabase.js';

// ── Login Screen ──────────────────────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Muss vor signInWithPassword gesetzt werden - der Storage-Adapter in lib/supabase.js liest
    // dieses Flag, sobald Supabase die neue Session direkt nach dem Login abspeichert.
    setRememberMe(remember);
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '4px', textAlign: 'center', marginBottom: '8px', color: '#1e293b' }}>YuYu</h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '300', marginBottom: '40px' }}>Melde dich mit deinen PIFA-Zugangsdaten an</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', background: '#f8fafc', color: '#1e293b' }}
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', background: '#f8fafc', color: '#1e293b' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
            />
            Angemeldet bleiben
          </label>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', borderRadius: '10px', background: '#3b82f6', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
