import {
  getToken,
  getUser,
  login,
  register,
  fetchMe,
  fetchLeaderboard,
  clearSession
} from './auth-client.js';
import { GameClient } from './game.js';

const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const authError = document.getElementById('auth-error');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const leaderboardList = document.getElementById('leaderboard-list');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const killFeed = document.getElementById('kill-feed');

let gameClient = null;

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function hideError() {
  authError.classList.add('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  loginForm.classList.toggle('hidden', tab !== 'login');
  registerForm.classList.toggle('hidden', tab !== 'register');
  hideError();
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function loadLeaderboard() {
  try {
    const board = await fetchLeaderboard();
    leaderboardList.innerHTML = board.length
      ? board
          .map(
            (entry, i) =>
              `<li><span>${i + 1}. ${entry.username}</span><span>${entry.kills}K / ${entry.deaths}D</span></li>`
          )
          .join('')
      : '<li>Aucun joueur pour l\'instant</li>';
  } catch {
    leaderboardList.innerHTML = '<li>Classement indisponible</li>';
  }
}

function showKillFeed(msg) {
  killFeed.textContent = msg;
  setTimeout(() => {
    if (killFeed.textContent === msg) killFeed.textContent = '';
  }, 4000);
}

async function startGame(user) {
  authScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.getElementById('player-name').textContent = user.username;

  gameClient = new GameClient({
    canvas: document.getElementById('game-canvas'),
    token: getToken(),
    username: user.username,
    onKillFeed: showKillFeed
  });
  gameClient.start();

  startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    gameClient.requestPointerLock();
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const form = new FormData(loginForm);
  try {
    const user = await login(form.get('username'), form.get('password'));
    await startGame(user);
  } catch (err) {
    showError(err.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const form = new FormData(registerForm);
  try {
    const user = await register(form.get('username'), form.get('email'), form.get('password'));
    await startGame(user);
  } catch (err) {
    showError(err.message);
  }
});

async function init() {
  await loadLeaderboard();

  const token = getToken();
  if (token) {
    try {
      const user = await fetchMe();
      await startGame(user);
      return;
    } catch {
      clearSession();
    }
  }
}

init();
