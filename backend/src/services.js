import { db } from './db.js';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (m, s = 400) => { throw new AppError(m, s); };

export const nowIso = () => new Date().toISOString();

export function notify(userId, message) {
  db.prepare('INSERT INTO notifications(user_id,message) VALUES (?,?)').run(userId, message);
}
function movement(userId, bookingId, type, amount, note = '') {
  db.prepare('INSERT INTO credit_movements(user_id,booking_id,type,amount,note) VALUES (?,?,?,?,?)')
    .run(userId, bookingId, type, amount, note);
}
const overlap = (aS, aE, bS, bE) => aS < bE && bS < aE;

// RG08 : chevauchement de séances acceptées pour un utilisateur
function hasConflict(userId, slot, ignoreBookingId = 0) {
  const rows = db.prepare(`
    SELECT s.start_at, s.end_at FROM bookings b JOIN slots s ON s.id=b.slot_id
    WHERE b.status IN ('acceptée','en_litige') AND b.id != ? AND (b.provider_id=? OR b.beneficiary_id=?)`)
    .all(ignoreBookingId, userId, userId);
  return rows.some((r) => overlap(slot.start_at, slot.end_at, r.start_at, r.end_at));
}

// Les transactions better-sqlite3 sont synchrones et sérialisées : pas de double attribution/transfert.
export const tx = (fn) => db.transaction(fn);

export const requestBooking = tx((userId, slotId) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(slotId);
  if (!slot) fail('Créneau introuvable.', 404);
  const offer = db.prepare('SELECT * FROM offers WHERE id=?').get(slot.offer_id);
  const provider = db.prepare('SELECT * FROM users WHERE id=?').get(offer.owner_id);
  const me = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (offer.owner_id === userId) fail('Vous ne pouvez pas réserver votre propre offre.');
  if (offer.status !== 'publiée' || offer.hidden) fail("Cette offre n'est pas disponible.");
  if (!provider.active) fail("L'intervenant n'est plus actif.");
  if (slot.start_at <= nowIso()) fail('Ce créneau est déjà passé.');
  if (db.prepare("SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('acceptée','en_litige','réalisée')").get(slotId))
    fail('Ce créneau est déjà attribué.');
  if (db.prepare("SELECT 1 FROM bookings WHERE slot_id=? AND beneficiary_id=? AND status IN ('en_attente','acceptée','en_litige')").get(slotId, userId))
    fail('Vous avez déjà une demande en cours pour ce créneau.');
  if (me.balance < offer.duration) fail(`Solde insuffisant : ${offer.duration} crédit(s) requis, ${me.balance} disponible(s).`);
  const info = db.prepare('INSERT INTO bookings(slot_id,offer_id,provider_id,beneficiary_id,cost) VALUES (?,?,?,?,?)')
    .run(slotId, offer.id, offer.owner_id, userId, offer.duration);
  notify(offer.owner_id, `Nouvelle demande de ${me.first_name} ${me.last_name} pour « ${offer.title} ».`);
  return info.lastInsertRowid;
});

export const acceptBooking = tx((userId, bookingId) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId) fail('Seul l’intervenant peut accepter.', 403);
  if (b.status !== 'en_attente') fail('Cette demande n’est plus en attente.');
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(b.slot_id);
  const offer = db.prepare('SELECT * FROM offers WHERE id=?').get(b.offer_id);
  const provider = db.prepare('SELECT * FROM users WHERE id=?').get(b.provider_id);
  const ben = db.prepare('SELECT * FROM users WHERE id=?').get(b.beneficiary_id);
  if (!provider.active) fail('Votre compte est désactivé.');
  if (!ben.active) fail('Le compte du bénéficiaire est désactivé.');
  if (offer.status !== 'publiée' || offer.hidden) fail('L’offre n’est plus publiée.');
  if (slot.start_at <= nowIso()) fail('Ce créneau est déjà passé.');
  if (db.prepare("SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('acceptée','en_litige','réalisée')").get(b.slot_id))
    fail('Ce créneau est déjà attribué.');
  if (hasConflict(b.provider_id, slot)) fail('Conflit de planning : vous avez déjà une séance sur cet horaire.');
  if (hasConflict(b.beneficiary_id, slot)) fail('Conflit de planning pour le bénéficiaire sur cet horaire.');
  if (ben.balance < b.cost) fail('Solde insuffisant du bénéficiaire pour accepter cette demande.'); // RG05
  db.prepare('UPDATE users SET balance=balance-?, blocked=blocked+? WHERE id=?').run(b.cost, b.cost, b.beneficiary_id);
  movement(b.beneficiary_id, b.id, 'blocage', b.cost, `Blocage pour « ${offer.title} »`);
  db.prepare("UPDATE bookings SET status='acceptée' WHERE id=?").run(b.id);
  // RG07 : refus automatique des autres demandes
  const others = db.prepare("SELECT * FROM bookings WHERE slot_id=? AND status='en_attente' AND id!=?").all(b.slot_id, b.id);
  for (const o of others) {
    db.prepare("UPDATE bookings SET status='refusée', reason=? WHERE id=?")
      .run('Créneau attribué à une autre demande.', o.id);
    notify(o.beneficiary_id, `Votre demande pour « ${offer.title} » a été refusée : créneau attribué à une autre demande.`);
  }
  notify(b.beneficiary_id, `Votre demande pour « ${offer.title} » a été acceptée. ${b.cost} crédit(s) bloqué(s).`);
});

export const refuseBooking = tx((userId, bookingId, reason) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId) fail('Seul l’intervenant peut refuser.', 403);
  if (b.status !== 'en_attente') fail('Cette demande n’est plus en attente.');
  if (!reason || !reason.trim()) fail('Un motif de refus est obligatoire.');
  db.prepare("UPDATE bookings SET status='refusée', reason=? WHERE id=?").run(reason.trim(), b.id);
  notify(b.beneficiary_id, `Votre demande a été refusée. Motif : ${reason.trim()}`);
});

export const withdrawBooking = tx((userId, bookingId) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.beneficiary_id !== userId) fail('Seul le bénéficiaire peut retirer sa demande.', 403);
  if (b.status !== 'en_attente') fail('Seule une demande en attente peut être retirée.');
  db.prepare("UPDATE bookings SET status='annulée', reason='Retirée par le bénéficiaire' WHERE id=?").run(b.id);
  notify(b.provider_id, 'Une demande en attente a été retirée.');
});

// Libère les crédits bloqués (RG10, RG16)
function releaseCredits(b, note) {
  db.prepare('UPDATE users SET balance=balance+?, blocked=blocked-? WHERE id=?').run(b.cost, b.cost, b.beneficiary_id);
  movement(b.beneficiary_id, b.id, 'libération', b.cost, note);
}

export const cancelBooking = tx((userId, bookingId) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId && b.beneficiary_id !== userId) fail('Accès refusé.', 403);
  if (b.status !== 'acceptée') fail('Seule une séance acceptée peut être annulée.');
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(b.slot_id);
  if (slot.start_at <= nowIso())
    fail('La séance a déjà commencé : annulation directe impossible, ouvrez un signalement.');
  releaseCredits(b, 'Annulation avant le début de la séance');
  db.prepare("UPDATE bookings SET status='annulée', reason='Annulée avant le début' WHERE id=?").run(b.id);
  const other = userId === b.provider_id ? b.beneficiary_id : b.provider_id;
  notify(other, 'Une séance acceptée a été annulée. Les crédits ont été libérés.');
});

export const confirmBooking = tx((userId, bookingId) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId && b.beneficiary_id !== userId) fail('Accès refusé.', 403);
  if (b.status !== 'acceptée') fail('Cette réservation ne peut pas être confirmée dans son état actuel.');
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(b.slot_id);
  if (nowIso() < slot.end_at) fail('La confirmation est possible uniquement après l’heure de fin.');
  const col = userId === b.provider_id ? 'provider_confirmed' : 'beneficiary_confirmed';
  if (b[col]) fail('Vous avez déjà confirmé cette séance.');
  db.prepare(`UPDATE bookings SET ${col}=1 WHERE id=?`).run(b.id);
  const fresh = db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id);
  if (fresh.provider_confirmed && fresh.beneficiary_confirmed) {
    if (db.prepare("SELECT 1 FROM disputes WHERE booking_id=? AND status='ouvert'").get(b.id))
      fail('Un litige est ouvert : le transfert est bloqué.');
    transferCredits(fresh, 'Transfert après double confirmation');
    return 'transféré';
  }
  notify(userId === b.provider_id ? b.beneficiary_id : b.provider_id, 'L’autre participant a confirmé la séance. À vous de confirmer.');
  return 'confirmé';
});

function transferCredits(b, note) {
  if (b.settled) fail('Cette réservation a déjà été réglée.');
  db.prepare('UPDATE users SET blocked=blocked-? WHERE id=?').run(b.cost, b.beneficiary_id);
  db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(b.cost, b.provider_id);
  movement(b.beneficiary_id, b.id, 'transfert_sortant', b.cost, note);
  movement(b.provider_id, b.id, 'transfert_entrant', b.cost, note);
  db.prepare("UPDATE bookings SET status='réalisée', settled=1 WHERE id=?").run(b.id);
  notify(b.provider_id, `Vous avez reçu ${b.cost} crédit(s).`);
  notify(b.beneficiary_id, `${b.cost} crédit(s) transféré(s) à l’intervenant.`);
}

export const openDispute = tx((userId, bookingId, kind, description) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId && b.beneficiary_id !== userId) fail('Accès refusé.', 403);
  if (b.settled) fail('Cette réservation est déjà réglée définitivement.');
  if (b.status !== 'acceptée') fail('Un signalement n’est possible que sur une séance acceptée.');
  const slot = db.prepare('SELECT * FROM slots WHERE id=?').get(b.slot_id);
  if (nowIso() < slot.start_at) fail('Avant le début, utilisez l’annulation.');
  if (!['absence', 'désaccord', 'confirmation_manquante'].includes(kind)) fail('Type de signalement invalide.');
  if (!description || description.trim().length < 5) fail('Décrivez le problème (5 caractères minimum).');
  if (db.prepare("SELECT 1 FROM disputes WHERE booking_id=? AND status='ouvert'").get(b.id))
    fail('Un litige est déjà ouvert pour cette réservation.');
  const info = db.prepare('INSERT INTO disputes(booking_id,opened_by,kind,description) VALUES (?,?,?,?)')
    .run(b.id, userId, kind, description.trim());
  db.prepare('INSERT INTO dispute_messages(dispute_id,user_id,message) VALUES (?,?,?)')
    .run(info.lastInsertRowid, userId, description.trim());
  db.prepare("UPDATE bookings SET status='en_litige' WHERE id=?").run(b.id);
  const other = userId === b.provider_id ? b.beneficiary_id : b.provider_id;
  notify(other, 'Un signalement a été ouvert sur une de vos séances.');
  db.prepare("SELECT id FROM users WHERE role='admin'").all().forEach((a) => notify(a.id, 'Nouveau litige à examiner.'));
  return info.lastInsertRowid;
});

export const resolveDispute = tx((adminId, disputeId, decision, reason) => {
  const d = db.prepare('SELECT * FROM disputes WHERE id=?').get(disputeId);
  if (!d) fail('Litige introuvable.', 404);
  if (d.status !== 'ouvert') fail('Ce litige est déjà réglé : aucun second règlement n’est autorisé.');
  if (!['transfert', 'restitution'].includes(decision)) fail('Décision invalide (transfert ou restitution).');
  if (!reason || reason.trim().length < 5) fail('La décision doit être motivée.');
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(d.booking_id);
  if (b.settled) fail('Cette réservation est déjà réglée.');
  if (decision === 'transfert') {
    transferCredits(b, 'Règlement administrateur : transfert');
  } else {
    db.prepare('UPDATE users SET blocked=blocked-?, balance=balance+? WHERE id=?').run(b.cost, b.cost, b.beneficiary_id);
    movement(b.beneficiary_id, b.id, 'restitution', b.cost, 'Règlement administrateur : restitution');
    db.prepare("UPDATE bookings SET status='annulée', settled=1 WHERE id=?").run(b.id);
  }
  db.prepare("UPDATE disputes SET status='résolu', decision=?, decision_reason=?, decided_by=?, resolved_at=datetime('now') WHERE id=?")
    .run(decision, reason.trim(), adminId, d.id);
  const msg = `Litige réglé : ${decision === 'transfert' ? 'transfert à l’intervenant' : 'restitution au bénéficiaire'}. Motif : ${reason.trim()}`;
  notify(b.provider_id, msg); notify(b.beneficiary_id, msg);
});

// Annule une réservation acceptée à la demande de l'admin (RG18)
export const adminCancelBooking = tx((bookingId) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.status !== 'acceptée') fail('Seule une séance acceptée peut être annulée par l’administrateur.');
  releaseCredits(b, 'Annulation administrateur');
  db.prepare("UPDATE bookings SET status='annulée', reason='Annulée par l’administrateur' WHERE id=?").run(b.id);
  notify(b.provider_id, 'Une séance a été annulée par l’administrateur.');
  notify(b.beneficiary_id, 'Une séance a été annulée par l’administrateur. Crédits libérés.');
});

// RG17 : archivage / masquage => annule les demandes en attente
export function cancelPendingForOffer(offerId, why) {
  const pend = db.prepare("SELECT * FROM bookings WHERE offer_id=? AND status='en_attente'").all(offerId);
  for (const p of pend) {
    db.prepare("UPDATE bookings SET status='annulée', reason=? WHERE id=?").run(why, p.id);
    notify(p.beneficiary_id, `Votre demande a été annulée : ${why}`);
  }
}

// RG18
export const setUserActive = tx((userId, active) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!u) fail('Utilisateur introuvable.', 404);
  if (u.role === 'admin' && !active) fail('Un administrateur ne peut pas être désactivé.');
  db.prepare('UPDATE users SET active=? WHERE id=?').run(active ? 1 : 0, userId);
  if (!active) {
    const pend = db.prepare("SELECT * FROM bookings WHERE status='en_attente' AND (provider_id=? OR beneficiary_id=?)").all(userId, userId);
    for (const p of pend) {
      db.prepare("UPDATE bookings SET status='annulée', reason='Compte désactivé' WHERE id=?").run(p.id);
      notify(p.provider_id === userId ? p.beneficiary_id : p.provider_id, 'Une demande a été annulée (compte désactivé).');
    }
  }
});

export const submitReview = tx((userId, bookingId, rating, comment) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) fail('Réservation introuvable.', 404);
  if (b.provider_id !== userId && b.beneficiary_id !== userId) fail('Accès refusé.', 403);
  if (b.status !== 'réalisée') fail('Une évaluation n’est possible qu’après une séance réalisée.');
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) fail('La note doit être comprise entre 1 et 5.');
  if (db.prepare('SELECT 1 FROM reviews WHERE booking_id=? AND author_id=?').get(bookingId, userId))
    fail('Vous avez déjà évalué cette séance.');
  const target = userId === b.provider_id ? b.beneficiary_id : b.provider_id;
  db.prepare('INSERT INTO reviews(booking_id,author_id,target_id,rating,comment) VALUES (?,?,?,?,?)')
    .run(bookingId, userId, target, r, (comment || '').trim());
  notify(target, 'Vous avez reçu une nouvelle évaluation.');
});
