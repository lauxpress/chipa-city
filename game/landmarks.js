// CHIPA CITY — edificios emblemáticos de Corrientes.
// Cada ficha se aplica al edificio de OpenStreetMap con ese nombre exacto (la forma sale de OSM).
// Es una interpretación propia en pixel art, hecha mirando fotos libres de Wikimedia Commons como referencia.
//
//   height   altura de las paredes (m)          storey  alto de cada "piso" de la fachada (m)
//   wall     color de las paredes                trim    molduras, columnas y marcos
//   style    fachada: clasico | iglesia | teatro | escuela | ladrillo | moderno | vidrio | paneles | colonial | casita
//            | balcones | castillo | perforado | lamas | canopy
//   roof     { shape: flat | gable | hip | vault, color, rise (px, opcional) }
//   parapet  balaustrada sobre techo plano (color)
//   statues  estatuas / remates sobre la cornisa      tank  tanque de agua de hormigón en el techo
//   base     altura (m) donde empieza un bloque elevado (corona, voladizo)
//   slopeTop techo inclinado: fracción de altura en el extremo bajo; spike: mástil
//   crenel   almenas (color); frame aristas de la torre (color); pyramid { h (m), color }
//   tribuna  gradas que bajan hacia la cancha más cercana: { low, seats [colores por bloque], block (m), press, rim, stagger }
//   at       [lat, lon] opcional: si varios edificios de OSM tienen el mismo nombre, se usa el más cercano
//   towers   { layout: twin | single | center, w (m), h (m), cap: dome | spire | pyramid, capColor, clock }
//
// Para sumar un edificio: copiá una ficha, poné el nombre tal como figura en OSM y ajustá los valores.
'use strict';
window.LANDMARKS = {
  // Salmón, neoclásica, con columnas, frontis curvos y balaustrada con remates sobre la Plaza 25 de Mayo
  'Casa de Gobierno de la Provincia de Corrientes': {
    height: 15, storey: 5, wall: '#e6a08e', trim: '#f8e8de', style: 'clasico',
    roof: { shape: 'flat', color: '#d49a88' }, parapet: '#f8e8de', statues: true,
  },
  // Blanca, con pórtico de columnas y dos torres rematadas en cúpulas celestes
  'Catedral Ntra. Sra. del Rosario': {
    height: 14, storey: 7, wall: '#f2efe8', trim: '#ffffff', style: 'iglesia',
    roof: { shape: 'gable', color: '#b8b4ac' },
    towers: { layout: 'twin', w: 6, h: 36, cap: 'dome', capColor: '#a6c2d8' },
  },
  // Amarillo con molduras blancas, balcones y estatuas en las esquinas
  'Teatro Vera': {
    height: 19, storey: 4.75, wall: '#dcc656', trim: '#f6f2dc', style: 'teatro',
    roof: { shape: 'flat', color: '#c8b45a' }, parapet: '#f6f2dc', statues: true,
  },
  // Crema, con dos torres de agujas oscuras
  'Iglesia San Francisco Solano': {
    height: 13, storey: 6.5, wall: '#e8dcc4', trim: '#f8f2e4', style: 'iglesia',
    roof: { shape: 'gable', color: '#9a5a44' },
    towers: { layout: 'twin', w: 5, h: 32, cap: 'spire', capColor: '#3c3c46' },
  },
  // Santuario de la Cruz de los Milagros (frente a la Plaza de la Cruz, sobre Belgrano): blanca y crema, ecléctica,
  // nave con techo a dos aguas gris claro y un campanario al frente que mira al atrio arbolado
  'Iglesia Santísima Cruz de los Milagros': {
    height: 12, storey: 6, wall: '#f2ead8', trim: '#fffaf0', style: 'iglesia',
    roof: { shape: 'gable', color: '#a8a49c', rise: 16 },
    towers: { layout: 'single', w: 5, h: 26, cap: 'pyramid', capColor: '#d8cdb4' },
  },
  // Gris piedra, sobria, de tres plantas
  'Escuela Normal José Manuel Estrada': {
    height: 13, storey: 4.3, wall: '#9c968c', trim: '#bab4a8', style: 'escuela',
    roof: { shape: 'flat', color: '#7a766e' }, parapet: '#8a847a',
  },
  // Blanca, con una sola torre alta con reloj y aguja
  'Iglesia Nuestra Señora de la Merced': {
    height: 15, storey: 7.5, wall: '#f0ece2', trim: '#ffffff', style: 'iglesia',
    roof: { shape: 'gable', color: '#a8a49c' },
    towers: { layout: 'single', w: 6, h: 44, cap: 'spire', capColor: '#ece8de', clock: true },
  },

  // ---- segunda tanda --------------------------------------------------------------------------------------------
  // Vieja estación del ferrocarril (hoy Ministerio de Producción): paredes claras, mansarda oscura y torre central
  'Ministerio de Producción': {
    at: [-27.47134, -58.82242], // hay varios edificios con este nombre: solo el de la vieja estación
    height: 9, storey: 4.5, wall: '#ece4d2', trim: '#faf6ec', style: 'clasico',
    roof: { shape: 'hip', color: '#4a4e58', rise: 14 },
    towers: { layout: 'center', w: 5, h: 24, cap: 'spire', capColor: '#4a4e58' },
  },
  // Estadio José Jorge Conte (Club de Regatas): estadio cubierto con bóveda de chapa
  'Club de Regatas Corrientes': {
    height: 10, storey: 5, wall: '#eeeeec', trim: '#2a5aa8', style: 'moderno',
    roof: { shape: 'vault', color: '#a8b0b8', rise: 34 },
  },
  // Facultad de Medicina (UNNE): ladrillo visto, marcos claros y techo de tejas
  'Facultad de Medicina UNNE': {
    height: 8, storey: 4, wall: '#b0503a', trim: '#f0ebe0', style: 'ladrillo',
    roof: { shape: 'hip', color: '#a85a40', rise: 16 },
  },
  // Instituto de Cardiología: moderno, crema, con ventanas corridas
  'Instituto de Cardiología de Corrientes': {
    height: 12, storey: 4, wall: '#ece2c8', trim: '#f6f0e0', style: 'moderno',
    roof: { shape: 'flat', color: '#b8b4aa' }, parapet: '#e6dcc4',
  },
  // Rectorado de la UNNE: paredes blancas, dinteles de ladrillo y techo de tejas
  'Rectorado UNNE': {
    height: 7.5, storey: 3.75, wall: '#f4f2ec', trim: '#b0503a', style: 'colonial',
    roof: { shape: 'hip', color: '#b05a3c', rise: 14 },
  },
  // FACENA (UNNE): paneles de hormigón
  'Facena unne': {
    height: 18, storey: 3, wall: '#c8c0b0', trim: '#a8a090', style: 'paneles',
    roof: { shape: 'flat', color: '#8e8a82' }, parapet: '#a8a090',
  },
  // Mercado Municipal de Productos Frescos: nave con bóveda de chapa
  'Mercado Municipal de Productos Frescos': {
    height: 8, storey: 4, wall: '#e8dcc0', trim: '#b0503a', style: 'colonial',
    roof: { shape: 'vault', color: '#9ea6ae', rise: 26 },
  },
  // Gran Hotel Guaraní: torre moderna de 12 pisos en el centro
  'Gran Hotel Guaraní': {
    height: 36, storey: 3, wall: '#e8e4dc', trim: '#f8f6f0', style: 'moderno',
    roof: { shape: 'flat', color: '#9a968e' }, parapet: '#d8d4cc',
  },
  // Centro Administrativo: la torre de vidrio más alta del centro
  'Centro Administrativo Corrientes': {
    height: 63, storey: 3, wall: '#3a5878', trim: '#a8c4dc', style: 'vidrio',
    roof: { shape: 'flat', color: '#8a8e94' }, parapet: '#c8ccd2',
  },

  // ---- casas del barrio --------------------------------------------------------------------------------------
  // Casa en la esquina de Guido Spano y Vélez Sarsfield: blanca, techo plano, galería al frente y tanque arriba
  'Mi casa': {
    height: 3.8, storey: 3.8, wall: '#f2f0ea', trim: '#ffffff', style: 'casita',
    roof: { shape: 'flat', color: '#d6d4ce' }, parapet: '#f4f2ec', tank: true,
  },

  // ---- Costanera sur -----------------------------------------------------------------------------------------
  // Marriott (en Lavalle): torre de vidrio con losas blancas y podio curvo de vidrio
  'Marriott': {
    height: 64, storey: 3, wall: '#5a7896', trim: '#f2f2ee', style: 'balcones',
    roof: { shape: 'flat', color: '#9aa0a8' }, parapet: '#e8e8e4',
  },
  'Marriott (podio)': {
    height: 16, storey: 4, wall: '#7a9ab6', trim: '#f4f4f0', style: 'balcones',
    roof: { shape: 'flat', color: '#c8ccd0' }, parapet: '#f0f0ec',
  },
  // Torre Ribera: dos láminas con una ranura al medio, unidas arriba por una corona
  'Torre Ribera': {
    height: 90, storey: 3, wall: '#b8c0c8', trim: '#f2f2f0', style: 'balcones',
    roof: { shape: 'flat', color: '#b0b4ba' }, parapet: '#e8e8e8',
  },
  'Torre Ribera (base)': {
    height: 10, storey: 5, wall: '#e8e8e4', trim: '#f4f4f0', style: 'moderno',
    roof: { shape: 'flat', color: '#c8c8c4' },
  },
  'Torre Ribera (corona)': {
    base: 82, height: 90, storey: 4, wall: '#e6e6e2', trim: '#f4f4f0', style: 'moderno',
    roof: { shape: 'flat', color: '#b0b4ba' },
  },
  // La tercera torre (nombre provisorio): vidrio azul con aristas blancas y un voladizo arriba
  'Torre Costanera Sur': {
    height: 92, storey: 3, wall: '#3a5878', trim: '#a8c4dc', style: 'vidrio',
    roof: { shape: 'flat', color: '#6a7078' }, parapet: '#f4f4f0', frame: '#f4f4f0',
  },
  'Torre Costanera Sur (base)': {
    height: 11, storey: 3.7, wall: '#c8ccd2', trim: '#e8e8e4', style: 'paneles',
    roof: { shape: 'flat', color: '#a8acb0' },
  },
  'Torre Costanera Sur (voladizo)': {
    base: 82, height: 92, storey: 3, wall: '#3a5878', trim: '#a8c4dc', style: 'vidrio',
    roof: { shape: 'flat', color: '#6a7078' }, frame: '#f4f4f0',
  },

  // ---- La Unidad (ex cárcel, hoy centro de innovación) ---------------------------------------------------------
  'La Unidad (edificio norte)': {
    height: 10, storey: 3.3, wall: '#e8e0cc', trim: '#f4f0e4', style: 'moderno',
    roof: { shape: 'flat', color: '#4a4c54' },
  },
  'La Unidad (cárcel)': { // muralla de ladrillo con fajas claras y almenas
    height: 7, storey: 7, wall: '#b8664a', trim: '#e6d2a8', style: 'castillo',
    roof: { shape: 'flat', color: '#d8d4cc' }, crenel: '#e6d2a8',
  },
  'La Unidad (portón)': {
    height: 10, storey: 5, wall: '#b8664a', trim: '#e6d2a8', style: 'castillo',
    roof: { shape: 'flat', color: '#c8c0b0' }, crenel: '#e6d2a8',
  },
  'Museo de la Cárcel y Centro de Ciencias': { // el panóptico en cruz, con la pirámide de vidrio
    height: 9, storey: 4.5, wall: '#b8664a', trim: '#e6d2a8', style: 'castillo',
    roof: { shape: 'flat', color: '#6a6e78' }, crenel: '#e6d2a8', pyramid: { h: 8, color: '#8ab4cc' },
  },
  'La Unidad (CIT)': {
    height: 13, storey: 4.3, wall: '#f0f0ec', trim: '#f8f8f4', style: 'perforado',
    roof: { shape: 'flat', color: '#d8d8d4' }, parapet: '#f4f4f0',
  },
  'Torre CIT La Unidad': { // la "vela": blanca, con ranuras y el techo en diagonal
    height: 92, storey: 3, wall: '#f2f2ee', trim: '#ffffff', style: 'perforado',
    roof: { shape: 'flat', color: '#d0d0cc' }, slopeTop: 0.7, spike: true,
  },

  // ---- más correcciones con fotos del usuario --------------------------------------------------------------
  'Marriott (torre sur)': { // la segunda torre del Marriott, más residencial
    height: 70, storey: 3, wall: '#c8ccd2', trim: '#f4f4f0', style: 'balcones',
    roof: { shape: 'flat', color: '#a8acb2' }, parapet: '#e8e8e8',
  },
  // IOSCor (entre Blas B. de la Vega y Niveyro, Carrillo y Lavalle): podio con lamas y tres torres
  'IOSCor (podio)': {
    height: 6.5, storey: 3.25, wall: '#a8acb0', trim: '#c4c8cc', style: 'lamas',
    roof: { shape: 'flat', color: '#8a8e94' }, parapet: '#b8bcc0',
  },
  'IOSCor (torre oeste)': {
    height: 50, storey: 3.5, wall: '#9aa0a6', trim: '#c4c8cc', style: 'lamas',
    roof: { shape: 'flat', color: '#6a6e74' }, parapet: '#b8bcc0', frame: '#b8bcc0',
  },
  'IOSCor (torre central)': {
    height: 38, storey: 3.5, wall: '#2e4a6a', trim: '#8ab0d0', style: 'vidrio',
    roof: { shape: 'flat', color: '#5a5e64' }, parapet: '#a8acb0',
  },
  'IOSCor (torre este)': {
    height: 50, storey: 3.5, wall: '#9aa0a6', trim: '#c4c8cc', style: 'lamas',
    roof: { shape: 'flat', color: '#6a6e74' }, parapet: '#b8bcc0', frame: '#b8bcc0',
  },
  // Estación de servicio en 3 de Abril y Blas de la Vega: techo sobre columnas (con paneles solares) y tienda
  'Estación de servicio (techo)': {
    base: 4.6, height: 5.8, storey: 1.2, wall: '#f4f4f0', trim: '#d8302a', style: 'canopy',
    roof: { shape: 'flat', color: '#34486a' },
  },
  'Estación de servicio (tienda)': {
    height: 5, storey: 5, wall: '#f4f4f0', trim: '#d8302a', style: 'moderno',
    roof: { shape: 'flat', color: '#a84a3a' },
  },

  // ---- Estadio de Huracán (Club Atlético Huracán Corrientes, Av. Sarmiento y Av. Teniente Ibáñez) ------------------
  'Huracán (tribuna oeste)': { // la grande: dos bandejas de butacas rojas y azules, pared blanca y cabina de prensa
    height: 14, storey: 3.5, wall: '#f0f0ea', trim: '#2a4aa8', style: 'moderno',
    roof: { shape: 'flat', color: '#a8a8a2' }, tribuna: { low: 0.1, seats: ['#c8302a', '#2a4aa8'], block: 6, press: true, stagger: true }, // stagger: la bandeja de arriba corre los colores un bloque,
  },
  'Huracán (tribuna norte)': { // detrás del arco: baja, roja y azul
    height: 7, storey: 3.5, wall: '#f0f0ea', trim: '#c8302a', style: 'moderno',
    roof: { shape: 'flat', color: '#a8a8a2' }, tribuna: { low: 0.18, seats: ['#2a4aa8', '#c8302a'], block: 5 },
  },
  'Huracán (tribuna este)': { // larga, de hormigón color óxido
    height: 10, storey: 3.3, wall: '#d8d0c4', trim: '#a85a30', style: 'paneles',
    roof: { shape: 'flat', color: '#9a8a7a' }, tribuna: { low: 0.12, seats: ['#c8703a', '#b05c32', '#d8884e'], block: 9, rim: '#e8e4dc' },
  },
  'Huracán (tribuna sur)': { // de ladrillo, con locales blancos que dan a Teniente Ibáñez
    height: 8, storey: 3.2, wall: '#f2f2ee', trim: '#c8302a', style: 'moderno',
    roof: { shape: 'flat', color: '#9a8a7a' }, tribuna: { low: 0.15, seats: ['#b8603a', '#a4522e'], block: 8, rim: '#c87a54' },
  },

  // ---- Plaza de la Cruz y alrededores (build_map.py, desde la captura satelital) --------------------------------
  // Escuela N° 3 del Centenario / Colegio Pte. Hipólito Yrigoyen: claustro de dos plantas con dos patios y tejas
  'Escuela N° 3 del Centenario': {
    height: 9, storey: 4.5, wall: '#ece0c8', trim: '#f8f2e4', style: 'colonial',
    roof: { shape: 'hip', color: '#a8583c', rise: 12 },
  },
  'Escuela N° 3 del Centenario (centro)': { // el cuerpo del medio, entre los dos patios: techo plano gris
    height: 8, storey: 4, wall: '#e6dcc6', trim: '#f4eee0', style: 'colonial',
    roof: { shape: 'flat', color: '#9a9894' }, parapet: '#e6dcc6',
  },
  // Club San Martín: el gimnasio de techo grande (chapa gris a dos aguas, bajo) y la pileta techada
  'Club San Martín': {
    height: 10, storey: 5, wall: '#e8e6e0', trim: '#2a6a3a', style: 'moderno',
    roof: { shape: 'gable', color: '#a8acb0', rise: 10 },
  },
  'Club San Martín (natatorio)': {
    height: 7, storey: 3.5, wall: '#e8e6e0', trim: '#2a6a3a', style: 'moderno',
    roof: { shape: 'vault', color: '#5a7ab0', rise: 8 },
  },

  // ---- Parque Mitre ----------------------------------------------------------------------------------------------
  // Faro del Parque Mitre (1887): torrecita blanca con la linterna roja
  'Faro del Parque Mitre': {
    height: 11, storey: 2.75, wall: '#f4f2ec', trim: '#c83a2a', style: 'moderno',
    roof: { shape: 'flat', color: '#c83a2a' }, parapet: '#c83a2a', pyramid: { h: 2.5, color: '#c83a2a' },
  },
  'Biblioteca El Palomar': {
    height: 4.5, storey: 4.5, wall: '#f2efe6', trim: '#b0503a', style: 'colonial',
    roof: { shape: 'hip', color: '#b05a3c', rise: 10 },
  },

  // ---- Lugares de misión ------------------------------------------------------------------------------------------
  // Altarcito del Gauchito Gil (Av. Maipú y Necochea): casita roja con techo a dos aguas; las banderas van en props.flags
  'Altar del Gauchito Gil': {
    height: 1.9, storey: 1.9, wall: '#c8201c', trim: '#f0d040', style: 'casita',
    roof: { shape: 'gable', color: '#9a1010', rise: 5 },
  },
  // Cerveza Patagonia: galpón de madera oscura con techo de chapa a dos aguas, frente al jardín cervecero
  'Cerveza Patagonia': {
    height: 6, storey: 6, wall: '#5a3a26', trim: '#e8c070', style: 'ladrillo',
    roof: { shape: 'gable', color: '#3a3e44', rise: 14 },
  },
};
