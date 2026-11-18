import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtHour } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad, useAction, Badge, ErrorBox, PromptModal, Modal, Stars } from '../ui.jsx';

export function BookingCard({ b, reload, showActions = true }) {
  const { refresh } = useAuth();
  const { busy, run } = useAction();
  const [modal, setModal] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const isProvider = b.role === 'intervenant';
  const other = isProvider ? b.beneficiary : b.provider;
  const ended = new Date(b.end_at) < new Date();
  const started = new Date(b.start_at) <= new Date();
  const act = (path, msg, body) => run(async () => { await api.post(`/bookings/${b.id}/${path}`, body); await refresh(); await reload(); }, msg);
  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3>{b.offer.title} <span className="badge gray">{b.role}</span></h3>
          <p className="small muted" style={{ margin: 0 }}>
            {isProvider ? 'Bénéficiaire' : 'Intervenant'} : <Link to={`/users/${other.id}`}>{other.first_name} {other.last_name}</Link> · {fmtDate(b.start_at)} → {fmtHour(b.end_at)} · {b.cost} crédit(s)
          </p>
          {b.location && <p className="small" style={{ margin: '.3rem 0 0' }}>📍 {b.location}</p>}
          {b.reason && <p className="small muted" style={{ margin: '.3rem 0 0' }}>Motif : {b.reason}</p>}
        </div>
        <Badge s={b.status} />
      </div>
      {showActions && (
        <div className="row" style={{ marginTop: '.7rem' }}>
          {b.status === 'en_attente' && isProvider && <>
            <button className="btn sm ok" disabled={busy} onClick={() => act('accept', 'Demande acceptée. Crédits bloqués chez le bénéficiaire.')}>Accepter</button>
            <button className="btn sm danger" disabled={busy} onClick={() => setModal('refuse')}>Refuser</button></>}
          {b.status === 'en_attente' && !isProvider && <button className="btn sm ghost" disabled={busy} onClick={() => act('withdraw', 'Demande retirée.')}>Retirer ma demande</button>}
          {b.status === 'acceptée' && !started && <button className="btn sm ghost" disabled={busy} onClick={() => { if (confirm('Annuler cette séance ? Les crédits seront libérés.')) act('cancel', 'Séance annulée, crédits libérés.'); }}>Annuler</button>}
          {b.status === 'acceptée' && ended && !b.my_confirmed && <button className="btn sm ok" disabled={busy} onClick={() => act('confirm', 'Confirmation enregistrée.')}>Confirmer la réalisation</button>}
          {b.status === 'acceptée' && b.my_confirmed && <span className="badge green">Vous avez confirmé</span>}
          {b.status === 'acceptée' && started && <button className="btn sm danger" disabled={busy} onClick={() => setModal('dispute')}>Signaler un problème</button>}
          {b.status === 'réalisée' && !b.reviewed && <button className="btn sm" onClick={() => setModal('review')}>Évaluer</button>}
          {b.status === 'réalisée' && b.reviewed && <span className="badge green">Évaluée</span>}
          {b.dispute && <Link className="btn sm ghost" to={`/disputes/${b.dispute.id}`}>Voir le litige</Link>}
        </div>
      )}
      {modal === 'refuse' && <PromptModal title="Refuser la demande" label="Motif du refus (obligatoire)" onClose={() => setModal(null)} confirmLabel="Refuser" onSubmit={async (t) => { await api.post(`/bookings/${b.id}/refuse`, { reason: t }); await reload(); }} />}
      {modal === 'dispute' && <DisputeModal b={b} onClose={() => setModal(null)} reload={reload} />}
      {modal === 'review' && (
        <Modal title="Évaluer l'autre participant" onClose={() => setModal(null)}>
          <div className="form">
            <Stars value={review.rating} onChange={(n) => setReview({ ...review, rating: n })} />
            <div><label>Commentaire</label><textarea value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} /></div>
            <div className="row"><button className="btn" disabled={busy} onClick={() => run(async () => { await api.post(`/bookings/${b.id}/review`, review); setModal(null); await reload(); }, 'Évaluation publiée.')}>Publier</button>
              <button className="btn ghost" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DisputeModal({ b, onClose, reload }) {
  const [kind, setKind] = useState('absence');
  return (
    <PromptModal title="Signaler un problème" label="Décrivez la situation" confirmLabel="Ouvrir le signalement" onClose={onClose}
      onSubmit={async (t) => { await api.post(`/bookings/${b.id}/dispute`, { kind, description: t }); await reload(); }}>
      <div><label>Type</label><select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="absence">Absence</option><option value="désaccord">Désaccord</option><option value="confirmation_manquante">Confirmation manquante</option></select></div>
      <p className="small muted">Les crédits restent bloqués jusqu'à la décision de l'administrateur.</p>
    </PromptModal>
  );
}

export default function Requests() {
  const [tab, setTab] = useState('received');
  const { data, error, reload } = useLoad(() => api.get(`/bookings?box=${tab}`), [tab]);
  return (
    <>
      <div className="page-head"><div><h1>Demandes</h1><p className="muted">Suivez vos demandes envoyées et reçues.</p></div></div>
      <div className="tabs">
        <button className={tab === 'received' ? 'on' : ''} onClick={() => setTab('received')}>Reçues (je suis intervenant)</button>
        <button className={tab === 'sent' ? 'on' : ''} onClick={() => setTab('sent')}>Envoyées (je suis bénéficiaire)</button>
      </div>
      <ErrorBox msg={error} />
      {data?.length === 0 && <p className="muted">Aucune demande.</p>}
      {data?.map((b) => <BookingCard key={b.id} b={b} reload={reload} />)}
    </>
  );
}
