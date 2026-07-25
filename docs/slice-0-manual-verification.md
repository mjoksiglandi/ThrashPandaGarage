# Matriz de verificación manual — Slice 0

Ejecutar sobre una galería y un cliente de prueba. Confirmar también en `GalleryEvent`
que las operaciones administrativas registran `actorType=ADMIN` y el `actorId`
del administrador autenticado.

| Escenario | Resultado esperado |
| --- | --- |
| Admin sin cookie abre una página administrativa | Redirección a `/admin/login`; no se consulta información administrativa |
| Admin sin cookie invoca una Server Action | Redirección a `/admin/login`; no ocurre ninguna mutación |
| Galería `PROOFING` vigente | Puede seleccionar, comentar y confirmar |
| Galería `PROOFING` expirada | HTTP 410 |
| Galería `SELECTION_CONFIRMED` | Lectura permitida; selección y comentarios rechazados |
| Galería `EDITING`, `READY_FOR_DELIVERY` o `DELIVERED` | Controles de selección y confirmación deshabilitados |
| Galería `ARCHIVED` | No permite selección, confirmación, importación, correo ni nuevas transiciones |
| Confirmación sin completar el límite | HTTP 409 |
| Confirmación con cantidad exacta | HTTP 200 y resultado `confirmed` |
| Confirmación repetida | HTTP 200 y resultado `already_confirmed` |
| Transición no incluida en `allowedGalleryTransitions` | Rechazo de dominio |
| Transición a `READY_FOR_DELIVERY` sin URL | Rechazo de dominio |
| Primer correo desde `DRAFT` | Evento `GALLERY_EMAIL_SENT` y estado `EMAIL_SENT` |
| Reenvío desde `EMAIL_SENT` | Evento `GALLERY_EMAIL_RESENT`; conserva `EMAIL_SENT` |
| Reenvío desde `PROOFING` | Evento `GALLERY_EMAIL_RESENT`; conserva `PROOFING` |
| Correo de selección desde `SELECTION_CONFIRMED` o posterior | Rechazo; no se envía SMTP ni se escribe evento |
| Primer envío o reenvío desde `ARCHIVED` | Rechazo; no se envía SMTP ni se escribe evento |
| Importación administrativa | Evento con actor, cantidades y `source=local_filesystem`; sin rutas absolutas |
| Reimportación sin cambios | No modifica fotos ni crea un evento nuevo |
| Reducir `selectionLimit` bajo el total seleccionado | Rechazo de dominio; límite y selecciones sin cambios |
| Editar `selectionLimit` desde `SELECTION_CONFIRMED` en adelante | Rechazo de dominio |
