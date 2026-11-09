// CHIPA CITY — escena "tunel": los túneles coloniales bajo las iglesias de Corrientes.
// Dungeon crawler en primera persona, movimiento por casilla con giros de 90° suavizados.
'use strict';
ChipaScenes.register('tunel', {
  fov: 66, lowH: 300,
  create(st, opts) {
    const T = THREE, { U } = ChipaScenes;
    const diff = U.diff(opts);
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    const S = 2, WH = 2.4, VH = 3.0, EYE = 1.5;
    const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
    const DIRN = ['NORTE', 'ESTE', 'SUR', 'OESTE'], LAT = ['AD SEPTENTRIONEM', 'AD ORIENTEM', 'AD MERIDIEM', 'AD OCCIDENTEM'];
    const toHigu = opts.exit === 'higuera' || opts.salida === 'higuera';
    const from = U.o(opts, 'from desde', 'la Cruz de los Milagros');
    const TITLE = U.o(opts, 'titulo title', 'Los túneles de las Siete Corrientes');
    const INTRO = U.o(opts, 'intro', 'Debajo de las iglesias de Corrientes corren túneles de ladrillo de la colonia. Dicen que los frailes los usaban para llegar al río sin que nadie los viera. La antorcha no dura para siempre, chamigo.');
    const GOAL = U.o(opts, 'objetivo goal', toHigu ? 'Encontrá la salida hacia la Higuera' : 'Seguí el agua hasta el río');
    const RULE = U.o(opts, 'regla', 'Donde gotea, se avanza; donde brilla, se cae.');
    const GALS = U.o(opts, 'niveles', [
      { nombre: 'Galería de la Cruz', bajo: 'calle Belgrano', texto: 'Paredes de ladrillo y raíces que atraviesan el techo.' },
      { nombre: 'Cruce de la Merced', bajo: 'la Iglesia de la Merced', texto: 'Una campana suena arriba. El polvo cae del techo.' },
      { nombre: 'Bóveda del Cabildo', bajo: 'la Jefatura de Policía', texto: 'Grilletes oxidados y un banco de piedra. Se escuchan pasos arriba.' },
      { nombre: 'Pasaje de los Frailes', bajo: 'el convento de San Francisco', texto: 'Cruces talladas y una inscripción: "Fr. B. pasó por aquí. Sin miedo."' },
      { nombre: 'Boca del río', bajo: 'la Costanera', texto: 'Luz de luna. El Paraná está bajo y la boca quedó a la vista.' },
    ]);
    const POMB_HELP = !!U.o(opts, 'pomberoAyuda ayudaPombero', false);
    const POMB = opts.pombero || (opts.pomberoAyuda !== undefined ? {} : null);
    const PLINES = (POMB && POMB.lineas) || (POMB_HELP ? ['Psst. ¿Tenés tabaco?', '(fuma) Ahora sí. Seguí mi silbido, gurí.', 'A la derecha no. A la derecha está el Kurupí. Mentira. Pero no vayas.']
      : ['Psst. ¿Tenés tabaco?', '¿No? Mezquino.', '(silbido burlón desde el pasillo equivocado)']);
    const FINDS = U.o(opts, 'hallazgos', ['Medalla de la Merced', 'Cartucho de fusil de 1865', 'Página del diario de Fray Benicio']);
    const DIARY = U.o(opts, 'diarioFraile', 'Abril de 1865. La flota entró al puerto. Lo llevaré bajo tierra hasta el río. Que vuelva al pueblo cuando haya paz.');
    const TORCH = opts.antorcha || {};
    const WIN_TXT = U.o(opts, 'textoGana', toHigu ? '¡Saliste bajo la Higuera!' : '¡Saliste al río! Corre aire fresco.');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Te quedaste a oscuras en los túneles.');
    const peligro = (g, re) => !!(GALS[g] && GALS[g].peligro && re.test(GALS[g].peligro));
    // qué galería tiene cada peligro (si el guion no los nombra, van en el orden clásico)
    const findGal = (re, def) => { for (let g = 0; g < GALS.length; g++) if (peligro(g, re)) return g; return GALS.some(x => x.peligro) ? -1 : Math.min(def, GALS.length - 1); };
    const G_RATS = findGal(/rata/i, 0), G_GUARD = findGal(/linterna|hombre|guardia|sigilo/i, 2), G_WATER = findGal(/agua/i, 3), G_WIND = findGal(/corriente|viento/i, 4);

    // ============================================================ laberinto
    let N, g, at, S0, E, P, O, A, keyC, direct, rubble, pits, traps, jars, solution, solIdx, drips, finds, pombC;
    const key = (i, j) => j * 1000 + i;
    function bfs(si, sj, block) {
      const dist = new Map(); dist.set(key(si, sj), 0); const q = [[si, sj]];
      while (q.length) {
        const [i, j] = q.shift(), d0 = dist.get(key(i, j));
        for (let d = 0; d < 4; d++) {
          const ni = i + DX[d], nj = j + DZ[d], k = key(ni, nj);
          if (!at(ni, nj) || dist.has(k) || (block && block(ni, nj))) continue;
          dist.set(k, d0 + 1); q.push([ni, nj]);
        }
      }
      return dist;
    }
    const nbrs = (i, j) => { let c = 0; for (let d = 0; d < 4; d++) if (at(i + DX[d], j + DZ[d])) c++; return c; };
    function generate(r) {
      const n = 4 + Math.round(diff * 0.55); N = 2 * n + 1;
      g = new Uint8Array(N * N);
      at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : g[j * N + i];
      const set = (i, j, v) => { g[j * N + i] = v; };
      const sj = 1 + 2 * Math.floor(r() * n);
      const stack = [[1, sj]]; set(1, sj, 1);
      while (stack.length) {
        const [i, j] = stack[stack.length - 1], ch = [];
        for (let d = 0; d < 4; d++) { const ni = i + DX[d] * 2, nj = j + DZ[d] * 2; if (ni > 0 && nj > 0 && ni < N - 1 && nj < N - 1 && !at(ni, nj)) ch.push(d); }
        if (!ch.length) { stack.pop(); continue; }
        const d = U.pick(r, ch); set(i + DX[d], j + DZ[d], 1); set(i + DX[d] * 2, j + DZ[d] * 2, 1); stack.push([i + DX[d] * 2, j + DZ[d] * 2]);
      }
      S0 = { i: 1, j: sj };
      let dist = bfs(1, sj);
      // salida: callejón sin salida contra el borde este/norte/sur, lo más lejos posible
      let best = null;
      for (let j = 1; j < N - 1; j += 2) for (let i = 1; i < N - 1; i += 2) {
        if (nbrs(i, j) !== 1 || !(i === N - 2 || j === 1 || j === N - 2) || i < N / 2) continue;
        const dd = dist.get(key(i, j)); if (best === null || dd > best.dd) best = { i, j, dd };
      }
      if (!best) return false;
      E = best;
      for (let d = 0; d < 4; d++) if (at(E.i + DX[d], E.j + DZ[d])) P = { i: E.i + DX[d], j: E.j + DZ[d], d: (d + 2) % 4 };
      const pd = E.i === N - 2 ? 1 : E.j === 1 ? 0 : 2;
      O = { i: E.i + DX[pd], j: E.j + DZ[pd], d: pd };
      // bucles (bifurcaciones): menos cuanto más difícil
      const loops = Math.round(n * n * (0.11 - diff * 0.007));
      const cand = [];
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        if (at(i, j) || (i + j) % 2 === 0) continue;
        if (Math.abs(i - E.i) + Math.abs(j - E.j) <= 1) continue;
        if ((at(i - 1, j) && at(i + 1, j)) || (at(i, j - 1) && at(i, j + 1))) cand.push([i, j]);
      }
      U.shuffle(r, cand).slice(0, loops).forEach(([i, j]) => set(i, j, 1));
      set(O.i, O.j, 1);
      A = { i: 0, j: sj }; set(0, sj, 1);
      dist = bfs(1, sj, (i, j) => (i === A.i && j === A.j));
      // llave: el callejón más lejano (que no sea la salida)
      let kb = null;
      for (let j = 1; j < N - 1; j += 2) for (let i = 1; i < N - 1; i += 2) {
        if (nbrs(i, j) !== 1 || (i === E.i && j === E.j) || (i === 1 && j === sj)) continue;
        const dd = dist.get(key(i, j)); if (dd === undefined) continue;
        if (!kb || dd > kb.dd) kb = { i, j, dd };
      }
      if (!kb || kb.dd < n) return false;
      keyC = kb;
      const special = new Set([key(S0.i, S0.j), key(E.i, E.j), key(P.i, P.j), key(O.i, O.j), key(A.i, A.j), key(keyC.i, keyC.j)]);
      const corridors = [];
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) if (at(i, j) && !special.has(key(i, j)) && (dist.get(key(i, j)) || 0) > 3) corridors.push({ i, j, n: nbrs(i, j) });
      U.shuffle(r, corridors);
      const used = new Set(special);
      // derrumbes: solo donde no cortan el laberinto
      rubble = new Set();
      const allFloor = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (at(i, j)) allFloor.push(key(i, j));
      let want = 1 + Math.round(diff * 0.6);
      for (const c of corridors) {
        if (want <= 0) break; if (c.n !== 2 || used.has(key(c.i, c.j))) continue;
        rubble.add(key(c.i, c.j));
        const dd = bfs(1, sj, (i, j) => rubble.has(key(i, j)));
        if (dd.size !== allFloor.length - rubble.size) rubble.delete(key(c.i, c.j));
        else { used.add(key(c.i, c.j)); want--; }
      }
      // camino correcto (inicio → llave → salida): goteras en los ramales buenos, monedas trampa en los malos
      const blockR = (i, j) => rubble.has(key(i, j)) || (i === A.i && j === A.j);
      const pathTo = (a, b) => {
        const par = new Map([[key(a.i, a.j), null]]), q = [[a.i, a.j]];
        while (q.length) { const [i, j] = q.shift(); if (i === b.i && j === b.j) break;
          for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d], k = key(ni, nj); if (!at(ni, nj) || blockR(ni, nj) || par.has(k)) continue; par.set(k, key(i, j)); q.push([ni, nj]); } }
        const out = []; let k = key(b.i, b.j); while (k !== null && k !== undefined) { out.push(k); k = par.get(k); } return out.reverse();
      };
      solution = pathTo(S0, keyC).concat(pathTo(keyC, E).slice(1)).concat([key(O.i, O.j)]);
      direct = pathTo(S0, E).concat([key(O.i, O.j)]); // recorrido directo inicio → salida (define las galerías)
      solIdx = new Map(); solution.forEach((k, n) => { if (!solIdx.has(k)) solIdx.set(k, n); });
      drips = new Set(); const wrong = [];
      for (const k of solution) {
        const i = k % 1000, j = Math.floor(k / 1000); let open = 0;
        for (let d = 0; d < 4; d++) if (at(i + DX[d], j + DZ[d]) && !blockR(i + DX[d], j + DZ[d])) open++;
        if (open < 3) continue;
        for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d], nk = key(ni, nj); if (!at(ni, nj) || blockR(ni, nj)) continue; if (solIdx.has(nk)) drips.add(nk); else wrong.push(nk); }
      }
      const take = (cnt, filt) => { const out = []; for (const c of corridors) { if (out.length >= cnt) break; const k = key(c.i, c.j); if (used.has(k) || (filt && !filt(c))) continue; used.add(k); out.push(c); } return out; };
      // vasijas con aceite: preferimos callejones
      const nJars = Math.max(2, Math.round(n * 0.75) - Math.floor(diff / 3));
      // el Pombero espera en la segunda galería, sobre el camino
      pombC = null;
      if (POMB) for (let n = Math.floor(direct.length * (GALS.length > 2 ? 0.24 : 0.2)); n < direct.length * (GALS.length > 2 ? 0.38 : 0.45); n++) {
        const k = direct[n], i = k % 1000, j = Math.floor(k / 1000);
        if (!used.has(k) && nbrs(i, j) === 2 && !drips.has(k)) { pombC = { i, j }; used.add(k); break; }
      }
      const nTraps = 1 + Math.floor(diff * 0.8);
      traps = [];
      for (const k of U.shuffle(r, wrong)) { if (traps.length >= nTraps) break; if (used.has(k) || drips.has(k)) continue; used.add(k); traps.push({ i: k % 1000, j: Math.floor(k / 1000) }); }
      if (traps.length < nTraps) traps = traps.concat(take(nTraps - traps.length, c => c.n === 2 && !solIdx.has(key(c.i, c.j))));
      finds = take(FINDS.length, c => c.n === 1 && (c.i % 2) && (c.j % 2) && !solIdx.has(key(c.i, c.j)));
      if (finds.length < FINDS.length) finds = finds.concat(take(FINDS.length - finds.length, c => c.n === 2 && !drips.has(key(c.i, c.j))));
      jars = take(nJars, c => c.n === 1 && (c.i % 2) && (c.j % 2));
      if (jars.length < nJars) jars = jars.concat(take(nJars - jars.length, c => c.n === 2 && !drips.has(key(c.i, c.j))));
      pits = take(1 + Math.floor(diff / 3), c => c.n === 2 && !solIdx.has(key(c.i, c.j)) && !drips.has(key(c.i, c.j)));
      return true;
    }
    let rr, tries = 0;
    do { rr = U.rng(U.hash(String(seed) + ':' + tries)); tries++; } while (!generate(rr) && tries < 80);
    const isRubble = (i, j) => rubble.has(key(i, j));
    const pitSet = new Set(pits.map(c => key(c.i, c.j))), trapSet = new Set(traps.map(c => key(c.i, c.j)));
    const trapKind = new Map(traps.map((c, n) => [key(c.i, c.j), n % 2 ? 'pozo' : 'derrumbe']));

    // ============================================================ galerías: el camino se reparte en tramos con nombre
    // (las galerías siguen el recorrido directo hasta la salida; el ramal de la llave toma la galería de donde sale)
    const NG = Math.max(1, GALS.length);
    const dpos = new Map(); direct.forEach((k, n) => { if (!dpos.has(k)) dpos.set(k, n); });
    const galOfCell = k => dpos.has(k) ? Math.min(NG - 1, Math.floor(dpos.get(k) / direct.length * NG)) : -1;
    const gal = new Int8Array(N * N).fill(-1);
    {
      const q = [];
      direct.forEach(k => { const i = k % 1000, j = Math.floor(k / 1000); if (gal[j * N + i] < 0) { gal[j * N + i] = galOfCell(k); q.push([i, j]); } });
      for (let h = 0; h < q.length; h++) {
        const [i, j] = q[h];
        for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d]; if (!at(ni, nj) || gal[nj * N + ni] >= 0) continue; gal[nj * N + ni] = gal[j * N + i]; q.push([ni, nj]); }
      }
    }
    const galAt = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : Math.max(0, gal[j * N + i]);
    // guardias del Ministro: patrullan un ramal que cruza el camino (sigilo)
    const guardDefs = [];
    if (G_GUARD >= 0) {
      const cands = [];
      direct.forEach((k, n) => {
        const i = k % 1000, j = Math.floor(k / 1000);
        if (i === O.i && j === O.j) return;
        for (let d = 0; d < 4; d++) {
          const bi = i + DX[d], bj = j + DZ[d], bk = key(bi, bj);
          if (!at(bi, bj) || isRubble(bi, bj) || solIdx.has(bk) || pitSet.has(bk)) continue;
          const cells = [[i, j]]; let ci = bi, cj = bj;
          while (cells.length < 5 && at(ci, cj) && !isRubble(ci, cj) && !solIdx.has(key(ci, cj)) && !pitSet.has(key(ci, cj))) { cells.push([ci, cj]); ci += DX[d]; cj += DZ[d]; }
          if (cells.length < 3) continue;
          cands.push({ n, cells, score: Math.abs(galOfCell(k) - G_GUARD) * 100 + Math.abs(n / direct.length - (G_GUARD + 0.5) / NG) * 10 - cells.length * 2 });
        }
      });
      cands.sort((a, b) => a.score - b.score);
      const want = diff >= 6 ? 2 : 1;
      for (const c of cands) {
        if (guardDefs.length >= want) break;
        if (guardDefs.some(g => Math.abs(g.n - c.n) < 4)) continue;
        guardDefs.push(c);
      }
      guardDefs.sort((a, b) => a.n - b.n);
    }

    // ============================================================ texturas
    const r = U.rng(U.hash('tex' + seed));
    const brickC = U.canvas(32, 32, (gg, w, h) => {
      U.paint.brick(gg, w, h, r, { bw: 8, bh: 4, cols: ['#7a4630', '#86503a', '#6a3c2a', '#946044', '#5e3624', '#7e5a44', '#8c4a30'], mortar: '#3a3028' });
      for (let k = 0; k < 3; k++) { const x = Math.floor(r() * 4) * 8 + 1, y = Math.floor(r() * 8) * 4 + 1; U.R(gg, '#1e1612', x, y, 7, 3); U.R(gg, '#2e241c', x, y, 7, 1); }
      // manchas de humedad y salitre
      for (let k = 0; k < 18; k++) U.R(gg, r() < 0.5 ? '#c8b89a' : '#5a3a2a', Math.floor(r() * 32), Math.floor(r() * 32), 1, 1);
    });
    const brickT = U.tex(brickC); const brickB = U.tex(brickC, { linear: true });
    const floorC = U.canvas(64, 32, (gg) => {
      const sub = U.canvas(32, 32, s => U.paint.flags(s, 32, 32, r, { n: 3 }));
      gg.drawImage(sub, 0, 0); gg.drawImage(sub, 32, 0);
      // mitad derecha: baldosas rajadas (trampa), con pista visible
      gg.strokeStyle = '#141008'; gg.lineWidth = 1;
      const crack = [[34, 6], [40, 10], [44, 9], [49, 16], [55, 18], [60, 26]];
      for (let k = 0; k < crack.length - 1; k++) { const [x0, y0] = crack[k], [x1, y1] = crack[k + 1]; for (let s = 0; s <= 8; s++) U.R(gg, '#120e0a', Math.round(x0 + (x1 - x0) * s / 8), Math.round(y0 + (y1 - y0) * s / 8), 1, 1); }
      for (let s = 0; s < 6; s++) { U.R(gg, '#120e0a', 44 + s, 9 + s * 2, 1, 1); U.R(gg, '#120e0a', 49 - s, 16 + s, 1, 1); }
    });
    const floorT = U.tex(floorC);
    const stoneC = U.canvas(16, 16, (gg) => U.paint.flags(gg, 16, 16, r, { n: 2, cols: ['#6a6058', '#5a5048', '#746a60'] }));
    const stoneT = U.tex(stoneC);
    const woodT = U.tex(U.canvas(16, 16, (gg) => U.paint.planks(gg, 16, 16, r, { pw: 4 })));

    // ============================================================ geometría del laberinto
    // paredes: ladrillo (0), sillares de piedra del Cabildo (1), revoque a la cal de los frailes (2)
    const wallBs = [new U.Builder(), new U.Builder(), new U.Builder()], floorB = new U.Builder(), ceilB = new U.Builder();
    const WMAT = [0, 0, 1, 2, 0];
    let wallB = wallBs[0];
    const cellTint = (i, j) => { const h = U.rng(key(i, j) * 7 + 3)(); return 0.82 + h * 0.3; };
    // tinte por galería: ladrillo tibio, polvo, piedra gris del Cabildo, cal de los frailes, verdín del río
    const GTINT = [[1, 1, 1], [1.04, 0.96, 0.88], [0.78, 0.8, 0.86], [1.12, 1.04, 0.9], [0.72, 0.92, 0.84]];
    let curTint = GTINT[0];
    const lin = (k, warm) => [k * (warm ? 1.02 : 1) * curTint[0], k * curTint[1], k * (warm ? 0.92 : 1) * curTint[2]];
    const sides = (i, j, d) => {
      const x0 = i * S, z0 = j * S, x1 = x0 + S, z1 = z0 + S;
      return [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]][d];
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!at(i, j)) continue;
      const x0 = i * S, z0 = j * S, x1 = x0 + S, z1 = z0 + S, cx = x0 + S / 2, cz = z0 + S / 2, tk = cellTint(i, j);
      const isA = i === A.i && j === A.j, isO = i === O.i && j === O.j;
      curTint = GTINT[galAt(i, j) % GTINT.length]; wallB = wallBs[WMAT[galAt(i, j) % WMAT.length]];
      // piso (con trampa rajada o pozo)
      const cr = trapSet.has(key(i, j)) ? 0.5 : 0, rot = Math.floor(U.rng(key(i, j))() * 4);
      const uvs = [[cr, 0], [cr + 0.5, 0], [cr + 0.5, 1], [cr, 1]];
      const ruv = k => uvs[(k + rot) % 4];
      const fc = lin(0.75 * tk);
      if (pitSet.has(key(i, j))) {
        const m = 0.4, xa = x0 + m, xb = x1 - m, za = z0 + m, zb = z1 - m, D = -0.55;
        const ring = [[x0, z1, x1, zb], [x0, za, x1, z0], [x0, zb, xa, za], [xb, zb, x1, za]];
        for (const [ax, az, bx, bz] of ring) floorB.quad([ax, 0, az], [bx, 0, az], [bx, 0, bz], [ax, 0, bz], [[ax / S, az / S], [bx / S, az / S], [bx / S, bz / S], [ax / S, bz / S]].map(([u, v]) => [u * 0.5, v]), fc);
        const inner = [[[xa, za], [xb, za]], [[xb, za], [xb, zb]], [[xb, zb], [xa, zb]], [[xa, zb], [xa, za]]];
        for (const [[ax, az], [bx, bz]] of inner) floorB.quad([bx, D, bz], [ax, D, az], [ax, 0, az], [bx, 0, bz], [[0, 0], [0.6, 0], [0.6, 0.3], [0, 0.3]], [[0.2, 0.2, 0.2], [0.2, 0.2, 0.2], fc, fc]);
      } else if (isA) {
        // escalera que sube a la iglesia (hacia -x)
        const nS = 7;
        for (let s = 0; s < nS; s++) {
          const xa = x1 - (s + 1) * S / nS, xb = x1 - s * S / nS, y = (s + 1) * 0.22, yp = s * 0.22, c = lin(0.6 + s * 0.06);
          floorB.quad([xa, y, z1], [xb, y, z1], [xb, y, z0], [xa, y, z0], [[0, 0], [0.5, 0], [0.5, 0.25], [0, 0.25]], c);
          floorB.quad([xb, yp, z1], [xb, yp, z0], [xb, y, z0], [xb, y, z1], [[0, 0], [0.5, 0], [0.5, 0.06], [0, 0.06]], lin(0.45 + s * 0.05));
        }
      } else floorB.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [ruv(0), ruv(1), ruv(2), ruv(3)], fc);
      // paredes y bóveda de arista
      for (let d = 0; d < 4; d++) {
        const [[lx, lz], [rx, rz]] = sides(i, j, d);
        const open = at(i + DX[d], j + DZ[d]);
        const len = S;
        if (!open && !(isO && d === O.d) && !(isA && d === 3)) {
          const bot = lin(0.45 * tk), mid = lin(0.9 * tk, true), top = lin(0.7 * tk);
          wallB.quad([lx, 0, lz], [rx, 0, rz], [rx, 1.2, rz], [lx, 1.2, lz], [[0, 0], [len, 0], [len, 1.2], [0, 1.2]], [bot, bot, mid, mid]);
          wallB.quad([lx, 1.2, lz], [rx, 1.2, rz], [rx, WH, rz], [lx, WH, lz], [[0, 1.2], [len, 1.2], [len, WH], [0, WH]], [mid, mid, top, top]);
        }
        if (isA && d === 3) {
          // marco de la puerta de arriba: paredes laterales y dintel
          wallB.quad([lx, 0, lz], [lx, 0, lz - 0.5], [lx, WH, lz - 0.5], [lx, WH, lz], [[0, 0], [0.5, 0], [0.5, 2.4], [0, 2.4]], lin(0.6));
          wallB.quad([rx, 0, rz + 0.5], [rx, 0, rz], [rx, WH, rz], [rx, WH, rz + 0.5], [[0, 0], [0.5, 0], [0.5, 2.4], [0, 2.4]], lin(0.6));
        }
        // bóveda
        const cc = lin(0.55 * tk), ce = lin(0.75 * tk);
        ceilB.tri([lx, WH, lz], [rx, WH, rz], [cx, VH, cz], [0, 0], [len, 0], [len / 2, 1.2], [ce, ce, cc]);
        // pilastras/arcos en los pasajes de pasillos rectos
        if (!open && ((i + j) % 2 === 1) && !(isO || isA)) {
          const ox = -DX[d] * 0.14, oz = -DZ[d] * 0.14, wv = 0.28;
          for (const [px, pz, sx, sz] of [[lx, lz, rx - lx, rz - lz], [rx, rz, lx - rx, lz - rz]]) {
            const ux = sx / len * wv, uz = sz / len * wv, c = lin(0.8 * tk, true);
            wallB.quad([px + ox, 0, pz + oz], [px + ux + ox, 0, pz + uz + oz], [px + ux + ox, WH, pz + uz + oz], [px + ox, WH, pz + oz], [[0, 0], [0.28, 0], [0.28, 2.4], [0, 2.4]], [lin(0.4), lin(0.4), c, c]);
            wallB.quad([px + ux + ox, 0, pz + uz + oz], [px + ux, 0, pz + uz], [px + ux, WH, pz + uz], [px + ux + ox, WH, pz + uz + oz], [[0, 0], [0.14, 0], [0.14, 2.4], [0, 2.4]], [lin(0.3), lin(0.3), lin(0.55), lin(0.55)]);
          }
        }
      }
    }
    const wallMat = U.mat({ map: brickT, bump: brickB, bumpScale: 0.9, vc: true, rough: 0.95 });
    const floorMat = U.mat({ map: floorT, vc: true, rough: 0.7, bump: U.tex(floorC, { linear: true }), bumpScale: 0.5 });
    const ceilMat = U.mat({ map: brickT, bump: brickB, bumpScale: 0.6, vc: true, rough: 1 });
    const mk = (b, m) => { const ms = new T.Mesh(b.geometry(), m); ms.receiveShadow = true; ms.castShadow = true; st.scene.add(ms); return ms; };
    // sillares grandes de piedra
    const ashC = U.canvas(32, 32, (gg, w, h) => {
      U.R(gg, '#2a2622', 0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += 8, row++) for (let x = -(row % 2) * 8; x < w; x += 16) {
        const c = U.pick(r, ['#7a746a', '#6e685e', '#847e72', '#6a645a']);
        for (const ox of [0, w]) { U.R(gg, c, x + 1 + ox, y + 1, 15, 7); U.R(gg, U.shade(c, 1.2), x + 1 + ox, y + 1, 15, 1); U.R(gg, U.shade(c, 0.7), x + 1 + ox, y + 7, 15, 1); }
      }
      U.paint.noise(gg, w, h, r, ['#5a544a', '#8e887c', '#4a463e'], 160);
      for (let k = 0; k < 6; k++) U.R(gg, '#3a5a2a', Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
    });
    // revoque a la cal, descascarado: asoma el ladrillo
    const calC = U.canvas(32, 32, (gg, w, h) => {
      U.R(gg, '#cfc4a8', 0, 0, w, h); U.paint.noise(gg, w, h, r, ['#c8bc9e', '#d6ccb2'], w * h * 0.25);
      for (let k = 0; k < 4; k++) { const x = Math.floor(r() * 26), y = Math.floor(r() * 26), ww = 4 + Math.floor(r() * 6), hh = 3 + Math.floor(r() * 4);
        U.R(gg, '#7a4630', x, y, ww, hh); for (let yy = y; yy < y + hh; yy += 2) U.R(gg, '#4a3a2c', x, yy, ww, 1); U.R(gg, '#a89a7c', x - 1, y - 1, ww + 2, 1); }
      for (let k = 0; k < 3; k++) { let x = Math.floor(r() * 32), y = Math.floor(r() * 16); for (let s = 0; s < 10; s++) { U.R(gg, '#8a806a', x, y, 1, 1); x += Math.floor(r() * 3) - 1; y++; } }
    });
    const ashT = U.tex(ashC), calT = U.tex(calC);
    const wallMats = [wallMat, U.mat({ map: ashT, bump: U.tex(ashC, { linear: true }), bumpScale: 0.8, vc: true, rough: 0.95 }), U.mat({ map: calT, bump: U.tex(calC, { linear: true }), bumpScale: 0.12, vc: true, rough: 1 })];
    wallBs.forEach((b, n) => { if (b.pos.length) mk(b, wallMats[n]); }); mk(floorB, floorMat); mk(ceilB, ceilMat);
    const cellC = (i, j) => [i * S + S / 2, j * S + S / 2];
    const wallPos = (i, j, d, y, inset = 0) => { const [cx, cz] = cellC(i, j); return new T.Vector3(cx + DX[d] * (S / 2 - inset), y, cz + DZ[d] * (S / 2 - inset)); };
    const faceIn = d => Math.atan2(-DX[d], -DZ[d]);

    // ============================================================ ambiente: luz, niebla, partículas
    st.scene.fog = new T.FogExp2(U.C(0x1c0f08), 0.13);
    st.renderer.setClearColor(U.C(0x0a0604));
    st.scene.add(new T.HemisphereLight(U.C(0x3a2a22), U.C(0x0a0606), 0.35));
    Object.assign(st.post, {});
    st.post.sat.value = 0.88; st.post.exposure.value = 0.95; st.post.levels.value = 20; st.post.vig.value = 0.95; st.post.bloom.value = 1.1; st.post.lift.value.setRGB(0.025, 0.012, 0.02); st.post.gain.value.setRGB(1.02, 0.96, 0.86);

    const rnd = U.rng(U.hash('props' + seed));
    // agua de los pozos
    const waterC = U.canvas(16, 16, (gg) => { U.R(gg, '#0e2a2a', 0, 0, 16, 16); U.paint.noise(gg, 16, 16, rnd, ['#164040', '#0a2020', '#1e5050'], 60); for (let k = 0; k < 5; k++) U.R(gg, '#4a8a80', Math.floor(rnd() * 14), Math.floor(rnd() * 16), 2, 1); });
    const waterT = U.tex(waterC);
    const waterMat = U.mat({ map: waterT, rough: 0.15, metal: 0.2, transparent: true, opacity: 0.88, emissive: 0x041414 });
    for (const c of pits) {
      const [cx, cz] = cellC(c.i, c.j);
      const w = new T.Mesh(new T.PlaneGeometry(S - 0.8, S - 0.8), waterMat); w.rotation.x = -Math.PI / 2; w.position.set(cx, -0.28, cz); w.receiveShadow = true; st.scene.add(w);
      st.particles({ mode: 'fall', count: 6, center: [cx + (rnd() - 0.5) * 0.6, 0, cz + (rnd() - 0.5) * 0.6], box: [0.05, VH - 0.1, 0.05], size: 0.025, color: 0x9ad0d0, bright: 0.8, speed: 0.4, far: 10 });
    }
    st.updaters.push((dt, t) => { waterT.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.02); });
    // goteras sobre el buen camino: charquito brillante + gotas que caen
    const puddleMat = U.mat({ color: 0x1a2a2c, rough: 0.05, metal: 0.3, transparent: true, opacity: 0.8 });
    const dripCells = [...drips].map(k => ({ i: k % 1000, j: Math.floor(k / 1000) }));
    for (const c of dripCells) {
      const [cx, cz] = cellC(c.i, c.j), ox = (rnd() - 0.5) * 0.5, oz = (rnd() - 0.5) * 0.5;
      const pd = new T.Mesh(new T.CircleGeometry(0.32 + rnd() * 0.15, 7), puddleMat); pd.rotation.x = -Math.PI / 2; pd.position.set(cx + ox, 0.012, cz + oz); pd.receiveShadow = true; st.scene.add(pd);
      st.particles({ mode: 'fall', count: 4, center: [cx + ox, 0, cz + oz], box: [0.06, VH - 0.15, 0.06], size: 0.02, color: 0xa8e0e8, bright: 1.6, speed: 0.55, far: 12 });
    }
    // monedas trampa: brillan (pozo o derrumbe)
    const coinMat = U.mat({ color: 0xf0c050, rough: 0.25, metal: 0.9, emissive: 0x3a2400 });
    const coinGeo = new T.CylinderGeometry(0.05, 0.05, 0.012, 7);
    const trapInfo = new Map();
    traps.forEach((c, n) => {
      const [cx, cz] = cellC(c.i, c.j), grp = new T.Group();
      for (let k = 0; k < 7; k++) { const m = new T.Mesh(coinGeo, coinMat); m.position.set((rnd() - 0.5) * 0.9, 0.01 + k * 0.004, (rnd() - 0.5) * 0.9); m.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4); grp.add(m); }
      grp.position.set(cx, 0, cz); st.scene.add(grp);
      const sp = st.particles({ mode: 'embers', count: 5, center: [cx, 0.02, cz], box: [0.9, 0.25, 0.9], size: 0.02, color: 0xffe090, bright: 2.5, speed: 0.4, far: 10 });
      trapInfo.set(key(c.i, c.j), { kind: n % 2 ? 'pozo' : 'derrumbe', grp, sp });
    });
    // hallazgos
    const findObjs = finds.map((c, n) => {
      const [cx, cz] = cellC(c.i, c.j), grp = new T.Group(), name = FINDS[n] || 'Algo viejo';
      const ledge = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.4), U.mat({ map: stoneT, color: 0x9a9088 })); ledge.position.y = 0.25; ledge.castShadow = ledge.receiveShadow = true; grp.add(ledge);
      let obj;
      if (/medalla/i.test(name)) { obj = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.02, 8), U.mat({ color: 0xb8b8c0, rough: 0.4, metal: 0.8 })); obj.rotation.x = Math.PI / 2; }
      else if (/cartucho|fusil/i.test(name)) { obj = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.16, 6), U.mat({ color: 0x8a6a3a, rough: 0.5, metal: 0.6 })); obj.rotation.z = Math.PI / 2; }
      else { obj = new T.Mesh(new T.PlaneGeometry(0.22, 0.3), U.mat({ map: U.tex(U.canvas(8, 10, gg => { U.R(gg, '#d8c8a0', 0, 0, 8, 10); for (let y = 1; y < 10; y += 2) U.R(gg, '#5a4a3a', 1, y, 5 + (y % 3), 1); }), { repeat: false, mips: false }), side: T.DoubleSide })); obj.rotation.x = -Math.PI / 2; }
      obj.position.y = 0.53; obj.castShadow = true; grp.add(obj);
      grp.position.set(cx, 0, cz); st.scene.add(grp);
      return { c, grp, obj, name, taken: false };
    });
    // el Pombero: hombrecito peludo con sombrero de paja, sentado en una piedra
    let pomb = null;
    if (pombC) {
      const grp = new T.Group(), fur = U.mat({ color: 0x5a3a22, rough: 1 }), straw = U.mat({ color: 0xd8b860, rough: 1 });
      const stone = new T.Mesh(new T.DodecahedronGeometry(0.28, 0), U.mat({ map: stoneT })); stone.position.y = 0.18; stone.scale.y = 0.7; grp.add(stone);
      const body = new T.Mesh(new T.DodecahedronGeometry(0.22, 0), fur); body.position.y = 0.55; body.scale.set(1, 1.2, 0.9); grp.add(body);
      const head = new T.Mesh(new T.DodecahedronGeometry(0.15, 0), fur); head.position.y = 0.85; grp.add(head);
      const brim = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.03, 8), straw); brim.position.y = 0.95; grp.add(brim);
      const crown = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 0.13, 8), straw); crown.position.y = 1.02; grp.add(crown);
      const eyeM = new T.MeshBasicMaterial({ color: new T.Color(2.5, 2.0, 0.6) });
      for (const x of [-0.05, 0.05]) { const e = new T.Mesh(new T.BoxGeometry(0.03, 0.025, 0.02), eyeM); e.position.set(x, 0.87, 0.14); grp.add(e); }
      const cig = st.flame({ w: 0.03, h: 0.04, bright: 4, grid: 3 }); cig.position.set(0.09, 0.8, 0.17); grp.add(cig);
      grp.traverse(o => { if (o.isMesh && !o.userData.flame) o.castShadow = true; });
      const [cx, cz] = cellC(pombC.i, pombC.j);
      // se sienta contra una pared del pasillo, mirando al centro
      const ws = [0, 1, 2, 3].filter(d => !at(pombC.i + DX[d], pombC.j + DZ[d]));
      const wd = ws.length ? ws[0] : 0;
      grp.position.set(cx + DX[wd] * 0.6, 0, cz + DZ[wd] * 0.6); grp.rotation.y = faceIn(wd);
      st.scene.add(grp);
      pomb = { grp, met: false, gone: 0, pranks: { blow: false, whistle: false } };
    }
    // derrumbes
    const rockMat = U.mat({ map: stoneT, color: 0xb0a090, rough: 1 });
    const rockGeo = [new T.DodecahedronGeometry(0.3, 0), new T.IcosahedronGeometry(0.25, 0), new T.DodecahedronGeometry(0.18, 0)];
    const addRocks = (cx, cz, n, h, spread) => {
      for (let k = 0; k < n; k++) {
        const m = new T.Mesh(U.pick(rnd, rockGeo), rockMat);
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * spread, s = 0.7 + rnd() * 1.4;
        m.position.set(cx + Math.cos(a) * rr, Math.max(0.1, (1 - rr / spread) * h * rnd()) , cz + Math.sin(a) * rr);
        m.scale.setScalar(s); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); m.castShadow = m.receiveShadow = true; st.scene.add(m);
      }
    };
    for (const k of rubble) {
      const i = k % 1000, j = Math.floor(k / 1000), [cx, cz] = cellC(i, j);
      addRocks(cx, cz, 34, 1.9, 0.95);
      const beam = new T.Mesh(new T.BoxGeometry(0.22, 0.22, 2.3), U.mat({ map: woodT, color: 0x8a6a4a })); beam.position.set(cx, 1.0, cz); beam.rotation.set(0.9, rnd() * 3, 0.2); beam.castShadow = true; st.scene.add(beam);
    }
    // reja con candado
    const iron = U.mat({ color: 0x3a3634, rough: 0.55, metal: 0.6 });
    const gate = new T.Group();
    {
      const axis = P.d % 2; // 0: pasillo norte-sur → reja a lo largo de x
      for (let k = 0; k < 9; k++) { const b = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, WH, 5), iron); b.position.set(-0.9 + k * 0.225, WH / 2, 0); b.castShadow = true; gate.add(b); }
      for (const y of [0.3, 1.3, 2.2]) { const b = new T.Mesh(new T.BoxGeometry(1.9, 0.07, 0.05), iron); b.position.y = y; b.castShadow = true; gate.add(b); }
      const lock = new T.Mesh(new T.BoxGeometry(0.2, 0.22, 0.09), U.mat({ color: 0xa08030, rough: 0.35, metal: 0.8 })); lock.position.set(0, 1.15, 0.08); gate.add(lock);
      const sh = new T.Mesh(new T.TorusGeometry(0.07, 0.018, 4, 8, Math.PI), iron); sh.position.set(0, 1.26, 0.08); gate.add(sh);
      const [cx, cz] = cellC(P.i, P.j); gate.position.set(cx, 0, cz); gate.rotation.y = axis ? Math.PI / 2 : 0;
      st.scene.add(gate);
    }
    let gateOpen = false, gateAnim = 0;
    // llave
    const gold = U.mat({ color: 0xe0b040, rough: 0.3, metal: 0.85, emissive: 0x2a1800 });
    const keyM = new T.Group();
    {
      const ring = new T.Mesh(new T.TorusGeometry(0.07, 0.02, 4, 8), gold); ring.position.y = 0.16; keyM.add(ring);
      const shaft = new T.Mesh(new T.BoxGeometry(0.025, 0.26, 0.025), gold); keyM.add(shaft);
      for (const [y, w] of [[-0.1, 0.07], [-0.05, 0.05]]) { const t = new T.Mesh(new T.BoxGeometry(w, 0.025, 0.025), gold); t.position.set(w / 2, y, 0); keyM.add(t); }
      const [cx, cz] = cellC(keyC.i, keyC.j); keyM.position.set(cx, 1.0, cz); keyM.scale.setScalar(1.6); st.scene.add(keyM);
      // pedestal: cofre viejo
      const chest = new T.Mesh(new T.BoxGeometry(0.7, 0.5, 0.45), U.mat({ map: woodT, color: 0xa07850 })); chest.position.set(cx, 0.25, cz); chest.castShadow = chest.receiveShadow = true; st.scene.add(chest);
      const band = new T.Mesh(new T.BoxGeometry(0.72, 0.06, 0.47), iron); band.position.set(cx, 0.4, cz); st.scene.add(band);
    }
    const keySpark = st.particles({ mode: 'embers', count: 10, center: [keyM.position.x, 0.6, keyM.position.z], box: [0.4, 0.8, 0.4], size: 0.02, color: 0xffd060, bright: 2, speed: 0.5 });
    let hasKey = false;
    // vasijas de aceite
    const clay = U.mat({ color: 0x9a5a34, rough: 0.8 });
    const jarGeo = new T.LatheGeometry([[0, 0], [0.16, 0.02], [0.22, 0.2], [0.2, 0.36], [0.1, 0.46], [0.09, 0.52], [0.12, 0.55]].map(([x, y]) => new T.Vector2(x, y)), 7);
    const jarObjs = jars.map(c => {
      const [cx, cz] = cellC(c.i, c.j), m = new T.Mesh(jarGeo, clay);
      m.position.set(cx + (rnd() - 0.5) * 0.5, 0, cz + (rnd() - 0.5) * 0.5); m.scale.setScalar(1.2); m.castShadow = m.receiveShadow = true; st.scene.add(m);
      return { c, m, taken: false };
    });
    // apliques de pared (antorchas) e inscripciones
    const feats = new Map(); const fkey = (i, j, d) => key(i, j) * 4 + d;
    const floors = []; for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) if (at(i, j) && !isRubble(i, j)) floors.push({ i, j });
    U.shuffle(rnd, floors);
    const wallsOf = (i, j) => [0, 1, 2, 3].filter(d => !at(i + DX[d], j + DZ[d]));
    const sconces = [];
    const sconceGeo = new T.BoxGeometry(0.08, 0.35, 0.08), stickGeo = new T.CylinderGeometry(0.035, 0.025, 0.42, 5);
    const distS = bfs(S0.i, S0.j, (i, j) => isRubble(i, j));
    const addSconce = (i, j, d, lit) => {
      const p = wallPos(i, j, d, 1.55, 0.06), grp = new T.Group(); grp.position.copy(p); grp.rotation.y = faceIn(d);
      const b = new T.Mesh(sconceGeo, iron); grp.add(b);
      const s = new T.Mesh(stickGeo, U.mat({ map: woodT, color: 0x6a4a30 })); s.position.set(0, 0.2, 0.12); s.rotation.x = 0.35; grp.add(s);
      const f = st.flame({ w: 0.2, h: 0.36 }); f.position.set(0, 0.42, 0.2); f.visible = lit; grp.add(f);
      st.scene.add(grp);
      const sc = { i, j, d, lit, flame: f, pos: grp.localToWorld(new T.Vector3(0, 0.55, 0.32)) };
      grp.updateMatrixWorld(); sc.pos = grp.localToWorld(new T.Vector3(0, 0.55, 0.3));
      sconces.push(sc); feats.set(fkey(i, j, d), { type: 'sconce', sc });
    };
    // una cerca del inicio, prendida
    { const ws = wallsOf(S0.i, S0.j).filter(d => d !== 3); addSconce(S0.i, S0.j, ws.length ? ws[0] : 0, true); }
    const nSc = Math.round(floors.length * 0.05);
    for (const c of floors) {
      if (sconces.length >= nSc) break;
      const ws = wallsOf(c.i, c.j); if (!ws.length || sconces.some(s => Math.abs(s.i - c.i) + Math.abs(s.j - c.j) < 4)) continue;
      const d = U.pick(rnd, ws); if (feats.has(fkey(c.i, c.j, d))) continue;
      addSconce(c.i, c.j, d, rnd() < 0.3);
    }
    // inscripciones jesuíticas
    const dirTo = (i, j, ti, tj) => { const dx = ti - i, dz = tj - j; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0); };
    const lore = [
      ['IHS', 'IHS: las iniciales de Jesús que los jesuitas grababan en todo. Abajo, con letra de otro siglo: "por acá pasaban la yerba y la plata sin que nadie viera".'],
      ['AMDG', '"Ad maiorem Dei gloriam": a la mayor gloria de Dios. Alguien agregó con carbón: "y a la mayor gloria del contrabando".'],
      ['MDCLXXXIX', 'Un año en números romanos: 1689. Debajo, una cruz y un dibujo de una canoa.'],
      ['CAVE', '"Cave": cuidado. Hay marcas en el piso: las baldosas rajadas ceden.'],
      ['FR. ANTONIO', '"Fray Antonio pasó por aquí con la lámpara apagada y vivió para contarlo". Optimista, el fraile.'],
      ['AQVA', 'Una gota cae justo sobre la letra. "El agua apaga el fuego": no pises los pozos si podés evitarlos.'],
    ];
    const inscs = [];
    const inscTex = (txt) => U.tex(U.canvas(48, 24, (gg) => {
      U.paint.flags(gg, 48, 24, rnd, { n: 1, cols: ['#9a9080', '#a49a88', '#8e8474'], gap: '#5a5248' });
      U.R(gg, '#7a7060', 1, 1, 46, 22); U.R(gg, '#a89e8c', 2, 2, 44, 20);
      U.paint.noise(gg, 48, 24, rnd, ['#968c7a', '#b4aa98'], 120);
      const small = txt.length > 8;
      U.text(gg, txt, 24, small ? 8 : 6, { align: 'center', size: small ? 7 : 10, color: '#2a2018', shadow: '#d4cab4', font: `bold ${small ? 7 : 10}px serif` });
      U.R(gg, '#2a2018', 22, 18, 4, 1); U.R(gg, '#2a2018', 23, 17, 2, 3);
    }), { repeat: false });
    const addInsc = (i, j, d, title, read) => {
      const m = new T.Mesh(new T.PlaneGeometry(0.9, 0.45), U.mat({ map: inscTex(title), rough: 0.9 }));
      m.position.copy(wallPos(i, j, d, 1.35, 0.02)); m.rotation.y = faceIn(d); m.receiveShadow = true; st.scene.add(m);
      const o = { type: 'insc', i, j, d, title, read, m }; feats.set(fkey(i, j, d), o); inscs.push(o);
    };
    {
      const ws = wallsOf(S0.i, S0.j).filter(d => d !== 3 && !feats.has(fkey(S0.i, S0.j, d)));
      addInsc(S0.i, S0.j, ws.length ? ws[0] : 1, 'AMDG', `Bajo el convento de ${from}. "Ad maiorem Dei gloriam". Alguien rayó una flecha y la palabra FLVMEN: el río. Si el agua corre al río, la salida está hacia el ${DIRN[dirTo(S0.i, S0.j, E.i, E.j)]}.`);
    }
    const nIn = 4 + Math.floor(diff / 3);
    let li = 0;
    for (const c of floors) {
      if (inscs.length >= nIn + 1) break;
      const ws = wallsOf(c.i, c.j).filter(d => !feats.has(fkey(c.i, c.j, d)));
      if (!ws.length || inscs.some(s => Math.abs(s.i - c.i) + Math.abs(s.j - c.j) < 5)) continue;
      const d = U.pick(rnd, ws), kind = inscs.length % 3;
      if (kind === 1) { const dd = dirTo(c.i, c.j, keyC.i, keyC.j); addInsc(c.i, c.j, d, 'CLAVIS', `"Clavis ${LAT[dd].toLowerCase()}". La llave del río está hacia el ${DIRN[dd]}.`); }
      else if (kind === 2) { const dd = dirTo(c.i, c.j, E.i, E.j); addInsc(c.i, c.j, d, 'FLVMEN', `"Flumen ${LAT[dd].toLowerCase()}". El río, hacia el ${DIRN[dd]}.`); }
      else { const [t, txt] = lore[li++ % lore.length]; addInsc(c.i, c.j, d, t, txt); }
    }
    // portal de salida: el río de noche (o la Higuera)
    {
      const [cx, cz] = cellC(O.i, O.j), d = O.d;
      const tex = U.tex(U.canvas(96, 72, (gg) => {
        if (!toHigu) {
          for (let y = 0; y < 40; y++) U.R(gg, U.mix('#0a0c28', '#3a2a5a', y / 40), 0, y, 96, 1);
          for (let k = 0; k < 40; k++) U.R(gg, rnd() < 0.3 ? '#fff8e0' : '#8a8ab0', Math.floor(rnd() * 96), Math.floor(rnd() * 34), 1, 1);
          U.R(gg, '#f8f0c8', 62, 8, 6, 6); U.R(gg, '#f8f0c8', 61, 9, 8, 4); U.R(gg, '#d8d0a8', 64, 10, 2, 2);
          U.R(gg, '#141a24', 0, 38, 96, 3); for (let x = 0; x < 96; x += 7) U.R(gg, '#f0c060', x + Math.floor(rnd() * 5), 39, 1, 1);
          for (let y = 41; y < 72; y++) U.R(gg, U.mix('#1a2a4a', '#0a1020', (y - 41) / 31), 0, y, 96, 1);
          for (let y = 42; y < 70; y += 2) { const w = 3 + Math.floor(rnd() * 6); U.R(gg, '#c8c0a0', 63 + Math.floor((rnd() - 0.5) * (y - 38) * 0.5), y, w, 1); }
          for (let k = 0; k < 30; k++) U.R(gg, '#3a5a8a', Math.floor(rnd() * 96), 42 + Math.floor(rnd() * 30), 3, 1);
          for (let x = 0; x < 96; x += 2) { const h = 3 + Math.floor(rnd() * 8); U.R(gg, '#06080a', x, 72 - h, 1, h); }
        } else {
          for (let y = 0; y < 72; y++) U.R(gg, U.mix('#a8d070', '#2a4a1a', y / 72), 0, y, 96, 1);
          for (let k = 0; k < 26; k++) { const x = Math.floor(rnd() * 96), w = 1 + Math.floor(rnd() * 3); U.R(gg, U.pick(rnd, ['#4a3a24', '#5a4630', '#3a2e1c']), x, 0, w, 72); }
          for (let k = 0; k < 200; k++) U.R(gg, U.pick(rnd, ['#3a6a20', '#5a8a30', '#2a4a14']), Math.floor(rnd() * 96), Math.floor(rnd() * 30), 2, 2);
        }
      }), { repeat: false });
      const bm = new T.MeshBasicMaterial({ map: tex, fog: false, color: new T.Color(1.6, 1.6, 1.7) });
      const bd = new T.Mesh(new T.PlaneGeometry(6, 4.5), bm);
      bd.position.set(cx + DX[d] * 2.2, 1.6, cz + DZ[d] * 2.2); bd.rotation.y = faceIn(d); st.scene.add(bd);
      const pl = new T.PointLight(U.C(toHigu ? 0x90c060 : 0x6080c0), 2.2, 9, 2); pl.position.set(cx + DX[d] * 0.8, 2, cz + DZ[d] * 0.8); st.scene.add(pl);
      st.addFlicker(pl, 2.2, 3, 0.4);
      st.particles({ mode: toHigu ? 'fireflies' : 'dust', count: 40, center: [cx + DX[d], 1.3, cz + DZ[d]], box: [3, 2, 3], size: 0.03, color: toHigu ? 0xc0ff60 : 0xa0c0ff, bright: 1.5, far: 12 });
    }
    // la puerta de la iglesia arriba de la escalera
    {
      const [cx, cz] = cellC(A.i, A.j);
      const door = new T.Mesh(new T.PlaneGeometry(1.4, 1.5), new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.4, 1.4), fog: false }));
      door.position.set(cx - S / 2 - 0.4, 2.0, cz); door.rotation.y = Math.PI / 2; st.scene.add(door);
      const dl = new T.PointLight(U.C(0xffd8a0), 1.6, 7, 2); dl.position.set(cx - 0.3, 2.2, cz); st.scene.add(dl);
      st.particles({ mode: 'dust', count: 60, center: [cx, 1.6, cz], box: [2, 2.4, 2], size: 0.025, color: 0xffe0a0, bright: 1.4, far: 10, speed: 0.6 });
    }

    // ============================================================ utilería de cada galería (instanciada: pocas llamadas de dibujo)
    {
      const m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), v4 = new T.Vector3(), s4 = new T.Vector3();
      const inst = (geo, mat, list) => {
        if (!list.length) return null;
        const im = new T.InstancedMesh(geo, mat, list.length);
        list.forEach((o, n) => { e4.set(o.rx || 0, o.ry || 0, o.rz || 0); q4.setFromEuler(e4); v4.set(o.x, o.y, o.z); s4.set(o.sx || 1, o.sy || 1, o.sz || 1); m4.compose(v4, q4, s4); im.setMatrixAt(n, m4); });
        im.castShadow = true; im.receiveShadow = true; st.scene.add(im); return im;
      };
      const roots = [], rings = [], crosses = [], benches = [];
      const pr = U.rng(U.hash('gal' + seed));
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        if (!at(i, j) || isRubble(i, j) || (i === S0.i && j === S0.j)) continue;
        const g = galAt(i, j), [cx, cz] = cellC(i, j), ws = wallsOf(i, j);
        // raíces que atraviesan el techo (bajo calle Belgrano hay lapachos y ficus)
        if ((g === 0 || g === NG - 1) && pr() < 0.4) {
          const n = 3 + Math.floor(pr() * 5), ox = (pr() - 0.5) * 1.2, oz = (pr() - 0.5) * 1.2;
          for (let k = 0; k < n; k++) { const len = 0.4 + pr() * 1.3; roots.push({ x: cx + ox + (pr() - 0.5) * 0.5, y: VH - 0.15 - len / 2, z: cz + oz + (pr() - 0.5) * 0.5, sy: len, rx: (pr() - 0.5) * 0.3, rz: (pr() - 0.5) * 0.3, sx: 0.6 + pr() * 0.9, sz: 0.6 + pr() * 0.9 }); }
        }
        // grilletes en la bóveda del Cabildo
        if (g === 2 && ws.length && pr() < 0.35) {
          const d = U.pick(pr, ws), along = [DZ[d], -DX[d]];
          for (const off of [-0.35, 0.35]) for (let k = 0; k < 5; k++) {
            const p = wallPos(i, j, d, 1.75 - k * 0.11, 0.05); rings.push({ x: p.x + along[0] * off, y: p.y, z: p.z + along[1] * off, ry: faceIn(d) + (k % 2) * Math.PI / 2 });
          }
          if (pr() < 0.4) { const p = wallPos(i, j, d, 0.22, 0.3); benches.push({ x: p.x, y: 0.22, z: p.z, ry: faceIn(d) }); }
        }
        // cruces talladas en el pasaje de los frailes
        if (g === 3 && ws.length && pr() < 0.3) {
          const d = U.pick(pr, ws), p = wallPos(i, j, d, 1.5, 0.03);
          crosses.push({ x: p.x, y: p.y, z: p.z, ry: faceIn(d), sx: 0.06, sy: 0.42, sz: 0.04 });
          crosses.push({ x: p.x, y: p.y + 0.08, z: p.z, ry: faceIn(d), sx: 0.26, sy: 0.06, sz: 0.04 });
        }
      }
      const rootGeo = new T.CylinderGeometry(0.035, 0.012, 1, 4); rootGeo.translate(0, 0, 0);
      inst(rootGeo, U.mat({ color: 0x4a3424, rough: 1 }), roots);
      inst(new T.TorusGeometry(0.05, 0.014, 3, 6), iron, rings);
      inst(new T.BoxGeometry(1, 1, 1), U.mat({ map: stoneT, color: 0xd8d0c0 }), crosses);
      inst(new T.BoxGeometry(1.3, 0.44, 0.5), U.mat({ map: stoneT, color: 0xa09890 }), benches);
    }

    // ============================================================ jugador: antorcha en la mano
    const cam = st.camera; cam.rotation.order = 'YXZ';
    const view = new T.Group(); cam.add(view);
    const torchStick = new T.Mesh(new T.CylinderGeometry(0.028, 0.02, 0.5, 6), U.mat({ map: woodT, color: 0x7a5434 }));
    torchStick.position.set(0, -0.2, 0); view.add(torchStick);
    const wrap = new T.Mesh(new T.CylinderGeometry(0.045, 0.035, 0.1, 6), U.mat({ color: 0x3a2a1c, rough: 1 })); wrap.position.set(0, 0.06, 0); view.add(wrap);
    const tflame = st.flame({ w: 0.1, h: 0.2, bright: 2.2, grid: 7 }); tflame.position.set(0, 0.09, 0); view.add(tflame);
    view.position.set(0.3, -0.36, -0.55); view.rotation.set(0.15, 0, -0.18);
    const torch = new T.PointLight(U.C(0xff9a48), 1.2, 10, 2);
    torch.castShadow = true; torch.shadow.mapSize.set(512, 512); torch.shadow.camera.near = 0.05; torch.shadow.bias = -0.004; torch.shadow.radius = 1;
    torch.position.set(0.32, -0.08, -0.5); cam.add(torch);
    const embers = st.particles({ mode: 'embers', count: 14, center: [0, 0, 0], box: [0.06, 0.55, 0.06], size: 0.012, color: 0xffa040, bright: 2.2, speed: 0.9, far: 6 });
    // pozo de luces para los apliques (los más cercanos)
    const pool = [0, 1, 2].map(k => {
      const l = new T.PointLight(U.C(0xff8a3a), 0, 7, 2);
      if (k < 2) { l.castShadow = true; l.shadow.mapSize.set(256, 256); l.shadow.camera.near = 0.05; l.shadow.bias = -0.005; }
      st.scene.add(l); return l;
    });
    const dust = st.particles({ mode: 'dust', count: 220, center: [0, 1.4, 0], box: [7, 3, 7], size: 0.022, color: 0xffd0a0, bright: 0.45, far: 7, speed: 0.6 });
    // neblina al ras del piso
    const mistC = U.canvas(32, 32, (gg) => { const rn = U.rng(9); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = Math.floor(80 + 120 * (0.5 + 0.25 * Math.sin(x * 0.4 + rn() * 0.8) + 0.25 * Math.sin(y * 0.33 + x * 0.1))); gg.fillStyle = `rgb(${v},${v},${v})`; gg.fillRect(x, y, 1, 1); } });
    const mistT = U.tex(mistC, { linear: true }); mistT.repeat.set(N / 3, N / 3);
    const mist = new T.Mesh(new T.PlaneGeometry(N * S, N * S), new T.MeshLambertMaterial({ color: U.C(0x9a8a7a), alphaMap: mistT, transparent: true, opacity: 0.22, depthWrite: false }));
    mist.rotation.x = -Math.PI / 2; mist.position.set(N * S / 2, 0.18, N * S / 2); mist.renderOrder = 3; st.scene.add(mist);
    st.updaters.push((dt, t) => { mistT.offset.set(t * 0.012, t * 0.007); });

    // murciélagos
    const batTex = [0, 1].map(fr => U.tex(U.canvas(16, 8, (gg) => {
      const c = '#1a1214';
      U.R(gg, c, 7, 3, 2, 3); U.R(gg, '#e04030', 7, 4, 1, 1); U.R(gg, '#e04030', 8, 4, 1, 1);
      if (fr) { U.R(gg, c, 2, 1, 5, 1); U.R(gg, c, 4, 2, 3, 2); U.R(gg, c, 9, 1, 5, 1); U.R(gg, c, 9, 2, 3, 2); U.R(gg, c, 1, 0, 1, 2); U.R(gg, c, 14, 0, 1, 2); }
      else { U.R(gg, c, 2, 5, 5, 1); U.R(gg, c, 4, 4, 3, 1); U.R(gg, c, 9, 5, 5, 1); U.R(gg, c, 9, 4, 3, 1); U.R(gg, c, 1, 5, 1, 2); U.R(gg, c, 14, 5, 1, 2); }
    }), { repeat: false, mips: false }));
    const bats = [];
    for (let k = 0; k < 7; k++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: batTex[0], color: U.C(0x6a5a5a), fog: true }));
      sp.scale.set(0.42, 0.21, 1); sp.visible = false; st.scene.add(sp); bats.push({ sp, ox: 0, oy: 0, ph: k * 1.7 });
    }
    let batEv = null, batTimer = 32 - diff * 1.6 + rnd() * 10;

    // ratas (galería de la Cruz): cruzan corriendo al ras del piso
    const ratTex = [0, 1].map(fr => U.tex(U.canvas(12, 6, (gg) => {
      const c = '#3a2e28', c2 = '#5a4a40';
      U.R(gg, c, 3, 2, 6, 3); U.R(gg, c2, 4, 2, 4, 1); U.R(gg, c, 9, 3, 2, 2); U.R(gg, '#e8a0a0', 11, 4, 1, 1); U.R(gg, '#000', 10, 3, 1, 1);
      U.R(gg, '#a07870', 0, 3 + fr, 3, 1); // cola
      U.R(gg, c, fr ? 4 : 3, 5, 1, 1); U.R(gg, c, fr ? 7 : 8, 5, 1, 1);
    }), { repeat: false, mips: false }));
    const rats = [];
    for (let k = 0; k < 4; k++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: ratTex[0], color: U.C(0x9a8a80) })); sp.scale.set(0.36, 0.18, 1); sp.visible = false; st.scene.add(sp); rats.push({ sp, t: 1, a: new T.Vector3(), b: new T.Vector3(), dur: 1 }); }
    let ratTimer = 4;

    // agua que sube (pasaje de los frailes): una lámina por celda de esa galería
    let water = null;
    if (G_WATER >= 0) {
      const wb = new U.Builder();
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (!at(i, j) || galAt(i, j) !== G_WATER) continue;
        const x0 = i * S, z0 = j * S;
        wb.quad([x0, 0, z0 + S], [x0 + S, 0, z0 + S], [x0 + S, 0, z0], [x0, 0, z0], [[x0 / 4, (z0 + S) / 4], [(x0 + S) / 4, (z0 + S) / 4], [(x0 + S) / 4, z0 / 4], [x0 / 4, z0 / 4]], [1, 1, 1]);
      }
      if (wb.pos.length) {
        const wt = U.tex(U.canvas(16, 16, (gg) => { U.R(gg, '#1a3a3a', 0, 0, 16, 16); U.paint.noise(gg, 16, 16, rnd, ['#204848', '#123030', '#2a5a5a'], 70); for (let k = 0; k < 6; k++) U.R(gg, '#6aa098', Math.floor(rnd() * 13), Math.floor(rnd() * 16), 3, 1); }));
        const wm = new T.Mesh(wb.geometry(), U.mat({ map: wt, vc: true, rough: 0.1, metal: 0.3, transparent: true, opacity: 0.82, emissive: 0x061818, depthWrite: false }));
        wm.position.y = -0.02; wm.renderOrder = 2; wm.receiveShadow = true; st.scene.add(wm);
        water = { mesh: wm, tex: wt, level: 0, t: 0 };
      }
    }

    // hombres del Ministro con linterna
    const guards = guardDefs.map((gd, n) => {
      const p = U.person({ shirt: '#2a3448', pants: '#1a1a22', hair: '#2a2018', skin: '#c89070', hat: '#1e1e26', mustache: n % 2 === 0 });
      const torchL = new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.2, 6), U.mat({ color: 0x202020, metal: 0.6, rough: 0.4 }));
      torchL.rotation.x = Math.PI / 2; torchL.position.set(0, -0.56, 0.1); p.userData.armR.add(torchL);
      p.userData.armR.rotation.x = -1.2;
      const lens = new T.Mesh(new T.CircleGeometry(0.034, 6), new T.MeshBasicMaterial({ color: new T.Color(4, 4, 3.4) })); lens.position.set(0, -0.56, 0.205); p.userData.armR.add(lens);
      const spot = new T.SpotLight(U.C(0xdce8ff), 5, 11, 0.36, 0.45, 1.5);
      spot.position.set(0.34, 1.3, 0.3); p.add(spot); spot.target.position.set(0.2, 0.2, 5); p.add(spot.target);
      // haz visible: cono aditivo muy tenue
      const beamGeo = new T.ConeGeometry(0.9, 4.2, 10, 1, true); beamGeo.translate(0, -2.1, 0); beamGeo.rotateX(-Math.PI / 2 + 0.1);
      const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: U.C(0x9ab0d0).multiplyScalar(0.09), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      beam.position.set(0.3, 1.3, 0.3); p.add(beam);
      p.traverse(o => { if (o.isMesh && o !== beam && o !== lens) o.castShadow = true; });
      const [cx, cz] = cellC(gd.cells[0][0], gd.cells[0][1]); p.position.set(cx, 0, cz);
      st.scene.add(p);
      return { gd, cells: gd.cells, p, spot, beam, lens, idx: 1, from: 0, dir: 1, mt: 0, pause: 0.5 + n, alert: 0, off: false, gone: false, face: 0 };
    });

    // ============================================================ estado del jugador
    const d0 = [1, 0, 2].find(d => at(S0.i + DX[d], S0.j + DZ[d])) ?? 1;
    const Pl = { i: S0.i, j: S0.j, d: d0, x: 0, z: 0, yaw: -d0 * Math.PI / 2, anim: null, bob: 0, inPit: 0, fall: 0 };
    [Pl.x, Pl.z] = cellC(Pl.i, Pl.j);
    // segundos que dura una antorcha llena (el guion la da en antorcha.duracion)
    const burnTime = TORCH.duracion ? U.clamp(+TORCH.duracion, 30, 900) : 250 - diff * 13;
    const cebo = /cebo|vela/i.test(TORCH.recargas || '');
    let fuel = 1, ember = 0, elapsed = 0, swing = 0, finished = false, lose = false;
    let curGal = 0, galEntry = { i: S0.i, j: S0.j, d: d0 }, blowOut = 0, gust = 0, gustT = 4, caughtN = 0, immune = 0, ruleShown = false;
    const galSeen = new Set([0]);
    const found = [];
    const PB = { met: false, vanish: -1, falseWhistle: !POMB_HELP, prankBlow: -1, guardDone: false };
    const seen = new Uint8Array(N * N);
    const reveal = () => {
      seen[Pl.j * N + Pl.i] = 1;
      for (let d = 0; d < 4; d++) {
        for (let s = 1; s <= 6; s++) {
          const i = Pl.i + DX[d] * s, j = Pl.j + DZ[d] * s; if (i < 0 || j < 0 || i >= N || j >= N) break;
          seen[j * N + i] = 1; if (!at(i, j) || isRubble(i, j)) break;
          for (const e of [1, 3]) { const si = i + DX[(d + e) % 4], sj = j + DZ[(d + e) % 4]; if (si >= 0 && sj >= 0 && si < N && sj < N) seen[sj * N + si] = 1; }
        }
      }
    };
    reveal();
    const canWalk = (i, j) => {
      if (!at(i, j) || isRubble(i, j)) return false;
      if (i === P.i && j === P.j && !gateOpen) return false;
      if (i === A.i && j === A.j) return false;
      return true;
    };
    const openDirs = (i, j) => [0, 1, 2, 3].filter(d => at(i + DX[d], j + DZ[d]) && !isRubble(i + DX[d], j + DZ[d]) && !(i + DX[d] === A.i && j + DZ[d] === A.j));

    // ============================================================ HUD
    const hudBox = st.el('cs3d-hud t', null);
    hudBox.style.cssText = 'top:16px;right:16px;text-align:right;font-size:10px;line-height:2';
    const mapC = document.createElement('canvas'); mapC.width = N * 4; mapC.height = N * 4;
    const mapScale = Math.max(2, Math.floor(150 / (N * 4)) + 1);
    mapC.style.cssText = `width:${N * 4 * mapScale}px;height:${N * 4 * mapScale}px;image-rendering:pixelated;border:3px solid #000;outline:2px solid #6a5a40;background:rgba(8,6,4,.75);margin-top:8px;display:block;margin-left:auto`;
    const hudTxt = document.createElement('div'); hudBox.appendChild(hudTxt); hudBox.appendChild(mapC);
    const mg = mapC.getContext('2d');
    function drawMap() {
      mg.clearRect(0, 0, mapC.width, mapC.height);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (!seen[j * N + i]) continue;
        let c = at(i, j) ? '#7a5a3a' : '#2a1a12';
        if (isRubble(i, j)) c = '#4a4038'; if (pitSet.has(key(i, j))) c = '#2a5a6a';
        if (water && galAt(i, j) === G_WATER && at(i, j) && water.level > 0.1) c = '#3a6a7a';
        if (i === P.i && j === P.j) c = gateOpen ? '#7a5a3a' : '#c0c0c0';
        if (i === O.i && j === O.j) c = '#60a0ff';
        if (i === keyC.i && j === keyC.j && !hasKey) c = '#ffd040';
        if (i === A.i && j === A.j) c = '#ffe0a0';
        mg.fillStyle = c; mg.fillRect(i * 4, j * 4, 4, 4);
      }
      for (const s of sconces) if (s.lit && seen[s.j * N + s.i]) { mg.fillStyle = '#ff8a20'; mg.fillRect(s.i * 4 + 1 + DX[s.d], s.j * 4 + 1 + DZ[s.d], 2, 2); }
      for (const jo of jarObjs) if (!jo.taken && seen[jo.c.j * N + jo.c.i]) { mg.fillStyle = '#d07040'; mg.fillRect(jo.c.i * 4 + 1, jo.c.j * 4 + 1, 2, 2); }
      for (const g of guards) if (!g.gone) { const [gi, gj] = guardCell(g); if (seen[gj * N + gi] && Math.abs(gi - Pl.i) + Math.abs(gj - Pl.j) < 7) { mg.fillStyle = '#a0c0ff'; mg.fillRect(gi * 4 + 1, gj * 4 + 1, 2, 2); } }
      const px = Pl.x / S * 4, pz = Pl.z / S * 4, a = -Pl.yaw;
      mg.fillStyle = '#ffffff'; mg.beginPath();
      const f = [Math.sin(a), -Math.cos(a)];
      mg.moveTo(px + f[0] * 3, pz + f[1] * 3); mg.lineTo(px - f[0] * 2 - f[1] * 2, pz - f[1] * 2 + f[0] * 2); mg.lineTo(px - f[0] * 2 + f[1] * 2, pz - f[1] * 2 - f[0] * 2); mg.fill();
    }
    function hudUpdate() {
      const segs = 12, on = Math.ceil(fuel * segs);
      let bar = '';
      for (let k = 0; k < segs; k++) bar += `<span style="display:inline-block;width:8px;height:10px;margin-left:2px;background:${k < on ? (fuel < 0.25 ? '#ff4030' : '#ffa030') : '#3a2a20'};box-shadow:2px 2px 0 #000"></span>`;
      const hd = ((Math.round(-Pl.yaw / (Math.PI / 2)) % 4) + 4) % 4;
      const gname = GALS[curGal] ? `<span style="color:#e8dcc0">${curGal + 1}/${NG} · ${String(GALS[curGal].nombre || '').toUpperCase()}</span><br>` : '';
      hudTxt.innerHTML = `${gname}ANTORCHA ${bar}<br>RUMBO <b style="color:#f0c030;font-weight:normal">${DIRN[hd]}</b>` +
        (hasKey ? '<br><span style="color:#ffd040">LLAVE DE LA REJA</span>' : '') +
        (findObjs.length ? `<br>HALLAZGOS <span style="color:#f0c030">${found.length}/${findObjs.length}</span>` : '');
      drawMap();
    }
    st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>${GOAL}`);
    st.titleCard(TITLE, `${INTRO}<br><br><span style="color:#9ad8e8">"${RULE}"</span>`, 6);
    st.showKeys(['[W ↑] avanzar · [S ↓] retroceder', '[A D ← →] girar · [Q E] paso al costado', '[ESPACIO] usar · leer · agitar la antorcha', 'Seguí las goteras · ojo con lo que brilla'], 14);
    setTimeout(() => { if (!st.done) hudUpdate(); }, 0);

    // ============================================================ lógica
    const SND = st.sfx;
    const ambience = SND.loop({ freq: 180, vol: 0.05 });
    const crackle = SND.loop({ freq: 2400, filter: 'bandpass', q: 2, vol: 0.012 });
    const river = SND.loop({ freq: 520, vol: 0.0 });
    const REL = ['adelante', 'la derecha', 'atrás', 'la izquierda'];
    const relPan = rel => [0, 0.85, 0, -0.85][rel];
    function addFuel(v, msg) { fuel = U.clamp(fuel + v, 0, 1); if (fuel > 0) ember = 0; if (msg) st.toast(msg, 3, v < 0 ? '#ff8060' : '#ffd060'); hudUpdate(); }
    const laugh = (d = 0) => [700, 820, 640, 900].forEach((f, n) => SND.tone(f, 0.07, { type: 'square', vol: 0.03, delay: d + n * 0.08, pan: (Math.random() - 0.5) * 1.6 }));
    // celda del camino correcto que sigue (antes de la llave, hacia la llave; después, hacia la salida)
    const keyIdx = solution.indexOf(key(keyC.i, keyC.j));
    function nextDir(i, j) {
      const k = key(i, j); let n = -1;
      for (let m = 0; m < solution.length; m++) if (solution[m] === k) { if (!hasKey && m <= keyIdx) { n = m; break; } if (hasKey && m >= keyIdx) { n = m; break; } }
      if (n < 0 || n + 1 >= solution.length) return -1;
      const nk = solution[n + 1], ni = nk % 1000, nj = Math.floor(nk / 1000);
      for (let d = 0; d < 4; d++) if (i + DX[d] === ni && j + DZ[d] === nj) return d;
      return -1;
    }
    // humito del cigarro del Pombero: marca el pasillo
    const puff = st.particles({ mode: 'embers', count: 26, center: [0, 1.2, 0], box: [0.35, 1.3, 0.35], size: 0.05, color: 0x8a8a94, bright: 0.5, speed: 0.25, far: 12 }); puff.visible = false;
    let puffT = 0;
    function junctionHint() {
      if (!PB.met || PB.vanish >= 0 && PB.vanish < 0.9) return;
      const od = openDirs(Pl.i, Pl.j); if (od.length < 3) return;
      let d = nextDir(Pl.i, Pl.j); if (d < 0) return;
      let falso = false;
      if (!POMB_HELP) {
        if (!PB.falseWhistle) return; // una sola travesura de silbido
        const wrong = od.filter(x => x !== d && x !== (Pl.d + 2) % 4);
        if (!wrong.length) return;
        PB.falseWhistle = false; d = U.pick(Math.random, wrong); falso = true;
      }
      const rel = (d - Pl.d + 4) % 4;
      SND.whistle({ pan: relPan(rel), vol: rel === 2 ? 0.035 : 0.06, delay: 0.15 });
      st.toast(`♪ Un silbido viene de ${REL[rel]}...`, 2.4, '#c8e0a0');
      const [cx, cz] = cellC(Pl.i + DX[d], Pl.j + DZ[d]); puff.material.uniforms.uCenter.value.set(cx, 1.0, cz); puff.visible = true; puffT = 3.5;
      if (falso) laugh(1.2);
    }
    async function meetPombero() {
      PB.met = true; st.busy++;
      // mirar hacia el Pombero
      const [cx, cz] = [pomb.grp.position.x, pomb.grp.position.z];
      const want = Math.atan2(-(cx - Pl.x), -(cz - Pl.z));
      let dy = want - Pl.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Pl.look = { from: Pl.yaw, to: Pl.yaw + dy, t: 0 };
      SND.whistle({ vol: 0.05 });
      try { await pomberoTalk(); } finally { st.busy--; }
      PB.vanish = 0; SND.noise(0.8, { freq: 1500, vol: 0.12, sweep: 300 });
      Pl.look = { from: Pl.yaw, to: -Pl.d * Math.PI / 2 + Math.round((Pl.yaw + Pl.d * Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2, t: 0 };
    }
    async function pomberoTalk() {
      await st.say('El Pombero', PLINES[0], { pitch: 380 });
      if (POMB_HELP) {
        await st.say('Vos', 'Tomá, chamigo. El último cigarro: te lo guardé.');
        SND.noise(0.4, { freq: 2000, vol: 0.08 });
      } else await st.say('Vos', 'No, chamigo. Se lo dejé todo al Gauchito.');
      for (const l of PLINES.slice(1)) { if (st.done) return; await st.say('El Pombero', l, { pitch: 380 }); }
      if (POMB_HELP) st.toast('El Pombero te va a silbar desde el pasillo bueno en cada cruce.', 3.4, '#c8e0a0');
      else {
        // travesuras: esconde un cebo y más tarde te sopla la antorcha
        const left = jarObjs.filter(j => !j.taken && !j.empty);
        if (left.length) { left.sort((a, b) => (solIdx.get(key(a.c.i, a.c.j)) || 999) - (solIdx.get(key(b.c.i, b.c.j)) || 999)); left[0].empty = true; }
        PB.prankBlow = 22 + Math.random() * 10;
        laugh(0.2);
      }
    }
    function enterGallery(g) {
      const G = GALS[g]; if (!G) return;
      st.titleCard(G.nombre, `bajo ${G.bajo || 'la ciudad'}<br>${G.texto || ''}`, 3.2);
      SND.tone(196, 0.6, { type: 'triangle', vol: 0.05 }); SND.tone(294, 0.8, { type: 'triangle', vol: 0.04, delay: 0.15 });
      if (/campana/i.test(G.texto || '')) {
        [0, 1.4, 2.8].forEach(dl => { SND.tone(392, 2.2, { type: 'sine', vol: 0.07, delay: dl + 0.6 }); SND.tone(784, 1.2, { type: 'sine', vol: 0.03, delay: dl + 0.6 }); });
        const fall = st.particles({ mode: 'fall', count: 50, center: [Pl.x, 0, Pl.z], box: [2.5, VH, 2.5], size: 0.035, color: 0xa08a70, bright: 0.5, speed: 0.8, far: 8 });
        setTimeout(() => { fall.visible = false; }, 4500); st.shake(0.25);
      }
      if (/pasos/i.test(G.texto || '')) for (let k = 0; k < 8; k++) SND.noise(0.18, { freq: 140, vol: 0.25, delay: 1 + k * 0.55 });
      if (g === G_WATER && water) st.toast('Se escucha agua corriendo. El nivel sube...', 2.6, '#9ad0e0');
      if (g === G_WIND) st.toast('Corre aire. Huele a río.', 2.2, '#a0c0ff');
    }
    function pickFind(fo) {
      fo.taken = true; fo.obj.visible = false; found.push(fo.name);
      st.flash(0xfff0c0, 0.25); [659, 784, 988].forEach((f, n) => SND.tone(f, 0.16, { type: 'triangle', vol: 0.07, delay: n * 0.08 }));
      if (/diario|p[aá]gina|carta/i.test(fo.name)) st.say('Diario de Fray Benicio', DIARY, { pitch: 300, speed: 55 });
      else st.toast(`Hallazgo: <span style="color:#fff">${fo.name}</span>`, 2.8);
    }
    function enterCell() {
      const k = key(Pl.i, Pl.j);
      reveal();
      SND.noise(0.12, { freq: inWater() ? 700 : 300, vol: 0.12 });
      const g = galAt(Pl.i, Pl.j);
      if (g !== curGal) { curGal = g; if (!galSeen.has(g)) { galSeen.add(g); galEntry = { i: Pl.i, j: Pl.j, d: Pl.d }; enterGallery(g); } }
      for (const jo of jarObjs) if (!jo.taken && jo.c.i === Pl.i && jo.c.j === Pl.j) {
        jo.taken = true; jo.m.visible = false;
        if (jo.empty) { st.toast(cebo ? 'El nicho está vacío. Alguien se llevó el cebo... Se escucha una risita.' : 'La vasija está vacía. Alguien se tomó el aceite... Se escucha una risita.', 3, '#ff9060'); laugh(0.3); }
        else {
          addFuel(0.38, cebo ? 'Cebo de vela en un nicho: ¡la antorcha revive!' : 'Una vasija con aceite: ¡la antorcha revive!');
          SND.tone(330, 0.15, { type: 'triangle', vol: 0.1 }); SND.tone(495, 0.25, { type: 'triangle', vol: 0.1, delay: 0.1 });
        }
      }
      if (!hasKey && Pl.i === keyC.i && Pl.j === keyC.j) {
        hasKey = true; keyM.visible = false; keySpark.visible = false; st.flash(0xffe080, 0.35);
        st.toast('¡Una llave de hierro con el escudo de la orden!<br>Ahora, la reja del río.', 3.5);
        st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>Tenés la llave: buscá la reja ${toHigu ? 'de la Higuera' : 'del río'}`);
        [523, 659, 784, 1046].forEach((f, n) => SND.tone(f, 0.18, { type: 'square', vol: 0.06, delay: n * 0.09 }));
      }
      for (const fo of findObjs) if (!fo.taken && fo.c.i === Pl.i && fo.c.j === Pl.j) pickFind(fo);
      if (trapSet.has(k)) {
        trapSet.delete(k); const [cx, cz] = cellC(Pl.i, Pl.j), ti = trapInfo.get(k);
        if (ti) { ti.sp.visible = false; }
        if (trapKind.get(k) === 'pozo') {
          if (ti) ti.grp.visible = false;
          Pl.fall = 1; st.shake(0.9); st.flash(0x000000, 0.8);
          SND.noise(0.5, { freq: 500, vol: 0.4, sweep: 80 }); SND.noise(0.3, { freq: 200, vol: 0.4, delay: 0.5 });
          addFuel(-0.16, '¡Las baldosas del brillo cedieron! Caíste a un pozo y trepás como podés. La antorcha sufrió.');
        } else {
          st.shake(1.2); SND.noise(1.4, { freq: 240, vol: 0.5, sweep: 60 });
          const fall = st.particles({ mode: 'fall', count: 70, center: [cx, 0, cz], box: [1.6, VH, 1.6], size: 0.05, color: 0x8a7a6a, bright: 0.6, speed: 1.6, far: 8 });
          setTimeout(() => { fall.visible = false; }, 1600);
          addRocks(cx, cz, 8, 0.4, 0.9);
          addFuel(-0.14, '¡El brillo era trampa: se vino abajo el techo! Te salvaste por poco, pero la antorcha sufrió.');
        }
      }
      if (pitSet.has(k)) { SND.noise(0.6, { freq: 900, vol: 0.3, sweep: 200 }); addFuel(-0.12, 'Te metiste en un pozo de agua. La antorcha chisporrotea...'); st.flash(0x103040, 0.3); }
      if (pomb && !PB.met && Math.abs(Pl.i - pombC.i) + Math.abs(Pl.j - pombC.j) <= 1) meetPombero();
      else if (openDirs(Pl.i, Pl.j).length >= 3) {
        if (!ruleShown && [0, 1, 2, 3].some(d => drips.has(key(Pl.i + DX[d], Pl.j + DZ[d])))) { ruleShown = true; st.toast(`Un cruce. Acordate: "${RULE}"`, 4, '#9ad8e8'); }
        else junctionHint();
      }
      if (Pl.i === O.i && Pl.j === O.j && !finished) {
        finished = true;
        const score = Math.max(0, Math.round(fuel * 600 + Math.max(0, 600 - elapsed * 2) + diff * 50 + found.length * 150 - caughtN * 100));
        st.finish({ ok: true, score, message: WIN_TXT, data: { seconds: Math.round(elapsed), fuel: Math.round(fuel * 100), hallazgos: found.slice(), atrapado: caughtN, pombero: POMB_HELP ? 'ayudó' : 'travesuras' } });
      }
      hudUpdate();
    }
    const inWater = () => water && curGal === G_WATER && water.level > 0.05;
    function tryMove(dir) {
      const ni = Pl.i + DX[dir], nj = Pl.j + DZ[dir];
      const [fx, fz] = [Pl.x, Pl.z];
      if (!canWalk(ni, nj)) {
        Pl.anim = { type: 'bump', t: 0, dur: 0.22, fx, fz, dir };
        if (ni === P.i && nj === P.j && !gateOpen) st.toast(hasKey ? 'La reja tiene candado. [ESPACIO] para usar la llave.' : 'Una reja con un candado viejo. Hace falta la llave.', 2.4);
        else if (ni === A.i && nj === A.j) st.toast('Arriba está la iglesia. La salida es por el otro lado.', 2.2);
        else if (isRubble(ni, nj)) st.toast('Derrumbe. Por acá no se pasa.', 1.6);
        SND.noise(0.08, { freq: 150, vol: 0.15 });
        return;
      }
      const [tx, tz] = cellC(ni, nj);
      Pl.anim = { type: 'move', t: 0, dur: 0.3 + (inWater() ? water.level * 0.7 : 0), fx, fz, tx, tz, ni, nj };
    }
    function interact() {
      const fi = Pl.i + DX[Pl.d], fj = Pl.j + DZ[Pl.d];
      if (batEv && batEv.state === 'fly') { scareBats(); return; }
      if (fi === P.i && fj === P.j && !gateOpen) {
        if (hasKey) { gateOpen = true; SND.noise(2.2, { freq: 500, vol: 0.25, filter: 'bandpass', q: 3 }); SND.tone(110, 1.5, { type: 'sawtooth', vol: 0.05, slide: 0.7 }); st.toast('El candado cede con un crujido. La reja sube...', 3); st.shake(0.4); }
        else st.toast('Sin la llave no hay caso.', 1.8);
        return;
      }
      const f = !at(fi, fj) ? feats.get(fkey(Pl.i, Pl.j, Pl.d)) : null;
      if (f && f.type === 'insc') { st.say('Inscripción: ' + f.title, f.read, { pitch: 300 }); return; }
      if (f && f.type === 'sconce' && !f.sc.lit) {
        f.sc.lit = true; f.sc.flame.visible = true; SND.noise(0.5, { freq: 1600, vol: 0.2, sweep: 400 }); addFuel(-0.02, 'Prendiste la antorcha de la pared. Te va a servir de guía.'); return;
      }
      swing = 1; SND.noise(0.25, { freq: 900, vol: 0.12, sweep: 300 });
    }
    function scareBats() {
      if (!batEv || batEv.state !== 'fly') return;
      batEv.state = 'scatter'; batEv.t = 0; swing = 1;
      SND.noise(0.3, { freq: 1200, vol: 0.2, sweep: 300 }); [1400, 1700, 1300].forEach((f, n) => SND.tone(f, 0.08, { type: 'square', vol: 0.03, delay: n * 0.05 }));
      st.toast('¡Fuera, bichos!', 1.2);
    }
    function startBats() {
      let n = 0, i = Pl.i, j = Pl.j;
      while (n < 5 && canWalk(i + DX[Pl.d], j + DZ[Pl.d])) { i += DX[Pl.d]; j += DZ[Pl.d]; n++; }
      if (n < 2) { batTimer = 3; return; }
      const [sx, sz] = cellC(i, j);
      batEv = { state: 'fly', t: 0, sx, sz };
      bats.forEach(b => { b.sp.visible = true; b.ox = (Math.random() - 0.5) * 1.2; b.oy = (Math.random() - 0.5) * 0.6; b.ph = Math.random() * 6; });
      st.toast('¡MURCIÉLAGOS! <b style="color:#fff">[ESPACIO]</b> agitá la antorcha', 2.2, '#ff8060');
      for (let k = 0; k < 6; k++) SND.tone(2200 + Math.random() * 800, 0.05, { type: 'square', vol: 0.02, delay: k * 0.12 });
    }
    function updateBats(dt) {
      if (!batEv) { batTimer -= dt; if (batTimer <= 0 && !st.busy && !Pl.anim) startBats(); bats.forEach(b => b.sp.visible = false); return; }
      const e = batEv; e.t += dt;
      const fl = Math.floor(st.t * 14) % 2;
      const px = Pl.x, pz = Pl.z;
      bats.forEach((b, k) => {
        b.sp.material.map = batTex[(fl + k) % 2];
        let u, x, y, z;
        if (e.state === 'fly') {
          u = Math.min(1, e.t / 2.4);
          x = U.lerp(e.sx, px, u) + Math.sin(st.t * 6 + b.ph) * 0.3 + b.ox * (1 - u * 0.6);
          z = U.lerp(e.sz, pz, u) + Math.cos(st.t * 5 + b.ph) * 0.3 + b.ox * (1 - u * 0.6);
          y = 1.9 + b.oy + Math.sin(st.t * 9 + b.ph) * 0.15 - u * 0.4;
          b.sp.position.set(x, y, z);
        } else {
          b.sp.position.y += dt * 2.5; b.sp.position.x += Math.sin(b.ph) * dt * 2; b.sp.position.z += Math.cos(b.ph) * dt * 2;
        }
      });
      if (e.state === 'fly' && e.t >= 2.4) {
        e.state = 'hit'; e.t = 0; addFuel(-0.1, 'Los murciélagos te pasaron por encima y casi te apagan la antorcha.'); st.flash(0x000000, 0.7);
        SND.noise(0.6, { freq: 3000, vol: 0.2, filter: 'bandpass' });
      }
      if ((e.state === 'scatter' && e.t > 1.2) || (e.state === 'hit' && e.t > 0.8)) { batEv = null; batTimer = 26 - diff * 1.4 + Math.random() * 14; }
    }
    // ---- ratas
    function spawnRats() {
      let d = Pl.d; if (!canWalk(Pl.i + DX[d], Pl.j + DZ[d])) { const od = openDirs(Pl.i, Pl.j).filter(x => x !== (Pl.d + 2) % 4); if (!od.length) return; d = od[0]; }
      let n = 0, i = Pl.i, j = Pl.j; while (n < 3 && canWalk(i + DX[d], j + DZ[d])) { i += DX[d]; j += DZ[d]; n++; }
      const [sx, sz] = cellC(i, j), side = [DZ[d], -DX[d]];
      const cnt = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < cnt; k++) {
        const r = rats[k], lo = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.3);
        r.a.set(sx + side[0] * lo, 0.09, sz + side[1] * lo);
        r.b.set(Pl.x + side[0] * lo - DX[d] * 2.2, 0.09, Pl.z + side[1] * lo - DZ[d] * 2.2);
        r.t = -k * 0.25; r.dur = (n * S + 2.2) / (4 + Math.random() * 1.5); r.sp.visible = false;
      }
      for (let k = 0; k < 5; k++) SND.tone(3200 + Math.random() * 1200, 0.04, { type: 'square', vol: 0.025, delay: k * 0.09 + Math.random() * 0.05, slide: 1.3 });
    }
    const v3 = new T.Vector3();
    function updateRats(dt) {
      if (curGal === G_RATS && !st.busy && !finished) { ratTimer -= dt; if (ratTimer <= 0) { ratTimer = 6 + Math.random() * 7; spawnRats(); } }
      rats.forEach((r, k) => {
        if (r.t >= 1) { r.sp.visible = false; return; }
        r.t += dt / r.dur; if (r.t < 0) return;
        r.sp.visible = true; r.sp.position.lerpVectors(r.a, r.b, Math.min(1, r.t));
        r.sp.material.map = ratTex[Math.floor(st.t * 18 + k) % 2];
        v3.subVectors(r.b, r.a).normalize();
        const right = Math.cos(Pl.yaw) * v3.x - Math.sin(Pl.yaw) * v3.z; // proyección sobre el "derecha" de la cámara
        r.sp.scale.x = right < 0 ? -0.36 : 0.36;
      });
    }
    // ---- guardias
    function guardCell(g) { const c = g.mt < 0.5 || g.pause > 0 ? g.cells[g.from] : g.cells[g.idx]; return c; }
    const dampAng = (a, b, k, dt) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * (1 - Math.exp(-k * dt)); };
    function caught(g) {
      caughtN++; immune = 3;
      st.flash(0xe8f0ff, 0.9); st.shake(0.6);
      SND.tone(220, 0.25, { type: 'sawtooth', vol: 0.08 }); SND.tone(180, 0.4, { type: 'sawtooth', vol: 0.08, delay: 0.2 });
      Pl.anim = null; Pl.i = galEntry.i; Pl.j = galEntry.j; Pl.d = galEntry.d; Pl.yaw = -Pl.d * Math.PI / 2; [Pl.x, Pl.z] = cellC(Pl.i, Pl.j);
      curGal = galAt(Pl.i, Pl.j);
      for (const o of guards) o.alert = 0;
      g.pause = 2;
      addFuel(-0.15, '"¡Alto ahí, ladrón de patrimonio!" Te zafás de un tirón y volvés corriendo al comienzo de la galería. La antorcha sufrió.');
    }
    function updateGuards(dt) {
      const pci = Math.floor(Pl.x / S), pcj = Math.floor(Pl.z / S);
      for (const g of guards) {
        if (g.gone) continue;
        if (g.off) {
          g.offT += dt; g.spot.intensity = g.offT < 0.8 ? (Math.random() < 0.5 ? 0 : 3) : 0; g.beam.visible = g.spot.intensity > 0; g.lens.visible = g.beam.visible;
          if (g.offT > 1.4) { const fw = [Math.sin(g.p.rotation.y), Math.cos(g.p.rotation.y)]; g.p.position.x -= fw[0] * dt * 1.5; g.p.position.z -= fw[1] * dt * 1.5; U.animPerson(g.p, 1.5, dt); }
          if (g.offT > 4) { g.gone = true; g.p.visible = false; g.spot.intensity = 0; }
          continue;
        }
        const cells = g.cells;
        if (g.pause > 0) { g.pause -= dt; U.animPerson(g.p, 0, dt); g.look = Math.sin(st.t * 1.6 + g.idx) * 0.7; }
        else {
          g.look = 0;
          g.mt += dt / 1.05;
          const a = cells[g.from], b = cells[g.idx], [ax, az] = cellC(a[0], a[1]), [bx, bz] = cellC(b[0], b[1]), k = Math.min(1, g.mt);
          g.p.position.set(U.lerp(ax, bx, k), 0, U.lerp(az, bz, k));
          g.face = Math.atan2(bx - ax, bz - az);
          U.animPerson(g.p, 1.6, dt);
          if (k >= 1) { g.mt = 0; g.from = g.idx; let nx = g.idx + g.dir; if (nx < 0 || nx >= cells.length) { g.dir *= -1; nx = g.idx + g.dir; g.pause = 1.6; } g.idx = nx; }
        }
        g.p.rotation.y = dampAng(g.p.rotation.y, g.face + (g.look || 0), 6, dt);
        g.spot.intensity = 5 * (0.95 + Math.random() * 0.05);
        if (immune > 0 || debug.ghost) continue;
        // ¿te ve? celda propia o vecina: te escucha; en línea recta adelante, con luz: te ve
        const [gi, gj] = guardCell(g);
        const dd = Math.abs(gi - pci) + Math.abs(gj - pcj);
        // misma celda: te choca. Adelante en línea recta (hasta 5 celdas): te ve; si está pegado, más rápido
        const close = dd === 0;
        let saw = 0;
        const fd = Math.round(((g.p.rotation.y / (Math.PI / 2)) % 4 + 4)) % 4; // 0:+z 1:+x 2:-z 3:-x
        const gdx = [0, 1, 0, -1][fd], gdz = [1, 0, -1, 0][fd];
        let ci = gi, cj = gj;
        for (let s = 1; s <= 5 && !close; s++) { ci += gdx; cj += gdz; if (!at(ci, cj) || isRubble(ci, cj)) break; if (ci === pci && cj === pcj) { saw = s; break; } }
        if (close) { caught(g); return; }
        if (saw) {
          if (g.alert === 0) { st.toast('"¡Eh! ¿Quién anda ahí?" <span style="color:#fff">¡Escondete!</span>', 1.6, '#a0c0ff'); SND.tone(300, 0.15, { type: 'square', vol: 0.06 }); }
          g.alert += dt * (fuel > 0 && !blowOut ? 1.3 : 0.6) * (saw === 1 ? 2 : 1);
          if (g.alert > 0.85) { caught(g); return; }
        } else g.alert = Math.max(0, g.alert - dt * 0.7);
      }
      // el Pombero (si le diste tabaco) le apaga la linterna al primero que se cruce
      if (POMB_HELP && PB.met && !PB.guardDone && guards.length) {
        const g = guards[0], [gi, gj] = guardCell(g);
        if (!g.off && Math.abs(gi - pci) + Math.abs(gj - pcj) <= 4) {
          PB.guardDone = true; g.off = true; g.offT = 0;
          SND.whistle({ vol: 0.06, pan: 0.3 }); laugh(1);
          st.toast('♪ Un silbido en la oscuridad... ¡la linterna del guardia se apaga!<br>"¡La pucha! ¡Pilas truchas del Ministerio!"', 3.6, '#c8e0a0');
        }
      }
    }

    let mapT = 0, dripT = 2;
    const debug = { ghost: false, auto: false };
    // depuración: __scenesCur.instance.debug.auto = true camina solo; .win() / .lose(); .info()
    function autoStep() {
      if (Pl.anim || st.busy) return;
      const target = hasKey ? (gateOpen ? O : P) : keyC;
      const par = new Map([[key(Pl.i, Pl.j), -1]]), q = [[Pl.i, Pl.j]];
      const ok = (i, j) => (canWalk(i, j) || (i === P.i && j === P.j)) && !(debug.safe && (trapSet.has(key(i, j)) || pitSet.has(key(i, j))) && !(i === target.i && j === target.j));
      while (q.length) { const [i, j] = q.shift(); if (i === target.i && j === target.j) break; for (let d = 0; d < 4; d++) { const ni = i + DX[d], nj = j + DZ[d], k = key(ni, nj); if (par.has(k) || !ok(ni, nj)) continue; par.set(k, key(i, j)); q.push([ni, nj]); } }
      let k = key(target.i, target.j); if (!par.has(k)) return;
      let prev = k; while (par.get(k) !== key(Pl.i, Pl.j) && par.get(k) !== -1) { prev = k; k = par.get(k); }
      const ni = k % 1000, nj = Math.floor(k / 1000); let d = 0; for (; d < 4; d++) if (Pl.i + DX[d] === ni && Pl.j + DZ[d] === nj) break;
      if (d !== Pl.d) { const rgt = (d - Pl.d + 4) % 4 === 1; Pl.anim = { type: 'turn', t: 0, dur: 0.2, from: Pl.yaw, to: Pl.yaw + (rgt ? -1 : 1) * Math.PI / 2 }; Pl.d = (Pl.d + (rgt ? 1 : 3)) % 4; return; }
      if (ni === P.i && nj === P.j && !gateOpen) { interact(); return; }
      tryMove(d);
    }
    st.updaters.push(() => { if (debug.auto && st.busy) st.hits.Enter = true; });
    return {
      debug: Object.assign(debug, {
        info: () => ({ N, sol: solution.length, key: keyC, exit: O, gate: P, guards: guardDefs.map(g => g.cells), pomb: pombC, gal: curGal, fuel, burnTime, galSeen: [...galSeen], found, caughtN, pl: [Pl.i, Pl.j, Pl.d] }),
        win() { hasKey = true; gateOpen = true; Pl.i = P.i; Pl.j = P.j; [Pl.x, Pl.z] = cellC(P.i, P.j); Pl.i = O.i; Pl.j = O.j; enterCell(); },
        lose() { fuel = 0; ember = 99; },
        fuel(v) { fuel = v; hudUpdate(); },
        tp(i, j, d) { Pl.i = i; Pl.j = j; if (d !== undefined) { Pl.d = d; Pl.yaw = -d * Math.PI / 2; } [Pl.x, Pl.z] = cellC(i, j); enterCell(); },
        // vista lucida de una galería: celda del recorrido con el pasillo recto más largo
        view(g) {
          let best = null;
          for (const k of direct) {
            const i = k % 1000, j = Math.floor(k / 1000); if (galAt(i, j) !== g) continue;
            for (let d = 0; d < 4; d++) { let n = 0; while (n < 8 && at(i + DX[d] * (n + 1), j + DZ[d] * (n + 1))) n++; if (!best || n > best.n) best = { i, j, d, n }; }
          }
          if (best) this.tp(best.i, best.j, best.d); return best;
        },
      }),
      update(dt, t) {
        elapsed += dt;
        immune = Math.max(0, immune - dt);
        if (debug.auto) autoStep();
        // movimiento por casilla
        if (!Pl.anim && !st.busy && !finished && !Pl.look) {
          if (st.down('KeyW', 'ArrowUp')) tryMove(Pl.d);
          else if (st.down('KeyS', 'ArrowDown')) tryMove((Pl.d + 2) % 4);
          else if (st.down('KeyQ')) tryMove((Pl.d + 3) % 4);
          else if (st.down('KeyE')) tryMove((Pl.d + 1) % 4);
          else if (st.down('KeyA', 'ArrowLeft')) { Pl.anim = { type: 'turn', t: 0, dur: 0.2, from: Pl.yaw, to: Pl.yaw + Math.PI / 2 }; Pl.d = (Pl.d + 3) % 4; }
          else if (st.down('KeyD', 'ArrowRight')) { Pl.anim = { type: 'turn', t: 0, dur: 0.2, from: Pl.yaw, to: Pl.yaw - Math.PI / 2 }; Pl.d = (Pl.d + 1) % 4; }
        }
        if (st.action()) interact();
        if (Pl.look) { const l = Pl.look; l.t = Math.min(1, l.t + dt / 0.5); Pl.yaw = U.lerp(l.from, l.to, U.ease(l.t)); if (l.t >= 1 && !st.busy) Pl.look = null; }
        if (Pl.anim) {
          const a = Pl.anim; a.t += dt; const k = Math.min(1, a.t / a.dur), e = U.ease(k);
          if (a.type === 'move') { Pl.x = U.lerp(a.fx, a.tx, e); Pl.z = U.lerp(a.fz, a.tz, e); Pl.bob = Math.sin(k * Math.PI); }
          else if (a.type === 'turn') Pl.yaw = U.lerp(a.from, a.to, e);
          else { const b = Math.sin(k * Math.PI) * 0.18; Pl.x = a.fx + DX[a.dir] * b; Pl.z = a.fz + DZ[a.dir] * b; }
          if (k >= 1) { Pl.anim = null; if (a.type === 'move') { Pl.i = a.ni; Pl.j = a.nj; enterCell(); } hudUpdate(); }
        }
        const pitNow = pitSet.has(key(Pl.i, Pl.j)) && !Pl.anim ? 1 : 0;
        Pl.inPit = U.damp(Pl.inPit, pitNow, 8, dt);
        Pl.fall = Math.max(0, Pl.fall - dt / 1.8);
        const fallY = Pl.fall > 0.6 ? (1 - Pl.fall) / 0.4 : Pl.fall / 0.6; // baja rápido y sube despacio
        const wl = inWater() ? water.level : 0;
        cam.position.set(Pl.x, EYE - Pl.bob * 0.06 - Pl.inPit * 0.3 - fallY * 1.1 - wl * 0.15, Pl.z);
        cam.rotation.y = Pl.yaw; cam.rotation.x = -0.02 + Math.sin(t * 0.7) * 0.006 + fallY * 0.4;
        cam.rotation.z = wl ? Math.sin(t * 1.3) * 0.012 * wl : 0;
        // antorcha: se consume (no durante los diálogos)
        if (!finished && !st.busy) {
          const drain = 1 + (inWater() ? water.level * 2.5 : 0) + gust * 0.8;
          fuel = Math.max(0, fuel - dt * drain / burnTime);
          if (fuel <= 0) {
            if (!ember) { ember = 0.001; st.toast('¡Se te apaga la antorcha! Buscá aceite, rápido...', 3, '#ff6040'); SND.noise(0.8, { freq: 600, vol: 0.2, sweep: 100 }); }
            ember += dt;
            if (ember > 18 && !lose) {
              lose = 2.4; finished = true; st.toast(LOSE_TXT, 3.5, '#ff6040'); SND.whistle({ vol: 0.05, delay: 0.6, pan: -0.5 }); laugh(1.5);
            }
          }
        }
        if (lose) { lose -= dt; tflame.visible = false; torch.intensity = 0; if (lose <= 0) st.finish({ ok: false, reason: LOSE_TXT, data: { reason: 'oscuridad', seconds: Math.round(elapsed), hallazgos: found.slice() } }); return; }
        // travesura: el Pombero te sopla la antorcha
        if (PB.prankBlow > 0 && !st.busy) {
          PB.prankBlow -= dt;
          if (PB.prankBlow <= 0) { blowOut = 5; SND.noise(1, { freq: 800, vol: 0.25, sweep: 200, attack: 0.2 }); laugh(0.8); st.toast('Un soplido en la nuca... ¡te apagó la antorcha! Una risita se aleja por el pasillo.', 3.2, '#ff8060'); }
        }
        if (blowOut > 0) {
          blowOut -= dt;
          if (blowOut <= 0) { blowOut = 0; addFuel(-0.08, 'Soplás las brasas y la antorcha revive. Pombero mezquino...'); SND.noise(0.5, { freq: 1600, vol: 0.2, sweep: 400 }); }
        }
        // ráfagas de la boca del río
        if (curGal === G_WIND && !finished) { gustT -= dt; if (gustT <= 0) { gustT = 4 + Math.random() * 5; gust = 1; SND.noise(1.6, { freq: 400, vol: 0.18, sweep: 1400, attack: 0.5 }); } }
        gust = Math.max(0, gust - dt * 0.7);
        const f = fuel > 0 && !blowOut ? fuel : 0, low = f < 0.22 ? (0.22 - f) * 3 : 0;
        const fl = U.flicker(t * (1 + low + gust * 2), 1.3);
        const flick = 1 + (fl - 1) * (1.6 + low * 4 + gust * 5);
        torch.intensity = (f > 0 ? 0.55 + f * 0.75 : blowOut ? 0.06 : 0.3 * Math.max(0, 1 - ember / 18)) * flick;
        torch.distance = f > 0 ? 3.2 + f * 7.5 : 2.2;
        torch.color.copy(U.C(f > 0 ? 0xff9a48 : 0xff4a18));
        tflame.material.uniforms.uScale.value.set((0.06 + 0.05 * Math.max(f, 0.15)) * (1 + gust * 0.6), (0.1 + 0.13 * Math.max(f, 0.15)) * (1 - gust * 0.35));
        tflame.visible = (f > 0 || ember < 18) && !blowOut;
        st.scene.fog.density = 0.12 + (1 - f) * 0.06;
        swing = Math.max(0, swing - dt * 2.5);
        view.position.set(0.3 + Math.sin(Pl.bob * Math.PI) * 0.01 - swing * 0.25, -0.36 + Math.abs(Math.sin(t * 1.3)) * 0.008 - Pl.bob * 0.025 + swing * 0.12, -0.55);
        view.rotation.set(0.15 + swing * 0.5, 0, -0.18 + swing * 0.9 - gust * 0.12);
        view.updateMatrixWorld(true);
        const fw = tflame.getWorldPosition(new T.Vector3());
        embers.material.uniforms.uCenter.value.copy(fw);
        embers.visible = f > 0;
        dust.material.uniforms.uCenter.value.set(Pl.x, 1.4, Pl.z);
        // luces de los apliques: las 3 más cercanas
        const near = sconces.filter(s => s.lit).map(s => ({ s, d: (s.pos.x - Pl.x) ** 2 + (s.pos.z - Pl.z) ** 2 })).sort((a, b) => a.d - b.d);
        pool.forEach((l, k) => {
          const s = near[k];
          if (!s || s.d > 14 * 14) { l.intensity = 0; return; }
          l.position.copy(s.s.pos); l.intensity = 1.5 * U.flicker(t, k * 7 + s.s.i);
        });
        // llave flotando
        keyM.rotation.y = t * 1.6; keyM.position.y = 1.0 + Math.sin(t * 2) * 0.06;
        // reja
        if (gateOpen && gateAnim < 1) { gateAnim = Math.min(1, gateAnim + dt / 2.2); gate.position.y = U.ease(gateAnim) * (WH - 0.15); if (gateAnim >= 1) st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>¡La reja está abierta! Salí ${toHigu ? 'hacia la Higuera' : 'al río'}`); }
        // el Pombero se esfuma en humo
        if (pomb && PB.vanish >= 0 && PB.vanish < 1) {
          PB.vanish = Math.min(1, PB.vanish + dt / 0.9);
          pomb.grp.scale.setScalar(Math.max(0.001, 1 - PB.vanish)); pomb.grp.position.y = PB.vanish * 0.6;
          if (PB.vanish >= 1) pomb.grp.visible = false;
        }
        if (pomb && !PB.met) { pomb.grp.children[2].rotation.y = Math.sin(t * 0.8) * 0.4; }
        if (puffT > 0) { puffT -= dt; puff.material.uniforms.uOpacity.value = Math.min(1, puffT / 1.5); if (puffT <= 0) puff.visible = false; }
        if (!st.busy) { updateBats(dt); updateGuards(dt); }
        updateRats(dt);
        // agua que sube
        if (water) {
          if (curGal === G_WATER && !finished && !st.busy) {
            water.t += dt;
            if (water.level > 0.25 && !water.warned) { water.warned = true; st.toast('¡El agua te llega a las rodillas! Caminás más lento y la antorcha se moja.', 3, '#9ad0e0'); }
          }
          water.level = Math.min(0.8, water.t / 70 * 0.8);
          water.mesh.position.y = 0.02 + water.level; water.mesh.visible = water.level > 0.01 || curGal === G_WATER;
          water.tex.offset.set(t * 0.03, Math.sin(t * 0.4) * 0.05);
        }
        // goteo y río
        dripT -= dt; if (dripT <= 0) { dripT = 1.5 + Math.random() * 4; SND.tone(1800 + Math.random() * 900, 0.09, { type: 'sine', vol: 0.03, slide: 0.5 }); }
        crackle.set(0.006 + f * 0.012);
        ambience.set(0.04);
        const dO = Math.hypot(Pl.i - O.i, Pl.j - O.j);
        river.set(Math.max(0, 0.08 - dO * 0.008) + (inWater() ? 0.05 : 0));
        // indicador de interacción
        let pr = null;
        const fi = Pl.i + DX[Pl.d], fj = Pl.j + DZ[Pl.d];
        if (batEv && batEv.state === 'fly') pr = '<b>[ESPACIO]</b> agitar la antorcha';
        else if (fi === P.i && fj === P.j && !gateOpen) pr = hasKey ? '<b>[ESPACIO]</b> abrir el candado' : 'Reja con candado';
        else if (!at(fi, fj)) { const ft = feats.get(fkey(Pl.i, Pl.j, Pl.d)); if (ft && ft.type === 'insc') pr = '<b>[ESPACIO]</b> leer la inscripción'; else if (ft && ft.type === 'sconce' && !ft.sc.lit) pr = '<b>[ESPACIO]</b> prender la antorcha de la pared'; }
        st.prompt(Pl.anim && Pl.anim.type !== 'bump' ? null : pr);
        mapT -= dt; if (mapT <= 0) { mapT = 0.25; hudUpdate(); }
      },
    };
  },
});
