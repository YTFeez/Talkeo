# Arena FPS

FPS multijoueur navigateur avec **inscription**, **connexion** et arène temps réel. Conçu pour un déploiement sur VPS Hostinger.

## Fonctionnalités

- Inscription et connexion (JWT + bcrypt)
- Arène 3D first-person (Three.js)
- Multijoueur temps réel (Socket.io)
- Système de vie, tir, éliminations et respawn
- Classement persistant (SQLite)
- Déploiement PM2 + Nginx

## Prérequis

- Node.js 18+
- npm

## Installation locale

```bash
git clone https://github.com/VOTRE-USER/arena-fps.git
cd arena-fps
npm install
cp .env.example .env
# Modifiez JWT_SECRET dans .env
npm run dev
```

Ouvrez `http://localhost:3000`.

## Contrôles

| Touche | Action |
|--------|--------|
| ZQSD / WASD | Déplacement |
| Souris | Viser |
| Clic gauche | Tirer |
| Tab | Score en direct |
| Échap | Quitter le mode souris |

## Déploiement sur VPS Hostinger

### 1. Préparer le serveur (Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git build-essential
sudo npm install -g pm2
```

### 2. Cloner et configurer

```bash
cd /var/www
sudo git clone https://github.com/VOTRE-USER/arena-fps.git
cd arena-fps
sudo npm install --production
sudo cp .env.example .env
sudo nano .env
```

Dans `.env` :

```env
PORT=3000
JWT_SECRET=votre-cle-secrete-tres-longue-et-aleatoire
NODE_ENV=production
```

### 3. Lancer avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Nginx (reverse proxy)

```bash
sudo nano /etc/nginx/sites-available/arena-fps
```

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/arena-fps /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. HTTPS (recommandé)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

> Le pointer lock (souris capturée) nécessite HTTPS en production.

### 6. Pare-feu Hostinger

Ouvrez les ports **80** et **443** dans le panneau Hostinger (Security → Firewall).

## Structure

```
arena-fps/
├── server/
│   ├── index.js    # Express + Socket.io
│   ├── auth.js     # JWT, inscription/connexion
│   ├── db.js       # SQLite
│   └── game.js     # Logique multijoueur
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
├── ecosystem.config.js
└── package.json
```

## API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/auth/register` | POST | Inscription |
| `/api/auth/login` | POST | Connexion |
| `/api/auth/me` | GET | Profil (Bearer token) |
| `/api/leaderboard` | GET | Top 10 joueurs |
| `/api/health` | GET | Santé du serveur |

## Licence

MIT
