const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '7d';

function validateUsername(username) {
  return typeof username === 'string' && username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

async function register({ username, email, password }) {
  if (!validateUsername(username)) {
    throw new Error('Pseudo invalide (3-20 caractères, lettres/chiffres/_).');
  }
  if (!validateEmail(email)) {
    throw new Error('Adresse e-mail invalide.');
  }
  if (!validatePassword(password)) {
    throw new Error('Mot de passe trop court (minimum 6 caractères).');
  }

  if (db.findUserByUsername(username)) {
    throw new Error('Ce pseudo est déjà pris.');
  }
  if (db.findUserByEmail(email)) {
    throw new Error('Cette adresse e-mail est déjà utilisée.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = db.createUser(username, email, passwordHash);
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY
  });

  return { token, user };
}

async function login({ username, password }) {
  if (!username || !password) {
    throw new Error('Identifiants manquants.');
  }

  const user = db.findUserByUsername(username);
  if (!user) {
    throw new Error('Pseudo ou mot de passe incorrect.');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Pseudo ou mot de passe incorrect.');
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY
  });

  return {
    token,
    user: db.findUserById(user.id)
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }

  req.user = payload;
  next();
}

module.exports = {
  register,
  login,
  verifyToken,
  authMiddleware
};
