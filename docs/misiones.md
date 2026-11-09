# Chipa City — Biblia de misiones

Documento del guionista. El texto definitivo de cada diálogo y los datos que lee el motor están en
`game/missions_data.js` (formato de `docs/EQUIPO.md`). Acá están el tono, los personajes, el hilo de la historia,
el diseño de cada misión y la base real de lo que se cuenta.

---

## 1. Tono

- **Humor de adentro, cariñoso.** Nos reímos *con* Corrientes, nunca *de* los correntinos: la siesta sagrada, el calor
  ("jhaku"), el chipá como moneda de cambio, el tereré con yuyos, la rivalidad Ara Berá / Sapucay, el bocinazo al
  pasar por un altar del Gauchito, la tía que todo lo arregla con un "ndeee".
- **Misterio con base real.** Las leyendas (túneles, Pombero, Pora, plata enterrada) y la historia del siglo XIX
  (fundación de 1588, ocupación paraguaya de 1865) están contadas como las cuenta la gente: con respeto y un guiño.
- **Sátira política genérica.** El villano es un *Ministro de Obras Truchas* inventado, con licitaciones de
  licitaciones, ñoquis, punteros y expedientes que desaparecen. **Ningún personaje representa a una persona real.**
  No hay crímenes reales, víctimas reales ni tragedias recientes. Los cargos son genéricos y los nombres, de chiste.
- **Diálogos cortos.** Una o dos oraciones por globo. Voseo rioplatense con palabras correntinas y guaraní
  mezclado. Los objetivos del HUD van en MAYÚSCULAS y empiezan con verbo: "SUBÍ AL REMÍS", "PERDÉ A LA POLICÍA".

### Glosario (para que todo el equipo lo use igual)

| Palabra | Uso en el juego |
|---|---|
| **che / chamigo** | "che amigo". Saludo de confianza. |
| **mitaí** | "chico", "pibe" (guaraní *mitã'i*). Así le dicen al jugador las señoras. |
| **gurí / gurises** | chico / chicos. |
| **ndeee** | asombro, admiración o reproche, según la entonación. |
| **nderakore** | exclamación de disgusto o sorpresa fuerte ("¡pucha!"). Usarla poco, en momentos de golpe. |
| **añamembuí** | insulto suave ("hijo del diablo"), de enojo cómico. Reservado para villanos chascos. |
| **jhaku** | calor, "qué calor" (guaraní *haku*). |
| **pora / póra** | aparecido, espíritu que cuida un tesoro; la "luz mala". |
| **mbareté** | fuerza, poder; "el que tiene la manija". Apodo del puntero. |
| **sapucay** | el grito largo del chamamé, de alegría o desahogo. Cierra el juego. |
| **plata yvyguy** | "plata bajo tierra": tesoros enterrados en tiempos de la Guerra Grande. |

---

## 2. Personajes recurrentes (todos inventados)

| Personaje | Quién es | Misiones |
|---|---|---|
| **Ña Cata** (Catalina Aquino) | Remisera veterana, dueña de un remís con chamamé a todo volumen. La tía postiza del jugador. Resuelve todo con mate y chipá. | 1, 7, 9, 10 |
| **Profe Galarza** | Profesor de historia jubilado, obsesionado con los túneles. Tiene la carta de Fray Benicio. Valiente con la boca, con la presión alta. | 1, 4, 6, 9, 10 |
| **Fray Benicio** | Fraile franciscano (ficticio) de 1865. Escondió por los túneles lo que los vecinos le confiaron durante la ocupación. Solo aparece en cartas, en su diario y en el plano. | hilo |
| **Ministro Licinio Sobreprecio** | *Ministro de Obras Truchas*. Quiere talar el Parque Mitre para hacer el "Paseo Subterráneo del Bicentenario" y quedarse con el tesoro. | 2 (voz), 10 |
| **Lic. Ñoquetti** | Asesor del Ministro. "Catorce cargos, no va a ninguno". Juega al truco en el Patagonia y hace trampa con las señas. | 6 |
| **Chiquito Mbareté** | Puntero del Ministro. Dos metros, cero vergüenza. Lleva colgada la llave de la cripta. | 2, 4, 5, 8 |
| **Rulo** | Colectivero de la 108, amigo del jugador. | 2, 8 |
| **Don Abundio** | Promesero del Gauchito Gil; levantó un altarcito en Av. Maipú y Necochea. | 3 |
| **Gladys** | Recolectora de residuos, filosofía de tereré. Le saca foto a todo. | 4, 8, 10 |
| **El Inge** | El jefe en el laburo. | 5 |
| **Yanina** | Moza del Patagonia. Sabe más de truco que todos. | 6 |
| **Tadeo** | Sobrino del Profe, 15 años, juega de 9 (o de lo que falte) en el barrio Huracán. | 8, 10 |
| **Don Eulogio** | Sacristán de la Cruz de los Milagros. "Yo no vi nada". | 9 |
| **El Pombero** | Hombrecito peludo de sombrero de paja que vive en los túneles. Si le das tabaco, te guía; si no, te hace travesuras. | 9 |
| **La Pora** | Luz mala que cuida el tesoro bajo la Higuera. No castiga al que busca: castiga al codicioso. | 10 |

Los colores de retrato (`look`) están en `LOOK` y `window.MISSION_CAST` dentro de `missions_data.js`.

---

## 3. El hilo: "Lo de todos"

> **Abril de 1865.** La flota paraguaya entra al puerto de Corrientes y la ciudad queda ocupada. Los vecinos le
> confían a Fray Benicio la plata de las iglesias y sus ahorros. El fraile la lleva por los túneles que, según
> cuentan, unen la Cruz de los Milagros, la Merced, el Cabildo y San Francisco con el río, y la esconde bajo el árbol
> grande de la punta, donde hoy está el Parque Mitre. Deja un plano y una frase: *"Donde la cruz no ardió, la tierra
> se abre"*.
>
> **Hoy.** El Ministro de Obras Truchas consiguió el plano del Archivo y quiere talar el parque con una licitación
> trucha para quedarse con el tesoro. El jugador, a fuerza de changas (remís, colectivo, basurero, laburo), va juntando
> las piezas: la carta (1), el acertijo del Gauchito (3), la fotocopia del plano (4), la llave del Archivo (6), el plano
> original (7), la llave de la cripta (8), el camino por los túneles (9) y, al final, el cofre bajo la Higuera (10),
> que termina en el Museo Histórico.

Cada pieza que se consigue se usa más adelante:

| Pieza | Se consigue en | Se usa en |
|---|---|---|
| Sobre con la frase de Fray Benicio | 1 (lo olvida el Profe en el remís) | 7, 9, 10 (símbolo "cruz") |
| Regla "seguí el agua y no el brillo" | 3 (acertijo del Gauchito) | 9 (trampas del túnel), 10 (símbolo "agua") |
| Último cigarro (flag `tabaco_pombero`) | 3 (elección) | 9 (el Pombero ayuda o molesta) |
| Fotocopia del plano + licitación 0001 (flag `honesto`) | 4 (bolsa de basura + elección) | 10 (epílogo) |
| Llave del Archivo | 6 (truco) | 7 |
| Plano original + combinación 3-13-25 | 7 (expedientes y caja fuerte) | 9, 10 (símbolo "árbol") |
| Llave de la cripta ("1730") | 8 (fútbol + persecución) | 9 |

---

## 4. Curva de dificultad

| # | Título | Jugabilidad principal | Presión | Dificultad |
|---|---|---|---|---|
| 1 | Bautismo de remís | `taxi` (remís) | ninguna | 1 |
| 2 | La 108 no espera | `route` colectivo | tiempo holgado, daño máx. 40% | 2 |
| 3 | Promesa colorada | `collect` + escena `santuario` | 5 min, acertijo | 3 |
| 4 | Bolsas del Ministerio | `route` basura + `choice` | 5:30, daño máx. 50% | 4 |
| 5 | Colgados en tres barrios | escena `trabajo` + `cables` + `escape` | 6 min para 6 postes, 1★ | 5 |
| 6 | Truco en el Patagonia | `goto` contra reloj + escena `patagonia` + `chase` follow | 2:30 para llegar, truco nivel 5-7, seguimiento 3 min | 6 |
| 7 | Expediente 1865 | escena `casa_gobierno` (sigilo + puzzle) + `escape` | 5 min adentro, 2★ | 7 |
| 8 | La Copa Sobreprecio | `futbol` + `chase` catch | rival sucio y árbitro comprado, 2:30 para alcanzar | 8 |
| 9 | Donde la cruz no ardió | `goto` contra reloj + escena `tunel` + `escape` | 1:30 para llegar, dungeon nivel 8-9, 3★ | 9 |
| 10 | Lo de todos | `goto` + `chase` catch + escena `higuera` + `escape` | 1:40, 2:00, 6 min bajo tierra, 4★ | 10 |

Reglas de la curva: cada misión agrega **una** cosa nueva (tiempo, daño, policía, sigilo, combinación de pasos) y no
repite el mismo plato principal. La policía aparece recién en la 5 con una estrella y sube de a una: 1, 2, 3, 4.

---

## 5. Las misiones

### Misión 1 · Bautismo de remís (dificultad 1, tutorial)

- **Da:** Ña Cata, Plaza 25 de Mayo. **Premio:** $500.
- **Historia:** Al chofer de Ña Cata "lo perdió" la Fiesta del Chamamé. Ella te presta el remís para un viaje corto:
  el Profe Galarza, del Museo Histórico a la Cruz de los Milagros. En el viaje el Profe cuenta la leyenda de la cruz de
  urunday que no se quemó. Al bajar se olvida un sobre viejo: *"Donde la cruz no ardió, la tierra se abre. Fr. Benicio, 1865"*.
- **Jugabilidad:** `vehicle remis` → `taxi` (pasajero charlatán, ~700 m) → `goto` para devolver el auto.
- **Enseña:** subir/bajar, manejar, frenar en un punto, leer el HUD y el marcador.
- **Guion clave:**
  - Ña Cata: "Más o menos es sí."
  - Profe: "Sin apuro, que la cruz espera desde 1588."
  - Vos: "Nderakore..." (al leer el sobre)
- **Notas de diseño:** sin tiempo, sin policía, sin daño máximo. El tráfico normal alcanza como obstáculo. Si el
  jugador choca, el Profe solo se queja ("¡Ay, mi cadera colonial!").

### Misión 2 · La 108 no espera (dificultad 2)

- **Da:** Rulo, en la terminal del Puerto. **Premio:** $800.
- **Historia:** A Rulo lo voltea el calor. Hacés su vuelta de la 108 por el centro. Suben dos comparseras de Ara Berá y
  Sapucay discutiendo quién ganó, un vendedor de chipá y un grandote de camisa verde que habla por teléfono con "el
  Ministro" sobre talar el Parque Mitre: es Chiquito Mbareté, que aparece por primera vez.
- **Jugabilidad:** `vehicle colectivo` (línea 108) → `route colectivo` de 7 paradas reales, siguiendo el tramo céntrico
  del recorrido de la 108 (Costanera, Tucumán, 9 de Julio, Salta, San Martín, Don Bosco, Av. 3 de Abril), 7 minutos,
  daño máximo 40% → volver al Puerto.
- **Enseña:** frenar con precisión y esperar quieto; manejar un vehículo largo.
- **Notas:** los diálogos de pasajeros están después del recorrido; si el motor puede, conviene soltarlos de a uno
  en las paradas 2, 4, 5 y 6 (ver Notas para el motor).

### Misión 3 · Promesa colorada (dificultad 3)

- **Da:** Don Abundio, en su altarcito (Av. Maipú y Necochea, cerca de Huracán). **Premio:** $1000.
- **Historia:** Don Abundio le debe una ofrenda al Gauchito Gil, que le curó la rodilla, y la rodilla ya no lo deja
  ir al centro. Le juntás vela roja, cintas rojas, banderín, cigarros y chipá antes de que caiga el sol. En el
  santuario, el Gauchito "habla" con un acertijo que te deja la regla para los túneles.
- **Jugabilidad:** `collect` de 5 objetos en Catedral, Mercado Municipal, Av. 3 de Abril y Córdoba, Plaza Torrent y
  Plaza La Cruz (5 min) → escena **`santuario`**, nivel 3 → `choice` sobre el último cigarro.
- **Escena `santuario`:** poner cada ofrenda en su lugar (vela frente a la imagen, cintas en el espinillo, banderín en
  el mástil, cigarros y chipá en el plato) y responder el acertijo:
  *"Bajo la tierra camino sin pies, del río vengo y al río voy..."* → **el agua**. Revelación: **"En lo oscuro, seguí
  el agua y no el brillo"**. Todos los textos, pistas e intentos están en `opts`.
- **Elección:** guardarte un cigarro (`tabaco_pombero = true`) o dejárselo todo al Gauchito. Ninguna está mal; la
  primera ayuda en la misión 9 ("dicen que en los túneles hay otro que fuma").
- **Notas:** el tono es de respeto. No se ridiculiza la devoción: los chistes son de Don Abundio sobre sí mismo.
  Al irse, bocinazo (es costumbre real saludar así al pasar por un santuario del Gauchito).

### Misión 4 · Bolsas del Ministerio (dificultad 4)

- **Da:** Gladys, en el Parque Cambá Cuá. **Premio:** $1200 (+$1500 si vendés los papeles).
- **Historia:** Recolección en Camba Cuá a la hora de la siesta ("solo salimos nosotros y el Yasy Yateré"). En la
  última bolsa aparecen papeles picados del Ministerio: la "Licitación 0001: Paseo Subterráneo del Bicentenario.
  Desmonte total del Parque Mitre" y una fotocopia del plano de Fray Benicio.
- **Jugabilidad:** `vehicle basurero` → `route basura` de 10 bolsas en esquinas reales de Camba Cuá (5:30, daño 50%) →
  `choice` moral con dos ramas:
  - **Al Profe** (`honesto = true`): ir al Museo Histórico; el Profe cuenta 1865.
  - **A Chiquito** (`honesto = false`, +$1500): ir a la Plaza Cabral. Gladys ya les sacó foto con el celu, así que la
    historia sigue igual.
- **Notas:** la elección no castiga, cambia el epílogo de la misión 10. El Yasy Yateré es el petisito rubio de bastón de
  oro que se lleva a los chicos que no duermen la siesta: se nombra, no aparece (todavía).

### Misión 5 · Colgados en tres barrios (dificultad 5)

- **Da:** El Inge, en el laburo (manzana Bolívar / Belgrano / Padre Borgatti / Don Bosco). **Premio:** $1500.
- **Historia:** La DPEC le terceriza un trabajo a tu empresa: seis colgados enormes en tres zonas (Mercado, barrio
  Huracán, Parque Mitre) que alimentan el obrador del Ministro y un cartel LED de doce metros que dice "PRÓXIMAMENTE".
  Cuando los cortás, Chiquito llama a la policía diciendo que robaste la camioneta.
- **Jugabilidad:** escena **`trabajo`** (nivel 4): briefing con El Inge y puzzle de tablero tipo "pipes" (llevar la
  corriente de la ENTRADA 13,2 kV a la SALIDA PLAYÓN pasando por 3 térmicas, sin tocar cables rojos) → `vehicle dpec` →
  `cables` con 6 postes y 3 s de ESPACIO cada uno (6 min) → `escape` 1★ → devolver la camioneta al playón.
- **Notas:** cortar los colgados es trabajo legítimo: el jugador está del lado correcto y la cana llega por una denuncia
  falsa. Es la primera misión con policía.

### Misión 6 · Truco en el Patagonia (dificultad 6)

- **Da:** Profe Galarza, Museo Histórico. **Premio:** $1800.
- **Lugar:** el jardín cervecero de Cerveza Patagonia en la Costanera y Tomás Edison, con vista al Puente General Belgrano
  (existe; confirmado). Queda a una cuadra del laburo del jugador.
- **Historia:** El asesor Ñoquetti tiene la llave del Archivo de la Casa de Gobierno y la apuesta al truco. Vos apostás
  el remís de Ña Cata (ella no sabe nada). Yanina, la moza, se ofrece a pasarte las cartas del rival por señas.
- **Jugabilidad:** `goto` al Patagonia en 2:30 → `choice` → escena **`patagonia`** (truco a 15 puntos, sin flor):
  - **Limpio** (`truco_limpio = true`): nivel 7. Pista: Ñoquetti se toca el reloj cuando tiene 28 o más de envido.
  - **Con señas** (`truco_limpio = false`): nivel 5, con la tabla de señas clásica (cejas = ancho de espadas, guiño =
    ancho de bastos, boca a la derecha/izquierda = sietes, morderse el labio = un tres). Riesgo: si mirás a Yanina más de
    2 manos seguidas, Ñoquetti se da vuelta y perdés la mano.
  → `chase follow` del auto oficial de Ñoquetti hasta la Casa de Gobierno (3 min).
- **Notas:** el rival tiene frases para cada canto (truco, envido, quiero, no quiero), todas en `opts.lineasRival`.

### Misión 7 · Expediente 1865 (dificultad 7)

- **Da:** Ña Cata, Plaza 25 de Mayo. **Premio:** $2200.
- **Historia:** Con la llave de Ñoquetti entrás a la Casa de Gobierno después de hora. En el Archivo hay pilas de
  expedientes truchos ("compra de 800 sillas para una oficina de 3 personas", "licitación de una licitación") y tres
  verdaderos con fechas: **3 de abril de 1588** (fundación), **13 de abril de 1865** (llega la flota paraguaya),
  **25 de mayo de 1865** (Combate del Puente de la Batería). Ordenados, dan la combinación de la caja fuerte del
  despacho del Ministro: **3-13-25**. Adentro: el plano original y la orden de desmonte, sin firmar.
- **Jugabilidad:** `goto` a pie → escena **`casa_gobierno`** (nivel 7, 5 min): sigilo con dos ordenanzas de ronda
  (3 vistas = fallo, con escondites), puzzle de expedientes y caja fuerte → `escape` 2★ → encuentro en Plaza Cabral.
- **Notas:** nada de violencia adentro; los ordenanzas son cómicos ("Será el aire acondicionado"). La leyenda de que
  hay túneles bajo la Casa de Gobierno se deja para después ("eso es otra historia", final de la misión 10).

### Misión 8 · La Copa Sobreprecio (dificultad 8)

- **Da:** Tadeo, estadio de Huracán. **Premio:** $2500.
- **Historia:** Chiquito apuesta la llave de la cripta en un fútbol 5: Barrio Huracán contra "Los Ñoquis de Planta FC"
  (empleados públicos de planta permanente). Si pierden, pintan la cancha de gris oficina. Ganan, Chiquito no paga y
  escapa hacia el puente ("¡Me voy a Resistencia!").
- **Jugabilidad:** `futbol` (5 vs 5, 6 minutos, nivel 8: rival que pega, árbitro comprado en el primer tiempo,
  rival que se cansa después del minuto 4, penales si empatan) → `chase catch` antes del puente (2:30).
- **Compañeros:** Tadeo, el Flaco Ojeda al arco, Rulo en defensa y Gladys de 5. Relato con "¡SAPUCAAAAY!" en los goles.
- **Notas:** el equipo del barrio usa camiseta blanca con vivos rojos (no se afirman colores oficiales de clubes).
  La llave dice "Cripta. 1730": el año en que la Cruz fue llevada a su ubicación actual.

### Misión 9 · Donde la cruz no ardió (dificultad 9)

- **Da:** Profe Galarza, Plaza La Cruz. **Premio:** $3000.
- **Historia:** Hay que llegar a la Iglesia de la Cruz de los Milagros antes que la gente del Ministro. Don Eulogio, el
  sacristán, abre la cripta. Abajo, cinco galerías: bajo calle Belgrano, bajo la Merced, la bóveda del Cabildo (bajo la
  actual Jefatura), el pasaje de los frailes bajo San Francisco y la boca en la Costanera, que quedó a la vista con el
  río bajo. El Profe resume la polémica real: "Los ingenieros dicen que son desagües. Los historiadores dicen que no.
  Yo digo: bajemos y veamos".
- **Jugabilidad:** `goto` contra reloj (1:30) → `cond tabaco_pombero` → escena **`tunel`**:
  - **Con tabaco:** nivel 8, el Pombero silba desde la galería correcta y una vez apaga la linterna de un guardia.
  - **Sin tabaco:** nivel 9, antorcha más corta y el Pombero hace travesuras (apaga la antorcha, silba desde el pasillo falso).
  Mecánica central: **seguir el agua (goteo) y no el brillo** (las monedas brillantes son trampas) → `escape` 3★ al salir
  → encuentro con Ña Cata en el Puerto ("Viernes, luna llena... pensé que eras el lobizón").
- **Notas:** el diario de Fray Benicio se encuentra en el túnel y explica todo en tres líneas. El Kurupí se nombra
  como chiste del Pombero y nada más (apto todo público).

### Misión 10 · Lo de todos (dificultad 10, final)

- **Da:** Ña Cata, Puerto. **Premio:** $5000.
- **Historia:** Amanece y las topadoras van al Parque Mitre. El Profe se "encadenó" a la Higuera con el cinturón. El
  Ministro tiene la orden de desmonte: lo alcanzás y le demostrás que no tiene firma (y que el expediente dice "Higuera"
  cuando el cartel del parque dice "Gomero de la India": ni sabían el nombre del árbol). Bajás por las raíces a las
  cuevas, encontrás el cofre de Fray Benicio y lo llevás al Museo Histórico con toda la policía detrás.
- **Jugabilidad:** `vehicle remis` → `goto` contra reloj (1:40) → `chase catch` de la camioneta oficial (2:00) → `goto`
  a pie → escena **`higuera`** (nivel 10, 6 min) → `escape` 4★ con el cofre → `goto` al Museo → epílogo según `honesto`.
- **Escena `higuera`:** cuatro zonas (raíces que son puertas, galería con nombres de vecinos de 1865, ojo de agua hacia la
  Punta Arazá, cámara del fraile), tres compuertas con los símbolos del plano (**cruz, agua, árbol**: cada uno remite a
  una misión anterior), la **Pora** como guardiana (si agarrás plata suelta te persigue y cierra las raíces; si llevás
  solo el cofre, te ilumina la salida) y la topadora golpeando arriba cada 30 s.
- **Tesoro:** plata de las iglesias (custodia, candelabros, cálices), un sable del Combate del Puente de la Batería, la
  carta de Fray Benicio con la lista de vecinos y una bandera vieja. La carta: *"No es mío ni tuyo. Es del pueblo de
  Corrientes. Devolvelo cuando haya paz."*
- **Epílogo:** si fuiste honesto en la 4, el Profe lo dice y la Higuera es declarada árbol histórico "por decreto, uno de
  verdad"; si no, Gladys te recuerda que su foto valió más que tu billetera, pero "volviste, y eso cuenta". Final común:
  "El expediente ya pasó a otro cajón. Clásico." Tadeo pregunta por el túnel que va a la Casa de Gobierno (gancho para
  más misiones). Todos: **¡SAPUCAAAAAAY!**

---

## 6. Base real (qué es verdad y qué inventamos)

| Tema | Lo real que usamos | Lo inventado |
|---|---|---|
| **Fundación y Cruz de los Milagros** | Acta del 3 de abril de 1588 (Juan Torres de Vera y Aragón; "San Juan de Vera de las Siete Corrientes"). Cruz de urunday de ~3 m; la tradición dice que los aborígenes intentaron quemarla y el fuego no la consumió. Llevada a su templo actual en 1730. Fiesta el 3 de mayo. | La cripta con entrada a los túneles. |
| **Túneles** | Leyenda muy difundida: "Túneles de las Congregaciones" que unirían el ex solar jesuita (Colegio Nacional), la Merced, el Cabildo, la Casa de Gobierno, la Matriz, el Municipio y San Francisco, con salida al río; se dice que sirvieron para burlar el bloqueo de víveres durante la ocupación de 1865. Hay un libro de un arquitecto local que los estudia; con la bajante del Paraná quedaron a la vista estructuras en la Costanera que funcionarios atribuyen a desagües y algunos historiadores discuten. | La red completa, la ruta Cruz → Merced → Cabildo → San Francisco → Costanera, el Pombero adentro. |
| **1865** | El 13 de abril de 1865 la flota paraguaya tomó dos buques argentinos en el puerto y la ciudad quedó ocupada hasta octubre. El 25 de mayo de 1865, combate del Puente de la Batería (primera acción aliada para recuperar la ciudad), en la zona del actual Parque Mitre. El puente fue construido hacia 1852 bajo el gobierno de Juan Pujol y demolido en 1958 al entubar el arroyo; hoy lo recuerda un mural en la entrada del parque. En el parque está el monumento "Las Cautivas" (Perlotti, 1941). | Fray Benicio, su plano y su cofre. |
| **Higuera / Gomero de la India** | El Parque Mitre tiene un "Gomero de la India" (ficus) de más de cien años, el árbol estrella del parque, y es el parque con los árboles más antiguos de la ciudad. Punta Arazá, faro de 1887. | Las cuevas bajo las raíces y el tesoro. |
| **Plata yvyguy y la Pora** | Creencia guaraní (muy fuerte en Paraguay y el NEA) de que en la Guerra Grande se enterraron fortunas; el póra es el espíritu que las cuida y se manifiesta como luz o fuego. | Que la Pora castigue la codicia y premie al que devuelve. |
| **Gauchito Gil** | Antonio Mamerto Gil Núñez, peón de la zona de Mercedes; según la tradición murió un 8 de enero (1874 o 1878), colgado de los pies, y la leyenda del sargento y el hijo enfermo que sanó. Santuarios rojos, velas, cintas y banderas rojas, ofrendas (cigarros, vino), bocinazos al pasar. | El altarcito de Don Abundio y su acertijo. |
| **Mitos guaraníes** | Pombero (protector del monte, silba, se le deja tabaco); Yasy Yateré (petiso rubio con bastón de oro que se lleva a los chicos a la siesta); lobizón (séptimo hijo, viernes de luna llena); Kurupí (solo nombrado). | Sus apariciones concretas. |
| **Cultura** | Chamamé (Patrimonio Cultural Inmaterial de la Humanidad, UNESCO 2020), el sapucay, chipá, tereré con yuyos (menta, cedrón), carnaval con Ara Berá, Sapucay, Copacabana y Arandú Beleza en el Corsódromo; Camba Cuá; colectivos 104, 105, 108, 109 (recorrido de la 108 tomado de `data/colectivos.txt`). | Rulo, Gladys y compañía. |
| **Lugares** | Todos los puntos de `MISSION_PLACES` salen de OpenStreetMap (`data/osm_raw.json`); el Patagonia (Costanera y Edison) de su ficha pública. | El altarcito de Av. Maipú y Necochea; la posición exacta de la Higuera dentro del parque (aproximada). |
| **Política** | Nada real. | Ministro Sobreprecio, Ñoquetti, Chiquito Mbareté, la Licitación 0001, el Paseo Subterráneo del Bicentenario. |

### Coordenadas corregidas respecto de EQUIPO.md

Verificadas con `data/osm_raw.json`:

- **Parque Mitre:** -27.45939, -58.82938 (EQUIPO.md decía -27.4594, -58.8352: estaba unos 600 m al oeste).
- **Plaza La Cruz:** -27.47110, -58.84005 e **Iglesia de la Cruz de los Milagros:** -27.47231, -58.84022 (EQUIPO.md decía lon -58.8330).
- **Casa de Gobierno:** -27.46364, -58.83864 (EQUIPO.md: -27.4631, -58.8387, casi igual).
- **Patagonia:** -27.46934, -58.85410 (Costanera y Tomás Edison).
- **Trabajo:** centro de la manzana ≈ -27.47040, -58.85030 (esquinas: Bolívar/Borgatti -27.46990, -58.85094; Belgrano/Don Bosco -27.47100, -58.84966).

La casa del jugador (Guido Spano y Vélez Sarsfield) **no se usa** en ninguna misión.

---

## 7. Notas para el motor (missions.js)

Lo que el guion asume y no está explícito en la tabla de EQUIPO.md:

1. **Índices base 0.** `choice.options[].goto`, `cond.then` y `cond.else` son índices dentro de `steps`, empezando en 0.
2. **Salto incondicional.** Para cerrar una rama uso `cond` con `then === else` (por ejemplo, misión 4, paso 7). Si el
   motor prefiere, se puede agregar un paso `{type: 'jump', to}`; con el truco actual no hace falta.
3. **Flags globales y persistentes.** `honesto` (misión 4) se lee en la 10; `tabaco_pombero` (misión 3) se lee en la 9;
   `truco_limpio` (misión 6) queda guardada para futuras misiones. Tienen que sobrevivir entre misiones (y al guardado si
   lo hay). Una flag nunca seteada vale `false`.
4. **`choice` con `money`.** En la misión 4 una opción da `money: 1500`. Si no se implementa, la misión funciona igual.
5. **`chase.target.kind: 'auto'`** con `name` y `color`: un auto común con IA (auto oficial, camioneta de Chiquito,
   camioneta del Ministro). El `to` es hacia dónde huye o va.
6. **`label` en `cables.poles`** y en `collect.items`: texto para el marcador del minimapa.
7. **`time` en `collect`, `route`, `goto`, `chase` y `cables`**: el campo común de la tabla.
8. **`talk` con varias voces:** `window.MISSION_CAST` mapea `who` → `look` para dibujar el retrato de cada hablante.
   `who: 'Vos'` es el jugador.
9. **Pasajeros del colectivo (opcional):** en la misión 2 los comentarios de pasajeros están en un `talk` posterior. Si el
   motor agrega `say` por parada (`stops[].say`), se pueden mover ahí para que suenen durante el viaje.
10. **Escenas y fútbol:** todo lo que necesitan está en `opts` (`dificultad` 1-10, `intro`, `objetivo`, textos de ganar y
    perder, NPCs, puzzles con solución). Si una escena devuelve `ok: false`, la misión falla con el `onFail` o el
    `textoPierde` de la escena, y se puede reintentar desde ese paso (recomendado para 7, 9 y 10, que son largas).
11. **`goto` con `mode: 'foot'`** en misiones 7 y 10: hay que bajarse del auto para entrar a la escena.

Pedidos a otros módulos (para el orquestador):

- **Escenas (`scenes.js`):** la escena `tunel` recibe `opts.pomberoAyuda` (true/false) y la `patagonia` recibe
  `opts.senas` (true/false) y `opts.tablaSenas`. La `higuera` necesita que la regla de la Pora dependa de si el jugador
  agarra monedas sueltas.
- **Fútbol (`futbol.js`):** además de `rival`, `minutos` y `jugadores`, usar si puede `dificultad`, `equipoJugador`,
  `equipoRival` (colores) y `relato`; `empate` describe penales.
- **Mapa / landmarks:** sería lindo un modelo del altarcito rojo en Av. Maipú y Necochea, un cartel LED "PRÓXIMAMENTE"
  en el Parque Mitre y la Higuera/Gomero como árbol gigante en el parque (no son obligatorios para jugar).

---

## 8. Fuentes consultadas

- Patagonia en Corrientes: ficha de "Cerveza Patagonia – Jardín Cervecero Corrientes" (Wanderlog): Av. Costanera General San Martín y Tomás Edison.
- Túneles: República de Corrientes, "Corrientes y sus túneles: relatos que se engrandecen entre lo real y lo fantástico" (2021); El Litoral, "Mito urbano: la versión oficial sobre los túneles en la Casa de Gobierno de Corrientes" (2021); NEA HOY (2024) y resultados de búsqueda de Radio Dos e itCorrientes.
- Puente de la Batería y 1865: Diario El Libertador, "Puente de la Batería, escenario de una batalla histórica y la anécdota de Pujol"; Wikipedia, "Corrientes campaign" / "Battle of Corrientes"; Boletín del Centro Naval.
- Parque Mitre y Gomero de la India: sitio de turismo de la Municipalidad de Corrientes (parques); estudio de arbolado urbano UNNE/INTA (Rev. FCA UNCuyo).
- Cruz de los Milagros: ACI Prensa y resúmenes de historia de Corrientes (fundación del 3/4/1588, cruz de urunday, traslado de 1730, fiesta del 3 de mayo).
- Gauchito Gil: La Nación, "Quién fue el Gauchito Gil y por qué se celebra hoy su día"; 421.news; EcuRed.
- Plata yvyguy y póra: ABC Color (Paraguay), notas sobre la plata yvyguy; La Nación (Paraguay), "Los tesoros enterrados de la Guerra contra la Triple Alianza".
- Carnaval: sitio de turismo de la Municipalidad de Corrientes (carnaval) y notas de prensa sobre el Corsódromo Nolo Alías y las comparsas.
- Habla correntina: registro de "nderakore" en diccionarios en línea; J. Pinta, "Correntino Spanish Memes and the Enregisterment of Argentine Guarani Loanwords", *Languages* (2023).
- Recorridos de colectivos y lugares: `data/colectivos.txt` y `data/osm_raw.json` del proyecto (OpenStreetMap, ODbL).
