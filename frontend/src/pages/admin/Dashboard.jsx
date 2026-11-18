import { api } from '../../api.js';
import { useLoad, ErrorBox } from '../../ui.jsx';

export default function Dashboard() {
  const { data: s, error } = useLoad(() => api.get('/admin/stats'));
  const items = s && [
    ['active_accounts', 'Comptes actifs'], ['published_offers', 'Offres publiées'], ['accepted_sessions', 'Séances acceptées'],
    ['completed_sessions', 'Séances réalisées'], ['credits_transferred', 'Crédits transférés'], ['open_disputes', 'Litiges ouverts'],
  ];
  return (
    <>
      <div className="page-head"><div><h1>Tableau de bord</h1><p className="muted">Vue d'ensemble de la plateforme.</p></div></div>
      <ErrorBox msg={error} />
      <div className="stats">{items?.map(([k, l]) => <div className="stat" key={k}><b>{s[k]}</b><span>{l}</span></div>)}</div>
    </>
  );
}
