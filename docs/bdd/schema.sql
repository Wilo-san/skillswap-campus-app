-- Schéma de la base SkillSwap Campus (généré depuis la migration Alembic 0001)
-- Moteur : SQLite (compatible PostgreSQL via SQLAlchemy)

CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE bookings (
	id INTEGER NOT NULL, 
	slot_id INTEGER NOT NULL, 
	offer_id INTEGER NOT NULL, 
	provider_id INTEGER NOT NULL, 
	beneficiary_id INTEGER NOT NULL, 
	cost INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	reason VARCHAR(255) NOT NULL, 
	provider_confirmed BOOLEAN NOT NULL, 
	beneficiary_confirmed BOOLEAN NOT NULL, 
	settled BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_bookings_status CHECK (status IN ('en_attente','refusée','acceptée','annulée','réalisée','en_litige')), 
	FOREIGN KEY(beneficiary_id) REFERENCES users (id), 
	FOREIGN KEY(offer_id) REFERENCES offers (id), 
	FOREIGN KEY(provider_id) REFERENCES users (id), 
	FOREIGN KEY(slot_id) REFERENCES slots (id)
);

CREATE TABLE categories (
	id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE credit_movements (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	booking_id INTEGER, 
	type VARCHAR(30) NOT NULL, 
	amount INTEGER NOT NULL, 
	note VARCHAR(255) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_movements_type CHECK (type IN ('bienvenue','blocage','libération','transfert_sortant','transfert_entrant','restitution')), 
	FOREIGN KEY(booking_id) REFERENCES bookings (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE dispute_messages (
	id INTEGER NOT NULL, 
	dispute_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(dispute_id) REFERENCES disputes (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE disputes (
	id INTEGER NOT NULL, 
	booking_id INTEGER NOT NULL, 
	opened_by INTEGER NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	description TEXT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	decision VARCHAR(20), 
	decision_reason TEXT, 
	decided_by INTEGER, 
	created_at DATETIME NOT NULL, 
	resolved_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_disputes_kind CHECK (kind IN ('absence','désaccord','confirmation_manquante')), 
	CONSTRAINT ck_disputes_status CHECK (status IN ('ouvert','résolu')), 
	FOREIGN KEY(booking_id) REFERENCES bookings (id), 
	FOREIGN KEY(decided_by) REFERENCES users (id), 
	FOREIGN KEY(opened_by) REFERENCES users (id)
);

CREATE TABLE notifications (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	read BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE offers (
	id INTEGER NOT NULL, 
	owner_id INTEGER NOT NULL, 
	category_id INTEGER NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	skill VARCHAR(120) NOT NULL, 
	description TEXT NOT NULL, 
	level VARCHAR(20) NOT NULL, 
	duration INTEGER NOT NULL, 
	mode VARCHAR(20) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	hidden BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_offers_level CHECK (level IN ('Débutant','Intermédiaire','Avancé')), 
	CONSTRAINT ck_offers_mode CHECK (mode IN ('Présentiel','À distance')), 
	CONSTRAINT ck_offers_status CHECK (status IN ('brouillon','publiée','archivée')), 
	CONSTRAINT ck_offers_duration CHECK (duration IN (1,2)), 
	FOREIGN KEY(category_id) REFERENCES categories (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id)
);

CREATE TABLE reviews (
	id INTEGER NOT NULL, 
	booking_id INTEGER NOT NULL, 
	author_id INTEGER NOT NULL, 
	target_id INTEGER NOT NULL, 
	rating INTEGER NOT NULL, 
	comment TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5), 
	FOREIGN KEY(author_id) REFERENCES users (id), 
	FOREIGN KEY(booking_id) REFERENCES bookings (id), 
	FOREIGN KEY(target_id) REFERENCES users (id), 
	CONSTRAINT uq_review_once UNIQUE (booking_id, author_id)
);

CREATE TABLE slots (
	id INTEGER NOT NULL, 
	offer_id INTEGER NOT NULL, 
	start_at DATETIME NOT NULL, 
	end_at DATETIME NOT NULL, 
	location VARCHAR(255) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(offer_id) REFERENCES offers (id) ON DELETE CASCADE
);

CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	first_name VARCHAR(80) NOT NULL, 
	last_name VARCHAR(80) NOT NULL, 
	field VARCHAR(120) NOT NULL, 
	offered_skills TEXT NOT NULL, 
	wanted_skills TEXT NOT NULL, 
	role VARCHAR(10) NOT NULL, 
	active BOOLEAN NOT NULL, 
	balance INTEGER NOT NULL, 
	blocked INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_users_role CHECK (role IN ('student','admin')), 
	CONSTRAINT ck_users_balance CHECK (balance >= 0), 
	CONSTRAINT ck_users_blocked CHECK (blocked >= 0)
);

CREATE INDEX ix_bookings_beneficiary_id ON bookings (beneficiary_id);

CREATE INDEX ix_bookings_provider_id ON bookings (provider_id);

CREATE INDEX ix_bookings_slot_id ON bookings (slot_id);

CREATE INDEX ix_credit_movements_user_id ON credit_movements (user_id);

CREATE INDEX ix_dispute_messages_dispute_id ON dispute_messages (dispute_id);

CREATE INDEX ix_disputes_booking_id ON disputes (booking_id);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);

CREATE INDEX ix_offers_owner_id ON offers (owner_id);

CREATE INDEX ix_reviews_target_id ON reviews (target_id);

CREATE INDEX ix_slots_offer_id ON slots (offer_id);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE UNIQUE INDEX uq_booking_dup ON bookings (slot_id, beneficiary_id) WHERE status IN ('en_attente','acceptée','en_litige');

CREATE UNIQUE INDEX uq_slot_active ON bookings (slot_id) WHERE status IN ('acceptée','en_litige','réalisée');

CREATE UNIQUE INDEX uq_transfer_once ON credit_movements (booking_id, type) WHERE type IN ('transfert_entrant','transfert_sortant','restitution');
