import { useEffect } from 'react';
import { api, fmtDate } from '../api.js';
import { useLoad } from '../ui.jsx';

export default function Notifications() {
  const { data, reload } = useLoad(() => api.get('/notifications'));
  useEffect(() => { if (data?.some((n) => !n.read)) { const t = setTimeout(() => api.post('/notifications/read').then(reload), 1500); return () => clearTimeout(t); } }, [data]); // eslint-disable-line
  return (
    <>
      <div className="page-head"><div><h1>Notifications</h1></div></div>
      {data?.length === 0 && <p className="muted">Aucune notification.</p>}
      {data?.map((n) => (
        <div key={n.id} className={`card notif ${n.read ? '' : 'unread'}`}>{n.message}<div className="small muted">{fmtDate(n.created_at + 'Z')}</div></div>
      ))}
    </>
  );
}
