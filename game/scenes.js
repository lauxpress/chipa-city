// CHIPA CITY — escenas 3D (window.Chipa.scenes)
// Framework común: renderer propio + post-proceso pixelado (shader a mano) + HUD en DOM + entrada + ciclo de vida.
// Cada escena vive en game/scenes/<id>.js y se carga la primera vez que se juega (ChipaScenes.register).
//   Chipa.scenes.play(id, opts) → Promise<{ok, score?, reason?, data?}>   (reason: texto de derrota que muestra missions.js)
//   Chipa.scenes.has(id) → si la escena existe en el catálogo
//   Chipa.scenes.debugFinish(ok = true, data) → (pruebas) termina la escena abierta ya, resuelve la Promise y libera todo
//   El bucle usa requestAnimationFrame con respaldo por setTimeout: corre aunque la pestaña esté oculta (más lento).
//   st.finishNow(result) → como st.finish pero sin fundido.
//
// Cambios de API (todos compatibles hacia atrás; lo viejo sigue igual):
//   · st.sfx.tone/noise aceptan o.pan (-1..1); st.sfx.whistle({pan, vol, delay}) = silbido "fiu-fiuuu".
//   · st.say/st.choose hacen cola si ya hay un diálogo abierto (antes se pisaban y st.busy quedaba colgado);
//     la tecla que cierra un diálogo ya no dispara también st.action(). st.dialogOpen() → bool.
//   · st.lightShaft({x, y, z, height, rTop, rBottom, color, intensity}) → Mesh: haz de luz (god ray) aditivo.
//   · st.thirdPerson({obj, collider, radius, speed, dist, pitch, camYaw, bounds}) → controlador de personaje en
//     tercera persona (WASD relativo a cámara, SHIFT corre, Q/E giran la cámara). Llamar ctl.update(dt).
//   · st.seeThrough(material, radio) → agujerea con tramado lo que tape a st.seeTarget (thirdPerson lo fija solo).
//   · st.nearest(items, x, z) → el {x, z, r} más cercano dentro de su radio (para carteles de interacción).
//   · U.dampAngle(a, b, k, dt).
//   · Depuración: cada escena puede exponer instance.debug (window.__scenesCur.instance.debug) para ganar/perder
//     o resolver puzzles desde la consola; test_scenes.html trae __adv/__run/__goM para probar sin la pestaña al frente.
'use strict';
(function () {
  const T = window.THREE;
  const SRC = document.currentScript && document.currentScript.src;
  const BASE = SRC ? SRC.replace(/[^/]*$/, '') : '';
  const DEFS = {};
  const LIST = [
    { id: 'tunel', name: 'Los túneles de la Merced', view: 'primera persona' },
    { id: 'higuera', name: 'Bajo la Higuera', view: 'tercera persona' },
    { id: 'patagonia', name: 'Truco en la Costanera', view: 'primera persona' },
    { id: 'casa_gobierno', name: 'Casa de Gobierno', view: 'tercera persona' },
    { id: 'trabajo', name: 'La oficina', view: 'tercera persona' },
    { id: 'santuario', name: 'El Gauchito', view: 'tercera persona' },
  ];
  let current = null;

  // ================================================================== utilidades
  const U = {};
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  // como damp pero para ángulos (toma el camino corto)
  U.dampAngle = (a, b, k, dt) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * (1 - Math.exp(-k * dt)); };
  U.ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  U.hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.rng = seed => {
    let a = (typeof seed === 'number' ? seed : U.hash(seed)) >>> 0 || 1;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  // primer valor definido entre varias claves de opts (los guiones usan claves en castellano)
  U.o = (o, keys, def) => { for (const k of keys.split(' ')) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return def; };
  U.diff = o => U.clamp(Math.round(+U.o(o, 'difficulty dificultad nivel', 3)) || 3, 1, 10);
  U.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  U.shuffle = (r, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  // color en espacio lineal (trabajamos en lineal y el post-proceso hace la curva + gamma)
  U.C = hex => new T.Color(hex).convertSRGBToLinear();
  U.canvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; if (fn) fn(g, w, h); return c; };
  U.R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); };
  U.tex = (c, o = {}) => {
    const t = new T.CanvasTexture(c);
    t.magFilter = T.NearestFilter;
    t.minFilter = o.mips === false ? T.NearestFilter : T.NearestMipmapNearestFilter;
    t.generateMipmaps = o.mips !== false;
    if (o.repeat !== false) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.encoding = o.linear ? T.LinearEncoding : T.sRGBEncoding;
    t.anisotropy = 1;
    return t;
  };
  // variación de un color hex (#rrggbb) en k (multiplicativo)
  U.shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
  };
  U.mix = (h1, h2, t) => {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return '#' + [16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('');
  };
  // ---- pintores de texturas pixel art
  U.paint = {
    noise(g, w, h, r, cols, n) { for (let i = 0; i < n; i++) U.R(g, U.pick(r, cols), Math.floor(r() * w), Math.floor(r() * h), 1, 1); },
    // ladrillo colonial (bw×bh px por ladrillo, 1 px de junta)
    brick(g, w, h, r, o = {}) {
      const bw = o.bw || 8, bh = o.bh || 4, base = o.cols || ['#8a3c22', '#9a4828', '#7a3420', '#a4542e', '#6e2e1c'], mortar = o.mortar || '#4a3a2c';
      U.R(g, mortar, 0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += bh, row++) {
        for (let x = -(row % 2) * (bw / 2); x < w; x += bw) {
          const c = U.pick(r, base);
          U.R(g, c, x + 1, y + 1, bw - 1, bh - 1);
          U.R(g, U.shade(c, 1.18), x + 1, y + 1, bw - 1, 1);
          U.R(g, U.shade(c, 0.8), x + 1, y + bh - 1, bw - 1, 1);
          if (r() < 0.35) U.R(g, U.shade(c, 0.7), x + 1 + Math.floor(r() * (bw - 2)), y + 1 + Math.floor(r() * (bh - 2)), 1, 1);
          if (r() < 0.25) U.R(g, U.shade(c, 1.25), x + 1 + Math.floor(r() * (bw - 2)), y + 2, 1, 1);
          if (x < 0) U.R(g, U.pick(r, base), x + w + 1, y + 1, bw - 1, bh - 1);
        }
      }
    },
    // baldosas de piedra irregulares
    flags(g, w, h, r, o = {}) {
      const cols = o.cols || ['#5a5248', '#625a50', '#4e4840', '#6a6258'], gap = o.gap || '#2a2620', n = o.n || 4;
      U.R(g, gap, 0, 0, w, h);
      const s = w / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = U.pick(r, cols), x = i * s + (j % 2 ? s / 2 : 0);
        for (const ox of [0, -w]) {
          U.R(g, c, x + 1 + ox, j * s + 1, s - 1, s - 1);
          U.R(g, U.shade(c, 1.15), x + 1 + ox, j * s + 1, s - 1, 1);
          U.R(g, U.shade(c, 0.78), x + 1 + ox, j * s + s - 1, s - 1, 1);
        }
      }
      U.paint.noise(g, w, h, r, [U.shade(cols[0], 0.8), U.shade(cols[0], 1.2)], w * h / 6);
    },
    planks(g, w, h, r, o = {}) {
      const cols = o.cols || ['#6a4426', '#5a3a20', '#7a5030', '#4e321c'], pw = o.pw || 4;
      for (let x = 0; x < w; x += pw) {
        const c = U.pick(r, cols); U.R(g, c, x, 0, pw, h); U.R(g, U.shade(c, 0.6), x + pw - 1, 0, 1, h);
        const cut = Math.floor(r() * h); U.R(g, U.shade(c, 0.55), x, cut, pw - 1, 1);
        for (let k = 0; k < 3; k++) U.R(g, U.shade(c, r() < 0.5 ? 0.85 : 1.15), x + Math.floor(r() * (pw - 1)), Math.floor(r() * h), 1, 2 + Math.floor(r() * 4));
      }
    },
    dirt(g, w, h, r, o = {}) {
      const cols = o.cols || ['#4a3624', '#54402a', '#3e2e1e', '#5c4630'];
      U.R(g, cols[0], 0, 0, w, h); U.paint.noise(g, w, h, r, cols, w * h * 0.7);
      for (let i = 0; i < w * h / 40; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); U.R(g, '#6a5a48', x, y, 2, 1); U.R(g, '#2a2018', x, y + 1, 2, 1); }
    },
    plaster(g, w, h, r, o = {}) {
      const c = o.col || '#d8cfb8'; U.R(g, c, 0, 0, w, h);
      U.paint.noise(g, w, h, r, [U.shade(c, 0.94), U.shade(c, 1.04), U.shade(c, 0.9)], w * h * 0.35);
    },
  };
  // texto pixelado nítido (dibuja con la fuente del sistema y umbraliza el antialias)
  U.text = (g, txt, x, y, o = {}) => {
    const W = g.canvas.width, H = g.canvas.height, tmp = U.canvas(W, H), t = tmp.getContext('2d');
    t.font = o.font || `bold ${o.size || 8}px monospace`; t.textBaseline = 'top'; t.textAlign = o.align || 'left'; t.fillStyle = '#fff';
    String(txt).split('\n').forEach((l, k) => t.fillText(l, x, y + k * (o.lh || (o.size || 8) + 1)));
    const d = t.getImageData(0, 0, W, H).data, out = g.getImageData(0, 0, W, H), od = out.data;
    const n = parseInt((o.color || '#000000').slice(1), 16), cr = n >> 16 & 255, cg = n >> 8 & 255, cb = n & 255, thr = o.thr || 100;
    const sh = o.shadow ? parseInt(o.shadow.slice(1), 16) : null;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > thr) {
      if (sh !== null) { const j = i + (W + 1) * 4; if (j < od.length && d[j + 3] <= thr) { od[j] = sh >> 16 & 255; od[j + 1] = sh >> 8 & 255; od[j + 2] = sh & 255; od[j + 3] = 255; } }
      od[i] = cr; od[i + 1] = cg; od[i + 2] = cb; od[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
  };
  // geometría con colores por vértice (para mezclar pisos/paredes en una sola malla)
  U.Builder = class {
    constructor() { this.pos = []; this.uv = []; this.col = []; this.nrm = []; }
    tri(a, b, c, ua, ub, uc, col) {
      const n = new T.Vector3().subVectors(new T.Vector3(...b), new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...c), new T.Vector3(...a))).normalize();
      for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { this.pos.push(...p); this.uv.push(...u); this.nrm.push(n.x, n.y, n.z); }
      const cc = Array.isArray(col) ? col : [col, col, col];
      for (const k of cc) { const v = k || [1, 1, 1]; this.col.push(v[0], v[1], v[2]); }
    }
    // a b c d en orden antihorario visto de frente; uv por esquina; col por esquina o único
    quad(a, b, c, d, uv, col) {
      const U4 = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
      const C4 = Array.isArray(col) && Array.isArray(col[0]) ? col : [col, col, col, col];
      this.tri(a, b, c, U4[0], U4[1], U4[2], [C4[0], C4[1], C4[2]]);
      this.tri(a, c, d, U4[0], U4[2], U4[3], [C4[0], C4[2], C4[3]]);
    }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nrm, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
      g.computeBoundingSphere();
      return g;
    }
  };
  // material estándar mate con textura pixelada
  U.mat = (o = {}) => {
    const m = new T.MeshStandardMaterial({ color: o.color !== undefined ? (o.color instanceof T.Color ? o.color : U.C(o.color)) : 0xffffff,
      map: o.map || null, roughness: o.rough !== undefined ? o.rough : 0.92, metalness: o.metal || 0, flatShading: o.flat !== false,
      vertexColors: !!o.vc, transparent: !!o.transparent, opacity: o.opacity !== undefined ? o.opacity : 1, side: o.side || T.FrontSide,
      emissive: o.emissive !== undefined ? U.C(o.emissive) : 0x000000, emissiveIntensity: o.ei || 1, emissiveMap: o.emissiveMap || null });
    if (o.bump) { m.bumpMap = o.bump; m.bumpScale = o.bumpScale || 0.6; }
    if (o.alphaTest) m.alphaTest = o.alphaTest;
    if (o.depthWrite === false) m.depthWrite = false;
    return m;
  };
  // ruido de parpadeo de fuego (0..1 aprox. centrado en 1)
  U.flicker = (t, s) => 0.86 + 0.07 * Math.sin(t * 9.1 + s) + 0.05 * Math.sin(t * 23.3 + s * 3.1) + 0.04 * Math.sin(t * 41.7 + s * 7.3);

  // ---- personaje low-poly (para tercera persona). Mira hacia +z.
  U.faceTex = (o = {}) => U.tex(U.canvas(8, 8, g => {
    U.R(g, o.skin || '#d8a878', 0, 0, 8, 8);
    U.R(g, o.hair || '#1a1a1a', 0, 0, 8, 2); U.R(g, o.hair || '#1a1a1a', 0, 2, 1, 1); U.R(g, o.hair || '#1a1a1a', 7, 2, 1, 1);
    U.R(g, '#f8f8f0', 1, 3, 2, 2); U.R(g, '#f8f8f0', 5, 3, 2, 2); U.R(g, o.eyes || '#2a1a10', 2, 3, 1, 2); U.R(g, o.eyes || '#2a1a10', 5, 3, 1, 2);
    if (o.mustache) U.R(g, o.hair || '#2a1a10', 2, 6, 4, 1);
    U.R(g, '#8a4a3a', 3, 7, 2, 1);
    if (o.beard) { U.R(g, o.hair, 1, 6, 1, 2); U.R(g, o.hair, 6, 6, 1, 2); U.R(g, o.hair, 2, 7, 1, 1); U.R(g, o.hair, 5, 7, 1, 1); }
  }), { repeat: false, mips: false });
  U.person = (o = {}) => {
    const g = new T.Group();
    const M = c => U.mat({ color: c, rough: 0.95 });
    const skin = M(o.skin || '#d8a878'), shirt = M(o.shirt || '#30c0e8'), pants = M(o.pants || '#2a3a6a'), hair = M(o.hair || '#1a1a1a'), shoes = M(o.shoes || '#2a201a');
    const box = (w, h, d, m, x, y, z, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; (parent || g).add(b); return b; };
    const hip = new T.Group(); hip.position.y = 0.9; g.add(hip);
    const legL = new T.Group(); legL.position.set(-0.13, 0, 0); hip.add(legL);
    const legR = new T.Group(); legR.position.set(0.13, 0, 0); hip.add(legR);
    box(0.2, 0.78, 0.22, pants, 0, -0.4, 0, legL); box(0.2, 0.78, 0.22, pants, 0, -0.4, 0, legR);
    box(0.22, 0.12, 0.3, shoes, 0, -0.84, 0.04, legL); box(0.22, 0.12, 0.3, shoes, 0, -0.84, 0.04, legR);
    const torso = new T.Group(); torso.position.y = 0.9; g.add(torso);
    box(0.52, 0.62, 0.28, shirt, 0, 0.31, 0, torso);
    const armL = new T.Group(); armL.position.set(-0.34, 0.56, 0); torso.add(armL);
    const armR = new T.Group(); armR.position.set(0.34, 0.56, 0); torso.add(armR);
    box(0.15, 0.56, 0.16, shirt, 0, -0.24, 0, armL); box(0.15, 0.56, 0.16, shirt, 0, -0.24, 0, armR);
    box(0.13, 0.12, 0.13, skin, 0, -0.56, 0, armL); box(0.13, 0.12, 0.13, skin, 0, -0.56, 0, armR);
    const head = new T.Group(); head.position.y = 0.66; torso.add(head);
    const faceM = U.mat({ map: U.faceTex(o), rough: 0.95 });
    const hb = new T.Mesh(new T.BoxGeometry(0.36, 0.38, 0.34), [skin, skin, hair, skin, faceM, hair]); hb.position.y = 0.2; hb.castShadow = true; head.add(hb);
    box(0.38, 0.1, 0.36, hair, 0, 0.42, -0.01, head);
    if (o.hat) { box(0.52, 0.04, 0.5, M(o.hat), 0, 0.44, 0, head); box(0.36, 0.14, 0.34, M(o.hat), 0, 0.52, 0, head); }
    if (o.headband) box(0.38, 0.06, 0.36, M(o.headband), 0, 0.34, 0, head);
    g.userData = { legL, legR, armL, armR, torso, head, phase: 0 };
    return g;
  };
  // anima caminata: speed en m/s
  U.animPerson = (p, speed, dt) => {
    const d = p.userData; d.phase += dt * (2 + speed * 3.2);
    const a = Math.min(1, speed / 2.5) * 0.7 * Math.sin(d.phase), idle = Math.sin(d.phase * 0.5) * 0.02 * (speed < 0.1 ? 1 : 0);
    d.legL.rotation.x = a; d.legR.rotation.x = -a; d.armL.rotation.x = -a * 0.8; d.armR.rotation.x = a * 0.8;
    d.torso.position.y = 0.9 + Math.abs(Math.sin(d.phase)) * 0.04 * Math.min(1, speed) + idle;
  };
  // colisiones 2D en el plano XZ: grilla + cajas + círculos
  U.Collider = class {
    constructor(solidFn, cell) { this.solid = solidFn; this.cell = cell || 1; this.boxes = []; this.circles = []; }
    box(x0, z0, x1, z1) { const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), on: true }; this.boxes.push(b); return b; }
    circle(x, z, r) { const c = { x, z, r, on: true }; this.circles.push(c); return c; }
    resolve(p, r) {
      for (let it = 0; it < 3; it++) {
        if (this.solid) {
          const s = this.cell, cx = Math.floor(p.x / s), cz = Math.floor(p.z / s);
          for (let j = cz - 1; j <= cz + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) if (this.solid(i, j)) this._pushBox(p, r, i * s, j * s, i * s + s, j * s + s);
        }
        for (const b of this.boxes) if (b.on) this._pushBox(p, r, b.x0, b.z0, b.x1, b.z1);
        for (const c of this.circles) if (c.on) {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
        }
      }
    }
    _pushBox(p, r, x0, z0, x1, z1) {
      const qx = U.clamp(p.x, x0, x1), qz = U.clamp(p.z, z0, z1), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = qx + dx / d * r; p.z = qz + dz / d * r; return; }
      // centro adentro de la caja: sacarlo por el lado más cercano
      const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b);
      if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r;
    }
    // línea de visión libre de celdas sólidas (y cajas marcadas como 'opaque')
    los(ax, az, bx, bz) {
      const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (this.cell * 0.25));
      for (let i = 1; i < n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        if (this.solid && this.solid(Math.floor(x / this.cell), Math.floor(z / this.cell))) return false;
        for (const b of this.boxes) if (b.on && b.opaque && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
      }
      return true;
    }
  };

  // ================================================================== shaders comunes
  const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const POST_FS = `
    precision highp float;
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, fade, levels, vig, aber, grain, exposure, bloom, bloomThr, sat;
    uniform vec3 flash; uniform float flashA; uniform vec3 lift, gain; uniform vec2 shake;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float bayer4(vec2 p){
      vec2 q = mod(floor(p), 4.0);
      float i = q.x + q.y * 4.0;
      // matriz de Bayer 4x4 desplegada
      if (i < 1.0) return 0.0; if (i < 2.0) return 8.0; if (i < 3.0) return 2.0; if (i < 4.0) return 10.0;
      if (i < 5.0) return 12.0; if (i < 6.0) return 4.0; if (i < 7.0) return 14.0; if (i < 8.0) return 6.0;
      if (i < 9.0) return 3.0; if (i < 10.0) return 11.0; if (i < 11.0) return 1.0; if (i < 12.0) return 9.0;
      if (i < 13.0) return 15.0; if (i < 14.0) return 7.0; if (i < 15.0) return 13.0; return 5.0;
    }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 bright(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return max(c - bloomThr, 0.0); }
    void main(){
      vec2 px = 1.0 / res;
      vec2 uv = vUv + shake * px;
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = floor(d * aber * r2 * 4.0 + 0.5) * px;
      vec3 c;
      c.r = texture2D(tDiffuse, uv + off).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - off).b;
      // bloom barato: dos anillos de muestras sobre la imagen de baja resolución
      vec3 b = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.39;
        vec2 o = vec2(cos(a), sin(a));
        b += bright(uv + o * px * 2.0) * 0.6 + bright(uv + o * px * 5.0) * 0.35 + bright(uv + o * px * 10.0) * 0.2;
      }
      c += b * bloom / 8.0;
      c *= exposure;
      c = aces(c);
      c = pow(c, vec3(1.0 / 2.2));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, sat);
      c = lift + c * (gain - lift);
      c *= mix(1.0, smoothstep(0.75, 0.12, r2 * 1.6), vig);
      c += (hash(floor(vUv * res) + floor(time * 24.0)) - 0.5) * grain;
      c = mix(c, flash, flashA);
      c *= 1.0 - fade;
      float lv = levels - 1.0;
      c = floor(c * lv + bayer4(vUv * res) / 16.0) / lv;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  // partículas: polvo (0), luciérnagas (1), brasas que suben (2), lluvia de polvo/derrumbe (3)
  const PART_VS = `
    attribute vec4 aSeed;
    uniform float uTime, uSize, uMode, uSpeed, uPixel, uFar; uniform vec3 uCenter, uBox;
    varying float vA;
    void main(){
      vec3 p = position;
      float t = uTime * uSpeed;
      if (uMode < 0.5) {
        p += vec3(sin(t * 0.31 + aSeed.x * 6.28), sin(t * 0.23 + aSeed.y * 6.28) * 0.6 - t * 0.04 * aSeed.z, cos(t * 0.27 + aSeed.z * 6.28)) * 0.6;
        p = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
        vA = 0.25 + 0.75 * aSeed.w;
      } else if (uMode < 1.5) {
        p += vec3(sin(t * 0.7 + aSeed.x * 30.0), sin(t * 0.9 + aSeed.y * 20.0) * 0.5, cos(t * 0.6 + aSeed.z * 25.0)) * 1.2;
        vA = pow(max(0.0, sin(t * (0.8 + aSeed.w * 1.6) + aSeed.x * 40.0)), 3.0);
      } else if (uMode < 2.5) {
        float life = fract(t * (0.35 + aSeed.w * 0.5) + aSeed.x);
        p = uCenter + vec3((aSeed.y - 0.5) * uBox.x + sin(life * 7.0 + aSeed.z * 20.0) * 0.12 * life, life * uBox.y, (aSeed.z - 0.5) * uBox.z + cos(life * 5.0 + aSeed.y * 20.0) * 0.12 * life);
        vA = (1.0 - life) * step(0.15, aSeed.w + 0.2);
      } else {
        float life = fract(t * (0.6 + aSeed.w * 0.6) + aSeed.x);
        p = uCenter + vec3((aSeed.y - 0.5) * uBox.x, uBox.y * (1.0 - life * life), (aSeed.z - 0.5) * uBox.z);
        vA = 1.0 - life * 0.5;
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA *= smoothstep(uFar, uFar * 0.4, -mv.z) * smoothstep(0.05, 0.4, -mv.z);
      gl_PointSize = clamp(uSize * uPixel / -mv.z, 1.0, 3.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const PART_FS = `
    uniform vec3 uColor; uniform float uOpacity;
    varying float vA;
    void main(){ if (vA < 0.02) discard; gl_FragColor = vec4(uColor * vA * uOpacity, 1.0); }`;

  // llama pixelada procedural (cartel que siempre mira a cámara)
  const FLAME_VS = `
    uniform vec2 uScale; varying vec2 vUv;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uScale; gl_Position = projectionMatrix * mv; }`;
  const FLAME_FS = `
    uniform float uTime, uSeed, uBright, uGrid; uniform vec3 uCore, uMid, uEdge; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec2 grid = vec2(uGrid, uGrid * 1.5);
      vec2 g = (floor(vUv * grid) + 0.5) / grid;
      float t = uTime * 2.6 + uSeed * 17.0;
      float y = g.y, x = (g.x - 0.5) * 2.0;
      float w = 0.95 * pow(1.0 - y, 1.3) + 0.04;
      float nn = n(vec2(g.x * 5.0 + uSeed, y * 4.0 - t * 1.7)) - 0.5;
      float shape = 1.0 - abs(x + nn * 0.5 * y) / w - y * 0.25 + nn * 0.45 * y;
      if (shape < 0.0) discard;
      vec3 c = mix(uEdge, uMid, smoothstep(0.0, 0.35, shape));
      c = mix(c, uCore, smoothstep(0.45, 0.85, shape));
      gl_FragColor = vec4(c * uBright, 1.0);
    }`;

  // ================================================================== CSS del HUD
  function injectCSS() {
    if (document.getElementById('cs3d-css')) return;
    const st = document.createElement('style'); st.id = 'cs3d-css';
    st.textContent = `
    .cs3d-root { position: fixed; inset: 0; z-index: 9000; background: #000; overflow: hidden; font-family: 'Press Start 2P', ui-monospace, monospace; color: #f4f0d8; user-select: none; cursor: default; }
    .cs3d-root canvas.cs3d-gl { position: absolute; image-rendering: pixelated; image-rendering: crisp-edges; }
    .cs3d-root .t { text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; }
    .cs3d-hud { position: absolute; pointer-events: none; }
    .cs3d-obj { top: 16px; left: 16px; font-size: 11px; line-height: 1.8; max-width: 46vw; }
    .cs3d-obj b { color: #f0c030; font-weight: normal; }
    .cs3d-stat { top: 16px; right: 16px; font-size: 10px; line-height: 2; text-align: right; }
    .cs3d-prompt { bottom: 15%; left: 50%; transform: translateX(-50%); font-size: 12px; padding: 8px 12px; background: rgba(10,6,4,.72); border: 2px solid #f0c030; box-shadow: 4px 4px 0 #000; white-space: nowrap; display: none; }
    .cs3d-prompt b { color: #f0c030; font-weight: normal; }
    .cs3d-toast { top: 30%; left: 0; right: 0; text-align: center; font-size: clamp(12px, 2.2vw, 22px); color: #f0c030; line-height: 1.6; opacity: 0; transition: opacity .3s; padding: 0 16px; }
    .cs3d-title { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; opacity: 0; transition: opacity .8s; padding: 16px; }
    .cs3d-title h2 { margin: 0; font-size: clamp(18px, 4vw, 44px); color: #f0c030; font-weight: normal; text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000; line-height: 1.3; }
    .cs3d-title div { font-size: clamp(9px, 1.4vw, 13px); color: #e8dcc0; line-height: 1.8; max-width: 760px; }
    .cs3d-keys { bottom: 16px; right: 16px; font-size: 9px; line-height: 2.1; background: rgba(8,6,10,.78); border: 2px solid #6a5a40; box-shadow: 4px 4px 0 #000; padding: 10px 14px; transition: opacity .6s; }
    .cs3d-keys b { color: #f0c030; font-weight: normal; }
    .cs3d-dialog { left: 50%; bottom: 20px; transform: translateX(-50%); width: min(880px, calc(100vw - 32px)); background: rgba(12,8,6,.9); border: 3px solid #e8dcc0; box-shadow: 6px 6px 0 #000; padding: 14px 18px 16px; font-size: clamp(10px, 1.35vw, 13px); line-height: 1.9; display: none; pointer-events: auto; }
    .cs3d-dialog .who { color: #f0c030; margin-bottom: 6px; }
    .cs3d-dialog .more { position: absolute; right: 12px; bottom: 6px; color: #f0c030; animation: cs3dblink .8s steps(2) infinite; }
    .cs3d-dialog .opt { padding-left: 18px; position: relative; }
    .cs3d-dialog .opt.sel { color: #f0c030; }
    .cs3d-dialog .opt.sel:before { content: '▶'; position: absolute; left: 0; }
    .cs3d-confirm { inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.55); pointer-events: auto; }
    .cs3d-confirm > div { background: #120c08; border: 3px solid #f0c030; box-shadow: 6px 6px 0 #000; padding: 22px 26px; font-size: 12px; line-height: 2.2; text-align: center; }
    .cs3d-confirm b { color: #f0c030; font-weight: normal; }
    .cs3d-fps { left: 16px; bottom: 6px; font-size: 8px; opacity: .5; }
    @keyframes cs3dblink { 50% { opacity: 0; } }
    @media (max-width: 640px) { .cs3d-keys { font-size: 7px; } .cs3d-obj { font-size: 9px; } }
    `;
    document.head.appendChild(st);
  }

  // ================================================================== audio sintetizado (chico)
  function makeAudio() {
    let ac = null, master = null;
    try { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination); } catch (e) { ac = null; }
    let noiseBuf = null;
    const out = pan => {
      if (!pan || !ac.createStereoPanner) return master;
      const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p;
    };
    const nb = () => {
      if (noiseBuf) return noiseBuf;
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf;
    };
    const A = {
      ctx: ac,
      // o.pan: -1 (izquierda) .. 1 (derecha)
      tone(freq, dur, o = {}) {
        if (!ac) return; const t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain();
        osc.type = o.type || 'square'; osc.frequency.setValueAtTime(freq, t);
        if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(out(o.pan)); osc.start(t); osc.stop(t + dur + 0.02);
      },
      noise(dur, o = {}) {
        if (!ac) return; const t = ac.currentTime + (o.delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = nb(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t); f.Q.value = o.q || 0.7;
        if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out(o.pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
      },
      // silbido "fiu-fiuuu" (Pombero, gente): o.pan, o.vol, o.delay
      whistle(o = {}) {
        const d = o.delay || 0, v = o.vol || 0.06, p = o.pan;
        A.tone(1500, 0.16, { type: 'sine', vol: v, slide: 1.35, delay: d, pan: p });
        A.tone(1350, 0.42, { type: 'sine', vol: v, slide: 1.6, delay: d + 0.22, pan: p });
      },
      // ruido continuo filtrado (ambiente): devuelve {set(vol)}
      loop(o = {}) {
        if (!ac) return { set() {} };
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = nb(); s.loop = true; f.type = o.filter || 'lowpass'; f.frequency.value = o.freq || 400; f.Q.value = o.q || 0.5; g.gain.value = o.vol || 0.05;
        s.connect(f); f.connect(g); g.connect(master); s.start();
        return { set(v) { g.gain.setTargetAtTime(v, ac.currentTime, 0.2); }, filter: f };
      },
      close() { if (ac) try { ac.close(); } catch (e) {} },
    };
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return A;
  }

  // ================================================================== Stage: una escena abierta
  function createStage(def, opts, resolve) {
    injectCSS();
    const st = { opts, def, t: 0, dt: 0, done: false, paused: false, busy: 0, keys: {}, hits: {}, flickers: [], disposables: [], updaters: [] };
    const root = document.createElement('div'); root.className = 'cs3d-root'; document.body.appendChild(root);
    const canvas = document.createElement('canvas'); canvas.className = 'cs3d-gl'; root.appendChild(canvas);
    const el = (cls, parent, html) => { const e = document.createElement('div'); e.className = cls; if (html !== undefined) e.innerHTML = html; (parent || root).appendChild(e); return e; };
    st.root = root; st.el = el;
    const capture = !!window.__scenesCapture;
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
    renderer.outputEncoding = T.LinearEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    renderer.setPixelRatio(1);
    st.renderer = renderer;
    const scene = new T.Scene(); st.scene = scene;
    const camera = new T.PerspectiveCamera(def.fov || 60, 16 / 9, 0.05, 200); st.camera = camera; scene.add(camera);
    const isGL2 = renderer.capabilities.isWebGL2;
    const rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, type: isGL2 ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: true });
    const post = {
      tDiffuse: { value: rt.texture }, res: { value: new T.Vector2(4, 4) }, time: { value: 0 }, fade: { value: 1 }, levels: { value: 24 }, vig: { value: 0.75 },
      aber: { value: 2.0 }, grain: { value: 0.035 }, exposure: { value: 1.0 }, bloom: { value: 0.9 }, bloomThr: { value: 0.75 }, sat: { value: 1.05 },
      flash: { value: new T.Color(1, 1, 1) }, flashA: { value: 0 }, lift: { value: new T.Color(0.02, 0.01, 0.03) }, gain: { value: new T.Color(1, 0.98, 0.94) }, shake: { value: new T.Vector2() },
    };
    const postMat = new T.ShaderMaterial({ uniforms: post, vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false });
    const postScene = new T.Scene(), postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), postMat); quad.frustumCulled = false; postScene.add(quad);
    st.post = post;
    st.pixelScale = def.pixelScale || 0; // 0 = automático
    let W = 4, H = 4;
    st.partMats = [];
    function resize() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const s = st.pixelScale || Math.max(2, Math.round(vh / (def.lowH || 300)));
      W = Math.max(64, Math.floor(vw / s)); H = Math.max(48, Math.floor(vh / s));
      renderer.setSize(W, H, false);
      canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
      canvas.style.left = Math.floor((vw - W * s) / 2) + 'px'; canvas.style.top = Math.floor((vh - H * s) / 2) + 'px';
      rt.setSize(W, H); post.res.value.set(W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      const pxu = H / (2 * Math.tan(camera.fov * Math.PI / 360));
      for (const m of st.partMats) m.uniforms.uPixel.value = pxu;
      st.W = W; st.H = H; st.scale = s;
      if (st.onResize) st.onResize();
    }
    st.resize = resize;

    // ---------- HUD
    const hud = {
      obj: el('cs3d-hud cs3d-obj t'), stat: el('cs3d-hud cs3d-stat t'), prompt: el('cs3d-hud cs3d-prompt t'), toast: el('cs3d-hud cs3d-toast t'),
      keys: el('cs3d-hud cs3d-keys t'), title: el('cs3d-hud cs3d-title'), dialog: el('cs3d-hud cs3d-dialog t'), confirm: el('cs3d-hud cs3d-confirm t'),
      fps: el('cs3d-hud cs3d-fps t'),
    };
    hud.confirm.innerHTML = '<div>¿Abandonás la escena?<br><b>[S]</b> sí, salir &nbsp; <b>[N]</b> no, seguir</div>';
    st.hud = hud;
    st.objective = html => { hud.obj.innerHTML = html || ''; };
    st.status = html => { hud.stat.innerHTML = html || ''; };
    let promptTxt = null;
    st.prompt = txt => { if (txt === promptTxt) return; promptTxt = txt; hud.prompt.style.display = txt ? 'block' : 'none'; if (txt) hud.prompt.innerHTML = txt; };
    let toastT = 0;
    st.toast = (html, secs = 2.5, color) => { hud.toast.innerHTML = html; hud.toast.style.color = color || ''; hud.toast.style.opacity = 1; toastT = secs; };
    let keysT = 0;
    st.showKeys = (lines, secs = 9) => { if (lines) hud.keys.innerHTML = lines.map(l => l.replace(/\[([^\]]+)\]/g, '<b>$1</b>')).join('<br>') + '<br><b>H</b> ayuda · <b>ESC</b> salir'; hud.keys.style.opacity = 1; keysT = secs; };
    st.titleCard = (title, sub, secs = 3.2) => {
      hud.title.innerHTML = `<h2>${title}</h2>${sub ? `<div class="t">${sub}</div>` : ''}`; hud.title.style.opacity = 1;
      setTimeout(() => { if (hud.title) hud.title.style.opacity = 0; }, secs * 1000);
    };
    // diálogo con máquina de escribir; ENTER/ESPACIO avanza
    // si ya hay un diálogo abierto, el nuevo espera en la cola (no se pisan ni queda st.busy colgado)
    let dlg = null; const dlgQueue = [];
    function openDlg(d) { if (dlg) { dlgQueue.push(d); return; } dlg = d; hud.dialog.style.display = 'block'; renderDialog(); }
    st.say = (who, text, o = {}) => new Promise(res => {
      st.busy++;
      openDlg({ who, text: String(text), shown: 0, res, opts: o, choice: null });
    });
    st.talk = async (lines, who) => { for (const l of lines) { if (st.done) return; if (typeof l === 'string') await st.say(who || '', l); else await st.say(l.who || who || '', l.text); } };
    st.choose = (who, text, options) => new Promise(res => {
      st.busy++;
      openDlg({ who, text: String(text), shown: String(text).length, res, opts: {}, choice: { options, sel: 0 } });
    });
    function renderDialog() {
      if (!dlg) return;
      const txt = dlg.text.slice(0, Math.floor(dlg.shown)).replace(/\n/g, '<br>');
      let h = (dlg.who ? `<div class="who">${dlg.who}</div>` : '') + `<div>${txt}</div>`;
      if (dlg.choice) h += dlg.choice.options.map((o, i) => `<div class="opt ${i === dlg.choice.sel ? 'sel' : ''}">${o}</div>`).join('');
      else if (dlg.shown >= dlg.text.length) h += '<span class="more">▼</span>';
      hud.dialog.innerHTML = h;
    }
    function updateDialog(dt) {
      if (!dlg) return;
      if (dlg.choice) {
        const c = dlg.choice;
        if (st.hit('ArrowUp', 'KeyW')) { c.sel = (c.sel + c.options.length - 1) % c.options.length; renderDialog(); st.sfx.tone(660, 0.05, { vol: 0.05 }); }
        if (st.hit('ArrowDown', 'KeyS')) { c.sel = (c.sel + 1) % c.options.length; renderDialog(); st.sfx.tone(660, 0.05, { vol: 0.05 }); }
        for (let i = 0; i < Math.min(9, c.options.length); i++) if (st.hit('Digit' + (i + 1))) { c.sel = i; closeDialog(i); return; }
        if (st.hit('Enter', 'Space')) closeDialog(c.sel);
        return;
      }
      if (dlg.shown < dlg.text.length) {
        const before = Math.floor(dlg.shown);
        dlg.shown = Math.min(dlg.text.length, dlg.shown + dt * (dlg.opts.speed || 45));
        if (Math.floor(dlg.shown) !== before) { renderDialog(); if (before % 3 === 0 && dlg.text[before] !== ' ') st.sfx.tone(dlg.opts.pitch || 520 + Math.random() * 60, 0.03, { vol: 0.025, type: 'square' }); }
        if (st.hit('Enter', 'Space')) { dlg.shown = dlg.text.length; renderDialog(); }
      } else if (st.hit('Enter', 'Space')) closeDialog();
    }
    function closeDialog(v) {
      const d = dlg; dlg = null; st.busy--; hud.dialog.style.display = 'none'; st.sfx.tone(880, 0.04, { vol: 0.04 });
      st.hits.Enter = st.hits.Space = false; // la tecla que cierra no dispara también st.action()
      d.res(v);
      if (dlgQueue.length) openDlg(dlgQueue.shift());
    }
    st.dialogOpen = () => !!dlg;

    // ---------- entrada
    const GAMEKEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape', 'Tab']);
    let confirming = false;
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code)) return;
      e.stopImmediatePropagation();
      if (GAMEKEYS.has(e.code) || e.code.startsWith('Key') || e.code.startsWith('Digit')) e.preventDefault();
      if (e.type === 'keydown') {
        if (e.repeat) return;
        if (confirming) {
          if (e.code === 'KeyS' || e.code === 'KeyY' || e.code === 'Enter') { confirming = false; hud.confirm.style.display = 'none'; st.finish({ ok: false, data: { quit: true } }); }
          else if (e.code === 'KeyN' || e.code === 'Escape') { confirming = false; hud.confirm.style.display = 'none'; st.paused = false; }
          return;
        }
        if (e.code === 'Escape') { if (st.done) return; confirming = true; st.paused = true; hud.confirm.style.display = 'flex'; st.keys = {}; return; }
        if (e.code === 'KeyH' && !(def.noHelpKey)) { if (hud.keys.style.opacity === '1' && keysT > 0) keysT = 0; else st.showKeys(null, 30); }
        st.keys[e.code] = true; st.hits[e.code] = true;
      } else st.keys[e.code] = false;
    }
    const onBlur = () => { st.keys = {}; };
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);
    st.down = (...c) => c.some(k => st.keys[k]);
    st.hit = (...c) => c.some(k => st.hits[k]);
    st.axis = () => ({ x: (st.down('KeyD', 'ArrowRight') ? 1 : 0) - (st.down('KeyA', 'ArrowLeft') ? 1 : 0), y: (st.down('KeyW', 'ArrowUp') ? 1 : 0) - (st.down('KeyS', 'ArrowDown') ? 1 : 0) });
    st.action = () => !st.busy && st.hit('Space', 'Enter');

    st.sfx = makeAudio();

    // ---------- ayudas de escena
    st.track = o => { st.disposables.push(o); return o; };
    st.addFlicker = (light, base, seed, amp = 1) => { const f = { light, base, seed: seed === undefined ? Math.random() * 100 : seed, amp, on: true }; st.flickers.push(f); return f; };
    st.particles = (o = {}) => {
      const n = o.count || 200, r = U.rng(o.seed || 7), box = o.box || [10, 4, 10];
      const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), c = o.center || [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = c[0] + (r() - 0.5) * box[0]; pos[i * 3 + 1] = c[1] + (r() - 0.5) * box[1]; pos[i * 3 + 2] = c[2] + (r() - 0.5) * box[2];
        if (o.positions) { const p = o.positions(i, r); pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; }
        seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new T.BufferAttribute(seed, 4));
      const MODES = { dust: 0, fireflies: 1, embers: 2, fall: 3 };
      const m = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSize: { value: o.size || 0.03 }, uMode: { value: MODES[o.mode || 'dust'] }, uSpeed: { value: o.speed || 1 },
          uPixel: { value: 300 }, uFar: { value: o.far || 14 }, uCenter: { value: new T.Vector3(...c) }, uBox: { value: new T.Vector3(...box) },
          uColor: { value: U.C(o.color || 0xffe0b0).multiplyScalar(o.bright || 1) }, uOpacity: { value: o.opacity === undefined ? 1 : o.opacity } },
        vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      st.partMats.push(m);
      const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
      (o.parent || scene).add(pts);
      if (st.W) m.uniforms.uPixel.value = st.H / (2 * Math.tan(camera.fov * Math.PI / 360));
      return pts;
    };
    st.flame = (o = {}) => {
      const m = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSeed: { value: o.seed !== undefined ? o.seed : Math.random() * 10 }, uBright: { value: o.bright || 3.2 }, uGrid: { value: o.grid || 8 },
          uScale: { value: new T.Vector2(o.w || 0.18, o.h || 0.3) }, uCore: { value: U.C(o.core || 0xfff4c0) }, uMid: { value: U.C(o.mid || 0xffa020) }, uEdge: { value: U.C(o.edge || 0xd02808) } },
        vertexShader: FLAME_VS, fragmentShader: FLAME_FS, depthWrite: false, transparent: false,
      });
      const geo = new T.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
      const mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 4;
      mesh.userData.flame = true;
      return mesh;
    };
    // halo de luz (niebla iluminada falsa): disco aditivo en bandas, siempre de frente
    st.halo = (o = {}) => {
      const m = new T.ShaderMaterial({
        uniforms: { uColor: { value: U.C(o.color || 0xff9040).multiplyScalar(o.intensity || 0.5) }, uScale: { value: new T.Vector2(o.size || 1.5, o.size || 1.5) }, uBands: { value: o.bands || 5 } },
        vertexShader: FLAME_VS,
        fragmentShader: `uniform vec3 uColor; uniform float uBands; varying vec2 vUv;
          void main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2); a = floor(a * uBands + 0.5) / uBands; if (a <= 0.0) discard; gl_FragColor = vec4(uColor * a, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), m); mesh.frustumCulled = false; mesh.renderOrder = 6;
      return mesh;
    };
    // haz de luz volumétrico falso (god ray): cono abierto aditivo que se desvanece en los bordes y abajo
    st.lightShaft = (o = {}) => {
      const h = o.height || 6, geo = new T.CylinderGeometry(o.rTop || 0.5, o.rBottom || 1.2, h, o.seg || 10, 1, true);
      geo.translate(0, h / 2, 0);
      const m = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: U.C(o.color || 0xffe0a0).multiplyScalar(o.intensity || 0.35) }, uSeed: { value: o.seed || Math.random() * 10 } },
        vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `uniform vec3 uColor; uniform float uTime, uSeed; varying vec2 vUv; varying float vF;
          void main(){ float a = pow(vF, 2.5) * smoothstep(0.0, 0.3, vUv.y) * (0.3 + 0.7 * vUv.y);
            a *= 0.8 + 0.2 * sin(uTime * 0.9 + uSeed + vUv.y * 5.0) * sin(uTime * 0.53 + uSeed * 2.0 + vUv.x * 12.0);
            a = floor(a * 7.0 + 0.5) / 7.0; if (a <= 0.0) discard; gl_FragColor = vec4(uColor * a, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      });
      const mesh = new T.Mesh(geo, m); mesh.userData.flame = true; mesh.renderOrder = 7; mesh.frustumCulled = false;
      if (o.x !== undefined) mesh.position.set(o.x, o.y || 0, o.z);
      return mesh;
    };
    // ---- tercera persona: mueve o.obj (un U.person o un Group) relativo a la cámara y la sigue de atrás/arriba.
    // o: {obj, collider (U.Collider), radius, speed, run, dist, pitch, camYaw, lookH, bounds:[x0,z0,x1,z1]}. Q/E giran la cámara 45°.
    // Devuelve el controlador: llamá ctl.update(dt) en tu update. ctl.enabled=false lo frena; ctl.slow multiplica la velocidad.
    st.thirdPerson = (o = {}) => {
      const C = { obj: o.obj, speed: o.speed || 3.4, runK: o.run || 1.6, radius: o.radius || 0.32, collider: o.collider || null, bounds: o.bounds || null,
        camYaw: o.camYaw || 0, camYawT: o.camYaw || 0, dist: o.dist || 8, pitch: o.pitch || 0.95, lookH: o.lookH || 1.1, camDamp: o.camDamp || 7,
        vel: new T.Vector3(), moving: 0, enabled: true, face: o.face || 0, slow: 1, first: true, rotate: o.rotate !== false };
      const tgt = new T.Vector3(), camP = new T.Vector3();
      C.forward = () => new T.Vector3(-Math.sin(C.camYaw), 0, -Math.cos(C.camYaw));
      C.update = dt => {
        const p = C.obj.position;
        if (C.rotate && !st.busy) { if (st.hit('KeyQ')) C.camYawT += Math.PI / 4; if (st.hit('KeyE')) C.camYawT -= Math.PI / 4; }
        C.camYaw = U.damp(C.camYaw, C.camYawT, 7, dt);
        let ax = 0, az = 0;
        if (C.enabled && !st.busy) {
          const a = st.axis(), s = Math.sin(C.camYaw), c = Math.cos(C.camYaw);
          ax = c * a.x - s * a.y; az = -s * a.x - c * a.y;
        }
        const len = Math.hypot(ax, az); if (len > 1) { ax /= len; az /= len; }
        const sp = C.speed * (st.down('ShiftLeft', 'ShiftRight') ? C.runK : 1) * C.slow;
        C.vel.x = U.damp(C.vel.x, ax * sp, 12, dt); C.vel.z = U.damp(C.vel.z, az * sp, 12, dt);
        p.x += C.vel.x * dt; p.z += C.vel.z * dt;
        if (C.collider) C.collider.resolve(p, C.radius);
        if (C.bounds) { p.x = U.clamp(p.x, C.bounds[0], C.bounds[2]); p.z = U.clamp(p.z, C.bounds[1], C.bounds[3]); }
        C.moving = Math.hypot(C.vel.x, C.vel.z);
        if (len > 0.1) C.face = Math.atan2(ax, az);
        C.obj.rotation.y = U.dampAngle(C.obj.rotation.y, C.face, 12, dt);
        if (C.obj.userData.legL) U.animPerson(C.obj, C.moving, dt);
        tgt.set(p.x, p.y + C.lookH, p.z);
        const hd = C.dist * Math.cos(C.pitch), vd = C.dist * Math.sin(C.pitch);
        camP.set(tgt.x + Math.sin(C.camYaw) * hd, tgt.y + vd, tgt.z + Math.cos(C.camYaw) * hd);
        if (C.first) { camera.position.copy(camP); C.first = false; } else camera.position.lerp(camP, 1 - Math.exp(-C.camDamp * dt));
        camera.lookAt(tgt);
        st.seeTarget = tgt; // para st.seeThrough
      };
      return C;
    };
    // ---- ver a través: los fragmentos de este material que tapan a st.seeTarget se agujerean con tramado (dither)
    const seeU = { uSeeCam: { value: new T.Vector3() }, uSeeTgt: { value: new T.Vector3() }, uSeeOn: { value: 0 } };
    st.seeTarget = null;
    st.seeThrough = (mat, radius = 1.3) => {
      const R = radius.toFixed(2), R2 = (radius * 0.4).toFixed(2);
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, seeU);
        sh.vertexShader = 'varying vec3 vSeeWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vSeeWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform vec3 uSeeCam, uSeeTgt; uniform float uSeeOn; varying vec3 vSeeWP;\n' + sh.fragmentShader.replace('void main() {', `void main() {
          if (uSeeOn > 0.5) { vec3 ab = uSeeTgt - uSeeCam; float tt = dot(vSeeWP - uSeeCam, ab) / dot(ab, ab);
            if (tt > 0.0 && tt < 0.96) { float dd = length(vSeeWP - (uSeeCam + ab * tt)); float k = smoothstep(${R}, ${R2}, dd);
              vec2 q = mod(floor(gl_FragCoord.xy), 2.0); float th = fract((q.x * 2.0 + q.y * 3.0) / 4.0) + 0.125; if (k > th) discard; } }`);
      };
      mat.customProgramCacheKey = () => 'see' + R;
      mat.needsUpdate = true;
      return mat;
    };
    st.updaters.push(() => { if (st.seeTarget) { seeU.uSeeCam.value.copy(camera.position); seeU.uSeeTgt.value.copy(st.seeTarget); seeU.uSeeOn.value = 1; } else seeU.uSeeOn.value = 0; });
    // el interactuable más cercano dentro de su radio: items [{x, z, r, on?}] → item o null
    st.nearest = (items, x, z) => {
      let best = null, bd = 1e9;
      for (const it of items) { if (it.on === false) continue; const d = Math.hypot(it.x - x, it.z - z); if (d < (it.r || 1.4) && d < bd) { bd = d; best = it; } }
      return best;
    };
    st.shakeAmt = 0;
    st.shake = a => { st.shakeAmt = Math.max(st.shakeAmt, a); };
    st.flash = (hex, a = 0.6) => { post.flash.value.setHex(hex); post.flashA.value = a; };
    st.fadeTo = (v, secs = 0.6) => new Promise(res => { st._fade = { from: post.fade.value, to: v, t: 0, d: secs, res }; });

    // ---------- fin
    st.finish = result => {
      if (st.done) return; st.done = true;
      st.prompt(null);
      const r = Object.assign({ ok: false }, result);
      const end = () => { if (st._closed) return; st._closed = true; cleanup(); resolve(r); };
      if (r.ok && result.message !== false) {
        st.toast(result.message || '¡Listo!', 3);
      }
      st._fade = { from: post.fade.value, to: 1, t: 0, d: r.ok ? 1.4 : 0.6, res: () => setTimeout(end, r.ok ? 500 : 50) };
      st.paused = false; st._ending = true;
    };
    // termina ya, sin fundido (no depende de requestAnimationFrame): para depuración / pruebas de misiones
    st.finishNow = result => {
      if (st._closed) return; st._closed = true; st.done = true;
      const r = Object.assign({ ok: false }, result);
      cleanup(); resolve(r);
    };
    let raf = 0, last = performance.now(), fpsAcc = 0, fpsN = 0;
    function cleanup() {
      cancelAnimationFrame(raf); clearTimeout(rafTO); st._closed = true;
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      try { if (st.instance && st.instance.dispose) st.instance.dispose(); } catch (e) { console.warn(e); }
      const seen = new Set();
      const disp = o => { if (o && !seen.has(o) && o.dispose) { seen.add(o); try { o.dispose(); } catch (e) {} } };
      scene.traverse(o => {
        disp(o.geometry);
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of ms) { for (const k in m) if (m[k] && m[k].isTexture) disp(m[k]); if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) disp(v); } disp(m); }
        if (o.isLight && o.shadow && o.shadow.map) disp(o.shadow.map);
      });
      for (const o of st.disposables) disp(o);
      disp(rt); disp(postMat); disp(quad.geometry);
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      st.sfx.close();
      root.remove();
      current = null;
      if (window.Chipa && window.Chipa.closeModal) window.Chipa.closeModal();
    }
    // requestAnimationFrame con respaldo por setTimeout (con la pestaña/panel oculto no hay rAF y la escena se colgaba)
    let rafTO = 0, rafPending = false;
    function schedule() {
      rafPending = true;
      raf = requestAnimationFrame(t => { if (!rafPending) return; rafPending = false; clearTimeout(rafTO); frame(t); });
      rafTO = setTimeout(() => { if (!rafPending) return; rafPending = false; cancelAnimationFrame(raf); frame(performance.now()); }, 120);
    }
    function frame(now) {
      if (st._closed) return;
      schedule();
      const rdt = Math.min(0.05, (now - last) / 1000); last = now;
      fpsAcc += (now - (st._lastNow || now)); fpsN++; st._lastNow = now;
      if (fpsAcc > 500) { st.fps = Math.round(fpsN * 1000 / fpsAcc); fpsAcc = 0; fpsN = 0; hud.fps.textContent = window.__scenesShowFps ? st.fps + ' fps ' + W + 'x' + H : ''; window.__scenesFps = st.fps; }
      if (tick(rdt)) draw();
    }
    // depuración: avanzar n pasos y dibujar (sirve con la pestaña en segundo plano)
    st.debugStep = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt); draw(); };
    window.__scenesCur = st;
    function tick(rdt) {
      const dt = st.paused ? 0 : rdt;
      st.dt = dt; st.t += dt;
      try {
        if (!st.paused) {
          updateDialog(dt);
          if (st.instance && st.instance.update && !st._ending) st.instance.update(dt, st.t);
          else if (st.instance && st.instance.idle) st.instance.idle(dt, st.t);
        }
      } catch (e) { console.error('escena', def.id, e); st.finish({ ok: false, data: { error: String(e) } }); }
      st.hits = {};
      // efectos comunes
      if (toastT > 0) { toastT -= rdt; if (toastT <= 0) hud.toast.style.opacity = 0; }
      if (keysT > 0) { keysT -= rdt; if (keysT <= 0) hud.keys.style.opacity = 0; }
      for (const f of st.flickers) if (f.on) f.light.intensity = f.base * (1 + (U.flicker(st.t, f.seed) - 1) * f.amp);
      else f.light.intensity = 0;
      scene.traverse(o => { if (o.userData.flame && o.material.uniforms) o.material.uniforms.uTime.value = st.t; });
      for (const m of st.partMats) m.uniforms.uTime.value = st.t;
      for (const u of st.updaters) u(dt, st.t);
      if (st._fade) {
        const f = st._fade; f.t += rdt; const k = Math.min(1, f.t / f.d); post.fade.value = U.lerp(f.from, f.to, k);
        if (k >= 1) { st._fade = null; f.res && f.res(); }
      }
      post.flashA.value = Math.max(0, post.flashA.value - rdt * 2.2);
      st.shakeAmt = Math.max(0, st.shakeAmt - rdt * 3);
      post.shake.value.set(Math.round((Math.random() - 0.5) * st.shakeAmt * 6), Math.round((Math.random() - 0.5) * st.shakeAmt * 6));
      post.time.value = st.t;
      if (st.done && !st._fade) return false;
      return true;
    }
    function draw() {
      if (st.preRender) st.preRender();
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    }
    st.renderOnce = () => { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam); };

    // ---------- arranque
    resize();
    try {
      st.instance = def.create(st, opts || {}) || {};
    } catch (e) {
      console.error('escena', def.id, e);
      cleanup(); resolve({ ok: false, data: { error: String(e) } }); return st;
    }
    resize();
    st.fadeTo(0, 1.0);
    schedule();
    return st;
  }

  // ================================================================== carga y API
  const loading = {};
  function load(id) {
    if (DEFS[id]) return Promise.resolve(DEFS[id]);
    if (!LIST.some(s => s.id === id)) return Promise.reject(new Error('escena desconocida: ' + id));
    if (!loading[id]) loading[id] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = BASE + 'scenes/' + id + '.js';
      s.onload = () => DEFS[id] ? res(DEFS[id]) : rej(new Error('la escena no se registró: ' + id));
      s.onerror = () => { delete loading[id]; rej(new Error('no se pudo cargar scenes/' + id + '.js')); };
      document.head.appendChild(s);
    });
    return loading[id];
  }
  const API = {
    list: LIST,
    has(id) { return LIST.some(s => s.id === id); },
    // depuración: termina la escena abierta como ganada/perdida (resuelve la Promise y libera todo al instante)
    debugFinish(ok = true, data) {
      const st = current && current.finishNow ? current : null;
      if (!st) return false;
      st.finishNow({ ok: !!ok, score: ok ? 1 : 0, data: Object.assign({ debug: true }, data || {}) });
      return true;
    },
    get playing() { return current ? current.def.id : null; },
    preload(id) { return load(id).then(() => true, () => false); },
    play(id, opts) {
      if (current) return Promise.resolve({ ok: false, data: { error: 'ya hay una escena abierta' } });
      if (!T) return Promise.resolve({ ok: false, data: { error: 'sin THREE' } });
      const owner = { scene: id };
      current = owner;
      if (window.Chipa && window.Chipa.openModal) window.Chipa.openModal(owner);
      return load(id).then(def => new Promise(res => {
        def.id = id;
        const st = createStage(def, Object.assign({}, opts || {}), r => { res(r); });
        if (current === owner) current = st; else if (!current) { /* falló al crear */ }
      })).catch(err => {
        console.error(err); current = null;
        if (window.Chipa && window.Chipa.closeModal) window.Chipa.closeModal();
        return { ok: false, data: { error: String(err && err.message || err) } };
      });
    },
  };
  window.ChipaScenes = { register(id, def) { DEFS[id] = def; }, U, defs: DEFS, api: API };
  const attach = () => { if (window.Chipa) window.Chipa.scenes = API; };
  attach(); window.addEventListener('chipa-ready', attach);
})();
