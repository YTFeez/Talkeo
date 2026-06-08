const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'arena.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT id, username, email, kills, deaths, created_at FROM users WHERE id = ?').get(id);
}

function createUser(username, email, passwordHash) {
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, passwordHash);
  return findUserById(result.lastInsertRowid);
}

function updateStats(userId, killsDelta, deathsDelta) {
  db.prepare('UPDATE users SET kills = kills + ?, deaths = deaths + ? WHERE id = ?').run(
    killsDelta,
    deathsDelta,
    userId
  );
}

function getLeaderboard(limit = 10) {
  return db
    .prepare(
      'SELECT username, kills, deaths FROM users ORDER BY kills DESC, deaths ASC LIMIT ?'
    )
    .all(limit);
}

module.exports = {
  findUserByUsername,
  findUserByEmail,
  findUserById,
  createUser,
  updateStats,
  getLeaderboard
};
