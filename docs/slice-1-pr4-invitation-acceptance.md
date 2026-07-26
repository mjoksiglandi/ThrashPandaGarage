# Slice 1 PR 4 — Aceptación de invitaciones

## Alcance

PR 4 publica `GET /invitations/accept#token` y conecta el formulario de definición
inicial de contraseña con el servicio transaccional de invitaciones.

El flujo:

1. recibe el token en el fragmento URL, que no se envía al servidor ni aparece
   en access logs, y lo elimina del historial antes de validarlo;
2. exige un token opaco canónico de 256 bits y consulta solo su hash SHA-256;
3. presenta un único estado público para enlaces inexistentes, expirados,
   revocados, reemplazados, consumidos o asociados a una cuenta no invitada;
4. valida y confirma una contraseña de 12 a 72 caracteres, sin transformarla;
5. rechaza entradas mayores a 72 bytes UTF-8 para evitar el truncamiento
   silencioso de bcrypt;
6. bloquea la cuenta y la invitación con `FOR UPDATE`;
7. escribe el hash bcrypt, activa la cuenta, consume la invitación y revoca las
   demás invitaciones pendientes dentro de una sola transacción;
8. redirige el éxito a `/invitations/accepted`, sin conservar el token en la
   URL de destino.

La validación previa de la pantalla sirve solo para presentación. La acción vuelve a
validar token, expiración, estado y consumo después de adquirir los bloqueos.

## Observación operativa local

Durante la preparación inicial del esquema de pruebas, Prisma aplicó
`20260723120000_harden_gallery_workflow` y
`20260725235807_add_account_invitation_sessions` al esquema local `public`.
Ambas migraciones aditivas finalizaron correctamente. No se incorporó ningún
rollback ni cambio de infraestructura a PR 4; la validación definitiva se
ejecutó en el esquema aislado `slice1_pr4_acceptance_test`.

## Concurrencia y consumo único

Dos aceptaciones simultáneas del mismo token se serializan en PostgreSQL. Solo
una puede observar la invitación y la cuenta en estado utilizable; la otra
recibe el mismo estado público de enlace no disponible. Si falla cualquier
escritura posterior a la activación, la transacción completa hace rollback.

## Fuera de alcance

- login, sesiones, cookies, middleware y logout;
- bloqueo o desactivación de cuentas;
- SMTP, emisión o reenvío de invitaciones;
- migración de `Gallery.accessToken`;
- cambios en la autenticación administrativa o el portal legacy.
