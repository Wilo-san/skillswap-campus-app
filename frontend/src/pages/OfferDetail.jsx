import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, fmtHour } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad, useAction, ErrorBox, Rating, Badge } from '../ui.jsx';

export default function OfferDetail() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const { data: o, error, reload } = useLoad(() => api.get(`/offers/${id}`), [id]);
  const { busy, run } = useAction();
  if (error) return <ErrorBox msg={error} />;
  if (!o) return <div className="center">Chargement…</div>;
  const mine = o.owner_id === user.id;
  const free = o.slots.filter((s) => !s.taken && new Date(s.start_at) > new Date());
  return (
    <>
      <div className="page-head">
        <div><h1>{o.title}</h1>
          <p className="muted">{o.category} · {o.skill} · {o.level} · {o.mode} · {o.duration} h ({o.duration} crédit{o.duration > 1 ? 's' : ''})</p></div>
        <Badge s={o.status} />
      </div>
      <div className="card">
        <p>{o.description}</p>
        <p className="small muted">Intervenant : <Link to={`/users/${o.owner.id}`}>{o.owner.first_name} {o.owner.last_name}</Link> ({o.owner.field}) · <Rating r={o.owner.rating} /></p>
      </div>
      <h2>Créneaux disponibles</h2>
      {free.length === 0 && <p className="muted">Aucun créneau disponible.</p>}
      {free.map((s) => (
        <div className="slot" key={s.id}>
          <div><b>{fmtDate(s.start_at)}</b> → {fmtHour(s.end_at)} {s.location && <span className="small muted">· {s.location}</span>}</div>
          {mine ? <span className="small muted">Votre offre</span> : (
            <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api.post('/bookings', { slot_id: s.id }); await refresh(); }, 'Demande envoyée. Suivez-la dans « Demandes ».')}>Demander ce créneau</button>
          )}
        </div>
      ))}
      {!mine && <p className="small muted">Vous disposez de {user.balance} crédit(s). Le lieu / lien précis est visible après acceptation.</p>}
    </>
  );
}
