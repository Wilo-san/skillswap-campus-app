import { api } from '../api.js';
import { useLoad, ErrorBox } from '../ui.jsx';
import { BookingCard } from './Requests.jsx';

export default function Planning() {
  const { data, error, reload } = useLoad(() => api.get('/planning'));
  return (
    <>
      <div className="page-head"><div><h1>Mon planning</h1><p className="muted">Vos séances acceptées, avec lieu ou lien privé.</p></div></div>
      <ErrorBox msg={error} />
      {data?.length === 0 && <p className="muted">Aucune séance acceptée pour le moment.</p>}
      {data?.map((b) => <BookingCard key={b.id} b={b} reload={reload} />)}
    </>
  );
}
