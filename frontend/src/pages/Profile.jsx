import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useAction, Rating } from '../ui.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({
    first_name: user.first_name, last_name: user.last_name, field: user.field || '',
    offered_skills: user.offered_skills || '', wanted_skills: user.wanted_skills || '',
  });
  const { busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="page-head"><div><h1>Mon profil</h1><p className="muted">{user.email} · <Rating r={user.rating} /></p></div></div>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.put('/me', f); await refresh(); }, 'Profil mis à jour.'); }}>
        <div className="form two">
          <div><label>Prénom</label><input required value={f.first_name} onChange={set('first_name')} /></div>
          <div><label>Nom</label><input required value={f.last_name} onChange={set('last_name')} /></div>
        </div>
        <div><label>Filière</label><input value={f.field} onChange={set('field')} /></div>
        <div><label>Compétences proposées (séparées par des virgules)</label>
          <input placeholder="Python, SQL, Anglais" value={f.offered_skills} onChange={set('offered_skills')} /></div>
        <div><label>Compétences recherchées (utilisées pour vos suggestions)</label>
          <input placeholder="Excel, Prise de parole, Design" value={f.wanted_skills} onChange={set('wanted_skills')} /></div>
        <div><button className="btn" disabled={busy}>Enregistrer</button></div>
      </form>
    </>
  );
}
