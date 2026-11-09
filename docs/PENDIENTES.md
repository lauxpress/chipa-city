# Cosas a cambiar (feedback del 9/11/2026, después de jugar la etapa 2)

Las capturas de referencia las mandó el usuario en el chat. Para lugares reales, usar las imágenes satelitales solo como
referencia para modelar a mano (no copiarlas).

## Bugs visuales y de mapa

1. **Rampa del Puente Belgrano con árboles encima.** Hay árboles 3D (lapachos, etc.) atravesando el tablero en la subida
   del puente. Hay que excluir la vegetación de la huella del puente, las rampas y el viaducto.
2. **Luminarias y sendas peatonales mal ubicadas** (3 de Abril, Costanera). Las calles se ven mucho mejor, pero:
   - los faroles amarillos de doble brazo del parterre aparecen sueltos, cruzados y a veces sobre la calzada; tienen que
     ir alineados en el centro del cantero, con los brazos perpendiculares a la avenida;
   - las sendas peatonales se pisan entre sí en los cruces (Costanera): una cebra por boca de calle, sin superponerse.
3. **IOSCor sigue mal.** El cuerpo que une todo es más grande que lo demás y tapa las torres. El podio tiene que ser bajo y
   las tres torres tienen que sobresalir.
4. **Castillo de La Unidad:** las torres/torreones tienen que estar pegados a la muralla, no flotando separados.
5. **Edificio con techo naranja sobre la arena de la plaza de juegos del Parque Mitre** (quedó de antes).

## Lugares a rehacer o agregar

6. **Escuela Nacional** (manzana Tucumán / Quintana / Costanera), en el triángulo Costanera–Tucumán–Pellegrini.
   - La planta tiene una forma que en la ciudad siempre se asoció a una escuadra y compás masónicos. Es un enigma conocido,
     así que hay que respetarla bien.
   - Techos de teja a dos aguas siguiendo los brazos. Lo que no es techo, por dentro, son patios internos.
   - Por fuera tiene playones con canchas de básquet.
   - Hoy en el juego hay una mole verde genérica (calle Tucumán).
7. **Punta San Sebastián** (Tucumán y Costanera): completar el paseo.
   - Muralla curva de piedra/ladrillo rojizo que sale al río, con escalones abajo.
   - Explanada con baranda blanca y faroles.
   - Pérgola de columnas blancas en la punta.
   - Árboles: una araucaria alta y pinos.
8. **Zona Patagonia / Usina** (costanera norte), con las referencias de la imagen satelital marcada:
   - (I) La estructura en el agua: el viejo muelle de descarga de gas de los barcos a la usina, una pasarela de hierro sobre
     pilotes. Se ve desde la terraza del Patagonia.
   - (II) Dónde está de verdad la Cervecería Patagonia: junto al muelle, con terraza sobre el río, guirnaldas de luces y
     deck de madera. Hoy está mal ubicada: en el juego es un galpón con sombrillas en el pasto.
   - (III) El restaurante legendario **"El Mirador"**.
   - (IV) El **Colegio Pío XII** (edificio de teja con claustro, patio con árboles, cancha).
   - (V) La **Usina eléctrica**: respetar esos edificios, más la estación transformadora abajo a la izquierda.
   - (VI) El gimnasio **VIVA FIT**. Más adelante va una misión ahí: hubo un caso de narco y corrupción ligado. Ojo, es un
     caso real: usar nombres inventados o ficcionalizar, sin acusar a personas reales.
9. **Puerto** (es parte de las misiones, tiene que estar bien):
   - (I) Terminal de colectivos: dársena con techo largo sobre la avenida, donde paran varias líneas. Agregar la parada a
     los recorridos de `data/colectivos.txt`.
   - (II) Edificio de una planta con locales gastronómicos en la azotea.
   - (III) Flotantes amarrados con un teatro y un local gastronómico, con lanchas alrededor y la guardería náutica al lado.
   - Hoy en el juego el puerto es un bloque blanco grande genérico.
10. **Crash Pool Bar** (Córdoba 1461): agregar el local y un **minijuego de pool**.
11. **Club de Regatas**: agregar un **minijuego de básquet** en una de sus dos canchas (la del estadio o la del playón junto
    al río), además de modelar la zona según la imagen (playa con sombrillas, piletas flotantes, guarderías de lanchas).

## Tráfico

12. **Siguen los choques en cadena y los atascos** (Costanera, cruce con parterre: decenas de autos amontonados en el
    cruce). Hace falta:
    - prioridad en los cruces (ceder el paso, semáforos que la IA respete);
    - que los autos frenen por el de adelante en el mismo carril;
    - despeje: si un auto queda trabado varios segundos fuera de pantalla, sacarlo o reubicarlo;
    - límite de densidad por zona.

## Funciones nuevas

13. **Minijuegos libres:** poder jugar los minijuegos (fútbol, truco, túnel, etc.) cuando uno quiere, no solo en las
    misiones. Por ejemplo desde un menú o entrando al lugar.
14. **Menú principal:** jugar, continuar, minijuegos, opciones y créditos.
15. **Guardar progreso:** hoy las misiones se guardan en `localStorage`. Sumar exportar e importar un `.json` (descargarlo
    en la PC y volver a cargarlo), así sirve online y entre navegadores.
16. **Login simple online** para saber cuántas personas jugaron.
    - Opciones: un nombre de jugador más un contador anónimo, o login con GitHub o Google mediante un servicio gratuito
      (Supabase o Firebase).
    - Decidir teniendo en cuenta que el sitio es estático (GitHub Pages) y la privacidad.

## Pendientes de antes

- DPEC o EPEC: confirmar el nombre de la camioneta de la misión 5 (en Corrientes la empresa es la DPEC).
- La ubicación del altar del Gauchito Gil es inventada (Maipú y Necochea). Moverlo si hay uno real conocido.
- Afinar la dificultad de las escenas (guardias del túnel y de la Casa de Gobierno) y los tiempos de las misiones.
- La cámara de la higuera atraviesa algunas paredes.
- Jugar todas las escenas a mano con el teclado.
