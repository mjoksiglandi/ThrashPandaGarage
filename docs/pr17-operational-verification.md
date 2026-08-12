# PR 17 — verificación operacional completa

Este escenario valida el producto desde navegador y correo de desarrollo. No
reemplaza los tests unitarios o PostgreSQL: cubre el recorrido que esos tests no
demuestran por sí solos.

## Alcance y seguridad de la fixture

`npm run db:fixtures:operational` sólo acepta una aplicación y base local
(`localhost`, `127.0.0.1` o el servicio Compose `db`) y rechaza
`NODE_ENV=production`. En cada ejecución reemplaza exclusivamente los cuatro
clientes con IDs `dev-*` propios de esta fixture. No borra clientes ni galerías
ajenos.

La fixture deja:

- `Cliente Demo`, correo `cliente.demo@trashpanda.test`, inicialmente sin
  cuenta para que el Flujo B pruebe la creación e invitación reales.
- `Sesión Demo`, 20 fotografías, límite 8, estado `PROOFING`, token vigente.
- `Cliente Seguridad B` con cuenta activa y galería propia para comprobar el
  aislamiento A/B.
- galerías cerrada y expirada, más invitación y recovery expirados.
- 20 copias controladas de imágenes versionadas bajo
  `<PHOTO_STORAGE_ROOT>/dev-fixtures/session-demo`; nunca usa una carpeta de
  sesión real.

Al terminar el Flujo B, `cliente.demo@trashpanda.test` queda como la cuenta
válida del escenario.

## Preparación

1. En `.env`, usa una base PostgreSQL local, `APP_BASE_URL=http://localhost:3000`,
   `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_USER=` y `SMTP_PASS=`. Define
   además `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` y un
   `PHOTO_STORAGE_ROOT` local.
2. Inicia dependencias y aplica migraciones:

   ```powershell
   docker compose up -d db mailpit
   npx prisma migrate deploy
   npm run db:fixtures:operational
   npm run dev
   ```

3. Abre dos pestañas: `http://localhost:3000/admin/login` y
   `http://localhost:8025`.
4. Mantén una ventana normal para admin y una ventana incógnita para cliente,
   de modo que las cookies no se mezclen.

Cada repetición comienza volviendo a ejecutar la fixture. Esa acción reinicia
sólo los registros `dev-*` y vuelve a dejar `Sesión Demo` abierta y sin
selecciones.

## Flujo A — token

1. Ingresa como admin y abre `Galerías → Sesión Demo`.
2. Comprueba: 20 fotos, límite 8, estado `Selección abierta` y acceso vigente.
3. Pulsa **Reenviar invitación**. La fixture parte en `PROOFING`, por eso se
   prueba el reenvío permitido en una galería ya abierta.
4. En Mailpit abre el correo de `cliente.demo@trashpanda.test` y sigue el enlace
   `/g/<token>` en la ventana cliente.
5. Selecciona exactamente 8 fotos y agrega al menos un comentario.
6. Antes de confirmar, abre DevTools en esa misma pestaña y ejecuta:

   ```js
   await fetch("/api/galleries/dev-gallery-token-a-000000000000000000000/selection", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ photoId: "dev-photo-a-09", selected: true })
   }).then(async response => ({ status: response.status, body: await response.json() }))
   ```

   Resultado esperado: `409`; la novena selección no se guarda.
7. Confirma. La UI muestra 8 seleccionadas y el admin muestra
   `SELECTION_CONFIRMED`, ocho selecciones y el comentario.

## Flujo B — cuenta

1. En admin abre `Clientes → Cliente Demo` y pulsa **Crear cuenta e invitar**.
2. En Mailpit abre `Activa tu cuenta` y sigue el enlace en la ventana cliente.
3. Define una contraseña válida. La página termina en la confirmación de cuenta
   activada sin conservar el token en la URL.
4. Abre `/login`, ingresa como `cliente.demo@trashpanda.test` y usa la contraseña
   recién definida.
5. En `/portal` abre `Sesión Demo`. Debe verse la selección confirmada del Flujo
   A, sin controles para modificarla.

## Flujo C — entrega

1. En admin abre `Sesión Demo` y cambia
   `SELECTION_CONFIRMED → EDITING`.
2. Guarda una URL HTTPS controlada en **Enlace de entrega en Drive**; para la
   prueba local puede usarse `https://drive.google.com/`.
3. Cambia `EDITING → READY_FOR_DELIVERY`. El paso `EDITING` es obligatorio por
   la máquina de estados del producto.
4. Recarga la galería desde el portal de cliente y comprueba el botón
   **Ver entrega en Google Drive**.
5. En admin cambia `READY_FOR_DELIVERY → DELIVERED`; el enlace continúa visible
   para el cliente y el estado del portal cambia a entregada.

## Flujo D — seguridad básica

Ejecuta estas comprobaciones desde la ventana cliente. Los `fetch` se hacen en
DevTools del navegador; no requieren clientes HTTP externos.

### Aislamiento Account/Client

Con la sesión de `cliente.demo@trashpanda.test`, abre
`/portal/galleries/dev-gallery-security-b`. Resultado: `404`; no se renderiza
ningún dato de Cliente B.

Luego prueba una foto externa:

```js
await fetch("/api/portal/galleries/dev-gallery-session-demo-a/photos/dev-photo-b-01/selection", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ selected: true })
}).then(async response => ({ status: response.status, body: await response.json() }))
```

Resultado: `404`.

### Aislamiento por token

Abre una pestaña sin sesión de admin y ejecuta:

```js
await fetch("/api/galleries/dev-gallery-token-a-000000000000000000000/selection", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ photoId: "dev-photo-b-01", selected: true })
}).then(async response => ({ status: response.status, body: await response.json() }))
```

Resultado: `404`; Token A no selecciona ni revela la foto de Gallery B.

### Galería cerrada

```js
await fetch("/api/galleries/dev-gallery-token-closed-0000000000000000/selection", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ photoId: "dev-photo-closed-01", selected: true })
}).then(async response => ({ status: response.status, body: await response.json() }))
```

Resultado: `410`; la selección permanece sin cambios.

### Sesión revocada

1. Con la cuenta A autenticada abre `/portal/sessions`.
2. Revoca la sesión actual.
3. Intenta volver a `/portal`. Resultado: redirección a `/login`; la cookie
   anterior no recupera acceso.

### Vencimientos

En Mailpit abre, uno por uno, los mensajes con prefijo `[Fixture]`:

- `Token de galería expirado`: el enlace termina en `404` y no muestra fotos.
- `Invitación expirada`: el intento entrega el mismo resultado público genérico
  que cualquier invitación no utilizable y no activa la cuenta.
- `Recovery expirado`: no permite cambiar la contraseña ni iniciar sesión con
  el valor intentado.

## Criterio GO

El PR queda en GO operacional sólo cuando A, B, C y todas las comprobaciones de
D pasan en una misma ejecución local usando las dos UIs (`:3000` y `:8025`).
Una suite automatizada verde, el envío SMTP simulado en tests o la sola creación
de fixtures no sustituyen esta evidencia.
