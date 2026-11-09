// CHIPA CITY — escena "santuario": el altarcito rojo del Gauchito Gil de Don Abundio, al atardecer.
// Tercera persona. Poner cada ofrenda en su lugar (vela, cintas, banderín, cigarros, chipá) y responder el acertijo.
// Tono de respeto: los chistes son de Don Abundio sobre sí mismo.
'use strict';
ChipaScenes.register('santuario', {
  fov: 50, lowH: 300,
  create(st, opts) {
    const T = THREE, { U } = ChipaScenes;
    const seed = opts.seed !== undefined ? opts.seed : 'gil';
    const r = U.rng(U.hash('santuario' + seed));
    const TITLE = U.o(opts, 'titulo title', 'El altarcito colorado');
    const INTRO = U.o(opts, 'intro', 'Un altarcito de chapa y ladrillo pintado de rojo bajo un espinillo. Banderas rojas, velas y la estampita del Gauchito Gil.');
    const GOAL = U.o(opts, 'objetivo goal', 'Poné cada ofrenda en su lugar y respondé el acertijo.');
    const OFR = U.o(opts, 'ofrendas', [
      { item: 'vela roja', lugar: 'frente a la imagen', texto: 'La llama no tiembla aunque sopla el norte.' },
      { item: 'cintas rojas', lugar: 'atadas a la rama del espinillo', texto: 'Una cinta por cada promesa.' },
      { item: 'banderín rojo', lugar: 'en el mástil de caña', texto: 'Colorado, como el pañuelo del Gauchito.' },
      { item: 'cigarros', lugar: 'en el plato de ofrendas', texto: 'Uno prendido, para que fume tranquilo.' },
      { item: 'chipá', lugar: 'en el plato de ofrendas', texto: 'Calentito.' },
    ]).map(o => Object.assign({ placed: false }, o));
    const ERR = U.o(opts, 'errorOfrenda', 'Don Abundio: "No, mitaí, eso no va ahí."');
    const AC = opts.acertijo || { pregunta: 'Bajo la tierra camino sin pies, del río vengo y al río voy. ¿Qué soy?', opciones: ['El oro', 'El agua', 'El Pombero'], correcta: 1, intentos: 3, pistas: [] };
    const NPC = (opts.npcs && opts.npcs[0]) || { name: 'Don Abundio', look: { skin: '#8a5a3a', hair: '#e0e0e0', shirt: '#d8282a', pants: '#3a3a3a' }, lineas: ['Despacito, que el Gauchito ve todo.'] };
    const REVEL = U.o(opts, 'revelacion', 'En lo oscuro, seguí el agua y no el brillo.');
    const WIN_TXT = U.o(opts, 'textoGana', 'Las velas se avivan todas juntas.');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Se apagan las velas. Volvé mañana.');
    const AMB = U.o(opts, 'ambiente', '');
    const who = String(NPC.name || 'Don Abundio');
    const sayErr = () => { const m = /^([^:]{2,30}):\s*"?(.*?)"?$/.exec(ERR); return m ? st.say(m[1], m[2]) : st.say(who, ERR); };
    const sayPista = p => { const m = /^([^:]{2,30}):\s*"?(.*?)"?$/.exec(p); return m ? st.say(m[1], m[2]) : st.say(who, p); };

    // ============================================================ texturas
    const grassC = U.canvas(32, 32, (g, w, h) => {
      U.R(g, '#5a6a2a', 0, 0, w, h); U.paint.noise(g, w, h, r, ['#4e5e24', '#66762e', '#6e7a34', '#56622a', '#7a7a3a'], w * h * 0.7);
      for (let k = 0; k < 40; k++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); U.R(g, U.pick(r, ['#8a8a42', '#3e4a1c']), x, y, 1, 2); }
    });
    const dirtC = U.canvas(32, 32, (g, w, h) => { U.paint.dirt(g, w, h, r, { cols: ['#6a5442', '#5e4a3a', '#74604a', '#54402e'] }); });
    const asphC = U.canvas(32, 32, (g, w, h) => { U.R(g, '#3a3634', 0, 0, w, h); U.paint.noise(g, w, h, r, ['#34302e', '#423e3a', '#2e2a28', '#4a4440'], w * h * 0.6); });
    const brickRedC = U.canvas(32, 32, (g, w, h) => {
      U.paint.brick(g, w, h, r, { bw: 8, bh: 4, cols: ['#c42a22', '#b0221c', '#d03028', '#a81e1a'], mortar: '#7a1610' });
      for (let k = 0; k < 30; k++) U.R(g, U.pick(r, ['#e04a3a', '#8a1a14', '#d8d0c0']), Math.floor(r() * w), Math.floor(r() * h), 1, 1); // pintura saltada
    });
    const tinC = U.canvas(16, 16, (g, w, h) => { for (let x = 0; x < w; x++) U.R(g, x % 4 < 2 ? '#c8261e' : '#9a1a14', x, 0, 1, h); U.paint.noise(g, w, h, r, ['#7a5a40', '#a04a30'], 20); });
    const caneC = U.canvas(8, 32, (g, w, h) => { U.R(g, '#c8b070', 0, 0, w, h); U.R(g, '#e0c890', 1, 0, 2, h); for (let y = 0; y < h; y += 8) { U.R(g, '#8a7040', 0, y, w, 1); U.R(g, '#a89050', 0, y + 1, w, 1); } });
    const barkC = U.canvas(16, 16, (g, w, h) => { U.R(g, '#4a3a2a', 0, 0, w, h); U.paint.noise(g, w, h, r, ['#3a2e20', '#5a4a36', '#2e241a', '#6a5a44'], 160); });
    // estampita del Gauchito Gil (pixel art)
    const gilC = U.canvas(24, 32, (g) => {
      U.R(g, '#5a0e0a', 0, 0, 24, 32); U.R(g, '#e8c040', 1, 1, 22, 30); U.R(g, '#c8221c', 2, 2, 20, 28);
      for (let y = 2; y < 18; y++) U.R(g, U.mix('#f08040', '#c8221c', (y - 2) / 16), 2, y, 20, 1);
      U.R(g, '#3a1a10', 11, 3, 2, 16); U.R(g, '#3a1a10', 6, 7, 12, 2);             // cruz
      U.R(g, '#1a1410', 8, 9, 8, 5); U.R(g, '#1a1410', 7, 11, 2, 7); U.R(g, '#1a1410', 15, 11, 2, 7); // pelo largo
      U.R(g, '#c88a5a', 9, 10, 6, 6); U.R(g, '#1a1410', 9, 14, 6, 1); U.R(g, '#e02020', 8, 9, 8, 1); // cara, bigote, vincha
      U.R(g, '#000', 10, 12, 1, 1); U.R(g, '#000', 13, 12, 1, 1);
      U.R(g, '#e02020', 8, 16, 8, 2);                                                // pañuelo
      U.R(g, '#5a8ac8', 7, 18, 10, 7); U.R(g, '#e02020', 6, 18, 2, 7); U.R(g, '#e02020', 16, 18, 2, 7); // camisa y poncho
      U.R(g, '#1a1a1a', 7, 24, 10, 1); U.R(g, '#d8c070', 11, 24, 2, 1);           // rastra
      U.R(g, '#e8e0d0', 7, 25, 4, 4); U.R(g, '#e8e0d0', 13, 25, 4, 4);           // bombacha
      U.R(g, '#f8e8a0', 3, 27, 2, 2); U.R(g, '#f8e8a0', 19, 27, 2, 2);
    });
    const T_ = (c, o) => U.tex(c, o);
    const grassT = T_(grassC), dirtT = T_(dirtC), asphT = T_(asphC), brickT = T_(brickRedC), tinT = T_(tinC), caneT = T_(caneC), barkT = T_(barkC), gilT = T_(gilC, { repeat: false, mips: false });

    // ============================================================ cielo y suelo
    const skyC = U.canvas(128, 64, (g, w, h) => {
      for (let y = 0; y < h; y++) {
        const t = y / h;
        U.R(g, t < 0.5 ? U.mix('#241a46', '#7a3a6a', t / 0.5) : t < 0.62 ? U.mix('#7a3a6a', '#f08a4a', (t - 0.5) / 0.12) : U.mix('#f8b060', '#3a2220', (t - 0.62) / 0.38), 0, y, w, 1);
      }
      // sol bajo hacia -x (u = 0.75)
      const sx = Math.round(w * 0.75), sy = Math.round(h * 0.6);
      for (let k = 6; k > 0; k--) { g.fillStyle = U.mix('#f8b060', '#fff4c0', 1 - k / 6); g.fillRect(sx - k * 2, sy - k, k * 4, k * 2); }
      for (let k = 0; k < 8; k++) { const y = 18 + Math.floor(r() * 16), x = Math.floor(r() * w), l = 8 + Math.floor(r() * 20); U.R(g, U.mix('#c86a6a', '#f0a070', r()), x, y, l, 1); U.R(g, '#5a3a5a', x + 2, y + 1, l - 4, 1); }
      for (let k = 0; k < 30; k++) U.R(g, '#e8e0ff', Math.floor(r() * w), Math.floor(r() * 18), 1, 1);
    });
    const skyT = U.tex(skyC, { repeat: false, mips: false }); skyT.wrapS = T.RepeatWrapping;
    const sky = new T.Mesh(new T.SphereGeometry(90, 24, 12), new T.MeshBasicMaterial({ map: skyT, side: T.BackSide, fog: false, color: new T.Color(1.15, 1.1, 1.1) }));
    st.scene.add(sky);
    st.scene.fog = new T.Fog(U.C(0x8a5a5a), 22, 75);
    st.renderer.setClearColor(U.C(0x2a1a2a));
    const ground = new T.Mesh(new T.PlaneGeometry(160, 160), U.mat({ map: grassT, rough: 1 })); grassT.repeat.set(80, 80);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; st.scene.add(ground);
    const patch = new T.Mesh(new T.CircleGeometry(4.8, 12), U.mat({ map: dirtT, rough: 1 })); dirtT.repeat.set(5, 5);
    patch.rotation.x = -Math.PI / 2; patch.position.set(0, 0.01, -1.6); patch.receiveShadow = true; st.scene.add(patch);
    // la avenida (Maipú) detrás del altar
    const road = new T.Mesh(new T.PlaneGeometry(200, 7), U.mat({ map: asphT, rough: 0.9 })); asphT.repeat.set(60, 2);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -11); road.receiveShadow = true; st.scene.add(road);
    for (let x = -100; x < 100; x += 4) { const m = new T.Mesh(new T.PlaneGeometry(1.8, 0.15), U.mat({ color: 0xd8d0b0, rough: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, -11); st.scene.add(m); }
    // siluetas lejanas: árboles, casas, postes de luz
    const far = new T.Group(); st.scene.add(far);
    const treeM = U.mat({ color: 0x2a3a1e, rough: 1 }), houseM = [0x4a3a3a, 0x5a4638, 0x3a3a48, 0x6a5444].map(c => U.mat({ color: c, rough: 1 })), roofM = U.mat({ color: 0x5a2a20, rough: 1 });
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = 26 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z < -8 && z > -14) continue;
      if (r() < 0.65) { const t = new T.Mesh(new T.DodecahedronGeometry(2 + r() * 2.5, 0), treeM); t.position.set(x, 2.5 + r() * 2, z); t.scale.y = 0.8; t.castShadow = true; far.add(t); const tr = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 3, 5), U.mat({ map: barkT })); tr.position.set(x, 1.5, z); far.add(tr); }
      else if (z < -19) { const hw = 4 + r() * 4, hh = 2.6 + r() * 3; const h = new T.Mesh(new T.BoxGeometry(hw, hh, 5), U.pick(r, houseM)); h.position.set(x, hh / 2, z); h.castShadow = true; far.add(h); }
    }
    for (let x = -60; x <= 60; x += 15) {
      const p = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 8, 5), U.mat({ color: 0x8a8a80 })); p.position.set(x, 4, -15); p.castShadow = true; far.add(p);
      const c = new T.Mesh(new T.BoxGeometry(1.6, 0.1, 0.1), U.mat({ color: 0x5a5a50 })); c.position.set(x, 7.6, -15); far.add(c);
    }
    { const pts = []; for (let x = -60; x <= 60; x += 1) pts.push(new T.Vector3(x, 7.55 - 0.6 * Math.pow(Math.sin(((x + 60) % 15) / 15 * Math.PI), 1.5), -15)); far.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x1a1a1a }))); }

    // ============================================================ el altarcito
    const SH = new T.Group(); SH.position.set(0, 0, -3); st.scene.add(SH);
    const brickM = U.mat({ map: brickT, rough: 0.85 }), tinM = U.mat({ map: tinT, rough: 0.5, metal: 0.4, side: T.DoubleSide }), whiteM = U.mat({ color: 0xe8e0d0 });
    const box = (w, h, d, m, x, y, z, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; (parent || SH).add(b); return b; };
    brickT.repeat.set(1, 1);
    box(1.9, 0.6, 1.4, brickM, 0, 0.3, 0);          // zócalo
    box(1.3, 1.15, 0.95, brickM, 0, 1.18, -0.15);   // capillita
    box(1.05, 0.95, 0.1, U.mat({ color: 0x2a0806 }), 0, 1.2, 0.29); // hueco oscuro
    const img = new T.Mesh(new T.PlaneGeometry(0.6, 0.8), U.mat({ map: gilT, rough: 0.6, emissive: 0x401010, emissiveMap: gilT, ei: 0.6 })); img.position.set(0, 1.22, 0.35); SH.add(img);
    // techo de chapa a dos aguas
    for (const sd of [-1, 1]) { const p = box(0.9, 0.03, 1.3, tinM, sd * 0.33, 2.01, -0.15); p.rotation.z = -sd * 0.63; }
    { const tri = new T.Shape(); tri.moveTo(-0.66, 0); tri.lineTo(0.66, 0); tri.lineTo(0, 0.48); const g = new T.ShapeGeometry(tri); for (const z of [0.33, -0.63]) { const m = new T.Mesh(g, U.mat({ color: 0xb01e18, side: T.DoubleSide })); m.position.set(0, 1.75, z); m.castShadow = true; SH.add(m); } }
    box(0.05, 0.36, 0.05, whiteM, 0, 2.38, 0.33); box(0.22, 0.05, 0.05, whiteM, 0, 2.46, 0.33); // crucecita arriba
    // botellitas, velas derretidas, flores de plástico que dejaron otros
    const bottleGeo = new T.CylinderGeometry(0.05, 0.06, 0.26, 6), neckGeo = new T.CylinderGeometry(0.02, 0.03, 0.1, 5);
    const glassM = [0x8ac8a8, 0x6a3a1a, 0xc8d8e0, 0xc02020].map(c => U.mat({ color: c, rough: 0.15, metal: 0.2, transparent: true, opacity: 0.85 }));
    for (let k = 0; k < 18; k++) {
      const a = r() * Math.PI - Math.PI, rad = 1.05 + r() * 0.5, x = Math.cos(a) * rad * 1.2, z = 0.2 + Math.abs(Math.sin(a)) * rad * 0.6 + 0.3;
      const m = U.pick(r, glassM), b = new T.Mesh(bottleGeo, m); b.position.set(x, 0.13, z); b.castShadow = true; SH.add(b);
      const n = new T.Mesh(neckGeo, m); n.position.set(x, 0.31, z); SH.add(n);
    }
    // velas viejas sobre el zócalo (prendidas) + la que pone el jugador
    const candleM = U.mat({ color: 0xd02020, rough: 0.6 }), waxGeo = new T.CylinderGeometry(0.045, 0.05, 1, 6);
    const flames = [];
    const addCandle = (x, y, z, h, lit, parent) => {
      const c = new T.Mesh(waxGeo, candleM); c.scale.y = h; c.position.set(x, y + h / 2, z); c.castShadow = true; (parent || SH).add(c);
      const f = st.flame({ w: 0.07, h: 0.13, bright: 3, grid: 5 }); f.position.set(x, y + h, z); f.visible = lit; (parent || SH).add(f); flames.push(f); return f;
    };
    for (let k = 0; k < 7; k++) addCandle(-0.75 + k * 0.25 + (r() - 0.5) * 0.06, 0.6, 0.45 + (r() - 0.5) * 0.15, 0.06 + r() * 0.16, r() < 0.6);
    const candleLight = new T.PointLight(U.C(0xff8a3a), 1.6, 6, 1.6); candleLight.position.set(0, 1.0, -2.2); st.scene.add(candleLight); st.addFlicker(candleLight, 1.6, 3, 0.9);
    st.particles({ mode: 'embers', count: 16, center: [0, 0.7, -2.45], box: [1.4, 0.8, 0.3], size: 0.015, color: 0xffa040, bright: 2, speed: 0.6, far: 16 });

    // ============================================================ el espinillo (árbol bajo y retorcido)
    const tree = new T.Group(); tree.position.set(-3.4, 0, -2.4); st.scene.add(tree);
    const barkM = U.mat({ map: barkT, rough: 1 });
    const limb = (x0, y0, z0, x1, y1, z1, rad) => { const a = new T.Vector3(x0, y0, z0), b = new T.Vector3(x1, y1, z1), len = a.distanceTo(b); const m = new T.Mesh(new T.CylinderGeometry(rad * 0.7, rad, len, 5), barkM); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; tree.add(m); };
    limb(0, 0, 0, 0.2, 1.3, 0.1, 0.16); limb(0.2, 1.3, 0.1, 1.3, 1.9, 0.5, 0.09); limb(0.2, 1.3, 0.1, -0.7, 2.3, -0.3, 0.1); limb(0.2, 1.3, 0.1, 0.4, 2.6, -0.6, 0.08); limb(-0.7, 2.3, -0.3, -1.4, 2.6, 0.2, 0.05); limb(1.3, 1.9, 0.5, 2.0, 2.2, 0.6, 0.05);
    const leafM = U.mat({ color: 0x4a6a2a, rough: 1 }), leafGeo = new T.IcosahedronGeometry(0.5, 0);
    for (let k = 0; k < 16; k++) { const l = new T.Mesh(leafGeo, leafM); l.position.set(-1.2 + r() * 3.2, 2.2 + r() * 0.8, -0.8 + r() * 1.4); l.scale.set(1 + r() * 0.8, 0.45, 1 + r() * 0.8); l.castShadow = true; tree.add(l); }
    // flores amarillas del espinillo
    st.particles({ mode: 'fireflies', count: 30, center: [-3.2, 2.6, -2.2], box: [3, 0.8, 1.6], size: 0.035, color: 0xf8d040, bright: 1.2, speed: 0.2, far: 30, positions: (n, rr) => [-4.4 + rr() * 3.2, 2.2 + rr() * 0.9, -3.1 + rr() * 1.5] });
    // ============================================================ mástil de caña, banderas, plato
    const caneM = U.mat({ map: caneT, rough: 0.8 });
    const mast = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 4.2, 6), caneM); mast.position.set(2.6, 2.1, -2.8); mast.castShadow = true; st.scene.add(mast);
    const flagM = U.mat({ color: 0xd8201a, rough: 0.9, side: T.DoubleSide });
    const flags = [];
    const addFlag = (x, z, h, w, fh, visible = true) => {
      const pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, h, 5), caneM); pole.position.set(x, h / 2, z); pole.castShadow = true; st.scene.add(pole);
      const geo = new T.PlaneGeometry(w, fh, 8, 3); geo.translate(w / 2, 0, 0);
      const f = new T.Mesh(geo, flagM); f.position.set(x, h - fh / 2 - 0.05, z); f.castShadow = true; f.visible = visible; st.scene.add(f);
      const base = Float32Array.from(geo.attributes.position.array);
      const fl = { f, geo, base, ph: r() * 6, w }; flags.push(fl); return fl;
    };
    addFlag(-1.7, -4.0, 3.4, 1.1, 0.7); addFlag(1.6, -4.3, 3.8, 1.2, 0.75); addFlag(-5.2, -4.4, 3.1, 1.0, 0.65); addFlag(4.6, -3.6, 3.3, 1.0, 0.65); addFlag(-0.4, -5.6, 4.0, 1.3, 0.8);
    const banderin = addFlag(2.6, -2.8, 4.2, 0.8, 0.45, false);
    // plato de ofrendas sobre unos ladrillos
    const PL = { x: 1.25, z: -1.55 };
    box(0.5, 0.45, 0.4, brickM, PL.x, 0.225, PL.z - (-3), null).position.set(PL.x, 0.225, PL.z + 3);
    const plate = new T.Mesh(new T.CylinderGeometry(0.28, 0.22, 0.04, 10), U.mat({ color: 0xc8c8c0, metal: 0.7, rough: 0.35 })); plate.position.set(PL.x, 0.47, PL.z); plate.castShadow = plate.receiveShadow = true; st.scene.add(plate);

    // ============================================================ Don Abundio
    const ab = U.person(Object.assign({ hat: '#d8c8a0' }, NPC.look || {})); ab.position.set(-1.7, 0, -0.4); ab.rotation.y = 0.6; st.scene.add(ab);
    ab.traverse(o => { if (o.isMesh) o.castShadow = true; });
    let abLine = 0;

    // ============================================================ luz de atardecer
    const sun = new T.DirectionalLight(U.C(0xffa060), 2.4); sun.position.set(-16, 7, -6); sun.target.position.set(0, 0, -1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -0.0008;
    st.scene.add(sun); st.scene.add(sun.target);
    st.scene.add(new T.HemisphereLight(U.C(0x8a7ab8), U.C(0x5a3a28), 0.75));
    const post = st.post; post.sat.value = 1.12; post.exposure.value = 1.0; post.levels.value = 26; post.vig.value = 0.7; post.bloom.value = 0.8; post.bloomThr.value = 0.8;
    post.lift.value.setRGB(0.04, 0.02, 0.05); post.gain.value.setRGB(1.04, 0.96, 0.9);
    st.particles({ mode: 'dust', count: 120, center: [0, 1.5, -1], box: [14, 3, 12], size: 0.025, color: 0xffd8a0, bright: 0.8, far: 20, speed: 0.4 });
    st.particles({ mode: 'fireflies', count: 26, center: [0, 1, 0], box: [16, 2, 12], size: 0.03, color: 0xd8ff80, bright: 1.6, speed: 0.6, far: 22, positions: (n, rr) => [(rr() - 0.5) * 18, 0.4 + rr() * 1.4, (rr() - 0.5) * 12] });

    // ============================================================ autos que pasan y tocan bocina
    const cars = [0, 1].map(k => {
      const g = new T.Group(), col = U.pick(r, [0xd8d0c0, 0x2a4a8a, 0x8a1a1a, 0xe8c040]);
      const body = new T.Mesh(new T.BoxGeometry(4, 0.7, 1.7), U.mat({ color: col, metal: 0.4, rough: 0.4 })); body.position.y = 0.6; g.add(body);
      const cab = new T.Mesh(new T.BoxGeometry(2.1, 0.6, 1.5), U.mat({ color: 0x1a2028, metal: 0.5, rough: 0.2 })); cab.position.set(-0.2, 1.2, 0); g.add(cab);
      for (const [x, z] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) { const w = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.25, 8), U.mat({ color: 0x111111 })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
      for (const z of [0.55, -0.55]) { const l = new T.Mesh(new T.BoxGeometry(0.05, 0.14, 0.3), new T.MeshBasicMaterial({ color: new T.Color(4, 3.6, 2.6) })); l.position.set(2.02, 0.65, z); g.add(l); }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.visible = false; st.scene.add(g);
      return { g, x: 0, dir: 1, v: 0, t: 4 + k * 7, honked: false };
    });

    // ============================================================ ofrendas colocadas (visual)
    const placedFx = {
      vela: () => { addCandle(0, 0.6, 0.62, 0.32, true); st.flash(0xffa040, 0.25); candleLight.intensity += 0.4; },
      cintas: () => { for (let k = 0; k < 7; k++) { const rib = new T.Mesh(new T.PlaneGeometry(0.06, 0.6 + r() * 0.4), flagM); rib.geometry.translate(0, -0.35, 0); rib.position.set(0.6 + k * 0.12, 1.66 + k * 0.08, 0.3 + (r() - 0.5) * 0.1); rib.castShadow = true; tree.add(rib); ribbons.push({ m: rib, ph: r() * 6 }); } },
      banderin: () => { banderin.f.visible = true; },
      cigarros: () => { for (let k = 0; k < 3; k++) { const c = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 5), whiteM); c.rotation.z = Math.PI / 2; c.rotation.y = k * 0.5; c.position.set(PL.x - 0.08 + k * 0.03, 0.5, PL.z - 0.06 + k * 0.05); st.scene.add(c); }
        st.particles({ mode: 'embers', count: 14, center: [PL.x - 0.02, 0.5, PL.z], box: [0.05, 1.0, 0.05], size: 0.04, color: 0x9a9aa0, bright: 0.5, speed: 0.2, far: 20 }); },
      chipa: () => { const m = U.mat({ color: 0xe0b060, rough: 0.9 }); for (let k = 0; k < 5; k++) { const c = new T.Mesh(new T.IcosahedronGeometry(0.06, 0), m); c.position.set(PL.x + 0.06 + (r() - 0.5) * 0.14, 0.52, PL.z + (r() - 0.5) * 0.14); c.scale.y = 0.75; c.castShadow = true; st.scene.add(c); } },
    };
    const ribbons = [];
    const fxKey = it => /vela/i.test(it) ? 'vela' : /cinta/i.test(it) ? 'cintas' : /bander/i.test(it) ? 'banderin' : /cigarr|tabaco/i.test(it) ? 'cigarros' : /chip/i.test(it) ? 'chipa' : 'vela';
    // lugares del altar
    const SPOTS = [
      { id: 'imagen', label: 'frente a la imagen', x: 0, z: -1.3, r: 1.5, re: /imagen|altar|estampa/i },
      { id: 'espinillo', label: 'en la rama del espinillo', x: -2.5, z: -1.6, r: 1.4, re: /espinillo|rama|árbol|arbol/i },
      { id: 'mastil', label: 'en el mástil de caña', x: 2.6, z: -2.0, r: 1.3, re: /m[aá]stil|caña|cana/i },
      { id: 'plato', label: 'en el plato de ofrendas', x: 1.25, z: -0.95, r: 1.2, re: /plato/i },
    ];
    const spotOf = o => SPOTS.find(s => s.re.test(o.lugar || '')) || SPOTS[0];

    // ============================================================ jugador
    const pl = U.person({ shirt: '#e0c070', pants: '#3a4a6a', hair: '#2a1a10', skin: '#d8a070' });
    pl.traverse(o => { if (o.isMesh) o.castShadow = true; });
    pl.position.set(0.4, 0, 4.2); pl.rotation.y = Math.PI; st.scene.add(pl);
    const coll = new U.Collider(null, 1);
    coll.box(-0.95, -3.7, 0.95, -2.3); coll.box(PL.x - 0.3, PL.z - 0.25, PL.x + 0.3, PL.z + 0.25); coll.circle(-3.2, -2.3, 0.3); coll.circle(2.6, -2.8, 0.15); coll.circle(-1.7, -0.4, 0.35);
    for (const f of flags) coll.circle(f.f.position.x, f.f.position.z, 0.12);
    const ctl = st.thirdPerson({ obj: pl, collider: coll, radius: 0.3, speed: 2.8, dist: 7, pitch: 0.36, lookH: 1.5, face: Math.PI, bounds: [-9, -6.5, 9, 9] });
    ctl.camYaw = ctl.camYawT = -0.25;

    // ============================================================ HUD y estado
    const S = { phase: 'ofrendas', tries: Math.max(1, +AC.intentos || 3), wrongs: 0, mistakes: 0, pista: 0 };
    function hud() {
      st.status('OFRENDAS<br>' + OFR.map(o => `<span style="color:${o.placed ? '#7ad070' : '#f4f0d8'}">${o.placed ? '✔' : '·'} ${o.item.toUpperCase()}</span>`).join('<br>') +
        (S.phase === 'acertijo' ? `<br><br><span style="color:#f0c030">INTENTOS: ${S.tries}</span>` : ''));
    }
    st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>${GOAL}`);
    st.titleCard(TITLE, INTRO, 6);
    st.showKeys(['[WASD ↑↓←→] caminar', '[Q E] girar la cámara', '[ESPACIO] dejar una ofrenda · hablar'], 14);
    if (AMB) setTimeout(() => { if (!st.done) st.toast(`<span style="color:#e8dcc0;font-size:.8em">${AMB}</span>`, 4); }, 6500);
    hud();
    const SND = st.sfx;
    const wind = SND.loop({ freq: 500, vol: 0.03 });
    // chamamé lejano de una radio a pila: arpegio en 3/4 muy bajito
    let radioT = 0, radioN = 0; const CH = [[220, 277, 330], [196, 247, 294], [165, 208, 247], [220, 277, 330]];
    const honk = () => { SND.tone(392, 0.22, { type: 'square', vol: 0.05 }); SND.tone(392, 0.4, { type: 'square', vol: 0.05, delay: 0.3 }); SND.tone(494, 0.22, { type: 'square', vol: 0.03 }); SND.tone(494, 0.4, { type: 'square', vol: 0.03, delay: 0.3 }); };

    async function placeAt(spot) {
      const left = OFR.filter(o => !o.placed);
      const ans = await st.choose('Ofrenda', `¿Qué dejás ${spot.label}?`, left.map(o => o.item[0].toUpperCase() + o.item.slice(1)).concat(['Nada, todavía']));
      if (st.done || ans >= left.length) return;
      const o = left[ans];
      if (spotOf(o).id === spot.id) {
        o.placed = true; placedFx[fxKey(o.item)]();
        [523, 659, 784].forEach((f, n) => SND.tone(f, 0.25, { type: 'triangle', vol: 0.06, delay: n * 0.1 }));
        st.toast(`${o.item[0].toUpperCase() + o.item.slice(1)} ${o.lugar}.<br><span style="color:#e8dcc0">${o.texto || ''}</span>`, 3.4);
        hud();
        if (OFR.every(x => x.placed)) riddle();
      } else { S.mistakes++; SND.tone(160, 0.3, { type: 'square', vol: 0.05 }); await sayErr(); }
    }
    async function riddle() {
      S.phase = 'acertijo'; hud();
      st.busy++;
      try {
        // las velas se avivan, el viento se calma
        for (const f of flames) f.visible = true;
        candleLight.intensity = 2.6; st.flash(0xffa040, 0.3);
        SND.tone(110, 3, { type: 'sine', vol: 0.06 }); SND.tone(165, 3, { type: 'sine', vol: 0.04, delay: 0.5 });
        await st.say(who, 'Listo, mitaí. Ahora callate un poquito... que el Gauchito está por hablar.');
        st.objective(`<b>${String(TITLE).toUpperCase()}</b><br>Respondé el acertijo del Gauchito`);
        while (S.tries > 0 && !st.done) {
          await st.say('El Gauchito Gil', AC.pregunta, { pitch: 260, speed: 35 });
          const a = await st.choose('El Gauchito Gil', '¿Qué soy?', AC.opciones);
          if (a === AC.correcta) { S.phase = 'listo'; break; }
          S.tries--; S.wrongs++; hud(); candleLight.intensity *= 0.7; for (let k = 0; k < flames.length; k += 2) flames[k].visible = false;
          SND.noise(0.6, { freq: 600, vol: 0.12, sweep: 200 });
          if (S.tries > 0) await sayPista((AC.pistas || [])[S.pista++] || `${who}: "Pensalo de nuevo, mitaí."`);
        }
      } finally { st.busy--; }
      if (st.done) return;
      if (S.phase === 'listo') {
        candleLight.intensity = 3.4; for (const f of flames) f.visible = true; st.flash(0xfff0c0, 0.6);
        [392, 494, 587, 784].forEach((f, n) => SND.tone(f, 0.5, { type: 'triangle', vol: 0.07, delay: n * 0.15 }));
        st.titleCard('"' + REVEL + '"', '', 5);
        await st.say('El Gauchito Gil', REVEL, { pitch: 260, speed: 32 });
        st.finish({ ok: true, score: Math.max(100, 1000 - S.mistakes * 100 - S.wrongs * 200), message: WIN_TXT, data: { revelacion: REVEL, errores: S.mistakes, intentosFallidos: S.wrongs } });
      } else {
        for (const f of flames) f.visible = false; candleLight.intensity = 0; st.flash(0x000000, 0.6);
        st.toast(LOSE_TXT, 4, '#ff8060');
        setTimeout(() => st.finish({ ok: false, reason: LOSE_TXT, data: { intentosFallidos: S.wrongs } }), 2500);
      }
    }
    const items = SPOTS.map(s => Object.assign({ kind: 'spot' }, s)).concat([{ kind: 'npc', x: -1.7, z: -0.1, r: 1.6 }]);
    const debug = {
      info: () => ({ phase: S.phase, tries: S.tries, placed: OFR.filter(o => o.placed).map(o => o.item), pos: [pl.position.x, pl.position.z] }),
      placeAll() { for (const o of OFR) if (!o.placed) { o.placed = true; placedFx[fxKey(o.item)](); } hud(); riddle(); },
      spots: () => OFR.map(o => spotOf(o).id),
      xy(x, z) { pl.position.set(x, 0, z); ctl.first = true; },
    };
    return {
      debug,
      update(dt, t) {
        ctl.update(dt);
        // Abundio mira al jugador
        const dx = pl.position.x - ab.position.x, dz = pl.position.z - ab.position.z;
        ab.rotation.y = U.dampAngle(ab.rotation.y, Math.atan2(dx, dz), 2, dt); U.animPerson(ab, 0, dt);
        // banderas y cintas al viento
        const gust = 0.7 + 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
        for (const fl of flags) {
          if (!fl.f.visible) continue;
          const a = fl.geo.attributes.position.array, b = fl.base;
          for (let i = 0; i < a.length; i += 3) { const u = b[i] / fl.w; a[i + 2] = Math.sin(t * 7 * gust - b[i] * 5 + fl.ph) * 0.12 * u * gust + Math.sin(t * 3.1 + b[i + 1] * 3) * 0.03 * u; a[i] = b[i] * (1 - 0.06 * u * Math.abs(Math.sin(t * 2 + fl.ph))); }
          fl.geo.attributes.position.needsUpdate = true; fl.geo.computeVertexNormals();
        }
        for (const rb of ribbons) { rb.m.rotation.x = Math.sin(t * 3 + rb.ph) * 0.35 * gust; rb.m.rotation.z = Math.sin(t * 2.3 + rb.ph) * 0.15; }
        wind.set(0.02 + gust * 0.02);
        // autos
        for (const c of cars) {
          if (!c.g.visible) { c.t -= dt; if (c.t <= 0) { c.dir = r() < 0.5 ? 1 : -1; c.x = -c.dir * 70; c.v = 11 + r() * 5; c.honked = false; c.g.visible = true; c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; c.g.position.set(c.x, 0, c.dir > 0 ? -12.6 + 1.8 : -9.4 - 0.4); } continue; }
          c.x += c.dir * c.v * dt; c.g.position.x = c.x;
          if (!c.honked && Math.abs(c.x) < 6) { c.honked = true; honk(); }
          if (Math.abs(c.x) > 72) { c.g.visible = false; c.t = 5 + r() * 9; }
        }
        // radio
        radioT -= dt; if (radioT <= 0) { radioT = 0.36; const ch = CH[Math.floor(radioN / 6) % 4], n = radioN % 6; SND.tone(ch[n % 3] * (n >= 3 ? 2 : 1), 0.3, { type: 'triangle', vol: n % 3 === 0 ? 0.012 : 0.007, pan: 0.6 }); radioN++; }
        // interacción
        let pr = null;
        const it = st.busy || S.phase !== 'ofrendas' ? null : st.nearest(items, pl.position.x, pl.position.z);
        if (it) pr = it.kind === 'npc' ? `<b>[ESPACIO]</b> hablar con ${who}` : `<b>[ESPACIO]</b> dejar una ofrenda ${it.label}`;
        st.prompt(pr);
        if (it && st.action()) {
          if (it.kind === 'npc') { const ls = NPC.lineas || NPC.lines || ['...']; st.say(who, ls[abLine++ % ls.length]); }
          else placeAt(it);
        }
      },
    };
  },
});
