import 'dotenv/config';
// Données de démonstration (optionnel) : npm run seed
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const h = bcrypt.hashSync('password123', 10);
const mk = (email, f, l, field, off, want) => {
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
  const id = db.prepare('INSERT INTO users(email,password_hash,first_name,last_name,field,offered_skills,wanted_skills,balance) VALUES (?,?,?,?,?,?,?,2)')
    .run(email, h, f, l, field, off, want).lastInsertRowid;
  db.prepare("INSERT INTO credit_movements(user_id,type,amount,note) VALUES (?,'bienvenue',2,'Crédits de bienvenue')").run(id);
  return id;
};
const sara = mk('sara@campus.ma', 'Sara', 'Benali', 'DUT GI', 'Python, SQL', 'Anglais');
const amine = mk('amine@campus.ma', 'Amine', 'El Idrissi', 'DUT GI', 'Anglais', 'Python');
const cat = (n) => db.prepare('SELECT id FROM categories WHERE name=?').get(n).id;
const day = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x; };
const offer = (owner, title, c, skill, desc, level, dur, mode, slots) => {
  if (db.prepare('SELECT 1 FROM offers WHERE title=? AND owner_id=?').get(title, owner)) return;
  const id = db.prepare("INSERT INTO offers(owner_id,category_id,title,skill,description,level,duration,mode,status) VALUES (?,?,?,?,?,?,?,?, 'publiée')")
    .run(owner, cat(c), title, skill, desc, level, dur, mode).lastInsertRowid;
  for (const [d, hh, loc] of slots) {
    const s = day(d, hh), e = new Date(s.getTime() + dur * 3600e3);
    db.prepare('INSERT INTO slots(offer_id,start_at,end_at,location) VALUES (?,?,?,?)').run(id, s.toISOString(), e.toISOString(), loc);
  }
};
offer(sara, 'Initiation à Python', 'Programmation', 'Python', 'Variables, boucles, fonctions : les bases pour démarrer.', 'Débutant', 1, 'À distance', [[2, 17, 'https://meet.example/python'], [3, 17, 'https://meet.example/python2']]);
offer(sara, 'SQL pour débutants', 'Programmation', 'SQL', 'Requêtes SELECT, jointures et modélisation simple.', 'Intermédiaire', 2, 'Présentiel', [[4, 14, 'Salle B12']]);
offer(amine, 'Conversation en anglais', 'Langues', 'Anglais', 'Pratiquer l’oral et gagner en confiance.', 'Intermédiaire', 1, 'À distance', [[2, 10, 'https://meet.example/english'], [5, 10, 'https://meet.example/english2']]);
console.log('Données de démo créées. Comptes : sara@campus.ma / amine@campus.ma (mot de passe : password123)');
