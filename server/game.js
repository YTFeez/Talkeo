const db = require('./db');

const MAP_SIZE = 80;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.5;
const MAX_HEALTH = 100;
const DAMAGE = 25;
const FIRE_RATE_MS = 200;
const RESPAWN_MS = 3000;
const TICK_RATE = 20;

const WALLS = [
  { x: 0, z: -40, w: 80, d: 1 },
  { x: 0, z: 40, w: 80, d: 1 },
  { x: -40, z: 0, w: 1, d: 80 },
  { x: 40, z: 0, w: 1, d: 80 },
  { x: -15, z: -10, w: 12, d: 2 },
  { x: 15, z: 10, w: 12, d: 2 },
  { x: 0, z: 0, w: 8, d: 8 },
  { x: -25, z: 20, w: 6, d: 14 },
  { x: 25, z: -20, w: 6, d: 14 }
];

const SPAWN_POINTS = [
  { x: -30, z: -30 },
  { x: 30, z: -30 },
  { x: -30, z: 30 },
  { x: 30, z: 30 },
  { x: 0, z: -32 },
  { x: 0, z: 32 }
];

class GameRoom {
  constructor() {
    this.players = new Map();
    this.lastTick = Date.now();
    this.spawnIndex = 0;
  }

  addPlayer(socketId, userId, username) {
    const spawn = SPAWN_POINTS[this.spawnIndex % SPAWN_POINTS.length];
    this.spawnIndex += 1;

    this.players.set(socketId, {
      id: socketId,
      userId,
      username,
      x: spawn.x,
      y: PLAYER_HEIGHT,
      z: spawn.z,
      rotationY: 0,
      rotationX: 0,
      health: MAX_HEALTH,
      kills: 0,
      deaths: 0,
      alive: true,
      lastShot: 0,
      respawnAt: 0
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPublicState() {
    const now = Date.now();
    const list = [];

    for (const player of this.players.values()) {
      if (!player.alive && player.respawnAt <= now) {
        this.respawnPlayer(player);
      }

      list.push({
        id: player.id,
        username: player.username,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        rotationX: player.rotationX,
        health: player.health,
        kills: player.kills,
        deaths: player.deaths,
        alive: player.alive
      });
    }

    return list;
  }

  respawnPlayer(player) {
    const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    player.x = spawn.x;
    player.y = PLAYER_HEIGHT;
    player.z = spawn.z;
    player.health = MAX_HEALTH;
    player.alive = true;
    player.respawnAt = 0;
  }

  updateMovement(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || !player.alive) return null;

    const speed = 0.18;
    const nextX = data.x;
    const nextZ = data.z;

    if (!this.collides(nextX, nextZ)) {
      player.x = nextX;
      player.z = nextZ;
    }

    player.rotationY = data.rotationY;
    player.rotationX = Math.max(-1.2, Math.min(1.2, data.rotationX));
    return player;
  }

  collides(x, z) {
    const limit = MAP_SIZE / 2 - 1;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return true;

    for (const wall of WALLS) {
      const halfW = wall.w / 2;
      const halfD = wall.d / 2;
      if (
        x + PLAYER_RADIUS > wall.x - halfW &&
        x - PLAYER_RADIUS < wall.x + halfW &&
        z + PLAYER_RADIUS > wall.z - halfD &&
        z - PLAYER_RADIUS < wall.z + halfD
      ) {
        return true;
      }
    }
    return false;
  }

  handleShoot(shooterId) {
    const shooter = this.players.get(shooterId);
    if (!shooter || !shooter.alive) return null;

    const now = Date.now();
    if (now - shooter.lastShot < FIRE_RATE_MS) return null;
    shooter.lastShot = now;

    const dirX = -Math.sin(shooter.rotationY) * Math.cos(shooter.rotationX);
    const dirY = Math.sin(shooter.rotationX);
    const dirZ = -Math.cos(shooter.rotationY) * Math.cos(shooter.rotationX);

    let closest = null;
    let closestDist = Infinity;

    for (const target of this.players.values()) {
      if (target.id === shooterId || !target.alive) continue;

      const toX = target.x - shooter.x;
      const toY = target.y - shooter.y;
      const toZ = target.z - shooter.z;
      const dist = Math.sqrt(toX * toX + toY * toY + toZ * toZ);
      if (dist > 50) continue;

      const norm = dist || 1;
      const dot = (toX / norm) * dirX + (toY / norm) * dirY + (toZ / norm) * dirZ;
      if (dot < 0.97) continue;

      if (dist < closestDist) {
        closestDist = dist;
        closest = target;
      }
    }

    if (!closest) {
      return { shooterId, hit: false };
    }

    closest.health -= DAMAGE;
    let killEvent = null;

    if (closest.health <= 0) {
      closest.alive = false;
      closest.health = 0;
      closest.deaths += 1;
      closest.respawnAt = now + RESPAWN_MS;
      shooter.kills += 1;
      db.updateStats(shooter.userId, 1, 0);
      db.updateStats(closest.userId, 0, 1);
      killEvent = {
        killer: shooter.username,
        victim: closest.username
      };
    }

    return {
      shooterId,
      hit: true,
      targetId: closest.id,
      targetHealth: closest.health,
      killEvent
    };
  }
}

const room = new GameRoom();

function attachGameHandlers(io) {
  setInterval(() => {
    io.to('arena').emit('game:state', {
      players: room.getPublicState(),
      walls: WALLS,
      mapSize: MAP_SIZE
    });
  }, 1000 / TICK_RATE);

  return {
    onJoin(socket, user) {
      room.addPlayer(socket.id, user.userId, user.username);
      socket.join('arena');
      socket.emit('game:joined', {
        id: socket.id,
        walls: WALLS,
        mapSize: MAP_SIZE
      });
      io.to('arena').emit('game:playerJoined', { username: user.username });
    },

    onMove(socket, data) {
      room.updateMovement(socket.id, data);
    },

    onShoot(socket) {
      const result = room.handleShoot(socket.id);
      if (result?.hit) {
        io.to('arena').emit('game:hit', result);
        if (result.killEvent) {
          io.to('arena').emit('game:kill', result.killEvent);
        }
      }
    },

    onDisconnect(socket) {
      const player = room.players.get(socket.id);
      if (player) {
        io.to('arena').emit('game:playerLeft', { username: player.username });
      }
      room.removePlayer(socket.id);
    }
  };
}

module.exports = { attachGameHandlers, WALLS, MAP_SIZE };
