# Trashpanda Garage — Cierre de V1 y Hardening

**Fecha:** 2026-07-08
**Estado:** Aprobado para plan de implementación

## Contexto

Trashpanda Garage es una aplicación fullstack (Next.js App Router + TypeScript + Prisma/PostgreSQL) que funciona como:
1. Portafolio público (foto, props, FX, builds).
2. Sistema privado de selección de fotos para clientes vía link con token (`/g/[token]`).
3. Entrega final mediante link de Google Drive pegado manualmente por el admin.
4. Panel admin para gestionar clientes, galerías, fotos, selección y entrega.

El código base ya implementa ~90% de la especificación de V1 (ver `docs/superpowers/specs/` para la spec original completa provista por el usuario). Un gap-analysis exhaustivo identificó los puntos pendientes que este documento formaliza como el trabajo de cierre.

Modelo de datos, rutas, y flujo de estados (`DRAFT → EMAIL_SENT → PROOFING → SELECTION_CONFIRMED → EDITING → READY_FOR_DELIVERY → DELIVERED → ARCHIVED`) ya coinciden con la spec y no cambian en este ciclo.

## Alcance

Este ciclo cierra:
- Gaps funcionales concretos encontrados en el gap-analysis.
- Hallazgos de seguridad en código de aplicación.
- Hallazgos de seguridad/hardening de infraestructura (Docker/Compose).
- Componentización pendiente (extracción de componentes sugeridos por la spec original, hoy inline).
- Tests críticos de los flujos de negocio más frágiles.

Fuera de alcance (explícitamente no se toca en este ciclo): features nuevas de contenido (props/FX/builds reales), pagos, integración con Google Drive API, procesamiento de RAW, roles múltiples, cualquier ítem ya marcado "no implementar todavía" en la spec original.

## 1. Seguridad — código de aplicación

### 1.1 IDOR en `/api/photos/[id]`
**Problema:** el endpoint sirve cualquier foto por `id` sin validar sesión ni estado de la galería dueña. Un `photo.id` filtrado o enumerado permite ver fotos de galerías archivadas, expiradas, o de otro cliente.

**Fix:**
- Si existe una sesión admin válida (cookie verificada) → servir sin restricción adicional.
- Si no hay sesión admin → exigir un query param `token` que debe coincidir con el `accessToken` de la galería dueña de la foto, y la galería no debe estar `ARCHIVED` ni tener `expiresAt` vencido (mismo criterio ya usado en `src/app/g/[token]/page.tsx`).
- Actualizar `ClientGallery.tsx` (y su extracción a `PhotoCard`/`GalleryGrid`, ver sección 4) para incluir el `accessToken` de la galería en las URLs de imagen que genera.
- Cualquier request que falle la validación responde `404` (no `403`, para no confirmar existencia del recurso).

### 1.2 Cookie de sesión sin firmar
**Problema:** `src/lib/auth.ts` guarda `user.id` en texto plano en la cookie `tpg_admin`. `AUTH_SECRET` está declarado en `src/lib/env.ts` pero nunca se usa.

**Fix:** firmar el valor de la cookie con HMAC-SHA256 usando `AUTH_SECRET`, formato `"<userId>.<signature>"`. Al leer la cookie, recomputar la firma y comparar con `crypto.timingSafeEqual` antes de confiar en el `userId`. Sin librerías nuevas — usar el módulo `crypto` de Node.

### 1.3 Rate limiting en login
**Problema:** `src/app/admin/login/page.tsx` no limita intentos, vulnerable a fuerza bruta.

**Fix:** contador en memoria (Map keyed por IP) con ventana fija — ej. máximo 5 intentos fallidos por IP en 15 minutos, luego bloqueo temporal con mensaje de error. Justificación de "en memoria": el despliegue es un único servidor personal (no hay múltiples instancias que necesiten estado compartido), así que no se justifica una dependencia externa (Redis).

## 2. Seguridad — infraestructura

### 2.1 Dockerfile — usuario no-root
Agregar un usuario no privilegiado (`USER node`, ya disponible en la imagen base `node:22-alpine`) en el stage `runner`, con permisos ajustados sobre los archivos copiados.

### 2.2 docker-compose.yml — Postgres no expuesto
Quitar el mapeo `"5432:5432"`. El servicio `db` sigue accesible para `app` vía la red interna de Docker Compose (por nombre de servicio), pero deja de estar expuesto al host/público.

### 2.3 Migraciones versionadas en vez de `db push`
Reemplazar `npx prisma db push && npm run start` por `npx prisma migrate deploy && npm run start` en el comando de arranque del contenedor. Requiere generar la carpeta `prisma/migrations` inicial (vía `prisma migrate dev` en entorno de desarrollo) antes de aplicar este cambio, dado que hoy el proyecto no tiene migraciones versionadas.

## 3. Fixes funcionales

### 3.1 Asunto del correo
Corregir el asunto en `src/modules/mail/mail.service.ts` de `"Tu galeria esta lista - Trashpanda Garage"` a `"Tu galería está lista — Trashpanda Garage"` (tildes correctas + em dash `—`). Verificar que Nodemailer envíe con encoding UTF-8 explícito para que el asunto no se corrompa en el cliente de correo del destinatario.

### 3.2 Exportación de selección
- Agregar una variante `.csv` con columnas `filename,baseName,comment` (una fila por foto seleccionada).
- Corregir la variante `.txt` existente para incluir el `comment` de cada foto cuando exista (hoy solo lista `baseName`).
- Ambos formatos deben quedar disponibles desde el mismo botón/acción en el admin (ej. dos links o un selector de formato).

### 3.3 Guarda de negocio para `READY_FOR_DELIVERY`
En `src/modules/galleries/gallery.service.ts`, la transición de estado a `READY_FOR_DELIVERY` debe validar que `deliveryDriveUrl` no esté vacío/null antes de aceptar el cambio. Si falta, rechazar con un mensaje de error claro mostrado en la UI del admin (ej. "Agrega el link de entrega de Google Drive antes de marcar como lista para entrega").

### 3.4 Vista de historial de `GalleryEvent`
`GalleryEvent` ya se escribe correctamente (envío de correo, importación de fotos, cambios de estado, archivado, confirmación de selección) pero no hay UI para verlo. Agregar una sección de solo lectura en `admin/galleries/[id]` que liste los eventos de esa galería ordenados por fecha descendente, mostrando `type`, `createdAt`, y `metadata` (si existe, como JSON legible).

## 4. Componentización

Extraer sin cambiar comportamiento (refactor puro, sin lógica nueva) los componentes sugeridos por la spec original, hoy inline:

**Cliente** (hoy todo vive en `src/components/gallery/ClientGallery.tsx`):
- `GalleryGrid` — el grid de miniaturas.
- `PhotoCard` — cada tarjeta de foto individual (miniatura + estado + botón selección).
- `PhotoLightbox` — el overlay de preview a pantalla completa.
- `SelectionCounter` — contador de seleccionadas / límite.
- `PhotoCommentBox` — textarea de comentario por foto.
- `ConfirmSelectionButton` — botón de confirmar selección.
- `DeliveryDriveButton` — botón/link hacia Google Drive cuando está lista la entrega.

`ClientGallery.tsx` pasa a ser un componente contenedor que orquesta estado y composición de estos siete.

**Admin** (hoy inline en páginas bajo `src/app/admin/`):
- `AdminSidebar` — extraer de `AdminShell.tsx`.
- `GalleryTable` — tabla de listado en `admin/galleries/page.tsx`.
- `ClientTable` — tabla de listado en `admin/clients/page.tsx`.
- `GalleryPhotoManager` — grid de fotos de galería en `admin/galleries/[id]/page.tsx`.
- `SelectedPhotoList` — lista de seleccionadas con comentario, misma página.
- `SendGalleryEmailButton` — botón/form de enviar correo.
- `ExportSelectionButton` — botón(es) de exportación (ahora con soporte .txt/.csv, ver 3.2).
- Renombrar `StatusBadge` existente a `GalleryStatusBadge` para alinear el nombre con la spec (sin cambiar su comportamiento).

`AdminShell` ya existe y no cambia de responsabilidad, solo deja de contener el sidebar inline.

## 5. Testing (Vitest)

Setup mínimo de Vitest (config + scripts en `package.json`), enfocado en los flujos de negocio más frágiles — no se busca cobertura total:

1. **`selection.service.ts`** — lógica de límite de selección: bloquea al alcanzar `selectionLimit`, permite seleccionar tras deseleccionar otra foto, cuenta correctamente excluyendo la foto actual en edición.
2. **Acceso a galería (`/g/[token]` o su función de resolución subyacente)** — galería `ARCHIVED` o con `expiresAt` vencido no debe ser accesible.
3. **`/api/photos/[id]` (regresión del fix de IDOR, sección 1.1)** — sin sesión admin y sin `token` válido → rechazado (404); con `token` válido de una galería no archivada/no expirada → permitido; con sesión admin válida → permitido sin token.
4. **Transición a `READY_FOR_DELIVERY` (sección 3.3)** — rechazada si `deliveryDriveUrl` está vacío, aceptada si está presente.

## Fuera de alcance / decisiones explícitas

- No se cambia el modelo de datos Prisma (ya coincide con la spec).
- No se agrega `middleware.ts` — el guard vía `AdminShell` en cada página se mantiene tal cual, ya que cumple el criterio funcional.
- No se usa una librería de rate limiting externa ni Redis — justificado por ser despliegue de instancia única.
- No se implementa JWT completo para sesión admin — HMAC simple es suficiente para un solo rol.
- Componentización es refactor puro: ningún comportamiento visible debe cambiar para el usuario final.
