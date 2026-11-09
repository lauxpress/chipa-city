// CHIPA CITY — escena "higuera": las cuevas bajo las raíces de la Higuera de la India (Gomero) del Parque Mitre.
// Tercera persona. Cuatro zonas separadas por tres compuertas de raíces con los símbolos del plano (cruz, agua, árbol).
// La Pora (luz mala) cuida el cofre de Fray Benicio: si agarrás plata suelta te persigue y las raíces se cierran;
// si llevás solo el cofre, te acompaña e ilumina la salida. Arriba, la topadora golpea cada tanto y tapa pasadizos.
'use strict';
ChipaScenes.register('higuera', {
  fov: 50, lowH: 300,
  create(st, opts) {
    const T = THREE, { U } = ChipaScenes;
    const diff = U.diff(opts);
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    const TITLE = U.o(opts, 'titulo title', 'Bajo la Higuera de la India');
    const INTRO = U.o(opts, 'intro', 'Entre las raíces de la Higuera centenaria hay un hueco que nadie vio nunca. Adentro, cuevas de tierra colorada y raíces como columnas.');
    const GOAL = U.o(opts, 'objetivo goal', 'Abrí las tres compuertas de raíces, encontrá el cofre de Fray Benicio y sacalo antes de que se derrumbe la entrada.');
    const TIME = Math.max(60, +U.o(opts, 'tiempo time duracion', 300 + (10 - diff) * 30));
    const ZONES = U.o(opts, 'zonas', [
      { nombre: 'Las raíces', texto: 'Raíces que se mueven si las empujás. Algunas son puertas.' },
      { nombre: 'La galería de los cautivos', texto: 'Nombres de vecinos de 1865 grabados en la tierra.' },
      { nombre: 'El ojo de agua', texto: 'Una vertiente que va hacia la Punta Arazá. Se oye el río.' },
      { nombre: 'La cámara del fraile', texto: 'Un cofre de madera dura con herrajes y una cruz. Y una luz que flota.' },
    ]);
    const GATES = U.o(opts, 'compuertas', [
      { simbolo: 'cruz', pista: 'Donde la cruz no ardió.' },
      { simbolo: 'agua', pista: 'Seguí el agua y no el brillo.' },
      { simbolo: 'árbol', pista: 'Aquí descansa lo de todos.' },
    ]);
    const PORA = opts.pora || {};
    const PLINES = PORA.lineas || ['Lo de todos... es de todos...', 'No es tuyo. No es de él. Es de ellos.', '(la luz se calma y te sigue)'];
    const TESORO = U.o(opts, 'tesoro', ['Cofre con la plata de las iglesias', 'Una carta de Fray Benicio', 'Una bandera vieja, doblada con cuidado']);
    const CARTA = U.o(opts, 'cartaFraile', 'A quien encuentre esto: no es mío ni tuyo. Es del pueblo de Corrientes. Devolvelo cuando haya paz. Fr. Benicio.');
    const WIN_TXT = U.o(opts, 'textoGana', '¡Saliste con el cofre!');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Se derrumbó la entrada.');
    const SLAM = (() => { const m = /cada\s+(\d+)\s*s/i.exec(opts.amenaza || ''); return m ? +m[1] : 30; })();
    const CHASE = (() => { const m = /(\d+)\s*s/i.exec(PORA.regla || ''); return m ? +m[1] : 20; })();
    // texto de la pista sin la aclaración entre paréntesis (eso lo tiene que deducir el jugador)
    const pistaCorta = p => String(p || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+([.,;])/g, '$1').trim();
    const SYM = {
      cruz: { name: 'La cruz', glyph: '✝' }, agua: { name: 'El agua', glyph: '≈' }, 'árbol': { name: 'El árbol', glyph: '♣' },
      sol: { name: 'El sol', glyph: '☼' }, luna: { name: 'La luna', glyph: '☾' }, espada: { name: 'La espada', glyph: '†' }, moneda: { name: 'La moneda', glyph: '◎' },
    };
    const symKey = s => { s = String(s || '').toLowerCase(); if (/cruz/.test(s)) return 'cruz'; if (/agua/.test(s)) return 'agua'; if (/rbol/.test(s)) return 'árbol'; return SYM[s] ? s : 'cruz'; };

    // ============================================================ mapa (celdas de 2 m)
    // # tierra · . piso · ~ agua · 1 2 3 compuertas · K cofre · P Pora · c plata suelta · n nombres grabados
    // R columna de raíces · C cortina de raíces · L haz de luz · S boca de salida (debajo del tronco)
    const MAP = [
      '############################',
      '##########.........#########',
      '#########....P......########',
      '#########.R.....R..#########',
      '#########....K.....3......##',
      '#########.c.......##..~~~..#',
      '##########...L...##..~~~~..#',
      '###########.....###.~~~R~~.#',
      '###########.###.##..~~~~~c.#',
      '###########.....##.L.~~~~..#',
      '##################....~~...#',
      '#########################2##',
      '##.n...n....n....n...n.....#',
      '#.........R.........R......#',
      '#.c...L.................L.c#',
      '##.n.....n.......n...n....##',
      '################1###########',
      '##########......L......#####',
      '#######....C..R...R..C..####',
      '#######..L.............R####',
      '########.R....SSS..c....####',
      '#########.....SSS......#####',
      '##########............######',
      '############################',
    ];
    const CS = 2, W = MAP[0].length, H = MAP.length, WH = 2.6;
    const ch = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? '#' : MAP[j][i];
    const blocked = new Set();
    const key = (i, j) => j * 100 + i;
    const cellC = (i, j) => [i * CS + CS / 2, j * CS + CS / 2];
    const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
    const cells = { gate: [], coin: [], n: [], R: [], C: [], L: [], S: [], water: [] };
    let K = null, PP = null;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = ch(i, j);
      if ('123'.includes(c)) cells.gate[+c - 1] = { i, j };
      else if (c === 'c') cells.coin.push({ i, j }); else if (c === 'n') cells.n.push({ i, j }); else if (c === 'R') cells.R.push({ i, j });
      else if (c === 'C') cells.C.push({ i, j }); else if (c === 'L') cells.L.push({ i, j }); else if (c === 'S') cells.S.push({ i, j });
      else if (c === '~') cells.water.push({ i, j }); else if (c === 'K') K = { i, j }; else if (c === 'P') PP = { i, j };
    }
    const isWall = (i, j) => ch(i, j) === '#' || blocked.has(key(i, j));
    // zonas: relleno desde una semilla sin cruzar compuertas
    const zone = new Int8Array(W * H).fill(-1);
    [[15, 20], [5, 13], [23, 6], [13, 3]].forEach(([si, sj], z) => {
      const q = [[si, sj]]; zone[sj * W + si] = z;
      for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d]; if (ch(ni, nj) === '#' || '123'.includes(ch(ni, nj)) || zone[nj * W + ni] >= 0) continue; zone[nj * W + ni] = z; q.push([ni, nj]); } }
    });
    const zoneAt = (x, z) => { const i = Math.floor(x / CS), j = Math.floor(z / CS); return (i < 0 || j < 0 || i >= W || j >= H) ? -1 : zone[j * W + i]; };

    // ============================================================ texturas
    const r = U.rng(U.hash('hig' + seed));
    const earthC = U.canvas(32, 32, (g, w, h) => {
      U.R(g, '#8a3c22', 0, 0, w, h);
      for (let y = 0; y < h; y++) { const k = 0.85 + 0.25 * Math.sin(y * 0.9 + Math.sin(y * 0.3) * 2); U.R(g, U.shade('#8a3c22', k), 0, y, w, 1); }
      U.paint.noise(g, w, h, r, ['#7a3220', '#9a4a2a', '#a65a34', '#6a2a1a', '#b06a40'], w * h * 0.45);
      for (let k = 0; k < 14; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); U.R(g, '#c8a070', x, y, 2, 1); U.R(g, '#5a2414', x, y + 1, 2, 1); }
      for (let k = 0; k < 5; k++) { let x = Math.floor(r() * w), y = 0; const c = U.pick(r, ['#3a2416', '#4a3020']); while (y < h) { U.R(g, c, x, y, 1, 1); y++; if (r() < 0.3) x += r() < 0.5 ? -1 : 1; } }
    });
    const floorC = U.canvas(32, 32, (g, w, h) => {
      U.R(g, '#6a3420', 0, 0, w, h); U.paint.noise(g, w, h, r, ['#64301e', '#70381f', '#5c2c1a', '#743c24'], w * h * 0.6);
      for (let k = 0; k < 16; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); U.R(g, '#86503a', x, y, 2, 1); U.R(g, '#4a2214', x, y + 1, 2, 1); }
      for (let k = 0; k < 10; k++) U.R(g, U.pick(r, ['#7a5a30', '#6a4a24', '#5a5a24']), Math.floor(r() * w), Math.floor(r() * h), 2, 1); // hojarasca
      for (let k = 0; k < 4; k++) { let x = Math.floor(r() * w), y = Math.floor(r() * h); for (let s = 0; s < 14; s++) { U.R(g, '#3a2214', x, y, 1, 1); x++; if (r() < 0.4) y += r() < 0.5 ? -1 : 1; } }
    });
    const capC = U.canvas(32, 32, (g, w, h) => {
      U.R(g, '#5a3a24', 0, 0, w, h); U.paint.noise(g, w, h, r, ['#4e3220', '#664430', '#583822'], w * h * 0.5);
      for (let k = 0; k < 120; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); U.R(g, U.pick(r, ['#3a5a22', '#4a6a2a', '#2e4a1a', '#5a7a30']), x, y, 1, 2); }
      for (let k = 0; k < 6; k++) { let x = Math.floor(r() * w), y = Math.floor(r() * h); for (let s = 0; s < 18; s++) { U.R(g, '#5a4a3a', x, y, 1, 1); x += 1; if (r() < 0.3) y += r() < 0.5 ? -1 : 1; } }
    });
    const barkC = U.canvas(16, 32, (g, w, h) => {
      U.R(g, '#6a5a48', 0, 0, w, h);
      for (let x = 0; x < w; x++) { const c = U.pick(r, ['#5a4a3a', '#6e5e4a', '#7a6a56', '#4e4032', '#8a7a62']); U.R(g, c, x, 0, 1, h); }
      for (let k = 0; k < 40; k++) U.R(g, U.pick(r, ['#a89880', '#3a3026', '#9a8a70']), Math.floor(r() * w), Math.floor(r() * h), 1, 2 + Math.floor(r() * 4));
      for (let k = 0; k < 6; k++) U.R(g, '#2e261e', 0, Math.floor(r() * h), w, 1);
    });
    const woodC = U.canvas(16, 16, (g, w, h) => U.paint.planks(g, w, h, r, { cols: ['#5a3418', '#4a2a12', '#6a3e1e'], pw: 4 }));
    const earthT = U.tex(earthC), floorT = U.tex(floorC), capT = U.tex(capC), barkT = U.tex(barkC), woodT = U.tex(woodC);

    // ============================================================ geometría de la cueva
    const jit = (x, y, z) => { const h = U.hash(Math.round(x * 10) + ',' + Math.round(y * 10) + ',' + Math.round(z * 10)); return [((h & 255) / 255 - 0.5) * 0.55, (((h >> 8) & 255) / 255 - 0.5) * 0.55]; };
    const topY = (x, z) => WH + (((U.hash(Math.round(x) + ':' + Math.round(z)) & 255) / 255) - 0.35) * 0.5;
    const LV = [0, 0.8, 1.7];
    const P = (x, y, z) => { const top = y < 0; const yy = top ? topY(x, z) : y; const [jx, jz] = jit(x, top ? 99 : yy, z); return [x + jx, yy, z + jz]; };
    const wallB = new U.Builder(), capB = new U.Builder(), floorB = new U.Builder();
    const sides = (i, j, d) => { const x0 = i * CS, z0 = j * CS, x1 = x0 + CS, z1 = z0 + CS; return [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]][d]; };
    const col = k => [k, k * 0.96, k * 0.92];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (isWall(i, j)) {
        const x0 = i * CS, z0 = j * CS, x1 = x0 + CS, z1 = z0 + CS;
        const edge = [0, 1, 2, 3].some(d => !isWall(i + DX[d], j + DZ[d]));
        const k = edge ? 1.0 : 0.7;
        capB.quad(P(x0, -1, z1), P(x1, -1, z1), P(x1, -1, z0), P(x0, -1, z0), [[x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4], [x0 / 4, z0 / 4]], col(k));
        continue;
      }
      for (let d = 0; d < 4; d++) {
        if (!isWall(i + DX[d], j + DZ[d])) continue;
        const [[lx, lz], [rx, rz]] = sides(i, j, d), u0 = (lx + lz) / 2, u1 = u0 + 1;
        const ys = [...LV, -1];
        for (let k = 0; k < 3; k++) {
          const ya = ys[k], yb = ys[k + 1], va = ya / 2, vb = (yb < 0 ? WH : yb) / 2;
          const ca = col(k === 0 ? 0.42 : k === 1 ? 0.78 : 0.95), cb = col(k === 0 ? 0.78 : k === 1 ? 0.95 : 0.72);
          wallB.quad(P(lx, ya, lz), P(rx, ya, rz), P(rx, yb, rz), P(lx, yb, lz), [[u0, va], [u1, va], [u1, vb], [u0, vb]], [ca, ca, cb, cb]);
        }
      }
    }
    floorB.quad([0, 0, H * CS], [W * CS, 0, H * CS], [W * CS, 0, 0], [0, 0, 0], [[0, H * CS / 2], [W * CS / 2, H * CS / 2], [W * CS / 2, 0], [0, 0]], [1, 1, 1]);
    const mk = (b, m, cast) => { const ms = new T.Mesh(b.geometry(), m); ms.receiveShadow = true; ms.castShadow = !!cast; st.scene.add(ms); return ms; };
    const wallMesh = mk(wallB, st.seeThrough(U.mat({ map: earthT, bump: U.tex(earthC, { linear: true }), bumpScale: 0.7, vc: true, rough: 1 })), true);
    mk(capB, st.seeThrough(U.mat({ map: capT, vc: true, rough: 1 })), true);
    mk(floorB, U.mat({ map: floorT, bump: U.tex(floorC, { linear: true }), bumpScale: 0.5, vc: true, rough: 0.95 }));
    // agua del ojo de agua
    const waterT = U.tex(U.canvas(16, 16, (g) => { U.R(g, '#2a6a6a', 0, 0, 16, 16); U.paint.noise(g, 16, 16, r, ['#286060', '#327272', '#246060'], 60); for (let k = 0; k < 4; k++) U.R(g, '#9ad8d0', Math.floor(r() * 13), Math.floor(r() * 16), 3, 1); }));
    {
      const wb = new U.Builder();
      for (const c of cells.water) { const x0 = c.i * CS, z0 = c.j * CS; wb.quad([x0, 0.1, z0 + CS], [x0 + CS, 0.1, z0 + CS], [x0 + CS, 0.1, z0], [x0, 0.1, z0], [[x0 / 3, (z0 + CS) / 3], [(x0 + CS) / 3, (z0 + CS) / 3], [(x0 + CS) / 3, z0 / 3], [x0 / 3, z0 / 3]], [1, 1, 1]); }
      const wm = new T.Mesh(wb.geometry(), U.mat({ map: waterT, vc: true, rough: 0.1, metal: 0.2, transparent: true, opacity: 0.7, emissive: 0x0c3030, depthWrite: false }));
      wm.receiveShadow = true; wm.renderOrder = 2; st.scene.add(wm);
      st.updaters.push((dt, t) => waterT.offset.set(t * 0.05, Math.sin(t * 0.5) * 0.04));
    }

    // ============================================================ raíces (instanciadas)
    const barkMat = U.mat({ map: barkT, rough: 1, color: 0xc8b8a0 });
    const rootGeo = new T.CylinderGeometry(1, 1, 1, 5, 1); rootGeo.translate(0, 0.5, 0);
    const rootList = [];
    const coll = new U.Collider((i, j) => isWall(i, j), CS);
    const rootCol = (cx, cz, scale = 1) => {
      // columna: decenas de raíces aéreas trenzadas (como el tronco de la foto)
      const n = 16;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + r() * 0.3, rad = (0.35 + r() * 0.35) * scale, th = (0.05 + r() * 0.12) * scale;
        const tilt = 0.08 + r() * 0.12;
        rootList.push({ x: cx + Math.cos(a) * rad, y: 0, z: cz + Math.sin(a) * rad, sx: th, sz: th, sy: WH + 3, rx: -Math.sin(a) * tilt, rz: Math.cos(a) * tilt });
      }
      for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2; rootList.push({ x: cx + Math.cos(a) * 0.7 * scale, y: 0, z: cz + Math.sin(a) * 0.7 * scale, sx: 0.08, sz: 0.08, sy: 0.9, rx: -Math.sin(a) * 1.0, rz: Math.cos(a) * 1.0 }); }
      coll.circle(cx, cz, 0.75 * scale);
    };
    for (const c of cells.R) { const [cx, cz] = cellC(c.i, c.j); rootCol(cx, cz); }
    // raíces que cuelgan por las paredes
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (isWall(i, j)) continue;
      for (let d = 0; d < 4; d++) {
        if (!isWall(i + DX[d], j + DZ[d]) || r() < 0.45) continue;
        const [[lx, lz], [rx, rz]] = sides(i, j, d), n = 1 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const t = r(), len = 0.8 + r() * 2.0, th = 0.025 + r() * 0.05;
          rootList.push({ x: U.lerp(lx, rx, t) - DX[d] * 0.18, y: WH + 0.2 - len, z: U.lerp(lz, rz, t) - DZ[d] * 0.18, sx: th, sz: th, sy: len + 0.2, rx: (r() - 0.5) * 0.1, rz: (r() - 0.5) * 0.1 });
        }
      }
    }
    {
      const m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), v4 = new T.Vector3(), s4 = new T.Vector3();
      const im = new T.InstancedMesh(rootGeo, barkMat, rootList.length);
      rootList.forEach((o, n) => { e4.set(o.rx || 0, 0, o.rz || 0); q4.setFromEuler(e4); v4.set(o.x, o.y, o.z); s4.set(o.sx, o.sy, o.sz); m4.compose(v4, q4, s4); im.setMatrixAt(n, m4); });
      im.castShadow = true; im.receiveShadow = true; st.scene.add(im);
    }
    // cortinas de raíces (se abren al pasar)
    const curtains = cells.C.map(c => {
      const [cx, cz] = cellC(c.i, c.j), grp = new T.Group(); grp.position.set(cx, 0, cz);
      const strands = [];
      for (let k = 0; k < 14; k++) {
        const len = 1.6 + r() * 1.2, th = 0.025 + r() * 0.03;
        const piv = new T.Group(); piv.position.set((k / 13 - 0.5) * 1.9, WH + 0.3, (r() - 0.5) * 0.4);
        const m = new T.Mesh(rootGeo, barkMat); m.scale.set(th, len, th); m.position.y = -len; m.castShadow = true; piv.add(m); grp.add(piv);
        strands.push({ piv, side: k < 7 ? -1 : 1, ph: r() * 6 });
      }
      grp.rotation.y = (ch(c.i - 1, c.j) === '#' || ch(c.i + 1, c.j) === '#') && ch(c.i, c.j - 1) !== '#' ? Math.PI / 2 : 0;
      st.scene.add(grp);
      return { grp, strands, open: 0, x: cx, z: cz };
    });

    // ============================================================ compuertas
    const symTex = (g, lit) => U.tex(U.canvas(24, 24, (gg) => {
      U.R(gg, '#5a5650', 0, 0, 24, 24); U.paint.noise(gg, 24, 24, r, ['#4a4640', '#6a665e', '#3e3a34'], 200);
      for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; U.R(gg, '#2a2622', Math.round(12 + Math.cos(t) * 10), Math.round(12 + Math.sin(t) * 10), 1, 1); }
      if (lit) U.text(gg, SYM[g].glyph, 12, 4, { align: 'center', size: 15, color: '#a0fff0', shadow: '#205050', font: 'bold 15px serif' });
      else U.R(gg, '#1e1a16', 8, 8, 8, 8);
    }), { repeat: false, mips: false });
    const gates = cells.gate.map((c, n) => {
      const G = GATES[n] || GATES[GATES.length - 1], sk = symKey(G.simbolo), [cx, cz] = cellC(c.i, c.j);
      const along = ch(c.i - 1, c.j) === '#' && ch(c.i + 1, c.j) === '#' ? 0 : Math.PI / 2; // pasillo norte-sur → reja a lo largo de x
      const grp = new T.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = along;
      const roots = new T.Group(); grp.add(roots);
      for (let k = 0; k < 9; k++) { const m = new T.Mesh(rootGeo, barkMat); const th = 0.07 + r() * 0.06; m.scale.set(th, WH + 0.6, th); m.position.set(-0.95 + k * 0.24, -0.1, (r() - 0.5) * 0.2); m.rotation.z = (r() - 0.5) * 0.25; m.castShadow = true; roots.add(m); }
      for (let k = 0; k < 4; k++) { const m = new T.Mesh(rootGeo, barkMat); m.scale.set(0.05, 2.3, 0.05); m.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.4; m.position.set(1.15, 0.4 + k * 0.5, 0.05); m.castShadow = true; roots.add(m); }
      const disk = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.12, 10), [U.mat({ color: 0x5a5650 }), U.mat({ map: symTex(sk, false) }), U.mat({ color: 0x5a5650 })]);
      disk.rotation.x = Math.PI / 2; disk.position.set(0, 1.35, 0.22); disk.castShadow = true; grp.add(disk);
      const back = disk.clone(); back.position.z = -0.22; back.rotation.x = -Math.PI / 2; grp.add(back);
      st.scene.add(grp);
      const box = coll.box(c.i * CS, c.j * CS, c.i * CS + CS, c.j * CS + CS);
      const gr = U.rng(U.hash('g' + n + seed)), choices = U.shuffle(gr, [...new Set([sk, 'cruz', 'agua', 'árbol', U.pick(gr, ['sol', 'luna', 'espada', 'moneda'])])]);
      return { n, c, G, sk, grp, roots, disk, back, box, open: false, anim: 0, x: cx, z: cz, closedByPora: false, choices };
    });
    const setGateLit = (g) => { const t = symTex(g.sk, true); g.disk.material[1] = U.mat({ map: t, emissive: 0x206050, emissiveMap: t, ei: 2 }); g.back.material = g.disk.material; };

    // ============================================================ plata suelta, nombres, cofre
    const silver = U.mat({ color: 0xd8dce4, rough: 0.25, metal: 0.95, emissive: 0x202428 });
    const coinGeo = new T.CylinderGeometry(0.07, 0.07, 0.02, 8);
    const piles = cells.coin.map(c => {
      const [cx, cz] = cellC(c.i, c.j), grp = new T.Group(); grp.position.set(cx + (r() - 0.5) * 0.6, 0, cz + (r() - 0.5) * 0.6);
      for (let k = 0; k < 14; k++) { const m = new T.Mesh(coinGeo, silver); const a = r() * 6.28, d = r() * 0.35; m.position.set(Math.cos(a) * d, 0.012 + (0.35 - d) * 0.3 * r(), Math.sin(a) * d); m.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6); m.castShadow = true; grp.add(m); }
      const cup = new T.Mesh(new T.LatheGeometry([[0, 0], [0.08, 0], [0.06, 0.1], [0.03, 0.14], [0.03, 0.22], [0.1, 0.3]].map(([x, y]) => new T.Vector2(x, y)), 7), silver);
      cup.position.set(0.2, 0, -0.15); cup.rotation.z = r() < 0.5 ? 1.4 : 0; cup.castShadow = true; grp.add(cup);
      st.scene.add(grp);
      const sp = st.particles({ mode: 'fireflies', count: 7, center: [grp.position.x, 0.2, grp.position.z], box: [0.6, 0.3, 0.6], size: 0.03, color: 0xe8f0ff, bright: 2.5, speed: 1.2, far: 16,
        positions: (n, rr) => [grp.position.x + (rr() - 0.5) * 0.5, 0.15 + rr() * 0.2, grp.position.z + (rr() - 0.5) * 0.5] });
      return { c, grp, sp, taken: false, x: grp.position.x, z: grp.position.z, n: 14 };
    });
    const VECINOS = ['Petrona Aguirre', 'J. M. Cabral', 'Fermina Ledesma', 'Pantaleón Gómez', 'Ña Rosa Insaurralde', 'Toribio Vallejos', 'Casiana Romero', 'Benjamín Sotelo', 'Juana Ojeda', 'Eusebio Acuña', 'Dolores Maciel', 'Silverio Fernández'];
    const plaques = cells.n.map((c, n) => {
      const d = [0, 1, 2, 3].find(d => ch(c.i + DX[d], c.j + DZ[d]) === '#'); if (d === undefined) return null;
      const names = [VECINOS[(n * 2) % VECINOS.length], VECINOS[(n * 2 + 1) % VECINOS.length]];
      const tex = U.tex(U.canvas(40, 24, (g) => {
        U.R(g, '#7a3420', 0, 0, 40, 24); U.paint.noise(g, 40, 24, r, ['#6a2a18', '#8a4028', '#5a2214'], 300);
        U.text(g, names[0].toUpperCase().slice(0, 12), 20, 3, { align: 'center', size: 6, color: '#3a160c', shadow: '#a8603a', font: 'bold 6px monospace' });
        U.text(g, names[1].toUpperCase().slice(0, 12), 20, 11, { align: 'center', size: 6, color: '#3a160c', shadow: '#a8603a', font: 'bold 6px monospace' });
        U.text(g, '1865', 20, 18, { align: 'center', size: 5, color: '#3a160c', font: 'bold 5px monospace' });
      }), { repeat: false, mips: false });
      const [cx, cz] = cellC(c.i, c.j);
      const m = new T.Mesh(new T.PlaneGeometry(1.4, 0.84), U.mat({ map: tex, rough: 1 }));
      m.position.set(cx + DX[d] * 0.88, 1.3, cz + DZ[d] * 0.88); m.rotation.y = Math.atan2(-DX[d], -DZ[d]); m.receiveShadow = true; st.scene.add(m);
      return { x: cx + DX[d] * 0.5, z: cz + DZ[d] * 0.5, r: 1.5, names };
    }).filter(Boolean);
    // cofre de Fray Benicio sobre un pedestal de piedra
    const chest = new T.Group();
    {
      const iron = U.mat({ color: 0x2e2a26, rough: 0.5, metal: 0.7 }), wood = U.mat({ map: woodT, color: 0xb08860 });
      const body = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 0.56), wood); body.position.y = 0.25; chest.add(body);
      const lid = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.9, 7, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.y = 0.5; chest.add(lid);
      for (const x of [-0.3, 0.3]) { const b = new T.Mesh(new T.BoxGeometry(0.06, 0.52, 0.58), iron); b.position.set(x, 0.26, 0); chest.add(b); }
      const crossM = U.mat({ color: 0xc8a050, metal: 0.8, rough: 0.3, emissive: 0x302008 });
      const c1 = new T.Mesh(new T.BoxGeometry(0.05, 0.26, 0.02), crossM); c1.position.set(0, 0.3, 0.29); chest.add(c1);
      const c2 = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.02), crossM); c2.position.set(0, 0.34, 0.29); chest.add(c2);
      chest.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    }
    const [kx, kz] = cellC(K.i, K.j);
    const pedestal = new T.Mesh(new T.CylinderGeometry(0.7, 0.85, 0.5, 8), U.mat({ map: U.tex(U.canvas(16, 16, g => U.paint.flags(g, 16, 16, r, { n: 2 }))), color: 0xb0a898 }));
    pedestal.position.set(kx, 0.25, kz); pedestal.castShadow = pedestal.receiveShadow = true; st.scene.add(pedestal);
    chest.position.set(kx, 0.5, kz); st.scene.add(chest);
    const pedCol = coll.circle(kx, kz, 0.8);

    // ============================================================ luz
    st.scene.fog = new T.FogExp2(U.C(0x1a0c08), 0.035);
    st.renderer.setClearColor(U.C(0x0c0604));
    st.scene.add(new T.HemisphereLight(U.C(0x8a6a58), U.C(0x2a140c), 0.5));
    const post = st.post; post.sat.value = 1.0; post.exposure.value = 1.05; post.levels.value = 22; post.vig.value = 0.85; post.bloom.value = 1.0; post.bloomThr.value = 0.7;
    post.lift.value.setRGB(0.03, 0.015, 0.02); post.gain.value.setRGB(1.03, 0.97, 0.86);
    const shafts = [];
    const addShaft = (cx, cz, big, shadow) => {
      const s = st.lightShaft({ x: cx, y: 0, z: cz, height: big ? 7 : 6, rTop: big ? 0.9 : 0.4, rBottom: big ? 1.5 : 0.85, color: 0xffe8b0, intensity: big ? 0.16 : 0.13 });
      s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(1.2, 11, -1).normalize());
      st.scene.add(s);
      const sp = new T.SpotLight(U.C(0xffe2b0), big ? 9 : 5, 16, big ? 0.42 : 0.3, 0.6, 1.2);
      sp.position.set(cx + 1.2, 11, cz - 1.0); sp.target.position.set(cx, 0, cz); st.scene.add(sp); st.scene.add(sp.target);
      if (shadow) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0015; sp.shadow.camera.near = 4; sp.shadow.camera.far = 16; }
      st.particles({ mode: 'dust', count: big ? 90 : 45, center: [cx, 2.2, cz], box: [big ? 3.6 : 2, 4, big ? 3.6 : 2], size: 0.03, color: 0xffe8c0, bright: 1.3, far: 22, speed: 0.4 });
      shafts.push({ s, sp });
    };
    // la boca bajo el tronco: el haz grande
    { const [sx, sz] = cellC(15, 20); addShaft(sx, sz + 1, true, true); }
    cells.L.forEach((c, n) => { const [cx, cz] = cellC(c.i, c.j); addShaft(cx, cz, false, n === 0 || c.j < 8); });
    // escalones de raíz para subir a la superficie (salida)
    {
      const [sx, sz] = cellC(15, 21);
      for (let k = 0; k < 4; k++) { const m = new T.Mesh(rootGeo, barkMat); m.scale.set(0.14, 2.6, 0.14); m.rotation.z = Math.PI / 2; m.position.set(sx + 1.3, 0.18 + k * 0.32, sz + 1.2 - k * 0.15); m.castShadow = true; st.scene.add(m); }
    }

    // ============================================================ jugador
    const pl = U.person({ shirt: '#e0c070', pants: '#3a4a6a', hair: '#2a1a10', skin: '#d8a070' });
    pl.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const lantern = new T.Group();
    { const fr = U.mat({ color: 0x2a2420, metal: 0.6, rough: 0.5 });
      const cage = new T.Mesh(new T.BoxGeometry(0.12, 0.16, 0.12), U.mat({ color: 0xffd080, emissive: 0xff9a30, ei: 2.5 })); lantern.add(cage);
      const top = new T.Mesh(new T.BoxGeometry(0.15, 0.03, 0.15), fr); top.position.y = 0.09; lantern.add(top);
      lantern.position.set(0, -0.68, 0.06); pl.userData.armR.add(lantern); }
    const lamp = new T.PointLight(U.C(0xffa850), 1.4, 7.5, 1.6); lamp.position.set(0, -0.6, 0.15); pl.userData.armR.add(lamp);
    st.addFlicker(lamp, 1.4, 2, 0.7);
    // luz de relleno sobre el personaje (que se lea desde arriba)
    const fill = new T.PointLight(U.C(0xffe0c0), 0.9, 7, 1.5); st.scene.add(fill);
    const carried = chest.clone(); carried.scale.setScalar(0.62); carried.position.set(0, 0.18, 0.34); carried.visible = false; pl.userData.torso.add(carried);
    const [px0, pz0] = cellC(15, 20); pl.position.set(px0, 0, pz0 - 0.5); pl.rotation.y = Math.PI; st.scene.add(pl);
    const ctl = st.thirdPerson({ obj: pl, collider: coll, radius: 0.32, speed: 3.4, dist: 9.5, pitch: 0.98, lookH: 0.9, face: Math.PI });

    // ============================================================ la Pora
    const pora = new T.Group();
    const poraCore = new T.Mesh(new T.IcosahedronGeometry(0.14, 0), new T.MeshBasicMaterial({ color: new T.Color(2.4, 3.2, 2.8) })); pora.add(poraCore);
    const poraHalo = st.halo({ color: 0x70ffd0, size: 1.8, intensity: 0.55, bands: 5 }); pora.add(poraHalo);
    const poraLight = new T.PointLight(U.C(0x60ffc8), 2.2, 9, 1.5); pora.add(poraLight);
    const [ppx, ppz] = cellC(PP.i, PP.j); pora.position.set(ppx, 1.6, ppz); st.scene.add(pora);
    const poraSparks = st.particles({ mode: 'fireflies', count: 24, center: [0, 0, 0], box: [1, 1, 1], size: 0.03, color: 0x90ffe0, bright: 2, speed: 1.5, far: 20, positions: () => [0, 0, 0] });
    const PORA_COL = { calm: [0x70ffd0, 0x60ffc8], angry: [0xff6030, 0xff4a20] };
    // estela que marca la salida cuando la Pora está tranquila y llevás el cofre
    const trail = []; for (let k = 0; k < 14; k++) { const h = st.halo({ color: 0x70ffd0, size: 0.5, intensity: 0.4, bands: 3 }); h.visible = false; st.scene.add(h); trail.push(h); }

    // ============================================================ estado
    const S = { time: TIME, coins: 0, hasChest: false, gatesOpen: 0, pora: 'idle', angryT: 0, zone: 0, zonesSeen: new Set([0]), done: false, slamT: SLAM, slams: 0, wrong: 0, mistakes: 0 };
    const SND = st.sfx;
    const amb = SND.loop({ freq: 140, vol: 0.05 }), drip = SND.loop({ freq: 3000, filter: 'bandpass', q: 6, vol: 0.0 });
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    function hud() {
      const z = ZONES[S.zone];
      st.status(`<span style="color:${S.time < 60 ? '#ff6040' : '#f4f0d8'}">TIEMPO ${fmt(Math.max(0, S.time))}</span><br>` +
        `COMPUERTAS ${S.gatesOpen}/${gates.length}<br>COFRE ${S.hasChest ? '<span style="color:#f0c030">LO LLEVÁS</span>' : 'NO'}` +
        (S.coins ? `<br><span style="color:#ff9070">PLATA EN EL BOLSILLO: ${S.coins}</span>` : '') +
        (z ? `<br><span style="color:#c8b8a0">${String(z.nombre).toUpperCase()}</span>` : ''));
    }
    st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>${GOAL}`);
    st.titleCard(TITLE, INTRO, 5.5);
    st.showKeys(['[WASD ↑↓←→] caminar · [SHIFT] correr', '[Q E] girar la cámara', '[ESPACIO] interactuar'], 14);
    hud();

    // ============================================================ lógica
    const bfsPath = (si, sj, ti, tj, open) => {
      const par = new Map([[key(si, sj), -1]]), q = [[si, sj]];
      while (q.length) { const [i, j] = q.shift(); if (i === ti && j === tj) break; for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d], k = key(ni, nj); if (par.has(k) || isWall(ni, nj)) continue; const g = gates.find(g => g.c.i === ni && g.c.j === nj); if (g && !g.open && !open) continue; par.set(k, key(i, j)); q.push([ni, nj]); } }
      if (!par.has(key(ti, tj))) return null;
      const out = []; let k = key(ti, tj); while (k !== -1) { out.push([k % 100, Math.floor(k / 100)]); k = par.get(k); } return out.reverse();
    };
    function setPora(state) {
      S.pora = state; const c = PORA_COL[state === 'angry' ? 'angry' : 'calm'];
      poraHalo.material.uniforms.uColor.value.copy(U.C(c[0]).multiplyScalar(0.55)); poraLight.color.copy(U.C(c[1]));
      poraSparks.material.uniforms.uColor.value.copy(U.C(state === 'angry' ? 0xffa060 : 0x90ffe0).multiplyScalar(2));
      poraCore.material.color.setRGB(...(state === 'angry' ? [3.4, 1.4, 0.6] : [2.4, 3.2, 2.8]));
    }
    function poraSays(t, col) { st.toast(/^\(/.test(t) ? `<span style="color:${col || '#a0ffe0'}">${t}</span>` : `<span style="color:${col || '#a0ffe0'}">La Pora: "${t}"</span>`, 3.4); SND.tone(220, 1.2, { type: 'sine', vol: 0.05, slide: 1.5 }); SND.tone(330, 1.4, { type: 'sine', vol: 0.03, slide: 0.7, delay: 0.3 }); }
    function anger() {
      if (S.pora !== 'angry') { poraSays(PLINES[0], '#ff9070'); st.flash(0xff4020, 0.35); }
      setPora('angry'); S.angryT = CHASE;
      // las raíces se cierran
      for (const g of gates) if (g.open) { g.closedByPora = true; g.box.on = true; }
      SND.noise(1.2, { freq: 200, vol: 0.35, sweep: 80 }); st.shake(0.4);
      st.objective(`<b>${String(TITLE).toUpperCase()}</b><br><span style="color:#ff9070">¡La Pora te persigue y las raíces se cerraron! Aguantá ${CHASE} s o devolvé la plata.</span>`);
    }
    function calm() {
      setPora(S.hasChest ? 'follow' : 'idle'); S.angryT = 0;
      for (const g of gates) if (g.closedByPora) { g.closedByPora = false; g.box.on = false; }
      st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>${S.hasChest ? 'Llevá el cofre hasta la boca bajo el tronco' : GOAL}`);
    }
    function returnCoins(msg) {
      S.coins = 0; for (const p of piles) if (p.taken) { p.taken = false; p.grp.visible = true; p.sp.visible = true; }
      if (msg) st.toast(msg, 3, '#a0ffe0'); calm(); hud();
    }
    async function useGate(g) {
      const opts2 = g.choices;
      const ans = await st.choose('Compuerta de raíces', `Una piedra redonda con un hueco tallado. Alrededor, una frase: "${pistaCorta(g.G.pista)}"\n¿Qué símbolo del plano ponés?`, opts2.map(k => `${SYM[k].glyph}  ${SYM[k].name}`));
      if (st.done) return;
      if (opts2[ans] === g.sk) {
        g.open = true; g.box.on = false; S.gatesOpen++; setGateLit(g);
        SND.tone(392, 0.3, { type: 'triangle', vol: 0.08 }); SND.tone(523, 0.4, { type: 'triangle', vol: 0.08, delay: 0.15 }); SND.tone(784, 0.6, { type: 'triangle', vol: 0.06, delay: 0.3 });
        SND.noise(1.6, { freq: 300, vol: 0.3, sweep: 90, delay: 0.3 }); st.shake(0.25);
        st.toast(`El símbolo brilla. Las raíces se retiran crujiendo. (${S.gatesOpen}/${gates.length})`, 3);
        if (S.angryT > 0) g.closedByPora = true, g.box.on = true;
      } else {
        S.wrong++; S.time -= 15; st.shake(0.6); st.flash(0x3a1a0a, 0.5);
        SND.noise(0.8, { freq: 180, vol: 0.4, sweep: 60 });
        st.toast('Las raíces se aprietan y cae tierra del techo. Ese no era. (−15 s)', 3, '#ff9070');
        dirtFall(g.x, g.z);
      }
      hud();
    }
    async function takeChest() {
      st.busy++;
      try {
        await st.say('El cofre de Fray Benicio', 'Madera dura, herrajes y una cruz. Adentro: ' + TESORO.join('; ') + '.', { speed: 60 });
        await st.say('Carta de Fray Benicio', CARTA, { pitch: 300 });
      } finally { st.busy--; }
      if (st.done) return;
      S.hasChest = true; chest.visible = false; carried.visible = true; ctl.slow = 0.75; pedCol.on = false;
      SND.tone(523, 0.2, { type: 'square', vol: 0.06 }); SND.tone(659, 0.2, { type: 'square', vol: 0.06, delay: 0.1 }); SND.tone(784, 0.4, { type: 'square', vol: 0.06, delay: 0.2 });
      if (S.coins > 0) { poraSays(PLINES[1] || PLINES[0], '#ff9070'); anger(); }
      else { poraSays(PLINES[1] || '...'); setTimeout(() => { if (!st.done) poraSays(PLINES[2] || '(la luz te sigue)'); }, 3200); setPora('follow');
        st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>Llevá el cofre hasta la boca bajo el tronco. La Pora te alumbra el camino.`); }
      hud();
    }
    async function takeCoins(p) {
      const a = await st.choose('', 'Monedas de plata y un cáliz, tirados en la tierra. Nadie se daría cuenta...', ['Dejarlas. No son mías.', 'Agarrar la plata.']);
      if (st.done || a !== 1) { if (a === 0) st.toast('Las dejás donde estaban. La luz de las monedas se calma.', 2.2); return; }
      p.taken = true; p.grp.visible = false; p.sp.visible = false; S.coins += p.n;
      SND.tone(1200, 0.1, { type: 'square', vol: 0.05 }); SND.tone(1500, 0.12, { type: 'square', vol: 0.05, delay: 0.06 });
      anger(); hud();
    }
    // tierra que cae (golpe de la topadora o error)
    function dirtFall(x, z) {
      const f = st.particles({ mode: 'fall', count: 60, center: [x, 0, z], box: [2.4, WH + 1, 2.4], size: 0.06, color: 0x8a5a3a, bright: 0.7, speed: 1.4, far: 22 });
      setTimeout(() => { f.visible = false; }, 2000);
    }
    const moundGeo = [new T.DodecahedronGeometry(0.6, 0), new T.IcosahedronGeometry(0.45, 0)], moundMat = U.mat({ map: floorT, color: 0xc08a6a, rough: 1 });
    function slam() {
      S.slams++;
      st.shake(1.0); SND.noise(1.6, { freq: 120, vol: 0.6, sweep: 40 }); SND.tone(55, 0.8, { type: 'sawtooth', vol: 0.1, slide: 0.6 });
      const pi = Math.floor(pl.position.x / CS), pj = Math.floor(pl.position.z / CS);
      dirtFall(pl.position.x, pl.position.z);
      // elegir un pasadizo para tapar que no corte el camino entrada ↔ cofre ↔ jugador
      const cand = [];
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const c = ch(i, j); if (c !== '.' && c !== 'C' && c !== '~' || isWall(i, j)) continue;
        if (Math.abs(i - pi) + Math.abs(j - pj) < 3) continue;
        if (gates.some(g => Math.abs(g.c.i - i) + Math.abs(g.c.j - j) <= 1) || Math.abs(i - K.i) + Math.abs(j - K.j) <= 1 || cells.S.some(s => Math.abs(s.i - i) + Math.abs(s.j - j) <= 1)) continue;
        if (Math.hypot(pora.position.x - (i + 0.5) * CS, pora.position.z - (j + 0.5) * CS) < 2) continue;
        const d = Math.hypot(i - pi, j - pj); cand.push({ i, j, s: Math.abs(d - 5) + r() * 2 });
      }
      cand.sort((a, b) => a.s - b.s);
      for (const c of cand.slice(0, 25)) {
        blocked.add(key(c.i, c.j));
        const ok = bfsPath(15, 20, K.i, K.j, true) && bfsPath(pi, pj, 15, 20, true) && piles.every(p => p.taken || bfsPath(15, 20, p.c.i, p.c.j, true));
        if (!ok) { blocked.delete(key(c.i, c.j)); continue; }
        const [cx, cz] = cellC(c.i, c.j);
        for (let k = 0; k < 9; k++) { const m = new T.Mesh(U.pick(r, moundGeo), moundMat); m.position.set(cx + (r() - 0.5) * 1.6, 0.2 + r() * 0.6, cz + (r() - 0.5) * 1.6); m.scale.set(1 + r(), 0.6 + r() * 0.8, 1 + r()); m.rotation.set(r() * 3, r() * 3, r() * 3); m.castShadow = m.receiveShadow = true; st.scene.add(m); }
        dirtFall(cx, cz);
        break;
      }
      st.toast(S.time < 60 ? '¡PUM! La topadora. La entrada se está viniendo abajo...' : '¡PUM! Arriba golpea la topadora. Cae tierra y se tapa un pasadizo.', 2.6, '#ffb070');
    }
    function enterZone(z) {
      const Z = ZONES[z]; if (!Z) return;
      st.titleCard(Z.nombre, Z.texto || '', 3);
      if (z === 3 && S.pora === 'idle') setTimeout(() => { if (!st.done && S.pora === 'idle') poraSays(PLINES[0]); }, 2500);
    }
    // interactuables
    const items = [];
    gates.forEach(g => items.push({ x: g.x, z: g.z, r: 2.5, kind: 'gate', g }));
    piles.forEach(p => items.push({ x: p.x, z: p.z, r: 1.5, kind: 'coin', p }));
    plaques.forEach(p => items.push(Object.assign({ kind: 'names' }, p)));
    items.push({ x: kx, z: kz, r: 2.3, kind: 'chest' });
    const [ex, ez] = cellC(15, 20); items.push({ x: ex, z: ez + 0.5, r: 3.2, kind: 'exit' });

    const debug = {
      info: () => ({ time: S.time, coins: S.coins, hasChest: S.hasChest, gatesOpen: S.gatesOpen, pora: S.pora, zone: S.zone, pos: [pl.position.x, pl.position.z], blocked: [...blocked] }),
      answer: n => gates[n].choices.indexOf(gates[n].sk),
      openGates() { for (const g of gates) if (!g.open) { g.open = true; g.box.on = false; S.gatesOpen++; setGateLit(g); } hud(); },
      slam: () => slam(),
      xy(x, z) { pl.position.set(x, 0, z); ctl.first = true; },
      piles: () => piles.map(p => [p.x, p.z, p.taken]),
      tp(i, j) { const [x, z] = cellC(i, j); pl.position.set(x, 0, z); ctl.first = true; },
      chest() { S.hasChest = true; chest.visible = false; carried.visible = true; ctl.slow = 0.75; pedCol.on = false; setPora(S.coins ? 'angry' : 'follow'); hud(); },
      win() { this.openGates(); this.chest(); this.tp(15, 20); },
      lose() { S.time = 0.5; },
      coins() { const p = piles.find(p => !p.taken); if (p) { p.taken = true; p.grp.visible = false; p.sp.visible = false; S.coins += p.n; anger(); hud(); } },
    };
    let hudT = 0, stepT = 0, endT = -1;
    return {
      debug,
      update(dt, t) {
        if (endT >= 0) { endT -= dt; if (endT < 0) st.finish({ ok: false, reason: LOSE_TXT, data: { reason: 'derrumbe', plata: S.coins } }); return; }
        if (!st.busy) S.time -= dt;
        const inWater = ch(Math.floor(pl.position.x / CS), Math.floor(pl.position.z / CS)) === '~';
        ctl.slow = (S.hasChest ? 0.75 : 1) * (inWater ? 0.7 : 1);
        ctl.update(dt);
        fill.position.set(pl.position.x + Math.sin(ctl.camYaw) * 1.6, 2.6, pl.position.z + Math.cos(ctl.camYaw) * 1.6);
        if (ctl.moving > 0.5) { stepT -= dt * ctl.moving; if (stepT <= 0) { stepT = 1.3; SND.noise(0.08, { freq: inWater ? 900 : 260, vol: inWater ? 0.12 : 0.07 }); } }
        // zonas
        const z = zoneAt(pl.position.x, pl.position.z);
        if (z >= 0 && z !== S.zone) { S.zone = z; if (!S.zonesSeen.has(z)) { S.zonesSeen.add(z); enterZone(z); } hud(); }
        // compuertas: animación de abrir/cerrar
        for (const g of gates) {
          const want = g.open && !g.closedByPora ? 1 : 0; g.anim = U.damp(g.anim, want, 2.5, dt);
          g.roots.position.y = -g.anim * (WH + 0.5); g.roots.visible = g.anim < 0.98;
        }
        // cortinas que se abren al pasar
        for (const c of curtains) {
          const d = Math.hypot(pl.position.x - c.x, pl.position.z - c.z); c.open = U.damp(c.open, d < 1.6 ? 1 : 0, 5, dt);
          for (const s of c.strands) s.piv.rotation.z = s.side * c.open * 0.7 + Math.sin(t * 0.8 + s.ph) * 0.03;
        }
        // topadora
        S.slamT -= dt; if (S.slamT <= 0 && !st.busy) { S.slamT = SLAM; slam(); }
        // Pora
        const pp = pora.position, tx = pl.position.x, tz = pl.position.z;
        if (S.pora === 'idle') { pp.x = U.damp(pp.x, kx + Math.sin(t * 0.4) * 1.6, 1, dt); pp.z = U.damp(pp.z, kz - 1.2 + Math.cos(t * 0.33) * 1.2, 1, dt); pp.y = 1.7 + Math.sin(t * 1.3) * 0.2; }
        else if (S.pora === 'follow') {
          const fx = tx - Math.sin(pl.rotation.y) * 0.9 + 0.6, fz = tz - Math.cos(pl.rotation.y) * 0.9;
          pp.x = U.damp(pp.x, fx, 2, dt); pp.z = U.damp(pp.z, fz, 2, dt); pp.y = U.damp(pp.y, 2.1 + Math.sin(t * 2) * 0.15, 2, dt);
        } else if (S.pora === 'angry') {
          const dx = tx - pp.x, dz = tz - pp.z, d = Math.hypot(dx, dz), sp = 2.5 + diff * 0.05;
          if (d > 0.01) { pp.x += dx / d * Math.min(d, sp * dt); pp.z += dz / d * Math.min(d, sp * dt); }
          pp.y = U.damp(pp.y, 1.3 + Math.sin(t * 5) * 0.15, 4, dt);
          S.angryT -= st.busy ? 0 : dt;
          if (d < 0.8 && !st.busy && !debug.ghost) {
            S.time -= 25; st.flash(0xff6030, 0.8); st.shake(0.8); SND.noise(1, { freq: 1500, vol: 0.3, sweep: 200 });
            returnCoins('La Pora te atraviesa: un frío de muerte. La plata vuelve sola a su lugar. (−25 s)');
          } else if (S.angryT <= 0) { calm(); poraSays(S.hasChest && !S.coins ? (PLINES[2] || '...') : '...', '#a0ffe0'); }
        }
        const pc = U.flicker(t * 1.5, 4); poraLight.intensity = (S.pora === 'angry' ? 3 : 2.2) * pc;
        poraSparks.material.uniforms.uCenter.value.set(pp.x, pp.y, pp.z); poraSparks.material.uniforms.uBox.value.set(1.4, 1.4, 1.4);
        // estela hacia la salida
        if (S.pora === 'follow') {
          if (!this._trailT || (this._trailT -= dt) <= 0) {
            this._trailT = 0.6;
            const path = bfsPath(Math.floor(tx / CS), Math.floor(tz / CS), 15, 20, false) || [];
            trail.forEach((h, k) => { const c = path[1 + k * 2]; h.visible = !!c; if (c) { const [cx, cz] = cellC(c[0], c[1]); h.position.set(cx, 0.6, cz); } });
          }
          trail.forEach((h, k) => { h.position.y = 0.5 + Math.sin(t * 3 + k) * 0.1; });
        } else trail.forEach(h => { h.visible = false; });
        // interacción
        const it = st.busy ? null : st.nearest(items.filter(i => !(i.kind === 'gate' && i.g.open) && !(i.kind === 'coin' && i.p.taken) && !(i.kind === 'chest' && S.hasChest && !S.coins)), tx, tz);
        let pr = null;
        if (it) {
          if (it.kind === 'gate') pr = '<b>[ESPACIO]</b> poner un símbolo en la piedra';
          else if (it.kind === 'coin') pr = '<b>[ESPACIO]</b> mirar la plata';
          else if (it.kind === 'names') pr = '<b>[ESPACIO]</b> leer los nombres';
          else if (it.kind === 'chest') pr = S.hasChest ? '<b>[ESPACIO]</b> devolver la plata' : '<b>[ESPACIO]</b> abrir el cofre';
          else if (it.kind === 'exit') pr = S.hasChest ? '<b>[ESPACIO]</b> subir con el cofre' : 'La boca bajo el tronco: por acá se sale';
        }
        st.prompt(pr);
        if (it && st.action()) {
          if (it.kind === 'gate') useGate(it.g);
          else if (it.kind === 'coin') takeCoins(it.p);
          else if (it.kind === 'names') st.say('Nombres grabados en la tierra', `"${it.names[0]}" y "${it.names[1]}", con fecha de 1865. Vecinos que le confiaron sus ahorros al fraile.`, { pitch: 300 });
          else if (it.kind === 'chest') { if (!S.hasChest) takeChest(); else if (S.coins) returnCoins('Devolvés la plata junto al pedestal. La Pora se calma.'); }
          else if (it.kind === 'exit' && S.hasChest) {
            const score = Math.max(0, Math.round(S.time * 4 + (S.coins ? 0 : 800) - S.wrong * 50));
            st.finish({ ok: true, score, message: S.coins ? 'Saliste con el cofre... y con plata en el bolsillo. La Pora no se olvida.' : WIN_TXT,
              data: { segundosRestantes: Math.round(S.time), plata: S.coins, errores: S.wrong, flags: { pora_codicia: S.coins > 0 } } });
          }
        }
        // goteo de agua cerca del ojo de agua
        drip.set(S.zone === 2 ? 0.02 : 0.004);
        amb.set(0.05 + (S.time < 60 ? 0.04 : 0));
        if (S.time <= 0 && endT < 0) {
          endT = 2.2; st.shake(1.6); SND.noise(2.5, { freq: 100, vol: 0.7, sweep: 30 }); dirtFall(tx, tz); st.flash(0x2a1408, 0.9);
          st.toast(LOSE_TXT, 4, '#ff6040'); st.prompt(null);
        }
        hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); }
      },
    };
  },
});
