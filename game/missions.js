// CHIPA CITY — motor de misiones (window.Chipa.missions)
// Lee window.MISSIONS / window.MISSION_PLACES (game/missions_data.js, del guionista; formato en docs/EQUIPO.md).
// Si no existen, usa MISSIONS_FALLBACK (misiones de prueba de este archivo, una por tipo de paso).
//
// Cómo se juega:
//   - Los "dadores" son peatones parados con un aro de color (y su marca en el minimapa). Acercate y ENTER.
//   - Ficha de misión: ←/→ elige, ENTER confirma, ESC rechaza (o S / N).
//   - TAB o L: listado de misiones (bloqueadas / disponibles / completadas). ENTER sobre una disponible la marca en el mapa.
//   - Diálogos: ENTER o ESPACIO avanza (la primera vez completa el texto).
//   - Elecciones: ↑/↓ o 1-4 y ENTER.
//   - ESC durante una misión: abandonar (pide confirmación).
//   - Si fallás: ENTER reintenta desde el principio (te lleva al dador), ESC sale.
//
// Objetos del mundo (dadores, bolsas, paradas, postes, pasajeros) se dibujan como peatones "quietos":
// un peatón con dead = true no tiene IA ni lo pisan los autos, y el render (2D y 3D) dibuja p.spr.dead.
// Por eso cada objeto propio tiene spr = { frames, dead: <canvas actual> } y lo animamos cambiando spr.dead.
'use strict';
(() => {
function boot() {
  const C = window.Chipa;
  if (!C || C.missions) return;
  const G = C.graph, TS = C.TS;

  // ============================================================ UTILIDADES
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const d2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  const dist = (a, b) => Math.sqrt(d2(a.x, a.y, b.x, b.y));
  const m2px = m => C.metersToPx(m);
  const px2m = p => p / C.metersToPx(1);
  const strHash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function shade(hex, k) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g];
  }
  const R = (g, col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const speedOf = c => c ? Math.hypot(c.vx, c.vy) : 0;
  const kmh = c => Math.round(Math.abs(c ? (c.vf || 0) : 0) * 0.675);

  // letras de 3x5 (para carteles en los sprites)
  const GL = {
    A: '010101111101101', C: '011100100100011', D: '110101101101110', E: '111100110100111', I: '111010010010111',
    M: '101111111101101', P: '110101110100100', R: '110101110101101', S: '011100010001110', B: '110101110101110',
  };
  function glyphs(g, text, x, y, col) {
    g.fillStyle = col;
    for (const ch of text) { const gl = GL[ch]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') g.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1); x += 4; }
  }

  // ============================================================ TILES Y LUGARES
  const T = C.T;
  const WALK_CALM = new Set([2, 3, 5, 6, 10]); // vereda, pasto, arena, peatonal, sendero
  const solidT = t => C.SOLID[t] === 1;
  // tile más cercano (en espiral) que cumpla pred(tipo); devuelve el centro en px
  function nearestTile(x, y, pred, maxR = 40) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (pred(C.tileAt(tx, ty))) return [(tx + 0.5) * TS, (ty + 0.5) * TS];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!pred(C.tileAt(tx + dx, ty + dy))) continue;
        const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = [(tx + dx + 0.5) * TS, (ty + dy + 0.5) * TS]; }
      }
      if (best) return best;
    }
    return null;
  }
  // punto caminable: primero vereda/pasto cerca, si no cualquier cosa no sólida
  function snapWalk(x, y) {
    if (!solidT(C.tileAtPx(x, y)) && WALK_CALM.has(C.tileAtPx(x, y))) return [x, y];
    const near = nearestTile(x, y, t => WALK_CALM.has(t), 6);
    if (near) return near;
    if (!solidT(C.tileAtPx(x, y))) return [x, y];
    return nearestTile(x, y, t => !solidT(t), 60) || [x, y];
  }
  // proyecta sobre una arista de la red vial
  function proj(e, x, y) {
    const a = G.ea[e]; return clamp((x - G.nx[a]) * G.edx[e] + (y - G.ny[a]) * G.edy[e], 0, G.elen[e]);
  }
  // punto manejable (carril derecho de la calle más cercana) → {x, y, a, e, s}
  function snapDrive(x, y) {
    const e = C.nearestDriveEdge(x, y);
    if (e < 0) { const [wx, wy] = snapWalk(x, y); return { x: wx, y: wy, a: 0, e: -1, s: 0 }; }
    const s = proj(e, x, y), [px, py] = C.lanePoint(e, s, 1);
    return { x: px, y: py, a: Math.atan2(G.edy[e], G.edx[e]), e, s };
  }
  // vereda más cercana del lado derecho de un punto de calle (para paradas, postes y pasajeros)
  function curbSpot(dp) {
    if (dp.e >= 0) {
      const rx = -G.edy[dp.e], ry = G.edx[dp.e];
      for (let k = 2; k < 90; k += 2) {
        const x = dp.x + rx * k, y = dp.y + ry * k, t = C.tileAtPx(x, y);
        if (solidT(t)) break;
        if (t === T.SIDE || t === T.GRASS) return [x + rx * 3, y + ry * 3];
      }
    }
    return nearestTile(dp.x, dp.y, t => t === T.SIDE, 12) || snapWalk(dp.x, dp.y);
  }
  // lugar del guion → [x, y] en px (lat/lon, nombre de MISSION_PLACES o {x, y} en px)
  function resolveAt(at, fallback) {
    if (at == null) return fallback ? [fallback.x, fallback.y] : null;
    if (typeof at === 'string') {
      const pl = (window.MISSION_PLACES || {})[at] || (FALLBACK_PLACES[at]);
      if (!pl) { console.warn('[misiones] lugar desconocido:', at); return fallback ? [fallback.x, fallback.y] : null; }
      return resolveAt(pl, fallback);
    }
    if (Array.isArray(at) && at.length >= 2 && isFinite(at[0]) && isFinite(at[1])) {
      if (Math.abs(at[0]) <= 90 && Math.abs(at[1]) <= 180) return C.ll2px(at[0], at[1]);
      return [at[0], at[1]]; // ya en px
    }
    if (typeof at === 'object' && isFinite(at.x) && isFinite(at.y)) return [at.x, at.y];
    if (typeof at === 'object' && isFinite(at.lat)) return C.ll2px(at.lat, at.lon);
    console.warn('[misiones] lugar inválido:', at);
    return fallback ? [fallback.x, fallback.y] : null;
  }
  const placeName = at => typeof at === 'string' ? at.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

  // ============================================================ SPRITES (todos de frente hacia arriba = +x en el mundo)
  const spr = new Map();
  const cached = (k, fn) => { if (!spr.has(k)) spr.set(k, fn()); return spr.get(k); };

  // camión compactador de basura: blanco y naranja, casi tan largo como un colectivo
  function basureroSprite(wreck = false) {
    return cached('basurero' + wreck, () => {
      const w = 15, l = 46, [c, g] = canvas(w, l);
      const white = wreck ? '#3a3634' : '#ecebe6', orange = wreck ? '#2e2a28' : '#e8781e', dark = wreck ? '#1e1c1a' : '#5a5a58';
      R(g, dark, 0, 1, w, l - 2); R(g, dark, 1, 0, w - 2, l);
      // cabina
      R(g, white, 1, 1, w - 2, 11);
      R(g, wreck ? '#141210' : '#24304a', 2, 2, w - 4, 3);             // parabrisas
      if (!wreck) R(g, '#6a8ab8', 3, 2, 3, 1);
      R(g, shade(white, -0.12), 2, 6, w - 4, 5);                         // techo de la cabina
      if (!wreck) { R(g, '#ffb020', 6, 7, 3, 2); R(g, '#fff0a0', 7, 7, 1, 1); } // baliza
      R(g, dark, 0, 7, 1, 2); R(g, dark, w - 1, 7, 1, 2);               // espejos
      R(g, '#2a2826', 1, 12, w - 2, 1);                                  // unión cabina-caja
      // caja compactadora
      R(g, white, 1, 13, w - 2, 25);
      for (let y = 15; y < 37; y += 3) R(g, shade(white, -0.08), 2, y, w - 4, 1); // nervaduras del techo
      R(g, orange, 1, 17, w - 2, 2); R(g, orange, 1, 31, w - 2, 2);     // franjas naranjas
      R(g, orange, 1, 13, 1, 25); R(g, orange, w - 2, 13, 1, 25);       // laterales
      // tolva trasera
      R(g, orange, 1, 38, w - 2, 7);
      R(g, wreck ? '#0a0a0a' : '#1a1816', 3, 39, w - 6, 3);              // boca de carga
      if (!wreck) for (let x = 1; x < w - 1; x += 2) { R(g, '#141414', x, 43, 1, 2); R(g, '#f0d020', x + 1, 43, 1, 2); } // rayas de peligro
      if (!wreck) { R(g, '#fff3b0', 1, 0, 2, 1); R(g, '#fff3b0', w - 3, 0, 2, 1); R(g, '#e03030', 1, l - 1, 2, 1); R(g, '#e03030', w - 3, l - 1, 2, 1); }
      else for (let i = 0; i < 18; i++) R(g, '#5a4a40', Math.floor(rand(1, w - 2)), Math.floor(rand(1, l - 2)), 2, 1);
      return c;
    });
  }
  // remís: sedán con el cartel REMIS en el techo (caja blanca con borde azul y la R roja)
  function remisSprite(color = '#e8e8e8', wreck = false) {
    return cached('remis' + color + wreck, () => {
      const w = 11, l = 22, [c, g] = canvas(w, l);
      const base = wreck ? '#34302e' : color, dark = shade(base, -0.45), light = shade(base, 0.28);
      R(g, dark, 0, 1, w, l - 2); R(g, dark, 1, 0, w - 2, l);
      R(g, base, 1, 1, w - 2, l - 2);
      R(g, light, 2, 2, w - 4, 1);
      const glass = wreck ? '#1a1818' : '#24304a';
      R(g, glass, 2, 6, w - 4, 3); if (!wreck) R(g, '#6a8ab8', 3, 6, 2, 1);
      R(g, dark, 0, 7, 1, 1); R(g, dark, w - 1, 7, 1, 1);
      R(g, light, 2, 9, w - 4, 5);
      R(g, glass, 2, 14, w - 4, 2);
      if (!wreck) {
        R(g, '#2050c0', 2, 9, 7, 7); R(g, '#ffffff', 3, 10, 5, 5);         // cartel
        glyphs(g, 'R', 4, 10, '#c82828');
        R(g, '#ffd030', 2, 9, 1, 1); R(g, '#ffd030', 8, 9, 1, 1);
        R(g, '#fff3b0', 1, 0, 2, 1); R(g, '#fff3b0', w - 3, 0, 2, 1);
        R(g, '#e03030', 1, l - 1, 2, 1); R(g, '#e03030', w - 3, l - 1, 2, 1);
      } else for (let i = 0; i < 10; i++) R(g, '#5a4a40', Math.floor(rand(1, w - 2)), Math.floor(rand(1, l - 2)), 2, 1);
      return c;
    });
  }
  // camioneta de la DPEC: blanca, franja azul, escalera y canasta hidráulica, logo (rayo) en el techo
  function dpecSprite(wreck = false) {
    return cached('dpec' + wreck, () => {
      const w = 13, l = 30, [c, g] = canvas(w, l);
      const white = wreck ? '#3a3634' : '#f0f0ec', dark = wreck ? '#1e1c1a' : '#55585c', blue = wreck ? '#2a2826' : '#1a4aa8';
      R(g, dark, 0, 1, w, l - 2); R(g, dark, 1, 0, w - 2, l);
      R(g, white, 1, 1, w - 2, l - 2);
      R(g, wreck ? '#141210' : '#24304a', 2, 2, w - 4, 3); if (!wreck) R(g, '#6a8ab8', 3, 2, 2, 1);
      R(g, shade(white, -0.08), 2, 5, w - 4, 6);                         // techo de la cabina
      R(g, blue, 0, 3, 1, l - 6); R(g, blue, w - 1, 3, 1, l - 6);       // franja
      R(g, dark, 0, 6, 1, 1); R(g, dark, w - 1, 6, 1, 1);
      if (!wreck) {                                                      // logo DPEC: rayo amarillo en un disco azul
        R(g, blue, 4, 5, 5, 6); R(g, blue, 3, 6, 7, 4);
        R(g, '#ffd030', 6, 5, 2, 1); R(g, '#ffd030', 5, 6, 2, 1); R(g, '#ffd030', 5, 7, 3, 1); R(g, '#ffd030', 6, 8, 2, 1); R(g, '#ffd030', 6, 9, 1, 1);
        R(g, '#ff9020', 2, 5, 1, 1); R(g, '#ff9020', w - 3, 5, 1, 1);      // balizas
      }
      R(g, wreck ? '#2a2826' : '#8a8e92', 2, 12, w - 4, l - 14);          // caja
      R(g, '#3a3c40', 5, 17, 3, 3);                                       // base del brazo hidráulico
      const lad = wreck ? '#4a4440' : '#e8b020';
      R(g, lad, 3, 4, 1, 20); R(g, lad, 9, 4, 1, 20);                    // escalera (asoma sobre la cabina)
      for (let y = 5; y < 24; y += 3) R(g, lad, 4, y, 5, 1);
      R(g, wreck ? '#3a3430' : '#f0d020', 3, 24, 7, 5); R(g, '#3a3020', 4, 25, 5, 3); // canasta
      if (!wreck) { R(g, '#fff3b0', 1, 0, 2, 1); R(g, '#fff3b0', w - 3, 0, 2, 1); R(g, '#e03030', 1, l - 1, 2, 1); R(g, '#e03030', w - 3, l - 1, 2, 1); }
      else for (let i = 0; i < 12; i++) R(g, '#5a4a40', Math.floor(rand(1, w - 2)), Math.floor(rand(1, l - 2)), 2, 1);
      return c;
    });
  }
  // registra los tipos nuevos (no pisa si ya están)
  Object.assign(C.VTYPE, Object.assign({
    basurero: { w: 15, l: 46, maxv: 120, acc: 78, grip: 9 },
    remis: { w: 11, l: 22, maxv: 200, acc: 150, grip: 8 },
    dpec: { w: 13, l: 30, maxv: 165, acc: 115, grip: 8 },
  }, Object.fromEntries(Object.entries(C.VTYPE).filter(([k]) => ['basurero', 'remis', 'dpec'].includes(k)))));

  const VEH = {
    colectivo: { name: 'el colectivo', type: 'bus' },
    basurero: { name: 'el camión de la basura', type: 'basurero' },
    remis: { name: 'el remís', type: 'remis' },
    dpec: { name: 'la camioneta de la DPEC', type: 'dpec' },
    patrullero: { name: 'el patrullero', type: 'police' },
  };
  const ALIAS = { bus: 'colectivo', taxi: 'remis', policia: 'patrullero', police: 'patrullero', camion: 'basurero', basura: 'basurero', auto: 'sedan', car: 'sedan', camioneta: 'pickup' };
  const kindOf = k => ALIAS[k] || k;
  function vehName(kind) {
    kind = kindOf(kind);
    if (VEH[kind]) return VEH[kind].name;
    return ({ sedan: 'el auto', pickup: 'la camioneta', sport: 'el deportivo', zcar: 'el auto negro', moto: 'la moto' })[kind] || 'el vehículo';
  }
  const aVeh = kind => vehName(kind).replace(/^el /, 'al ').replace(/^la /, 'a la ').toUpperCase(); // "al remís", "a la camioneta"
  // sprite y tipo físico para cada clase de vehículo de misión
  function vehSpec(kind, o = {}) {
    kind = kindOf(kind);
    if (kind === 'colectivo') { const line = o.line || 104, ramal = o.ramal || 'A'; return { type: 'bus', spr: C.busSprite(line, ramal, false), line, ramal }; }
    if (kind === 'basurero') return { type: 'basurero', spr: basureroSprite() };
    if (kind === 'remis') return { type: 'remis', spr: remisSprite(o.color || '#e8e8e8'), color: o.color || '#e8e8e8' };
    if (kind === 'dpec') return { type: 'dpec', spr: dpecSprite() };
    if (kind === 'patrullero') return { type: 'police', spr: C.carSprite('police', '#ececec'), color: '#ececec', sprB: C.carSprite('police', '#ececec', false, true) };
    const type = C.VTYPE[kind] ? kind : 'sedan', color = o.color || pick(C.CAR_COLORS);
    return { type, color, spr: C.carSprite(type, color) };
  }
  function wreckSprite(c) {
    if (c.type === 'basurero') return basureroSprite(true);
    if (c.type === 'remis') return remisSprite(c.color, true);
    if (c.type === 'dpec') return dpecSprite(true);
    return null;
  }

  // ---- objetos del mundo
  // aro punteado (la "corona" de los objetivos), con 3 cuadros para que gire
  function ringFrames(rpx, color) {
    rpx = Math.round(clamp(rpx, 6, 80));
    return cached('ring' + rpx + color, () => [0, 1, 2].map(k => {
      const S = rpx * 2 + 4, [c, g] = canvas(S, S), n = Math.max(12, Math.round(rpx * 1.6));
      g.fillStyle = color;
      for (let i = 0; i < n; i++) {
        if ((i + k) % 3 === 2) continue;
        const a = i / n * Math.PI * 2;
        g.fillRect(Math.round(S / 2 + Math.cos(a) * rpx - 1), Math.round(S / 2 + Math.sin(a) * rpx - 1), 2, 2);
      }
      return c;
    }));
  }
  // dador: el peatón parado adentro de su aro
  function giverFrames(look, color) {
    const ped = C.pedSprites(normLook(look));
    return [0, 1, 2].map(k => {
      const [c, g] = canvas(25, 25);
      g.drawImage(ringFrames(10, color)[k], 0, 0);
      g.drawImage(ped.frames[0], 7, 7);
      return c;
    });
  }
  // bolsas de basura en la vereda
  function bagSprite(seed) {
    return cached('bag' + seed, () => {
      const [c, g] = canvas(14, 10), r = (strHash('b' + seed) % 1000) / 1000;
      const bag = (x, y, col) => { R(g, shade(col, -0.4), x, y + 1, 6, 6); R(g, shade(col, -0.4), x + 1, y, 4, 8); R(g, col, x + 1, y + 1, 4, 6); R(g, shade(col, 0.35), x + 1, y + 1, 2, 1); R(g, '#d8d8c8', x + 2, y, 2, 1); };
      bag(0, 2, r < 0.5 ? '#1c2420' : '#202020');
      bag(7, 1, r < 0.3 ? '#2a4a30' : '#1a1a1e');
      if (r > 0.6) bag(4, 0, '#3a3a40');
      return c;
    });
  }
  // refugio de colectivo (techo verde municipal) con el cartel P
  function stopFrames() {
    return cached('stop', () => [0, 1].map(k => {
      const [c, g] = canvas(28, 11);
      R(g, '#0e2a1a', 0, 2, 22, 8); R(g, '#1f7a4c', 1, 3, 20, 6); R(g, '#f4f4f0', 1, 3, 20, 1); R(g, '#2a9a60', 2, 5, 18, 1);
      R(g, '#3a3a3a', 23, 6, 1, 4);                                           // poste del cartel
      R(g, '#f4f4f0', 22, 0, 6, 7); R(g, k ? '#2050c0' : '#1a40a0', 23, 1, 4, 5); glyphs(g, 'P', 24, 1, '#ffffff');
      return c;
    }));
  }
  // poste de luz con su cruceta; con chispas cuando se corta, gris cuando ya está cortado
  function poleFrames() {
    return cached('pole', () => {
      const base = (sparks, cut) => {
        const [c, g] = canvas(19, 9);
        R(g, cut ? '#4a4a4a' : '#5a4030', 2, 3, 15, 3);
        R(g, '#2a2420', 8, 3, 3, 3);
        for (const x of [2, 9, 16]) R(g, cut ? '#7a7a7a' : '#f4f4f0', x, 2, 1, 1);
        if (!cut) { R(g, '#909090', 0, 2, 2, 1); R(g, '#909090', 17, 2, 2, 1); }
        if (cut) { R(g, '#c02020', 5, 0, 1, 1); R(g, '#c02020', 13, 8, 1, 1); }
        for (let i = 0; i < sparks; i++) R(g, pick(['#fff6a0', '#ffd030', '#ffffff', '#60c0ff']), Math.floor(rand(0, 19)), Math.floor(rand(0, 9)));
        return c;
      };
      return { idle: [base(0, false), base(0, false)], spark: [base(5, false), base(7, false), base(6, false)], cut: [base(0, true)] };
    });
  }
  // íconos para juntar (con aro chico)
  function iconFrames(icon, color = '#f0c030') {
    return cached('icon' + icon + color, () => [0, 1, 2].map(k => {
      const [c, g] = canvas(21, 21), y0 = k === 1 ? 5 : 6, x0 = 5;
      g.drawImage(ringFrames(8, color)[k], 0, 0);
      const ic = String(icon || '').toLowerCase();
      if (ic === 'chipa') { R(g, '#7a5020', x0 + 2, y0 + 1, 7, 9); R(g, '#7a5020', x0 + 1, y0 + 2, 9, 7); R(g, '#d8a860', x0 + 2, y0 + 2, 7, 7); R(g, '#f0d090', x0 + 3, y0 + 3, 2, 2); R(g, '#a87030', x0 + 6, y0 + 6, 1, 1); R(g, '#a87030', x0 + 4, y0 + 7, 1, 1); }
      else if (ic === 'billete' || ic === 'plata') { R(g, '#1a4a2a', x0, y0 + 2, 11, 7); R(g, '#3c9a5a', x0 + 1, y0 + 3, 9, 5); R(g, '#1a4a2a', x0 + 5, y0 + 3, 1, 5); R(g, '#8ad0a0', x0 + 2, y0 + 4, 1, 1); }
      else if (ic === 'mate') { R(g, '#3a2010', x0 + 2, y0 + 2, 7, 8); R(g, '#7a4a2a', x0 + 3, y0 + 3, 5, 6); R(g, '#3a7a2a', x0 + 4, y0 + 3, 3, 2); R(g, '#d0d0d8', x0 + 7, y0, 1, 5); }
      else if (ic === 'expediente' || ic === 'carpeta' || ic === 'papel') { R(g, '#6a5020', x0, y0 + 1, 11, 9); R(g, '#e0c070', x0 + 1, y0 + 2, 9, 7); for (let y = 4; y < 9; y += 2) R(g, '#8a7040', x0 + 2, y0 + y, 6, 1); }
      else if (ic === 'llave') { R(g, '#806010', x0 + 1, y0 + 2, 4, 4); R(g, '#f0c030', x0 + 2, y0 + 3, 2, 2); R(g, '#f0c030', x0 + 5, y0 + 4, 5, 1); R(g, '#f0c030', x0 + 8, y0 + 5, 1, 2); }
      else if (ic === 'ofrenda' || ic === 'vela') { R(g, '#5a0a0a', x0 + 2, y0 + 3, 7, 7); R(g, '#d82020', x0 + 3, y0 + 4, 5, 5); R(g, '#f4f4f0', x0 + 5, y0 + 2, 1, 2); R(g, '#ffd030', x0 + 5, y0, 1, 2); R(g, '#ff9020', x0 + 4, y0 + 1, 1, 1); R(g, '#ff7070', x0 + 3, y0 + 4, 1, 3); }
      else if (ic === 'estrella') { R(g, '#f0c030', x0 + 5, y0, 1, 10); R(g, '#f0c030', x0, y0 + 4, 11, 2); R(g, '#f0c030', x0 + 3, y0 + 2, 5, 6); R(g, '#fff0a0', x0 + 4, y0 + 3, 2, 2); }
      else { R(g, '#4a3010', x0, y0 + 1, 11, 9); R(g, '#a8783c', x0 + 1, y0 + 2, 9, 7); R(g, '#e8d8a0', x0 + 5, y0 + 2, 1, 7); R(g, '#e8d8a0', x0 + 1, y0 + 5, 9, 1); } // paquete
      return c;
    }));
  }

  // ============================================================ OBJETOS PROPIOS EN EL MUNDO ("peatones quietos")
  const PROPS = new Set();
  function addProp(x, y, frames, o = {}) {
    const p = { x, y, a: o.a !== undefined ? o.a : -Math.PI / 2, vx: 0, vy: 0, z: 0, dead: true, anim: 0, state: 'walk', t: 1e9, flee: 0, fx: 0, fy: 0,
      spr: { frames, dead: frames[0] }, fr: frames, fps: o.fps || 0, ft: rand(1), mission: true, walk: null, owner: o.owner || null };
    PROPS.add(p); C.peds.push(p); return p;
  }
  function setFrames(p, frames, fps) { p.fr = frames; p.spr.frames = frames; p.spr.dead = frames[0]; p.fps = fps || 0; }
  function removeProp(p) {
    if (!p) return; PROPS.delete(p);
    const i = C.peds.indexOf(p); if (i >= 0) C.peds.splice(i, 1);
  }
  // un peatón de misión (pasajero, dador) que camina: frames de pedSprites
  function addPerson(x, y, look, o = {}) {
    const s = C.pedSprites(normLook(look));
    const p = addProp(x, y, s.frames, o); p.person = s; p.spr.dead = s.frames[0]; return p;
  }
  // camina hacia (tx, ty); devuelve true al llegar
  function walkTo(p, tx, ty, dt, spd = 30) {
    const dx = tx - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy);
    if (dd < 2) { p.spr.dead = p.fr[0]; return true; }
    const st = Math.min(dd, spd * dt);
    p.x += dx / dd * st; p.y += dy / dd * st; p.a = Math.atan2(dy, dx);
    p.anim += st * 0.22; p.spr.dead = p.fr[Math.floor(p.anim) % p.fr.length];
    return false;
  }
  let propT = 0;
  function updateProps(dt) {
    for (const p of PROPS) {
      if (p.fps && !p.walking) { p.ft += dt * p.fps; p.spr.dead = p.fr[Math.floor(p.ft) % p.fr.length]; }
      p.walking = false;
    }
    // el juego borra los peatones lejanos: los volvemos a poner si estamos cerca
    if ((propT -= dt) <= 0) {
      propT = 0.25;
      const cam = C.cam;
      for (const p of PROPS) if (d2(p.x, p.y, cam.x, cam.y) < 900 * 900 && !C.peds.includes(p)) C.peds.push(p);
    }
  }

  // ---- marcas (minimapa y columnas de luz en 3D)
  function addMarker(x, y, color, label, r = 14) { const m = { x, y, color, label, r, mission: true }; C.markers.push(m); return m; }
  function removeMarker(m) { const i = C.markers.indexOf(m); if (i >= 0) C.markers.splice(i, 1); }

  // ============================================================ ASPECTO Y RETRATOS
  const PLAYER_LOOK = { shirt: '#30c0e8', pants: '#2a3a6a', skin: '#d8a878', hair: '#1a1a1a' };
  const SK = ['#f0c8a0', '#d8a878', '#a87850', '#7a5030'], HR = ['#2a1a10', '#5a3a20', '#1a1a1a', '#a87830', '#8a8a8a'];
  const SH = ['#d84040', '#4070d8', '#e8e8e8', '#40a860', '#e8c040', '#8848c0', '#e07830', '#40b8c8', '#303030', '#e86aa0'];
  function lookFromName(name) {
    const h = strHash(name || '?');
    return { skin: SK[h % 4], hair: HR[(h >> 3) % 5], shirt: SH[(h >> 7) % 10], pants: ['#2a3a6a', '#3a3a3a', '#6a5a4a', '#4a4a7a'][(h >> 11) % 4] };
  }
  function normLook(l) {
    const b = lookFromName(l && l.name);
    l = l || {};
    return { skin: l.skin || b.skin, hair: l.hair || b.hair, shirt: l.shirt || b.shirt, pants: l.pants || b.pants, hat: l.hat, beard: l.beard, glasses: l.glasses, style: l.style };
  }
  const isPlayerName = n => /^(vos|yo|jugador|player|el pibe|vos:)$/i.test(String(n || '').trim());
  // retrato de 32x32 a partir del look
  function portrait(look, name) {
    const L = normLook(look), h = strHash(name || ''), style = L.style !== undefined ? L.style : h % 4;
    const [c, g] = canvas(32, 32);
    R(g, '#18243a', 0, 0, 32, 32); R(g, '#22324e', 0, 0, 32, 16);
    for (let y = 0; y < 32; y += 4) R(g, '#1c2a44', 0, y, 32, 1);
    const sk = L.skin, skd = shade(sk, -0.18), hair = L.hair, ol = '#0c0a10';
    // hombros
    R(g, ol, 3, 24, 26, 8); R(g, L.shirt, 4, 25, 24, 7); R(g, shade(L.shirt, -0.2), 4, 30, 24, 2); R(g, shade(L.shirt, 0.2), 6, 25, 4, 1);
    R(g, skd, 13, 21, 6, 4); R(g, shade(L.shirt, -0.35), 12, 25, 1, 3); R(g, shade(L.shirt, -0.35), 19, 25, 1, 3); // cuello
    // pelo largo atrás
    if (style === 1) { R(g, ol, 7, 8, 18, 17); R(g, hair, 8, 9, 16, 15); }
    // cabeza
    R(g, ol, 8, 5, 16, 18); R(g, ol, 9, 4, 14, 20);
    R(g, sk, 9, 6, 14, 16); R(g, sk, 10, 5, 12, 18);
    R(g, skd, 20, 7, 2, 14); R(g, skd, 11, 21, 10, 1);
    R(g, sk, 7, 12, 2, 4); R(g, skd, 7, 13, 1, 2); R(g, sk, 23, 12, 2, 4); R(g, skd, 24, 13, 1, 2); // orejas
    // pelo
    if (style === 0) { R(g, hair, 9, 3, 14, 5); R(g, hair, 8, 5, 2, 6); R(g, hair, 22, 5, 2, 6); R(g, shade(hair, 0.25), 12, 4, 5, 1); }
    else if (style === 1) { R(g, hair, 9, 3, 14, 5); R(g, hair, 8, 4, 3, 12); R(g, hair, 21, 4, 3, 12); R(g, shade(hair, 0.25), 11, 4, 6, 1); }
    else if (style === 2) { for (let x = 8; x < 24; x += 2) R(g, hair, x, (x % 4) ? 2 : 3, 2, 5); R(g, hair, 8, 5, 2, 5); R(g, hair, 22, 5, 2, 5); }
    else { R(g, hair, 8, 7, 2, 5); R(g, hair, 22, 7, 2, 5); R(g, shade(sk, 0.15), 12, 5, 6, 2); } // pelado
    if (L.hat) { R(g, ol, 7, 2, 18, 6); R(g, L.hat, 8, 2, 16, 5); R(g, shade(L.hat, -0.25), 6, 6, 20, 2); }
    // cara
    R(g, hair, 11, 11, 3, 1); R(g, hair, 18, 11, 3, 1);                       // cejas
    R(g, '#f4f4f0', 11, 13, 3, 2); R(g, '#f4f4f0', 18, 13, 3, 2);
    R(g, '#1a1a1a', 12, 13, 2, 2); R(g, '#1a1a1a', 19, 13, 2, 2);
    R(g, skd, 15, 15, 2, 3); R(g, shade(sk, -0.3), 15, 17, 2, 1);           // nariz
    R(g, '#7a3030', 13, 19, 6, 1); R(g, shade(sk, -0.1), 14, 20, 4, 1);      // boca
    if (L.beard) { const bc = typeof L.beard === 'string' ? L.beard : hair; R(g, bc, 10, 18, 12, 4); R(g, bc, 12, 22, 8, 1); R(g, '#7a3030', 13, 19, 6, 1); }
    if (L.glasses) { R(g, '#1a1a1a', 10, 12, 5, 4); R(g, '#1a1a1a', 17, 12, 5, 4); R(g, '#9ac0e0', 11, 13, 3, 2); R(g, '#9ac0e0', 18, 13, 3, 2); R(g, '#1a1a1a', 15, 13, 2, 1); }
    return c;
  }

  // ============================================================ PROGRESO (localStorage)
  const SAVE_KEY = 'chipacity.misiones.v1';
  let progress = { done: {}, flags: {} };
  function loadProgress() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && typeof s === 'object') progress = { done: s.done || {}, flags: s.flags || {} }; }
    catch (e) { /* sin almacenamiento: seguimos sin guardar */ }
  }
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* nada */ } }

  // ============================================================ DOM / HUD
  const $ = id => document.getElementById(id);
  function el(tag, id, cls, parent = document.body) { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; parent.appendChild(e); return e; }
  const ui = {
    hud: el('div', 'm-hud', 'mhud'), banner: el('div', 'm-banner', 'mhud'), prompt: el('div', 'm-prompt', 'mhud'),
    bar: el('div', 'm-bar', 'mhud'), sub: el('div', 'm-sub', 'mhud'), dlg: el('div', 'm-dlg'), card: el('div', 'm-card', 'm-panel'),
    list: el('div', 'm-list', 'm-panel'), done: el('div', 'm-done', 'mhud'), fail: el('div', 'm-fail', 'mhud'), confirm: el('div', 'm-confirm', 'm-panel'),
  };
  ui.hud.innerHTML = '<div class="m-title"></div><div class="m-obj"></div><div class="m-row"><span class="m-arrow">▲</span><span class="m-dist"></span><span class="m-time"></span></div><div class="m-extra"></div>';
  ui.bar.innerHTML = '<div class="m-bar-label"></div><div class="m-bar-out"><div class="m-bar-in"></div></div>';
  ui.dlg.innerHTML = '<canvas class="m-face" width="32" height="32"></canvas><div class="m-body"><div class="m-name"></div><div class="m-text"></div><div class="m-opts"></div></div><div class="m-next">▼</div>';
  const H = {
    title: ui.hud.querySelector('.m-title'), obj: ui.hud.querySelector('.m-obj'), arrow: ui.hud.querySelector('.m-arrow'), dist: ui.hud.querySelector('.m-dist'),
    time: ui.hud.querySelector('.m-time'), extra: ui.hud.querySelector('.m-extra'), row: ui.hud.querySelector('.m-row'),
    barLabel: ui.bar.querySelector('.m-bar-label'), barIn: ui.bar.querySelector('.m-bar-in'),
    face: ui.dlg.querySelector('.m-face'), name: ui.dlg.querySelector('.m-name'), text: ui.dlg.querySelector('.m-text'), opts: ui.dlg.querySelector('.m-opts'), next: ui.dlg.querySelector('.m-next'),
  };
  ui.hud.appendChild(ui.bar); // la barra de progreso va dentro del recuadro de objetivo (no se pisa con nada)
  const show = (e, on) => { e.style.display = on ? '' : 'none'; };
  for (const k of ['hud', 'banner', 'prompt', 'bar', 'sub', 'dlg', 'card', 'list', 'done', 'fail', 'confirm']) show(ui[k], false);
  const cache = {};
  const setHTML = (e, k, v) => { if (cache[k] !== v) { cache[k] = v; e.innerHTML = v; } };

  // suelta las teclas apretadas (para que el jugador no siga caminando detrás de un diálogo)
  const HELD = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyJ', 'KeyZ', 'Enter', 'KeyF', 'KeyQ', 'KeyE'];
  function releaseKeys() { for (const code of HELD) { try { dispatchEvent(new KeyboardEvent('keyup', { code })); } catch (e) { /* nada */ } } }

  let bannerT = 0;
  function banner(text, secs = 2.5, cls = '') { ui.banner.className = 'mhud ' + cls; ui.banner.innerHTML = text; show(ui.banner, true); ui.banner.style.opacity = 1; bannerT = secs; }
  let barOn = false;
  function setBar(label, f, col) {
    barOn = true; show(ui.bar, true);
    setHTML(H.barLabel, 'barl', esc(label));
    H.barIn.style.width = Math.round(clamp(f, 0, 1) * 100) + '%';
    H.barIn.style.background = col || '';
  }
  // subtítulos que no frenan el juego (el pasajero que habla mientras manejás)
  let subQ = [], subT = 0;
  function say(who, text, secs = 3.6) { if (!text) return; subQ.push({ who, text, secs }); if (subQ.length > 3) subQ.shift(); }

  // ---- diálogos (bloquean al jugador)
  const dlg = { open: false, lines: [], i: 0, shown: 0, resolve: null, choice: null, sel: 0 };
  function lineObjs(lines, who, look, run) {
    const arr = Array.isArray(lines) ? lines : lines == null ? [] : [lines];
    return arr.filter(l => l != null && l !== '').map(l => typeof l === 'string' ? { who, text: l, look } : { who: l.who || who, text: l.text || '', look: l.look || (l.who && l.who !== who ? null : look) })
      .map(l => ({ ...l, look: lookFor(l.who, l.look, run) }));
  }
  function lookFor(name, explicit, run) {
    if (explicit) return explicit;
    if (isPlayerName(name)) return PLAYER_LOOK;
    for (const chars of [window.MISSION_CAST, window.MISSION_CHARACTERS, window.MISSION_CHARS]) if (chars && chars[name]) return chars[name].look || chars[name];
    if (run && run.m.giver && run.m.giver.name === name && run.m.giver.look) return run.m.giver.look;
    if (run && run.looks && run.looks[name]) return run.looks[name];
    for (const m of MISSIONS) if (m.giver && m.giver.name === name && m.giver.look) return m.giver.look;
    return lookFromName(name);
  }
  function dialog(lines) {
    if (!lines.length) return Promise.resolve();
    return new Promise(res => {
      Object.assign(dlg, { open: true, lines, i: 0, shown: 0, resolve: res, choice: null });
      releaseKeys(); show(ui.dlg, true); show(ui.sub, false); renderLine();
    });
  }
  function renderLine() {
    const l = dlg.lines[dlg.i];
    H.name.textContent = isPlayerName(l.who) ? 'VOS' : (l.who || '');
    show(H.name, !!l.who);
    const g = H.face.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 32, 32);
    g.drawImage(portrait(l.look, l.who), 0, 0);
    show(H.face, !!l.who);
    H.text.textContent = ''; H.opts.innerHTML = ''; dlg.shown = 0;
  }
  function advanceDialog() {
    const l = dlg.lines[dlg.i];
    if (dlg.shown < l.text.length) { dlg.shown = l.text.length; H.text.textContent = l.text; return; }
    if (dlg.choice) return;
    dlg.i++;
    if (dlg.i >= dlg.lines.length) { closeDialog(); return; }
    renderLine();
  }
  function closeDialog(val) {
    dlg.open = false; show(ui.dlg, false);
    const r = dlg.resolve; dlg.resolve = null; dlg.choice = null;
    if (r) r(val);
  }
  // elección: muestra la pregunta y las opciones en la caja de diálogo
  function choose(prompt, options, who, look) {
    return new Promise(res => {
      Object.assign(dlg, { open: true, lines: [{ who, text: prompt || '¿Qué hacés?', look }], i: 0, shown: 0, resolve: res, choice: options, sel: 0 });
      releaseKeys(); show(ui.dlg, true); renderLine(); renderChoice();
    });
  }
  function renderChoice() {
    if (!dlg.choice) return;
    H.opts.innerHTML = dlg.choice.map((o, i) => `<div class="m-opt${i === dlg.sel ? ' on' : ''}">${i === dlg.sel ? '▶' : '&nbsp;'} ${i + 1}. ${esc(o.text)}</div>`).join('');
  }
  function uiBlocking() { return dlg.open || card.open || list.open || confirmBox.open; }
  let talkingCls = false;
  function syncBodyClass() { const on = uiBlocking(); if (on !== talkingCls) { talkingCls = on; document.body.classList.toggle('m-talking', on); } }

  // ============================================================ MISIONES: DATOS
  const FALLBACK_PLACES = {};
  // con #pruebas en la URL se cargan las misiones de prueba (todas al lado de la plaza) en vez de las del guion
  const usingFallback = !(Array.isArray(window.MISSIONS) && window.MISSIONS.length) || /pruebas/.test(location.hash);
  const MISSIONS = (usingFallback ? buildFallback() : window.MISSIONS)
    .filter(m => m && m.id && Array.isArray(m.steps)).slice().sort((a, b) => (a.n || 99) - (b.n || 99));
  const byId = id => MISSIONS.find(m => m.id === id);
  const isDone = m => !!progress.done[m.id];
  const isUnlocked = m => (m.unlock || []).every(id => progress.done[id] || !byId(id));
  const statusOf = m => isDone(m) ? 'completada' : isUnlocked(m) ? 'disponible' : 'bloqueada';
  const difficulty = m => clamp(Math.round(m.difficulty || Math.ceil((m.n || 1) / 2)), 1, 5);
  const starsHTML = n => '<i class="star on"></i>'.repeat(n) + '<i class="star"></i>'.repeat(5 - n);
  const money = m => (m.reward && m.reward.money) || 0;

  // ---- dadores en el mundo
  const givers = new Map(); // id → {m, x, y, prop, marker}
  function placeGivers() {
    for (const g of givers.values()) { removeProp(g.prop); if (g.marker) removeMarker(g.marker); }
    givers.clear();
    // primero las disponibles: si un personaje da varias misiones en el mismo lugar (Ña Cata en la Plaza 25 de Mayo),
    // se ve una sola vez y ENTER ofrece la que está disponible; las repeticiones quedan para cuando no hay otra.
    const order = MISSIONS.map(m => ({ m, st: statusOf(m) })).filter(o => o.st !== 'bloqueada')
      .sort((a, b) => (a.st === 'disponible' ? 0 : 1) - (b.st === 'disponible' ? 0 : 1) || (b.m.n || 0) - (a.m.n || 0));
    for (const { m, st } of order) {
      const at = resolveAt(m.giver && m.giver.at, { x: C.player.x + 40, y: C.player.y });
      let [x, y] = snapWalk(at[0], at[1]);
      const taken = [...givers.values()].find(g => d2(g.x, g.y, x, y) < 26 * 26);
      if (taken) {
        if (st !== 'disponible') continue;
        [x, y] = snapWalk(x + 22, y + 10);
      }
      const color = st === 'completada' ? '#9aa0a8' : '#ff9f3f';
      const prop = addProp(x, y, giverFrames(m.giver && m.giver.look, color), { fps: 4 });
      const g = { m, x, y, prop, marker: null, status: st };
      if (st === 'disponible' && !active) g.marker = addMarker(x, y, '#ff9f3f', (m.giver && m.giver.name) || m.title, 10);
      givers.set(m.id, g);
    }
  }
  function giverMarkers(on) {
    for (const g of givers.values()) {
      if (on && g.status === 'disponible' && !g.marker) g.marker = addMarker(g.x, g.y, '#ff9f3f', (g.m.giver && g.m.giver.name) || g.m.title, 10);
      if (!on && g.marker) { removeMarker(g.marker); g.marker = null; }
    }
  }
  function nearGiver() {
    const p = C.player.car || C.player, lim = C.player.car ? 34 : 24;
    let best = null, bd = lim * lim;
    for (const g of givers.values()) { const dd = d2(g.x, g.y, p.x, p.y); if (dd < bd) { bd = dd; best = g; } }
    if (best && C.player.car && speedOf(C.player.car) > 25) return null;
    return best;
  }

  // ============================================================ FICHA, LISTADO, CONFIRMACIÓN
  const card = { open: false, m: null, sel: 0 };
  function openCard(m) {
    Object.assign(card, { open: true, m, sel: 0 }); releaseKeys(); show(ui.card, true); renderCard();
    C.sfx.blip(660, 0.08, 0.1);
  }
  function renderCard() {
    const m = card.m, replay = isDone(m);
    ui.card.innerHTML = `<div class="m-plate-top"><span class="cs-seal"></span><span>Misión N° ${esc(m.n || '?')}<b>CHIPA CITY</b></span></div>` +
      `<div class="m-card-title">${esc(m.title)}</div>` +
      (m.tagline ? `<div class="m-card-tag">${esc(m.tagline)}</div>` : '') +
      `<div class="m-card-row"><span>DIFICULTAD</span><span class="m-stars">${starsHTML(difficulty(m))}</span></div>` +
      `<div class="m-card-row"><span>PAGA</span><span class="m-pay">$${replay ? Math.round(money(m) * 0.25) : money(m)}${replay ? ' (repetición)' : ''}</span></div>` +
      (m.giver && m.giver.name ? `<div class="m-card-row"><span>TE LA DA</span><span>${esc(m.giver.name)}</span></div>` : '') +
      `<div class="m-btns"><span class="m-btn${card.sel === 0 ? ' on' : ''}">ACEPTAR</span><span class="m-btn${card.sel === 1 ? ' on' : ''}">RECHAZAR</span></div>` +
      `<div class="m-keys">←/→ elegir · ENTER confirmar · ESC rechazar</div>`;
  }
  function closeCard(accept) {
    card.open = false; show(ui.card, false);
    const m = card.m;
    if (accept) startMission(m);
    else if (m && m.giver && m.giver.name) say(m.giver.name, pick(['Bueno, cuando quieras, acá estoy.', 'Dale, pensalo. No me muevo de acá.', '¡Ta bien! Después no digas que no te avisé.']), 2.8);
  }

  const list = { open: false, sel: 0 };
  function openList() { list.open = true; releaseKeys(); show(ui.list, true); renderList(); }
  function closeList() { list.open = false; show(ui.list, false); }
  function renderList() {
    list.sel = clamp(list.sel, 0, MISSIONS.length - 1);
    const rows = MISSIONS.map((m, i) => {
      const st = statusOf(m), need = (m.unlock || []).filter(id => !progress.done[id]).map(id => (byId(id) || { title: id }).title);
      const icon = st === 'completada' ? '✓' : st === 'disponible' ? '!' : '🔒';
      return `<div class="m-li ${st}${i === list.sel ? ' on' : ''}"><span class="m-li-n">${esc(m.n || i + 1)}</span><span class="m-li-t">${esc(m.title)}` +
        `${st === 'bloqueada' && need.length ? `<small>Antes: ${esc(need.join(', '))}</small>` : m.tagline ? `<small>${esc(m.tagline)}</small>` : ''}</span>` +
        `<span class="m-li-s">${icon} ${st.toUpperCase()}</span></div>`;
    }).join('');
    const nDone = MISSIONS.filter(isDone).length;
    ui.list.innerHTML = `<div class="m-plate-top"><span class="cs-seal"></span><span>Municipalidad de<b>MISIONES · ${nDone}/${MISSIONS.length}</b></span></div>` +
      `<div class="m-li-wrap">${rows}</div>` +
      `<div class="m-keys">↑/↓ elegir · ENTER marcar en el mapa · TAB/L/ESC cerrar${usingFallback ? ' · (misiones de prueba)' : ''}</div>`;
    const on = ui.list.querySelector('.m-li.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  let gpsMarker = null;
  function listPick() {
    const m = MISSIONS[list.sel], g = m && givers.get(m.id);
    if (!g) { C.sfx.blip(180, 0.1, 0.1); return; }
    if (gpsMarker) removeMarker(gpsMarker);
    gpsMarker = addMarker(g.x, g.y, '#ffffff', 'GPS: ' + m.title, 14);
    closeList(); banner(`<small>MARCADO EN EL MAPA</small><br>${esc((m.giver && m.giver.name) || m.title)}`, 2.2, 'small');
  }

  const confirmBox = { open: false, yes: null };
  function askConfirm(text, yes) {
    confirmBox.open = true; confirmBox.yes = yes; releaseKeys(); show(ui.confirm, true);
    ui.confirm.innerHTML = `<div class="m-card-title">${esc(text)}</div><div class="m-keys">ENTER: sí · ESC: no</div>`;
  }
  function closeConfirm(ok) { confirmBox.open = false; show(ui.confirm, false); const y = confirmBox.yes; confirmBox.yes = null; if (ok && y) y(); }

  // ============================================================ EJECUCIÓN
  let active = null;      // misión en curso
  let failed = null;      // {m, reason, t} después de fallar (para reintentar)
  let doneT = 0, failT = 0;

  // from: índice de paso para reintentar desde una escena larga (con las flags que había en ese momento)
  function startMission(m, retry = false, from = null) {
    if (active) return;
    hideFail();
    if (gpsMarker) { removeMarker(gpsMarker); gpsMarker = null; }
    const run = {
      m, i: -1, t: 0, flags: Object.assign({}, progress.flags, from ? from.flags : null), props: new Set(), markers: new Set(), cars: new Set(), from: from ? from.i : 0,
      vehicle: null, tick: null, timeLeft: null, hint: '', extra: '', target: null, override: null, bonus: [], looks: {}, guard: 0, retry, stats: {},
    };
    if (m.giver && m.giver.look) run.looks[m.giver.name] = m.giver.look;
    active = run;
    giverMarkers(false);
    banner(`<small>${retry ? 'REINTENTO' : 'MISIÓN'}</small><br>${esc(m.title)}`, 2.6);
    C.sfx.blip(440, 0.12, 0.12); setTimeout(() => C.sfx.blip(660, 0.18, 0.12), 130);
    runSteps(run);
  }
  async function runSteps(run) {
    const steps = run.m.steps;
    let i = run.from || 0;
    try {
      while (i >= 0 && i < steps.length) {
        if (active !== run) return;
        if (++run.guard > 2000) { failRun(run, 'ERROR EN EL GUION (bucle)'); return; }
        run.i = i;
        const st = steps[i] || {};
        const res = await execStep(st, run, i);
        if (active !== run) return;
        let next = i + 1;
        if (run.jumpTo != null) { next = run.jumpTo; run.jumpTo = null; i = next; continue; } // depuración
        if (res && res.goto !== undefined && res.goto !== null) {
          const gt = res.goto;
          if (gt === 'fin' || gt === 'end') next = steps.length;
          else if (gt === 'fallo' || gt === 'fail') { failRun(run, res.reason || st.onFail || 'MISIÓN FALLIDA'); return; }
          else if (typeof gt === 'number') next = gt;
          else { const k = steps.findIndex(s => s && (s.id === gt || s.label === gt)); next = k >= 0 ? k : i + 1; }
        }
        i = next;
      }
      if (active === run) completeRun(run);
    } catch (e) {
      console.error('[misiones] error en el paso', i, e);
      if (active === run) failRun(run, 'ERROR EN EL PASO ' + (i + 1));
    }
  }
  function execStep(st, run, i) {
    // estado común del paso
    run.tick = null; run.hint = st.hint || ''; run.extra = ''; run.target = null; run.forceDone = false; run.onTimeout = null;
    run.timeLeft = st.time > 0 ? st.time : null; run.stepFail = st.onFail || null; run.step = st;
    hideBar();
    const f = STEPS[st.type];
    if (!f) { console.warn('[misiones] paso desconocido:', st.type); return notice(run, 'PASO DESCONOCIDO: ' + st.type, 1.5); }
    return f(st, run, i);
  }
  // espera cuadro a cuadro: fn(dt) devuelve algo "verdadero" para terminar el paso (o {goto})
  function waitTick(run, fn) {
    return new Promise(res => {
      run.tick = dt => {
        const r = run.forceDone ? true : fn(dt);
        if (r && active === run) { run.tick = null; res(r === true ? null : r); }
      };
    });
  }
  function notice(run, text, secs = 2.5) {
    banner(esc(text), secs, 'small');
    let t = secs;
    return waitTick(run, dt => (t -= dt) <= 0);
  }

  // ---- objetos de la corrida (se limpian al terminar)
  const rProp = (run, ...a) => { const p = addProp(...a); run.props.add(p); return p; };
  const rPerson = (run, ...a) => { const p = addPerson(...a); run.props.add(p); return p; };
  const rMarker = (run, ...a) => { const m = addMarker(...a); run.markers.add(m); return m; };
  function rUnprop(run, p) { if (p) { removeProp(p); run.props.delete(p); } }
  function rUnmark(run, m) { if (m) { removeMarker(m); run.markers.delete(m); } }
  function ring(run, x, y, rpx, color = '#f0c030', label = '') {
    return { prop: rProp(run, x, y, ringFrames(rpx, color), { fps: 5 }), marker: rMarker(run, x, y, color, label, rpx) };
  }
  function unring(run, r) { if (!r) return; rUnprop(run, r.prop); rUnmark(run, r.marker); }

  function cleanup(run) {
    for (const p of run.props) removeProp(p);
    for (const m of run.markers) removeMarker(m);
    for (const c of run.cars) {
      if (c === C.player.car) continue;
      const k = C.cars.indexOf(c); if (k >= 0) C.cars.splice(k, 1);
    }
    run.props.clear(); run.markers.clear(); run.cars.clear(); run.tick = null;
    hideBar(); show(ui.hud, false);
    if (dlg.open) closeDialog();
  }
  function failRun(run, reason) {
    if (active !== run) return;
    active = null; cleanup(run);
    // si falló una escena 3D o el fútbol, se puede reintentar desde ese paso (las misiones largas lo agradecen)
    const st = run.m.steps[run.i] || {}, cp = (st.type === 'scene' || st.type === 'futbol') && run.i > 0 ? { i: run.i, flags: Object.assign({}, run.flags) } : null;
    failed = { m: run.m, reason: reason || 'MISIÓN FALLIDA', checkpoint: cp };
    ui.fail.innerHTML = `<div class="m-big red">MISIÓN FALLIDA</div><div class="m-reason">${esc(failed.reason)}</div>` +
      `<div class="m-keys">${cp ? 'ENTER: reintentar la escena · R: desde el principio' : 'ENTER: reintentar'} · ESC: salir</div>`;
    show(ui.fail, true); failT = 15;
    C.sfx.blip(220, 0.3, 0.15); setTimeout(() => C.sfx.blip(150, 0.5, 0.15), 260);
    giverMarkers(true);
  }
  function hideFail() { failed = null; show(ui.fail, false); }
  function cancelRun() {
    const run = active; if (!run) return;
    active = null; cleanup(run); giverMarkers(true);
    banner('MISIÓN ABANDONADA', 2.2, 'small red');
  }
  function retry(fromStart = false) {
    if (!failed) return;
    const m = failed.m, cp = failed.checkpoint; hideFail();
    const go = () => {
      if (C.player.dead) { setTimeout(go, 300); return; }
      if (cp && !fromStart) { startMission(m, true, cp); return; }
      const g = givers.get(m.id);
      if (g) {
        if (C.player.car) { const c = C.player.car; c.mode = 'phys'; c.vx = c.vy = 0; C.player.car = null; C.sfx.engine(false, 0, false); }
        const [x, y] = snapWalk(g.x + 14, g.y + 6);
        C.teleport(x, y);
      }
      C.clearPolice();
      startMission(m, true);
    };
    go();
  }
  function completeRun(run) {
    const m = run.m, replay = isDone(m);
    active = null; cleanup(run);
    const base = replay ? Math.round(money(m) * 0.25) : money(m);
    const bonus = run.bonus.reduce((s, b) => s + (b.money || 0), 0);
    C.player.score = Math.max(0, C.player.score + base + bonus);
    // flags del guion: persisten entre misiones
    Object.assign(progress.flags, run.flags);
    const prevBest = progress.done[m.id] && progress.done[m.id].best;
    progress.done[m.id] = { t: Date.now(), best: prevBest ? Math.min(prevBest, Math.round(run.t)) : Math.round(run.t) };
    saveProgress();
    const before = new Set([...givers.keys()]);
    placeGivers();
    const nuevas = [...givers.keys()].filter(id => !before.has(id)).map(id => byId(id).title);
    const sgn = v => (v < 0 ? '-$' : '+$') + Math.abs(v);
    ui.done.innerHTML = `<div class="m-big">¡MISIÓN CUMPLIDA!</div><div class="m-money">${sgn(base + bonus)}</div>` +
      run.bonus.map(b => `<div class="m-bonus">${esc(b.label)}${b.money ? ' ' + sgn(b.money) : ''}</div>`).join('') +
      `<div class="m-bonus dim">TIEMPO ${fmtTime(run.t)}</div>` +
      nuevas.map(t => `<div class="m-bonus new">NUEVA MISIÓN: ${esc(t)}</div>`).join('');
    show(ui.done, true); doneT = 6;
    [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => C.sfx.blip(f, 0.16, 0.12), k * 140));
  }
  const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // ---- vehículos de misión
  function fits(x, y, a, w, l) {
    const fx = Math.cos(a), fy = Math.sin(a), hl = l / 2 - 1, hw = w / 2 - 1;
    for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]])
      if (C.solidPx(x + fx * lx - fy * ly, y + fy * lx + fx * ly)) return false;
    return true;
  }
  function clearSpot(x, y, r, keep) {
    for (let i = C.cars.length - 1; i >= 0; i--) {
      const c = C.cars[i];
      if (c === C.player.car || c === keep || c.mission || c.cop) continue;
      if (d2(c.x, c.y, x, y) < r * r) C.cars.splice(i, 1);
    }
  }
  // crea un vehículo de misión estacionado en la calle más cercana a (x, y)
  function spawnVehicle(run, kind, x, y, o = {}) {
    const spec = vehSpec(kind, o), vt = C.VTYPE[spec.type] || C.VTYPE.sedan;
    const dp = snapDrive(x, y);
    let px = dp.x, py = dp.y, a = dp.a;
    if (dp.e >= 0) {
      outer: for (const ds of [0, 20, -20, 40, -40, 70, -70, 110, -110]) for (const lane of [1, 0, -1]) {
        const s = clamp(dp.s + ds, 0, G.elen[dp.e]), [qx, qy] = C.lanePoint(dp.e, s, lane);
        if (fits(qx, qy, a, vt.w, vt.l)) { px = qx; py = qy; break outer; }
      }
    }
    clearSpot(px, py, vt.l / 2 + 14);
    const c = C.makeCar(px, py, a, { type: spec.type, color: spec.color, spr: spec.spr, mode: o.mode || 'phys', npc: !!o.npc });
    c.mission = true; c.kind = kindOf(kind);
    if (spec.line) { c.line = spec.line; c.ramal = spec.ramal; }
    if (spec.sprB) c.sprB = spec.sprB;
    run.cars.add(c);
    return c;
  }
  const usable = c => c && !c.wreck && C.cars.includes(c);
  // los pasos que necesitan vehículo: devuelve el auto si estás arriba del que corresponde; si no, orienta al jugador
  function inVehicle(run) {
    const v = run.vehicle, car = C.player.car;
    if (v) {
      if (v.wreck || !C.cars.includes(v)) { failRun(run, `¡Hiciste pelota ${vehName(v.kind)}!`); return null; }
      if (car === v) { if (v.burn > 0) run.override = { hint: '¡SE PRENDE FUEGO! ¡BAJATE!' }; return v; }
      run.override = { hint: 'VOLVÉ A SUBIRTE ' + aVeh(v.kind), target: v };
      return null;
    }
    if (car && !car.wreck) return car;
    run.override = { hint: 'Conseguite un vehículo (ENTER al lado de un auto)' };
    return null;
  }
  const slowEnough = (c, v = 12) => speedOf(c) < v;

  // ============================================================ PASOS
  const STEPS = {};

  // talk: diálogo con retrato
  STEPS.talk = async (st, run) => {
    const lines = lineObjs(st.lines || st.text, st.who, st.look, run);
    if (st.look && st.who) run.looks[st.who] = st.look;
    await dialog(lines);
  };

  // goto: ir a un lugar (a pie, en vehículo o como sea)
  STEPS.goto = (st, run) => {
    const mode = st.mode || 'any';
    const at = resolveAt(st.at, C.player);
    const [x, y] = mode === 'vehicle' ? (p => [p.x, p.y])(snapDrive(at[0], at[1])) : snapWalk(at[0], at[1]);
    const r = m2px(st.r || 12);
    run.hint = st.hint || (st.at && typeof st.at === 'string' ? 'Andá a ' + placeName(st.at) : 'Andá al punto marcado');
    run.target = { x, y };
    ring(run, x, y, Math.min(r, 70), '#f0c030', run.hint);
    return waitTick(run, () => {
      const P = C.player;
      if (mode === 'vehicle' && !inVehicle(run)) return false;
      if (mode === 'foot' && P.car) { if (d2(P.x, P.y, x, y) < (r * 3) ** 2) run.override = { hint: 'Bajate del auto (ENTER) y seguí a pie' }; return false; }
      return d2(P.x, P.y, x, y) < r * r;
    });
  };

  // vehicle: subirse a un vehículo de misión
  STEPS.vehicle = (st, run) => {
    const kind = kindOf(st.kind || 'any');
    if (kind === 'any' || kind === 'none') {
      run.hint = st.hint || 'Conseguite un auto (ENTER al lado de uno)';
      return waitTick(run, () => { if (C.player.car && !C.player.car.wreck) { run.vehicle = kind === 'none' ? null : C.player.car; return true; } return false; });
    }
    // si ya estás arriba de uno de esa clase (por ejemplo, al encadenar pasos), sirve
    const cur = C.player.car;
    if (cur && cur.mission && cur.kind === kind && !cur.wreck) { run.vehicle = cur; run.cars.add(cur); return Promise.resolve(); }
    const at = resolveAt(st.at, null) || (() => { const a = C.player.a; return [C.player.x + Math.cos(a) * 40, C.player.y + Math.sin(a) * 40]; })();
    const v = spawnVehicle(run, kind, at[0], at[1], { line: st.line, ramal: st.ramal, color: st.color });
    run.vehicle = v;
    run.hint = st.hint || 'SUBITE ' + aVeh(kind);
    run.target = v;
    const mk = rMarker(run, v.x, v.y, '#30c0e8', vehName(kind), 16);
    return waitTick(run, () => {
      if (!usable(v)) { failRun(run, `¡Hiciste pelota ${vehName(kind)}!`); return false; }
      mk.x = v.x; mk.y = v.y;
      if (C.player.car === v) { rUnmark(run, mk); return true; }
      return false;
    });
  };

  // route: recorrido con paradas (colectivo: frenar y esperar; basura: frenar al lado de las bolsas)
  STEPS.route = (st, run) => {
    const isBasura = /basura|bolsa/i.test(st.kind || '') || (run.vehicle && run.vehicle.kind === 'basurero' && !st.kind);
    const stops = (st.stops || []).map((s, k) => {
      const at = resolveAt(s && (s.at || s), C.player), dp = snapDrive(at[0], at[1]);
      return { ...s, k, dp, wait: s.wait != null ? s.wait : isBasura ? 1.5 : 3, label: s.label || (isBasura ? 'Bolsas' : 'Parada ' + (k + 1)), done: false };
    });
    if (!stops.length) return Promise.resolve();
    const RAD = m2px(st.r || (isBasura ? 12 : 12));
    let t = 0, startHp = null, cur = 0, boarding = null, pts = [], damageMax = 0;
    // escenografía de cada parada
    for (const s of stops) {
      const [sx, sy] = curbSpot(s.dp);
      s.sx = sx; s.sy = sy;
      if (isBasura) {
        s.bags = [];
        const rx = -Math.sin(s.dp.a), ry = Math.cos(s.dp.a);
        const n = s.bagsN || 2 + (s.k % 2);
        for (let b = 0; b < n; b++) {
          const off = (b - (n - 1) / 2) * 13;
          s.bags.push(rProp(run, sx + Math.cos(s.dp.a) * off + rx * rand(-2, 2), sy + Math.sin(s.dp.a) * off + ry * rand(-2, 2), [bagSprite(s.k * 7 + b)], { a: rand(Math.PI * 2) }));
        }
        s.ring = ring(run, sx, sy, 12, '#80e060', s.label);
      } else {
        s.sign = rProp(run, sx, sy, stopFrames(), { a: s.dp.a - Math.PI / 2, fps: 1 });
        s.pax = [];
        const n = s.pax_n != null ? s.pax_n : s.pax != null && isFinite(s.pax) ? s.pax : 1 + Math.floor(rand(3));
        const rx = -Math.sin(s.dp.a), ry = Math.cos(s.dp.a);
        for (let q = 0; q < n; q++) {
          const off = (q - (n - 1) / 2) * 8 + rand(-1.5, 1.5);
          const px = sx + Math.cos(s.dp.a) * off + rx * 6, py = sy + Math.sin(s.dp.a) * off + ry * 6;
          const p = rPerson(run, px, py, C.randomOutfit(), { a: s.dp.a + Math.PI / 2 + Math.PI });
          p.home = [px, py]; s.pax.push(p);
        }
      }
    }
    // tiempos esperados (puntualidad): distancia en línea recta a ~45 km/h + espera
    let accT = 0, prev = run.vehicle || C.player;
    for (const s of stops) { accT += Math.hypot(s.dp.x - prev.x, s.dp.y - prev.y) * 1.35 / 66 + 4; s.expected = s.t != null ? s.t : accT; accT += s.wait; prev = s.dp; }
    let curRing = null;
    const showStop = () => {
      if (isBasura) return;
      unring(run, curRing); curRing = null;
      const s = stops[cur]; if (s) curRing = ring(run, s.dp.x, s.dp.y, Math.min(RAD, 60), '#f0c030', s.label);
    };
    showStop();
    const baseHint = st.hint || (isBasura ? 'Juntá las bolsas de basura' : 'Hacé el recorrido');
    return waitTick(run, dt => {
      t += dt;
      const v = inVehicle(run);
      if (!v) return false;
      if (startHp === null) startHp = v.hp;
      const dmg = Math.max(0, startHp - v.hp); damageMax = Math.max(damageMax, dmg);
      if (st.maxDamage != null && dmg > st.maxDamage) { failRun(run, st.onFail || (isBasura ? '¡Destrozaste el camión!' : '¡Destrozaste el colectivo!')); return false; }
      const left = stops.filter(s => !s.done);
      if (isBasura) {
        // cualquier orden: la bolsa más cercana
        let s = null, bd = Infinity;
        for (const q of left) { const dd = d2(v.x, v.y, q.sx, q.sy); if (dd < bd) { bd = dd; s = q; } }
        run.hint = baseHint; run.target = s ? { x: s.sx, y: s.sy } : null;
        run.extra = `BOLSAS ${stops.length - left.length}/${stops.length} · DAÑO ${Math.round(dmg)}%`;
        if (!s) return true;
        if (bd < RAD * RAD && slowEnough(v)) {
          s.prog = (s.prog || 0) + dt;
          setBar('JUNTANDO BOLSAS…', s.prog / s.wait, '#80e060');
          const gone = Math.floor(s.prog / s.wait * s.bags.length);
          while (s.bagsGone < gone || (s.bagsGone === undefined && gone > 0)) {
            s.bagsGone = (s.bagsGone || 0) + 1; rUnprop(run, s.bags[s.bagsGone - 1]); C.sfx.burst(0.18, 0.25, 500);
          }
          if (s.prog >= s.wait) {
            for (const b of s.bags) rUnprop(run, b);
            unring(run, s.ring); s.done = true; hideBar(); C.sfx.blip(520, 0.1, 0.1);
            pts.push(1);
            if (!stops.some(q => !q.done)) { finishRoute(); return true; }
          }
        } else {
          if (s.prog) { hideBar(); }
          if (bd < (RAD * 1.6) ** 2 && !slowEnough(v)) run.override = { hint: '¡Frená al lado de las bolsas!' };
        }
        return false;
      }
      // colectivo: en orden, frenar en la parada y esperar que suban
      const s = stops[cur];
      run.target = s.dp;
      run.hint = st.hint ? `${st.hint}\n▶ ${s.label}` : `PARÁ EN: ${s.label}`;
      const late = t - s.expected;
      run.extra = `PARADA ${cur + 1}/${stops.length} · ${late > 0 ? '<b class="red">ATRASADO ' + Math.ceil(late) + 's</b>' : 'EN HORARIO'} · DAÑO ${Math.round(dmg)}%`;
      const near = d2(v.x, v.y, s.dp.x, s.dp.y) < RAD * RAD;
      if (near && !boarding && slowEnough(v, 10)) {
        boarding = { t: 0, arrived: t, k: 0 };
        C.sfx.blip(880, 0.06, 0.08);
      }
      if (boarding) {
        if (!near) { // se fue antes de tiempo: los pasajeros vuelven a esperar
          for (const p of s.pax) if (!p.aboard) { p.x = p.home[0]; p.y = p.home[1]; p.go = false; }
          boarding = null; hideBar(); say('Pasajero', pick(['¡Eeeh! ¡Chofer! ¡Que no subí!', '¡Pará, che! ¿Adónde vas?', '¡Así no se puede, chamigo!']));
          return false;
        }
        const moving = !slowEnough(v, 12);
        if (moving) run.override = { hint: '¡Esperá que suban todos!' };
        else boarding.t += dt;
        // la puerta: adelante a la derecha
        const fx = Math.cos(v.a), fy = Math.sin(v.a), rx = -fy, ry = fx;
        const doorX = v.x + fx * (v.l / 2 - 9) + rx * (v.w / 2 + 3), doorY = v.y + fy * (v.l / 2 - 9) + ry * (v.w / 2 + 3);
        s.pax.forEach((p, q) => {
          if (p.aboard) return;
          if (boarding.t > q * 0.7) p.go = true;
          if (p.go && !moving) { p.walking = true; if (walkTo(p, doorX, doorY, dt, 34)) { p.aboard = true; rUnprop(run, p); C.sfx.blip(990, 0.03, 0.05); } }
        });
        const allIn = s.pax.every(p => p.aboard);
        setBar(allIn ? 'LISTO, ARRANCÁ' : 'SUBEN PASAJEROS…', Math.min(boarding.t / Math.max(0.1, s.wait), allIn ? 1 : 0.95), '#30c0e8');
        if (allIn && boarding.t >= s.wait) {
          const lateS = Math.max(0, boarding.arrived - s.expected);
          pts.push(clamp(1 - lateS / 30, 0, 1));
          s.done = true; boarding = null; hideBar();
          C.sfx.blip(660, 0.08, 0.1);
          // frases de los pasajeros de esta parada (stops[].say)
          if (s.say) (Array.isArray(s.say) ? s.say : [s.say]).forEach((l, q) => setTimeout(() => {
            if (active === run) say(typeof l === 'object' ? l.who || 'Pasajero' : 'Pasajero', typeof l === 'object' ? l.text : l);
          }, q * 3700));
          cur++;
          if (cur >= stops.length) { unring(run, curRing); finishRoute(); return true; }
          showStop();
        }
      }
      return false;
    });
    function finishRoute() {
      const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 1;
      const dmgF = clamp(1 - damageMax / 100, 0, 1);
      const bonus = Math.round((st.bonus != null ? st.bonus : 300) * (isBasura ? clamp(1.6 - t / Math.max(30, accT * 1.2), 0.2, 1) : avg) * dmgF / 10) * 10;
      const label = isBasura ? `RECOLECCIÓN · DAÑO ${Math.round(damageMax)}%` : `PUNTUALIDAD ${Math.round(avg * 100)}% · DAÑO ${Math.round(damageMax)}%`;
      run.bonus.push({ label, money: bonus });
      run.stats.ultimoRecorrido = { puntualidad: Math.round(avg * 100), dano: Math.round(damageMax) };
      banner(`<small>${esc(label)}</small><br>BONUS $${bonus}`, 2.6, 'small');
    }
  };

  // taxi: levantar al pasajero, llevarlo y cobrar (con propina según el humor)
  const MOOD = {
    choque: ['¡Epa! ¡Mirá por dónde vas!', '¡Che, que no es un carrito chocador!', '¡Ay, mi cuello!', '¡La pucha! ¿Quién te dio el registro?'],
    apurado: { lento: ['¡Dale, que llego tarde!', '¿Vamos a pie o en auto? ¡Acelerá!', 'Mi abuela maneja más rápido, y tiene noventa.', '¡Metele pata, chamigo!'], choque: ['¡Rápido, pero entero, che!'] },
    mareado: { rapido: ['Despacito, por favor… que comí chipa.', 'Ay, ay… creo que voy a vomitar.', '¡Más despacio, que me mareo!'], choque: ['Ay… ese golpe me dio vuelta el estómago.'] },
    'charlatán': { charla: ['¿Sabías que el puente tiene más de cincuenta años?', 'Mi primo toca el acordeón en un conjunto de chamamé.', 'Qué calor, ¿no? Corrientes no perdona.', '¿Vos de qué cuadro sos? Yo de Huracán, toda la vida.', 'Este verano me voy a pescar al Paraná, ¿vos pescás?', 'Dicen que abajo de la Merced hay túneles… ¿vos creés?'], choque: ['¡Uh! Como mi cuñado, que chocó en la Costanera…'] },
  };
  STEPS.taxi = (st, run) => {
    const pas = st.passenger || {}, name = pas.name || 'Pasajero', mood = String(pas.mood || 'tranquilo').toLowerCase().replace('charlatan', 'charlatán');
    const look = pas.look || lookFor(name, null, run); run.looks[name] = look;
    const L = st.lines || {};
    const pick0 = resolveAt(st.pickup, C.player), drop0 = resolveAt(st.dropoff, C.player);
    const pd = snapDrive(pick0[0], pick0[1]), dd = snapDrive(drop0[0], drop0[1]);
    const [wx, wy] = curbSpot(pd), [ex, ey] = curbSpot(dd);
    const p = rPerson(run, wx, wy, look, { a: pd.a + Math.PI / 2 });
    const RAD = m2px(st.r || 14);
    let phase = 'pickup', rg = ring(run, pd.x, pd.y, 36, '#f0c030', 'Pasajero: ' + name);
    let t = 0, rideT = 0, hpPrev = null, dmg = 0, slowT = 0, fastT = 0, cool = 0, chatT = 8, saidMid = false, complaints = 0, total = 1, waveT = 0;
    const expected = st.expected || (Math.hypot(dd.x - pd.x, dd.y - pd.y) * 1.4 / 75 + 12);
    const moodLine = kind => {
      const bank = MOOD[mood] && MOOD[mood][kind] || (kind === 'choque' ? MOOD.choque : null);
      if (bank) say(name, pick(bank));
    };
    return waitTick(run, dt => {
      t += dt;
      const v = inVehicle(run);
      if (phase === 'pickup') {
        run.hint = st.hint || `Levantá a ${name}`; run.target = { x: wx, y: wy };
        // el pasajero hace señas
        waveT += dt; p.a = pd.a + Math.PI / 2 + Math.PI + Math.sin(waveT * 6) * 0.3;
        if (!v) return false;
        if (d2(v.x, v.y, wx, wy) < RAD * RAD) {
          if (slowEnough(v, 10)) { phase = 'boarding'; unring(run, rg); rg = null; }
          else run.override = { hint: 'Frená para que suba' };
        }
        return false;
      }
      if (phase === 'boarding') {
        if (!v) return false;
        const fx = Math.cos(v.a), fy = Math.sin(v.a), dx = v.x - fy * (v.w / 2 + 4), dy = v.y + fx * (v.w / 2 + 4);
        if (!slowEnough(v, 14)) { run.override = { hint: '¡Esperá que suba!' }; if (d2(v.x, v.y, p.x, p.y) > (RAD * 2) ** 2) { phase = 'pickup'; p.x = wx; p.y = wy; rg = ring(run, pd.x, pd.y, 36, '#f0c030', 'Pasajero: ' + name); } return false; }
        p.walking = true;
        if (walkTo(p, dx, dy, dt, 32)) {
          rUnprop(run, p); C.sfx.blip(520, 0.06, 0.08);
          phase = 'start'; hpPrev = v.hp;
          rg = ring(run, dd.x, dd.y, 40, '#80e060', 'Destino de ' + name);
          total = Math.max(1, Math.hypot(dd.x - v.x, dd.y - v.y));
          const lines = lineObjs(L.start || '¡Buenas! Llevame, por favor.', name, look, run);
          dialog(lines).then(() => { if (phase === 'start') phase = 'ride'; });
        }
        return false;
      }
      if (phase === 'start') return false;
      if (phase === 'ride') {
        rideT += dt; cool -= dt;
        run.hint = st.hint2 || `Llevá a ${name} a destino`; run.target = { x: dd.x, y: dd.y };
        run.extra = `VIAJE ${fmtTime(rideT)} · ${mood.toUpperCase()}`;
        if (!v) return false;
        // daño: queja
        if (hpPrev !== null && v.hp < hpPrev - 2) { dmg += hpPrev - v.hp; complaints++; if (cool <= 0) { moodLine('choque'); cool = 3; } }
        hpPrev = v.hp;
        const k = kmh(v);
        if (mood === 'apurado') { slowT = k < 40 ? slowT + dt : 0; if (slowT > 5 && cool <= 0) { moodLine('lento'); cool = 7; slowT = 0; complaints++; } }
        if (mood === 'mareado') { fastT = (k > 85 || Math.abs(v.vr || 0) > 35) ? fastT + dt : Math.max(0, fastT - dt); if (fastT > 2.5 && cool <= 0) { moodLine('rapido'); cool = 6; fastT = 0; complaints++; } }
        if (mood === 'charlatán' && (chatT -= dt) <= 0) { chatT = rand(9, 14); moodLine('charla'); }
        if (!saidMid && L.mid && Math.hypot(dd.x - v.x, dd.y - v.y) < total * 0.5) { saidMid = true; const ls = lineObjs(L.mid, name, look, run); ls.forEach((l, q) => setTimeout(() => say(l.who, l.text), q * 3600)); }
        if (d2(v.x, v.y, dd.x, dd.y) < (RAD * 1.4) ** 2) {
          if (!slowEnough(v, 10)) { run.override = { hint: 'Frená para que baje' }; return false; }
          phase = 'end'; unring(run, rg); rg = null;
          // baja por la derecha y camina a la vereda
          const fx = Math.cos(v.a), fy = Math.sin(v.a);
          const q = rPerson(run, v.x - fy * (v.w / 2 + 4), v.y + fx * (v.w / 2 + 4), look, { a: v.a + Math.PI / 2 });
          run.exitPed = q; run.exitTo = [ex, ey];
          const ratio = rideT / expected, tf = ratio <= 1 ? 1 : clamp(2 - ratio, 0, 1);
          const df = clamp(1 - dmg / 60, 0, 1);
          const base = st.tip != null ? st.tip : 150;
          let tip = base * (mood === 'apurado' ? tf * tf : tf) * (mood === 'mareado' ? df * df : df) * (mood === 'charlatán' ? 1.15 : 1);
          tip = Math.max(0, Math.round(tip / 10) * 10);
          run.bonus.push({ label: `PROPINA DE ${name.toUpperCase()}`, money: tip });
          run.stats.ultimaPropina = tip;
          const endL = L.end || (tip > base * 0.7 ? '¡Bárbaro! Tomá, quedate con el vuelto.' : tip > 0 ? 'Llegamos… más o menos. Tomá.' : '¡Nunca más me subo con vos! Ni propina te dejo.');
          dialog(lineObjs(endL, name, look, run)).then(() => { phase = 'done'; banner(`<small>PROPINA</small><br>$${tip}`, 2.2, 'small'); });
        }
        return false;
      }
      if (phase === 'end') { if (run.exitPed) { run.exitPed.walking = true; walkTo(run.exitPed, run.exitTo[0], run.exitTo[1], dt, 20); } return false; }
      return phase === 'done';
    });
  };

  // collect: juntar objetos en el mapa
  STEPS.collect = (st, run) => {
    const mode = st.mode || 'any';
    const items = (st.items || []).map((it, k) => {
      const at = resolveAt(it && (it.at || it), C.player), [x, y] = snapWalk(at[0], at[1]);
      const icon = (it && it.icon) || st.icon;
      const p = rProp(run, x, y, iconFrames(icon), { fps: 3 });
      const mk = rMarker(run, x, y, '#f0c030', (it && it.label) || 'Objeto', 8);
      return { x, y, p, mk, label: (it && it.label) || '', got: false };
    });
    if (!items.length) return Promise.resolve();
    const r = m2px(st.r || (mode === 'vehicle' ? 9 : 5));
    return waitTick(run, () => {
      const P = C.player;
      if (mode === 'vehicle' && !inVehicle(run)) return false;
      if (mode === 'foot' && P.car) run.override = { hint: 'Esto se junta a pie: bajate (ENTER)' };
      let near = null, bd = Infinity;
      for (const it of items) {
        if (it.got) continue;
        const dd = d2(P.x, P.y, it.x, it.y); if (dd < bd) { bd = dd; near = it; }
        const okMode = mode === 'any' || (mode === 'foot' ? !P.car : !!P.car);
        if (dd < r * r && okMode) {
          it.got = true; rUnprop(run, it.p); rUnmark(run, it.mk);
          C.sfx.blip(760, 0.1, 0.12);
          const n = items.filter(q => q.got).length;
          banner(`<small>${esc(it.label || 'JUNTASTE')}</small><br>${n}/${items.length}`, 1.4, 'small');
        }
      }
      const got = items.filter(q => q.got).length;
      run.hint = st.hint || 'Juntá lo marcado';
      run.extra = `${(st.label || 'JUNTASTE').toUpperCase()} ${got}/${items.length}`;
      run.target = near ? { x: near.x, y: near.y } : null;
      return got === items.length;
    });
  };

  // cables: frenar al lado de cada poste y mantener ESPACIO
  STEPS.cables = (st, run) => {
    const hold = st.hold || 3, fr = poleFrames();
    const poles = (st.poles || []).map((q, k) => {
      const at = resolveAt(q && (q.at || q), C.player), dp = snapDrive(at[0], at[1]), [x, y] = curbSpot(dp);
      const p = rProp(run, x, y, fr.idle, { a: dp.a, fps: 2 });
      const rg = ring(run, x, y, 14, '#60c0ff', (q && q.label) || 'Poste ' + (k + 1));
      return { x, y, p, rg, prog: 0, done: false, label: (q && q.label) || '' };
    });
    if (!poles.length) return Promise.resolve();
    const r = m2px(st.r || 11);
    let crackle = 0;
    return waitTick(run, dt => {
      const footOk = st.mode === 'foot' || st.mode === 'any';
      const v = footOk ? (C.player.car || C.player) : inVehicle(run);
      const left = poles.filter(q => !q.done);
      run.hint = st.hint || 'Cortá los cables de los postes marcados';
      run.extra = `POSTES ${poles.length - left.length}/${poles.length} · MANTENÉ ESPACIO AL LADO DEL POSTE`;
      let near = null, bd = Infinity;
      for (const q of left) { const dd = d2(C.player.x, C.player.y, q.x, q.y); if (dd < bd) { bd = dd; near = q; } }
      run.target = near;
      if (!v || !near) return !left.length;
      if (bd < r * r && slowEnough(C.player.car, 10)) {
        if (C.isDown('Space')) {
          near.prog += dt;
          if (near.p.fr !== fr.spark) setFrames(near.p, fr.spark, 14);
          if ((crackle -= dt) <= 0) { crackle = rand(0.08, 0.2); C.sfx.burst(0.06, 0.3, 4200); }
        } else {
          near.prog = Math.max(0, near.prog - dt * 0.5);
          if (near.p.fr !== fr.idle) setFrames(near.p, fr.idle, 2);
          run.override = { hint: 'Mantené apretado ESPACIO para cortar' };
        }
        setBar('CORTANDO CABLES…', near.prog / hold, '#60c0ff');
        if (near.prog >= hold) {
          near.done = true; setFrames(near.p, fr.cut, 0); unring(run, near.rg); hideBar();
          C.sfx.burst(0.4, 0.5, 1800); C.sfx.blip(300, 0.15, 0.1);
          if (!poles.some(q => !q.done)) return true;
        }
      } else {
        for (const q of left) if (q.p.fr !== fr.idle) setFrames(q.p, fr.idle, 2);
        if (barOn) hideBar();
        if (bd < (r * 2) ** 2 && C.player.car && !slowEnough(C.player.car, 10)) run.override = { hint: 'Frená al lado del poste' };
      }
      return false;
    });
  };

  // ruta dirigida (respeta las manos) desde la arista e0 hasta el nodo t
  function routeEdges(e0, t) {
    const NN = G.nx.length, dist = new Float64Array(NN).fill(Infinity), prevE = new Int32Array(NN).fill(-1), done = new Uint8Array(NN);
    const s = G.eb[e0]; dist[s] = 0;
    const heap = [[0, s]];
    const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const u = pop()[1]; if (done[u]) continue; done[u] = 1; if (u === t) break;
      for (const e of G.out[u]) { const v = G.eb[e], nd = dist[u] + G.elen[e]; if (nd < dist[v]) { dist[v] = nd; prevE[v] = e; push(nd, v); } }
    }
    if (s !== t && prevE[t] < 0) return null;
    const path = []; for (let n = t; n !== s; n = G.ea[prevE[n]]) path.push(prevE[n]);
    return [e0, ...path.reverse()];
  }
  function segD2(e, x, y) { const a = G.ea[e], s = proj(e, x, y); return d2(x, y, G.nx[a] + G.edx[e] * s, G.ny[a] + G.edy[e] * s); }
  // vuelve a poner en ruta a un auto que quedó en "física" después de un choque
  function resumeAI(c) {
    let best = c.ri, bd = Infinity;
    for (let k = Math.max(0, c.ri - 1); k < Math.min(c.route.length, c.ri + 6); k++) { const dd = segD2(c.route[k], c.x, c.y); if (dd < bd) { bd = dd; best = k; } }
    c.ri = best; c.e = c.route[best]; c.s = proj(c.e, c.x, c.y); c.nextE = undefined;
    c.spd = Math.min(speedOf(c), c.maxSpd); c.mode = 'ai';
  }

  // chase: seguir (sin perderlo) o alcanzar y frenar a un vehículo
  STEPS.chase = (st, run) => {
    const tg = st.target || {}, kind = kindOf(tg.kind || 'sedan'), goal = st.goal || 'follow';
    const from = resolveAt(tg.from, { x: C.player.x + 120, y: C.player.y }), to = resolveAt(tg.to, null);
    const spec = vehSpec(kind, { line: tg.line, ramal: tg.ramal, color: tg.color });
    const e0 = C.nearestDriveEdge(from[0], from[1]);
    if (e0 < 0) return Promise.resolve();
    // ruta hasta el principio de la calle del destino y después esa calle (así termina a la altura del destino)
    const deTo = to ? C.nearestDriveEdge(to[0], to[1]) : -1;
    let route = deTo >= 0 ? (deTo === e0 ? [e0] : routeEdges(e0, G.ea[deTo])) : null;
    if (route && route[route.length - 1] !== deTo) route.push(deTo);
    if (!route && deTo >= 0) route = routeEdges(e0, G.eb[deTo]);
    const s0 = proj(e0, from[0], from[1]), [x, y] = C.lanePoint(e0, s0, 1);
    clearSpot(x, y, 40);
    const c = C.makeCar(x, y, Math.atan2(G.edy[e0], G.edx[e0]), { type: spec.type, color: spec.color, spr: spec.spr, mode: 'ai', npc: true });
    if (spec.line) { c.line = spec.line; c.ramal = spec.ramal; }
    if (spec.sprB) c.sprB = spec.sprB;
    Object.assign(c, { mission: true, kind, e: e0, s: s0, lane: 1, spd: 0, maxSpd: st.speed ? m2px(st.speed / 3.6) : goal === 'catch' ? 95 : 72,
      isBus: true, stopIn: 1e9, stopT: 0 });
    if (route) { c.route = route; c.ri = 0; }
    // en la última calle llega a la altura del destino (no hasta la otra esquina)
    const sEnd = route && to ? proj(route[route.length - 1], to[0], to[1]) + 12 : Infinity;
    // seguimiento con tiempo: que el objetivo llegue holgado antes de que se acabe el reloj
    if (route && goal === 'follow' && st.time > 0 && !st.speed) {
      let len = 0; for (const e of route) len += G.elen[e];
      c.maxSpd = clamp(len / (st.time * 0.5), 55, 100);
    }
    run.cars.add(c);
    const tname = tg.name || vehName(kind);
    const mk = rMarker(run, c.x, c.y, '#ff4060', tname, 12);
    let goalRing = null;
    if (to && goal === 'follow') { const dp = snapDrive(to[0], to[1]); goalRing = rMarker(run, dp.x, dp.y, '#80e060', 'Destino', 10); }
    const LOSE = m2px(st.maxDist || 85), GRACE = st.grace || 6, CATCH_HP = st.catchHp || 30;
    let lostT = 0, physT = 0, t = 0, startHp = c.hp;
    const roamSecs = st.secs || 60;
    run.hint = st.hint || (goal === 'catch' ? `Alcanzá y frená a ${tname} (chocalo)` : `Seguí a ${tname} sin perderlo`);
    // seguir: si se acaba el reloj y todavía lo tenés a la vista, cumpliste
    if (goal === 'follow') run.onTimeout = () => { if (lostT > GRACE * 0.5) return false; stopTarget(); banner('<small>NO TE VIO</small><br>¡LO SEGUISTE HASTA EL FINAL!', 2, 'small'); return true; };
    return waitTick(run, dt => {
      t += dt;
      mk.x = c.x; mk.y = c.y; run.target = c;
      if (c.wreck || c.burn > 0 || c.hp <= 0) {
        if (goal === 'catch') { stopTarget(); banner('¡LO FRENASTE!', 2, 'small'); return true; }
        failRun(run, st.onFail || '¡Lo hiciste pelota! Había que seguirlo.'); return false;
      }
      if (!C.cars.includes(c)) { if (goal === 'follow') return true; failRun(run, st.onFail || '¡Se te escapó!'); return false; }
      // llegó a destino (o se terminó la ruta)
      const arrived = c.remove || (route && c.ri >= route.length - 1 && c.s > Math.min(G.elen[c.e] - 40, sEnd)) || (!route && goal === 'follow' && t > roamSecs);
      if (arrived) {
        c.remove = false; stopTarget();
        if (goal === 'follow') { banner('<small>LLEGÓ A DESTINO</small>', 1.8, 'small'); return true; }
        failRun(run, st.onFail || '¡Se te escapó!'); return false;
      }
      // después de un choque queda en "física": que retome la ruta
      if (c.mode === 'phys' && c.route) { physT += dt; if (physT > 0.9 && speedOf(c) < 70) { resumeAI(c); physT = 0; } } else physT = 0;
      if (c.mode === 'phys' && !c.route) { physT += dt; if (physT > 1.2) { c.e = C.nearestDriveEdge(c.x, c.y); c.s = proj(c.e, c.x, c.y); c.nextE = undefined; c.spd = speedOf(c); c.mode = 'ai'; physT = 0; } }
      const P = C.player.car || C.player, dd = Math.sqrt(d2(P.x, P.y, c.x, c.y));
      if (goal === 'catch') {
        run.extra = `DAÑO DEL OBJETIVO ${Math.round(clamp((startHp - c.hp) / (startHp - CATCH_HP) * 100, 0, 100))}% · ${Math.round(px2m(dd))} m`;
        if (c.hp <= CATCH_HP) { stopTarget(); banner('¡LO FRENASTE!', 2, 'small'); return true; }
        if (dd > LOSE * 2.2) { lostT += dt; if (lostT > GRACE * 1.5) { failRun(run, st.onFail || '¡Se te escapó!'); return false; } } else lostT = 0;
      } else {
        if (dd > LOSE) {
          lostT += dt; run.override = { hint: `¡LO ESTÁS PERDIENDO! ${Math.ceil(GRACE - lostT)}`, target: c };
          if (lostT > GRACE) { failRun(run, st.onFail || '¡Lo perdiste de vista!'); return false; }
        } else lostT = Math.max(0, lostT - dt * 2);
        run.extra = `DISTANCIA ${Math.round(px2m(dd))} m`;
      }
      return false;
    });
    function stopTarget() { c.mode = 'phys'; c.vx *= 0.3; c.vy *= 0.3; c.isBus = false; rUnmark(run, mk); if (goalRing) rUnmark(run, goalRing); }
  };

  // escape: perder a la policía
  STEPS.escape = (st, run) => {
    const want = clamp(st.stars || 2, 1, 5), TH = [1, 4, 9, 16, 25];
    if (C.wantedLevel() < want) C.crime(TH[want - 1]);
    run.hint = st.hint || 'Perdé a la policía';
    let t = 0;
    return waitTick(run, dt => {
      t += dt;
      const lv = C.wantedLevel();
      run.extra = lv ? `NIVEL DE BÚSQUEDA ${'★'.repeat(lv)}` : '';
      return t > 0.5 && lv === 0;
    });
  };

  // scene / futbol: delegan en los otros módulos
  // Si el módulo no está, la escena no existe todavía o se rompe al cargar/crear, el paso se da por superado
  // con el aviso "ESCENA EN CONSTRUCCIÓN" (así se puede jugar la misión entera mientras se terminan las escenas).
  async function construction(run, label) {
    await notice(run, 'ESCENA EN CONSTRUCCIÓN · ' + label, 2.6);
    return { ok: true, skipped: true };
  }
  async function external(run, st, mod, call, label) {
    const M = C[mod];
    const known = mod !== 'scenes' || !M || !Array.isArray(M.list) || M.list.some(s => s && s.id === st.id);
    if (DEBUG.skipScenes) return construction(run, label + ' (SALTEADA)');
    if (!M || typeof M.play !== 'function' || !known || (mod === 'scenes' && M.has && !M.has(st.id))) return construction(run, label);
    releaseKeys(); show(ui.hud, false); show(ui.sub, false);
    run.inModal = true;
    let r;
    try { r = await call(M); } catch (e) { console.error('[misiones]', mod, e); r = { ok: false, data: { error: String(e) } }; }
    run.inModal = false;
    if (C.modal) C.closeModal(); // por las dudas, que no quede el mundo en pausa
    releaseKeys();
    if (active !== run) return;
    const err = r && (r.error || (r.data && r.data.error));
    if (!r || (r.ok === false && err && !(r.data && r.data.quit))) {
      console.warn('[misiones] escena/minijuego con error, se da por superado:', label, err || r);
      return construction(run, label);
    }
    if (r.ok === false) {
      const quit = (r.data && r.data.quit) || r.abandono;
      failRun(run, quit ? 'ABANDONASTE' : st.onFail || r.reason || (st.opts && (st.opts.textoPierde || st.opts.textoPerder)) || 'NO LO LOGRASTE');
      return;
    }
    return r;
  }
  STEPS.scene = async (st, run) => {
    const r = await external(run, st, 'scenes', M => M.play(st.id, Object.assign({ mission: run.m.id, flags: Object.assign({}, run.flags) }, st.opts || {})), ((st.opts && st.opts.titulo) || st.id || '').toUpperCase());
    if (r && active === run) { run.stats['escena_' + st.id] = r.score != null ? r.score : true; if (r.data && typeof r.data === 'object' && r.data.flags) Object.assign(run.flags, r.data.flags); }
  };
  STEPS.futbol = async (st, run) => {
    const r = await external(run, st, 'futbol', M => M.play(Object.assign({ mission: run.m.id }, st.opts || {})), 'FÚTBOL');
    if (r && active === run) {
      run.stats.futbol = { gj: r.golesJugador, gr: r.golesRival };
      if (r.golesJugador != null) banner(`<small>RESULTADO</small><br>${r.golesJugador} a ${r.golesRival}`, 2.4, 'small');
    }
  };

  // timer: aguantar / esperar un tiempo
  STEPS.timer = (st, run) => {
    let left = st.secs || st.time || 10;
    run.timeLeft = null;
    return waitTick(run, dt => { left -= dt; run.hint = st.hint || st.text || 'Aguantá'; run.extra = `⏱ ${fmtTime(left)}`; return left <= 0; });
  };

  // choice: elección con consecuencias
  STEPS.choice = async (st, run) => {
    const opts = (st.options || []).filter(Boolean);
    if (!opts.length) return;
    const k = await choose(st.prompt, opts, st.who, st.who ? lookFor(st.who, st.look, run) : null);
    const o = opts[k] || opts[0];
    if (o.set) Object.assign(run.flags, o.set);
    if (o.money) { // una opción puede dar o sacar plata: se cobra/paga al cumplir la misión (no se duplica al reintentar)
      run.bonus.push({ label: o.label || (o.money > 0 ? 'EXTRA: ' : 'GASTO: ') + String(o.text || '').toUpperCase().slice(0, 40), money: o.money });
      banner(`<small>${o.money > 0 ? 'VAS A COBRAR' : 'VAS A PAGAR'}</small><br>$${Math.abs(o.money)}`, 2.2, 'small');
      C.sfx.blip(o.money > 0 ? 880 : 220, 0.12, 0.1);
    }
    if (o.lines) await dialog(lineObjs(o.lines, st.who, lookFor(st.who, st.look, run), run));
    if (o.goto !== undefined) return { goto: o.goto };
  };

  // cond: salta según un flag
  STEPS.cond = (st, run) => {
    const v = run.flags[st.flag];
    const ok = st.eq !== undefined ? v === st.eq : st.ne !== undefined ? v !== st.ne : st.gte !== undefined ? v >= st.gte : !!v;
    const to = ok ? st.then : st.else;
    return Promise.resolve(to !== undefined ? { goto: to } : null);
  };

  // extras útiles para el guion
  STEPS.jump = st => Promise.resolve({ goto: st.to !== undefined ? st.to : st.goto });
  STEPS.pay =(st, run) => { if (st.money) run.bonus.push({ label: st.label || 'EXTRA', money: st.money }); return Promise.resolve(); };
  STEPS.flag = (st, run) => { Object.assign(run.flags, st.set || {}); return Promise.resolve(); };
  STEPS.wait = (st, run) => { let t = st.secs || 1; return waitTick(run, dt => (t -= dt) <= 0); };
  STEPS.fail = (st, run) => { failRun(run, st.text || st.onFail || 'MISIÓN FALLIDA'); return Promise.resolve(); };

  // ============================================================ HUD DE OBJETIVO
  function updateHud() {
    const run = active;
    if (!run) { show(ui.hud, false); return; }
    const o = run.override;
    const hint = (o && o.hint) || run.hint;
    const tgt = (o && o.target) || run.target;
    show(ui.hud, !!(hint || run.timeLeft != null || run.extra));
    setHTML(H.title, 'title', esc(run.m.title));
    setHTML(H.obj, 'obj', esc(hint));
    if (tgt && isFinite(tgt.x)) {
      const P = C.player.car || C.player, dx = tgt.x - P.x, dy = tgt.y - P.y, dm = px2m(Math.hypot(dx, dy));
      H.arrow.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      show(H.arrow, true);
      setHTML(H.dist, 'dist', dm >= 1000 ? (dm / 1000).toFixed(1) + ' km' : Math.round(dm) + ' m');
    } else { show(H.arrow, false); setHTML(H.dist, 'dist', ''); }
    if (run.timeLeft != null) { setHTML(H.time, 'time', '⏱ ' + fmtTime(run.timeLeft)); H.time.classList.toggle('red', run.timeLeft < 10); }
    else setHTML(H.time, 'time', '');
    setHTML(H.extra, 'extra', run.extra || '');
  }
  function hideBar() { barOn = false; show(ui.bar, false); }

  // ============================================================ HOOKS
  let promptKey = '';
  C.hooks.update.push(dt => {
    updateProps(dt);
    syncBodyClass();
    const P = C.player;
    // con un diálogo o un menú abierto, el auto frena solo
    if (uiBlocking() && P.car) { const c = P.car; c.vx *= 0.92; c.vy *= 0.92; }
    // los dadores miran al jugador
    for (const g of givers.values()) if (d2(g.x, g.y, P.x, P.y) < 90 * 90) g.prop.a = Math.atan2(P.y - g.y, P.x - g.x);
    const run = active;
    if (run) {
      run.override = null;
      if (!uiBlocking()) {
        run.t += dt;
        if (P.dead) { failRun(run, P.busted ? '¡TE AGARRÓ LA CANA!' : '¡SONASTE!'); }
        else {
          if (run.timeLeft != null) {
            run.timeLeft -= dt;
            if (run.timeLeft <= 0) {
              if (run.onTimeout && run.onTimeout()) { run.timeLeft = null; run.forceDone = true; }
              else { run.timeLeft = 0; failRun(run, run.stepFail || '¡SE ACABÓ EL TIEMPO!'); }
            }
          }
          if (active === run && run.tick) run.tick(dt);
        }
      }
      updateHud();
    }
    // cartelito "ENTER para hablar" cerca de un dador
    let pr = '';
    if (!active && !uiBlocking() && !P.dead) {
      const g = nearGiver();
      if (g) pr = `<b>ENTER</b> · ${esc((g.m.giver && g.m.giver.name) || 'Hablar')}: ${esc(g.m.title)}${g.status === 'completada' ? ' (repetir)' : ''}`;
    }
    if (pr !== promptKey) { promptKey = pr; ui.prompt.innerHTML = pr; show(ui.prompt, !!pr); }
  });
  C.hooks.interact.push(() => {
    if (uiBlocking()) return true;
    if (active) return false;
    const g = nearGiver();
    if (!g) return false;
    if (C.player.car) { const c = C.player.car; c.vx = c.vy = 0; }
    hideFail();
    openCard(g.m);
    return true;
  });
  C.hooks.keydown.push(e => {
    const code = e.code, sys = e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(code);
    if (sys) return false;
    const enter = code === 'Enter' || code === 'NumpadEnter', escK = code === 'Escape' || code === 'Backspace';
    if (dlg.open) {
      if (e.repeat) return true;
      if (dlg.choice) {
        if (code === 'ArrowUp' || code === 'KeyW') { dlg.sel = (dlg.sel + dlg.choice.length - 1) % dlg.choice.length; renderChoice(); }
        else if (code === 'ArrowDown' || code === 'KeyS') { dlg.sel = (dlg.sel + 1) % dlg.choice.length; renderChoice(); }
        else if (/^Digit[1-9]$/.test(code) && +code[5] <= dlg.choice.length) { dlg.sel = +code[5] - 1; renderChoice(); closeDialog(dlg.sel); }
        else if (enter || code === 'Space') { if (dlg.shown < dlg.lines[0].text.length) advanceDialog(); else closeDialog(dlg.sel); }
        return true;
      }
      if (enter || code === 'Space') advanceDialog();
      return true;
    }
    if (confirmBox.open) { if (enter || code === 'KeyS') closeConfirm(true); else if (escK || code === 'KeyN') closeConfirm(false); return true; }
    if (card.open) {
      if (e.repeat) return true;
      if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD' || code === 'Tab') { card.sel = 1 - card.sel; renderCard(); }
      else if (enter || code === 'Space') closeCard(card.sel === 0);
      else if (code === 'KeyS' || code === 'KeyY') closeCard(true);
      else if (escK || code === 'KeyN') closeCard(false);
      return true;
    }
    if (list.open) {
      if (code === 'ArrowUp' || code === 'KeyW') { list.sel--; renderList(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { list.sel++; renderList(); }
      else if (enter) listPick();
      else if (escK || code === 'Tab' || code === 'KeyL') closeList();
      return true;
    }
    if (failed && ui.fail.style.display !== 'none') {
      if (enter) { retry(); return true; }
      if (code === 'KeyR' && failed.checkpoint) { retry(true); return true; }
      if (escK) { hideFail(); return true; }
    }
    if (doneT > 0 && enter && ui.done.style.display !== 'none') { doneT = 0; show(ui.done, false); return true; }
    if (code === 'Tab' || code === 'KeyL') { if (!e.repeat) openList(); return true; }
    if (code === 'Escape' && active) { askConfirm('¿ABANDONAR LA MISIÓN?', cancelRun); return true; }
    return false;
  });

  // ============================================================ ANIMACIÓN DE LA INTERFAZ (texto letra por letra, carteles)
  let lastUi = performance.now(), blipN = 0;
  function uiLoop(now) {
    const dt = Math.min(0.1, (now - lastUi) / 1000); lastUi = now;
    syncBodyClass();
    if (dlg.open) {
      const l = dlg.lines[dlg.i];
      if (dlg.shown < l.text.length) {
        const before = Math.floor(dlg.shown);
        dlg.shown = Math.min(l.text.length, dlg.shown + dt * 42);
        const n = Math.floor(dlg.shown);
        if (n !== before) { H.text.textContent = l.text.slice(0, n); if ((blipN++ & 3) === 0 && /\S/.test(l.text[n - 1] || '')) C.sfx.blip(900 + (strHash(l.who || '') % 300), 0.015, 0.025); }
      }
      H.next.style.visibility = dlg.shown >= l.text.length && !dlg.choice ? '' : 'hidden';
      if (dlg.choice && dlg.shown >= l.text.length && !H.opts.innerHTML) renderChoice();
    }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0.4) ui.banner.style.opacity = Math.max(0, bannerT / 0.4); if (bannerT <= 0) show(ui.banner, false); }
    if (doneT > 0) { doneT -= dt; if (doneT <= 0) show(ui.done, false); }
    if (failT > 0 && failed) { failT -= dt; if (failT <= 0) hideFail(); }
    // subtítulos
    if (!dlg.open) {
      if (subT > 0) { subT -= dt; if (subT <= 0) show(ui.sub, false); }
      if (subT <= 0 && subQ.length) {
        const s = subQ.shift(); subT = s.secs;
        ui.sub.innerHTML = (s.who ? `<b>${esc(isPlayerName(s.who) ? 'VOS' : s.who)}:</b> ` : '') + esc(s.text);
        show(ui.sub, true);
      }
    }
    requestAnimationFrame(uiLoop);
  }
  requestAnimationFrame(uiLoop);

  // ============================================================ MISIONES DE PRUEBA (solo si no hay missions_data.js)
  function buildFallback() {
    // alrededor de la Plaza 25 de Mayo (donde arranca el jugador)
    const [la, lo] = C.px2ll(C.player.x, C.player.y);
    const P = (dlat, dlon) => [+(la + dlat).toFixed(6), +(lo + dlon).toFixed(6)];
    Object.assign(FALLBACK_PLACES, { plaza: P(0, 0), esquina: P(-0.0012, 0.0010), terminal: P(-0.0030, 0.0035) });
    const chela = { skin: '#c89a70', hair: '#8a8a8a', shirt: '#d84a8a', pants: '#2a2a4a' };
    const tito = { skin: '#a87850', hair: '#1a1a1a', shirt: '#e8c040', pants: '#3a3a3a', hat: '#1f7a4c' };
    return [
      { id: 'prueba_tutorial', n: 1, title: 'Primeros pasos', tagline: 'Hablá, caminá y elegí', giver: { name: 'Doña Chela', at: P(0.0002, 0.0004), look: chela },
        unlock: [], reward: { money: 100 },
        steps: [
          { type: 'talk', who: 'Doña Chela', lines: ['¡Hola, mijo! ¿Me hacés un favorcito?', { who: 'Vos', text: 'Sí, doña. ¿Qué necesita?' }, 'Andá hasta la esquina y fijate si llegó el diariero.'] },
          { type: 'goto', at: 'esquina', r: 10, mode: 'foot', hint: 'Caminá hasta la esquina', time: 90 },
          { type: 'choice', who: 'Doña Chela', prompt: '¿Le traés el diario o un chipá?', options: [{ text: 'El diario', set: { trajo: 'diario' } }, { text: 'Un chipá calentito', set: { trajo: 'chipa' } }] },
          { type: 'cond', flag: 'trajo', eq: 'chipa', then: 5, else: 4 },
          { type: 'talk', who: 'Doña Chela', lines: ['Gracias, ahora me entero de todo el chisme.'], },
          { type: 'cond', flag: 'trajo', eq: 'diario', then: 7 },
          { type: 'talk', who: 'Doña Chela', lines: ['¡Ay, qué rico! Con un mate esto es gloria.'] },
          { type: 'timer', secs: 3, text: 'Esperá que Doña Chela busque la plata' },
          { type: 'talk', who: 'Doña Chela', lines: ['Tomá, para vos. ¡No lo gastes en pavadas!'] },
        ] },
      { id: 'prueba_colectivo', n: 2, title: 'El 104 de las seis', tagline: 'Cubrí el recorrido del chofer enfermo', giver: { name: 'Tito', at: P(-0.0004, 0.0006), look: tito },
        unlock: [], reward: { money: 300 },
        steps: [
          { type: 'talk', who: 'Tito', lines: ['El chofer del 104 se enfermó. ¿Lo cubrís?', 'Pará en cada parada y esperá que suban todos. ¡Y no me lo choques!'] },
          { type: 'vehicle', kind: 'colectivo', line: 104, ramal: 'A', at: P(-0.0004, 0.0012) },
          { type: 'route', kind: 'colectivo', maxDamage: 60, stops: [{ at: P(-0.0016, 0.0016), wait: 3, label: 'Parada Junín' }, { at: P(-0.0030, 0.0030), wait: 3, label: 'Parada Salta' }, { at: P(-0.0020, 0.0050), wait: 2, label: 'Terminal' }] },
          { type: 'talk', who: 'Tito', lines: ['¡Bien ahí! La gente llegó a horario por primera vez en años.'] },
        ] },
      { id: 'prueba_remis', n: 3, title: 'Remís a la terminal', tagline: 'Un pasajero apurado', giver: { name: 'Doña Chela', at: P(0.0006, -0.0004), look: chela },
        unlock: [], reward: { money: 200 },
        steps: [
          { type: 'vehicle', kind: 'remis', at: P(0.0008, 0.0000) },
          { type: 'taxi', pickup: P(-0.0010, 0.0020), dropoff: 'terminal', passenger: { name: 'Don Ramón', mood: 'apurado', look: { shirt: '#4070d8', hair: '#8a8a8a', skin: '#f0c8a0', pants: '#3a3a3a', glasses: true } },
            lines: { start: ['¡A la terminal, rápido, que pierdo el micro!'], mid: ['¿Falta mucho? ¡Dale!'], end: ['¡Llegué! Gracias, chamigo.'] }, time: 150 },
        ] },
      { id: 'prueba_dpec', n: 4, title: 'Cables de la DPEC', tagline: 'Cortá los cables colgados antes de la tormenta', giver: { name: 'Ingeniero Benítez', at: P(-0.0002, -0.0008), look: { shirt: '#1a4aa8', hat: '#f0d020', skin: '#d8a878', hair: '#2a1a10', pants: '#2a3a6a' } },
        unlock: [], reward: { money: 350 },
        steps: [
          { type: 'talk', who: 'Ingeniero Benítez', lines: ['Hay cables colgando en tres postes. Llevate la camioneta.', 'Frená al lado del poste y mantené ESPACIO hasta cortar.'] },
          { type: 'vehicle', kind: 'dpec', at: P(-0.0004, -0.0010) },
          { type: 'cables', hold: 2.5, time: 180, poles: [{ at: P(-0.0014, -0.0010) }, { at: P(-0.0020, 0.0004) }, { at: P(-0.0008, 0.0018) }] },
        ] },
      { id: 'prueba_basura', n: 5, title: 'Recolección nocturna', tagline: 'Las bolsas no se juntan solas', giver: { name: 'Tito', at: P(0.0010, 0.0008), look: tito },
        unlock: ['prueba_colectivo'], reward: { money: 250 },
        steps: [
          { type: 'vehicle', kind: 'basurero', at: P(0.0012, 0.0012) },
          { type: 'route', kind: 'basura', stops: [{ at: P(0.0016, 0.0024) }, { at: P(0.0004, 0.0030) }, { at: P(-0.0008, 0.0026) }], time: 240 },
        ] },
      { id: 'prueba_persecucion', n: 6, title: 'El auto negro', tagline: 'Seguilo, alcanzalo y después rajá', giver: { name: 'Comisario Sosa', at: P(0.0000, -0.0012), look: { shirt: '#24357a', pants: '#14183a', skin: '#d8a878', hair: '#0e1430', beard: true } },
        unlock: [], reward: { money: 500 },
        steps: [
          { type: 'talk', who: 'Comisario Sosa', lines: ['Ese auto negro anda raro. Seguilo sin que te vea.'] },
          { type: 'vehicle', kind: 'patrullero', at: P(-0.0002, -0.0016) },
          { type: 'chase', goal: 'follow', target: { kind: 'zcar', from: P(-0.0010, -0.0016), to: P(-0.0040, 0.0040) } },
          { type: 'chase', goal: 'catch', target: { kind: 'sedan', color: '#2a2a2a', from: P(-0.0040, 0.0044), to: P(0.0020, 0.0060) }, time: 120 },
          { type: 'escape', stars: 2 },
        ] },
      { id: 'prueba_escenas', n: 7, title: 'Expedientes y picado', tagline: 'Escena 3D, fútbol y juntar cosas', giver: { name: 'Ingeniero Benítez', at: P(0.0004, 0.0012) },
        unlock: ['prueba_tutorial'], reward: { money: 400 },
        steps: [
          { type: 'collect', icon: 'expediente', label: 'Expedientes', items: [{ at: P(0.0008, 0.0016), label: 'Expediente 1' }, { at: P(0.0012, 0.0010), label: 'Expediente 2' }], mode: 'foot' },
          { type: 'scene', id: 'casa_gobierno', opts: { dificultad: 1 } },
          { type: 'futbol', opts: { rival: 'Huracán', minutos: 2, jugadores: 5 } },
        ] },
    ];
  }

  // ============================================================ ARRANQUE
  loadProgress();
  placeGivers();

  // API para depurar / otros módulos
  C.missions = {
    list: MISSIONS, usingFallback,
    get active() { return active; }, get failed() { return failed; }, get progress() { return progress; },
    status: id => { const m = byId(id); return m ? statusOf(m) : null; },
    start(id) { const m = byId(id); if (m && !active) startMission(m); return !!m; },
    cancel: cancelRun, retry,
    skip() { DEBUG.skip(); },                                         // da por cumplido el paso actual (pruebas)
    debug: null,
    reset() { if (active) cancelRun(); progress = { done: {}, flags: {} }; saveProgress(); placeGivers(); },
    resolveAt, snapWalk, snapDrive, givers, dialog: (lines, who) => dialog(lineObjs(lines, who, null, active)),
    sprites: { basurero: basureroSprite, remis: remisSprite, dpec: dpecSprite, portrait },
  };
  // ---- depuración desde la consola: Chipa.missions.debug.help()
  const DEBUG = C.missions.debug = {
    help() {
      return ['state()            estado de la misión en curso', 'start(id|n, paso)  arranca una misión (desbloqueada o no), opcionalmente desde un paso',
        'skip()             da por cumplido el paso actual (cierra diálogos; en una elección toma la marcada)', 'step(i)            salta al paso i (base 0)',
        'pick(k)            en una elección abierta, elige la opción k (base 0)', 'tp()               te lleva al objetivo actual',
        'complete(id|n)     marca misiones como cumplidas (todas las previas)', 'flag(k, v)         escribe una flag global', 'unlockAll()        desbloquea todas',
        'fail()             hace fallar la misión en curso'].join('\n');
    },
    state() {
      const r = active; if (!r) return { active: null, failed: failed && { id: failed.m.id, reason: failed.reason, checkpoint: failed.checkpoint }, flags: C.missionFlags };
      const st = r.m.steps[r.i] || {};
      return { id: r.m.id, i: r.i, type: st.type, hint: (r.override && r.override.hint) || r.hint, extra: r.extra, timeLeft: r.timeLeft, dialog: dlg.open ? (dlg.choice ? 'choice' : dlg.i + 1 + '/' + dlg.lines.length) : null,
        target: r.target && isFinite(r.target.x) ? [Math.round(r.target.x), Math.round(r.target.y)] : null, vehicle: r.vehicle ? r.vehicle.kind : null, inCar: !!C.player.car, flags: Object.assign({}, r.flags) };
    },
    start(id, step = 0) {
      const m = typeof id === 'number' ? MISSIONS.find(q => q.n === id) : byId(id); if (!m) return false;
      if (active) cancelRun(); hideFail(); show(ui.done, false);
      if (step) startMission(m, false, { i: step, flags: {} }); else startMission(m);
      return true;
    },
    skip() {
      if (card.open) { closeCard(true); return; }
      if (dlg.open) { closeDialog(dlg.choice ? dlg.sel : undefined); return; }
      if (active) active.forceDone = true;
    },
    step(i) { if (!active) return false; active.jumpTo = i; this.skip(); return true; },
    pick(k) { if (dlg.open && dlg.choice) { dlg.sel = k; closeDialog(k); return true; } return false; },
    tp(dx = 0, dy = 0) {
      const r = active, t = r && ((r.override && r.override.target) || r.target); if (!t || !isFinite(t.x)) return false;
      C.teleport(t.x + dx, t.y + dy); const car = C.player.car; if (car) { car.vx = car.vy = 0; }
      return [Math.round(t.x), Math.round(t.y)];
    },
    complete(...ids) {
      for (const id of ids) { const m = typeof id === 'number' ? MISSIONS.find(q => q.n === id) : byId(id); if (m) progress.done[m.id] = { t: Date.now(), best: 0 }; }
      saveProgress(); placeGivers(); return Object.keys(progress.done);
    },
    unlockAll() { for (const m of MISSIONS) for (const u of m.unlock || []) if (!progress.done[u]) progress.done[u] = { t: Date.now(), best: 0 }; saveProgress(); placeGivers(); },
    flag(k, v = true) { progress.flags[k] = v; if (active) active.flags[k] = v; saveProgress(); return C.missionFlags; },
    fail(reason) { if (active) failRun(active, reason || 'FALLO DE PRUEBA'); },
  };
  // flags del guion (las guardadas + las de la misión en curso), por si una escena las quiere leer
  Object.defineProperty(C, 'missionFlags', { configurable: true, get: () => Object.assign({}, progress.flags, active ? active.flags : null) });
  dispatchEvent(new Event('missions-ready'));
}
if (window.Chipa) boot(); else addEventListener('chipa-ready', boot, { once: true });
})();
