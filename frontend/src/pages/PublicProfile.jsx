import { useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useLoad, ErrorBox, Rating, Stars } from '../ui.jsx';

export default function PublicProfile() {
  const { id } = useParams();
  const { data: u, error } = useLoad(() => api.get(`/users/${id}`), [id]);
  if (error) return <ErrorBox msg={error} />;
  if (!u) return <div className="center">Chargement…</div>;
  return (
    <>
      <div className="page-head"><div><h1>{u.first_name} {u.last_name}</h1><p className="muted">{u.field} · <Rating r={u.rating} /></p></div></div>
      <div className="card"><h3>Propose</h3><p>{u.offered_skills || '—'}</p><h3>Recherche</h3><p>{u.wanted_skills || '—'}</p></div>
      <h2>Évaluations</h2>
      {u.reviews.length === 0 && <p className="muted">Aucune évaluation pour le moment.</p>}
      {u.reviews.map((r, i) => (
        <div className="card" key={i}><Stars value={r.rating} /> <b>{r.first_name} {r.last_name}</b> <span className="small muted">· {fmtDate(r.created_at + 'Z')}</span><p>{r.comment || <span className="muted">Pas de commentaire.</span>}</p></div>
      ))}
    </>
  );
}
