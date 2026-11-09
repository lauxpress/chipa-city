// CHIPA CITY — escena "casa_gobierno": la Casa de Gobierno de Corrientes de noche.
// Tercera persona (cámara fija mirando al norte, paredes del sur recortadas). Sigilo con ordenanzas que hacen la ronda
// (conos de visión), expedientes en el Archivo y la caja fuerte del despacho (combinación de las pistas).
'use strict';
ChipaScenes.register('casa_gobierno', {
  fov: 46, lowH: 300,
  create(st, opts) {
    const T = THREE, { U } = ChipaScenes;
    const diff = U.diff(opts);
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    const rnd = U.rng(U.hash('casa' + seed));
    const scene = st.scene, cam = st.camera, SND = st.sfx;
    const TITLE = U.o(opts, 'titulo title', 'Casa de Gobierno, después de hora');
    const INTRO = U.o(opts, 'intro', 'Pasillos de mármol, retratos de próceres y olor a cera y a expediente. Los ordenanzas hacen la ronda... cuando se acuerdan.');
    const GOAL = U.o(opts, 'objetivo goal', 'Llegar al Archivo, encontrar los expedientes, ordenarlos y abrir la caja fuerte del despacho.');
    const TIME = +U.o(opts, 'tiempo time', 360 - diff * 8);
    const SIG = opts.sigilo || {};
    const VMAX = +(SIG.vistasMax || (diff >= 9 ? 1 : diff >= 6 ? 3 : 5));
    const SEEN_TXT = SIG.textoVisto || '¡EY! ¿Usted tiene turno?';
    const P1 = opts.puzzle1 || {}, P2 = opts.puzzle2 || {};
    const REALES = P1.expedientes || [
      { titulo: 'Copia del acta de fundación de San Juan de Vera de las Siete Corrientes', fecha: '3 de abril de 1588', pista: 'La ciudad nació un día TRES.' },
      { titulo: 'Carta de Fray Benicio al guardián de San Francisco', fecha: '13 de abril de 1865', pista: 'La flota llegó al puerto un día TRECE.' },
      { titulo: 'Parte del Combate del Puente de la Batería', fecha: '25 de mayo de 1865', pista: 'La ciudad se recuperó un VEINTICINCO.' },
    ];
    const FALSOS = (P1.falsos || []).concat([
      'Expte. 4532: compra de 800 sillas para una oficina de 3 personas.', 'Expte. 0007: repavimentación de una calle que no existe. Etapa 14 de 14.',
      'Expte. 1111: viático a Disney para estudiar el drenaje de los castillos.', 'Expte. 2020: licitación de una licitación.',
      'Expte. 9999: "Esto no lo leas". Firmado: nadie.', 'Expte. 3141: compra de un ventilador para el ventilador.',
      'Expte. 0420: estudio de factibilidad del estudio de factibilidad.', 'Expte. 8080: alquiler de una oficina para guardar expedientes de alquileres.',
      'Expte. 1234: pedido de chipá para la reunión de la comisión de chipá.', 'Expte. 5555: refacción del puente (el de la maqueta, no el de verdad).',
    ]).filter((v, i, a) => a.indexOf(v) === i);
    const COMBO = (P2.combinacion || [3, 13, 25]).map(Number);
    const SAFE_TRIES = +(P2.intentos || (diff >= 8 ? 2 : 3));
    const POSTIT = P2.pista || 'Un post-it en la maqueta: "Combinación: las fechas que nadie en este edificio recuerda".';
    const CONTENIDO = P2.contenido || ['Plano original de Fray Benicio (1865)'];
    const WIN_TXT = U.o(opts, 'textoGana', 'Tenés el plano.');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Un ordenanza te acompaña a la salida muy amablemente.');
    const salaInfo = {}; for (const s of (opts.salas || [])) salaInfo[s.id] = s;
    const salaName = id => (salaInfo[id] && salaInfo[id].nombre) || { mesa_entradas: 'Mesa de Entradas', pasillo: 'Pasillo de los Retratos', salon: 'Salón de Acuerdos', archivo: 'Archivo (subsuelo)', despacho: 'Despacho del Ministro' }[id];

    // ============================================================ planta (1 celda = 1 m; x → este, z → sur)
    const GW = 42, GH = 34;
    const ROOMS = [
      { id: 'salon', x0: 12, z0: 2, x1: 25, z1: 12, floor: 'damero' },
      { id: 'despacho', x0: 28, z0: 2, x1: 38, z1: 11, floor: 'parquet' },
      { id: 'pasillo', x0: 2, z0: 14, x1: 38, z1: 18, floor: 'damero' },
      { id: 'mesa_entradas', x0: 12, z0: 20, x1: 24, z1: 30, floor: 'mosaico' },
      { id: 'archivo', x0: 27, z0: 20, x1: 38, z1: 31, floor: 'cemento' },
    ];
    const DOORS = [
      { cells: [[18, 13], [19, 13]], a: 'salon', b: 'pasillo' }, { cells: [[18, 19], [19, 19]], a: 'pasillo', b: 'mesa_entradas' },
      { cells: [[26, 6], [27, 6], [26, 7], [27, 7]], a: 'salon', b: 'despacho' },
      { cells: [[25, 25], [26, 25], [25, 26], [26, 26]], a: 'mesa_entradas', b: 'archivo', locked: true },
    ];
    const grid = new Int8Array(GW * GH).fill(-1); // -1 pared, k = índice de sala, 9 = puerta
    const gAt = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : grid[j * GW + i];
    ROOMS.forEach((r, k) => { for (let j = r.z0; j <= r.z1; j++) for (let i = r.x0; i <= r.x1; i++) grid[j * GW + i] = k; });
    for (const d of DOORS) for (const [i, j] of d.cells) grid[j * GW + i] = 9;
    const isFloor = (i, j) => gAt(i, j) >= 0;
    const roomAt = (x, z) => { const v = gAt(Math.floor(x), Math.floor(z)); return v >= 0 && v < 9 ? ROOMS[v] : null; };
    const archDoor = DOORS[3];
    let archLocked = true;
    const col = new U.Collider((i, j) => !isFloor(i, j) || (archLocked && archDoor.cells.some(c => c[0] === i && c[1] === j)), 1);

    // ============================================================ texturas
    const tex = (w, h, fn, o) => U.tex(U.canvas(w, h, fn), o);
    const R = U.R;
    const damT = tex(16, 16, g => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const w = (i + j) % 2 === 0; R(g, w ? '#d4cfc4' : '#26242a', i * 4, j * 4, 4, 4); U.paint.noise(g, 4, 4, rnd, [], 0); for (let k = 0; k < 3; k++) R(g, w ? '#bab4a8' : '#3a3640', i * 4 + Math.floor(rnd() * 4), j * 4 + Math.floor(rnd() * 4), 1, 1); } });
    const mosT = tex(16, 16, g => { R(g, '#c8b898', 0, 0, 16, 16); for (const [x, y] of [[0, 0], [8, 8]]) { R(g, '#9a5a40', x + 2, y + 2, 4, 4); R(g, '#c89a58', x + 3, y + 3, 2, 2); } for (const [x, y] of [[8, 0], [0, 8]]) { R(g, '#6a7a70', x + 3, y + 2, 2, 4); R(g, '#6a7a70', x + 2, y + 3, 4, 2); } R(g, '#a8987a', 0, 15, 16, 1); R(g, '#a8987a', 15, 0, 1, 16); });
    const parT = tex(32, 32, g => U.paint.planks(g, 32, 32, rnd, { pw: 4, cols: ['#7a4a26', '#6a3e20', '#844e2a', '#5e3a1e'] }));
    const cemT = tex(32, 32, g => { R(g, '#6a6660', 0, 0, 32, 32); U.paint.noise(g, 32, 32, rnd, ['#5e5a54', '#76726a', '#625e58'], 500); for (let k = 0; k < 20; k++) R(g, '#4a4640', Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2, 1); });
    const FLOORT = { damero: [damT, 2], mosaico: [mosT, 2], parquet: [parT, 2], cemento: [cemT, 3] };
    const wallC = U.canvas(16, 64, g => {
      R(g, '#d6ccb2', 0, 0, 16, 64); U.paint.noise(g, 16, 64, rnd, ['#cec4aa', '#ddd4bc', '#c8bea4'], 200);
      R(g, '#efe8d4', 0, 0, 16, 3); R(g, '#a89c80', 0, 3, 16, 1); R(g, '#bcb094', 0, 4, 16, 1);
      R(g, '#c8b890', 0, 43, 16, 2); R(g, '#8a7a5a', 0, 45, 16, 1);
      R(g, '#5a3a22', 0, 46, 16, 18); R(g, '#6e4a2c', 1, 48, 6, 13); R(g, '#6e4a2c', 9, 48, 6, 13); R(g, '#4a2e18', 1, 60, 6, 1); R(g, '#4a2e18', 9, 60, 6, 1); R(g, '#3a2212', 0, 63, 16, 1);
    });
    const wallT = U.tex(wallC);
    const archWallT = tex(32, 64, g => { U.paint.brick(g, 32, 64, rnd, { bw: 8, bh: 4, cols: ['#7a6a5a', '#6e5e50', '#86766a', '#5e5046'], mortar: '#3a342e' }); R(g, '#3a3632', 0, 54, 32, 10); });
    const capM = U.mat({ color: 0x2a2420, rough: 1 });
    const wood = tex(16, 16, g => U.paint.planks(g, 16, 16, rnd, { pw: 4, cols: ['#5a3a22', '#4e321c', '#634228'] }));
    const woodM = U.mat({ map: wood, rough: 0.7 });
    const goldM = U.mat({ color: 0xc8a040, rough: 0.35, metal: 0.8, emissive: 0x201000 });
    const metalM = U.mat({ color: 0x5a6068, rough: 0.5, metal: 0.6 });
    const folderT = tex(16, 16, g => { const cs = ['#e8c8b0', '#d8d0a0', '#a8c0d8', '#c8a080', '#e0d8c8', '#d8b0b8']; for (let y = 0; y < 16; y++) { R(g, U.pick(rnd, cs), 0, y, 16, 1); if (rnd() < 0.5) R(g, '#5a4a3a', 0, y, 16, 1); } for (let y = 0; y < 16; y += 3) R(g, '#b83a2a', 7, y, 1, 2); });
    const folderM = U.mat({ map: folderT, rough: 0.9 });

    // ============================================================ paredes (recortadas del lado de la cámara)
    const HW = 3.4, HLOW = 0.55;
    const wB = new U.Builder(), aB = new U.Builder(), capB = new U.Builder();
    const wallH = (i, j) => (isFloor(i, j - 1) && !isFloor(i, j)) ? HLOW : HW;
    const nearArch = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const v = gAt(i + di, j + dj); if (v >= 0 && v < 9 && ROOMS[v].id === 'archivo') return true; } return false; };
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      if (isFloor(i, j)) continue;
      let any = false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (isFloor(i + di, j + dj)) any = true;
      if (!any) continue;
      const h = wallH(i, j), B = nearArch(i, j) ? aB : wB, x0 = i, x1 = i + 1, z0 = j, z1 = j + 1;
      const vv = y => y / HW, sh = [0.62, 0.6, 0.66], hi = [1, 1, 1];
      const face = (a, b, c, d, len) => B.quad(a, b, c, d, [[0, 0], [len / 2, 0], [len / 2, vv(h)], [0, vv(h)]], [sh, sh, hi, hi]);
      if (isFloor(i, j + 1)) face([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], 1);
      if (isFloor(i, j - 1)) face([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], 1);
      if (isFloor(i + 1, j)) face([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], 1);
      if (isFloor(i - 1, j)) face([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], 1);
      // si el vecino es pared baja, mostrar el escalón
      if (!isFloor(i, j + 1) && wallH(i, j + 1) < h) face([x0, wallH(i, j + 1), z1], [x1, wallH(i, j + 1), z1], [x1, h, z1], [x0, h, z1], 1);
      if (!isFloor(i + 1, j) && wallH(i + 1, j) < h) face([x1, wallH(i + 1, j), z1], [x1, wallH(i + 1, j), z0], [x1, h, z0], [x1, h, z1], 1);
      if (!isFloor(i - 1, j) && wallH(i - 1, j) < h) face([x0, wallH(i - 1, j), z0], [x0, wallH(i - 1, j), z1], [x0, h, z1], [x0, h, z0], 1);
      capB.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], null, [1, 1, 1]);
    }
    const mkMesh = (b, m) => { const ms = new T.Mesh(b.geometry(), m); ms.castShadow = true; ms.receiveShadow = true; scene.add(ms); return ms; };
    mkMesh(wB, U.mat({ map: wallT, vc: true, rough: 0.9 })); mkMesh(aB, U.mat({ map: archWallT, vc: true, rough: 1 })); mkMesh(capB, capM);
    // pisos
    for (const r of ROOMS) {
      const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1, [t, s] = FLOORT[r.floor], tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(w / s, d / s);
      const m = new T.Mesh(new T.PlaneGeometry(w, d), U.mat({ map: tt, rough: r.floor === 'damero' ? 0.35 : 0.85, metal: r.floor === 'damero' ? 0.1 : 0 }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x0 + w / 2, 0, r.z0 + d / 2); m.receiveShadow = true; scene.add(m); st.track(tt);
    }
    for (const d of DOORS) for (const [i, j] of d.cells) { const m = new T.Mesh(new T.PlaneGeometry(1, 1), U.mat({ map: damT })); m.rotation.x = -Math.PI / 2; m.position.set(i + 0.5, 0.002, j + 0.5); m.receiveShadow = true; scene.add(m); }
    // vacío negro alrededor
    const voidM = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: 0x050406 })); voidM.rotation.x = -Math.PI / 2; voidM.position.set(21, -0.02, 17); scene.add(voidM);

    // ============================================================ utilería
    const box = (w, h, d, m, x, y, z, o = {}) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o.ry) b.rotation.y = o.ry; b.castShadow = o.shadow !== false; b.receiveShadow = true; (o.parent || scene).add(b); if (o.solid) { const c = col.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2); if (o.opaque) c.opaque = true; } return b; };
    // marcos de puertas
    const frameM = U.mat({ map: wood, color: 0x8a6a4a });
    for (const d of DOORS) {
      const xs = d.cells.map(c => c[0]), zs = d.cells.map(c => c[1]), x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
      const horiz = (x1 - x0) === 2 && (z1 - z0) === 1;
      if (horiz) { box(0.2, 3, 1.05, frameM, x0 + 0.1, 1.5, (z0 + z1) / 2, {}); box(0.2, 3, 1.05, frameM, x1 - 0.1, 1.5, (z0 + z1) / 2); if (z0 !== 19 && z0 !== 13) {} box(2.2, 0.35, 1.05, frameM, (x0 + x1) / 2, 2.9, (z0 + z1) / 2); }
      else { box(2.05, 3, 0.2, frameM, (x0 + x1) / 2, 1.5, z0 + 0.1); box(2.05, 3, 0.2, frameM, (x0 + x1) / 2, 1.5, z1 - 0.1); box(2.05, 0.35, 2.0, frameM, (x0 + x1) / 2, 2.9, (z0 + z1) / 2); }
    }
    // puerta del archivo (con llave)
    const archLeaf = new T.Group(); archLeaf.position.set(25.05, 0, 25); scene.add(archLeaf);
    box(0.1, 2.6, 2, U.mat({ map: wood, color: 0x6a4a30 }), 0, 1.3, 1, { parent: archLeaf });
    box(0.14, 0.12, 0.2, goldM, 0.05, 1.2, 1.7, { parent: archLeaf, shadow: false });
    const archSign = U.tex(U.canvas(32, 10, g => { R(g, '#1a1a1a', 0, 0, 32, 10); U.text(g, 'ARCHIVO', 16, 1, { align: 'center', size: 7, color: '#e8d8a0' }); }), { repeat: false, mips: false });
    const archSignM = new T.Mesh(new T.PlaneGeometry(1.2, 0.36), U.mat({ map: archSign })); archSignM.rotation.y = -Math.PI / 2; archSignM.position.set(24.98, 2.5, 25.98); scene.add(archSignM);
    // escalones bajando al subsuelo (decorado del lado del archivo)
    for (let k = 0; k < 4; k++) box(0.5, 0.06, 2, U.mat({ map: cemT, color: 0x9a948a }), 27.3 + k * 0.5, 0.03 - k * 0.0, 26, { shadow: false });
    // retratos
    const portrait = (smile) => U.canvas(20, 26, g => {
      R(g, U.pick(rnd, ['#2a1a14', '#1a2a20', '#2a1a2a', '#1e2230']), 0, 0, 20, 26); U.paint.noise(g, 20, 26, rnd, ['#3a2a20', '#20302a'], 40);
      const skin = U.pick(rnd, ['#e0b090', '#d0a078', '#c08a60', '#e8c0a0']), hair = U.pick(rnd, ['#1a1a1a', '#5a5a5a', '#c8c8c8', '#3a2a1a']);
      R(g, '#1a1a1a', 3, 18, 14, 8); R(g, '#f0f0f0', 8, 18, 4, 5); R(g, '#1a1a1a', 9, 19, 2, 3);
      for (let k = 0; k < 6; k++) { R(g, '#8ac8f0', 4 + k, 19 + k * 0.5, 2, 1); R(g, '#f8f8f8', 5 + k, 19 + k * 0.5, 1, 1); }
      R(g, skin, 6, 6, 8, 11); R(g, skin, 5, 8, 10, 7); R(g, hair, 6, 4, 8, 3); if (rnd() < 0.4) R(g, skin, 7, 4, 6, 2);
      R(g, '#1a1a1a', 7, 10, 2, 1); R(g, '#1a1a1a', 11, 10, 2, 1);
      if (smile) { R(g, '#f8f8f8', 7, 14, 6, 1); R(g, '#8a2a2a', 7, 15, 6, 1); R(g, '#f0c030', 9, 14, 1, 1); }
      else if (rnd() < 0.6) R(g, hair, 7, 13, 6, 1 + Math.floor(rnd() * 2)); else R(g, '#8a4a3a', 8, 14, 4, 1);
      if (rnd() < 0.3) { R(g, hair, 5, 13, 1, 3); R(g, hair, 14, 13, 1, 3); R(g, hair, 6, 15, 8, 2); }
    });
    const addPortrait = (x, y, z, ry, smile, w = 1.0) => {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
      box(w + 0.18, w * 1.3 + 0.18, 0.08, goldM, 0, 0, 0, { parent: g, shadow: false });
      const p = new T.Mesh(new T.PlaneGeometry(w, w * 1.3), U.mat({ map: U.tex(portrait(smile), { repeat: false, mips: false }), rough: 0.8 })); p.position.z = 0.045; g.add(p);
      return g;
    };
    for (let x = 4; x <= 37; x += 3.4) if (Math.abs(x - 18.8) > 1.8) addPortrait(x, 1.9, 14.06, 0, false);
    // columnas neoclásicas
    const colGeo = new T.CylinderGeometry(0.22, 0.25, 3.0, 10), capGeo = new T.BoxGeometry(0.66, 0.2, 0.66), baseGeo = new T.BoxGeometry(0.62, 0.22, 0.62);
    const marbleM = U.mat({ map: tex(16, 16, g => { R(g, '#e8e2d6', 0, 0, 16, 16); for (let k = 0; k < 6; k++) { let x = Math.floor(rnd() * 16); for (let y = 0; y < 16; y++) { x += Math.floor(rnd() * 3) - 1; R(g, '#c8c0b0', (x + 16) % 16, y, 1, 1); } } }), rough: 0.4 });
    const column = (x, z) => { const c = new T.Mesh(colGeo, marbleM); c.position.set(x, 1.6, z); c.castShadow = c.receiveShadow = true; scene.add(c); box(0.66, 0.2, 0.66, marbleM, x, 3.15, z); box(0.62, 0.22, 0.62, marbleM, x, 0.11, z); col.circle(x, z, 0.3).opaque = true; };
    for (const x of [14.2, 23.8]) for (const z of [4.2, 10.5]) column(x, z);
    for (let x = 6; x <= 36; x += 6) column(x, 17.6);
    // arañas (lámparas de techo) y luces
    const chandelier = (x, z, y = 3.0, i = 2.2, c = 0xffc070, dist = 11) => {
      const g = new T.Group(); g.position.set(x, y, z); scene.add(g);
      const ring = new T.Mesh(new T.TorusGeometry(0.45, 0.03, 4, 12), goldM); ring.rotation.x = Math.PI / 2; g.add(ring);
      const bm = new T.MeshBasicMaterial({ color: new T.Color(3.5, 2.6, 1.4) });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const b = new T.Mesh(new T.IcosahedronGeometry(0.05, 0), bm); b.position.set(Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45); g.add(b); }
      const h = st.halo({ color: c, intensity: 0.3, size: 2.2 }); g.add(h);
      const l = new T.PointLight(U.C(c), i, dist, 1.4); l.position.set(x, y - 0.3, z); scene.add(l); st.addFlicker(l, i, x + z, 0.15);
      return l;
    };
    chandelier(18.8, 7.2, 3.0, 2.6); chandelier(33, 6.5, 2.8, 1.6, 0xffb060, 9); chandelier(10, 16.5, 2.9, 1.5); chandelier(28, 16.5, 2.9, 1.5); chandelier(18.5, 25, 2.9, 1.8, 0xfff0d0, 10);
    const archL = new T.PointLight(U.C(0x9ab0a0), 1.2, 10, 1.6); archL.position.set(32.5, 2.6, 25.5); scene.add(archL); st.addFlicker(archL, 1.2, 9, 0.6);
    const bulbA = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), new T.MeshBasicMaterial({ color: new T.Color(2.4, 2.8, 2.4) })); bulbA.position.set(32.5, 2.9, 25.5); scene.add(bulbA);
    // luna por las ventanas
    scene.add(new T.HemisphereLight(U.C(0x4a5a8a), U.C(0x1a1410), 0.45));
    const moon = new T.DirectionalLight(U.C(0x8aa0d8), 0.7); moon.position.set(-10, 22, -8); moon.target.position.set(21, 0, 17); scene.add(moon); scene.add(moon.target);
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); const sc = moon.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 70; moon.shadow.bias = -0.0008;
    scene.fog = new T.Fog(U.C(0x0a0810), 18, 34);
    st.renderer.setClearColor(U.C(0x050406));
    st.post.levels.value = 24; st.post.vig.value = 0.8; st.post.bloom.value = 1.0; st.post.sat.value = 1.0; st.post.exposure.value = 1.1;
    st.post.lift.value.setRGB(0.02, 0.02, 0.04); st.post.gain.value.setRGB(1.0, 0.97, 0.92);
    const winT = tex(8, 16, g => { R(g, '#3a4a6a', 0, 0, 8, 16); R(g, '#6a8ab8', 1, 1, 6, 6); R(g, '#5a7aa8', 1, 9, 6, 6); R(g, '#d8e0f0', 5, 2, 1, 1); });
    const winM = new T.MeshBasicMaterial({ map: winT, color: new T.Color(1.3, 1.4, 1.8) });
    const windowAt = (x, z) => { const w = new T.Mesh(new T.PlaneGeometry(1.2, 2.0), winM); w.position.set(x, 1.8, z); scene.add(w); box(1.4, 0.12, 0.2, frameM, x, 0.74, z + 0.05); box(1.4, 0.12, 0.12, frameM, x, 2.86, z + 0.03); };
    for (const x of [15.5, 22]) windowAt(x, 2.02); for (const x of [31, 36]) windowAt(x, 2.02);
    // banderas
    const flagT = tex(24, 16, g => { R(g, '#74acdf', 0, 0, 24, 16); R(g, '#f8f8f8', 0, 5, 24, 6); R(g, '#f0b020', 11, 7, 2, 2); R(g, '#c88a10', 10, 8, 4, 1); });
    const flag = (x, z) => { box(0.04, 2.6, 0.04, goldM, x, 1.3, z); const f = new T.Mesh(new T.PlaneGeometry(0.9, 0.6), U.mat({ map: flagT, side: T.DoubleSide })); f.position.set(x + 0.47, 2.2, z); scene.add(f); };
    flag(13, 2.6); flag(24.5, 2.6); flag(29, 2.6);

    // ---- Salón de Acuerdos: mesa larga y 14 sillas
    const tableTop = box(7.6, 0.08, 1.7, woodM, 18.8, 0.78, 7.3); box(7.2, 0.7, 0.1, woodM, 18.8, 0.4, 7.3);
    col.box(15.0, 6.45, 22.6, 8.15);
    const chairM = U.mat({ color: 0x6a2a20, rough: 0.8 });
    for (let k = 0; k < 7; k++) for (const s of [-1, 1]) { const cx = 15.6 + k * 1.07, cz = 7.3 + s * 1.15; box(0.45, 0.06, 0.45, chairM, cx, 0.47, cz); box(0.45, 0.65, 0.06, chairM, cx, 0.8, cz + s * 0.22); }
    // ---- Despacho: escritorio, maqueta, cuadro del Ministro (caja fuerte), bibliotecas, montañas de expedientes
    box(2.6, 0.8, 1.1, woodM, 33, 0.4, 5.2, { solid: true });
    const maq = new T.Group(); maq.position.set(32.6, 0.81, 5.2); scene.add(maq);
    box(1.0, 0.04, 0.7, U.mat({ color: 0x3a6a3a }), 0, 0.02, 0, { parent: maq });
    for (let k = 0; k < 7; k++) box(0.08 + rnd() * 0.1, 0.06 + rnd() * 0.2, 0.08 + rnd() * 0.1, U.mat({ color: U.pick(rnd, [0xe8e0d0, 0xd0c8b8, 0xa8b8c8]) }), (rnd() - 0.5) * 0.8, 0.1, (rnd() - 0.5) * 0.5, { parent: maq });
    box(0.9, 0.02, 0.08, U.mat({ color: 0x4a6aa8, emissive: 0x0a1a3a }), 0, 0.05, 0.1, { parent: maq });
    box(0.12, 0.005, 0.12, U.mat({ color: 0xf8e848, emissive: 0x3a3000 }), 0.4, 0.05, 0.28, { parent: maq });
    const lampD = new T.PointLight(U.C(0x90ff90), 0.6, 3, 2); lampD.position.set(34, 1.3, 5.2); scene.add(lampD);
    box(0.25, 0.04, 0.25, metalM, 34, 0.83, 5.2); const ls = new T.Mesh(new T.ConeGeometry(0.15, 0.15, 6), U.mat({ color: 0x2a8a3a, emissive: 0x0a3a10 })); ls.position.set(34, 1.15, 5.2); scene.add(ls);
    const minPort = addPortrait(33, 1.9, 2.06, 0, true, 1.1);
    const safe = new T.Group(); safe.position.set(33, 1.85, 2.05); scene.add(safe);
    box(0.8, 0.8, 0.12, U.mat({ color: 0x3a3e44, rough: 0.4, metal: 0.7 }), 0, 0, 0, { parent: safe });
    for (let k = 0; k < 3; k++) { const d = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.05, 10), goldM); d.rotation.x = Math.PI / 2; d.position.set(-0.22 + k * 0.22, 0.05, 0.08); safe.add(d); }
    safe.visible = false;
    for (const x of [29.2, 37.6]) { box(0.5, 2.6, 3.0, woodM, x, 1.3, 4.5, { solid: true, opaque: true }); for (let s = 0; s < 4; s++) box(0.4, 0.4, 2.8, U.mat({ color: U.pick(rnd, [0x7a2a2a, 0x2a4a6a, 0x3a5a2a, 0x8a6a2a]) }), x + (x < 33 ? 0.05 : -0.05), 0.5 + s * 0.6, 4.5); }
    const pile = (x, z, h, o = {}) => { const g = new T.Group(); g.position.set(x, 0, z); scene.add(g); let y = 0; while (y < h) { const t = 0.12 + rnd() * 0.25, b = new T.Mesh(new T.BoxGeometry(0.62 + rnd() * 0.1, t, 0.45 + rnd() * 0.08), folderM); b.position.set((rnd() - 0.5) * 0.08, y + t / 2, (rnd() - 0.5) * 0.08); b.rotation.y = (rnd() - 0.5) * 0.3; b.castShadow = b.receiveShadow = true; g.add(b); y += t; } if (o.solid !== false) { const c = col.box(x - 0.36, z - 0.28, x + 0.36, z + 0.28); if (h > 1.1) c.opaque = true; } return g; };
    pile(30.2, 9.8, 1.8); pile(31.1, 10.1, 1.3); pile(36.8, 9.6, 2.0); pile(35.6, 2.8, 0.9); pile(30.4, 2.8, 1.5);
    box(2.2, 0.5, 0.8, U.mat({ color: 0x5a2a20 }), 33, 0.3, 10.4, { solid: true }); box(2.2, 0.6, 0.2, U.mat({ color: 0x5a2a20 }), 33, 0.7, 10.75);
    // ---- Pasillo: placard de banderines
    box(1.6, 2.4, 0.8, woodM, 3.0, 1.2, 14.5, { solid: true, opaque: true });
    box(0.06, 2.2, 0.02, U.mat({ color: 0x2a1a10 }), 3.0, 1.2, 14.91, { shadow: false });
    for (const x of [8.5, 26]) { const p = new T.Mesh(new T.CylinderGeometry(0.25, 0.18, 0.5, 8), U.mat({ color: 0x8a4a2a })); p.position.set(x, 0.25, 14.5); scene.add(p); const pl = new T.Mesh(new T.IcosahedronGeometry(0.55, 0), U.mat({ color: 0x2a6a2a })); pl.position.set(x, 1.0, 14.5); pl.castShadow = true; scene.add(pl); col.circle(x, 14.5, 0.35); }
    // ---- Mesa de Entradas: mostrador, bancos, radio, cartel
    box(7, 1.05, 0.7, woodM, 18.5, 0.52, 22.8, { solid: true }); box(7.1, 0.06, 0.85, U.mat({ color: 0x8a6a4a }), 18.5, 1.07, 22.8);
    const vueT = U.tex(U.canvas(48, 12, g => { R(g, '#f4f0e0', 0, 0, 48, 12); U.text(g, 'VUELVA MAÑANA', 24, 2, { align: 'center', size: 7, color: '#b82a1a' }); }), { repeat: false, mips: false });
    const vue = new T.Mesh(new T.PlaneGeometry(1.4, 0.35), U.mat({ map: vueT })); vue.position.set(18.5, 1.32, 23.18); vue.rotation.x = -0.15; scene.add(vue);
    box(0.06, 0.3, 0.06, metalM, 18, 1.15, 23.1); box(0.06, 0.3, 0.06, metalM, 19, 1.15, 23.1);
    for (const x of [14.2, 16.4, 20.6, 22.8]) pile(x, 22.6, 0.4 + rnd() * 0.6, { solid: false });
    for (const z of [26.5, 28.5]) { box(3, 0.08, 0.5, woodM, 15.2, 0.45, z, { solid: true }); box(3, 0.5, 0.06, woodM, 15.2, 0.75, z + 0.22); box(3, 0.08, 0.5, woodM, 21.8, 0.45, z, { solid: true }); box(3, 0.5, 0.06, woodM, 21.8, 0.75, z + 0.22); }
    box(0.5, 0.75, 0.5, woodM, 23.4, 0.37, 28.6, { solid: true });
    const radio = box(0.4, 0.22, 0.16, U.mat({ color: 0x8a3a2a, rough: 0.6 }), 23.4, 0.86, 28.6); box(0.14, 0.14, 0.02, U.mat({ color: 0xd8c8a0 }), 23.5, 0.86, 28.69);
    const ticket = box(0.35, 1.2, 0.3, U.mat({ color: 0xb83a2a }), 12.6, 0.6, 20.6, { solid: true });
    box(2, 0.5, 0.15, U.mat({ map: wood, color: 0x6a4a30 }), 19, 0.25, 31.05); box(1.6, 0.01, 0.9, U.mat({ color: 0x6a2020 }), 19, 0.005, 30.4, { shadow: false });
    // ---- Archivo: estanterías metálicas, cajas, pilas
    const shelf = (x, z, w) => {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      for (const sx of [-w / 2, w / 2]) for (const sz of [-0.3, 0.3]) box(0.05, 2.4, 0.05, metalM, sx, 1.2, sz, { parent: g, shadow: false });
      for (let k = 0; k < 5; k++) { box(w, 0.04, 0.65, metalM, 0, 0.15 + k * 0.55, 0, { parent: g }); for (let b = 0; b < w / 0.45 - 1; b++) if (rnd() < 0.8) box(0.38, 0.3, 0.45, U.mat({ color: U.pick(rnd, [0xb89a6a, 0xa88a5a, 0xc8aa7a]), map: folderT }), -w / 2 + 0.3 + b * 0.45, 0.33 + k * 0.55, 0, { parent: g }); }
      col.box(x - w / 2, z - 0.35, x + w / 2, z + 0.35).opaque = true;
    };
    shelf(31.5, 23.3, 4.0); shelf(31.5, 27.0, 4.0); shelf(36.0, 25.2, 3.0); shelf(31.5, 30.5, 4.0);
    const estante = new T.Group(); estante.position.set(36.2, 0, 20.45); scene.add(estante);
    box(2.2, 2.2, 0.5, woodM, 0, 1.1, 0, { parent: estante }); for (let k = 0; k < 3; k++) box(2.0, 0.05, 0.45, U.mat({ color: 0x3a2a1a }), 0, 0.5 + k * 0.6, 0.03, { parent: estante });
    const estT = U.tex(U.canvas(32, 8, g => { R(g, '#e8dcb8', 0, 0, 32, 8); U.text(g, 'ESTANTE 1865', 16, 0, { align: 'center', size: 7, color: '#2a1a10' }); }), { repeat: false, mips: false });
    const estS = new T.Mesh(new T.PlaneGeometry(1.4, 0.35), U.mat({ map: estT })); estS.position.set(0, 2.0, 0.27); estante.add(estS);
    col.box(35.1, 20, 37.3, 20.75);
    const ordered = [];
    pile(37.6, 31.2, 1.9); // la pila escondite
    pile(28.0, 31.2, 1.4);

    // ============================================================ expedientes del archivo (12 pilas, 3 verdaderas)
    const spots = [[28.2, 21.0], [29.2, 24.7], [33.9, 24.6], [28.2, 28.8], [34.3, 28.8], [37.7, 22.0], [37.7, 28.5], [29.5, 31.3], [33.8, 21.2], [28.0, 26.2], [34.4, 31.1], [36.0, 27.0]];
    const kinds = U.shuffle(rnd, spots.map((s, i) => i));
    const docs = spots.map((s, i) => {
      const k = kinds.indexOf(i), real = k < 3 ? REALES[k] : null;
      const g = pile(s[0], s[1], 0.35 + rnd() * 0.5, { solid: false });
      return { x: s[0], z: s[1], real, fake: real ? null : FALSOS[(k - 3) % FALSOS.length], g, taken: false, read: false };
    });
    const sparkle = st.particles({ mode: 'dust', count: 60, center: [32.5, 1.2, 26], box: [11, 2.4, 11], size: 0.025, color: 0xd8e0c8, bright: 0.6, far: 30, speed: 0.5 });
    st.particles({ mode: 'dust', count: 80, center: [18.8, 1.4, 7], box: [14, 2.8, 11], size: 0.022, color: 0xffe0b0, bright: 0.45, far: 30, speed: 0.4 });

    // ============================================================ jugador y ordenanzas
    const player = U.person({ skin: '#c8956a', hair: '#2a1a10', shirt: '#3a6a4a', pants: '#2a2a3a', shoes: '#1a1410' });
    scene.add(player);
    const Pl = { x: 18.5, z: 29.6, yaw: Math.PI, hidden: null, speed: 0 };
    let checkpoint = { x: Pl.x, z: Pl.z };
    const GLOOK = { skin: '#b07a52', hair: '#1a1a1a', shirt: '#4a5a7a', pants: '#2a2a3a', hat: '#2a3a5a' };
    const visionR = v => ({ corta: 4.2, media: 5.6, larga: 7.2 }[v] || 5.2) * (0.86 + diff * 0.025);
    const GDEF = opts.guardias || [{ name: 'Ordenanza Benítez', vision: 'corta', linea: '¿Quién anda? ...Será el aire acondicionado.' }, { name: 'Ordenanza Romero', vision: 'media', linea: 'Uy, el partido. Ya vuelvo.' }];
    const ROUTES = [
      [[5, 16.2, 2.2], [20, 16.2, 0], [34.5, 16.2, 2.0], [20, 16.2, 0], [18.9, 12.2, 0], [18.9, 10.0, 0], [13.0, 9.9, 0], [13.0, 3.2, 1.6], [24.7, 3.2, 0], [24.7, 9.9, 2.0], [18.9, 10.0, 0], [18.9, 12.2, 0], [18.9, 16.2, 0]],
      [[14, 24.2, 1.2], [23.2, 24.2, 0], [23.2, 27.6, 5.5, 'radio'], [24.2, 25.9, 0], [27.6, 25.9, 0], [29.2, 25.2, 0], [34.3, 25.2, 0], [34.3, 21.6, 1.2], [28.6, 21.6, 0], [28.4, 25.2, 0], [28.4, 28.9, 0], [34.0, 28.9, 0], [37.2, 29.6, 1.8], [33.5, 28.9, 0], [28.4, 28.9, 0], [28.4, 25.9, 0], [27.6, 25.9, 0], [24.2, 25.9, 0], [15, 26.0, 1.5]],
    ];
    const coneMat = new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.4, 0.5), transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
    const markT = ['?', '!'].map(ch => U.tex(U.canvas(8, 12, g => { R(g, '#1a1a1a', 1, 0, 6, 12); R(g, ch === '!' ? '#ff4020' : '#f0c030', 2, 1, 4, 10); U.text(g, ch, 4, 1, { align: 'center', size: 9, color: '#1a1a1a' }); }), { repeat: false, mips: false }));
    const guards = GDEF.slice(0, 2).map((d, k) => {
      const m = U.person(Object.assign({}, GLOOK, k ? { shirt: '#5a6a5a', skin: '#c89a70' } : {})); scene.add(m);
      const route = ROUTES[k], seg = 40;
      const geo = new T.BufferGeometry(); const pos = new Float32Array((seg + 2) * 3); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const idx = []; for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1); geo.setIndex(idx);
      const cone = new T.Mesh(geo, coneMat.clone()); cone.frustumCulled = false; cone.renderOrder = 3; scene.add(cone);
      const torch = new T.SpotLight(U.C(0xfff0c0), 2.2, visionR(d.vision) + 2, 0.55, 0.6, 1.5); scene.add(torch); scene.add(torch.target);
      const mark = new T.Sprite(new T.SpriteMaterial({ map: markT[0], depthTest: false })); mark.scale.set(0.45, 0.65, 1); mark.visible = false; scene.add(mark);
      const [sx, sz] = route[k ? 0 : 0];
      return { d, m, route, wp: 0, x: sx, z: sz, yaw: 0, pause: 0, look: 0, meter: 0, sus: 0, cone, pos, seg, torch, mark, range: visionR(d.vision), half: 0.62, said: 0, speed: 1.05 + diff * 0.05 };
    });
    // Romero arranca del lado del archivo para no pisar la entrada
    guards[1].wp = 6; guards[1].x = ROUTES[1][5][0]; guards[1].z = ROUTES[1][5][1];
    const HIDES = [
      { key: 'pila', x: 37.6, z: 30.3, hx: 37.6, hz: 31.0, txt: 'Esconderte detrás de la pila de expedientes' },
      { key: 'mesa', x: 18.8, z: 8.6, hx: 18.8, hz: 7.3, txt: 'Meterte debajo de la mesa larga' },
      { key: 'placard', x: 3.0, z: 15.4, hx: 3.0, hz: 14.6, txt: 'Meterte en el placard de los banderines' },
      { key: 'mostrador', x: 21.8, z: 23.6, hx: 21.8, hz: 22.4, txt: 'Agacharte detrás del mostrador' },
    ];
    const wantH = (SIG.escondites || []).join(' ').toLowerCase();
    const hides = HIDES.filter(h => !wantH || wantH.includes(h.key) || h.key === 'mostrador');

    // ============================================================ HUD
    const hudBox = st.el('cs3d-hud t'); hudBox.style.cssText = 'top:16px;right:16px;text-align:right;font-size:10px;line-height:2.1';
    const notesEl = st.el('cs3d-hud t'); notesEl.style.cssText = 'left:16px;bottom:16px;font-size:9px;line-height:1.9;max-width:44vw;background:rgba(10,8,6,.75);border:2px solid #6a5a40;padding:8px 10px;box-shadow:4px 4px 0 #000;display:none';
    const safeEl = st.el('cs3d-hud t'); safeEl.style.cssText = 'inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)';
    let timeLeft = TIME, vistas = 0, phase = 'archivo', collected = [], safeState = null, finished = false, readPostit = false;
    const showNotes = () => {
      if (!collected.length && phase !== 'safe') { notesEl.style.display = 'none'; return; }
      notesEl.style.display = 'block';
      let h = '<b style="color:#f0c030;font-weight:normal">LIBRETA</b><br>';
      const list = phase === 'safe' ? ordered : collected;
      h += list.map(r => `· ${r.titulo.length > 46 ? r.titulo.slice(0, 44) + '…' : r.titulo}${diff < 7 || phase === 'safe' ? ` <span style="color:#9ad0ff">(${r.fecha})</span>` : ''}${phase === 'safe' ? `<br>&nbsp;&nbsp;<span style="color:#f0c030">${r.pista}</span>` : ''}`).join('<br>');
      if (readPostit) h += `<br><span style="color:#f8e848">Post-it: ${POSTIT.replace(/^Un post-it[^:]*:\s*/i, '')}</span>`;
      notesEl.innerHTML = h;
    };
    const hudUpdate = () => {
      const m = Math.floor(Math.max(0, timeLeft) / 60), s = Math.floor(Math.max(0, timeLeft) % 60);
      hudBox.innerHTML = `TIEMPO <b style="color:${timeLeft < 45 ? '#ff6040' : '#f0c030'};font-weight:normal">${m}:${String(s).padStart(2, '0')}</b><br>` +
        `TE VIERON <b style="color:${vistas ? '#ff8060' : '#f0c030'};font-weight:normal">${vistas}/${VMAX}</b><br>EXPEDIENTES <b style="color:#f0c030;font-weight:normal">${collected.length}/3</b>` +
        (Pl.hidden ? '<br><span style="color:#9ad0ff">ESCONDIDO</span>' : '');
    };
    const setObj = txt => st.objective(`<b>${TITLE.toUpperCase()}</b><br>${txt}`);
    setObj('Entrá al Archivo (puerta a la derecha de Mesa de Entradas) con la llave de Ñoquetti.');
    st.titleCard(TITLE, INTRO, 4.5);
    st.showKeys(['[WASD ←↑↓→] caminar', '[ESPACIO] usar · leer · esconderse', 'Que no te vean los conos de luz de los ordenanzas', '[SHIFT] caminar en puntas de pie (más lento, menos ruido)'], 14);
    hudUpdate();

    // ============================================================ lógica
    const amb = SND.loop({ freq: 140, vol: 0.03 });
    const radioS = SND.loop({ freq: 1400, filter: 'bandpass', q: 3, vol: 0.0 });
    const interactables = () => {
      const out = [];
      if (archLocked) out.push({ x: 24.6, z: 25.9, r: 1.4, txt: 'Abrir el Archivo con la llave de Ñoquetti', fn: () => { archLocked = false; SND.noise(0.5, { freq: 800, vol: 0.2, filter: 'bandpass', q: 3 }); SND.tone(1200, 0.08, { vol: 0.05 }); st.toast('Clic. La llave de Ñoquetti abre el Archivo.', 2.4); setObj('Buscá entre las pilas los TRES expedientes verdaderos (leelos con ESPACIO).'); } });
      if (phase === 'archivo') for (const d of docs) if (!d.taken) out.push({ x: d.x, z: d.z, r: 1.15, txt: d.read ? 'Releer el expediente' : 'Revisar la pila de expedientes', fn: () => readDoc(d) });
      if (phase === 'ordenar' || (phase === 'archivo' && collected.length === 3)) out.push({ x: 36.2, z: 21.3, r: 1.5, txt: 'Ordenar los expedientes en el ESTANTE 1865', fn: orderDocs });
      out.push({ x: 32.6, z: 6.2, r: 1.4, txt: 'Leer el post-it de la maqueta', fn: () => { readPostit = true; st.say('Maqueta del "Paseo Subterráneo del Bicentenario"', POSTIT); showNotes(); } });
      if (phase === 'safe') out.push({ x: 33, z: 3.0, r: 1.6, txt: safe.visible ? 'Abrir la caja fuerte' : 'Correr el cuadro del Ministro', fn: openSafe });
      else out.push({ x: 33, z: 3.0, r: 1.6, txt: 'Mirar el cuadro del Ministro', fn: () => st.say('', 'El Ministro sonríe con todos los dientes. Uno es de oro. El cuadro está torcido, como si alguien lo corriera seguido.') });
      out.push({ x: 18.5, z: 23.7, r: 1.4, txt: 'Leer el cartel', fn: () => st.say(salaName('mesa_entradas'), (salaInfo.mesa_entradas && salaInfo.mesa_entradas.texto) || 'Un cartel: "VUELVA MAÑANA".') });
      out.push({ x: 19, z: 30.4, r: 1.2, txt: 'Salir (abandonar)', fn: () => { st.toast('Todavía no tenés lo que viniste a buscar.', 2); } });
      for (const h of hides) out.push({ x: h.x, z: h.z, r: 1.2, txt: h.txt, fn: () => hide(h) });
      return out;
    };
    async function readDoc(d) {
      d.read = true;
      if (d.real) {
        await st.say('Expediente', `${d.real.titulo}\nFecha: ${d.real.fecha}.`);
        if (!d.taken) {
          d.taken = true; d.g.visible = false; collected.push(d.real); st.flash(0xffe080, 0.25);
          [523, 659, 784].forEach((f, n) => SND.tone(f, 0.15, { type: 'square', vol: 0.05, delay: n * 0.08 }));
          st.toast(`¡Este es de verdad! Lo guardás. (${collected.length}/3)`, 2.4);
          if (collected.length === 3) { phase = 'ordenar'; setObj('Ordená los tres expedientes por fecha en el ESTANTE 1865 (pared norte del Archivo).'); }
        }
        showNotes(); hudUpdate();
      } else { SND.noise(0.15, { freq: 2000, vol: 0.1 }); await st.say('Expediente trucho', d.fake); }
    }
    async function orderDocs() {
      if (collected.length < 3) { st.toast(`Te faltan expedientes (${collected.length}/3).`, 2); return; }
      const left = collected.slice(), pick = [];
      const ord = ['PRIMERO', 'SEGUNDO', 'TERCERO'];
      for (let k = 0; k < 3; k++) {
        if (left.length === 1) { pick.push(left[0]); break; }
        const i = await st.choose('Estante 1865', `¿Cuál va ${ord[k]}? (del más viejo al más nuevo)`, left.map(r => r.titulo.length > 60 ? r.titulo.slice(0, 58) + '…' : r.titulo));
        if (st.done) return;
        pick.push(left.splice(i, 1)[0]);
      }
      const key = s => { const m = String(s.fecha).match(/(\d{4})/), y = m ? +m[1] : 0, mm = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].findIndex(x => String(s.fecha).toLowerCase().includes(x)), dd = parseInt(s.fecha) || 0; return y * 10000 + mm * 100 + dd; };
      const ok = pick.every((r, i) => i === 0 || key(pick[i - 1]) <= key(r));
      if (!ok) { timeLeft -= 10; SND.tone(160, 0.4, { type: 'sawtooth', vol: 0.08 }); st.toast('Mmm, no. Mirá bien las fechas. (−10 s)', 2.6, '#ff8060'); return; }
      ordered.splice(0, 3, ...pick); phase = 'safe';
      [392, 523, 659, 784].forEach((f, n) => SND.tone(f, 0.18, { type: 'square', vol: 0.05, delay: n * 0.09 }));
      showNotes();
      await st.talk(pick.map(r => ({ who: r.fecha, text: r.pista })));
      setObj('Andá al despacho del Ministro (pasando el Salón de Acuerdos) y abrí la caja fuerte.');
    }
    function openSafe() {
      if (!safe.visible) { safe.visible = true; minPort.rotation.y = 0.9; minPort.position.x -= 0.6; minPort.position.z += 0.3; SND.noise(0.4, { freq: 400, vol: 0.15 }); st.toast('Detrás del cuadro: una caja fuerte de tres ruedas.', 2.4); return; }
      safeState = { vals: [0, 0, 0], sel: 0, tries: SAFE_TRIES };
      st.busy++; safeEl.style.display = 'flex'; renderSafe();
    }
    function renderSafe() {
      const s = safeState;
      safeEl.innerHTML = `<div style="background:#16181c;border:3px solid #c8a040;box-shadow:6px 6px 0 #000;padding:20px 26px;text-align:center;font-size:11px;line-height:2">
        <div style="color:#f0c030">CAJA FUERTE DEL MINISTRO</div>
        <div style="display:flex;gap:18px;justify-content:center;margin:12px 0">${s.vals.map((v, i) => `<div style="width:64px;padding:8px 0;border:3px solid ${i === s.sel ? '#f0c030' : '#5a5a5a'};background:#0c0c0e;font-size:22px;color:${i === s.sel ? '#fff' : '#aaa'}">▲<br>${String(v).padStart(2, '0')}<br>▼</div>`).join('')}</div>
        <div>[← →] rueda · [↑ ↓] número · [ENTER] probar · [Q] cerrar</div><div style="color:#ff8060">Intentos: ${s.tries}</div></div>`;
    }
    function safeInput() {
      const s = safeState;
      if (st.hit('ArrowLeft', 'KeyA')) { s.sel = (s.sel + 2) % 3; SND.tone(600, 0.03, { vol: 0.04 }); renderSafe(); }
      if (st.hit('ArrowRight', 'KeyD')) { s.sel = (s.sel + 1) % 3; SND.tone(600, 0.03, { vol: 0.04 }); renderSafe(); }
      if (st.hit('ArrowUp', 'KeyW')) { s.vals[s.sel] = (s.vals[s.sel] + 1) % 40; SND.noise(0.03, { freq: 3000, vol: 0.08, filter: 'highpass' }); renderSafe(); }
      if (st.hit('ArrowDown', 'KeyS')) { s.vals[s.sel] = (s.vals[s.sel] + 39) % 40; SND.noise(0.03, { freq: 3000, vol: 0.08, filter: 'highpass' }); renderSafe(); }
      if (st.hit('KeyQ', 'Backspace')) { safeState = null; safeEl.style.display = 'none'; st.busy--; return; }
      if (st.hit('Enter', 'Space')) {
        if (s.vals.every((v, i) => v === COMBO[i])) {
          safeState = null; safeEl.style.display = 'none'; st.busy--; win(); return;
        }
        s.tries--; SND.tone(140, 0.5, { type: 'sawtooth', vol: 0.08 }); st.shake(0.2);
        if (s.tries <= 0) { safeState = null; safeEl.style.display = 'none'; st.busy--; lose('Suena una alarmita ridícula, tipo juguete. Igual vienen todos.'); return; }
        renderSafe();
      }
    }
    async function win() {
      finished = true;
      [523, 659, 784, 1046, 1318].forEach((f, n) => SND.tone(f, 0.22, { type: 'square', vol: 0.06, delay: n * 0.1 }));
      safe.children.forEach((c, k) => { if (k) c.rotation.z = 1; });
      await st.say('Caja fuerte', 'Clac, clac, clac. Adentro: ' + CONTENIDO.join(' · ') + '.');
      await st.say('', WIN_TXT);
      st.finish({ ok: true, score: Math.round(600 + timeLeft * 3 + (VMAX - vistas) * 120 + diff * 50), message: '¡Tenés el plano!', data: { seconds: Math.round(TIME - timeLeft), vistas } });
    }
    async function lose(why) {
      if (finished) return; finished = true;
      SND.tone(220, 0.5, { type: 'sawtooth', vol: 0.08 }); SND.tone(165, 0.7, { type: 'sawtooth', vol: 0.08, delay: 0.4 });
      if (why) await st.say('', why);
      await st.say('', LOSE_TXT);
      st.finish({ ok: false, data: { reason: why || 'visto', vistas, seconds: Math.round(TIME - timeLeft) } });
    }
    function hide(h) {
      Pl.hidden = h; Pl.x = h.hx; Pl.z = h.hz; SND.noise(0.2, { freq: 600, vol: 0.12 });
      st.toast('Escondido. [ESPACIO] o moverte para salir.', 1.8); hudUpdate();
    }
    let caughtBusy = false;
    async function caught(g) {
      caughtBusy = true; vistas++; hudUpdate();
      st.flash(0xff4020, 0.5); st.shake(0.5); SND.tone(880, 0.12, { type: 'square', vol: 0.08 }); SND.tone(660, 0.25, { type: 'square', vol: 0.08, delay: 0.12 });
      await st.say(g.d.name, SEEN_TXT);
      if (vistas >= VMAX) { await lose(null); return; }
      await st.fadeTo(1, 0.4);
      Pl.x = checkpoint.x; Pl.z = checkpoint.z; Pl.hidden = null;
      for (const gg of guards) { gg.meter = 0; gg.sus = 0; }
      // el ordenanza se va a seguir la ronda: lo corremos un poco para darte aire
      g.wp = (g.wp + 3) % g.route.length; g.x = g.route[g.wp][0]; g.z = g.route[g.wp][1];
      await st.fadeTo(0, 0.5);
      st.toast(`Volvés al principio de la sala. Te vieron ${vistas} de ${VMAX}.`, 2.6, '#ff8060');
      caughtBusy = false;
    }
    let curRoom = null;
    function updateRoom() {
      const r = roomAt(Pl.x, Pl.z);
      if (r && r !== curRoom) {
        curRoom = r; checkpoint = { x: Pl.x, z: Pl.z };
        const info = salaInfo[r.id]; st.toast(`<b>${salaName(r.id)}</b>${info && info.texto ? '<br><span style="font-size:.7em;color:#e8dcc0">' + info.texto + '</span>' : ''}`, 3);
      }
    }
    // rayos del cono de visión contra paredes y cosas altas
    const rayLen = (x, z, a, max) => {
      const dx = Math.sin(a), dz = Math.cos(a);
      for (let s = 0.2; s < max; s += 0.2) {
        const px = x + dx * s, pz = z + dz * s;
        if (!isFloor(Math.floor(px), Math.floor(pz))) return s;
        if (archLocked && px > 25 && px < 27 && pz > 25 && pz < 27) return s;
        for (const b of col.boxes) if (b.on && b.opaque && px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1) return s;
      }
      return max;
    };
    function updateGuard(g, dt, t) {
      const target = g.route[g.wp];
      const sus = g.meter > 0.3;
      if (sus) { // se queda mirando hacia donde vio algo
        const a = Math.atan2(Pl.x - g.x, Pl.z - g.z); g.yaw = U.damp(g.yaw, g.yaw + angDiff(a, g.yaw), 3, dt);
        g.mark.material.map = markT[g.meter > 0.75 ? 1 : 0]; g.mark.visible = true;
        U.animPerson(g.m, 0, dt);
      } else if (g.pause > 0) {
        g.pause -= dt; g.mark.visible = false;
        if (target[3] === 'radio') { g.yaw = U.damp(g.yaw, 0.6, 3, dt); if (!g.said) { g.said = 1; say3d(g, g.d.linea || 'Uy, el partido.'); } }
        else g.yaw += Math.sin(t * 1.4 + g.look) * dt * 1.2;
        U.animPerson(g.m, 0, dt);
        if (g.pause <= 0) { g.wp = (g.wp + 1) % g.route.length; g.said = 0; }
      } else {
        g.mark.visible = false;
        const dx = target[0] - g.x, dz = target[1] - g.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { g.pause = target[2] || 0; if (!g.pause) g.wp = (g.wp + 1) % g.route.length; }
        else {
          const sp = g.speed * dt, k = Math.min(1, sp / d); g.x += dx * k; g.z += dz * k;
          const a = Math.atan2(dx, dz); g.yaw += angDiff(a, g.yaw) * Math.min(1, dt * 6);
          U.animPerson(g.m, g.speed, dt);
        }
      }
      g.m.position.set(g.x, 0, g.z); g.m.rotation.y = g.yaw;
      g.mark.position.set(g.x, 2.5, g.z);
      // la puerta del archivo se abre si pasa Romero
      // cono
      const R0 = g.range * (Pl.sneak ? 0.85 : 1);
      g.pos[0] = g.x; g.pos[1] = 0.04; g.pos[2] = g.z;
      for (let i = 0; i <= g.seg; i++) { const a = g.yaw - g.half + (2 * g.half) * i / g.seg, L = rayLen(g.x, g.z, a, R0); g.pos[(i + 1) * 3] = g.x + Math.sin(a) * L; g.pos[(i + 1) * 3 + 1] = 0.04; g.pos[(i + 1) * 3 + 2] = g.z + Math.cos(a) * L; }
      g.cone.geometry.attributes.position.needsUpdate = true; g.cone.geometry.computeBoundingSphere();
      const cm = g.cone.material; cm.color.setRGB(1.6 + g.meter * 1.6, 1.4 - g.meter * 1.2, 0.5 - g.meter * 0.4); cm.opacity = 0.2 + g.meter * 0.25;
      g.torch.position.set(g.x + Math.sin(g.yaw) * 0.3, 1.4, g.z + Math.cos(g.yaw) * 0.3); g.torch.target.position.set(g.x + Math.sin(g.yaw) * 4, 0, g.z + Math.cos(g.yaw) * 4);
      // detección
      if (finished || caughtBusy) return;
      const dx = Pl.x - g.x, dz = Pl.z - g.z, dist = Math.hypot(dx, dz);
      let see = false;
      if (!Pl.hidden && dist < R0) {
        const a = Math.atan2(dx, dz), da = Math.abs(angDiff(a, g.yaw));
        if (da < g.half + 0.05 && rayLen(g.x, g.z, a, dist) >= dist - 0.05) see = true;
        if (dist < 0.9 && !Pl.sneak) see = true; // te choca
      }
      if (see) { g.meter += dt * (1.1 + diff * 0.14) * (1.25 - dist / R0 * 0.7) * (Pl.speed > 0.1 ? 1.15 : 0.8); g.sus = 1; }
      else { g.meter = Math.max(0, g.meter - dt * 0.35); if (g.sus && g.meter <= 0) { g.sus = 0; say3d(g, U.pick(rnd, [g.d.linea || '¿Quién anda?', '¿Quién anda? ...Será el aire acondicionado.', 'Debe ser un gato. O un ñoqui.', 'Mmm. Nada.'])); } }
      if (g.meter >= 1) { g.meter = 1; caught(g); }
    }
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const sayEl = st.el('cs3d-hud t'); sayEl.style.cssText = 'font-size:9px;background:rgba(244,236,212,.95);color:#1a1008;text-shadow:none;border:2px solid #1a1008;padding:5px 8px;box-shadow:3px 3px 0 #000;transform:translate(-50%,-100%);white-space:nowrap;opacity:0;transition:opacity .2s';
    let sayG = null, sayT = 0;
    function say3d(g, text) { sayG = g; sayT = 2.8; sayEl.textContent = `${g.d.name.replace('Ordenanza ', '')}: ${text}`; sayEl.style.opacity = 1; }
    const tmpV = new T.Vector3();
    window.__cg = { Pl, guards, docs, get phase() { return phase; }, set phase(v) { phase = v; }, collected, unlock() { archLocked = false; } };

    // cámara
    const camOff = new T.Vector3(0, 10.5, 7.8);
    const camPos = new T.Vector3(Pl.x, 0, Pl.z).add(camOff);
    cam.position.copy(camPos); cam.lookAt(Pl.x, 0, Pl.z - 0.6);
    let promptFn = null, footT = 0;
    return {
      update(dt, t) {
        if (!finished) { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; lose('Se te hizo de día. Llegan los empleados... y no hay nada que hacer, como siempre.'); } }
        if (safeState) safeInput();
        // movimiento
        const ax = st.axis();
        Pl.sneak = st.down('ShiftLeft', 'ShiftRight');
        let mvx = ax.x, mvz = -ax.y;
        if (st.busy || caughtBusy || finished) { mvx = 0; mvz = 0; }
        if (Pl.hidden && (mvx || mvz)) { Pl.hidden = null; hudUpdate(); }
        const len = Math.hypot(mvx, mvz), spd = Pl.sneak ? 1.5 : 3.0;
        if (len > 0 && !Pl.hidden) {
          const vx = mvx / len * spd, vz = mvz / len * spd;
          const p = { x: Pl.x + vx * dt, z: Pl.z + vz * dt }; col.resolve(p, 0.3); Pl.x = p.x; Pl.z = p.z;
          Pl.yaw += angDiff(Math.atan2(vx, vz), Pl.yaw) * Math.min(1, dt * 12); Pl.speed = spd;
          footT -= dt; if (footT <= 0) { footT = Pl.sneak ? 0.55 : 0.36; SND.noise(0.05, { freq: Pl.sneak ? 500 : 900, vol: Pl.sneak ? 0.03 : 0.07 }); }
        } else Pl.speed = 0;
        player.position.set(Pl.x, 0, Pl.z); player.rotation.y = Pl.yaw;
        player.scale.y = U.damp(player.scale.y, Pl.hidden ? 0.55 : Pl.sneak ? 0.85 : 1, 10, dt);
        player.visible = true;
        U.animPerson(player, Pl.speed, dt);
        updateRoom();
        // puerta del archivo
        const nearDoor = guards.some(g => Math.abs(g.x - 26) < 2.2 && Math.abs(g.z - 25.9) < 1.6) || (!archLocked && Math.abs(Pl.x - 26) < 2 && Math.abs(Pl.z - 25.9) < 1.5);
        archLeaf.rotation.y = U.damp(archLeaf.rotation.y, nearDoor ? -1.5 : 0, 5, dt);
        for (const g of guards) updateGuard(g, dt, t);
        // radio con el partido
        const rd = Math.hypot(Pl.x - 23.4, Pl.z - 28.6); radioS.set(Math.max(0, 0.03 - rd * 0.0025)); amb.set(0.03);
        // interacciones
        let best = null, bd = 1e9;
        if (!st.busy && !caughtBusy && !finished) for (const it of interactables()) { const d = Math.hypot(Pl.x - it.x, Pl.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
        if (Pl.hidden) best = { txt: 'Salir del escondite', fn: () => { Pl.hidden = null; hudUpdate(); } };
        st.prompt(best ? `<b>[ESPACIO]</b> ${best.txt}` : null);
        if (best && st.action()) best.fn();
        // cámara
        tmpV.set(Pl.x, 0, Pl.z).add(camOff); camPos.lerp(tmpV, 1 - Math.exp(-5 * dt));
        cam.position.copy(camPos); cam.lookAt(camPos.x, 0, camPos.z - camOff.z - 0.6);
        // globito de los ordenanzas
        if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.style.opacity = 0; tmpV.set(sayG.x, 2.4, sayG.z).project(cam); const r = st.root.querySelector('canvas.cs3d-gl').getBoundingClientRect(); sayEl.style.left = (r.left + (tmpV.x + 1) / 2 * r.width) + 'px'; sayEl.style.top = (r.top + (1 - tmpV.y) / 2 * r.height) + 'px'; }
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) hudUpdate();
      },
    };
  },
});
