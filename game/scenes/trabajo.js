// CHIPA CITY — escena "trabajo": la oficina del jugador (manzana Bolívar / Belgrano / Padre Borgatti / Don Bosco).
// Tercera persona: briefing con El Inge y compañeros, después el tablero eléctrico del playón (puzzle de cables
// rotando piezas, pasando por las térmicas sin tocar los colgados rojos) antes de salir con la camioneta de la DPEC.
'use strict';
ChipaScenes.register('trabajo', {
  fov: 46, lowH: 300,
  create(st, opts) {
    const T = THREE, { U } = ChipaScenes;
    const diff = U.diff(opts);
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    const rnd = U.rng(U.hash('trabajo' + seed));
    const scene = st.scene, cam = st.camera, SND = st.sfx, R = U.R;
    const TITLE = U.o(opts, 'titulo title', 'Lunes en la oficina');
    const INTRO = U.o(opts, 'intro', 'Ventilador de techo, mate lavado y el aire acondicionado que gotea en el mismo balde de siempre.');
    const BRIEF = U.o(opts, 'briefing', [{ who: 'El Inge', text: 'Llegás tarde. Arreglame el tablero del playón, que saltó todo y la camioneta no carga.' }]);
    const PZ = opts.puzzle || {};
    const TRIES = +(PZ.intentos || Math.max(2, 6 - Math.floor(diff / 2)));
    const PTIME = +(PZ.tiempo || 150 - diff * 6);
    const PISTAS = PZ.pistas || ['El Inge: "Los cables rojos son de terceros. No los toques ni con un palo."'];
    const NPCS = opts.npcs || [{ name: 'El Inge' }, { name: 'Compañera de RRHH', lineas: ['¿Firmaste la planilla?'] }, { name: 'Pasante', lineas: ['Yo no toqué nada.'] }];
    const WIN_TXT = U.o(opts, 'textoGana', 'Se prenden todas las luces del playón.');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Saltó la térmica general. Se apaga el ventilador. Todos te miran en silencio.');
    const INGE = NPCS.find(n => /inge/i.test(n.name)) || { name: 'El Inge' };

    // ============================================================ planta
    const GW = 24, GH = 14;
    const ROOMS = [{ id: 'oficina', x0: 1, z0: 1, x1: 14, z1: 10 }, { id: 'tablero', x0: 17, z0: 1, x1: 22, z1: 10 }];
    const grid = new Int8Array(GW * GH).fill(-1);
    ROOMS.forEach((r, k) => { for (let j = r.z0; j <= r.z1; j++) for (let i = r.x0; i <= r.x1; i++) grid[j * GW + i] = k; });
    for (const [i, j] of [[15, 6], [16, 6], [15, 7], [16, 7]]) grid[j * GW + i] = 9;
    const gAt = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : grid[j * GW + i];
    const isFloor = (i, j) => gAt(i, j) >= 0;
    const col = new U.Collider((i, j) => !isFloor(i, j), 1);
    const tex = (w, h, fn, o) => U.tex(U.canvas(w, h, fn), o);
    const wallC = U.canvas(16, 64, g => { R(g, '#d8d0b0', 0, 0, 16, 64); U.paint.noise(g, 16, 64, rnd, ['#d0c8a8', '#ded6b8', '#c8c0a0'], 220); R(g, '#7a8a6a', 0, 44, 16, 20); R(g, '#6a7a5a', 0, 44, 16, 1); U.paint.noise(g, 16, 20, rnd, ['#728262', '#82927a'], 40); R(g, '#3a3a2a', 0, 62, 16, 2); for (let k = 0; k < 6; k++) R(g, '#b8b090', Math.floor(rnd() * 16), Math.floor(rnd() * 40), 1, 2); });
    const wallT = U.tex(wallC);
    const HW = 3.0, HLOW = 0.55;
    const wB = new U.Builder(), capB = new U.Builder();
    const wallH = (i, j) => (isFloor(i, j - 1) && !isFloor(i, j)) ? HLOW : HW;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      if (isFloor(i, j)) continue;
      let any = false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (isFloor(i + di, j + dj)) any = true;
      if (!any) continue;
      const h = wallH(i, j), x0 = i, x1 = i + 1, z0 = j, z1 = j + 1, sh = [0.6, 0.6, 0.64], hi = [1, 1, 1];
      const face = (a, b, c, d) => wB.quad(a, b, c, d, [[0, 0], [0.5, 0], [0.5, h / HW], [0, h / HW]], [sh, sh, hi, hi]);
      if (isFloor(i, j + 1)) face([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]);
      if (isFloor(i, j - 1)) face([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]);
      if (isFloor(i + 1, j)) face([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]);
      if (isFloor(i - 1, j)) face([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]);
      if (!isFloor(i + 1, j) && wallH(i + 1, j) < h) face([x1, wallH(i + 1, j), z1], [x1, wallH(i + 1, j), z0], [x1, h, z0], [x1, h, z1]);
      if (!isFloor(i - 1, j) && wallH(i - 1, j) < h) face([x0, wallH(i - 1, j), z0], [x0, wallH(i - 1, j), z1], [x0, h, z1], [x0, h, z0]);
      if (!isFloor(i, j + 1) && wallH(i, j + 1) < h) face([x0, wallH(i, j + 1), z1], [x1, wallH(i, j + 1), z1], [x1, h, z1], [x0, h, z1]);
      capB.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], null, [1, 1, 1]);
    }
    const mk = (b, m) => { const ms = new T.Mesh(b.geometry(), m); ms.castShadow = true; ms.receiveShadow = true; scene.add(ms); return ms; };
    mk(wB, U.mat({ map: wallT, vc: true, rough: 0.95 })); mk(capB, U.mat({ color: 0x2a2620 }));
    const tileT = tex(16, 16, g => { R(g, '#b8b0a0', 0, 0, 16, 16); R(g, '#c8c0b0', 1, 1, 7, 7); R(g, '#c0b8a6', 9, 9, 6, 6); R(g, '#a8a090', 8, 0, 1, 16); R(g, '#a8a090', 0, 8, 16, 1); U.paint.noise(g, 16, 16, rnd, ['#b0a898', '#c4bcac'], 30); });
    const cemT = tex(32, 32, g => { R(g, '#6a6660', 0, 0, 32, 32); U.paint.noise(g, 32, 32, rnd, ['#5e5a54', '#76726a'], 400); R(g, '#c8a020', 0, 30, 32, 2); });
    for (const r of ROOMS) {
      const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1, t = (r.id === 'oficina' ? tileT : cemT).clone(); t.needsUpdate = true; t.repeat.set(w, d); st.track(t);
      const m = new T.Mesh(new T.PlaneGeometry(w, d), U.mat({ map: t, rough: 0.6 })); m.rotation.x = -Math.PI / 2; m.position.set(r.x0 + w / 2, 0, r.z0 + d / 2); m.receiveShadow = true; scene.add(m);
    }
    { const m = new T.Mesh(new T.PlaneGeometry(2, 2), U.mat({ map: tileT })); m.rotation.x = -Math.PI / 2; m.position.set(16, 0.002, 7); scene.add(m); }
    const voidM = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshBasicMaterial({ color: 0x0a0806 })); voidM.rotation.x = -Math.PI / 2; voidM.position.set(12, -0.02, 7); scene.add(voidM);

    // ============================================================ utilería
    const box = (w, h, d, m, x, y, z, o = {}) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o.ry) b.rotation.y = o.ry; b.castShadow = o.shadow !== false; b.receiveShadow = true; (o.parent || scene).add(b); if (o.solid) col.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2); return b; };
    const woodT = tex(16, 16, g => U.paint.planks(g, 16, 16, rnd, { pw: 4, cols: ['#8a6a48', '#7a5a3a', '#947250'] }));
    const deskM = U.mat({ map: woodT, rough: 0.7 }), grayM = U.mat({ color: 0x8a8c88, rough: 0.6, metal: 0.3 }), darkM = U.mat({ color: 0x2a2a2c, rough: 0.7 });
    const screenT = tex(16, 12, g => { R(g, '#0a2a4a', 0, 0, 16, 12); for (let y = 1; y < 11; y += 2) R(g, U.pick(rnd, ['#4ac0f0', '#e8e8e8', '#f0c030']), 1, y, 4 + Math.floor(rnd() * 10), 1); });
    const screenM = new T.MeshBasicMaterial({ map: screenT, color: new T.Color(1.6, 1.6, 1.6) });
    const desk = (x, z, ry = 0) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      box(1.6, 0.06, 0.8, deskM, 0, 0.75, 0, { parent: g }); for (const sx of [-0.75, 0.75]) box(0.05, 0.75, 0.75, grayM, sx, 0.37, 0, { parent: g });
      box(0.5, 0.42, 0.45, U.mat({ color: 0xd8d0b8 }), -0.2, 1.0, -0.12, { parent: g }); const sc = new T.Mesh(new T.PlaneGeometry(0.4, 0.3), screenM); sc.position.set(-0.2, 1.02, 0.106); g.add(sc);
      box(0.45, 0.03, 0.15, darkM, -0.2, 0.79, 0.2, { parent: g });
      for (let k = 0; k < 3; k++) box(0.3, 0.04 + rnd() * 0.12, 0.22, U.mat({ color: U.pick(rnd, [0xe8c8b0, 0xd8d0a0, 0xa8c0d8]) }), 0.5, 0.8 + k * 0.06, -0.1, { parent: g });
      box(0.5, 0.06, 0.5, U.mat({ color: 0x2a3a6a }), 0, 0.48, 0.65, { parent: g }); box(0.5, 0.5, 0.06, U.mat({ color: 0x2a3a6a }), 0, 0.75, 0.9, { parent: g });
      col.box(x - 0.85, z - 0.45, x + 0.85, z + 0.45);
      return g;
    };
    desk(4, 4); desk(8, 4); desk(4, 7.6); desk(8, 7.6); desk(12.2, 3.2, -Math.PI / 2);
    // mate y termo del Inge
    box(0.12, 0.3, 0.12, U.mat({ color: 0xc83a2a, rough: 0.4 }), 12.0, 0.93, 2.6); const mate = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 0.1, 8), U.mat({ color: 0x6a4a2a })); mate.position.set(11.9, 0.83, 3.0); scene.add(mate);
    // pizarra con el laburo
    const boardT = U.tex(U.canvas(64, 32, g => { R(g, '#f0f0ea', 0, 0, 64, 32); U.text(g, 'DPEC - COLGADOS', 32, 2, { align: 'center', size: 7, color: '#1a3a9a' }); U.text(g, 'MERCADO x2\nHURACAN x2\nPQUE MITRE x2', 3, 11, { size: 6, lh: 7, color: '#c82a1a' }); R(g, '#1a3a9a', 44, 12, 14, 1); R(g, '#1a3a9a', 50, 10, 2, 16); U.text(g, '?!', 54, 18, { size: 7, color: '#2a2a2a' }); }), { repeat: false, mips: false });
    const board = new T.Mesh(new T.PlaneGeometry(2.4, 1.2), U.mat({ map: boardT, rough: 0.4 })); board.position.set(9, 1.7, 1.03); scene.add(board); box(2.5, 1.3, 0.04, grayM, 9, 1.7, 1.0);
    // ventana a la calle Bolívar
    const winT = tex(24, 16, g => { R(g, '#f0c890', 0, 0, 24, 9); R(g, '#e8a868', 0, 9, 24, 7); R(g, '#3a3a3a', 0, 12, 24, 4); R(g, '#2a6a2a', 2, 3, 5, 9); R(g, '#1a8a3a', 6, 4, 2, 2); R(g, '#f8f8f8', 14, 5, 8, 3); U.text(g, 'BOLIVAR', 18, 5, { align: 'center', size: 5, color: '#1a3a7a' }); });
    const winMesh = new T.Mesh(new T.PlaneGeometry(2.2, 1.4), new T.MeshBasicMaterial({ map: winT, color: new T.Color(1.6, 1.5, 1.3) })); winMesh.position.set(4.5, 1.8, 1.02); scene.add(winMesh);
    for (let k = 0; k < 6; k++) box(2.2, 0.05, 0.03, U.mat({ color: 0xd8d8d0 }), 4.5, 1.2 + k * 0.24, 1.06, { shadow: false });
    const sunL = new T.DirectionalLight(U.C(0xffe0b0), 0.9); sunL.position.set(4, 9, -8); sunL.target.position.set(7, 0, 6); scene.add(sunL); scene.add(sunL.target);
    sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024); Object.assign(sunL.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 }); sunL.shadow.camera.updateProjectionMatrix(); sunL.shadow.bias = -0.0008;
    // aire acondicionado que gotea en el balde
    box(1.0, 0.35, 0.3, U.mat({ color: 0xe8e8e0 }), 1.5 + 0.2, 2.5, 3.0, { shadow: false }).rotation.y = Math.PI / 2;
    const bucket = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.28, 8), U.mat({ color: 0x2a6ac8, rough: 0.5 })); bucket.position.set(1.5, 0.14, 3.0); scene.add(bucket); col.circle(1.5, 3.0, 0.2);
    st.particles({ mode: 'fall', count: 4, center: [1.5, 0.2, 3.0], box: [0.03, 2.2, 0.03], size: 0.03, color: 0x9ad0ff, bright: 1.4, speed: 0.6, far: 30 });
    // dispenser, archivero, planta, cartel
    box(0.35, 1.1, 0.35, U.mat({ color: 0xe8e8e8 }), 13.6, 0.55, 9.4, { solid: true }); const bot = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.4, 8), U.mat({ color: 0x6ab0e8, transparent: true, opacity: 0.7 })); bot.position.set(13.6, 1.3, 9.4); scene.add(bot);
    for (const x of [1.6, 2.2]) box(0.55, 1.3, 0.6, grayM, x, 0.65, 9.3, { solid: true });
    const pot = new T.Mesh(new T.IcosahedronGeometry(0.45, 0), U.mat({ color: 0x2a6a2a })); pot.position.set(13.6, 0.8, 1.6); pot.castShadow = true; scene.add(pot); box(0.4, 0.4, 0.4, U.mat({ color: 0x8a4a2a }), 13.6, 0.2, 1.6, { solid: true });
    // ventilador de techo (desde arriba se ve girar)
    const fan = new T.Group(); fan.position.set(7, 2.75, 5.8); scene.add(fan);
    box(0.18, 0.12, 0.18, darkM, 0, 0, 0, { parent: fan });
    for (let k = 0; k < 4; k++) { const b = new T.Mesh(new T.BoxGeometry(1.1, 0.02, 0.18), U.mat({ map: woodT })); b.position.set(Math.cos(k * Math.PI / 2) * 0.6, 0, Math.sin(k * Math.PI / 2) * 0.6); b.rotation.y = -k * Math.PI / 2; b.castShadow = true; fan.add(b); }
    let fanSpeed = 7;
    // luces de tubo
    const tubeM = new T.MeshBasicMaterial({ color: new T.Color(2.4, 2.5, 2.3) });
    const tubes = [];
    for (const [x, z] of [[5, 3], [9.5, 3], [5, 8], [9.5, 8], [19.5, 4.5]]) { const t = new T.Mesh(new T.BoxGeometry(1.2, 0.05, 0.12), tubeM); t.position.set(x, 2.95, z); scene.add(t); const l = new T.PointLight(U.C(0xe8f0e0), 0.9, 7, 1.6); l.position.set(x, 2.6, z); scene.add(l); tubes.push(l); }
    scene.add(new T.HemisphereLight(U.C(0xe0e0f0), U.C(0x3a3020), 0.55));
    st.renderer.setClearColor(U.C(0x0a0806));
    st.post.levels.value = 26; st.post.vig.value = 0.6; st.post.bloom.value = 0.8; st.post.exposure.value = 1.0; st.post.sat.value = 1.08;
    st.post.gain.value.setRGB(1.02, 0.99, 0.94);
    st.particles({ mode: 'dust', count: 120, center: [6, 1.5, 4], box: [10, 2.6, 6], size: 0.02, color: 0xfff0c0, bright: 0.55, far: 30, speed: 0.4 });
    // ---- cuarto del tablero: panel, banco de trabajo, portón al playón con la camioneta
    const panel = new T.Group(); panel.position.set(19.5, 0, 1.05); scene.add(panel);
    box(1.9, 1.7, 0.25, U.mat({ color: 0x8a9088, rough: 0.5, metal: 0.4 }), 0, 1.55, 0.12, { parent: panel });
    const door = new T.Group(); door.position.set(-0.95, 1.55, 0.26); panel.add(door);
    box(1.9, 1.7, 0.04, U.mat({ color: 0x9aa098, metal: 0.4, rough: 0.5 }), 0.95, 0, 0, { parent: door });
    const warnT = tex(16, 16, g => { R(g, '#f0c020', 0, 0, 16, 16); R(g, '#1a1a1a', 7, 3, 3, 4); R(g, '#1a1a1a', 6, 7, 3, 3); R(g, '#1a1a1a', 7, 10, 2, 3); });
    const warn = new T.Mesh(new T.PlaneGeometry(0.35, 0.35), U.mat({ map: warnT })); warn.position.set(0.95, 0.4, 0.025); door.add(warn);
    col.box(18.5, 1, 20.5, 1.5);
    box(2.0, 0.9, 0.8, deskM, 21.5, 0.45, 8.6, { solid: true }); for (let k = 0; k < 3; k++) { const sp = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.35, 10), U.mat({ color: U.pick(rnd, [0xc83a2a, 0x2a2a2a, 0xe8a020]) })); sp.position.set(17.8 + k * 0.7, 0.17, 9.6); sp.rotation.x = Math.PI / 2; sp.castShadow = true; scene.add(sp); }
    col.box(17.4, 9.2, 19.6, 10);
    // portón al playón (este) con la camioneta blanca de la DPEC
    const playT = tex(32, 24, g => { R(g, '#3a3a40', 0, 0, 32, 24); R(g, '#5a5a60', 0, 16, 32, 8); R(g, '#e8e8e8', 6, 8, 20, 9); R(g, '#3a6ab8', 6, 12, 20, 1); R(g, '#8ac0e8', 20, 9, 5, 3); R(g, '#1a1a1a', 8, 16, 4, 3); R(g, '#1a1a1a', 20, 16, 4, 3); U.text(g, 'DPEC', 13, 9, { align: 'center', size: 5, color: '#3a6ab8' }); });
    const playM = new T.MeshBasicMaterial({ map: playT, color: new T.Color(0.35, 0.35, 0.4) });
    const play = new T.Mesh(new T.PlaneGeometry(2.8, 2.1), playM); play.rotation.y = -Math.PI / 2; play.position.set(22.98, 1.1, 5.5); scene.add(play);
    const playLight = new T.PointLight(U.C(0xfff0c0), 0, 8, 1.4); playLight.position.set(21.8, 2.2, 5.5); scene.add(playLight);

    // ============================================================ personajes
    const player = U.person({ skin: '#c8956a', hair: '#2a1a10', shirt: '#e8a020', pants: '#2a3a6a' }); scene.add(player);
    const Pl = { x: 6.5, z: 9.8, yaw: Math.PI, speed: 0 };
    const LK = [Object.assign({ skin: '#d8a880', hair: '#5a4a3a', shirt: '#3a6ab8', pants: '#5a5a5a' }, INGE.look || {}), { skin: '#c89a70', hair: '#6a2a1a', shirt: '#d860a0', pants: '#2a2a3a' }, { skin: '#e0b090', hair: '#1a1a1a', shirt: '#f4f4f4', pants: '#2a3a6a' }];
    const POS = [[10.2, 2.2, 0], [8, 3.2, Math.PI], [12.6, 8.6, -Math.PI / 2]];
    const npcs = NPCS.slice(0, 3).map((n, k) => {
      const m = U.person(Object.assign({}, LK[k], n.look || {})); const [x, z, ry] = POS[k]; m.position.set(x, 0, z); m.rotation.y = ry; scene.add(m);
      if (k === 1) { m.position.y = -0.42; m.userData.legL.rotation.x = m.userData.legR.rotation.x = -Math.PI / 2; m.userData.armL.rotation.x = m.userData.armR.rotation.x = -1.1; }
      col.circle(x, z, 0.35);
      return { n, m, x, z, k, talked: 0 };
    });
    const ingeMate = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.09, 8), U.mat({ color: 0x6a4a2a })); ingeMate.position.set(0, -0.62, 0.06); npcs[0].m.userData.armR.add(ingeMate); npcs[0].m.userData.armR.rotation.x = -0.9;

    // ============================================================ puzzle del tablero
    const N = diff <= 4 ? 4 : diff <= 7 ? 5 : 6;
    const NB = 1, EB = 2, SB = 4, WB = 8, DIRS = [[0, -1, NB, SB], [1, 0, EB, WB], [0, 1, SB, NB], [-1, 0, WB, EB]];
    const rot = (m, r) => { for (let k = 0; k < r; k++) m = ((m << 1) | (m >> 3)) & 15; return m; };
    let PZG = null;
    function genPuzzle() {
      for (let tries = 0; tries < 500; tries++) {
        const rIn = Math.floor(rnd() * N), rOut = Math.floor(rnd() * N);
        const path = [[0, rIn]], seen = new Set(['0,' + rIn]);
        const minLen = N + 2 + Math.floor(diff / 3);
        let ok = false;
        const dfs = () => {
          const [x, y] = path[path.length - 1];
          if (x === N - 1 && y === rOut && path.length >= minLen) return true;
          if (path.length > N * N * 0.75) return false;
          for (const d of U.shuffle(rnd, [0, 1, 2, 3])) {
            const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = nx + ',' + ny;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(k)) continue;
            seen.add(k); path.push([nx, ny]); if (dfs()) return true; path.pop(); seen.delete(k);
          }
          return false;
        };
        let budget = 4000; const dfs0 = dfs; ok = (function guard() { return dfs0(); })();
        if (!ok) continue;
        const cells = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cells.push({ x, y, kind: 'vacio', base: 0, r: 0, onPath: false });
        const C = (x, y) => cells[y * N + x];
        const straights = [];
        path.forEach(([x, y], i) => {
          const prev = i === 0 ? [-1, rIn] : path[i - 1], next = i === path.length - 1 ? [N, rOut] : path[i + 1];
          let m = 0; for (const p of [prev, next]) { const dx = p[0] - x, dy = p[1] - y; m |= dx === 1 ? EB : dx === -1 ? WB : dy === 1 ? SB : NB; }
          const c = C(x, y); c.base = m; c.onPath = true; c.kind = (m === 5 || m === 10) ? 'recta' : 'codo'; c.idx = i;
          if (c.kind === 'recta' && i > 0 && i < path.length - 1) straights.push(c);
        });
        if (straights.length < 3) continue;
        // tres térmicas repartidas en el camino, en orden
        const pick = [straights[Math.floor(straights.length * 0.15)], straights[Math.floor(straights.length * 0.5)], straights[Math.floor(straights.length * 0.85)]];
        if (new Set(pick).size < 3) continue;
        pick.sort((a, b) => a.idx - b.idx).forEach((c, k) => { c.kind = 'termica'; c.tn = k + 1; });
        // fuera del camino: señuelos y colgados (de preferencia pegados al camino)
        const off = cells.filter(c => !c.onPath);
        const nCol = Math.min(off.length, 2 + Math.floor(diff / 3));
        const adj = off.filter(c => DIRS.some(d => { const n = c.x + d[0], m = c.y + d[1]; return n >= 0 && m >= 0 && n < N && m < N && C(n, m).onPath; }));
        U.shuffle(rnd, adj).slice(0, nCol).forEach(c => { c.kind = 'colgado'; c.base = rnd() < 0.5 ? 3 : 5; });
        for (const c of off) if (c.kind === 'vacio') { const t = rnd(); if (t < 0.35) { c.kind = 'recta'; c.base = 5; } else if (t < 0.7) { c.kind = 'codo'; c.base = 3; } else if (t < 0.9) { c.kind = 'T'; c.base = 7; } }
        // T en el camino: a veces reemplaza un codo (el brazo extra apunta a una celda sin colgado)
        PZG = { cells, rIn, rOut, C, path };
        scramble();
        return;
      }
    }
    function scramble() {
      for (const c of PZG.cells) c.r = Math.floor(rnd() * 4);
      // que el camino no quede resuelto de entrada
      for (const c of PZG.cells) if (c.onPath && c.r === 0 && rnd() < 0.8) c.r = 1 + Math.floor(rnd() * 3);
    }
    const maskOf = c => c.kind === 'vacio' ? 0 : rot(c.base, c.r);
    function flow() {
      const { cells, C, rIn, rOut } = PZG, on = new Set(), q = [];
      const s = C(0, rIn); if (maskOf(s) & WB) { on.add(s); q.push(s); }
      while (q.length) {
        const c = q.shift(), m = maskOf(c);
        if (c.kind === 'colgado') continue; // la corriente entra al colgado pero no lo atraviesa hacia el resto
        for (const [dx, dy, a, b] of DIRS) {
          if (!(m & a)) continue; const nx = c.x + dx, ny = c.y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const n = C(nx, ny); if (on.has(n) || !(maskOf(n) & b)) continue; on.add(n); q.push(n);
        }
      }
      const out = C(N - 1, rOut), exit = on.has(out) && !!(maskOf(out) & EB);
      return { on, exit, colg: [...on].filter(c => c.kind === 'colgado'), term: [...on].filter(c => c.kind === 'termica').length };
    }
    genPuzzle();
    // malla del tablero (dentro de la puerta del panel)
    const TS = 1.3 / N, tileCache = {};
    const tileCanvas = (kind, base, tn) => {
      const key = kind + base + (tn || ''); if (tileCache[key]) return tileCache[key];
      const c = U.canvas(24, 24, g => {
        R(g, '#22262a', 0, 0, 24, 24); R(g, '#2c3036', 1, 1, 22, 22); R(g, '#1a1c20', 0, 23, 24, 1); R(g, '#1a1c20', 23, 0, 1, 24);
        if (kind === 'vacio') { R(g, '#3a3e44', 3, 3, 2, 2); R(g, '#3a3e44', 19, 19, 2, 2); return; }
        const colr = kind === 'colgado' ? '#d82a1a' : '#d88a3a', hi = kind === 'colgado' ? '#ff7050' : '#f8c070';
        const arm = (b, x, y, w, h) => { if (base & b) { R(g, colr, x, y, w, h); R(g, hi, x, y, w > h ? w : 1, w > h ? 1 : h); } };
        arm(NB, 10, 0, 4, 13); arm(SB, 10, 11, 4, 13); arm(EB, 11, 10, 13, 4); arm(WB, 0, 10, 13, 4);
        R(g, colr, 9, 9, 6, 6);
        if (kind === 'termica') { R(g, '#e8e8e0', 6, 6, 12, 12); R(g, '#1a1a1a', 7, 7, 10, 10); R(g, '#3ac83a', 10, 8, 4, 5); U.text(g, 'T' + tn, 12, 14, { align: 'center', size: 5, color: '#f0c030' }); }
        if (kind === 'colgado') { R(g, '#1a1a1a', 8, 8, 8, 8); R(g, '#f0c020', 9, 9, 6, 6); R(g, '#1a1a1a', 11, 10, 2, 3); R(g, '#1a1a1a', 11, 14, 2, 1); }
        if (kind === 'T') R(g, '#a86a2a', 10, 10, 4, 4);
      });
      return (tileCache[key] = U.tex(c, { repeat: false, mips: false }));
    };
    const board3d = new T.Group(); board3d.position.set(19.5, 1.55, 0.27); scene.add(board3d);
    box(1.5, 1.5, 0.02, U.mat({ color: 0x14161a }), 0, 0, -0.01, { parent: board3d, shadow: false });
    const tileGeo = new T.PlaneGeometry(TS * 0.96, TS * 0.96);
    const tiles = PZG.cells.map(c => {
      const t = tileCanvas(c.kind, c.base, c.tn), m = new T.Mesh(tileGeo, U.mat({ map: t, emissive: 0xffffff, emissiveMap: t, ei: 0.15, rough: 0.6 }));
      m.position.set(-0.65 + TS * (c.x + 0.5), 0.65 - TS * (c.y + 0.5), 0.005); m.rotation.z = -c.r * Math.PI / 2; board3d.add(m); c.mesh = m; c.vr = c.r; return m;
    });
    const lab = (txt, x, y, color) => { const t = U.tex(U.canvas(40, 10, g => { R(g, '#14161a', 0, 0, 40, 10); U.text(g, txt, 20, 1, { align: 'center', size: 6, color }); }), { repeat: false, mips: false }); const m = new T.Mesh(new T.PlaneGeometry(0.5, 0.125), new T.MeshBasicMaterial({ map: t })); m.position.set(x, y, 0.01); m.rotation.z = Math.PI / 2 * (x < 0 ? 1 : -1); board3d.add(m); };
    lab('13,2 kV', -0.71, 0.65 - TS * (PZG.rIn + 0.5), '#f0c030'); lab('PLAYON', 0.71, 0.65 - TS * (PZG.rOut + 0.5), '#8ae0ff');
    const cursor = new T.Mesh(new T.RingGeometry(TS * 0.46, TS * 0.54, 4, 1), new T.MeshBasicMaterial({ color: new T.Color(3, 2.4, 0.6) })); cursor.rotation.z = Math.PI / 4; cursor.position.z = 0.012; cursor.visible = false; board3d.add(cursor);
    const sparks = st.particles({ mode: 'embers', count: 40, center: [19.5, 1.6, 0.6], box: [1.4, 1.4, 0.3], size: 0.03, color: 0xa0d8ff, bright: 3, speed: 2.5, far: 30 }); sparks.visible = false;

    // ============================================================ HUD y flujo
    const hudBox = st.el('cs3d-hud t'); hudBox.style.cssText = 'top:16px;right:16px;text-align:right;font-size:10px;line-height:2.1';
    let phase = 'briefing', pz = null, finished = false, tries = TRIES, ptime = PTIME, sel = [0, 0];
    const setObj = t => st.objective(`<b>${TITLE.toUpperCase()}</b><br>${t}`);
    setObj(`Hablá con ${INGE.name} (al lado de la pizarra).`);
    st.titleCard(TITLE, INTRO, 4.2);
    st.showKeys(['[WASD ←↑↓→] caminar', '[ESPACIO] hablar · usar'], 10);
    const hud = () => { hudBox.innerHTML = phase === 'puzzle' || phase === 'tablero' ? `INTENTOS <b style="color:#f0c030;font-weight:normal">${tries}</b><br>TIEMPO <b style="color:${ptime < 25 ? '#ff6040' : '#f0c030'};font-weight:normal">${Math.ceil(ptime)} s</b>` : ''; };
    function refreshTiles() {
      const f = flow();
      for (const c of PZG.cells) {
        const lit = f.on.has(c) && c.kind !== 'colgado';
        c.mesh.material.emissiveIntensity = lit ? 1.1 : 0.15;
        c.mesh.material.color.setRGB(lit ? 1.25 : 1, lit ? 1.15 : 1, lit ? 0.8 : 1);
      }
      return f;
    }
    refreshTiles();
    async function talkTo(np) {
      if (np.k === 0) {
        if (phase === 'briefing') { await st.talk(BRIEF.map(b => typeof b === 'string' ? { who: INGE.name, text: b } : b)); phase = 'tablero'; setObj('Andá al cuarto del fondo y arreglá el tablero del playón.'); hud(); }
        else await st.say(np.n.name, phase === 'done' ? 'Dale, a la camioneta.' : U.pick(rnd, PISTAS).replace(/^El Inge:\s*/, ''));
      } else { const L = np.n.lineas || ['...']; await st.say(np.n.name, L[np.talked++ % L.length]); }
    }
    function enterPuzzle() {
      phase = 'puzzle'; cursor.visible = true; st.busy++; refreshTiles(); hud();
      st.showKeys(['[← ↑ → ↓] elegir pieza', '[ESPACIO] girar la pieza', '[ENTER] subir la térmica general', '[Q] alejarse del tablero'], 14);
      setObj('Llevá la corriente de 13,2 kV al PLAYÓN pasando por T1, T2 y T3. ¡Los cables ROJOS (colgados) no se tocan!');
    }
    function leavePuzzle() { phase = 'tablero'; cursor.visible = false; st.busy--; }
    async function testBoard() {
      const f = refreshTiles();
      SND.noise(0.3, { freq: 300, vol: 0.2 }); SND.tone(80, 0.4, { type: 'sawtooth', vol: 0.06 });
      if (f.colg.length) {
        tries--; st.flash(0xa0d8ff, 0.8); st.shake(0.6); sparks.visible = true; setTimeout(() => { sparks.visible = false; }, 900);
        SND.noise(0.8, { freq: 3000, vol: 0.4, filter: 'highpass' }); tubes.forEach(l => l.intensity = 0.1); setTimeout(() => tubes.forEach(l => l.intensity = 0.9), 600);
        st.toast(`¡PAF! Tocaste un colgado y saltó todo. Se reinicia la grilla. (${tries} intentos)`, 3, '#ff8060');
        for (const c of f.colg) c.mesh.material.color.setRGB(3, 0.6, 0.4);
        if (tries <= 0) return lose();
        scramble(); refreshTiles(); return;
      }
      if (!f.exit || f.term < 3) {
        tries--; SND.tone(160, 0.5, { type: 'sawtooth', vol: 0.08 });
        st.toast(!f.exit ? `No llega la corriente al playón. (${tries} intentos)` : `Llega, pero sin pasar por las tres térmicas: salta igual. (${tries} intentos)`, 3, '#ff8060');
        if (tries <= 0) return lose();
        if (tries === 1) st.say(INGE.name, U.pick(rnd, PISTAS).replace(/^El Inge:\s*/, ''));
        return;
      }
      return win();
    }
    async function win() {
      finished = true; leavePuzzle(); phase = 'done';
      for (const c of PZG.cells) if (flow().on.has(c)) c.mesh.material.emissiveIntensity = 2;
      [523, 659, 784, 1046].forEach((f, n) => SND.tone(f, 0.2, { type: 'square', vol: 0.06, delay: n * 0.1 }));
      playLight.intensity = 2.4; playM.color.setRGB(1.4, 1.4, 1.5); st.flash(0xfff0c0, 0.4);
      await st.say('', WIN_TXT);
      st.finish({ ok: true, score: Math.round(500 + ptime * 6 + tries * 100 + diff * 40), message: '¡Tablero andando! A la camioneta.', data: { tries: TRIES - tries, seconds: Math.round(PTIME - ptime) } });
    }
    async function lose() {
      if (finished) return; finished = true; if (phase === 'puzzle') leavePuzzle(); phase = 'lost';
      tubes.forEach(l => l.intensity = 0.05); fanSpeed = 0; screenM.color.setRGB(0.05, 0.05, 0.05); SND.tone(110, 1.2, { type: 'sawtooth', vol: 0.08, slide: 0.5 });
      await st.say('', LOSE_TXT);
      st.finish({ ok: false, data: { reason: 'tablero', tries: TRIES } });
    }
    window.__tb = { get PZG() { return PZG; }, flow, refreshTiles, Pl, get phase() { return phase; }, rot };
    const amb = SND.loop({ freq: 300, vol: 0.025 });
    const camOff = new T.Vector3(0, 9, 7.2), camPos = new T.Vector3(Pl.x, 0, Pl.z).add(camOff), tmp = new T.Vector3(), lookP = new T.Vector3(Pl.x, 0, Pl.z - 0.5);
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    let footT = 0;
    return {
      update(dt, t) {
        fan.rotation.y += dt * fanSpeed;
        npcs.forEach(n => { if (n.k !== 1) U.animPerson(n.m, 0, dt); n.m.userData.head.rotation.y = Math.sin(t * 0.5 + n.k) * 0.3; });
        if (phase === 'puzzle' && !finished) {
          ptime -= dt; if (ptime <= 0) { ptime = 0; st.toast('Se acabó el tiempo.', 2); lose(); }
          if (st.hit('ArrowLeft', 'KeyA')) sel[0] = (sel[0] + N - 1) % N; if (st.hit('ArrowRight', 'KeyD')) sel[0] = (sel[0] + 1) % N;
          if (st.hit('ArrowUp', 'KeyW')) sel[1] = (sel[1] + N - 1) % N; if (st.hit('ArrowDown', 'KeyS')) sel[1] = (sel[1] + 1) % N;
          if (st.hit('Space')) { const c = PZG.C(sel[0], sel[1]); if (c.kind !== 'vacio') { c.r = (c.r + 1) % 4; SND.noise(0.06, { freq: 2200, vol: 0.12, filter: 'highpass' }); refreshTiles(); } }
          if (st.hit('Enter')) testBoard();
          if (st.hit('KeyQ', 'Backspace')) leavePuzzle();
          cursor.position.set(-0.65 + TS * (sel[0] + 0.5), 0.65 - TS * (sel[1] + 0.5), 0.012);
          cursor.material.color.setRGB(3, 2.4 + Math.sin(t * 8) * 0.6, 0.6);
        }
        for (const c of PZG.cells) { const target = -c.r * Math.PI / 2; let cur = c.mesh.rotation.z; if (Math.abs(cur - target) > 0.001) { if (cur < target - Math.PI) cur += Math.PI * 2; c.mesh.rotation.z = U.damp(cur, target, 18, dt); } }
        door.rotation.y = U.damp(door.rotation.y, phase === 'tablero' || phase === 'puzzle' || phase === 'done' ? -1.9 : 0, 4, dt);
        // movimiento
        const ax = st.axis();
        let mx = ax.x, mz = -ax.y; if (st.busy || finished) { mx = 0; mz = 0; }
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          const vx = mx / len * 3, vz = mz / len * 3, p = { x: Pl.x + vx * dt, z: Pl.z + vz * dt }; col.resolve(p, 0.3); Pl.x = p.x; Pl.z = p.z;
          Pl.yaw += angDiff(Math.atan2(vx, vz), Pl.yaw) * Math.min(1, dt * 12); Pl.speed = 3;
          footT -= dt; if (footT <= 0) { footT = 0.36; SND.noise(0.05, { freq: 900, vol: 0.05 }); }
        } else Pl.speed = 0;
        player.position.set(Pl.x, 0, Pl.z); player.rotation.y = Pl.yaw; U.animPerson(player, Pl.speed, dt);
        // interacciones
        let best = null, bd = 1e9;
        if (!st.busy && !finished) {
          for (const n of npcs) { const d = Math.hypot(Pl.x - n.x, Pl.z - n.z); if (d < 1.6 && d < bd) { bd = d; best = { txt: `Hablar con ${n.n.name}`, fn: () => talkTo(n) }; } }
          const dp = Math.hypot(Pl.x - 19.5, Pl.z - 2.0);
          if (dp < 1.5 && dp < bd) { bd = dp; best = phase === 'briefing' ? { txt: 'Mirar el tablero', fn: () => st.say('', `Mejor primero escuchá a ${INGE.name}.`) } : { txt: 'Trabajar en el tablero', fn: enterPuzzle }; }
        }
        st.prompt(best ? `<b>[ESPACIO]</b> ${best.txt}` : null);
        if (best && st.action()) best.fn();
        // cámara: sigue al jugador, o se acerca al tablero
        if (phase === 'puzzle') { tmp.set(19.5, 1.65, 2.35); camPos.lerp(tmp, 1 - Math.exp(-5 * dt)); lookP.lerp(tmp.set(19.5, 1.55, 0.3), 1 - Math.exp(-5 * dt)); }
        else { tmp.set(Pl.x, 0, Pl.z).add(camOff); camPos.lerp(tmp, 1 - Math.exp(-5 * dt)); lookP.lerp(tmp.set(camPos.x, 0, camPos.z - camOff.z - 0.5), 1 - Math.exp(-5 * dt)); }
        cam.position.copy(camPos); cam.lookAt(lookP);
        player.visible = phase !== 'puzzle';
        amb.set(0.025);
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) hud();
      },
    };
  },
});
