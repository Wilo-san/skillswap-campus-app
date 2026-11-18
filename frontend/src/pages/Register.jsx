import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', field: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr('');
    try { await register(f); nav('/profile'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="auth">
      <form className="card form" onSubmit={submit}>
        <div><h1>Créer un compte</h1><p className="muted">Vous recevez 2 crédits de bienvenue 🎁</p></div>
        {err && <div className="alert">{err}</div>}
        <div className="form two">
          <div><label>Prénom</label><input required value={f.first_name} onChange={set('first_name')} /></div>
          <div><label>Nom</label><input required value={f.last_name} onChange={set('last_name')} /></div>
        </div>
        <div><label>Adresse e-mail</label><input type="email" required value={f.email} onChange={set('email')} /></div>
        <div><label>Filière</label><input placeholder="ex. DUT GI" value={f.field} onChange={set('field')} /></div>
        <div><label>Mot de passe (8 caractères min.)</label><input type="password" minLength={8} required value={f.password} onChange={set('password')} /></div>
        <button className="btn" disabled={busy}>Créer mon compte</button>
        <p className="small muted">Déjà inscrit ? <Link to="/login">Se connecter</Link></p>
      </form>
    </div>
  );
}
