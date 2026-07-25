# Slice 1 PR 1 — Modelo y política de cuentas

## Objetivo

Este PR prepara `Client -> Account -> Invitation -> AccountSession` de forma
aditiva. Define el modelo futuro y sus reglas puras, pero no cambia el acceso
actual de administradores, clientes o galerías.

## Alcance

Incluye:

- `AccountStatus`, `Account`, `Invitation` y `AccountSession`;
- relación opcional uno a uno entre `Client` y `Account`;
- normalización canónica de email;
- token de invitación aleatorio de 256 bits y hash SHA-256;
- políticas puras de estado, login e invitaciones;
- errores de dominio;
- repositorios mínimos sin callers productivos;
- pruebas unitarias.

No incluye:

- backfill de `Client.passwordHash`;
- eliminación de campos legacy;
- cambios en `src/lib/client-auth.ts`;
- cookies o sesiones nuevas;
- emisión SMTP;
- página pública de aceptación;
- cambios en `Gallery.accessToken`;
- aplicación de migraciones sobre una base.

## Identidad comercial e identidad de acceso

`Client` conserva nombre, email de contacto, teléfono, notas y galerías.
`Account` representa exclusivamente la identidad capaz de iniciar sesión. Un
cliente puede no tener cuenta y una cuenta pertenece exactamente a un cliente.

El email de `Account` debe persistirse siempre mediante
`normalizeAccountEmail`: `trim()` seguido de `toLowerCase()`. El índice único de
Prisma presupone este contrato; no se usan búsquedas case-insensitive como
sustituto.

## Política de Account

| Estado | Login | Invitación | Transiciones persistibles |
| --- | --- | --- | --- |
| `INVITED` | No | Emitir o reenviar | `ACTIVE`, `DISABLED` |
| `ACTIVE` | Sí | No | `LOCKED`, `DISABLED` |
| `LOCKED` | Sólo si existe `lockedUntil` y `lockedUntil <= now` | No | `ACTIVE` al expirar, o `DISABLED` |
| `DISABLED` | No | No | Ninguna en este PR |

La expiración de un bloqueo no escribe por sí sola `LOCKED -> ACTIVE`. El futuro
servicio de login podrá normalizar ese estado dentro de su propia transacción.
Un `LOCKED` sin `lockedUntil` se rechaza de forma conservadora; no se interpreta
como bloqueo vencido.

## Política de Invitation

Una invitación es utilizable solamente si:

```text
acceptedAt === null
revokedAt === null
expiresAt > now
account.status === INVITED
```

El instante exacto `expiresAt === now` se considera expirado. La política no
depende de Prisma, SMTP, cookies ni hashing.

Antes de emitir una nueva invitación, el futuro servicio debe bloquear la cuenta
y revocar en la misma transacción todas las invitaciones pendientes, incluidas
las expiradas. Una invitación aceptada no puede revocarse y una segunda
revocación se rechaza explícitamente.

## Tokens

`createInvitationToken` devuelve el token plano y su hash. El token contiene 32
bytes aleatorios y sólo debe existir en memoria durante la futura emisión. Los
repositorios aceptan un tipo marcado `TokenHash` y vuelven a validar en runtime
el formato hexadecimal SHA-256 antes de consultar o persistir. Ni el token ni el
hash deben aparecer en logs.

## Relaciones y borrado

`Client -> Account`, `Account -> Invitation` y `Account -> AccountSession`
declaran `onDelete: Cascade` y `onUpdate: Cascade`. La cascada invalida de forma
inmediata invitaciones y sesiones si se borra una cuenta, pero también elimina
ese historial. Slice 1 no incorpora operaciones de borrado: `DISABLED` es el
estado terminal operativo. Antes de habilitar cualquier delete, el PR de
migración debe confirmar la política de retención y backup.

La unicidad de `Account.email` presupone persistencia normalizada. El repositorio
normaliza creación y búsqueda; la migración posterior debe añadir una
restricción PostgreSQL que impida saltarse el contrato mediante acceso directo a
Prisma. También debe validar `failedLoginAttempts >= 0` y la coherencia de
`LOCKED` con `lockedUntil`.

## Persistencia y migración

No se creó una migración de Slice 1 porque
`20260723120000_harden_gallery_workflow` continúa pendiente en la base local.
El schema es una preparación de código hasta completar, en este orden:

1. aplicar y validar el cierre de Slice 0;
2. configurar `TEST_DATABASE_URL` sobre una base aislada;
3. crear la migración aditiva;
4. añadir y probar restricciones de email normalizado, intentos y bloqueos;
5. probar unicidad, relaciones y cascadas;
6. mantener sin cambios el login legacy;
7. ejecutar el backfill en un PR posterior.

## Siguiente PR

PR 2 perfilará las bases objetivo, migrará hashes existentes a `Account` y
cambiará el login mediante un cutover reversible. Hasta entonces
`Client.passwordHash`, `tpg_client` y `/portal/login` siguen siendo la autoridad
productiva.
