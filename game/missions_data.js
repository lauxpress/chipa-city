// Chipa City — datos de las misiones (contrato guionista ↔ motor, ver docs/EQUIPO.md y docs/misiones.md)
//
// Este archivo es SOLO datos: lo escribe el guionista y lo interpreta game/missions.js.
// Convenciones que asume (detalladas en docs/misiones.md, sección "Notas para el motor"):
//  - Los índices de paso (choice.options[].goto, cond.then, cond.else) son base 0 dentro de `steps`.
//  - Un `cond` con then === else funciona como salto incondicional (lo usamos para cerrar ramas).
//  - Las flags (`set`) son GLOBALES y persisten entre misiones (la 10 lee 'honesto' de la 4, la 9 lee
//    'tabaco_pombero' de la 3). Una flag nunca seteada vale false.
//  - `at` puede ser [lat, lon] o un nombre de MISSION_PLACES. Los vehículos aparecen en la calle más cercana.
//  - Campos extra no listados en la tabla (por ejemplo `opts` de las escenas, `money` en una opción de choice,
//    `name`/`color` en chase.target) son opcionales: si el motor no los usa, la misión igual se juega.
//  - Textos de HUD (`hint`) en mayúsculas; diálogos cortos en rioplatense correntino.
//  - Todo lo político es sátira con personajes INVENTADOS. Ningún personaje representa a una persona real.

window.MISSION_PLACES = {
  // Centro histórico (coordenadas verificadas con data/osm_raw.json)
  casa_gobierno:    [-27.46360, -58.83890], // Casa de Gobierno de la Provincia de Corrientes
  plaza_25_mayo:    [-27.46343, -58.83963],
  la_merced:        [-27.46382, -58.84013], // Iglesia Nuestra Señora de la Merced
  jefatura:         [-27.46241, -58.83944], // Jefatura de Policía (donde estaba el Cabildo)
  san_francisco:    [-27.46262, -58.83512], // Iglesia y convento San Francisco Solano
  museo_historico:  [-27.46660, -58.83741], // Museo Histórico de Corrientes
  casa_nandereco:   [-27.46419, -58.83580], // Centro de Interpretación del Chamamé y el Carnaval
  catedral:         [-27.46921, -58.83131], // Catedral Nuestra Señora del Rosario
  plaza_cabral:     [-27.46869, -58.83121],
  plaza_torrent:    [-27.47166, -58.83307],
  cruz_milagros:    [-27.47180, -58.84029], // Iglesia Santísima Cruz de los Milagros
  plaza_cruz:       [-27.47110, -58.84005], // Plaza La Cruz
  mercado:          [-27.47679, -58.83612], // Mercado Municipal de Productos Frescos
  puesto_banderas:  [-27.47606, -58.83527], // Av. 3 de Abril y Córdoba
  // Costanera y río
  puerto:           [-27.46139, -58.83826], // Paseo de compras "El Puerto"
  costanera_tucuman:[-27.46149, -58.84125], // Av. Costanera y Tucumán
  costanera_pelle:  [-27.46434, -58.84654], // Av. Costanera y Pellegrini
  boca_tunel:       [-27.46113, -58.83366], // Costanera Norte, frente a San Francisco (Córdoba y Torres de Vera)
  patagonia:        [-27.46934, -58.85410], // Cerveza Patagonia, jardín cervecero (Costanera y Edison)
  marriott:         [-27.47464, -58.85568], // Costanera Sur y Lavalle
  // Barrio del trabajo / puente
  trabajo:          [-27.47040, -58.85030], // manzana Bolívar / Belgrano / Padre Borgatti / Don Bosco
  trabajo_playon:   [-27.47065, -58.85030], // playón de estacionamiento de la manzana del trabajo
  la_unidad:        [-27.47255, -58.85053], // ex cárcel, hoy centro de ciencias
  subida_puente:    [-27.47411, -58.85023], // control de subida al Puente General Belgrano
  estacion:         [-27.47471, -58.84675], // estación de servicio, Av. 3 de Abril y Blas B. de la Vega
  ioscor:           [-27.47550, -58.84640],
  // Camba Cuá
  parque_camba_cua: [-27.46496, -58.84578],
  anfiteatro:       [-27.46616, -58.84852], // Anfiteatro José Hernández
  // Sur: Huracán
  huracan:          [-27.48377, -58.82983], // estadio del Club Huracán (Sarmiento y Tte. Ibáñez)
  santuario_gil:    [-27.47934, -58.82884], // altarcito del Gauchito Gil (inventado), Av. Maipú y Necochea
  // Norte: Parque Mitre
  parque_mitre:     [-27.45939, -58.82938],
  higuera:          [-27.46002, -58.82988], // Higuera / Gomero de la India (posición aproximada dentro del parque)
  regatas:          [-27.45909, -58.83028], // Club de Regatas Corrientes
};

// Retratos (look) de los personajes recurrentes
const LOOK = {
  cata:     { skin: '#b07a52', hair: '#d8d8d8', shirt: '#c8282a', pants: '#2a2a4a' },
  profe:    { skin: '#d0a07a', hair: '#9a9a9a', shirt: '#8a7a5a', pants: '#4a3a2a' },
  rulo:     { skin: '#a8724a', hair: '#1a1a1a', shirt: '#e8e8e8', pants: '#2a3a6a' },
  abundio:  { skin: '#8a5a3a', hair: '#e0e0e0', shirt: '#d8282a', pants: '#3a3a3a' },
  gladys:   { skin: '#c08a60', hair: '#4a2a1a', shirt: '#f0a020', pants: '#2a4a2a' },
  inge:     { skin: '#d8a880', hair: '#5a4a3a', shirt: '#3a6ab8', pants: '#5a5a5a' },
  yanina:   { skin: '#c89a70', hair: '#2a1a0a', shirt: '#1a1a1a', pants: '#2a2a2a' },
  noquetti: { skin: '#e0b090', hair: '#c8a050', shirt: '#f4f4f4', pants: '#1a1a3a' },
  chiquito: { skin: '#9a6a44', hair: '#1a1a1a', shirt: '#4a8a3a', pants: '#3a2a1a' },
  tadeo:    { skin: '#b8865a', hair: '#2a1a0a', shirt: '#f4f4f4', pants: '#c8282a' },
  eulogio:  { skin: '#d0a888', hair: '#f0f0f0', shirt: '#2a2a2a', pants: '#2a2a2a' },
  ministro: { skin: '#e8b898', hair: '#e8e8e8', shirt: '#2a2a3a', pants: '#2a2a3a' },
};

// Retrato por nombre de hablante (opcional para el motor: en un talk con varias voces, buscar `who` acá)
window.MISSION_CAST = {
  'Ña Cata': LOOK.cata, 'Profe Galarza': LOOK.profe, 'Rulo': LOOK.rulo, 'Don Abundio': LOOK.abundio,
  'Gladys': LOOK.gladys, 'El Inge': LOOK.inge, 'Yanina (moza)': LOOK.yanina, 'Lic. Ñoquetti': LOOK.noquetti,
  'Chiquito Mbareté': LOOK.chiquito, 'Grandote de camisa verde': LOOK.chiquito, 'Tadeo': LOOK.tadeo,
  'Don Eulogio': LOOK.eulogio, 'Ministro Sobreprecio': LOOK.ministro,
};

window.MISSIONS = [
  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 1 · TUTORIAL: remís corto, sin policía, sin tiempo
  {
    id: 'm01_remis',
    n: 1,
    title: 'Bautismo de remís',
    tagline: 'Ña Cata te presta el remís. Llevá al Profe sin romper nada.',
    giver: { name: 'Ña Cata', at: [-27.46343, -58.83963], look: LOOK.cata },
    unlock: [],
    reward: { money: 500 },
    steps: [
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: '¡Mitaí! Vení, vení. ¿Vos sabés manejar, no? Decime que sí que estoy apurada.' },
        { who: 'Vos', text: 'Y... más o menos.' },
        { who: 'Ña Cata', text: 'Más o menos es sí. Mi chofer se fue a la Fiesta del Chamamé y no volvió más, el sinvergüenza.' },
        { who: 'Ña Cata', text: 'Tengo un viaje cortito: el Profe Galarza, en el Museo Histórico. Lo llevás a la Cruz de los Milagros.' },
        { who: 'Ña Cata', text: 'Despacito. Es un señor mayor y habla mucho. Vos decile "ajá" y manejá.' },
      ] },
      { type: 'vehicle', kind: 'remis', at: 'plaza_25_mayo', hint: 'SUBÍ AL REMÍS DE ÑA CATA (ENTER)' },
      { type: 'taxi', hint: 'BUSCÁ AL PROFE EN EL MUSEO HISTÓRICO',
        pickup: 'museo_historico', dropoff: 'cruz_milagros',
        passenger: { name: 'Profe Galarza', look: LOOK.profe, mood: 'charlatán' },
        lines: {
          start: '¡Buenas, joven! A la Cruz de los Milagros, por favor. Sin apuro, que la cruz espera desde 1588.',
          mid: 'Dicen que la quisieron quemar y el fuego no la tocó. Urunday, mi amigo. Ni el fuego ni las termitas.',
          end: 'Llegamos. Tome, quédese el vuelto... ah, no, justo, justo. Bueno. ¡Saludos a Ña Cata!',
        } },
      { type: 'talk', lines: [
        { who: 'Vos', text: 'Se olvidó un sobre en el asiento de atrás. Amarillo, viejísimo, con un sello de fraile.' },
        { who: 'Vos', text: 'Dice: "Donde la cruz no ardió, la tierra se abre. Fr. Benicio, 1865". Nderakore...' },
      ] },
      { type: 'goto', at: 'plaza_25_mayo', mode: 'vehicle', r: 20, hint: 'DEVOLVÉ EL REMÍS A LA PLAZA 25 DE MAYO' },
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: '¡Ndeee, sin un rayón! Vos servís, mitaí.' },
        { who: 'Ña Cata', text: '¿Y ese sobre? Eso es del Profe. Guardalo, que con él siempre hay lío. Del lindo.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 2 · COLECTIVO: paradas con espera, tiempo holgado, cuidado con el daño
  {
    id: 'm02_colectivo',
    n: 2,
    title: 'La 108 no espera',
    tagline: 'Rulo se descompuso. Hacé su recorrido antes de que el chipá se enfríe.',
    giver: { name: 'Rulo', at: [-27.46139, -58.83826], look: LOOK.rulo },
    unlock: ['m01_remis'],
    reward: { money: 800 },
    steps: [
      { type: 'talk', look: LOOK.rulo, lines: [
        { who: 'Rulo', text: 'Chamigo, me agarró el jhaku. Cuarenta grados a la sombra y yo sin sombra.' },
        { who: 'Rulo', text: 'Hacé mi vuelta, dale. Costanera, Tucumán, 9 de Julio, Salta y bajamos por Don Bosco.' },
        { who: 'Rulo', text: 'Frená en cada parada y esperá que suban. Y no me choques el bondi, que es nuevito. Del 2009.' },
      ] },
      { type: 'vehicle', kind: 'colectivo', line: 108, at: 'puerto', hint: 'SUBÍ AL COLECTIVO 108' },
      { type: 'route', kind: 'colectivo', time: 420, maxDamage: 40,
        hint: 'HACÉ EL RECORRIDO: FRENÁ EN CADA PARADA',
        onFail: 'Se te pasó el horario. En la parada te están retando en guaraní.',
        stops: [
          { at: 'costanera_tucuman',     wait: 4, label: 'COSTANERA Y TUCUMÁN' },
          { at: [-27.46608, -58.84157],  wait: 4, label: 'TUCUMÁN Y 9 DE JULIO' },
          { at: [-27.46628, -58.83907],  wait: 5, label: '9 DE JULIO Y SALTA' },
          { at: [-27.46739, -58.83914],  wait: 4, label: 'SALTA Y JUNÍN' },
          { at: [-27.46956, -58.83928],  wait: 5, label: 'SALTA Y SAN MARTÍN' },
          { at: [-27.46888, -58.84944],  wait: 4, label: 'SAN MARTÍN Y DON BOSCO' },
          { at: [-27.47391, -58.84999],  wait: 6, label: 'DON BOSCO Y 3 DE ABRIL' },
        ] },
      { type: 'talk', lines: [
        { who: 'Pasajera de Ara Berá', text: 'Este año ganamos otra vez, señora. Las plumas de Ara Berá se ven desde el puente.' },
        { who: 'Pasajera de Sapucay', text: '¿Plumas? Sapucay trajo una carroza con un yacaré de seis metros. Hacé el favor.' },
        { who: 'Vendedor de chipá', text: '¡Chipá calentito! ¡Chipá! ...¿Usted, chofer? Para usted, gratis. Si no frena de golpe.' },
        { who: 'Grandote de camisa verde', text: '(al teléfono) Sí, Ministro. El parque Mitre es nuestro. Tala y obra, como dijo.' },
        { who: 'Grandote de camisa verde', text: '(cuelga) ¿Qué mirás, chofer? Yo soy Chiquito Mbareté. Acordate la cara.' },
      ] },
      { type: 'goto', at: 'puerto', mode: 'vehicle', r: 25, hint: 'VOLVÉ A LA TERMINAL DEL PUERTO' },
      { type: 'talk', look: LOOK.rulo, lines: [
        { who: 'Rulo', text: '¡Ndeee, llegaste con el bondi entero! Te ganaste la gorra.' },
        { who: 'Vos', text: 'Se subió un tal Chiquito Mbareté hablando de talar el Parque Mitre.' },
        { who: 'Rulo', text: '¿Chiquito? Es el puntero del Ministro de Obras Truchas. Dos metros y cero vergüenza. Cuidate.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 3 · GAUCHITO GIL: juntar ofrendas por la ciudad con tiempo + escena del santuario (acertijo)
  {
    id: 'm03_gauchito',
    n: 3,
    title: 'Promesa colorada',
    tagline: 'Don Abundio le debe una promesa al Gauchito. Juntá las ofrendas antes del anochecer.',
    giver: { name: 'Don Abundio', at: [-27.47934, -58.82884], look: LOOK.abundio },
    unlock: ['m02_colectivo'],
    reward: { money: 1000 },
    steps: [
      { type: 'talk', look: LOOK.abundio, lines: [
        { who: 'Don Abundio', text: 'Buenas, mitaí. Este altarcito lo levanté yo, cuando el Gauchito me curó la rodilla.' },
        { who: 'Don Abundio', text: 'Le prometí una ofrenda completa y la rodilla ya no me deja caminar el centro. Qué ironía, ¿no?' },
        { who: 'Don Abundio', text: 'Vela roja, cintas rojas, un banderín, cigarros y chipá calentito. Antes de que caiga el sol.' },
        { who: 'Don Abundio', text: 'Y el Profe Galarza me dijo que vos tenés un sobre del fraile. El Gauchito sabe de esas cosas.' },
      ] },
      { type: 'collect', mode: 'any', icon: 'ofrenda', time: 300,
        hint: 'JUNTÁ LAS 5 OFRENDAS PARA EL GAUCHITO',
        onFail: 'Se hizo de noche. La promesa se cumple, pero otro día.',
        items: [
          { at: 'catedral',        label: 'VELA ROJA (SANTERÍA DE LA CATEDRAL)' },
          { at: 'mercado',         label: 'CINTAS ROJAS (MERCADO MUNICIPAL)' },
          { at: 'puesto_banderas', label: 'BANDERÍN ROJO (3 DE ABRIL Y CÓRDOBA)' },
          { at: 'plaza_torrent',   label: 'CIGARROS (KIOSCO DE LA PLAZA TORRENT)' },
          { at: 'plaza_cruz',      label: 'CHIPÁ CALENTITO (PLAZA LA CRUZ)' },
        ] },
      { type: 'goto', at: 'santuario_gil', mode: 'any', r: 12, hint: 'LLEVÁ LAS OFRENDAS AL SANTUARIO' },
      { type: 'scene', id: 'santuario', hint: 'ARMÁ LA OFRENDA Y RESOLVÉ EL ACERTIJO', opts: {
        dificultad: 3,
        titulo: 'El altarcito colorado',
        intro: 'Un altarcito de chapa y ladrillo pintado de rojo bajo un espinillo. Banderas rojas que flamean, ' +
               'velas derretidas, botellitas y la estampita del Gauchito Gil: Antonio Gil, el gaucho de Mercedes, ' +
               'que según cuentan murió colgado de los pies un 8 de enero y le perdonó la vida al hijo del sargento.',
        objetivo: 'Poner cada ofrenda en su lugar y responder el acertijo que "dicta" el Gauchito.',
        ofrendas: [
          { item: 'vela roja',     lugar: 'frente a la imagen', texto: 'La llama no tiembla aunque sopla el norte.' },
          { item: 'cintas rojas',  lugar: 'atadas a la rama del espinillo', texto: 'Una cinta por cada promesa.' },
          { item: 'banderín rojo', lugar: 'en el mástil de caña', texto: 'Colorado, como el pañuelo del Gauchito.' },
          { item: 'cigarros',      lugar: 'en el plato de ofrendas', texto: 'Uno prendido, para que fume tranquilo.' },
          { item: 'chipá',         lugar: 'en el plato de ofrendas', texto: 'Calentito. Al santo no se le da chipá frío.' },
        ],
        errorOfrenda: 'Don Abundio: "No, mitaí, eso no va ahí. ¿Vos fuiste a catequesis o a la siesta?"',
        acertijo: {
          pregunta: 'Bajo la tierra camino sin pies, del río vengo y al río voy. ' +
                    'El que me sigue no se pierde; el que me tapa no sabe quién soy. ¿Qué soy?',
          opciones: ['El oro de los frailes', 'El agua', 'El Pombero'],
          correcta: 1,
          intentos: 3,
          pistas: [
            'Don Abundio: "Pensá en lo que corre debajo de la Costanera cuando el Paraná está bajo."',
            'Don Abundio: "El Pombero camina, pero tiene pies. Y pide tabaco."',
          ],
        },
        npcs: [{ name: 'Don Abundio', look: LOOK.abundio, lineas: ['Despacito, que el Gauchito ve todo.', 'Tocá bocina al irte, es costumbre.'] }],
        ambiente: 'Atardecer. Bocinas de los autos que pasan saludando. Chamamé lejano de una radio a pila.',
        revelacion: 'En lo oscuro, seguí el agua y no el brillo. Donde gotea, se avanza; donde brilla, se cae.',
        textoGana: 'Las velas se avivan todas juntas. Don Abundio se persigna: "Te habló, mitaí. Te habló."',
        textoPierde: 'Se apagan las velas. Don Abundio: "Volvé mañana. El Gauchito es paciente, no como yo."',
      } },
      { type: 'talk', look: LOOK.abundio, lines: [
        { who: 'Don Abundio', text: '"Seguí el agua y no el brillo." Anotalo. El Gauchito no habla al pedo.' },
        { who: 'Don Abundio', text: 'Te sobró un cigarro. ¿Se lo dejás al santo o te lo guardás?' },
      ] },
      { type: 'choice', prompt: '¿Qué hacés con el último cigarro?', options: [
        { text: 'Lo guardo. Por las dudas.', set: { tabaco_pombero: true } },
        { text: 'Se lo dejo todo al Gauchito.', set: { tabaco_pombero: false } },
      ] },
      { type: 'talk', look: LOOK.abundio, lines: [
        { who: 'Don Abundio', text: 'Bien hecho, el Gauchito no es mezquino. Y dicen que en los túneles hay otro que fuma.' },
        { who: 'Don Abundio', text: 'Andá con cuidado. Y al pasar por acá... ¡bocinazo!' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 4 · BASURERO: juntar bolsas en Camba Cuá con tiempo + elección moral (flag 'honesto')
  {
    id: 'm04_basura',
    n: 4,
    title: 'Bolsas del Ministerio',
    tagline: 'Recolección en Camba Cuá a la hora de la siesta. Alguien tiró papeles que no debía.',
    giver: { name: 'Gladys', at: [-27.46496, -58.84578], look: LOOK.gladys },
    unlock: ['m03_gauchito'],
    reward: { money: 1200 },
    steps: [
      { type: 'talk', look: LOOK.gladys, lines: [
        { who: 'Gladys', text: '¡Ey, vos! ¿Sos el del remís de Ña Cata? Me falta chofer y es la hora de la siesta.' },
        { who: 'Gladys', text: 'A la siesta no sale nadie. Ni los perros. Solo nosotros y el Yasy Yateré.' },
        { who: 'Vos', text: '¿El qué?' },
        { who: 'Gladys', text: 'Un petisito rubio con un bastón de oro que se lleva a los gurises que no duermen. Dale, subí.' },
        { who: 'Gladys', text: 'Diez bolsas en Camba Cuá. Frená al lado de cada una, que yo salto, agarro y tiro. Rapidito.' },
      ] },
      { type: 'vehicle', kind: 'basurero', at: 'parque_camba_cua', hint: 'SUBÍ AL CAMIÓN RECOLECTOR' },
      { type: 'route', kind: 'basura', time: 330, maxDamage: 50,
        hint: 'JUNTÁ LAS 10 BOLSAS: FRENÁ AL LADO DE CADA UNA',
        onFail: 'Pasó la hora. Los vecinos de Camba Cuá ya sacaron el reclamo en la radio.',
        stops: [
          { at: [-27.46468, -58.84413], wait: 2, label: 'PELLEGRINI Y ENTRE RÍOS' },
          { at: [-27.46479, -58.84293], wait: 2, label: 'PELLEGRINI Y SAN LUIS' },
          { at: [-27.46597, -58.84288], wait: 2, label: '9 DE JULIO Y SAN LUIS' },
          { at: [-27.46586, -58.84411], wait: 2, label: '9 DE JULIO Y ENTRE RÍOS' },
          { at: [-27.46578, -58.84535], wait: 2, label: '9 DE JULIO Y MISIONES' },
          { at: [-27.46691, -58.84546], wait: 2, label: 'JUNÍN Y MISIONES' },
          { at: [-27.46701, -58.84417], wait: 2, label: 'JUNÍN Y ENTRE RÍOS' },
          { at: [-27.46710, -58.84294], wait: 2, label: 'JUNÍN Y SAN LUIS' },
          { at: [-27.46810, -58.84300], wait: 2, label: 'YRIGOYEN Y SAN LUIS' },
          { at: [-27.46802, -58.84554], wait: 4, label: 'BOLSA CON SELLO DEL MINISTERIO (YRIGOYEN Y MISIONES)' },
        ] },
      { type: 'talk', look: LOOK.gladys, lines: [
        { who: 'Gladys', text: 'Mirá esto. Papeles picados con sello: "Ministerio de Obras Truchas. CONFIDENCIAL".' },
        { who: 'Gladys', text: '"Licitación 0001: Paseo Subterráneo del Bicentenario. Desmonte total del Parque Mitre."' },
        { who: 'Vos', text: 'Y abajo una fotocopia de un plano viejo... con la misma firma del sobre: Fr. Benicio, 1865.' },
        { who: 'Gladys', text: 'Chiquito Mbareté anda buscando esto, me dijeron. Paga bien. ¿Qué hacemos?' },
      ] },
      { type: 'choice', prompt: '¿Qué hacés con los papeles del Ministerio?', options: [
        { text: 'Se los llevo al Profe Galarza.', set: { honesto: true }, goto: 5 },
        { text: 'Se los vendo a Chiquito Mbareté.', set: { honesto: false }, money: 1500, goto: 8 },
      ] },
      // rama A (índices 5-7): el Profe
      { type: 'goto', at: 'museo_historico', mode: 'any', r: 14, hint: 'LLEVALE LOS PAPELES AL PROFE (MUSEO HISTÓRICO)' },
      { type: 'talk', look: LOOK.profe, lines: [
        { who: 'Profe Galarza', text: '¡Mi sobre! ¡Y la fotocopia del plano de Fray Benicio! Esto estaba en el Archivo... hasta que no estuvo.' },
        { who: 'Profe Galarza', text: 'En 1865 los paraguayos tomaron la ciudad. Fray Benicio escondió algo por los túneles. Algo grande.' },
        { who: 'Profe Galarza', text: 'Y el Ministro lo quiere antes de pasar la topadora. Usted es honesto, joven. Eso acá es casi un superpoder.' },
      ] },
      { type: 'cond', flag: 'honesto', then: 10, else: 10 }, // salto: cierra la rama A
      // rama B (índices 8-9): Chiquito
      { type: 'goto', at: 'plaza_cabral', mode: 'any', r: 14, hint: 'ENCONTRATE CON CHIQUITO EN LA PLAZA CABRAL' },
      { type: 'talk', look: LOOK.chiquito, lines: [
        { who: 'Chiquito Mbareté', text: 'Muy bien, chofer. El Ministro sabe agradecer. Acá tenés. Y vos no viste nada.' },
        { who: 'Gladys', text: '(en voz baja) Tranqui. Antes le saqué foto a todo con el celu. Al Profe se la mando yo.' },
        { who: 'Gladys', text: 'Plata es plata, pero el Parque Mitre es el Parque Mitre, ¿o no?' },
      ] },
      // final común (índice 10)
      { type: 'talk', look: LOOK.gladys, lines: [
        { who: 'Gladys', text: 'Bueno, se terminó la siesta. ¿Querés un tereré? Tiene menta y cedrón. Te lo ganaste.' },
        { who: 'Gladys', text: 'Y si ves un petisito rubio con bastón de oro... no lo mirés a los ojos.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 5 · EL TRABAJO: escena de oficina + tablero; camioneta de la DPEC cortando "colgados" con tiempo; escape 1★
  {
    id: 'm05_dpec',
    n: 5,
    title: 'Colgados en tres barrios',
    tagline: 'En el laburo te dan la camioneta de la DPEC: cortá las conexiones truchas del Ministro.',
    giver: { name: 'El Inge', at: [-27.47040, -58.85030], look: LOOK.inge },
    unlock: ['m04_basura'],
    reward: { money: 1500 },
    steps: [
      { type: 'goto', at: 'trabajo', mode: 'any', r: 18, hint: 'ANDÁ AL LABURO' },
      { type: 'scene', id: 'trabajo', hint: 'ESCUCHÁ AL INGE Y ARREGLÁ EL TABLERO', opts: {
        dificultad: 4,
        titulo: 'Lunes en la oficina',
        intro: 'Ventilador de techo, mate lavado, el aire acondicionado que gotea en el mismo balde de siempre. ' +
               'El Inge tiene la planilla de la DPEC en una mano y el termo en la otra.',
        objetivo: 'Briefing con El Inge y después reconectar el tablero del playón sin que salte la térmica.',
        briefing: [
          { who: 'El Inge', text: 'Llegás tarde. No me digas: el puente. Siempre el puente.' },
          { who: 'El Inge', text: 'La DPEC nos tercerizó un trabajo: hay seis colgados enormes en tres zonas.' },
          { who: 'El Inge', text: 'Mercado, barrio Huracán y Parque Mitre. Todos van a parar al obrador del Ministro.' },
          { who: 'El Inge', text: 'Están alimentando un cartel LED de doce metros que dice "PRÓXIMAMENTE". Próximamente qué, digo yo.' },
          { who: 'El Inge', text: 'Pero primero arreglame el tablero del playón, que con el calor saltó todo y la camioneta no carga.' },
        ],
        puzzle: {
          tipo: 'tablero',
          descripcion: 'Grilla de 4x4 piezas de cableado que se rotan (estilo "pipes"). Hay que llevar la corriente ' +
                       'desde ENTRADA 13,2 kV hasta SALIDA PLAYÓN pasando por las 3 térmicas, sin tocar los cables rojos ' +
                       '(colgados), que hacen saltar todo y reinician la grilla.',
          piezas: ['recta', 'codo', 'T', 'térmica', 'colgado'],
          intentos: 4,
          tiempo: 120,
          pistas: [
            'El Inge: "La corriente es como el colectivo: si la mandás por el camino corto, se queda sin frenos."',
            'El Inge: "Los cables rojos son de terceros. No los toques ni con un palo."',
          ],
        },
        npcs: [
          { name: 'El Inge', look: LOOK.inge },
          { name: 'Compañera de RRHH', lineas: ['¿Firmaste la planilla de horas extra? ¿Y la de la planilla?'] },
          { name: 'Pasante', lineas: ['Yo no toqué nada. Bueno, toqué un poquito.'] },
        ],
        textoGana: 'Se prenden todas las luces del playón. El Inge: "Hay esperanza para este país."',
        textoPierde: 'Saltó la térmica general. Se apaga el ventilador. Todos te miran en silencio.',
      } },
      { type: 'vehicle', kind: 'dpec', at: 'trabajo_playon', hint: 'SUBÍ A LA CAMIONETA DE LA DPEC' },
      { type: 'cables', hold: 3, time: 360,
        hint: 'CORTÁ LOS 6 COLGADOS: FRENÁ AL LADO DEL POSTE Y MANTENÉ ESPACIO',
        onFail: 'Se hizo de noche y el cartel LED del Ministro sigue brillando. "PRÓXIMAMENTE: VOS, DESPEDIDO."',
        poles: [
          { at: [-27.47711, -58.83664], label: 'MERCADO: LAVALLE Y PÍO XII' },
          { at: [-27.47657, -58.83531], label: 'MERCADO: CARRILLO Y SEGOVIA' },
          { at: [-27.48038, -58.82801], label: 'HURACÁN: MAIPÚ Y LAS HERAS' },
          { at: [-27.48167, -58.82882], label: 'HURACÁN: LÍBANO Y BAIGORRIA' },
          { at: [-27.46136, -58.82921], label: 'PARQUE MITRE: PUJOL Y ROLÓN' },
          { at: [-27.46021, -58.82722], label: 'PARQUE MITRE: ALVEAR Y PAMPÍN' },
        ] },
      { type: 'talk', lines: [
        { who: 'Chiquito Mbareté', text: '(por la radio de la camioneta) ¿Quién me cortó la luz del obrador? ¡Ya llamé a la cana!' },
        { who: 'Chiquito Mbareté', text: 'Dije que un loco robó una camioneta de la DPEC. Disfrutá el paseo, chofer.' },
      ] },
      { type: 'escape', stars: 1, hint: 'PERDÉ A LA POLICÍA' },
      { type: 'goto', at: 'trabajo_playon', mode: 'vehicle', r: 20, hint: 'DEVOLVÉ LA CAMIONETA AL PLAYÓN DEL LABURO' },
      { type: 'talk', look: LOOK.inge, lines: [
        { who: 'El Inge', text: 'Volviste con la camioneta y sin la policía. Te subo el sueldo. Mentira. Pero te felicito.' },
        { who: 'El Inge', text: 'Ah, te dejó esto el Profe Galarza: dice que el asesor del Ministro juega al truco en el Patagonia.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 6 · PATAGONIA: llegar a tiempo + truco por turnos (con elección de jugar limpio o con señas) + seguir un auto
  {
    id: 'm06_truco',
    n: 6,
    title: 'Truco en el Patagonia',
    tagline: 'El asesor Ñoquetti apuesta la llave del Archivo. Ganale al truco y seguilo sin que te vea.',
    giver: { name: 'Profe Galarza', at: [-27.46660, -58.83741], look: LOOK.profe },
    unlock: ['m05_dpec'],
    reward: { money: 1800 },
    steps: [
      { type: 'talk', look: LOOK.profe, lines: [
        { who: 'Profe Galarza', text: 'El plano original de Fray Benicio está en la Casa de Gobierno. En la caja fuerte del Ministro.' },
        { who: 'Profe Galarza', text: 'Y la llave del Archivo la tiene su asesor, el Licenciado Ñoquetti. Catorce cargos, no va a ninguno.' },
        { who: 'Profe Galarza', text: 'Lo único que hace es jugar al truco en el Patagonia, en la Costanera. Se va a las ocho en punto.' },
        { who: 'Profe Galarza', text: 'Apuesta todo, joven. Todo. Hasta lo que no es de él. Sobre todo lo que no es de él.' },
      ] },
      { type: 'goto', at: 'patagonia', mode: 'any', r: 16, time: 150,
        hint: 'LLEGÁ AL PATAGONIA ANTES DE LAS 8',
        onFail: 'Ñoquetti ya se fue. Mañana tiene "reunión" (siesta) en la Legislatura.' },
      { type: 'talk', look: LOOK.yanina, lines: [
        { who: 'Yanina (moza)', text: 'Bienvenido al Patagonia. Vista al puente, birra tirada y el asesor en la mesa del fondo.' },
        { who: 'Yanina (moza)', text: 'Ese hace trampa con las señas. Si querés, yo me paro atrás de él y te paso lo que tiene.' },
      ] },
      { type: 'choice', prompt: '¿Cómo jugás contra Ñoquetti?', options: [
        { text: 'Limpio. Le gano igual.', set: { truco_limpio: true }, goto: 4 },
        { text: 'Que Yanina me pase las señas.', set: { truco_limpio: false }, goto: 6 },
      ] },
      // índice 4: truco limpio (más difícil)
      { type: 'scene', id: 'patagonia', hint: 'GANALE AL TRUCO A ÑOQUETTI', opts: {
        dificultad: 7,
        titulo: 'Mesa del fondo, Patagonia',
        intro: 'Atardecer sobre el Paraná. El Puente General Belgrano se prende de luces. Ñoquetti mezcla con anillos de oro.',
        objetivo: 'Ganar la partida de truco a 15 puntos, mano a mano, sin flor.',
        rival: { name: 'Lic. Ñoquetti', look: LOOK.noquetti, estilo: 'mentiroso',
          descripcion: 'Canta truco con cualquier cosa. Si tiene envido alto se toca el reloj (tic involuntario).' },
        reglas: { puntos: 15, flor: false, envido: true, realEnvido: true, faltaEnvido: true, truco: true, retruco: true, valeCuatro: true },
        apuesta: 'La llave del Archivo de la Casa de Gobierno contra el remís de Ña Cata (Ña Cata no sabe nada).',
        senas: false,
        tellRival: 'Se toca el reloj cuando tiene 28 o más de envido.',
        lineasRival: {
          truco: ['¡Truco, pichón!', 'Truco. Y no me mirés así que yo soy funcionario.'],
          envido: ['Envido. Tengo los papeles en regla.', 'Envido... como los gastos reservados.'],
          quiero: ['Quiero. Firmo donde sea.', 'Quiero, quiero, y que lo pague la provincia.'],
          noQuiero: ['No quiero. Lo paso a comisión.', 'No quiero. Esto lo resolvemos en otra licitación.'],
          gana: ['Lo siento, chamigo. Las cartas, como las licitaciones, ya estaban marcadas.'],
          pierde: ['Nderakore... ¿Me hiciste trampa? ¡Esto no consta en actas!'],
        },
        textoGana: 'Ñoquetti tira la llave sobre la mesa y se va sin pagar la cerveza. Yanina: "Clásico."',
        textoPierde: 'Ñoquetti se guarda las llaves del remís. Ña Cata te va a matar. Revancha: volvé a jugar.',
      } },
      { type: 'cond', flag: 'truco_limpio', then: 7, else: 7 }, // salto: cierra la rama limpia
      // índice 6: truco con señas de Yanina (más fácil, con riesgo)
      { type: 'scene', id: 'patagonia', hint: 'GANALE AL TRUCO A ÑOQUETTI (MIRÁ LAS SEÑAS DE YANINA)', opts: {
        dificultad: 5,
        titulo: 'Mesa del fondo, Patagonia',
        intro: 'Atardecer sobre el Paraná. Yanina limpia una mesa detrás de Ñoquetti y te guiña. O tiene una basurita.',
        objetivo: 'Ganar la partida de truco a 15 puntos, mano a mano, sin flor. Yanina te pasa las cartas del rival por señas.',
        rival: { name: 'Lic. Ñoquetti', look: LOOK.noquetti, estilo: 'mentiroso' },
        reglas: { puntos: 15, flor: false, envido: true, realEnvido: true, faltaEnvido: true, truco: true, retruco: true, valeCuatro: true },
        apuesta: 'La llave del Archivo de la Casa de Gobierno contra el remís de Ña Cata (Ña Cata no sabe nada).',
        senas: true,
        tablaSenas: [
          { carta: 'ancho de espadas', sena: 'levanta las cejas' },
          { carta: 'ancho de bastos',  sena: 'guiña un ojo' },
          { carta: 'siete de espadas', sena: 'tuerce la boca a la derecha' },
          { carta: 'siete de oro',     sena: 'tuerce la boca a la izquierda' },
          { carta: 'un tres',          sena: 'se muerde el labio' },
          { carta: 'nada',             sena: 'cierra los ojos' },
        ],
        riesgo: 'Si mirás a Yanina más de 2 manos seguidas, Ñoquetti se da vuelta y la jugada se anula (pierde la mano quien mira).',
        lineasRival: {
          truco: ['¡Truco, pichón!', '¿Qué mirás para atrás? Truco.'],
          envido: ['Envido. Tengo los papeles en regla.'],
          quiero: ['Quiero. Firmo donde sea.'],
          noQuiero: ['No quiero. Lo paso a comisión.'],
          gana: ['Las cartas, como las licitaciones, ya estaban marcadas.'],
          pierde: ['¿Vos me hiciste señas, moza? ¡Esto es una vergüenza institucional!'],
        },
        textoGana: 'Ñoquetti tira la llave sobre la mesa. Yanina: "Hoy te invito yo. Mañana, vos."',
        textoPierde: 'Ñoquetti se guarda las llaves del remís. Ña Cata te va a matar. Revancha: volvé a jugar.',
      } },
      // índice 7: final común
      { type: 'talk', lines: [
        { who: 'Lic. Ñoquetti', text: '(al teléfono, saliendo) Ministro, perdí la llave... no, no al truco, se me cayó. Voy para allá.' },
        { who: 'Yanina (moza)', text: 'Va derecho a la Casa de Gobierno, seguro. Seguilo de lejos, que maneja como pide licitaciones: sin mirar.' },
      ] },
      { type: 'chase', goal: 'follow', time: 180,
        target: { kind: 'auto', name: 'Auto oficial de Ñoquetti', color: '#1a1a1a', from: 'patagonia', to: 'casa_gobierno' },
        hint: 'SEGUÍ A ÑOQUETTI SIN PERDERLO DE VISTA',
        onFail: 'Lo perdiste. Ñoquetti se metió en una rotonda imaginaria y desapareció, como un expediente.' },
      { type: 'talk', lines: [
        { who: 'Vos', text: 'Entró por la puerta de servicio de la Casa de Gobierno. Sin custodia. Con la llave que ya no tiene.' },
        { who: 'Profe Galarza', text: '(por teléfono) ¡Perfecto! Mañana entramos. Bueno, entra usted. Yo tengo la presión alta.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 7 · CASA DE GOBIERNO: escena de sigilo + puzzle de expedientes y caja fuerte; escape 2★
  {
    id: 'm07_casa_gobierno',
    n: 7,
    title: 'Expediente 1865',
    tagline: 'Entrá a la Casa de Gobierno, encontrá los expedientes y abrí la caja fuerte del Ministro.',
    giver: { name: 'Ña Cata', at: [-27.46343, -58.83963], look: LOOK.cata },
    unlock: ['m06_truco'],
    reward: { money: 2200 },
    steps: [
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: 'Así que apostaste mi remís al truco. Mirá vos. ¿Y ganaste? Bueno. Te perdono a medias.' },
        { who: 'Ña Cata', text: 'Yo te espero acá en la plaza con el motor en marcha. Vos entrás, sacás el plano y salís.' },
        { who: 'Ña Cata', text: 'Si te agarran, no me conocés. Si no te agarran, invito chipá.' },
      ] },
      { type: 'goto', at: 'casa_gobierno', mode: 'foot', r: 10, hint: 'ENTRÁ A PIE A LA CASA DE GOBIERNO' },
      { type: 'scene', id: 'casa_gobierno', hint: 'ENCONTRÁ EL PLANO DE FRAY BENICIO', opts: {
        dificultad: 7,
        titulo: 'Casa de Gobierno, después de hora',
        intro: 'Pasillos de mármol, retratos de próceres y un olor a cera y a expediente. Se escucha un ventilador ' +
               'y, a lo lejos, una radio con el partido. Los ordenanzas hacen la ronda... cuando se acuerdan.',
        objetivo: 'Llegar al Archivo con la llave de Ñoquetti, encontrar tres expedientes, ordenarlos y abrir la caja fuerte del despacho.',
        tiempo: 300,
        salas: [
          { id: 'mesa_entradas', nombre: 'Mesa de Entradas', texto: 'Un cartel: "VUELVA MAÑANA". Está ahí desde 1994.' },
          { id: 'pasillo', nombre: 'Pasillo de los Retratos', texto: 'Los gobernadores te miran. Uno parece decir "yo no fui".' },
          { id: 'salon', nombre: 'Salón de Acuerdos', texto: 'Una mesa larguísima y catorce sillas para catorce cargos de Ñoquetti.' },
          { id: 'archivo', nombre: 'Archivo (subsuelo)', texto: 'Montañas de expedientes. Algunos se mueven solos cuando no los mirás.' },
          { id: 'despacho', nombre: 'Despacho del Ministro de Obras Truchas', texto: 'Una maqueta del "Paseo Subterráneo del Bicentenario" sobre el escritorio.' },
        ],
        guardias: [
          { name: 'Ordenanza Benítez', ronda: ['pasillo', 'salon'], vision: 'corta', linea: '¿Quién anda? ...Será el aire acondicionado.' },
          { name: 'Ordenanza Romero', ronda: ['mesa_entradas', 'archivo'], vision: 'media', linea: 'Uy, el partido. Ya vuelvo.' },
        ],
        sigilo: { vistasMax: 3, textoVisto: '¡EY! ¿Usted tiene turno?', escondites: ['detrás de la pila de expedientes', 'debajo de la mesa larga', 'en el placard de los banderines'] },
        puzzle1: {
          tipo: 'expedientes',
          descripcion: 'En el Archivo hay 12 expedientes; 3 son reales y tienen una pista cada uno. Hay que encontrarlos ' +
                       '(los falsos dicen cosas como "Expte. 4532: compra de 800 sillas para una oficina de 3 personas") ' +
                       'y ordenarlos por fecha en el estante.',
          expedientes: [
            { titulo: 'Copia del acta de fundación: San Juan de Vera de las Siete Corrientes', fecha: '3 de abril de 1588', pista: 'La ciudad nació un día TRES.' },
            { titulo: 'Carta de Fray Benicio al guardián de San Francisco', fecha: '13 de abril de 1865', pista: 'La flota llegó al puerto un día TRECE.' },
            { titulo: 'Parte del Combate del Puente de la Batería', fecha: '25 de mayo de 1865', pista: 'La ciudad se recuperó por primera vez un VEINTICINCO.' },
          ],
          falsos: [
            'Expte. 4532: compra de 800 sillas para una oficina de 3 personas.',
            'Expte. 0007: repavimentación de una calle que no existe. Etapa 14 de 14.',
            'Expte. 1111: viático a Disney para estudiar el sistema de drenaje de los castillos.',
            'Expte. 2020: licitación de una licitación.',
            'Expte. 9999: "Esto no lo leas". Firmado: nadie.',
          ],
        },
        puzzle2: {
          tipo: 'caja_fuerte',
          descripcion: 'Caja fuerte de tres ruedas en el despacho, detrás de un cuadro del Ministro sonriendo. ' +
                       'La combinación sale de las pistas de los expedientes, en orden cronológico.',
          combinacion: [3, 13, 25],
          intentos: 3,
          pista: 'Un post-it pegado en la maqueta: "Combinación: las fechas que nadie en este edificio recuerda".',
          contenido: ['Plano original de Fray Benicio (1865)', 'Expte. 0001/Higuera: orden de desmonte del Parque Mitre, sin firmar'],
        },
        textoGana: 'Tenés el plano. Tiene dibujada una cruz, una línea de agua y un árbol enorme junto al río.',
        textoPierde: 'Un ordenanza te acompaña a la salida muy amablemente y te da un número para Mesa de Entradas. Para 2031.',
      } },
      { type: 'talk', lines: [
        { who: 'Vos', text: 'El plano marca una entrada bajo la Cruz de los Milagros y una línea de agua hasta el río.' },
        { who: 'Vos', text: 'Al final, un árbol gigante en la punta del Parque Mitre. Y abajo: "Aquí descansa lo de todos".' },
        { who: 'Ordenanza Romero', text: '¡EY! ¿Y usted qué hace con eso? ¡Seguridaaad! ¡Llamen a la policía!' },
      ] },
      { type: 'escape', stars: 2, hint: 'ESCAPÁ Y PERDÉ A LA POLICÍA' },
      { type: 'goto', at: 'plaza_cabral', mode: 'any', r: 14, hint: 'ENCONTRATE CON ÑA CATA EN LA PLAZA CABRAL' },
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: '¿Me dejaste esperando en la 25 de Mayo con tres patrulleros dando vueltas? Ndeee.' },
        { who: 'Ña Cata', text: 'Bueno, tenés el plano. Chipá para los dos. Pero falta la llave de la cripta, dice el Profe.' },
        { who: 'Ña Cata', text: 'Y la llave la tiene colgada del cuello Chiquito Mbareté. Como medalla. Qué tipo.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 8 · FÚTBOL: partido en el estadio de Huracán + persecución para alcanzar al que no paga la apuesta
  {
    id: 'm08_futbol',
    n: 8,
    title: 'La Copa Sobreprecio',
    tagline: 'Barrio Huracán contra los Ñoquis de Planta. Si ganan, Chiquito entrega la llave de la cripta.',
    giver: { name: 'Tadeo', at: [-27.48377, -58.82983], look: LOOK.tadeo },
    unlock: ['m07_casa_gobierno'],
    reward: { money: 2500 },
    steps: [
      { type: 'talk', look: LOOK.tadeo, lines: [
        { who: 'Tadeo', text: '¡Che! Soy Tadeo, el sobrino del Profe. Juego en el barrio, de nueve. Bueno, de lo que falte.' },
        { who: 'Tadeo', text: 'Chiquito armó un partido: "Copa Sobreprecio". Su equipo son todos empleados de planta.' },
        { who: 'Tadeo', text: 'Apostó la llave que lleva colgada. Si ganamos, es nuestra. Nos falta uno. Sos vos.' },
        { who: 'Vos', text: '¿Y si perdemos?' },
        { who: 'Tadeo', text: 'Nos hacen pintar la cancha con los colores del Ministro. Gris oficina. No podemos perder.' },
      ] },
      { type: 'goto', at: 'huracan', mode: 'any', r: 30, hint: 'ANDÁ A LA CANCHA DE HURACÁN' },
      { type: 'futbol', hint: 'GANÁ EL PARTIDO', opts: {
        rival: 'Los Ñoquis de Planta FC',
        minutos: 6,
        jugadores: 5,
        dificultad: 8,
        estadio: 'huracan',
        equipoJugador: { nombre: 'Barrio Huracán', camiseta: '#f4f4f4', vivos: '#c8282a', arquero: '#e8c020' },
        equipoRival: { nombre: 'Los Ñoquis de Planta FC', camiseta: '#8a8a8a', vivos: '#2a2a3a', arquero: '#4a4a4a',
          estilo: 'Juegan sucio: patean de atrás y se tiran en el área. Se cansan rápido después del minuto 4 (son de planta).' },
        arbitro: 'Comprado: cobra offside cuando el jugador pasa la mitad de la cancha con la pelota. Solo en el primer tiempo.',
        companeros: ['Tadeo (9)', 'El Flaco Ojeda (arquero)', 'Rulo (el colectivero, en defensa)', 'Gladys (sí, Gladys, de 5)'],
        empate: 'Penales: 3 por lado. Si siguen iguales, muerte súbita.',
        objetivo: 'Ganar por al menos un gol (o en los penales).',
        relato: {
          inicio: '¡Arranca la Copa Sobreprecio en el estadio de Huracán! Hinchada del barrio, bombos y chipá.',
          golJugador: ['¡GOOOOL DEL BARRIO! ¡SAPUCAAAAY!', '¡Golazo! ¡Como para un chamamé!', '¡Adentro! ¡Ndeee!'],
          golRival: ['Gol de los Ñoquis. Primera vez que trabajan en el año.', 'Gol rival. El árbitro lo festeja. Disimula mal.'],
          falta: ['¡Patada de planta permanente!', 'Falta. El árbitro mira el celular.'],
          final: 'Terminó el partido. Que alguien despierte a los suplentes de los Ñoquis.',
        },
      } },
      { type: 'talk', lines: [
        { who: 'Tadeo', text: '¡GANAMOS! ¡Chiquito, la llave!' },
        { who: 'Chiquito Mbareté', text: 'Ehh... la apuesta era de palabra. Y la palabra, en este ministerio, no tiene presupuesto.' },
        { who: 'Chiquito Mbareté', text: '¡Me voy a Resistencia! ¡Chau, perdedores ganadores!' },
      ] },
      { type: 'chase', goal: 'catch', time: 150,
        target: { kind: 'auto', name: 'Camioneta de Chiquito', color: '#4a8a3a', from: 'huracan', to: 'subida_puente' },
        hint: 'ALCANZÁ A CHIQUITO ANTES DEL PUENTE',
        onFail: 'Chiquito cruzó el puente. Ahora la llave es problema del Chaco.' },
      { type: 'talk', lines: [
        { who: 'Chiquito Mbareté', text: 'Bueno, bueno, tomá la llave. Pero el Ministro ya sabe todo. Mañana entra la topadora.' },
        { who: 'Vos', text: 'Una llave de hierro, larga como una mano, con una cruz en el mango. "Cripta. 1730".' },
        { who: 'Tadeo', text: '1730: el año que llevaron la Cruz a la iglesia nueva. El tío dice que esta noche bajamos.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 9 · TÚNELES: llegar a la iglesia contra reloj + dungeon en primera persona (cambia si tenés tabaco) + escape 3★
  {
    id: 'm09_tuneles',
    n: 9,
    title: 'Donde la cruz no ardió',
    tagline: 'Bajá por la cripta de la Cruz de los Milagros y seguí el agua hasta el río.',
    giver: { name: 'Profe Galarza', at: [-27.47110, -58.84005], look: LOOK.profe },
    unlock: ['m08_futbol'],
    reward: { money: 3000 },
    steps: [
      { type: 'talk', look: LOOK.profe, lines: [
        { who: 'Profe Galarza', text: 'Cuentan que los túneles unían las iglesias, el Cabildo y San Francisco, y salían al río.' },
        { who: 'Profe Galarza', text: 'Los ingenieros dicen que son desagües. Los historiadores dicen que no. Yo digo: bajemos y veamos.' },
        { who: 'Profe Galarza', text: 'En 1865, con la ciudad ocupada, Fray Benicio llevó por acá lo que los vecinos le confiaron.' },
        { who: 'Profe Galarza', text: 'Rápido: Chiquito ya le avisó al Ministro. Don Eulogio, el sacristán, nos abre la puerta.' },
      ] },
      { type: 'goto', at: 'cruz_milagros', mode: 'any', r: 12, time: 90,
        hint: 'LLEGÁ A LA IGLESIA DE LA CRUZ ANTES QUE LOS DEL MINISTRO',
        onFail: 'Llegaron primero los del Ministro y pusieron una faja: "CLAUSURADO POR OBRA". ¿Qué obra?' },
      { type: 'talk', look: LOOK.eulogio, lines: [
        { who: 'Don Eulogio', text: 'Pasen, pasen. La cruz de urunday está acá desde 1730. La cripta, desde antes.' },
        { who: 'Don Eulogio', text: 'Yo no vi nada. Y si ven un hombrecito peludo que silba allá abajo... no le griten. Es sensible.' },
      ] },
      { type: 'cond', flag: 'tabaco_pombero', then: 4, else: 6 },
      // índice 4: túnel con ayuda del Pombero (le diste el cigarro)
      { type: 'scene', id: 'tunel', hint: 'SEGUÍ EL AGUA HASTA EL RÍO', opts: {
        dificultad: 8, pomberoAyuda: true,
        titulo: 'Los túneles de las Siete Corrientes',
        intro: 'Escalones de ladrillo colonial, humedad, olor a río. La antorcha chisporrotea. Bajo la Cruz empieza la oscuridad.',
        objetivo: 'Cruzar las cinco galerías siguiendo la regla del Gauchito: seguí el agua y no el brillo. Salir por la boca de la Costanera.',
        regla: 'Donde gotea, se avanza; donde brilla, se cae. Las monedas brillantes marcan trampas (pozo o derrumbe).',
        niveles: [
          { nombre: 'Galería de la Cruz', bajo: 'calle Belgrano', texto: 'Paredes de ladrillo y raíces que atraviesan el techo.', peligro: 'ratas' },
          { nombre: 'Cruce de la Merced', bajo: 'la Iglesia de la Merced', texto: 'Una campana suena arriba. El polvo cae del techo.', peligro: 'monedas trampa' },
          { nombre: 'Bóveda del Cabildo', bajo: 'la Jefatura de Policía', texto: 'Grilletes oxidados y un banco de piedra. Se escuchan pasos arriba.', peligro: 'hombres del Ministro con linternas (sigilo)' },
          { nombre: 'Pasaje de los Frailes', bajo: 'el convento de San Francisco', texto: 'Cruces talladas y una inscripción: "Fr. B. pasó por aquí. Sin miedo."', peligro: 'agua que sube' },
          { nombre: 'Boca del río', bajo: 'la Costanera', texto: 'Luz de luna. El Paraná está bajo y la boca quedó a la vista.', peligro: 'corriente' },
        ],
        antorcha: { duracion: 90, recargas: 'nichos con cebo de vela cada tantos pasillos' },
        pombero: {
          aparece: 'En el Cruce de la Merced, un hombrecito peludo, sombrero de paja, sentado en una piedra.',
          lineas: ['Psst. ¿Tenés tabaco?', '(fuma) Ahora sí. Seguí mi silbido, gurí.', 'A la derecha no. A la derecha está el Kurupí. Mentira. Pero no vayas.'],
          ayuda: 'Silba desde la galería correcta en cada cruce y una vez apaga la linterna de un hombre del Ministro.',
        },
        hallazgos: ['Medalla de la Merced', 'Cartucho de fusil de 1865', 'Página del diario de Fray Benicio'],
        diarioFraile: 'Abril de 1865. La flota entró al puerto. Los vecinos me trajeron la plata de las iglesias y sus ahorros. ' +
                      'Lo llevaré bajo tierra hasta la punta, junto al árbol grande. Que vuelva al pueblo cuando haya paz.',
        textoGana: 'Salís a la Costanera por la boca del túnel. El aire fresco del río. Y sirenas.',
        textoPierde: 'Se apaga la antorcha. Escuchás un silbido burlón. Volvés a empezar desde la cripta.',
      } },
      { type: 'cond', flag: 'tabaco_pombero', then: 7, else: 7 }, // salto: cierra la rama con Pombero
      // índice 6: túnel sin ayuda (el Pombero hace travesuras)
      { type: 'scene', id: 'tunel', hint: 'SEGUÍ EL AGUA HASTA EL RÍO', opts: {
        dificultad: 9, pomberoAyuda: false,
        titulo: 'Los túneles de las Siete Corrientes',
        intro: 'Escalones de ladrillo colonial, humedad, olor a río. La antorcha chisporrotea. Bajo la Cruz empieza la oscuridad.',
        objetivo: 'Cruzar las cinco galerías siguiendo la regla del Gauchito: seguí el agua y no el brillo. Salir por la boca de la Costanera.',
        regla: 'Donde gotea, se avanza; donde brilla, se cae. Las monedas brillantes marcan trampas (pozo o derrumbe).',
        niveles: [
          { nombre: 'Galería de la Cruz', bajo: 'calle Belgrano', texto: 'Paredes de ladrillo y raíces que atraviesan el techo.', peligro: 'ratas' },
          { nombre: 'Cruce de la Merced', bajo: 'la Iglesia de la Merced', texto: 'Una campana suena arriba. El polvo cae del techo.', peligro: 'monedas trampa' },
          { nombre: 'Bóveda del Cabildo', bajo: 'la Jefatura de Policía', texto: 'Grilletes oxidados y un banco de piedra. Se escuchan pasos arriba.', peligro: 'hombres del Ministro con linternas (sigilo)' },
          { nombre: 'Pasaje de los Frailes', bajo: 'el convento de San Francisco', texto: 'Cruces talladas y una inscripción: "Fr. B. pasó por aquí. Sin miedo."', peligro: 'agua que sube' },
          { nombre: 'Boca del río', bajo: 'la Costanera', texto: 'Luz de luna. El Paraná está bajo y la boca quedó a la vista.', peligro: 'corriente' },
        ],
        antorcha: { duracion: 75, recargas: 'nichos con cebo de vela cada tantos pasillos' },
        pombero: {
          aparece: 'En el Cruce de la Merced, un hombrecito peludo, sombrero de paja, sentado en una piedra.',
          lineas: ['Psst. ¿Tenés tabaco?', '¿No? Mezquino.', '(silbido burlón desde el pasillo equivocado)'],
          travesuras: 'Una vez apaga la antorcha; una vez silba desde una galería falsa; esconde un cebo de vela.',
        },
        hallazgos: ['Medalla de la Merced', 'Cartucho de fusil de 1865', 'Página del diario de Fray Benicio'],
        diarioFraile: 'Abril de 1865. La flota entró al puerto. Los vecinos me trajeron la plata de las iglesias y sus ahorros. ' +
                      'Lo llevaré bajo tierra hasta la punta, junto al árbol grande. Que vuelva al pueblo cuando haya paz.',
        textoGana: 'Salís a la Costanera por la boca del túnel. El aire fresco del río. Y sirenas.',
        textoPierde: 'Se apaga la antorcha. Escuchás un silbido burlón. Volvés a empezar desde la cripta.',
      } },
      // índice 7: salida al río
      { type: 'talk', lines: [
        { who: 'Profe Galarza', text: '(sin aire) ¡Salimos frente a San Francisco! ¡Era cierto! ¡Era cierto y además era un desagüe!' },
        { who: 'Vos', text: 'Profe, la policía. El Ministro dijo que somos ladrones de patrimonio.' },
        { who: 'Profe Galarza', text: 'Qué ironía. Corra, joven. Yo me escondo en el Paseo. Nos vemos donde termina el plano.' },
      ] },
      { type: 'escape', stars: 3, hint: 'PERDÉ A LA POLICÍA (3 ESTRELLAS)' },
      { type: 'goto', at: 'puerto', mode: 'any', r: 18, hint: 'ENCONTRATE CON ÑA CATA EN EL PUERTO' },
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: 'Viernes, luna llena y vos saliendo de un agujero. Pensé que eras el lobizón.' },
        { who: 'Ña Cata', text: 'Mañana al amanecer entran las topadoras al Parque Mitre. Dormí dos horas. Yo te despierto con mate.' },
      ] },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────────────────────────
  // 10 · FINAL: carrera contra la topadora + alcanzar al Ministro + cuevas de la Higuera + escape 4★ + epílogo con flag
  {
    id: 'm10_higuera',
    n: 10,
    title: 'Lo de todos',
    tagline: 'Amanece. Las topadoras van por la Higuera de la India. Lo que escondió Fray Benicio está debajo.',
    giver: { name: 'Ña Cata', at: [-27.46139, -58.83826], look: LOOK.cata },
    unlock: ['m09_tuneles'],
    reward: { money: 5000 },
    steps: [
      { type: 'talk', look: LOOK.cata, lines: [
        { who: 'Ña Cata', text: 'Arriba, mitaí. Mate y chipá. Las topadoras salieron del obrador hace diez minutos.' },
        { who: 'Ña Cata', text: 'Llevate el remís. Hoy no cobro. Hoy manejás vos y que Dios y el Gauchito nos ayuden.' },
      ] },
      { type: 'vehicle', kind: 'remis', at: 'puerto', hint: 'SUBÍ AL REMÍS' },
      { type: 'goto', at: 'parque_mitre', mode: 'vehicle', r: 30, time: 100,
        hint: 'LLEGÁ AL PARQUE MITRE ANTES QUE LAS TOPADORAS',
        onFail: 'Llegaste tarde. Ahora hay un cartel: "AQUÍ HABRÁ UN PASEO". Siempre habrá. Nunca hay.' },
      { type: 'talk', lines: [
        { who: 'Profe Galarza', text: '¡Llegó! Me encadené a la Higuera. Bueno, con el cinturón. Es lo que tenía.' },
        { who: 'Ministro Sobreprecio', text: '(desde su camioneta) ¡Saquen a ese viejo! Tengo la orden de desmonte acá, firmada.' },
        { who: 'Profe Galarza', text: '¡Sin esa orden no pueden tocar el árbol! ¡Quitesela, joven!' },
      ] },
      { type: 'chase', goal: 'catch', time: 120,
        target: { kind: 'auto', name: 'Camioneta oficial del Ministro', color: '#2a2a3a', from: 'parque_mitre', to: 'casa_gobierno' },
        hint: 'ALCANZÁ LA CAMIONETA DEL MINISTRO Y FRENALA',
        onFail: 'El Ministro llegó a la Casa de Gobierno con la orden. La topadora arranca.' },
      { type: 'talk', look: LOOK.ministro, lines: [
        { who: 'Ministro Sobreprecio', text: '¡Esto es un atropello! ¿Sabe quién soy yo? Soy el que firma. Y lo que firmo, se hace.' },
        { who: 'Vos', text: 'Esta orden no tiene firma, Ministro. Y el expediente dice "Higuera". Ni sabían el nombre del árbol.' },
        { who: 'Ministro Sobreprecio', text: '...Es un detalle técnico. ¡Chiquito! ¡CHIQUITO! ¿Dónde está Chiquito?' },
      ] },
      { type: 'goto', at: 'higuera', mode: 'foot', r: 10, hint: 'ANDÁ A PIE HASTA LA HIGUERA DE LA INDIA' },
      { type: 'scene', id: 'higuera', hint: 'ENCONTRÁ EL COFRE DE FRAY BENICIO', opts: {
        dificultad: 10,
        titulo: 'Bajo la Higuera de la India',
        intro: 'Entre las raíces de la Higuera centenaria (el Gomero de la India, dicen los carteles) hay un hueco ' +
               'que nadie vio nunca. Adentro, cuevas de tierra colorada, raíces como columnas y el rumor del Paraná.',
        objetivo: 'Recorrer las cuevas, abrir las tres compuertas de raíces con los símbolos del plano, llevar el cofre a la salida ' +
                  'sin tocar la plata suelta y antes de que la topadora derrumbe la entrada.',
        tiempo: 360,
        zonas: [
          { nombre: 'Las raíces', texto: 'Raíces que se mueven si las empujás. Algunas son puertas.' },
          { nombre: 'La galería de los cautivos', texto: 'Nombres de vecinos de 1865 grabados en la tierra.' },
          { nombre: 'El ojo de agua', texto: 'Una vertiente que va hacia la Punta Arazá. Se oye el río.' },
          { nombre: 'La cámara del fraile', texto: 'Un cofre de madera dura con herrajes y una cruz. Y una luz que flota.' },
        ],
        compuertas: [
          { simbolo: 'cruz', pista: 'Donde la cruz no ardió (la entrada de los túneles).' },
          { simbolo: 'agua', pista: 'Seguí el agua y no el brillo (el acertijo del Gauchito).' },
          { simbolo: 'árbol', pista: 'Aquí descansa lo de todos (el final del plano).' },
        ],
        pora: {
          descripcion: 'La Pora: una luz mala que flota, el alma que cuida la plata enterrada (plata yvyguy).',
          regla: 'Hay monedas de plata sueltas por todos lados. Si agarrás una, la Pora se enoja: te persigue y las raíces se cierran 20 s. ' +
                 'Si llevás solo el cofre, la Pora te acompaña e ilumina el camino de salida.',
          lineas: ['Lo de todos... es de todos...', 'No es tuyo. No es de él. Es de ellos.', '(la luz se calma y te sigue)'],
        },
        amenaza: 'Arriba la topadora golpea el suelo cada 30 s: cae tierra y se tapa un pasadizo. A los 360 s se derrumba la entrada.',
        tesoro: [
          'Cofre con la plata de las iglesias: custodia, candelabros, cálices',
          'Sable de un oficial del Combate del Puente de la Batería (25 de mayo de 1865)',
          'Carta de Fray Benicio con la lista de vecinos que confiaron sus ahorros',
          'Una bandera vieja, doblada con cuidado',
        ],
        cartaFraile: 'A quien encuentre esto: no es mío ni tuyo. Es del pueblo de Corrientes. Devolvelo cuando haya paz. Fr. Benicio.',
        textoGana: 'Salís con el cofre a la luz del amanecer. La topadora se apaga sola. El maquinista se persigna.',
        textoPierde: 'Se derrumba la entrada. Volvés a la superficie con las manos vacías y tierra hasta en las orejas.',
      } },
      { type: 'talk', lines: [
        { who: 'Profe Galarza', text: '¡El cofre de Fray Benicio! ¡Ciento sesenta años bajo la Higuera!' },
        { who: 'Ministro Sobreprecio', text: '¡Eso es del Estado! ¡O sea mío! ¡Policía! ¡Ese hombre es un tesorero trucho!' },
        { who: 'Ña Cata', text: '¡Subí el cofre al remís, mitaí! ¡Al Museo Histórico! ¡Ahí no lo toca nadie!' },
      ] },
      { type: 'escape', stars: 4, hint: 'LLEVÁ EL COFRE Y PERDÉ A LA POLICÍA (4 ESTRELLAS)' },
      { type: 'goto', at: 'museo_historico', mode: 'vehicle', r: 16, hint: 'ENTREGÁ EL COFRE EN EL MUSEO HISTÓRICO' },
      { type: 'cond', flag: 'honesto', then: 12, else: 14 },
      // índice 12: epílogo si le llevaste los papeles al Profe (misión 4)
      { type: 'talk', lines: [
        { who: 'Profe Galarza', text: 'Desde la bolsa de basura supe que usted era de fiar. El Museo lo recibe en nombre de todos.' },
        { who: 'Profe Galarza', text: 'Y el Parque Mitre queda como está. La Higuera, declarada árbol histórico. Por decreto. Uno de verdad.' },
      ] },
      { type: 'cond', flag: 'honesto', then: 15, else: 15 }, // salto: cierra el epílogo A
      // índice 14: epílogo si le vendiste los papeles a Chiquito
      { type: 'talk', lines: [
        { who: 'Gladys', text: 'Al final la foto de mi celu sirvió más que tu billetera, ¿viste? Pero volviste. Eso cuenta.' },
        { who: 'Profe Galarza', text: 'Todos tenemos un día Ñoquetti, joven. Lo importante es el último día. El Museo lo recibe.' },
      ] },
      // índice 15: final común
      { type: 'talk', lines: [
        { who: 'Ña Cata', text: 'El Ministro dice que va a "investigar a fondo". El expediente ya pasó a otro cajón. Clásico.' },
        { who: 'Tadeo', text: 'Tío, ¿y si hay más túneles? ¿Y el que va hacia la Casa de Gobierno?' },
        { who: 'Profe Galarza', text: 'Eso, sobrino, es otra historia. Ahora... ¡chipá y chamamé para todos!' },
        { who: 'Todos', text: '¡SAPUCAAAAAAY!' },
      ] },
    ],
  },
];
