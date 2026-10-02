(() => {
'use strict';
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d'), scr = $('#screen'), menu = $('#menu');
const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const cfg = Object.assign({ mode: 1, diff: 1, disp: 'fit' }, LS.get('ri_cfg', {}));
// lives, fréquence de tir ennemi, vitesse de marche, vitesse des tirs, tirs ennemis simultanés
const DIF = [
  { lives: 5, fire: .7, spd: .85, bs: .85, mb: 2 },
  { lives: 3, fire: 1, spd: 1.1, bs: 1, mb: 3 },
  { lives: 2, fire: 1.5, spd: 1.4, bs: 1.25, mb: 4 }
];
const PAL = {
  1: { bg: '#00060f', fg: ['#4da6ff', '#4da6ff', '#4da6ff'], ship: '#a8d4ff', ufo: '#cfe6ff', sh: '#2f86e0', bu: '#cfe6ff', eb: '#7fbfff', tx: '#6db6ff' },
  2: { bg: '#0b0016', fg: ['#ff2bd6', '#00f0ff', '#b6ff00'], ship: '#ffe600', ufo: '#ff3b3b', sh: '#39ff14', bu: '#ffffff', eb: '#ff9a00', tx: '#00f0ff' }
};
let P = PAL[cfg.mode];

// ---------- sprites ----------
const mk = rows => {
  const runs = [];
  rows.forEach((row, r) => { for (const m of row.matchAll(/1+/g)) runs.push([m.index, r, m[0].length]); });
  return { w: rows[0].length, runs };
};
const SQ = [mk(['00011000', '00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101']),
            mk(['00011000', '00111100', '01111110', '11011011', '11111111', '01011010', '10000001', '01000010'])];
const CR = [mk(['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000']),
            mk(['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'])];
const OC = [mk(['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '000110011000', '001101101100', '110000000011']),
            mk(['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '001110011100', '011001100110', '001100001100'])];
const SHP = mk(['0000001000000', '0000011100000', '0000011100000', '0111111111110', '1111111111111', '1111111111111', '1111111111111', '1111111111111']);
const UFS = mk(['0000011111100000', '0001111111111000', '0011111111111100', '0110110110110110', '1111111111111111', '0011100110011100', '0001000000001000']);
const TY = [SQ, CR, OC], PTS = [30, 20, 10];
function dr(sp, x, y, s, col) {
  ctx.fillStyle = col;
  for (const [c0, r, l] of sp.runs) ctx.fillRect(x + c0 * s, y + r * s, l * s, s);
}

// ---------- audio (Web Audio, sons synthétiques d'époque) ----------
let ac, nbuf;
const m1 = () => cfg.mode === 1;
function aud() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const l = ac.sampleRate; nbuf = ac.createBuffer(1, l, l);
    const d = nbuf.getChannelData(0); for (let i = 0; i < l; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}
function tone(f1, f2, d, ty, v, dl = 0) {
  if (!ac) return;
  const t = ac.currentTime + dl, o = ac.createOscillator(), g = ac.createGain();
  o.type = ty; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
function nz(d, v, f, dl = 0) {
  if (!ac) return;
  const t = ac.currentTime + dl, s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
  s.buffer = nbuf; fl.type = 'lowpass';
  fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(100, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(fl).connect(g).connect(ac.destination); s.start(t); s.stop(t + d);
}
const wv = () => m1() ? 'square' : 'sawtooth';
const S = {
  shoot() { m1() ? tone(900, 150, .15, 'square', .08) : (tone(1500, 200, .2, 'sawtooth', .06), tone(750, 100, .2, 'square', .05)); },
  hit() { nz(.2, .2, 3000); m1() ? tone(350, 60, .15, 'square', .08) : tone(600, 40, .22, 'sawtooth', .08); },
  boom() { nz(1, .35, 1500); tone(180, 25, .9, wv(), .12); },
  march(i) { const f = [55, 49, 46, 41][i % 4] * 2; tone(f, f * .98, .1, wv(), .12); if (!m1()) tone(f * 2, f * 2, .08, 'triangle', .05); },
  ufo() { m1() ? tone(500, 800, .11, 'square', .04) : tone(1000, 1500, .11, 'sawtooth', .04); },
  ufoHit() { nz(.4, .25, 2500); [900, 700, 500, 300].forEach((f, i) => tone(f, f * .9, .1, 'square', .08, i * .08)); },
  start() { (m1() ? [262, 330, 392] : [262, 330, 392, 523, 659]).forEach((f, i) => tone(f, f, .12, wv(), .07, i * .1)); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, f, .14, wv(), .07, i * .12)); },
  over() { [392, 330, 262, 196].forEach((f, i) => tone(f, f * .97, .3, wv(), .08, i * .28)); }
};

// ---------- état ----------
let W = 0, H = 0, sc = 1, SY = 0, st = 'menu';
let score = 0, hi = 0, lives = 3, lvl = 1, yb = 50;
let inv = [], ox = 0, oy = 0, dir = 1, mt = 0, fr = 0, mi = 0;
let px = 0, pb = null, eb = [], shs = [], ufo = null, ut = 12, ef = 1, parts = [], pops = [], stars = [];
let dT = 0, lock = 0;
const keys = { l: 0, r: 0, f: 0 };
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- affichage / taille ----------
function fit() {
  const vw = innerWidth, vh = innerHeight, real = cfg.disp === 'real';
  if (st === 'menu' || !W) {
    W = 360; H = real ? 480 : cl(Math.round(360 * vh / vw), 440, 720);
    cv.width = W; cv.height = H; SY = H - 44;
    stars = Array.from({ length: 50 }, () => ({ x: rnd(0, W), y: rnd(0, H), a: rnd(.15, .5) }));
  }
  sc = real ? Math.min(1, vw / W, vh / H) : Math.min(vw / W, vh / H);
  scr.style.width = W * sc + 'px'; scr.style.height = H * sc + 'px';
  scr.style.setProperty('--u', sc + 'px');
}
function sync() {
  document.body.className = 'm' + cfg.mode; P = PAL[cfg.mode];
  menu.querySelectorAll('.g').forEach(g => g.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', String(cfg[g.dataset.k]) === b.dataset.v)));
  LS.set('ri_cfg', cfg);
}
menu.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'go') return start();
  const k = b.parentNode.dataset.k; cfg[k] = k === 'disp' ? b.dataset.v : +b.dataset.v;
  sync(); fit();
});

// ---------- jeu ----------
function newLevel() {
  inv = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) inv.push({ r, c, t: r ? (r < 3 ? 1 : 2) : 0, a: 1 });
  ox = 0; oy = 0; dir = 1; mt = 0; fr = 0; mi = 0; pb = null; eb = []; ufo = null; ut = rnd(12, 22); ef = 1; parts = []; pops = [];
  yb = 50 + Math.min(lvl - 1, 5) * 10;
  shs = [];
  for (let i = 0; i < 4; i++) {
    const c = new Uint8Array(264);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 22; x++) {
      let o = 1;
      if (y < 3 && (x < 3 - y || x > 18 + y)) o = 0;
      if (y > 7 && x > 7 && x < 14) o = 0;
      c[y * 22 + x] = o;
    }
    shs.push({ x: W / 2 + (i - 1.5) * 80 - 33, y: H - 120, c });
  }
}
function start() {
  aud(); fit();
  score = 0; lives = DIF[cfg.diff].lives; lvl = 1; px = W / 2; hi = LS.get('ri_hi' + cfg.mode, 0);
  newLevel(); st = 'play'; menu.style.display = 'none';
  if (document.activeElement) document.activeElement.blur();
  S.start();
  if (cfg.disp === 'fit' && document.fullscreenEnabled && matchMedia('(pointer:coarse)').matches) {
    const r = document.documentElement.requestFullscreen; if (r) r.call(document.documentElement).catch(() => {});
  }
}
function showMenu() { st = 'menu'; menu.style.display = ''; sync(); fit(); }
function over() {
  st = 'over'; lock = 1.2;
  if (score > hi) { hi = score; LS.set('ri_hi' + cfg.mode, hi); }
  S.over();
}
const iw = i => TY[i.t][0].w * 2;
const ipos = i => [ox + 26 + i.c * 28 + (28 - iw(i)) / 2, oy + yb + i.r * 24, iw(i)];
function boom(x, y, n, l, col) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.283), v = rnd(30, 100);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: l * rnd(.6, 1), c: col });
  }
}
function fire() { if (st === 'play' && !pb) { pb = { x: px, y: SY - 6 }; S.shoot(); } }
function die() {
  if (st !== 'play') return;
  lives--; boom(px, SY + 8, 28, 1.2, P.ship); S.boom(); st = 'dead'; dT = 1.5; eb = []; pb = null;
}
function hitSh(x, y, d) {
  for (const s of shs) {
    const lx = x - s.x, ly = y - s.y;
    if (lx >= 0 && lx < 66 && ly >= 0 && ly < 36) {
      const cx = lx / 3 | 0, cy = ly / 3 | 0;
      if (s.c[cy * 22 + cx]) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 2; dy++) {
          const nx = cx + dx, ny = cy + dy * d * -1 * -1;
          if (nx >= 0 && nx < 22 && ny >= 0 && ny < 12 && (dx === 0 && dy === 0 || Math.random() < .6)) s.c[ny * 22 + nx] = 0;
        }
        return true;
      }
    }
  }
  return false;
}
function eatSh() {
  for (const i of inv) {
    if (!i.a) continue;
    const [x, y, w] = ipos(i);
    if (y + 16 < H - 124) continue;
    for (const s of shs) {
      for (let cy = 0; cy < 12; cy++) for (let cx = 0; cx < 22; cx++) {
        const X = s.x + cx * 3, Y = s.y + cy * 3;
        if (X + 3 > x && X < x + w && Y + 3 > y && Y < y + 16) s.c[cy * 22 + cx] = 0;
      }
    }
  }
}
function march() {
  let L = 1e9, R = -1e9, B = 0;
  for (const i of inv) if (i.a) { const [x, y, w] = ipos(i); L = Math.min(L, x); R = Math.max(R, x + w); B = Math.max(B, y + 16); }
  if ((dir > 0 && R + 6 > W - 8) || (dir < 0 && L - 6 < 8)) { oy += 12; dir = -dir; B += 12; } else ox += 6 * dir;
  fr ^= 1; eatSh();
  if (B >= SY) { lives = 1; die(); }
}
function hitInv() {
  for (const i of inv) {
    if (!i.a) continue;
    const [x, y, w] = ipos(i);
    if (pb.x > x && pb.x < x + w && pb.y > y && pb.y < y + 16) {
      i.a = 0; score += PTS[i.t]; boom(x + w / 2, y + 8, 8, .3, P.fg[i.t]); S.hit(); return true;
    }
  }
  return false;
}
function hitUfo() {
  if (ufo && pb.x > ufo.x && pb.x < ufo.x + 32 && pb.y > 30 && pb.y < 46) {
    const p = [50, 100, 150, 300][Math.random() * 4 | 0];
    score += p; pops.push({ x: ufo.x + 16, y: 42, t: 1, s: p }); boom(ufo.x + 16, 38, 12, .5, P.ufo);
    S.ufoHit(); ufo = null; ut = rnd(15, 27); return true;
  }
  return false;
}
function upd(dt) {
  parts = parts.filter(p => (p.t -= dt) > 0); parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; });
  pops = pops.filter(p => (p.t -= dt) > 0);
  if (st === 'dead') { if ((dT -= dt) <= 0) { if (lives <= 0) over(); else { st = 'play'; px = W / 2; } } return; }
  if (st === 'clear') { if ((dT -= dt) <= 0) { lvl++; newLevel(); st = 'play'; S.start(); } return; }
  if (st !== 'play') return;
  const D = DIF[cfg.diff];
  px = cl(px + ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * 170 * dt, 16, W - 16);
  if (keys.f) fire();
  // tir du joueur (pas de 2 px pour ne pas traverser les boucliers)
  if (pb) {
    let d = 430 * dt;
    while (d > 0 && pb) {
      const s = Math.min(2, d); pb.y -= s; d -= s;
      if (pb.y < 28 || hitSh(pb.x, pb.y, -1) || hitInv() || hitUfo()) pb = null;
    }
  }
  // marche des envahisseurs
  const n = inv.filter(i => i.a).length;
  if (!n) { st = 'clear'; dT = 1.8; S.win(); return; }
  mt -= dt;
  if (mt <= 0) {
    mt = (.04 + .6 * n / 55) / (D.spd * (1 + .1 * (lvl - 1))); if (n === 1) mt *= .7;
    march(); if (st !== 'play') return; S.march(mi++);
  }
  // tirs ennemis
  ef -= dt;
  if (ef <= 0 && eb.length < D.mb) {
    ef = rnd(.3, 1.2) / (D.fire * (1 + .08 * (lvl - 1)));
    const col = {}; inv.forEach(i => { if (i.a && (!col[i.c] || i.r > col[i.c].r)) col[i.c] = i; });
    const ks = Object.values(col);
    let i = ks[Math.random() * ks.length | 0];
    if (Math.random() < .4) i = ks.reduce((a, b) => { const A = ipos(a), B = ipos(b); return Math.abs(A[0] + A[2] / 2 - px) < Math.abs(B[0] + B[2] / 2 - px) ? a : b; });
    const [x, y, w] = ipos(i); eb.push({ x: x + w / 2, y: y + 16 });
  }
  eb = eb.filter(b => {
    let d = 130 * D.bs * (1 + .04 * lvl) * dt;
    while (d > 0) {
      const s = Math.min(2, d); b.y += s; d -= s;
      if (st !== 'play') return false;
      if (hitSh(b.x, b.y + 8, 1)) return false;
      if (b.y + 8 > SY && b.y < SY + 16 && Math.abs(b.x - px) < 12) { die(); return false; }
    }
    return b.y < H;
  });
  if (st === 'dead') eb = [];
  // soucoupe
  ut -= dt;
  if (!ufo && ut <= 0) { const l = Math.random() < .5; ufo = { x: l ? -34 : W + 2, d: l ? 1 : -1, sn: 0 }; }
  if (ufo) {
    ufo.x += ufo.d * 70 * dt;
    if ((ufo.sn -= dt) <= 0) { ufo.sn = .12; S.ufo(); }
    if (ufo.x < -40 || ufo.x > W + 40) { ufo = null; ut = rnd(15, 27); }
  }
}

// ---------- rendu ----------
const pad = n => String(n).padStart(5, '0');
function tx(s, x, y, z, a, c) {
  ctx.font = 'bold ' + z + 'px "Courier New",monospace'; ctx.textAlign = a || 'left'; ctx.fillStyle = c || P.tx; ctx.fillText(s, x, y);
}
function draw() {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  if (cfg.mode === 2) { ctx.fillStyle = '#9fa8ff'; stars.forEach(s => { ctx.globalAlpha = s.a; ctx.fillRect(s.x, s.y, 1, 1); }); ctx.globalAlpha = 1; }
  if (st === 'menu') return;
  tx('SCORE ' + pad(score), 8, 18, 13); tx('HI ' + pad(Math.max(hi, score)), W - 8, 18, 13, 'right');
  ctx.fillStyle = P.sh; ctx.fillRect(0, H - 24, W, 1);
  tx(String(Math.max(lives, 0)), 8, H - 7, 12);
  for (let i = 0; i < Math.min(lives, 8); i++) dr(SHP, 24 + i * 16, H - 17, 1, P.ship);
  tx('NIV ' + lvl, W - 8, H - 7, 12, 'right');
  ctx.fillStyle = P.sh;
  for (const s of shs) for (let y = 0; y < 12; y++) for (let x = 0; x < 22; x++) if (s.c[y * 22 + x]) ctx.fillRect(s.x + x * 3, s.y + y * 3, 3, 3);
  for (const i of inv) if (i.a) { const [x, y] = ipos(i); dr(TY[i.t][fr], x, y, 2, P.fg[i.t]); }
  if (ufo) dr(UFS, ufo.x, 32, 2, P.ufo);
  if (st !== 'dead') dr(SHP, px - 13, SY, 2, P.ship);
  if (pb) { ctx.fillStyle = P.bu; ctx.fillRect(pb.x - 1, pb.y, 2, 8); }
  ctx.fillStyle = P.eb;
  for (const b of eb) { const z = (b.y / 6 | 0) % 2; ctx.fillRect(b.x - 1 + z, b.y, 2, 4); ctx.fillRect(b.x - 1 + 1 - z, b.y + 4, 2, 4); }
  for (const p of parts) { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 2, 2); }
  for (const p of pops) tx(String(p.s), p.x, p.y, 11, 'center', P.ufo);
  if (st === 'clear') tx('NIVEAU ' + (lvl + 1), W / 2, H / 2, 22, 'center');
  if (st === 'pause') { tx('PAUSE', W / 2, H / 2, 26, 'center'); tx('toucher pour reprendre', W / 2, H / 2 + 24, 11, 'center'); }
  if (st === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
    tx('GAME OVER', W / 2, H / 2 - 10, 28, 'center'); tx('SCORE ' + pad(score), W / 2, H / 2 + 16, 14, 'center');
    if (lock <= 0) tx('toucher pour rejouer', W / 2, H / 2 + 44, 11, 'center');
  }
}
let last = 0;
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  if (lock > 0) lock -= dt;
  upd(dt); draw(); requestAnimationFrame(loop);
}

// ---------- contrôles ----------
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k) && st !== 'menu') e.preventDefault();
  if (k === 'ArrowLeft') keys.l = 1; else if (k === 'ArrowRight') keys.r = 1; else if (k === 'ArrowUp' || k === ' ') keys.f = 1;
  if (st === 'menu') { if (k === 'Enter') { e.preventDefault(); start(); } return; }
  if (st === 'over' && lock <= 0 && (k === 'Enter' || k === ' ')) showMenu();
  else if (k === 'p' || k === 'P') st = st === 'play' ? 'pause' : st === 'pause' ? 'play' : st;
  else if (st === 'pause' && (k === 'Enter' || k === ' ')) st = 'play';
  else if (k === 'Escape' && (st === 'play' || st === 'pause')) showMenu();
});
addEventListener('keyup', e => {
  const k = e.key;
  if (k === 'ArrowLeft') keys.l = 0; else if (k === 'ArrowRight') keys.r = 0; else if (k === 'ArrowUp' || k === ' ') keys.f = 0;
});
// tactile : glisser ← → = déplacer, glisser ↑ ou toucher = tirer
let t0 = null;
cv.addEventListener('touchstart', e => {
  e.preventDefault(); const t = e.touches[0]; aud();
  t0 = { y: t.clientY, lx: t.clientX, t: performance.now(), m: 0 };
  if (st === 'pause') st = 'play'; else if (st === 'over' && lock <= 0) showMenu();
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault(); if (!t0 || st !== 'play') return;
  const t = e.touches[0], dx = (t.clientX - t0.lx) / sc;
  t0.lx = t.clientX; t0.m += Math.abs(dx);
  px = cl(px + dx * 1.3, 16, W - 16);
  if (t0.y - t.clientY > 30) { t0.m += 99; fire(); }
}, { passive: false });
cv.addEventListener('touchend', e => {
  e.preventDefault();
  if (t0 && performance.now() - t0.t < 250 && t0.m < 12) fire();
  t0 = null;
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && st === 'play') st = 'pause'; });
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 150));

sync(); fit(); requestAnimationFrame(loop);
})();
