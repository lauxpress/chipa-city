// CHIPA CITY — controles táctiles (celular / tablet)
// Joystick a la izquierda + botones a la derecha. No toca la lógica del juego: cada control "aprieta" la misma tecla
// que el teclado (KeyboardEvent sintético), así funciona igual en la ciudad, las misiones, las escenas 3D y el fútbol.
// Aparece solo en pantallas táctiles (o con #touch en la URL). El botón 🎮 lo prende y apaga; se recuerda la elección.
'use strict';
(function () {
  const FORCE = /(^|[#&])touch\b/.test(location.hash);
  const TOUCH = FORCE || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  if (!TOUCH) return;
  const LS = 'chipacity.touch.v1';
  let on = true;
  try { on = localStorage.getItem(LS) !== 'off'; } catch (e) { /* sin storage */ }

  // ---------------------------------------------------------------- teclas sintéticas
  const held = {};
  function key(code, down) {
    if (!!held[code] === down) return;
    held[code] = down;
    const k = code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: k, bubbles: true, cancelable: true }));
  }
  const releaseAll = () => { for (const c in held) if (held[c]) key(c, false); const S = window.Chipa && Chipa.stick; if (S) S.on = false; };

  // ---------------------------------------------------------------- estilos
  const css = document.createElement('style');
  css.textContent = `
  #tc { position: fixed; inset: 0; z-index: 60; pointer-events: none; font-family: 'Press Start 2P', ui-monospace, monospace; }
  #tc * { -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
  #tc-stick { position: fixed; left: 0; bottom: 0; width: 50vw; height: 62vh; pointer-events: auto; touch-action: none; }
  #tc-base { position: fixed; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%; display: none;
    background: radial-gradient(circle, rgba(0,0,0,.18) 55%, rgba(0,0,0,.35) 56%); border: 3px solid rgba(244,240,216,.55); }
  #tc-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: rgba(240,192,48,.85); border: 3px solid #000; box-shadow: 0 0 0 2px rgba(244,240,216,.8); }
  #tc-ghost { position: fixed; left: 34px; bottom: 34px; width: 110px; height: 110px; border-radius: 50%;
    border: 3px dashed rgba(244,240,216,.35); color: rgba(244,240,216,.5); font-size: 8px; display: flex; align-items: center;
    justify-content: center; text-align: center; line-height: 1.6; }
  #tc-btns { position: fixed; right: 14px; bottom: 18px; width: 200px; height: 190px; }
  .tc-b { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; text-align: center; color: #fff; text-shadow: 2px 2px 0 #000; border: 3px solid #000;
    box-shadow: 0 0 0 2px rgba(244,240,216,.75), 3px 4px 0 rgba(0,0,0,.45); line-height: 1.5; }
  .tc-b.big { width: 84px; height: 84px; font-size: 9px; }
  .tc-b.a { right: 0; bottom: 40px; background: rgba(224,32,46,.82); }
  .tc-b.b { right: 96px; bottom: 0; background: rgba(32,64,176,.82); }
  .tc-b.sm { width: 46px; height: 46px; font-size: 7px; background: rgba(20,20,28,.72); border-radius: 12px; }
  .tc-b.down { filter: brightness(1.5); transform: scale(.93); }
  #tc-top { position: fixed; right: 12px; top: 156px; display: flex; flex-direction: column; gap: 8px; }
  #tc-top .tc-b { position: static; }
  #tc-toggle { position: fixed; z-index: 61; left: 10px; top: 104px; width: 40px; height: 32px;
    border-radius: 8px; font-size: 18px; line-height: 1; pointer-events: auto; touch-action: none; background: rgba(20,20,28,.7);
    border: 2px solid rgba(244,240,216,.6); display: flex; align-items: center; justify-content: center; }
  #tc-toggle.off { opacity: .55; }
  body.tc-on { touch-action: none; overscroll-behavior: none; }
  /* lo que estaba abajo pasa arriba para dejar lugar a los controles */
  body.tc-on #hint { display: none; }
  body.tc-on #minimap { top: 62px; bottom: auto; right: 10px; width: 88px; height: 88px; }
  body.tc-on #weapon { left: 12px; bottom: 160px; white-space: nowrap; }
  body.tc-on #speed { left: 12px; transform: none; bottom: 196px; }
  body.tc-on #credit { left: 8px; transform: none; max-width: 46vw; font-size: 8px; text-align: left; }
  body.tc-on #baresand { left: 10px; bottom: auto; top: 76px; }
  body.tc-on #baresand img { height: 18px; }
  body.tc-on #m-prompt, body.tc-on #m-sub, body.tc-on #m-dlg { bottom: 222px; left: 10px; right: 10px; }
  @media (max-width: 860px) { body.tc-on #m-hud { top: 156px; left: 10px; right: 66px; max-width: none; width: auto; } }
  @media (max-height: 520px) {
    #tc-stick { height: 100vh; width: 40vw; }
    #tc-top { top: 8px; right: auto; left: 50%; transform: translateX(-50%); flex-direction: row; }
    body.tc-on #m-prompt, body.tc-on #m-sub, body.tc-on #m-dlg { bottom: 70px; left: 170px; right: 230px; }
    body.tc-on #weapon { left: 50%; transform: translateX(-50%); bottom: 44px; } body.tc-on #speed { left: 50%; transform: translateX(-50%); bottom: 18px; }
  }`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- DOM
  const root = document.createElement('div'); root.id = 'tc';
  root.innerHTML = `<div id="tc-stick"><div id="tc-ghost">MOVER<br>ACÁ</div></div><div id="tc-base"><div id="tc-knob"></div></div>
    <div id="tc-btns"><div class="tc-b big a" data-i="0"></div><div class="tc-b big b" data-i="1"></div></div><div id="tc-top"></div>`;
  const toggle = document.createElement('div'); toggle.id = 'tc-toggle'; toggle.textContent = '🎮'; toggle.title = 'Controles táctiles';
  document.body.appendChild(root); document.body.appendChild(toggle);
  const $ = id => document.getElementById(id);
  const stick = $('tc-stick'), base = $('tc-base'), knob = $('tc-knob'), ghost = $('tc-ghost'), top = $('tc-top');
  const big = [...root.querySelectorAll('.tc-b.big')];

  // ---------------------------------------------------------------- joystick (aparece donde apoyás el pulgar)
  let sid = null, sx = 0, sy = 0;
  const DIRS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  function setDir(dx, dy) {
    const R = 54, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const nx = dx / R, ny = dy / R, dead = 0.32;
    key('ArrowLeft', nx < -dead); key('ArrowRight', nx > dead);
    key('ArrowUp', ny < -dead * 1.25); key('ArrowDown', ny > dead * 1.25);
    // en la ciudad el juego usa el valor analógico: caminás / manejás hacia donde apunta el stick
    const S = window.Chipa && Chipa.stick;
    if (S) { S.on = true; S.x = nx * k; S.y = ny * k; }
  }
  const stickOff = () => { const S = window.Chipa && Chipa.stick; if (S) { S.on = false; S.x = S.y = 0; } };
  stick.addEventListener('pointerdown', e => {
    if (sid !== null) return;
    sid = e.pointerId; sx = e.clientX; sy = e.clientY; try { stick.setPointerCapture(sid); } catch (_) { /* puntero sintético */ }
    base.style.left = sx + 'px'; base.style.top = sy + 'px'; base.style.display = 'block'; ghost.style.display = 'none';
    setDir(0, 0); e.preventDefault();
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) { setDir(e.clientX - sx, e.clientY - sy); e.preventDefault(); } });
  const stickUp = e => {
    if (e.pointerId !== sid) return;
    sid = null; base.style.display = 'none'; knob.style.transform = '';
    for (const c of DIRS) key(c, false);
    stickOff();
  };
  stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);

  // ---------------------------------------------------------------- botones (cambian según dónde estás)
  // [código, etiqueta]; la etiqueta puede ser función
  const inCar = () => !!(window.Chipa && Chipa.player && Chipa.player.car);
  const LAYOUTS = {
    world: { big: [['Space', () => inCar() ? 'FRENO' : 'TIRO'], ['Enter', () => inCar() ? 'BAJAR' : 'SUBIR']],
             small: [['Tab', 'MISIÓN'], ['KeyM', 'MAPA'], ['KeyQ', 'ARMA-'], ['KeyE', 'ARMA+'], ['Escape', 'ESC']] },
    scene: { big: [['Space', 'ACCIÓN'], ['Enter', 'OK']],
             small: [['KeyQ', '↺'], ['KeyE', '↻'], ['KeyH', 'AYUDA'], ['Escape', 'SALIR']] },
    futbol: { big: [['Space', 'PATEAR'], ['KeyX', 'PASE']],
              small: [['KeyC', 'BARRER'], ['KeyQ', 'CAMBIO'], ['Enter', 'OK'], ['Escape', 'PAUSA']] },
    title: { big: [['Enter', 'JUGAR'], ['Space', '']], small: [] },
  };
  let layout = null, smallEls = [];
  function context() {
    const CH = window.Chipa;
    if (!CH) return 'title';
    if (CH.futbol && CH.modal === CH.futbol) return 'futbol';
    if (CH.modal) return 'scene';
    if (CH.state !== 'play') return 'title';
    return 'world';
  }
  function bindBtn(el, getCode) {
    let pid = null, code = null;
    el.addEventListener('pointerdown', e => {
      if (pid !== null) return;
      code = getCode(); if (!code) return;
      pid = e.pointerId; try { el.setPointerCapture(pid); } catch (_) { /* puntero sintético */ } el.classList.add('down');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) { /* nada */ }
      key(code, true); e.preventDefault(); e.stopPropagation();
    });
    const up = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('down'); if (code) key(code, false); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  big.forEach((el, i) => bindBtn(el, () => layout && LAYOUTS[layout].big[i] && LAYOUTS[layout].big[i][0]));
  const lbl = l => typeof l === 'function' ? l() : l;
  function refresh() {
    const ctx = context();
    if (ctx !== layout) {
      layout = ctx; releaseAll();
      top.innerHTML = ''; smallEls = LAYOUTS[ctx].small.map(([code, l]) => {
        const el = document.createElement('div'); el.className = 'tc-b sm'; el.textContent = lbl(l);
        bindBtn(el, () => code); top.appendChild(el); return el;
      });
    }
    const L = LAYOUTS[layout];
    big.forEach((el, i) => { const b = L.big[i]; const t = b ? lbl(b[1]) : ''; el.style.visibility = b && t ? '' : 'hidden'; if (el.textContent !== t) el.textContent = t; });
  }

  // tocar el cuadro de diálogo de una misión lo avanza
  document.addEventListener('pointerdown', e => {
    if (!on || !e.target.closest) return;
    if (e.target.closest('#m-dlg')) { key('Space', true); setTimeout(() => key('Space', false), 60); }
  });

  // ---------------------------------------------------------------- prender / apagar
  function apply() {
    root.style.display = on ? '' : 'none';
    toggle.classList.toggle('off', !on);
    document.body.classList.toggle('tc-on', on);
    if (!on) releaseAll();
    try { localStorage.setItem(LS, on ? 'on' : 'off'); } catch (e) { /* nada */ }
    dispatchEvent(new Event('resize'));
  }
  toggle.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    on = !on; apply();
    // pantalla completa la primera vez que se prenden (en celular ayuda mucho); si el navegador no deja, sigue igual
    if (on && !document.fullscreenElement && document.documentElement.requestFullscreen && !FORCE)
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  // evitar el menú contextual / zoom por doble toque sobre el juego
  document.addEventListener('contextmenu', e => { if (on) e.preventDefault(); });
  document.addEventListener('dblclick', e => { if (on) e.preventDefault(); }, { passive: false });

  apply(); refresh();
  setInterval(() => { if (on) refresh(); }, 150);
  window.ChipaTouch = { key, get on() { return on; }, set on(v) { on = !!v; apply(); } };
})();
