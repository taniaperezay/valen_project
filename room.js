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
    { y: 124, x0: 6, x1: 84 },
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

    let i = 0;
    for (let x = 10; x < W - 8; x += 21) {
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
    const colores = [PAPEL, "#d9a2b0", "#c9a227", "#b04058"];
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
        px(vx, base - 7, 1, 7, tono(col, 0.18));
        px(vx, base - 4, 2, 1, tono(col, -0.2));

        if (!velasApagadas) {
          const salto = sinMovimiento ? 0 : (Math.sin((frame + indice * 9) / 7) > 0 ? 1 : 0);
          px(vx, base - 10 - salto, 2, 3, "#e8a93c");
          px(vx, base - 11 - salto, 2, 1, "#fdeab4");
          px(vx, base - 8, 2, 1, "#c96a24");
        } else if (!sinMovimiento) {
          const h = Math.floor((frame / 3 + indice * 5) % 16);
          px(vx + (h % 3 === 0 ? 0 : 1), base - 9 - h, 1, 1, "rgba(214,206,196,0.35)");
        }
        vx += paso;
        indice++;
      }
    }
  }

  function dibujarTarta(t, cx, baseY) {
    const anchos = [46, 34, 22];
    const altoPiso = 10;
    const pisos = Math.max(1, Math.min(3, t.pisos | 0));

    // Bandeja de laca con filo de oro
    px(cx - 27, baseY - 3, 54, 3, LACA);
    px(cx - 27, baseY - 3, 54, 1, ORO);
    px(cx - 24, baseY - 5, 48, 2, LACA_CLARA);

    let y = baseY - 5;
    for (let i = 0; i < pisos; i++) {
      const w = anchos[i];
      const x = cx - Math.floor(w / 2);
      y -= altoPiso;

      px(x, y, w, altoPiso, t.bizcocho);
      px(x, y + altoPiso - 2, w, 2, tono(t.bizcocho, -0.1));
      px(x, y, 1, altoPiso, tono(t.bizcocho, 0.1));
      px(x, y, w, 4, t.cobertura);
      for (let dx = 1; dx < w - 2; dx += 5) {
        px(x + dx, y + 4, 3, 2 + (dx % 3 ? 1 : 2), t.cobertura);
      }
      px(x, y, w, 1, tono(t.cobertura, 0.16));

      if (t.chispas) {
        const r = azar(100 + i);
        for (let k = 0; k < 9; k++) {
          const sx = x + 2 + Math.floor(r() * (w - 5));
          const sy = y + 6 + Math.floor(r() * (altoPiso - 7));
          px(sx, sy, 2, 1, k % 3 === 0 ? tono(ORO, 0.18) : ORO);
        }
      }
    }

    if (t.topper === "luna") luna(cx, y + 3, ORO);
    else if (t.topper === "sakura") sakura(cx, y + 3, "#e7c2cb");
    else if (t.topper === "corazon") corazon(cx, y + 4, "#b04058");

    const velas = Math.max(0, Math.min(12, t.velas | 0));
    if (velas > 0) velasDe(cx, y, anchos[pisos - 1], velas);

    return y - 12;
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

  /* ---------- pétalos y confeti ---------- */

  function iniciarPetalos() {
    const r = azar(31);
    petalos = [];
    for (let i = 0; i < 9; i++) {
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
    faroles(est.sala);
    suelo();
    tatami(est.sala);
    mesa();

    const alturaTarta = dibujarTarta(est.tarta, 128, 110);
    zonas.push({ id: "tarta", x: 102, y: alturaTarta, w: 52, h: 110 - alturaTarta });

    dibujarRegalos(est.regalos);
    if (est.sala.mascota) gato();
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

  function ajustarEscala() {
    const disponible = canvas.parentElement.clientWidth;
    const porAncho = disponible / W;
    const porAlto = (window.innerHeight * 0.62) / H;
    let escala = Math.min(porAncho, porAlto);
    if (escala > 1) escala = Math.floor(escala);
    escala = Math.max(escala, 0.55);
    canvas.style.width = Math.round(W * escala) + "px";
    canvas.style.height = Math.round(H * escala) + "px";
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
