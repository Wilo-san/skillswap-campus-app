import { NavLink, Navigate, Route, Routes, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Catalog from './pages/Catalog.jsx';
import OfferDetail from './pages/OfferDetail.jsx';
import MyOffers from './pages/MyOffers.jsx';
import OfferForm from './pages/OfferForm.jsx';
import Requests from './pages/Requests.jsx';
import Planning from './pages/Planning.jsx';
import Wallet from './pages/Wallet.jsx';
import Profile from './pages/Profile.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import Notifications from './pages/Notifications.jsx';
import Disputes from './pages/Disputes.jsx';
import DisputeDetail from './pages/DisputeDetail.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminCategories from './pages/admin/Categories.jsx';
import AdminOffers from './pages/admin/Offers.jsx';
import AdminDisputes from './pages/admin/Disputes.jsx';
import AdminDisputeDetail from './pages/AdminDisputeDetail.jsx';

function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/notifications').then((n) => alive && setUnread(n.filter((x) => !x.read).length)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const admin = user.role === 'admin';
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand" onClick={() => nav('/')}>🔄 SkillSwap <span>Campus</span></div>
        <nav>
          {admin ? (
            <>
              <NavLink to="/admin">Tableau de bord</NavLink>
              <NavLink to="/admin/users">Comptes</NavLink>
              <NavLink to="/admin/categories">Catégories</NavLink>
              <NavLink to="/admin/offers">Modération</NavLink>
              <NavLink to="/admin/disputes">Litiges</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end>Catalogue</NavLink>
              <NavLink to="/my-offers">Mes offres</NavLink>
              <NavLink to="/requests">Demandes</NavLink>
              <NavLink to="/planning">Planning</NavLink>
              <NavLink to="/wallet">Crédits</NavLink>
              <NavLink to="/disputes">Signalements</NavLink>
            </>
          )}
        </nav>
        <div className="userbox">
          <NavLink to="/notifications" className="bell" title="Notifications">🔔{unread > 0 && <b>{unread}</b>}</NavLink>
          {!admin && <NavLink to="/profile" className="chip">{user.first_name} · {user.balance} cr.</NavLink>}
          {admin && <span className="chip">Admin</span>}
          <button className="btn ghost" onClick={() => { logout(); nav('/login'); }}>Déconnexion</button>
        </div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  );
}

function Protected({ admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Layout />;
}

function Home() {
  const { user } = useAuth();
  return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Catalog />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Home />} />
        <Route path="/offers/:id" element={<OfferDetail />} />
        <Route path="/my-offers" element={<MyOffers />} />
        <Route path="/my-offers/new" element={<OfferForm />} />
        <Route path="/my-offers/:id" element={<OfferForm />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users/:id" element={<PublicProfile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/disputes" element={<Disputes />} />
        <Route path="/disputes/:id" element={<DisputeDetail />} />
      </Route>
      <Route element={<Protected admin />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/categories" element={<AdminCategories />} />
        <Route path="/admin/offers" element={<AdminOffers />} />
        <Route path="/admin/disputes" element={<AdminDisputes />} />
        <Route path="/admin/disputes/:id" element={<AdminDisputeDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
