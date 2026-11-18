import { api, fmtDate } from '../api.js';
import { useLoad, ErrorBox } from '../ui.jsx';

const LABELS = { bienvenue: 'Bienvenue', blocage: 'Blocage', 'libération': 'Libération', transfert_sortant: 'Transfert envoyé', transfert_entrant: 'Transfert reçu', restitution: 'Restitution' };
const SIGN = { bienvenue: '+', 'libération': '+', transfert_entrant: '+', restitution: '+', blocage: '−', transfert_sortant: '−' };

export default function Wallet() {
  const { data, error } = useLoad(() => api.get('/wallet'));
  if (error) return <ErrorBox msg={error} />;
  if (!data) return <div className="center">Chargement…</div>;
  return (
    <>
      <div className="page-head"><div><h1>Portefeuille de crédits</h1><p className="muted">1 crédit = 1 heure.</p></div></div>
      <div className="wallet">
        <div className="stat"><b>{data.balance}</b><span>Crédits disponibles</span></div>
        <div className="stat"><b>{data.blocked}</b><span>Crédits bloqués (séances acceptées)</span></div>
      </div>
      <h2>Historique des mouvements</h2>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Séance</th><th>Détail</th></tr></thead>
        <tbody>
          {data.movements.length === 0 && <tr><td colSpan={5} className="muted">Aucun mouvement.</td></tr>}
          {data.movements.map((m) => (
            <tr key={m.id}>
              <td>{fmtDate(m.created_at + 'Z')}</td><td>{LABELS[m.type]}</td>
              <td className={SIGN[m.type] === '+' ? 'pos' : 'neg'}>{SIGN[m.type]}{m.amount}</td>
              <td>{m.offer_title || '—'}</td><td className="small muted">{m.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
