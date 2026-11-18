import { api } from '../../api.js';
import { useLoad, useAction, ErrorBox } from '../../ui.jsx';

export default function Users() {
  const { data, error, reload } = useLoad(() => api.get('/admin/users'));
  const { busy, run } = useAction();
  const toggle = (u) => {
    const msg = u.active ? 'Désactiver ce compte ? Ses demandes en attente seront annulées.' : 'Réactiver ce compte ?';
    if (confirm(msg)) run(async () => { await api.post(`/admin/users/${u.id}/active`, { active: !u.active }); await reload(); }, u.active ? 'Compte désactivé.' : 'Compte réactivé.');
  };
  return (
    <>
      <div className="page-head"><div><h1>Comptes</h1></div></div>
      <ErrorBox msg={error} />
      <table>
        <thead><tr><th>Nom</th><th>E-mail</th><th>Filière</th><th>Rôle</th><th>Dispo</th><th>Bloqués</th><th>État</th><th></th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id}><td>{u.first_name} {u.last_name}</td><td>{u.email}</td><td>{u.field}</td><td>{u.role}</td><td>{u.balance}</td><td>{u.blocked}</td>
              <td><span className={`badge ${u.active ? 'green' : 'red'}`}>{u.active ? 'Actif' : 'Désactivé'}</span></td>
              <td>{u.role !== 'admin' && <button className="btn sm ghost" disabled={busy} onClick={() => toggle(u)}>{u.active ? 'Désactiver' : 'Réactiver'}</button>}</td></tr>
          ))}
        </tbody>
      </table>
      <AdminBookings />
    </>
  );
}

// RG18 : traitement des réservations acceptées par l'administrateur
function AdminBookings() {
  const { data, reload } = useLoad(() => api.get('/admin/bookings'));
  const { busy, run } = useAction();
  if (!data || data.length === 0) return null;
  return (
    <>
      <h2 style={{ marginTop: '2rem' }}>Réservations acceptées / en litige</h2>
      <p className="small muted">L'administrateur peut annuler une séance acceptée (les crédits bloqués sont libérés, jamais perdus).</p>
      <table>
        <thead><tr><th>Séance</th><th>Intervenant</th><th>Bénéficiaire</th><th>Crédits</th><th>État</th><th></th></tr></thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id}><td>{b.offer.title}</td><td>{b.provider.first_name} {b.provider.last_name}</td><td>{b.beneficiary.first_name} {b.beneficiary.last_name}</td><td>{b.cost}</td><td>{b.status}</td>
              <td>{b.status === 'acceptée' && <button className="btn sm danger" disabled={busy} onClick={() => confirm('Annuler cette séance et libérer les crédits ?') && run(async () => { await api.post(`/admin/bookings/${b.id}/cancel`); await reload(); }, 'Séance annulée.')}>Annuler</button>}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
