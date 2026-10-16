'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle, speed = 520, ttl = 1.1, pierce = 0) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.ttl  = ttl;
    this.pierce = pierce;
    this.radius = pierce > 0 ? 2.6 : 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Las balas perforantes dejan una estela que marca su alcance extra
    if (this.pierce > 0) {
      ctx.strokeStyle = 'rgba(124, 249, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
      ctx.stroke();
    }
    ctx.fillStyle = this.pierce > 0 ? '#7cf9ff' : '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Estrella fugaz: asteroide especial rápido y efímero
const SHOOTING_STAR_POINTS = 300;
const SHOOTING_STAR_SPEED_MULT = 3;
const SHOOTING_STAR_TTL_MIN = 5;
const SHOOTING_STAR_TTL_MAX = 8;
const SHOOTING_STAR_INTERVAL_MIN = 10;
const SHOOTING_STAR_INTERVAL_MAX = 18;

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.points = POINTS[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.color || '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
class ShootingStar extends Asteroid {
  constructor(x, y) {
    super(x, y, 2);
    this.color  = '#7cf9ff';
    this.points = SHOOTING_STAR_POINTS;
    this.vx *= SHOOTING_STAR_SPEED_MULT;
    this.vy *= SHOOTING_STAR_SPEED_MULT;
    this.rotSpeed = rand(-3, 3);
    this.ttl = rand(SHOOTING_STAR_TTL_MIN, SHOOTING_STAR_TTL_MAX);
    this.life = this.ttl;
  }

  update(dt) {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.dead = true;
      explode(this.x, this.y, 10);
    }
  }

  split() {
    return [];
  }

  draw() {
    // Parpadeo cuando está a punto de desvanecerse
    const fade = this.ttl < 1.5 && Math.floor(this.ttl * 8) % 2 === 0;
    const alpha = fade ? 0.35 : Math.min(1, this.ttl);

    // Estela opuesta a la dirección de movimiento
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const ux = this.vx / speed;
    const uy = this.vy / speed;
    const TAIL = this.radius * 4;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x - ux * this.radius, this.y - uy * this.radius);
    ctx.lineTo(this.x - ux * TAIL, this.y - uy * TAIL);
    ctx.strokeStyle = `rgba(124,249,255,${(alpha * 0.5).toFixed(2)})`;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    super.draw();
    ctx.restore();
  }
}

// ── Skins de la nave ──────────────────────────────────────────────────────────
// Cada skin cambia aspecto y jugabilidad. `stats` define el comportamiento de la
// nave; `trait` es la etiqueta corta que se muestra en pantalla.
//   fireDelay   segundos entre disparos
//   bulletSpeed px/s de la bala
//   bulletTtl   segundos de vida (alcance)
//   pierce      asteroides que la bala atraviesa antes de morir
//   spread      desvíos angulares (rad) de cada bala del disparo
//   line        desvíos laterales (px) de cada bala del disparo
//   rotSpeed    rad/s de giro
//   thrust      px/s² de empuje
//   shield      parámetros del escudo de esta skin
const SKINS = [
  {
    name: 'CLÁSICO',
    trait: 'EQUILIBRADO',
    color: '#ffffff',
    flame: 'rgba(255, 130, 0, 0.85)',
    flameX: -8,
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
    stats: {
      fireDelay: 0.2, bulletSpeed: 520, bulletTtl: 1.1, pierce: 0,
      spread: [0], line: [0], rotSpeed: 3.5, thrust: 260,
      shield: { energy: 100, drain: 25, recharge: 12, minStart: 20, hits: 3, radius: 26 },
    },
  },
  {
    name: 'HALCÓN',
    trait: 'PERFORANTE',
    color: '#4dfffc',
    flame: 'rgba(0, 220, 255, 0.9)',
    flameX: -9,
    verts: [
      [23, 0], [7, -4], [2, -6], [-7, -15], [-3, -5], [-13, -5],
      [-9, 0], [-13, 5], [-3, 5], [-7, 15], [2, 6], [7, 4],
    ],
    stats: {
      fireDelay: 0.34, bulletSpeed: 680, bulletTtl: 1.35, pierce: 2,
      spread: [0], line: [0], rotSpeed: 2.9, thrust: 260,
      shield: { energy: 100, drain: 25, recharge: 12, minStart: 20, hits: 3, radius: 26 },
    },
  },
  {
    name: 'ROMBO',
    trait: 'ABANICO',
    color: '#ff5fd0',
    flame: 'rgba(255, 95, 208, 0.9)',
    flameX: -13,
    verts: [[20, 0], [0, -9], [-14, 0], [0, 9]],
    stats: {
      fireDelay: 0.26, bulletSpeed: 500, bulletTtl: 0.72, pierce: 0,
      spread: [-0.16, 0, 0.16], line: [0, 0, 0], rotSpeed: 3.5, thrust: 275,
      shield: { energy: 100, drain: 25, recharge: 12, minStart: 20, hits: 3, radius: 26 },
    },
  },
  {
    name: 'SIGILOSA',
    trait: 'BALUARTE',
    color: '#ffd800',
    flame: 'rgba(255, 216, 0, 0.9)',
    flameX: -10,
    verts: [[20, 0], [0, -7], [-13, -6], [-9, 0], [-13, 6], [0, 7]],
    stats: {
      fireDelay: 0.14, bulletSpeed: 480, bulletTtl: 0.95, pierce: 0,
      spread: [0, 0], line: [-6, 6], rotSpeed: 3.2, thrust: 210,
      shield: { energy: 130, drain: 20, recharge: 20, minStart: 20, hits: 4, radius: 30 },
    },
  },
];

const SKIN_STORAGE_KEY = 'asteroids.skin';
let skinIndex = 0;
try {
  const saved = parseInt(localStorage.getItem(SKIN_STORAGE_KEY), 10);
  if (Number.isInteger(saved) && saved >= 0 && saved < SKINS.length) skinIndex = saved;
} catch (e) {}

let skinToast = 0;

function cycleSkin() {
  skinIndex = (skinIndex + 1) % SKINS.length;
  skinToast = 1.5;
  try { localStorage.setItem(SKIN_STORAGE_KEY, String(skinIndex)); } catch (e) {}
}

const activeSkin  = () => SKINS[skinIndex];
const activeStats = () => SKINS[skinIndex].stats;

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoost    = 0;
    this.tripleShot    = 0;
    this.dead          = false;

    // El escudo hereda su configuración de la skin activa
    const sh = activeStats().shield;
    this.shieldMax      = sh.energy;
    this.shieldDrain    = sh.drain;
    this.shieldRecharge = sh.recharge;
    this.shieldMinStart = sh.minStart;
    this.shieldMaxHits  = sh.hits;
    this.shieldRadius   = sh.radius;

    this.shield        = false;
    this.shieldEnergy  = sh.energy;
    this.shieldHits    = sh.hits;
    this.shieldFlash   = 0;
    this.shieldPhase   = 0;
    this.skin          = skinIndex;
  }

  applySkin() {
    const sh = activeStats().shield;
    this.shieldMax      = sh.energy;
    this.shieldDrain    = sh.drain;
    this.shieldRecharge = sh.recharge;
    this.shieldMinStart = sh.minStart;
    this.shieldMaxHits  = sh.hits;
    this.shieldRadius   = sh.radius;
    this.shieldEnergy   = Math.min(this.shieldEnergy, sh.energy);
    this.shieldHits     = Math.min(this.shieldHits, sh.hits);
    this.skin           = skinIndex;
  }

  update(dt) {
    if (this.dead) return;
    if (this.skin !== skinIndex) this.applySkin();
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.shieldFlash   > 0) this.shieldFlash   = Math.max(0, this.shieldFlash - dt * 3);
    this.shieldPhase += dt;

    // Escudo: drena energía mientras está activo, recarga inactivo
    if (this.shield) {
      this.shieldEnergy -= this.shieldDrain * dt;
      if (this.shieldEnergy <= 0) {
        this.shieldEnergy = 0;
        this.breakShield();
      }
    } else if (this.shieldEnergy < this.shieldMax) {
      this.shieldEnergy = Math.min(
        this.shieldMax,
        this.shieldEnergy + this.shieldRecharge * dt
      );
    }

    const stats  = activeStats();
    const ROT    = stats.rotSpeed;   // rad/s
    const THRUST = stats.thrust;     // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      const thrust = THRUST * (this.speedBoost > 0 ? 2 : 1);
      this.vx += Math.cos(this.angle) * thrust * dt;
      this.vy += Math.sin(this.angle) * thrust * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    const stats = activeStats();
    this.shootCooldown = stats.fireDelay;
    const NOSE = Math.max(...activeSkin().verts.map(v => v[0])) + 1;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    if (this.tripleShot > 0) {
      // Ráfaga de 3 balas en línea recta, una detrás de otra
      const GAP = 14;
      const volley = [];
      for (let i = 0; i < 3; i++) {
        const d = NOSE + i * GAP;
        volley.push(new Bullet(
          this.x + cos * d,
          this.y + sin * d,
          this.angle,
          stats.bulletSpeed,
          stats.bulletTtl,
          stats.pierce
        ));
      }
      return volley;
    }

    // Patrón propio de la skin (simple, abanico o cañones paralelos)
    const volley = [];
    for (let i = 0; i < stats.spread.length; i++) {
      const off = stats.line[i] || 0;
      const a = this.angle + stats.spread[i];
      volley.push(new Bullet(
        this.x + cos * NOSE - sin * off,
        this.y + sin * NOSE + cos * off,
        a,
        stats.bulletSpeed,
        stats.bulletTtl,
        stats.pierce
      ));
    }
    return volley;
  }

  toggleShield() {
    if (this.dead) return;
    if (this.shield) {
      this.shield = false;
    } else if (this.shieldEnergy >= this.shieldMinStart) {
      this.shield     = true;
      this.shieldHits = this.shieldMaxHits;
    }
  }

  absorbHit() {
    if (!this.shield) return false;
    this.shieldHits--;
    this.shieldFlash = 1;
    if (this.shieldHits <= 0) this.breakShield();
    return true;
  }

  breakShield() {
    if (!this.shield) return;
    this.shield      = false;
    this.shieldFlash = 1;
    explode(this.x, this.y, 10);
  }

  draw() {
    if (this.dead) return;

    // Escudo (no parpadea con la invencibilidad de reaparición)
    if (this.shield) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 0.55 + 0.3 * Math.sin(this.shieldPhase * 6);
      ctx.beginPath();
      ctx.arc(0, 0, this.shieldRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${(0.06 + 0.08 * (1 - this.shieldEnergy / this.shieldMax)).toFixed(2)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0,229,255,${pulse.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Destello al absorber un impacto o romperse
    if (this.shieldFlash > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(255,255,255,${this.shieldFlash.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.shieldRadius + 6 * (1 - this.shieldFlash), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta de la nave según el skin
    ctx.beginPath();
    ctx.moveTo(skin.verts[0][0], skin.verts[0][1]);
    for (let i = 1; i < skin.verts.length; i++)
      ctx.lineTo(skin.verts[i][0], skin.verts[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const fx = skin.flameX;
      ctx.beginPath();
      ctx.moveTo(fx, -4);
      ctx.lineTo(fx - rand(6, 14), 0);
      ctx.lineTo(fx,  4);
      ctx.strokeStyle = this.speedBoost > 0
        ? 'rgba(0, 220, 255, 0.9)'
        : this.tripleShot > 0
          ? 'rgba(255, 77, 210, 0.9)'
          : skin.flame;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUps ──────────────────────────────────────────────────────────────────
const POWERUP_CHANCE   = 0.12;  // probabilidad al destruir un asteroide
const POWERUP_DURATION = 5;     // segundos de duración del efecto

class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x = x;
    this.y = y;
    this.type = type;  // 'speed' | 'triple'
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 45);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 12;
    this.rot  = 0;
    this.ttl  = 12;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += dt * 2;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const style = this.type === 'triple'
      ? { color: '#ff4dd2', rgb: '255,77,210' }
      : { color: '#00e5ff', rgb: '0,229,255' };

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.rot) * 0.3);

    // Halo parpadeante
    const pulse = 0.5 + 0.5 * Math.sin(this.rot * 4);
    ctx.strokeStyle = `rgba(${style.rgb},${(0.25 + 0.35 * pulse).toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = style.color;
    ctx.fillStyle   = style.color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';

    if (this.type === 'triple') {
      // Tres puntos en fila: la ráfaga en línea recta
      for (const dx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.arc(dx, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Rayo
      ctx.beginPath();
      ctx.moveTo( 2, -10);
      ctx.lineTo(-5,   1);
      ctx.lineTo( 1,   1);
      ctx.lineTo(-2,  10);
      ctx.lineTo( 6,  -2);
      ctx.lineTo( 0,  -2);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Elige el tipo del próximo power-up: prioriza el efecto que no está activo
function pickPowerupType() {
  const hasSpeed  = ship && ship.speedBoost > 0;
  const hasTriple = ship && ship.tripleShot > 0;
  if (hasSpeed && !hasTriple) return 'triple';
  if (hasTriple && !hasSpeed) return 'speed';
  return Math.random() < 0.5 ? 'speed' : 'triple';
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let shootingStarTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function spawnShootingStar() {
  const SAFE_DIST = 130;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
  asteroids.push(new ShootingStar(x, y));
}

function resetShootingStarTimer() {
  shootingStarTimer = rand(SHOOTING_STAR_INTERVAL_MIN, SHOOTING_STAR_INTERVAL_MAX);
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
  resetShootingStarTimer();
  skinToast = 1.5;
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  ship.reset();
  spawnAsteroids(3 + level);
  resetShootingStarTimer();
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambio de skin (disponible en cualquier estado)
  if (pressed('KeyS')) cycleSkin();
  if (skinToast > 0) skinToast -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Escudo (alternar) — se leen ambos para no dejar flags pendientes
  const shiftPressed = pressed('ShiftLeft') | pressed('ShiftRight');
  if (shiftPressed) ship.toggleShield();

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);

  // Aparición periódica de la estrella fugaz (máx. una a la vez)
  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) {
    if (!asteroids.some(a => a instanceof ShootingStar)) spawnShootingStar();
    resetShootingStarTimer();
  }

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        a.dead = true;
        score += a.points;
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        if (Math.random() < POWERUP_CHANCE)
          powerups.push(new PowerUp(a.x, a.y, pickPowerupType()));
        // Las balas perforantes siguen de largo hasta agotar su carga
        if (b.pierce > 0) b.pierce--;
        else b.dead = true;
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs powerup
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'triple') ship.tripleShot = POWERUP_DURATION;
      else                     ship.speedBoost = POWERUP_DURATION;
      explode(p.x, p.y, 6);
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Nave vs asteroide (el escudo absorbe el golpe si está activo)
  if (ship.invincible <= 0) {
    const shieldSplit = [];
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.absorbHit()) {
          a.dead = true;
          score += a.points;
          explode(a.x, a.y, a.size * 5);
          const kids = a.split();
          if (kids.length) {
            // Reubica los fragmentos fuera del radio del escudo
            for (const k of kids) {
              const ang = rand(0, Math.PI * 2);
              k.x = wrap(ship.x + Math.cos(ang) * (ship.shieldRadius + k.radius + 6), W);
              k.y = wrap(ship.y + Math.sin(ang) * (ship.shieldRadius + k.radius + 6), H);
              shieldSplit.push(k);
            }
          }
          if (Math.random() < POWERUP_CHANCE)
            powerups.push(new PowerUp(a.x, a.y, pickPowerupType()));
        } else {
          killShip();
        }
        break;
      }
    }
    if (shieldSplit.length)
      asteroids = asteroids.concat(shieldSplit);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[skinIndex];
  const S = 0.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = skin.color;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(skin.verts[0][0] * S, skin.verts[0][1] * S);
  for (let i = 1; i < skin.verts.length; i++)
    ctx.lineTo(skin.verts[i][0] * S, skin.verts[i][1] * S);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  let y = 52;

  if (ship) {
    // Energía del escudo + golpes restantes
    const shieldPct = ship.shieldEnergy / ship.shieldMax;
    const hits      = ship.shield ? ship.shieldHits : ship.shieldMaxHits;
    ctx.textAlign = 'left';
    ctx.fillStyle = ship.shield ? '#00e5ff' : 'rgba(0,229,255,0.6)';
    ctx.font = '13px monospace';
    ctx.fillText(
      `ESCUDO  ${'●'.repeat(hits)}${'○'.repeat(ship.shieldMaxHits - hits)}  ${Math.round(ship.shieldEnergy)}%`,
      14, y
    );
    ctx.fillStyle = 'rgba(0,229,255,0.25)';
    ctx.fillRect(14, y + 6, 150, 6);
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(14, y + 6, 150 * shieldPct, 6);
    y += 26;
  }

  if (ship && (ship.speedBoost > 0 || ship.tripleShot > 0)) {
    const effects = [];
    if (ship.speedBoost > 0)
      effects.push({ label: 'VELOCIDAD', time: ship.speedBoost, color: '#00e5ff', rgb: '0,229,255' });
    if (ship.tripleShot > 0)
      effects.push({ label: 'TRIPLE',    time: ship.tripleShot, color: '#ff4dd2', rgb: '255,77,210' });

    ctx.textAlign = 'left';
    ctx.font = '13px monospace';
    for (const e of effects) {
      ctx.fillStyle = e.color;
      ctx.fillText(`${e.label}  ${e.time.toFixed(1)}s`, 14, y);
      ctx.fillStyle = `rgba(${e.rgb},0.25)`;
      ctx.fillRect(14, y + 6, 150, 6);
      ctx.fillStyle = e.color;
      ctx.fillRect(14, y + 6, 150 * (e.time / POWERUP_DURATION), 6);
      y += 26;
    }
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '11px monospace';
  ctx.fillText('S  CAMBIAR SKIN  ·  SHIFT  ESCUDO', W - 14, H - 12);
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerups.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (skinToast > 0) {
    const skin = SKINS[skinIndex];
    ctx.textAlign = 'center';
    ctx.font = '14px monospace';
    ctx.fillStyle = skin.color;
    ctx.globalAlpha = Math.min(1, skinToast / 0.4);
    ctx.fillText(`SKIN  ${skin.name}  ·  ${skin.trait}`, W / 2, H - 40);
    ctx.globalAlpha = 1;
  }

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
