import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useLoad, ErrorBox, Rating } from '../ui.jsx';

export default function Catalog() {
  const [tab, setTab] = useState('all');
  const [f, setF] = useState({ q: '', category_id: '', level: '', mode: '', date: '' });
  const cats = useLoad(() => api.get('/categories'));
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...(tab === 'sug' ? { suggestions: '1' } : {}) }).toString();
  const { data: offers, error } = useLoad(() => api.get('/offers?' + qs), [qs]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="page-head"><div><h1>Catalogue des séances</h1><p className="muted">Trouvez une compétence à apprendre.</p></div></div>
      <div className="tabs">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Toutes les offres</button>
        <button className={tab === 'sug' ? 'on' : ''} onClick={() => setTab('sug')}>✨ Suggestions pour moi</button>
      </div>
      <div className="filters card">
        <div><label>Compétence / mot-clé</label><input placeholder="Python, anglais…" value={f.q} onChange={set('q')} /></div>
        <div><label>Catégorie</label><select value={f.category_id} onChange={set('category_id')}><option value="">Toutes</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>Niveau</label><select value={f.level} onChange={set('level')}><option value="">Tous</option><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option></select></div>
        <div><label>Mode</label><select value={f.mode} onChange={set('mode')}><option value="">Tous</option><option>Présentiel</option><option>À distance</option></select></div>
        <div><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
        <button className="btn ghost" onClick={() => setF({ q: '', category_id: '', level: '', mode: '', date: '' })}>Réinitialiser</button>
      </div>
      <ErrorBox msg={error} />
      {tab === 'sug' && offers?.length === 0 && <div className="alert info">Aucune suggestion : renseignez vos <Link to="/profile">compétences recherchées</Link> dans votre profil.</div>}
      {offers?.length === 0 && tab === 'all' && <p className="muted">Aucune offre ne correspond à votre recherche.</p>}
      <div className="grid">
        {offers?.map((o) => (
          <div className="card" key={o.id}>
            <div className="row between"><span className="badge">{o.category}</span><span className="badge gray">{o.duration} h · {o.duration} cr.</span></div>
            <h3>{o.title}</h3>
            <p className="small muted" style={{ margin: 0 }}>{o.skill} · {o.level} · {o.mode}</p>
            <p className="small" style={{ margin: 0 }}>{o.description.slice(0, 110)}{o.description.length > 110 ? '…' : ''}</p>
            <p className="small muted" style={{ margin: 0 }}>Par <Link to={`/users/${o.owner.id}`}>{o.owner.first_name} {o.owner.last_name}</Link> · <Rating r={o.owner.rating} /></p>
            <p className="small" style={{ margin: 0 }}>📅 Prochain créneau : {fmtDate(o.slots[0].start_at)}</p>
            <Link className="btn" to={`/offers/${o.id}`} style={{ textAlign: 'center' }}>Voir l'offre</Link>
          </div>
        ))}
      </div>
    </>
  );
}
