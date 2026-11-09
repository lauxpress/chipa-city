// CHIPA CITY — escena "patagonia": truco argentino en el jardín cervecero de la Costanera.
// Primera persona sentado a la mesa. El motor de reglas (Truco) no depende de THREE: se puede cargar en Node
// (module.exports) para simular partidas IA contra IA.
'use strict';
(function () {
  // ================================================================== MOTOR DEL TRUCO (reglas puras)
  const Truco = (function () {
    const PALOS = ['espada', 'basto', 'oro', 'copa'];
    const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    const NOMBRE_N = { 1: 'ancho', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 10: 'sota', 11: 'caballo', 12: 'rey' };
    const PLURAL = { espada: 'espadas', basto: 'bastos', oro: 'oros', copa: 'copas' };
    const deck = () => { const d = []; for (const p of PALOS) for (const n of NUMS) d.push({ n, p, id: n + p[0] }); return d; };
    // jerarquía: 1e, 1b, 7e, 7o, treses, doses, anchos falsos, reyes, caballos, sotas, sietes falsos, seises, cincos, cuatros
    function rank(c) {
      const n = c.n, p = c.p;
      if (n === 1 && p === 'espada') return 14; if (n === 1 && p === 'basto') return 13;
      if (n === 7 && p === 'espada') return 12; if (n === 7 && p === 'oro') return 11;
      if (n === 3) return 10; if (n === 2) return 9; if (n === 1) return 8; if (n === 12) return 7; if (n === 11) return 6; if (n === 10) return 5;
      if (n === 7) return 4; if (n === 6) return 3; if (n === 5) return 2; return 1;
    }
    const envVal = c => c.n >= 10 ? 0 : c.n;
    function envido(hand) {
      let best = 0;
      for (const p of PALOS) {
        const v = hand.filter(c => c.p === p).map(envVal).sort((a, b) => b - a);
        if (v.length >= 2) best = Math.max(best, 20 + v[0] + v[1]); else if (v.length === 1) best = Math.max(best, v[0]);
      }
      return best;
    }
    function name(c) {
      if (c.n === 1 && c.p === 'espada') return 'el ancho de espadas';
      if (c.n === 1 && c.p === 'basto') return 'el ancho de bastos';
      if (c.n === 1) return 'el uno de ' + PLURAL[c.p];
      if (c.n >= 10) return 'el ' + NOMBRE_N[c.n] + ' de ' + PLURAL[c.p];
      return 'el ' + NOMBRE_N[c.n] + ' de ' + PLURAL[c.p];
    }
    const short = c => (c.n === 1 ? '1' : c.n) + ' ' + PLURAL[c.p];
    // ganador de la mano según los resultados de las bazas (0, 1 o 'P' = parda). null = sin definir todavía
    function handWinner(r, mano) {
      const k = r.length; if (k < 2) return null;
      const w0 = r.filter(x => x === 0).length, w1 = r.filter(x => x === 1).length;
      if (w0 >= 2) return 0; if (w1 >= 2) return 1;
      if (k === 2) {
        if (r[0] === 'P' && r[1] !== 'P') return r[1];
        if (r[0] !== 'P' && r[1] === 'P') return r[0];
        return null;
      }
      if (r[0] === 'P' && r[1] === 'P') return r[2] === 'P' ? mano : r[2];
      if (r[2] === 'P') return r[0] === 'P' ? r[1] : r[0];
      return r[2];
    }
    const ENV_PTS = { E: 2, R: 3 };
    const CALL_NAME = { E: 'envido', R: 'real envido', F: 'falta envido', 2: 'truco', 3: 'retruco', 4: 'vale cuatro' };

    class Game {
      // o: {target, rng, mano (quién es mano en la primera)}
      constructor(o = {}) {
        this.target = o.target || 15; this.rng = o.rng || Math.random;
        this.scores = [0, 0]; this.nextMano = o.mano !== undefined ? o.mano : 0;
        this.over = false; this.winner = null; this.handNo = 0; this.h = null;
      }
      faltaValue(winner) {
        const lead = Math.max(this.scores[0], this.scores[1]);
        if (this.target >= 30 && lead < this.target / 2) return this.target - this.scores[winner]; // en malas, la falta gana el partido
        return this.target - lead;
      }
      newHand(forced) {
        const d = deck();
        for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
        const mano = this.nextMano; this.nextMano = 1 - mano; this.handNo++;
        const hands = forced || [[], []];
        if (!forced) for (let k = 0; k < 3; k++) { hands[mano].push(d.pop()); hands[1 - mano].push(d.pop()); }
        this.h = {
          mano, hands: hands.map(x => x.slice()), orig: hands.map(x => x.slice()), played: [[], []], cur: [null, null], results: [],
          trick: 0, turn: mano, trucoLevel: 1, trucoOwner: null, pending: null, suspended: null,
          envDone: false, envInfo: [null, null], envCalls: [], over: false, winner: null, pts: 0, reason: '', envPts: [0, 0],
        };
        return this.h;
      }
      whoActs() { const h = this.h; if (!h || h.over || this.over) return null; return h.pending ? 1 - h.pending.by : h.turn; }
      canEnvido(p) {
        const h = this.h;
        if (h.envDone || h.trick !== 0 || h.cur[p] !== null || h.trucoLevel !== 1) return false;
        if (!h.pending) return h.turn === p;
        return h.pending.kind === 'truco' && h.pending.level === 2 && h.pending.by !== p && !h.suspended;
      }
      envOptions(chain) {
        const out = [], last = chain[chain.length - 1];
        if (last === 'F') return out;
        const nE = chain.filter(x => x === 'E').length, hasR = chain.includes('R');
        if (nE < 2 && !hasR) out.push('E');
        if (!hasR) out.push('R');
        out.push('F');
        return out;
      }
      canTruco(p) { const h = this.h; return !h.pending && h.turn === p && h.trucoLevel < 4 && (h.trucoOwner === null || h.trucoOwner === p); }
      // acciones: play0..2, E, R, F, T (truco/retruco/vale cuatro según nivel), Q (quiero), N (no quiero), M (mazo)
      legal(p) {
        const h = this.h, out = [];
        if (this.whoActs() !== p) return out;
        if (h.pending) {
          const pd = h.pending;
          out.push('Q', 'N');
          if (pd.kind === 'envido') { for (const x of this.envOptions(pd.chain)) out.push(x); }
          else {
            if (pd.level < 4) out.push('T');
            if (this.canEnvido(p)) out.push('E', 'R', 'F');
            out.push('M');
          }
          return out;
        }
        for (let i = 0; i < h.hands[p].length; i++) out.push('play' + i);
        if (this.canEnvido(p)) out.push('E', 'R', 'F');
        if (this.canTruco(p)) out.push('T');
        out.push('M');
        return out;
      }
      _award(p, n, ev, why) {
        if (n <= 0) return;
        this.scores[p] += n; ev.push({ t: 'points', p, n, why, scores: this.scores.slice() });
        if (!this.over && this.scores[p] >= this.target) { this.over = true; this.winner = p; this.h.over = true; ev.push({ t: 'gameEnd', winner: p, scores: this.scores.slice() }); }
      }
      _endHand(winner, pts, reason, ev) {
        const h = this.h; h.over = true; h.winner = winner; h.pts = pts; h.reason = reason;
        ev.push({ t: 'handEnd', winner, pts, reason });
        this._award(winner, pts, ev, reason);
      }
      _resolveEnvido(quiero, ev) {
        const h = this.h, pd = h.pending, chain = pd.chain;
        h.envDone = true; h.envCalls = chain.slice();
        let pts, winner;
        if (!quiero) {
          winner = pd.by;
          pts = chain.length === 1 ? 1 : chain.slice(0, -1).reduce((s, x) => s + (ENV_PTS[x] || 0), 0);
          ev.push({ t: 'envido', quiero: false, winner, pts, chain: chain.slice() });
        } else {
          const v = [envido(h.orig[0]), envido(h.orig[1])];
          winner = v[0] > v[1] ? 0 : v[1] > v[0] ? 1 : h.mano;
          pts = chain.includes('F') ? this.faltaValue(winner) : chain.reduce((s, x) => s + ENV_PTS[x], 0);
          const pie = 1 - h.mano, buenas = winner === h.mano; // el pie dice "son buenas" si pierde
          h.envInfo[h.mano] = { exact: v[h.mano] };
          h.envInfo[pie] = buenas ? { max: v[h.mano] } : { exact: v[pie] };
          ev.push({ t: 'envido', quiero: true, winner, pts, vals: v, mano: h.mano, buenas, chain: chain.slice() });
        }
        h.envPts[winner] += pts;
        h.pending = h.suspended; h.suspended = null;
        this._award(winner, pts, ev, 'envido');
      }
      // p pierde la mano por una falta (lo agarraron mirando las señas): el rival se lleva lo que vale el truco
      forfeit(p, reason) {
        const h = this.h, ev = []; if (!h || h.over || this.over) return ev;
        h.pending = null; h.suspended = null;
        this._endHand(1 - p, h.trucoLevel, reason || 'falta', ev); return ev;
      }
      act(p, a) {
        const h = this.h, ev = [];
        if (!this.legal(p).includes(a)) throw new Error('acción ilegal ' + a + ' de ' + p + ' (legal: ' + this.legal(p).join(',') + ')');
        const o = 1 - p;
        if (h.pending) {
          const pd = h.pending;
          if (pd.kind === 'envido') {
            if (a === 'Q' || a === 'N') { ev.push({ t: 'resp', p, a, kind: 'envido' }); this._resolveEnvido(a === 'Q', ev); }
            else { pd.chain.push(a); pd.by = p; ev.push({ t: 'call', p, call: a, chain: pd.chain.slice() }); }
            return ev;
          }
          // truco pendiente
          if (a === 'Q') { h.trucoLevel = pd.level; h.trucoOwner = p; h.pending = null; ev.push({ t: 'resp', p, a, kind: 'truco', level: pd.level }); return ev; }
          if (a === 'N' || a === 'M') {
            ev.push({ t: 'resp', p, a: 'N', kind: 'truco', level: pd.level });
            h.pending = null; this._endHand(o, pd.level - 1, a === 'M' ? 'mazo' : 'noquiero', ev); return ev;
          }
          if (a === 'T') { h.trucoLevel = pd.level; h.pending = { kind: 'truco', level: pd.level + 1, by: p }; h.trucoOwner = null; ev.push({ t: 'call', p, call: pd.level + 1 }); return ev; }
          // el envido está primero
          h.suspended = pd; h.pending = { kind: 'envido', chain: [a], by: p }; ev.push({ t: 'call', p, call: a, chain: [a], primero: true });
          return ev;
        }
        if (a === 'M') {
          let pts = h.trucoLevel;
          if (h.trick === 0 && !h.envDone && h.trucoLevel === 1 && h.cur[p] === null) pts += 1; // se fue sin dejar jugar el envido
          ev.push({ t: 'mazo', p });
          this._endHand(o, pts, 'mazo', ev); return ev;
        }
        if (a === 'E' || a === 'R' || a === 'F') { h.pending = { kind: 'envido', chain: [a], by: p }; ev.push({ t: 'call', p, call: a, chain: [a] }); return ev; }
        if (a === 'T') { h.pending = { kind: 'truco', level: h.trucoLevel + 1, by: p }; ev.push({ t: 'call', p, call: h.trucoLevel + 1 }); return ev; }
        // jugar carta
        const i = +a.slice(4), card = h.hands[p].splice(i, 1)[0];
        h.cur[p] = card; h.played[p].push(card);
        ev.push({ t: 'play', p, card, trick: h.trick });
        if (h.cur[o] === null) { h.turn = o; return ev; }
        const r0 = rank(h.cur[0]), r1 = rank(h.cur[1]), res = r0 > r1 ? 0 : r1 > r0 ? 1 : 'P';
        h.results.push(res); ev.push({ t: 'trick', trick: h.trick, res, cards: h.cur.slice() });
        h.cur = [null, null]; h.trick++;
        const w = handWinner(h.results, h.mano);
        if (w !== null) { this._endHand(w, h.trucoLevel, 'cartas', ev); return ev; }
        h.turn = res === 'P' ? h.mano : res;
        return ev;
      }
    }

    // ------------------------------------------------------------ IA
    // resultado con información perfecta de las bazas que quedan (minimax chiquito): devuelve el ganador
    function solve(hands, cur, results, turn, mano) {
      const w = handWinner(results, mano); if (w !== null) return w;
      const p = turn, o = 1 - p, opts = hands[p];
      let best = null;
      for (let i = 0; i < opts.length; i++) {
        const c = opts[i], nh = hands.slice(); nh[p] = opts.slice(0, i).concat(opts.slice(i + 1));
        const nc = cur.slice(); nc[p] = c; let res;
        if (nc[o] === null) res = solve(nh, nc, results, o, mano);
        else {
          const r0 = rank(nc[0]), r1 = rank(nc[1]), t = r0 > r1 ? 0 : r1 > r0 ? 1 : 'P';
          const nr = results.concat([t]);
          const ww = handWinner(nr, mano);
          res = ww !== null ? ww : solve(nh, [null, null], nr, t === 'P' ? mano : t, mano);
        }
        if (res === p) return p;
        best = res;
      }
      return best === null ? o : best;
    }
    // jugada "codiciosa" para cartas (IA débil): matar con la más baja que gane, si no tirar la más baja
    function greedyCard(h, p) {
      const mine = h.hands[p].map((c, i) => ({ c, i, r: rank(c) })).sort((a, b) => a.r - b.r);
      const opp = h.cur[1 - p];
      if (opp) { const k = mine.find(x => x.r > rank(opp)); return (k || mine[0]).i; }
      if (h.trick === 0) return mine[Math.min(1, mine.length - 1)].i;
      return mine[mine.length - 1].i;
    }
    class AI {
      // o: {diff 1-10, style 'mentiroso'|'normal'|'cauto', rng}
      constructor(p, o = {}) {
        this.p = p; this.diff = o.diff || 5; this.style = o.style || 'normal'; this.rng = o.rng || Math.random;
        const d = this.diff;
        this.samples = 24 + d * 16;
        this.noise = Math.max(0, 0.72 - d * 0.075);
        this.greedy = d <= 3;
        this.useInfo = d >= 4;
        this.bluff = ({ mentiroso: 0.24, normal: 0.11, cauto: 0.04 }[this.style] || 0.1) * (0.5 + d / 14);
        this.envThr = 27 + (this.style === 'cauto' ? 2 : 0) - (this.style === 'mentiroso' ? 1 : 0);
        this.lastPEnv = 0; this.lastPWin = 0;
      }
      // muestras de la mano del rival compatibles con lo que se sabe
      sample(g, oppCalledEnv, oppCalledTruco) {
        const h = g.h, p = this.p, o = 1 - p, r = this.rng;
        const known = new Set(h.orig[p].map(c => c.id).concat(h.played[o].map(c => c.id)));
        const pool = deck().filter(c => !known.has(c.id));
        const need = 3 - h.played[o].length, info = this.useInfo ? h.envInfo[o] : null;
        const out = [];
        let tries = 0;
        while (out.length < this.samples && tries < this.samples * 25) {
          tries++;
          for (let i = 0; i < need; i++) { const j = i + Math.floor(r() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          const rest = pool.slice(0, need), full = h.played[o].concat(rest);
          if (info) { const e = envido(full); if (info.exact !== undefined && e !== info.exact) continue; if (info.max !== undefined && e > info.max) continue; }
          let wgt = 1;
          if (this.useInfo && oppCalledEnv) { const e = envido(full); wgt = 0.12 + 1 / (1 + Math.exp(-(e - 26.5) / 1.6)); }
          if (this.diff >= 6 && oppCalledTruco && rest.length) { const m = rest.reduce((s, c) => s + rank(c), 0) / rest.length; wgt *= 0.3 + 1 / (1 + Math.exp(-(m - 7.5) / 1.4)); }
          out.push({ rest, full, w: wgt });
        }
        if (!out.length) for (let k = 0; k < 20; k++) { U_shuffle(r, pool); out.push({ rest: pool.slice(0, need), full: h.played[o].concat(pool.slice(0, need)), w: 1 }); }
        return out;
      }
      pEnv(g, oppCalled) {
        const h = g.h, me = envido(h.orig[this.p]), S = this.sample(g, oppCalled);
        let win = 0, tot = 0;
        for (const s of S) { const e = envido(s.full); tot += s.w; if (me > e || (me === e && h.mano === this.p)) win += s.w; }
        let pr = tot ? win / tot : 0.5;
        pr += (this.rng() - 0.5) * this.noise * 0.8;
        return Math.max(0, Math.min(1, pr));
      }
      // probabilidad de ganar las bazas jugando la carta i (o la mejor si i === undefined)
      pWin(g, cardIdx, S) {
        const h = g.h, p = this.p, o = 1 - p;
        S = S || this.sample(g, h.envCalls.length && h.envInfo[o] === null);
        let win = 0, tot = 0;
        for (const s of S) {
          const hands = [null, null]; hands[p] = h.hands[p]; hands[o] = s.rest.filter(c => !h.cur[o] || c.id !== h.cur[o].id);
          let res;
          if (cardIdx === undefined) res = solve(hands, h.cur.slice(), h.results.slice(), h.turn, h.mano);
          else {
            const c = hands[p][cardIdx], nh = hands.slice(); nh[p] = hands[p].filter((_, k) => k !== cardIdx);
            const nc = h.cur.slice(); nc[p] = c;
            if (nc[o] === null) res = solve(nh, nc, h.results.slice(), o, h.mano);
            else {
              const r0 = rank(nc[0]), r1 = rank(nc[1]), t = r0 > r1 ? 0 : r1 > r0 ? 1 : 'P', nr = h.results.concat([t]), ww = handWinner(nr, h.mano);
              res = ww !== null ? ww : solve(nh, [null, null], nr, t === 'P' ? h.mano : t, h.mano);
            }
          }
          tot += s.w; if (res === p) win += s.w;
        }
        return tot ? win / tot : 0.5;
      }
      decide(g) {
        const h = g.h, p = this.p, o = 1 - p, L = g.legal(p), r = this.rng;
        if (!L.length) return null;
        const has = a => L.includes(a);
        const need = n => g.scores[o] + n >= g.target; // si el rival gana el partido con n puntos
        // ---- respuesta a canto de envido
        if (h.pending && h.pending.kind === 'envido') {
          const ch = h.pending.chain, pe = this.pEnv(g, true);
          this.lastPEnv = pe;
          const qPts = ch.includes('F') ? g.faltaValue(o) : ch.reduce((s, x) => s + (x === 'E' ? 2 : 3), 0);
          const nPts = ch.length === 1 ? 1 : ch.slice(0, -1).reduce((s, x) => s + (x === 'E' ? 2 : x === 'R' ? 3 : 0), 0);
          if (need(nPts)) return 'Q';
          if (pe > 0.86 && has('F') && (g.faltaValue(p) >= g.target - g.scores[p] || pe > 0.94) && r() < 0.6) return 'F';
          if (pe > 0.8 && has('R') && r() < 0.6) return 'R';
          if (pe > 0.76 && has('E') && r() < 0.5) return 'E';
          if (pe < 0.3 && has('R') && r() < this.bluff * 0.5) return 'R'; // mentira
          const thr = (1 - nPts / qPts) / 2 + 0.06;
          return pe > thr ? 'Q' : 'N';
        }
        // ---- respuesta a truco
        if (h.pending && h.pending.kind === 'truco') {
          const lvl = h.pending.level;
          // ¿envido primero?
          if (has('E')) { const me = envido(h.orig[p]); if (me >= this.envThr + 1 || (me >= this.envThr - 1 && r() < 0.5)) return me >= 31 && r() < 0.5 ? 'R' : 'E'; }
          const pw = this.pWin(g, undefined, this.sample(g, h.envCalls.length && h.envInfo[o] === null, true)); this.lastPWin = pw;
          if (need(lvl - 1)) return pw > 0.6 && has('T') ? 'T' : 'Q';
          if (pw > 0.8 && has('T') && r() < 0.7) return 'T';
          if (pw < 0.25 && has('T') && r() < this.bluff * 0.35) return 'T';
          const thr = 1 / (2 * lvl) + 0.1 + (this.style === 'cauto' ? 0.06 : 0) - (this.style === 'mentiroso' ? 0.04 : 0);
          return (pw + (r() - 0.5) * this.noise) > thr ? 'Q' : 'N';
        }
        // ---- mi turno
        if (has('E')) {
          const me = envido(h.orig[p]); let pe = this.pEnv(g, false); this.lastPEnv = pe;
          // como pie, el rival que no cantó suele tener poco
          if (h.mano !== p && this.useInfo && h.played[o].length) pe = Math.min(1, pe + 0.06);
          if (me >= 31 && pe > 0.8 && r() < 0.35 && has('R')) return 'R';
          if (me >= 32 && pe > 0.9 && r() < 0.25 && g.faltaValue(p) > 3) return 'F';
          if (me >= this.envThr && pe > 0.55) return 'E';
          if (r() < this.bluff * 0.45) return 'E';
        }
        const S = this.sample(g, h.envCalls.length && h.envInfo[o] === null);
        if (has('T')) {
          const pw = this.pWin(g, undefined, S); this.lastPWin = pw;
          const lvl = h.trucoLevel + 1;
          const thr = lvl === 2 ? 0.66 : lvl === 3 ? 0.75 : 0.84;
          if (pw > thr && (h.played[p].length > 0 || r() < 0.5)) return 'T';
          if (pw > 0.97) return 'T';
          if (lvl === 2 && pw < 0.4 && r() < this.bluff * 0.5) return 'T';
        }
        // carta
        const cards = L.filter(a => a.startsWith('play'));
        if (this.greedy || r() < this.noise) return 'play' + (r() < 0.75 ? greedyCard(h, p) : Math.floor(r() * cards.length));
        let best = null, bv = -1;
        for (let i = 0; i < h.hands[p].length; i++) {
          const v = this.pWin(g, i, S) - rank(h.hands[p][i]) * 0.004;
          if (v > bv) { bv = v; best = i; }
        }
        return 'play' + best;
      }
    }
    function U_shuffle(r, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    return { PALOS, NUMS, PLURAL, deck, rank, envido, envVal, name, short, handWinner, Game, AI, solve, CALL_NAME };
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = Truco;
  if (typeof window !== 'undefined') window.ChipaTruco = Truco;
  if (typeof ChipaScenes === 'undefined') return;

  // ================================================================== ESCENA 3D
  ChipaScenes.register('patagonia', {
    fov: 58, lowH: 330,
    create(st, opts) { return createScene(st, opts); },
  });

  // ---------------------------------------------------------------- textos por defecto (el guion los pisa con opts.lineasRival)
  const DEF_LINES = {
    truco: ['¡Truco!', 'Truco, chamigo.'],
    retruco: ['¡Quiero retruco!', 'Retruco. Y no me llorés después.'],
    vale4: ['¡Quiero vale cuatro!', 'Vale cuatro. Que sea lo que Dios quiera.'],
    envido: ['Envido.'],
    real: ['Real envido.', 'Real envido, nderakore.'],
    falta: ['¡Falta envido!', 'Falta envido. A todo o nada, como en la Legislatura.'],
    quiero: ['Quiero.'], noQuiero: ['No quiero.'],
    mazo: ['Me voy al mazo. Esta mano no consta.', 'Al mazo. Paso a cuarto intermedio.'],
    buenas: ['Son buenas.', 'Son buenas... qué suerte la tuya, che.'],
    ganaMano: ['Esa va para el expediente.', 'Ja. Anotá, anotá.', 'Así se gobierna, pichón.'],
    pierdeMano: ['Bah. Mezclá vos.', 'Ni modo. Sigamos.', 'Esa no cuenta, estaba distraído.'],
    gana: ['Lo siento, chamigo. Las cartas ya estaban marcadas.'],
    pierde: ['Nderakore... ¡Esto no consta en actas!'],
    saludo: ['Sentate, sentate. ¿Una birra? La paga la provincia.'],
    pillado: ['¿Qué mirás para atrás, vos? ¡Esa mano es mía!'],
    sospecha: ['¿Qué tanto mirás a la moza vos?'],
  };
  const NUMW = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
    'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
    'veintiocho', 'veintinueve', 'treinta', 'treinta y uno', 'treinta y dos', 'treinta y tres'];
  const DEF_TABLA = [
    { carta: 'ancho de espadas', sena: 'levanta las cejas' }, { carta: 'ancho de bastos', sena: 'guiña un ojo' },
    { carta: 'siete de espadas', sena: 'tuerce la boca a la derecha' }, { carta: 'siete de oro', sena: 'tuerce la boca a la izquierda' },
    { carta: 'un tres', sena: 'se muerde el labio' }, { carta: 'nada', sena: 'cierra los ojos' },
  ];

  // ---------------------------------------------------------------- pixel art del mazo español (40×60)
  const PAL = { k: '#3a2410', y: '#f8d048', Y: '#e0a020', r: '#c83018', R: '#f8e888', w: '#eef4ff', b: '#4a68b8', B: '#22307a', g: '#5a8a2a', G: '#9ac050', d: '#2a4a10', o: '#8a5a2a' };
  const SPR = {
    oro: ['..kkkkk..', '.kyyyyyk.', 'kyYYYYYyk', 'kyYrrrYyk', 'kyYrRrYyk', 'kyYrrrYyk', 'kyYYYYYyk', '.kyyyyyk.', '..kkkkk..'],
    copa: ['kkkkkkkkk', 'kyyyyyyyk', '.krrrrrk.', '.krRrrrk.', '.krRrrrk.', '..krrrk..', '...kyk...', '...kyk...', '..kyyyk..', '.kyyyyyk.', '.kkkkkkk.'],
    espada: ['..w..', '.bwB.', '.bwB.', '.bwB.', '.bwB.', '.bwB.', '.bwB.', '.bwB.', 'yYyYy', '.kyk.', '..r..', '..r..', '.yYy.'],
    basto: ['.gGg.', 'gGgdg', 'ggGgg', 'dgggd', '.gGg.', '.ggd.', '.gg..', '..gd.', '.gg..', '.dg..', '..g..', '..g..', '..o..'],
  };
  const SUITCOL = { oro: '#c88a10', copa: '#c02820', espada: '#2a48a8', basto: '#2a7a2a' };
  const ROBE = { oro: '#d8a030', copa: '#c83028', espada: '#3a58b0', basto: '#3a8a3a' };
  const DIG = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
    4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'] };
  function spr(g, rows, x, y, s = 1) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; g.fillStyle = PAL[ch]; g.fillRect(x + i * s, y + j * s, s, s); }
  }
  const pip = (g, p, cx, cy, s = 1) => { const rows = SPR[p]; spr(g, rows, Math.round(cx - rows[0].length * s / 2), Math.round(cy - rows.length * s / 2), s); };
  function num(g, n, x, y, col) { const str = String(n); let ox = 0; for (const ch of str) { const rows = DIG[ch]; g.fillStyle = col; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (rows[j][i] === '1') g.fillRect(x + ox + i, y + j, 1, 1); ox += 4; } }
  const LAYOUT = {
    2: [[20, 17], [20, 43]], 3: [[20, 14], [20, 30], [20, 46]], 4: [[12, 17], [28, 17], [12, 43], [28, 43]],
    5: [[12, 16], [28, 16], [20, 30], [12, 44], [28, 44]], 6: [[12, 14], [28, 14], [12, 30], [28, 30], [12, 46], [28, 46]],
    7: [[12, 13], [28, 13], [20, 22], [12, 31], [28, 31], [12, 47], [28, 47]],
  };
  function cardCanvas(c, U) {
    return U.canvas(40, 60, (g) => {
      const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      R('#2a1a10', 0, 0, 40, 60); R('#f4ecd4', 1, 1, 38, 58); R('#e8dcc0', 1, 57, 38, 2);
      // esquinas redondeadas
      for (const [x, y] of [[0, 0], [39, 0], [0, 59], [39, 59]]) { g.clearRect(x, y, 1, 1); }
      for (const [x, y] of [[1, 1], [38, 1], [1, 58], [38, 58]]) R('#2a1a10', x, y, 1, 1);
      // la "pinta": marco cortado según el palo (oros 0, copas 1, espadas 2, bastos 3 cortes)
      const col = SUITCOL[c.p], cuts = { oro: 0, copa: 1, espada: 2, basto: 3 }[c.p];
      R(col, 3, 3, 34, 1); R(col, 3, 56, 34, 1); R(col, 3, 3, 1, 54); R(col, 36, 3, 1, 54);
      for (let k = 0; k < cuts; k++) { const x = 20 - (cuts - 1) * 3 + k * 6 - 1; R('#f4ecd4', x, 3, 3, 1); R('#f4ecd4', x, 56, 3, 1); }
      // número en las esquinas
      R('#f4ecd4', 4, 4, c.n >= 10 ? 9 : 5, 7); num(g, c.n, 5, 5, col);
      R('#f4ecd4', c.n >= 10 ? 27 : 31, 49, c.n >= 10 ? 9 : 5, 7); num(g, c.n, c.n >= 10 ? 28 : 32, 50, col);
      if (c.n === 1) {
        if (c.p === 'espada') { // el ancho de espadas: la espada grande con adornos
          pip(g, 'espada', 20, 30, 3);
          R('#e0a020', 13, 20, 2, 2); R('#e0a020', 25, 20, 2, 2); R('#c83018', 12, 34, 2, 2); R('#c83018', 26, 34, 2, 2);
          for (let k = 0; k < 4; k++) { R('#3a8a3a', 9 + k, 44 - k * 3, 1, 2); R('#3a8a3a', 30 - k, 44 - k * 3, 1, 2); }
        } else if (c.p === 'basto') { pip(g, 'basto', 20, 30, 3); R('#3a8a3a', 11, 14, 3, 2); R('#3a8a3a', 27, 18, 3, 2); }
        else if (c.p === 'oro') pip(g, 'oro', 20, 30, 3);
        else pip(g, 'copa', 20, 30, 2);
      } else if (c.n <= 7) {
        for (const [x, y] of LAYOUT[c.n]) pip(g, c.p, x, y, 1);
      } else {
        const robe = ROBE[c.p], dark = U.shade(robe, 0.7), skin = '#f0c8a0', hair = '#6a3a1a';
        if (c.n === 10) { // sota
          R(dark, 15, 9, 10, 3); R('#f8f0e0', 23, 7, 2, 3);
          R(skin, 16, 12, 8, 7); R(hair, 16, 12, 8, 2); R('#2a1a10', 18, 15, 1, 1); R('#2a1a10', 21, 15, 1, 1);
          R('#f8f0e0', 15, 19, 10, 2); R(robe, 13, 21, 14, 12); R('#f0c030', 13, 29, 14, 1); R(dark, 12, 33, 16, 6);
          R(robe, 10, 22, 3, 10); R(skin, 10, 32, 3, 2);
          R('#e8e0d0', 15, 39, 4, 10); R('#e8e0d0', 21, 39, 4, 10); R('#2a1a10', 14, 49, 5, 2); R('#2a1a10', 21, 49, 5, 2);
          pip(g, c.p, 31, 28, 1);
        } else if (c.n === 11) { // caballo
          R('#e8e0d0', 8, 36, 24, 9); R('#b8b0a0', 8, 44, 24, 1);
          for (const x of [10, 14, 25, 29]) { R('#e8e0d0', x, 45, 2, 7); R('#2a1a10', x, 51, 2, 1); }
          R('#e8e0d0', 6, 28, 5, 10); R('#e8e0d0', 2, 26, 7, 5); R('#2a1a10', 4, 27, 1, 1); R('#8a6a4a', 7, 26, 3, 6);
          R('#8a6a4a', 32, 37, 3, 8); R('#f0c030', 14, 35, 12, 4);
          R(robe, 16, 24, 9, 12); R(skin, 17, 17, 7, 7); R('#2a1a10', 19, 19, 1, 1); R('#2a1a10', 22, 19, 1, 1);
          R(dark, 16, 14, 9, 3); R(robe, 19, 36, 3, 6); R('#2a1a10', 19, 41, 4, 2);
          pip(g, c.p, 30, 20, 1);
        } else { // rey
          R('#f0c030', 14, 9, 12, 4); R('#f0c030', 14, 7, 2, 2); R('#f0c030', 19, 6, 2, 3); R('#f0c030', 24, 7, 2, 2); R('#c83018', 19, 10, 2, 2);
          R(skin, 15, 13, 10, 8); R('#2a1a10', 17, 15, 1, 1); R('#2a1a10', 22, 15, 1, 1);
          R('#e8e8e8', 15, 18, 10, 5); R('#e8e8e8', 17, 23, 6, 2);
          R(robe, 11, 23, 18, 27); R('#f8f8f0', 11, 23, 18, 2); R('#f8f8f0', 11, 23, 2, 27); R('#f8f8f0', 27, 23, 2, 27);
          for (let y = 26; y < 50; y += 4) { R('#1a1a1a', 11, y, 1, 1); R('#1a1a1a', 28, y + 2, 1, 1); }
          R(dark, 13, 36, 14, 1); R(skin, 9, 30, 2, 3);
          R('#2a1a10', 14, 50, 5, 2); R('#2a1a10', 21, 50, 5, 2);
          pip(g, c.p, 32, 30, 1);
        }
      }
    });
  }
  function backCanvas(U) {
    return U.canvas(40, 60, (g) => {
      const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      R('#2a1a10', 0, 0, 40, 60); R('#f4ecd4', 1, 1, 38, 58); R('#24307a', 3, 3, 34, 54);
      for (let y = 3; y < 57; y++) for (let x = 3; x < 37; x++) if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) R('#b83040', x, y, 1, 1);
      R('#f0c030', 13, 21, 14, 18); R('#24307a', 14, 22, 12, 16); R('#f0c030', 15, 23, 10, 14);
      R('#b83040', 18, 26, 4, 8); R('#f8e888', 19, 27, 2, 2);
      for (const [x, y] of [[0, 0], [39, 0], [0, 59], [39, 59]]) g.clearRect(x, y, 1, 1);
    });
  }
  // cara de la moza 16×16 con expresiones para las señas
  function yanFace(g, expr, U) {
    const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); };
    const skin = '#c89a70', hair = '#2a1a0a', dark = '#1a0e08', lip = '#a83a3a', sh = '#a87a52';
    R(skin, 0, 0, 16, 16);
    R(hair, 0, 0, 16, 3); R(hair, 0, 3, 2, 9); R(hair, 14, 3, 2, 9); R(hair, 2, 3, 3, 1); R(hair, 11, 3, 3, 1);
    R(sh, 7, 9, 2, 2); R(U.shade(skin, 1.1), 3, 10, 2, 1); R(U.shade(skin, 1.1), 11, 10, 2, 1);
    const eye = (x, open, tall) => { if (!open) { R(dark, x, 8, 3, 1); return; } R('#f8f4ec', x, tall ? 6 : 7, 3, tall ? 3 : 2); R(dark, x + 1, tall ? 6 : 7, 1, tall ? 3 : 2); };
    const brows = (yl, yr) => { R(hair, 3, yl, 3, 1); R(hair, 10, yr, 3, 1); };
    let mouth = () => { R(lip, 6, 12, 4, 1); R(U.shade(lip, 0.7), 6, 13, 4, 1); };
    switch (expr) {
      case 'cejas': brows(3, 3); R(hair, 2, 4, 1, 1); R(hair, 13, 4, 1, 1); eye(3, true, true); eye(10, true, true); break;
      case 'guino': brows(5, 6); eye(3, true); eye(10, false); R(lip, 7, 12, 4, 1); R(lip, 11, 11, 1, 1); mouth = null; break;
      case 'bocaD': brows(5, 5); eye(3, true); eye(10, true); mouth = () => { R(lip, 8, 12, 4, 1); R(lip, 12, 11, 1, 1); R(dark, 8, 13, 3, 1); }; break;
      case 'bocaI': brows(5, 5); eye(3, true); eye(10, true); mouth = () => { R(lip, 4, 12, 4, 1); R(lip, 3, 11, 1, 1); R(dark, 5, 13, 3, 1); }; break;
      case 'labio': brows(5, 5); eye(3, true); eye(10, true); mouth = () => { R('#f8f4ec', 6, 12, 4, 1); R(lip, 6, 13, 4, 1); R(dark, 6, 11, 4, 1); }; break;
      case 'cerrados': brows(5, 5); eye(3, false); eye(10, false); break;
      case 'parpadeo': brows(5, 5); eye(3, false); eye(10, false); break;
      default: brows(5, 5); eye(3, true); eye(10, true);
    }
    if (mouth) mouth();
  }

  // ================================================================== escena
  function createScene(st, opts) {
    const T = THREE, { U } = ChipaScenes, TR = Truco;
    const diff = U.diff(opts);
    const reglas = opts.reglas || {};
    const TARGET = +reglas.puntos || +U.o(opts, 'puntos', 0) || (diff >= 8 ? 30 : 15);
    const RIV = opts.rival || {};
    const RNAME = RIV.name || RIV.nombre || 'Lic. Ñoquetti';
    const RSHORT = RNAME.replace(/^(Lic\.|Dr\.|Don|Doña|Ña|Ing\.)\s+/, '');
    const RLOOK = Object.assign({ skin: '#e0b090', hair: '#c8a050', shirt: '#f4f4f4', pants: '#1a1a3a' }, RIV.look || {});
    const STYLE = RIV.estilo || RIV.style || (diff >= 6 ? 'mentiroso' : 'normal');
    const SENAS = !!U.o(opts, 'senas señas', false);
    const TABLA = U.o(opts, 'tablaSenas', DEF_TABLA);
    const TELL = U.o(opts, 'tellRival', SENAS ? null : (diff <= 6 ? 'Se toca el reloj cuando tiene 28 o más de envido.' : null));
    const MOZA = U.o(opts, 'moza companero compañero', 'Yanina');
    const L = Object.assign({}, DEF_LINES, opts.lineasRival || {});
    const pickL = k => { const a = L[k] || DEF_LINES[k] || ['...']; return Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a; };
    const TITLE = U.o(opts, 'titulo title', 'Truco en el Patagonia');
    const INTRO = U.o(opts, 'intro', 'Noche en la Costanera. El Puente General Belgrano se prende de luces y en la mesa del fondo te espera un truco.');
    const GOAL = U.o(opts, 'objetivo goal', `Ganar la partida de truco a ${TARGET} puntos, sin flor.`);
    const APUESTA = U.o(opts, 'apuesta', null);
    const WIN_TXT = U.o(opts, 'textoGana', '¡Ganaste la partida!');
    const LOSE_TXT = U.o(opts, 'textoPierde', 'Perdiste la partida. Hay revancha.');
    const seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    const rnd = U.rng(U.hash('patagonia' + seed));
    const scene = st.scene, cam = st.camera, SND = st.sfx;
    const rules = { envido: reglas.envido !== false, real: reglas.realEnvido !== false, falta: reglas.faltaEnvido !== false, truco: reglas.truco !== false, retruco: reglas.retruco !== false, vale4: reglas.valeCuatro !== false };

    // ============================================================ motor
    const game = new TR.Game({ target: TARGET, mano: rnd() < 0.5 ? 0 : 1 });
    const baseLegal = game.legal.bind(game);
    game.legal = p => baseLegal(p).filter(a => {
      if (a === 'E') return rules.envido; if (a === 'R') return rules.envido && rules.real; if (a === 'F') return rules.envido && rules.falta;
      if (a === 'T') { const h = game.h, lvl = h.pending && h.pending.kind === 'truco' ? h.pending.level + 1 : h.trucoLevel + 1; return rules.truco && (lvl < 3 || rules.retruco) && (lvl < 4 || rules.vale4); }
      return true;
    });
    const ai = new TR.AI(1, { diff, style: STYLE });
    window.__truco = { game, ai };

    // ============================================================ ambiente y luces
    scene.fog = new T.FogExp2(U.C(0x1c1830), 0.02);
    st.post.levels.value = 26; st.post.vig.value = 0.7; st.post.bloom.value = 1.15; st.post.bloomThr.value = 0.8; st.post.sat.value = 1.08; st.post.exposure.value = 1.05;
    st.post.lift.value.setRGB(0.02, 0.015, 0.04); st.post.gain.value.setRGB(1.03, 0.97, 0.9); st.post.grain.value = 0.03;
    scene.add(new T.HemisphereLight(U.C(0x5a5a90), U.C(0x1a1210), 0.42));
    const moon = new T.DirectionalLight(U.C(0x8a9ad0), 0.25); moon.position.set(-3, 6, -6); scene.add(moon);
    const spot = new T.SpotLight(U.C(0xffc070), 1.7, 7, 0.75, 0.7, 1.6);
    spot.position.set(0.15, 2.45, 0.1); spot.target.position.set(0, 0.75, -0.15); scene.add(spot); scene.add(spot.target);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 4;
    st.addFlicker(spot, 1.7, 1, 0.25);
    const warm = [[-3.6, 2.8, -3.4], [3.6, 2.8, -3.6], [0, 2.8, -6.6]].map(([x, y, z], k) => { const l = new T.PointLight(U.C(0xffa850), 1.6, 10, 1.8); l.position.set(x, y, z); scene.add(l); st.addFlicker(l, 1.6, k * 5, 0.2); return l; });

    // ---- texturas
    const woodC = U.canvas(32, 32, g => U.paint.planks(g, 32, 32, rnd, { pw: 8, cols: ['#8a5a32', '#7a4e2a', '#946438', '#6e4424'] }));
    const woodT = U.tex(woodC);
    const deckT = U.tex(U.canvas(32, 32, g => U.paint.planks(g, 32, 32, rnd, { pw: 4, cols: ['#5a3a22', '#4e321c', '#634228', '#462c18'] })));
    const grassT = U.tex(U.canvas(32, 32, g => { U.R(g, '#1e3a18', 0, 0, 32, 32); U.paint.noise(g, 32, 32, rnd, ['#284a20', '#163012', '#2e5424', '#1a3416'], 700); for (let k = 0; k < 40; k++) U.R(g, '#3a6a2a', Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 2); }));
    const pavT = U.tex(U.canvas(32, 32, g => U.paint.flags(g, 32, 32, rnd, { n: 4, cols: ['#6a6460', '#5e5854', '#726c66'], gap: '#3a3634' })));
    const metal = U.mat({ color: 0x2a2a30, rough: 0.5, metal: 0.6 });
    const woodM = U.mat({ map: woodT, rough: 0.8, color: 0xa08068 });
    const box = (w, h, d, m, x, y, z, parent, shadow = true) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; (parent || scene).add(b); return b; };

    // ---- piso: deck de madera y pasto
    const grass = new T.Mesh(new T.PlaneGeometry(60, 30), U.mat({ map: grassT, rough: 1 })); grassT.repeat.set(30, 15);
    grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.01, -1.5); grass.receiveShadow = true; scene.add(grass);
    const deck = new T.Mesh(new T.PlaneGeometry(15, 10), U.mat({ map: deckT, rough: 0.85 })); deckT.repeat.set(10, 7);
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.01, -3); deck.receiveShadow = true; scene.add(deck);
    // baranda de la Costanera y la vereda de abajo
    const railZ = -8.6;
    for (let x = -20; x <= 20; x += 1.6) box(0.07, 1.0, 0.07, metal, x, 0.5, railZ, null, false);
    box(40, 0.06, 0.08, metal, 0, 1.0, railZ, null, false); box(40, 0.03, 0.03, metal, 0, 0.6, railZ, null, false); box(40, 0.03, 0.03, metal, 0, 0.25, railZ, null, false);
    const pav = new T.Mesh(new T.PlaneGeometry(80, 7), U.mat({ map: pavT, rough: 0.9 })); pavT.repeat.set(40, 3.5);
    pav.rotation.x = -Math.PI / 2; pav.position.set(0, -0.35, -12.2); pav.receiveShadow = true; scene.add(pav);
    box(80, 0.4, 7, U.mat({ color: 0x3a3634 }), 0, -0.56, -12.2, null, false);
    box(80, 0.5, 0.3, U.mat({ map: pavT, color: 0x9a948c }), 0, -0.1, -15.6, null, false);
    // faroles de la Costanera
    const lampHeadM = new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.4, 1.3) });
    const lamps = [];
    for (let x = -42; x <= 42; x += 12) {
      const lx = x + 4; box(0.1, 3.6, 0.1, metal, lx, 1.45, -14.6, null, false); box(0.6, 0.05, 0.05, metal, lx + 0.25, 3.25, -14.6, null, false);
      const hd = new T.Mesh(new T.BoxGeometry(0.22, 0.26, 0.22), lampHeadM); hd.position.set(lx + 0.5, 3.1, -14.6); scene.add(hd);
      const ha = st.halo({ color: 0xffc880, intensity: 0.5, size: 2.2 }); ha.position.copy(hd.position); scene.add(ha);
      lamps.push(hd.position.clone());
    }
    const lampL = new T.PointLight(U.C(0xffc880), 1.2, 12, 1.6); lampL.position.set(4.5, 3, -14); scene.add(lampL);

    // ---- mesa, sillas y vasos
    const TY = 0.76;
    const table = new T.Group(); scene.add(table);
    box(1.34, 0.05, 0.98, woodM, 0, TY - 0.025, 0, table);
    for (const [x, z] of [[-0.58, -0.4], [0.58, -0.4], [-0.58, 0.4], [0.58, 0.4]]) box(0.06, TY - 0.05, 0.06, woodM, x, (TY - 0.05) / 2, z, table);
    box(1.2, 0.04, 0.04, woodM, 0, 0.2, -0.4, table); box(1.2, 0.04, 0.04, woodM, 0, 0.2, 0.4, table);
    const chair = (x, z, ry, parent) => {
      const c = new T.Group(); c.position.set(x, 0, z); c.rotation.y = ry; (parent || scene).add(c);
      box(0.46, 0.05, 0.44, woodM, 0, 0.45, 0, c); box(0.46, 0.5, 0.04, woodM, 0, 0.72, -0.21, c);
      for (const [a, b] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) box(0.04, 0.45, 0.04, woodM, a, 0.225, b, c);
      return c;
    };
    chair(0, -1.02, 0);
    // pintas de cerveza (Patagonia: rubia y roja)
    const glassGeo = new T.CylinderGeometry(0.042, 0.034, 0.15, 10, 1, true);
    const beerGeo = new T.CylinderGeometry(0.039, 0.032, 0.12, 10);
    const foamGeo = new T.CylinderGeometry(0.041, 0.039, 0.025, 10);
    const glassM = U.mat({ color: 0xc8d8e0, rough: 0.1, metal: 0.1, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false });
    const foamM = U.mat({ color: 0xf8f0dc, rough: 0.9 });
    const beerMats = [U.mat({ color: 0xd88a18, rough: 0.2, emissive: 0x3a1a00, transparent: true, opacity: 0.92 }), U.mat({ color: 0x9a2a10, rough: 0.2, emissive: 0x200800, transparent: true, opacity: 0.92 })];
    const pint = (x, z, kind, lvl = 1, parent) => {
      const g = new T.Group(); g.position.set(x, TY, z); (parent || scene).add(g);
      const b = new T.Mesh(beerGeo, beerMats[kind]); b.scale.y = lvl; b.position.y = 0.06 * lvl + 0.004; b.castShadow = true; g.add(b);
      const f = new T.Mesh(foamGeo, foamM); f.position.y = 0.12 * lvl + 0.012; g.add(f);
      const gl = new T.Mesh(glassGeo, glassM); gl.position.y = 0.075; gl.renderOrder = 2; g.add(gl);
      return g;
    };
    pint(-0.5, 0.26, 0, 0.8); const rivPint = pint(0.46, -0.3, 1, 0.55);
    // posavasos y maní
    box(0.09, 0.004, 0.09, U.mat({ color: 0xe8d8b0 }), -0.5, TY + 0.002, 0.26, null, false);
    const bowl = new T.Mesh(new T.CylinderGeometry(0.07, 0.045, 0.04, 8), U.mat({ color: 0x6a3a1a, rough: 0.6 })); bowl.position.set(-0.36, TY + 0.02, -0.28); bowl.castShadow = true; scene.add(bowl);
    for (let k = 0; k < 14; k++) { const m = new T.Mesh(new T.SphereGeometry(0.009, 4, 3), U.mat({ color: 0xc89050 })); m.position.set(-0.36 + (rnd() - 0.5) * 0.08, TY + 0.04, -0.28 + (rnd() - 0.5) * 0.08); scene.add(m); }
    // servilletero con el logo
    const napT = U.tex(U.canvas(16, 8, g => { U.R(g, '#d8d0c0', 0, 0, 16, 8); U.R(g, '#2a3a6a', 1, 1, 14, 6); U.text(g, 'P', 8, 0, { align: 'center', size: 7, color: '#f0e0b0' }); }), { repeat: false, mips: false });
    const nap = new T.Mesh(new T.BoxGeometry(0.1, 0.07, 0.04), [metal, metal, metal, metal, U.mat({ map: napT }), U.mat({ map: napT })]); nap.position.set(0.5, TY + 0.035, 0.12); nap.rotation.y = -0.4; nap.castShadow = true; scene.add(nap);

    // ---- el rival
    const riv = U.person(RLOOK); riv.position.set(0, -0.42, -1.0); scene.add(riv);
    const RD = riv.userData;
    RD.legL.rotation.x = RD.legR.rotation.x = -Math.PI / 2;
    const gold = U.mat({ color: 0xe8b830, rough: 0.3, metal: 0.9, emissive: 0x2a1800 });
    box(0.17, 0.06, 0.18, gold, 0, -0.47, 0, RD.armL, false); // el reloj
    box(0.05, 0.03, 0.05, gold, 0.05, -0.6, 0.05, RD.armR, false); box(0.05, 0.03, 0.05, gold, -0.05, -0.6, 0.05, RD.armL, false);
    box(0.4, 0.02, 0.29, gold, 0, 0.6, 0.0, RD.torso, false).scale.set(0.3, 1, 1); // cadenita
    const rivHand = new T.Group(); scene.add(rivHand); rivHand.position.set(0, 1.0, -0.48);
    const RA = { mode: 'idle', t: 0, dur: 0, look: 0.25 };
    const rivAnim = (mode, dur) => { RA.mode = mode; RA.t = 0; RA.dur = dur; };

    // ---- la moza (señas) y otros parroquianos
    const yan = U.person({ skin: '#c89a70', hair: '#2a1a0a', shirt: '#1a1a1a', pants: '#2a2a2a' });
    yan.position.set(0.95, 0, -2.55); yan.rotation.y = -0.3; scene.add(yan);
    const yanL = new T.PointLight(U.C(0xffb878), 0.9, 3.2, 1.5); yanL.position.set(0.7, 2.0, -1.6); scene.add(yanL);
    const YD = yan.userData;
    box(0.4, 0.3, 0.02, U.mat({ color: 0x8a2a20 }), 0, 0.12, 0.15, YD.torso, false); // delantal
    const faceC = U.canvas(16, 16, g => yanFace(g, 'neutral', U)); const faceT = U.tex(faceC, { repeat: false, mips: false });
    const headBox = YD.head.children[0]; headBox.material[4].map = faceT; headBox.material[4].needsUpdate = true;
    // pelo largo atado
    box(0.12, 0.3, 0.1, U.mat({ color: 0x2a1a0a }), 0, 0.1, -0.2, YD.head, false);
    const tray = new T.Group(); tray.position.set(0, -0.55, 0.12); YD.armL.add(tray);
    const trayM = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.015, 12), metal); tray.add(trayM);
    YD.armL.rotation.set(-1.4, 0, 0.2);
    let yanExpr = 'neutral';
    const setFace = e => { if (e === yanExpr) return; yanExpr = e; const g = faceC.getContext('2d'); yanFace(g, e, U); faceT.needsUpdate = true; };
    const patrons = [];
    const looks = [
      { skin: '#c08a60', hair: '#1a1a1a', shirt: '#c83a3a', pants: '#2a2a4a' }, { skin: '#e0b090', hair: '#6a4a2a', shirt: '#3a8a6a', pants: '#2a2a2a' },
      { skin: '#a8724a', hair: '#1a1a1a', shirt: '#f0c030', pants: '#3a3a5a' }, { skin: '#d8a878', hair: '#2a1a0a', shirt: '#e8e8e8', pants: '#2a3a6a', hat: '#d8c8a0' },
      { skin: '#b07a52', hair: '#d0d0d0', shirt: '#4a5ab0', pants: '#2a2a2a' }, { skin: '#c89a70', hair: '#3a1a0a', shirt: '#d860a0', pants: '#1a1a2a' },
      { skin: '#9a6a44', hair: '#1a1a1a', shirt: '#6a3a8a', pants: '#3a2a1a' },
    ];
    const otherTable = (x, z, seats) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rnd() * 0.6 - 0.3; scene.add(g);
      box(1.3, 0.05, 0.95, woodM, 0, TY - 0.025, 0, g); for (const [a, b] of [[-0.58, -0.4], [0.58, -0.4], [-0.58, 0.4], [0.58, 0.4]]) box(0.06, TY - 0.05, 0.06, woodM, a, (TY - 0.05) / 2, b, g);
      seats.forEach((s, k) => {
        const [sx, sz, ry] = s, c = chair(sx, sz, ry, g);
        const p = U.person(looks[(patrons.length + k) % looks.length]); p.position.set(sx, -0.42, sz); p.rotation.y = ry; g.add(p);
        p.userData.legL.rotation.x = p.userData.legR.rotation.x = -Math.PI / 2; p.userData.armR.rotation.x = -0.9; p.userData.armL.rotation.x = -0.7;
        patrons.push({ p, ph: rnd() * 10, sp: 0.6 + rnd() * 0.8 });
      });
      pint(0.2, 0.1, 0, 0.7, g); pint(-0.25, -0.1, 1, 0.5, g); pint(0.3, -0.2, 0, 0.9, g);
    };
    otherTable(-3.4, -3.6, [[0, -0.75, 0], [0, 0.75, Math.PI], [-0.85, 0, Math.PI / 2]]);
    otherTable(3.2, -5.6, [[0, -0.75, 0], [0.85, 0, -Math.PI / 2], [0, 0.75, Math.PI]]);
    otherTable(-4.8, -7.0, [[0, 0.75, Math.PI], [0.85, 0, -Math.PI / 2]]);
    otherTable(2.6, -2.2, [[0.85, 0, -Math.PI / 2]]);
    // ---- el contenedor-barra de Patagonia
    const bar = new T.Group(); bar.position.set(8.2, 0, -4.2); bar.rotation.y = -Math.PI / 2 + 0.35; scene.add(bar);
    const contT = U.tex(U.canvas(32, 32, g => { for (let x = 0; x < 32; x++) U.R(g, x % 4 < 2 ? '#2a4a3e' : '#1e382e', x, 0, 1, 32); U.paint.noise(g, 32, 32, rnd, ['#3a5a4a', '#16281e'], 60); }));
    contT.repeat.set(4, 1.2);
    box(7, 2.7, 2.6, U.mat({ map: contT, rough: 0.7, metal: 0.3 }), 0, 1.35, 0, bar);
    const winM = new T.MeshBasicMaterial({ color: new T.Color(2.2, 1.5, 0.8) });
    const win = new T.Mesh(new T.PlaneGeometry(4.6, 1.1), winM); win.position.set(0, 1.55, 1.31); bar.add(win);
    box(5.2, 0.1, 0.5, woodM, 0, 1.05, 1.5, bar); box(5.2, 1.0, 0.1, woodM, 0, 0.5, 1.4, bar);
    const signC = U.canvas(64, 12, g => { U.R(g, '#141414', 0, 0, 64, 12); U.text(g, 'PATAGONIA', 32, 2, { align: 'center', size: 9, color: '#f8ecd0', font: 'bold 9px monospace' }); });
    const signT = U.tex(signC, { repeat: false, mips: false });
    const sign = new T.Mesh(new T.PlaneGeometry(4, 0.75), new T.MeshBasicMaterial({ map: signT, color: new T.Color(2.4, 2.2, 1.9) })); sign.position.set(0, 2.95, 1.32); bar.add(sign);
    box(4.2, 0.85, 0.1, U.mat({ color: 0x141414 }), 0, 2.95, 1.27, bar, false);
    const barL = new T.PointLight(U.C(0xffc888), 2.0, 9, 1.6); barL.position.set(0, 1.8, 2.4); bar.add(barL);
    for (let k = 0; k < 5; k++) { const s = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.05, 8), U.mat({ color: 0x3a2a1a })); s.position.set(-2 + k, 0.72, 2.0); bar.add(s); box(0.04, 0.7, 0.04, metal, -2 + k, 0.35, 2.0, bar, false); }
    // ---- árboles: lapacho rosado y un timbó
    const tree = (x, z, col, s) => {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      const tr = new T.Mesh(new T.CylinderGeometry(0.16 * s, 0.24 * s, 3 * s, 6), U.mat({ color: 0x4a3424 })); tr.position.y = 1.5 * s; tr.castShadow = true; g.add(tr);
      const leafT = U.tex(U.canvas(16, 16, gg => { U.R(gg, col, 0, 0, 16, 16); U.paint.noise(gg, 16, 16, rnd, [U.shade(col, 0.75), U.shade(col, 1.2), U.shade(col, 0.9)], 140); }));
      const lm = U.mat({ map: leafT, rough: 1 });
      for (let k = 0; k < 6; k++) { const c = new T.Mesh(new T.IcosahedronGeometry((0.9 + rnd() * 0.6) * s, 0), lm); c.position.set((rnd() - 0.5) * 2 * s, (3 + rnd() * 1.2) * s, (rnd() - 0.5) * 2 * s); c.castShadow = true; g.add(c); }
      return g;
    };
    tree(-7.2, -5.5, '#d86aa0', 1.1); tree(-9.5, -1.5, '#2a5a2a', 1.0); tree(7.5, 1.0, '#2e5e2a', 1.2);
    // ---- guirnaldas de lamparitas
    const posts = { a: [-6.8, 1.4], b: [6.8, 1.4], c: [-6.8, -8.0], d: [6.8, -8.0], e: [0, -8.0], f: [0, 1.4] };
    for (const k in posts) box(0.1, 3.3, 0.1, woodM, posts[k][0], 1.65, posts[k][1], null, false);
    const strings = [['a', 'd'], ['b', 'c'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['f', 'e'], ['a', 'b']];
    const bulbPos = [], wirePts = [];
    for (const [s, e] of strings) {
      const [x0, z0] = posts[s], [x1, z1] = posts[e], len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.55);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = U.lerp(x0, x1, t), z = U.lerp(z0, z1, t), y = 3.25 - Math.sin(t * Math.PI) * (0.25 + len * 0.04);
        if (i > 0) wirePts.push(wirePts[wirePts.length - 1].clone(), new T.Vector3(x, y, z)); else wirePts.push(new T.Vector3(x, y, z));
        if (i > 0 && i < n) bulbPos.push(new T.Vector3(x, y - 0.06, z));
      }
      wirePts.pop();
    }
    // (los segmentos se arman de a pares)
    const wp = []; for (const [s, e] of strings) { const [x0, z0] = posts[s], [x1, z1] = posts[e], len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.55); for (let i = 0; i < n; i++) { const f = t => new T.Vector3(U.lerp(x0, x1, t), 3.25 - Math.sin(t * Math.PI) * (0.25 + len * 0.04), U.lerp(z0, z1, t)); wp.push(f(i / n), f((i + 1) / n)); } }
    scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(wp), new T.LineBasicMaterial({ color: U.C(0x1a1410) })));
    const bulbGeo = new T.IcosahedronGeometry(0.035, 0);
    const bulbs = new T.InstancedMesh(bulbGeo, new T.MeshBasicMaterial({ color: 0xffffff }), bulbPos.length);
    const bcol = new T.Color(), m4 = new T.Matrix4();
    bulbPos.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); const w = 0.8 + rnd() * 0.5; bcol.setRGB(3.4 * w, 2.3 * w, 1.0 * w); bulbs.setColorAt(i, bcol); });
    scene.add(bulbs);
    bulbPos.forEach((p, i) => { if (i % 2) return; const h = st.halo({ color: 0xffb060, intensity: 0.22, size: 0.7, bands: 4 }); h.position.copy(p); scene.add(h); });
    // lamparita sobre nuestra mesa
    const ourBulb = new T.Mesh(new T.IcosahedronGeometry(0.05, 0), new T.MeshBasicMaterial({ color: new T.Color(4, 2.8, 1.4) })); ourBulb.position.set(0.15, 2.4, 0.1); scene.add(ourBulb);
    // partículas: bichitos de luz y polillas
    st.particles({ mode: 'fireflies', count: 50, center: [-4, 1.0, -6], box: [10, 1.6, 5], size: 0.03, color: 0xc0ff70, bright: 2.2, far: 16 });
    st.particles({ mode: 'fireflies', count: 22, center: [0.1, 2.3, -0.1], box: [0.9, 0.5, 0.9], size: 0.018, color: 0xffe0b0, bright: 1.6, speed: 2.2, far: 8 });
    st.particles({ mode: 'dust', count: 120, center: [0, 1.4, -0.4], box: [2.6, 2.0, 2.6], size: 0.012, color: 0xffd8a0, bright: 0.5, far: 6, speed: 0.4 });

    // ============================================================ el fondo lejano: río Paraná, puente, cielo (escena aparte en metros reales)
    const far = new T.Scene(); const farCam = new T.PerspectiveCamera(cam.fov, cam.aspect, 2, 9000);
    const W = -7; // nivel del agua respecto del jardín
    far.fog = new T.FogExp2(U.C(0x1c1630), 0.00042);
    far.add(new T.HemisphereLight(U.C(0x5a5a9a), U.C(0x101018), 0.7));
    const fm = new T.DirectionalLight(U.C(0x9aaad8), 0.6); fm.position.set(-1, 1.2, -0.6); far.add(fm);
    const fwarm = new T.PointLight(U.C(0xffb070), 2.2, 400, 1.2); far.add(fwarm);
    // cielo
    const sky = new T.Mesh(new T.SphereGeometry(7000, 32, 16), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec3 vD;
        float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){ vec3 d = normalize(vD); float h = d.y;
          vec3 top = vec3(0.012, 0.018, 0.07), mid = vec3(0.09, 0.05, 0.2), hor = vec3(0.95, 0.36, 0.16);
          float west = pow(clamp(-d.z * 0.7 + d.x * 0.25 + 0.25, 0.0, 1.0), 2.2);
          vec3 c = mix(mid, top, smoothstep(0.0, 0.55, h));
          c = mix(c, hor, west * (1.0 - smoothstep(-0.02, 0.2, h)));
          c = mix(c, vec3(0.02, 0.02, 0.05), smoothstep(0.0, -0.08, h));
          vec3 q = floor(d * 380.0); float s = hh(q);
          float tw = 0.6 + 0.4 * sin(uTime * (2.0 + hh(q + 1.0) * 4.0) + s * 60.0);
          c += step(0.9975, s) * smoothstep(0.06, 0.35, h) * vec3(1.0, 0.95, 0.85) * tw * 1.2;
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    far.add(sky);
    const moonC = U.canvas(32, 32, g => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 13) { g.fillStyle = d > 11.5 ? '#c8c0a0' : ((x * 7 + y * 13) % 11 === 0 || (x > 10 && x < 15 && y > 14 && y < 19) ? '#b8b090' : '#f0ead0'); g.fillRect(x, y, 1, 1); } } });
    const moonM = new T.Mesh(new T.PlaneGeometry(220, 220), new T.MeshBasicMaterial({ map: U.tex(moonC, { repeat: false, mips: false }), transparent: true, alphaTest: 0.5, fog: false, color: new T.Color(2.2, 2.1, 1.8) }));
    moonM.position.set(2600, 2300, -5200); moonM.lookAt(0, 0, 0); far.add(moonM);
    const moonHalo = st.halo({ color: 0x8090c0, intensity: 0.25, size: 900, bands: 6 }); moonHalo.position.copy(moonM.position); far.add(moonHalo);
    // agua
    const water = new T.Mesh(new T.PlaneGeometry(16000, 8000), new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new T.Vector3() } }, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uCam; varying vec3 vW;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){ vec3 v = vW - uCam; vec3 d = normalize(v); float dist = length(v.xz);
          float graze = 1.0 - clamp(-d.y * 5.0, 0.0, 1.0);
          float west = pow(clamp(-d.z * 0.7 + d.x * 0.25 + 0.25, 0.0, 1.0), 2.2);
          vec3 sky = mix(vec3(0.08, 0.05, 0.18), vec3(0.8, 0.3, 0.14), west);
          vec3 c = mix(vec3(0.008, 0.012, 0.03), sky * 0.55, graze * graze);
          float sc = 1.0 + dist * 0.004;
          vec2 cell = floor(vW.xz / vec2(3.0 * sc, 0.9 * sc));
          float w = sin(vW.z * 0.08 / sc + uTime * 0.9 + hh(vec2(cell.y, 0.0)) * 6.0);
          c *= 0.85 + 0.25 * step(0.6, w);
          float s = hh(cell + floor(uTime * 2.0 + hh(cell) * 3.0));
          c += step(0.992, s) * vec3(0.5, 0.4, 0.5) * graze;
          c = mix(c, vec3(0.11, 0.07, 0.17), smoothstep(800.0, 4000.0, dist) * 0.6);
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, W, -4000); far.add(water);
    // borde de la Costanera (defensa de piedra) y la orilla de enfrente
    const wallT = U.tex(U.canvas(32, 16, g => U.paint.flags(g, 32, 16, rnd, { n: 4, cols: ['#4a4644', '#3e3a38', '#56504c'], gap: '#1e1c1a' })));
    wallT.repeat.set(60, 1);
    const defensa = new T.Mesh(new T.PlaneGeometry(600, 7.2), U.mat({ map: wallT, color: 0x8a8480 })); defensa.position.set(0, W + 3.4, -15.8); far.add(defensa);
    const shore = new T.Mesh(new T.BoxGeometry(14000, 14, 60), U.mat({ color: 0x07070c })); shore.position.set(0, W + 2, -3200); far.add(shore);
    const farLights = [], farCols = [];
    const addPt = (x, y, z, r, g, b) => { farLights.push(x, y, z); farCols.push(r, g, b); };
    for (let k = 0; k < 340; k++) { const x = (rnd() - 0.5) * 9000, w = rnd(); addPt(x, W + 6 + rnd() * 10 + (Math.abs(x) < 1500 ? rnd() * 18 : 0), -3170 - rnd() * 40, 2.6 * (0.8 + w * 0.4), 2.0 * (0.7 + w * 0.3), 1.2 + (rnd() < 0.2 ? 1.5 : 0)); }
    // costanera de Corrientes a la derecha, curvándose hacia el centro
    for (let k = 0; k < 60; k++) { const t = k / 60, x = 60 + t * 900, z = -40 - t * t * 1800; addPt(x, W + 10, z, 3.2, 2.3, 1.1); if (k % 3 === 0) addPt(x + 30 + rnd() * 80, W + 18 + rnd() * 50, z - 20 - rnd() * 60, 2.4, 2.2, 1.6); }
    // siluetas de torres a la derecha
    const bldM = U.mat({ color: 0x0c0c14 });
    for (let k = 0; k < 9; k++) {
      const t = 0.15 + k * 0.09, x = 120 + t * 900, z = -120 - t * t * 1800, h = 20 + rnd() * 60;
      const b = new T.Mesh(new T.BoxGeometry(18 + rnd() * 20, h, 18), bldM); b.position.set(x + 40, W + 8 + h / 2, z - 40); far.add(b);
      for (let w = 0; w < 14; w++) if (rnd() < 0.55) addPt(x + 40 + (rnd() - 0.5) * 16, W + 10 + rnd() * h, z - 30, 2.4, 1.9, 1.1);
    }
    // ---- Puente General Belgrano (atirantado, dos pilonos)
    const A = new T.Vector3(-260, 0, -60), B = new T.Vector3(-30, 0, -3170), dir = B.clone().sub(A).normalize(), nrm = new T.Vector3(dir.z, 0, -dir.x);
    const LEN = A.distanceTo(B), S1 = 330, S2 = 575;
    const deckY = s => W + 4 + 30 * U.clamp(s / 300, 0, 1) - (s > 640 ? 30 * Math.min(1, (s - 640) / 1700) : 0) + (s > 300 && s < 640 ? 2 * Math.sin((s - 300) / 340 * Math.PI) : 0);
    const at = (s, lat = 0, y) => A.clone().addScaledVector(dir, s).addScaledVector(nrm, lat).setY(y === undefined ? deckY(s) : y);
    const concrete = U.mat({ color: 0x8a8a90, rough: 0.9 });
    const yaw = Math.atan2(dir.x, dir.z);
    for (let s = 0; s < LEN; s += 30) {
      const a = at(s), b = at(Math.min(LEN, s + 30)), mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
      const seg = new T.Mesh(new T.BoxGeometry(17, 1.8, len + 0.3), concrete); seg.position.copy(mid); seg.rotation.order = 'YXZ'; seg.rotation.y = yaw; seg.rotation.x = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)); far.add(seg);
      if ((s < S1 - 40 || s > S2 + 40) && s % 60 === 0) { const h = deckY(s) - W; const pier = new T.Mesh(new T.BoxGeometry(5, h, 3), concrete); pier.position.copy(at(s, 0, W + h / 2)); pier.rotation.y = yaw; far.add(pier); }
      for (const lat of [-8, 8]) { const p = at(s + 15, lat); addPt(p.x, p.y + 1.6, p.z, 3.4, 2.4, 1.2); }
    }
    const pylonM = U.mat({ color: 0xb0b0b8, rough: 0.8, emissive: 0x30281a });
    const cables = [], pylTops = [];
    for (const S of [S1, S2]) {
      for (const lat of [-7.5, 7.5]) {
        const base = at(S, lat, W), top = at(S, lat * 0.35, W + 86);
        const mid = base.clone().add(top).multiplyScalar(0.5), len = base.distanceTo(top);
        const leg = new T.Mesh(new T.BoxGeometry(3, len, 4), pylonM); leg.position.copy(mid); leg.rotation.y = yaw; leg.rotateZ(Math.atan2(lat * 0.65, 86) * Math.sign(lat) * Math.sign(lat)); far.add(leg);
        leg.lookAt(top); leg.rotateX(Math.PI / 2);
        for (let k = 1; k <= 10; k++) for (const sg of [-1, 1]) { const d = at(S + sg * k * 11.5, lat); const tp = at(S, lat * 0.4, W + 84 - k * 1.6); cables.push(tp, d); }
        pylTops.push(top);
      }
      const beam = new T.Mesh(new T.BoxGeometry(20, 3, 3.6), pylonM); beam.position.copy(at(S, 0, deckY(S) - 2.4)); beam.rotation.y = yaw; far.add(beam);
      const beam2 = new T.Mesh(new T.BoxGeometry(8, 2.4, 3), pylonM); beam2.position.copy(at(S, 0, W + 66)); beam2.rotation.y = yaw; far.add(beam2);
      for (let y = 0; y < 80; y += 8) for (const lat of [-7.5, 7.5]) { const p = at(S, lat * (1 - y / 86 * 0.65), W + y + 4); addPt(p.x - nrm.x * 0, p.y, p.z, 1.6, 1.4, 1.2); }
    }
    far.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(cables), new T.LineBasicMaterial({ color: U.C(0xa8b0c0), fog: true })));
    const redM = new T.MeshBasicMaterial({ color: new T.Color(5, 0.4, 0.2), fog: false });
    const aviation = pylTops.map(p => { const m = new T.Mesh(new T.SphereGeometry(1.4, 6, 4), redM); m.position.copy(p).y += 2; far.add(m); const h = st.halo({ color: 0xff3020, intensity: 0.6, size: 30 }); h.position.copy(m.position); far.add(h); return { m, h }; });
    const ptsGeo = new T.BufferGeometry(); ptsGeo.setAttribute('position', new T.Float32BufferAttribute(farLights, 3)); ptsGeo.setAttribute('color', new T.Float32BufferAttribute(farCols, 3));
    const ptsMat = new T.PointsMaterial({ size: 2.0, sizeAttenuation: false, vertexColors: true, fog: false });
    far.add(new T.Points(ptsGeo, ptsMat));
    // reflejos de las luces en el agua: rayitas que tiemblan hacia nosotros
    {
      const pos = [], uv = [], seedA = [], colA = [];
      const add = (x, z, r, g, b, len, wid) => {
        const ux = -x, uz = 0.7 - z, ul = Math.hypot(ux, uz), u = [ux / ul, uz / ul], w = [u[1] * wid / 2, -u[0] * wid / 2], y = W + 0.05, s = rnd();
        const P = [[x - w[0], z - w[1], 0, 0], [x + w[0], z + w[1], 1, 0], [x + w[0] + u[0] * len, z + w[1] + u[1] * len, 1, 1], [x - w[0] + u[0] * len, z - w[1] + u[1] * len, 0, 1]];
        for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k][0], y, P[k][1]); uv.push(P[k][2], P[k][3]); seedA.push(s); colA.push(r, g, b); }
      };
      for (let s = 20; s < 1100; s += 24) { const p = at(s, 8); const d = Math.hypot(p.x, p.z); add(p.x, p.z, 1.6, 1.1, 0.5, d * 0.35, 3 + d * 0.012); }
      for (const t of pylTops) add(t.x, t.z, 2.2, 0.3, 0.1, Math.hypot(t.x, t.z) * 0.4, 5);
      for (let k = 0; k < 120; k++) { const i = Math.floor(rnd() * (farLights.length / 3)); const x = farLights[i * 3], z = farLights[i * 3 + 2]; if (z > -300) continue; const d = Math.hypot(x, z); add(x, z + 30, farCols[i * 3] * 0.5, farCols[i * 3 + 1] * 0.5, farCols[i * 3 + 2] * 0.5, d * 0.25, 4 + d * 0.006); }
      for (const p of lamps) add(p.x, -16.5, 1.6, 1.1, 0.5, 30, 1.2);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('aSeed', new T.Float32BufferAttribute(seedA, 1)); g.setAttribute('aCol', new T.Float32BufferAttribute(colA, 3));
      const m = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'attribute float aSeed; attribute vec3 aCol; varying vec2 vUv; varying float vS; varying vec3 vC; void main(){ vUv = uv; vS = aSeed; vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vS; varying vec3 vC;
          float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main(){ float y = vUv.y; float band = floor(y * 46.0); float n = hh(vec2(band + vS * 91.0, floor(uTime * 5.0 + vS * 10.0)));
            float w = abs(vUv.x - 0.5) * 2.0; float a = step(w, 0.25 + 0.75 * n) * pow(1.0 - y, 1.5) * step(0.3, n);
            if (a <= 0.01) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
      });
      const refl = new T.Mesh(g, m); refl.frustumCulled = false; far.add(refl);
      st.updaters.push((dt, t) => { m.uniforms.uTime.value = t; });
    }
    st.updaters.push((dt, t) => {
      sky.material.uniforms.uTime.value = t; water.material.uniforms.uTime.value = t;
      const on = Math.sin(t * 2.4) > 0.2; for (const a of aviation) { a.m.visible = on; a.h.visible = on; }
    });
    // render en dos capas: primero el fondo lejano (con su propia cámara de 9 km), después la escena cercana encima
    let mainRT = null, disposed = false;
    scene.onBeforeRender = (r, s, c, target) => { if (target) mainRT = target; };
    st.preRender = () => {
      const R = st.renderer;
      if (!mainRT || disposed) { R.autoClear = true; return; }
      R.autoClear = false;
      cam.updateMatrixWorld();
      farCam.fov = cam.fov; farCam.aspect = cam.aspect; farCam.updateProjectionMatrix();
      cam.matrixWorld.decompose(farCam.position, farCam.quaternion, farCam.scale); farCam.scale.set(1, 1, 1); farCam.updateMatrixWorld();
      water.material.uniforms.uCam.value.copy(farCam.position);
      R.setRenderTarget(mainRT); R.setClearColor(0x000000); R.clear(true, true, true);
      R.render(far, farCam); R.clearDepth();
    };

    // ============================================================ cartas 3D
    const CW = 0.085, CH = 0.128;
    const cardGeo = new T.PlaneGeometry(CW, CH);
    const backC = backCanvas(U), backT = U.tex(backC, { repeat: false, mips: false });
    const backMat = U.mat({ map: backT, emissive: 0xffffff, emissiveMap: backT, ei: 0.12, rough: 0.7, flat: true });
    const faceMats = {};
    const faceMat = c => faceMats[c.id] || (faceMats[c.id] = (() => { const t = U.tex(cardCanvas(c, U), { repeat: false, mips: false }); return U.mat({ map: t, emissive: 0xffffff, emissiveMap: t, ei: 0.2, rough: 0.7 }); })());
    const glowMat = new T.MeshBasicMaterial({ color: new T.Color(2.6, 1.9, 0.5), transparent: true, opacity: 0.85, depthWrite: false });
    const glowGeo = new T.PlaneGeometry(CW + 0.012, CH + 0.012);
    function makeCard() {
      const g = new T.Group();
      const f = new T.Mesh(cardGeo, faceMat({ n: 4, p: 'copa', id: '4c' })); f.castShadow = true; f.receiveShadow = true; g.add(f);
      const b = new T.Mesh(cardGeo, backMat); b.rotation.y = Math.PI; b.position.z = -0.0005; b.castShadow = true; b.receiveShadow = true; g.add(b);
      const gl = new T.Mesh(glowGeo, glowMat); gl.position.z = -0.001; gl.visible = false; g.add(gl);
      g.userData = { f, b, gl, tw: null, card: null };
      g.visible = false; scene.add(g); return g;
    }
    const cards = []; for (let k = 0; k < 6; k++) cards.push(makeCard());
    const poseQ = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'YXZ'));
    function moveCard(cm, pos, quat, dur = 0.4, delay = 0, arc = 0.06) {
      cm.userData.tw = { p0: cm.position.clone(), q0: cm.quaternion.clone(), p1: pos.clone(), q1: quat.clone(), t: -delay, dur, arc };
    }
    function setCardNow(cm, pos, quat) { cm.position.copy(pos); cm.quaternion.copy(quat); cm.userData.tw = null; }
    let dealer = 1; // quién reparte (el pie)
    const deckPos = () => new T.Vector3(0.48, TY + 0.012, dealer === 1 ? -0.3 : 0.28);
    const deckQ = poseQ(Math.PI / 2, 0.3, 0);
    const handPose = (p, i, n, sel) => {
      const k = i - (n - 1) / 2;
      if (p === 0) return { pos: new T.Vector3(k * 0.068, 0.955 - Math.abs(k) * 0.01 + (sel ? 0.03 : 0), 0.37 + i * 0.002 - (sel ? 0.012 : 0)), q: poseQ(-0.66 + (sel ? 0.05 : 0), 0, -k * 0.13) };
      return { pos: new T.Vector3(-k * 0.055 + 0.01, 1.03 - Math.abs(k) * 0.008, -0.6 - i * 0.002), q: poseQ(-0.3, Math.PI, k * 0.2) };
    };
    const tablePose = (p, k, jit) => ({ pos: new T.Vector3(-0.25 + k * 0.25 + jit * 0.02, TY + 0.002 + k * 0.0006, p === 0 ? -0.02 : -0.26), q: poseQ(-Math.PI / 2, 0, jit * 0.12) });
    // qué malla representa cada carta de cada jugador en esta mano
    let handMeshes = [[], []]; // en orden de la mano del motor (h.hands[p])
    let selIdx = 0;
    function layoutHands(dur = 0.25) {
      for (const p of [0, 1]) { const arr = handMeshes[p]; arr.forEach((cm, i) => { const ps = handPose(p, i, arr.length, p === 0 && i === selIdx && myTurnToPlay()); moveCard(cm, ps.pos, ps.q, dur, 0, 0); }); }
    }

    // ============================================================ HUD propio
    if (!document.getElementById('pt-css')) {
      const s = document.createElement('style'); s.id = 'pt-css';
      s.textContent = `
      .pt-btns { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 7px; pointer-events: auto; }
      .pt-btn { font: inherit; font-size: 10px; min-width: 168px; text-align: left; padding: 8px 10px; background: rgba(14,10,8,.82); color: #f4f0d8; border: 2px solid #8a6a3a; box-shadow: 3px 3px 0 #000; cursor: pointer; }
      .pt-btn b { color: #f0c030; font-weight: normal; display: inline-block; width: 26px; }
      .pt-btn:hover:not([disabled]) { border-color: #f0c030; background: rgba(40,28,10,.9); }
      .pt-btn[disabled] { opacity: .28; cursor: default; }
      .pt-btn.hot { border-color: #f0c030; animation: ptpulse .9s steps(2) infinite; }
      @keyframes ptpulse { 50% { border-color: #ff7040; } }
      .pt-score { position: absolute; top: 14px; right: 14px; background: rgba(14,10,8,.8); border: 2px solid #8a6a3a; box-shadow: 4px 4px 0 #000; padding: 8px 10px 6px; font-size: 9px; text-align: center; pointer-events: none; }
      .pt-score canvas { image-rendering: pixelated; display: block; margin-top: 4px; }
      .pt-score .lbl { display: flex; justify-content: space-around; color: #f0c030; }
      .pt-bubble { position: absolute; top: 9%; left: 50%; transform: translateX(-50%); max-width: min(560px, 70vw); background: #f4ecd4; color: #1a1008; border: 3px solid #1a1008; box-shadow: 4px 4px 0 #000; padding: 10px 14px; font-size: clamp(10px, 1.3vw, 13px); line-height: 1.7; text-align: center; opacity: 0; transition: opacity .15s; pointer-events: none; text-shadow: none; }
      .pt-bubble .w { color: #8a2a10; font-size: 9px; display: block; margin-bottom: 3px; }
      .pt-bubble:after { content: ''; position: absolute; left: 50%; bottom: -12px; border: 9px solid transparent; border-top-color: #1a1008; transform: translateX(-50%); }
      .pt-me { position: absolute; bottom: 33%; left: 50%; transform: translateX(-50%); background: rgba(10,16,30,.88); color: #d8ecff; border: 3px solid #6aa8e8; box-shadow: 4px 4px 0 #000; padding: 8px 14px; font-size: clamp(10px, 1.3vw, 13px); opacity: 0; transition: opacity .15s; pointer-events: none; white-space: nowrap; }
      .pt-banner { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: clamp(22px, 5vw, 56px); color: #f0c030; opacity: 0; pointer-events: none; text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 0 18px rgba(255,160,40,.6); }
      .pt-info { position: absolute; left: 16px; bottom: 16px; font-size: 9px; line-height: 2; pointer-events: none; max-width: 40vw; }
      .pt-info b { color: #f0c030; font-weight: normal; }
      .pt-senas { position: absolute; left: 16px; top: 34%; font-size: 9px; line-height: 2; background: rgba(14,10,8,.82); border: 2px solid #8a6a3a; box-shadow: 4px 4px 0 #000; padding: 8px 12px; pointer-events: none; opacity: 0; transition: opacity .3s; }
      .pt-senas b { color: #f0c030; font-weight: normal; }
      .pt-caption { position: absolute; bottom: 22%; left: 0; right: 0; text-align: center; font-size: clamp(11px, 1.6vw, 16px); color: #f8e0a0; opacity: 0; transition: opacity .2s; pointer-events: none; }
      @media (max-width: 760px) { .pt-btn { min-width: 120px; font-size: 8px; padding: 6px 8px; } .pt-info { max-width: 60vw; } }
      `;
      document.head.appendChild(s);
    }
    const el = (cls, html) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; st.root.appendChild(e); return e; };
    const scoreEl = el('pt-score t'); scoreEl.innerHTML = `<div class="lbl"><span>VOS</span><span>${RSHORT.toUpperCase().slice(0, 9)}</span></div><div style="margin-top:2px;color:#e8dcc0">a ${TARGET}</div>`;
    const scoreC = document.createElement('canvas'); scoreEl.appendChild(scoreC);
    const bubble = el('pt-bubble'), meEl = el('pt-me t'), banner = el('pt-banner'), info = el('pt-info t'), caption = el('pt-caption t');
    const senasEl = el('pt-senas t'); senasEl.innerHTML = `<b>SEÑAS DE ${MOZA.toUpperCase()}</b><br>` + TABLA.map(r => `${r.sena} → <b>${r.carta}</b>`).join('<br>');
    // botones
    const btnDefs = [
      { a: 'play', key: '␣', label: 'JUGAR CARTA' }, { a: 'E', key: 'E', label: 'ENVIDO' }, { a: 'R', key: 'R', label: 'REAL ENVIDO' }, { a: 'F', key: 'F', label: 'FALTA ENVIDO' },
      { a: 'T', key: 'T', label: 'TRUCO' }, { a: 'Q', key: 'Q', label: 'QUIERO' }, { a: 'N', key: 'N', label: 'NO QUIERO' }, { a: 'M', key: 'M', label: 'IRSE AL MAZO' },
    ];
    if (SENAS) btnDefs.push({ a: 'Y', key: 'Y', label: 'MIRAR A ' + MOZA.toUpperCase() });
    const btnBox = el('pt-btns');
    const btns = {};
    for (const d of btnDefs) {
      const b = document.createElement('button'); b.className = 'pt-btn t'; b.innerHTML = `<b>${d.key}</b>${d.label}`; b.disabled = true;
      b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if (!b.disabled) uiAction(d.a); });
      btnBox.appendChild(b); btns[d.a] = { b, d };
    }
    const show = (e, on) => { e.style.opacity = on ? 1 : 0; };
    let bubbleT = 0, meT = 0, bannerT = 0, capT = 0;
    function drawScore() {
      const n = TARGET, groups = Math.ceil(n / 5), rows = n > 15 ? 2 : 1, perRow = Math.ceil(groups / rows);
      const cw = perRow * 13 + 4, W2 = cw * 2 + 8, H2 = rows * 14 + 6 + (rows > 1 ? 4 : 0);
      scoreC.width = W2; scoreC.height = H2; scoreC.style.width = W2 * 2 + 'px'; scoreC.style.height = H2 * 2 + 'px';
      const g = scoreC.getContext('2d'); g.clearRect(0, 0, W2, H2);
      g.fillStyle = '#5a4020'; g.fillRect(cw + 3, 0, 1, H2);
      if (rows > 1) { g.fillStyle = '#5a4020'; g.fillRect(0, 14 + 5, W2, 1); }
      const match = (x0, y0, x1, y1) => { const n2 = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n2; i++) { const x = Math.round(U.lerp(x0, x1, i / n2)), y = Math.round(U.lerp(y0, y1, i / n2)); g.fillStyle = i >= n2 - 1 ? '#e04020' : '#f0d8a0'; g.fillRect(x, y, 1, 1); } };
      for (const p of [0, 1]) {
        const pts = Math.min(n, game.scores[p]);
        for (let k = 0; k < pts; k++) {
          const gi = Math.floor(k / 5), m = k % 5, row = Math.floor(gi / perRow), col = gi % perRow;
          const x = 2 + p * (cw + 6) + col * 13, y = 3 + row * 18;
          if (m === 0) match(x, y + 10, x, y); else if (m === 1) match(x, y, x + 10, y); else if (m === 2) match(x + 10, y, x + 10, y + 10); else if (m === 3) match(x + 10, y + 10, x, y + 10); else match(x + 1, y + 9, x + 9, y + 1);
        }
        g.fillStyle = '#f0c030';
      }
      scoreEl.querySelector('.lbl').innerHTML = `<span>VOS ${game.scores[0]}</span><span>${RSHORT.toUpperCase().slice(0, 9)} ${game.scores[1]}</span>`;
    }
    drawScore();
    function rivalSay(text, secs) {
      bubble.innerHTML = `<span class="w">${RNAME.toUpperCase()}</span>${text}`; show(bubble, true); bubbleT = secs || Math.max(1.6, 0.9 + text.length * 0.045);
      rivalAnim('talk', bubbleT);
      for (let k = 0; k < Math.min(10, text.length / 4); k++) SND.tone(170 + Math.random() * 60, 0.05, { type: 'square', vol: 0.03, delay: k * 0.07 });
      return wait(Math.min(bubbleT, 0.7 + text.length * 0.035));
    }
    function meSay(text, secs = 1.4) { meEl.innerHTML = 'VOS: ' + text; show(meEl, true); meT = secs; return wait(Math.min(secs, 0.9)); }
    function bannerSay(text, color) { banner.textContent = text; banner.style.color = color || '#f0c030'; show(banner, true); bannerT = 1.1; banner.style.transform = 'scale(1.25)'; requestAnimationFrame(() => { banner.style.transition = 'transform .25s, opacity .2s'; banner.style.transform = 'scale(1)'; }); }
    function captionSay(text, secs = 2) { caption.innerHTML = text; show(caption, true); capT = secs; }

    // ============================================================ tiempo y flujo
    const waits = [];
    const wait = s => new Promise(r => waits.push({ until: st.t + s, r }));
    let inputReq = null; // {resolve}
    const myTurnToPlay = () => !!inputReq && game.whoActs() === 0 && !game.h.pending;
    function uiAction(a) {
      if (!inputReq) return;
      if (a === 'play') { if (myTurnToPlay()) finishInput('play' + selIdx); return; }
      if (a === 'Y') { if (canLook()) finishInput('__look'); return; }
      if (game.legal(0).includes(a)) finishInput(a);
    }
    function finishInput(a) { const r = inputReq; inputReq = null; refreshButtons(); r(a); }
    const humanInput = () => new Promise(r => { inputReq = r; selIdx = Math.min(selIdx, game.h.hands[0].length - 1); layoutHands(0.18); refreshButtons(); });
    let lastBtnKey = '';
    function refreshButtons() {
      const L = inputReq ? game.legal(0) : [];
      const h = game.h;
      const tl = h ? (h.pending && h.pending.kind === 'truco' ? h.pending.level + 1 : h.trucoLevel + 1) : 2;
      const tLabel = tl === 2 ? 'TRUCO' : tl === 3 ? 'QUIERO RETRUCO' : 'QUIERO VALE CUATRO';
      const st2 = { play: inputReq && myTurnToPlay(), E: L.includes('E'), R: L.includes('R'), F: L.includes('F'), T: L.includes('T'), Q: L.includes('Q'), N: L.includes('N'), M: L.includes('M'), Y: !!inputReq && canLook() };
      const key = JSON.stringify(st2) + tLabel;
      if (key === lastBtnKey) return; lastBtnKey = key;
      for (const a in btns) { btns[a].b.disabled = !st2[a]; btns[a].b.classList.toggle('hot', !!st2[a] && (a === 'Q' || a === 'N') && !!(h && h.pending)); }
      btns.T.b.innerHTML = `<b>T</b>${tLabel}`;
    }
    function refreshInfo() {
      const h = game.h; if (!h) { info.innerHTML = ''; return; }
      const myE = TR.envido(h.orig[0]);
      const tr = h.trucoLevel === 1 ? 'sin cantar' : ['', '', 'TRUCO querido (2)', 'RETRUCO querido (3)', 'VALE CUATRO querido (4)'][h.trucoLevel];
      const res = h.results.map(r => r === 'P' ? 'parda' : r === 0 ? 'vos' : RSHORT).join(' · ') || '—';
      info.innerHTML = `Mano ${game.handNo}: es mano <b>${h.mano === 0 ? 'VOS' : RSHORT.toUpperCase()}</b><br>Tu envido: <b>${myE}</b>${h.envDone ? ' (ya se jugó)' : ''}<br>Truco: <b>${tr}</b><br>Bazas: <b>${res}</b>`;
    }

    // ---- mirar a la moza (señas)
    let lookedThisHand = false, lookStreak = 0, looking = 0, lookT = 0;
    const canLook = () => SENAS && !lookedThisHand && !!game.h && !game.h.over;
    const SENA_FX = r => /ceja/i.test(r) ? 'cejas' : /gui/i.test(r) ? 'guino' : /boca.*der/i.test(r) ? 'bocaD' : /boca.*izq/i.test(r) ? 'bocaI' : /labio/i.test(r) ? 'labio' : /cierr|ojos/i.test(r) ? 'cerrados' : 'cejas';
    const SENA_CARD = c => {
      const s = c.toLowerCase();
      if (/ancho.*espada/.test(s)) return x => x.n === 1 && x.p === 'espada'; if (/ancho.*basto/.test(s)) return x => x.n === 1 && x.p === 'basto';
      if (/siete.*espada/.test(s)) return x => x.n === 7 && x.p === 'espada'; if (/siete.*oro/.test(s)) return x => x.n === 7 && x.p === 'oro';
      if (/tres/.test(s)) return x => x.n === 3; if (/dos/.test(s)) return x => x.n === 2; return null;
    };
    async function lookAtYanina() {
      lookedThisHand = true;
      if (lookStreak >= 2) { // ya miraste dos manos seguidas: te pescan
        rivalAnim('turn', 3.2); SND.noise(0.3, { freq: 600, vol: 0.15 });
        await wait(1.0); setFace('cerrados');
        await rivalSay(pickL('pillado'), 2.6);
        bannerSay('¡TE PESCÓ!', '#ff6040'); st.shake(0.4);
        setFace('neutral');
        await wait(0.6);
        const ev = game.forfeit(0, 'señas'); await present(ev, 0, null);
        return;
      }
      looking = 1; lookT = 0; show(senasEl, true);
      SND.tone(520, 0.08, { vol: 0.04 });
      await wait(0.9);
      const hand = game.h.hands[1], seq = [];
      for (const row of TABLA) { const f = SENA_CARD(row.carta || ''); if (!f) continue; for (const c of hand) if (f(c) && !seq.some(x => x.c === c)) seq.push({ c, row }); }
      if (!seq.length) { const nada = TABLA.find(r => /nada/i.test(r.carta)) || { sena: 'cierra los ojos', carta: 'nada' }; seq.push({ row: nada }); }
      for (const s of seq.slice(0, 3)) {
        setFace(SENA_FX(s.row.sena)); captionSay(`${MOZA} ${s.row.sena}.`, 1.5); SND.tone(880, 0.05, { vol: 0.03 });
        await wait(1.5); setFace('neutral'); await wait(0.35);
      }
      looking = 0; show(senasEl, false);
      if (lookStreak + 1 >= 2) { await wait(0.5); await rivalSay(pickL('sospecha'), 2); }
      await wait(0.6);
    }

    // ---- presentación de los eventos del motor
    const callText = c => ({ E: 'ENVIDO', R: 'REAL ENVIDO', F: 'FALTA ENVIDO', 2: 'TRUCO', 3: 'QUIERO RETRUCO', 4: 'QUIERO VALE CUATRO' })[c];
    const callLine = c => ({ E: 'envido', R: 'real', F: 'falta', 2: 'truco', 3: 'retruco', 4: 'vale4' })[c];
    async function present(ev, who) {
      for (const e of ev) {
        if (st.done) return;
        if (e.t === 'call') {
          const txt = callText(e.call); bannerSay('¡' + txt + '!', e.p === 0 ? '#9ad0ff' : '#f0c030');
          SND.tone(e.call === 'F' || e.call === 4 ? 330 : 440, 0.12, { type: 'square', vol: 0.07 }); SND.tone(e.call === 'F' || e.call === 4 ? 495 : 660, 0.2, { type: 'square', vol: 0.07, delay: 0.1 });
          if (e.p === 1) await rivalSay((e.primero ? 'El envido está primero. ' : '') + pickL(callLine(e.call))); else await meSay((e.primero ? 'El envido está primero. ' : '') + '¡' + txt.charAt(0) + txt.slice(1).toLowerCase() + '!');
          await wait(0.3);
        } else if (e.t === 'resp') {
          const q = e.a === 'Q';
          if (e.p === 1) await rivalSay(pickL(q ? 'quiero' : 'noQuiero')); else await meSay(q ? 'Quiero.' : 'No quiero.');
          SND.tone(q ? 600 : 300, 0.15, { type: 'triangle', vol: 0.08 });
          await wait(0.25);
        } else if (e.t === 'envido') {
          if (e.quiero) {
            const m = e.mano, pie = 1 - m;
            const decl = async (p, txt) => { if (p === 1) await rivalSay(txt, 1.8); else await meSay(txt, 1.8); await wait(0.5); };
            await decl(m, `Tengo ${e.vals[m]}${e.vals[m] >= 30 ? '.' : '.'}`);
            if (e.buenas) await decl(pie, pie === 1 ? pickL('buenas') : 'Son buenas.');
            else await decl(pie, `${e.vals[pie]} son mejores.`);
            if (e.winner === 0 && e.vals[1] !== undefined && !e.buenas) { /* nada */ }
            bannerSay(e.winner === 0 ? `ENVIDO PARA VOS +${e.pts}` : `ENVIDO PARA ${RSHORT.toUpperCase()} +${e.pts}`, e.winner === 0 ? '#9ad0ff' : '#f0c030');
          } else bannerSay(e.winner === 0 ? `+${e.pts} PARA VOS` : `+${e.pts} PARA ${RSHORT.toUpperCase()}`, e.winner === 0 ? '#9ad0ff' : '#f0c030');
          await wait(1.0);
        } else if (e.t === 'play') {
          const arr = handMeshes[e.p], idx = arr.findIndex(cm => cm.userData.card === e.card), cm = arr.splice(idx, 1)[0];
          const tp = tablePose(e.p, e.trick, (rnd() - 0.5));
          if (e.p === 1) { rivalAnim('play', 0.6); await wait(0.2); }
          moveCard(cm, tp.pos, tp.q, 0.38, 0, 0.07); cm.userData.played = { p: e.p, trick: e.trick }; cm.userData.big = 1.35;
          layoutHands(0.25);
          setTimeout(() => SND.noise(0.07, { freq: 2600, filter: 'highpass', vol: 0.25 }), 330);
          await wait(0.55);
        } else if (e.t === 'trick') {
          const w = e.res;
          if (w === 'P') { captionSay('Parda.', 1.2); SND.tone(400, 0.2, { type: 'triangle', vol: 0.05 }); }
          else {
            const cm = cards.find(c => c.userData.played && c.userData.played.trick === e.trick && c.userData.played.p === w);
            if (cm) { cm.userData.gl.visible = true; }
            SND.tone(w === 0 ? 784 : 330, 0.12, { type: 'square', vol: 0.05 });
          }
          refreshInfo();
          await wait(0.7);
        } else if (e.t === 'mazo') {
          if (e.p === 1) await rivalSay(pickL('mazo')); else await meSay('Me voy al mazo.');
        } else if (e.t === 'points') {
          drawScore();
          for (let k = 0; k < Math.min(e.n, 6); k++) SND.tone(e.p === 0 ? 900 + k * 60 : 500 - k * 30, 0.06, { type: 'square', vol: 0.05, delay: k * 0.08 });
        } else if (e.t === 'handEnd') {
          const why = { cartas: '', noquiero: ' (no quiso)', mazo: ' (al mazo)', 'señas': ' (te pescaron mirando)' }[e.reason] || '';
          await wait(0.4);
          bannerSay(e.winner === 0 ? `MANO PARA VOS +${e.pts}` : `MANO PARA ${RSHORT.toUpperCase()} +${e.pts}`, e.winner === 0 ? '#9ad0ff' : '#f0c030');
          if (why) captionSay(why.trim().replace(/[()]/g, ''), 1.6);
          await wait(1.3);
          if (!game.over && rnd() < 0.55) await rivalSay(pickL(e.winner === 1 ? 'ganaMano' : 'pierdeMano'));
        }
        refreshInfo();
      }
    }

    // ---- reparto y recogida de cartas
    async function dealHand() {
      const h = game.newHand(); dealer = 1 - h.mano; lookedThisHand = false;
      for (const c of cards) { c.userData.gl.visible = false; c.userData.played = null; c.userData.big = 1; }
      handMeshes = [[], []]; selIdx = 1;
      const dp = deckPos();
      cards.forEach((cm, k) => { setCardNow(cm, dp.clone().setY(dp.y + k * 0.002), deckQ); cm.visible = true; });
      for (const p of [0, 1]) h.hands[p].forEach((c, i) => { const cm = cards[p * 3 + i]; cm.userData.card = c; cm.userData.f.material = faceMat(c); handMeshes[p].push(cm); });
      refreshInfo();
      captionSay(h.mano === 0 ? 'Sos mano.' : `Es mano ${RSHORT}.`, 1.6);
      let k = 0;
      for (let i = 0; i < 3; i++) for (const p of [h.mano, 1 - h.mano]) {
        const cm = handMeshes[p][i], ps = handPose(p, i, 3, false);
        moveCard(cm, ps.pos, ps.q, 0.32, k * 0.13, 0.08); k++;
        setTimeout(() => SND.noise(0.05, { freq: 3000, filter: 'highpass', vol: 0.12 }), k * 130);
      }
      rivalAnim('think', 2);
      await wait(k * 0.13 + 0.5);
      // tic del rival: se toca el reloj si tiene 28 o más
      if (TELL && TR.envido(h.orig[1]) >= 28) setTimeout(() => { if (!st.done) rivalAnim('watch', 1.5); }, 700 + Math.random() * 1500);
    }
    async function collect() {
      const dp = deckPos();
      cards.forEach((cm, k) => { cm.userData.gl.visible = false; cm.userData.big = 1; moveCard(cm, dp.clone().setY(dp.y + k * 0.002), deckQ, 0.35, k * 0.04, 0.05); });
      await wait(0.7);
      cards.forEach(cm => { cm.visible = false; });
    }
    async function rivalThink() {
      rivalAnim('think', 9);
      const h = game.h;
      await wait(h.pending ? 0.8 + Math.random() * 0.9 : 0.6 + Math.random() * 0.8);
    }
    // ---- partida
    async function mainLoop() {
      await wait(0.6);
      st.titleCard(TITLE, INTRO, 4.2);
      await wait(4.4);
      const intro = [{ who: RNAME, text: pickL('saludo') }];
      if (APUESTA) intro.push({ who: '', text: 'Se juega: ' + APUESTA });
      if (SENAS) intro.push({ who: MOZA, text: `Mirame cuando quieras (tecla Y) y te paso lo que tiene. Pero no más de dos manos seguidas, que se avispa.` });
      else if (TELL) intro.push({ who: 'Dato', text: TELL });
      intro.push({ who: '', text: `Partida a ${TARGET} puntos, mano a mano, sin flor. ${TR.Game && game.nextMano === 0 ? 'Arrancás de mano.' : 'Arranca él de mano.'}` });
      rivalAnim('talk', 2);
      await st.talk(intro);
      st.showKeys(['[← →] elegir carta · [1 2 3] tirar', '[ESPACIO] jugar la elegida', '[E R F] envido · real · falta', '[T] truco/retruco/vale 4 · [Q N] quiero/no', '[M] irse al mazo' + (SENAS ? ' · [Y] mirar a ' + MOZA : '')], 14);
      while (!game.over && !st.done) {
        await dealHand();
        while (game.whoActs() !== null && !st.done) {
          const who = game.whoActs();
          let a;
          if (who === 1) { await rivalThink(); a = ai.decide(game); }
          else {
            a = await humanInput();
            if (a === '__look') { await lookAtYanina(); continue; }
          }
          const ev = game.act(who, a);
          await present(ev, who);
        }
        if (game.h.over && !lookedThisHand) lookStreak = 0; else if (lookedThisHand) lookStreak++;
        await wait(0.4);
        await collect();
      }
      if (st.done) return;
      const won = game.winner === 0;
      bannerSay(won ? '¡GANASTE LA PARTIDA!' : `GANÓ ${RSHORT.toUpperCase()}`, won ? '#9ad0ff' : '#ff8060');
      if (won) { [523, 659, 784, 1046, 1318].forEach((f, n) => SND.tone(f, 0.22, { type: 'square', vol: 0.06, delay: n * 0.11 })); rivalAnim('watch', 1.2); }
      else [392, 330, 262, 196].forEach((f, n) => SND.tone(f, 0.3, { type: 'triangle', vol: 0.07, delay: n * 0.16 }));
      await wait(1.6);
      await rivalSay(pickL(won ? 'pierde' : 'gana'), 3);
      await wait(1.5);
      await st.say('', won ? WIN_TXT : LOSE_TXT);
      const margin = game.scores[0] - game.scores[1];
      st.finish(won ? { ok: true, score: 400 + diff * 80 + margin * 25 + (SENAS ? 0 : 300), message: '¡Partida ganada!', data: { puntos: game.scores.slice(), manos: game.handNo, senas: SENAS } }
        : { ok: false, data: { puntos: game.scores.slice(), manos: game.handNo, reason: 'perdio' } });
    }
    mainLoop().catch(e => { console.error('patagonia', e); if (!st.done) st.finish({ ok: false, data: { error: String(e) } }); });

    // ---- mouse: click en las cartas de la mano
    const ray = new T.Raycaster(), mv = new T.Vector2();
    const onClick = e => {
      if (!myTurnToPlay()) return;
      const r = st.root.querySelector('canvas.cs3d-gl').getBoundingClientRect();
      mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam);
      const hits = ray.intersectObjects(handMeshes[0].map(c => c.userData.f));
      if (hits.length) { const i = handMeshes[0].findIndex(c => c.userData.f === hits[0].object); if (i >= 0) { if (i === selIdx) finishInput('play' + i); else { selIdx = i; layoutHands(0.15); SND.tone(700, 0.04, { vol: 0.04 }); } } }
    };
    const onMove = e => {
      if (!myTurnToPlay()) return;
      const r = st.root.querySelector('canvas.cs3d-gl').getBoundingClientRect();
      mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam);
      const hits = ray.intersectObjects(handMeshes[0].map(c => c.userData.f));
      if (hits.length) { const i = handMeshes[0].findIndex(c => c.userData.f === hits[0].object); if (i >= 0 && i !== selIdx) { selIdx = i; layoutHands(0.12); } }
    };
    st.root.addEventListener('mousedown', onClick); st.root.addEventListener('mousemove', onMove);

    // ---- cámara
    cam.rotation.order = 'YXZ';
    const camBase = new T.Vector3(0, 1.24, 0.74);
    const lookBase = new T.Vector3(0, 0.86, -0.6);
    const lookCur = lookBase.clone(), tmpV = new T.Vector3();
    let fovCur = 64;
    cam.position.copy(camBase); cam.lookAt(lookBase); cam.fov = fovCur; cam.far = 120; cam.updateProjectionMatrix();

    // ---- audio ambiente: murmullo, río y un chamamé lejano
    const murmur = SND.loop({ freq: 520, filter: 'bandpass', q: 0.8, vol: 0.03 });
    const river = SND.loop({ freq: 220, vol: 0.025 });
    const SCALE = [220, 247, 262, 294, 330, 349, 392, 440, 494, 523];
    let musT = 0, musStep = 0;
    const PROG = [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]];
    function music(dt) {
      musT -= dt; if (musT > 0) return; musT = 0.21;
      const ch = PROG[Math.floor(musStep / 12) % 4], beat = musStep % 6;
      if (beat === 0) SND.tone(SCALE[ch[0]] / 2, 0.35, { type: 'triangle', vol: 0.025 });
      if (beat === 3) SND.tone(SCALE[ch[1]] / 2, 0.25, { type: 'triangle', vol: 0.018 });
      if (beat !== 0 && Math.random() < 0.7) SND.tone(SCALE[ch[(beat + musStep) % 3]] * (Math.random() < 0.3 ? 2 : 1), 0.16, { type: 'sawtooth', vol: 0.009 });
      musStep++;
    }

    // ============================================================ actualización por cuadro
    function keyInput() {
      if (!inputReq) return;
      const n = game.h.hands[0].length;
      if (myTurnToPlay()) {
        if (st.hit('ArrowLeft', 'KeyA')) { selIdx = (selIdx + n - 1) % n; layoutHands(0.12); SND.tone(700, 0.04, { vol: 0.04 }); }
        if (st.hit('ArrowRight', 'KeyD')) { selIdx = (selIdx + 1) % n; layoutHands(0.12); SND.tone(700, 0.04, { vol: 0.04 }); }
        for (let i = 0; i < n; i++) if (st.hit('Digit' + (i + 1), 'Numpad' + (i + 1))) { selIdx = i; finishInput('play' + i); return; }
        if (st.action()) { finishInput('play' + selIdx); return; }
      }
      const map = { KeyE: 'E', KeyR: 'R', KeyF: 'F', KeyT: 'T', KeyQ: 'Q', KeyN: 'N', KeyM: 'M', KeyY: 'Y' };
      for (const k in map) if (st.hit(k)) { uiAction(map[k]); return; }
      if (game.h.pending && st.action()) uiAction('Q');
    }
    function animRival(dt, t) {
      RA.t += dt;
      const k = RA.dur ? U.clamp(RA.t / RA.dur, 0, 1) : 1, ud = RD;
      let aLx = -1.05, aLz = 0.32, aRx = -1.05, aRz = -0.32, hx = 0.28, hy = 0, ty = 0, tz = 0;
      if (RA.mode === 'play') { const s = Math.sin(k * Math.PI); aRx = -1.05 - s * 0.55; aRz = -0.32 + s * 0.2; hx = 0.35; }
      else if (RA.mode === 'talk') { hx = 0.02 + Math.sin(t * 9) * 0.04; hy = Math.sin(t * 2.3) * 0.08; }
      else if (RA.mode === 'think') { hx = 0.34 + Math.sin(t * 1.1) * 0.03; hy = Math.sin(t * 0.7) * 0.05; }
      else if (RA.mode === 'watch') { const s = Math.sin(k * Math.PI); aLx = -1.05 - s * 0.35; aLz = 0.32 + s * 0.25; aRx = -1.05 - s * 0.2; aRz = -0.32 - s * 0.25; hx = 0.3 + s * 0.15; hy = s * -0.25; }
      else if (RA.mode === 'turn') { const s = Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * (k > 0.8 ? (1 - k) * 5 : 1); ty = s * 1.6; hy = s * 0.9; hx = 0.05; }
      if (RA.dur && RA.t >= RA.dur && RA.mode !== 'idle') { RA.mode = 'idle'; RA.dur = 0; }
      const D = (o, prop, v) => { o.rotation[prop] = U.damp(o.rotation[prop], v, 10, dt); };
      D(ud.armL, 'x', aLx); D(ud.armL, 'z', aLz); D(ud.armR, 'x', aRx); D(ud.armR, 'z', aRz);
      D(ud.head, 'x', hx); D(ud.head, 'y', hy); D(ud.torso, 'y', ty);
      ud.torso.position.y = 0.9 + Math.sin(t * 1.6) * 0.008;
      // las cartas del rival siguen sus manos
      const hp = new T.Vector3(); ud.armR.updateWorldMatrix(true, false); ud.armR.localToWorld(hp.set(0, -0.6, 0.05));
      const lp = new T.Vector3(); ud.armL.localToWorld(lp.set(0, -0.6, 0.05));
      rivHand.position.copy(hp.add(lp).multiplyScalar(0.5));
    }
    function rivalAnim(mode, dur) { if (RA.mode === 'turn' && RA.t < RA.dur && mode !== 'turn') return; RA.mode = mode; RA.t = 0; RA.dur = dur; }

    st.objective(`<b>${TITLE.toUpperCase()}</b><br>${GOAL}`);
    refreshInfo();
    let blinkT = 3;
    return {
      update(dt, t) {
        for (let i = waits.length - 1; i >= 0; i--) if (st.t >= waits[i].until) { const w = waits[i]; waits.splice(i, 1); w.r(); }
        if (!st.busy) keyInput();
        refreshButtons();
        // tweens de cartas
        for (const cm of cards) {
          const tw = cm.userData.tw; if (!tw) continue;
          tw.t += dt; if (tw.t < 0) continue;
          const k = U.clamp(tw.t / tw.dur, 0, 1), e = U.ease(k);
          cm.position.lerpVectors(tw.p0, tw.p1, e); cm.position.y += Math.sin(k * Math.PI) * tw.arc;
          cm.quaternion.slerpQuaternions(tw.q0, tw.q1, e);
          const sc = U.lerp(cm.scale.x, cm.userData.big || 1, e); cm.scale.setScalar(sc);
          if (k >= 1) cm.userData.tw = null;
        }
        // las cartas del rival siguen sus manos (pose relativa)
        animRival(dt, t);
        // la moza: limpia, mira, hace señas
        YD.armR.rotation.x = U.damp(YD.armR.rotation.x, looking ? -0.2 : -0.5 + Math.sin(t * 3) * 0.25, 6, dt);
        YD.head.rotation.y = U.damp(YD.head.rotation.y, looking ? 0.3 : Math.sin(t * 0.4) * 0.4, 4, dt);
        YD.torso.position.y = 0.9 + Math.sin(t * 1.3) * 0.006;
        if (!looking) { blinkT -= dt; if (blinkT < 0) { setFace('parpadeo'); if (blinkT < -0.12) { setFace('neutral'); blinkT = 2 + Math.random() * 3; } } }
        // parroquianos
        for (const pt of patrons) { const ud = pt.p.userData; ud.head.rotation.y = Math.sin(t * pt.sp + pt.ph) * 0.5; ud.head.rotation.x = Math.sin(t * pt.sp * 1.7 + pt.ph) * 0.08; ud.armR.rotation.x = -0.9 - Math.max(0, Math.sin(t * 0.3 + pt.ph) - 0.85) * 6; }
        // cámara (sentado: respira; mirar a la moza: zoom)
        if (looking) { lookT += dt; YD.head.updateWorldMatrix(true, false); YD.head.getWorldPosition(tmpV); tmpV.y += 0.18; lookCur.lerp(tmpV, 1 - Math.exp(-4 * dt)); fovCur = U.damp(fovCur, 13, 3.5, dt); }
        else { lookCur.lerp(lookBase, 1 - Math.exp(-4 * dt)); fovCur = U.damp(fovCur, 64, 4, dt); }
        cam.position.set(camBase.x + Math.sin(t * 0.5) * 0.006, camBase.y + Math.sin(t * 0.9) * 0.004, camBase.z);
        cam.lookAt(lookCur);
        if (Math.abs(cam.fov - fovCur) > 0.01) { cam.fov = fovCur; cam.updateProjectionMatrix(); }
        // HUD temporales
        if (bubbleT > 0) { bubbleT -= dt; if (bubbleT <= 0) show(bubble, false); }
        if (meT > 0) { meT -= dt; if (meT <= 0) show(meEl, false); }
        if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) show(banner, false); }
        if (capT > 0) { capT -= dt; if (capT <= 0) show(caption, false); }
        music(dt); murmur.set(0.028); river.set(0.022);
      },
      dispose() {
        disposed = true;
        st.root.removeEventListener('mousedown', onClick); st.root.removeEventListener('mousemove', onMove);
        st.renderer.autoClear = true;
        const seen = new Set(), disp = o => { if (o && !seen.has(o) && o.dispose) { seen.add(o); try { o.dispose(); } catch (e) {} } };
        far.traverse(o => { disp(o.geometry); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { for (const k in m) if (m[k] && m[k].isTexture) disp(m[k]); disp(m); } });
        for (const k in faceMats) { disp(faceMats[k].map); disp(faceMats[k]); }
        disp(backT); disp(backMat); disp(cardGeo); disp(glowGeo); disp(glowMat);
      },
    };
  }
})();
