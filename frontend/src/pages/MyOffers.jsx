import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad, useAction, Badge, ErrorBox } from '../ui.jsx';

export default function MyOffers() {
  const { data: offers, error, reload } = useLoad(() => api.get('/offers/mine'));
  const { busy, run } = useAction();
  const setStatus = (id, status, msg) => run(async () => { await api.post(`/offers/${id}/status`, { status }); await reload(); }, msg);
  return (
    <>
      <div className="page-head"><div><h1>Mes offres</h1><p className="muted">Créez, publiez ou archivez vos séances.</p></div>
        <Link className="btn" to="/my-offers/new">+ Nouvelle offre</Link></div>
      <ErrorBox msg={error} />
      {offers?.length === 0 && <p className="muted">Vous n'avez pas encore d'offre.</p>}
      {offers?.map((o) => (
        <div className="card" key={o.id}>
          <div className="row between">
            <div><h3>{o.title} {o.hidden ? <span className="badge red">Masquée</span> : null}</h3>
              <p className="small muted" style={{ margin: 0 }}>{o.category} · {o.skill} · {o.level} · {o.mode} · {o.duration} h · {o.slots.length} créneau(x)</p></div>
            <Badge s={o.status} />
          </div>
          <div className="row" style={{ marginTop: '.7rem' }}>
            <Link className="btn sm ghost" to={`/my-offers/${o.id}`}>Modifier / créneaux</Link>
            {o.status !== 'publiée' && !o.hidden && <button className="btn sm ok" disabled={busy} onClick={() => setStatus(o.id, 'publiée', 'Offre publiée.')}>Publier</button>}
            {o.status === 'publiée' && <button className="btn sm ghost" disabled={busy} onClick={() => setStatus(o.id, 'brouillon', 'Offre repassée en brouillon.')}>Dépublier</button>}
            {o.status !== 'archivée' && <button className="btn sm danger" disabled={busy} onClick={() => { if (confirm('Archiver cette offre ? Les demandes en attente seront annulées.')) setStatus(o.id, 'archivée', 'Offre archivée.'); }}>Archiver</button>}
          </div>
        </div>
      ))}
    </>
  );
}
