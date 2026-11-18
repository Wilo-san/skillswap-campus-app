import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useLoad, useAction, Badge, ErrorBox } from '../ui.jsx';

export default function DisputeDetail({ admin }) {
  const { id } = useParams();
  const { data: d, error, reload } = useLoad(() => api.get(`/disputes/${id}`), [id]);
  const [msg, setMsg] = useState('');
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  if (error) return <ErrorBox msg={error} />;
  if (!d) return <div className="center">Chargement…</div>;
  const decide = (decision) => run(async () => { await api.post(`/admin/disputes/${d.id}/resolve`, { decision, reason }); await reload(); }, 'Décision enregistrée.');
  return (
    <>
      <div className="page-head"><div><h1>Litige : {d.offer_title}</h1>
        <p className="muted">{d.kind} · {fmtDate(d.start_at)} · {d.cost} crédit(s) bloqués</p></div><Badge s={d.status} /></div>
      <div className="card">
        <p className="small">Intervenant : <b>{d.provider.first_name} {d.provider.last_name}</b> {d.provider_confirmed ? '(a confirmé)' : '(n’a pas confirmé)'}<br />
          Bénéficiaire : <b>{d.beneficiary.first_name} {d.beneficiary.last_name}</b> {d.beneficiary_confirmed ? '(a confirmé)' : '(n’a pas confirmé)'}</p>
      </div>
      <h2>Échanges</h2>
      {d.messages.map((m) => <div className="msg" key={m.id}><b>{m.first_name} {m.last_name}</b> <span className="small muted">{fmtDate(m.created_at + 'Z')}</span><div>{m.message}</div></div>)}
      {d.status === 'ouvert' && (
        <div className="card form">
          <div><label>Ajouter un élément / message</label><textarea value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
          <div><button className="btn" disabled={busy || msg.trim().length < 2} onClick={() => run(async () => { await api.post(`/disputes/${d.id}/messages`, { message: msg }); setMsg(''); await reload(); }, 'Message ajouté.')}>Envoyer</button></div>
        </div>
      )}
      {d.status === 'résolu' && <div className="card"><h3>Décision : {d.decision === 'transfert' ? 'Transfert à l’intervenant' : 'Restitution au bénéficiaire'}</h3><p>{d.decision_reason}</p></div>}
      {admin && d.status === 'ouvert' && (
        <div className="card form">
          <h3>Décision de l'administrateur (définitive, intégrale)</h3>
          <div><label>Motif de la décision (obligatoire)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="row">
            <button className="btn ok" disabled={busy} onClick={() => { if (confirm('Transférer intégralement les crédits à l’intervenant ?')) decide('transfert'); }}>Transférer à l'intervenant</button>
            <button className="btn danger" disabled={busy} onClick={() => { if (confirm('Restituer intégralement les crédits au bénéficiaire ?')) decide('restitution'); }}>Restituer au bénéficiaire</button>
          </div>
        </div>
      )}
    </>
  );
}
