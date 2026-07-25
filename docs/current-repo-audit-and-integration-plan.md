# Auditoría actual e integración del handoff

Fecha: 2026-07-23  
Alcance: estado real del checkout y contraste con `mocks/trashpanda-garage-handoff-completo`.

## Resumen ejecutivo

Trashpanda Garage no es actualmente un monorepo. Es un monolito modular de Next.js 16 con App Router, React 19, TypeScript, Prisma 6 y PostgreSQL. Esta forma sigue siendo adecuada para el MVP: no conviene crear `apps/` y `packages/` antes de que exista un segundo consumidor real.

La aplicación ya contiene un flujo vertical parcial y usable:

1. el administrador crea clientes y galerías;
2. importa thumbnails y previews desde el filesystem;
3. comparte una galería mediante un token o correo;
4. el cliente selecciona, comenta y confirma;
5. el administrador exporta la selección y publica un enlace externo de entrega;
6. algunos cambios quedan en `GalleryEvent`.

Los mocks son una referencia visual y funcional, no código para portar. El mayor desfase no es visual: faltan límites de dominio y persistencia para cuentas, invitaciones, transiciones, sesiones, administración de fotos, entregas y auditoría.

**Decisión de arquitectura:** continuar como monolito modular dentro de `src/modules`. No migrar ahora a `apps/web` + `packages/*`.

**Go/no-go:**

- **GO para desarrollo del MVP y demo local:** tests, TypeScript y lint están sanos.
- **NO-GO para producción con clientes reales:** antes deben cerrarse autorización de mutaciones, confirmación/bloqueo de selección, migraciones incrementales, cuentas/invitaciones y almacenamiento/operación de producción.

## 1. Arquitectura actual

| Área | Estado real |
| --- | --- |
| Aplicación | Una sola app Next.js `trashpanda-garage`; no existen `apps/` ni `packages/`. |
| Framework | Next.js `^16.2.10`, React `^19.2.1`, App Router en `src/app`. |
| UI | Tailwind v4 y CSS global; componentes propios. No hay shadcn/ui ni Framer Motion. |
| Autenticación admin | `User` + bcrypt + cookie HTTP-only firmada por HMAC, 7 días. |
| Autenticación cliente | `Client.passwordHash` + cookie HTTP-only firmada, 30 días. También existe acceso directo por token de galería. |
| Autorización | `AdminShell` y `requireClient` protegen renderizado; no hay `middleware.ts`. Las galerías y fotos usan token. |
| Datos | Prisma 6 + PostgreSQL. Modelos: `User`, `Client`, `Gallery`, `Photo`, `Selection`, `GalleryEvent`. |
| Storage | Filesystem bajo `PHOTO_STORAGE_ROOT`; importa thumbs/previews y los sirve por API después de validar admin o token. |
| Correo | Nodemailer/SMTP para un correo de galería en texto plano. |
| API | Route Handlers para fotos, selección, confirmación, exports y sesiones públicas. |
| Escrituras admin | Server Actions declaradas dentro de páginas. |
| Despliegue | Dockerfile multi-stage + Compose con app, PostgreSQL y bind mount de Lightroom. |
| Calidad comprobada | 34/34 tests, TypeScript limpio, ESLint con 0 errores y 8 warnings de `<img>`. |

### Límites de módulos existentes

Ya existen:

- `clients`
- `galleries`
- `photos`
- `selections`
- `mail`
- `storage`

Existen como infraestructura en `src/lib`, pero todavía no como módulos completos:

- `auth`
- `public-sessions`

No existen como dominio persistente:

- `accounts`
- `invitations`
- `deliveries`
- `notifications`
- `audit` general
- `settings`

### Acoplamientos relevantes

- Las páginas admin consultan repositorios antes de que `AdminShell` ejecute `requireAdmin`.
- Las mutaciones admin viven como Server Actions en páginas y no vuelven a comprobar `requireAdmin` dentro de cada acción.
- `Client` mezcla perfil de contacto, credenciales y cuenta de acceso.
- `Gallery` mezcla workflow, storage local, publicación, correo y entrega.
- `GalleryEvent.type` es texto libre y solo audita galerías; no identifica actor ni transición anterior/nueva.
- El token de galería funciona a la vez como publicación, autorización de lectura y autorización de mutación.

## 2. Mapa de rutas actual

### Públicas

| Ruta | Función |
| --- | --- |
| `/` | Home/portfolio |
| `/about` | About |
| `/services` | Servicios |
| `/contact` | Contacto |
| `/work` | Portfolio |
| `/work/photo` | Categoría de fotografía |
| `/sessions` | Sesiones públicas leídas desde filesystem |
| `/sessions/[slug]` | Detalle de sesión pública |
| `/api/public-sessions/[slug]/[folder]/[filename]` | Imagen de sesión pública |

### Cliente

| Ruta | Función | Protección |
| --- | --- | --- |
| `/portal/login` | Login por email/contraseña o código | Pública |
| `/portal` | Lista de galerías del cliente | Cookie cliente |
| `/g/[token]` | Selección y entrega de una galería | Token |
| `/api/galleries/[token]/selection` | Seleccionar/comentar | Token |
| `/api/galleries/[token]/confirm` | Confirmar selección | Token |
| `/api/photos/[id]` | Thumb/preview | Cookie admin o token |

### Administración

| Ruta | Función |
| --- | --- |
| `/admin/login` | Login admin |
| `/admin` | Dashboard básico |
| `/admin/clients` | Lista de clientes |
| `/admin/clients/new` | Crear cliente |
| `/admin/clients/[id]` | Editar cliente y contraseña |
| `/admin/galleries` | Lista de galerías |
| `/admin/galleries/new` | Crear galería |
| `/admin/galleries/[id]` | Datos, importación, correo, export, fotos e historial |
| `/admin/galleries/[id]/export` | TXT |
| `/admin/galleries/[id]/export/csv` | CSV |

## 3. Modelo de datos y brechas frente al handoff

| Concepto objetivo | Soporte actual | Brecha |
| --- | --- | --- |
| Cliente | `Client` | Falta estado, archivado, campos de contacto separados y reglas de ciclo de vida. |
| Cuenta | Embebida en `Client.passwordHash` | Debe separarse de cliente; faltan email de acceso, estado, intentos fallidos, bloqueo y sesiones. |
| Invitación | No existe | Faltan token hasheado, expiración, consumo único, reenvío, revocación y estado. |
| Galería | `Gallery` | El enum actual tiene 8 estados frente a 6 del handoff; falta una máquina de transiciones y definición canónica. |
| Foto | `Photo` | Faltan visibilidad/soft delete, portada, flags acumulables, estado de procesamiento y operaciones masivas. |
| Selección | `Selection` por foto | La confirmación no exige límite exacto, no es transaccional, admite doble confirmación y no bloquea cambios posteriores. |
| Entrega | Campos URL/fecha en `Gallery` | Falta entidad/publicación, expiración propia, evento de apertura/descarga y versionado mínimo. |
| Notificación | Envío SMTP directo | Falta registro, estado, retry, plantilla e idempotencia. Los rebotes pueden postergarse. |
| Auditoría | `GalleryEvent` | Falta actor, ámbito, entidad, before/after, cliente/cuenta y eventos de acceso/entrega. |
| Settings | Variables de entorno | Suficiente para MVP; no crear tabla hasta necesitar configuración editable. |

### Inconsistencias funcionales prioritarias

1. **Confirmación incompleta.** `confirmSelection` cambia el estado sin comprobar que el total sea exactamente el límite.
2. **Selección no bloqueada.** Después de confirmar, el endpoint todavía permite seleccionar, deseleccionar o comentar.
3. **Transiciones libres.** El admin puede saltar a cualquier `GalleryStatus` desde un `<select>`.
4. **Autorización admin demasiado implícita.** La protección ocurre al renderizar `AdminShell`, no en cada mutación.
5. **Token con demasiadas responsabilidades.** Quien posee el token puede leer fotos, modificar y confirmar; no hay vínculo obligatorio con la cuenta autenticada.
6. **Rate limit solo en memoria.** Se reinicia con el proceso y no funciona de forma coordinada con múltiples instancias.
7. **Cuenta y cliente son la misma fila.** Impide representar fielmente `no_access`, `inactive`, `deactivated`, `blocked` y `archived`.
8. **Correo no es invitación.** El correo actual comparte directamente la galería; no crea una cuenta ni consume un token de registro.
9. **Importación parcial.** Solo upsert; no modela upload/procesamiento/error, ocultar, portada, reordenamiento persistente ni soft delete.
10. **Texto mojibake.** Hay strings versionados con caracteres mal decodificados; debe corregirse de forma acotada antes de tomar capturas o enviar correos reales.

## 4. Plan de migraciones

No reescribir la migración existente si ya fue aplicada. Crear migraciones incrementales pequeñas y respaldar la base antes de la migración que separe cuentas.

### M0 — Baseline y seguridad de ejecución

- Confirmar en cada ambiente qué migraciones están aplicadas.
- Adoptar `prisma migrate dev` en desarrollo y `prisma migrate deploy` en runtime.
- Añadir índices y restricciones que no destruyan datos:
  - email normalizado/único donde aplique;
  - `Gallery.slug` según la política elegida;
  - índices para `Gallery.clientId/status`, `Photo.galleryId/sortOrder` y eventos por fecha.

### M1 — Reglas de galería y selección

- Elegir y documentar el enum canónico de galería.
- Añadir campos de publicación/confirmación que permitan idempotencia.
- Mantener `Selection`, pero confirmar en una transacción que:
  - la galería está abierta;
  - el actor tiene acceso;
  - el conteo satisface la regla;
  - no fue confirmada;
  - se registra el evento.

Esta fase puede implementarse sin cambiar todavía la autenticación del cliente.

### M2 — Cuenta separada

Crear `Account` con relación opcional 1:1 a `Client`:

- `id`, `clientId`, `loginEmail`, `passwordHash`;
- `status`;
- `failedLoginCount`, `lockedAt`;
- `activatedAt`, `deactivatedAt`, timestamps.

Migrar `Client.passwordHash` y email a `Account` solo para clientes que ya tengan credenciales. Durante una versión de transición se puede leer el modelo nuevo y mantener compatibilidad controlada; después eliminar `Client.passwordHash`.

### M3 — Invitaciones y sesiones

Crear:

- `Invitation`: `accountId`, `tokenHash`, estado, `expiresAt`, `openedAt`, `acceptedAt`, `revokedAt`, timestamps de envío.
- `AccountSession`: identificador opaco hasheado, expiración, revocación y metadatos mínimos.

Nunca almacenar tokens de invitación o sesión en claro. El token se muestra/envía una vez y se persiste solo su hash.

### M4 — Administración de fotos

Extender `Photo` con:

- `isVisible`, `deletedAt`, `isCover`;
- estado de procesamiento separado del estado editorial;
- datos de archivo suficientes para storage futuro.

Mantener el filesystem como adapter inicial. No introducir S3 hasta decidir el ambiente de producción.

### M5 — Entrega, notificación y auditoría

Crear:

- `Delivery`: galería, URL externa, publicación, expiración y aperturas.
- `Notification`: tipo, destinatario, proveedor, estado, intentos y error seguro.
- `AuditEvent`: actor, acción, entidad, entidadId, before/after seguro y fecha.

Los eventos no deben guardar contraseñas, tokens, URLs firmadas ni datos sensibles innecesarios.

## 5. Backlog por vertical slice

### Slice 0 — Cerrar invariantes antes de ampliar UI

Objetivo: hacer confiable lo que ya existe.

Especificación implementable: [`slice-0-implementation-spec.md`](slice-0-implementation-spec.md).

- [ ] Exigir admin dentro de cada Server Action y proteger lecturas antes de consultar datos.
- [ ] Centralizar transiciones permitidas de galería.
- [ ] Confirmación idempotente y transaccional.
- [ ] Exigir límite exacto cuando exista.
- [ ] Bloquear selección/comentarios después de confirmar.
- [ ] Añadir pruebas de concurrencia lógica, doble confirmación, propiedad y expiración.
- [ ] Resolver mojibake visible.

### Slice 1 — Cliente → cuenta → invitación → login

- [ ] Crear/editar cliente sin obligar cuenta.
- [ ] Crear cuenta separada.
- [ ] Enviar invitación simple con expiración.
- [ ] Aceptar invitación y definir contraseña.
- [ ] Iniciar/cerrar sesión.
- [ ] Mostrar estados `no_access`, `inactive`, `active`, `deactivated` y `blocked`.
- [ ] Auditoría mínima de creación, invitación, aceptación y estado.

**Postergar:** contraseña temporal administrativa, sesiones por dispositivo, rebotes automáticos y múltiples plantillas.

### Slice 2 — Galería publicada en portal

- [ ] Crear galería asociada a cliente.
- [ ] Configurar límite y expiración.
- [ ] Publicar mediante transición válida.
- [ ] Autorizar acceso por cuenta/propiedad.
- [ ] Mantener código/token como acceso explícito opcional, con permisos definidos.
- [ ] Mostrar dashboard, vacío, no autorizado y expirada según los mocks.

### Slice 3 — Fotografías

- [ ] Importar previews desde el storage actual.
- [ ] Mostrar progreso/errores de importación.
- [ ] Reordenar y persistir.
- [ ] Ocultar/mostrar.
- [ ] Elegir una portada única.
- [ ] Soft delete.
- [ ] Operaciones masivas mínimas.

**Postergar:** carga directa cloud y pipeline distribuido hasta definir hosting/storage.

### Slice 4 — Selección

- [ ] Filtros todas/seleccionadas/sin seleccionar.
- [ ] Contador y barra.
- [ ] Lightbox navegable con posición.
- [ ] Confirmación irreversible con consecuencias.
- [ ] Bloqueo posterior.
- [ ] Export TXT/CSV usando una misma consulta.
- [ ] Estado confirmado en portal y admin.

### Slice 5 — Edición y entrega

- [ ] Cambiar de confirmada a edición mediante transición.
- [ ] Timeline sin porcentajes.
- [ ] Configurar enlace y expiración de entrega.
- [ ] Publicar y notificar.
- [ ] Registrar apertura.
- [ ] Archivar con precondiciones.

### Slice 6 — Hardening

- [ ] Rate limiting compartido o persistente.
- [ ] Sesiones revocables.
- [ ] Auditoría general con actor.
- [ ] Errores consistentes y observabilidad.
- [ ] Pruebas end-to-end de los cinco flujos.
- [ ] Revisión de accesibilidad y responsive contra mockups.

## 6. Reutilización recomendada

Conservar:

- el monolito modular y la dirección `app/components → modules → repositories/db`;
- Prisma/PostgreSQL;
- servicios y repositorios actuales como punto de partida;
- adapter de filesystem y ruta protegida de imágenes;
- componentes públicos ya construidos;
- export TXT/CSV;
- cookies HTTP-only firmadas mientras se introduce una sesión revocable;
- tokens visuales del handoff en el CSS existente.

Refactorizar solo cuando llegue su slice:

- `Client.passwordHash` hacia `Account`;
- `GalleryEvent` hacia auditoría general;
- campos de entrega de `Gallery` hacia `Delivery`;
- envío SMTP directo hacia `Notification`.

No crear todavía:

- workspaces `apps/*` o `packages/*`;
- microservicios;
- un design system publicado;
- abstracción multi-storage sin un segundo backend;
- colas, webhooks o eventos distribuidos para el MVP.

## 7. Despliegue actual

El repositorio incluye una intención de despliegue local:

- build multi-stage en Node 22 Alpine;
- proceso final no-root;
- PostgreSQL 16 en Compose;
- migraciones con `prisma migrate deploy`;
- volumen `D:/Lightroom/revelado/web:/data/photos`.

No se detectó un runtime activo el 2026-07-23:

- no hay listener en el puerto 3000;
- Docker no está disponible en el entorno actual;
- no hay remote Git configurado;
- no existe configuración de CI/CD ni manifiesto de hosting.

Bloqueadores para producción:

1. autorización e invariantes del Slice 0;
2. ambiente de despliegue y dominio HTTPS;
3. PostgreSQL administrado o estrategia de backup;
4. storage persistente accesible desde el host de producción;
5. secretos fuera del repositorio;
6. migraciones probadas sobre una copia de datos;
7. SMTP/proveedor y observabilidad;
8. política de recuperación y backups.

El bind mount de Lightroom es válido para operación local en esta máquina, pero no es por sí solo una estrategia portable de producción.

## 8. Criterio de terminado por pantalla

Cada pantalla del handoff se implementa solo cuando existan:

1. entidad y reglas;
2. schema y migración;
3. servicio de dominio;
4. autorización explícita;
5. Server Action o Route Handler;
6. interfaz real, sin botones simulados;
7. loading, vacío y error;
8. evento de auditoría mínimo;
9. prueba de regla y prueba del flujo crítico.

La primera implementación recomendada es **Slice 0**, seguida de **Slice 1**. Construir primero el panel visual completo dejaría activos flujos que el modelo actual todavía no puede garantizar.
