import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth.jsx';

export const STATUS_BADGE = {
  en_attente: ['orange', 'En attente'], acceptée: ['green', 'Acceptée'], refusée: ['red', 'Refusée'],
  annulée: ['gray', 'Annulée'], réalisée: ['green', 'Réalisée'], en_litige: ['red', 'En litige'],
  brouillon: ['gray', 'Brouillon'], publiée: ['green', 'Publiée'], archivée: ['gray', 'Archivée'],
  ouvert: ['red', 'Ouvert'], résolu: ['green', 'Résolu'],
};
export const Badge = ({ s }) => {
  const [c, l] = STATUS_BADGE[s] || ['', s];
  return <span className={`badge ${c}`}>{l}</span>;
};

// Charge des données et expose reload()
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => fn().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

// Empêche les doubles clics : un seul envoi à la fois
export function useAction() {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    try { const r = await fn(); if (okMsg) notify(okMsg); return r; }
    catch (e) { notify(e.message, 'err'); }
    finally { setBusy(false); }
  };
  return { busy, run };
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Boîte de saisie d'un texte (motif, description...)
export function PromptModal({ title, label, placeholder, confirmLabel = 'Valider', onSubmit, onClose, children }) {
  const [text, setText] = useState('');
  const { busy, run } = useAction();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="form">
        {children}
        <div><label>{label}</label><textarea value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} /></div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={() => run(async () => { await onSubmit(text); onClose(); })}>{confirmLabel}</button>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}

export const Stars = ({ value, onChange }) => (
  <span className="stars">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" className={n <= value ? 'on' : ''} onClick={() => onChange && onChange(n)} style={{ cursor: onChange ? 'pointer' : 'default' }}>★</button>
    ))}
  </span>
);
export const Rating = ({ r }) => (r && r.n ? <span className="small">⭐ {r.avg} ({r.n})</span> : <span className="small muted">Pas encore noté</span>);
export const ErrorBox = ({ msg }) => (msg ? <div className="alert">{msg}</div> : null);
