# Slice 0 — Especificación de implementación

Fecha: 2026-07-23
Estado: GO técnico validado
Alcance: autorización administrativa, workflow de galerías y consistencia de selección.

## 1. Objetivo

Cerrar los invariantes del flujo existente antes de separar `Account`, añadir
invitaciones o ampliar la UI administrativa.

Al terminar Slice 0:

- ninguna lectura o mutación admin consulta datos antes de autenticar;
- toda transición de galería pasa por una política de dominio única;
- una selección solo cambia mientras la galería está abierta;
- confirmar exige el número exacto de fotos cuando existe límite;
- confirmar es atómico e idempotente;
- estado, timestamp y evento se escriben en la misma transacción;
- la UI solo ofrece transiciones permitidas, sin ser la autoridad;
- los rechazos relevantes están cubiertos por pruebas.

Se conserva el monolito modular. Este slice no crea `apps/`, `packages/`,
`Account`, `Invitation`, `Delivery`, `AuditEvent`, S3 ni middleware global.

## 2. Decisiones canónicas

### Estados

No se renombra el enum Prisma:

```prisma
enum GalleryStatus {
  DRAFT
  EMAIL_SENT
  PROOFING
  SELECTION_CONFIRMED
  EDITING
  READY_FOR_DELIVERY
  DELIVERED
  ARCHIVED
}
```

| Estado | Semántica |
| --- | --- |
| `DRAFT` | Configuración interna; selección cerrada. |
| `EMAIL_SENT` | Enlace enviado; selección aún cerrada. |
| `PROOFING` | Selección y comentarios abiertos. |
| `SELECTION_CONFIRMED` | Selección cerrada e inmutable. |
| `EDITING` | Trabajo interno posterior. |
| `READY_FOR_DELIVERY` | Entrega publicada; exige URL. |
| `DELIVERED` | Entrega completada. |
| `ARCHIVED` | Terminal y no accesible por token. |

`expiresAt` sigue siendo una condición de acceso; no se añade `EXPIRED`.

### Transiciones

```ts
export const GALLERY_TRANSITIONS = {
  DRAFT: ["EMAIL_SENT", "PROOFING", "ARCHIVED"],
  EMAIL_SENT: ["PROOFING", "ARCHIVED"],
  PROOFING: ["SELECTION_CONFIRMED", "ARCHIVED"],
  SELECTION_CONFIRMED: ["EDITING", "ARCHIVED"],
  EDITING: ["READY_FOR_DELIVERY", "ARCHIVED"],
  READY_FOR_DELIVERY: ["DELIVERED", "EDITING", "ARCHIVED"],
  DELIVERED: ["ARCHIVED"],
  ARCHIVED: [],
} as const satisfies Record<GalleryStatus, readonly GalleryStatus[]>;
```

Decisiones:

- `READY_FOR_DELIVERY -> EDITING` permite retirar una entrega para corregirla.
- reabrir selección y desarchivar quedan fuera: requieren actor, motivo y una
  operación explícita;
- reenviar correo no debe degradar un estado avanzado a `EMAIL_SENT`;
- el primer envío solo acepta `DRAFT`;
- el reenvío solo acepta `EMAIL_SENT` o `PROOFING` y conserva el estado;
- desde `SELECTION_CONFIRMED` en adelante, incluido `ARCHIVED`, el correo de
  selección queda rechazado porque corresponde otra clase de comunicación.

### Capacidad del cliente

Solo `PROOFING` no expirada permite seleccionar, deseleccionar, comentar y
confirmar. El token válido no basta.

Regla de cantidad:

- sin límite: se exige al menos una foto;
- con límite: el total debe ser exactamente el límite;
- cero fotos nunca es confirmable.

Política de edición de `selectionLimit`:

- sin selecciones persistidas, puede editarse libremente;
- con selecciones persistidas, puede quitarse el límite o cambiarse a un valor
  igual o superior al total seleccionado;
- nunca puede reducirse por debajo del total seleccionado;
- desde `SELECTION_CONFIRMED` en adelante, incluido `ARCHIVED`, queda inmutable.

Segunda confirmación:

- devuelve éxito `already_confirmed`;
- conserva `selectionConfirmedAt`;
- no crea otro evento.

Una modificación posterior sí se rechaza.

### Concurrencia

Confirmación y mutación de selección deben tomar el mismo bloqueo de fila dentro
de una transacción interactiva PostgreSQL:

```ts
await tx.$queryRaw`
  SELECT id FROM "Gallery" WHERE id = ${galleryId} FOR UPDATE
`;
```

Después del bloqueo se vuelve a leer estado y selecciones con `tx`. Así una
confirmación concurrente no duplica eventos y una mutación no gana una carrera
después del cierre.

## 3. Archivos nuevos

### `src/modules/galleries/gallery-workflow.ts`

Política pura, sin Prisma IO ni Next.js:

```ts
export const GALLERY_TRANSITIONS: Readonly<
  Record<GalleryStatus, readonly GalleryStatus[]>
>;
export function allowedGalleryTransitions(current: GalleryStatus): readonly GalleryStatus[];
export function canTransitionGallery(current: GalleryStatus, next: GalleryStatus): boolean;
export function assertGalleryTransition(current: GalleryStatus, next: GalleryStatus): void;
export function isSelectionOpen(
  gallery: Pick<Gallery, "status" | "expiresAt">,
  now?: Date,
): boolean;
```

Guardar otros campos sin cambiar estado no es una transición.

### `src/modules/galleries/gallery.errors.ts`

```ts
export class GalleryNotFoundError extends Error {}
export class GalleryUnavailableError extends Error {}
export class InvalidGalleryTransitionError extends Error {}
export class SelectionClosedError extends Error {}
export class SelectionCountMismatchError extends Error {}
```

Los servicios no importan `NextResponse`; los Route Handlers traducen errores.

### `src/modules/galleries/gallery-workflow.test.ts`

Prueba la matriz completa, expiración y apertura de selección.

## 4. Cambios archivo por archivo

### Autorización admin

Archivos:

- `src/app/admin/page.tsx`
- `src/app/admin/clients/page.tsx`
- `src/app/admin/clients/new/page.tsx`
- `src/app/admin/clients/[id]/page.tsx`
- `src/app/admin/galleries/page.tsx`
- `src/app/admin/galleries/new/page.tsx`
- `src/app/admin/galleries/[id]/page.tsx`

Cada página llama `requireAdmin()` antes de su primera consulta. Cada Server
Action vuelve a llamarlo como primera operación:

```ts
async function update(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  await updateGalleryFromForm(id, formData, { actorId: admin.id });
}
```

Acciones inventariadas: crear/editar cliente, crear/editar/archivar galería,
importar fotos y enviar correo. Los exports TXT/CSV ya están protegidos y deben
seguir autenticando antes de leer.

`AdminShell` conserva su comprobación como defensa adicional, pero no protege por
sí solo la lectura de la página ni la invocación directa de una acción.

### `src/modules/galleries/gallery.service.ts`

Contratos:

```ts
type AdminActor = { actorId: string };

export async function updateGalleryFromForm(
  id: string,
  formData: FormData,
  actor: AdminActor,
): Promise<Gallery>;

export async function transitionGallery(
  id: string,
  next: GalleryStatus,
  actor: AdminActor,
): Promise<Gallery>;

export async function archiveGallery(
  id: string,
  actor: AdminActor,
): Promise<Gallery>;
```

Reglas:

- cargar primero la galería;
- guardar datos sin evento de transición si el estado no cambia;
- delegar todo cambio de estado a `transitionGallery`;
- `READY_FOR_DELIVERY` exige URL entrante o persistida;
- no cambiar `selectionLimit` desde `SELECTION_CONFIRMED` en adelante;
- evento con `actorId`, `fromStatus` y `toStatus`;
- retirar `markSelectionConfirmed` como operación independiente.

La confirmación completa vive en `selection.service.ts`.

### Repositorios

`gallery.repository.ts` y `selection.repository.ts` aceptan un cliente opcional:

```ts
type DbClient = Prisma.TransactionClient | typeof db;
```

Contratos necesarios:

```ts
findForUpdate(id: string, client?: DbClient): Promise<Gallery | null>;
update(id: string, data: Prisma.GalleryUncheckedUpdateInput, client?: DbClient): Promise<Gallery>;
event(data: GalleryEventInput, client?: DbClient): Promise<GalleryEvent>;
countSelected(galleryId: string, client?: DbClient): Promise<number>;
```

El servicio controla una única transacción; cada repositorio no abre la suya.

### `src/modules/selections/selection.service.ts`

```ts
export async function updateSelectionFromClient(
  accessToken: string,
  input: unknown,
): Promise<Selection>;

export type ConfirmSelectionResult = {
  galleryId: string;
  status: "confirmed" | "already_confirmed";
  selectedCount: number;
  confirmedAt: Date;
};

export async function confirmSelection(
  accessToken: string,
): Promise<ConfirmSelectionResult>;
```

`updateSelectionFromClient`:

1. valida input;
2. abre transacción y bloquea galería;
3. vuelve a leer estado, fotos y selecciones dentro de `tx`;
4. exige `PROOFING` no expirada;
5. valida pertenencia de `photoId`;
6. aplica límite excluyendo la foto actual;
7. hace `upsert` con `tx`.

`confirmSelection`:

1. abre transacción y bloquea por token;
2. rechaza inexistente, expirada o archivada;
3. devuelve `already_confirmed` si corresponde;
4. exige `PROOFING`;
5. cuenta selecciones dentro de `tx`;
6. aplica mínimo uno e igualdad exacta si hay límite;
7. actualiza estado y `selectionConfirmedAt`;
8. crea un evento con
   `{ actorType: "GALLERY_TOKEN", selectedCount, fromStatus, toStatus }`;
9. devuelve `confirmed`.

Nunca se almacena el token en eventos.

### Route Handlers

Archivos:

- `src/app/api/galleries/[token]/selection/route.ts`
- `src/app/api/galleries/[token]/confirm/route.ts`

| Caso | HTTP |
| --- | --- |
| éxito o idempotencia | `200` |
| input inválido | `400` |
| token inexistente | `404` |
| expirada/no disponible | `410` |
| estado cerrado o conteo incorrecto | `409` |
| inesperado | `500`, sin detalles internos |

Confirmar responde `status`, `selectedCount` y `confirmedAt`.

### UI de galería

En `src/app/g/[token]/page.tsx`, derivar `selectionOpen` en servidor y pasarlo a
`ClientGallery`; `alreadyConfirmed` no cubre `EDITING` o `DELIVERED`.

En `src/components/gallery/ClientGallery.tsx`:

- deshabilitar selección, comentarios y confirmación si está cerrada;
- habilitar confirmación solo si el conteo local cumple la regla;
- tratar servidor como autoridad;
- ante `409` o `410`, revertir el cambio optimista o refrescar;
- mantener mensajes seguros en español.

### UI admin

En `src/app/admin/galleries/[id]/page.tsx`:

- eliminar el `<select>` con `Object.values(GalleryStatus)`;
- mostrar solo `allowedGalleryTransitions(gallery.status)`;
- separar guardar datos de cambiar estado;
- ocultar o bloquear el límite después de confirmar;
- autenticar antes del `Promise.all` de repositorios.

### Correo e importación

`src/modules/mail/mail-workflow.ts` expresa la política pura mediante
`canSendInitialInvitation`, `canResendInvitation` y sus aserciones de dominio.
`src/modules/mail/mail.service.ts` expone operaciones separadas para primer envío
y reenvío, exige `actorId`, bloquea la galería y vuelve a validar el estado antes
del SMTP. El primer envío cambia `DRAFT -> EMAIL_SENT`; el reenvío conserva
`EMAIL_SENT` o `PROOFING`. Si SMTP falla, la transacción no escribe estado,
timestamp ni evento. Un éxito registra `GALLERY_EMAIL_SENT` o
`GALLERY_EMAIL_RESENT` con el actor administrativo. La entrega exactamente una
vez queda para el futuro módulo `Notification`.

`src/modules/photos/photo-import.service.ts` recibe `actorId` y lo registra en
`PHOTOS_IMPORTED`. La autorización sigue en el borde de la Server Action.
`ARCHIVED` rechaza la importación antes de leer el filesystem y vuelve a
comprobarse después del bloqueo antes de persistir.

## 5. Migración Prisma

Slice 0 amplía `GalleryEvent` de forma incremental:

```prisma
enum GalleryEventActorType {
  ADMIN
  GALLERY_TOKEN
  SYSTEM
}

model GalleryEvent {
  id        String                @id @default(cuid())
  galleryId String
  gallery   Gallery               @relation(fields: [galleryId], references: [id], onDelete: Cascade)
  type      String
  actorType GalleryEventActorType @default(SYSTEM)
  actorId   String?
  metadata  Json?
  createdAt DateTime              @default(now())

  @@index([galleryId, createdAt])
}
```

No editar migraciones aplicadas. Los eventos históricos quedan `SYSTEM` y sin
actor. `actorId` todavía no es foreign key porque el actor futuro puede ser
`User`, `Account`, token o proceso.

Nombre: `<timestamp>_harden_gallery_workflow`.

## 6. Pruebas requeridas

### Workflow

- acepta cada transición listada;
- rechaza cada combinación no listada;
- `ARCHIVED` no tiene salida;
- solo `PROOFING` no expirada abre selección;
- fecha igual o anterior a `now` está expirada.

### Galerías

- rechaza `DRAFT -> DELIVERED`;
- acepta `DRAFT -> PROOFING`;
- exige URL en `EDITING -> READY_FOR_DELIVERY`;
- registra actor y before/after;
- no crea evento si no cambia estado;
- impide cambiar límite después de confirmar;
- archivar usa la misma política.

### Selección

- token inexistente y galería expirada;
- estado distinto de `PROOFING`;
- foto de otra galería;
- seleccionar/desseleccionar bajo y al alcanzar límite;
- crear, editar y borrar comentario durante `PROOFING`;
- modificar después de confirmar;
- confirmar cero fotos, menos, más y exactamente el límite;
- confirmar dos veces sin cambiar timestamp ni duplicar evento;
- dos confirmaciones concurrentes producen un evento;
- una modificación concurrente no persiste después del cierre;
- dos selecciones concurrentes no superan `selectionLimit`;
- confirmación concurrente con archivo relee el estado persistido;
- confirmación concurrente con cambio de `expiresAt` relee la expiración;
- reintento posterior a un commit devuelve `already_confirmed`;
- confirmación y deselección concurrentes dejan un único resultado coherente;
- los rechazos concurrentes son errores de dominio, no errores Prisma.

Las dos últimas son pruebas de integración contra PostgreSQL; mocks unitarios no
demuestran `FOR UPDATE`.

### Correo

- `DRAFT` permite primer envío y cambia a `EMAIL_SENT`;
- el primer envío exitoso registra actor y `GALLERY_EMAIL_SENT`;
- fallo SMTP no cambia estado ni crea evento;
- `EMAIL_SENT` y `PROOFING` permiten reenvío sin cambiar estado;
- el reenvío registra `GALLERY_EMAIL_RESENT`;
- `ARCHIVED` rechaza primer envío y reenvío;
- los estados posteriores a `PROOFING` rechazan correo de selección;
- una invocación de primer envío contra `PROOFING` no puede degradar el estado.

### Autorización y HTTP

- página y acción autentican antes de consultar o mutar;
- sin cookie, la acción redirige a `/admin/login` y no invoca el servicio;
- errores de dominio se traducen a `404`, `409` y `410`;
- doble confirmación responde `200`;
- la UI no ofrece transiciones inválidas ni conserva un optimismo rechazado.

## 7. Orden de implementación

1. Errores y política pura con pruebas.
2. Actor de evento y migración Prisma.
3. Repositorios transaccionales y confirmación.
4. Bloqueo de mutaciones fuera de `PROOFING`.
5. `transitionGallery` y eliminación del selector libre.
6. Protección de lecturas y acciones admin.
7. Ajustes de correo, importación y eventos.
8. Route Handlers y UI.
9. Prueba PostgreSQL de concurrencia y validación completa.
10. Corregir solo el mojibake visible en archivos tocados.

## 8. Criterios de aceptación

- [x] Todas las páginas y acciones admin autentican antes de IO.
- [x] No existe selector libre de todos los estados.
- [x] Toda transición inválida falla en servidor.
- [x] Entrega lista sin URL falla en servidor.
- [x] Solo `PROOFING` admite cambios y confirmación.
- [x] Expirada, foto ajena y cambios posteriores se rechazan.
- [x] Límite exacto y mínimo de una foto se validan al confirmar.
- [x] Doble confirmación es idempotente.
- [x] Estado, timestamp y evento son atómicos.
- [x] Una carrera no deja cambios posteriores al cierre.
- [x] Eventos nuevos identifican tipo de actor sin guardar token.
- [x] Primer envío y reenvío aplican matrices distintas y nunca degradan estado.
- [x] Un fallo SMTP no persiste estado, timestamp ni evento.
- [x] Route Handlers no convierten todos los errores en `400`.
- [x] Pruebas, TypeScript, lint, Prisma y build pasan.

## 9. Validación final

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run lint
npm test -- --run
npx next build
git diff --check
```

Si aparece `EPERM` sobre `query_engine-windows.dll.node`, liberar el proceso que
mantiene el DLL y repetir el comando final. Una ejecución parcial no valida el slice.

## 10. Fuera de alcance

- separación `Client`/`Account`;
- invitaciones y sesiones persistentes;
- `GalleryAccessMode`;
- auditoría general;
- entrega versionada;
- colas/reintentos de correo;
- rate limit distribuido;
- adapter S3.

El siguiente slice es `Client -> Account -> Invitation -> login`, con migración
incremental de credenciales existentes.

## 11. Cierre técnico PR 6

Fecha de validación: 2026-07-25.
Veredicto: **GO técnico**.

- suite unitaria: 109/109;
- integración PostgreSQL aislada: 17/17;
- TypeScript estricto: aprobado;
- Prisma format, validate y generate: aprobados;
- ESLint: 0 errores, 8 advertencias preexistentes de `<img>`;
- build de producción: aprobado;
- nueve rutas administrativas anónimas: `307 -> /admin/login`;
- `git diff --check`: aprobado;
- auditoría de mutaciones y eventos exportados: sin bypass productivo.

El GO operativo sigue requiriendo SMTP real, una carpeta Lightroom
representativa y la pasada end-to-end indicada en la matriz manual.
