// CHIPA CITY — motor 3D (Three.js): cámara cenital con perspectiva, como los clásicos de los 90.
// La lógica del juego vive en game.js (todo en 2D); este archivo solo dibuja.
'use strict';
window.createRender3D = function (G) {
  const T = window.THREE;
  if (!T) return null;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: G.canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) { console.warn('WebGL no disponible, sigo en 2D', e); return null; }
  renderer.setClearColor(0x2a5aa8, 1);
  renderer.outputEncoding = T.LinearEncoding;
  const scene = new T.Scene();
  const FOV = 32, TAN = Math.tan(FOV / 2 * Math.PI / 180);
  const camera = new T.PerspectiveCamera(FOV, 1, 4, 9000);
  camera.up.set(0, 1, 0);
  const { TS, CPX, FLOOR } = G, TT = G.T;
  const KEY = (cx, cy) => cy * 4096 + cx;
  const nearest = t => { t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t; };
  const unitPlane = new T.PlaneGeometry(1, 1);
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  let frame = 0;

  // ------------------------------------------------------------ texturas pixel art (blancas: se tiñen por vértice)
  function cv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; }
  const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const lcg = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
  function win(g, x, y, w, h, reja) {
    R(g, '#5a5a62', x - 1, y - 1, w + 2, h + 2); R(g, '#34465e', x, y, w, h);
    R(g, '#7a92b0', x, y, 2, 1); R(g, '#7a92b0', x, y, 1, 2);
    if (reja) for (let i = x + 1; i < x + w; i += 2) R(g, '#e6e6e6', i, y, 1, h);
  }
  // cada textura = un piso de alto (12 px = 3 m) y varios módulos de 16 px (3 m) de ancho
  const FAC = {
    casa: { w: 64, c: cv(64, 12, g => {
      R(g, '#fff', 0, 0, 64, 12); R(g, '#dcdcdc', 0, 0, 64, 1); R(g, '#9c9c9c', 0, 10, 64, 2);
      for (let m = 0; m < 4; m++) {
        const x = m * 16;
        if (m === 1) { R(g, '#5a3a20', x + 4, 2, 8, 10); R(g, '#8a5a34', x + 5, 3, 6, 9); R(g, '#e0c060', x + 9, 7, 1, 1); }
        else { win(g, x + 3, 3, 10, 6, true); R(g, '#c8c8c8', x + 2, 9, 12, 1); }
      }
    }) },
    comercio: { w: 64, c: cv(64, 12, g => {
      R(g, '#fff', 0, 0, 64, 12);
      R(g, '#d83838', 0, 0, 32, 3); R(g, '#2a6ad8', 32, 0, 32, 3);
      for (let x = 3; x < 30; x += 4) R(g, '#fff', x, 1, 2, 1);
      for (let x = 35; x < 62; x += 3) R(g, '#ffe080', x, 1, 2, 1);
      R(g, '#444', 1, 4, 30, 8); R(g, '#3a5a7a', 2, 5, 28, 7); R(g, '#6a8aaa', 3, 5, 6, 1); R(g, '#2a3a4a', 13, 6, 6, 6);
      R(g, '#6e6e6e', 33, 4, 30, 8); for (let y = 5; y < 12; y += 2) R(g, '#a8a8a8', 34, y, 28, 1);
    }) },
    depto: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12);
      win(g, 2, 2, 12, 6, false); R(g, '#e8e8e8', 1, 7, 14, 1);
      for (let x = 1; x < 15; x += 2) R(g, '#cfcfcf', x, 8, 1, 3);
      R(g, '#a8a8a8', 0, 11, 16, 1);
      win(g, 18, 2, 11, 7, false); R(g, '#c8c8cc', 24, 9, 5, 2); R(g, '#8a8a90', 25, 9, 1, 2);
    }) },
    casa2: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12); R(g, '#dcdcdc', 0, 0, 32, 1);
      win(g, 5, 3, 7, 6, false); R(g, '#8a7058', 3, 3, 2, 6); R(g, '#8a7058', 12, 3, 2, 6);
      win(g, 21, 4, 5, 4, false);
    }) },
    trasera: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12); win(g, 5, 3, 6, 4, true); R(g, '#9a9a9a', 24, 0, 1, 12); R(g, '#d8d8d8', 0, 11, 32, 1);
    }) },
    medianera: { w: 32, c: cv(32, 12, g => {
      R(g, '#ececec', 0, 0, 32, 12); const r = lcg(7);
      for (let i = 0; i < 40; i++) R(g, r() < 0.5 ? '#d6d6d6' : '#f8f8f8', Math.floor(r() * 32), Math.floor(r() * 12), 1 + Math.floor(r() * 2), 1);
      R(g, '#d0d0d0', 9, 0, 1, 12);
    }) },
  };
  const ROOFTEX = {
    chapa: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); for (let x = 1; x < 16; x += 2) R(g, '#c4c4c4', x, 0, 1, 16); }),
    teja: cv(16, 16, g => {
      R(g, '#fff', 0, 0, 16, 16);
      for (let y = 3; y < 16; y += 4) { R(g, '#a4a4a4', 0, y, 16, 1); R(g, '#f6f6f6', 0, y - 3, 16, 1); }
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 2; x < 16; x += 4) R(g, '#c8c8c8', x, y + 1, 1, 2);
    }),
    losa: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); const r = lcg(3); for (let i = 0; i < 30; i++) R(g, r() < 0.6 ? '#d6d6d6' : '#ececec', Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); }),
    membrana: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); R(g, '#e0e0e0', 15, 0, 1, 16); R(g, '#f0f0f0', 0, 8, 16, 1); }),
  };
  const DECK = cv(64, 32, g => {
    R(g, '#76767c', 0, 0, 64, 32); const r = lcg(11);
    for (let i = 0; i < 120; i++) R(g, r() < 0.5 ? '#828288' : '#6a6a70', Math.floor(r() * 64), Math.floor(r() * 32), 1, 1);
    R(g, '#e8e8e8', 4, 0, 1, 32); R(g, '#e8e8e8', 59, 0, 1, 32);
    R(g, '#e0c040', 31, 0, 2, 14);
  });
  const rep = c => { const t = nearest(new T.CanvasTexture(c)); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const mats = {};
  const facMat = k => mats[k] || (mats[k] = new T.MeshBasicMaterial({ map: rep(FAC[k].c), vertexColors: true, side: T.DoubleSide }));
  const roofMat = k => mats['r_' + k] || (mats['r_' + k] = new T.MeshBasicMaterial({ map: rep(ROOFTEX[k]), vertexColors: true, side: T.DoubleSide }));
  const plainMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
  const deckMat = new T.MeshBasicMaterial({ map: rep(DECK), side: T.DoubleSide });
  const lineMat = new T.LineBasicMaterial({ vertexColors: true });
  const groundShadowMat = new T.MeshBasicMaterial({ color: 0x0a0018, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide });

  // ------------------------------------------------------------ geometría
  const Geo = () => ({ pos: [], uv: [], col: [] });
  function pv(g, x, y, z, u, v, c) { g.pos.push(x, -y, z); g.uv.push(u, v); g.col.push(c[0], c[1], c[2]); }
  function quad(g, ax, ay, bx, by, z0, z1, u0, u1, v0, v1, c) {
    pv(g, ax, ay, z0, u0, v0, c); pv(g, bx, by, z0, u1, v0, c); pv(g, bx, by, z1, u1, v1, c);
    pv(g, ax, ay, z0, u0, v0, c); pv(g, bx, by, z1, u1, v1, c); pv(g, ax, ay, z1, u0, v1, c);
  }
  // quad general por 4 esquinas 3D (para tableros y techos inclinados)
  function quad4(g, a, b, c, d, col, uv) {
    const U = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    pv(g, a[0], a[1], a[2], U[0][0], U[0][1], col); pv(g, b[0], b[1], b[2], U[1][0], U[1][1], col); pv(g, c[0], c[1], c[2], U[2][0], U[2][1], col);
    pv(g, a[0], a[1], a[2], U[0][0], U[0][1], col); pv(g, c[0], c[1], c[2], U[2][0], U[2][1], col); pv(g, d[0], d[1], d[2], U[3][0], U[3][1], col);
  }
  // caja orientada: centro (cx,cy), eje (ux,uy), medio largo hl, medio ancho hw
  function obox(g, cx, cy, ux, uy, hl, hw, z0, z1, top, side) {
    const vx = -uy, vy = ux;
    const C = [[cx - ux * hl - vx * hw, cy - uy * hl - vy * hw], [cx + ux * hl - vx * hw, cy + uy * hl - vy * hw],
               [cx + ux * hl + vx * hw, cy + uy * hl + vy * hw], [cx - ux * hl + vx * hw, cy - uy * hl + vy * hw]];
    const shades = [1, 0.82, 0.66, 0.9];
    for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i])); }
    quad4(g, [C[0][0], C[0][1], z1], [C[1][0], C[1][1], z1], [C[2][0], C[2][1], z1], [C[3][0], C[3][1], z1], top);
  }
  const box = (g, x, y, z, w, d, h, top, side) => obox(g, x + w / 2, y + d / 2, 1, 0, w / 2, d / 2, z, z + h, top, side);
  function toMesh(g, mat) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
    geo.computeBoundingSphere();
    const m = new T.Mesh(geo, mat); m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  }
  function toLines(l) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(l.pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(l.col, 3));
    geo.computeBoundingSphere();
    const m = new T.LineSegments(geo, lineMat); m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  }

  // ------------------------------------------------------------ edificios
  const PAINT_CASA = ['#f2efe6', '#efe2c4', '#e8d3a8', '#f0c8a8', '#d8e6ee', '#d4e8cc', '#f2d0d0', '#e6e0f0', '#d8c8a8', '#e0e0e0', '#f4e4a0', '#c8dcd0'].map(rgb);
  const PAINT_DEPTO = ['#e8e4dc', '#d8d4cc', '#c8c4bc', '#e0d4c0', '#bcc4cc', '#d0c8c0', '#e4dcd0'].map(rgb);
  const PAINT_MED = ['#c8c2b8', '#b8b2a8', '#d4c8b8', '#c4a088'].map(rgb);
  const BCENT = new Map();
  for (const bd of G.BLD) {
    const k = KEY(Math.floor((bd.minx + bd.maxx) / 2 / CPX), Math.floor((bd.miny + bd.maxy) / 2 / CPX));
    let l = BCENT.get(k); if (!l) BCENT.set(k, l = []); l.push(bd);
  }
  // ------------------------------------------------------------ edificios emblemáticos (fichas en landmarks.js)
  const LM = window.LANDMARKS || {};
  const MPX = FLOOR / 3; // píxeles por metro en altura (los pisos de 3 m miden FLOOR px)
  function lmFacade(spec) { // un "piso" de fachada, 48 px de ancho (≈9 m), 24 px de alto
    return cv(48, 24, g => {
      const W2 = spec.wall, Tr = spec.trim, glass = '#3a4a62', dark = '#2a3446';
      R(g, W2, 0, 0, 48, 24);
      if (spec.style === 'lamas') { // lamas verticales grises con paños de vidrio (IOSCor)
        R(g, '#2e4a6a', 16, 0, 16, 24); R(g, '#5a7a9a', 16, 0, 16, 1); for (let x = 16; x < 32; x += 4) R(g, '#4a6a8a', x, 0, 1, 24);
        for (let x = 0; x < 48; x += 2) if (x < 16 || x >= 32) { R(g, Tr, x, 0, 1, 24); R(g, '#00000030', x + 1, 0, 1, 24); }
        R(g, '#00000020', 0, 23, 48, 1);
        return;
      }
      if (spec.style === 'canopy') { // techo de estación de servicio: blanco con franja de color
        R(g, '#f4f4f0', 0, 0, 48, 24); R(g, Tr, 0, 9, 48, 5); R(g, '#f0a020', 0, 7, 48, 2); R(g, '#00000018', 0, 22, 48, 2);
        return;
      }
      if (spec.style === 'balcones') { // torres: vidrio con losas y barandas blancas en cada piso
        for (let x = 0; x < 48; x += 8) R(g, '#ffffff30', x, 0, 1, 20);
        R(g, '#ffffff22', 0, 2, 48, 1);
        R(g, Tr, 0, 19, 48, 5); R(g, '#00000026', 0, 23, 48, 1);
        for (let x = 2; x < 48; x += 4) R(g, '#00000018', x, 20, 1, 3);
        return;
      }
      if (spec.style === 'castillo') { // ladrillo con fajas claras y ventanitas enrejadas (la vieja cárcel)
        for (let y = 0; y < 24; y += 3) { R(g, '#00000020', 0, y, 48, 1); for (let x = (y / 3 % 2) * 3; x < 48; x += 6) R(g, '#00000016', x, y, 1, 3); }
        R(g, Tr, 0, 0, 48, 3); R(g, Tr, 0, 20, 48, 2);
        for (let x = 0; x < 48; x += 4) R(g, '#00000030', x, 3, 2, 1);
        for (let x = 6; x < 48; x += 12) { R(g, Tr, x - 1, 8, 5, 9); R(g, '#2a2420', x, 9, 3, 7); R(g, Tr, x, 8, 3, 1); R(g, '#8a8070', x + 1, 9, 1, 7); }
        return;
      }
      if (spec.style === 'perforado') { // blanco con ranuras chicas (el CIT de La Unidad)
        const r = lcg(19);
        for (let i = 0; i < 26; i++) R(g, '#3a3e48', Math.floor(r() * 46), Math.floor(r() * 21), 1, 3);
        R(g, '#00000012', 0, 23, 48, 1);
        return;
      }
      if (spec.style === 'casita') { // casa blanca de barrio: ventana con persianas de madera y otra con rejas
        R(g, '#d8d4cc', 0, 21, 48, 3); R(g, '#00000010', 0, 0, 48, 1);
        R(g, '#e8e4dc', 5, 6, 14, 12); R(g, '#7a6048', 6, 7, 12, 10);
        for (let y = 8; y < 17; y += 2) R(g, '#5a4434', 6, y, 12, 1);
        R(g, '#4a382a', 11, 7, 1, 10); R(g, '#c8c4bc', 5, 17, 14, 1);
        R(g, '#e8e4dc', 29, 7, 11, 10); R(g, '#34465e', 30, 8, 9, 8);
        for (let x = 31; x < 39; x += 2) R(g, '#d8d8d8', x, 8, 1, 8);
        R(g, '#00000014', 22, 2, 2, 19);
        return;
      }
      if (spec.style === 'ladrillo') { // ladrillo visto con marcos claros
        for (let y = 0; y < 24; y += 3) { R(g, '#00000022', 0, y, 48, 1); for (let x = (y / 3 % 2) * 3; x < 48; x += 6) R(g, '#00000018', x, y, 1, 3); }
        R(g, Tr, 0, 0, 48, 2);
        for (let x = 4; x < 48; x += 16) { R(g, Tr, x - 2, 5, 12, 14); R(g, glass, x, 7, 8, 10); R(g, Tr, x + 3, 7, 2, 10); R(g, Tr, x - 3, 18, 14, 2); }
        return;
      }
      if (spec.style === 'moderno') { // ventanas corridas horizontales
        R(g, Tr, 0, 0, 48, 2);
        R(g, '#2c3a50', 0, 7, 48, 9); R(g, '#5a7898', 0, 7, 48, 1);
        for (let x = 0; x < 48; x += 8) R(g, Tr, x, 7, 1, 9);
        R(g, Tr, 0, 16, 48, 2);
        return;
      }
      if (spec.style === 'vidrio') { // muro cortina
        R(g, '#3a5878', 0, 0, 48, 24);
        for (let x = 0; x < 48; x += 6) R(g, '#7aa0c0', x, 0, 1, 24);
        R(g, '#a8c4dc', 0, 0, 48, 1); R(g, '#24364c', 0, 20, 48, 4); R(g, '#7aa0c0', 3, 3, 2, 2); R(g, '#7aa0c0', 27, 9, 2, 2);
        return;
      }
      if (spec.style === 'paneles') { // paneles de hormigón y ventanas chicas
        for (let x = 0; x < 48; x += 12) { R(g, x % 24 ? '#00000014' : '#ffffff18', x, 0, 12, 24); R(g, '#00000030', x, 0, 1, 24); }
        R(g, '#00000030', 0, 12, 48, 1);
        for (let x = 3; x < 48; x += 12) R(g, glass, x, 15, 6, 5);
        return;
      }
      if (spec.style === 'colonial') { // paredes blancas, ventanas con dintel de ladrillo
        R(g, '#9a948c', 0, 21, 48, 3);
        for (let x = 5; x < 48; x += 16) { R(g, Tr, x - 2, 4, 10, 2); R(g, glass, x, 7, 6, 9); R(g, '#e0e0e0', x + 2, 7, 1, 9); R(g, '#e0e0e0', x, 11, 6, 1); }
        return;
      }
      if (spec.style === 'escuela') {
        R(g, Tr, 0, 0, 48, 2); R(g, Tr, 0, 21, 48, 1);
        for (let x = 4; x < 48; x += 12) { R(g, Tr, x - 1, 5, 8, 13); R(g, glass, x, 6, 6, 11); R(g, Tr, x + 2, 6, 1, 11); R(g, Tr, x, 11, 6, 1); }
        return;
      }
      // pilastras y cornisa
      for (let x = 0; x < 48; x += 16) R(g, Tr, x, 0, 2, 24);
      R(g, Tr, 0, 0, 48, 3); R(g, Tr, 0, 22, 48, 2);
      for (let x = 0; x < 48; x += 4) R(g, '#00000018', x, 3, 2, 1);
      if (spec.style === 'iglesia') { // ventanales altos en arco
        for (let x = 6; x < 48; x += 16) {
          R(g, Tr, x - 1, 6, 6, 15); R(g, dark, x, 8, 4, 12); R(g, dark, x + 1, 7, 2, 1); R(g, '#5a7090', x, 8, 1, 3);
        }
      } else if (spec.style === 'teatro') { // ventanas con balconcito
        for (let x = 5; x < 48; x += 16) {
          R(g, Tr, x - 1, 4, 8, 13); R(g, glass, x, 6, 6, 9); R(g, Tr, x + 2, 6, 1, 9);
          R(g, Tr, x - 2, 15, 10, 1); for (let k = x - 2; k < x + 8; k += 2) R(g, Tr, k, 16, 1, 3); R(g, Tr, x - 2, 19, 10, 1);
        }
      } else { // clasico: ventanas en arco con marco
        for (let x = 5; x < 48; x += 16) {
          R(g, Tr, x - 1, 5, 8, 15); R(g, glass, x, 7, 6, 12); R(g, glass, x + 1, 6, 4, 1); R(g, Tr, x + 2, 7, 1, 12); R(g, '#6a82a2', x, 7, 1, 3);
        }
      }
    });
  }
  const lmMats = {};
  const lmMat = name => lmMats[name] || (lmMats[name] = new T.MeshBasicMaterial({ map: rep(lmFacade(LM[name])), vertexColors: true, side: T.DoubleSide }));
  function obbOf(bd) { // rectángulo orientado mínimo que contiene al edificio
    const p = bd.pts, n = bd.n; let best = null;
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const dx = p[2 * k] - p[2 * j], dy = p[2 * k + 1] - p[2 * j + 1], l = Math.hypot(dx, dy); if (l < 1) continue;
      const ux = dx / l, uy = dy / l, vx = -uy, vy = ux;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < n; i++) { const a = p[2 * i] * ux + p[2 * i + 1] * uy, b = p[2 * i] * vx + p[2 * i + 1] * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      const area = (a1 - a0) * (b1 - b0);
      if (!best || area < best.area) {
        const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
        best = { area, cx: ux * ca + vx * cb, cy: uy * ca + vy * cb, ax: ux, ay: uy, bx: vx, by: vy, la: (a1 - a0) / 2, lb: (b1 - b0) / 2 };
      }
    }
    if (best.lb > best.la) best = { ...best, ax: best.bx, ay: best.by, bx: -best.ax, by: -best.ay, la: best.lb, lb: best.la };
    return best;
  }
  const tri3 = (g, a, b, c, col) => { pv(g, a[0], a[1], a[2], 0, 0, col); pv(g, b[0], b[1], b[2], 0, 0, col); pv(g, c[0], c[1], c[2], 0, 0, col); };
  function pyramid(g, cx, cy, ux, uy, hw, z0, z1, col) {
    const vx = -uy, vy = ux, C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + ux * a * hw + vx * b * hw, cy + uy * a * hw + vy * b * hw, z0]);
    const top = [cx, cy, z1], sh = [1, 0.8, 0.62, 0.9];
    for (let i = 0; i < 4; i++) tri3(g, C[i], C[(i + 1) % 4], top, mul(col, sh[i]));
  }
  function dome(g, cx, cy, ux, uy, r, z0, h, col) { // cúpula escalonada (se ve bien en pixel art)
    for (let k = 0; k < 5; k++) {
      const rr = Math.max(1, r * Math.cos(k / 5 * Math.PI / 2));
      obox(g, cx, cy, ux, uy, rr, rr, z0 + h * k / 5, z0 + h * (k + 1) / 5, mul(col, 1.05), mul(col, 0.85));
    }
    obox(g, cx, cy, ux, uy, 1, 1, z0 + h, z0 + h + 6, [0.85, 0.85, 0.8], [0.6, 0.6, 0.58]); // linterna y cruz
  }
  const STREETISH = t => !(t === TT.BLOCK || t === TT.OSMB || t === TT.YARD);
  function buildLandmark(bd, name, getG, lines) {
    const spec = LM[name], p = bd.pts, n = bd.n, h = spec.height * MPX, st = spec.storey * MPX;
    const wall = rgb(spec.wall), trim = rgb(spec.trim), rc = rgb(spec.roof.color), fac = getG('lm_' + name);
    const o = obbOf(bd), plain = getG('plain'), z0 = (spec.base || 0) * MPX;
    // techo inclinado a lo largo del eje largo (la torre "vela"): alto en el extremo sur, más bajo en el otro
    const sgnA = (o.ay > 0.05 || (Math.abs(o.ay) <= 0.05 && o.ax > 0)) ? 1 : -1;
    let zTop = spec.slopeTop ? (x, y) => h * (spec.slopeTop + (1 - spec.slopeTop) * ((((x - o.cx) * o.ax + (y - o.cy) * o.ay) * sgnA / o.la) + 1) / 2) : () => h;
    // tribuna: la pendiente baja hacia la cancha más cercana (f = 0 junto al campo, 1 en la pared de atrás)
    let trib = null;
    if (spec.tribuna) {
      let pc = [o.cx, o.cy], bestD = Infinity;
      for (const q of G.PROPS.pitches || []) {
        const x = ((q[0] + q[2] + q[4] + q[6]) / 4 + 0.5) * TS, y = ((q[1] + q[3] + q[5] + q[7]) / 4 + 0.5) * TS, d = Math.hypot(x - o.cx, y - o.cy);
        if (d < bestD) { bestD = d; pc = [x, y]; }
      }
      const dx = pc[0] - o.cx, dy = pc[1] - o.cy, da = dx * o.ax + dy * o.ay, db = dx * o.bx + dy * o.by, useA = Math.abs(da) > Math.abs(db);
      trib = { ux: useA ? o.ax : o.bx, uy: useA ? o.ay : o.by, L: useA ? o.la : o.lb, sg: Math.sign(useA ? da : db) || 1,
               vx: useA ? o.bx : o.ax, vy: useA ? o.by : o.ay, M: useA ? o.lb : o.la };
      const low = spec.tribuna.low ?? 0.15;
      trib.f = (x, y) => Math.min(1, Math.max(0, (1 - ((x - o.cx) * trib.ux + (y - o.cy) * trib.uy) * trib.sg / trib.L) / 2));
      trib.at = (f, m) => [o.cx + trib.ux * trib.sg * trib.L * (1 - 2 * f) + trib.vx * m, o.cy + trib.uy * trib.sg * trib.L * (1 - 2 * f) + trib.vy * m];
      trib.z = f => h * (low + (1 - low) * f);
      zTop = (x, y) => trib.z(trib.f(x, y));
    }
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
      const nxo = (by - ay) / len * bd.sign, nyo = -(bx - ax) / len * bd.sign;
      const light = 0.74 + 0.26 * Math.max(0, -(nxo * 0.6 + nyo * 0.8)), za = zTop(ax, ay), zb = zTop(bx, by);
      quad4(fac, [ax, ay, z0], [bx, by, z0], [bx, by, zb], [ax, ay, za], [light, light, light], [[0, 0], [len / 48, 0], [len / 48, (zb - z0) / st], [0, (za - z0) / st]]);
      if (z0 > 0) quad4(plain, [ax, ay, z0], [bx, by, z0], [bx, by, z0 + 1], [ax, ay, z0 + 1], mul(wall, 0.5)); // canto inferior
    }
    if (spec.roof.shape === 'gable') { // techo a dos aguas sobre el rectángulo, con el triángulo del frente
      const rh = Math.min(o.lb * 0.7, 22), C = (sa, sb, z) => [o.cx + o.ax * o.la * sa + o.bx * o.lb * sb, o.cy + o.ay * o.la * sa + o.by * o.lb * sb, z];
      const R0 = [o.cx - o.ax * o.la, o.cy - o.ay * o.la, h + rh], R1 = [o.cx + o.ax * o.la, o.cy + o.ay * o.la, h + rh];
      quad4(plain, C(-1, -1, h), C(1, -1, h), R1, R0, mul(rc, 0.95));
      quad4(plain, C(1, 1, h), C(-1, 1, h), R0, R1, mul(rc, 0.72));
      tri3(plain, C(-1, -1, h), C(-1, 1, h), R0, mul(trim, 0.9));
      tri3(plain, C(1, 1, h), C(1, -1, h), R1, mul(trim, 0.8));
      const oc = mul(rc, 0.5); lines.pos.push(R0[0], -R0[1], R0[2] + 0.3, R1[0], -R1[1], R1[2] + 0.3); lines.col.push(...oc, ...oc);
    } else if (spec.roof.shape === 'hip') { // cuatro aguas (tejas, pizarra)
      const rh = Math.min(o.lb * 0.75, spec.roof.rise || 22), r0 = Math.max(0, o.la - o.lb);
      const C = (sa, sb) => [o.cx + o.ax * o.la * sa + o.bx * o.lb * sb, o.cy + o.ay * o.la * sa + o.by * o.lb * sb, h];
      const R0 = [o.cx - o.ax * r0, o.cy - o.ay * r0, h + rh], R1 = [o.cx + o.ax * r0, o.cy + o.ay * r0, h + rh];
      quad4(plain, C(-1, -1), C(1, -1), R1, R0, mul(rc, 0.95));
      quad4(plain, C(1, 1), C(-1, 1), R0, R1, mul(rc, 0.7));
      tri3(plain, C(-1, 1), C(-1, -1), R0, mul(rc, 0.84));
      tri3(plain, C(1, -1), C(1, 1), R1, mul(rc, 0.62));
      const oc = mul(rc, 0.5);
      for (const [a, b] of [[R0, R1], [C(-1, -1), R0], [C(-1, 1), R0], [C(1, -1), R1], [C(1, 1), R1]]) { lines.pos.push(a[0], -a[1], a[2] + 0.3, b[0], -b[1], b[2] + 0.3); lines.col.push(...oc, ...oc); }
    } else if (spec.roof.shape === 'vault') { // bóveda de chapa (estadios, mercados)
      const rv = Math.min(o.lb * 0.8, spec.roof.rise || 30), N = 8, P = [];
      for (let k = 0; k <= N; k++) { const t = Math.PI * k / N; P.push([-Math.cos(t) * o.lb, h + Math.sin(t) * rv]); }
      for (let k = 0; k < N; k++) {
        const [b0, z0] = P[k], [b1, z1] = P[k + 1], sh = 0.7 + 0.3 * Math.max(0, Math.cos(Math.PI * (k + 0.5) / N) * -1 + 0.5);
        const A = s2 => [o.cx + o.ax * o.la * s2 + o.bx * b0, o.cy + o.ay * o.la * s2 + o.by * b0, z0];
        const B = s2 => [o.cx + o.ax * o.la * s2 + o.bx * b1, o.cy + o.ay * o.la * s2 + o.by * b1, z1];
        quad4(plain, A(-1), A(1), B(1), B(-1), mul(rc, Math.min(1.05, sh)));
        for (const s2 of [-1, 1]) tri3(plain, [o.cx + o.ax * o.la * s2, o.cy + o.ay * o.la * s2, h], A(s2), B(s2), mul(trim, s2 > 0 ? 0.8 : 0.95));
        if (k % 2 === 0) { const oc = mul(rc, 0.6), a = A(-1), b = A(1); lines.pos.push(a[0], -a[1], a[2] + 0.3, b[0], -b[1], b[2] + 0.3); lines.col.push(...oc, ...oc); }
      }
    } else { // techo plano con balaustrada
      const contour = []; for (let k = 0; k < n; k++) contour.push(new T.Vector2(p[2 * k], p[2 * k + 1]));
      let faces = []; try { faces = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { /* forma rara */ }
      for (const f of faces) for (const i of f) pv(plain, p[2 * i], p[2 * i + 1], zTop(p[2 * i], p[2 * i + 1]), 0, 0, rc);
      if (spec.parapet && !spec.slopeTop) {
        const pc = rgb(spec.parapet);
        for (let k = 0, j = n - 1; k < n; j = k++) { // balaustrada con grosor: desde arriba se lee como un borde claro
          const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], l = Math.hypot(bx - ax, by - ay); if (l < 1) continue;
          const ux = (bx - ax) / l, uy = (by - ay) / l, nxo = uy * bd.sign, nyo = -ux * bd.sign;
          obox(plain, (ax + bx) / 2 - nxo * 2, (ay + by) / 2 - nyo * 2, ux, uy, l / 2 + 2, 2, h, h + 5, pc, mul(pc, 0.78));
          for (let d = 4; d < l - 2; d += 6) obox(plain, ax + ux * d - nxo * 2, ay + uy * d - nyo * 2, ux, uy, 0.6, 2.2, h + 5, h + 6, mul(pc, 0.7), mul(pc, 0.6));
        }
      }
    }
    if (trib) { // gradas: escalones con butacas en bloques de colores, borde blanco atrás y (opcional) cabina de prensa
      const T2 = spec.tribuna, HPM = TS / (G.MD.tileMeters || 2.25), cols = (T2.seats || ['#c8302a', '#2a4aa8']).map(rgb);
      const back = T2.back ?? 0.08, f0 = 0.03, rows = Math.max(3, Math.round(2 * trib.L * (1 - back - f0) / (0.9 * HPM))), df = (1 - back - f0) / rows;
      const blk = (T2.block || 7) * HPM, M = trib.M - 1.2 * HPM, nb = Math.max(1, Math.round(2 * M / blk));
      for (let r = 0; r < rows; r++) {
        const fa = f0 + r * df, fb = fa + df, za = trib.z(fa), zb = trib.z(fb) + 0.3;
        for (let k = 0; k < nb; k++) {
          const m0 = -M + 2 * M * k / nb + (k ? 0.6 : 0), m1 = -M + 2 * M * (k + 1) / nb, c = mul(cols[(k + (T2.stagger && r >= rows / 2 ? 1 : 0)) % cols.length], r % 2 ? 0.9 : 1);
          const A = trib.at(fa, m0), B = trib.at(fa, m1), C2 = trib.at(fb, m1), D = trib.at(fb, m0);
          quad4(plain, [A[0], A[1], zb], [B[0], B[1], zb], [C2[0], C2[1], zb], [D[0], D[1], zb], c);
          quad4(plain, [A[0], A[1], za], [B[0], B[1], za], [B[0], B[1], zb], [A[0], A[1], zb], mul(c, 0.6));
        }
      }
      const rim = rgb(T2.rim || '#f2f2ec'), [bx, by] = trib.at(1 - back / 2, 0);
      obox(plain, bx, by, trib.vx, trib.vy, trib.M, trib.L * back, h, h + 1.6 * MPX, rim, mul(rim, 0.8));
      if (T2.press) { // cabina de prensa en el medio, arriba de todo
        const [qx, qy] = trib.at(0.9, 0);
        obox(plain, qx, qy, trib.vx, trib.vy, 6 * HPM, 2.6 * HPM, h, h + 3 * MPX, rim, [0.22, 0.28, 0.36]);
        obox(plain, qx, qy, trib.vx, trib.vy, 6.6 * HPM, 3 * HPM, h + 3 * MPX, h + 3.8 * MPX, rim, mul(rim, 0.8));
      }
    }
    if (spec.crenel) { // almenas sobre el borde
      const cc = rgb(spec.crenel);
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], l = Math.hypot(bx - ax, by - ay); if (l < 1) continue;
        const ux = (bx - ax) / l, uy = (by - ay) / l, nxo = uy * bd.sign, nyo = -ux * bd.sign;
        obox(plain, (ax + bx) / 2 - nxo * 1.2, (ay + by) / 2 - nyo * 1.2, ux, uy, l / 2, 1.2, h, h + 2, cc, mul(cc, 0.8));
        for (let d = 2; d < l - 1; d += 6) obox(plain, ax + ux * d - nxo * 1.2, ay + uy * d - nyo * 1.2, ux, uy, 1.5, 1.2, h + 2, h + 5, cc, mul(cc, 0.78));
      }
    }
    if (spec.frame) { // aristas blancas que enmarcan la torre de vidrio
      const fc = rgb(spec.frame);
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = o.cx + o.ax * (o.la - 1.5) * sa + o.bx * (o.lb - 1.5) * sb, y = o.cy + o.ay * (o.la - 1.5) * sa + o.by * (o.lb - 1.5) * sb;
        obox(plain, x, y, o.ax, o.ay, 1.8, 1.8, z0, h + 3, fc, mul(fc, 0.82));
      }
    }
    if (spec.pyramid) pyramid(plain, o.cx, o.cy, o.ax, o.ay, Math.min(o.la, o.lb) * 0.38, h, h + spec.pyramid.h * MPX, rgb(spec.pyramid.color));
    if (spec.spike) { // mástil en la punta alta de la vela
      const x = o.cx + o.ax * sgnA * o.la * 0.85, y = o.cy + o.ay * sgnA * o.la * 0.85;
      obox(plain, x, y, o.ax, o.ay, 1, 1, h - 2, h + 22, [0.92, 0.92, 0.9], [0.7, 0.7, 0.68]);
    }
    if (spec.tank) { // tanque de agua de hormigón sobre el techo
      const tx = o.cx + o.ax * o.la * 0.3, ty = o.cy + o.ay * o.la * 0.3;
      obox(plain, tx, ty, o.ax, o.ay, 4, 4, h, h + 7, [0.78, 0.76, 0.72], [0.6, 0.58, 0.55]);
      obox(plain, tx, ty, o.ax, o.ay, 4.6, 4.6, h + 7, h + 8, [0.86, 0.84, 0.8], [0.7, 0.68, 0.64]);
    }
    if (spec.statues) { // remates en las esquinas y al medio de los lados largos
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
        const x = o.cx + o.ax * (o.la - 3) * sa + o.bx * (o.lb - 3) * sb, y = o.cy + o.ay * (o.la - 3) * sa + o.by * (o.lb - 3) * sb;
        obox(plain, x, y, o.ax, o.ay, 2.5, 2.5, h, h + 6, trim, mul(trim, 0.8));    // pedestal
        obox(plain, x, y, o.ax, o.ay, 1.5, 1.5, h + 6, h + 14, mul(trim, 0.92), mul(trim, 0.7)); // figura
      }
    }
    if (spec.towers) { // torres al frente: el extremo corto que da a la calle o a la plaza
      const tw = spec.towers, half = tw.w * MPX / 2, th = tw.h * MPX, cap = rgb(tw.capColor);
      const out = s => G.tileAtPx(o.cx + o.ax * s * (o.la + 26), o.cy + o.ay * s * (o.la + 26));
      const s = STREETISH(out(1)) || !STREETISH(out(-1)) ? 1 : -1;
      const fx = o.cx + o.ax * s * (o.la - half), fy = o.cy + o.ay * s * (o.la - half);
      const spots = tw.layout === 'twin' ? [1, -1].map(k => [fx + o.bx * k * (o.lb - half), fy + o.by * k * (o.lb - half)])
        : tw.layout === 'center' ? [[o.cx, o.cy]] : [[fx, fy]];
      for (const [x, y] of spots) {
        obox(plain, x, y, o.ax, o.ay, half, half, 0, th * 0.72, mul(wall, 1), mul(wall, 0.8));
        obox(plain, x, y, o.ax, o.ay, half + 1, half + 1, th * 0.72 - 3, th * 0.72, trim, mul(trim, 0.85)); // cornisa
        obox(plain, x, y, o.ax, o.ay, half * 0.82, half * 0.82, th * 0.72, th * 0.9, mul(wall, 1.02), mul(wall, 0.82)); // campanario
        for (const [ua, ub] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // aberturas del campanario
          const ex = x + (o.ax * ua + o.bx * ub) * (half * 0.82 + 0.4), ey = y + (o.ay * ua + o.by * ub) * (half * 0.82 + 0.4);
          obox(plain, ex, ey, o.ax, o.ay, ub ? half * 0.35 : 0.5, ua ? half * 0.35 : 0.5, th * 0.75, th * 0.86, [0.16, 0.18, 0.24], [0.16, 0.18, 0.24]);
        }
        if (tw.clock) for (const [ua, ub] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // reloj en las cuatro caras
          const ex = x + (o.ax * ua + o.bx * ub) * (half + 0.4), ey = y + (o.ay * ua + o.by * ub) * (half + 0.4), zc = th * 0.6;
          obox(plain, ex, ey, o.ax, o.ay, ub ? half * 0.5 : 0.6, ua ? half * 0.5 : 0.6, zc - half * 0.5, zc + half * 0.5, [0.97, 0.97, 0.94], [0.97, 0.97, 0.94]);
          obox(plain, ex + (o.ax * ua + o.bx * ub) * 0.5, ey + (o.ay * ua + o.by * ub) * 0.5, o.ax, o.ay, ub ? 0.6 : 0.7, ua ? 0.6 : 0.7, zc - 1, zc + 2, [0.1, 0.1, 0.12], [0.1, 0.1, 0.12]);
        }
        const z = th * 0.9;
        if (tw.cap === 'dome') dome(plain, x, y, o.ax, o.ay, half * 0.8, z, half * 1.4, cap);
        else if (tw.cap === 'spire') { pyramid(plain, x, y, o.ax, o.ay, half * 0.82, z, z + th * 0.45, cap); obox(plain, x, y, o.ax, o.ay, 0.6, 0.6, z + th * 0.45, z + th * 0.45 + 7, [0.9, 0.86, 0.6], [0.7, 0.66, 0.4]); }
        else pyramid(plain, x, y, o.ax, o.ay, half * 0.9, z, z + half * 1.6, cap);
      }
    }
  }
  function details(bd, h, pal, g) {
    const W2 = bd.maxx - bd.minx, H2 = bd.maxy - bd.miny;
    if (bd.floors >= 5 && W2 > 40 && H2 > 40) { // sala de máquinas
      const w = Math.round(Math.min(40, W2 * 0.3)), d = Math.round(Math.min(40, H2 * 0.3));
      const x = Math.round(bd.minx + W2 * (0.25 + G.hash(bd.id, 3, 1) * 0.3)), y = Math.round(bd.miny + H2 * (0.25 + G.hash(bd.id, 4, 1) * 0.3));
      if (G.rectInside(bd, x, y, w + 4, d + 4)) box(g, x, y, h, w, d, 10, rgb(pal[2]), rgb(pal[3]));
    }
    const count = bd.m2 < 250 ? (G.hash(bd.id, 5, 1) < 0.55 ? 1 : 0) : Math.min(7, Math.floor(bd.m2 / 220));
    let placed = 0;
    for (let t = 0; t < count * 4 && placed < count; t++) {
      const x = Math.round(bd.minx + 2 + G.hash(bd.id, t, 11) * (W2 - 10)), y = Math.round(bd.miny + 2 + G.hash(bd.id, t, 12) * (H2 - 10));
      if (!G.rectInside(bd, x, y, 7, 7)) continue;
      placed++;
      if (bd.m2 < 250 || G.hash(bd.id, t, 13) < 0.45) box(g, x, y, h, 5, 5, 6, [0.25, 0.25, 0.3], [0.11, 0.11, 0.14]); // tanque negro
      else box(g, x, y, h, 6, 5, 4, [0.8, 0.82, 0.86], [0.6, 0.62, 0.68]); // aire acondicionado
    }
  }
  // faroles: amarillos de doble brazo en los parterres (como en la 3 de Abril) y grises de un brazo en las veredas;
  // semáforos amarillos (como los de Corrientes) donde OSM marca uno
  const SIGNALS = [];
  for (let i = 0; i + 1 < G.SIGNALS.length; i += 2) SIGNALS.push([(G.SIGNALS[i] + 0.5) * TS, (G.SIGNALS[i + 1] + 0.5) * TS]);
  function furniture(cx, cy, g) {
    const x0 = cx * G.CH, y0 = cy * G.CH, yellow = rgb('#e0c030'), gray = rgb('#7a7a82'), head = rgb('#d8d8d0');
    const RL = G.T_ALL.ROADLIKE;
    for (let ly = 0; ly < G.CH; ly++) for (let lx = 0; lx < G.CH; lx++) {
      const tx = x0 + lx, ty = y0 + ly, t = G.tileAt(tx, ty), px = tx * TS + TS / 2, py = ty * TS + TS / 2;
      if (t === G.T_ALL.MEDIAN && G.hash(tx, ty, 51) < 0.07) {
        const alongX = G.tileAt(tx, ty - 1) !== t || G.tileAt(tx, ty + 1) !== t; // la calle está arriba/abajo
        const ax = alongX ? 0 : 1, ay = alongX ? 1 : 0;
        obox(g, px, py, 1, 0, 1.5, 1.5, 0, 46, yellow, mul(yellow, 0.75));
        obox(g, px, py, ax, ay, 12, 1, 44, 46, yellow, mul(yellow, 0.8));
        for (const sg of [1, -1]) box(g, px + ax * 12 * sg - 2.5, py + ay * 12 * sg - 2.5, 41, 5, 5, 3, head, mul(head, 0.7));
      } else if (t === G.T_ALL.SIDE && G.hash(tx, ty, 52) < 0.03) {
        let dx = 0, dy = 0;
        if (RL[G.tileAt(tx + 1, ty)]) dx = 1; else if (RL[G.tileAt(tx - 1, ty)]) dx = -1; else if (RL[G.tileAt(tx, ty + 1)]) dy = 1; else if (RL[G.tileAt(tx, ty - 1)]) dy = -1; else continue;
        obox(g, px - dx * 4, py - dy * 4, 1, 0, 1, 1, 0, 38, gray, mul(gray, 0.75));
        obox(g, px + dx * 2, py + dy * 2, dx || 1, dy, dx ? 6 : 1, dx ? 1 : 6, 36, 38, gray, mul(gray, 0.8));
        box(g, px + dx * 8 - 2, py + dy * 8 - 2, 33, 4, 4, 3, head, mul(head, 0.7));
      }
    }
    for (const [sx, sy] of SIGNALS) {
      if (Math.floor(sx / CPX) !== cx || Math.floor(sy / CPX) !== cy) continue;
      // poste en la esquina de vereda más cercana y brazo hacia el cruce
      let best = null;
      for (let r = 1; r < 7 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(sx / TS) + dx, ty = Math.floor(sy / TS) + dy;
        if (G.tileAt(tx, ty) === G.T_ALL.SIDE && (!best || dx * dx + dy * dy < best[2])) best = [tx * TS + TS / 2, ty * TS + TS / 2, dx * dx + dy * dy];
      }
      if (!best) continue;
      const [bx, by] = best, vx = sx - bx, vy = sy - by, l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l, armL = Math.min(26, l * 0.6);
      obox(g, bx, by, 1, 0, 1.5, 1.5, 0, 34, rgb('#e0c030'), rgb('#a88c20'));
      obox(g, bx + ux * armL / 2, by + uy * armL / 2, ux, uy, armL / 2, 1, 32, 34, rgb('#e0c030'), rgb('#a88c20'));
      const hx = bx + ux * armL, hy = by + uy * armL;
      obox(g, hx, hy, ux, uy, 3, 3, 20, 31, rgb('#e8c828'), rgb('#b09018'));
      box(g, hx - 1, hy - 3, 31, 2, 2, 1, rgb('#ff3020'), rgb('#ff3020'));
      box(g, hx - 1, hy - 1, 31, 2, 2, 1, rgb('#ffb020'), rgb('#ffb020'));
      box(g, hx - 1, hy + 1, 31, 2, 2, 1, rgb('#30e060'), rgb('#30e060'));
    }
  }
  function buildBlock(cx, cy) {
    const group = new T.Group(), list = BCENT.get(KEY(cx, cy)) || [];
    const geos = {}, getG = k => geos[k] || (geos[k] = Geo()), lines = { pos: [], col: [] };
    for (const bd of list) {
      if (bd.name && LM[bd.name]) { buildLandmark(bd, bd.name, getG, lines); continue; }
      const p = bd.pts, n = bd.n, h = bd.floors * FLOOR, id = bd.id;
      const tall = bd.floors >= 3;
      const centro = Math.max(0, 1 - Math.hypot((bd.minx + bd.maxx) / 2 - G.SPAWN.x, (bd.miny + bd.maxy) / 2 - G.SPAWN.y) / 9000);
      const paints = tall ? PAINT_DEPTO : PAINT_CASA, paint = paints[Math.floor(G.hash(id, 2, 9) * paints.length)];
      const med = PAINT_MED[Math.floor(G.hash(id, 6, 9) * PAINT_MED.length)];
      const groundT = G.hash(id, 3, 9) < 0.15 + 0.45 * centro ? 'comercio' : 'casa';
      const upperT = tall ? 'depto' : 'casa2';
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1];
        const len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
        const nxo = (by - ay) / len * bd.sign, nyo = -(bx - ax) / len * bd.sign;
        const t = G.tileAtPx((ax + bx) / 2 + nxo * 4, (ay + by) / 2 + nyo * 4);
        const light = 0.72 + 0.28 * Math.max(0, -(nxo * 0.6 + nyo * 0.8)); // luz desde el noroeste
        const u0 = Math.floor(G.hash(id, k, 5) * 4) / 4;
        if (t === TT.BLOCK || t === TT.OSMB) { // medianera contra el vecino
          quad(getG('medianera'), ax, ay, bx, by, 0, h, u0, u0 + len / FAC.medianera.w, 0, h / FLOOR, mul(med, light));
          continue;
        }
        const back = t === TT.YARD, c = mul(paint, light);
        const gt = back ? 'trasera' : groundT, ut = back ? 'trasera' : upperT;
        quad(getG(gt), ax, ay, bx, by, 0, FLOOR, u0, u0 + len / FAC[gt].w, 0, 1, c);
        if (h > FLOOR) quad(getG(ut), ax, ay, bx, by, FLOOR, h, u0, u0 + len / FAC[ut].w, 0, (h - FLOOR) / FLOOR, c);
      }
      // techo
      const contour = []; for (let k = 0; k < n; k++) contour.push(new T.Vector2(p[2 * k], p[2 * k + 1]));
      let faces = []; try { faces = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { /* polígono raro */ }
      const pal = G.roofPal(bd), rc = rgb(pal[0]), rg = getG('r_' + bd.style);
      for (const f of faces) for (const i of f) pv(rg, p[2 * i], p[2 * i + 1], h, p[2 * i] / 16, p[2 * i + 1] / 16, rc);
      const oc = rgb(pal[1]);
      for (let k = 0, j = n - 1; k < n; j = k++) {
        lines.pos.push(p[2 * j], -p[2 * j + 1], h + 0.3, p[2 * k], -p[2 * k + 1], h + 0.3);
        lines.col.push(oc[0], oc[1], oc[2], oc[0], oc[1], oc[2]);
      }
      details(bd, h, pal, getG('plain'));
    }
    furniture(cx, cy, getG('plain'));
    for (const k in geos) group.add(toMesh(geos[k], k === 'plain' ? plainMat : k.startsWith('r_') ? roofMat(k.slice(2)) : k.startsWith('lm_') ? lmMat(k.slice(3)) : facMat(k)));
    if (lines.pos.length) group.add(toLines(lines));
    return group;
  }
  const blocks = new Map();
  let builtBlocks = 0;
  function getBlock(cx, cy) {
    const k = KEY(cx, cy);
    let b = blocks.get(k);
    if (!b) {
      if (builtBlocks >= 2) return null; // como mucho 2 manzanas nuevas por cuadro
      builtBlocks++;
      b = { group: buildBlock(cx, cy), used: frame };
      blocks.set(k, b); scene.add(b.group);
      if (blocks.size > 110) {
        let ok = -1, ou = Infinity;
        for (const [kk, v] of blocks) if (v.used < ou && v.used < frame) { ou = v.used; ok = kk; }
        const old = blocks.get(ok);
        if (old) { scene.remove(old.group); old.group.traverse(o => o.geometry && o.geometry.dispose()); blocks.delete(ok); }
      }
    }
    b.used = frame; b.group.visible = true;
    return b;
  }

  // ------------------------------------------------------------ puentes (el General Belgrano, atirantado)
  // Referencia: torres en "A" con los tensores en abanico desde el vértice, vano central de ~245 m
  // corrido hacia la costa correntina (~517 m del agua), pilas cada ~80 m y defensas triangulares rojas.
  const bridgeGroup = new T.Group(); scene.add(bridgeGroup);
  function prism(g, pts, z0, z1, top, side) { // prisma vertical de base poligonal convexa
    const n = pts.length, shades = [1, 0.84, 0.68, 0.9, 0.78, 0.95];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i % 6])); }
    for (let i = 1; i + 1 < n; i++) { pv(g, pts[0][0], pts[0][1], z1, 0, 0, top); pv(g, pts[i][0], pts[i][1], z1, 0, 0, top); pv(g, pts[i + 1][0], pts[i + 1][1], z1, 0, 0, top); }
  }
  function leg(g, bx, by, tx, ty, z1, ux, uy, w, col) { // pata inclinada de sección w x w, del agua al vértice
    const hx = tx - bx, hy = ty - by, hl = Math.hypot(hx, hy) || 1, h = [hx / hl, hy / hl];
    const off = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sh]) => [ux * su * w / 2 + h[0] * sh * w / 2, uy * su * w / 2 + h[1] * sh * w / 2]);
    const shades = [1, 0.8, 0.66, 0.9];
    for (let i = 0; i < 4; i++) {
      const a = off[i], b = off[(i + 1) % 4];
      quad4(g, [bx + a[0], by + a[1], 0], [bx + b[0], by + b[1], 0], [tx + b[0], ty + b[1], z1], [tx + a[0], ty + a[1], z1], mul(col, shades[i]));
    }
  }
  function leg3(g, B, Tp, cx, cy, w, col) { // pata de sección w x w entre dos puntos 3D (cx,cy = eje transversal)
    const hx = Tp[0] - B[0], hy = Tp[1] - B[1], hl = Math.hypot(hx, hy) || 1, h = [hx / hl, hy / hl];
    const off = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sh]) => [cx * su * w / 2 + h[0] * sh * w / 2, cy * su * w / 2 + h[1] * sh * w / 2]);
    const shades = [1, 0.8, 0.66, 0.9];
    for (let i = 0; i < 4; i++) {
      const a = off[i], c = off[(i + 1) % 4];
      quad4(g, [B[0] + a[0], B[1] + a[1], B[2]], [B[0] + c[0], B[1] + c[1], B[2]], [Tp[0] + c[0], Tp[1] + c[1], Tp[2]], [Tp[0] + a[0], Tp[1] + a[1], Tp[2]], mul(col, shades[i]));
    }
  }
  (function buildBridges() {
    const gp = Geo(), gd = Geo(), gs = Geo(), cables = { pos: [], col: [] };
    const concrete = rgb('#b4b0a8'), concreteD = rgb('#8a867e'), rail = rgb('#e0e0d8'), pyl = rgb('#dedad2'), cableC = rgb('#f2f2f2');
    const red = rgb('#c0604a'), redD = rgb('#8a3e32');
    for (const b of G.BRIDGES) {
      const hw = b.wpx / 2, step = 16, S = [];
      for (let s = 0; s <= b.L; s += step) S.push(s);
      if (S[S.length - 1] < b.L) S.push(b.L);
      const P = S.map(s => G.bridgePoint(b, s));
      const N = P.map((q, i) => {
        const a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)];
        const dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1;
        return { ux: dx / l, uy: dy / l, nx: -dy / l, ny: dx / l };
      });
      const Nat = s => N[Math.min(N.length - 1, Math.max(0, Math.round(s / step)))];
      const Z = S.map(s => G.bridgeZ(b, s));
      let nextPier = 0;
      for (let i = 0; i + 1 < S.length; i++) {
        const z0 = Math.max(0.7, Z[i]), z1 = Math.max(0.7, Z[i + 1]);
        if (Z[i] < 0.2 && Z[i + 1] < 0.2) continue; // ya en el piso: lo dibuja el mapa
        const a = P[i], c = P[i + 1], na = N[i], nc = N[i + 1];
        const aL = [a.x + na.nx * hw, a.y + na.ny * hw], aR = [a.x - na.nx * hw, a.y - na.ny * hw];
        const cL = [c.x + nc.nx * hw, c.y + nc.ny * hw], cR = [c.x - nc.nx * hw, c.y - nc.ny * hw];
        const v0 = S[i] / 32, v1 = S[i + 1] / 32;
        quad4(gd, [aR[0], aR[1], z0], [aL[0], aL[1], z0], [cL[0], cL[1], z1], [cR[0], cR[1], z1], [1, 1, 1], [[0, v0], [1, v0], [1, v1], [0, v1]]);
        for (const [A, C, sh] of [[aL, cL, 0.9], [aR, cR, 0.7]]) {
          if (z0 < 3 && z1 < 3) continue; // en la punta de la rampa no hay costados ni barandas
          quad4(gp, [A[0], A[1], Math.max(0, z0 - 9)], [C[0], C[1], Math.max(0, z1 - 9)], [C[0], C[1], z1], [A[0], A[1], z0], mul(concrete, sh));
          quad4(gp, [A[0], A[1], z0], [C[0], C[1], z1], [C[0], C[1], z1 + 5], [A[0], A[1], z0 + 5], mul(rail, sh));
        }
        const o0 = z0 * 0.42, o1 = z1 * 0.42;
        quad4(gs, [aR[0] + o0, aR[1] + o0, 0.6], [aL[0] + o0, aL[1] + o0, 0.6], [cL[0] + o1, cL[1] + o1, 0.6], [cR[0] + o1, cR[1] + o1, 0.6], [0, 0, 0]);
        // pilas cada ~80 m (una columna ancha bajo el tablero)
        if (S[i] >= nextPier && z0 > 18) {
          nextPier = S[i] + 427;
          obox(gp, a.x, a.y, na.nx, na.ny, hw * 0.72, 7, 0, z0 - 9, concrete, concreteD);
          quad4(gs, [a.x - na.nx * hw * 0.7, a.y - na.ny * hw * 0.7, 0.7], [a.x + na.nx * hw * 0.7, a.y + na.ny * hw * 0.7, 0.7],
                [a.x + na.nx * hw * 0.7 + z0 * 0.42, a.y + na.ny * hw * 0.7 + z0 * 0.42, 0.7], [a.x - na.nx * hw * 0.7 + z0 * 0.42, a.y - na.ny * hw * 0.7 + z0 * 0.42, 0.7], [0, 0, 0]);
        }
      }
      if (!b.pylons) continue;
      // ¿dónde empieza el agua del lado de Corrientes (el extremo este)?
      const eastAtEnd = P[P.length - 1].x > P[0].x;
      let sShore = null;
      for (let k = 0; k < S.length; k++) {
        const i = eastAtEnd ? S.length - 1 - k : k;
        if (G.tileAt(Math.floor(P[i].x / TS), Math.floor(P[i].y / TS)) === TT.BRIDGEW) { sShore = S[i]; break; }
      }
      const sC = sShore === null ? b.L / 2 : sShore + (eastAtEnd ? -2757 : 2757);
      const HP = b.pylonPx;
      for (const sp of [sC - 653, sC + 653]) {
        // Cada torre: dos marcos en "A", uno a cada lado del tablero, con las patas abiertas a lo largo del puente,
        // sobre una base maciza de hormigón; arriba los une un cabezal y los tensores bajan desde la cabeza de cada A.
        const q = G.bridgePoint(b, sp), nn = Nat(sp), zd = G.bridgeZ(b, sp), off = hw + 14, spread = 70, base = 22;
        const brown = rgb('#7a5a48');
        obox(gp, q.x, q.y, nn.ux, nn.uy, spread + 24, off + 18, 0, base, mul(brown, 1.05), mul(brown, 0.78));
        quad4(gs, [q.x - nn.nx * (off + 18), q.y - nn.ny * (off + 18), 0.8], [q.x + nn.nx * (off + 18), q.y + nn.ny * (off + 18), 0.8],
              [q.x + nn.nx * (off + 18) + 9, q.y + nn.ny * (off + 18) + 9, 0.8], [q.x - nn.nx * (off + 18) + 9, q.y - nn.ny * (off + 18) + 9, 0.8], [0, 0, 0]);
        const tops = [];
        for (const sgn of [1, -1]) {
          const cx = q.x + nn.nx * off * sgn, cy = q.y + nn.ny * off * sgn, apex = [cx, cy, HP];
          for (const dir of [1, -1]) leg3(gp, [cx + nn.ux * spread * dir, cy + nn.uy * spread * dir, base], apex, nn.nx, nn.ny, 9, pyl);
          const f = (zd - 16 - base) / (HP - base), half = spread * (1 - f);
          obox(gp, cx, cy, nn.ux, nn.uy, half, 4, zd - 22, zd - 12, pyl, mul(pyl, 0.85)); // tirante a la altura del tablero
          obox(gp, cx, cy, nn.ux, nn.uy, 9, 6, HP - 26, HP + 6, pyl, mul(pyl, 0.8));     // cabeza de la A (anclaje de tensores)
          tops.push([cx, cy]);
          const sx = HP * 0.42; // sombra de la A sobre el agua
          tri3(gs, [cx + nn.ux * spread, cy + nn.uy * spread, 0.8], [cx - nn.ux * spread, cy - nn.uy * spread, 0.8], [cx + sx, cy + sx, 0.8], [0, 0, 0]);
        }
        obox(gp, q.x, q.y, nn.nx, nn.ny, off, 5, HP - 14, HP + 2, pyl, mul(pyl, 0.88)); // cabezal que une las dos A
        obox(gp, q.x, q.y, nn.nx, nn.ny, off, 6, zd - 24, zd - 12, pyl, mul(pyl, 0.88)); // travesaño bajo el tablero
        // tensores: de la cabeza de cada A al borde del tablero de su mismo lado, hacia los dos lados del puente
        for (let k = 1; k <= 12; k++) for (const dir of [1, -1]) {
          const s2 = sp + dir * (40 + k * 50);
          if (s2 < 0 || s2 > b.L) continue;
          const d = G.bridgePoint(b, s2), nd = Nat(s2), ez = G.bridgeZ(b, s2) + 5;
          for (const sgn of [1, -1]) {
            const [tx, ty] = tops[sgn > 0 ? 0 : 1];
            cables.pos.push(tx, -ty, HP - 22 + k * 1.3, d.x + nd.nx * (hw - 2) * sgn, -(d.y + nd.ny * (hw - 2) * sgn), ez);
            cables.col.push(...cableC, ...cableC);
          }
        }
      }
      // defensas triangulares rojas que protegen las pilas del canal de navegación
      const defensa = (sp, dist, base, len) => {
        const q = G.bridgePoint(b, sp), nn = Nat(sp);
        for (const sgn of [1, -1]) {
          const cx = q.x + nn.nx * dist * sgn, cy = q.y + nn.ny * dist * sgn;
          const tri = [[cx - nn.ux * base / 2, cy - nn.uy * base / 2], [cx + nn.ux * base / 2, cy + nn.uy * base / 2],
                       [cx + nn.nx * len * sgn, cy + nn.ny * len * sgn]];
          prism(gp, sgn > 0 ? tri : [tri[1], tri[0], tri[2]], 0, 20, red, redD);
          quad4(gs, [tri[0][0] + 8, tri[0][1] + 8, 0.7], [tri[1][0] + 8, tri[1][1] + 8, 0.7], [tri[2][0] + 8, tri[2][1] + 8, 0.7], [tri[2][0] + 8, tri[2][1] + 8, 0.7], [0, 0, 0]);
        }
      };
      for (const sp of [sC - 653, sC + 653]) defensa(sp, 190, 180, 250);
      for (const sp of [sC - 1472, sC + 1472]) defensa(sp, 330, 130, 170);
    }
    if (gd.pos.length) bridgeGroup.add(toMesh(gd, deckMat));
    if (gp.pos.length) bridgeGroup.add(toMesh(gp, plainMat));
    if (gs.pos.length) { const m = toMesh(gs, groundShadowMat); m.renderOrder = 1; bridgeGroup.add(m); }
    if (cables.pos.length) bridgeGroup.add(toLines(cables));
  })();

  // ------------------------------------------------------------ pórtico de carteles de la Av. 3 de Abril
  function signCanvas(lines, w, h, bg) {
    return cv(w, h, g => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4f4f0'; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, h - 2, w - 2, 1); g.fillRect(1, 1, 1, h - 2); g.fillRect(w - 2, 1, 1, h - 2);
      g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
      lines.forEach((t, i) => g.fillText(t, w / 2, 4 + i * 11));
      // flecha hacia abajo
      const ax = w / 2, ay = h - 11;
      g.fillRect(ax - 1, ay, 3, 5); g.fillRect(ax - 4, ay + 5, 9, 1); g.fillRect(ax - 3, ay + 6, 7, 1); g.fillRect(ax - 2, ay + 7, 5, 1); g.fillRect(ax - 1, ay + 8, 3, 1);
    });
  }
  const signMat = c => new T.MeshBasicMaterial({ map: nearest(new T.CanvasTexture(c)), side: T.DoubleSide });
  function panel(group, mat, cx, cy, ux, uy, nx, ny, w, ztop, depth, drop) {
    const g = Geo(), wh = w / 2;
    quad4(g, [cx - nx * wh - ux * depth, cy - ny * wh - uy * depth, ztop - drop], [cx + nx * wh - ux * depth, cy + ny * wh - uy * depth, ztop - drop],
          [cx + nx * wh, cy + ny * wh, ztop], [cx - nx * wh, cy - ny * wh, ztop], [1, 1, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    group.add(toMesh(g, mat));
  }
  if (G.GANTRY) {
    const gg = G.GANTRY, ux = gg.ux, uy = gg.uy, nx = -uy, ny = ux, span = gg.half + 8, gp = Geo();
    const yellow = rgb('#d8c030'), steel = rgb('#9a9aa2');
    for (const s of [1, -1]) obox(gp, gg.x + nx * span * s, gg.y + ny * span * s, ux, uy, 3, 3, 0, 56, steel, mul(steel, 0.8));
    obox(gp, gg.x, gg.y, nx, ny, span, 3, 50, 56, steel, mul(steel, 0.85));
    obox(gp, gg.x - ux * 6, gg.y - uy * 6, nx, ny, span, 2, 44, 48, steel, mul(steel, 0.75));
    const furn = new T.Group(); scene.add(furn);
    furn.add(toMesh(gp, plainMat));
    const w = span * 0.92;
    panel(furn, signMat(signCanvas(['PROV. DEL CHACO', 'AV. COSTANERA'], 96, 40, '#1e8a5c')), gg.x - nx * w / 2, gg.y - ny * w / 2, ux, uy, nx, ny, w - 4, 52, 30, 16);
    panel(furn, signMat(signCanvas(['CALLE SANTA FE', 'CENTRO'], 96, 40, '#1e8a5c')), gg.x + nx * w / 2, gg.y + ny * w / 2, ux, uy, nx, ny, w - 4, 52, 30, 16);
    // cartel de velocidad máxima en la vereda, antes del pórtico
    const vx = gg.x + nx * (span + 10) - ux * 70, vy = gg.y + ny * (span + 10) - uy * 70, gv = Geo();
    obox(gv, vx, vy, ux, uy, 1.5, 1.5, 0, 30, steel, mul(steel, 0.8));
    furn.add(toMesh(gv, plainMat));
    const vel = cv(32, 40, g => {
      g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 32, 40); g.fillStyle = '#222'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 39, 32, 1); g.fillRect(0, 0, 1, 40); g.fillRect(31, 0, 1, 40);
      g.fillStyle = '#d02020'; g.beginPath(); g.arc(16, 12, 10, 0, 7); g.fill(); g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(16, 12, 7, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('40', 16, 13);
      g.font = 'bold 5px monospace'; g.fillText('VELOCIDAD', 16, 27); g.fillText('MAXIMA', 16, 32); g.fillStyle = '#c02020'; g.fillText('RADAR', 16, 37);
    });
    panel(furn, signMat(vel), vx, vy, ux, uy, nx, ny, 14, 32, 14, 8);
  }

  // ------------------------------------------------------------ props armados a mano (rejas, chimenea, ruinas)
  function prism8(g, cx, cy, r, z0, z1, top, side) {
    const C = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; C.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const shades = [0.7, 0.62, 0.72, 0.85, 1, 1, 0.95, 0.8];
    for (let i = 0; i < 8; i++) { const a = C[i], b = C[(i + 1) % 8]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i])); }
    for (let i = 1; i < 7; i++) { pv(g, C[0][0], C[0][1], z1, 0, 0, top); pv(g, C[i][0], C[i][1], z1, 0, 0, top); pv(g, C[i + 1][0], C[i + 1][1], z1, 0, 0, top); }
  }
  (function buildProps() {
    const PR = G.PROPS || {}, gp = Geo(), gs = Geo(), MPXp = FLOOR / 3, px = t => (t + 0.5) * TS;
    const white = rgb('#eeece6'), iron0 = rgb('#3a3632'), conc = rgb('#a8a49c'), redIron = rgb('#c0302a');
    for (const [x1t, y1t, x2t, y2t, kind] of PR.fences || []) {
      const x1 = px(x1t), y1 = px(y1t), x2 = px(x2t), y2 = px(y2t), l = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / l, uy = (y2 - y1) / l;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      if (kind === 'wall') { obox(gp, cx, cy, ux, uy, l / 2, 1, 0, 6, white, mul(white, 0.82)); continue; }
      const cancha = kind === 'cancha', iron = cancha ? redIron : iron0;   // alambrado rojo alrededor de la cancha
      const base = kind === 'porch' || cancha ? 1 : 4, top = kind === 'porch' ? 6 : cancha ? 9 : 11;
      obox(gp, cx, cy, ux, uy, l / 2, 1, 0, base, white, mul(white, 0.82));
      for (let d = 1; d < l; d += cancha ? 8 : 3) obox(gp, x1 + ux * d, y1 + uy * d, ux, uy, 0.4, 0.4, base, top, iron, iron);
      if (cancha) obox(gp, cx, cy, ux, uy, l / 2, 0.3, top * 0.55, top * 0.55 + 0.6, iron, iron);
      obox(gp, cx, cy, ux, uy, l / 2, 0.5, top - 1, top, iron, iron);
      if (kind === 'rail') for (let d = 0; d <= l; d += 14) obox(gp, x1 + ux * d, y1 + uy * d, ux, uy, 1.4, 1.4, 0, top + 1, white, mul(white, 0.8)); // pilares
    }
    for (const [x1t, y1t, x2t, y2t] of PR.ruins || []) { // cimientos de la fábrica vieja
      const x1 = px(x1t), y1 = px(y1t), x2 = px(x2t), y2 = px(y2t), l = Math.hypot(x2 - x1, y2 - y1) || 1;
      obox(gp, (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / l, (y2 - y1) / l, l / 2, 1.5, 0, 3, conc, mul(conc, 0.75));
    }
    for (const [xt, yt, hm] of PR.chimneys || []) { // chimenea de ladrillo con anillos
      const x = px(xt), y = px(yt), H = hm * MPXp, baseH = 4 * MPXp, bs = 1.7 * MPXp;
      obox(gp, x, y, 1, 0, bs, bs, 0, baseH, rgb('#c8a284'), rgb('#a8805e'));
      obox(gp, x, y, 1, 0, bs + 0.8, bs + 0.8, baseH - 1.5, baseH, rgb('#e0d4c4'), rgb('#c0b4a4'));
      const segs = 14, r0 = 1.5 * MPXp, r1 = 0.9 * MPXp;
      for (let k = 0; k < segs; k++) {
        const z0 = baseH + (H - baseH) * k / segs, z1 = baseH + (H - baseH) * (k + 1) / segs, r = r0 + (r1 - r0) * (k + 0.5) / segs;
        const band = k % 3 === 2;
        prism8(gp, x, y, r, z0, z1, rgb('#6a3a2a'), rgb(band ? '#c88a62' : '#a8583a'));
      }
      prism8(gp, x, y, r1 + 1.2, H, H + 3, rgb('#2a1a14'), rgb('#7a4a36')); // corona
      const sx = H * 0.42;
      quad4(gs, [x - r0, y, 0.6], [x + r0, y, 0.6], [x + r1 + sx, y + sx, 0.6], [x - r1 + sx, y + sx, 0.6], [0, 0, 0]);
    }
    const HPMp = TS / (G.MD.tileMeters || 2.25);
    for (const [xt, yt, bx, by, dx, dy] of PR.goals || []) { // arcos de fútbol (7,32 x 2,44 m) con la red atrás
      const x = px(xt), y = px(yt), hw = 3.66 * HPMp, H = 2.44 * MPXp, dp = 1.8 * HPMp, net = rgb('#d8d8d0');
      for (const s of [-1, 1]) {
        obox(gp, x + bx * hw * s, y + by * hw * s, bx, by, 0.5, 0.5, 0, H, white, white);
        obox(gp, x + bx * hw * s + dx * dp / 2, y + by * hw * s + dy * dp / 2, dx, dy, dp / 2, 0.3, 0, 0.6, net, net);
      }
      obox(gp, x, y, bx, by, hw + 0.5, 0.5, H - 0.8, H, white, white);
      obox(gp, x + dx * dp, y + dy * dp, bx, by, hw, 0.3, 0, 0.6, net, net);
      quad4(gp, [x + bx * hw, y + by * hw, H], [x - bx * hw, y - by * hw, H], [x - bx * hw + dx * dp, y - by * hw + dy * dp, 0.6], [x + bx * hw + dx * dp, y + by * hw + dy * dp, 0.6], mul(net, 0.9));
    }
    for (const [xt, yt, hm] of PR.floodlights || []) { // torres de iluminación, mirando a la cancha más cercana
      const x = px(xt), y = px(yt), H = hm * MPXp, gray = rgb('#9a9aa2');
      let fx = 0, fy = 1, best = Infinity;
      for (const q of PR.pitches || []) {
        const qx = px((q[0] + q[2] + q[4] + q[6]) / 4), qy = px((q[1] + q[3] + q[5] + q[7]) / 4), d = Math.hypot(qx - x, qy - y);
        if (d < best) { best = d; fx = (qx - x) / d; fy = (qy - y) / d; }
      }
      obox(gp, x, y, 1, 0, 0.9, 0.9, 0, H, gray, mul(gray, 0.75));
      obox(gp, x + fx * 1.5, y + fy * 1.5, -fy, fx, 2.6 * HPMp, 0.7 * HPMp, H, H + 2.6 * MPXp, mul(gray, 0.8), mul(gray, 0.6));
      for (let i = -1; i <= 1; i++) for (let j = 0; j < 2; j++)
        obox(gp, x + fx * 3 - fy * i * 1.7 * HPMp, y + fy * 3 + fx * i * 1.7 * HPMp, -fy, fx, 0.7 * HPMp, 0.4, H + (0.4 + j * 1.2) * MPXp, H + (1.2 + j * 1.2) * MPXp, rgb('#fff6c8'), rgb('#f4e8a0'));
      const sx = H * 0.42; quad4(gs, [x - 1, y, 0.6], [x + 1, y, 0.6], [x + 1 + sx, y + sx, 0.6], [x - 1 + sx, y + sx, 0.6], [0, 0, 0]);
    }
    for (const [xt, yt, hm] of PR.pillars || []) obox(gp, px(xt), px(yt), 1, 0, 1.4, 1.4, 0, hm * MPXp, rgb('#f2f2ee'), rgb('#c8c8c4'));
    for (const [xt, yt, rm, hm] of PR.turrets || []) { // torreones redondos con almenas (La Unidad)
      const x = px(xt), y = px(yt), r = rm * MPXp, H = hm * MPXp, brick = rgb('#b8664a'), cream = rgb('#e6d2a8');
      prism8(gp, x, y, r, 0, H - 3, brick, brick);
      prism8(gp, x, y, r + 1, H - 3, H, cream, cream);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; obox(gp, x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), 1.6, 1, H, H + 3, cream, mul(cream, 0.8)); }
      const sx = H * 0.42; quad4(gs, [x - r, y, 0.6], [x + r, y, 0.6], [x + r + sx, y + sx, 0.6], [x - r + sx, y + sx, 0.6], [0, 0, 0]);
    }
    for (const [xt, yt, hm] of PR.watertowers || []) { // tanque de agua elevado
      const x = px(xt), y = px(yt), H = hm * MPXp, r = 2.6 * MPXp, w = rgb('#e8e8e4');
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) obox(gp, x + dx * r * 0.6, y + dy * r * 0.6, 1, 0, 0.8, 0.8, 0, H, rgb('#9a9aa0'), rgb('#7a7a80'));
      prism8(gp, x, y, r, H, H + 4 * MPXp, w, w);
      pyramid(gp, x, y, 1, 0, r * 0.9, H + 4 * MPXp, H + 5.5 * MPXp, mul(w, 0.9));
    }
    if (gp.pos.length) scene.add(toMesh(gp, plainMat));
    if (gs.pos.length) { const m = toMesh(gs, groundShadowMat); m.renderOrder = 1; scene.add(m); }
  })();

  // ------------------------------------------------------------ sprites (autos, peatones) y capa de efectos
  const sprMats = new Map();
  function sprMat(c) {
    let m = sprMats.get(c);
    if (!m) { m = new T.MeshBasicMaterial({ map: nearest(new T.CanvasTexture(c)), alphaTest: 0.5 }); sprMats.set(c, m); }
    return m;
  }
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000010, transparent: true, opacity: 0.38, depthWrite: false });
  function pool(mat) {
    const arr = []; let used = 0;
    return {
      reset() { used = 0; },
      get(m) { if (used >= arr.length) { const o = new T.Mesh(unitPlane, mat); scene.add(o); arr.push(o); } const o = arr[used++]; o.visible = true; if (m) o.material = m; return o; },
      finish() { for (let i = used; i < arr.length; i++) arr[i].visible = false; },
    };
  }
  const sprites = pool(null), shadows = pool(shadowMat);
  function place(o, x, y, z, a, w, h) { o.position.set(x, -y, z); o.rotation.set(0, 0, -a - Math.PI / 2); o.scale.set(w, h, 1); }
  let fxTex = null, fxMesh = null;
  function makeFx() {
    if (fxMesh) { scene.remove(fxMesh); fxMesh.material.dispose(); fxTex.dispose(); }
    fxTex = nearest(new T.CanvasTexture(G.fxCanvas));
    fxMesh = new T.Mesh(unitPlane, new T.MeshBasicMaterial({ map: fxTex, transparent: true, depthWrite: false }));
    fxMesh.renderOrder = 5; scene.add(fxMesh);
  }

  // ------------------------------------------------------------ cuadro
  let iw = 400, ih = 300;
  function resize(w, h) { iw = w; ih = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); makeFx(); }
  function render() {
    frame++; builtBlocks = 0;
    const cam = G.cam, player = G.player, zoom = cam.zoom, view = G.view;
    view.w = iw / zoom; view.h = ih / zoom; view.scale = G.baseScale * zoom;
    const baseZ = (player.car ? player.car.z : player.z) || 0;
    const camH = view.h / 2 / TAN + baseZ;
    const sh = G.shake() > 0 ? G.shake() * 8 : 0;
    const cx = cam.x + (sh ? (Math.random() * 2 - 1) * sh : 0), cy = cam.y + (sh ? (Math.random() * 2 - 1) * sh : 0);
    camera.position.set(cx, -cy, camH); camera.lookAt(cx, -cy, 0);
    // zona visible a nivel del suelo (más un margen: los edificios altos se "inclinan" hacia adentro)
    const k = camH / Math.max(1, camH - baseZ), gw = view.w * k, gh = view.h * k;
    const gx0 = cx - gw / 2, gy0 = cy - gh / 2;
    for (const c of G.chunks.values()) if (c.mesh) c.mesh.visible = false;
    const c0x = Math.floor((gx0 - 32) / CPX), c1x = Math.floor((gx0 + gw + 32) / CPX), c0y = Math.floor((gy0 - 32) / CPX), c1y = Math.floor((gy0 + gh + 32) / CPX);
    for (let y = c0y; y <= c1y; y++) for (let x = c0x; x <= c1x; x++) {
      if (!G.inMap(x, y)) continue;
      const c = G.getChunk(x, y);
      if (!c.mesh) {
        c.tex = nearest(new T.CanvasTexture(c.cv));
        c.mesh = new T.Mesh(unitPlane, new T.MeshBasicMaterial({ map: c.tex }));
        c.mesh.position.set(x * CPX + CPX / 2, -(y * CPX + CPX / 2), 0); c.mesh.scale.set(CPX, CPX, 1);
        c.mesh.matrixAutoUpdate = false; c.mesh.updateMatrix(); scene.add(c.mesh);
      }
      if (c.dirty) { c.tex.needsUpdate = true; c.dirty = false; }
      c.mesh.visible = true;
    }
    G.prefetch(gx0, gy0, gw, gh);
    for (const b of blocks.values()) b.group.visible = false;
    const m = Math.max(gw, gh) * 0.35;
    const b0x = Math.floor((gx0 - m) / CPX), b1x = Math.floor((gx0 + gw + m) / CPX), b0y = Math.floor((gy0 - m) / CPX), b1y = Math.floor((gy0 + gh + m) / CPX);
    // primero las manzanas del centro, después las de los bordes
    const order = [];
    for (let y = b0y; y <= b1y; y++) for (let x = b0x; x <= b1x; x++) if (G.inMap(x, y)) order.push([x, y, (x * CPX + CPX / 2 - cx) ** 2 + (y * CPX + CPX / 2 - cy) ** 2]);
    order.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of order) getBlock(x, y);
    // autos y peatones
    sprites.reset(); shadows.reset();
    const vis = (x, y) => x > gx0 - 40 && y > gy0 - 40 && x < gx0 + gw + 40 && y < gy0 + gh + 40;
    const flash = (G.frameNo() >> 3) & 1;
    for (const c of G.cars) {
      if (!vis(c.x, c.y)) continue;
      const z = c.z || 0;
      place(shadows.get(), c.x + 2, c.y + 3, z + 0.5, c.a, c.w, c.l);
      const siren = c.cop && !c.wreck && (c.mode === 'cop' || c === player.car);
      place(sprites.get(sprMat(siren && flash ? c.sprB : c.spr)), c.x, c.y, z + 1.4, c.a, c.w, c.l);
    }
    for (const p of G.peds) {
      if (!vis(p.x, p.y)) continue;
      const img = p.dead ? p.spr.dead : p.spr.frames[Math.floor(p.anim) % 4];
      place(sprites.get(sprMat(img)), p.x, p.y, (p.z || 0) + (p.dead ? 0.7 : 1.1), p.a, img.width, img.height);
    }
    if (!player.car) {
      const img = player.dead && !player.busted ? player.spr.dead : player.spr.frames[Math.floor(player.anim) % 4];
      place(sprites.get(sprMat(img)), player.x, player.y, (player.z || 0) + 1.2, player.a, img.width, img.height);
    }
    sprites.finish(); shadows.finish();
    // efectos (balas, partículas, pickups) en una capa 2D a la altura del jugador
    const bw = Math.min(G.fxCanvas.width, Math.ceil(view.w) + 1), bh = Math.min(G.fxCanvas.height, Math.ceil(view.h) + 1);
    const ox = Math.round(cx - view.w / 2), oy = Math.round(cy - view.h / 2);
    G.drawFX(ox, oy, bw, bh, true);
    fxTex.needsUpdate = true;
    fxTex.repeat.set(bw / G.fxCanvas.width, bh / G.fxCanvas.height);
    fxTex.offset.set(0, 1 - bh / G.fxCanvas.height);
    fxMesh.position.set(ox + bw / 2, -(oy + bh / 2), baseZ + 0.9); fxMesh.scale.set(bw, bh, 1);
    renderer.render(scene, camera);
  }
  function evict(c) {
    if (!c.mesh) return;
    scene.remove(c.mesh); c.mesh.material.dispose(); c.tex.dispose(); c.mesh = null; c.tex = null;
  }
  return { render, resize, evict, info: () => renderer.info };
};
