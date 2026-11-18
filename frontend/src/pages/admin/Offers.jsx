import { api } from '../../api.js';
import { useLoad, useAction, Badge, ErrorBox } from '../../ui.jsx';

export default function Offers() {
  const { data, error, reload } = useLoad(() => api.get('/admin/offers'));
  const { busy, run } = useAction();
  const toggle = (o) => run(async () => { await api.post(`/admin/offers/${o.id}/hide`, { hidden: !o.hidden }); await reload(); }, o.hidden ? 'Offre réaffichée.' : 'Offre masquée.');
  return (
    <>
      <div className="page-head"><div><h1>Modération des offres</h1><p className="muted">Masquer une offre inappropriée annule ses demandes en attente.</p></div></div>
      <ErrorBox msg={error} />
      <table>
        <thead><tr><th>Titre</th><th>Catégorie</th><th>Auteur</th><th>État</th><th>Visibilité</th><th></th></tr></thead>
        <tbody>
          {data?.map((o) => (
            <tr key={o.id}><td>{o.title}</td><td>{o.category}</td><td>{o.owner.first_name} {o.owner.last_name}</td><td><Badge s={o.status} /></td>
              <td>{o.hidden ? <span className="badge red">Masquée</span> : <span className="badge green">Visible</span>}</td>
              <td><button className="btn sm ghost" disabled={busy} onClick={() => toggle(o)}>{o.hidden ? 'Réafficher' : 'Masquer'}</button></td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
