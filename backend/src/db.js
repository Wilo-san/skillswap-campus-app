import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_FILE || path.join(__dirname, '..', 'skillswap.db');
export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  field TEXT DEFAULT '',
  offered_skills TEXT DEFAULT '',
  wanted_skills TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  blocked INTEGER NOT NULL DEFAULT 0 CHECK (blocked >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  skill TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Débutant','Intermédiaire','Avancé')),
  duration INTEGER NOT NULL CHECK (duration IN (1,2)),
  mode TEXT NOT NULL CHECK (mode IN ('Présentiel','À distance')),
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','publiée','archivée')),
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  offer_id INTEGER NOT NULL REFERENCES offers(id),
  provider_id INTEGER NOT NULL REFERENCES users(id),
  beneficiary_id INTEGER NOT NULL REFERENCES users(id),
  cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente','refusée','acceptée','annulée','réalisée','en_litige')),
  reason TEXT DEFAULT '',
  provider_confirmed INTEGER NOT NULL DEFAULT 0,
  beneficiary_confirmed INTEGER NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- RG07 : une seule réservation acceptée/en litige par créneau (garantie en base)
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_active ON bookings(slot_id)
  WHERE status IN ('acceptée','en_litige','réalisée');
-- RG03 : pas de doublon en attente/acceptée pour un même bénéficiaire et créneau
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_dup ON bookings(slot_id, beneficiary_id)
  WHERE status IN ('en_attente','acceptée','en_litige');
CREATE TABLE IF NOT EXISTS credit_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  booking_id INTEGER REFERENCES bookings(id),
  type TEXT NOT NULL CHECK (type IN ('bienvenue','blocage','libération','transfert_sortant','transfert_entrant','restitution')),
  amount INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- RG11/RG14 : un seul règlement par réservation
CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_once ON credit_movements(booking_id, type)
  WHERE type IN ('transfert_entrant','transfert_sortant','restitution');
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  target_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (booking_id, author_id)
);
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  opened_by INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('absence','désaccord','confirmation_manquante')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert','résolu')),
  decision TEXT CHECK (decision IN ('transfert','restitution')),
  decision_reason TEXT,
  decided_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS dispute_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Données initiales
const defaultCats = ['Programmation', 'Langues', 'Communication orale', 'Mathématiques', 'Design', 'Bureautique'];
const insCat = db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)');
defaultCats.forEach((c) => insCat.run(c));

if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  db.prepare(
    "INSERT INTO users(email,password_hash,first_name,last_name,field,role,balance) VALUES (?,?,?,?,?,?,0)"
  ).run('admin@skillswap.ma', bcrypt.hashSync('Admin123!', 10), 'Admin', 'SkillSwap', 'Administration', 'admin');
}
