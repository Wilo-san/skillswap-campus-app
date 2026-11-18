import { useState } from 'react';
import { api } from '../../api.js';
import { useLoad, useAction, ErrorBox } from '../../ui.jsx';

export default function Categories() {
  const { data, error, reload } = useLoad(() => api.get('/categories'));
  const [name, setName] = useState('');
  const { busy, run } = useAction();
  return (
    <>
      <div className="page-head"><div><h1>Catégories de compétences</h1></div></div>
      <ErrorBox msg={error} />
      <form className="card row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/categories', { name }); setName(''); await reload(); }, 'Catégorie ajoutée.'); }}>
        <input style={{ flex: 1 }} placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn" disabled={busy}>Ajouter</button>
      </form>
      <table>
        <thead><tr><th>Catégorie</th><th></th></tr></thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td className="row">
              <button className="btn sm ghost" disabled={busy} onClick={() => { const n = prompt('Nouveau nom', c.name); if (n) run(async () => { await api.put(`/categories/${c.id}`, { name: n }); await reload(); }, 'Catégorie renommée.'); }}>Renommer</button>
              <button className="btn sm danger" disabled={busy} onClick={() => confirm('Supprimer cette catégorie ?') && run(async () => { await api.del(`/categories/${c.id}`); await reload(); }, 'Catégorie supprimée.')}>Supprimer</button></td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
