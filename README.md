# Sala de cumpleaños

Una página interactiva que dibuja una sala en pixel art donde la gente puede dejar
regalos, envolverlos a su gusto y decorar la tarta.

La ambientación es cálida pero oscura, entre lo gótico y lo japonés: ventanal de
arco *katōmado* con la luna y una rama de sakura, faroles *chōchin* colgados,
una cuerda con tiras de papel *shide*, un rollo *kakejiku* con su ensō a tinta,
tatami con ribete de brocado, incensario humeante y un gato negro con cascabel.

Todo el dibujo se genera por código sobre un `<canvas>`: no hay ni una sola imagen
en el repositorio. Funciona sin servidor, sin frameworks y sin instalar nada.

---

## 1. Abrirlo en Visual Studio Code

1. Descomprime la carpeta `sala-de-cumple` donde quieras tenerla.
2. En VS Code: **Archivo → Abrir carpeta…** y elige `sala-de-cumple`.
3. Para verla mientras la editas, instala la extensión **Live Server**
   (de Ritwick Dey). VS Code te la sugerirá sola al abrir el proyecto.
4. Clic derecho sobre `index.html` → **Open with Live Server**.
   Se abre en el navegador y se recarga cada vez que guardas.

Sin Live Server también funciona: basta con abrir `index.html` haciendo doble clic.
La única diferencia es que no se recarga sola al guardar.

---

## 2. Personalizarla

Abre `js/config.js`. Es el único archivo que necesitas tocar:

```js
nombre: "Lucía",
saludo: "¡Feliz cumple, Lucía!",
fecha: "2026-10-04",
```

Ahí dentro están también el texto de la nota, los colores que podrá elegir quien
envuelva un regalo y cómo empieza la sala: luz de luna o de niebla, cuántos
faroles cuelgan, el color del tatami y si está el gato. Guarda y recarga.

Los estampados del papel son tres clásicos japoneses —*asanoha* (hoja de cáñamo),
*seigaiha* (olas) y *kikkō* (panal de tortuga)— más liso y rayas. Los remates del
cordón son *mizuhiki*, luna y sakura.

---

## 3. Subirla a GitHub

Primero crea el repositorio vacío en [github.com/new](https://github.com/new).
Ponle un nombre (por ejemplo `sala-de-cumple`) y **no marques** la casilla de
añadir un README: ya tienes uno y se estorbarían.

Después, en el terminal de VS Code (**Terminal → Nuevo terminal**), dentro de la
carpeta del proyecto:

```bash
git init
git add .
git commit -m "Primera versión de la sala"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/sala-de-cumple.git
git push -u origin main
```

Cambia `TU-USUARIO` por tu nombre de usuario de GitHub. La primera vez te pedirá
iniciar sesión; acepta la ventana que abre VS Code.

A partir de ahí, cada vez que cambies algo:

```bash
git add .
git commit -m "Describe lo que has cambiado"
git push
```

> Si prefieres no usar el terminal, el panel **Control de código fuente** de VS Code
> (el icono de las tres ramas) hace lo mismo con botones.

---

## 4. Publicarla para que tu amiga la vea

GitHub puede servir la página gratis:

1. En tu repositorio, entra en **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**.
3. Rama `main`, carpeta `/ (root)`. Guarda.
4. Al cabo de un minuto estará en
   `https://TU-USUARIO.github.io/sala-de-cumple/`

Ese enlace es el que le mandas.

---

## 5. Cómo llegan los regalos de otras personas

Esto conviene entenderlo antes de repartir el enlace.

GitHub Pages sirve archivos, pero no guarda datos. Cada persona que abre la página
tiene **su propia sala**, guardada en su navegador. Si tu amiga entra desde su móvil,
ve la suya, no la tuya.

Para que los regalos lleguen de verdad, la página usa códigos:

1. Tu amiga entra, pulsa **Dejar un regalo**, lo envuelve y pulsa
   **Copiar código para enviar**.
2. Te pasa ese enlace (o ese texto) por donde sea.
3. La cumpleañera lo abre: si es un enlace, el regalo aparece solo. Si es un texto,
   lo pega en **Códigos y copia → Añadir a la sala**.

Así el regalo queda en la sala de ella, con su mensaje y su envoltorio.

**Consejo:** recoge tú todos los códigos antes del día, móntale la sala completa
en un navegador y usa **Códigos y copia → Copiar** para guardarte una copia de
seguridad. Si algo se borra, la restauras pegando ese texto.

Si algún día quieres que los regalos se compartan solos entre todos, hace falta una
base de datos (Firebase o Supabase tienen plan gratuito). Eso ya no puede vivir solo
en GitHub Pages, pero el resto del código te valdría igual.

---

## 6. Qué hay en cada archivo

```
sala-de-cumple/
├── index.html      La página y las ventanas de personalización
├── css/style.css   Colores, tipografías y componentes
├── js/config.js    ← lo que tú editas: nombre, fecha, textos, paletas
├── js/room.js      Dibuja la sala píxel a píxel y anima globos y velas
└── js/app.js       Estado, guardado en el navegador y códigos de regalo
```

El lienzo mide 256×160 píxeles de verdad y luego se amplía a números enteros, que
es lo que mantiene los bordes limpios en vez de borrosos.

Las tipografías son Shippori Mincho para los títulos y DotGothic16 para el resto,
ambas japonesas.

---

## 7. Ideas para seguir

- Añadir más piezas en `room.js`: un biombo, un brasero, un jarrón *ikebana*.
- Un botón de música con un `<audio>`: un *shakuhachi* o lluvia de fondo encaja.
- Que al abrir un regalo caigan pétalos de los colores de ese envoltorio.
- Cambiar los pétalos de sakura por nieve o por luciérnagas según la estación.

Las tipografías vienen de Google Fonts, así que hace falta conexión para que se vean
como están pensadas. Sin conexión la página funciona igual, solo cambia la letra.
