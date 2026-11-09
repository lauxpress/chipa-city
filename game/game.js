// TARAGÜÍ TURBO — prototipo top-down 8 bits sobre el mapa real de Corrientes.
// Mapa: © OpenStreetMap contributors (ODbL). Edificios: Microsoft Global ML Building Footprints (ODbL).
// Todo lo demás se dibuja por código.
'use strict';
(() => {
// ============================================================ MAPA
const MD = window.MAPDATA;
const W = MD.w, H = MD.h, TS = 12; // 12 px por tile de 2,25 m (5,33 px por metro)
const T_BLOCK = 0, T_ROAD = 1, T_SIDE = 2, T_GRASS = 3, T_WATER = 4, T_SAND = 5,
      T_PEAT = 6, T_BRIDGE = 7, T_OSMB = 8, T_PARK = 9, T_PATH = 10, T_YARD = 11, T_BRIDGEW = 12, T_MEDIAN = 13, T_DIRT = 14;

const tiles = new Uint8Array(W * H);
{
  const bin = atob(MD.tiles); let p = 0;
  for (let i = 0; i < bin.length; i += 2) { const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1); tiles.fill(v, p, p + n); p += n; }
}
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? T_BLOCK : tiles[ty * W + tx];
const tileAtPx = (x, y) => tileAt(Math.floor(x / TS), Math.floor(y / TS));
const SOLID     = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
const ROADLIKE  = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0];
const DRIVEABLE = [0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0];
const WALK_CALM = [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0];
const WALK_FLEE = [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1];
// ¿Hay WebGL? Entonces dibujamos en 3D (render3d.js). Con #2d en la URL se fuerza el modo plano.
const USE3D = !!(window.THREE && window.createRender3D) && !/2d/.test(location.hash) && (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
})();
const VS = 4, FLOOR = 10; // escala vertical: 4 px por metro; los pisos un poco comprimidos (10 px) para que se vea la calle
const solidPx = (x, y) => SOLID[tileAtPx(x, y)] === 1;
const isBuilding = t => t === T_BLOCK || t === T_OSMB;

// ============================================================ UTIL
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function shade(hex, k) {
  const c = hex2rgb(hex).map(v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g];
}
function disc(g, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5)); g.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
}

// ============================================================ RED VIAL
const NN = MD.nodes.length / 2;
const nx = new Float32Array(NN), ny = new Float32Array(NN);
for (let i = 0; i < NN; i++) { nx[i] = (MD.nodes[2 * i] + 0.5) * TS; ny[i] = (MD.nodes[2 * i + 1] + 0.5) * TS; }
const EC = MD.edges.length / 4;
const ea = new Int32Array(EC), eb = new Int32Array(EC), ef = new Uint8Array(EC), en = new Int32Array(EC);
const elen = new Float32Array(EC), edx = new Float32Array(EC), edy = new Float32Array(EC);
const eoff = new Float32Array(EC).fill(NaN), epark = new Float32Array(EC), ehalf = new Float32Array(EC);
const out = Array.from({ length: NN }, () => []);
const nbrs = Array.from({ length: NN }, () => new Set());
const DRIVE_EDGES = [];
for (let i = 0; i < EC; i++) {
  const a = MD.edges[4 * i], b = MD.edges[4 * i + 1];
  ea[i] = a; eb[i] = b; ef[i] = MD.edges[4 * i + 2]; en[i] = MD.edges[4 * i + 3];
  const dx = nx[b] - nx[a], dy = ny[b] - ny[a], l = Math.hypot(dx, dy) || 1;
  elen[i] = l; edx[i] = dx / l; edy[i] = dy / l;
  if (ef[i] & 1) { out[a].push(i); DRIVE_EDGES.push(i); nbrs[a].add(b); nbrs[b].add(a); }
}
const deg = i => nbrs[i].size;
// grilla de calles manejables para generar tráfico cerca del jugador
const DCELL = 256, driveGrid = new Map();
for (const e of DRIVE_EDGES) {
  const k = Math.floor((ny[ea[e]] + ny[eb[e]]) / 2 / DCELL) * 4096 + Math.floor((nx[ea[e]] + nx[eb[e]]) / 2 / DCELL);
  let l = driveGrid.get(k); if (!l) driveGrid.set(k, l = []); l.push(e);
}

// Mide el ancho real de la calle (en tiles) para ubicar carriles y autos estacionados.
function laneInfo(e) {
  if (!isNaN(eoff[e])) return;
  const a = ea[e], mx = (nx[a] + nx[eb[e]]) / 2, my = (ny[a] + ny[eb[e]]) / 2, rx = -edy[e], ry = edx[e];
  let dp = 0, dn = 0;
  while (dp < 100 && DRIVEABLE[tileAtPx(mx + rx * dp, my + ry * dp)]) dp += 2;
  while (dn < 100 && DRIVEABLE[tileAtPx(mx - rx * dn, my - ry * dn)]) dn += 2;
  const c = (dp - dn) / 2, half = (dp + dn) / 2;
  ehalf[e] = half;
  eoff[e] = (ef[e] & 2) ? c + half * 0.42 : c;
  epark[e] = c + half - 7;
}

// Segmentos para las líneas pintadas (doble mano)
const MARKS = [];
for (let i = 0; i < EC; i++) {
  if (!(ef[i] & 1)) continue;
  const two = ef[i] & 2, multi = ef[i] & 4;
  if (two && ea[i] > eb[i]) continue;
  if (!two && !multi) continue;
  const a = ea[i], b = eb[i];
  const base = { ax: nx[a], ay: ny[a], dx: edx[i], dy: edy[i], len: elen[i],
    t0: deg(a) > 2 ? 44 : 0, t1: deg(b) > 2 ? 44 : 0,
    minx: Math.min(nx[a], nx[b]) - 40, maxx: Math.max(nx[a], nx[b]) + 40, miny: Math.min(ny[a], ny[b]) - 40, maxy: Math.max(ny[a], ny[b]) + 40 };
  if (two) MARKS.push({ ...base, off: 0, col: '#d8c050' });
  if (multi) {
    laneInfo(i);
    const c = eoff[i] - (two ? ehalf[i] * 0.42 : 0);
    if (two) { MARKS.push({ ...base, off: c + ehalf[i] * 0.5, col: '#e8e8e8' }); MARKS.push({ ...base, off: c - ehalf[i] * 0.5, col: '#e8e8e8' }); }
    else MARKS.push({ ...base, off: c, col: '#e8e8e8' });
  }
}

// Índice espacial de calles para mostrar el nombre de la calle actual
const NCELL = 128, nameGrid = new Map();
for (let i = 0; i < EC; i++) {
  if (!MD.names[en[i]]) continue;
  const a = ea[i], b = eb[i];
  const x0 = Math.floor((Math.min(nx[a], nx[b]) - 48) / NCELL), x1 = Math.floor((Math.max(nx[a], nx[b]) + 48) / NCELL);
  const y0 = Math.floor((Math.min(ny[a], ny[b]) - 48) / NCELL), y1 = Math.floor((Math.max(ny[a], ny[b]) + 48) / NCELL);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const k = cy * 4096 + cx; let l = nameGrid.get(k); if (!l) nameGrid.set(k, l = []); l.push(i);
  }
}
function segDist2(px, py, e) {
  const a = ea[e]; let t = (px - nx[a]) * edx[e] + (py - ny[a]) * edy[e]; t = clamp(t, 0, elen[e]);
  return dist2(px, py, nx[a] + edx[e] * t, ny[a] + edy[e] * t);
}
function streetName(px, py) {
  const l = nameGrid.get(Math.floor(py / NCELL) * 4096 + Math.floor(px / NCELL)); if (!l) return '';
  let best = 48 * 48, name = '';
  for (const e of l) { const d = segDist2(px, py, e); if (d < best) { best = d; name = MD.names[en[e]]; } }
  return name;
}
function nearestDriveEdge(px, py) {
  let best = Infinity, be = -1;
  for (const e of DRIVE_EDGES) { const d = segDist2(px, py, e); if (d < best) { best = d; be = e; } }
  return be;
}

// ============================================================ TEXTURAS
const V = 4;
function tex(seed, base, fn) {
  const [c, g] = canvas(TS, TS), id = g.createImageData(TS, TS), r = rng(seed), b = hex2rgb(base);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const col = fn(x, y, r) || b, i = (y * TS + x) * 4;
    id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return c;
}
const variants = (seed, base, fn) => [...Array(V)].map((_, i) => tex(seed + i * 17, base, (x, y, r) => fn(x, y, r, i)));
const TEX = [];
TEX[T_ROAD] = variants(1, '#3a3a44', (x, y, r) => { const v = r(); return v < 0.07 ? [68, 68, 80] : v < 0.13 ? [48, 48, 58] : null; });
TEX[T_BRIDGE] = variants(2, '#44444e', (x, y, r) => { const v = r(); return v < 0.08 ? [76, 76, 88] : v < 0.12 ? [54, 54, 64] : null; });
TEX[T_SIDE] = variants(3, '#9a9aa4', (x, y, r) => (x % 8 === 0 || y % 8 === 0) ? [128, 128, 138] : r() < 0.08 ? [168, 168, 176] : null);
TEX[T_GRASS] = variants(4, '#3f8a3a', (x, y, r) => { const v = r(); return v < 0.004 ? [236, 224, 96] : v < 0.006 ? [240, 240, 240] : v < 0.18 ? [76, 154, 66] : v < 0.3 ? [52, 120, 48] : null; });
TEX[T_WATER] = variants(5, '#2a5aa8', (x, y, r, i) => ((x + y * 5 + i * 3) % 13 === 0 && y % 4 === i % 4) ? [84, 140, 214] : (x + i * 2 + y * 3) % 17 === 0 && y % 4 === (i + 2) % 4 ? [70, 120, 200] : r() < 0.06 ? [36, 78, 152] : null);
TEX[T_SAND] = variants(6, '#d8c48a', (x, y, r) => { const v = r(); return v < 0.12 ? [196, 172, 114] : v < 0.17 ? [234, 216, 164] : null; });
TEX[T_PEAT] = variants(7, '#a8584a', (x, y, r) => (y % 5 === 0 || x % 8 === ((Math.floor(y / 5) % 2) ? 4 : 0)) ? [124, 62, 50] : r() < 0.1 ? [186, 104, 88] : null);
TEX[T_PARK] = variants(8, '#4a4a54', (x, y, r) => (x === 0 && y > 1 && y < 14) ? [208, 208, 208] : r() < 0.07 ? [80, 80, 92] : null);
TEX[T_PATH] = TEX[T_GRASS];
TEX[T_MEDIAN] = variants(31, '#4a9440', (x, y, r) => { const v = r(); return v < 0.16 ? [86, 164, 72] : v < 0.26 ? [60, 128, 52] : null; });
TEX[T_DIRT] = variants(32, '#8c7454', (x, y, r) => { const v = r(); return v < 0.12 ? [116, 96, 70] : v < 0.2 ? [164, 140, 104] : v < 0.23 ? [180, 172, 160] : null; });
TEX[T_BRIDGEW] = USE3D ? TEX[T_WATER] : TEX[T_BRIDGE]; // en 3D el tablero va arriba y abajo se ve el río // los senderos se dibujan aparte, como líneas suaves
// Senderos de plazas y parques (polilíneas de OSM)
const PATHS = [];
for (const pl of MD.paths || []) for (let i = 0; i + 3 < pl.length; i += 2) {
  const ax = (pl[i] + 0.5) * TS, ay = (pl[i + 1] + 0.5) * TS, bx = (pl[i + 2] + 0.5) * TS, by = (pl[i + 3] + 0.5) * TS;
  PATHS.push({ ax, ay, bx, by, minx: Math.min(ax, bx), maxx: Math.max(ax, bx), miny: Math.min(ay, by), maxy: Math.max(ay, by) });
}

const CH0 = 32, CPX0 = CH0 * TS; // tamaño de chunk (igual a CH / CPX)
TEX[T_YARD] = variants(10, '#4f7a42', (x, y, r, i) => {
  const v = r();
  if (i === 3 && (x * 7 + y * 3) % 11 < 5) return v < 0.3 ? [112, 92, 66] : [128, 106, 76]; // tierra
  return v < 0.12 ? [90, 136, 72] : v < 0.22 ? [68, 102, 56] : v < 0.24 ? [128, 106, 76] : null;
});
// ---- Piso en alta: en 3D los chunks se dibujan a GS× (24 px por tile ≈ 10,7 px por metro) con texturas propias
const GS = USE3D ? 2 : 1, TT = TS * GS;
const T_DOCK = 15; // solo para el piso en alta: el adoquín que cae sobre un muelle (props.docks) se pinta de madera
const TEXD = []; // píxeles de cada textura (para el pase de bordes suaves)
if (GS > 1) {
  const texN = (seed, fn) => {
    const [c, g] = canvas(TT, TT), id = g.createImageData(TT, TT), r = rng(seed);
    for (let y = 0; y < TT; y++) for (let x = 0; x < TT; x++) {
      const col = fn(x, y, r), i = (y * TT + x) * 4;
      id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0); return c;
  };
  const vars = (seed, fn) => [...Array(V)].map((_, i) => texN(seed + i * 17, (x, y, r) => fn(x, y, r, i)));
  const sh = (c, k) => [c[0] + k, c[1] + k, c[2] + k];
  // asfalto: árido claro, poros oscuros y manchones grandes apenas distintos
  const asphalt = (base, s0) => vars(s0, (x, y, r, i) => {
    const v = r(), b = sh(base, Math.round((hash(x >> 3, y >> 3, 90 + i) - 0.5) * 6));
    return v < 0.045 ? sh(b, 22) : v < 0.11 ? sh(b, -10) : v < 0.2 ? sh(b, 6) : b;
  });
  TEX[T_ROAD] = asphalt([58, 58, 66], 101);
  TEX[T_BRIDGE] = asphalt([70, 70, 78], 102);
  TEX[T_PARK] = vars(103, (x, y, r, i) => {
    if (x < 2 && y > 2 && y < TT - 3) return [214, 212, 204]; // línea de la cochera
    const v = r(), b = sh([66, 66, 72], Math.round((hash(x >> 3, y >> 3, 95 + i) - 0.5) * 6));
    return v < 0.05 ? sh(b, 20) : v < 0.12 ? sh(b, -9) : b;
  });
  // vereda: baldosas "vainilla" de 6 px con junta, cada una con su tono y sus 4 puntitos
  TEX[T_SIDE] = vars(104, (x, y, r, i) => {
    const b = 6, bx = Math.floor(x / b), by = Math.floor(y / b);
    if (x % b === 0 || y % b === 0) return [132, 129, 124];
    let c = 172 + Math.round((hash(bx + i * 7, by, 33) - 0.5) * 14);
    if ((x % b === 2 || x % b === 4) && (y % b === 2 || y % b === 4)) c -= 9;
    const v = r(); if (v < 0.05) c += 10; else if (v < 0.09) c -= 12;
    if (i === 3 && bx === 2 && by === 1 && (x + y) % 3 === 0) c -= 30; // baldosa rajada
    return [c, c - 3, c - 8];
  });
  const grassFn = (base, lush) => (x, y, r, i) => {
    const v = r(), bl = hash(x >> 2, y >> 2, 40 + i);
    if (v < 0.003) return [236, 224, 96]; if (v < 0.005) return [240, 240, 240];
    if ((x * 3 + y * 7 + i * 11) % 19 === 0) return [base[0] + 30, base[1] + 36, base[2] + 20]; // briznas
    if (v < 0.16) return [base[0] + 15, base[1] + 18, base[2] + 10];
    if (v < 0.3) return [base[0] - 12, base[1] - 20, base[2] - 8];
    return [base[0] + Math.round((bl - 0.5) * 10), base[1] + Math.round((bl - 0.5) * lush), base[2] + Math.round((bl - 0.5) * 8)];
  };
  TEX[T_GRASS] = TEX[T_PATH] = vars(105, grassFn([62, 132, 54], 18));
  TEX[T_MEDIAN] = vars(106, grassFn([72, 144, 60], 8));
  TEX[T_SAND] = vars(107, (x, y, r, i) => {
    const v = r();
    if ((y + Math.round(2 * Math.sin((x + i * 5) * 0.45))) % 7 === 0) return [198, 176, 120]; // ondas que deja el viento
    return v < 0.1 ? [196, 174, 118] : v < 0.16 ? [236, 220, 170] : [216, 198, 140];
  });
  TEX[T_PEAT] = vars(108, (x, y, r, i) => { // adoquín de ladrillo trabado de la peatonal
    const row = Math.floor(y / 4), off = (row % 2) * 4, bx = Math.floor((x + off) / 8);
    if (y % 4 === 0 || (x + off) % 8 === 0) return [118, 66, 54];
    const c = Math.round((hash(bx + i * 9, row, 34) - 0.5) * 22), v = r();
    return [172 + c + (v < 0.08 ? 14 : 0), 92 + c / 2, 74 + c / 3];
  });
  TEX[T_DIRT] = vars(109, (x, y, r) => { const v = r(); return v < 0.03 ? [182, 174, 160] : v < 0.15 ? [114, 94, 68] : v < 0.24 ? [162, 138, 102] : [140, 116, 84]; });
  // madera de muelle (sin dirección: las tablas se pintan después siguiendo el muelle)
  TEX[T_DOCK] = vars(113, (x, y, r, i) => {
    const v = r(), b = Math.round((hash(x >> 2, y >> 3, 120 + i) - 0.5) * 16);
    return v < 0.06 ? [96 + b, 70 + b, 48 + b] : v < 0.12 ? [150 + b, 116 + b, 80 + b] : [128 + b, 96 + b, 66 + b];
  });
  // patio / terreno: pasto más seco con alguna mancha de tierra chica (sin cuadros enteros de tierra: se notaba la grilla)
  const yardG = grassFn([74, 118, 60], 14);
  TEX[T_YARD] = vars(110, (x, y, r, i) => {
    const v = yardG(x, y, r, i), dx = x - 7, dy = y - 15;
    if (i === 3 && dx * dx * 0.5 + dy * dy < 5 + 5 * hash(x, y, 111)) return [v[0] + 30, v[1] + 4, v[2] + 8]; // pisoteado
    return v;
  });
  for (const t in TEX) TEXD[t] = TEX[t].map(c => c.width === TT ? c.getContext('2d').getImageData(0, 0, TT, TT).data : null);
}

// ============================================================ EDIFICIOS (siluetas reales del satélite + OSM)
const BLD = [];
{
  const b = MD.buildings || []; let i = 0;
  while (i < b.length) {
    const kind = b[i], floors = b[i + 1], n = b[i + 2]; let x = b[i + 3], y = b[i + 4]; i += 5;
    const pts = new Float32Array(n * 2); pts[0] = x; pts[1] = y;
    for (let k = 1; k < n; k++) { x += b[i]; y += b[i + 1]; i += 2; pts[2 * k] = x; pts[2 * k + 1] = y; }
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, A = 0;
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const px = pts[2 * k], py = pts[2 * k + 1];
      minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py);
      A += pts[2 * j] * py - px * pts[2 * j + 1];
    }
    const id = BLD.length, m2 = Math.abs(A) / 2 * (3 / TS) ** 2;
    BLD.push({ id, kind, floors, pts, n, minx, maxx, miny, maxy, sign: A >= 0 ? 1 : -1, m2,
      sh: USE3D ? Math.min(40, Math.round(floors * FLOOR * 0.42)) : Math.min(18, Math.round(2 + floors * 1.4)), style: kind >= 10 ? ['chapa', 'teja', 'losa', 'membrana'][(kind - 10) >> 2] : roofStyle(id, kind, m2),
      pal: kind >= 10 ? (kind - 10) & 3 : -1 });
  }
}
function roofStyle(id, kind, m2) {
  const h = hash(id, 7, 3);
  if (kind === 1) return h < 0.4 ? 'teja' : h < 0.8 ? 'losa' : 'membrana';
  if (m2 < 250) return h < 0.42 ? 'chapa' : h < 0.64 ? 'teja' : h < 0.9 ? 'losa' : 'membrana';
  return h < 0.12 ? 'chapa' : h < 0.68 ? 'losa' : 'membrana';
}
// [base, contorno, luz, sombra interna]
const ROOF_PAL = {
  chapa: [['#8e9aa4', '#4e5862', '#b8c4cc', '#76828c'], ['#9a5a3e', '#4e2a1a', '#bc7a58', '#80482e'],
          ['#5a8066', '#2a4432', '#7ca28a', '#4a6a54'], ['#a84a42', '#56201c', '#c86c62', '#8a3a34']],
  teja: [['#b0583a', '#5a2618', '#d07a58', '#8a402a'], ['#a0503a', '#50241a', '#c27056', '#80402e']],
  losa: [['#9a9690', '#4a4642', '#bebab2', '#807c76'], ['#b4a684', '#5a5040', '#d4c8a8', '#968a6c'],
         ['#7c7a82', '#3a3840', '#a09ea6', '#66646c'], ['#a89a92', '#544a44', '#c8bab2', '#8c7e78']],
  membrana: [['#d6d2ca', '#78746c', '#f2eee6', '#bcb8b0'], ['#c2c6cc', '#686c72', '#e4e8ec', '#a6aab0']],
};
// nombres de OSM de los edificios (para los emblemáticos de landmarks.js)
{ const bn = MD.bnames || []; for (let i = 0; i + 1 < bn.length; i += 2) if (BLD[bn[i]]) BLD[bn[i]].name = MD.names[bn[i + 1]]; }
// si varios edificios comparten nombre y la ficha trae coordenadas (at: [lat, lon]), solo vale el más cercano
{
  const [S, Wb, N, E] = MD.bbox, mx = Math.cos((S + N) / 2 * Math.PI / 180) * 111320, my = 110574, tm = MD.tileMeters;
  for (const [name, spec] of Object.entries(window.LANDMARKS || {})) {
    if (!spec.at) continue;
    const x = ((spec.at[1] - Wb) * mx / tm + 0.5) * TS, y = ((N - spec.at[0]) * my / tm + 0.5) * TS;
    const same = BLD.filter(b => b.name === name);
    let best = null, bd = Infinity;
    for (const b of same) { const d = dist2((b.minx + b.maxx) / 2, (b.miny + b.maxy) / 2, x, y); if (d < bd) { bd = d; best = b; } }
    for (const b of same) if (b !== best) b.name = name + ' (otro)';
  }
}
function roofPalOf(bd) {
  const pals = ROOF_PAL[bd.style];
  return bd.pal >= 0 ? pals[Math.min(bd.pal, pals.length - 1)] : pals[Math.floor(hash(bd.id, 8, 3) * pals.length)];
}
const BCH = new Map();
for (const bd of BLD) {
  for (let cy = Math.floor(bd.miny / CPX0); cy <= Math.floor((bd.maxy + bd.sh) / CPX0); cy++)
    for (let cx = Math.floor(bd.minx / CPX0); cx <= Math.floor((bd.maxx + bd.sh) / CPX0); cx++) {
      const k = cy * 4096 + cx; let l = BCH.get(k); if (!l) BCH.set(k, l = []); l.push(bd);
    }
}
for (const l of BCH.values()) l.sort((a, b) => a.floors - b.floors || a.id - b.id);
const ROOF_OK = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1];
// Relleno de polígono por líneas de barrido: píxeles nítidos, sin antialias.
// Opcionalmente recorta por tipo de tile para que los techos no pisen veredas ni calles.
function scanPoly(pts, n, minyF, maxyF, ox, oy, clip, fn, dx = 0, dy = 0, size = CPX0) {
  const ya = Math.max(Math.floor(minyF + dy), oy), yb = Math.min(Math.ceil(maxyF + dy), oy + size);
  const xs = [];
  for (let y = ya; y < yb; y++) {
    const sy = y + 0.5 - dy; xs.length = 0;
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const ay = pts[2 * j + 1], by = pts[2 * k + 1];
      if ((ay <= sy) !== (by <= sy)) { const ax = pts[2 * j], bx = pts[2 * k]; xs.push(ax + (sy - ay) * (bx - ax) / (by - ay) + dx); }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(Math.round(xs[k]), ox), xb = Math.min(Math.round(xs[k + 1]), ox + size);
      if (xb <= xa) continue;
      if (!clip) { fn(xa - ox, xb - ox, y - oy); continue; }
      const ty = Math.floor(y / TS);
      for (let x = xa; x < xb;) {
        const tx = Math.floor(x / TS), e = Math.min(xb, (tx + 1) * TS);
        if (clip[tileAt(tx, ty)]) fn(x - ox, e - ox, y - oy);
        x = e;
      }
    }
  }
}
function inPoly(bd, x, y) {
  const p = bd.pts; let c = false;
  for (let k = 0, j = bd.n - 1; k < bd.n; j = k++) {
    const ay = p[2 * j + 1], by = p[2 * k + 1];
    if ((ay <= y) !== (by <= y) && x < p[2 * j] + (y - ay) * (p[2 * k] - p[2 * j]) / (by - ay)) c = !c;
  }
  return c;
}
const rectInside = (bd, x, y, w, h) => inPoly(bd, x, y) && inPoly(bd, x + w, y) && inPoly(bd, x, y + h) && inPoly(bd, x + w, y + h) &&
  ROOF_OK[tileAtPx(x, y)] && ROOF_OK[tileAtPx(x + w, y + h)];
// Traza un borde agrupando píxeles consecutivos en tramos (pocos fillRect)
function edgeLine(g, ax, ay, bx, by, ox, oy, sx, sy) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  const horiz = Math.abs(bx - ax) >= Math.abs(by - ay);
  let rx = 0, ry = 0, rl = 0;
  const flush = () => { if (rl) { horiz ? g.fillRect(rx - ox, ry - oy, rl, 1) : g.fillRect(rx - ox, ry - oy, 1, rl); rl = 0; } };
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(ax + (bx - ax) * i / n) + sx, y = Math.floor(ay + (by - ay) * i / n) + sy;
    if (x < ox - 1 || y < oy - 1 || x > ox + CPX0 || y > oy + CPX0) { flush(); continue; }
    if (rl && (horiz ? (y === ry && x === rx + rl) : (x === rx && y === ry + rl))) { rl++; continue; }
    if (rl && (horiz ? (y === ry && x >= rx && x < rx + rl) : (x === rx && y >= ry && y < ry + rl))) continue;
    if (rl && horiz && y === ry && x === rx - 1) { rx--; rl++; continue; }
    if (rl && !horiz && x === rx && y === ry - 1) { ry--; rl++; continue; }
    flush(); rx = x; ry = y; rl = 1;
  }
  flush();
}
function makePatterns(g) {
  const pat = (w, h, fn) => { const [c, cg] = canvas(w, h); fn(cg); return g.createPattern(c, 'repeat'); };
  return {
    chapaH: pat(1, 2, cg => { cg.fillStyle = 'rgba(0,0,0,0.2)'; cg.fillRect(0, 1, 1, 1); }),
    chapaV: pat(2, 1, cg => { cg.fillStyle = 'rgba(0,0,0,0.2)'; cg.fillRect(1, 0, 1, 1); }),
    teja: pat(4, 4, cg => { cg.fillStyle = 'rgba(60,10,0,0.35)'; cg.fillRect(0, 3, 4, 1); cg.fillStyle = 'rgba(255,220,180,0.12)'; cg.fillRect(0, 0, 4, 1); cg.fillStyle = 'rgba(60,10,0,0.2)'; cg.fillRect(2, 1, 1, 2); }),
    losa: pat(16, 16, cg => { const r = rng(77); for (let i = 0; i < 26; i++) { cg.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.14)'; cg.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); } }),
    membrana: pat(8, 8, cg => { cg.fillStyle = 'rgba(0,0,0,0.08)'; cg.fillRect(7, 0, 1, 8); }),
  };
}
const SM = USE3D ? 42 : 20, SBINS = USE3D ? [6, 12, 20, 30, 40] : [4, 8, 12, 18];
const [shadowCv, shadowG] = canvas(CPX0 + SM, CPX0 + SM);
const binCvs = SBINS.map(() => canvas(CPX0 + SM, CPX0 + SM));
function polyPath(bd, ox, oy) {
  const path = new Path2D(), p = bd.pts;
  path.moveTo(p[0] - ox, p[1] - oy);
  for (let k = 1; k < bd.n; k++) path.lineTo(p[2 * k] - ox, p[2 * k + 1] - oy);
  path.closePath(); return path;
}
function drawBuildings(g, cx, cy) {
  const list = BCH.get(cy * 4096 + cx); if (!list) return;
  const ox = cx * CPX0, oy = cy * CPX0;
  const paths = list.map(bd => polyPath(bd, ox, oy));
  // 1) sombras: máscaras por altura y copias desplazadas en GPU (una sola mano translúcida)
  for (const [, bg] of binCvs) { bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, CPX0 + SM, CPX0 + SM); bg.fillStyle = '#000'; bg.setTransform(1, 0, 0, 1, SM, SM); }
  list.forEach((bd, i) => {
    let b = 0; while (b < SBINS.length - 1 && bd.sh > SBINS[b]) b++;
    binCvs[b][1].fill(paths[i]);
  });
  shadowG.clearRect(0, 0, CPX0 + SM, CPX0 + SM);
  SBINS.forEach((len, i) => { for (let k = 1; k <= len; k++) shadowG.drawImage(binCvs[i][0], k, k); });
  g.globalAlpha = 0.34; g.drawImage(shadowCv, -SM, -SM); g.globalAlpha = 1;
  if (USE3D) return; // los techos los levanta el motor 3D
  // 2) techos, recortados a los tiles de edificio/patio para no pisar veredas ni calles
  const clip = new Path2D();
  for (let ly = 0; ly < CH0; ly++) {
    let run = -1;
    for (let lx = 0; lx <= CH0; lx++) {
      const ok = lx < CH0 && ROOF_OK[tileAt(cx * CH0 + lx, cy * CH0 + ly)];
      if (ok && run < 0) run = lx;
      else if (!ok && run >= 0) { clip.rect(run * TS, ly * TS, (lx - run) * TS, TS); run = -1; }
    }
  }
  g.save(); g.clip(clip);
  const P = makePatterns(g);
  list.forEach((bd, i) => {
    if (bd.maxx < ox || bd.minx > ox + CPX0 || bd.maxy < oy || bd.miny > oy + CPX0) return;
    const pal = roofPalOf(bd);
    g.fillStyle = pal[0]; g.fill(paths[i]);
    g.fillStyle = bd.style === 'chapa' ? (bd.maxx - bd.minx > bd.maxy - bd.miny ? P.chapaV : P.chapaH) : P[bd.style];
    g.fill(paths[i]);
    // bordes: luz arriba/izquierda, sombra abajo/derecha, contorno oscuro
    const p = bd.pts;
    for (let k = 0, j = bd.n - 1; k < bd.n; j = k++) {
      const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1, nxo = (by - ay) / len * bd.sign, nyo = -(bx - ax) / len * bd.sign;
      g.fillStyle = (nyo < -0.4 || nxo < -0.4) ? pal[2] : pal[3];
      edgeLine(g, ax, ay, bx, by, ox, oy, -Math.round(nxo), -Math.round(nyo));
      g.fillStyle = pal[1];
      edgeLine(g, ax, ay, bx, by, ox, oy, 0, 0);
    }
    roofDetails(g, bd, pal, ox, oy);
  });
  g.restore();
}
function roofDetails(g, bd, pal, ox, oy) {
  const W2 = bd.maxx - bd.minx, H2 = bd.maxy - bd.miny;
  // sala de máquinas en los edificios altos
  if (bd.floors >= 5 && W2 > 40 && H2 > 40) {
    const w = Math.round(Math.min(40, W2 * 0.3)), h = Math.round(Math.min(40, H2 * 0.3));
    const x = Math.round(bd.minx + W2 * (0.25 + hash(bd.id, 3, 1) * 0.3)), y = Math.round(bd.miny + H2 * (0.25 + hash(bd.id, 4, 1) * 0.3));
    if (rectInside(bd, x, y, w + 4, h + 4)) {
      g.fillStyle = 'rgba(0,0,16,0.3)'; g.fillRect(x - ox + 3, y - oy + 3, w, h);
      g.fillStyle = pal[2]; g.fillRect(x - ox, y - oy, w, h);
      g.fillStyle = pal[1]; g.fillRect(x - ox, y - oy, w, 1); g.fillRect(x - ox, y - oy + h - 1, w, 1); g.fillRect(x - ox, y - oy, 1, h); g.fillRect(x - ox + w - 1, y - oy, 1, h);
    }
  }
  const count = bd.m2 < 250 ? (hash(bd.id, 5, 1) < 0.55 ? 1 : 0) : Math.min(7, Math.floor(bd.m2 / 220));
  let placed = 0;
  for (let t = 0; t < count * 4 && placed < count; t++) {
    const x = Math.round(bd.minx + 2 + hash(bd.id, t, 11) * (W2 - 10)), y = Math.round(bd.miny + 2 + hash(bd.id, t, 12) * (H2 - 10));
    if (!rectInside(bd, x, y, 7, 7)) continue;
    placed++;
    const lx = x - ox, ly = y - oy;
    if (lx < -8 || ly < -8 || lx > CPX0 || ly > CPX0) continue;
    if (bd.m2 < 250 || hash(bd.id, t, 13) < 0.45) { // tanque de agua negro, infaltable
      g.fillStyle = 'rgba(0,0,16,0.35)'; disc(g, lx + 5, ly + 5, 3);
      g.fillStyle = '#1c1c22'; disc(g, lx + 3, ly + 3, 3);
      g.fillStyle = '#4a4a56'; g.fillRect(lx + 2, ly + 2, 1, 1);
    } else { // aire acondicionado
      g.fillStyle = 'rgba(0,0,16,0.35)'; g.fillRect(lx + 2, ly + 2, 6, 5);
      g.fillStyle = '#b8bcc4'; g.fillRect(lx, ly, 6, 5);
      g.fillStyle = '#6a6e78'; g.fillRect(lx + 1, ly + 1, 3, 3);
      g.fillStyle = '#8a8e98'; g.fillRect(lx + 2, ly + 2, 1, 1);
    }
  }
}
const PROP_TREES = (MD.props && MD.props.trees) || [];
// canchas de fútbol: [x0,y0, x1,y1, x2,y2, x3,y3] en tiles; 0-1 es una línea de fondo y 1-2 un lateral
const PITCHES = (MD.props && MD.props.pitches) || [];
function inPitch(tx, ty, mS, mT) { // ¿el tile cae en la cancha (con un margen en fracciones del ancho/largo)?
  for (const q of PITCHES) {
    const ex = q[2] - q[0], ey = q[3] - q[1], fx = q[6] - q[0], fy = q[7] - q[1], dx = tx - q[0], dy = ty - q[1];
    const s = (dx * ex + dy * ey) / (ex * ex + ey * ey), t = (dx * fx + dy * fy) / (fx * fx + fy * fy);
    if (s > -mS && s < 1 + mS && t > -mT && t < 1 + mT) return true;
  }
  return false;
}
function drawPitch(g, q, cxp, cyp) {
  const P = (s, t) => [(q[0] + (q[2] - q[0]) * s + (q[6] - q[0]) * t + 0.5) * TS - cxp, (q[1] + (q[3] - q[1]) * s + (q[7] - q[1]) * t + 0.5) * TS - cyp];
  const xs = [0, 2, 4, 6].map(i => (q[i] + 0.5) * TS - cxp), ys = [1, 3, 5, 7].map(i => (q[i] + 0.5) * TS - cyp);
  if (Math.max(...xs) < -60 || Math.max(...ys) < -60 || Math.min(...xs) > CPX + 60 || Math.min(...ys) > CPX + 60) return;
  const Wm = Math.hypot(q[2] - q[0], q[3] - q[1]) * MD.tileMeters, Lm = Math.hypot(q[6] - q[0], q[7] - q[1]) * MD.tileMeters;
  const poly = (pts, fill) => { g.beginPath(); pts.forEach(([s, t], i) => { const [x, y] = P(s, t); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (fill) { g.closePath(); g.fill(); } else g.stroke(); };
  const rect = (s0, t0, s1, t1, fill) => poly([[s0, t0], [s1, t0], [s1, t1], [s0, t1], [s0, t0]], fill);
  // césped cortado en franjas
  const bands = 14, m = 0.06;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = i % 2 ? '#4f9a3a' : '#5cab45';
    rect(-m, -m / 2 + (1 + m) * i / bands, 1 + m, -m / 2 + (1 + m) * (i + 1) / bands + 0.002, true);
  }
  g.strokeStyle = '#f4f4ec'; g.lineWidth = 1.2;
  rect(0, 0, 1, 1); poly([[0, 0.5], [1, 0.5]]);
  const circ = (cs, ct, r, keep) => {
    let open = false; g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2, s = cs + Math.cos(a) * r / Wm, t = ct + Math.sin(a) * r / Lm, [x, y] = P(s, t);
      if (keep && !keep(s, t)) { open = false; continue; }
      open ? g.lineTo(x, y) : g.moveTo(x, y); open = true;
    }
    g.stroke();
  };
  circ(0.5, 0.5, 9.15);
  for (const end of [0, 1]) {
    const d = end ? -1 : 1, t0 = end;
    rect(0.5 - 20.16 / Wm, t0, 0.5 + 20.16 / Wm, t0 + d * 16.5 / Lm);   // área grande
    rect(0.5 - 9.16 / Wm, t0, 0.5 + 9.16 / Wm, t0 + d * 5.5 / Lm);      // área chica
    const ts = t0 + d * 11 / Lm;
    circ(0.5, ts, 9.15, (s, t) => (t - t0) * d > 16.5 / Lm);              // medialuna
    g.fillStyle = '#f4f4ec'; const [x, y] = P(0.5, ts); g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  const [x, y] = P(0.5, 0.5); g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
}
function drawPalm(g, x, y, h) {
  g.fillStyle = 'rgba(0,0,20,0.32)'; disc(g, x + 4, y + 4, 5);
  const n = 7, rot = h * 6.28;
  for (let i = 0; i < n; i++) {
    const a = rot + i * 6.283 / n;
    for (let d = 1; d <= 7; d++) {
      g.fillStyle = d > 5 ? '#3a7a2a' : '#2a6a22';
      g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), d > 4 ? 1 : 2, d > 4 ? 1 : 2);
    }
  }
  g.fillStyle = '#6a5a3a'; g.fillRect(x - 1, y - 1, 2, 2);
}
function drawTree(g, x, y, r, lap) {
  g.fillStyle = 'rgba(0,0,20,0.35)'; disc(g, x + 3, y + 3, r);
  g.fillStyle = lap ? '#a03c6a' : '#1f5a26'; disc(g, x, y, r);
  g.fillStyle = lap ? '#d8649c' : '#2f7a32'; disc(g, x - 1, y - 1, r - 2);
  g.fillStyle = lap ? '#f4a0c8' : '#4a9a44'; disc(g, x - 2, y - 2, Math.max(1, r - 4));
}

// ============================================================ CHUNKS
const CH = 32, CPX = CH * TS;
const chunks = new Map();
let frameNo = 0;
// ---- Chunks en alta (modo 3D): el piso a GS×, con los bordes de calzada y vereda suaves (no en escalera),
// cordón cuneta, sendas peatonales, tapas, baches y manchas. Los árboles no se pintan: los levanta el 3D.
const HD_M = 2, HD_W = CH + 2 * HD_M;
// árboles gigantes (props.bigtrees: [x, y, radio m, alto m] en tiles); si el mapa todavía no los trae, la higuera del Parque Mitre
// muelles (props.docks: polilíneas en tiles): tramos en px con el ancho medido sobre el adoquín de cada lado
const DOCKSEG = [];
for (const pl of (MD.props && MD.props.docks) || []) for (let i = 0; i + 3 < pl.length; i += 2) {
  const ax = (pl[i] + 0.5) * TS, ay = (pl[i + 1] + 0.5) * TS, bx = (pl[i + 2] + 0.5) * TS, by = (pl[i + 3] + 0.5) * TS, L = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / L, uy = (by - ay) / L, w = [12, 12];
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1, v = [];
    for (let t = L * 0.1; t < L * 0.9; t += 6) { let d = 0; while (d < 60 && tileAtPx(ax + ux * t - uy * d * sg, ay + uy * t + ux * d * sg) === T_PEAT) d++; v.push(d); }
    if (v.length) { v.sort((p, q) => p - q); w[s] = Math.max(4, v[v.length >> 1]); }
  }
  DOCKSEG.push({ ax, ay, bx, by, ux, uy, L, wp: w[0], wn: w[1] });
}
function dockDist(x, y) {
  let best = 1e9;
  for (const s of DOCKSEG) { const dx = x - s.ax, dy = y - s.ay, t = clamp(dx * s.ux + dy * s.uy, 0, s.L); best = Math.min(best, Math.hypot(dx - s.ux * t, dy - s.uy * t)); }
  return best;
}
const PLAYGROUNDS = ((MD.props && MD.props.playgrounds) || []).map(([x, y, r]) => [(x + 0.5) * TS, (y + 0.5) * TS, r * TS / MD.tileMeters]);
const BIGTREES = (() => {
  const tm = MD.tileMeters, l = ((MD.props && MD.props.bigtrees) || []).map(([x, y, rm]) => [(x + 0.5) * TS, (y + 0.5) * TS, rm * TS / tm]);
  if (!l.length) {
    const [S, Wb, N] = MD.bbox, mx = Math.cos((S + N) / 2 * Math.PI / 180) * 111320;
    l.push([((-58.82938 - Wb) * mx / tm + 0.5) * TS, ((N + 27.45939) * 110574 / tm + 0.5) * TS, 20 * TS / tm]);
  }
  return l;
})();
const ROADC = t => t === T_ROAD || t === T_BRIDGE || t === T_PARK;
const WATERC = t => t === T_WATER || t === T_BRIDGEW;
let hdOv = null, hdImg = null, hdNoise = null, nodeGrid = null, lastTrees = null;
function hdBlur(raw, out) { // máscara de tiles desenfocada [1 2 1]²: su curva de nivel 0,5 es el borde suave
  const W2 = HD_W, tmp = new Float32Array(W2 * W2);
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) { const k = j * W2 + i; tmp[k] = (raw[i > 0 ? k - 1 : k] + 2 * raw[k] + raw[i < W2 - 1 ? k + 1 : k]) / 4; }
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) { const k = j * W2 + i; out[k] = (tmp[j > 0 ? k - W2 : k] + 2 * tmp[k] + tmp[j < W2 - 1 ? k + W2 : k]) / 4; }
}
function crossings(g, a, cxp, cyp) { // senda peatonal en cada boca de la esquina
  const ta = tileAtPx(nx[a], ny[a]); if (ta !== T_ROAD) return;
  if (hash(a, 3, 71) > Math.max(0.35, 1 - Math.hypot(nx[a] - SPAWN.x, ny[a] - SPAWN.y) / 6000)) return; // en el centro hay en todas
  const arms = [];
  for (const b of nbrs[a]) {
    let e = out[a].find(i => eb[i] === b); if (e === undefined) e = out[b].find(i => eb[i] === a); if (e === undefined) continue;
    laneInfo(e);
    const sg = ea[e] === a ? 1 : -1, ux = edx[e] * sg, uy = edy[e] * sg, two = ef[e] & 2;
    const c = (two ? eoff[e] - ehalf[e] * 0.42 : eoff[e]) * sg;
    arms.push({ ux, uy, hw: Math.min(60, ehalf[e]), c, len: elen[e] });
  }
  if (arms.length < 3) return;
  g.fillStyle = 'rgba(238,238,232,0.88)';
  for (const A of arms) {
    let d0 = 6; for (const B of arms) if (B !== A) d0 = Math.max(d0, B.hw * Math.min(1, Math.abs(A.ux * B.uy - A.uy * B.ux) + 0.15) + 5);
    d0 = Math.min(d0, 64); if (A.len < d0 + 30 || A.hw < 8) continue;
    const rx = -A.uy, ry = A.ux, L = 7;
    for (let v = -A.hw + 2.6; v <= A.hw - 2.4; v += 4.6) {
      const mx = nx[a] + A.ux * (d0 + L) + rx * (A.c + v), my = ny[a] + A.uy * (d0 + L) + ry * (A.c + v);
      if (tileAtPx(mx, my) !== T_ROAD || tileAtPx(mx + A.ux * L, my + A.uy * L) !== T_ROAD) continue;
      const P = (s, w) => [mx + A.ux * s + rx * w - cxp, my + A.uy * s + ry * w - cyp];
      g.beginPath(); g.moveTo(...P(-L, -1.2)); g.lineTo(...P(L, -1.2)); g.lineTo(...P(L, 1.2)); g.lineTo(...P(-L, 1.2)); g.fill();
    }
  }
}
function roadDecal(g, tx, ty, x, y) { // tapas de cloaca, manchas de aceite, baches, parches y grietas
  const h = hash(tx, ty, 61), q = k => hash(tx, ty, 62 + k);
  if (h < 0.008) {
    g.fillStyle = '#2a2a2e'; g.beginPath(); g.arc(x, y, 2.7, 0, 7); g.fill();
    g.fillStyle = '#5c5a56'; g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill();
    g.fillStyle = '#44423f'; for (let k = -1; k <= 1; k++) { g.fillRect(x - 1.8, y + k * 0.9 - 0.2, 3.6, 0.4); g.fillRect(x + k * 0.9 - 0.2, y - 1.8, 0.4, 3.6); }
  } else if (h < 0.022) {
    g.fillStyle = 'rgba(14,12,20,0.26)'; g.beginPath(); g.ellipse(x, y, 2.5 + q(1) * 3, 1.6 + q(2) * 2, q(3) * 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(30,20,50,0.18)'; g.beginPath(); g.ellipse(x + 0.6, y - 0.4, 1.2 + q(4), 0.9 + q(5), q(3) * 3, 0, 7); g.fill();
  } else if (h < 0.03) {
    const n = 7, R0 = 1.6 + q(1) * 1.6, pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283, r = R0 * (0.7 + 0.5 * q(10 + k)); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    g.fillStyle = '#7a7670'; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px + 0.5, py + 0.5) : g.moveTo(px + 0.5, py + 0.5)); g.fill();
    g.fillStyle = '#242428'; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px, py) : g.moveTo(px, py)); g.fill();
  } else if (h < 0.05) {
    g.fillStyle = q(1) < 0.5 ? 'rgba(0,0,8,0.13)' : 'rgba(255,255,255,0.05)';
    const w = 5 + q(2) * 9, hh = 4 + q(3) * 6; g.fillRect(x - w / 2, y - hh / 2, w, hh);
    g.strokeStyle = 'rgba(20,20,26,0.35)'; g.lineWidth = 0.5; g.strokeRect(x - w / 2, y - hh / 2, w, hh);
  } else if (h < 0.068) {
    g.strokeStyle = 'rgba(24,24,30,0.55)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y);
    let px = x, py = y, a = q(1) * 6.28; for (let k = 0; k < 4; k++) { a += (q(5 + k) - 0.5) * 1.6; px += Math.cos(a) * 2.5; py += Math.sin(a) * 2.5; g.lineTo(px, py); }
    g.stroke();
  }
}
// ---- Bordes desde la red vial: cada tramo de calle es una franja recta (calzada y vereda medidas sobre los
// tiles a lo largo de todo el tramo), así las diagonales y los parterres quedan derechos y no siguen la escalera.
const eprof = new Map();
let segGrid = null;
function edgeProf(e) {
  let p = eprof.get(e); if (p !== undefined) return p;
  const a = ea[e], ux = edx[e], uy = edy[e], rx = -uy, ry = ux, L = elen[e], S = [[], [], [], []]; // dP, dN, sP, sN
  const n = Math.max(2, Math.min(48, Math.floor(L / 5))); // hasta 48 muestras por tramo
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * L / n; if (L > 70 && (t < 24 || t > L - 24)) continue;
    const x = nx[a] + ux * t, y = ny[a] + uy * t;
    if (!ROADC(tileAtPx(x, y))) continue;
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1; let d = 0;
      while (d < 130 && ROADC(tileAtPx(x + rx * d * sg, y + ry * d * sg))) d++;
      if (d >= 130) continue;
      let w = d; while (w - d < 48 && tileAtPx(x + rx * w * sg, y + ry * w * sg) === T_SIDE) w++;
      S[s].push(d); S[2 + s].push(w - d);
    }
  }
  const robust = arr => { // media de las muestras cercanas a la mediana (descarta bocacalles y cocheras)
    if (arr.length < 3) return NaN;
    const s = arr.slice().sort((p2, q) => p2 - q), m = s[s.length >> 1]; let k = 0, sum = 0;
    for (const v of s) if (Math.abs(v - m) <= 7) { sum += v; k++; }
    return sum / k;
  };
  const dP = robust(S[0]) - 0.5, dN = robust(S[1]) - 0.5, sP = robust(S[2]) || 0, sN = robust(S[3]) || 0;
  p = isNaN(dP) || isNaN(dN) || dP + dN < 8 ? null
    : { c: (dP - dN) / 2, h: (dP + dN) / 2, sc: (dP + sP - dN - sN) / 2, sh: (dP + sP + dN + sN) / 2 };
  eprof.set(e, p); return p;
}
function segsNear(cx, cy) {
  if (!segGrid) {
    segGrid = new Map();
    for (const e of DRIVE_EDGES) {
      if ((ef[e] & 2) && ea[e] > eb[e]) continue; // las doble mano vienen dos veces
      const a = ea[e], b = eb[e], m = 110;
      for (let gy = Math.floor((Math.min(ny[a], ny[b]) - m) / CPX); gy <= Math.floor((Math.max(ny[a], ny[b]) + m) / CPX); gy++)
        for (let gx = Math.floor((Math.min(nx[a], nx[b]) - m) / CPX); gx <= Math.floor((Math.max(nx[a], nx[b]) + m) / CPX); gx++) {
          const k = gy * 4096 + gx; let l = segGrid.get(k); if (!l) segGrid.set(k, l = []); l.push(e);
        }
    }
  }
  const out2 = [];
  for (const e of segGrid.get(cy * 4096 + cx) || []) {
    const p = edgeProf(e); if (!p) continue;
    out2.push({ ax: nx[ea[e]], ay: ny[ea[e]], ux: edx[e], uy: edy[e], L: elen[e], c: p.c, h: p.h, sc: p.sc, sh: p.sh, grp: en[e] });
  }
  return out2;
}
// distancia con signo (px, negativa adentro) a la calzada y a la vereda según la red: cápsulas por tramo,
// unión dura dentro de la misma calle y suave entre calles distintas (el radio del cordón en la esquina)
const NET = { r: 0, s: 0 }, NG_ID = new Int32Array(8), NG_D = new Float32Array(8);
const NGS = 8, NGR = (TS * 2) / NGS + 1, NGRR = new Float32Array(NGR * NGR), NGRS = new Float32Array(NGR * NGR); // grilla por tile (alta = 2×)
function netDist(cand, x, y) {
  let ng = 0, S = 1e9;
  for (let i = 0; i < cand.length; i++) {
    const s = cand[i], dx = x - s.ax, dy = y - s.ay, t = dx * s.ux + dy * s.uy, l = dy * s.ux - dx * s.uy;
    const tc = t < 0 ? t : t > s.L ? t - s.L : 0;
    const r = Math.sqrt(tc * tc + (l - s.c) * (l - s.c)) - s.h, q = Math.sqrt(tc * tc + (l - s.sc) * (l - s.sc)) - s.sh;
    if (q < S) S = q;
    let k = 0; while (k < ng && NG_ID[k] !== s.grp) k++;
    if (k === ng) { if (ng === 8) k = 7; else ng++; NG_ID[k] = s.grp; NG_D[k] = r; } else if (r < NG_D[k]) NG_D[k] = r;
  }
  let R = 1e9;
  for (let k = 0; k < ng; k++) { const b = NG_D[k], hh = Math.max(22 - Math.abs(R - b), 0) / 22; R = Math.min(R, b) - hh * hh * 5.5; }
  NET.r = R; NET.s = Math.min(S, R); return NET;
}
function buildChunkHD(cx, cy) {
  const N = CPX * GS, [cv, g] = canvas(N, N), M = HD_M, W2 = HD_W;
  const x0 = cx * CH, y0 = cy * CH, cxp = cx * CPX, cyp = cy * CPX;
  const SEGS = segsNear(cx, cy), cand = [];
  const typ = new Uint8Array(W2 * W2), fS = new Uint8Array(W2 * W2), hasSide = new Uint8Array(W2 * W2);
  const rawR = new Float32Array(W2 * W2), rawS = new Float32Array(W2 * W2), FR = new Float32Array(W2 * W2), FS = new Float32Array(W2 * W2);
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) typ[j * W2 + i] = tileAt(x0 - M + i, y0 - M + j);
  if (DOCKSEG.length && GS > 1) for (let k = 0; k < W2 * W2; k++) // el adoquín de los muelles es madera
    if (typ[k] === T_PEAT && dockDist((x0 - M + k % W2 + 0.5) * TS, (y0 - M + ((k / W2) | 0) + 0.5) * TS) < 60) typ[k] = T_DOCK;
  // material "de afuera" de calles, agua y veredas: el vecino más común que no sea ninguna de esas (gana el parterre)
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) {
    const k = j * W2 + i, t = typ[k];
    if (!ROADC(t) && !WATERC(t) && t !== T_SIDE) { fS[k] = isBuilding(t) ? T_YARD : t; continue; }
    const cnt = new Map(); let best = WATERC(t) ? T_SAND : T_YARD, bc = 0, med = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const n = tileAt(x0 - M + i + dx, y0 - M + j + dy);
      if (n === T_SIDE) { hasSide[k] = 1; continue; }
      if (ROADC(n) || WATERC(n)) continue;
      const nn = isBuilding(n) ? T_YARD : n; if (nn === T_MEDIAN) med = true;
      const c2 = (cnt.get(nn) || 0) + 1; cnt.set(nn, c2); if (c2 > bc) { bc = c2; best = nn; }
    }
    fS[k] = med && !WATERC(t) ? T_MEDIAN : best;
  }
  for (let k = 0; k < W2 * W2; k++) {
    const t = typ[k]; rawR[k] = ROADC(t) ? 1 : 0;
    rawS[k] = t === T_SIDE || (ROADC(t) && hasSide[k] && fS[k] !== T_MEDIAN) ? 1 : 0;
  }
  hdBlur(rawR, FR); hdBlur(rawS, FS);
  // 1) base: tiles lejos de los bordes, de a una textura entera
  const edges = [];
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const i = lx + M, j = ly + M, k = j * W2 + i, t = typ[k];
    let sR = 0, sS = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = k + dj * W2 + di; sR += rawR[q]; sS += rawS[q]; }
    // ¿limita con otro piso "de afuera" (pasto, arena, patio, adoquín...)? entonces también va por píxel, con borde suave
    let multi = 0;
    if (!ROADC(t) && t !== T_SIDE) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const q = k + dj * W2 + di, tq = typ[q]; if (!ROADC(tq) && tq !== T_SIDE && fS[q] !== fS[k]) multi = 1;
    }
    if ((sR > 0 && sR < 9) || (sS > 0 && sS < 9) || multi) { edges.push(lx, ly, multi); continue; }
    const tt = ROADC(t) ? t : t === T_SIDE ? T_SIDE : WATERC(t) && hasSide[k] ? T_SIDE : fS[k];
    g.drawImage(TEX[tt][Math.floor(hash(x0 + lx, y0 + ly, 1) * V)], lx * TT, ly * TT);
  }
  // 2) bordes: por píxel, con la distancia (en tiles) al borde suave de la calzada y de la vereda
  if (edges.length) {
    if (!hdImg) { hdOv = canvas(N, N); hdImg = hdOv[1].createImageData(N, N); }
    const od = hdImg.data; od.fill(0);
    const BT = new Float32Array(4 * 9), TY = [0, 0, 0, 0], TXD = [null, null, null, null];
    for (let e = 0; e < edges.length; e += 3) {
      const lx = edges[e], ly = edges[e + 1], multi = edges[e + 2], k = (ly + M) * W2 + lx + M, t = typ[k], vr = Math.floor(hash(x0 + lx, y0 + ly, 1) * V);
      const own = TEXD[ROADC(t) ? t : T_ROAD][vr], side = TEXD[T_SIDE][vr];
      let outer = TEXD[fS[k]][vr] || TEXD[T_YARD][vr];
      const med = t === T_MEDIAN || fS[k] === T_MEDIAN;
      // varios pisos de afuera: máscara desenfocada de cada uno en los 3x3 nodos alrededor (gana el mayor)
      let nT = 0;
      if (multi) {
        const ft = q => { const tq = typ[q]; return ROADC(tq) || tq === T_SIDE ? fS[k] : fS[q]; };
        TY[0] = fS[k]; nT = 1;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const v = ft(k + dj * W2 + di); let s = 0; while (s < nT && TY[s] !== v) s++; if (s === nT && nT < 4) TY[nT++] = v;
        }
        for (let s = 0; s < nT; s++) {
          TXD[s] = TEXD[TY[s]][vr] || TEXD[T_YARD][vr];
          for (let b = 0; b < 3; b++) for (let a = 0; a < 3; a++) {
            const n0 = k + (b - 1) * W2 + (a - 1); let acc = 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (ft(n0 + dj * W2 + di) === TY[s]) acc += (2 - (di < 0 ? -di : di)) * (2 - (dj < 0 ? -dj : dj));
            BT[s * 9 + b * 3 + a] = acc / 16 + (s === 0 ? 0.001 : 0);
          }
        }
      }
      // tramos de calle que pasan cerca de este tile
      cand.length = 0;
      const tcx = (x0 + lx + 0.5) * TS, tcy = (y0 + ly + 0.5) * TS;
      for (const s of SEGS) {
        const dx = tcx - s.ax, dy = tcy - s.ay, tt = dx * s.ux + dy * s.uy, l = dy * s.ux - dx * s.uy, tc = tt < 0 ? tt : tt > s.L ? tt - s.L : 0;
        if (Math.sqrt(tc * tc + (l - s.sc) * (l - s.sc)) - s.sh < 24) cand.push(s);
      }
      const useNet = cand.length > 0;
      if (useNet) { // la distancia a la red se evalúa en una grilla de 4 px (alta) y se interpola: es suave
        for (let gy = 0, n = 0; gy < NGR; gy++) for (let gx = 0; gx < NGR; gx++, n++) {
          const nd = netDist(cand, cxp + (lx * TT + gx * NGS) / GS, cyp + (ly * TT + gy * NGS) / GS);
          NGRR[n] = -nd.r / TS; NGRS[n] = -nd.s / TS;
        }
      }
      for (let py = 0; py < TT; py++) {
        const fv = ly + (py + 0.5) / TT + M - 0.5, j0 = fv | 0, wy = fv - j0;
        let o = ((ly * TT + py) * N + lx * TT) * 4;
        for (let px = 0; px < TT; px++, o += 4) {
          const fu = lx + (px + 0.5) / TT + M - 0.5, i0 = fu | 0, wx = fu - i0, q = j0 * W2 + i0;
          let a = FR[q], b = FR[q + 1], c = FR[q + W2], d = FR[q + W2 + 1], x2 = a - b - c + d;
          let f = a + (b - a) * wx + (c - a) * wy + x2 * wx * wy, gx = b - a + x2 * wy, gy = c - a + x2 * wx;
          let dR = (f - 0.5) / Math.max(0.2, Math.sqrt(gx * gx + gy * gy)), nS = 0, wS = 0;
          if (useNet) { // si la red y los tiles coinciden (±1 tile), manda la red: borde recto
            const u = (px + 0.5) / NGS, v = (py + 0.5) / NGS, iu = u | 0, iv = v | 0, fu2 = u - iu, fv2 = v - iv, n = iv * NGR + iu;
            const w00 = (1 - fu2) * (1 - fv2), w10 = fu2 * (1 - fv2), w01 = (1 - fu2) * fv2, w11 = fu2 * fv2;
            const nR = NGRR[n] * w00 + NGRR[n + 1] * w10 + NGRR[n + NGR] * w01 + NGRR[n + NGR + 1] * w11;
            const dd = Math.abs(nR - dR), w = dd < 0.55 ? 1 : dd > 1.05 ? 0 : (1.05 - dd) / 0.5;
            dR += (nR - dR) * w; nS = NGRS[n] * w00 + NGRS[n + 1] * w10 + NGRS[n + NGR] * w01 + NGRS[n + NGR + 1] * w11; wS = w;
          }
          const ti = (py * TT + px) * 4;
          let R0, G0, B0;
          if (dR > 0.24) { R0 = own[ti]; G0 = own[ti + 1]; B0 = own[ti + 2]; }
          else if (dR > 0.035) { const n = own[ti] * 0.35 + 104; R0 = n + 6; G0 = n + 4; B0 = n; } // cordón cuneta de hormigón
          else if (dR > 0) { R0 = 78; G0 = 76; B0 = 74; }                                            // junta / cara del cordón
          else if (dR > -0.1) { if (med) { R0 = 238; G0 = 236; B0 = 228; } else { R0 = 204; G0 = 200; B0 = 192; } } // cordón
          else {
            a = FS[q]; b = FS[q + 1]; c = FS[q + W2]; d = FS[q + W2 + 1]; x2 = a - b - c + d;
            f = a + (b - a) * wx + (c - a) * wy + x2 * wx * wy; gx = b - a + x2 * wy; gy = c - a + x2 * wx;
            let dS = (f - 0.5) / Math.max(0.2, Math.sqrt(gx * gx + gy * gy));
            if (wS > 0) { const dd = Math.abs(nS - dS); if (dd < 1.05) dS += (nS - dS) * (dd < 0.55 ? 1 : (1.05 - dd) / 0.5); }
            if (nT > 1 && dS <= 0) {
              const a0 = i0 - lx - M + 1, b0 = j0 - ly - M + 1; let best = -1;
              for (let s = 0; s < nT; s++) {
                const o9 = s * 9 + b0 * 3 + a0, A = BT[o9], B2 = BT[o9 + 1], C2 = BT[o9 + 3], D = BT[o9 + 4];
                const v = A + (B2 - A) * wx + (C2 - A) * wy + (A - B2 - C2 + D) * wx * wy;
                if (v > best) { best = v; outer = TXD[s]; }
              }
            }
            const src = dS > 0 ? side : outer;
            R0 = src[ti]; G0 = src[ti + 1]; B0 = src[ti + 2];
            if (dS > 0 && dS < 0.06) { R0 *= 0.8; G0 *= 0.8; B0 *= 0.8; } // línea municipal
          }
          od[o] = R0; od[o + 1] = G0; od[o + 2] = B0; od[o + 3] = 255;
        }
      }
    }
    hdOv[1].putImageData(hdImg, 0, 0);
    g.drawImage(hdOv[0], 0, 0);
  }
  // 3) variación grande (manchones de pasto seco, asfalto más gastado) para que no se note la repetición
  if (!hdNoise) hdNoise = canvas(11, 11);
  {
    const [ncv, ncg] = hdNoise, id = ncg.createImageData(11, 11);
    for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) {
      const gx = cx * 8 - 1 + i, gy = cy * 8 - 1 + j, v = hash(gx, gy, 77) * 0.55 + hash(gx >> 2, gy >> 2, 78) * 0.45, o = (j * 11 + i) * 4;
      id.data[o] = id.data[o + 1] = id.data[o + 2] = 96 + v * 64; id.data[o + 3] = 255;
    }
    ncg.putImageData(id, 0, 0);
    g.save(); g.setTransform(GS, 0, 0, GS, 0, 0); g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.3; g.drawImage(ncv, -48, -48, 11 * 48, 11 * 48); g.restore();
  }
  g.setTransform(GS, 0, 0, GS, 0, 0);
  // 4) detalles por tile (en px del mundo)
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const tx = x0 + lx, ty = y0 + ly, px = lx * TS, py = ly * TS, t = tileAt(tx, ty);
    if (t === T_YARD) { // (la línea municipal ya la marca el pase de bordes suaves)
      if (hash(tx, ty, 21) < 0.012 && tileAt(tx + 1, ty) === T_YARD && tileAt(tx, ty + 1) === T_YARD && tileAt(tx + 1, ty + 1) === T_YARD
          && [[-2, 0], [3, 0], [0, -2], [0, 3], [3, 3], [-2, -2]].some(([dx, dy]) => isBuilding(tileAt(tx + dx, ty + dy)))) { // pileta: solo en el fondo de una casa
        g.fillStyle = '#e8e8e0'; g.fillRect(px + 4, py + 4, 16, 10);
        g.fillStyle = '#2f8cc4'; g.fillRect(px + 5, py + 5, 14, 8);
        g.fillStyle = '#5cb4e4'; g.fillRect(px + 5, py + 5, 14, 2);
        g.fillStyle = '#9adaf8'; g.fillRect(px + 6, py + 8, 5, 0.5); g.fillRect(px + 12, py + 10, 5, 0.5);
      }
    } else if (t === T_BRIDGE) {
      const rail = (x, y, w, h, vert) => {
        g.fillStyle = '#c8c8d0'; g.fillRect(x, y, w, h);
        g.fillStyle = '#5a5a66'; for (let k = 0; k < TS; k += 3) vert ? g.fillRect(x, y + k, w, 0.5) : g.fillRect(x + k, y, 0.5, h);
      };
      if (tileAt(tx, ty - 1) === T_WATER) rail(px, py, TS, 2, false);
      if (tileAt(tx, ty + 1) === T_WATER) rail(px, py + TS - 2, TS, 2, false);
      if (tileAt(tx - 1, ty) === T_WATER) rail(px, py, 2, TS, true);
      if (tileAt(tx + 1, ty) === T_WATER) rail(px + TS - 2, py, 2, TS, true);
    } else if (t === T_ROAD) {
      let inner = true;
      for (let dy = -1; dy <= 1 && inner; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(tx + dx, ty + dy) !== T_ROAD) { inner = false; break; }
      if (inner) roadDecal(g, tx, ty, px + 2 + hash(tx, ty, 63) * (TS - 4), py + 2 + hash(tx, ty, 64) * (TS - 4));
    }
  }
  // senderos de plazas: trazos suaves, recortados a pasto/arena
  const okPath = t => t === T_PATH || t === T_GRASS || t === T_SAND;
  const clip = new Path2D();
  for (let ly = 0; ly < CH; ly++) {
    let run = -1;
    for (let lx = 0; lx <= CH; lx++) {
      const ok = lx < CH && okPath(tileAt(x0 + lx, y0 + ly));
      if (ok && run < 0) run = lx; else if (!ok && run >= 0) { clip.rect(run * TS, ly * TS, (lx - run) * TS, TS); run = -1; }
    }
  }
  g.save(); g.clip(clip); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [col, w] of [['#9a8458', 7], ['#d0b886', 5], ['#dcc698', 2]]) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    for (const s of PATHS) {
      if (s.maxx < cxp - 8 || s.minx > cxp + CPX + 8 || s.maxy < cyp - 8 || s.miny > cyp + CPX + 8) continue;
      g.moveTo(s.ax - cxp, s.ay - cyp); g.lineTo(s.bx - cxp, s.by - cyp);
    }
    g.stroke();
  }
  g.restore();
  // líneas pintadas: trazos parejos (también en las calles diagonales)
  g.lineWidth = 1.15; g.lineCap = 'butt';
  for (const s of MARKS) {
    if (s.maxx < cxp - 4 || s.minx > cxp + CPX + 4 || s.maxy < cyp - 4 || s.miny > cyp + CPX + 4) continue;
    g.strokeStyle = s.col; g.beginPath();
    const P = d => [s.ax + s.dx * d - s.dy * s.off, s.ay + s.dy * d + s.dx * s.off];
    for (let d = s.t0; d < s.len - s.t1; d += 14) {
      const d1 = Math.min(d + 7, s.len - s.t1), A = P(d), B = P(d1), C = P((d + d1) / 2);
      if (tileAtPx(A[0], A[1]) !== T_ROAD || tileAtPx(B[0], B[1]) !== T_ROAD || tileAtPx(C[0], C[1]) !== T_ROAD) continue;
      g.moveTo(A[0] - cxp, A[1] - cyp); g.lineTo(B[0] - cxp, B[1] - cyp);
    }
    g.stroke();
  }
  // sendas peatonales en las esquinas (también las de los chunks vecinos que caen acá)
  if (!nodeGrid) {
    nodeGrid = new Map();
    for (let a = 0; a < NN; a++) if (deg(a) >= 3) { const k = Math.floor(ny[a] / CPX) * 4096 + Math.floor(nx[a] / CPX); let l = nodeGrid.get(k); if (!l) nodeGrid.set(k, l = []); l.push(a); }
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const a of nodeGrid.get((cy + dy) * 4096 + cx + dx) || []) {
    if (nx[a] < cxp - 90 || nx[a] > cxp + CPX + 90 || ny[a] < cyp - 90 || ny[a] > cyp + CPX + 90) continue;
    crossings(g, a, cxp, cyp);
  }
  for (const q of PITCHES) drawPitch(g, q, cxp, cyp);
  // muelles: tablas de madera atravesadas, cada una con su tono, y las vigas de borde
  for (const s of DOCKSEG) {
    if (Math.max(s.ax, s.bx) + 80 < cxp || Math.min(s.ax, s.bx) - 80 > cxp + CPX || Math.max(s.ay, s.by) + 80 < cyp || Math.min(s.ay, s.by) - 80 > cyp + CPX) continue;
    const nx2 = -s.uy, ny2 = s.ux, P = (t, d) => [s.ax + s.ux * t + nx2 * d - cxp, s.ay + s.uy * t + ny2 * d - cyp];
    const quad = (t0, t1, d0, d1) => { g.beginPath(); g.moveTo(...P(t0, d0)); g.lineTo(...P(t1, d0)); g.lineTo(...P(t1, d1)); g.lineTo(...P(t0, d1)); g.closePath(); };
    g.save(); quad(-s.wn, s.L + s.wp, -s.wn, s.wp); g.clip();
    g.fillStyle = '#8a6444'; g.fill();
    for (let t = -s.wn, b = 0; t < s.L + s.wp; t += 1.6, b++) {
      const h = hash(Math.round(s.ax), b, 131);
      g.fillStyle = h < 0.33 ? '#7a5638' : h < 0.66 ? '#936c48' : '#a07852'; quad(t, t + 1.35, -s.wn, s.wp); g.fill();
      if (h > 0.9) { g.fillStyle = 'rgba(30,20,12,0.5)'; g.fillRect(...P(t + 0.4, (h - 0.95) * 40), 0.6, 0.6); } // clavos / nudos
    }
    g.fillStyle = 'rgba(40,26,16,0.75)'; quad(-s.wn, s.L + s.wp, -s.wn, -s.wn + 1.2); g.fill(); quad(-s.wn, s.L + s.wp, s.wp - 1.2, s.wp); g.fill();
    g.restore();
  }
  // areneros de las plazas de juegos
  for (const [bx, by, br] of PLAYGROUNDS) {
    if (bx + br < cxp || bx - br > cxp + CPX || by + br < cyp || by - br > cyp + CPX) continue;
    const lx0 = bx - cxp, ly0 = by - cyp;
    g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(lx0, ly0, br + 1.5, 0, 7); g.fill();
    g.fillStyle = '#dcc690'; g.beginPath(); g.arc(lx0, ly0, br, 0, 7); g.fill();
    const r = rng(55);
    for (let i = 0; i < 160; i++) { const a = r() * 6.283, d = br * Math.sqrt(r()); g.fillStyle = r() < 0.5 ? '#c8b07a' : '#ecd8a8'; g.fillRect(lx0 + Math.cos(a) * d, ly0 + Math.sin(a) * d, 1, 1); }
  }
  // bajo la higuera del Parque Mitre: pasto ralo, hojarasca y raíces que serpentean por el piso
  for (const [bx, by, br] of BIGTREES) {
    if (bx + br < cxp || bx - br > cxp + CPX || by + br < cyp || by - br > cyp + CPX) continue;
    const lx0 = bx - cxp, ly0 = by - cyp, gr = g.createRadialGradient(lx0, ly0, br * 0.1, lx0, ly0, br);
    gr.addColorStop(0, 'rgba(92,72,46,0.85)'); gr.addColorStop(0.55, 'rgba(84,78,44,0.55)'); gr.addColorStop(1, 'rgba(70,90,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(lx0, ly0, br, 0, 7); g.fill();
    const r = rng(777); g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      let a = r() * 6.283, d = br * (0.08 + r() * 0.06), x = lx0 + Math.cos(a) * d, y = ly0 + Math.sin(a) * d;
      const L = br * (0.25 + r() * 0.45), w = 2.6 - L / br * 2;
      g.strokeStyle = r() < 0.5 ? '#7a6a56' : '#8c7c66'; g.lineWidth = Math.max(0.6, w); g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < L; s += 4) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 260; i++) { // hojas caídas
      const a = r() * 6.283, d = br * Math.sqrt(r()) * 0.95;
      g.fillStyle = ['#5a6a2e', '#7a6a34', '#4a5a28', '#8a7440'][i & 3]; g.fillRect(lx0 + Math.cos(a) * d, ly0 + Math.sin(a) * d, 1, 0.6);
    }
  }
  // árboles y palmeras: van en 3D; acá solo la cazuela de tierra en la vereda
  const trees = [], mine = (x, y) => x >= cxp && x < cxp + CPX && y >= cyp && y < cyp + CPX;
  for (const [tx, ty, r, kind] of PROP_TREES) {
    const x = (tx + 0.5) * TS, y = (ty + 0.5) * TS;
    if (mine(x, y)) trees.push([x, y, kind === 1 ? 5 : r * 3, kind === 1 ? 2 : 0, hash(Math.round(tx), Math.round(ty), 42)]);
  }
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const tx = x0 + lx, ty = y0 + ly, t = tileAt(tx, ty), h = hash(tx, ty, 11), x = (tx + 0.5) * TS, y = (ty + 0.5) * TS;
    if (t === T_MEDIAN && hash(tx, ty, 41) < 0.12) { trees.push([x, y, 5, 2, hash(tx, ty, 42)]); continue; }
    if (t === T_GRASS && PITCHES.length && inPitch(tx, ty, 0.12, 0.08)) continue;
    if ((t === T_SIDE && h < 0.05) || (t === T_GRASS && h < 0.09) || (t === T_PATH && h < 0.015) || (t === T_YARD && h < 0.08)) {
      let ox = 0, oy = 0;
      if (t === T_SIDE) {
        if (ROADLIKE[tileAt(tx, ty - 1)]) oy = -3; else if (ROADLIKE[tileAt(tx, ty + 1)]) oy = 3;
        if (ROADLIKE[tileAt(tx - 1, ty)]) ox = -3; else if (ROADLIKE[tileAt(tx + 1, ty)]) ox = 3;
        const lx2 = x + ox - cxp, ly2 = y + oy - cyp;
        g.fillStyle = '#8c8880'; g.fillRect(lx2 - 3, ly2 - 3, 6, 6);
        g.fillStyle = '#4a3a2a'; g.fillRect(lx2 - 2.4, ly2 - 2.4, 4.8, 4.8);
        g.fillStyle = '#5e4a34'; g.fillRect(lx2 - 2.4, ly2 - 2.4, 4.8, 1);
      }
      const big = t === T_GRASS || t === T_YARD;
      trees.push([x + ox, y + oy, big ? 5 + Math.floor(hash(tx, ty, 13) * 4) : 6, hash(tx, ty, 12) < (t === T_YARD ? 0.12 : 0.22) ? 1 : 0, hash(tx, ty, 14)]);
    }
  }
  lastTrees = trees;
  g.setTransform(GS, 0, 0, GS, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return cv;
}
function buildChunk(cx, cy) {
  if (GS > 1) return buildChunkHD(cx, cy);
  lastTrees = null;
  const [cv, g] = canvas(CPX, CPX);
  const x0 = cx * CH, y0 = cy * CH;
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const tx = x0 + lx, ty = y0 + ly, px = lx * TS, py = ly * TS, t = tileAt(tx, ty);
    g.drawImage(TEX[isBuilding(t) ? T_YARD : t][Math.floor(hash(tx, ty, 1) * V)], px, py);
    if (t === T_YARD) {
      // medianera / reja contra la vereda
      const side = n => n === T_SIDE;
      g.fillStyle = '#a8a29a';
      if (side(tileAt(tx, ty - 1))) g.fillRect(px, py, TS, 2);
      if (side(tileAt(tx, ty + 1))) g.fillRect(px, py + TS - 2, TS, 2);
      if (side(tileAt(tx - 1, ty))) g.fillRect(px, py, 2, TS);
      if (side(tileAt(tx + 1, ty))) g.fillRect(px + TS - 2, py, 2, TS);
      // alguna pileta en el fondo
      if (hash(tx, ty, 21) < 0.012 && tileAt(tx + 1, ty) === T_YARD && tileAt(tx, ty + 1) === T_YARD && tileAt(tx + 1, ty + 1) === T_YARD) {
        g.fillStyle = '#e8e8e0'; g.fillRect(px + 4, py + 4, 16, 10);
        g.fillStyle = '#3a9ad0'; g.fillRect(px + 5, py + 5, 14, 8);
        g.fillStyle = '#7ccaf0'; g.fillRect(px + 6, py + 6, 6, 1); g.fillRect(px + 12, py + 9, 5, 1);
      }
    } else if (t === T_MEDIAN) {
      // cordón blanco pintado, como en la 3 de Abril y la Costanera
      const rl = n => ROADLIKE[n] || n === T_PEAT;
      for (const [dx, dy, x, y, w, h] of [[0, -1, 0, 0, TS, 2], [0, 1, 0, TS - 2, TS, 2], [-1, 0, 0, 0, 2, TS], [1, 0, TS - 2, 0, 2, TS]]) {
        if (!rl(tileAt(tx + dx, ty + dy))) continue;
        g.fillStyle = '#f0f0ec'; g.fillRect(px + x, py + y, w, h);
        g.fillStyle = '#8a8a90'; g.fillRect(px + x + (dx > 0 ? 1 : 0), py + y + (dy > 0 ? 1 : 0), dx ? 1 : w, dy ? 1 : h);
      }
    } else if (t === T_SIDE) {
      g.fillStyle = '#d4d4da';
      if (ROADLIKE[tileAt(tx, ty - 1)]) g.fillRect(px, py, TS, 2);
      if (ROADLIKE[tileAt(tx, ty + 1)]) g.fillRect(px, py + TS - 2, TS, 2);
      if (ROADLIKE[tileAt(tx - 1, ty)]) g.fillRect(px, py, 2, TS);
      if (ROADLIKE[tileAt(tx + 1, ty)]) g.fillRect(px + TS - 2, py, 2, TS);
    } else if (t === T_WATER || (USE3D && t === T_BRIDGEW)) {
      g.fillStyle = '#8cbce8';
      const land = n => n !== T_WATER && n !== T_BRIDGE && n !== T_BRIDGEW;
      if (land(tileAt(tx, ty - 1))) g.fillRect(px, py, TS, 1);
      if (land(tileAt(tx, ty + 1))) g.fillRect(px, py + TS - 1, TS, 1);
      if (land(tileAt(tx - 1, ty))) g.fillRect(px, py, 1, TS);
      if (land(tileAt(tx + 1, ty))) g.fillRect(px + TS - 1, py, 1, TS);
    } else if (t === T_BRIDGE || t === T_BRIDGEW) {
      const rail = (x, y, w, h, vert) => {
        g.fillStyle = '#c8c8d0'; g.fillRect(x, y, w, h);
        g.fillStyle = '#5a5a66'; for (let k = 0; k < TS; k += 4) vert ? g.fillRect(x, y + k, w, 1) : g.fillRect(x + k, y, 1, h);
      };
      if (tileAt(tx, ty - 1) === T_WATER) rail(px, py, TS, 2, false);
      if (tileAt(tx, ty + 1) === T_WATER) rail(px, py + TS - 2, TS, 2, false);
      if (tileAt(tx - 1, ty) === T_WATER) rail(px, py, 2, TS, true);
      if (tileAt(tx + 1, ty) === T_WATER) rail(px + TS - 2, py, 2, TS, true);
    }
  }
  const cxp = cx * CPX, cyp = cy * CPX;
  // senderos: borde oscuro y después el relleno claro
  const okPath = t => t === T_PATH || t === T_GRASS || t === T_SAND;
  for (const [col, r] of [['#9a8458', 3], ['#d0b886', 2]]) {
    g.fillStyle = col;
    for (const s of PATHS) {
      if (s.maxx < cxp - 6 || s.minx > cxp + CPX + 6 || s.maxy < cyp - 6 || s.miny > cyp + CPX + 6) continue;
      const n = Math.ceil(Math.hypot(s.bx - s.ax, s.by - s.ay));
      for (let i = 0; i <= n; i++) {
        const x = s.ax + (s.bx - s.ax) * i / n, y = s.ay + (s.by - s.ay) * i / n;
        if (!okPath(tileAtPx(x, y))) continue;
        g.fillRect(Math.round(x - cxp) - r, Math.round(y - cyp) - r, 2 * r + 1, 2 * r + 1);
      }
    }
  }
  drawBuildings(g, cx, cy);
  // líneas amarillas de las calles doble mano
  for (const s of MARKS) {
    if (s.maxx < cxp - 4 || s.minx > cxp + CPX + 4 || s.maxy < cyp - 4 || s.miny > cyp + CPX + 4) continue;
    g.fillStyle = s.col;
    for (let d = s.t0; d < s.len - s.t1; d += 1) {
      if (((d / 7) | 0) % 2) continue;
      const x = s.ax + s.dx * d - s.dy * s.off, y = s.ay + s.dy * d + s.dx * s.off;
      if (tileAtPx(x, y) !== T_ROAD) continue;
      g.fillRect(Math.floor(x - cxp) - 1, Math.floor(y - cyp) - 1, 2, 2);
    }
  }
  for (const q of PITCHES) drawPitch(g, q, cxp, cyp);
  // palmeras en los parterres
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const tx = x0 + lx, ty = y0 + ly;
    if (tileAt(tx, ty) === T_MEDIAN && hash(tx, ty, 41) < 0.12) drawPalm(g, lx * TS + TS / 2, ly * TS + TS / 2, hash(tx, ty, 42));
  }
  // árboles puestos a mano (manzana del trabajo)
  for (const [tx, ty, r, kind] of PROP_TREES) {
    const x = (tx + 0.5) * TS - cxp, y = (ty + 0.5) * TS - cyp;
    if (x > -40 && y > -40 && x < CPX + 40 && y < CPX + 40) {
      if (kind === 1) drawPalm(g, Math.round(x), Math.round(y), 0.3); else drawTree(g, Math.round(x), Math.round(y), r * 3, false);
    }
  }
  // árboles (y algún lapacho rosado)
  for (let ly = 1; ly < CH - 1; ly++) for (let lx = 1; lx < CH - 1; lx++) {
    const tx = x0 + lx, ty = y0 + ly, t = tileAt(tx, ty), h = hash(tx, ty, 11);
    if (t === T_GRASS && PITCHES.length && inPitch(tx, ty, 0.12, 0.08)) continue; // en la cancha no hay árboles
    if ((t === T_SIDE && h < 0.05) || (t === T_GRASS && h < 0.09) || (t === T_PATH && h < 0.015) || (t === T_YARD && h < 0.08)) {
      let ox = 0, oy = 0;
      if (t === T_SIDE) {
        if (ROADLIKE[tileAt(tx, ty - 1)]) oy = -3; else if (ROADLIKE[tileAt(tx, ty + 1)]) oy = 3;
        if (ROADLIKE[tileAt(tx - 1, ty)]) ox = -3; else if (ROADLIKE[tileAt(tx + 1, ty)]) ox = 3;
      }
      const big = t === T_GRASS || t === T_YARD;
      drawTree(g, lx * TS + TS / 2 + ox, ly * TS + TS / 2 + oy, big ? 5 + Math.floor(hash(tx, ty, 13) * 4) : 6, hash(tx, ty, 12) < (t === T_YARD ? 0.12 : 0.22));
    }
  }
  return cv;
}
function getChunk(cx, cy) {
  const k = cy * 4096 + cx;
  let c = chunks.get(k);
  if (!c) {
    c = { cv: buildChunk(cx, cy), used: frameNo }; builtThisFrame++;
    c.trees = lastTrees; // en 3D los árboles se levantan en volumen (render3d.js)
    chunks.set(k, c);
    if (chunks.size > (GS > 1 ? 56 : 72)) { // en alta cada chunk pesa 2,4 MB (más su textura en la GPU)
      let ok = -1, ou = Infinity;
      for (const [kk, v] of chunks) if (v.used < ou) { ou = v.used; ok = kk; }
      if (R3) R3.evict(chunks.get(ok));
      chunks.delete(ok);
    }
  }
  c.used = frameNo;
  return c;
}
// Calcomanías (manchas, marcas de frenada) pintadas directo sobre los chunks
function decal(x, y, r, fn) {
  const c0x = Math.floor((x - r) / CPX), c1x = Math.floor((x + r) / CPX);
  const c0y = Math.floor((y - r) / CPX), c1y = Math.floor((y + r) / CPX);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const c = chunks.get(cy * 4096 + cx); if (!c) continue;
    const g = c.cv.getContext('2d'); fn(g, x - cx * CPX, y - cy * CPX); c.dirty = true;
  }
}
function splat(x, y, n = 18) {
  decal(x, y, 9, (g, lx, ly) => {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), d = rand(7);
      g.fillStyle = pick(['#8a1020', '#a01828', '#6a0a18']);
      g.fillRect(Math.round(lx + Math.cos(a) * d), Math.round(ly + Math.sin(a) * d), rand() < 0.3 ? 2 : 1, 1);
    }
  });
}
function scorch(x, y) {
  decal(x, y, 22, (g, lx, ly) => {
    g.fillStyle = 'rgba(10,8,8,0.55)'; disc(g, Math.round(lx), Math.round(ly), 14);
    g.fillStyle = 'rgba(10,8,8,0.5)'; disc(g, Math.round(lx), Math.round(ly), 8);
  });
}

// Imagen de toda la ciudad (1 px = 1 tile) para el minimapa y el mapa grande
const MAPCOL = ['#4b4554', '#6e6e7a', '#9a9aa4', '#3f8a3a', '#2a5aa8', '#d8c48a', '#a8584a', '#8a8a96', '#b0583a', '#5a5a66', '#c8b07e', '#56704a', '#8a8a96', '#46963f', '#8c7454'].map(hex2rgb);
const [mapImg, mapG] = canvas(W, H);
{
  const id = mapG.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const c = MAPCOL[tiles[i]]; id.data[4 * i] = c[0]; id.data[4 * i + 1] = c[1]; id.data[4 * i + 2] = c[2]; id.data[4 * i + 3] = 255; }
  mapG.putImageData(id, 0, 0);
}

// ============================================================ SPRITES
const CAR_COLORS = ['#c83c3c', '#3c6cc8', '#e8e8e8', '#2a2a2a', '#9aa0a8', '#d8b03c', '#3c9a5a', '#8a3cc8', '#c87a3c', '#6a2a2a', '#5ab0d0'];
const sprCache = new Map();
function carSprite(type, color, wreck = false, flash = false) {
  const key = type + color + wreck + flash; if (sprCache.has(key)) return sprCache.get(key);
  if (type === 'sport' || type === 'zcar') { const cv = sportSprite(type === 'zcar' ? '#141414' : color, wreck, type === 'zcar'); sprCache.set(key, cv); return cv; }
  if (type === 'moto') { const cv = motoSprite(color, wreck); sprCache.set(key, cv); return cv; }
  const w = 11, l = type === 'pickup' ? 24 : 22, [c, g] = canvas(w, l);
  const base = wreck ? '#34302e' : color, dark = shade(base, -0.45), light = shade(base, 0.28);
  g.fillStyle = dark; g.fillRect(0, 1, w, l - 2); g.fillRect(1, 0, w - 2, l);
  g.fillStyle = base; g.fillRect(1, 1, w - 2, l - 2);
  g.fillStyle = light; g.fillRect(2, 2, w - 4, 1);
  const glass = wreck ? '#1a1818' : '#24304a';
  g.fillStyle = glass; g.fillRect(2, 6, w - 4, 3);
  if (!wreck) { g.fillStyle = '#6a8ab8'; g.fillRect(3, 6, 2, 1); }
  g.fillStyle = dark; g.fillRect(0, 7, 1, 1); g.fillRect(w - 1, 7, 1, 1); // espejos
  if (type === 'pickup') {
    g.fillStyle = light; g.fillRect(2, 9, w - 4, 3);
    g.fillStyle = glass; g.fillRect(2, 12, w - 4, 1);
    g.fillStyle = dark; g.fillRect(2, 14, w - 4, l - 16);
    g.fillStyle = shade(base, -0.65); g.fillRect(3, 15, w - 6, l - 18);
  } else {
    g.fillStyle = light; g.fillRect(2, 9, w - 4, 5);
    g.fillStyle = glass; g.fillRect(2, 14, w - 4, 2);
  }
  if (type === 'police' && !wreck) { // franja azul + balizas
    g.fillStyle = '#2050c0'; g.fillRect(0, 9, 1, 7); g.fillRect(w - 1, 9, 1, 7); g.fillRect(2, 3, w - 4, 1); g.fillRect(2, 17, w - 4, 1);
    g.fillStyle = flash ? '#3a70ff' : '#ff2a2a'; g.fillRect(2, 11, 3, 2);
    g.fillStyle = flash ? '#ff2a2a' : '#3a70ff'; g.fillRect(w - 5, 11, 3, 2);
    g.fillStyle = '#e8e8e8'; g.fillRect(5, 11, 1, 2);
  }
  if (!wreck) {
    g.fillStyle = '#fff3b0'; g.fillRect(1, 0, 2, 1); g.fillRect(w - 3, 0, 2, 1);
    g.fillStyle = '#e03030'; g.fillRect(1, l - 1, 2, 1); g.fillRect(w - 3, l - 1, 2, 1);
  } else {
    g.fillStyle = '#5a4a40'; for (let i = 0; i < 10; i++) g.fillRect(Math.floor(rand(1, w - 2)), Math.floor(rand(1, l - 2)), 2, 1);
  }
  sprCache.set(key, c); return c;
}
// ---- vehículos nuevos: deportivo, el negro con la Z, moto y colectivos
const GLYPH = { // letras y números de 3x5 para pintar en los techos
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', Z: '111001010100111',
};
function paintText(g, text, x, y, col) {
  g.fillStyle = col;
  for (const ch of String(text)) {
    const gl = GLYPH[ch]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') g.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
    x += 4;
  }
}
function sportSprite(color, wreck, zmark) {
  const w = 11, l = 23, [c, g] = canvas(w, l), base = wreck ? '#34302e' : color, dark = shade(base, -0.5), light = shade(base, 0.3);
  g.fillStyle = dark; g.fillRect(0, 2, w, l - 3); g.fillRect(1, 0, w - 2, l);
  g.fillStyle = base; g.fillRect(1, 1, w - 2, l - 2);
  g.fillStyle = light; g.fillRect(2, 2, 1, 7); g.fillRect(w - 3, 2, 1, 7);            // tomas de aire del capot
  g.fillStyle = wreck ? '#1a1818' : '#1c2538'; g.fillRect(2, 9, w - 4, 3); g.fillRect(3, 17, w - 6, 2); // parabrisas y luneta
  g.fillStyle = shade(base, 0.12); g.fillRect(2, 12, w - 4, 5);                       // techo bajo
  if (!wreck && !zmark) { g.fillStyle = '#f0f0f0'; g.fillRect(4, 0, 1, l); g.fillRect(6, 0, 1, l); }  // franjas de carrera
  if (!wreck && zmark) { g.fillStyle = '#000000'; g.fillRect(3, 12, 5, 6); paintText(g, 'Z', 4, 12, '#f0c020'); }
  g.fillStyle = dark; g.fillRect(1, l - 2, w - 2, 1);                                 // alerón
  if (!wreck) { g.fillStyle = '#fff3b0'; g.fillRect(1, 0, 2, 1); g.fillRect(w - 3, 0, 2, 1); g.fillStyle = '#ff3030'; g.fillRect(1, l - 1, 3, 1); g.fillRect(w - 4, l - 1, 3, 1); }
  return c;
}
function motoSprite(color, wreck) {
  const [c, g] = canvas(5, 12);
  g.fillStyle = '#1a1a1a'; g.fillRect(2, 0, 1, 3); g.fillRect(2, 9, 1, 3);           // ruedas
  g.fillStyle = wreck ? '#34302e' : color; g.fillRect(1, 3, 3, 6);
  if (!wreck) { g.fillStyle = '#d8a878'; g.fillRect(0, 4, 1, 1); g.fillRect(4, 4, 1, 1); // manos
    g.fillStyle = pick(['#2a2a2a', '#c83c3c', '#3c6cc8', '#e8e8e8']); g.fillRect(1, 5, 3, 3); g.fillStyle = '#5a7090'; g.fillRect(2, 5, 1, 1); } // casco
  return c;
}
// colectivos rojos y blancos, un diseño por línea, con número y ramal en el techo
const BUS_DESIGN = {
  104: { body: '#c8282a', roof: '#f2f2ee', accent: '#f2f2ee' },
  105: { body: '#f2f2ee', roof: '#f2f2ee', accent: '#c8282a' },
  108: { body: '#c8282a', roof: '#c8282a', accent: '#f2f2ee' },
  109: { body: '#f2f2ee', roof: '#e8e8e4', accent: '#d02a2a' },
};
function busSprite(line, ramal, wreck) {
  const key = 'bus' + line + ramal + wreck; if (sprCache.has(key)) return sprCache.get(key);
  const w = 14, l = 58, [c, g] = canvas(w, l), d = BUS_DESIGN[line] || BUS_DESIGN[104];
  const body = wreck ? '#34302e' : d.body;
  g.fillStyle = shade(body, -0.45); g.fillRect(0, 1, w, l - 2); g.fillRect(1, 0, w - 2, l);
  g.fillStyle = body; g.fillRect(1, 1, w - 2, l - 2);
  if (!wreck) {
    g.fillStyle = d.roof; g.fillRect(2, 4, w - 4, l - 8);                             // techo
    g.fillStyle = d.accent;
    if (line == 105) { g.fillRect(1, 1, w - 2, 5); g.fillRect(1, l - 6, w - 2, 5); g.fillRect(1, 20, w - 2, 2); }
    else if (line == 108) { for (let y = 0; y < 14; y++) g.fillRect(1, l - 18 + y, Math.min(w - 2, y + 1), 1); }
    else if (line == 109) { g.fillRect(3, 4, 2, l - 8); g.fillRect(w - 5, 4, 2, l - 8); }
    else { g.fillRect(1, l - 10, w - 2, 2); g.fillRect(1, 9, w - 2, 1); }
    g.fillStyle = '#24304a'; g.fillRect(2, 1, w - 4, 3);                              // parabrisas
    for (let y = 8; y < l - 6; y += 5) { g.fillRect(0, y, 1, 3); g.fillRect(w - 1, y, 1, 3); } // ventanillas
    g.fillStyle = '#9aa0a8'; g.fillRect(4, l - 16, 6, 6); g.fillStyle = '#7a8088'; g.fillRect(5, l - 15, 4, 4); // aire acondicionado
    g.fillStyle = '#ffffff'; g.fillRect(1, 24, w - 2, 15);                             // cartel del techo
    paintText(g, line, 1, 26, '#c8282a'); paintText(g, ramal, 5, 32, '#1a1a1a');
    g.fillStyle = '#fff3b0'; g.fillRect(1, 0, 2, 1); g.fillRect(w - 3, 0, 2, 1);
    g.fillStyle = '#e03030'; g.fillRect(1, l - 1, 2, 1); g.fillRect(w - 3, l - 1, 2, 1);
  }
  sprCache.set(key, c); return c;
}
function shadowSprite(w, l) {
  const key = 'sh' + w + 'x' + l; if (sprCache.has(key)) return sprCache.get(key);
  const [c, g] = canvas(w, l); g.fillStyle = 'rgba(0,0,16,0.38)'; g.fillRect(0, 1, w, l - 2); g.fillRect(1, 0, w - 2, l);
  sprCache.set(key, c); return c;
}
const SHIRTS = ['#d84040', '#4070d8', '#e8e8e8', '#40a860', '#e8c040', '#8848c0', '#e07830', '#40b8c8', '#303030', '#e86aa0'];
const PANTS = ['#2a3a6a', '#3a3a3a', '#6a5a4a', '#4a4a7a', '#2a4a3a'];
const SKIN = ['#f0c8a0', '#d8a878', '#a87850', '#7a5030'];
const HAIR = ['#2a1a10', '#5a3a20', '#1a1a1a', '#a87830', '#8a8a8a'];
function pedSprites(o, gun = false) {
  const frame = f => {
    const [c, g] = canvas(11, 11), leg = [0, 1, -1][f];
    if (leg) { g.fillStyle = o.pants; g.fillRect(3, leg > 0 ? 1 : 7, 2, 3); g.fillRect(6, leg > 0 ? 7 : 1, 2, 3); }
    g.fillStyle = o.shirt; g.fillRect(2, 4, 7, 3); g.fillRect(3, 3, 5, 5);
    g.fillStyle = o.skin; g.fillRect(1, leg > 0 ? 5 : leg < 0 ? 3 : 4, 1, 2); g.fillRect(9, leg < 0 ? 5 : leg > 0 ? 3 : 4, 1, 2);
    if (gun) { g.fillStyle = o.skin; g.fillRect(7, 2, 2, 2); g.fillStyle = '#1a1a1a'; g.fillRect(7, 0, 1, 3); }
    g.fillStyle = o.hair; g.fillRect(4, 3, 3, 4); g.fillRect(3, 4, 5, 2);
    g.fillStyle = o.skin; g.fillRect(5, 3, 1, 1);
    return c;
  };
  const [d, g] = canvas(11, 13);
  g.fillStyle = o.pants; g.fillRect(3, 7, 2, 5); g.fillRect(6, 7, 2, 5);
  g.fillStyle = o.shirt; g.fillRect(2, 3, 7, 5);
  g.fillStyle = o.skin; g.fillRect(0, 3, 2, 1); g.fillRect(9, 4, 2, 1);
  g.fillStyle = o.hair; g.fillRect(4, 0, 3, 3);
  return { frames: [frame(0), frame(1), frame(0), frame(2)], dead: d };
}
const randomOutfit = () => ({ shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKIN), hair: pick(HAIR) });
const OUTFIT_SPRITES = [];
const outfitSprites = () => { if (OUTFIT_SPRITES.length < 28) OUTFIT_SPRITES.push(pedSprites(randomOutfit())); return pick(OUTFIT_SPRITES); };

// ============================================================ SONIDO (WebAudio, todo sintetizado)
const sfx = (() => {
  let ac = null, noise = null, master = null, eng = null, engGain = null, sir = null, sirGain = null, muted = false;
  function init() {
    if (ac) return; ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    eng = ac.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 40;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    engGain = ac.createGain(); engGain.gain.value = 0; eng.connect(lp); lp.connect(engGain); engGain.connect(master); eng.start();
    sir = ac.createOscillator(); sir.type = 'square';
    const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
    sirGain = ac.createGain(); sirGain.gain.value = 0; sir.connect(sf); sf.connect(sirGain); sirGain.connect(master); sir.start();
  }
  function burst(dur, vol, freq) {
    if (!ac || muted || vol <= 0.01) return;
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  function blip(freq, dur, vol = 0.15) {
    if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = 'square';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  return {
    init, burst, blip,
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.6; return muted; },
    siren(v) {
      if (!ac) return; const t = ac.currentTime;
      sirGain.gain.setTargetAtTime(muted ? 0 : v * 0.05, t, 0.1);
      sir.frequency.setTargetAtTime(Math.floor(t * 2.2) % 2 ? 960 : 720, t, 0.02);
    },
    engine(on, speed, thr) {
      if (!ac) return; const t = ac.currentTime;
      engGain.gain.setTargetAtTime(on && !muted ? 0.05 + (thr ? 0.03 : 0) : 0, t, 0.05);
      eng.frequency.setTargetAtTime(38 + Math.abs(speed) * 0.55 + (thr ? 12 : 0), t, 0.05);
    },
  };
})();
function sfxAt(x, y, fn) { const d = Math.sqrt(dist2(x, y, cam.x, cam.y)); const v = clamp(1 - d / 700, 0, 1); if (v > 0) fn(v); }

// ============================================================ API PARA MÓDULOS (misiones, escenas 3D, minijuegos)
// Los módulos (missions.js, scenes.js, futbol.js) se cargan después de game.js y usan window.Chipa.
// - hooks.update(dt): cada paso de simulación (60/s) mientras se juega
// - hooks.interact(playerCar): al apretar ENTER/F; si alguno devuelve true, se consume (no roba auto)
// - hooks.render2d(ctx, ox, oy): dibujar encima del mundo en modo 2D (en 3D, ver markers)
// - hooks.keydown(e): teclas; si devuelve true no las procesa el juego
// - markers: [{x, y, color, label, r}] en px del mundo: el minimapa y el render 3D los muestran
// - modal: mientras sea un objeto (p. ej. una escena 3D o el fútbol), el mundo queda en pausa y no se dibuja
const HOOKS = { update: [], interact: [], render2d: [], keydown: [] };
const MARKERS = [];
let MODAL = null;
// ============================================================ ESTADO
const cars = [], peds = [], bullets = [], parts = [], pickups = [];
const cam = { x: 0, y: 0, zoom: 1 };
const MAXV = 200, REVMAX = 60, ACC = 150, BRAKE = 320, TURN = 2.8;
const WEAPONS = [
  { id: 'pistola', name: 'PISTOLA', rate: 0.32, dmg: 26, spread: 0.03, pellets: 1, snd: [0.12, 0.25, 3200] },
  { id: 'uzi', name: 'UZI', rate: 0.085, dmg: 14, spread: 0.09, pellets: 1, snd: [0.08, 0.2, 4000] },
  { id: 'escopeta', name: 'ESCOPETA', rate: 0.8, dmg: 22, spread: 0.22, pellets: 6, snd: [0.3, 0.4, 1400] },
];
const PLAYER_OUTFIT = { shirt: '#30c0e8', pants: '#2a3a6a', skin: '#d8a878', hair: '#1a1a1a' };
const player = {
  x: 0, y: 0, a: -Math.PI / 2, vx: 0, vy: 0, hp: 100, car: null, dead: false, deadT: 0, anim: 0,
  spr: pedSprites(PLAYER_OUTFIT, true), busted: false, arrestT: 0, weapon: 0, ammo: { pistola: Infinity, uzi: 0, escopeta: 0 }, cool: 0, score: 0,
};
const SPAWN = { x: (MD.spawn[0] + 0.5) * TS, y: (MD.spawn[1] + 0.5) * TS };
let state = 'title', showBig = false;
let R3 = null; // motor 3D (si hay WebGL)
const BRIDGES = (MD.bridges || []).map(b => {
  const px = b.pts.map(v => (v + 0.5) * TS), cum = [0];
  for (let i = 2; i < px.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(px[i] - px[i - 2], px[i + 1] - px[i - 1]));
  const L = cum[cum.length - 1];
  return { name: b.name, px, cum, L, wpx: b.w * TS, deckPx: b.deck * VS, pylons: b.pylons, pylonPx: 83 * VS, R: L * 0.3 };
});
function bridgeZ(b, s) { const u = clamp(Math.min(s, b.L - s) / b.R, 0, 1); return b.deckPx * u * u * (3 - 2 * u); }
function bridgePoint(b, s) {
  let i = 1; while (i < b.cum.length - 1 && b.cum[i] < s) i++;
  const s0 = b.cum[i - 1], s1 = b.cum[i], t = s1 > s0 ? clamp((s - s0) / (s1 - s0), 0, 1) : 0;
  return { x: b.px[2 * i - 2] + (b.px[2 * i] - b.px[2 * i - 2]) * t, y: b.px[2 * i - 1] + (b.px[2 * i + 1] - b.px[2 * i - 1]) * t };
}
function bridgeAt(x, y) {
  let best = null, bd = Infinity;
  for (const b of BRIDGES) {
    const lim = (b.wpx / 2 + 8) ** 2;
    for (let i = 0; i + 3 < b.px.length; i += 2) {
      const ax = b.px[i], ay = b.px[i + 1], dx = b.px[i + 2] - ax, dy = b.px[i + 3] - ay, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), d = dist2(x, y, ax + dx * t, ay + dy * t);
      if (d < lim && d < bd) { bd = d; best = { b, s: b.cum[i / 2] + t * Math.sqrt(l2), px: ax + dx * t, py: ay + dy * t }; }
    }
  }
  if (best) { best.z = bridgeZ(best.b, best.s); best.d = Math.sqrt(bd); }
  return best;
}
// Sube a quien entra al puente por la rampa; los que pasan por abajo (la Costanera) siguen en el piso.
function updateZ(e) {
  const t = tileAtPx(e.x, e.y);
  // arriba del viaducto se sigue el tablero aunque abajo haya pasto o una calle (el tramo elevado sobre tierra)
  const q = (e.onBridge || t === T_BRIDGE || t === T_BRIDGEW) ? bridgeAt(e.x, e.y) : null;
  if (q && (t === T_BRIDGEW || e.onBridge || q.z < 14)) {
    const lim = q.b.wpx / 2 - 5;
    if (q.z > 20 && q.d > lim) { // barandas: no deja caerse por el costado
      const nx = (e.x - q.px) / q.d, ny = (e.y - q.py) / q.d;
      e.x = q.px + nx * lim; e.y = q.py + ny * lim;
      if (e.vx !== undefined) { const v = e.vx * nx + e.vy * ny; if (v > 0) { e.vx -= nx * v * 1.4; e.vy -= ny * v * 1.4; } }
    }
    e.onBridge = true; e.z = q.z; return;
  }
  e.onBridge = false; e.z = 0;
}
// ubicación del pórtico de carteles: Av. 3 de Abril, mano que va al puente, antes del cruce con Santa Fe
const GANTRY = (() => {
  const n3 = MD.names.indexOf('Avenida 3 de Abril'), nsf = MD.names.indexOf('Santa Fe');
  if (n3 < 0 || nsf < 0) return null;
  const hasSF = new Set();
  for (let i = 0; i < EC; i++) if (en[i] === nsf) { hasSF.add(ea[i]); hasSF.add(eb[i]); }
  for (let i = 0; i < EC; i++) {
    if (en[i] !== n3 || (ef[i] & 2) || !hasSF.has(eb[i]) || edx[i] > 0) continue; // mano única hacia el oeste (al puente)
    const back = Math.min(elen[i] - 10, 110), rx = -edy[i], ry = edx[i];
    let x = nx[eb[i]] - edx[i] * back, y = ny[eb[i]] - edy[i] * back;
    // si el trazado cae sobre el parterre, la calzada de esta mano está a la derecha (se maneja por la derecha)
    for (let k = 0; k < 64 && !DRIVEABLE[tileAtPx(x, y)]; k += 2) { x += rx * 2; y += ry * 2; }
    // ancho real de la calzada justo ahí (hasta el parterre o la vereda)
    let dp = 0, dn = 0;
    while (dp < 100 && DRIVEABLE[tileAtPx(x + rx * dp, y + ry * dp)]) dp += 2;
    while (dn < 100 && DRIVEABLE[tileAtPx(x - rx * dn, y - ry * dn)]) dn += 2;
    const c = (dp - dn) / 2;
    return { x: x + rx * c, y: y + ry * c, ux: edx[i], uy: edy[i], half: Math.max(20, (dp + dn) / 2) };
  }
  return null;
})();
const sameLevel = (a, b) => Math.abs((a.z || 0) - (b.z || 0)) < 20;

// ============================================================ AUTOS
// tamaño (px) y rendimiento de cada tipo: velocidad máxima, aceleración y agarre
const VTYPE = {
  sedan: { w: 11, l: 22, maxv: 200, acc: 150, grip: 8 }, pickup: { w: 11, l: 24, maxv: 180, acc: 135, grip: 8 },
  police: { w: 11, l: 22, maxv: 210, acc: 160, grip: 8 }, sport: { w: 11, l: 23, maxv: 255, acc: 205, grip: 9 },
  zcar: { w: 11, l: 23, maxv: 285, acc: 240, grip: 10 }, moto: { w: 5, l: 12, maxv: 230, acc: 230, grip: 6 },
  bus: { w: 14, l: 58, maxv: 125, acc: 80, grip: 9 },
};
function randomType(traffic) {
  const r = rand();
  if (traffic) return r < 0.5 ? 'sedan' : r < 0.68 ? 'pickup' : r < 0.78 ? 'sport' : r < 0.985 ? 'moto' : 'zcar';
  return r < 0.62 ? 'sedan' : r < 0.85 ? 'pickup' : r < 0.95 ? 'sport' : r < 0.99 ? 'moto' : 'zcar';
}
function makeCar(x, y, a, o = {}) {
  const type = o.type || randomType(false), color = o.color || pick(CAR_COLORS), vt = VTYPE[type] || VTYPE.sedan;
  const c = { x, y, a, vx: 0, vy: 0, spin: 0, type, color, spr: o.spr || carSprite(type, color), w: vt.w, l: vt.l, maxv: vt.maxv, acc: vt.acc, grip: vt.grip,
    hp: 100, z: 0, mode: o.mode || 'phys', npc: !!o.npc, burn: 0, wreck: false, e: -1, s: 0, spd: 0, stuck: 0, ignore: 0,
    skidL: null, skidR: null, vf: 0, vr: 0, smoke: 0 };
  cars.push(c); return c;
}
function carHits(x, y, a, c) {
  if (c.onBridge && c.z > 6) return false; // arriba del puente mandan las barandas (updateZ), no las celdas de abajo
  const fx = Math.cos(a), fy = Math.sin(a), hl = c.l / 2 - 1, hw = c.w / 2 - 1;
  for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]])
    if (solidPx(x + fx * lx - fy * ly, y + fy * lx + fx * ly)) return true;
  return false;
}
function damageCar(c, d) {
  if (c.wreck || d <= 0) return;
  c.hp -= d;
  if (c.hp <= 0 && c.burn <= 0) {
    c.hp = 0; c.burn = 3;
    if (c.mode === 'ai') toPhys(c);
    if (c.npc) { ejectDriver(c); }
  }
}
function toPhys(c) {
  if (c.mode !== 'ai') return;
  c.mode = 'phys'; c.vx = Math.cos(c.a) * c.spd; c.vy = Math.sin(c.a) * c.spd;
}
function ejectDriver(c) {
  c.npc = false;
  const lx = Math.sin(c.a), ly = -Math.cos(c.a);
  let n = c.cop ? c.crew : 1, made = null;
  c.crew = 0;
  for (const s of [1, -1]) {
    if (n <= 0) break;
    const px = c.x + lx * s * (c.w / 2 + 6), py = c.y + ly * s * (c.w / 2 + 6);
    if (SOLID[tileAtPx(px, py)]) continue;
    if (c.cop) made = makeCopPed(px, py); else { made = makePed(px, py); scare(made, c.x, c.y, 6); }
    n--;
  }
  return made;
}
function explode(c) {
  c.wreck = true; c.burn = 0; c.hp = 0; c.spr = c.type === 'bus' ? busSprite(c.line, c.ramal, true) : carSprite(c.type, c.color, true);
  scorch(c.x, c.y);
  for (let i = 0; i < 60; i++) {
    const a = rand(Math.PI * 2), s = rand(20, 160);
    parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1.1), max: 1.1, kind: 'fire', size: rand() < 0.4 ? 3 : 2 });
  }
  for (let i = 0; i < 25; i++) parts.push({ x: c.x + rand(-10, 10), y: c.y + rand(-10, 10), vx: rand(-15, 15), vy: rand(-15, 15), life: rand(1, 2.5), max: 2.5, kind: 'smoke', size: 3 });
  sfxAt(c.x, c.y, v => sfx.burst(1.2, 0.8 * v, 380));
  shake = 0.5;
  const mine = dist2(c.x, c.y, player.x, player.y) < 600 * 600;
  if (mine) { player.score += 50; crime(c.cop ? 4 : 1.5); }
  for (const p of peds) if (!p.dead && dist2(p.x, p.y, c.x, c.y) < 50 * 50) killPed(p, mine);
  for (const o of cars) {
    if (o === c) continue;
    const d2 = dist2(o.x, o.y, c.x, c.y);
    if (d2 < 60 * 60) {
      if (o.mode === 'ai') toPhys(o);
      const d = Math.sqrt(d2) || 1; o.vx += (o.x - c.x) / d * 90; o.vy += (o.y - c.y) / d * 90; o.spin += rand(-3, 3);
      damageCar(o, 65);
    }
  }
  if (player.car === c) killPlayer();
  else if (!player.car && !player.dead && dist2(player.x, player.y, c.x, c.y) < 44 * 44) killPlayer();
  alertPeds(c.x, c.y, 260);
}
function carPhysics(c, dt, inp) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  let vf = c.vx * fx + c.vy * fy, vr = -c.vx * fy + c.vy * fx;
  const driven = !!inp && !c.wreck && c.hp > 0;
  if (driven) {
    const acc = c.acc || ACC, mv = c.maxv || MAXV;
    if (inp.thr) { if (vf < -5) vf += BRAKE * dt; else vf += acc * dt * (1 - clamp(vf / mv, 0, 1) * 0.55); }
    if (inp.brk) { if (vf > 5) vf -= BRAKE * dt; else vf = Math.max(-REVMAX, vf - acc * 0.7 * dt); }
  }
  vf -= vf * (driven ? 0.45 : 1.6) * dt;
  if (!driven || (!inp.thr && !inp.brk)) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 30 * dt);
  const hb = driven && inp.hb;
  if (hb) vf -= vf * 1.3 * dt;
  vr *= Math.exp(-(hb ? 1.3 : driven ? (c.grip || 8) : 5) * dt);
  vf = clamp(vf, -REVMAX, c.maxv || MAXV);
  let av = 0;
  if (driven) av = inp.steer * TURN * (c.type === 'bus' ? 0.7 : c.type === 'moto' ? 1.2 : 1) * clamp(vf / 45, -1, 1) * (1 - 0.3 * clamp(Math.abs(vf) / (c.maxv || MAXV), 0, 1)) * (hb ? 1.5 : 1);
  c.spin *= Math.exp(-3 * dt);
  const na = c.a + (av + c.spin) * dt;
  if (!carHits(c.x, c.y, na, c)) c.a = na; else c.spin *= -0.3;
  const nfx = Math.cos(c.a), nfy = Math.sin(c.a);
  c.vx = nfx * vf - nfy * vr; c.vy = nfy * vf + nfx * vr;
  c.vf = vf; c.vr = vr;
  // movimiento con choque contra la ciudad (desliza contra las paredes)
  let hit = 0;
  const mx = c.x + c.vx * dt;
  if (!carHits(mx, c.y, c.a, c)) c.x = mx; else { hit = Math.max(hit, Math.abs(c.vx)); c.vx *= -0.25; }
  const my = c.y + c.vy * dt;
  if (!carHits(c.x, my, c.a, c)) c.y = my; else { hit = Math.max(hit, Math.abs(c.vy)); c.vy *= -0.25; }
  if (hit > 55) {
    damageCar(c, (hit - 55) * 0.22);
    sfxAt(c.x, c.y, v => sfx.burst(0.25, 0.45 * v, 900));
    sparks(c.x + nfx * c.l / 2, c.y + nfy * c.l / 2, 6);
    if (c === player.car) shake = Math.min(0.35, hit / 400);
  }
  // marcas de frenada
  const skid = Math.abs(vr) > 38 || (hb && Math.abs(vf) > 40);
  for (const s of [1, -1]) {
    const wx = c.x - nfx * (c.l / 2 - 4) - nfy * s * (c.w / 2 - 2), wy = c.y - nfy * (c.l / 2 - 4) + nfx * s * (c.w / 2 - 2);
    const key = s > 0 ? 'skidL' : 'skidR', prev = c[key];
    if (skid && prev && dist2(prev[0], prev[1], wx, wy) < 400) {
      const n = Math.ceil(Math.sqrt(dist2(prev[0], prev[1], wx, wy)));
      decal(wx, wy, 24, (g, lx, ly) => {
        g.fillStyle = 'rgba(16,14,20,0.55)';
        for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; g.fillRect(Math.round(lx + (prev[0] - wx) * t), Math.round(ly + (prev[1] - wy) * t), 1, 1); }
      });
    }
    c[key] = skid ? [wx, wy] : null;
  }
}
function carCircles(c) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a), d = (c.l - c.w) / 2;
  return [[c.x + fx * d, c.y + fy * d], [c.x, c.y], [c.x - fx * d, c.y - fy * d]];
}
function collideCars(a, b) {
  if (!sameLevel(a, b)) return;
  const ra = a.w / 2 + 0.5, rb = b.w / 2 + 0.5;
  let best = 0, bn = null;
  for (const p of carCircles(a)) for (const q of carCircles(b)) {
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy), ov = ra + rb - d;
    if (ov > best) { best = ov; bn = d > 0.001 ? [dx / d, dy / d] : [1, 0]; }
  }
  if (!bn) return;
  if (b.mode === 'ai') toPhys(b);
  if (a.mode === 'ai') toPhys(a);
  for (const [car, s] of [[a, -0.5], [b, 0.5]]) {
    const ox = car.x, oy = car.y; car.x += bn[0] * best * s; car.y += bn[1] * best * s;
    if (carHits(car.x, car.y, car.a, car)) { car.x = ox; car.y = oy; }
  }
  const vrel = (b.vx - a.vx) * bn[0] + (b.vy - a.vy) * bn[1];
  if (vrel < 0) {
    const j = -1.3 * vrel / 2;
    a.vx -= j * bn[0]; a.vy -= j * bn[1]; b.vx += j * bn[0]; b.vy += j * bn[1];
    const side = Math.sign((b.x - a.x) * Math.sin(b.a) - (b.y - a.y) * Math.cos(b.a)) || 1;
    b.spin += side * j * 0.02; a.spin -= side * j * 0.01;
    if (-vrel > 35) {
      damageCar(a, -vrel * 0.12); damageCar(b, -vrel * 0.14);
      sfxAt(a.x, a.y, v => sfx.burst(0.3, 0.5 * v, 800));
      sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
      if (a === player.car || b === player.car) shake = Math.min(0.4, -vrel / 300);
    }
  }
}

// ---- Tráfico: autos que siguen la red de calles real (respetando la mano)
function laneOff(e, lane) {
  laneInfo(e);
  if (!(ef[e] & 4)) return eoff[e];
  return (ef[e] & 2) ? eoff[e] - ehalf[e] * 0.42 + ehalf[e] * (lane > 0 ? 0.74 : 0.26) : eoff[e] + lane * ehalf[e] * 0.45;
}
function lanePoint(e, sv, lane) {
  const a = ea[e], off = laneOff(e, lane || 0);
  return [nx[a] + edx[e] * sv - edy[e] * off, ny[a] + edy[e] * sv + edx[e] * off];
}
function aiPos(c) { return lanePoint(c.e, c.s, c.lane); }
function pickNext(c) {
  if (c.route) return c.ri + 1 < c.route.length ? c.route[c.ri + 1] : -1;
  const from = ea[c.e], at = eb[c.e], opts = out[at].filter(e => eb[e] !== from);
  const list = opts.length ? opts : out[at];
  return list.length ? pick(list) : -1;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// camino corto por la red (para que un colectivo enlace la vuelta con la ida)
function bfsPath(from, to, limit = 600) {
  if (from === to) return [];
  const prev = new Map([[from, -1]]), q = [from];
  for (let qi = 0; qi < q.length && qi < limit; qi++) {
    const u = q[qi];
    for (const e of out[u]) { const v = eb[e]; if (prev.has(v)) continue; prev.set(v, e); if (v === to) { const p = []; for (let n = to; n !== from; n = ea[prev.get(n)]) p.push(prev.get(n)); return p.reverse(); } q.push(v); }
  }
  return null;
}
function updateAI(c, dt) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  let blocked = false;
  if (c.ignore > 0) c.ignore -= dt;
  else {
    // mira adelante del paragolpes; radio chico para no frenar por los estacionados al costado
    for (const ahead of [c.l / 2 + 6, c.l / 2 + 20]) {
      const lx = c.x + fx * ahead, ly = c.y + fy * ahead;
      for (const o of cars) if (o !== c && dist2(o.x, o.y, lx, ly) < 10 * 10 && sameLevel(o, c)) { blocked = true; break; }
      if (!blocked && !player.car && !player.dead && dist2(player.x, player.y, lx, ly) < 10 * 10) blocked = true;
      if (!blocked) for (const p of peds) if (!p.dead && dist2(p.x, p.y, lx, ly) < 9 * 9) { blocked = true; break; }
      if (blocked) break;
    }
  }
  if (c.nextE === undefined) c.nextE = pickNext(c);
  // frena antes de doblar fuerte
  let vmax = c.maxSpd;
  const remain = elen[c.e] - c.s;
  if (c.nextE >= 0 && remain < 55 && Math.abs(angDiff(Math.atan2(edy[c.nextE], edx[c.nextE]), Math.atan2(edy[c.e], edx[c.e]))) > 0.6) vmax = Math.min(vmax, 34);
  // los colectivos paran cada tanto
  if (c.isBus) {
    if (c.stopT > 0) { c.stopT -= dt; vmax = 0; }
    else if ((c.stopIn -= dt) <= 0) { c.stopIn = rand(18, 32); c.stopT = rand(2.5, 4); }
  }
  if (blocked) { c.spd = Math.max(0, c.spd - 260 * dt); c.stuck += dt; if (c.stuck > 2.5) { c.ignore = 1.2; c.stuck = 0; } }
  else { c.spd = c.spd > vmax ? Math.max(vmax, c.spd - 160 * dt) : Math.min(vmax, c.spd + 70 * dt); c.stuck = 0; }
  // persecución pura: apunta a un punto del carril un poco más adelante y gira con suavidad
  const L = 18 + c.spd * 0.3 + (c.isBus ? 14 : 0);
  let tx, ty;
  if (c.s + L <= elen[c.e] || c.nextE < 0) [tx, ty] = lanePoint(c.e, Math.min(elen[c.e], c.s + L), c.lane);
  else [tx, ty] = lanePoint(c.nextE, Math.min(elen[c.nextE], c.s + L - elen[c.e]), c.lane);
  const d = angDiff(Math.atan2(ty - c.y, tx - c.x), c.a), maxTurn = (2.0 + c.spd / 35) * dt;
  // si el punto a seguir queda muy de costado o atrás, frena para poder doblar cerrado (si no, lo orbita)
  if (Math.abs(d) > 1.0) c.spd = Math.min(c.spd, 26);
  const turn = c.spd > 1 ? clamp(d, -maxTurn, maxTurn) : 0;
  c.a += turn;
  c.x += Math.cos(c.a) * c.spd * dt; c.y += Math.sin(c.a) * c.spd * dt;
  c.s = (c.x - nx[ea[c.e]]) * edx[c.e] + (c.y - ny[ea[c.e]]) * edy[c.e];
  // ya dobló: si avanzó sobre la calle siguiente, pasa a ella aunque nunca haya "llegado" a la esquina
  const s2 = c.nextE >= 0 ? (c.x - nx[ea[c.nextE]]) * edx[c.nextE] + (c.y - ny[ea[c.nextE]]) * edy[c.nextE] : -1;
  if (c.s >= elen[c.e] - 1 || dist2(c.x, c.y, nx[eb[c.e]], ny[eb[c.e]]) < 36 || (c.s > elen[c.e] - L && s2 > 6)) {
    if (c.nextE < 0) {
      if (!c.isBus || !busNextLeg(c)) { c.remove = true; return; }
    } else { c.e = c.nextE; if (c.route) c.ri++; c.nextE = pickNext(c); }
    c.s = (c.x - nx[ea[c.e]]) * edx[c.e] + (c.y - ny[ea[c.e]]) * edy[c.e];
  }
  // si algo lo sacó del camino, vuelve al carril
  const [px2, py2] = lanePoint(c.e, clamp(c.s, 0, elen[c.e]), c.lane);
  if (dist2(px2, py2, c.x, c.y) > 70 * 70) { c.x = px2; c.y = py2; c.a = Math.atan2(edy[c.e], edx[c.e]); }
  // vigía anti-trompo: si giró más de una vuelta sin avanzar por la calle, lo acomoda en el carril
  if (c.orbE !== c.e || c.s > c.orbS + 14) { c.orbE = c.e; c.orbS = c.s; c.orbT = 0; }
  else if ((c.orbT += Math.abs(turn)) > 5.5 && !visible(c.x, c.y, 20)) {
    const sv = clamp(c.s + 20, 0, elen[c.e]); [c.x, c.y] = lanePoint(c.e, sv, c.lane); c.s = sv;
    c.a = Math.atan2(edy[c.e], edx[c.e]); c.orbT = 0; c.orbS = c.s;
  } else if (c.orbT > 5.5) { c.spd = Math.min(c.spd, 12); c.orbT = 4; }
  c.vx = Math.cos(c.a) * c.spd; c.vy = Math.sin(c.a) * c.spd;
}

// ---- Colectivos: siguen los recorridos reales (ida y vuelta)
const ROUTES = MD.routes || [];
function busNextLeg(c) {
  const other = ROUTES.find(r => r.line === c.line && r.ramal === c.ramal && r.dir !== c.dir && r.edges.length) ||
                ROUTES.find(r => r.line === c.line && r.ramal === c.ramal && r.dir === c.dir);
  if (!other) return false;
  const link = bfsPath(eb[c.e], ea[other.edges[0]]);
  if (link === null) return false;
  c.dir = other.dir; c.route = [...link, ...other.edges]; c.ri = 0; c.e = c.route[0]; c.nextE = pickNext(c);
  return true;
}
function spawnBuses() {
  for (const r of ROUTES) {
    const n = r.edges.length > 60 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const ri = Math.floor(rand(r.edges.length)), e = r.edges[ri];
      laneInfo(e);
      const c = { e, s: rand(elen[e]), lane: 1 }, [x, y] = lanePoint(e, c.s, 1);
      const bus = makeCar(x, y, Math.atan2(edy[e], edx[e]), { type: 'bus', color: '#c8282a', mode: 'ai', npc: true, spr: busSprite(r.line, r.ramal, false) });
      Object.assign(bus, { e, s: c.s, lane: 1, spd: 30, maxSpd: rand(50, 62), isBus: true, line: r.line, ramal: r.ramal, dir: r.dir,
        route: r.edges, ri, stopIn: rand(5, 25), stopT: 0 });
    }
  }
}
function visible(x, y, m = 40) {
  return Math.abs(x - cam.x) < view.w / 2 + m && Math.abs(y - cam.y) < view.h / 2 + m;
}
function spawnAI() {
  for (let tries = 0; tries < 25; tries++) {
    const ang = rand(Math.PI * 2), dd = rand(520, 1000);
    const cell = driveGrid.get(Math.floor((cam.y + Math.sin(ang) * dd) / DCELL) * 4096 + Math.floor((cam.x + Math.cos(ang) * dd) / DCELL));
    if (!cell) continue;
    const e = pick(cell), s = rand(elen[e]);
    const c = { e, s, lane: rand() < 0.5 ? -1 : 1 }, [x, y] = aiPos(c);
    const d2 = dist2(x, y, cam.x, cam.y);
    if (d2 < 480 * 480 || d2 > 1050 * 1050 || visible(x, y, 60)) continue;
    if (cars.some(o => dist2(o.x, o.y, x, y) < 34 * 34)) continue;
    const type = randomType(true);
    const car = makeCar(x, y, Math.atan2(edy[e], edx[e]), { mode: 'ai', npc: true, type });
    car.e = e; car.s = s; car.lane = c.lane; car.spd = 50;
    car.maxSpd = type === 'moto' ? rand(70, 100) : type === 'sport' || type === 'zcar' ? rand(80, 110) : rand(55, 85);
    if (carHits(x, y, car.a, car)) { cars.pop(); continue; }
    return;
  }
}

// ---- Autos estacionados a lo largo de las calles (se crean una vez)
function parkCars() {
  const r = rng(1234);
  for (const e of DRIVE_EDGES) {
    if (elen[e] < 90 || r() > 0.3 || ((ef[e] & 2) && ea[e] > eb[e])) continue;
    if (deg(ea[e]) > 2 && elen[e] < 120) continue;
    laneInfo(e);
    if (ehalf[e] < 26) continue;
    const s = 30 + r() * (elen[e] - 60), a = ea[e], off = epark[e];
    const x = nx[a] + edx[e] * s - edy[e] * off, y = ny[a] + edy[e] * s + edx[e] * off;
    const car = makeCar(x, y, Math.atan2(edy[e], edx[e]));
    if (carHits(x, y, car.a, car) || cars.some(o => o !== car && dist2(o.x, o.y, x, y) < 30 * 30)) cars.pop();
  }
}

// ============================================================ PEATONES
function makePed(x, y, o) {
  const p = { x, y, a: Math.floor(rand(4)) * Math.PI / 2, state: 'walk', t: rand(2, 6), flee: 0, anim: rand(4), dead: false,
    spr: o ? pedSprites(o) : outfitSprites(), fx: 0, fy: 0, z: 0 };
  peds.push(p); return p;
}
function scare(p, x, y, t = 4) { if (p.dead || p.cop) return; p.state = 'flee'; p.flee = t; p.fx = x; p.fy = y; p.t = 0; }
function alertPeds(x, y, r) { for (const p of peds) if (dist2(p.x, p.y, x, y) < r * r) scare(p, x, y, rand(3, 6)); }
function killPed(p, byPlayer = false) {
  if (p.dead) return;
  p.dead = true; splat(p.x, p.y);
  if (byPlayer) { player.score += p.cop ? 30 : 10; crime(p.cop ? 3 : 1); }
  sfxAt(p.x, p.y, v => sfx.blip(220, 0.12, 0.12 * v));
}
function updatePed(p, dt) {
  if (p.dead) return;
  p.t -= dt;
  const fleeing = p.state === 'flee';
  if (fleeing) { p.flee -= dt; if (p.flee <= 0) p.state = 'walk'; }
  const spd = fleeing ? 46 : 14;
  const here = tileAtPx(p.x, p.y);
  const set = (fleeing || !WALK_CALM[here]) ? WALK_FLEE : WALK_CALM;
  const fx = Math.cos(p.a), fy = Math.sin(p.a);
  if (!set[tileAtPx(p.x + fx * 7, p.y + fy * 7)] || p.t <= 0) {
    let best = null, bs = -Infinity;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
      if (!set[tileAtPx(p.x + dx * 9, p.y + dy * 9)]) continue;
      let sc = rand();
      if (fleeing) { const ax = p.x - p.fx, ay = p.y - p.fy, l = Math.hypot(ax, ay) || 1; sc += 2 * (dx * ax + dy * ay) / l; }
      else if (Math.abs(Math.cos(a - p.a) + 1) < 0.01) sc -= 0.8; // evita darse vuelta
      if (sc > bs) { bs = sc; best = a; }
    }
    p.a = best !== null ? best : p.a + Math.PI;
    p.t = fleeing ? rand(0.5, 1.5) : rand(2, 7);
  }
  const mx = p.x + Math.cos(p.a) * spd * dt, my = p.y + Math.sin(p.a) * spd * dt;
  if (!SOLID[tileAtPx(mx, my)]) { p.x = mx; p.y = my; } else p.t = 0;
  p.anim += spd * dt * 0.22;
}
function spawnPed() {
  for (let tries = 0; tries < 30; tries++) {
    const a = rand(Math.PI * 2), d = rand(420, 820), x = cam.x + Math.cos(a) * d, y = cam.y + Math.sin(a) * d;
    const t = tileAtPx(x, y);
    if (t !== T_SIDE && t !== T_PEAT && t !== T_PATH) continue;
    if (visible(x, y, 40)) continue;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    makePed((tx + 0.5) * TS, (ty + 0.5) * TS); return;
  }
}
// Empuja a alguien fuera de los autos (no se atraviesan)
function pushOutOfCars(e, r) {
  for (const c of cars) {
    if (dist2(c.x, c.y, e.x, e.y) > 30 * 30 || !sameLevel(c, e)) continue;
    const fx = Math.cos(c.a), fy = Math.sin(c.a), dx = e.x - c.x, dy = e.y - c.y;
    let lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx;
    const hl = c.l / 2 + r, hw = c.w / 2 + r;
    if (Math.abs(lx) < hl && Math.abs(ly) < hw) {
      if (hl - Math.abs(lx) < hw - Math.abs(ly)) lx = Math.sign(lx || 1) * hl; else ly = Math.sign(ly || 1) * hw;
      const nx2 = c.x + fx * lx - fy * ly, ny2 = c.y + fy * lx + fx * ly;
      if (!SOLID[tileAtPx(nx2, ny2)]) { e.x = nx2; e.y = ny2; }
    }
  }
}
function carHitsPeople(c) {
  const sp = Math.hypot(c.vx, c.vy);
  if (c.mode === 'ai' || sp < 30) return;
  const lvl = q => sameLevel(c, q);
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  const inside = (x, y) => { const dx = x - c.x, dy = y - c.y, lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx; return Math.abs(lx) < c.l / 2 + 2 && Math.abs(ly) < c.w / 2 + 2; };
  for (const p of peds) if (!p.dead && lvl(p) && dist2(p.x, p.y, c.x, c.y) < 400 && inside(p.x, p.y)) { killPed(p, c === player.car); alertPeds(p.x, p.y, 120); }
  if (!player.car && !player.dead && lvl(player) && sp > 60 && dist2(player.x, player.y, c.x, c.y) < 400 && inside(player.x, player.y)) killPlayer();
}

// ============================================================ ARMAS Y PARTÍCULAS
function sparks(x, y, n) {
  for (let i = 0; i < n; i++) { const a = rand(Math.PI * 2), s = rand(30, 120); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.1, 0.3), max: 0.3, kind: 'spark', size: 1 }); }
}
function fire() {
  const w = WEAPONS[player.weapon];
  if (player.cool > 0 || player.ammo[w.id] <= 0) return;
  player.cool = w.rate;
  if (player.ammo[w.id] !== Infinity) player.ammo[w.id]--;
  const fx = Math.cos(player.a), fy = Math.sin(player.a);
  const ox = player.x + fx * 6 - fy * 2, oy = player.y + fy * 6 + fx * 2;
  for (let i = 0; i < w.pellets; i++) {
    const a = player.a + rand(-w.spread, w.spread);
    bullets.push({ x: ox, y: oy, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 0.55, dmg: w.dmg, owner: 'player' });
  }
  parts.push({ x: ox + fx * 3, y: oy + fy * 3, vx: 0, vy: 0, life: 0.05, max: 0.05, kind: 'flash', size: 3 });
  sfx.burst(...w.snd);
  alertPeds(player.x, player.y, 200);
  if (player.ammo[w.id] <= 0) cycleWeapon(1);
}
function cycleWeapon(dir) {
  for (let i = 1; i <= WEAPONS.length; i++) {
    const k = (player.weapon + dir * i + WEAPONS.length * 3) % WEAPONS.length;
    if (player.ammo[WEAPONS[k].id] > 0) { player.weapon = k; return; }
  }
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt;
    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (solidPx(b.x, b.y)) { sparks(b.x - b.vx * 0.005, b.y - b.vy * 0.005, 3); b.life = 0; break; }
      for (const p of peds) if (!p.dead && p !== b.owner && dist2(p.x, p.y, b.x, b.y) < 25) { killPed(p, b.owner === 'player'); b.life = 0; break; }
      if (b.life <= 0) break;
      if (b.owner !== 'player' && !player.car && !player.dead && dist2(player.x, player.y, b.x, b.y) < 25) {
        player.hp -= b.dmg; b.life = 0; splat(player.x, player.y, 4); shake = 0.15;
        if (player.hp <= 0) killPlayer();
        break;
      }
      for (const c of cars) {
        if (dist2(c.x, c.y, b.x, b.y) > 196) continue;
        const fx = Math.cos(c.a), fy = Math.sin(c.a), dx = b.x - c.x, dy = b.y - c.y;
        if (Math.abs(dx * fx + dy * fy) < c.l / 2 && Math.abs(-dx * fy + dy * fx) < c.w / 2) {
          damageCar(c, b.dmg); sparks(b.x, b.y, 4); b.life = 0;
          if (c.cop && b.owner === 'player') crime(0.4);
          sfxAt(b.x, b.y, v => sfx.blip(900, 0.04, 0.06 * v)); break;
        }
      }
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
}
function updateParts(dt) {
  for (const p of parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = p.kind === 'smoke' ? 0.8 : 3; p.vx -= p.vx * k * dt; p.vy -= p.vy * k * dt;
    if (p.kind === 'smoke') p.vy -= 6 * dt;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

// ---- Pickups (cajas con armas y vida)
const PICK_TYPES = [
  { id: 'uzi', col: '#3fa0ff', glyph: '101101101101111', give: () => { player.ammo.uzi += 90; return 'UZI +90'; } },
  { id: 'escopeta', col: '#ff9f3f', glyph: '111100110100111', give: () => { player.ammo.escopeta += 14; return 'ESCOPETA +14'; } },
  { id: 'vida', col: '#ff4f6f', glyph: '000010111010000', give: () => { player.hp = Math.min(100, player.hp + 50); return 'VIDA +50'; } },
];
function placePickups() {
  const r = rng(99);
  let n = 0, tries = 0;
  while (n < 90 && tries++ < 20000) {
    const tx = Math.floor(r() * W), ty = Math.floor(r() * H), t = tileAt(tx, ty);
    if (t !== T_SIDE && t !== T_PEAT && t !== T_PATH) continue;
    pickups.push({ x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, type: PICK_TYPES[n % 3], respawn: 0 }); n++;
  }
  // una caja de UZI cerquita del inicio para arrancar con todo
  for (let d = 2; d < 30; d++) {
    const tx = Math.floor(SPAWN.x / TS) + d, ty = Math.floor(SPAWN.y / TS);
    if (WALK_CALM[tileAt(tx, ty)]) { pickups.push({ x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, type: PICK_TYPES[0], respawn: 0 }); break; }
  }
}

// ============================================================ POLICÍA
// Nivel de búsqueda: el "calor" sube con cada delito; las estrellas salen de estos umbrales.
const THRESH = [1, 4, 9, 16, 25];
const COPS_PER_LEVEL = [0, 1, 2, 3, 5, 7];
let heat = 0, evadeT = 0, arresting = false, copSpawnT = 0;
const wantedLevel = () => THRESH.filter(t => heat >= t).length;
function crime(n) {
  if (player.dead) return;
  const before = wantedLevel();
  heat = Math.min(40, heat + n); evadeT = 0;
  if (wantedLevel() > before) { sfx.blip(660, 0.2, 0.15); if (before === 0) showMsg('¡TE BUSCA LA POLICÍA!', 2); }
}
const COP_OUTFIT = { shirt: '#24357a', pants: '#14183a', skin: '#d8a878', hair: '#0e1430' };
let copSprites = null;
function makeCopPed(x, y) {
  copSprites = copSprites || pedSprites(COP_OUTFIT, true);
  const p = makePed(x, y); p.spr = copSprites; p.cop = true; p.chase = wantedLevel() > 0; p.cool = rand(0.6, 1.4);
  return p;
}

// ---- Ruteo A* sobre la red de calles real (la policía no respeta la mano)
const UND = Array.from({ length: NN }, (_, i) => [...nbrs[i]]);
const NODES_USED = []; for (let i = 0; i < NN; i++) if (nbrs[i].size) NODES_USED.push(i);
function nearestNode(x, y) {
  let b = -1, bd = Infinity;
  for (const i of NODES_USED) { const d = dist2(x, y, nx[i], ny[i]); if (d < bd) { bd = d; b = i; } }
  return b;
}
function findPath(sx, sy, tx, ty) {
  const s = nearestNode(sx, sy), t = nearestNode(tx, ty);
  if (s < 0 || t < 0) return null;
  if (s === t) return [t];
  const g = new Float64Array(NN).fill(Infinity), prev = new Int32Array(NN).fill(-1), closed = new Uint8Array(NN), heap = [];
  const push = (f, n) => {
    heap.push([f, n]); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  g[s] = 0; push(0, s);
  while (heap.length) {
    const n = pop()[1];
    if (closed[n]) continue; closed[n] = 1;
    if (n === t) break;
    for (const m of UND[n]) {
      const ng = g[n] + Math.hypot(nx[m] - nx[n], ny[m] - ny[n]);
      if (ng < g[m]) { g[m] = ng; prev[m] = n; push(ng + Math.hypot(nx[t] - nx[m], ny[t] - ny[m]), m); }
    }
  }
  if (prev[t] < 0) return null;
  const path = []; for (let n = t; n >= 0; n = prev[n]) path.push(n);
  return path.reverse();
}

// ---- Manejo de los patrulleros: apuntan al próximo punto de la ruta, con marcha atrás si se traban
function driveTo(c, tx, ty, dt) {
  let d = Math.atan2(ty - c.y, tx - c.x) - c.a; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (c.rev > 0) { c.rev -= dt; carPhysics(c, dt, { thr: false, brk: true, steer: d > 0 ? -1 : 1, hb: false }); return; }
  if (Math.abs(d) > 1.9 && c.vf < 20) { c.rev = 0.7; return; }
  const sharp = Math.abs(d) > 0.55 && c.vf > 95;
  carPhysics(c, dt, { thr: !sharp && Math.abs(d) < 1.9, brk: sharp, steer: clamp(d * 2.5, -1, 1), hb: Math.abs(d) > 1.0 && c.vf > 70 });
  c.stuckT = Math.abs(c.vf) < 12 ? (c.stuckT || 0) + dt : 0;
  if (c.stuckT > 1.1) { c.rev = 0.9; c.stuckT = 0; }
}
function updateCopCar(c, dt) {
  if (wantedLevel() === 0 || player.dead) { c.mode = 'phys'; c.leaving = true; return; }
  const T = player.car || player, d = Math.sqrt(dist2(c.x, c.y, T.x, T.y));
  const tsp = player.car ? Math.hypot(player.car.vx, player.car.vy) : 0;
  // cerca y despacio: se bajan los policías
  if (c.crew > 0 && d < 130 && Math.hypot(c.vx, c.vy) < 35 && tsp < 40) { ejectDriver(c); c.mode = 'phys'; return; }
  // si estás a pie, frenan antes de pisarte
  if (!player.car && d < 110) { carPhysics(c, dt, { thr: false, brk: c.vf > 0, steer: 0, hb: false }); return; }
  let tx = T.x, ty = T.y;
  if (d > 200) {
    c.replan = (c.replan || 0) - dt;
    if (c.replan <= 0 || !c.path) {
      c.replan = 1.2; c.path = findPath(c.x, c.y, T.x, T.y); c.pi = 0;
      if (c.path && c.path.length > 1) {
        const a = c.path[0], b = c.path[1];
        if (dist2(c.x, c.y, nx[b], ny[b]) < dist2(nx[a], ny[a], nx[b], ny[b])) c.pi = 1;
      }
    }
    if (c.path) {
      while (c.pi < c.path.length && dist2(c.x, c.y, nx[c.path[c.pi]], ny[c.path[c.pi]]) < 40 * 40) c.pi++;
      const end = c.path[c.path.length - 1];
      // si ya está más cerca que la última esquina de la ruta, va derecho
      if (c.pi < c.path.length && dist2(nx[end], ny[end], T.x, T.y) < d * d) { tx = nx[c.path[c.pi]]; ty = ny[c.path[c.pi]]; }
    }
  }
  driveTo(c, tx, ty, dt); // de cerca: te encara directo (y te choca)
}
function updateCopPed(p, dt) {
  if (wantedLevel() === 0 || player.dead) { p.chase = false; return; }
  const T = player.car || player, d = Math.sqrt(dist2(p.x, p.y, T.x, T.y)), lv = wantedLevel();
  p.a = Math.atan2(T.y - p.y, T.x - p.x);
  const reach = player.car ? player.car.l / 2 + 7 : 9;
  if (d > reach) {
    const sp = 44, mx = Math.cos(p.a) * sp * dt, my = Math.sin(p.a) * sp * dt;
    if (!SOLID[tileAtPx(p.x + mx, p.y)]) p.x += mx;
    if (!SOLID[tileAtPx(p.x, p.y + my)]) p.y += my;
    p.anim += sp * dt * 0.22;
  } else if (!player.car || Math.hypot(player.car.vx, player.car.vy) < 15) arresting = true;
  p.cool -= dt;
  // desde 2 estrellas, tiran
  if (lv >= 2 && d < 170 && d > 14 && p.cool <= 0) {
    p.cool = rand(0.8, 1.4) - lv * 0.08;
    const a = p.a + rand(-0.12, 0.12);
    bullets.push({ x: p.x + Math.cos(p.a) * 6, y: p.y + Math.sin(p.a) * 6, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 0.5, dmg: 8, owner: p });
    sfxAt(p.x, p.y, v => sfx.burst(0.1, 0.22 * v, 2800));
  }
}
function spawnCop(lv) {
  for (let tries = 0; tries < 25; tries++) {
    const ang = rand(Math.PI * 2), dd = rand(550, 950);
    const cell = driveGrid.get(Math.floor((player.y + Math.sin(ang) * dd) / DCELL) * 4096 + Math.floor((player.x + Math.cos(ang) * dd) / DCELL));
    if (!cell) continue;
    const e = pick(cell), s = rand(elen[e]), x = nx[ea[e]] + edx[e] * s, y = ny[ea[e]] + edy[e] * s;
    if (visible(x, y, 60) || cars.some(o => dist2(o.x, o.y, x, y) < 34 * 34)) continue;
    let a = Math.atan2(edy[e], edx[e]);
    if (edx[e] * (player.x - x) + edy[e] * (player.y - y) < 0) a += Math.PI;
    const c = makeCar(x, y, a, { type: 'police', color: '#ececec', mode: 'cop', npc: true });
    if (carHits(x, y, a, c)) { cars.pop(); continue; }
    c.cop = true; c.crew = 2; c.maxv = 165 + lv * 9; c.sprB = carSprite('police', '#ececec', false, true);
    c.vx = Math.cos(a) * 60; c.vy = Math.sin(a) * 60;
    return;
  }
}
function bust() {
  if (player.dead) return;
  if (player.car) { const c = player.car; c.mode = 'phys'; player.x = c.x + Math.sin(c.a) * 12; player.y = c.y - Math.cos(c.a) * 12; player.car = null; }
  player.dead = true; player.busted = true; player.deadT = 3;
  showMsg('¡TE AGARRÓ LA CANA!', 3, true);
  sfx.engine(false, 0, false); sfx.blip(180, 0.5, 0.2);
}
function clearPolice() {
  heat = 0; evadeT = 0;
  for (let i = cars.length - 1; i >= 0; i--) if (cars[i].cop && cars[i] !== player.car && !cars[i].wreck) cars.splice(i, 1);
  for (let i = peds.length - 1; i >= 0; i--) if (peds[i].cop) peds.splice(i, 1);
  sfx.siren(0);
}
function updatePolice(dt) {
  const lv = wantedLevel();
  if (arresting && !player.dead) { player.arrestT += dt; if (player.arrestT > (player.car ? 1.2 : 0.7)) bust(); }
  else player.arrestT = 0;
  // para perderlos: 8 segundos sin ningún policía cerca baja una estrella
  if (lv > 0 && !player.dead) {
    let seen = false;
    for (const c of cars) if (c.mode === 'cop' && dist2(c.x, c.y, player.x, player.y) < 420 * 420) { seen = true; break; }
    if (!seen) for (const p of peds) if (p.cop && p.chase && !p.dead && dist2(p.x, p.y, player.x, player.y) < 320 * 320) { seen = true; break; }
    evadeT = seen ? 0 : evadeT + dt;
    if (evadeT > 8) { heat = lv > 1 ? THRESH[lv - 2] : 0; evadeT = 0; showMsg(lv > 1 ? 'BAJÓ LA PERSECUCIÓN' : '¡LOS PERDISTE!', 2); }
  }
  copSpawnT -= dt;
  if (lv > 0 && copSpawnT <= 0 && !player.dead) {
    copSpawnT = 3.6 - lv * 0.4;
    let n = 0; for (const c of cars) if (c.mode === 'cop') n++;
    if (n < COPS_PER_LEVEL[lv]) spawnCop(lv);
  }
  let near = Infinity;
  for (const c of cars) if (c.mode === 'cop') near = Math.min(near, dist2(c.x, c.y, cam.x, cam.y));
  sfx.siren(lv > 0 ? clamp(1 - Math.sqrt(near) / 800, 0, 1) : 0);
}

// ============================================================ JUGADOR
function killPlayer() {
  if (player.dead) return;
  player.dead = true; player.deadT = 3.5;
  if (player.car) { const c = player.car; player.x = c.x; player.y = c.y; player.car = null; }
  splat(player.x, player.y, 26);
  player.busted = false;
  showMsg('¡SONASTE!', 3, true);
  sfx.blip(110, 0.6, 0.2);
}
function respawn() {
  player.dead = false; player.hp = 100; player.car = null; player.x = SPAWN.x; player.y = SPAWN.y; player.a = -Math.PI / 2;
  player.ammo = { pistola: Infinity, uzi: 0, escopeta: 0 }; player.weapon = 0;
  cam.x = player.x; cam.y = player.y;
  showMsg(player.busted ? 'SALISTE DE LA COMISARÍA' : 'PLAZA 25 DE MAYO', 2);
  if (player.busted) player.score = Math.floor(player.score * 0.7);
  player.busted = false; player.arrestT = 0;
  clearPolice();
}
function tryEnterExit() {
  for (const f of HOOKS.interact) if (f(player.car)) return;
  if (player.car) {
    const c = player.car;
    if (Math.hypot(c.vx, c.vy) > 45) return;
    const lx = Math.sin(c.a), ly = -Math.cos(c.a);
    for (const [s, f] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = c.x + lx * s * (c.w / 2 + 6) + Math.cos(c.a) * f * (c.l / 2 + 6);
      const py = c.y + ly * s * (c.w / 2 + 6) + Math.sin(c.a) * f * (c.l / 2 + 6);
      if (!SOLID[tileAtPx(px, py)]) {
        player.x = px; player.y = py; player.a = c.a; player.car = null; c.mode = 'phys';
        sfx.engine(false, 0, false); return;
      }
    }
    return;
  }
  let best = null, bd = 26 * 26;
  for (const c of cars) { if (c.wreck || c.burn > 0) continue; const d = dist2(c.x, c.y, player.x, player.y); if (d < bd) { bd = d; best = c; } }
  if (!best) return;
  if (best.mode === 'ai') toPhys(best);
  if (best.npc) { crime(best.cop ? 3 : 0.5); ejectDriver(best); player.score += 5; }
  else if (best.cop) crime(2);
  best.mode = 'player'; player.car = best;
  sfx.blip(330, 0.08);
}
function updatePlayer(dt) {
  if (player.dead) { player.deadT -= dt; if (player.deadT <= 0) respawn(); return; }
  const L = down('ArrowLeft', 'KeyA'), R = down('ArrowRight', 'KeyD'), U = down('ArrowUp', 'KeyW'), D = down('ArrowDown', 'KeyS');
  if (hit('Enter', 'KeyF', 'NumpadEnter')) tryEnterExit();
  if (player.car) {
    const c = player.car;
    carPhysics(c, dt, { thr: U, brk: D, steer: (R ? 1 : 0) - (L ? 1 : 0), hb: down('Space') });
    player.x = c.x; player.y = c.y; player.vx = c.vx; player.vy = c.vy; player.z = c.z; player.onBridge = c.onBridge;
    sfx.engine(true, c.vf, U);
    if (c.wreck) killPlayer();
    return;
  }
  if (hit('KeyQ')) cycleWeapon(-1);
  if (hit('KeyE')) cycleWeapon(1);
  player.cool -= dt;
  if (down('Space', 'KeyJ', 'KeyZ')) fire();
  player.a += ((R ? 1 : 0) - (L ? 1 : 0)) * 4.2 * dt;
  const spd = U ? 46 : D ? -22 : 0;
  const fx = Math.cos(player.a), fy = Math.sin(player.a);
  const r = 3, free = (x, y) => (player.onBridge && player.z > 6) || !solidPx(x - r, y - r) && !solidPx(x + r, y - r) && !solidPx(x - r, y + r) && !solidPx(x + r, y + r);
  const mx = player.x + fx * spd * dt, my = player.y + fy * spd * dt;
  if (free(mx, player.y)) player.x = mx;
  if (free(player.x, my)) player.y = my;
  pushOutOfCars(player, 3);
  player.vx = fx * spd; player.vy = fy * spd;
  player.anim += Math.abs(spd) * dt * 0.22;
  for (const pk of pickups) {
    if (pk.respawn > 0 || dist2(pk.x, pk.y, player.x, player.y) > 12 * 12) continue;
    showMsg(pk.type.give(), 1.5); pk.respawn = 60; sfx.blip(520, 0.15);
    if (pk.type.id !== 'vida' && WEAPONS[player.weapon].id === 'pistola') player.weapon = WEAPONS.findIndex(w => w.id === pk.type.id);
  }
}

// ============================================================ INPUT
const keys = {}, pressed = {};
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter']);
addEventListener('keydown', e => {
  if (MODAL) return; // la escena o minijuego activo maneja sus propias teclas
  if (state === 'play' && HOOKS.keydown.some(f => f(e))) { e.preventDefault(); return; }
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (state === 'title' && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) { startGame(); pressed[e.code] = false; }
  else if (e.code === 'KeyM' && state === 'play') { showBig = !showBig; bigEl.style.display = showBig ? 'block' : 'none'; if (showBig) drawBigMap(); }
  else if (e.code === 'KeyN') { const m = sfx.toggle(); showMsg(m ? 'SONIDO OFF' : 'SONIDO ON', 1); }
  else if (e.code === 'KeyH' && state === 'play') { titleEl.style.display = titleEl.style.display === 'none' ? 'flex' : 'none'; titleEl.querySelector('.start').textContent = 'H PARA VOLVER AL JUEGO'; }
});
addEventListener('keyup', e => { keys[e.code] = false; });
document.getElementById('title').addEventListener('click', () => startGame());
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const down = (...c) => c.some(k => keys[k]);
const hit = (...c) => c.some(k => pressed[k]);

// ============================================================ HUD
const $ = id => document.getElementById(id);
const screen = $('screen'), sctx = screen.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
const bigEl = $('bigmap'), titleEl = $('title');
const hud = { street: $('street'), score: $('score'), weapon: $('weapon'), speed: $('speed'), msg: $('msg'), wanted: $('wanted') };
const hudCache = {};
const setHud = (k, v) => { if (hudCache[k] !== v) { hudCache[k] = v; hud[k].innerHTML = v; } };
let msgT = 0;
function showMsg(t, secs, big = false) { hud.msg.textContent = t; hud.msg.className = 'hud' + (big ? ' big' : ''); hud.msg.style.opacity = 1; msgT = secs; }
let nameT = 0;
// numeración: direcciones reales de OSM agrupadas por calle
const ADDR = new Map();
{
  const A = MD.addresses || [];
  for (let i = 0; i < A.length; i += 4) {
    const nm = MD.names[A[i + 2]]; let l = ADDR.get(nm); if (!l) ADDR.set(nm, l = []);
    l.push([(A[i] + 0.5) * TS, (A[i + 1] + 0.5) * TS, A[i + 3]]);
  }
}
function streetNumbers(name, x, y) {
  const l = ADDR.get(name); if (!l) return '';
  let best = null, bd = 260 * 260;
  for (const a of l) { const d = dist2(a[0], a[1], x, y); if (d < bd) { bd = d; best = a; } }
  if (!best) return '';
  const h = Math.floor(best[2] / 100) * 100;
  return `${h + 100} - ${h}`;
}
// calle actual y, cerca de una esquina, la que cruza (con su sentido de circulación)
function nearStreets(px, py) {
  const l = nameGrid.get(Math.floor(py / NCELL) * 4096 + Math.floor(px / NCELL)); if (!l) return [];
  const best = new Map();
  for (const e of l) {
    const nm = MD.names[en[e]], d = segDist2(px, py, e);
    if (d > 60 * 60) continue;
    const b = best.get(nm);
    if (!b || d < b.d) best.set(nm, { nm, d, e });
  }
  return [...best.values()].sort((a, b) => a.d - b.d);
}
const ARROWS = ['→', '↓', '←', '↑'];
function signHTML(s) {
  const e = s.e, nm = s.nm;
  let arrow = '';
  if (!(ef[e] & 2) && (ef[e] & 1)) { // mano única: flechita con el sentido
    const k = Math.round(Math.atan2(edy[e], edx[e]) / (Math.PI / 2));
    arrow = `<div class="cs-arrow">${ARROWS[(k + 4) % 4]}</div>`;
  }
  const nums = streetNumbers(nm, player.x, player.y);
  return `<div class="cs"><div class="cs-plate"><div class="cs-top"><span class="cs-seal"></span><span>Municipalidad de<b>CORRIENTES</b></span></div>` +
    `<div class="cs-name">${nm}</div>${nums ? `<div class="cs-num">${nums}</div>` : ''}</div>${arrow}</div>`;
}
let signKey = '';
function updateSigns() {
  const near = nearStreets(player.x, player.y).filter(s => s.nm);
  const list = near.length ? [near[0]] : [];
  if (near[1] && near[1].d < 30 * 30) list.push(near[1]);
  const html = list.map(signHTML).join('');
  if (html !== signKey) { signKey = html; hud.street.innerHTML = html; }
}
function updateHud(dt) {
  msgT -= dt; if (msgT <= 0) hud.msg.style.opacity = 0;
  nameT -= dt;
  if (nameT <= 0) { nameT = 0.25; updateSigns(); }
  setHud('score', '$' + player.score);
  const lv = wantedLevel();
  setHud('wanted', '<i class="star on"></i>'.repeat(lv) + '<i class="star"></i>'.repeat(5 - lv));
  hud.wanted.classList.toggle('chase', lv > 0 && evadeT < 3);
  const w = WEAPONS[player.weapon], am = player.ammo[w.id];
  const hearts = '♥'.repeat(Math.ceil(player.hp / 25));
  setHud('weapon', player.car ? `<span style="color:#ff4f6f">${hearts}</span><br>AUTO ${Math.max(0, Math.round(player.car.hp))}%`
    : `<span style="color:#ff4f6f">${hearts}</span><br>${w.name} ${am === Infinity ? '∞' : am}`);
  setHud('speed', player.car ? Math.round(Math.abs(player.car.vf) * 0.675) + ' KM/H' : '');
}
function drawMini() {
  const S = mini.width, tx = Math.floor(player.x / TS), ty = Math.floor(player.y / TS);
  mctx.fillStyle = '#2a5aa8'; mctx.fillRect(0, 0, S, S);
  mctx.drawImage(mapImg, tx - S / 2, ty - S / 2, S, S, 0, 0, S, S);
  mctx.fillStyle = '#fff';
  for (const c of cars) if (c.mode === 'ai') { const x = Math.floor(c.x / TS) - tx + S / 2, y = Math.floor(c.y / TS) - ty + S / 2; if (x >= 0 && y >= 0 && x < S && y < S) { mctx.fillStyle = '#e8e0c0'; mctx.fillRect(x, y, 1, 1); } }
  const blink = (performance.now() / 250 | 0) % 2;
  for (const c of cars) if (c.cop && c.mode === 'cop') {
    const x = Math.floor(c.x / TS) - tx + S / 2, y = Math.floor(c.y / TS) - ty + S / 2;
    mctx.fillStyle = blink ? '#ff2a2a' : '#3a70ff'; mctx.fillRect(x - 1, y - 1, 3, 3);
  }
  for (const m of MARKERS) { // objetivos de misión (en el borde si quedan lejos)
    let x = m.x / TS - tx + S / 2, y = m.y / TS - ty + S / 2;
    const k = Math.max(Math.abs(x - S / 2), Math.abs(y - S / 2)) / (S / 2 - 3);
    if (k > 1) { x = S / 2 + (x - S / 2) / k; y = S / 2 + (y - S / 2) / k; }
    mctx.fillStyle = blink && k > 1 ? '#fff' : (m.color || '#ffd030'); mctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
  }
  mctx.fillStyle = blink ? '#f0c030' : '#ff4060';
  mctx.fillRect(S / 2 - 1, S / 2 - 1, 3, 3);
  mctx.fillStyle = '#fff';
  mctx.fillRect(Math.round(S / 2 + Math.cos(player.a) * 4), Math.round(S / 2 + Math.sin(player.a) * 4), 1, 1);
}
function drawBigMap() {
  const dpr = devicePixelRatio || 1;
  bigEl.width = innerWidth * dpr; bigEl.height = innerHeight * dpr;
  const g = bigEl.getContext('2d'); g.imageSmoothingEnabled = false;
  const s = Math.min(bigEl.width / W, bigEl.height / H) * 0.95, ox = (bigEl.width - W * s) / 2, oy = (bigEl.height - H * s) / 2;
  g.drawImage(mapImg, ox, oy, W * s, H * s);
  g.font = `${Math.round(8 * dpr)}px 'Press Start 2P', monospace`; g.textAlign = 'center';
  for (const [name, x, y] of MD.places) {
    if (!/^(Plaza|Parque|Hospital|Catedral|Iglesia|Universidad)/.test(name)) continue;
    g.fillStyle = '#000'; g.fillText(name, ox + x * s + 1, oy + y * s + 1);
    g.fillStyle = '#f4f0d8'; g.fillText(name, ox + x * s, oy + y * s);
  }
  const px = ox + player.x / TS * s, py = oy + player.y / TS * s;
  g.fillStyle = '#ff4060'; g.beginPath(); g.arc(px, py, 6 * dpr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr; g.stroke();
  g.font = `${Math.round(16 * dpr)}px 'Press Start 2P', monospace`; g.fillStyle = '#f0c030';
  g.fillText('CORRIENTES', bigEl.width / 2, 34 * dpr);
  g.font = `${Math.round(8 * dpr)}px 'Press Start 2P', monospace`; g.fillStyle = '#f4f0d8';
  g.fillText('M PARA VOLVER · Mapa © OpenStreetMap contributors · Edificios © Microsoft (ODbL) · Alturas: Google Open Buildings (CC BY 4.0)', bigEl.width / 2, bigEl.height - 14 * dpr);
}

// ============================================================ RENDER
const VIEW_H = USE3D ? 380 : 300, ZMIN = 0.55; // en 3D se ve un poco más de ciudad
const [buf, bctx] = canvas(16, 16);
const view = { w: 600, h: 300, scale: 1 };
let baseScale = 1, shake = 0;
function resize() {
  const dpr = devicePixelRatio || 1;
  screen.width = Math.floor(innerWidth * dpr); screen.height = Math.floor(innerHeight * dpr);
  baseScale = Math.max(1, screen.height / VIEW_H);
  buf.width = Math.ceil(screen.width / (baseScale * ZMIN)) + 4; buf.height = Math.ceil(screen.height / (baseScale * ZMIN)) + 4;
  bctx.imageSmoothingEnabled = false; sctx.imageSmoothingEnabled = false;
  if (R3) R3.resize(Math.ceil(screen.width / baseScale), Math.ceil(screen.height / baseScale));
  if (showBig) drawBigMap();
}
addEventListener('resize', resize);
function drawRot(img, x, y, a, ox, oy) {
  bctx.save(); bctx.translate(Math.round(x - ox), Math.round(y - oy)); bctx.rotate(a + Math.PI / 2);
  bctx.drawImage(img, -(img.width >> 1), -(img.height >> 1)); bctx.restore();
}
const FIRE_COL = ['#7a1a10', '#d04818', '#f09028', '#fff0a0'];
const GLYPH_W = 3;
function prefetchChunk(ox, oy, bw, bh) {
  // arma de a un chunk por cuadro alrededor de la vista, antes de que haga falta; primero los que quedan
  // hacia donde va el jugador (adelanta ~2 s de viaje), así manejando rápido no aparecen de golpe
  const vx = player.car ? player.car.vx : player.vx || 0, vy = player.car ? player.car.vy : player.vy || 0;
  const ax = clamp(vx * 2, -CPX * 2, CPX * 2), ay = clamp(vy * 2, -CPX * 2, CPX * 2);
  const m = CPX * 0.75, c0x = Math.floor((ox - m + Math.min(0, ax)) / CPX), c1x = Math.floor((ox + bw + m + Math.max(0, ax)) / CPX);
  const c0y = Math.floor((oy - m + Math.min(0, ay)) / CPX), c1y = Math.floor((oy + bh + m + Math.max(0, ay)) / CPX);
  const mx = (ox + bw / 2) / CPX - 0.5, my = (oy + bh / 2) / CPX - 0.5;
  let best = null, bd = Infinity;
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    if (cx < -1 || cy < -1 || cx * CH > W || cy * CH > H || chunks.has(cy * 4096 + cx)) continue;
    const d = (cx - mx) ** 2 + (cy - my) ** 2; // el más cercano al centro de la vista primero
    if (d < bd) { bd = d; best = [cx, cy]; }
  }
  if (best) getChunk(best[0], best[1]);
}
let builtThisFrame = 0;
function render() {
  if (R3) { frameNo++; R3.render(); builtThisFrame = 0; if (state === 'play') drawMini(); return; }
  frameNo++;
  const scale = baseScale * cam.zoom;
  view.scale = scale; view.w = screen.width / scale; view.h = screen.height / scale;
  const sx = shake > 0 ? rand(-1, 1) * shake * 8 : 0, sy = shake > 0 ? rand(-1, 1) * shake * 8 : 0;
  const ox = Math.round(cam.x - view.w / 2 + sx), oy = Math.round(cam.y - view.h / 2 + sy);
  const bw = Math.min(buf.width, Math.ceil(view.w) + 1), bh = Math.min(buf.height, Math.ceil(view.h) + 1);
  bctx.fillStyle = '#2a5aa8'; bctx.fillRect(0, 0, bw, bh);
  const c0x = Math.floor(ox / CPX), c1x = Math.floor((ox + bw) / CPX), c0y = Math.floor(oy / CPX), c1y = Math.floor((oy + bh) / CPX);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    if (cx < -1 || cy < -1 || cx * CH > W || cy * CH > H) continue;
    bctx.drawImage(getChunk(cx, cy).cv, cx * CPX - ox, cy * CPX - oy);
  }
  if (!builtThisFrame) prefetchChunk(ox, oy, bw, bh);
  builtThisFrame = 0;
  const vis = (x, y) => x > ox - 30 && y > oy - 30 && x < ox + bw + 30 && y < oy + bh + 30;
  // peatones caídos, después los vivos
  for (const p of peds) if (p.dead && vis(p.x, p.y)) drawRot(p.spr.dead, p.x, p.y, p.a, ox, oy);
  for (const p of peds) if (!p.dead && vis(p.x, p.y)) drawRot(p.spr.frames[Math.floor(p.anim) % 4], p.x, p.y, p.a, ox, oy);
  if (!player.car) {
    if (player.dead && !player.busted) drawRot(player.spr.dead, player.x, player.y, player.a, ox, oy);
    else drawRot(player.spr.frames[Math.floor(player.anim) % 4], player.x, player.y, player.a, ox, oy);
  }
  // autos
  for (const c of cars) if (vis(c.x, c.y)) drawRot(shadowSprite(c.w, c.l), c.x + 2, c.y + 3, c.a, ox, oy);
  const flash2 = (frameNo >> 3) & 1;
  for (const c of cars) {
    if (!vis(c.x, c.y)) continue;
    const siren = c.cop && !c.wreck && (c.mode === 'cop' || c === player.car);
    drawRot(siren && flash2 ? c.sprB : c.spr, c.x, c.y, c.a, ox, oy);
  }
  drawFX(ox, oy, bw, bh, false);
  sctx.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * scale, bh * scale);
  if (state === 'play') drawMini();
}
// Efectos que van "a nivel del piso": pickups, balizas, balas, partículas y la flechita del jugador
function drawFX(ox, oy, bw, bh, clear) {
  if (clear) bctx.clearRect(0, 0, bw + 2, bh + 2);
  const vis = (x, y) => x > ox - 30 && y > oy - 30 && x < ox + bw + 30 && y < oy + bh + 30;
  // pickups
  const bob = (performance.now() / 300 | 0) % 2;
  for (const pk of pickups) {
    if (pk.respawn > 0 || !vis(pk.x, pk.y)) continue;
    const x = Math.round(pk.x - ox) - 5, y = Math.round(pk.y - oy) - 5 - bob;
    bctx.fillStyle = 'rgba(0,0,0,0.35)'; bctx.fillRect(x + 2, y + 2 + bob, 10, 10);
    bctx.fillStyle = '#1a1a1a'; bctx.fillRect(x, y, 10, 10);
    bctx.fillStyle = pk.type.col; bctx.fillRect(x + 1, y + 1, 8, 8);
    bctx.fillStyle = '#fff';
    for (let i = 0; i < 15; i++) if (pk.type.glyph[i] === '1') bctx.fillRect(x + 4 + (i % GLYPH_W) - 1, y + 3 + Math.floor(i / GLYPH_W) - 1, 1, 1);
  }
  const flash = (frameNo >> 3) & 1;
  for (const c of cars) {
    if (!vis(c.x, c.y)) continue;
    const siren = c.cop && !c.wreck && (c.mode === 'cop' || c === player.car);
    if (siren) {
      bctx.fillStyle = flash ? 'rgba(60,110,255,0.22)' : 'rgba(255,40,40,0.22)';
      disc(bctx, Math.round(c.x - ox), Math.round(c.y - oy), 9);
    }
  }
  // balas
  bctx.fillStyle = '#fff8c0';
  for (const b of bullets) bctx.fillRect(Math.round(b.x - ox), Math.round(b.y - oy), 2, 2);
  // partículas
  for (const p of parts) {
    if (!vis(p.x, p.y)) continue;
    const f = clamp(p.life / p.max, 0, 0.999);
    if (p.kind === 'fire') bctx.fillStyle = FIRE_COL[Math.floor(f * 4)];
    else if (p.kind === 'smoke') bctx.fillStyle = `rgba(60,56,60,${0.55 * f})`;
    else if (p.kind === 'flash') bctx.fillStyle = '#fff6a0';
    else bctx.fillStyle = f > 0.5 ? '#fff6c0' : '#f0a030';
    const s = p.kind === 'smoke' ? Math.round(p.size + (1 - f) * 5) : p.size;
    bctx.fillRect(Math.round(p.x - ox - s / 2), Math.round(p.y - oy - s / 2), s, s);
  }
  // indicador del jugador cuando está en auto (flechita parpadeante tipo arcade)
  if (player.car && (frameNo >> 4) % 2) {
    bctx.fillStyle = '#f0c030';
    const x = Math.round(player.car.x - ox), y = Math.round(player.car.y - oy) - 20;
    bctx.fillRect(x - 2, y, 5, 1); bctx.fillRect(x - 1, y + 1, 3, 1); bctx.fillRect(x, y + 2, 1, 1);
  }
}

// ============================================================ LOOP
let manageT = 0;
const AI_TARGET = 34, PED_TARGET = 70;
function update(dt) {
  for (const f of HOOKS.update) f(dt);
  updatePlayer(dt);
  if (!player.car) updateZ(player);
  for (const p of peds) updateZ(p);
  for (const c of cars) {
    const near = dist2(c.x, c.y, cam.x, cam.y) < 1400 * 1400;
    if (near) updateZ(c);
    if (c.mode === 'ai') updateAI(c, dt);
    else if (c.mode === 'cop') updateCopCar(c, dt);
    else if (c.mode === 'phys' && near && (Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.spin) > 0.5)) carPhysics(c, dt, null);
    if (c.burn > 0) {
      c.burn -= dt;
      if (rand() < 0.6) parts.push({ x: c.x + rand(-4, 4), y: c.y + rand(-6, 6), vx: rand(-10, 10), vy: rand(-30, -5), life: rand(0.3, 0.7), max: 0.7, kind: 'fire', size: 2 });
      if (c.burn <= 0) explode(c);
    } else if (!c.wreck && c.hp < 35 && near) {
      c.smoke -= dt;
      if (c.smoke <= 0) { c.smoke = 0.12; parts.push({ x: c.x + Math.cos(c.a) * c.l / 3, y: c.y + Math.sin(c.a) * c.l / 3, vx: rand(-8, 8), vy: rand(-8, 8), life: 1.2, max: 1.2, kind: 'smoke', size: 2 }); }
    }
  }
  // choques entre autos (al menos uno en movimiento libre)
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.mode === 'ai' || Math.abs(a.vx) + Math.abs(a.vy) < 3) continue;
    for (let j = 0; j < cars.length; j++) {
      const b = cars[j];
      if (b === a || dist2(a.x, a.y, b.x, b.y) > 30 * 30) continue;
      if (b.mode !== 'ai' && Math.abs(b.vx) + Math.abs(b.vy) >= 3 && j < i) continue;
      collideCars(a, b);
    }
    carHitsPeople(a);
  }
  arresting = false;
  for (const p of peds) { if (p.cop && p.chase && !p.dead) updateCopPed(p, dt); else updatePed(p, dt); if (!p.dead) pushOutOfCars(p, 3); }
  updatePolice(dt);
  updateBullets(dt);
  updateParts(dt);
  for (const pk of pickups) if (pk.respawn > 0) pk.respawn -= dt;
  // cámara: sigue con anticipación y se aleja con la velocidad (como los clásicos)
  const sp = player.car ? Math.hypot(player.car.vx, player.car.vy) : 0;
  const tx = player.x + (player.car ? player.car.vx * 0.5 : 0), ty = player.y + (player.car ? player.car.vy * 0.5 : 0);
  cam.x += (tx - cam.x) * Math.min(1, dt * 4); cam.y += (ty - cam.y) * Math.min(1, dt * 4);
  // se aleja recién desde ~50 px/s, con curva suave y un tope: las motos casi no alejan (se veían diminutas)
  const pc = player.car, zFar = !pc ? 1 : pc.type === 'moto' ? 0.88 : pc.l > 40 ? 0.74 : 0.8;
  const zu = clamp((sp - 50) / 130, 0, 1), zt = 1 - (1 - zFar) * zu * zu * (3 - 2 * zu);
  cam.zoom += (zt - cam.zoom) * Math.min(1, dt * (zt < cam.zoom ? 1.2 : 0.7));
  if (shake > 0) shake -= dt;
  manageT -= dt;
  if (manageT <= 0) {
    manageT = 0.4;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      const far = dist2(c.x, c.y, cam.x, cam.y);
      if (c.remove || (c.mode === 'ai' && !c.isBus && far > 1250 * 1250) || (c.mode === 'cop' && far > 1600 * 1600) ||
          (c.leaving && c.mode === 'phys' && !visible(c.x, c.y, 80))) cars.splice(i, 1);
    }
    for (let i = peds.length - 1; i >= 0; i--) {
      const q = peds[i];
      if (dist2(q.x, q.y, cam.x, cam.y) > 950 * 950 || (q.cop && !q.chase && !visible(q.x, q.y, 60))) peds.splice(i, 1);
    }
    let ai = 0; for (const c of cars) if (c.mode === 'ai' && !c.isBus) ai++;
    for (let k = 0; k < 4 && ai < AI_TARGET; k++, ai++) spawnAI();
    let alive = 0; for (const p of peds) if (!p.dead) alive++;
    for (let k = 0; k < 6 && alive < PED_TARGET; k++, alive++) spawnPed();
  }
  updateHud(dt);
}
function startGame() {
  if (state === 'play') { titleEl.style.display = 'none'; return; }
  state = 'play'; titleEl.style.display = 'none'; mini.style.display = 'block';
  sfx.init();
  showMsg('¡BIENVENIDO A CORRIENTES!', 2.5);
  setTimeout(() => { if (!player.car) showMsg('ENTER PARA ROBAR UN AUTO', 2.5); }, 2800);
}

// ---- inicio
function setup() {
  // ubicar al jugador en un lugar caminable cerca de la plaza
  let sx = Math.floor(SPAWN.x / TS), sy = Math.floor(SPAWN.y / TS);
  outer: for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (WALK_CALM[tileAt(sx + dx, sy + dy)]) { sx += dx; sy += dy; break outer; }
  }
  SPAWN.x = (sx + 0.5) * TS; SPAWN.y = (sy + 0.5) * TS;
  player.x = SPAWN.x; player.y = SPAWN.y; cam.x = player.x; cam.y = player.y;
  parkCars();
  // un auto rojo esperando al lado de la plaza
  const e = nearestDriveEdge(SPAWN.x, SPAWN.y);
  if (e >= 0) {
    laneInfo(e);
    const a = ea[e];
    let t = (SPAWN.x - nx[a]) * edx[e] + (SPAWN.y - ny[a]) * edy[e]; t = clamp(t, 30, elen[e] - 30);
    for (const off of [epark[e], -epark[e], eoff[e], 0]) {
      const x = nx[a] + edx[e] * t - edy[e] * off, y = ny[a] + edy[e] * t + edx[e] * off;
      for (let i = cars.length - 1; i >= 0; i--) if (dist2(cars[i].x, cars[i].y, x, y) < 30 * 30) cars.splice(i, 1);
      const c = makeCar(x, y, Math.atan2(edy[e], edx[e]), { type: 'sedan', color: '#e03c3c' });
      if (!carHits(x, y, c.a, c)) break;
      cars.pop();
    }
    // y un deportivo negro con la Z, un poco más adelante sobre la misma calle
    for (const dt2 of [60, -60, 110, -110]) {
      const t2 = clamp(t + dt2, 20, elen[e] - 20), off = epark[e];
      const x = nx[a] + edx[e] * t2 - edy[e] * off, y = ny[a] + edy[e] * t2 + edx[e] * off;
      if (cars.some(o => dist2(o.x, o.y, x, y) < 28 * 28)) continue;
      const z = makeCar(x, y, Math.atan2(edy[e], edx[e]), { type: 'zcar', color: '#141414' });
      if (!carHits(x, y, z.a, z)) break;
      cars.pop();
    }
  }
  for (const [tx, ty, a, ci] of (MD.props && MD.props.cars) || []) {
    const x = (tx + 0.5) * TS, y = (ty + 0.5) * TS;
    for (let i = cars.length - 1; i >= 0; i--) if (dist2(cars[i].x, cars[i].y, x, y) < 20 * 20) cars.splice(i, 1);
    makeCar(x, y, a, { type: ci === 1 ? 'pickup' : 'sedan', color: CAR_COLORS[ci] });
  }
  spawnBuses();
  placePickups();
  if (USE3D) {
    const c3 = $('screen3d');
    R3 = window.createRender3D({
      canvas: c3, TS, CPX, CH, FLOOR, VS, BLD, BRIDGES, SPAWN, cars, peds, player, cam, view, chunks, fxCanvas: buf,
      T: { BLOCK: T_BLOCK, OSMB: T_OSMB, YARD: T_YARD, SIDE: T_SIDE, BRIDGEW: T_BRIDGEW },
      hash, rectInside, tileAtPx, getChunk, drawFX, bridgeZ, bridgePoint,
      roofPal: roofPalOf, PROPS: MD.props || {}, MD, GANTRY, SIGNALS: MD.signals || [], tileAt, T_ALL: { MEDIAN: T_MEDIAN, SIDE: T_SIDE, ROADLIKE }, CH,
      inMap: (cx, cy) => !(cx < -1 || cy < -1 || cx * CH > W || cy * CH > H),
      prefetch: (x, y, w, h) => { if (!builtThisFrame) prefetchChunk(x, y, w, h); },
      shake: () => shake, frameNo: () => frameNo, get baseScale() { return baseScale; },
    });
    if (R3) { c3.style.display = 'block'; screen.style.display = 'none'; }
  }
  resize();
  for (let i = 0; i < 40; i++) spawnPed();
}
setup();
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (MODAL) { for (const k in keys) keys[k] = false; for (const k in pressed) pressed[k] = false; requestAnimationFrame(loop); return; }
  if (state === 'play' && !showBig && !window.__freeze) { // __freeze: pausa para depurar desde la consola
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; for (const k in pressed) pressed[k] = false; }
  } else {
    for (const k in pressed) pressed[k] = false;
    if (state === 'title') { cam.x = player.x + Math.cos(now / 4000) * 60; cam.y = player.y + Math.sin(now / 4000) * 40; }
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// para depurar desde la consola
window.__game = { player, cars, peds, cam, tileAt, MD, crime, wantedLevel, buildChunk, BRIDGES, bridgeAt, bridgePoint, GANTRY, BLD, get R3() { return R3; },
  step: n => { for (let i = 0; i < n; i++) { update(STEP); for (const k in pressed) pressed[k] = false; } } };
// API pública para los módulos (ver el comentario de "API PARA MÓDULOS")
{
  const [S0, W0, N0, E0] = MD.bbox, MX0 = Math.cos((S0 + N0) / 2 * Math.PI / 180) * 111320, MY0 = 110574, TM = MD.tileMeters;
  window.Chipa = {
    hooks: HOOKS, markers: MARKERS,
    get modal() { return MODAL; },
    // abre una pantalla a pantalla completa (escena 3D, minijuego) y pausa el mundo; close() lo devuelve
    openModal(owner) { MODAL = owner || {}; sfx.engine(false, 0, false); [screen, $('screen3d')].forEach(c => c.style.visibility = 'hidden'); },
    closeModal() { MODAL = null; [screen, $('screen3d')].forEach(c => c.style.visibility = ''); last = performance.now(); acc = 0; },
    get state() { return state; },
    player, cars, peds, cam, MD, TS, VTYPE, CAR_COLORS, WEAPONS, BLD,
    graph: { nx, ny, ea, eb, ef, edx, edy, elen, out, DRIVE_EDGES },
    tileAt, tileAtPx, solidPx, SOLID, T: { BLOCK: T_BLOCK, ROAD: T_ROAD, SIDE: T_SIDE, GRASS: T_GRASS, WATER: T_WATER, PARK: T_PARK, MEDIAN: T_MEDIAN },
    makeCar, makePed, killPed, explode, damageCar, crime, wantedLevel, clearPolice, showMsg, sfx, respawn,
    carSprite, busSprite, sportSprite, motoSprite, pedSprites, randomOutfit,
    nearestDriveEdge, nearestNode, findPath, streetName, lanePoint, laneInfo,
    // coordenadas: lat/lon <-> px del mundo
    ll2px: (lat, lon) => [((lon - W0) * MX0 / TM + 0.5) * TS, ((N0 - lat) * MY0 / TM + 0.5) * TS],
    px2ll: (x, y) => [N0 - (y / TS - 0.5) * TM / MY0, W0 + (x / TS - 0.5) * TM / MX0],
    metersToPx: m => m * TS / TM,
    isDown: (...c) => c.some(k => keys[k]), wasHit: (...c) => c.some(k => pressed[k]),
    teleport(x, y) { const o = player.car || player; o.x = x; o.y = y; player.x = x; player.y = y; cam.x = x; cam.y = y; },
  };
  dispatchEvent(new Event('chipa-ready'));
}
})();
