# Chipa City — Etapa 2: misiones, escenas 3D y gráficos

Documento de trabajo del equipo. Lo mantiene el orquestador; cada agente lee esto antes de empezar.

## El juego hoy

- Top-down estilo GTA 1/2 sobre el mapa real de Corrientes (OSM + Microsoft + Google Open Buildings). Corre en el navegador sin build ni dependencias externas (Three.js r149 está en `game/vendor/three.min.js`).
- `game/map.js` — datos generados por `tools/build_map.py` (`window.MAPDATA`: tiles RLE, red vial, edificios, props, puentes, recorridos de colectivos).
- `game/game.js` — lógica (IIFE): tiles de 2,25 m = 12 px (`TS = 12`, 5,33 px por metro en horizontal), autos, peatones, policía, armas, HUD, minimapa, chunks de piso dibujados en canvas 2D.
- `game/render3d.js` — render 3D con Three.js (cámara perspectiva cenital, FOV 32): piso = canvases de chunk como textura, edificios extruidos, landmarks, puente, faroles, props. Escala vertical: `FLOOR = 10` px por 3 m (`MPX = 10/3` px por metro en altura).
- `game/landmarks.js` — fichas de edificios emblemáticos (por nombre de OSM o puestos a mano en build_map.py).
- `game/index.html` — canvases `#screen` (2D) y `#screen3d` (WebGL), HUD en DOM, título.
- Para probar: `python -m http.server 8765 --directory game` → http://localhost:8765 (ya suele estar corriendo).
- Consola: `window.__freeze = true` pausa; `window.__game` expone estado; `__game.R3.render()` dibuja un frame.
- Idioma de todo el texto del juego y comentarios: español rioplatense (voseo), con sabor correntino.

## API para módulos: `window.Chipa`

Se crea al final de game.js (evento `chipa-ready`). Los módulos nuevos se cargan **después** de game.js.

| Campo | Qué es |
|---|---|
| `hooks.update` | array de `f(dt)`: se llaman en cada paso de simulación (60/s) mientras se juega |
| `hooks.interact` | array de `f(playerCar)`: al apretar ENTER/F. Si una devuelve `true`, se consume (no roba/baja del auto) |
| `hooks.keydown` | array de `f(e)`: si devuelve `true` el juego no procesa la tecla |
| `hooks.render2d` | reservado (modo 2D sin WebGL) |
| `markers` | array de `{x, y, color, label, r}` (px del mundo). El minimapa los dibuja (en el borde si están lejos); el render 3D los muestra como columnas de luz |
| `openModal(owner)` / `closeModal()` | pantalla completa propia (escena 3D, minijuego): pausa y oculta el mundo; el módulo dibuja en su propio canvas y maneja sus teclas |
| `player`, `cars`, `peds`, `cam`, `MD`, `TS`, `VTYPE`, `CAR_COLORS`, `WEAPONS`, `BLD` | estado vivo |
| `graph` | red vial: `nx, ny` (nodos en px), `ea, eb, ef, edx, edy, elen, out, DRIVE_EDGES` (aristas) |
| `tileAt, tileAtPx, solidPx, SOLID, T` | tiles |
| `makeCar(x, y, a, {type, color, spr, mode, npc})`, `makePed`, `killPed`, `explode`, `damageCar`, `crime(n)`, `wantedLevel()`, `clearPolice()`, `showMsg(text, secs, big)`, `sfx`, `respawn` | acciones |
| `carSprite, busSprite, sportSprite, motoSprite, pedSprites, randomOutfit` | sprites (canvas) |
| `nearestDriveEdge, nearestNode, findPath(sx,sy,tx,ty), streetName(x,y), lanePoint, laneInfo` | navegación |
| `ll2px(lat, lon)` → `[x, y]`, `px2ll(x, y)`, `metersToPx(m)` | coordenadas |
| `isDown(...codes)`, `wasHit(...codes)` | teclado (KeyboardEvent.code) |
| `teleport(x, y)` | mueve al jugador (o su auto) y la cámara |

Vehículos nuevos: agregá la entrada a `Chipa.VTYPE` (`{w, l, maxv, acc, grip}` en px) y pasá tu propio sprite en `makeCar(..., {type, spr})`. El sprite es un canvas de `w × l` px mirando hacia la derecha (+x)… copiá la convención de `carSprite` en game.js.

## Reparto de archivos (para no pisarnos)

| Agente | Es dueño de | No toca |
|---|---|---|
| Guionista | `docs/misiones.md`, `game/missions_data.js` | código del motor |
| Misiones (motor) | `game/missions.js`, `game/index.html` (agrega los `<script>` y el CSS del HUD de misiones) | game.js, render3d.js |
| Escenas 3D | `game/scenes.js` (+ `game/scenes/*` si hace falta) | game.js, render3d.js, index.html |
| Fútbol | `game/futbol.js` | game.js, render3d.js, index.html |
| Gráficos | `game/render3d.js`; en `game/game.js` SOLO las secciones TEXTURAS, EDIFICIOS (dibujo 2D de techos) y CHUNKS (`buildChunk`, `getChunk`) | el resto de game.js |
| Mapa | `tools/build_map.py`, `game/landmarks.js`, `game/map.js` (regenerado) | game.js, render3d.js |
| Orquestador | el resto de `game/game.js` (IA, cámara, API), integración | — |

Nadie hace commits: el orquestador integra y commitea. Si necesitás algo de un archivo ajeno, dejalo anotado en tu informe final ("pedido al orquestador: ...").

## Catálogo de escenas y minijuegos (ids compartidos)

Las misiones los llaman por id; el módulo devuelve una Promise con el resultado.

`Chipa.scenes.play(id, opts)` → `Promise<{ok: boolean, score?, data?}>` (scenes.js)

| id | Qué es | Vista |
|---|---|---|
| `casa_gobierno` | Interior de la Casa de Gobierno: salones, despachos, expedientes. Puzzle (encontrar/ordenar expedientes, abrir la caja fuerte con pistas) | tercera persona |
| `patagonia` | Bar/cervecería Patagonia en la Costanera: partida de **truco** por turnos contra un personaje | primera persona en la mesa |
| `trabajo` | Oficina del jugador (manzana Bolívar / Belgrano / P. Borgatti / Don Bosco): briefing + puzzle de tablero eléctrico | tercera persona |
| `tunel` | Túneles coloniales bajo las iglesias (entrada en La Merced / Cruz de los Milagros): laberinto con antorcha, trampas y salida al río | primera persona (dungeon crawler) |
| `higuera` | Cuevas bajo las raíces de la Higuera de la India del Parque Mitre: tesoros de la Guerra de la Triple Alianza | tercera persona |
| `santuario` | Altarcito rojo del Gauchito Gil: ofrenda y acertijo | tercera persona |

`Chipa.futbol.play(opts)` → `Promise<{ok, golesJugador, golesRival}>` (futbol.js): fútbol 5 o 7 visto desde arriba, una tecla patea y otra pasa.

## Tipos de jugabilidad en el mundo (motor de misiones)

Pasos que entiende `missions.js` (el guionista escribe las misiones con estos pasos; si hace falta otro, se agrega al motor):

`talk` (diálogo con retrato), `goto` (ir a un lugar, a pie o en vehículo), `vehicle` (subir a un vehículo de misión: `colectivo`, `basurero`, `remis`, `dpec`, o el que sea), `route` (recorrido con paradas y tiempo: colectivo en paradas, basurero juntando bolsas), `taxi` (levantar pasajero y llevarlo, con humor del pasajero), `collect` (juntar objetos en el mapa), `cables` (camioneta de la DPEC: frenar en postes y cortar cables manteniendo una tecla), `chase` (seguir o alcanzar un vehículo), `escape` (perder a la policía), `scene` (escena 3D por id), `futbol`, `timer`, `choice` (elección con consecuencias).

## Lugares (lat, lon)

- Casa de Gobierno: -27.4631, -58.8387 (verificar con OSM / `BLD` por nombre)
- Parque Mitre (Gomero/Higuera de la India): -27.45939, -58.82938
- Plaza de la Cruz: -27.47110, -58.84005; Iglesia de la Cruz de los Milagros: -27.47231, -58.84022 (Buenos Aires, Salta, Bolívar, Belgrano)
- Patagonia (jardín cervecero): Costanera y Tomás Edison, -27.46934, -58.85410
- Estadio de Huracán: -27.48373, -58.82983
- Trabajo del jugador: manzana Bolívar / Belgrano / Padre Borgatti / Don Bosco
- Casa del jugador: Guido Spano y Vélez Sarsfield
- Puente General Belgrano, La Unidad, Costanera (Marriott, Torre Ribera), IOSCor, estación de servicio 3 de Abril y Blas de la Vega

Las coordenadas aproximadas hay que confirmarlas con `Chipa.BLD` (buscar por `name`) o con los nodos de OSM.

## Formato de `game/missions_data.js` (contrato guionista ↔ motor)

```js
window.MISSIONS = [
  {
    id: 'm01_remis',            // único
    n: 1,                       // orden (dificultad ascendente: 1 = tutorial … 10 = final)
    title: 'El remís de Doña Chela',
    tagline: 'Una línea para el menú',
    giver: { name: 'Doña Chela', at: [-27.46, -58.83], look: { skin: '#c89a70', hair: '#3a2a1a', shirt: '#d84a8a', pants: '#2a2a4a' } },
    unlock: [],                 // ids de misiones previas necesarias
    reward: { money: 500 },
    steps: [ /* pasos, en orden */ ],
  },
];
// Lugares con nombre que pueden usar los pasos en vez de coordenadas:
window.MISSION_PLACES = { casa_gobierno: [-27.4631, -58.8387], /* ... */ };
```

Un lugar (`at`) es `[lat, lon]` o el nombre de una entrada de `MISSION_PLACES`. Campos comunes opcionales de cualquier paso: `hint` (texto del objetivo en el HUD), `time` (segundos límite; si se acaba, la misión falla), `onFail` (texto).

| `type` | Campos |
|---|---|
| `talk` | `who`, `lines: [string]` (o `[{who, text}]` para conversación), `look` opcional |
| `goto` | `at`, `r` (m, def. 12), `mode`: `'foot'` / `'vehicle'` / `'any'` |
| `vehicle` | `kind`: `colectivo` / `basurero` / `remis` / `dpec` / `patrullero` / `any`, `at` (dónde aparece), `line` (para colectivo) |
| `route` | `stops: [{at, wait (s), label}]`, `kind`: `colectivo` (frenar y esperar en la parada) o `basura` (frenar al lado de las bolsas), `maxDamage` opcional |
| `taxi` | `pickup: at`, `dropoff: at`, `passenger: {name, look, mood: 'apurado'/'mareado'/'charlatán'/...}`, `lines: {start, mid, end}` |
| `collect` | `items: [{at, label}]`, `mode`, `icon` |
| `cables` | `poles: [{at}]`, `hold` (s manteniendo ESPACIO al lado del poste) |
| `chase` | `target: {kind, from: at, to: at}`, `goal`: `'follow'` (no perderlo de vista) o `'catch'` (chocarlo hasta frenarlo) |
| `escape` | `stars` (nivel de búsqueda inicial) |
| `scene` | `id` (ver catálogo), `opts` (libre: dificultad, textos, etc.) |
| `futbol` | `opts: {rival, minutos, jugadores}` |
| `timer` | `secs`, `text` |
| `choice` | `prompt`, `options: [{text, set: {flag: valor}, goto: índice de paso opcional}]` |
| `cond` | `flag`, `then: índice de paso`, `else: índice de paso` |
