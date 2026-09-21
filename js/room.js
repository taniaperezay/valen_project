/* ===========================================================
   room.js — Dibuja la sala en pixel art sobre un <canvas>.
   Ambientación: cálida pero oscura, entre gótico y japonés.
   Todo se pinta con rectángulos de 1px: no hay imágenes.
   El lienzo mide 256x160 píxeles "reales" y luego se escala.
   =========================================================== */

const Room = (function () {
  "use strict";

  const W = 256;          // ancho del lienzo en píxeles reales
  const H = 160;          // alto
  const SUELO = 106;      // línea donde empieza el suelo
  const ZOCALO = 84;      // donde empieza el friso de madera de la pared

  // Maderas y lacas de la sala
  const LACA = "#1c1826";
  const LACA_CLARA = "#2a2333";
  const MADERA = "#3a2c28";
  const MADERA_CLARA = "#4e3b33";
  const PAPEL = "#ded3c4";
  const PAPEL_HONDO = "#b8ab94";
  const ORO = "#c9a227";
  const CARMIN = "#8c2f45";
  const TINTA = "#241d28";

  const TAMANOS = {
    pequeno: { w: 11, h: 10 },
    mediano: { w: 15, h: 14 },
    grande: { w: 19, h: 18 },
  };

  // Filas donde se van posando los regalos (de atrás hacia delante)
  const LADO_DERECHO = [
    { y: 124, x0: 174, x1: 252 },
    { y: 138, x0: 172, x1: 254 },
    { y: 154, x0: 174, x1: 254 },
  ];
  const LADO_IZQUIERDO = [
    { y: 124, x0: 26, x1: 86 },
    { y: 138, x0: 4, x1: 86 },
    { y: 154, x0: 2, x1: 86 },
  ];

  // Faroles chochin colgados del techo
  const ANCLAS_FAROL = [
    { x: 88, y: 40 },
    { x: 176, y: 36 },
    { x: 242, y: 46 },
    { x: 162, y: 84 },
  ];

  // Ventana katomado: el ventanal de arco acampanado de los templos zen
  const VENT = { x: 16, y: 24, w: 60, h: 56 };

  // Perfil del arco: media anchura de cada fila, calculado una sola vez
  const ARCO = (function () {
    const filas = [];
    for (let i = 0; i < VENT.h; i++) {
      const t = i / (VENT.h - 1);
      const k = t < 0.46 ? Math.pow(Math.sin((t / 0.46) * (Math.PI / 2)), 0.6) : 1;
      filas.push(Math.round((VENT.w / 2) * k));
    }
    return filas;
  })();

  let c = null;                 // contexto de dibujo activo
  let canvas = null;
  let leerEstado = function () { return null; };
  let alClic = function () {};
  let frame = 0;
  let zonas = [];               // zonas clicables del último fotograma
  let confeti = [];
  let petalos = [];
  let velasApagadas = false;
  let sinMovimiento = false;
  let posicionesRegalo = [];

  /* ---------- utilidades de dibujo ---------- */

  function px(x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function tono(hex, cantidad) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * cantidad)));
    return "#" + [f(r), f(g), f(b)]
      .map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function circulo(cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      px(cx - dx, cy + dy, dx * 2 + 1, 1, color);
    }
  }

  function elipse(cx, cy, rw, rh, color) {
    for (let dy = -rh; dy <= rh; dy++) {
      const k = Math.sqrt(Math.max(0, 1 - (dy * dy) / (rh * rh)));
      const w = Math.round(rw * k);
      if (w > 0) px(cx - w, cy + dy, w * 2, 1, color);
    }
  }

  // Números aleatorios reproducibles: la misma semilla da el mismo dibujo
  function azar(semilla) {
    let s = (semilla * 2654435761) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function onda(divisor, amplitud, desfase) {
    if (sinMovimiento) return 0;
    return Math.round(Math.sin((frame + (desfase || 0)) / divisor) * amplitud);
  }

  /* ---------- formas pequeñas reutilizables ---------- */

  function corazon(cx, cy, col) {
    px(cx - 3, cy, 2, 2, col);
    px(cx + 1, cy, 2, 2, col);
    px(cx - 4, cy + 1, 8, 2, col);
    px(cx - 3, cy + 3, 6, 1, col);
    px(cx - 2, cy + 4, 4, 1, col);
    px(cx - 1, cy + 5, 2, 1, col);
  }

  // Luna creciente de 5x7
  function luna(cx, cy, col) {
    const filas = [2, 1, 0, 0, 0, 1, 2];
    for (let i = 0; i < filas.length; i++) px(cx - 2 + filas[i], cy + i, 2, 1, col);
  }

  // Flor de sakura de cinco pétalos
  function sakura(cx, cy, col) {
    const centro = tono(col, 0.28);
    px(cx - 1, cy, 2, 2, col);
    px(cx + 2, cy + 2, 2, 2, col);
    px(cx + 1, cy + 5, 2, 2, col);
    px(cx - 3, cy + 5, 2, 2, col);
    px(cx - 4, cy + 2, 2, 2, col);
    px(cx - 1, cy + 3, 2, 2, centro);
  }

  /* ---------- la pared ---------- */

  function pared(sala) {
    const base = sala.pared;

    // Yeso de la parte alta
    px(0, 0, W, ZOCALO, base);
    const listón = tono(base, 0.05);
    for (let x = 6; x < W; x += 20) px(x, 0, 1, ZOCALO, listón);
    px(0, 0, W, 4, tono(base, -0.1));

    // Friso de madera de la parte baja
    px(0, ZOCALO, W, SUELO - ZOCALO, MADERA);
    for (let x = 0; x < W; x += 16) px(x, ZOCALO + 3, 1, SUELO - ZOCALO - 3, tono(MADERA, -0.05));
    px(0, ZOCALO, W, 3, MADERA_CLARA);        // nageshi, el travesaño superior
    px(0, ZOCALO + 3, W, 1, TINTA);
    px(0, SUELO - 2, W, 2, TINTA);
  }

  function suelo() {
    const tablas = ["#463228", "#412e25", "#4b362b", "#3d2b23"];
    let fila = 0;
    for (let y = SUELO; y < H; y += 11) {
      const madera = tablas[fila % tablas.length];
      px(0, y, W, 11, madera);
      px(0, y, W, 1, "#2b1d18");
      px(0, y + 1, W, 1, tono(madera, 0.04));
      const desfase = (fila * 37) % 96;
      for (let x = -desfase; x < W; x += 96) px(x, y + 2, 1, 9, tono(madera, -0.06));
      fila++;
    }
  }

  /* ---------- la ventana katomado ---------- */

  function ventana(sala) {
    const cx = VENT.x + VENT.w / 2;
    const noche = sala.momento !== "alba";

    // Marco exterior siguiendo el arco
    for (let i = 0; i < VENT.h + 4; i++) {
      const j = Math.max(0, Math.min(ARCO.length - 1, i - 3));
      const h = ARCO[j] + 3;
      px(cx - h, VENT.y + i, h * 2, 1, MADERA);
    }

    // El cielo, fila a fila, siguiendo exactamente el arco
    const cielo = noche ? "#151a2e" : "#474155";
    const horizonte = noche ? "#1f2440" : "#6a6070";
    for (let i = 0; i < VENT.h; i++) {
      const h = ARCO[i];
      if (h > 0) px(cx - h, VENT.y + i, h * 2, 1, i > VENT.h - 16 ? horizonte : cielo);
    }

    // Luna, estrellas o niebla, recortados al hueco de la ventana
    c.save();
    c.beginPath();
    c.rect(VENT.x, VENT.y, VENT.w, VENT.h);
    c.clip();

    if (noche) {
      const r = azar(11);
      for (let i = 0; i < 22; i++) {
        const sx = VENT.x + 4 + Math.floor(r() * (VENT.w - 8));
        const sy = VENT.y + 14 + Math.floor(r() * (VENT.h - 30));
        if (sinMovimiento || Math.sin((frame + i * 17) / 26) > -0.3) px(sx, sy, 1, 1, "#f2e9cf");
      }
      // Luna creciente: un disco pálido mordido por otro disco de cielo
      circulo(cx + 9, VENT.y + 22, 8, "#f2e9cf");
      circulo(cx + 5, VENT.y + 20, 8, cielo);
    } else {
      // Bandas de niebla que se desplazan muy despacio
      for (let i = 0; i < 4; i++) {
        const desliz = sinMovimiento ? 0 : (frame / (40 + i * 14)) % (VENT.w + 40);
        px(VENT.x - 20 + desliz, VENT.y + 18 + i * 9, 26, 2, "rgba(222,211,196,0.22)");
      }
      circulo(cx + 8, VENT.y + 20, 7, "rgba(238,222,198,0.5)");
    }

    // Un utilitario verde lima aparcado en la calle, con los faros encendidos
    cocheFuera(VENT.x + 32, VENT.y + VENT.h - 8);

    // Rama de sakura en silueta. De noche se aclara y de día se oscurece,
    // porque en tinta pura sobre el cielo nocturno no se veía nada.
    const rama = noche ? "#63536e" : "#2b2430";
    px(cx - 26, VENT.y + 46, 14, 2, rama);
    px(cx - 14, VENT.y + 38, 2, 10, rama);
    px(cx - 13, VENT.y + 34, 9, 2, rama);
    px(cx - 5, VENT.y + 27, 2, 9, rama);
    px(cx - 20, VENT.y + 31, 2, 8, rama);
    const flor = noche ? "#d9a2b0" : "#e7c2cb";
    px(cx - 21, VENT.y + 28, 3, 3, flor);
    px(cx - 6, VENT.y + 24, 3, 3, flor);
    px(cx - 14, VENT.y + 31, 3, 3, flor);
    px(cx - 2, VENT.y + 32, 3, 3, flor);
    px(cx - 24, VENT.y + 42, 2, 2, flor);

    c.restore();

    // Vuelve a pintarse el borde del arco para tapar lo que se salga
    for (let i = 0; i < VENT.h; i++) {
      const h = ARCO[i];
      px(cx - h - 3, VENT.y + i, 3, 1, MADERA);
      px(cx + h, VENT.y + i, 3, 1, MADERA);
    }

    // Celosía de la ventana
    for (let i = 0; i < VENT.h; i++) {
      const h = ARCO[i];
      if (h < 6) continue;
      const y = VENT.y + i;
      for (const bx of [-20, 0, 20]) {
        if (Math.abs(bx) + 2 <= h) px(cx + bx - 1, y, 2, 1, MADERA_CLARA);
      }
    }
    for (const fila of [18, 32, 46]) {
      const h = ARCO[fila];
      if (h > 4) px(cx - h + 1, VENT.y + fila, h * 2 - 2, 2, MADERA_CLARA);
    }

    // Alféizar
    px(cx - 36, VENT.y + VENT.h, 72, 3, MADERA_CLARA);
    px(cx - 36, VENT.y + VENT.h + 3, 72, 2, TINTA);
  }

  /* ---------- la cuerda con shide ---------- */

  function shimenawa() {
    // Cuerda trenzada con una leve caída
    for (let x = 0; x < W; x++) {
      const y = 5 + Math.round(Math.sin((x / W) * Math.PI) * 4);
      px(x, y, 1, 3, "#6b5a3f");
      if (x % 6 < 3) px(x, y, 1, 1, "#8a7550");
    }

    // Bajo la guirnalda no cuelgan tiras, para que se lean las letras
    const libre = rangoGuirnalda();
    let i = 0;
    for (let x = 10; x < W - 8; x += 21) {
      if (x + 5 >= libre.a && x <= libre.b) { i++; continue; }
      const yTop = 8 + Math.round(Math.sin((x / W) * Math.PI) * 4);
      if (i % 2 === 0) {
        // Shide: tira de papel plegada en zigzag
        let sx = x;
        for (let k = 0; k < 4; k++) {
          px(sx, yTop + k * 3, 5, 3, PAPEL);
          px(sx, yTop + k * 3, 5, 1, PAPEL_HONDO);
          sx += (k % 2 === 0) ? 3 : -3;
        }
      } else {
        // Borla de hilo carmín
        px(x + 1, yTop, 3, 2, ORO);
        px(x, yTop + 2, 5, 6, CARMIN);
        for (let k = 0; k < 5; k++) px(x + k, yTop + 8, 1, 2 + (k % 2), tono(CARMIN, -0.12));
      }
      i++;
    }
  }

  /* ---------- faroles chochin ---------- */

  function farol(cx, cy, encendido, vaiven) {
    // Un chochin es claramente más alto que ancho
    const anchos = [7, 10, 12, 13, 13, 13, 13, 13, 13, 13, 12, 11, 9, 7];
    const papel = encendido ? "#e8c98a" : "#8a7a63";
    const sombra = tono(papel, -0.16);

    // Cordón desde el techo
    for (let y = 0; y < cy - 10; y++) {
      const deriva = Math.round(vaiven * (y / Math.max(1, cy)));
      px(cx + deriva, y, 1, 1, "#5a4a38");
    }

    const x = cx + vaiven;

    // Aro superior de madera
    px(x - 4, cy - 10, 8, 2, MADERA);
    px(x - 1, cy - 12, 2, 2, MADERA);

    // Cuerpo abombado, con una varilla cada tres filas
    for (let i = 0; i < anchos.length; i++) {
      const a = anchos[i];
      const y = cy - 8 + i;
      px(x - a / 2, y, a, 1, i % 3 === 2 ? sombra : papel);
      px(x - a / 2, y, 1, 1, sombra);
      px(x + a / 2 - 1, y, 1, 1, sombra);
    }

    // Banda carmín con un trazo de tinta
    px(x - 6, cy - 1, 12, 4, CARMIN);
    px(x - 2, cy, 4, 1, TINTA);
    px(x - 1, cy + 1, 2, 2, TINTA);

    // Aro y borla inferior
    px(x - 4, cy + 6, 8, 2, MADERA);
    px(x - 1, cy + 8, 2, 4, CARMIN);
    px(x - 2, cy + 11, 4, 2, tono(CARMIN, -0.15));

    // Halo cálido cuando está encendido
    if (encendido) {
      px(x - 9, cy - 5, 2, 11, "rgba(232,201,138,0.12)");
      px(x + 7, cy - 5, 2, 11, "rgba(232,201,138,0.12)");
      px(x - 6, cy - 11, 12, 2, "rgba(232,201,138,0.1)");
    }
  }

  function faroles(sala) {
    const n = Math.max(0, Math.min(4, sala.faroles | 0));
    for (let i = 0; i < n; i++) {
      const a = ANCLAS_FAROL[i];
      const vaiven = onda(58, 2, i * 70);
      farol(a.x, a.y, true, vaiven);
      zonas.push({ id: "farol", i, x: a.x + vaiven - 8, y: a.y - 13, w: 16, h: 27 });
    }
  }

  /* ---------- el rollo colgante (kakejiku) ---------- */

  function kakejiku() {
    const x = 200, y = 28, w = 26, h = 54;

    // Cordón en V desde el clavo
    for (let k = 0; k < 10; k++) {
      px(x + 2 + k, y - 10 + k, 1, 1, "#5a4a38");
      px(x + w - 3 - k, y - 10 + k, 1, 1, "#5a4a38");
    }

    px(x - 3, y, w + 6, 3, MADERA);            // varilla superior
    px(x, y + 3, w, h - 9, "#cfc3ad");         // papel
    px(x, y + 3, w, 1, PAPEL_HONDO);
    px(x, y + 3, 3, h - 9, "#6d2a3c");         // brocado lateral
    px(x + w - 3, y + 3, 3, h - 9, "#6d2a3c");
    px(x - 3, y + h - 6, w + 6, 4, MADERA);    // varilla inferior
    px(x - 4, y + h - 3, w + 8, 2, TINTA);

    // Enso: el círculo a un solo trazo
    const ecx = x + w / 2, ecy = y + 22;
    circulo(ecx, ecy, 8, "#2b2430");
    circulo(ecx, ecy, 6, "#cfc3ad");
    px(ecx + 4, ecy - 8, 4, 3, "#cfc3ad");     // la abertura del trazo

    // Dos pájaros y el sello rojo
    px(ecx - 6, ecy + 13, 1, 1, "#2b2430");
    px(ecx - 5, ecy + 12, 1, 1, "#2b2430");
    px(ecx - 4, ecy + 13, 1, 1, "#2b2430");
    px(ecx + 1, ecy + 16, 1, 1, "#2b2430");
    px(ecx + 2, ecy + 15, 1, 1, "#2b2430");
    px(ecx + 3, ecy + 16, 1, 1, "#2b2430");
    px(x + w - 8, y + h - 14, 4, 4, "#a8323f");
  }

  /* ---------- el estante ---------- */

  function estante() {
    const x = 104, y = 48, w = 48;
    px(x, y, w, 3, MADERA_CLARA);
    px(x, y + 3, w, 2, TINTA);
    px(x + 4, y + 5, 2, 3, MADERA);
    px(x + w - 6, y + 5, 2, 3, MADERA);

    // Dos libros encuadernados
    px(x + 4, y - 12, 4, 12, "#6d2a3c");
    px(x + 4, y - 12, 4, 1, ORO);
    px(x + 4, y - 7, 4, 1, ORO);
    px(x + 9, y - 10, 4, 10, "#2b2736");
    px(x + 9, y - 10, 4, 1, ORO);

    // Incensario con su humo
    const ix = x + 19;
    px(ix, y - 5, 9, 5, "#6b5535");
    px(ix, y - 4, 9, 1, "#8a6e46");
    px(ix + 1, y - 7, 7, 2, "#8a6e46");
    px(ix + 3, y - 8, 3, 1, "#8a6e46");
    px(ix + 1, y, 2, 2, "#4e3e27");
    px(ix + 6, y, 2, 2, "#4e3e27");
    if (!sinMovimiento) {
      for (let k = 0; k < 14; k++) {
        const t = (frame / 4 + k * 3) % 42;
        const alto = y - 10 - t;
        if (alto < 4) continue;
        const deriva = Math.round(Math.sin(t / 7 + k) * 3);
        px(ix + 4 + deriva, alto, 1, 1, "rgba(220,212,200,0.45)");
      }
    }

    // Rama seca con tres flores en un tiesto oscuro
    const mx = x + w - 13;
    px(mx, y - 7, 9, 7, "#3e3340");
    px(mx, y - 8, 9, 2, "#514459");
    px(mx + 4, y - 16, 1, 9, MADERA);
    px(mx + 1, y - 13, 3, 1, MADERA);
    px(mx + 5, y - 15, 3, 1, MADERA);
    px(mx, y - 15, 2, 2, "#d9a2b0");
    px(mx + 7, y - 17, 2, 2, "#d9a2b0");
    px(mx + 3, y - 19, 2, 2, "#e7c2cb");
  }

  /* ---------- el coche que se ve por la ventana ---------- */

  function cocheFuera(x, y) {
    const lima = "#8fc93a", limaClara = "#b5e05a", limaHonda = "#5f8f24";
    const cristal = "#1f2a44", reflejo = "#4a6690";

    // Asfalto y bordillo
    px(VENT.x, y + 6, VENT.w, 2, "#20222c");
    px(VENT.x, y + 5, VENT.w, 1, "#3a3a44");

    // Haz de los faros sobre el asfalto
    px(x - 9, y + 4, 9, 1, "rgba(250,230,150,0.18)");
    px(x - 6, y + 5, 6, 1, "rgba(250,230,150,0.28)");
    px(x - 12, y + 6, 12, 1, "rgba(250,230,150,0.14)");

    // Carrocería de hatchback, mirando a la izquierda
    px(x + 4, y - 1, 8, 1, lima);                 // techo
    px(x + 3, y, 11, 2, lima);
    px(x + 4, y, 4, 2, cristal);                  // luna delantera
    px(x + 9, y, 4, 2, cristal);                  // ventanilla trasera
    px(x + 4, y, 1, 1, reflejo);
    px(x + 9, y, 1, 1, reflejo);
    px(x + 1, y + 2, 15, 3, lima);
    px(x + 1, y + 2, 15, 1, limaClara);
    px(x, y + 3, 1, 2, lima);
    px(x + 1, y + 4, 15, 1, limaHonda);
    px(x, y + 3, 1, 1, "#fdf0a8");                // faro
    px(x + 15, y + 2, 1, 1, "#d23a3a");           // piloto trasero
    px(x + 7, y + 3, 2, 1, limaHonda);            // tirador de la puerta

    // Ruedas
    px(x + 2, y + 5, 4, 2, "#0e0c12");
    px(x + 11, y + 5, 4, 2, "#0e0c12");
    px(x + 3, y + 5, 2, 1, "#8a8a94");
    px(x + 12, y + 5, 2, 1, "#8a8a94");
  }

  /* ---------- pósters de anime ---------- */

  // Marco común: papel blanco, sombra y un trozo de cinta arriba
  function marcoPoster(x, y, w, h) {
    px(x + 1, y + 1, w, h, "rgba(10,6,16,0.45)");
    px(x, y, w, h, "#e9e1d2");
    px(x + Math.floor(w / 2) - 2, y - 1, 4, 2, "rgba(222,211,196,0.75)");
  }

  // Una columna de "letras" japonesas en miniatura
  function rotulo(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      px(x, y + i * 3, 2, 1, col);
      if (i % 2 === 0) px(x + 1, y + i * 3 + 1, 1, 1, col);
    }
  }

  // Cara de chica anime: ojos grandes, flequillo y rubor.
  // (cx, y) es el centro de la frente.
  function caraAnime(cx, y, pelo, ojos) {
    const piel = "#f3dccf";
    circulo(cx, y + 2, 4, pelo);                  // coronilla
    px(cx - 3, y + 2, 7, 6, piel);                // cara
    px(cx - 2, y + 8, 5, 1, piel);                // barbilla
    px(cx - 4, y, 9, 3, pelo);                    // flequillo
    px(cx - 2, y + 3, 1, 1, pelo);
    px(cx + 1, y + 3, 1, 1, pelo);
    px(cx - 4, y + 3, 1, 5, pelo);                // mechones laterales
    px(cx + 4, y + 3, 1, 5, pelo);

    // Ojos: pestaña, iris y brillo
    px(cx - 3, y + 4, 2, 1, "#1a1020");
    px(cx + 2, y + 4, 2, 1, "#1a1020");
    px(cx - 3, y + 5, 2, 2, ojos);
    px(cx + 2, y + 5, 2, 2, ojos);
    px(cx - 3, y + 5, 1, 1, "#ffffff");
    px(cx + 2, y + 5, 1, 1, "#ffffff");

    px(cx - 3, y + 7, 1, 1, "#e89aa8");           // rubor
    px(cx + 3, y + 7, 1, 1, "#e89aa8");
    px(cx, y + 7, 1, 1, "#b0505e");               // boca
  }

  // Póster 1: chica de pelo violeta con uniforme de marinera, bajo la luna
  function posterLuna(x, y) {
    const w = 17, h = 24;
    marcoPoster(x, y, w, h);
    const cielos = ["#141a38", "#1b2244", "#232a55", "#2c2f63"];
    for (let i = 0; i < h - 2; i++) px(x + 1, y + 1 + i, w - 2, 1, cielos[Math.floor((i / (h - 2)) * 4)]);
    circulo(x + 12, y + 4, 2, "#f2e9cf");
    px(x + 3, y + 3, 1, 1, "#f2e9cf");
    px(x + 14, y + 10, 1, 1, "#f2e9cf");

    const pelo = "#4a2c6a";
    px(x + 3, y + 8, 11, 12, pelo);               // melena larga por detrás
    caraAnime(x + 8, y + 6, pelo, "#b86ad0");

    // Uniforme de marinera con pañuelo rojo
    px(x + 3, y + 16, 11, h - 17, "#1e2340");
    px(x + 4, y + 16, 2, 2, "#e9e1d2");
    px(x + 11, y + 16, 2, 2, "#e9e1d2");
    px(x + 7, y + 16, 3, 2, "#c23a4e");
    px(x + 8, y + 18, 1, 2, "#c23a4e");
  }

  // Póster 2: chica de coletas rosas delante de la ciudad al atardecer
  function posterCiudad(x, y) {
    const w = 17, h = 24;
    marcoPoster(x, y, w, h);
    const bandas = ["#4c3760", "#7a4a78", "#b8607a", "#e0876e", "#f0b27a"];
    for (let i = 0; i < 16; i++) px(x + 1, y + 1 + i, w - 2, 1, bandas[Math.floor(i / 3.2)]);

    const s = "#1d1628";
    px(x + 1, y + 15, w - 2, h - 16, s);
    px(x + 1, y + 11, 3, 5, s);
    px(x + 2, y + 8, 1, 3, s);                    // antena
    px(x + 13, y + 10, 3, 6, s);
    for (const [dx, dy] of [[2, 13], [1, 17], [14, 12], [14, 16], [15, 19]]) {
      px(x + dx, y + dy, 1, 1, "#f0c86a");
    }

    const pelo = "#e27aa6";
    px(x + 3, y + 8, 2, 9, pelo);                 // coletas
    px(x + 12, y + 8, 2, 9, pelo);
    px(x + 4, y + 5, 1, 2, "#8fc93a");            // lazos
    px(x + 12, y + 5, 1, 2, "#8fc93a");
    caraAnime(x + 8, y + 5, pelo, "#3d6fb0");

    // Chaqueta y cuello de camisa
    px(x + 5, y + 15, 7, h - 16, "#2b2736");
    px(x + 7, y + 15, 3, 2, "#e9e1d2");
    px(x + 8, y + 17, 1, 3, "#c23a4e");
  }

  // Póster 3: el monte Fuji con sol rojo y un torii
  function posterFuji(x, y) {
    const w = 18, h = 19;
    marcoPoster(x, y, w, h);
    px(x + 1, y + 1, w - 2, h - 2, "#8fbcc0");
    px(x + 1, y + 1, w - 2, 4, "#a9cfcf");
    circulo(x + 13, y + 5, 3, "#c23a4e");

    const cx = x + 8, cima = y + 6;
    for (let i = 0; i < 9; i++) {
      px(cx - i, cima + i, i * 2 + 1, 1, i < 3 ? "#f4efe6" : "#3b4f6b");
    }
    px(cx - 2, cima + 3, 1, 1, "#f4efe6");
    px(cx + 2, cima + 3, 1, 1, "#f4efe6");
    px(x + 1, y + h - 4, w - 2, 3, "#2e5a55");

    px(x + 11, y + 10, 6, 1, "#c23a4e");
    px(x + 12, y + 12, 4, 1, "#c23a4e");
    px(x + 12, y + 11, 1, 5, "#c23a4e");
    px(x + 15, y + 11, 1, 5, "#c23a4e");
    rotulo(x + 2, y + 2, 2, "#2b2430");
  }

  // Póster 4: cartel de rave hardcore con un ecualizador que late
  function posterHardcore(x, y) {
    const w = 17, h = 23;
    marcoPoster(x, y, w, h);
    px(x + 1, y + 1, w - 2, h - 2, "#07060a");
    px(x + 1, y + 1, w - 2, 1, "#ff4fa3");        // filo de neón
    px(x + 1, y + h - 2, w - 2, 1, "#ff4fa3");

    // "Letras" gruesas del cartel
    px(x + 3, y + 3, 11, 2, "#f2eee8");
    px(x + 4, y + 6, 9, 1, "#9a93a6");

    // Rayo
    const rayo = "#ff4fa3";
    px(x + 9, y + 8, 2, 2, rayo);
    px(x + 8, y + 10, 2, 2, rayo);
    px(x + 7, y + 11, 4, 1, rayo);
    px(x + 8, y + 12, 2, 2, rayo);

    // Ecualizador animado
    for (let i = 0; i < 6; i++) {
      const alto = 2 + Math.abs(onda(5 + i, 3, i * 13));
      px(x + 3 + i * 2, y + h - 3 - alto, 1, alto, i % 2 ? "#ff8fc8" : "#ff4fa3");
    }
  }

  function posters() {
    posterLuna(88, 58);
    posterCiudad(150, 57);
    posterHardcore(172, 58);
    posterFuji(234, 63);
  }

  /* ---------- enredaderas ---------- */

  const TALLO = "#3d4a2c";
  const HOJAS = ["#3f6a3c", "#52804a", "#6a9a58"];

  function hoja(x, y, r) {
    const col = HOJAS[Math.floor(r() * HOJAS.length)];
    px(x, y, 2, 2, col);
    px(x + (r() > 0.5 ? 2 : -1), y + 1, 1, 1, col);
  }

  // Una enredadera que cae desde la cuerda del techo
  function enredaderaColgante(x, largo, semilla) {
    const r = azar(semilla);
    const arriba = 7 + Math.round(Math.sin((x / W) * Math.PI) * 4);
    let sx = x;
    for (let i = 0; i < largo; i++) {
      if (i % 6 === 5) sx += r() > 0.5 ? 1 : -1;
      const vaiven = i > largo - 14 ? onda(50, 1, x) : 0;   // solo se mece la punta
      px(sx + vaiven, arriba + i, 1, 1, TALLO);
      if (i % 4 === 2) hoja(sx + vaiven + ((i >> 2) % 2 ? 1 : -2), arriba + i - 1, r);
    }
    // Un par de flores blancas diminutas
    px(sx - 1, arriba + largo - 6, 1, 1, "#f2e9e4");
    px(sx + 2, arriba + Math.floor(largo / 2), 1, 1, "#f2e9e4");
  }

  // Una enredadera que trepa a lo largo del travesaño de madera
  function enredaderaTravesano(x0, x1, semilla) {
    const r = azar(semilla);
    for (let x = x0; x < x1; x++) {
      const y = ZOCALO - 1 + Math.round(Math.sin(x / 5) * 1);
      px(x, y, 1, 1, TALLO);
      if (x % 3 === 0) hoja(x, y + (x % 6 === 0 ? -2 : 1), r);
      if (x % 17 === 4) {               // guías que cuelgan sobre el friso
        const caida = 3 + Math.floor(r() * 5);
        px(x, y + 1, 1, caida, TALLO);
        hoja(x - 1, y + caida, r);
      }
    }
  }

  function enredaderas() {
    enredaderaColgante(4, 62, 3);
    enredaderaColgante(190, 46, 7);
    enredaderaColgante(252, 36, 9);
    enredaderaTravesano(0, 64, 5);
    enredaderaTravesano(186, 256, 6);
  }

  /* ---------- ramas de sakura ---------- */

  // Traza una rama recta de un punto a otro
  function trazo(x0, y0, x1, y1, grosor, col) {
    const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= pasos; i++) {
      const t = pasos ? i / pasos : 0;
      px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, grosor, grosor, col);
    }
  }

  function racimo(x, y, r) {
    const cols = ["#e7c2cb", "#d9a2b0", "#f3dde2"];
    for (let k = 0; k < 4; k++) {
      px(x + Math.floor(r() * 5) - 2, y + Math.floor(r() * 4) - 1, 2, 2, cols[k % 3]);
    }
  }

  function ramasSakura() {
    const rama = "#4a3438";
    const r = azar(21);

    // Esquina izquierda, sobre la ventana
    trazo(0, 10, 12, 14, 2, rama);
    trazo(12, 14, 26, 18, 1, rama);
    trazo(12, 14, 15, 22, 1, rama);
    sakura(27, 16, "#e7c2cb");
    sakura(15, 21, "#d9a2b0");
    racimo(6, 12, r);
    racimo(20, 17, r);
    racimo(33, 20, r);

    // Esquina derecha, asomando por encima del rollo
    trazo(255, 9, 242, 13, 2, rama);
    trazo(242, 13, 228, 17, 1, rama);
    trazo(242, 13, 238, 22, 1, rama);
    sakura(227, 15, "#e7c2cb");
    sakura(238, 21, "#d9a2b0");
    racimo(249, 11, r);
    racimo(234, 16, r);
    racimo(221, 19, r);
  }

  /* ---------- guirnalda de banderines ---------- */

  // Letras de 3x5 píxeles para los banderines
  const LETRAS = {
    A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
    C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
    E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
    G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
    I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", ".#."],
    K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
    M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"],
    O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
    Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
    S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
    U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
    W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  };

  function textoGuirnalda() {
    const nombre = (typeof CONFIG !== "undefined" && CONFIG.nombre) ? CONFIG.nombre : "";
    return ("Felicidades " + nombre).trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");   // quita las tildes
  }

  const PASO_BANDERIN = 6;                         // ancho de cada banderín + hueco

  // Dónde empieza y acaba la guirnalda (también lo usa la cuerda del techo)
  function rangoGuirnalda() {
    const n = textoGuirnalda().length;
    const x0 = Math.round(128 - (n * PASO_BANDERIN) / 2);
    return { x0: x0, x1: x0 + n * PASO_BANDERIN, a: x0 - 10, b: x0 + n * PASO_BANDERIN + 10 };
  }

  function guirnalda() {
    const texto = textoGuirnalda();
    const paso = PASO_BANDERIN;
    const r = rangoGuirnalda();
    const x0 = r.x0, a = r.a, b = r.b;             // a y b: donde se ata el cordel
    const cordelY = function (x) {
      return 13 + Math.round(3 * Math.sin(Math.PI * (x - a) / (b - a)));
    };
    const colores = ["#f7c9d8", "#fde2eb"];
    const brisa = onda(70, 1);

    // Cordel, atado a la cuerda del techo por los dos extremos
    for (let x = a; x <= b; x++) px(x, cordelY(x), 1, 1, "#ead3da");
    px(a, 9, 1, 4, "#ead3da");
    px(b, 9, 1, 4, "#ead3da");

    for (let i = 0; i < texto.length; i++) {
      const letra = LETRAS[texto[i]];
      if (!letra) continue;                        // los espacios quedan vacíos
      const x = x0 + i * paso;
      const y = cordelY(x + 2) + 1 + (i % 2 ? brisa : 0);
      const col = colores[i % 2];

      // Banderín con la punta hacia abajo
      px(x, y, 5, 6, col);
      px(x + 1, y + 6, 3, 1, col);
      px(x + 2, y + 7, 1, 1, col);
      px(x + 4, y, 1, 6, "#e7b3c5");               // sombra en el borde

      for (let fy = 0; fy < 5; fy++) {
        for (let fx = 0; fx < 3; fx++) {
          if (letra[fy][fx] === "#") px(x + 1 + fx, y + 1 + fy, 1, 1, "#8c2f45");
        }
      }
    }
  }

  /* ---------- el tatami y la mesa ---------- */

  function tatami(sala) {
    const x = 90, y = 132, w = 80, h = 26;
    const base = sala.tatami;

    px(x, y, w, h, tono(base, -0.06));
    px(x + 2, y + 4, w - 4, h - 8, base);

    // Trama del junco
    for (let yy = y + 5; yy < y + h - 4; yy += 2) px(x + 2, yy, w - 4, 1, tono(base, 0.05));

    // Ribete de brocado con hilo de oro en los bordes largos
    px(x, y, w, 4, "#2b2330");
    px(x, y + h - 4, w, 4, "#2b2330");
    px(x, y + 1, w, 1, ORO);
    px(x, y + h - 2, w, 1, ORO);
    for (let xx = x + 3; xx < x + w - 2; xx += 6) {
      px(xx, y + 2, 2, 1, tono(ORO, -0.25));
      px(xx, y + h - 3, 2, 1, tono(ORO, -0.25));
    }
  }

  function mesa() {
    // Patas de laca con el pie ensanchado
    px(102, 117, 6, 18, LACA);
    px(148, 117, 6, 18, LACA);
    px(101, 133, 8, 3, LACA_CLARA);
    px(147, 133, 8, 3, LACA_CLARA);

    // Tablero lacado
    px(94, 110, 68, 5, "#342b40");
    px(94, 110, 68, 1, "#463a54");
    px(94, 115, 68, 2, LACA);

    // Camino de mesa carmín, cayendo por la izquierda
    px(96, 110, 60, 2, CARMIN);
    px(98, 112, 14, 8, CARMIN);
    px(98, 112, 14, 1, tono(CARMIN, 0.12));
    px(98, 119, 14, 1, ORO);
  }

  /* ---------- la tarta ---------- */

  function velasDe(cx, topY, topW, velas) {
    // Velas pastel con rayas de caramelo
    const colores = ["#f7b8d0", "#b8ecd8", "#c9b6f0", "#fbe9a6", "#b6d8f5"];
    const filas = velas > 6 ? 2 : 1;
    const porFila = Math.ceil(velas / filas);
    let restantes = velas;
    let indice = 0;

    for (let f = filas - 1; f >= 0; f--) {
      const n = Math.min(porFila, restantes);
      restantes -= n;
      if (n <= 0) continue;

      const paso = n > 1 ? Math.max(3, Math.floor((topW - 6) / (n - 1))) : 0;
      let vx = cx - Math.floor((paso * (n - 1)) / 2) + (f === 1 ? 1 : 0);
      const base = topY - (f === 1 ? 3 : 0);

      for (let i = 0; i < n; i++) {
        const col = colores[indice % colores.length];
        px(vx, base - 7, 2, 7, col);
        px(vx + 1, base - 7, 1, 7, tono(col, -0.1));
        px(vx, base - 6, 2, 1, "#fff6fa");
        px(vx, base - 3, 2, 1, "#fff6fa");

        if (!velasApagadas) {
          const salto = sinMovimiento ? 0 : (Math.sin((frame + indice * 9) / 7) > 0 ? 1 : 0);
          px(vx, base - 10 - salto, 2, 3, "#ffb84a");
          px(vx, base - 11 - salto, 2, 1, "#fff1c2");
          px(vx, base - 8, 2, 1, "#ff7a5c");
        } else if (!sinMovimiento) {
          const h = Math.floor((frame / 3 + indice * 5) % 16);
          px(vx + (h % 3 === 0 ? 0 : 1), base - 9 - h, 1, 1, "rgba(214,206,196,0.35)");
        }
        vx += paso;
        indice++;
      }
    }
  }

  /* ---------- adornos del frente de la tarta ---------- */

  // Calavera kawaii con lazo rosa
  function calaveraKawaii(cx, cy) {
    const hueso = "#fff6f0", ojo = "#2a1d2e";
    px(cx - 3, cy, 6, 4, hueso);
    px(cx - 2, cy - 1, 4, 1, hueso);
    px(cx - 2, cy + 4, 4, 2, hueso);
    px(cx - 2, cy + 1, 2, 2, ojo);
    px(cx + 1, cy + 1, 2, 2, ojo);
    px(cx - 2, cy + 1, 1, 1, "#ffffff");
    px(cx + 1, cy + 1, 1, 1, "#ffffff");
    px(cx - 1, cy + 5, 1, 1, ojo);
    px(cx + 1, cy + 5, 1, 1, ojo);
    px(cx + 2, cy - 2, 2, 2, "#ff8fc0");          // lazo
    px(cx + 4, cy - 2, 2, 2, "#ff8fc0");
    px(cx + 4, cy - 1, 1, 1, "#d9588f");
  }

  // Corona gótica negra con gema rosa
  function coronaGotica(cx, cy) {
    const negro = "#1b1520", filo = "#b9a3d8";
    px(cx - 4, cy + 2, 9, 4, negro);
    px(cx - 4, cy, 1, 2, negro);
    px(cx, cy - 1, 1, 3, negro);
    px(cx + 4, cy, 1, 2, negro);
    px(cx - 2, cy + 1, 1, 1, negro);
    px(cx + 2, cy + 1, 1, 1, negro);
    px(cx - 4, cy + 5, 9, 1, filo);
    px(cx - 4, cy - 1, 1, 1, filo);
    px(cx, cy - 2, 1, 1, filo);
    px(cx + 4, cy - 1, 1, 1, filo);
    px(cx - 1, cy + 3, 3, 2, "#ff8fc0");
    px(cx - 1, cy + 3, 1, 1, "#ffd6ea");
  }

  /* ---------- toppings ---------- */

  function destello(x, y, fase, col) {
    // Estrellita de cuatro puntas que se enciende y se apaga
    const t = sinMovimiento ? 1 : (Math.sin((frame + fase) / 11) + 1) / 2;
    if (t < 0.25) return;
    px(x, y, 1, 1, "#ffffff");
    px(x - 1, y, 3, 1, col);
    px(x, y - 1, 1, 3, col);
    px(x, y, 1, 1, "#ffffff");
    if (t > 0.7) {
      px(x - 2, y, 1, 1, col);
      px(x + 2, y, 1, 1, col);
      px(x, y - 2, 1, 1, col);
      px(x, y + 2, 1, 1, col);
    }
  }

  function murcielago(x, y, fase) {
    const cuerpo = "#4a3b5c", ala = "#9d86c2", filo = "#ff9fcf";
    const arriba = sinMovimiento ? true : Math.floor((frame + fase) / 9) % 2 === 0;
    const bote = onda(20, 1, fase);
    y += bote;
    px(x, y, 2, 3, cuerpo);
    px(x, y - 1, 1, 1, cuerpo);                   // orejas
    px(x + 1, y - 1, 1, 1, cuerpo);
    px(x, y + 1, 1, 1, filo);                     // ojitos rosas
    px(x + 1, y + 1, 1, 1, filo);
    if (arriba) {
      px(x - 3, y - 1, 3, 1, ala);
      px(x - 2, y, 2, 1, ala);
      px(x + 2, y - 1, 3, 1, ala);
      px(x + 2, y, 2, 1, ala);
      px(x - 3, y - 2, 1, 1, filo);
      px(x + 4, y - 2, 1, 1, filo);
    } else {
      px(x - 3, y + 1, 3, 1, ala);
      px(x - 2, y + 2, 2, 1, ala);
      px(x + 2, y + 1, 3, 1, ala);
      px(x + 2, y + 2, 2, 1, ala);
      px(x - 3, y + 2, 1, 1, filo);
      px(x + 4, y + 2, 1, 1, filo);
    }
  }

  function cereza(x, y) {
    px(x + 1, y - 3, 1, 2, "#5f8f5a");            // rabito
    px(x + 2, y - 4, 1, 1, "#5f8f5a");
    px(x, y - 1, 3, 3, "#c0264a");
    px(x - 1, y, 1, 1, "#c0264a");
    px(x, y - 1, 1, 1, "#ff9fb4");                // brillo
  }

  /* ---------- la tarta ---------- */

  function dibujarTarta(t, cx, baseY) {
    const anchos = [48, 36, 24];
    const altos = [11, 11, 13];
    const pisos = Math.max(1, Math.min(3, t.pisos | 0));
    const lista = Array.isArray(t.toppings) ? t.toppings : [];
    const tiene = function (id) { return lista.indexOf(id) >= 0; };
    const bizcocho = t.bizcocho, cobertura = t.cobertura;
    const hayAdorno = t.topper && t.topper !== "ninguno";

    // Bandeja negra con filo pastel
    px(cx - 28, baseY - 3, 56, 3, "#1a1420");
    px(cx - 28, baseY - 3, 56, 1, "#f3c6d8");
    px(cx - 27, baseY, 54, 1, "rgba(10,6,14,0.35)");

    let y = baseY - 4;
    const cimas = [];

    for (let i = 0; i < pisos; i++) {
      const w = anchos[i];
      const alto = i === pisos - 1 ? altos[2] : altos[i];
      const x = cx - Math.floor(w / 2);
      y -= alto;
      cimas.push({ x: x, y: y, w: w, alto: alto });
      const r = azar(200 + i);

      // Bizcocho con volumen: luz a la izquierda, sombra a la derecha
      px(x, y, w, alto, bizcocho);
      px(x, y, 2, alto, tono(bizcocho, 0.08));
      px(x + w - 3, y, 3, alto, tono(bizcocho, -0.08));
      px(x, y + alto - 1, w, 1, tono(bizcocho, -0.14));

      // Cobertura que chorrea
      px(x - 1, y, w + 2, 3, cobertura);
      px(x - 1, y, w + 2, 1, tono(cobertura, 0.14));
      const maxGota = i === pisos - 1 ? 2 : 3;
      for (let dx = 0; dx < w - 1; dx += 3) {
        const largo = 1 + Math.floor(r() * maxGota);
        px(x + dx, y + 3, 2, largo, cobertura);
        px(x + dx, y + 3, 1, largo, tono(cobertura, 0.08));
      }

      // Chispitas de colores
      // En el piso de la carita se deja libre el centro
      const libre = function (sx) { return i === 0 && tiene("carita") && Math.abs(sx - cx) < 10; };

      if (tiene("chispas")) {
        const cols = ["#ff8fc8", "#8fd8ff", "#fff08a", "#a8f0c8", "#d8b0ff"];
        for (let k = 0; k < Math.floor(w / 4); k++) {
          const sx = x + 2 + Math.floor(r() * (w - 5));
          const sy = y + 5 + Math.floor(r() * (alto - 8));
          if (libre(sx)) continue;
          if (k % 2) px(sx, sy, 2, 1, cols[k % cols.length]);
          else px(sx, sy, 1, 2, cols[k % cols.length]);
        }
      }

      // Brillantes: gemitas incrustadas en el bizcocho
      if (tiene("brillantes")) {
        for (let k = 0; k < 2; k++) {
          const gx = x + 4 + Math.floor(r() * (w - 9));
          const gy = y + 5 + Math.floor(r() * (alto - 8));
          const gema = k % 2 ? "#bff3ff" : "#ffd0ec";
          if (libre(gx)) continue;
          px(gx, gy, 2, 2, gema);
          px(gx, gy, 1, 1, "#ffffff");
        }
      }

      // Pinchos góticos: una tira negra con púas de punta plateada
      if (tiene("pinchos")) {
        const hueco = (i === 0 && tiene("carita")) ? 10 : (i === pisos - 1 && hayAdorno) ? 7 : -1;
        px(x, y + alto - 3, w, 2, "#17121c");
        for (let sx = x + 1; sx < x + w - 2; sx += 5) {
          if (Math.abs(sx + 1 - cx) < hueco) continue;
          px(sx, y + alto - 4, 3, 1, "#17121c");
          px(sx + 1, y + alto - 5, 1, 1, "#17121c");
          px(sx + 1, y + alto - 6, 1, 1, "#e4e7ee");
          px(sx + 1, y + alto - 2, 1, 1, "#9aa0ab");   // tachuela
        }
      }

      // Perlas en el borde de abajo
      if (tiene("perlas")) {
        for (let dx = 1; dx < w - 1; dx += 2) {
          px(x + dx, y + alto - 1, 1, 1, dx % 4 === 1 ? "#fffaf7" : "#f3dfe8");
        }
      }

      // Nata montada en el borde de arriba (la del piso de encima tapa el centro)
      if (tiene("nata")) {
        for (let dx = 0; dx < w - 1; dx += 5) {
          px(x + dx, y - 2, 3, 2, "#fffaf5");
          px(x + dx + 1, y - 3, 1, 1, "#fffaf5");
          px(x + dx + 2, y - 1, 1, 1, "#ecdde4");
        }
      }
    }

    // Encaje blanco sobre la bandeja
    for (let dx = -27; dx < 27; dx += 3) px(cx + dx, baseY - 3, 2, 1, "#fbe3ec");
    px(cx - 26, baseY - 4, 52, 1, "#fbe3ec");

    const cima = cimas[cimas.length - 1];

    // Carita kawaii en el piso de abajo: ojos brillantes, coloretes y boca ":3"
    if (tiene("carita")) {
      const fy = cimas[0].y + 4;
      const ojo = "#2a1d2e";
      px(cx - 6, fy, 2, 2, ojo);
      px(cx + 4, fy, 2, 2, ojo);
      px(cx - 6, fy, 1, 1, "#ffffff");
      px(cx + 4, fy, 1, 1, "#ffffff");
      px(cx - 9, fy + 2, 2, 1, "#ff7fae");
      px(cx + 7, fy + 2, 2, 1, "#ff7fae");
      px(cx - 2, fy + 2, 1, 1, ojo);
      px(cx - 1, fy + 3, 1, 1, ojo);
      px(cx, fy + 2, 1, 1, ojo);
      px(cx + 1, fy + 3, 1, 1, ojo);
      px(cx + 2, fy + 2, 1, 1, ojo);
    }

    // Adorno en el frente del piso de arriba
    const ay = cima.y + 4;
    if (t.topper === "luna") luna(cx, ay, ORO);
    else if (t.topper === "sakura") sakura(cx, ay, "#ffc2d8");
    else if (t.topper === "corazon") corazon(cx, ay + 1, "#ff6f9f");
    else if (t.topper === "calavera") calaveraKawaii(cx, ay + 1);
    else if (t.topper === "corona") coronaGotica(cx, ay + 1);

    // Cerezas en la repisa del piso de en medio (o arriba si solo hay un piso)
    if (tiene("cerezas")) {
      if (pisos >= 2) {
        const rep = cimas[pisos - 2];
        const borde = Math.floor(anchos[pisos - 1] / 2);
        cereza(cx - borde - 5, rep.y - 1);
        cereza(cx + borde + 2, rep.y - 1);
      } else {
        cereza(cx - 9, cima.y - 1);
        cereza(cx + 7, cima.y - 1);
      }
    }

    const velas = Math.max(0, Math.min(12, t.velas | 0));
    if (velas > 0) velasDe(cx, cima.y, cima.w, velas);

    const arriba = cima.y - 12;

    // Murciélagos revoloteando a los lados
    if (tiene("murcielagos")) {
      murcielago(cx - 26, arriba + 10, 0);
      murcielago(cx + 24, arriba + 4, 37);
    }

    // Destellos alrededor de la tarta
    if (tiene("brillantes")) {
      destello(cx - 21, arriba + 4, 0, "#ffd0ec");
      destello(cx + 20, arriba + 14, 25, "#bff3ff");
      destello(cx - 15, arriba - 3, 50, "#fff08a");
      destello(cx + 13, arriba - 5, 75, "#ffd0ec");
      destello(cx + 27, baseY - 16, 12, "#d8b0ff");
      destello(cx - 28, baseY - 12, 60, "#bff3ff");
    }

    return arriba;
  }

  /* ---------- los regalos ---------- */

  // Estampados tradicionales, reducidos a lo que cabe en 11-19 píxeles
  function patronCaja(id, x, y, w, h, base) {
    const claro = tono(base, 0.22);
    const hondo = tono(base, -0.14);

    if (id === "rayas") {
      for (let dx = 1; dx < w - 1; dx += 4) px(x + dx, y, 2, h, claro);

    } else if (id === "asanoha") {
      // Hoja de cáñamo: estrellas de seis puntas en retícula
      for (let dy = 1; dy < h - 2; dy += 5) {
        const inicio = (dy % 10 === 1) ? 2 : 5;
        for (let dx = inicio; dx < w - 2; dx += 6) {
          px(x + dx, y + dy + 1, 3, 1, claro);
          px(x + dx + 1, y + dy, 1, 3, claro);
          px(x + dx, y + dy, 1, 1, claro);
          px(x + dx + 2, y + dy + 2, 1, 1, claro);
        }
      }

    } else if (id === "seigaiha") {
      // Olas: arcos concéntricos superpuestos
      for (let dy = 2; dy < h + 2; dy += 4) {
        const inicio = ((dy - 2) % 8 === 0) ? 0 : -3;
        for (let dx = inicio; dx < w; dx += 6) {
          for (let r = 3; r >= 1; r -= 2) {
            for (let k = -r; k <= r; k++) {
              const alto = Math.round(Math.sqrt(Math.max(0, r * r - k * k)));
              const ax = x + dx + 3 + k, ay = y + dy - alto;
              if (ax >= x && ax < x + w && ay >= y && ay < y + h) {
                px(ax, ay, 1, 1, r === 3 ? claro : hondo);
              }
            }
          }
        }
      }

    } else if (id === "kikko") {
      // Panal de tortuga: hexágonos encajados
      for (let dy = 0; dy < h; dy += 4) {
        const inicio = (dy % 8 === 0) ? 1 : 4;
        for (let dx = inicio; dx < w - 3; dx += 6) {
          px(x + dx + 1, y + dy, 2, 1, claro);
          px(x + dx, y + dy + 1, 1, 2, claro);
          px(x + dx + 3, y + dy + 1, 1, 2, claro);
          px(x + dx + 1, y + dy + 3, 2, 1, claro);
        }
      }
    }
  }

  function dibujarRegalo(g, x, abajo, conSombra) {
    const t = TAMANOS[g.tamano] || TAMANOS.mediano;
    const y = abajo - t.h;
    const caja = g.caja, cinta = g.cinta;

    if (conSombra) px(x - 1, abajo, t.w + 2, 2, "rgba(10,6,14,0.35)");

    px(x, y, t.w, t.h, caja);
    patronCaja(g.patron, x, y, t.w, t.h, caja);
    px(x, y, t.w, 2, tono(caja, 0.16));
    px(x, y, 1, t.h, tono(caja, 0.08));
    px(x + t.w - 1, y, 1, t.h, tono(caja, -0.18));
    px(x, y + t.h - 1, t.w, 1, tono(caja, -0.22));

    // Cordón mizuhiki cruzando la caja
    const mx = x + Math.floor(t.w / 2) - 1;
    px(mx, y, 2, t.h, cinta);
    px(mx, y, 1, t.h, tono(cinta, 0.2));
    px(x, y + Math.floor(t.h / 3), t.w, 2, cinta);
    px(x, y + Math.floor(t.h / 3), t.w, 1, tono(cinta, 0.2));

    const bx = x + Math.floor(t.w / 2);
    if (g.lazo === "mizuhiki") {
      // Nudo plano de cordón, más sobrio que un lazo
      px(bx - 5, y - 3, 4, 2, cinta);
      px(bx + 1, y - 3, 4, 2, cinta);
      px(bx - 5, y - 4, 2, 1, tono(cinta, 0.25));
      px(bx + 3, y - 4, 2, 1, tono(cinta, 0.25));
      px(bx - 1, y - 4, 2, 3, tono(cinta, -0.12));
    } else if (g.lazo === "luna") {
      luna(bx, y - 8, cinta);
    } else if (g.lazo === "sakura") {
      sakura(bx + 1, y - 8, cinta);
    }

    // Etiqueta de papel
    px(x + t.w - 5, y + t.h - 5, 4, 4, PAPEL);
    px(x + t.w - 5, y + t.h - 2, 4, 1, PAPEL_HONDO);
  }

  function calcularPosiciones(regalos) {
    // Un cursor por lado: los regalos se posan alternando derecha e izquierda
    const lados = [
      { filas: LADO_DERECHO, fila: 0, x: LADO_DERECHO[0].x0, pasada: 0 },
      { filas: LADO_IZQUIERDO, fila: 0, x: LADO_IZQUIERDO[0].x0, pasada: 0 },
    ];
    const res = [];

    for (let i = 0; i < regalos.length; i++) {
      const lado = lados[i % 2];
      const t = TAMANOS[regalos[i].tamano] || TAMANOS.mediano;
      let f = lado.filas[lado.fila];

      if (lado.x + t.w > f.x1) {
        lado.fila++;
        if (lado.fila >= lado.filas.length) { lado.fila = 0; lado.pasada++; }
        f = lado.filas[lado.fila];
        lado.x = f.x0;
      }

      res.push({
        x: lado.x, abajo: f.y - lado.pasada * 12,
        w: t.w, h: t.h, i, fila: lado.fila, pasada: lado.pasada,
      });
      lado.x += t.w + 2;
    }

    res.sort(function (a, b) { return (a.fila - b.fila) || (a.pasada - b.pasada); });
    return res;
  }

  function dibujarRegalos(regalos) {
    posicionesRegalo = calcularPosiciones(regalos);
    for (const p of posicionesRegalo) {
      dibujarRegalo(regalos[p.i], p.x, p.abajo, true);
      zonas.push({
        id: "regalo", i: p.i,
        x: p.x - 2, y: p.abajo - p.h - 9, w: p.w + 4, h: p.h + 11,
      });
    }
  }

  /* ---------- el gato ---------- */

  function gato() {
    const x = 122, y = 150;
    const col = "#1a1620", col2 = "#2a2333";
    const cola = onda(28, 2);

    px(x + 12, y - 4 + cola, 5, 2, col);
    px(x + 15, y - 8 + cola, 2, 5, col);
    px(x + 2, y - 9, 11, 9, col);
    px(x + 2, y - 9, 11, 2, col2);
    circulo(x + 7, y - 13, 5, col);
    px(x + 2, y - 19, 3, 3, col);
    px(x + 10, y - 19, 3, 3, col);
    px(x + 3, y - 18, 1, 1, "#7a4a55");
    px(x + 11, y - 18, 1, 1, "#7a4a55");

    const parpadea = !sinMovimiento && frame % 210 < 8;
    if (parpadea) {
      px(x + 4, y - 14, 2, 1, ORO);
      px(x + 9, y - 14, 2, 1, ORO);
    } else {
      px(x + 4, y - 15, 2, 2, ORO);
      px(x + 9, y - 15, 2, 2, ORO);
      px(x + 5, y - 15, 1, 1, "#f0d98a");
      px(x + 10, y - 15, 1, 1, "#f0d98a");
    }
    px(x + 7, y - 12, 1, 1, "#7a4a55");

    // Collar con cascabel
    px(x + 3, y - 9, 9, 1, CARMIN);
    px(x + 7, y - 8, 2, 2, ORO);

    px(x + 2, y - 2, 4, 2, col2);
    px(x + 9, y - 2, 4, 2, col2);

    zonas.push({ id: "gato", x: x - 2, y: y - 22, w: 22, h: 24 });
  }

  /* ---------- el perro (bichón frisé) ---------- */

  function perro() {
    const x = 143, y = 152;   // esquina inferior izquierda, a la derecha del gato
    const blanco = "#ece6dc", sombra = "#c4baad", brillo = "#fbf8f2";
    const mancha = "#a87a58", negro = "#16121a";
    const meneo = onda(9, 1); // la cola se mueve más rápido que la del gato

    // Cola: un pompón rizado sobre el lomo
    circulo(x + 24, y - 12 + meneo, 3, blanco);
    px(x + 23, y - 14 + meneo, 2, 1, brillo);

    // Cuerpo tumbado, estirado hacia atrás
    elipse(x + 16, y - 6, 10, 5, blanco);
    px(x + 9, y - 2, 18, 2, sombra);
    elipse(x + 23, y - 3, 4, 3, blanco);          // pata trasera
    px(x + 20, y - 1, 7, 1, sombra);
    px(x + 13, y - 10, 1, 1, brillo);             // rizos del lomo
    px(x + 17, y - 9, 1, 1, brillo);
    px(x + 21, y - 8, 1, 1, brillo);
    px(x + 15, y - 7, 1, 1, sombra);
    px(x + 19, y - 6, 1, 1, sombra);

    // Patas delanteras hacia delante
    px(x + 2, y - 4, 4, 4, blanco);
    px(x + 8, y - 4, 4, 4, blanco);
    px(x + 2, y - 1, 4, 1, sombra);
    px(x + 8, y - 1, 4, 1, sombra);
    px(x + 7, y - 4, 1, 4, sombra);             // separa las patas del pecho

    // Orejas caídas y peludas
    circulo(x + 1, y - 12, 3, blanco);
    circulo(x + 13, y - 12, 3, blanco);
    px(x - 1, y - 10, 2, 1, sombra);
    px(x + 14, y - 10, 2, 1, sombra);

    // Cabeza redonda de algodón
    circulo(x + 7, y - 15, 6, blanco);
    circulo(x + 7, y - 18, 5, blanco);
    px(x + 4, y - 22, 1, 1, brillo);
    px(x + 7, y - 23, 2, 1, brillo);
    px(x + 10, y - 21, 1, 1, brillo);
    px(x + 3, y - 19, 1, 1, brillo);
    px(x + 11, y - 18, 1, 1, brillo);

    // Ojos negros, con el parpadeo desfasado del gato
    const parpadea = !sinMovimiento && (frame + 90) % 240 < 8;
    if (parpadea) {
      px(x + 4, y - 16, 2, 1, negro);
      px(x + 9, y - 16, 2, 1, negro);
    } else {
      px(x + 4, y - 17, 2, 2, negro);
      px(x + 9, y - 17, 2, 2, negro);
      px(x + 4, y - 17, 1, 1, "#5d5566");
      px(x + 9, y - 17, 1, 1, "#5d5566");
    }

    // Manchitas color canela bajo los ojos y en el bigote
    px(x + 3, y - 15, 1, 2, mancha);
    px(x + 11, y - 15, 1, 2, mancha);
    px(x + 5, y - 11, 1, 1, mancha);
    px(x + 9, y - 11, 1, 1, mancha);

    // Hocico negro y boquita
    px(x + 6, y - 14, 3, 2, negro);
    px(x + 7, y - 14, 1, 1, "#4a4150");
    px(x + 6, y - 11, 3, 1, "#5a3a44");

    // Chapita azul con la huella
    px(x + 7, y - 9, 2, 2, "#3b56a3");
    px(x + 7, y - 9, 1, 1, "#a9bce6");

    zonas.push({ id: "perro", x: x - 3, y: y - 24, w: 32, h: 25 });
  }

  /* ---------- el conde Drácula, pensativo en su rincón ---------- */

  function dracula() {
    const x = 3, y = 122;                          // esquina inferior izquierda
    const capa = "#120d18", forro = "#8c1f33", traje = "#231c2c";
    const piel = "#d8d6cc", pelo = "#0c090f";

    // Cuello alto de la capa, por detrás de la cabeza
    px(x + 2, y - 37, 3, 9, capa);
    px(x + 14, y - 37, 3, 9, capa);
    px(x + 3, y - 36, 1, 7, forro);
    px(x + 15, y - 36, 1, 7, forro);

    // Capa que se abre hacia abajo, con el forro rojo asomando
    for (let i = 0; i < 29; i++) {
      const a = 12 + Math.floor(i * 0.3);
      px(x + 9.5 - a / 2, y - 29 + i, a, 1, capa);
    }
    for (let i = 4; i < 29; i++) {
      const a = 12 + Math.floor(i * 0.3);
      px(x + 9.5 - a / 2 + 1, y - 29 + i, 1, 1, forro);
      px(x + 9.5 + a / 2 - 2, y - 29 + i, 1, 1, forro);
    }

    // Traje, pechera blanca, corbatín rojo y medallón
    px(x + 6, y - 28, 8, 26, traje);
    px(x + 9, y - 27, 2, 3, "#ece6dc");
    px(x + 8, y - 28, 4, 1, "#8c1f33");
    px(x + 9, y - 22, 2, 2, ORO);
    px(x + 9, y - 21, 1, 1, "#c23a3a");
    px(x + 9, y - 10, 2, 8, capa);                // separación de las piernas
    px(x + 6, y - 2, 4, 2, "#050407");            // zapatos
    px(x + 11, y - 2, 4, 2, "#050407");

    // Manos pálidas sujetando la capa
    px(x + 4, y - 19, 2, 2, piel);
    px(x + 14, y - 19, 2, 2, piel);

    // Cabeza: pelo engominado con pico, orejas puntiagudas
    px(x + 6, y - 37, 8, 7, piel);
    px(x + 7, y - 30, 6, 1, piel);
    px(x + 7, y - 29, 6, 1, "#0c090f");           // sombra del cuello
    px(x + 6, y - 39, 8, 3, pelo);
    px(x + 6, y - 36, 2, 1, pelo);
    px(x + 12, y - 36, 2, 1, pelo);
    px(x + 9, y - 36, 2, 1, pelo);                // el pico en la frente
    px(x + 5, y - 35, 1, 3, piel);
    px(x + 14, y - 35, 1, 3, piel);
    px(x + 5, y - 36, 1, 1, piel);
    px(x + 14, y - 36, 1, 1, piel);

    // Cejas y ojos rojos que parpadean
    px(x + 7, y - 34, 2, 1, pelo);
    px(x + 11, y - 34, 2, 1, pelo);
    const parpadea = !sinMovimiento && (frame + 40) % 260 < 7;
    if (!parpadea) {
      px(x + 7, y - 33, 2, 1, "#e0304a");
      px(x + 11, y - 33, 2, 1, "#e0304a");
    } else {
      px(x + 7, y - 33, 2, 1, "#8e8a84");
      px(x + 11, y - 33, 2, 1, "#8e8a84");
    }

    // Boca con los colmillos
    px(x + 8, y - 31, 4, 1, "#5a1a24");
    px(x + 8, y - 30, 1, 1, "#ffffff");
    px(x + 11, y - 30, 1, 1, "#ffffff");

    // Circulitos de pensamiento que van apareciendo uno tras otro
    const nube = "rgba(236,226,214,0.9)";
    const paso = sinMovimiento ? 3 : Math.floor(frame / 30) % 5;
    if (paso >= 0) circulo(x + 17, y - 42, 1, nube);
    if (paso >= 1) circulo(x + 21, y - 47, 2, nube);
    if (paso >= 2) {
      circulo(x + 28, y - 54, 4, nube);
      circulo(x + 33, y - 56, 5, nube);
      circulo(x + 38, y - 54, 4, nube);
      px(x + 26, y - 53, 15, 4, nube);
      // Tres puntos suspensivos dentro de la nube
      const puntos = sinMovimiento ? 3 : Math.min(3, paso - 1);
      for (let k = 0; k < puntos; k++) px(x + 28 + k * 4, y - 55, 2, 2, "#4a3a55");
    }

    zonas.push({ id: "dracula", x: x, y: y - 62, w: 44, h: 62 });
  }

  /* ---------- luz LED rosa y ambiente tenue ---------- */

  function tiraLed(x, y, w, haciaAbajo) {
    const pulso = sinMovimiento ? 0 : Math.sin(frame / 40) * 0.04;
    px(x, y, w, 1, "#ff6fb8");
    for (let i = 1; i <= 8; i++) {
      const a = Math.max(0, (0.22 + pulso) * (1 - i / 9));
      px(x, haciaAbajo ? y + i : y - i, w, 1, "rgba(255,90,175," + a.toFixed(3) + ")");
    }
  }

  function luzRosa() {
    // Primero se apaga un poco la sala y luego se tiñe de rosa
    px(0, 0, W, H, "rgba(12,4,22,0.34)");
    px(0, 0, W, H, "rgba(255,70,165,0.09)");

    // Tiras LED: bajo el techo y bajo el estante
    tiraLed(0, 1, W, true);
    tiraLed(104, 53, 48, true);
  }

  /* ---------- pétalos y confeti ---------- */

  function iniciarPetalos() {
    const r = azar(31);
    petalos = [];
    for (let i = 0; i < 18; i++) {
      petalos.push({
        x: r() * W,
        y: r() * H,
        v: 0.12 + r() * 0.16,
        fase: r() * 100,
        c: r() > 0.5 ? "#d9a2b0" : "#e7c2cb",
      });
    }
  }

  function dibujarPetalos() {
    for (const p of petalos) {
      if (!sinMovimiento) {
        p.y += p.v;
        if (p.y > H + 2) { p.y = -3; p.x = (p.x + 47) % W; }
      }
      const deriva = sinMovimiento ? 0 : Math.round(Math.sin((frame + p.fase) / 48) * 7);
      px(p.x + deriva, p.y, 2, 2, p.c);
    }
  }

  function lanzarConfeti(x, y, n) {
    const cols = [ORO, "#e8c98a", "#d9a2b0", PAPEL, "#b04058", "#e7c2cb"];
    const cantidad = sinMovimiento ? Math.min(n, 12) : n;
    for (let i = 0; i < cantidad; i++) {
      confeti.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -Math.random() * 2.1 - 0.5,
        c: cols[(Math.random() * cols.length) | 0],
        vida: 55 + Math.random() * 55,
      });
    }
  }

  function dibujarConfeti() {
    for (let i = confeti.length - 1; i >= 0; i--) {
      const p = confeti[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.vida--;
      if (p.vida <= 0 || p.y > H + 4) { confeti.splice(i, 1); continue; }
      px(p.x, p.y, 2, 2, p.c);
    }
  }

  /* ---------- escena completa ---------- */

  function dibujarEscena() {
    const est = leerEstado();
    if (!est) return;

    zonas = [];
    c.clearRect(0, 0, W, H);

    pared(est.sala);
    shimenawa();
    ventana(est.sala);
    kakejiku();
    estante();
    posters();
    enredaderas();
    ramasSakura();
    faroles(est.sala);
    guirnalda();
    suelo();
    tatami(est.sala);
    mesa();

    dracula();
    dibujarRegalos(est.regalos);
    if (est.sala.mascota) gato();
    perro();
    luzRosa();

    // La tarta va después de la luz tenue, para que sus colores pastel
    // destaquen sobre la sala oscura, con un halo suave detrás.
    elipse(128, 88, 40, 30, "rgba(255,190,225,0.05)");
    elipse(128, 90, 30, 22, "rgba(255,190,225,0.06)");
    const alturaTarta = dibujarTarta(est.tarta, 128, 110);
    zonas.push({ id: "tarta", x: 98, y: alturaTarta, w: 60, h: 110 - alturaTarta });
    dibujarPetalos();
    dibujarConfeti();

    // Viñeteado suave: las esquinas quedan algo más oscuras
    px(0, 0, 3, H, "rgba(10,6,16,0.28)");
    px(W - 3, 0, 3, H, "rgba(10,6,16,0.28)");
    px(0, 0, W, 2, "rgba(10,6,16,0.22)");
    px(0, H - 2, W, 2, "rgba(10,6,16,0.22)");

    frame++;
  }

  function bucle() {
    dibujarEscena();
    requestAnimationFrame(bucle);
  }

  /* ---------- interacción ---------- */

  function aCoordenadas(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * W,
      y: ((ev.clientY - r.top) / r.height) * H,
    };
  }

  function zonaEn(p) {
    for (let i = zonas.length - 1; i >= 0; i--) {
      const z = zonas[i];
      if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
    }
    return null;
  }

  // Altura de referencia: solo se actualiza al girar el móvil o cambiar el
  // ancho, para que la barra del navegador no cambie el tamaño al hacer scroll.
  // Qué parte del alto de la pantalla ocupa la sala en vertical (1 = toda).
  // Bájalo (por ejemplo a 0.8) si quieres ver más sala a lo ancho.
  const ZOOM_VERTICAL = 1;

  // Por debajo de este alto (móvil en horizontal) la sala también ocupa
  // toda la pantalla, sin marco.
  const ALTO_COMPACTO = 540;

  let anchoAnterior = 0;
  let sonda = null;

  // Alto útil de la pantalla. Se mide con 100svh, que no cambia cuando la
  // barra del navegador del móvil aparece o desaparece al hacer scroll.
  function altoPantalla() {
    if (!sonda) {
      sonda = document.createElement("div");
      sonda.setAttribute("aria-hidden", "true");
      sonda.style.cssText = "position:fixed;top:0;left:0;width:0;visibility:hidden;" +
        "pointer-events:none;height:100vh;height:100svh;";
      document.body.appendChild(sonda);
    }
    return sonda.offsetHeight || window.innerHeight;
  }

  function ajustarEscala() {
    const visor = canvas.parentElement;
    const pantalla = visor.parentElement;
    const escenario = pantalla.parentElement;

    const anchoPantalla = window.innerWidth;
    const alto = altoPantalla();

    const e = getComputedStyle(pantalla);
    const bordes = parseFloat(e.paddingLeft) + parseFloat(e.paddingRight) +
                   parseFloat(e.borderLeftWidth) + parseFloat(e.borderRightWidth);
    const disponible = escenario.clientWidth - bordes;
    const vertical = alto > anchoPantalla;
    const compacto = !vertical && alto <= ALTO_COMPACTO;

    let escala;
    if (vertical) {
      // En vertical (móvil o tablet) la sala ocupa toda la pantalla de alto
      // y se recorre a los lados con las flechas o deslizando, como un juego.
      escala = Math.max(disponible / W, (alto * ZOOM_VERTICAL) / H);
    } else if (compacto) {
      // Móvil en horizontal: la sala ocupa todo el alto de la pantalla
      escala = alto / H;
    } else {
      escala = Math.min(disponible / W, (alto * 0.9) / H);
      if (escala >= 5) escala = Math.floor(escala);
    }
    escala = Math.max(escala, 0.5);

    const ancho = Math.floor(W * escala);
    canvas.style.width = ancho + "px";
    canvas.style.height = Math.floor(H * escala) + "px";

    // Al cambiar de tamaño, la vista vuelve a centrarse en la tarta
    if (ancho !== anchoAnterior) {
      anchoAnterior = ancho;
      visor.scrollLeft = Math.max(0, (ancho - visor.clientWidth) / 2);
    }

    ajustarHud(pantalla);

    // Avisa a app.js para que muestre u oculte las flechas
    window.dispatchEvent(new Event("sala-ajustada"));
  }

  // Los textos de los botones solo se muestran si caben sin solaparse
  function ajustarHud(pantalla) {
    const izq = pantalla.querySelector(".hud-izq");
    const der = pantalla.querySelector(".hud-der");
    if (!izq || !der) return;
    pantalla.classList.add("hud-amplio");
    const choca = izq.getBoundingClientRect().right + 12 > der.getBoundingClientRect().left;
    if (choca) pantalla.classList.remove("hud-amplio");
  }

  /* ---------- API pública ---------- */

  return {
    W: W,
    H: H,
    TAMANOS: TAMANOS,

    init: function (elemento, obtenerEstado, manejadorClic) {
      canvas = elemento;
      canvas.width = W;
      canvas.height = H;
      c = canvas.getContext("2d");
      c.imageSmoothingEnabled = false;
      leerEstado = obtenerEstado;
      alClic = manejadorClic || function () {};

      // La preferencia de movimiento reducido es un extra: si el navegador no
      // la soporta, se ignora en vez de tumbar la página entera.
      try {
        const mq = window.matchMedia
          ? window.matchMedia("(prefers-reduced-motion: reduce)")
          : null;
        if (mq) {
          sinMovimiento = !!mq.matches;
          const cambio = function (e) { sinMovimiento = !!e.matches; };
          if (mq.addEventListener) mq.addEventListener("change", cambio);
          else if (mq.addListener) mq.addListener(cambio);
        }
      } catch (e) {
        sinMovimiento = false;
      }

      iniciarPetalos();

      canvas.addEventListener("click", function (ev) {
        const z = zonaEn(aCoordenadas(ev));
        if (z) alClic(z);
      });

      canvas.addEventListener("mousemove", function (ev) {
        canvas.style.cursor = zonaEn(aCoordenadas(ev)) ? "pointer" : "default";
      });

      window.addEventListener("resize", ajustarEscala);
      ajustarEscala();
      requestAnimationFrame(bucle);
    },

    ajustar: ajustarEscala,

    confeti: function (x, y, n) { lanzarConfeti(x, y, n || 40); },

    confetiEnRegalo: function (indice, n) {
      const p = posicionesRegalo.find(function (q) { return q.i === indice; });
      if (p) lanzarConfeti(p.x + p.w / 2, p.abajo - p.h, n || 34);
      else lanzarConfeti(W / 2, H / 2, n || 34);
    },

    soplarVelas: function () {
      velasApagadas = true;
      lanzarConfeti(128, 70, 60);
    },

    encenderVelas: function () { velasApagadas = false; },

    velasEstanApagadas: function () { return velasApagadas; },

    // Dibuja un regalo suelto en otro canvas (para las vistas previas)
    previaRegalo: function (ctx2, g) {
      const anterior = c;
      c = ctx2;
      ctx2.imageSmoothingEnabled = false;
      ctx2.clearRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
      const t = TAMANOS[g.tamano] || TAMANOS.mediano;
      const x = Math.floor((ctx2.canvas.width - t.w) / 2);
      const abajo = Math.floor(ctx2.canvas.height / 2 + t.h / 2) + 4;
      dibujarRegalo(g, x, abajo, false);
      c = anterior;
    },

    // Dibuja la tarta en otro canvas (para la vista previa del editor)
    previaTarta: function (ctx2, t) {
      const anterior = c;
      c = ctx2;
      ctx2.imageSmoothingEnabled = false;
      ctx2.clearRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
      dibujarTarta(t, Math.floor(ctx2.canvas.width / 2), ctx2.canvas.height - 2);
      c = anterior;
    },
  };
})();