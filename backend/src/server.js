import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import * as S from './services.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (e) {
    if (e instanceof S.AppError) return res.status(e.status).json({ error: e.message });
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Opération en doublon refusée.' });
    console.error(e);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
const bad = (m, s = 400) => { throw new S.AppError(m, s); };

function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
    if (u && u.active) req.user = u;
  } catch { /* token invalide */ }
  next();
}
app.use(auth);
const need = (req) => req.user || bad('Veuillez vous connecter.', 401);
const needAdmin = (req) => { const u = need(req); if (u.role !== 'admin') bad('Accès réservé à l’administrateur.', 403); return u; };

const pub = (u) => ({
  id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, field: u.field,
  offered_skills: u.offered_skills, wanted_skills: u.wanted_skills, role: u.role, active: !!u.active,
  balance: u.balance, blocked: u.blocked, created_at: u.created_at,
});
const avgOf = (id) => db.prepare('SELECT ROUND(AVG(rating),2) avg, COUNT(*) n FROM reviews WHERE target_id=?').get(id);

// ---------- AUTH ----------
app.post('/api/auth/register', wrap((req, res) => {
  const { email, password, first_name, last_name, field } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) bad('Adresse e-mail invalide.');
  if (!password || password.length < 8) bad('Le mot de passe doit contenir au moins 8 caractères.');
  if (!first_name?.trim() || !last_name?.trim()) bad('Nom et prénom obligatoires.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) bad('Cette adresse e-mail est déjà utilisée.', 409);
  const id = S.tx(() => {
    const info = db.prepare('INSERT INTO users(email,password_hash,first_name,last_name,field,balance) VALUES (?,?,?,?,?,2)')
      .run(email.trim().toLowerCase(), bcrypt.hashSync(password, 10), first_name.trim(), last_name.trim(), (field || '').trim());
    db.prepare("INSERT INTO credit_movements(user_id,type,amount,note) VALUES (?,'bienvenue',2,'Crédits de bienvenue')").run(info.lastInsertRowid);
    return info.lastInsertRowid;
  })();
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  res.status(201).json({ token: jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' }), user: pub(u) });
}));

app.post('/api/auth/login', wrap((req) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').trim());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) bad('Identifiants incorrects.', 401);
  if (!u.active) bad('Ce compte est désactivé.', 403);
  return { token: jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' }), user: pub(u) };
}));

app.get('/api/me', wrap((req) => ({ ...pub(need(req)), rating: avgOf(req.user.id) })));

app.put('/api/me', wrap((req) => {
  const u = need(req);
  const { first_name, last_name, field, offered_skills, wanted_skills } = req.body;
  if (!first_name?.trim() || !last_name?.trim()) bad('Nom et prénom obligatoires.');
  db.prepare('UPDATE users SET first_name=?,last_name=?,field=?,offered_skills=?,wanted_skills=? WHERE id=?')
    .run(first_name.trim(), last_name.trim(), (field || '').trim(), (offered_skills || '').trim(), (wanted_skills || '').trim(), u.id);
  return pub(db.prepare('SELECT * FROM users WHERE id=?').get(u.id));
}));

app.get('/api/users/:id', wrap((req) => {
  need(req);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) bad('Profil introuvable.', 404);
  const reviews = db.prepare(`SELECT r.rating,r.comment,r.created_at,a.first_name,a.last_name FROM reviews r
    JOIN users a ON a.id=r.author_id WHERE r.target_id=? ORDER BY r.created_at DESC`).all(u.id);
  return {
    id: u.id, first_name: u.first_name, last_name: u.last_name, field: u.field,
    offered_skills: u.offered_skills, wanted_skills: u.wanted_skills, rating: avgOf(u.id), reviews,
  };
}));

// ---------- CATEGORIES ----------
app.get('/api/categories', wrap(() => db.prepare('SELECT * FROM categories ORDER BY name').all()));
app.post('/api/categories', wrap((req) => {
  needAdmin(req);
  const name = (req.body.name || '').trim();
  if (!name) bad('Nom de catégorie obligatoire.');
  if (db.prepare('SELECT 1 FROM categories WHERE name=?').get(name)) bad('Cette catégorie existe déjà.', 409);
  return { id: db.prepare('INSERT INTO categories(name) VALUES (?)').run(name).lastInsertRowid, name };
}));
app.put('/api/categories/:id', wrap((req) => {
  needAdmin(req);
  const name = (req.body.name || '').trim();
  if (!name) bad('Nom de catégorie obligatoire.');
  db.prepare('UPDATE categories SET name=? WHERE id=?').run(name, req.params.id);
  return { ok: true };
}));
app.delete('/api/categories/:id', wrap((req) => {
  needAdmin(req);
  if (db.prepare('SELECT 1 FROM offers WHERE category_id=?').get(req.params.id)) bad('Catégorie utilisée par des offres : suppression impossible.');
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  return { ok: true };
}));

// ---------- OFFERS ----------
const nowIso = () => new Date().toISOString();
function offerView(o, viewer) {
  const slots = db.prepare('SELECT * FROM slots WHERE offer_id=? ORDER BY start_at').all(o.id).map((s) => {
    const taken = !!db.prepare("SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('acceptée','en_litige','réalisée')").get(s.id);
    const mine = viewer && db.prepare(
      "SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('acceptée','en_litige','réalisée') AND (provider_id=? OR beneficiary_id=?)"
    ).get(s.id, viewer.id, viewer.id);
    const canSee = viewer && (viewer.id === o.owner_id || mine || viewer.role === 'admin'); // RG19
    return { id: s.id, start_at: s.start_at, end_at: s.end_at, taken, location: canSee ? s.location : undefined };
  });
  const owner = db.prepare('SELECT id,first_name,last_name,field FROM users WHERE id=?').get(o.owner_id);
  const cat = db.prepare('SELECT name FROM categories WHERE id=?').get(o.category_id);
  return { ...o, category: cat?.name, owner: { ...owner, rating: avgOf(o.owner_id) }, slots };
}

function validateOffer(b) {
  const { title, category_id, skill, description, level, duration, mode } = b;
  if (!title?.trim() || !skill?.trim() || !description?.trim()) bad('Titre, compétence et description sont obligatoires.');
  if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(category_id)) bad('Catégorie invalide.');
  if (!['Débutant', 'Intermédiaire', 'Avancé'].includes(level)) bad('Niveau invalide.');
  if (![1, 2].includes(Number(duration))) bad('La durée doit être de 1 ou 2 heures.');
  if (!['Présentiel', 'À distance'].includes(mode)) bad('Mode de déroulement invalide.');
}

app.get('/api/offers', wrap((req) => {
  const u = need(req);
  const { q, category_id, level, mode, date, suggestions } = req.query;
  let rows = db.prepare(`SELECT o.* FROM offers o JOIN users w ON w.id=o.owner_id
    WHERE o.status='publiée' AND o.hidden=0 AND w.active=1 AND o.owner_id != ?
    AND EXISTS (SELECT 1 FROM slots s WHERE s.offer_id=o.id AND s.start_at > ?
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status IN ('acceptée','en_litige','réalisée')))`)
    .all(u.id, nowIso());
  if (category_id) rows = rows.filter((o) => String(o.category_id) === String(category_id));
  if (level) rows = rows.filter((o) => o.level === level);
  if (mode) rows = rows.filter((o) => o.mode === mode);
  if (q) { const n = q.toLowerCase(); rows = rows.filter((o) => (o.skill + ' ' + o.title + ' ' + o.description).toLowerCase().includes(n)); }
  let views = rows.map((o) => offerView(o, u));
  views.forEach((v) => { v.slots = v.slots.filter((s) => !s.taken && s.start_at > nowIso()); });
  if (date) views = views.filter((v) => v.slots.some((s) => s.start_at.slice(0, 10) === date));
  if (suggestions === '1') {
    const wanted = (u.wanted_skills || '').toLowerCase().split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    views = views.filter((v) => wanted.some((w) =>
      v.skill.toLowerCase().includes(w) || w.includes(v.skill.toLowerCase()) || v.category.toLowerCase() === w || v.title.toLowerCase().includes(w)));
  }
  return views;
}));

app.get('/api/offers/mine', wrap((req) => {
  const u = need(req);
  return db.prepare('SELECT * FROM offers WHERE owner_id=? ORDER BY created_at DESC').all(u.id).map((o) => offerView(o, u));
}));

app.get('/api/offers/:id', wrap((req) => {
  const u = need(req);
  const o = db.prepare('SELECT * FROM offers WHERE id=?').get(req.params.id);
  if (!o) bad('Offre introuvable.', 404);
  if (o.owner_id !== u.id && u.role !== 'admin' && (o.status !== 'publiée' || o.hidden)) bad('Offre introuvable.', 404);
  return offerView(o, u);
}));

app.post('/api/offers', wrap((req, res) => {
  const u = need(req);
  validateOffer(req.body);
  const b = req.body;
  const info = db.prepare('INSERT INTO offers(owner_id,category_id,title,skill,description,level,duration,mode) VALUES (?,?,?,?,?,?,?,?)')
    .run(u.id, b.category_id, b.title.trim(), b.skill.trim(), b.description.trim(), b.level, Number(b.duration), b.mode);
  res.status(201).json({ id: info.lastInsertRowid });
}));

app.put('/api/offers/:id', wrap((req) => {
  const u = need(req);
  const o = db.prepare('SELECT * FROM offers WHERE id=?').get(req.params.id);
  if (!o || o.owner_id !== u.id) bad('Offre introuvable.', 404);
  validateOffer(req.body);
  const b = req.body;
  // RG17 : durée non modifiable si une séance acceptée existe
  if (Number(b.duration) !== o.duration &&
    db.prepare("SELECT 1 FROM bookings WHERE offer_id=? AND status IN ('acceptée','en_litige')").get(o.id))
    bad('La durée ne peut plus être modifiée : une séance est déjà acceptée.');
  db.prepare('UPDATE offers SET category_id=?,title=?,skill=?,description=?,level=?,duration=?,mode=? WHERE id=?')
    .run(b.category_id, b.title.trim(), b.skill.trim(), b.description.trim(), b.level, Number(b.duration), b.mode, o.id);
  return { ok: true };
}));

app.post('/api/offers/:id/status', wrap((req) => {
  const u = need(req);
  const o = db.prepare('SELECT * FROM offers WHERE id=?').get(req.params.id);
  if (!o || o.owner_id !== u.id) bad('Offre introuvable.', 404);
  const { status } = req.body;
  if (!['brouillon', 'publiée', 'archivée'].includes(status)) bad('État invalide.');
  if (status === 'publiée') {
    if (o.hidden) bad('Cette offre a été masquée par un administrateur.');
    if (!db.prepare('SELECT 1 FROM slots WHERE offer_id=? AND start_at>?').get(o.id, nowIso())) bad('Ajoutez au moins un créneau futur avant de publier.');
  }
  S.tx(() => {
    db.prepare('UPDATE offers SET status=? WHERE id=?').run(status, o.id);
    if (status !== 'publiée') S.cancelPendingForOffer(o.id, "l'offre n'est plus publiée.");
  })();
  return { ok: true };
}));

app.post('/api/offers/:id/slots', wrap((req, res) => {
  const u = need(req);
  const o = db.prepare('SELECT * FROM offers WHERE id=?').get(req.params.id);
  if (!o || o.owner_id !== u.id) bad('Offre introuvable.', 404);
  const { start_at, location } = req.body;
  const start = new Date(start_at);
  if (isNaN(start)) bad('Date de début invalide.');
  if (start.getTime() <= Date.now()) bad('Le créneau doit être dans le futur.');
  const end = new Date(start.getTime() + o.duration * 3600 * 1000);
  const sI = start.toISOString(), eI = end.toISOString();
  if (!location?.trim()) bad(o.mode === 'À distance' ? 'Le lien de réunion est obligatoire.' : 'Le lieu est obligatoire.');
  const clash = db.prepare('SELECT s.start_at,s.end_at FROM slots s JOIN offers x ON x.id=s.offer_id WHERE x.owner_id=?').all(u.id)
    .some((s) => sI < s.end_at && s.start_at < eI);
  if (clash) bad('Ce créneau chevauche un de vos autres créneaux.');
  const info = db.prepare('INSERT INTO slots(offer_id,start_at,end_at,location) VALUES (?,?,?,?)').run(o.id, sI, eI, location.trim());
  res.status(201).json({ id: info.lastInsertRowid });
}));

app.delete('/api/slots/:id', wrap((req) => {
  const u = need(req);
  const s = db.prepare('SELECT s.*,o.owner_id FROM slots s JOIN offers o ON o.id=s.offer_id WHERE s.id=?').get(req.params.id);
  if (!s || s.owner_id !== u.id) bad('Créneau introuvable.', 404);
  if (db.prepare("SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('en_attente','acceptée','en_litige','réalisée')").get(s.id))
    bad('Ce créneau a des demandes ou une réservation : suppression impossible.');
  db.prepare('DELETE FROM slots WHERE id=?').run(s.id);
  return { ok: true };
}));

// ---------- BOOKINGS ----------
function bookingView(b, viewer) {
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(b.slot_id);
  const offer = db.prepare('SELECT id,title,skill,duration,mode FROM offers WHERE id=?').get(b.offer_id);
  const p = db.prepare('SELECT id,first_name,last_name FROM users WHERE id=?').get(b.provider_id);
  const ben = db.prepare('SELECT id,first_name,last_name FROM users WHERE id=?').get(b.beneficiary_id);
  const participant = viewer.id === b.provider_id || viewer.id === b.beneficiary_id;
  const showLoc = participant && ['acceptée', 'réalisée', 'en_litige'].includes(b.status);
  const reviewed = !!db.prepare('SELECT 1 FROM reviews WHERE booking_id=? AND author_id=?').get(b.id, viewer.id);
  const dispute = db.prepare('SELECT id,status FROM disputes WHERE booking_id=? ORDER BY id DESC').get(b.id);
  return {
    ...b, offer, provider: p, beneficiary: ben,
    start_at: slot.start_at, end_at: slot.end_at, location: showLoc ? slot.location : undefined,
    role: viewer.id === b.provider_id ? 'intervenant' : 'bénéficiaire',
    my_confirmed: !!(viewer.id === b.provider_id ? b.provider_confirmed : b.beneficiary_confirmed),
    reviewed, dispute,
  };
}

app.post('/api/bookings', wrap((req, res) => {
  const u = need(req);
  const id = S.requestBooking(u.id, Number(req.body.slot_id));
  res.status(201).json({ id });
}));
app.get('/api/bookings', wrap((req) => {
  const u = need(req);
  const { box } = req.query; // sent | received | all
  const col = box === 'received' ? 'provider_id' : box === 'sent' ? 'beneficiary_id' : null;
  const rows = col
    ? db.prepare(`SELECT * FROM bookings WHERE ${col}=? ORDER BY created_at DESC`).all(u.id)
    : db.prepare('SELECT * FROM bookings WHERE provider_id=? OR beneficiary_id=? ORDER BY created_at DESC').all(u.id, u.id);
  return rows.map((b) => bookingView(b, u));
}));
app.get('/api/planning', wrap((req) => {
  const u = need(req);
  return db.prepare("SELECT b.* FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status IN ('acceptée','en_litige') AND (b.provider_id=? OR b.beneficiary_id=?) ORDER BY s.start_at")
    .all(u.id, u.id).map((b) => bookingView(b, u));
}));
app.post('/api/bookings/:id/accept', wrap((req) => { S.acceptBooking(need(req).id, Number(req.params.id)); return { ok: true }; }));
app.post('/api/bookings/:id/refuse', wrap((req) => { S.refuseBooking(need(req).id, Number(req.params.id), req.body.reason); return { ok: true }; }));
app.post('/api/bookings/:id/withdraw', wrap((req) => { S.withdrawBooking(need(req).id, Number(req.params.id)); return { ok: true }; }));
app.post('/api/bookings/:id/cancel', wrap((req) => { S.cancelBooking(need(req).id, Number(req.params.id)); return { ok: true }; }));
app.post('/api/bookings/:id/confirm', wrap((req) => ({ result: S.confirmBooking(need(req).id, Number(req.params.id)) })));
app.post('/api/bookings/:id/review', wrap((req) => { S.submitReview(need(req).id, Number(req.params.id), req.body.rating, req.body.comment); return { ok: true }; }));
app.post('/api/bookings/:id/dispute', wrap((req, res) => {
  const id = S.openDispute(need(req).id, Number(req.params.id), req.body.kind, req.body.description);
  res.status(201).json({ id });
}));

// ---------- WALLET / NOTIFS ----------
app.get('/api/wallet', wrap((req) => {
  const u = need(req);
  const movements = db.prepare(`SELECT m.*, o.title offer_title FROM credit_movements m
    LEFT JOIN bookings b ON b.id=m.booking_id LEFT JOIN offers o ON o.id=b.offer_id
    WHERE m.user_id=? ORDER BY m.id DESC`).all(u.id);
  return { balance: u.balance, blocked: u.blocked, movements };
}));
app.get('/api/notifications', wrap((req) => db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(need(req).id)));
app.post('/api/notifications/read', wrap((req) => { db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(need(req).id); return { ok: true }; }));

// ---------- DISPUTES ----------
function canSeeDispute(u, d) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(d.booking_id);
  return u.role === 'admin' || b.provider_id === u.id || b.beneficiary_id === u.id;
}
function disputeView(d) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(d.booking_id);
  const offer = db.prepare('SELECT title FROM offers WHERE id=?').get(b.offer_id);
  const slot = db.prepare('SELECT start_at,end_at FROM slots WHERE id=?').get(b.slot_id);
  const p = db.prepare('SELECT id,first_name,last_name FROM users WHERE id=?').get(b.provider_id);
  const ben = db.prepare('SELECT id,first_name,last_name FROM users WHERE id=?').get(b.beneficiary_id);
  const messages = db.prepare(`SELECT m.*,u.first_name,u.last_name FROM dispute_messages m JOIN users u ON u.id=m.user_id WHERE dispute_id=? ORDER BY m.id`).all(d.id);
  return { ...d, offer_title: offer.title, cost: b.cost, provider: p, beneficiary: ben, provider_confirmed: !!b.provider_confirmed, beneficiary_confirmed: !!b.beneficiary_confirmed, ...slot, messages };
}
app.get('/api/disputes', wrap((req) => {
  const u = need(req);
  const rows = u.role === 'admin'
    ? db.prepare('SELECT * FROM disputes ORDER BY status, id DESC').all()
    : db.prepare('SELECT d.* FROM disputes d JOIN bookings b ON b.id=d.booking_id WHERE b.provider_id=? OR b.beneficiary_id=? ORDER BY d.id DESC').all(u.id, u.id);
  return rows.map(disputeView);
}));
app.get('/api/disputes/:id', wrap((req) => {
  const u = need(req);
  const d = db.prepare('SELECT * FROM disputes WHERE id=?').get(req.params.id);
  if (!d || !canSeeDispute(u, d)) bad('Litige introuvable.', 404); // RG19
  return disputeView(d);
}));
app.post('/api/disputes/:id/messages', wrap((req) => {
  const u = need(req);
  const d = db.prepare('SELECT * FROM disputes WHERE id=?').get(req.params.id);
  if (!d || !canSeeDispute(u, d)) bad('Litige introuvable.', 404);
  if (d.status !== 'ouvert') bad('Ce litige est clos.');
  const m = (req.body.message || '').trim();
  if (m.length < 2) bad('Message trop court.');
  db.prepare('INSERT INTO dispute_messages(dispute_id,user_id,message) VALUES (?,?,?)').run(d.id, u.id, m);
  return { ok: true };
}));

// ---------- ADMIN ----------
app.get('/api/admin/stats', wrap((req) => {
  needAdmin(req);
  const c = (sql) => db.prepare(sql).get().n;
  return {
    active_accounts: c("SELECT COUNT(*) n FROM users WHERE active=1 AND role='student'"),
    published_offers: c("SELECT COUNT(*) n FROM offers WHERE status='publiée' AND hidden=0"),
    accepted_sessions: c("SELECT COUNT(*) n FROM bookings WHERE status IN ('acceptée','en_litige')"),
    completed_sessions: c("SELECT COUNT(*) n FROM bookings WHERE status='réalisée'"),
    credits_transferred: c("SELECT COALESCE(SUM(amount),0) n FROM credit_movements WHERE type='transfert_entrant'"),
    open_disputes: c("SELECT COUNT(*) n FROM disputes WHERE status='ouvert'"),
  };
}));
app.get('/api/admin/users', wrap((req) => { needAdmin(req); return db.prepare('SELECT * FROM users ORDER BY id').all().map(pub); }));
app.post('/api/admin/users/:id/active', wrap((req) => { needAdmin(req); S.setUserActive(Number(req.params.id), !!req.body.active); return { ok: true }; }));
app.get('/api/admin/offers', wrap((req) => {
  needAdmin(req);
  return db.prepare("SELECT * FROM offers WHERE status != 'brouillon' ORDER BY id DESC").all().map((o) => offerView(o, req.user));
}));
app.post('/api/admin/offers/:id/hide', wrap((req) => {
  needAdmin(req);
  const hide = !!req.body.hidden;
  const o = db.prepare('SELECT * FROM offers WHERE id=?').get(req.params.id);
  if (!o) bad('Offre introuvable.', 404);
  S.tx(() => {
    db.prepare('UPDATE offers SET hidden=? WHERE id=?').run(hide ? 1 : 0, o.id);
    if (hide) { S.cancelPendingForOffer(o.id, 'offre masquée par la modération.'); S.notify(o.owner_id, `Votre offre « ${o.title} » a été masquée par la modération.`); }
  })();
  return { ok: true };
}));
app.get('/api/admin/bookings', wrap((req) => {
  needAdmin(req);
  return db.prepare("SELECT * FROM bookings WHERE status IN ('acceptée','en_litige') ORDER BY id DESC").all().map((b) => bookingView(b, req.user));
}));
app.post('/api/admin/bookings/:id/cancel', wrap((req) => { needAdmin(req); S.adminCancelBooking(Number(req.params.id)); return { ok: true }; }));
app.post('/api/admin/disputes/:id/resolve', wrap((req) => {
  const a = needAdmin(req);
  S.resolveDispute(a.id, Number(req.params.id), req.body.decision, req.body.reason);
  return { ok: true };
}));

app.get('/api/health', (_q, r) => r.json({ ok: true }));

if (process.env.NODE_ENV !== 'test') app.listen(PORT, () => console.log(`SkillSwap API sur http://localhost:${PORT}`));
export default app;
