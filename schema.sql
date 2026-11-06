-- EESIM — Cloudflare D1 şeması
-- Worker bu dosyayı gömer ve ilk API isteğinde kendiliğinden uygular (worker/schema.ts).
-- Elle çalıştırmak istersen:  npx wrangler d1 execute eesim --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  avatar        TEXT,
  password_hash TEXT,              -- "pbkdf2$<iter>$<salt-b64>$<hash-b64>"; yalnızca Google ile girenlerde NULL
  google_sub    TEXT UNIQUE,       -- Google hesabının değişmeyen kimliği
  premium       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_login    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,     -- SHA-256(çerezdeki rastgele belirteç); belirtecin kendisi saklanmaz
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- XP, tamamlanan adımlar, seri… (istemcideki useProgress durumunun JSON hâli)
CREATE TABLE IF NOT EXISTS progress (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Kullanıcının yüklediği datasheet'ler (dosyanın kendisi R2'de: ds/<user_id>/<id>.pdf)
CREATE TABLE IF NOT EXISTS datasheets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,        -- eleman tipi (ör. "npn")
  name       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS datasheets_user_key ON datasheets(user_id, key);

-- "Tepecan'a Sor" günlük kullanım sayacı (kota)
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,           -- misafirler için "ip:<hash>"
  day     TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Kaba kuvvet koruması: sabit pencere hız sayacı (ör. "login:<ip-hash>")
CREATE TABLE IF NOT EXISTS rate_limits (
  k        TEXT PRIMARY KEY,       -- "<eylem>:<ip-hash>"
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL        -- unix saniye; bu andan sonra sayaç sıfırlanır
);
