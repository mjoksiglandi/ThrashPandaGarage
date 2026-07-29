# Slice 2 PR 6 — Sesiones activas de cuenta

## Alcance

Este PR permite que una cuenta autenticada liste y revoque únicamente sus
sesiones activas desde `/portal/sessions`. No modifica el schema Prisma, la
autenticación administrativa, los roles ni el acceso público por
`/g/[token]`.

`AccountSession` ya contiene toda la información mínima necesaria:
`id`, `accountId`, `tokenHash`, `createdAt`, `expiresAt` y `revokedAt`. Como no
existe metadata persistida de actividad, agente o dispositivo, la interfaz no
la inventa.

## Fronteras

1. La cookie `tpg_account_session` se valida por la ruta canónica:
   token opaco → digest SHA-256 → `AccountSession` bloqueada.
2. `AccountSessionPrincipal` conserva el `sessionId` interno validado para
   identificar la sesión actual sin comparar tokens planos.
3. La página obtiene el actor mediante `requirePortalAccount()`.
4. La mutación obtiene `accountId` y `sessionId` actual exclusivamente del
   principal. El body no participa en autorización.
5. El repositorio aplica ownership, revocación y expiración en PostgreSQL.

El endpoint `GET /api/account-session` mantiene su contrato mínimo de cuenta y
no publica el `sessionId` interno agregado al principal.

## Listado

La consulta selecciona solo `id`, `createdAt`, `expiresAt` y la marca
`current`. Filtra en PostgreSQL:

- `accountId` igual al principal;
- `revokedAt IS NULL`;
- `expiresAt > now`.

El orden es determinista: sesión actual primero, `createdAt` descendente e
`id` ascendente como desempate. Nunca se seleccionan ni serializan token,
digest, password hash, cookies o `Gallery.accessToken`.

## Revocación y locks

El orden global existente es `Account → child row`. La nueva transacción:

1. bloquea la `Account` del principal;
2. revalida que siga activa;
3. bloquea `AccountSession WHERE id = target AND accountId = principal`;
4. revalida revocación y expiración;
5. escribe `revokedAt` solo si todavía es nulo.

Una sesión inválida, inexistente, ajena, expirada o ya revocada recibe el mismo
redirect fijo y no revela existencia. Los reintentos son idempotentes.

Si el ID objetivo coincide con el `sessionId` canónico del principal, la capa
HTTP reutiliza `logoutAccountSessionToken`. Después limpia
`tpg_account_session` y la cookie legacy `tpg_client`, y redirige al destino
interno fijo `/portal/login`.

Todas las mutaciones validan `Origin` contra `APP_BASE_URL` y responden con
caché privada/no-store y errores genéricos.

## Separación del acceso público

`/g/[token]` continúa resolviendo exclusivamente `Gallery.accessToken`. Ese
token:

- no es una `AccountSession`;
- no crea ni autentica una cuenta;
- no aparece en el listado;
- no puede invocar la administración de sesiones;
- no cambia cuando se revoca una sesión de cuenta.

Las pruebas PostgreSQL verifican que la revocación no altera
`Gallery.accessToken`, `Selection` ni los datos de galería, y que el acceso
público sigue resolviendo la galería.
