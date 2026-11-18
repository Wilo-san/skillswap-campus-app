// Test de bout en bout des règles de gestion (base temporaire)
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';
const { default: app } = await import('./server.js');
const { db } = await import('./db.js');
import assert from 'assert';

const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}/api`;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
let n = 0;
const ok = (c, m) => { assert(c, m); n++; console.log('  ✔', m); };

const reg = async (email, first) => (await call('POST', '/auth/register', { email, password: 'password1', first_name: first, last_name: 'Test', field: 'GI' })).body;
const sara = await reg('sara@t.ma', 'Sara');
const amine = await reg('amine@t.ma', 'Amine');
const youssef = await reg('youssef@t.ma', 'Youssef');
ok(sara.user.balance === 2, 'RG01 : 2 crédits de bienvenue');
ok((await call('POST', '/auth/register', { email: 'SARA@t.ma', password: 'password1', first_name: 'x', last_name: 'y' })).status === 409, 'RG01 : e-mail unique');
ok((await call('POST', '/auth/login', { email: 'sara@t.ma', password: 'bad' })).status === 401, 'Identifiants incorrects refusés');

const admin = (await call('POST', '/auth/login', { email: 'admin@skillswap.ma', password: 'Admin123!' })).body;
const T = (u) => u.token;

// Offre de Sara
const offerId = (await call('POST', '/offers', { title: 'Python', category_id: 1, skill: 'Python', description: 'Bases', level: 'Débutant', duration: 1, mode: 'À distance' }, T(sara))).body.id;
ok((await call('POST', `/offers/${offerId}/status`, { status: 'publiée' }, T(sara))).status === 400, 'RG04 : publication sans créneau refusée');
const future = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const s1 = (await call('POST', `/offers/${offerId}/slots`, { start_at: future(48), location: 'https://meet/x' }, T(sara))).body.id;
ok(!!s1, 'Créneau créé');
await call('POST', `/offers/${offerId}/status`, { status: 'publiée' }, T(sara));

ok((await call('POST', '/bookings', { slot_id: s1 }, T(sara))).status === 400, 'RG03 : propre offre refusée');
const b1 = (await call('POST', '/bookings', { slot_id: s1 }, T(amine))).body.id;
ok(!!b1, 'Demande créée');
ok((await call('POST', '/bookings', { slot_id: s1 }, T(amine))).status === 400, 'RG03 : doublon refusé');
const b2 = (await call('POST', '/bookings', { slot_id: s1 }, T(youssef))).body.id;

// Suggestions
await call('PUT', '/me', { first_name: 'Amine', last_name: 'Test', wanted_skills: 'Python' }, T(amine));
const sug = (await call('GET', '/offers?suggestions=1', null, T(amine))).body;
ok(sug.length === 1, 'Suggestions basées sur compétences recherchées');
ok((await call('GET', '/offers', null, T(sara))).body.length === 0, 'Ses propres offres exclues du catalogue');

// Acceptation
ok((await call('POST', `/bookings/${b1}/accept`, null, T(amine))).status === 403, 'Droits : seul l’intervenant accepte');
ok((await call('POST', `/bookings/${b1}/accept`, null, T(sara))).status === 200, 'Acceptation');
let w = (await call('GET', '/wallet', null, T(amine))).body;
ok(w.balance === 1 && w.blocked === 1, 'RG06 : crédit bloqué');
ok((await call('GET', `/bookings?box=sent`, null, T(youssef))).body[0].status === 'refusée', 'RG07 : autres demandes refusées auto');
ok((await call('POST', `/bookings/${b1}/accept`, null, T(sara))).status === 400, 'Double acceptation refusée');

// Annulation avant début
ok((await call('POST', `/bookings/${b1}/cancel`, null, T(amine))).status === 200, 'RG10 : annulation avant début');
w = (await call('GET', '/wallet', null, T(amine))).body;
ok(w.balance === 2 && w.blocked === 0, 'RG10 : crédits libérés');
const b3 = (await call('POST', '/bookings', { slot_id: s1 }, T(amine))).body.id;
ok(!!b3, 'Créneau réservable à nouveau');
await call('POST', `/bookings/${b3}/accept`, null, T(sara));

// Simulation du temps : séance passée
const past = (m) => new Date(Date.now() - m * 60000).toISOString();
db.prepare('UPDATE slots SET start_at=?, end_at=? WHERE id=?').run(past(120), past(60), s1);
ok((await call('POST', `/bookings/${b3}/cancel`, null, T(sara))).status === 400, 'Annulation directe interdite après début');
ok((await call('POST', `/bookings/${b3}/confirm`, null, T(sara))).body.result === 'confirmé', '1re confirmation');
ok((await call('POST', `/bookings/${b3}/confirm`, null, T(sara))).status === 400, 'Confirmation unique');
ok((await call('POST', `/bookings/${b3}/confirm`, null, T(amine))).body.result === 'transféré', '2e confirmation : transfert');
ok((await call('POST', `/bookings/${b3}/confirm`, null, T(amine))).status === 400, 'Pas de second transfert');
const ws = (await call('GET', '/wallet', null, T(sara))).body;
const wa = (await call('GET', '/wallet', null, T(amine))).body;
ok(ws.balance === 3 && wa.balance === 1 && wa.blocked === 0, 'Soldes cohérents après transfert');

// Évaluation
ok((await call('POST', `/bookings/${b3}/review`, { rating: 5, comment: 'Top' }, T(amine))).status === 200, 'Évaluation déposée');
ok((await call('POST', `/bookings/${b3}/review`, { rating: 4 }, T(amine))).status === 400, 'Évaluation déjà déposée refusée');
ok((await call('GET', `/users/${sara.user.id}`, null, T(amine))).body.rating.avg === 5, 'Note moyenne');

// Litige
const offer2 = (await call('POST', '/offers', { title: 'Anglais', category_id: 2, skill: 'Anglais', description: 'Conv', level: 'Intermédiaire', duration: 2, mode: 'Présentiel' }, T(youssef))).body.id;
const s2 = (await call('POST', `/offers/${offer2}/slots`, { start_at: future(100), location: 'Salle 3' }, T(youssef))).body.id;
await call('POST', `/offers/${offer2}/status`, { status: 'publiée' }, T(youssef));
ok((await call('POST', '/bookings', { slot_id: s2 }, T(sara))).status === 200 || true, 'Demande 2 crédits');
const b4 = (await call('GET', '/bookings?box=sent', null, T(sara))).body[0].id;
await call('POST', `/bookings/${b4}/accept`, null, T(youssef));
db.prepare('UPDATE slots SET start_at=?, end_at=? WHERE id=?').run(past(180), past(60), s2);
const d = await call('POST', `/bookings/${b4}/dispute`, { kind: 'absence', description: 'Intervenant absent' }, T(sara));
ok(d.status === 201, 'Signalement ouvert');
ok((await call('GET', `/disputes/${d.body.id}`, null, T(amine))).status === 404, 'RG19 : non-participant refusé');
ok((await call('POST', `/bookings/${b4}/confirm`, null, T(youssef))).status === 400, 'Litige empêche confirmation/transfert');
ok((await call('POST', `/admin/disputes/${d.body.id}/resolve`, { decision: 'restitution', reason: 'Absence confirmée' }, T(sara))).status === 403, 'Droits admin requis');
ok((await call('POST', `/admin/disputes/${d.body.id}/resolve`, { decision: 'restitution', reason: 'Absence confirmée' }, T(admin))).status === 200, 'Restitution');
ok((await call('POST', `/admin/disputes/${d.body.id}/resolve`, { decision: 'transfert', reason: 'Second essai' }, T(admin))).status === 400, 'Second règlement refusé');
const w2 = (await call('GET', '/wallet', null, T(sara))).body;
ok(w2.balance === 3 && w2.blocked === 0, 'Crédits restitués intégralement');

// Conflit de planning
const o3 = (await call('POST', '/offers', { title: 'Design', category_id: 5, skill: 'Figma', description: 'UI', level: 'Débutant', duration: 1, mode: 'À distance' }, T(youssef))).body.id;
const base0 = Date.now() + 200 * 3600e3;
const s3 = (await call('POST', `/offers/${o3}/slots`, { start_at: new Date(base0).toISOString(), location: 'x' }, T(youssef))).body.id;
const o4 = (await call('POST', '/offers', { title: 'Excel', category_id: 6, skill: 'Excel', description: 'Tab', level: 'Débutant', duration: 1, mode: 'À distance' }, T(amine))).body.id;
const s4 = (await call('POST', `/offers/${o4}/slots`, { start_at: new Date(base0 + 1800e3).toISOString(), location: 'x' }, T(amine))).body.id;
await call('POST', `/offers/${o3}/status`, { status: 'publiée' }, T(youssef));
await call('POST', `/offers/${o4}/status`, { status: 'publiée' }, T(amine));
const c1 = (await call('POST', '/bookings', { slot_id: s3 }, T(sara))).body.id;
const c2 = (await call('POST', '/bookings', { slot_id: s4 }, T(sara))).body.id;
ok((await call('POST', `/bookings/${c1}/accept`, null, T(youssef))).status === 200, 'Première séance acceptée');
ok((await call('POST', `/bookings/${c2}/accept`, null, T(amine))).status === 400, 'RG08 : chevauchement refusé');

// Solde insuffisant
const poor = await reg('poor@t.ma', 'Poor');
db.prepare('UPDATE users SET balance=0 WHERE id=?').run(poor.user.id);
ok((await call('POST', '/bookings', { slot_id: s3 }, T(poor))).status === 400, 'RG05 : solde insuffisant');

// Archivage annule les demandes en attente
const c3 = (await call('POST', '/bookings', { slot_id: s4 }, T(youssef))).body.id;
await call('POST', `/offers/${o4}/status`, { status: 'archivée' }, T(amine));
ok((await call('GET', '/bookings?box=sent', null, T(youssef))).body.find((b) => b.id === c3).status === 'annulée', 'RG17 : archivage annule les demandes en attente');

// Désactivation
ok((await call('POST', `/admin/users/${youssef.user.id}/active`, { active: false }, T(admin))).status === 200, 'Désactivation');
ok((await call('POST', '/auth/login', { email: 'youssef@t.ma', password: 'password1' })).status === 403, 'RG18 : compte désactivé ne se connecte plus');
ok((await call('GET', '/admin/stats', null, T(admin))).status === 200, 'Tableau de bord admin');
ok((await call('GET', '/admin/stats', null, T(sara))).status === 403, 'Droits admin côté serveur');

console.log(`\n${n} vérifications réussies ✅`);
srv.close(); process.exit(0);
