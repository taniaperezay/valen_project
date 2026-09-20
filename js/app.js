/* ===========================================================
   app.js — Une la configuración, el dibujo y la interfaz.
   Guarda todo en el navegador (localStorage) y permite
   compartir regalos sueltos mediante un código de texto.
   =========================================================== */

(function () {
  "use strict";

  const CLAVE = "sala-cumple-v1";
  const CLAVE_NOMBRE = "sala-cumple-nombre";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  let estado = null;
  let borrador = null;        // el regalo que se está envolviendo
  let borradorTarta = null;   // la tarta mientras se edita
  let detalleIndice = -1;
  let ultimoFoco = null;
  let temporizadorAviso = null;

  let ctxPreviaRegalo = null;
  let ctxPreviaTarta = null;
  let ctxDetalle = null;

  /* ---------- avisos ---------- */

  function aviso(texto) {
    const el = $("#aviso");
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { el.hidden = true; }, 3400);
  }

  /* ---------- validación ---------- */

  function esColor(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); }

  function color(v, alternativa) { return esColor(v) ? v : alternativa; }

  function deLista(v, lista, alternativa) {
    return lista.some(function (o) { return String(o.id) === String(v); }) ? v : alternativa;
  }

  function entero(v, min, max, alternativa) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return alternativa;
    return Math.max(min, Math.min(max, n));
  }

  function nuevoId() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Limpia un regalo venga de donde venga (incluido un código pegado)
  function sanearRegalo(g) {
    g = g || {};
    return {
      id: typeof g.id === "string" ? g.id.slice(0, 40) : nuevoId(),
      de: String(g.de || "Alguien que te quiere").slice(0, 24),
      mensaje: String(g.mensaje || "").slice(0, 400),
      caja: color(g.caja, CONFIG.coloresCaja[0]),
      cinta: color(g.cinta, CONFIG.coloresCinta[0]),
      patron: deLista(g.patron, CONFIG.patrones, "liso"),
      lazo: deLista(g.lazo, CONFIG.lazos, "mizuhiki"),
      tamano: deLista(g.tamano, CONFIG.tamanos, "mediano"),
      fecha: typeof g.fecha === "number" ? g.fecha : Date.now(),
    };
  }

  function sanearTarta(t) {
    t = t || {};
    const base = CONFIG.tartaInicial;
    return {
      pisos: entero(t.pisos, 1, 3, base.pisos),
      bizcocho: color(t.bizcocho, base.bizcocho),
      cobertura: color(t.cobertura, base.cobertura),
      chispas: typeof t.chispas === "boolean" ? t.chispas : base.chispas,
      velas: entero(t.velas, 0, 12, base.velas),
      topper: ["luna", "sakura", "corazon", "ninguno"].indexOf(t.topper) >= 0
        ? t.topper : base.topper,
    };
  }

  function sanearSala(s) {
    s = s || {};
    const base = CONFIG.salaInicial;
    return {
      momento: s.momento === "alba" ? "alba" : (s.momento === "noche" ? "noche" : base.momento),
      pared: color(s.pared, base.pared),
      tatami: color(s.tatami, base.tatami),
      faroles: entero(s.faroles, 0, 4, base.faroles),
      mascota: typeof s.mascota === "boolean" ? s.mascota : base.mascota,
    };
  }

  /* ---------- guardado ---------- */

  function estadoInicial() {
    return {
      sala: sanearSala(CONFIG.salaInicial),
      tarta: sanearTarta(CONFIG.tartaInicial),
      regalos: [],
    };
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      aviso("Este navegador no deja guardar. Usa la copia de seguridad.");
    }
  }

  function cargar() {
    let datos = null;
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (crudo) datos = JSON.parse(crudo);
    } catch (e) {
      datos = null;
    }
    if (!datos || typeof datos !== "object") return estadoInicial();
    return {
      sala: sanearSala(datos.sala),
      tarta: sanearTarta(datos.tarta),
      regalos: Array.isArray(datos.regalos) ? datos.regalos.slice(0, 200).map(sanearRegalo) : [],
    };
  }

  /* ---------- códigos compartibles ---------- */

  function aCodigo(objeto) {
    const bytes = new TextEncoder().encode(JSON.stringify(objeto));
    let binario = "";
    bytes.forEach(function (b) { binario += String.fromCharCode(b); });
    return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function deCodigo(texto) {
    let s = String(texto).trim();
    const coincide = s.match(/regalo=([A-Za-z0-9\-_]+)/);
    if (coincide) s = coincide[1];
    s = s.replace(/[^A-Za-z0-9\-_]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    const binario = atob(s);
    const bytes = Uint8Array.from(binario, function (ch) { return ch.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto)
        .then(function () { return true; })
        .catch(function () { return respaldoCopia(texto); });
    }
    return Promise.resolve(respaldoCopia(texto));
  }

  function respaldoCopia(texto) {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* ---------- ventanas ---------- */

  function abrir(id) {
    ultimoFoco = document.activeElement;
    const m = document.getElementById(id);
    m.hidden = false;
    document.body.style.overflow = "hidden";
    const primero = m.querySelector("input, textarea, button:not(.cerrar)");
    if (primero) primero.focus();
  }

  function cerrar() {
    $$(".fondo").forEach(function (m) { m.hidden = true; });
    document.body.style.overflow = "";
    if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
  }

  function hayVentanaAbierta() {
    return $$(".fondo").some(function (m) { return !m.hidden; });
  }

  /* ---------- constructores de controles ---------- */

  function marcarSeleccion(contenedor, valor) {
    Array.prototype.forEach.call(contenedor.children, function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.valor === String(valor)));
    });
  }

  function construir(selector, opciones, tipo, valorActual, alElegir) {
    const cont = $(selector);
    cont.innerHTML = "";
    opciones.forEach(function (op) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.valor = String(op.id);
      if (tipo === "color") {
        b.className = "muestra";
        b.style.background = op.id;
        b.setAttribute("aria-label", "Color " + op.id);
      } else {
        b.className = "ficha";
        b.textContent = op.nombre;
      }
      b.setAttribute("aria-pressed", String(String(op.id) === String(valorActual)));
      b.addEventListener("click", function () {
        alElegir(op.id);
        marcarSeleccion(cont, op.id);
      });
      cont.appendChild(b);
    });
  }

  function comoOpciones(colores) {
    return colores.map(function (c) { return { id: c }; });
  }

  /* ---------- el regalo que se envuelve ---------- */

  function nuevoBorrador() {
    const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];
    return {
      id: nuevoId(),
      de: localStorage.getItem(CLAVE_NOMBRE) || "",
      mensaje: "",
      caja: alAzar(CONFIG.coloresCaja),
      cinta: alAzar(CONFIG.coloresCinta),
      patron: alAzar(CONFIG.patrones).id,
      lazo: "mizuhiki",
      tamano: "mediano",
      fecha: Date.now(),
    };
  }

  function pintarFormularioRegalo() {
    $("#reg-de").value = borrador.de;
    $("#reg-mensaje").value = borrador.mensaje;
    construir("#sw-caja", comoOpciones(CONFIG.coloresCaja), "color", borrador.caja,
      function (v) { borrador.caja = v; });
    construir("#sw-cinta", comoOpciones(CONFIG.coloresCinta), "color", borrador.cinta,
      function (v) { borrador.cinta = v; });
    construir("#ch-patron", CONFIG.patrones, "ficha", borrador.patron,
      function (v) { borrador.patron = v; });
    construir("#ch-lazo", CONFIG.lazos, "ficha", borrador.lazo,
      function (v) { borrador.lazo = v; });
    construir("#ch-tamano", CONFIG.tamanos, "ficha", borrador.tamano,
      function (v) { borrador.tamano = v; });
  }

  function abrirRegalo() {
    borrador = nuevoBorrador();
    pintarFormularioRegalo();
    abrir("modal-regalo");
  }

  function leerFormularioRegalo() {
    borrador.de = $("#reg-de").value.trim();
    borrador.mensaje = $("#reg-mensaje").value.trim();
    if (borrador.de) localStorage.setItem(CLAVE_NOMBRE, borrador.de);
    return sanearRegalo(borrador);
  }

  function dejarRegalo() {
    const g = leerFormularioRegalo();
    estado.regalos.push(g);
    guardar();
    actualizarContador();
    cerrar();
    aviso("Tu regalo ya está en el tatami. Gracias, " + g.de + ".");
    const indice = estado.regalos.length - 1;
    setTimeout(function () { Room.confetiEnRegalo(indice, 40); }, 80);
  }

  function copiarCodigoRegalo() {
    const g = leerFormularioRegalo();
    const codigo = aCodigo(g);
    const esWeb = location.protocol === "http:" || location.protocol === "https:";
    const texto = esWeb
      ? location.origin + location.pathname + "#regalo=" + codigo
      : codigo;
    copiarTexto(texto).then(function (ok) {
      if (ok) {
        aviso(esWeb ? "Enlace copiado. Envíaselo y el regalo aparecerá en su sala."
                    : "Código copiado. Envíaselo para que lo pegue en «Códigos y copia».");
      } else {
        $("#copia-texto").value = texto;
        cerrar();
        abrir("modal-datos");
        aviso("Copia a mano el texto del recuadro.");
      }
    });
  }

  /* ---------- la tarta ---------- */

  function abrirTarta() {
    borradorTarta = sanearTarta(estado.tarta);
    construir("#ch-pisos", [{ id: 1, nombre: "1" }, { id: 2, nombre: "2" }, { id: 3, nombre: "3" }],
      "ficha", borradorTarta.pisos, function (v) { borradorTarta.pisos = parseInt(v, 10); });
    construir("#sw-bizcocho", comoOpciones(CONFIG.coloresTarta), "color", borradorTarta.bizcocho,
      function (v) { borradorTarta.bizcocho = v; });
    construir("#sw-cobertura", comoOpciones(CONFIG.coloresTarta), "color", borradorTarta.cobertura,
      function (v) { borradorTarta.cobertura = v; });
    construir("#ch-topper", [
      { id: "luna", nombre: "Luna" },
      { id: "sakura", nombre: "Sakura" },
      { id: "corazon", nombre: "Corazón" },
      { id: "ninguno", nombre: "Ninguno" },
    ], "ficha", borradorTarta.topper, function (v) { borradorTarta.topper = v; });

    $("#tarta-velas").value = borradorTarta.velas;
    $("#velas-num").textContent = borradorTarta.velas;
    $("#tarta-chispas").checked = borradorTarta.chispas;
    abrir("modal-tarta");
  }

  function guardarTarta() {
    estado.tarta = sanearTarta(borradorTarta);
    guardar();
    Room.encenderVelas();
    $("#btn-soplar").textContent = "Soplar las velas";
    cerrar();
    aviso("La tarta ya está servida.");
  }

  /* ---------- la sala ---------- */

  function abrirSala() {
    construir("#ch-momento", [{ id: "noche", nombre: "Luna" }, { id: "alba", nombre: "Niebla" }],
      "ficha", estado.sala.momento, function (v) { estado.sala.momento = v; guardar(); });
    construir("#sw-pared", comoOpciones(CONFIG.coloresPared), "color", estado.sala.pared,
      function (v) { estado.sala.pared = v; guardar(); });
    construir("#sw-tatami", comoOpciones(CONFIG.coloresTatami), "color", estado.sala.tatami,
      function (v) { estado.sala.tatami = v; guardar(); });
    construir("#ch-faroles", [0, 1, 2, 3, 4].map(function (n) { return { id: n, nombre: String(n) }; }),
      "ficha", estado.sala.faroles, function (v) { estado.sala.faroles = parseInt(v, 10); guardar(); });
    $("#sala-mascota").checked = estado.sala.mascota;
    abrir("modal-sala");
  }

  /* ---------- lista y detalle ---------- */

  function actualizarContador() {
    $("#contador").textContent = String(estado.regalos.length);
  }

  function abrirLista() {
    const rejilla = $("#rejilla-regalos");
    rejilla.innerHTML = "";
    $("#lista-vacia").hidden = estado.regalos.length > 0;

    estado.regalos.forEach(function (g, i) {
      const tarjeta = document.createElement("button");
      tarjeta.type = "button";
      tarjeta.className = "regalo-tarjeta";

      const lienzo = document.createElement("canvas");
      lienzo.width = 52;
      lienzo.height = 46;
      tarjeta.appendChild(lienzo);

      const nombre = document.createElement("span");
      nombre.textContent = g.de;
      tarjeta.appendChild(nombre);

      tarjeta.addEventListener("click", function () { abrirDetalle(i); });
      rejilla.appendChild(tarjeta);
      Room.previaRegalo(lienzo.getContext("2d"), g);
    });

    abrir("modal-lista");
  }

  function abrirDetalle(indice) {
    const g = estado.regalos[indice];
    if (!g) return;
    detalleIndice = indice;
    $("#detalle-de").textContent = "De " + g.de;
    $("#detalle-cuando").textContent = new Date(g.fecha)
      .toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    $("#detalle-mensaje").textContent = g.mensaje || "Vino sin nota, pero con cariño.";
    cerrar();
    abrir("modal-detalle");
    Room.previaRegalo(ctxDetalle, g);
  }

  function quitarRegalo() {
    if (detalleIndice < 0) return;
    const g = estado.regalos[detalleIndice];
    if (!confirm("¿Quitar el regalo de " + g.de + "? No se puede deshacer.")) return;
    estado.regalos.splice(detalleIndice, 1);
    detalleIndice = -1;
    guardar();
    actualizarContador();
    cerrar();
    aviso("Regalo retirado.");
  }

  /* ---------- datos ---------- */

  function abrirDatos() {
    $("#copia-texto").value = JSON.stringify(estado);
    $("#codigo-entrada").value = "";
    abrir("modal-datos");
  }

  function anadirDesdeCodigo() {
    const texto = $("#codigo-entrada").value;
    if (!texto.trim()) { aviso("Pega primero un código."); return; }
    let g;
    try {
      g = sanearRegalo(deCodigo(texto));
    } catch (e) {
      aviso("Ese código no se ha podido leer. Revisa que esté completo.");
      return;
    }
    if (estado.regalos.some(function (r) { return r.id === g.id; })) {
      aviso("Ese regalo ya está en la sala.");
      return;
    }
    estado.regalos.push(g);
    guardar();
    actualizarContador();
    cerrar();
    aviso("Ha llegado un regalo de " + g.de + ".");
    setTimeout(function () { Room.confetiEnRegalo(estado.regalos.length - 1, 40); }, 80);
  }

  function restaurarCopia() {
    let datos;
    try {
      datos = JSON.parse($("#copia-texto").value);
    } catch (e) {
      aviso("Ese texto no es una copia válida.");
      return;
    }
    if (!confirm("Esto sustituye la sala actual. ¿Seguir?")) return;
    estado = {
      sala: sanearSala(datos.sala),
      tarta: sanearTarta(datos.tarta),
      regalos: Array.isArray(datos.regalos) ? datos.regalos.slice(0, 200).map(sanearRegalo) : [],
    };
    guardar();
    actualizarContador();
    cerrar();
    aviso("Sala restaurada.");
  }

  function vaciarSala() {
    if (!confirm("Se borran todos los regalos y la decoración. ¿Seguro?")) return;
    estado = estadoInicial();
    guardar();
    actualizarContador();
    Room.encenderVelas();
    cerrar();
    aviso("La sala vuelve a estar en silencio.");
  }

  /* ---------- clics dentro del lienzo ---------- */

  function clicEnSala(zona) {
    if (zona.id === "tarta") {
      abrirTarta();
    } else if (zona.id === "regalo") {
      abrirDetalle(zona.i);
    } else if (zona.id === "farol") {
      aviso("El farol se balancea y la llama se aviva.");
      Room.confeti(zona.x + zona.w / 2, zona.y + zona.h / 2, 18);
    } else if (zona.id === "gato") {
      aviso("Hola tita, soy el Puma. La Tania me ha traído a tu cumpleaños para que vigile tus regalos.");
      Room.confeti(zona.x + zona.w / 2, zona.y, 10);
    }
  }

  /* ---------- cabecera ---------- */

  function textoFecha() {
    const f = new Date(String(CONFIG.fecha) + "T00:00:00");
    if (isNaN(f.getTime())) return "";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((f - hoy) / 86400000);
    if (dias === 0) return "Hoy es el día";
    if (dias === 1) return "Falta 1 día";
    if (dias > 1) return "Faltan " + dias + " días";
    return f.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  function pintarCabecera() {
    document.title = CONFIG.titulo || "Sala de cumpleaños";
    $("#saludo").textContent = CONFIG.saludo;
    $("#subtitulo").textContent = CONFIG.subtitulo;
    const partes = [];
    if (CONFIG.edad) partes.push(CONFIG.edad + " años");
    const f = textoFecha();
    if (f) partes.push(f);
    $("#fecha").textContent = partes.join(" · ");
    $("#nota-texto").textContent = CONFIG.notaAnfitriona.texto;
    $("#nota-de").textContent = "— " + CONFIG.notaAnfitriona.de;
  }

  /* ---------- vistas previas animadas ---------- */

  function bucleVistas() {
    if (!$("#modal-regalo").hidden && borrador) {
      borrador.de = $("#reg-de").value;
      borrador.mensaje = $("#reg-mensaje").value;
      Room.previaRegalo(ctxPreviaRegalo, sanearRegalo(borrador));
    }
    if (!$("#modal-tarta").hidden && borradorTarta) {
      Room.previaTarta(ctxPreviaTarta, borradorTarta);
    }
    requestAnimationFrame(bucleVistas);
  }

  /* ---------- enlaces recibidos ---------- */

  function revisarEnlace() {
    if (location.hash.indexOf("regalo=") === -1) return;
    try {
      const g = sanearRegalo(deCodigo(location.hash));
      if (!estado.regalos.some(function (r) { return r.id === g.id; })) {
        estado.regalos.push(g);
        guardar();
        actualizarContador();
        setTimeout(function () {
          aviso("Ha llegado un regalo de " + g.de + ".");
          Room.confetiEnRegalo(estado.regalos.length - 1, 44);
        }, 400);
      }
    } catch (e) {
      aviso("El enlace traía un código que no se ha podido leer.");
    }
    history.replaceState(null, "", location.pathname + location.search);
  }

  /* ---------- arranque ---------- */

  function conectarEventos() {
    $("#btn-regalo").addEventListener("click", abrirRegalo);
    $("#btn-tarta").addEventListener("click", abrirTarta);
    $("#btn-sala").addEventListener("click", abrirSala);
    $("#btn-lista").addEventListener("click", abrirLista);
    $("#btn-nota").addEventListener("click", function () { abrir("modal-nota"); });
    $("#btn-datos").addEventListener("click", abrirDatos);
    $("#pie-datos").addEventListener("click", abrirDatos);

    $("#btn-soplar").addEventListener("click", function () {
      if (estado.tarta.velas === 0) {
        aviso("Primero ponle velas a la tarta.");
        return;
      }
      if (Room.velasEstanApagadas()) {
        Room.encenderVelas();
        this.textContent = "Soplar las velas";
      } else {
        Room.soplarVelas();
        this.textContent = "Encender las velas";
        aviso("Se apagan las velas. Pide un deseo.");
      }
    });

    $("#reg-dejar").addEventListener("click", dejarRegalo);
    $("#reg-codigo").addEventListener("click", copiarCodigoRegalo);

    $("#tarta-guardar").addEventListener("click", guardarTarta);
    $("#tarta-velas").addEventListener("input", function () {
      borradorTarta.velas = parseInt(this.value, 10);
      $("#velas-num").textContent = this.value;
    });
    $("#tarta-chispas").addEventListener("change", function () {
      borradorTarta.chispas = this.checked;
    });

    $("#sala-mascota").addEventListener("change", function () {
      estado.sala.mascota = this.checked;
      guardar();
    });

    $("#detalle-quitar").addEventListener("click", quitarRegalo);

    $("#codigo-anadir").addEventListener("click", anadirDesdeCodigo);
    $("#copia-restaurar").addEventListener("click", restaurarCopia);
    $("#copia-vaciar").addEventListener("click", vaciarSala);
    $("#copia-copiar").addEventListener("click", function () {
      copiarTexto($("#copia-texto").value).then(function (ok) {
        aviso(ok ? "Copia guardada en el portapapeles." : "Selecciona el texto y cópialo a mano.");
      });
    });

    $$("[data-cerrar]").forEach(function (b) { b.addEventListener("click", cerrar); });

    $$(".fondo").forEach(function (fondo) {
      fondo.addEventListener("click", function (ev) {
        if (ev.target === fondo) cerrar();
      });
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && hayVentanaAbierta()) cerrar();
    });
  }

  function iniciar() {
    estado = cargar();
    pintarCabecera();
    actualizarContador();

    ctxPreviaRegalo = $("#previa-regalo").getContext("2d");
    ctxPreviaTarta = $("#previa-tarta").getContext("2d");
    ctxDetalle = $("#detalle-canvas").getContext("2d");

    Room.init($("#sala"), function () { return estado; }, clicEnSala);
    conectarEventos();
    requestAnimationFrame(bucleVistas);
    revisarEnlace();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
