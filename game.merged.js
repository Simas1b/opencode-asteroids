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
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
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

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
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

// ── Escudo ────────────────────────────────────────────────────────────────────
const SHIELD_MAX_ENERGY   = 100;  // barra completa
const SHIELD_DRAIN        = 25;   // energía por segundo activo (4 s máx.)
const SHIELD_RECHARGE     = 12;   // energía por segundo inactivo
const SHIELD_MIN_TO_START = 20;   // energía mínima para encenderlo
const SHIELD_MAX_HITS     = 3;    // golpes absorbidos por activación
const SHIELD_RADIUS       = 26;

// ── Skins de la nave ──────────────────────────────────────────────────────────
const SKINS = [
  {
    name: 'CLÁSICA',
    color: '#fff',
    flame: 'rgba(255, 130, 0, 0.85)',
    flameX: -8,
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
  },
  {
    name: 'HALCÓN',
    color: '#7cf9ff',
    flame: 'rgba(0, 220, 255, 0.9)',
    flameX: -7,
    verts: [[20, 0], [4, -7], [-4, -4], [-12, -10], [-10, -1], [-6, 0], [-10, 1], [-12, 10], [-4, 4], [4, 7]],
  },
  {
    name: 'ROMBO',
    color: '#ff5fd0',
    flame: 'rgba(255, 95, 208, 0.9)',
    flameX: -13,
    verts: [[20, 0], [0, -9], [-14, 0], [0, 9]],
  },
  {
    name: 'SIGILOSA',
    color: '#ffd800',
    flame: 'rgba(255, 216, 0, 0.9)',
    flameX: -10,
    verts: [[20, 0], [0, -7], [-13, -6], [-9, 0], [-13, 6], [0, 7]],
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
