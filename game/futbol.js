// game/futbol.js — Minijuego de fútbol de Chipa City.
// Vista cenital con leve perspectiva, al estilo de los jueguitos flash de antes y de Sensible Soccer.
// Todo en pixel art sobre un canvas 2D chico escalado (sin suavizado), sonido sintetizado con WebAudio.
//
// API:  Chipa.futbol.play(opts) → Promise<{ ok, golesJugador, golesRival }>
//   opts.rival         nombre del equipo rival ('Boca Unidos', 'Los del Barrio', …)
//   opts.minutos       duración real del partido en minutos (def. 3; se reparte en dos tiempos)
//   opts.jugadores     5 o 7 por lado (def. 5)
//   opts.dificultad    1..10 (def. 5)
//   opts.necesitaGanar si es true, el empate no alcanza (hay gol de oro y si sigue empatado, ok = false)
//   opts.titulo        título de la presentación
//   opts.textos        { gol, golRival, entretiempo, final, ganaste, perdiste, empate, golDeOro, intro }
//   opts.demo          (prueba) los dos equipos los maneja la compu
//
// Teclas: flechas/WASD mover · ESPACIO/J patear (mantener = más fuerte) · X/K pasar (sin pelota: cambiar)
//         C/L barrida · Q/SHIFT cambiar jugador · ESC/P pausa · M sonido
(() => {
'use strict';
const Chipa = window.Chipa = window.Chipa || {};

// ============================================================ UTILIDADES
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const FONT = '"Press Start 2P", ui-monospace, monospace';
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const STEP = 1 / 60, PY = 0.8, PZ = 0.85, GRAV = 360;
const RUN = 16;              // banquina de pasto alrededor de la cancha (px del mundo)
const ROWH = 6;              // alto de cada escalón de la tribuna (px de pantalla)
const TOP_ROWS = 8, BOT_ROWS = 5;
const ADH = 10, FENCEH = 13; // alto de los carteles de publicidad y del alambrado (px de pantalla)
const FR_LIN = 0.9, FR_CONST = 25; // rozamiento de la pelota en el piso
const RECN = 170;            // cuadros guardados para la repetición

const KEYS = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  kick: ['Space', 'KeyJ'], pass: ['KeyX', 'KeyK'], tackle: ['KeyC', 'KeyL'], sw: ['KeyQ', 'ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'], mute: ['KeyM'], ok: ['Enter', 'NumpadEnter'],
};
const GAME_KEYS = new Set(Object.values(KEYS).flat());

// medidas de la cancha (px del mundo; ~5,5 px por metro)
const FIELDS = {
  5: { FW: 440, FH: 260, GW: 46, GH: 15, GD: 12, AD: 58, AW: 140, CR: 34,
       form: [[0.02, 0.5, 'GK', 1], [0.2, 0.5, 'DEF', 4], [0.4, 0.24, 'MID', 8], [0.4, 0.76, 'MID', 7], [0.64, 0.5, 'FWD', 9]] },
  7: { FW: 580, FH: 340, GW: 54, GH: 16, GD: 13, AD: 72, AW: 172, CR: 42,
       form: [[0.02, 0.5, 'GK', 1], [0.19, 0.3, 'DEF', 2], [0.19, 0.7, 'DEF', 6], [0.4, 0.17, 'MID', 7], [0.37, 0.5, 'MID', 5],
              [0.4, 0.83, 'MID', 11], [0.66, 0.5, 'FWD', 9]] },
};

// ============================================================ EQUIPOS Y CAMISETAS
const HURACAN = { name: 'HURACÁN', shirt: '#e0202e', alt: '#2040b0', pat: 'stripes', shorts: '#1a2470', socks: '#e0202e', fans: ['#e0202e', '#2040b0', '#e0202e', '#f0f0f0'] };
const PRESETS = [
  [/boca\s*unidos/i, { shirt: '#f4c820', alt: '#1a3a90', pat: 'band', shorts: '#1a3a90', socks: '#f4c820' }],
  [/barrio/i, { shirt: '#f2f2ea', alt: '#22a050', pat: 'sash', shorts: '#22a050', socks: '#f2f2ea' }],
  [/mandiy/i, { shirt: '#f2f2ea', alt: '#1a8040', pat: 'band', shorts: '#1a8040', socks: '#f2f2ea' }],
  [/san\s*mart/i, { shirt: '#f2f2ea', alt: '#202020', pat: 'stripes', shorts: '#202020', socks: '#202020' }],
  [/policia|policía|polis/i, { shirt: '#203070', alt: '#80b0f0', pat: 'band', shorts: '#202840', socks: '#203070' }],
  [/colectiv|chofer/i, { shirt: '#f08020', alt: '#202020', pat: 'solid', shorts: '#202020', socks: '#f08020' }],
];
const FALLBACK = [
  { shirt: '#f4d020', alt: '#202020', pat: 'stripes', shorts: '#202020', socks: '#f4d020' },
  { shirt: '#22a050', alt: '#f2f2ea', pat: 'stripes', shorts: '#f2f2ea', socks: '#22a050' },
  { shirt: '#80c8f0', alt: '#f2f2ea', pat: 'stripes', shorts: '#202020', socks: '#f2f2ea' },
  { shirt: '#f08020', alt: '#f08020', pat: 'solid', shorts: '#f2f2ea', socks: '#f08020' },
  { shirt: '#8040b0', alt: '#f2f2ea', pat: 'band', shorts: '#8040b0', socks: '#f2f2ea' },
  { shirt: '#f2f2ea', alt: '#202020', pat: 'stripes', shorts: '#202020', socks: '#f2f2ea' },
  { shirt: '#f2f2ea', alt: '#f2f2ea', pat: 'solid', shorts: '#202020', socks: '#202020' },
  { shirt: '#30a040', alt: '#f4d020', pat: 'sash', shorts: '#30a040', socks: '#f4d020' },
];
function teamLook(name) {
  let base = null;
  for (const [re, l] of PRESETS) if (re.test(name)) { base = l; break; }
  if (!base) { let h = 7; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; base = FALLBACK[h % FALLBACK.length]; }
  return Object.assign({ name: name.toUpperCase() }, base, { fans: [base.shirt, base.alt, base.shirt, base.shorts] });
}
const GK_HOME = { shirt: '#30b050', alt: '#208038', pat: 'solid', shorts: '#202020', socks: '#30b050', gk: true };
const GK_AWAY = { shirt: '#ff8a20', alt: '#202020', pat: 'solid', shorts: '#202020', socks: '#ff8a20', gk: true };
const GK_AWAY2 = { shirt: '#a8a8b0', alt: '#404048', pat: 'solid', shorts: '#202020', socks: '#a8a8b0', gk: true };
const SKINS = ['#f0c8a0', '#e0b088', '#c89068', '#a87050', '#8a5a3a', '#6a4028'];
const HAIRS = ['#1a1410', '#2a1c10', '#4a3020', '#6a4a28', '#101010', '#c8a050', '#3a2a20'];

// ============================================================ SONIDO (WebAudio, todo sintetizado)
const AU = (() => {
  let ac = null, master = null, noise = null, crowdG = null, crowdF = null, muted = false;
  let bomboT = 0, bomboStep = 0, level = 0.05, roarT = 0;
  const BOMBO = [1, 0, 1, 1, 0, 1, 0, 0];
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { b = b * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = b * 1.6; }
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    crowdF = ac.createBiquadFilter(); crowdF.type = 'bandpass'; crowdF.frequency.value = 650; crowdF.Q.value = 0.6;
    crowdG = ac.createGain(); crowdG.gain.value = 0;
    src.connect(crowdF); crowdF.connect(crowdG); crowdG.connect(master); src.start();
  }
  function close() { if (ac) { try { ac.close(); } catch (e) { /* nada */ } } ac = null; }
  const T = () => ac.currentTime;
  function burst(dur, vol, freq, type = 'lowpass', t0) {
    if (!ac || vol <= 0.002) return;
    const t = t0 || T(), s = ac.createBufferSource(); s.buffer = noise; s.playbackRate.value = 1.5;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function tone(type, f0, f1, dur, vol, t0) {
    if (!ac) return;
    const t = t0 || T(), o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function whistle(dur = 0.3, delay = 0) {
    if (!ac) return;
    const t = T() + delay, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 36; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.setValueAtTime(0.16, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
    burst(dur, 0.025, 5000, 'highpass', t);
  }
  function kick(p) { tone('sine', 170, 45, 0.13, 0.2 + p * 0.3); burst(0.05, 0.08 + p * 0.12, 2500); }
  function touch() { tone('sine', 220, 90, 0.05, 0.08); }
  function bounce(v) { tone('sine', 140, 70, 0.06, Math.min(0.12, v / 900)); }
  function post() { tone('square', 900, 860, 0.35, 0.06); tone('triangle', 1350, 1300, 0.45, 0.08); burst(0.05, 0.1, 3000); }
  function slide() { burst(0.25, 0.07, 900); }
  function thud() { tone('sine', 90, 40, 0.15, 0.25); burst(0.08, 0.1, 600); }
  function bombo(v) { if (!ac) return; tone('sine', 95, 48, 0.28, 0.22 * v); burst(0.04, 0.05 * v, 400); }
  function roar(peak, dur, freq) {
    if (!ac) return; const t = T();
    crowdG.gain.cancelScheduledValues(t); crowdG.gain.setValueAtTime(crowdG.gain.value, t);
    crowdG.gain.linearRampToValueAtTime(muted ? 0 : peak, t + 0.25); crowdG.gain.linearRampToValueAtTime(muted ? 0 : level, t + dur);
    crowdF.frequency.cancelScheduledValues(t); crowdF.frequency.setValueAtTime(freq, t); crowdF.frequency.linearRampToValueAtTime(650, t + dur);
    roarT = dur;
  }
  // "¡GOOOOL!" con un sintetizador de formantes (sierra + filtros de la vocal O)
  function voice(dur = 2.4) {
    if (!ac) return;
    const t = T(), o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), out = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(235, t + 0.3);
    o.frequency.setValueAtTime(235, t + dur * 0.75); o.frequency.linearRampToValueAtTime(190, t + dur);
    vib.frequency.value = 5.5; vg.gain.value = 7; vib.connect(vg); vg.connect(o.frequency);
    for (const [f, q, gv] of [[540, 7, 1], [860, 9, 0.55], [2500, 12, 0.15]]) {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      if (f === 860) { bp.frequency.setValueAtTime(860, t + dur * 0.82); bp.frequency.linearRampToValueAtTime(1300, t + dur * 0.9); }
      const g = ac.createGain(); g.gain.value = gv; o.connect(bp); bp.connect(g); g.connect(out);
    }
    out.gain.setValueAtTime(0.0005, t); out.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    out.gain.setValueAtTime(0.9, t + dur * 0.85); out.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    out.connect(master); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    burst(0.06, 0.12, 700, 'lowpass', t);
  }
  function update(dt, excite) {
    if (!ac) return;
    level = 0.035 + excite * 0.05;
    if (roarT > 0) roarT -= dt; else crowdG.gain.setTargetAtTime(muted ? 0 : level, T(), 0.4);
    bomboT -= dt;
    if (bomboT <= 0) { bomboT += 0.23; if (BOMBO[bomboStep++ % 8]) bombo(0.6 + excite * 0.6); }
  }
  return {
    init, close, whistle, kick, touch, bounce, post, slide, thud, roar, voice, update,
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
  };
})();

// ============================================================ EL PARTIDO
function createMatch(opts, done) {
  const NP = opts.jugadores === 7 ? 7 : 5;
  const F = FIELDS[NP];
  const { FW, FH, GW, GH, GD, AD, AW, CR } = F;
  const CY = FH / 2;
  const DIF = clamp(Math.round(opts.dificultad || 5), 1, 10);
  const EJ = opts.equipoJugador || {}, ER = opts.equipoRival || {};
  const RIVAL = String(opts.rival || ER.nombre || 'Los del Barrio');
  const NAME0 = String(EJ.nombre || 'Huracán').toUpperCase();
  const TX = Object.assign({
    gol: '¡GOOOL, NDEEE!', golRival: `Gol de ${RIVAL}... ¡qué macana!`, entretiempo: 'ENTRETIEMPO', final: '¡FINAL DEL PARTIDO!',
    ganaste: '¡Ganó el Globo, ndeee!', perdiste: 'Perdimos... la próxima los bailamos', empate: 'Empate. Ni fu ni fa.',
    golDeOro: '¡GOL DE ORO! El que la mete, gana', intro: 'Cancha del Globo · Corrientes',
  }, opts.textos || {});
  // camisetas: Huracán (rojo y azul a bastones) o las que mande la misión ({camiseta, vivos, arquero})
  const custom = (E, base, nm) => E.camiseta ? { name: nm, shirt: E.camiseta, alt: E.vivos || E.camiseta, sleeve: E.vivos || E.camiseta,
    pat: E.patron || (E.vivos ? 'trim' : 'solid'), shorts: E.short || E.vivos || '#202020', socks: E.medias || E.camiseta,
    fans: [E.camiseta, E.vivos || E.camiseta, E.camiseta, '#f0f0f0'] } : base;
  const gkCustom = (col, base) => col ? Object.assign({}, base, { shirt: col, alt: col, socks: col }) : base;
  const LOOKS = [custom(EJ, Object.assign({}, HURACAN), NAME0), custom(ER, teamLook(RIVAL), RIVAL.toUpperCase())];
  const GKL = [gkCustom(EJ.arquero, GK_HOME), gkCustom(ER.arquero, /#ff8a20|#f08020/.test(LOOKS[1].shirt) ? GK_AWAY2 : GK_AWAY)];
  // reglas raras que pueden venir de la misión
  const estilo = String(ER.estilo || '');
  const DIRTY = ER.juegaSucio != null ? !!ER.juegaSucio : /sucio|patea|pegan/i.test(estilo);
  const TIRED = ER.seCansan != null ? !!ER.seCansan : /cans/i.test(estilo);
  const BRIBED = opts.arbitroComprado != null ? !!opts.arbitroComprado : /offside|orsai/i.test(String(opts.arbitro || ''));
  const PENALES = opts.penales > 0 ? opts.penales | 0 : (/penal/i.test(String(opts.empate || '')) ? (parseInt(String(opts.empate).match(/(\d+)/)?.[1], 10) || 3) : 0);
  const RELATO = opts.relato || {};
  const DEMO = !!opts.demo;
  const minutos = opts.minutos > 0 ? +opts.minutos : 3;
  const HALF = minutos * 60 / 2;                // segundos reales por tiempo

  // ---------------------------------------------------------- estado
  const M = {
    phase: 'intro', pt: 0, time: 0, half: 1, clock: 0, added: [1 + (Math.random() * 3 | 0), 2 + (Math.random() * 3 | 0)],
    score: [0, 0], side: [1, -1], kickoff0: Math.random() < 0.5 ? 0 : 1, ctrl: null, switchT: 0,
    restart: null, pending: null, paused: false, big: null, label: null, shake: 0, excite: 0,
    crowdMode: 'n', crowdT: 0, conf: [], parts: [], scorer: null, lastGoalTeam: -1, endMsg: '', result: null,
    rec: [], recHead: 0, recCount: 0, replayI: 0, addedShown: false, autoT: 0, abandon: false,
  };
  const ball = { x: FW / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, hold: false, last: null, lastTeam: 0,
    passTo: null, passT: 0, shot: false, rot: 0, spin: 0, spinT: 0, inNet: false, imm: 0 };
  const players = [];
  for (let t = 0; t < 2; t++) {
    F.form.forEach(([u, v, role, num], i) => {
      players.push({ team: t, i, role, num, bu: u, bv: v, x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0, face: 0, run: 0,
        st: 'ok', stT: 0, kickCD: 0, saveCD: 0, thinkT: rand(0.5), tx: 0, ty: 0, charge: 0, charging: false,
        holdT: 0, dribA: 0, touched: false, diveDone: false, slideHit: false, skin: pick(SKINS), hair: pick(HAIRS),
        look: role === 'GK' ? GKL[t] : LOOKS[t], name: '', tookU: 0 });
    });
  }
  // nombres de los compañeros: ['Tadeo (9)', 'El Flaco Ojeda (arquero)', …]
  if (Array.isArray(opts.companeros)) {
    const mine = players.filter(p => p.team === 0), field = mine.filter(p => p.role !== 'GK');
    for (const s of opts.companeros) {
      const nm = String(s).replace(/\s*\(.*?\)\s*/g, ' ').trim(), num = String(s).match(/\((\d+)\)/);
      const p = /arquero|arco/i.test(s) && !mine[0].name ? mine[0] : field.find(q => !q.name);
      if (!p) continue;
      p.name = nm; if (num) p.num = +num[1];
    }
  }
  // el referí (no toca la pelota; corre cerca de la jugada)
  const REF = { team: -1, i: 9, role: 'REF', x: FW / 2, y: CY - 40, vx: 0, vy: 0, face: 0, run: 0, st: 'ok', skin: pick(SKINS), hair: '#101010',
    look: { shirt: '#181818', alt: '#181818', pat: 'solid', shorts: '#181818', socks: '#181818' } };
  for (let i = 0; i < RECN; i++) M.rec.push(new Float32Array(3 + players.length * 5));
  const team = t => players.filter(p => p.team === t);
  const gkOf = t => players.find(p => p.team === t && p.role === 'GK');
  const difOf = t => (t === 1 ? DIF : 5);
  const isHuman = p => !DEMO && p === M.ctrl;
  const ownGoalX = t => (M.side[t] === 1 ? 0 : FW);
  const oppGoalX = t => (M.side[t] === 1 ? FW : 0);
  const toU = (t, x) => (M.side[t] === 1 ? x / FW : 1 - x / FW);
  const fromU = (t, u) => (M.side[t] === 1 ? u * FW : FW - u * FW);
  const inBox = (t, x, y) => { const gx = ownGoalX(t); return Math.abs(x - gx) < AD && Math.abs(y - CY) < AW / 2; };
  const speedOf = p => {
    let s = p.team === 1 ? 84 + DIF * 3.2 : 100;
    if (p.role === 'GK') s *= 0.9;
    if (isHuman(p)) s *= 1.05;
    return s;
  };

  // ---------------------------------------------------------- entrada
  const keys = {}, hit = {};
  const IN = { x: 0, y: 0, kick: false, kickP: false, passP: false, tackleP: false, swP: false, okP: false };
  const down = k => KEYS[k].some(c => keys[c]);
  const was = k => KEYS[k].some(c => hit[c]);
  function onKey(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.type === 'keydown') {
      AU.init();
      if (!keys[e.code]) hit[e.code] = true;
      keys[e.code] = true;
    } else keys[e.code] = false;
  }
  function onBlur() { for (const k in keys) keys[k] = false; if (['play', 'restart', 'kickoff', 'dead'].includes(M.phase)) M.paused = true; }
  function readInput() {
    if (M.forceInput) { Object.assign(IN, M.forceInput); return; }
    IN.x = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    IN.y = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    IN.kick = down('kick'); IN.kickP = was('kick'); IN.passP = was('pass'); IN.tackleP = was('tackle');
    IN.swP = was('sw'); IN.okP = was('ok');
  }

  // ---------------------------------------------------------- mensajes y jugo
  function big(text, dur = 2.2, col = '#ffe040', size = 16) { M.big = { text, t: 0, dur, col, size }; }
  function label(text, dur = 1.6) { M.label = { text, t: 0, dur }; }
  function shake(a) { M.shake = Math.max(M.shake, a); }
  function grass(x, y, n, sp = 60) {
    for (let i = 0; i < n; i++) M.parts.push({ x, y, z: 1, vx: rand(-sp, sp), vy: rand(-sp, sp), vz: rand(20, 90), life: rand(0.3, 0.7), col: pick(['#2a8a34', '#56c060', '#3aa346', '#8ad070']) });
  }
  function confetti(cols) {
    for (let i = 0; i < 160; i++) M.conf.push({ x: rand(VW), y: rand(-VH, 0), vy: rand(25, 60), ph: rand(TAU), life: rand(3, 5.5), col: pick(cols), w: Math.random() < 0.5 ? 2 : 1 });
  }

  // ---------------------------------------------------------- formaciones y saque del medio
  function formPos(p, mode) {
    const bu = toU(p.team, ball.x), bv = ball.y / FH;
    let u = p.bu, v = p.bv;
    if (mode === 'att') u += 0.2 + (bu - 0.5) * 0.35;
    else if (mode === 'def') u += -0.05 + (bu - 0.5) * 0.45;
    else u += 0.08 + (bu - 0.5) * 0.4;
    v += (bv - 0.5) * (mode === 'def' ? 0.45 : 0.3);
    if (mode === 'def') u = Math.min(u, bu + 0.02);  // no quedarse atrás de la pelota… pero sí entre la pelota y el arco
    u = clamp(u, 0.06, mode === 'att' ? 0.9 : 0.82); v = clamp(v, 0.06, 0.94);
    return [fromU(p.team, u), v * FH];
  }
  function setupKickoff(t) {
    M.phase = 'kickoff'; M.pt = 0; M.kickTeam = t; M.restart = null; M.pending = null;
    Object.assign(ball, { x: FW / 2, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, hold: false, passTo: null, shot: false, inNet: false, spinT: 0 });
    for (const p of players) {
      const u = Math.min(p.bu * 0.92, 0.44);
      p.x = fromU(p.team, u); p.y = p.bv * FH; p.vx = p.vy = p.dvx = p.dvy = 0;
      p.st = 'ok'; p.stT = 0; p.kickCD = 0; p.charge = 0; p.charging = false; p.holdT = 0; p.diveDone = false;
      p.face = M.side[p.team] === 1 ? 0 : Math.PI;
      if (p.team !== t && hyp(p.x - FW / 2, p.y - CY) < CR + 6) p.x = fromU(p.team, 0.5 - (CR + 8) / FW);
    }
    const tk = team(t).find(p => p.role === 'FWD') || team(t)[1];
    tk.x = FW / 2 - M.side[t] * 5; tk.y = CY;
    const mate = team(t).filter(p => p.role === 'MID')[0];
    if (mate) { mate.x = FW / 2 - M.side[t] * 16; mate.y = CY + 22; }
    take(tk, true);
    M.kicker = tk;
    if (!DEMO) M.ctrl = t === 0 ? tk : nearestTo(team(0).filter(p => p.role !== 'GK'), ball.x, ball.y);
    label(t === 0 ? 'Saca HURACÁN' : `Saca ${RIVAL.toUpperCase()}`, 1.4);
  }
  function nearestTo(list, x, y) { let b = null, bd = 1e9; for (const p of list) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return b; }

  // ---------------------------------------------------------- pelota: control, patadas y pases
  function take(p, quiet) {
    ball.owner = p; ball.vx = ball.vy = ball.vz = 0; ball.z = 0; ball.passTo = null; ball.shot = false; ball.spinT = 0;
    ball.last = p; ball.lastTeam = p.team; ball.hold = false;
    if (!quiet) AU.touch();
    if (p.team === 0 && !DEMO && p.role !== 'GK') setCtrl(p);
  }
  function release(p) { if (ball.owner === p) { ball.owner = null; ball.hold = false; } }
  function setCtrl(p) { if (DEMO || M.ctrl === p) return; if (M.ctrl) { M.ctrl.charge = 0; M.ctrl.charging = false; } M.ctrl = p; M.switchT = 0; }
  function kickBall(p, ang, spd, vz, kind) {
    release(p);
    ball.x = p.x + Math.cos(ang) * 5; ball.y = p.y + Math.sin(ang) * 5;
    ball.vx = Math.cos(ang) * spd + p.vx * 0.2; ball.vy = Math.sin(ang) * spd + p.vy * 0.2; ball.vz = vz; ball.z = Math.max(ball.z, 1);
    ball.last = p; ball.lastTeam = p.team; ball.passTo = null; ball.shot = kind === 'shot'; ball.spinT = kind === 'shot' ? 0.4 : 0;
    ball.kicker = p; ball.kickDir = ang;
    p.kickCD = 0.3; p.st = 'kick'; p.stT = 0.16; p.face = ang;
    const pw = clamp(spd / 420, 0, 1);
    AU.kick(pw); grass(ball.x, ball.y, 3 + pw * 6 | 0, 40 + pw * 60);
    if (pw > 0.7) shake(pw * 3);
  }
  function shoot(p, ang, power) {
    const spd = 160 + 260 * power, vz = power > 0.8 ? (power - 0.8) * 400 : 8 + power * 18;
    kickBall(p, ang, spd, vz, 'shot');
  }
  // ayuda para apuntar: si el tiro va más o menos al arco, lo corrige un poco hacia adentro
  function aimAssist(p, ang) {
    const gx = oppGoalX(p.team), dx = gx - p.x;
    if (Math.sign(dx) !== Math.sign(Math.cos(ang)) || Math.abs(dx) > FW * 0.5 || Math.abs(Math.cos(ang)) < 0.2) return ang;
    const yHit = p.y + Math.tan(ang) * dx;
    if (Math.abs(yHit - CY) > GW / 2 + 26) return ang;
    const ty = clamp(yHit, CY - GW / 2 + 4, CY + GW / 2 - 4);
    const a2 = Math.atan2(ty - p.y, dx);
    return ang + angDiff(ang, a2) * 0.7;
  }
  function laneClear(ax, ay, bx, by, t) {
    let m = 40; const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    for (const q of players) {
      if (q.team === t) continue;
      const s = clamp(((q.x - ax) * dx + (q.y - ay) * dy) / L2, 0, 1);
      m = Math.min(m, hyp(ax + dx * s - q.x, ay + dy * s - q.y));
    }
    return m;
  }
  function bestPassTarget(p, ang, human) {
    let best = null, bs = -1e9;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (const q of players) {
      if (q.team !== p.team || q === p || q.st === 'down') continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy);
      if (d < 16) continue;
      const cos = (dx * ca + dy * sa) / d;
      if (human && cos < 0.25) continue;
      const lane = laneClear(p.x, p.y, q.x, q.y, p.team);
      const fwd = (q.x - p.x) * M.side[p.team] / FW;
      let s = (human ? cos * 90 : cos * 10) - Math.abs(d - 110) * 0.12 + Math.min(lane, 30) * 1.3 + fwd * 45;
      if (q.role === 'GK') s -= human ? 40 : 90;
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }
  function passTo(p, q) {
    const d0 = hyp(q.x - p.x, q.y - p.y), lead = d0 / 240;
    const tx = clamp(q.x + q.vx * lead * 0.9, -4, FW + 4), ty = clamp(q.y + q.vy * lead * 0.9, 2, FH - 2);
    const d = hyp(tx - p.x, ty - p.y), ang = Math.atan2(ty - p.y, tx - p.x);
    if (d > 150 || laneClear(p.x, p.y, tx, ty, p.team) < 7) {   // pelotazo por arriba
      const vz = clamp(70 + d * 0.25, 80, 150), T = 2 * vz / GRAV;
      kickBall(p, ang, (d / T) * 0.82, vz, 'pass');
    } else kickBall(p, ang, d * FR_LIN + 115, 0, 'pass');
    ball.passTo = q; ball.passT = 2.2;
    if (q.team === 0 && !DEMO) setCtrl(q);
  }
  function doPass(p, ang, human) {
    const q = bestPassTarget(p, ang, human);
    if (q) passTo(p, q); else kickBall(p, ang, 190, 0, 'pass');
  }
  function startSlide(p, ang) {
    if (p.st !== 'ok' && p.st !== 'kick') return;
    p.st = 'slide'; p.stT = 0.42; p.face = ang; p.slideHit = false; p.touched = false;
    p.vx = Math.cos(ang) * 175; p.vy = Math.sin(ang) * 175;
    AU.slide(); grass(p.x, p.y, 5, 40);
  }
  function knockDown(p, t = 0.8) {
    release(p); p.st = 'down'; p.stT = t; p.charge = 0; p.charging = false;
  }

  // ---------------------------------------------------------- IA
  function predict(t) {
    if (ball.owner) return [ball.owner.x + ball.owner.vx * t, ball.owner.y + ball.owner.vy * t];
    const f = (1 - Math.exp(-FR_LIN * t)) / FR_LIN;
    return [ball.x + ball.vx * f, ball.y + ball.vy * f];
  }
  function interceptT(p) {
    const sp = speedOf(p);
    for (let t = 0; t <= 2.4; t += 0.1) {
      const [x, y] = predict(t);
      if (hyp(x - p.x, y - p.y) <= sp * t + 6) return t;
    }
    return 2.5 + hyp(ball.x - p.x, ball.y - p.y) / sp;
  }
  function interceptPt(p) { const t = interceptT(p); return predict(Math.min(t, 2.4)); }
  function nearestOpp(p) {
    let b = null, bd = 1e9;
    for (const q of players) if (q.team !== p.team && q.st !== 'down') { const d = hyp(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; b = q; } }
    return [b, bd];
  }
  // reparto de tareas por equipo: quién va a buscar la pelota, quién presiona y quién cubre
  const roles = [{}, {}];
  function assignRoles() {
    for (let t = 0; t < 2; t++) {
      const R = roles[t]; R.chase = R.chase2 = R.press = R.cover = null;
      const field = players.filter(p => p.team === t && p.role !== 'GK' && p.st !== 'down' && !isHuman(p));
      if (!field.length) continue;
      const ts = field.map(p => [p, interceptT(p)]).sort((a, b) => a[1] - b[1]);
      const humanHere = !DEMO && t === 0 && M.ctrl;
      if (!ball.owner) {
        if (!humanHere || ts[0][1] + 0.4 < interceptT(M.ctrl)) R.chase = ts[0][0];
        if (difOf(t) >= 6 && ts[1] && !humanHere) R.chase2 = ts[1][0];
      } else if (ball.owner.team !== t) {
        if (!humanHere) R.press = ts[0][0];
        const own = [ownGoalX(t), CY];
        const cands = field.filter(p => p !== R.press);
        R.cover = nearestTo(cands, (ball.x + own[0]) / 2, (ball.y + own[1]) / 2);
        if (difOf(t) >= 7 && ts[1] && ts[1][0] !== R.cover && !humanHere) R.chase2 = ts[1][0];
      }
    }
  }
  function steer(p, tx, ty, f = 1) {
    const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
    if (d < 1.5) { p.dvx = p.dvy = 0; return; }
    const s = speedOf(p) * f * Math.min(1, d / 22);
    p.dvx = dx / d * s; p.dvy = dy / d * s;
  }
  function aiPlayer(p, dt) {
    if (p.st !== 'ok' && p.st !== 'kick') return;
    if (p.role === 'GK') return gkAI(p, dt);
    if (ball.owner === p) return carrierAI(p, dt);
    const t = p.team, R = roles[t], o = ball.owner;
    if (o && o.team === t) {          // tenemos la pelota: desmarcarse
      p.thinkT -= dt;
      if (p.thinkT <= 0) {
        p.thinkT = rand(0.45, 0.9);
        const [bx, by] = formPos(p, 'att');
        let best = [bx, by], bs = -1e9;
        for (let k = -1; k < 8; k++) {
          const a = k * TAU / 8 + rand(0.3), r = k < 0 ? 0 : rand(18, 36);
          const cx = clamp(bx + Math.cos(a) * r, 8, FW - 8), cy = clamp(by + Math.sin(a) * r, 8, FH - 8);
          let md = 45; for (const q of players) if (q.team !== t) md = Math.min(md, hyp(q.x - cx, q.y - cy));
          const s = md + Math.min(laneClear(o.x, o.y, cx, cy, t), 30) * 0.8 + toU(t, cx) * 30 - hyp(cx - bx, cy - by) * 0.25;
          if (s > bs) { bs = s; best = [cx, cy]; }
        }
        p.tx = best[0]; p.ty = best[1];
      }
      steer(p, p.tx, p.ty, 0.95);
    } else if (o) {                    // la tienen ellos
      const d = difOf(t);
      if (p === R.press || p === R.chase2) {
        const gx = ownGoalX(t);
        const tx = o.x + o.vx * 0.18 + Math.sign(gx - o.x) * 3, ty = o.y + o.vy * 0.18;
        steer(p, tx, ty, p === R.press ? 0.92 + d * 0.012 : 0.85);
        const dd = hyp(o.x - p.x, o.y - p.y);
        const rate = t === 1 ? 0.2 + d * 0.11 : 0.45;
        if (dd < 22 && dd > 8 && Math.random() < rate * dt) startSlide(p, Math.atan2(ball.y - p.y, ball.x - p.x));
      } else if (p === R.cover) {
        const gx = ownGoalX(t);
        steer(p, lerp(o.x, gx, 0.42), lerp(o.y, CY, 0.4), 0.9);
      } else { const [x, y] = formPos(p, 'def'); steer(p, x, y, 0.85); }
    } else {                           // pelota suelta
      if (p === R.chase || p === R.chase2) { const [x, y] = interceptPt(p); steer(p, x, y, 1); }
      else { const [x, y] = formPos(p, 'free'); steer(p, x, y, 0.85); }
    }
  }
  function aiShoot(p) {
    const t = p.team, d = difOf(t), gx = oppGoalX(t), gk = gkOf(1 - t);
    const side = gk && gk.y > CY ? -1 : 1;
    let ty = CY + side * (GW / 2 - 5) * rand(0.5, 1);
    ty += (1 - d / 11) * rand(-1, 1) * GW * 0.55;
    shoot(p, Math.atan2(ty - p.y, gx - p.x), rand(0.68, 0.98));
  }
  function carrierAI(p, dt) {
    const t = p.team, d = difOf(t), gx = oppGoalX(t);
    const dg = hyp(gx - p.x, CY - p.y), [, nd] = nearestOpp(p);
    p.thinkT -= dt;
    if (p.thinkT <= 0) {
      p.thinkT = 0.16 + (10 - d) * 0.025 + rand(0.15);
      const range = (70 + d * 7) * FW / 440;
      if (dg < range && Math.abs(CY - p.y) < dg * 0.85 && Math.random() < 0.5 + d * 0.04) { aiShoot(p); return; }
      if (nd < 17 && Math.random() < 0.42 + d * 0.03) { const q = bestPassTarget(p, p.face, false); if (q) { passTo(p, q); return; } }
      if (Math.random() < 0.08 + d * 0.008) {
        const q = bestPassTarget(p, p.face, false);
        if (q && toU(t, q.x) > toU(t, p.x) + 0.08 && laneClear(p.x, p.y, q.x, q.y, t) > 12) { passTo(p, q); return; }
      }
      const ga = Math.atan2(CY - p.y, gx - p.x);
      let best = ga, bs = -1e9;
      for (let k = -4; k <= 4; k++) {
        const a = ga + k * 0.32, rx = p.x + Math.cos(a) * 20, ry = p.y + Math.sin(a) * 20;
        let s = Math.cos(a - ga) * 1.2;
        for (const q of players) if (q.team !== t) { const dd = hyp(q.x - rx, q.y - ry); if (dd < 18) s -= (18 - dd) / 18 * 1.6; }
        if (ry < 6 || ry > FH - 6 || rx < 4 || rx > FW - 4) s -= 2;
        if (s > bs) { bs = s; best = a; }
      }
      p.dribA = best;
    }
    p.face += clamp(angDiff(p.face, p.dribA), -7 * dt, 7 * dt);
    const s = speedOf(p) * 0.9;
    p.dvx = Math.cos(p.face) * s; p.dvy = Math.sin(p.face) * s;
  }
  function gkDistribute(p) {
    const q = bestPassTarget(p, M.side[p.team] === 1 ? 0 : Math.PI, false);
    if (q && Math.random() < 0.6) passTo(p, q);
    else {   // reventarla para adelante
      const a = (M.side[p.team] === 1 ? 0 : Math.PI) + rand(-0.4, 0.4);
      kickBall(p, a, rand(230, 290), rand(110, 150), 'pass');
    }
  }
  function gkAI(p, dt) {
    const t = p.team, sd = M.side[t], gx = ownGoalX(t);
    if (ball.owner === p) {
      p.dvx = p.dvy = 0; p.face = sd === 1 ? 0 : Math.PI; p.holdT += dt;
      if (M.phase === 'play' && p.holdT > (isHuman(p) ? 3.5 : 1.1)) gkDistribute(p);
      return;
    }
    let tx = gx + sd * 7, ty = CY + clamp((ball.y - CY) * 0.4, -GW / 2 + 3, GW / 2 - 3);
    const bd = hyp(ball.x - gx, ball.y - CY);
    if (bd < FW * 0.35) tx = gx + sd * Math.min(22, 7 + (FW * 0.35 - bd) * 0.12);
    const vxTo = -sd * ball.vx;   // > 0 si la pelota viene hacia nuestro arco
    if (!ball.owner && vxTo > 50) {
      const tHit = (p.x - ball.x) / ball.vx;
      if (tHit > 0 && tHit < 1.4) {
        const yHit = ball.y + ball.vy * tHit;
        if (Math.abs(yHit - CY) < GW / 2 + 14) {
          ty = clamp(yHit, CY - GW / 2 - 3, CY + GW / 2 + 3); tx = p.x;
          const react = t === 1 ? 0.25 + DIF * 0.02 : 0.38;
          if (Math.abs(ty - p.y) > 7 && tHit < react && !p.diveDone && ball.shot) {
            p.diveDone = true; p.st = 'dive'; p.stT = 0.42; p.vy = Math.sign(ty - p.y) * 150; p.vx = 0;
            p.face = Math.sign(ty - p.y) * Math.PI / 2; return;
          }
        }
      }
    } else p.diveDone = false;
    if (!ball.owner && inBox(t, ball.x, ball.y) && ball.z < 12) {
      const my = interceptT(p); let ob = 9;
      for (const q of players) if (q.team !== t) ob = Math.min(ob, interceptT(q));
      if (my < ob + 0.2 || hyp(ball.vx, ball.vy) < 40) { [tx, ty] = interceptPt(p); }
    }
    const o = ball.owner;
    if (o && o.team !== t && inBox(t, o.x, o.y) && hyp(o.x - p.x, o.y - p.y) < 45) { tx = o.x; ty = o.y; }
    tx = sd === 1 ? clamp(tx, 2, AD - 4) : clamp(tx, FW - AD + 4, FW - 2);
    ty = clamp(ty, CY - AW / 2 + 4, CY + AW / 2 - 4);
    steer(p, tx, ty, 1);
  }

  // ---------------------------------------------------------- control del jugador humano
  function humanControl(p, dt) {
    let ix = IN.x, iy = IN.y; const mag = hyp(ix, iy);
    if (mag > 0) { ix /= mag; iy /= mag; }
    const owner = ball.owner === p;
    const ok = p.st === 'ok' || p.st === 'kick';
    if (mag > 0 && ok) p.face = Math.atan2(iy, ix);
    // patear: mantener para cargar, soltar para patear
    if (IN.kick && ok) {
      if (p.charging || IN.kickP) { p.charging = true; p.charge = Math.min(1, p.charge + dt / 0.7); }
    } else if (p.charging) {
      const pw = 0.25 + 0.75 * p.charge; p.charging = false; p.charge = 0;
      if (owner) {
        if (p.role === 'GK' && ball.hold) kickBall(p, p.face, 200 + pw * 110, 100 + pw * 60, 'pass');
        else shoot(p, aimAssist(p, p.face), pw);
      } else if (!ball.owner && hyp(ball.x - p.x, ball.y - p.y) < 13 && ball.z < 12 && p.kickCD <= 0) {
        shoot(p, aimAssist(p, p.face), pw);   // de volea / de primera
      }
    }
    if (IN.passP) {
      if (owner && ok) doPass(p, p.face, true);
      else manualSwitch();
    }
    if (IN.tackleP && !owner && ok) startSlide(p, p.face);
    if (IN.swP && !owner) manualSwitch();
    if (!ok) return;
    if (owner && p.role === 'GK' && ball.hold) { p.dvx = p.dvy = 0; return; }
    if (mag > 0) { const s = speedOf(p) * (owner ? 0.92 : 1); p.dvx = ix * s; p.dvy = iy * s; }
    else if (ball.passTo === p && !ball.owner) { const [x, y] = interceptPt(p); steer(p, x, y, 1); }   // ayudita: ir a buscar el pase
    else { p.dvx = p.dvy = 0; }
  }
  function manualSwitch() {
    if (DEMO) return;
    const c = players.filter(p => p.team === 0 && p.role !== 'GK' && p !== M.ctrl && p.st !== 'down');
    let b = null, bt = 1e9;
    for (const p of c) { const t = interceptT(p); if (t < bt) { bt = t; b = p; } }
    if (b) setCtrl(b);
  }
  function autoSwitch(dt) {
    if (DEMO) return;
    M.switchT += dt;
    const o = ball.owner;
    if (o && o.team === 0) { if (M.ctrl !== o) setCtrl(o); return; }
    if (!o && ball.passTo && ball.passTo.team === 0) { if (M.ctrl !== ball.passTo) setCtrl(ball.passTo); return; }
    const cur = M.ctrl;
    if (cur && cur.charging) return;
    if (M.switchT < 0.35 && cur && cur.role !== 'GK') return;
    let b = null, bt = 1e9;
    for (const p of players) if (p.team === 0 && p.role !== 'GK' && p.st !== 'down') { const t = interceptT(p); if (t < bt) { bt = t; b = p; } }
    if (!b) return;
    if (!cur || cur.role === 'GK' || cur.st === 'down' || (b !== cur && bt + 0.22 < interceptT(cur))) setCtrl(b);
  }

  // ---------------------------------------------------------- física de jugadores
  function updatePlayers(dt) {
    for (const p of players) {
      p.kickCD -= dt; p.saveCD -= dt;
      if (p.stT > 0) p.stT -= dt;
      if (p.st === 'slide') {
        const k = Math.exp(-2.6 * dt); p.vx *= k; p.vy *= k;
        if (p.stT <= 0) { p.st = 'down'; p.stT = 0.3; }
      } else if (p.st === 'down') {
        const k = Math.exp(-9 * dt); p.vx *= k; p.vy *= k;
        if (p.stT <= 0) p.st = 'ok';
      } else if (p.st === 'dive') {
        const k = Math.exp(-2.5 * dt); p.vx *= k; p.vy *= k;
        if (p.stT <= 0) { p.st = 'down'; p.stT = 0.4; }
      } else {
        if (p.st === 'kick' && p.stT <= 0) p.st = 'ok';
        const acc = (ball.owner === p ? 520 : 680) * (p.st === 'celebrate' ? 0.6 : 1);
        const ex = p.dvx - p.vx, ey = p.dvy - p.vy, e = hyp(ex, ey), m = acc * dt;
        if (e <= m) { p.vx = p.dvx; p.vy = p.dvy; } else { p.vx += ex / e * m; p.vy += ey / e * m; }
        if (!isHuman(p) && ball.owner !== p && hyp(p.vx, p.vy) > 12) p.face = Math.atan2(p.vy, p.vx);
        if (!isHuman(p) && ball.owner !== p && hyp(p.vx, p.vy) <= 12 && p.st === 'ok') {   // quieto: mirar la pelota
          p.face += clamp(angDiff(p.face, Math.atan2(ball.y - p.y, ball.x - p.x)), -6 * dt, 6 * dt);
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.run += hyp(p.vx, p.vy) * dt;
      // separación entre jugadores para que no se encimen
      for (const q of players) {
        if (q === p || q.st === 'down') continue;
        const dx = p.x - q.x, dy = p.y - q.y, d = hyp(dx, dy);
        if (d < 6 && d > 0.01) { const f = (6 - d) * 0.5; p.x += dx / d * f; p.y += dy / d * f; }
      }
      p.x = clamp(p.x, -RUN + 3, FW + RUN - 3); p.y = clamp(p.y, -RUN + 4, FH + RUN - 3);
      if (p.role === 'GK' && M.phase === 'play') {   // el arquero no se mete adentro del arco
        if (p.x < 1) p.x = 1; if (p.x > FW - 1) p.x = FW - 1;
      }
    }
  }

  // ---------------------------------------------------------- física de la pelota
  function updateBall(dt) {
    ball.passT -= dt; if (ball.passT <= 0) ball.passTo = null;
    if (ball.imm > 0) ball.imm -= dt;
    const o = ball.owner;
    if (o) {
      if (ball.hold) {   // en las manos (arquero) o arriba de la cabeza (lateral)
        const r = o.role === 'GK' ? 3 : 1;
        ball.x = o.x + Math.cos(o.face) * r; ball.y = o.y + Math.sin(o.face) * r + 0.5; ball.z = o.role === 'GK' ? 7 : 13;
      } else {
        const r = 5.2 + Math.sin(o.run * 0.45) * 1.3;
        const tx = o.x + Math.cos(o.face) * r, ty = o.y + Math.sin(o.face) * r, k = Math.min(1, dt * 18);
        const nx = ball.x + (tx - ball.x) * k, ny = ball.y + (ty - ball.y) * k;
        ball.vx = (nx - ball.x) / dt; ball.vy = (ny - ball.y) / dt; ball.x = nx; ball.y = ny; ball.z = 0; ball.vz = 0;
      }
      ball.rot += hyp(o.vx, o.vy) * dt * 0.25;
      return;
    }
    // efecto (comba) del remate: mientras dura, la tecla de costado tuerce la pelota
    if (ball.spinT > 0) {
      ball.spinT -= dt;
      if (ball.kicker && isHuman(ball.kicker)) {
        const a = ball.kickDir, px = -Math.sin(a), py = Math.cos(a);
        const side = IN.x * px + IN.y * py;
        ball.vx += px * side * 260 * dt; ball.vy += py * side * 260 * dt;
      }
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
    if (ball.z > 0 || ball.vz > 0) { ball.vz -= GRAV * dt; const k = Math.exp(-0.12 * dt); ball.vx *= k; ball.vy *= k; }
    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -45) { AU.bounce(-ball.vz); ball.vz = -ball.vz * 0.45; } else ball.vz = 0;
      if (ball.vz === 0) {
        const s = hyp(ball.vx, ball.vy);
        if (s > 0.01) { const ns = Math.max(0, s * Math.exp(-FR_LIN * dt) - FR_CONST * dt); ball.vx *= ns / s; ball.vy *= ns / s; }
      }
    }
    ball.rot += hyp(ball.vx, ball.vy) * dt * 0.25;
    // palos y travesaño
    for (const gx of [0, FW]) {
      for (const py of [CY - GW / 2, CY + GW / 2]) {
        if (ball.z > GH + 1) continue;
        const dx = ball.x - gx, dy = ball.y - py, d = hyp(dx, dy);
        if (d < 2.6 && d > 0.001) {
          const nx = dx / d, ny = dy / d, vn = ball.vx * nx + ball.vy * ny;
          if (vn < 0) { ball.vx -= 1.75 * vn * nx; ball.vy -= 1.75 * vn * ny; AU.post(); shake(2); if (ball.shot) uuh(); }
          ball.x = gx + nx * 2.7; ball.y = py + ny * 2.7;
        }
      }
      if (Math.abs(ball.y - CY) < GW / 2 && Math.abs(ball.x - gx) < 2.5 && Math.abs(ball.z - GH) < 2.2 && !ball.inNet) {
        if ((ball.x - gx) * ball.vx < 0 || Math.abs(ball.x - gx) < 1.5) {
          ball.vx = -ball.vx * 0.5; ball.vz = ball.z > GH ? Math.abs(ball.vz) * 0.5 + 20 : -Math.abs(ball.vz) * 0.5;
          ball.x = gx + Math.sign(ball.vx || 1) * 2.6; AU.post(); shake(2); if (ball.shot) uuh();
        }
      }
    }
    // adentro del arco: la red frena la pelota
    if (ball.inNet) {
      const back = ball.x < FW / 2 ? -GD + 2 : FW + GD - 2;
      if ((ball.x < FW / 2 && ball.x < back) || (ball.x > FW / 2 && ball.x > back)) { ball.x = back; ball.vx *= -0.15; ball.vy *= 0.5; }
      ball.y = clamp(ball.y, CY - GW / 2 + 2, CY + GW / 2 - 2);
      if (ball.z > GH - 2) { ball.z = GH - 2; ball.vz = -Math.abs(ball.vz) * 0.3; }
      ball.vx *= Math.exp(-3 * dt); ball.vy *= Math.exp(-3 * dt);
    }
  }
  let uuhT = 0;
  function uuh() { if (uuhT > 0) return; uuhT = 1.5; AU.roar(0.22, 1.4, 380); M.excite = 1; }

  // ---------------------------------------------------------- contactos con la pelota
  function interactions(dt) {
    const o = ball.owner;
    if (o) {
      if (ball.hold) return;   // en las manos del arquero o en un lateral: no se la pueden sacar
      for (const p of players) {
        if (p.team === o.team || (p.st !== 'ok' && p.st !== 'kick' && p.st !== 'slide')) continue;
        const d = hyp(p.x - ball.x, p.y - ball.y);
        if (p.st === 'slide') { if (d < 8) slideBall(p); continue; }
        if (d < 6.5) {
          let rate;
          if (p.team === 0) rate = isHuman(p) ? 4.2 - DIF * 0.2 : 1.8;
          else rate = isHuman(o) ? 1.0 + DIF * 0.35 : 2.2;
          if (Math.random() < rate * dt) {
            if (Math.random() < 0.55) take(p);
            else { release(o); const a = Math.atan2(ball.y - p.y, ball.x - p.x) + rand(-0.8, 0.8); ball.vx = Math.cos(a) * 90; ball.vy = Math.sin(a) * 90; ball.last = p; ball.lastTeam = p.team; AU.touch(); }
            o.kickCD = 0.35;
            return;
          }
        }
      }
      return;
    }
    if (ball.imm > 0) return;
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.kickCD > 0 || p.st === 'down' || p.st === 'celebrate') continue;
      const d = hyp(p.x - ball.x, p.y - ball.y);
      if (p.st === 'slide') { if (d < 8 && ball.z < 6) { slideBall(p); return; } continue; }
      if (p.role === 'GK' && p.saveCD <= 0 && inBox(p.team, p.x, p.y)) {
        const reach = p.st === 'dive' ? 13 : 8.5;
        if (d < reach && ball.z < 20) { gkTouch(p); return; }
        continue;
      }
      if (d < 6.5 && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    const p = best;
    if (ball.z < 7) {
      const rel = hyp(ball.vx - p.vx, ball.vy - p.vy);
      if (rel < 270 || Math.random() < 0.35) take(p);
      else {     // le pega en el cuerpo y rebota
        ball.vx = -ball.vx * 0.3 + p.vx * 0.6 + rand(-40, 40); ball.vy = -ball.vy * 0.3 + p.vy * 0.6 + rand(-40, 40);
        ball.last = p; ball.lastTeam = p.team; ball.passTo = null; ball.shot = false; p.kickCD = 0.2; AU.touch();
      }
    } else if (ball.z < 17) {   // cabezazo
      const t = p.team, gx = oppGoalX(t);
      let a, s, vz;
      if (Math.abs(gx - p.x) < 120 * FW / 440) { a = Math.atan2(CY + rand(-GW / 2, GW / 2) * 0.8 - p.y, gx - p.x); s = 190; vz = rand(0, 30); }
      else { a = isHuman(p) && hyp(IN.x, IN.y) > 0 ? p.face : Math.atan2(CY - p.y, gx - p.x) + rand(-0.6, 0.6); s = 140; vz = 50; }
      ball.vx = Math.cos(a) * s; ball.vy = Math.sin(a) * s; ball.vz = vz; ball.last = p; ball.lastTeam = t; ball.passTo = null; ball.shot = s > 180;
      p.kickCD = 0.35; AU.kick(0.3); label('¡De cabeza!', 0.9);
    }
  }
  function slideBall(p) {
    if (p.touched) return;
    const o = ball.owner;
    if (o && o.team === p.team) return;
    p.touched = true;
    if (o) { knockDown(o, 0.8); o.kickCD = 0.5; }
    const a = p.face + rand(-0.3, 0.3);
    ball.owner = null; ball.hold = false;
    ball.vx = Math.cos(a) * 150 + p.vx * 0.3; ball.vy = Math.sin(a) * 150 + p.vy * 0.3; ball.vz = 20;
    ball.last = p; ball.lastTeam = p.team; ball.passTo = null; ball.shot = false;
    AU.kick(0.5); grass(ball.x, ball.y, 8, 70); shake(1.5);
  }
  function gkTouch(p) {
    const spd = hyp(ball.vx, ball.vy);
    const skill = p.team === 1 ? 0.42 + DIF * 0.045 : 0.66;
    const pc = clamp(skill - (spd - 160) / 650 - (p.st === 'dive' ? 0.1 : 0), 0.12, 0.97);
    const r = Math.random();
    if (r < pc || spd < 70) {
      take(p, true); ball.hold = true; p.holdT = 0; AU.thud();
      if (ball.shot || spd > 160) label('¡Atajó!', 1.0);
      if (p.team === 0 && !DEMO) setCtrl(p);
    } else if (r < pc + 0.33) {      // la saca con la mano: rebote
      const sd = M.side[p.team];
      ball.vx = sd * Math.abs(ball.vx) * rand(0.3, 0.5) + rand(-20, 20); ball.vy = ball.vy * 0.4 + rand(-90, 90); ball.vz = rand(30, 70);
      ball.last = p; ball.lastTeam = p.team; ball.shot = false; ball.passTo = null; p.saveCD = 0.35;
      AU.thud(); label('¡Qué tapada!', 1.0); shake(1.5);
    } else p.saveCD = 0.6;
  }
  // barrida que se lleva puesto al rival (sin tocar la pelota): falta
  function slideFouls() {
    for (const p of players) {
      if (p.st !== 'slide' || p.slideHit) continue;
      for (const q of players) {
        if (q.team === p.team || q.st === 'down' || q.st === 'dive') continue;
        if (hyp(q.x - p.x, q.y - p.y) < 7) {
          p.slideHit = true;
          const hadBall = ball.owner === q;
          knockDown(q, 0.9); AU.thud();
          if (!p.touched && (hadBall || Math.random() < 0.5) && M.phase === 'play') {
            const pen = inBox(p.team, q.x, q.y) && q.role !== 'GK';
            ballDead(pen ? 'penal' : 'falta', q.team, q.x, q.y, q);
            AU.whistle(0.45);
            return;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------- salidas, goles, saques
  function checkBall() {
    const o = ball.owner, bx = ball.x, by = ball.y;
    if (by < -3 || by > FH + 3) {
      const lt = o ? o.team : ball.lastTeam; release(o);
      ballDead('lateral', 1 - lt, clamp(bx, 6, FW - 6), by < 0 ? 0 : FH);
      return;
    }
    if (bx < -1 || bx > FW + 1) {
      const left = bx < 0;
      if (Math.abs(by - CY) < GW / 2 - 0.5 && ball.z < GH) {
        const scorer = M.side[0] === (left ? -1 : 1) ? 0 : 1;
        goal(scorer); return;
      }
      const lt = o ? o.team : ball.lastTeam; release(o);
      const def = M.side[0] === (left ? 1 : -1) ? 0 : 1;      // el equipo que defiende ese arco
      if (ball.shot && Math.abs(by - CY) < GW / 2 + 22) uuh();
      if (lt === def) ballDead('corner', 1 - def, left ? 0 : FW, by < CY ? 0 : FH);
      else ballDead('arco', def, left ? 0 : FW, CY);
    }
  }
  function ballDead(type, t, x, y, fouled) {
    M.phase = 'dead'; M.pt = 0; M.pending = { type, team: t, x, y, fouled };
    for (const p of players) { p.charge = 0; p.charging = false; }
    if (type !== 'falta' && type !== 'penal') AU.whistle(0.22);
    const names = { lateral: 'Lateral', corner: 'Córner', arco: 'Saque de arco', falta: '¡Falta!', penal: '¡PENAL!' };
    if (type === 'penal') big('¡PENAL!', 1.6, '#ff5050', 16); else label(names[type], 1.3);
  }
  function setupRestart() {
    const { type, team: t, fouled } = M.pending;
    let { x, y } = M.pending;
    const sd = M.side[t];
    const field = team(t).filter(p => p.role !== 'GK' && p.st !== 'down');
    let tk;
    if (type === 'arco') { tk = gkOf(t); x = ownGoalX(t) + sd * 18; y = CY; }
    else if (type === 'penal') {
      tk = (fouled && fouled.role !== 'GK') ? fouled : (team(t).find(p => p.role === 'FWD') || field[0]);
      x = oppGoalX(t) - sd * AD * 0.72; y = CY;
    } else if (type === 'falta') {
      tk = fouled && fouled.role !== 'GK' ? fouled : nearestTo(field, x, y);
      x = clamp(x, 6, FW - 6); y = clamp(y, 6, FH - 6);
    } else tk = nearestTo(field.length ? field : team(t), x, y);
    if (tk.st === 'down') tk.st = 'ok';
    let face;
    if (type === 'lateral') { tk.x = x; tk.y = y === 0 ? -3 : FH + 3; face = y === 0 ? Math.PI / 2 : -Math.PI / 2; }
    else if (type === 'corner') {
      const cx = x === 0 ? -3 : FW + 3, cy = y === 0 ? -3 : FH + 3; tk.x = cx; tk.y = cy;
      face = Math.atan2(CY - cy, (x === 0 ? AD * 0.7 : FW - AD * 0.7) - cx);
    } else {
      face = Math.atan2(CY - y, oppGoalX(t) - x);
      tk.x = x - Math.cos(face) * 5; tk.y = y - Math.sin(face) * 5;
    }
    tk.face = face; tk.vx = tk.vy = 0;
    Object.assign(ball, { x, y, z: 0, vx: 0, vy: 0, vz: 0, inNet: false, shot: false, passTo: null });
    take(tk, true); ball.hold = type === 'lateral';
    M.restart = { type, team: t, taker: tk, aiT: rand(0.8, 1.4) };
    if (type === 'penal') {  // todos afuera del área, el arquero en la línea
      for (const p of players) {
        if (p === tk) continue;
        if (p.role === 'GK' && p.team !== t) { p.x = oppGoalX(t) - sd * 2; p.y = CY; p.vx = p.vy = 0; p.st = 'ok'; continue; }
        if (p.role === 'GK') continue;
        if (inBox(1 - t, p.x, p.y) || hyp(p.x - x, p.y - y) < 30) { p.x = oppGoalX(t) - sd * (AD + rand(6, 30)); p.y = clamp(p.y, 10, FH - 10); }
      }
    }
    if (t === 0 && !DEMO) M.ctrl = tk;
    M.phase = 'restart'; M.pt = 0;
  }
  function executeRestart(kind, power) {  // kind: 'kick' | 'pass'
    const R = M.restart, tk = R.taker;
    ball.hold = false;
    if (R.type === 'lateral') {
      if (kind === 'pass') { const q = bestPassTarget(tk, tk.face, isHuman(tk)); if (q) { passTo(tk, q); ball.vz = 50; } else kickBall(tk, tk.face, 120, 50, 'pass'); }
      else kickBall(tk, tk.face, 110 + 120 * power, 50 + 40 * power, 'pass');
      ball.z = 12;
    } else if (kind === 'pass') doPass(tk, tk.face, isHuman(tk));
    else if (R.type === 'corner' && !isHuman(tk)) {   // centro al área
      const gx = oppGoalX(tk.team), tx = gx - M.side[tk.team] * rand(AD * 0.35, AD * 0.8), ty = CY + rand(-GW, GW) * 0.8;
      const d = hyp(tx - ball.x, ty - ball.y), vz = rand(95, 125), T = 2 * vz / GRAV;
      kickBall(tk, Math.atan2(ty - ball.y, tx - ball.x), d / T * 0.95, vz, 'pass');
    } else if (R.type === 'corner') {
      kickBall(tk, tk.face, 120 + 170 * power, 60 + 70 * power, 'pass');
    } else if (R.type === 'arco' && !isHuman(tk)) gkDistribute(tk);
    else shoot(tk, isHuman(tk) ? aimAssist(tk, tk.face) : tk.face, power);
    tk.kickCD = 0.35; M.restart = null; M.phase = 'play'; M.pt = 0;
    for (const p of players) p.diveDone = false;
  }
  function restartUpdate(dt) {
    const R = M.restart, tk = R.taker;
    tk.dvx = tk.dvy = 0; tk.vx = tk.vy = 0;
    // los demás se acomodan (los rivales a 25 px de la pelota)
    for (const p of players) {
      if (p === tk || isHuman(p)) continue;
      if (p.role === 'GK') { if (R.type === 'penal' && p.team !== R.team) { p.dvx = p.dvy = 0; } else gkAI(p, dt); continue; }
      let [x, y] = formPos(p, p.team === R.team ? 'att' : 'def');
      if (R.type === 'corner' || (R.type === 'falta' && Math.abs(oppGoalX(R.team) - ball.x) < FW * 0.3)) {
        const gx = oppGoalX(R.team);  // a cabecear / a defender el área
        x = gx - M.side[R.team] * rand(AD * 0.25, AD * 0.9) * (p.team === R.team ? 1 : 0.7); y = CY + (p.bv - 0.5) * GW * 2.2;
        if (p.tx && Math.abs(p.tx - x) < AD) { x = p.tx; y = p.ty; } else { p.tx = x; p.ty = y; }
      }
      if (p.team !== R.team) { const d = hyp(x - ball.x, y - ball.y); if (d < 26) { x = ball.x + (x - ball.x) / (d || 1) * 26; y = ball.y + (y - ball.y) / (d || 1) * 26; } }
      if (R.type === 'penal' && p.role !== 'GK') { const sd = M.side[R.team]; const lim = oppGoalX(R.team) - sd * (AD + 6); x = sd === 1 ? Math.min(x, lim) : Math.max(x, lim); }
      steer(p, x, y, 0.8);
    }
    if (isHuman(tk)) {
      if (hyp(IN.x, IN.y) > 0) {
        const a = Math.atan2(IN.y, IN.x);
        tk.face += clamp(angDiff(tk.face, a), -4 * dt, 4 * dt);
      }
      if (IN.kick) { if (tk.charging || IN.kickP) { tk.charging = true; tk.charge = Math.min(1, tk.charge + dt / 0.7); } }
      else if (tk.charging) { const pw = 0.25 + 0.75 * tk.charge; tk.charging = false; tk.charge = 0; executeRestart('kick', pw); return; }
      if (IN.passP) { executeRestart('pass', 0.5); return; }
      if (M.pt > 7) { executeRestart('pass', 0.5); return; }
    } else if (M.pt > R.aiT) {
      if (R.type === 'penal') {
        const gx = oppGoalX(tk.team), ty = CY + pick([-1, 1]) * rand(GW * 0.2, GW * 0.45) + rand(-1, 1) * (1 - difOf(tk.team) / 12) * 14;
        tk.face = Math.atan2(ty - tk.y, gx - tk.x); executeRestart('kick', rand(0.7, 0.95));
      } else if (R.type === 'falta' && hyp(oppGoalX(tk.team) - ball.x, CY - ball.y) < 140 * FW / 440) {
        const gk = gkOf(1 - tk.team), side = gk && gk.y > CY ? -1 : 1;
        tk.face = Math.atan2(CY + side * GW * 0.38 - tk.y, oppGoalX(tk.team) - tk.x); executeRestart('kick', rand(0.75, 0.95));
      } else if (R.type === 'corner') executeRestart('kick', 0.8);
      else if (R.type === 'arco') executeRestart('kick', 0.8);
      else executeRestart('pass', 0.5);
    }
    // arquero que ataja un penal: se tira para un lado
    if (R.type === 'penal') {
      const gk = gkOf(1 - R.team);
      gk.penalGuess = gk.penalGuess || (Math.random() < 0.5 ? -1 : 1);
    }
  }
  function goal(t) {
    M.score[t]++; M.phase = 'goal'; M.pt = 0; M.lastGoalTeam = t; ball.inNet = true; ball.owner = null; ball.hold = false;
    M.scorer = ball.last && ball.last.team === t ? ball.last : nearestTo(team(t).filter(p => p.role !== 'GK'), ball.x, ball.y);
    for (const p of players) { p.charge = 0; p.charging = false; }
    const local = t === 0;
    AU.whistle(0.2, 0.05); AU.roar(local ? 0.55 : 0.12, local ? 5 : 2, local ? 1300 : 420);
    if (local) { AU.voice(2.6); big(TX.gol, 3.2, '#ffe040', 24); confetti(['#e0202e', '#2040b0', '#f4f4f4', '#ffe040']); }
    else { big(TX.golRival, 3, '#f0f0f0', 8); confetti(LOOKS[1].fans); }
    if (ball.last && ball.last.team !== t) label('¡En contra!', 2);
    M.crowdMode = local ? 'L' : 'R'; M.crowdT = 5; shake(5); M.excite = 1;
  }
  function celebrate(dt) {
    const t = M.lastGoalTeam, sc = M.scorer;
    for (const p of players) {
      if (p.st === 'down' || p.st === 'dive' || p.st === 'slide') continue;
      if (p.team === t) {
        if (p === sc) {
          const cx = M.side[t] === 1 ? FW - 8 : 8, cy = p.y < CY ? 6 : FH - 6;
          steer(p, cx, cy, 1);
          if (hyp(cx - p.x, cy - p.y) < 10) p.st = 'celebrate';
        } else if (sc && p.role !== 'GK') { steer(p, sc.x + Math.cos(p.i * 1.7) * 10, sc.y + Math.sin(p.i * 1.7) * 8, 1); if (hyp(sc.x - p.x, sc.y - p.y) < 16) p.st = 'celebrate'; }
        else { p.dvx = p.dvy = 0; p.st = 'celebrate'; }
      } else { const [x, y] = formPos(p, 'def'); steer(p, x, y, 0.35); }
    }
  }

  // ---------------------------------------------------------- repetición
  const ST_CODE = { ok: 0, kick: 0, slide: 1, down: 2, dive: 3, celebrate: 4 }, CODE_ST = ['ok', 'slide', 'down', 'dive', 'celebrate'];
  function record() {
    const r = M.rec[M.recHead]; r[0] = ball.x; r[1] = ball.y; r[2] = ball.z;
    players.forEach((p, i) => { const o = 3 + i * 5; r[o] = p.x; r[o + 1] = p.y; r[o + 2] = p.face; r[o + 3] = p.run; r[o + 4] = ST_CODE[p.st] || 0; });
    M.recHead = (M.recHead + 1) % RECN; M.recCount = Math.min(RECN, M.recCount + 1);
  }
  function applyRec(i) {
    const n = M.recCount, idx = (M.recHead - n + Math.floor(i) + RECN * 2) % RECN, r = M.rec[idx];
    ball.x = r[0]; ball.y = r[1]; ball.z = r[2]; ball.owner = null;
    players.forEach((p, k) => { const o = 3 + k * 5; p.vx = (r[o] - p.x) * 60; p.vy = (r[o + 1] - p.y) * 60; p.x = r[o]; p.y = r[o + 1]; p.face = r[o + 2]; p.run = r[o + 3]; p.st = CODE_ST[r[o + 4]]; });
  }

  // ---------------------------------------------------------- reloj
  const halfLimit = () => (M.half === 3 ? Math.max(40, HALF * 0.6) : HALF + M.added[M.half - 1] / 45 * HALF);
  function shotInFlight() {
    if (ball.owner || hyp(ball.vx, ball.vy) < 140) return false;
    for (const gx of [0, FW]) if (Math.sign(gx - ball.x) === Math.sign(ball.vx) && Math.abs(gx - ball.x) < 160) return true;
    return false;
  }
  function tickClock(dt) {
    M.clock += dt;
    if (M.half < 3 && !M.addedShown && M.clock >= HALF) { M.addedShown = true; label(`Tiempo agregado: +${M.added[M.half - 1]}'`, 2.2); }
    if (M.clock >= halfLimit() && !shotInFlight() && M.phase !== 'goal') endHalf();
  }
  function endHalf() {
    for (const p of players) { p.charge = 0; p.charging = false; }
    if (M.half === 1) {
      AU.whistle(0.3); AU.whistle(0.6, 0.4);
      M.phase = 'half'; M.pt = 0; big(TX.entretiempo, 3.5, '#ffe040', 16);
    } else if (M.half === 2 && opts.necesitaGanar && M.score[0] === M.score[1]) {
      AU.whistle(0.3); AU.whistle(0.6, 0.4);
      M.phase = 'golden'; M.pt = 0; big('¡GOL DE ORO!', 3, '#ffe040', 16); label(TX.golDeOro, 3);
    } else finish();
  }
  function finish() {
    AU.whistle(0.3); AU.whistle(0.3, 0.4); AU.whistle(0.9, 0.8);
    const [a, b] = M.score;
    const ok = opts.necesitaGanar ? a > b : a >= b;
    M.result = { ok, golesJugador: a, golesRival: b };
    M.endMsg = a > b ? TX.ganaste : a < b ? TX.perdiste : TX.empate;
    if (a > b) { AU.roar(0.45, 4, 1100); confetti(['#e0202e', '#2040b0', '#f4f4f4']); M.crowdMode = 'L'; M.crowdT = 6; }
    M.phase = 'full'; M.pt = 0;
  }

  // ---------------------------------------------------------- paso de simulación
  function update(dt) {
    readInput();
    if (was('mute')) AU.toggle();
    if (M.paused) {
      if (was('pause')) M.paused = false;
      else if (IN.okP) { M.abandon = true; M.result = { ok: false, golesJugador: M.score[0], golesRival: M.score[1], abandono: true }; close(); }
      clearHits(); return;
    }
    if (was('pause') && !['intro', 'full'].includes(M.phase)) { M.paused = true; clearHits(); return; }
    M.time += dt; M.pt += dt;
    if (M.big) { M.big.t += dt; if (M.big.t > M.big.dur) M.big = null; }
    if (M.label) { M.label.t += dt; if (M.label.t > M.label.dur) M.label = null; }
    M.shake *= Math.exp(-7 * dt); M.excite *= Math.exp(-0.5 * dt); uuhT -= dt;
    if (M.crowdT > 0) { M.crowdT -= dt; if (M.crowdT <= 0) M.crowdMode = 'n'; }
    // emoción de la hinchada: pelota cerca de un arco
    const gd = Math.min(ball.x, FW - ball.x) / FW; M.excite = Math.max(M.excite, clamp(0.35 - gd, 0, 0.35) * 2);
    AU.update(dt, M.excite);

    switch (M.phase) {
      case 'intro':
        if (IN.kickP || IN.okP || M.pt > (opts.autoStart || 1e9)) { setupKickoff(M.kickoff0); }
        break;
      case 'kickoff': {
        assignRoles();
        const kt = M.kickTeam, tk = M.kicker;
        for (const p of players) if (p !== tk && !isHuman(p)) { const u = Math.min(p.bu * 0.92, 0.44); steer(p, fromU(p.team, u), p.bv * FH, 0.6); }
        if (isHuman(tk) && ball.owner === tk) {
          if (IN.kickP || IN.passP || hyp(IN.x, IN.y) > 0) { M.phase = 'play'; M.pt = 0; AU.whistle(0.35); }
          else { tk.dvx = tk.dvy = 0; }
        } else if (M.pt > 1.0) {
          AU.whistle(0.35); M.phase = 'play'; M.pt = 0;
          const q = team(kt).filter(p => p !== tk && p.role !== 'GK').sort((a, b) => hyp(a.x - tk.x, a.y - tk.y) - hyp(b.x - tk.x, b.y - tk.y))[0];
          if (q) passTo(tk, q);
        } else if (!isHuman(tk)) tk.dvx = tk.dvy = 0;
        updatePlayers(dt); updateBall(dt);
        if (M.phase === 'play') { if (!DEMO && M.ctrl) humanControl(M.ctrl, dt); }
        break;
      }
      case 'play':
        tickClock(dt);
        if (M.phase !== 'play') break;
        assignRoles(); autoSwitch(dt);
        for (const p of players) { if (isHuman(p)) humanControl(p, dt); else aiPlayer(p, dt); }
        updatePlayers(dt); updateBall(dt); interactions(dt); slideFouls();
        if (M.phase === 'play') checkBall();
        record();
        break;
      case 'dead': {
        tickClock(dt);
        if (M.phase !== 'dead') break;
        const P = M.pending;
        for (const p of players) {
          if (isHuman(p)) { p.dvx = p.dvy = 0; continue; }
          if (p.role === 'GK') { gkAI(p, dt); continue; }
          const [x, y] = formPos(p, p.team === P.team ? 'att' : 'def'); steer(p, x, y, 0.7);
        }
        updatePlayers(dt); updateBall(dt); record();
        if (M.pt > 1.1) setupRestart();
        break;
      }
      case 'restart':
        tickClock(dt);
        if (M.phase !== 'restart') break;
        restartUpdate(dt); updatePlayers(dt);
        if (M.phase === 'restart') updateBall(dt);
        // penal: el arquero se tira cuando patean
        if (M.phase === 'play' && ball.shot) {
          const gk = gkOf(1 - ball.lastTeam);
          if (gk && gk.penalGuess) {
            const right = Math.random() < (gk.team === 1 ? 0.25 + DIF * 0.05 : 0.5);
            const dir = right ? Math.sign(ball.vy || 1) : gk.penalGuess;
            gk.st = 'dive'; gk.stT = 0.5; gk.vy = dir * 140; gk.vx = 0; gk.diveDone = true; gk.penalGuess = 0;
          }
        }
        break;
      case 'goal':
        celebrate(dt); updatePlayers(dt); updateBall(dt);
        if (M.pt > 3.2 || (M.pt > 1.2 && (IN.okP || IN.kickP))) {
          if (M.recCount > 30) { M.phase = 'replay'; M.pt = 0; M.replayI = 0; }
          else afterGoal();
        }
        break;
      case 'replay':
        M.replayI += 0.6;
        if (M.replayI >= M.recCount - 1 || (M.pt > 0.4 && (IN.okP || IN.kickP))) afterGoal();
        else applyRec(M.replayI);
        break;
      case 'half':
        if (M.pt > 3.5 || (M.pt > 1 && (IN.okP || IN.kickP))) {
          M.half = 2; M.clock = 0; M.addedShown = false; M.side = [-1, 1]; M.recCount = 0;
          setupKickoff(1 - M.kickoff0); label('Segundo tiempo', 1.6);
        }
        break;
      case 'golden':
        if (M.pt > 3 || (M.pt > 1 && (IN.okP || IN.kickP))) { M.half = 3; M.clock = 0; M.recCount = 0; setupKickoff(Math.random() < 0.5 ? 0 : 1); }
        break;
      case 'full':
        celebrateEnd(dt); updatePlayers(dt); updateBall(dt);
        if (M.pt > 1.5 && (IN.okP || IN.kickP)) close();
        if (M.pt > 20) close();
        break;
    }
    // partículas
    for (const q of M.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 300 * dt; if (q.z < 0) { q.z = 0; q.vx *= 0.5; q.vy *= 0.5; } }
    M.parts = M.parts.filter(q => q.life > 0);
    for (const c of M.conf) { c.life -= dt; c.y += c.vy * dt; c.x += Math.sin(M.time * 3 + c.ph) * 12 * dt; }
    M.conf = M.conf.filter(c => c.life > 0);
    clearHits();
  }
  function celebrateEnd() {
    const win = M.score[0] > M.score[1] ? 0 : M.score[1] > M.score[0] ? 1 : -1;
    for (const p of players) {
      if (p.st !== 'ok' && p.st !== 'celebrate') continue;
      if (p.team === win) { p.st = 'celebrate'; p.dvx = p.dvy = 0; }
      else { p.st = 'ok'; p.dvx = p.dvy = 0; }
    }
  }
  function afterGoal() {
    M.recCount = 0;
    if (M.half === 3) { finish(); return; }
    setupKickoff(1 - M.lastGoalTeam);
  }
  function clearHits() { for (const k in hit) hit[k] = false; }

  // ============================================================ DIBUJO
  const cv = document.createElement('canvas');
  cv.id = 'futbol-canvas';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '9000', imageRendering: 'pixelated', background: '#05060c', display: 'block' });
  const ctx = cv.getContext('2d');
  let VW = 400, VH = 225, SC = 4, camX = 0, camY = 0, shx = 0, shy = 0;
  function resize() {
    SC = Math.max(1, Math.round(innerHeight / 228));
    VW = Math.ceil(innerWidth / SC); VH = Math.ceil(innerHeight / SC);
    cv.width = VW; cv.height = VH; cv.style.width = VW * SC + 'px'; cv.style.height = VH * SC + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  // ---- mundo proyectado: x igual, y * PY - z * PZ
  const X0 = -GD - 64, X1 = FW + GD + 64;
  const yTopBase = (-RUN - 12) * PY, yBotBase = (FH + RUN + 12) * PY;
  const PT = yTopBase - TOP_ROWS * ROWH - 50, PB = yBotBase + BOT_ROWS * ROWH + 26;
  const SX0 = -24, SX1 = FW + 24;      // largo de las tribunas
  const RIVAL_SEC = [FW * 0.72, FW + 24];   // la visitante, en la punta de la tribuna de arriba
  let gCv, topFront, botFront, crowdTop, crowdBot;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function pxText(c, s, x, y, col, size = 8, align = 'left', out = '#000') {
    c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'top';
    if (out) { c.fillStyle = out; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(s, x + dx, y + dy); }
    c.fillStyle = col; c.fillText(s, x, y);
  }

  function buildGround() {
    const W = X1 - X0, H = PB - PT, R = seeded(1234);
    const [c, g] = mk(W, H);
    const gx = x => Math.round(x - X0), gy = y => Math.round(y * PY - PT);
    // cielo nocturno y fondo
    g.fillStyle = '#0a0c1c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { g.fillStyle = R() < 0.3 ? '#8890b0' : '#3a4060'; g.fillRect(R() * W | 0, R() * 34 | 0, 1, 1); }
    // cemento alrededor
    g.fillStyle = '#4a4752'; g.fillRect(0, Math.round(yTopBase - PT) - TOP_ROWS * ROWH - 6, W, H);
    // pared de atrás de la tribuna de arriba (roja con franja azul)
    const wallY = Math.round(yTopBase - PT) - TOP_ROWS * ROWH - 6;
    g.fillStyle = '#8a1a24'; g.fillRect(gx(SX0) - 2, wallY, SX1 - SX0 + 4, 6); g.fillStyle = '#2a3a90'; g.fillRect(gx(SX0) - 2, wallY + 4, SX1 - SX0 + 4, 2);
    // escalones de las tribunas
    for (let r = 0; r < TOP_ROWS; r++) {
      const y = Math.round(yTopBase - PT) - (r + 1) * ROWH;
      g.fillStyle = r % 2 ? '#8c8994' : '#7a7782'; g.fillRect(gx(SX0), y, SX1 - SX0, ROWH);
      g.fillStyle = '#5a5762'; g.fillRect(gx(SX0), y + ROWH - 1, SX1 - SX0, 1);
    }
    for (let r = 0; r < BOT_ROWS; r++) {
      const y = Math.round(yBotBase - PT) + r * ROWH;
      g.fillStyle = r % 2 ? '#8c8994' : '#7a7782'; g.fillRect(gx(SX0), y, SX1 - SX0, ROWH);
      g.fillStyle = '#5a5762'; g.fillRect(gx(SX0), y + ROWH - 1, SX1 - SX0, 1);
    }
    // pulmón entre la local y la visitante (escalones vacíos con un vallado)
    g.fillStyle = '#6a6772'; g.fillRect(gx(RIVAL_SEC[0]) - 14, Math.round(yTopBase - PT) - TOP_ROWS * ROWH, 12, TOP_ROWS * ROWH);
    g.fillStyle = '#c8c8c8'; for (let y = 0; y < TOP_ROWS * ROWH; y += 2) { g.fillRect(gx(RIVAL_SEC[0]) - 14, Math.round(yTopBase - PT) - TOP_ROWS * ROWH + y, 1, 1); g.fillRect(gx(RIVAL_SEC[0]) - 3, Math.round(yTopBase - PT) - TOP_ROWS * ROWH + y, 1, 1); }
    // pasto: banquina y cancha con franjas
    const gy0 = gy(-RUN), gy1 = gy(FH + RUN);
    g.fillStyle = '#2c8238'; g.fillRect(gx(-GD - 22), gy0, FW + 2 * GD + 44, gy1 - gy0);
    for (let x = 0; x < FW; x += 1) {
      const band = Math.floor(x / (FW / 14)) % 2;
      g.fillStyle = band ? '#3aa146' : '#34963f';
      g.fillRect(gx(x), gy(0), 1, gy(FH) - gy(0));
    }
    // textura: puntitos de pasto
    for (let i = 0; i < W * H * 0.05; i++) {
      const x = R() * (FW + 2 * GD + 44) - GD - 22, y = R() * (FH + 2 * RUN) - RUN;
      g.fillStyle = R() < 0.5 ? 'rgba(0,40,0,.18)' : 'rgba(180,255,150,.10)';
      g.fillRect(gx(x), gy(y), 1, 1);
    }
    // líneas de cal
    g.fillStyle = '#f2f2e6';
    const hline = (x0, x1, y) => g.fillRect(gx(x0), gy(y), gx(x1) - gx(x0) + 1, 1);
    const vline = (x, y0, y1) => g.fillRect(gx(x), gy(y0), 1, gy(y1) - gy(y0) + 1);
    hline(0, FW, 0); hline(0, FW, FH); vline(0, 0, FH); vline(FW, 0, FH); vline(FW / 2, 0, FH);
    const ell = (cx, cy, r, a0 = 0, a1 = TAU) => { const n = Math.ceil(r * 8); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; g.fillRect(gx(cx + Math.cos(a) * r), gy(cy + Math.sin(a) * r), 1, 1); } };
    ell(FW / 2, CY, CR);
    g.fillRect(gx(FW / 2) - 1, gy(CY) - 1, 3, 2);
    for (const [x0, sd] of [[0, 1], [FW, -1]]) {
      const ax = x0 + sd * AD;
      hline(Math.min(x0, ax), Math.max(x0, ax), CY - AW / 2); hline(Math.min(x0, ax), Math.max(x0, ax), CY + AW / 2); vline(ax, CY - AW / 2, CY + AW / 2);
      const sx = x0 + sd * AD * 0.38, sw = GW / 2 + 14;
      hline(Math.min(x0, sx), Math.max(x0, sx), CY - sw); hline(Math.min(x0, sx), Math.max(x0, sx), CY + sw); vline(sx, CY - sw, CY + sw);
      const px = x0 + sd * AD * 0.72; g.fillRect(gx(px) - 1, gy(CY), 2, 1);
      ell(px, CY, AD * 0.3, sd === 1 ? -0.95 : Math.PI - 0.95 + 0, sd === 1 ? 0.95 : Math.PI + 0.95);
      // la medialuna sólo afuera del área
      g.fillStyle = band => 0;
      g.fillStyle = '#f2f2e6';
      ell(x0, 0, 5, sd === 1 ? 0 : Math.PI / 2, sd === 1 ? Math.PI / 2 : Math.PI); ell(x0, FH, 5, sd === 1 ? -Math.PI / 2 : Math.PI, sd === 1 ? 0 : Math.PI * 1.5);
    }
    // tapar la parte de la medialuna que cae adentro del área
    for (const [x0, sd] of [[0, 1], [FW, -1]]) {
      const ax = x0 + sd * AD, px = x0 + sd * AD * 0.72;
      for (let y = CY - AD * 0.3 - 1; y <= CY + AD * 0.3 + 1; y += 0.5) {
        for (let x = Math.min(px, ax) + 0.5; x < Math.max(px, ax) - 0.4; x += 0.5) {
          if (hyp(x - px, y - CY) > AD * 0.3 - 1.4) {
            const band = Math.floor(x / (FW / 14)) % 2; g.fillStyle = band ? '#3aa146' : '#34963f'; g.fillRect(gx(x), gy(y), 1, 1);
          }
        }
      }
    }
    // banderines de córner
    for (const x of [0, FW]) for (const y of [0, FH]) { g.fillStyle = '#f2f2e6'; g.fillRect(gx(x), gy(y) - 7, 1, 7); g.fillStyle = '#ffd020'; g.fillRect(gx(x) + 1, gy(y) - 7, 3, 2); }
    // atrás de los arcos: carteles bajos al costado
    for (const x of [-GD - 18, FW + GD + 16]) {
      for (let y = -RUN; y < FH + RUN; y += 24) { g.fillStyle = (y / 24 | 0) % 2 ? '#e0202e' : '#2040b0'; g.fillRect(gx(x), gy(y), 3, gy(y + 24) - gy(y)); }
    }
    // bancos de suplentes y banderitas en la banquina de abajo
    for (const bx of [FW / 2 - 70, FW / 2 + 40]) { g.fillStyle = '#20242c'; g.fillRect(gx(bx), gy(FH + RUN) - 5, 30, 5); g.fillStyle = '#c8d8f0'; g.fillRect(gx(bx), gy(FH + RUN) - 6, 30, 1); }
    gCv = c;
  }
  function buildFronts() {
    // arriba: alambrado + trapos + carteles de publicidad
    const W = X1 - X0;
    const ADS = ['CHIPA CITY', 'RADIO SAPUCAY', 'CHIPÁ DOÑA CHELA', 'MBURUCUYÁ', 'NDE TV', 'PARRILLA EL GAUCHO', 'COLECTIVOS 104', 'YERBA KURUSÚ'];
    const COLS = [['#f4d020', '#202020'], ['#2040b0', '#f4f4f4'], ['#f4f4f4', '#e0202e'], ['#20a050', '#f4f4f4'], ['#202020', '#ffd020'], ['#e0202e', '#f4f4f4']];
    function fence(g, y0) {     // y0 = base del alambrado en coords del canvas
      for (let x = 0; x < SX1 - SX0 + 40; x++) {
        for (let y = 0; y < FENCEH; y++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) { g.fillStyle = 'rgba(200,30,40,.55)'; g.fillRect(x, y0 - y, 1, 1); }
      }
      g.fillStyle = '#c01c28'; g.fillRect(0, y0 - FENCEH, SX1 - SX0 + 40, 1); g.fillRect(0, y0, SX1 - SX0 + 40, 1);
      for (let x = 0; x < SX1 - SX0 + 40; x += 16) { g.fillStyle = '#80101a'; g.fillRect(x, y0 - FENCEH - 2, 1, FENCEH + 3); }
    }
    function boards(g, y0, seed) {   // y0 = base de los carteles
      let x = 0, k = seed;
      while (x < SX1 - SX0 + 40) {
        const txt = ADS[k % ADS.length], [bg, fg] = COLS[k % COLS.length];
        g.font = `8px ${FONT}`; const w = Math.ceil(g.measureText(txt).width) + 12;
        g.fillStyle = bg; g.fillRect(x, y0 - ADH, w, ADH); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y0 - 1, w, 1); g.fillRect(x + w - 1, y0 - ADH, 1, ADH);
        g.fillStyle = fg; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText(txt, x + 6, y0 - ADH + 1);
        x += w; k++;
      }
    }
    function trapo(g, x, y, txt, c1, c2) {
      g.font = `8px ${FONT}`; const w = Math.ceil(g.measureText(txt).width) + 8;
      g.fillStyle = c1; g.fillRect(x, y, w, 5); g.fillStyle = c2; g.fillRect(x, y + 5, w, 6);
      g.fillStyle = '#f4f4f4'; g.fillRect(x, y + 4, w, 2);
      pxText(g, txt, x + 4, y + 2, '#fff', 8, 'left', '#101010');
      g.fillStyle = '#d0d0d0'; g.fillRect(x - 1, y - 1, 2, 2); g.fillRect(x + w - 1, y - 1, 2, 2);
    }
    // arriba
    {
      const h = FENCEH + 30 + ADH;
      const [c, g] = mk(SX1 - SX0 + 40, h);
      const fenceBase = Math.round((-RUN - 8) * PY - yTopBase) + h - 12, boardBase = Math.round(-RUN * PY - yTopBase) + h - 12;
      fence(g, fenceBase);
      trapo(g, 30, fenceBase - FENCEH + 1, 'HURACÁN CORRIENTES', '#e0202e', '#2040b0');
      trapo(g, FW * 0.35, fenceBase - FENCEH + 1, 'LA BANDA DEL GLOBO', '#2040b0', '#e0202e');
      trapo(g, FW * 0.58, fenceBase - FENCEH + 1, 'NDE', '#e0202e', '#2040b0');
      const rl = LOOKS[1];
      trapo(g, RIVAL_SEC[0] - SX0 + 10, fenceBase - FENCEH + 1, rl.name.slice(0, 14), rl.shirt, rl.alt);
      boards(g, boardBase, 0);
      topFront = { c, x: SX0 - 20, y: yTopBase - h + 12 };
    }
    // abajo
    {
      const h = FENCEH + ADH + 30;
      const [c, g] = mk(SX1 - SX0 + 40, h);
      const boardBase = Math.round((FH + RUN) * PY - ((FH + RUN) * PY - 20)), fenceBase = Math.round((FH + RUN + 10) * PY - ((FH + RUN) * PY - 20));
      boards(g, boardBase, 3);
      fence(g, fenceBase);
      trapo(g, FW * 0.18, fenceBase - FENCEH + 1, 'EL GLOBO ES DE CORRIENTES', '#2040b0', '#e0202e');
      trapo(g, FW * 0.7, fenceBase - FENCEH + 1, 'AGUANTE HURACÁN', '#e0202e', '#2040b0');
      botFront = { c, x: SX0 - 20, y: (FH + RUN) * PY - 20 };
    }
  }
  function buildCrowd() {
    const R = seeded(99);
    const fanFor = (x, back) => {
      const riv = x >= RIVAL_SEC[0] && !back;
      const L = riv ? LOOKS[1] : HURACAN;
      const sh = pick(L.fans), stripes = !riv && R() < 0.3;
      return { x: Math.round(x - SX0), riv, sh, sh2: stripes ? (sh === '#e0202e' ? '#2040b0' : '#e0202e') : null, skin: pick(SKINS), hair: pick(HAIRS), ph: R() * 4 | 0, clap: R() < 0.2, back };
    };
    const mkFans = (rows, back) => {
      const fans = [];
      for (let r = 0; r < rows; r++) {
        for (let x = SX0 + 2 + (r % 2) * 2; x < SX1 - 3; x += 4 + (R() < 0.12 ? 2 : 0)) {
          if (!back && x > RIVAL_SEC[0] - 15 && x < RIVAL_SEC[0]) continue;   // pulmón vacío
          const dens = (!back && x >= RIVAL_SEC[0]) ? 0.62 : 0.9;
          if (R() < dens) { const f = fanFor(x, back); f.r = r; fans.push(f); }
        }
      }
      return fans;
    };
    const drawFan = (g, f, yb, mode, k) => {
      const mine = mode === 'n' ? null : (mode === 'L' ? !f.riv : f.riv);
      let y = yb, arms = false;
      if (mode === 'n') { y += ((f.ph + k) % 4 === 0) ? -1 : 0; arms = f.clap && ((f.ph + k) % 2 === 0); }
      else if (mine) { y += ((f.ph + k) % 2) ? -2 : 0; arms = true; }
      else y += 1;
      const x = f.x;
      g.fillStyle = f.sh; g.fillRect(x, y - 3, 3, 3);
      if (f.sh2) { g.fillStyle = f.sh2; g.fillRect(x + 1, y - 3, 1, 3); }
      g.fillStyle = f.back ? f.hair : f.skin; g.fillRect(x, y - 5, 3, 2);
      g.fillStyle = f.hair; g.fillRect(x, y - 5, 3, 1);
      if (arms) { g.fillStyle = f.skin; g.fillRect(x - 1, y - 7, 1, 3); g.fillRect(x + 3, y - 7, 1, 3); }
    };
    const top = mkFans(TOP_ROWS, false), bot = mkFans(BOT_ROWS, true);
    const W = SX1 - SX0;
    const frames = (fans, rows, isTop) => {
      const out = {};
      for (const [mode, n] of [['n', 4], ['L', 2], ['R', 2]]) {
        out[mode] = [];
        for (let k = 0; k < n; k++) {
          const [c, g] = mk(W, rows * ROWH + 10);
          // de atrás para adelante: arriba primero la fila más alta
          const order = isTop ? fans.slice().sort((a, b) => b.r - a.r) : fans.slice().sort((a, b) => a.r - b.r);
          for (const f of order) {
            const yb = isTop ? rows * ROWH + 10 - f.r * ROWH - 1 : 10 + (f.r + 1) * ROWH - 1;
            drawFan(g, f, yb, mode, k);
          }
          out[mode].push(c);
        }
      }
      return out;
    };
    crowdTop = { f: frames(top, TOP_ROWS, true), x: SX0, y: yTopBase - TOP_ROWS * ROWH - 10 };
    crowdBot = { f: frames(bot, BOT_ROWS, false), x: SX0, y: yBotBase - 10 };
  }

  // ---- dibujo en vivo
  const P = (x, y, z = 0) => [Math.round(x - camX + shx), Math.round(y * PY - z * PZ - camY + shy)];
  function updateCamera(dt, snap) {
    let fx = ball.x + ball.vx * 0.25, fy = ball.y + ball.vy * 0.2;
    if (M.phase === 'intro') { fx = FW / 2 + Math.sin(M.time * 0.25) * FW * 0.45; fy = -RUN - 20 + Math.sin(M.time * 0.17) * 40; }
    let tx = fx - VW / 2, ty = fy * PY - VH / 2 - 6;
    const minX = X0, maxX = X1 - VW, minY = PT + 24, maxY = PB - VH;
    tx = maxX < minX ? (minX + maxX) / 2 : clamp(tx, minX, maxX);
    ty = maxY < minY ? (minY + maxY) / 2 : clamp(ty, minY, maxY);
    const k = snap ? 1 : Math.min(1, dt * 5);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
    const s = M.shake; shx = s > 0.3 ? Math.round(rand(-s, s)) : 0; shy = s > 0.3 ? Math.round(rand(-s, s)) : 0;
  }
  function drawTower(x, yProj, h, front) {
    const sx = Math.round(x - camX + shx), sy = Math.round(yProj - camY + shy);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(sx - 1, sy - h, 3, h);
    ctx.fillStyle = '#2a2a32'; for (let y = sy - h + 4; y < sy; y += 6) ctx.fillRect(sx - 2, y, 5, 1);
    ctx.fillStyle = '#4a4a54'; ctx.fillRect(sx - 9, sy - h - 10, 19, 11);
    const on = '#fff8d0';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = on; ctx.fillRect(sx - 8 + i * 5, sy - h - 9 + j * 5, 3, 3); }
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff6c0';
    ctx.beginPath(); ctx.arc(sx, sy - h - 5, 22, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.07; ctx.beginPath(); ctx.arc(sx, sy - h - 5, 40, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawFlags() {
    const xs = [SX0 + 30, FW * 0.2, FW * 0.42, FW * 0.62, RIVAL_SEC[0] + 30];
    xs.forEach((x, i) => {
      const riv = x >= RIVAL_SEC[0];
      const [sx, sy0] = P(x, 0); const sy = Math.round(yTopBase - (2 + (i % 3)) * ROWH - camY + shy) - 4;
      if (sx < -20 || sx > VW + 10) return;
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(sx, sy - 16, 1, 16);
      const c1 = riv ? LOOKS[1].shirt : '#e0202e', c2 = riv ? LOOKS[1].alt : '#2040b0';
      for (let k = 0; k < 12; k++) {
        const o = Math.round(Math.sin(M.time * 7 + k * 0.7 + i) * (0.4 + k * 0.12));
        ctx.fillStyle = riv ? (k % 4 < 2 ? c1 : c2) : (k % 4 < 2 ? c1 : c2);
        ctx.fillRect(sx + 1 + k, sy - 16 + o, 1, 7);
      }
    });
  }
  function drawGoalBack(gx) {
    const sd = gx === 0 ? -1 : 1, y1 = CY - GW / 2, y2 = CY + GW / 2;
    const [ax, ay1] = P(gx, y1), [, ay2] = P(gx, y2), [bx] = P(gx + sd * GD, y1);
    const top = Math.round(GH * PZ);
    // red: piso + fondo con cuadriculado
    const xl = Math.min(ax, bx), xr = Math.max(ax, bx);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(xl, ay1 - top, xr - xl, ay2 - ay1 + top);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (let x = xl; x <= xr; x += 3) ctx.fillRect(x, ay1 - top, 1, ay2 - ay1 + top);
    for (let y = ay1 - top; y <= ay2; y += 3) ctx.fillRect(xl, y, xr - xl, 1);
    // palo de atrás (el de arriba en pantalla) y travesaño
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(bx, ay1 - top, 1, ay2 - ay1 + top);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 1, ay1 - top, 2, top + 1);
    ctx.fillRect(ax - 1, ay1 - top, 2, ay2 - ay1 + 1);
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(Math.min(ax, bx), ay1 - top, Math.abs(bx - ax), 1);
  }
  function drawGoalFront(gx) {
    const sd = gx === 0 ? -1 : 1, y2 = CY + GW / 2;
    const [ax, ay2] = P(gx, y2), [bx] = P(gx + sd * GD, y2);
    const top = Math.round(GH * PZ);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 1, ay2 - top, 2, top + 1);
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(Math.min(ax, bx), ay2 - top, Math.abs(bx - ax), 1);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let y = ay2 - top; y <= ay2; y += 3) ctx.fillRect(Math.min(ax, bx), y, Math.abs(bx - ax), 1);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.min(ax, bx), ay2 + 1, Math.abs(bx - ax) + 2, 1);
  }
  function shirtCol(L, col, row) {
    switch (L.pat) {
      case 'stripes': return col % 2 ? L.alt : L.shirt;
      case 'band': return row === 2 ? L.alt : L.shirt;
      case 'sash': return (col - row + 6) % 6 === 2 ? L.alt : L.shirt;
      default: return L.shirt;
    }
  }
  function drawPlayer(p) {
    const [sx, sy] = P(p.x, p.y);
    if (sx < -16 || sx > VW + 16 || sy < -20 || sy > VH + 20) return;
    const L = p.look, sp = hyp(p.vx, p.vy);
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(sx - 3, sy, 8, 2); ctx.fillRect(sx - 2, sy + 2, 6, 1);
    if (p.st === 'down' || p.st === 'slide' || p.st === 'dive') {
      const d = Math.cos(p.face) >= 0 ? 1 : -1, lift = p.st === 'dive' ? 5 : 0, y = sy - 3 - lift;
      const vert = p.st === 'dive' && Math.abs(Math.sin(p.face)) > 0.7;
      if (vert) {   // estirado para arriba/abajo (palomita en el arco)
        const dy = Math.sin(p.face) > 0 ? 1 : -1;
        ctx.fillStyle = L.shirt; ctx.fillRect(sx - 2, y - 2, 5, 5);
        ctx.fillStyle = p.skin; ctx.fillRect(sx - 1, y + dy * 5 - 1, 3, 3);
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(sx - 2, y + dy * 8 - 1, 2, 2); ctx.fillRect(sx + 1, y + dy * 8 - 1, 2, 2);
        ctx.fillStyle = L.shorts; ctx.fillRect(sx - 2, y - dy * 4 - 1, 5, 2);
        ctx.fillStyle = L.socks; ctx.fillRect(sx - 2, y - dy * 6 - 1, 2, 3); ctx.fillRect(sx + 1, y - dy * 6 - 1, 2, 3);
        return;
      }
      for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++) { ctx.fillStyle = shirtCol(L, c, r); ctx.fillRect(sx + d * (c - 2) - (d < 0 ? 0 : 0), y + r - 2, 1, 1); }
      ctx.fillStyle = p.skin; ctx.fillRect(sx + d * 4 - 1, y - 2, 3, 3);
      ctx.fillStyle = p.hair; ctx.fillRect(sx + d * 5 - (d > 0 ? 0 : 1), y - 2, 2, 3);
      ctx.fillStyle = L.shorts; ctx.fillRect(sx - d * 4 - 1, y - 2, 3, 4);
      ctx.fillStyle = L.socks; ctx.fillRect(sx - d * 7 - 1, y - 2, 3, 1); ctx.fillRect(sx - d * 7 - 1, y + 1, 3, 1);
      ctx.fillStyle = '#101010'; ctx.fillRect(sx - d * 9, y - 2, 1, 1); ctx.fillRect(sx - d * 9, y + 1, 1, 1);
      return;
    }
    const cel = p.st === 'celebrate';
    const jump = cel ? Math.round(Math.abs(Math.sin(M.time * 9 + p.i)) * 3) : 0;
    const y0 = sy - jump;
    const fr = Math.floor(p.run / 5) % 4, mv = sp > 10;
    const lOff = mv ? [0, 1, 0, -1][fr] : 0;
    const fs = Math.sin(p.face), fc = Math.cos(p.face);
    const dir = fs < -0.6 ? 'up' : fs > 0.6 ? 'down' : fc > 0 ? 'right' : 'left';
    // piernas
    const legs = [[-2, lOff > 0 ? 1 : 0], [0, lOff < 0 ? 1 : 0]];
    for (const [lx, up] of legs) {
      ctx.fillStyle = p.skin; ctx.fillRect(sx + lx, y0 - 4 - up, 2, 1);
      ctx.fillStyle = L.socks; ctx.fillRect(sx + lx, y0 - 3 - up, 2, 2);
      ctx.fillStyle = '#121212'; ctx.fillRect(sx + lx, y0 - 1 - up, 2, 1);
    }
    if (p.st === 'kick') { ctx.fillStyle = L.socks; ctx.fillRect(sx + Math.round(fc * 4), y0 - 2 + Math.round(fs * 2), 2, 2); }
    // pantalón
    ctx.fillStyle = L.shorts; ctx.fillRect(sx - 3, y0 - 6, 6, 2);
    // camiseta (6 x 5)
    for (let c = 0; c < 6; c++) for (let r = 0; r < 5; r++) { ctx.fillStyle = shirtCol(L, c, r); ctx.fillRect(sx - 3 + c, y0 - 11 + r, 1, 1); }
    // brazos
    const aOff = mv ? [0, 1, 0, -1][(fr + 2) % 4] : 0;
    if (cel || (p.role === 'GK' && ball.owner === p && ball.hold)) {
      ctx.fillStyle = L.shirt; ctx.fillRect(sx - 4, y0 - 13, 1, 3); ctx.fillRect(sx + 3, y0 - 13, 1, 3);
      ctx.fillStyle = L.gk ? '#f4f4f4' : p.skin; ctx.fillRect(sx - 4, y0 - 15, 1, 2); ctx.fillRect(sx + 3, y0 - 15, 1, 2);
    } else {
      ctx.fillStyle = L.shirt; ctx.fillRect(sx - 4, y0 - 11, 1, 2); ctx.fillRect(sx + 3, y0 - 11, 1, 2);
      ctx.fillStyle = L.gk ? '#f4f4f4' : p.skin; ctx.fillRect(sx - 4, y0 - 9 + (aOff > 0 ? 1 : 0), 1, 2); ctx.fillRect(sx + 3, y0 - 9 + (aOff < 0 ? 1 : 0), 1, 2);
    }
    // número en la espalda
    if (dir === 'up') { ctx.fillStyle = L.pat === 'solid' || L.gk ? '#101010' : '#f4f4f4'; ctx.fillRect(sx - 1, y0 - 10, 2, 3); }
    // cabeza
    ctx.fillStyle = p.skin; ctx.fillRect(sx - 2, y0 - 15, 4, 4);
    ctx.fillStyle = p.hair;
    if (dir === 'up') ctx.fillRect(sx - 2, y0 - 15, 4, 4);
    else if (dir === 'down') { ctx.fillRect(sx - 2, y0 - 15, 4, 1); ctx.fillStyle = '#101010'; ctx.fillRect(sx - 1, y0 - 13, 1, 1); ctx.fillRect(sx + 1, y0 - 13, 1, 1); }
    else if (dir === 'right') { ctx.fillRect(sx - 2, y0 - 15, 4, 1); ctx.fillRect(sx - 2, y0 - 14, 2, 2); ctx.fillStyle = '#101010'; ctx.fillRect(sx + 1, y0 - 13, 1, 1); }
    else { ctx.fillRect(sx - 2, y0 - 15, 4, 1); ctx.fillRect(sx, y0 - 14, 2, 2); ctx.fillStyle = '#101010'; ctx.fillRect(sx - 2, y0 - 13, 1, 1); }
  }
  function drawMarker(p) {
    const [sx, sy] = P(p.x, p.y);
    const b = Math.round(Math.sin(M.time * 8)) , y = sy - 21 + b;
    ctx.fillStyle = '#000'; ctx.fillRect(sx - 3, y - 1, 7, 1); ctx.fillRect(sx - 2, y + 2, 5, 1);
    ctx.fillStyle = '#ffe040'; ctx.fillRect(sx - 2, y, 5, 1); ctx.fillRect(sx - 1, y + 1, 3, 1); ctx.fillRect(sx, y + 2, 1, 1);
    if (p.charging || p.charge > 0) {
      const w = 14, f = Math.round(p.charge * w);
      ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, sy + 4, w + 2, 4);
      ctx.fillStyle = p.charge < 0.5 ? '#40e060' : p.charge < 0.85 ? '#ffe040' : '#ff4040';
      ctx.fillRect(sx - w / 2, sy + 5, f, 2);
    }
  }
  function drawAim(p) {
    const [sx, sy] = P(p.x, p.y);
    for (let i = 2; i < 7; i++) {
      if ((i + Math.floor(M.time * 8)) % 2) continue;
      ctx.fillStyle = '#ffe040'; ctx.fillRect(Math.round(sx + Math.cos(p.face) * i * 5), Math.round(sy + Math.sin(p.face) * i * 5 * PY) - 1, 2, 2);
    }
  }
  function drawBall() {
    const [sx, sy] = P(ball.x, ball.y), [, bz] = P(ball.x, ball.y, ball.z);
    const sz = ball.z > 30 ? 4 : 3;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(sx - 1, sy, 3, 1);
    if (ball.z > 2) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx - 2, sy, 5, 1); }
    // estela en los remates fuertes
    if (!ball.owner && hyp(ball.vx, ball.vy) > 280) {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 1; i <= 3; i++) ctx.fillRect(Math.round(sx - ball.vx * 0.008 * i) - 1, Math.round(bz - ball.vy * PY * 0.008 * i - ball.vz * PZ * 0.008 * i) - 2, 2, 2);
    }
    ctx.fillStyle = '#101010'; ctx.fillRect(sx - 1 - (sz - 3), bz - sz, sz + 1, sz + 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1 - (sz - 3), bz - sz, sz, sz);
    const r = Math.floor(ball.rot) % 4;
    ctx.fillStyle = '#303030'; ctx.fillRect(sx - 1 + (r & 1), bz - sz + (r >> 1), 1, 1);
  }
  function drawParts() {
    for (const q of M.parts) { const [sx, sy] = P(q.x, q.y, q.z); ctx.fillStyle = q.col; ctx.fillRect(sx, sy, 1, 1); }
  }
  function drawHUD() {
    // marcador
    ctx.font = `8px ${FONT}`;
    const nA = 'HURACÁN', nB = RIVAL.toUpperCase().slice(0, 13), sc = `${M.score[0]}-${M.score[1]}`;
    const wA = ctx.measureText(nA).width, wB = ctx.measureText(nB).width, wS = ctx.measureText(sc).width;
    const W = Math.ceil(wA + wB + wS + 40), x0 = Math.round(VW / 2 - W / 2), y0 = 4;
    ctx.fillStyle = 'rgba(8,10,20,.82)'; ctx.fillRect(x0, y0, W, 13); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x0, y0 + 13, W, 1);
    // chapitas de colores
    ctx.fillStyle = '#e0202e'; ctx.fillRect(x0 + 3, y0 + 3, 2, 7); ctx.fillStyle = '#2040b0'; ctx.fillRect(x0 + 5, y0 + 3, 2, 7);
    ctx.fillStyle = LOOKS[1].shirt; ctx.fillRect(x0 + W - 7, y0 + 3, 2, 7); ctx.fillStyle = LOOKS[1].alt; ctx.fillRect(x0 + W - 5, y0 + 3, 2, 7);
    pxText(ctx, nA, x0 + 10, y0 + 3, '#ffffff', 8, 'left', null);
    pxText(ctx, sc, x0 + 10 + wA + 10, y0 + 3, '#ffe040', 8, 'left', null);
    pxText(ctx, nB, x0 + W - 10 - wB, y0 + 3, '#ffffff', 8, 'left', null);
    // reloj
    let clk;
    if (M.half === 3) clk = 'ORO ' + Math.max(0, Math.ceil(halfLimit() - M.clock)) + 's';
    else {
      const base = M.half === 2 ? 45 : 0, m = Math.floor(Math.min(M.clock, HALF) / HALF * 45) + base;
      clk = `${m}'`;
      if (M.clock > HALF) clk = `${base + 45}+${Math.min(M.added[M.half - 1], Math.floor((M.clock - HALF) / HALF * 45) + 1)}'`;
      clk += M.half === 1 ? ' 1T' : ' 2T';
    }
    const wc = Math.ceil(ctx.measureText(clk).width) + 10;
    ctx.fillStyle = 'rgba(8,10,20,.82)'; ctx.fillRect(Math.round(VW / 2 - wc / 2), y0 + 14, wc, 11);
    pxText(ctx, clk, Math.round(VW / 2), y0 + 16, M.clock > HALF && M.half < 3 ? '#ff8040' : '#a0e0ff', 8, 'center', null);
    // radar
    const rw = 56, rh = Math.round(56 * FH / FW), rx = VW - rw - 5, ry = VH - rh - 5;
    ctx.fillStyle = 'rgba(10,40,16,.75)'; ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(rx + rw / 2, ry, 1, rh);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(rx - 0.5, ry - 0.5, rw + 1, rh + 1);
    for (const p of players) {
      ctx.fillStyle = p.team === 0 ? (p === M.ctrl && Math.floor(M.time * 6) % 2 ? '#ffe040' : '#ff3040') : LOOKS[1].shirt === '#f2f2ea' ? '#e0e0d8' : LOOKS[1].shirt;
      ctx.fillRect(rx + Math.round(p.x / FW * rw) - 1, ry + Math.round(p.y / FH * rh) - 1, 2, 2);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(rx + Math.round(ball.x / FW * rw), ry + Math.round(ball.y / FH * rh), 1, 1);
  }
  function drawBig() {
    const B = M.big; if (!B) return;
    const sz = B.size; ctx.font = `${sz}px ${FONT}`;
    let size = sz; while (size > 8 && ctx.measureText(B.text).width > VW - 16) { size -= 8; ctx.font = `${size}px ${FONT}`; }
    const w = ctx.measureText(B.text).width, chars = [...B.text];
    let x = Math.round(VW / 2 - w / 2);
    const y = Math.round(VH * 0.36), pop = Math.min(1, B.t * 5);
    chars.forEach((ch, i) => {
      const cw = ctx.measureText(ch).width, oy = Math.round(Math.sin(B.t * 9 + i * 0.6) * (size > 8 ? 3 : 1)) + Math.round((1 - pop) * -30);
      pxText(ctx, ch, x, y + oy, B.col, size, 'left', '#000');
      x += cw;
    });
  }
  function panel(lines, y) {
    ctx.font = `8px ${FONT}`;
    let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l.t).width * (l.s || 8) / 8);
    w = Math.min(VW - 8, Math.ceil(w) + 20);
    let h = 10; for (const l of lines) h += (l.s || 8) + (l.gap ?? 5);
    const x = Math.round(VW / 2 - w / 2);
    ctx.fillStyle = 'rgba(6,8,18,.86)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e0202e'; ctx.fillRect(x, y, w, 2); ctx.fillStyle = '#2040b0'; ctx.fillRect(x, y + h - 2, w, 2);
    let yy = y + 7;
    for (const l of lines) { pxText(ctx, l.t, Math.round(VW / 2), yy, l.c || '#f4f4f4', l.s || 8, 'center', '#000'); yy += (l.s || 8) + (l.gap ?? 5); }
  }
  const CONTROLS = [
    { t: 'FLECHAS / WASD: mover', c: '#a0e0ff' },
    { t: 'ESPACIO o J: patear (mantené = más fuerte)', c: '#a0e0ff' },
    { t: 'X o K: pasar  ·  C o L: barrida', c: '#a0e0ff' },
    { t: 'Q o SHIFT: cambiar jugador · ESC: pausa', c: '#a0e0ff' },
  ];
  function drawOverlays() {
    const blink = Math.floor(M.time * 2) % 2 === 0;
    if (M.phase === 'intro') {
      const n = NP === 7 ? 'Fútbol 7' : 'Fútbol 5';
      panel([
        { t: (opts.titulo || 'PARTIDO EN LA CANCHA DEL GLOBO').toUpperCase(), c: '#ffe040' },
        { t: `HURACÁN vs ${RIVAL.toUpperCase()}`, c: '#ffffff', s: 8, gap: 4 },
        { t: `${n} · ${minutos} min · ${TX.intro}`, c: '#c0c0c0', gap: 8 },
        ...(opts.necesitaGanar ? [{ t: '¡HAY QUE GANAR SÍ O SÍ!', c: '#ff6060', gap: 8 }] : []),
        ...CONTROLS,
        { t: blink ? 'ESPACIO PARA ARRANCAR' : ' ', c: '#ffe040', gap: 2 },
      ], Math.round(VH * 0.18));
    } else if (M.phase === 'full') {
      const [a, b] = M.score;
      panel([
        { t: TX.final, c: '#ffe040' },
        { t: `HURACÁN ${a} - ${b} ${RIVAL.toUpperCase()}`, c: '#ffffff', s: 8, gap: 8 },
        { t: M.endMsg, c: a > b ? '#60ff80' : a < b ? '#ff6060' : '#f0f0f0', gap: 8 },
        { t: M.pt > 1.5 && blink ? 'ENTER PARA SEGUIR' : ' ', c: '#ffe040', gap: 2 },
      ], Math.round(VH * 0.3));
    } else if (M.phase === 'half') {
      panel([{ t: `HURACÁN ${M.score[0]} - ${M.score[1]} ${RIVAL.toUpperCase()}`, c: '#ffffff' }, { t: 'Se cambian de lado', c: '#c0c0c0', gap: 2 }], Math.round(VH * 0.52));
    }
    if (M.phase === 'replay') {
      if (blink) pxText(ctx, '● REPETICIÓN', 8, 30, '#ff4040', 8, 'left', '#000');
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, 2); ctx.fillRect(0, VH - 2, VW, 2);
    }
    if (M.label) {
      const L = M.label, a = Math.min(1, (L.dur - L.t) * 4);
      ctx.globalAlpha = clamp(a, 0, 1); pxText(ctx, L.text, Math.round(VW / 2), Math.round(VH * 0.22), '#ffffff', 8, 'center', '#000'); ctx.globalAlpha = 1;
    }
    if (M.phase === 'restart' && isHuman(M.restart.taker) && blink) {
      pxText(ctx, 'Apuntá con las flechas · ESPACIO patea · X pasa', Math.round(VW / 2), VH - 14, '#ffe040', 8, 'center', '#000');
    }
    if (M.phase === 'kickoff' && M.kickTeam === 0 && !DEMO && blink) pxText(ctx, 'Movete o pasala para sacar', Math.round(VW / 2), VH - 14, '#ffe040', 8, 'center', '#000');
    if (M.paused) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, VW, VH);
      panel([{ t: 'PAUSA', c: '#ffe040', s: 16, gap: 8 }, ...CONTROLS, { t: 'ESC: seguir · ENTER: abandonar (perdés)', c: '#ff8080', gap: 2 }], Math.round(VH * 0.2));
    }
    // papelitos
    for (const c of M.conf) { ctx.fillStyle = c.col; ctx.fillRect(Math.round(c.x), Math.round(c.y), c.w, c.w === 2 ? 1 : 2); }
  }
  function draw(dt) {
    updateCamera(dt);
    ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, VW, VH);
    // torres de luz de atrás
    drawTower(X0 + 26, yTopBase - TOP_ROWS * ROWH + 8, 64);
    drawTower(X1 - 26, yTopBase - TOP_ROWS * ROWH + 8, 64);
    ctx.drawImage(gCv, Math.round(X0 - camX + shx), Math.round(PT - camY + shy));
    // hinchada de arriba
    const fi = Math.floor(M.time * (M.crowdMode === 'n' ? 3 + M.excite * 6 : 8));
    const fT = crowdTop.f[M.crowdMode], fB = crowdBot.f[M.crowdMode];
    ctx.drawImage(fT[fi % fT.length], Math.round(crowdTop.x - camX + shx), Math.round(crowdTop.y - camY + shy));
    drawFlags();
    ctx.drawImage(topFront.c, Math.round(topFront.x - camX + shx), Math.round(topFront.y - camY + shy));
    // arcos (parte de atrás), sombras y entidades ordenadas por profundidad
    drawGoalBack(0); drawGoalBack(FW);
    const ents = players.map(p => ({ y: p.y, f: () => drawPlayer(p) }));
    ents.push({ y: ball.y + 0.5, f: drawBall });
    ents.push({ y: CY + GW / 2, f: () => { drawGoalFront(0); drawGoalFront(FW); } });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.f();
    drawParts();
    if (M.ctrl && !DEMO && ['play', 'kickoff', 'restart', 'dead'].includes(M.phase)) {
      drawMarker(M.ctrl);
      if (M.phase === 'restart' && M.restart.taker === M.ctrl) drawAim(M.ctrl);
    }
    // adelante: carteles y alambrado de abajo, hinchada de abajo, torres de adelante
    ctx.drawImage(botFront.c, Math.round(botFront.x - camX + shx), Math.round(botFront.y - camY + shy));
    ctx.drawImage(fB[fi % fB.length], Math.round(crowdBot.x - camX + shx), Math.round(crowdBot.y - camY + shy));
    drawTower(X0 + 18, yBotBase + BOT_ROWS * ROWH + 14, 92);
    drawTower(X1 - 18, yBotBase + BOT_ROWS * ROWH + 14, 92);
    if (M.phase !== 'intro') drawHUD();
    drawBig();
    drawOverlays();
  }

  // ============================================================ CICLO
  let raf = 0, last = 0, acc = 0, closed = false;
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { update(STEP); acc -= STEP; n++; if (closed) return; }
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function close() {
    if (closed) return; closed = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true);
    removeEventListener('blur', onBlur); removeEventListener('resize', resize);
    setTimeout(() => AU.close(), 1200);
    cv.remove();
    try { if (Chipa.closeModal) Chipa.closeModal(); } catch (e) { console.error(e); }
    const r = M.result || { ok: false, golesJugador: M.score[0], golesRival: M.score[1] };
    if (Chipa.futbol._dbg && Chipa.futbol._dbg.M === M) Chipa.futbol._dbg.closed = true;
    done(r);
  }
  function start() {
    resize();
    buildGround(); buildFronts(); buildCrowd();
    document.body.appendChild(cv);
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
    addEventListener('blur', onBlur); addEventListener('resize', resize);
    AU.init();
    // posiciones iniciales para la presentación
    for (const p of players) { p.x = fromU(p.team, Math.min(p.bu * 0.92, 0.44)); p.y = p.bv * FH; p.face = M.side[p.team] === 1 ? 0 : Math.PI; }
    updateCamera(0, true);
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  // para probar desde la consola / simular partidos
  const dbg = {
    M, ball, players, update, draw, roles, close, canvas: cv,
    sim(secs, input) { M.forceInput = input || null; const n = Math.round(secs / STEP); for (let i = 0; i < n && !closed; i++) update(STEP); M.forceInput = null; },
    setInput(o) { M.forceInput = o; },
  };
  return { start, dbg };
}

// ============================================================ API
let busy = null;
Chipa.futbol = {
  play(opts = {}) {
    if (busy) return busy;
    busy = new Promise(resolve => {
      const go = () => {
        try { if (Chipa.openModal) Chipa.openModal(Chipa.futbol); } catch (e) { console.error(e); }
        const m = createMatch(opts, r => { busy = null; resolve(r); });
        Chipa.futbol._dbg = m.dbg;
        m.start();
      };
      // esperamos la tipografía pixelada (si está en la página) para dibujar los carteles
      const f = document.fonts && document.fonts.load ? document.fonts.load(`8px ${FONT}`) : Promise.resolve();
      Promise.race([f, new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(go);
    });
    return busy;
  },
};
})();
