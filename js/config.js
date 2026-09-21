/* ===========================================================
   config.js — EDITA SOLO ESTE ARCHIVO PARA PERSONALIZAR
   Cambia el nombre, la fecha y los textos. El resto del
   proyecto lee de aquí, así que no hace falta tocar nada más.
   =========================================================== */

const CONFIG = {
  // --- Lo básico -------------------------------------------
  nombre: "Valen",                  // el nombre de tu mejor amiga
  edad: 24,                       // pon un número (ej: 23) o deja null para no mostrarlo
  fecha: "2026-12-04",              // fecha del cumple (formato AAAA-MM-DD)

  titulo: "La sala de Lucía",       // aparece en la pestaña del navegador
  saludo: "Feliz cumpleaños, Valen <3",
  subtitulo: "Pasa sin hacer ruido. Deja tu regalo y enciende una vela.",

  // Texto de la nota que abre la sala (se lee al pulsar "Leer la nota")
  notaAnfitriona: {
    de: "Tu mejor amiga",
    texto:
      "Monté esta sala porque no cabías en una tarjeta. " +
      "He dejado los faroles encendidos y la luna en la ventana. " +
      "Cada regalo lo ha traído alguien que te quiere. " +
      "Sopla las velas cuando estés lista.",
  },

  // --- Estado inicial de la sala ----------------------------
  salaInicial: {
    momento: "noche",     // "noche" (luna llena) o "alba" (niebla)
    pared: "#2e2a3d",
    tatami: "#6e6a42",
    faroles: 3,           // faroles colgados, de 0 a 4
    mascota: true,        // el gato del tatami
  },

  tartaInicial: {
    pisos: 3,             // 1, 2 o 3
    bizcocho: "#f7b8d0",  // rosa pastel
    cobertura: "#c9b6f0", // lila pastel
    velas: 6,             // de 0 a 12
    topper: "calavera",   // "calavera", "corona", "luna", "sakura", "corazon" o "ninguno"
    // Toppings que lleva al empezar. Se pueden combinar todos:
    // "nata", "perlas", "chispas", "brillantes", "pinchos",
    // "murcielagos", "cerezas", "carita"
    toppings: ["nata", "perlas", "brillantes", "pinchos", "murcielagos"],
  },

  // --- La sala de los regalos --------------------------------
  // Lo que dice Manolo, el chico que te recibe al entrar (y cada vez
  // que lo tocas). Habla en nombre de quien hizo la sala.
  nombreAnfitrion: "Manolo",
  mensajeAnfitrion:
    "Hola, Valen. Soy Manolo y vengo en representación de la Bloody, " +
    "que me ha pedido que te enseñe los regalos. Pasa, pasa.",

  // --- Regalos de la sala de los regalos ---------------------
  // Letrero de la puerta que lleva a esta sala (sin tildes; si es
  // largo se parte solo en dos líneas)
  textoPuerta: "Regalos de Bloody",
  // Letrero de la puerta para volver a la sala de la tarta
  textoPuertaVolver: "Volver a la fiesta",

  // Están detrás de la puerta de la derecha. Nadie los puede quitar
  // ni cambiar desde la página: solo se editan aquí.
  // caja y cinta: colores. patron: "liso", "rayas", "asanoha",
  // "seigaiha" o "kikko". lazo: "mizuhiki", "luna", "sakura" o
  // "ninguno". tamano: "pequeno", "mediano" o "grande".
  regalosFijos: [
    {
      de: "Tu mejor amiga",
      mensaje: "Escribe aquí lo que quieras decirle con este regalo.",
      caja: "#8c2f45", cinta: "#c9a227", patron: "asanoha", lazo: "mizuhiki", tamano: "grande",
    },
    {
      de: "El Puma",
      mensaje: "Miau. He vigilado todos tus regalos. Este es el mío: una siesta al sol.",
      caja: "#2b2736", cinta: "#b04058", patron: "kikko", lazo: "luna", tamano: "mediano",
    },
    {
      de: "Max",
      mensaje: "¡Guau! Te regalo mi pelota favorita. Casi no está mordida.",
      caja: "#ded3c4", cinta: "#5f8f7a", patron: "rayas", lazo: "sakura", tamano: "pequeno",
    },
    {
      // Un regalo con forma propia: forma "pajaro" dibuja un pájaro de barro
      forma: "pajaro",
      nombre: "Un pájaro de barro",
      de: "Tu mejor amiga",
      mensaje: "Ni una página en blanco más.",
    },
    {
      // forma "deseo": una cajita alargada con una rama de los deseos
      forma: "deseo",
      nombre: "La rama de los deseos",
      de: "Tu mejor amiga",
      mensaje: "Escribe aquí el mensaje de la rama de los deseos.",
    },
    {
      de: "El conde Drácula",
      mensaje: "Una capa de terciopelo para las noches frías. Quinientos años y aún tengo estilo.",
      caja: "#4c3760", cinta: "#9a8fb0", patron: "seigaiha", lazo: "mizuhiki", tamano: "grande",
    },
  ],

  // --- Paletas que verán quienes envuelvan un regalo --------
  coloresCaja: [
    "#8c2f45", "#2b2736", "#4c3760", "#c9a227",
    "#3f5f52", "#7a4a2e", "#ded3c4", "#5d6b78",
  ],
  coloresCinta: [
    "#c9a227", "#ded3c4", "#8c2f45", "#2b2736",
    "#b04058", "#5f8f7a", "#9a8fb0", "#a8742e",
  ],
  // Pasteles kawaii para que la tarta destaque, más dos toques góticos
  coloresTarta: [
    "#f7b8d0", "#ff9fc4", "#c9b6f0", "#b6d8f5", "#b8ecd8",
    "#fbe9a6", "#fcc9b0", "#fdf3e7", "#2b2433", "#6d3a6b",
  ],
  coloresPared: ["#2e2a3d", "#332a2e", "#26303a", "#3a2f28", "#2b2b30"],
  coloresTatami: ["#6e6a42", "#4f5a48", "#6b5540", "#4a4560", "#5e4a4a"],

  // --- Opciones de envoltorio -------------------------------
  // asanoha, seigaiha y kikko son estampados tradicionales japoneses
  patrones: [
    { id: "liso", nombre: "Liso" },
    { id: "rayas", nombre: "Rayas" },
    { id: "asanoha", nombre: "Asanoha" },
    { id: "seigaiha", nombre: "Olas" },
    { id: "kikko", nombre: "Panal" },
  ],
  lazos: [
    { id: "mizuhiki", nombre: "Mizuhiki" },
    { id: "luna", nombre: "Luna" },
    { id: "sakura", nombre: "Sakura" },
    { id: "ninguno", nombre: "Sin lazo" },
  ],
  tamanos: [
    { id: "pequeno", nombre: "Pequeño" },
    { id: "mediano", nombre: "Mediano" },
    { id: "grande", nombre: "Grande" },
  ],
};