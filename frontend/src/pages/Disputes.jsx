import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useLoad, Badge, ErrorBox } from '../ui.jsx';

export default function Disputes() {
  const { data, error } = useLoad(() => api.get('/disputes'));
  return (
    <>
      <div className="page-head"><div><h1>Mes signalements</h1><p className="muted">Pour signaler un problème, ouvrez une séance acceptée dans « Planning » après son début.</p></div></div>
      <ErrorBox msg={error} />
      {data?.length === 0 && <p className="muted">Aucun signalement.</p>}
      {data?.map((d) => (
        <div className="card" key={d.id}>
          <div className="row between"><div><h3>{d.offer_title}</h3><p className="small muted" style={{ margin: 0 }}>{d.kind} · {fmtDate(d.created_at + 'Z')}</p></div><Badge s={d.status} /></div>
          <Link className="btn sm ghost" to={`/disputes/${d.id}`} style={{ marginTop: '.6rem', display: 'inline-block' }}>Ouvrir</Link>
        </div>
      ))}
    </>
  );
}
