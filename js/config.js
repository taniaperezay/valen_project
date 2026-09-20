/* ===========================================================
   config.js — EDITA SOLO ESTE ARCHIVO PARA PERSONALIZAR
   Cambia el nombre, la fecha y los textos. El resto del
   proyecto lee de aquí, así que no hace falta tocar nada más.
   =========================================================== */

const CONFIG = {
  // --- Lo básico -------------------------------------------
  nombre: "Lucía",                  // el nombre de tu mejor amiga
  edad: null,                       // pon un número (ej: 23) o deja null para no mostrarlo
  fecha: "2026-10-04",              // fecha del cumple (formato AAAA-MM-DD)

  titulo: "La sala de Lucía",       // aparece en la pestaña del navegador
  saludo: "Feliz cumpleaños, Lucía",
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
    bizcocho: "#3a2c3f",
    cobertura: "#8c2f45",
    chispas: true,        // polvo dorado
    velas: 6,             // de 0 a 12
    topper: "luna",       // "luna", "sakura", "corazon" o "ninguno"
  },

  // --- Paletas que verán quienes envuelvan un regalo --------
  coloresCaja: [
    "#8c2f45", "#2b2736", "#4c3760", "#c9a227",
    "#3f5f52", "#7a4a2e", "#ded3c4", "#5d6b78",
  ],
  coloresCinta: [
    "#c9a227", "#ded3c4", "#8c2f45", "#2b2736",
    "#b04058", "#5f8f7a", "#9a8fb0", "#a8742e",
  ],
  coloresTarta: [
    "#8c2f45", "#3a2c3f", "#4c3760", "#c9a227",
    "#3f5f52", "#ded3c4", "#b04058", "#6d5a3f",
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
