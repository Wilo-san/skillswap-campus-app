import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate, fmtHour } from '../api.js';
import { useAction, useLoad, ErrorBox, Badge } from '../ui.jsx';

const empty = { title: '', category_id: '', skill: '', description: '', level: 'Débutant', duration: 1, mode: 'À distance' };

export default function OfferForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const cats = useLoad(() => api.get('/categories'));
  const offer = useLoad(() => (id ? api.get(`/offers/${id}`) : Promise.resolve(null)), [id]);
  const [f, setF] = useState(empty);
  const [slot, setSlot] = useState({ start_at: '', location: '' });
  const { busy, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (offer.data) { const o = offer.data; setF({ title: o.title, category_id: o.category_id, skill: o.skill, description: o.description, level: o.level, duration: o.duration, mode: o.mode }); } }, [offer.data]);
  useEffect(() => { if (!id && cats.data?.length && !f.category_id) setF((x) => ({ ...x, category_id: cats.data[0].id })); }, [cats.data, id]); // eslint-disable-line

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      if (id) { await api.put(`/offers/${id}`, { ...f, duration: Number(f.duration) }); await offer.reload(); }
      else { const r = await api.post('/offers', { ...f, duration: Number(f.duration) }); nav(`/my-offers/${r.id}`); }
    }, 'Offre enregistrée.');
  };
  const addSlot = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/offers/${id}/slots`, { start_at: new Date(slot.start_at).toISOString(), location: slot.location }); setSlot({ start_at: '', location: '' }); await offer.reload(); }, 'Créneau ajouté.');
  };
  const o = offer.data;
  return (
    <>
      <div className="page-head"><div><h1>{id ? 'Modifier l’offre' : 'Nouvelle offre'}</h1></div>{o && <Badge s={o.status} />}</div>
      <ErrorBox msg={offer.error} />
      <form className="card form" onSubmit={save}>
        <div><label>Titre</label><input required value={f.title} onChange={set('title')} placeholder="Initiation à Python" /></div>
        <div className="form two">
          <div><label>Catégorie</label><select value={f.category_id} onChange={set('category_id')}>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label>Compétence</label><input required value={f.skill} onChange={set('skill')} placeholder="Python" /></div>
        </div>
        <div><label>Description</label><textarea required value={f.description} onChange={set('description')} /></div>
        <div className="form two">
          <div><label>Niveau</label><select value={f.level} onChange={set('level')}><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option></select></div>
          <div><label>Durée</label><select value={f.duration} onChange={set('duration')}><option value={1}>1 heure (1 crédit)</option><option value={2}>2 heures (2 crédits)</option></select></div>
        </div>
        <div><label>Mode de déroulement</label><select value={f.mode} onChange={set('mode')}><option>À distance</option><option>Présentiel</option></select></div>
        <div className="row"><button className="btn" disabled={busy}>Enregistrer</button><button type="button" className="btn ghost" onClick={() => nav('/my-offers')}>Retour</button></div>
      </form>

      {id && o && (
        <>
          <h2>Créneaux</h2>
          <form className="card form two" onSubmit={addSlot}>
            <div><label>Début (la fin = début + {f.duration} h)</label><input type="datetime-local" required value={slot.start_at} onChange={(e) => setSlot({ ...slot, start_at: e.target.value })} /></div>
            <div><label>{o.mode === 'À distance' ? 'Lien de réunion (privé)' : 'Lieu précis (privé)'}</label><input required value={slot.location} onChange={(e) => setSlot({ ...slot, location: e.target.value })} placeholder={o.mode === 'À distance' ? 'https://meet…' : 'Salle B12, bibliothèque'} /></div>
            <div><button className="btn" disabled={busy}>Ajouter le créneau</button></div>
          </form>
          {o.slots.length === 0 && <p className="muted">Aucun créneau. Ajoutez-en un pour pouvoir publier.</p>}
          {o.slots.map((s) => (
            <div className="slot" key={s.id}>
              <div><b>{fmtDate(s.start_at)}</b> → {fmtHour(s.end_at)} <span className="small muted">· {s.location}</span> {s.taken && <span className="badge green">Attribué</span>}</div>
              {!s.taken && <button className="btn sm danger" disabled={busy} onClick={() => run(async () => { await api.del(`/slots/${s.id}`); await offer.reload(); }, 'Créneau supprimé.')}>Supprimer</button>}
            </div>
          ))}
        </>
      )}
    </>
  );
}
