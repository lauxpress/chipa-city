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

  function createScene(st, opts) {
    return {};
  }
})();
