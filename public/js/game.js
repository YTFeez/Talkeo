import * as THREE from 'three';

const MOVE_SPEED = 0.18;
const MOUSE_SENS = 0.002;
const PLAYER_HEIGHT = 1.7;

export class GameClient {
  constructor({ canvas, token, username, onKillFeed }) {
    this.canvas = canvas;
    this.token = token;
    this.username = username;
    this.onKillFeed = onKillFeed;

    this.socket = null;
    this.playerId = null;
    this.players = new Map();
    this.walls = [];
    this.mapSize = 80;

    this.keys = {};
    this.pointerLocked = false;
    this.rotationY = 0;
    this.rotationX = 0;
    this.position = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
    this.alive = true;
    this.health = 100;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d8);
    this.scene.fog = new THREE.Fog(0x87b5d8, 20, 90);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.ground = null;
    this.playerMeshes = new Map();
    this.wallMeshes = [];

    this.setupLights();
    this.setupInput();
    this.animate = this.animate.bind(this);
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);
  }

  buildMap(walls, mapSize) {
    this.walls = walls;
    this.mapSize = mapSize;

    if (this.ground) this.scene.remove(this.ground);
    this.wallMeshes.forEach((m) => this.scene.remove(m));
    this.wallMeshes = [];

    const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 0.9 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    const grid = new THREE.GridHelper(mapSize, mapSize / 4, 0x2a3f28, 0x2a3f28);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7 });

    for (const wall of walls) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.w, 3, wall.d),
        wallMat
      );
      mesh.position.set(wall.x, 1.5, wall.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
    }
  }

  connect() {
    this.socket = io({ auth: { token: this.token } });

    this.socket.on('game:joined', (data) => {
      this.playerId = data.id;
      this.buildMap(data.walls, data.mapSize);
    });

    this.socket.on('game:state', (state) => {
      this.syncPlayers(state.players);
    });

    this.socket.on('game:kill', (event) => {
      this.onKillFeed(`${event.killer} a éliminé ${event.victim}`);
    });

    this.socket.on('game:hit', (event) => {
      if (event.targetId === this.playerId) {
        this.health = event.targetHealth;
        this.updateHealthBar();
      }
    });

    this.socket.on('connect_error', (err) => {
      this.onKillFeed(`Erreur connexion: ${err.message}`);
    });
  }

  syncPlayers(serverPlayers) {
    const seen = new Set();

    for (const p of serverPlayers) {
      seen.add(p.id);

      if (p.id === this.playerId) {
        this.alive = p.alive;
        this.health = p.health;
        this.updateHealthBar();
        document.getElementById('death-screen').classList.toggle('hidden', p.alive);
        document.getElementById('player-stats').textContent = `${p.kills} K / ${p.deaths} D`;
        continue;
      }

      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        mesh = this.createPlayerMesh(p.username);
        this.playerMeshes.set(p.id, mesh);
        this.scene.add(mesh);
      }

      mesh.visible = p.alive;
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.rotationY;

      const nameTag = mesh.userData.nameTag;
      if (nameTag) {
        nameTag.position.set(p.x, p.y + 1.2, p.z);
      }
    }

    for (const [id, mesh] of this.playerMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        if (mesh.userData.nameTag) this.scene.remove(mesh.userData.nameTag);
        this.playerMeshes.delete(id);
      }
    }

    this.updateScoreboard(serverPlayers);
  }

  createPlayerMesh(username) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    body.position.y = 0.2;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffb4a2 })
    );
    head.position.y = 1.1;
    group.add(head);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(username, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(2.5, 0.6, 1);
    group.userData.nameTag = sprite;

    this.scene.add(sprite);
    return group;
  }

  updateScoreboard(players) {
    const list = document.getElementById('scoreboard-list');
    list.innerHTML = players
      .sort((a, b) => b.kills - a.kills)
      .map(
        (p) =>
          `<li><span>${p.username}${p.id === this.playerId ? ' (vous)' : ''}</span><span>${p.kills}/${p.deaths} — ${p.health} HP</span></li>`
      )
      .join('');
  }

  updateHealthBar() {
    const fill = document.getElementById('health-fill');
    fill.style.width = `${Math.max(0, this.health)}%`;
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        document.getElementById('scoreboard').classList.remove('hidden');
      }
      if (e.code === 'Escape') {
        document.exitPointerLock();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        document.getElementById('scoreboard').classList.add('hidden');
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.rotationY -= e.movementX * MOUSE_SENS;
      this.rotationX -= e.movementY * MOUSE_SENS;
      this.rotationX = Math.max(-1.2, Math.min(1.2, this.rotationX));
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.pointerLocked && this.alive) {
        this.socket?.emit('game:shoot');
        this.flashMuzzle();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  flashMuzzle() {
    const flash = new THREE.PointLight(0xffaa00, 2, 3);
    flash.position.copy(this.camera.position);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 50);
  }

  collides(x, z) {
    const limit = this.mapSize / 2 - 1;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return true;

    for (const wall of this.walls) {
      const halfW = wall.w / 2;
      const halfD = wall.d / 2;
      if (
        x + 0.5 > wall.x - halfW &&
        x - 0.5 < wall.x + halfW &&
        z + 0.5 > wall.z - halfD &&
        z - 0.5 < wall.z + halfD
      ) {
        return true;
      }
    }
    return false;
  }

  updateMovement() {
    if (!this.pointerLocked || !this.alive) return;

    let dx = 0;
    let dz = 0;

    if (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp']) dz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dz += 1;
    if (this.keys['KeyA'] || this.keys['KeyQ']) dx -= 1;
    if (this.keys['KeyD']) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      const sin = Math.sin(this.rotationY);
      const cos = Math.cos(this.rotationY);
      const moveX = (dx * cos + dz * sin) * MOVE_SPEED;
      const moveZ = (-dx * sin + dz * cos) * MOVE_SPEED;

      const nextX = this.position.x + moveX;
      const nextZ = this.position.z + moveZ;

      if (!this.collides(nextX, this.position.z)) this.position.x = nextX;
      if (!this.collides(this.position.x, nextZ)) this.position.z = nextZ;
    }

    this.camera.position.set(this.position.x, this.position.y, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.rotationY;
    this.camera.rotation.x = this.rotationX;

    this.socket?.emit('game:move', {
      x: this.position.x,
      z: this.position.z,
      rotationY: this.rotationY,
      rotationX: this.rotationX
    });
  }

  start() {
    this.connect();
    this.renderer.setAnimationLoop(this.animate);
  }

  animate() {
    this.updateMovement();
    this.renderer.render(this.scene, this.camera);
  }

  requestPointerLock() {
    this.canvas.requestPointerLock();
  }
}
