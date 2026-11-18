import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr('');
    try { await login(f.email, f.password); nav('/'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="auth">
      <form className="card form" onSubmit={submit}>
        <div><h1>🔄 SkillSwap <span style={{ color: 'var(--primary)' }}>Campus</span></h1><p className="muted">Échangez vos compétences, sans argent.</p></div>
        {err && <div className="alert">{err}</div>}
        <div><label>Adresse e-mail</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label>Mot de passe</label><input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn" disabled={busy}>Se connecter</button>
        <p className="small muted">Pas de compte ? <Link to="/register">S'inscrire</Link> (2 crédits offerts)</p>
      </form>
    </div>
  );
}
