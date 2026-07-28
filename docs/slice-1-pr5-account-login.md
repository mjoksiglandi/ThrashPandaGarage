# Slice 1 PR 5 — Login y sesiones de cuenta

## Alcance

PR 5 publica `GET /login` y `POST /api/account-login` para cuentas activadas
mediante invitación. El flujo usa `Account`, `authentication-attempt.service.ts`
y `account-session.service.ts`; no modifica el login administrativo, el portal
legacy, `Client.passwordHash`, `Gallery.accessToken` ni el schema Prisma.

No hay migraciones nuevas.

## Arquitectura

- La UI sólo recopila correo y contraseña, bloquea envíos repetidos y presenta
  errores públicos.
- El adaptador HTTP valida origen, parsea `FormData`, traduce errores, configura
  la cookie y responde sin datos internos.
- `account-login.service.ts` normaliza y valida la entrada, ejecuta bcrypt,
  registra el intento y coordina la transacción final.
- `authentication-attempt.service.ts` sigue siendo la autoridad para incrementar,
  bloquear, normalizar bloqueos expirados y reiniciar contadores.
- `account-session.service.ts` sigue siendo la autoridad para generar el token,
  calcular el digest, definir la expiración y persistir la sesión.
- El repositorio de cuentas limita `passwordHash` a dos lecturas específicas del
  flujo de credenciales: la lectura mínima inicial y la revalidación bloqueada.

## Flujo de autenticación

1. Se exige un correo canónico válido y una contraseña no vacía.
2. Se rechazan contraseñas de más de 72 caracteres o 72 bytes UTF-8. La
   contraseña no se recorta ni se transforma.
3. Se busca una proyección mínima de la cuenta por el correo normalizado.
4. bcrypt compara la contraseña con el hash almacenado. Si no hay cuenta o hash,
   compara contra un hash centinela bcrypt de costo 12.
5. Una comparación incorrecta se entrega al servicio existente de intentos. La
   fila de la cuenta se bloquea con `FOR UPDATE`; los fallos concurrentes no
   pierden incrementos.
6. Una comparación correcta abre una transacción corta, vuelve a bloquear la
   cuenta y revalida estado y hash.
7. En esa misma transacción se reinician los intentos, se actualiza
   `lastLoginAt`, se genera una sesión nueva y se guarda sólo el digest SHA-256
   de su token.
8. Después del commit, el límite HTTP coloca únicamente el token opaco en la
   cookie.

## Enumeración y errores

Las cuentas inexistentes, sin contraseña, invitadas, bloqueadas, desactivadas y
las contraseñas incorrectas producen `401` con exactamente:

`Correo electrónico o contraseña incorrectos.`

Todas comparten la misma estructura JSON y no reciben cookie ni redirección.
Las cuentas inexistentes realizan bcrypt y una búsqueda transaccional de intento
en vez de omitir el trabajo costoso. Las entradas sintácticamente inválidas se
rechazan antes de bcrypt.

Los fallos inesperados se traducen a un `503` genérico. El adaptador nunca
serializa errores internos, IDs, consultas, hashes, credenciales ni tokens.

## Política de intentos

PR 3 definió la máquina de estados y su coordinación por bloqueo de fila. PR 5
configura el límite productivo en cinco fallos y una ventana de bloqueo de
quince minutos, coherente con el límite temporal del acceso legacy:

- cada contraseña incorrecta de una cuenta activa incrementa el contador;
- el quinto fallo persiste `LOCKED` y `lockedUntil`;
- un intento antes de `lockedUntil` se rechaza sin sobrescribir el estado;
- tras expirar el bloqueo, el siguiente fallo comienza en uno;
- un login correcto tras un fallo permitido o bloqueo expirado persiste
  `ACTIVE`, contador cero, `lockedUntil = null` y `lastLoginAt`;
- `INVITED` y `DISABLED` no modifican sus estados mediante login.

## Bcrypt y coordinación transaccional

bcrypt se ejecuta después de la lectura mínima y antes de adquirir `FOR UPDATE`.
Así no se mantiene una transacción abierta durante el trabajo criptográfico.

La comparación fuera de la transacción no autoriza por sí sola. La transacción
final exige que el hash siga siendo exactamente el verificado y que la política
permita autenticar el estado bloqueado. Sólo entonces reinicia el intento y
crea la sesión. Si la cuenta se desactiva, bloquea o cambia de contraseña durante
bcrypt, no se crea sesión. Si falla cualquier escritura de sesión, también se
revierte el reinicio del intento.

Dos logins correctos concurrentes generan sesiones independientes. Un login
correcto concurrente con uno fallido se serializa sin perder actualizaciones; si
un fallo alcanza el umbral antes de la revalidación correcta, el login correcto
se rechaza conservadoramente.

## Sesión y cookie

Cada login correcto genera 32 bytes aleatorios mediante el generador existente.
PostgreSQL recibe sólo su digest SHA-256 y una expiración de 30 días. El token
plano no se reutiliza, no se registra y no forma parte del HTML, metadata, JSON o
URL.

La cookie central `tpg_account_session` contiene exclusivamente el token y usa:

- `HttpOnly`;
- `Secure` cuando `NODE_ENV=production`;
- `SameSite=Lax`;
- `Path=/`;
- `Expires` y `Max-Age` derivados de la expiración persistida.

El desarrollo local puede usar HTTP sin desactivar `Secure` globalmente.

## CSRF, caché y redirección

El endpoint sólo implementa `POST` y exige un encabezado `Origin` exactamente
igual a `APP_BASE_URL`, incluido scheme, host y puerto. El redirect se construye
desde esa misma base canónica; no confía en el host de la solicitud ni en
headers reenviados. Un origen ausente, malformado o externo se rechaza antes de
leer credenciales.

El valor recibido debe ser ya una serialización de origen válida, sin path,
query, credenciales ni valores múltiples; no se normalizan URLs arbitrarias
antes de decidir confianza.

`/login` y `/api/account-login` usan:

`private, no-cache, no-store, max-age=0, must-revalidate`

La página además publica `noindex`, `nofollow`, `X-Robots-Tag` y
`Referrer-Policy: no-referrer`.

El éxito responde `303` hacia el destino interno fijo `/`; la cookie se emite en
esa misma respuesta y nunca antes del commit. PR 5 no acepta `next`, por lo que
no existe una entrada de open redirect. El portal legacy todavía depende de
`tpg_client`; convertir su guarda a `AccountSession` está expresamente fuera de
alcance y se difiere.

## Pruebas

La cobertura unitaria incluye validación y normalización, límite UTF-8,
traducción pública, centinela bcrypt, estados no autenticables, cambio de hash,
cookie, origen, endpoint HTTP y ausencia de datos sensibles.

La suite PostgreSQL usa exclusivamente el schema aislado
`slice1_pr5_account_login_test` y cubre:

- login correcto, digest, expiración y no sobrescritura del hash;
- fallo existente y no-existencia;
- reinicio después de fallos permitidos y bloqueo al alcanzar el umbral;
- estados `INVITED`, `LOCKED` y `DISABLED`;
- dos logins correctos concurrentes;
- login correcto concurrente con uno fallido;
- incrementos fallidos concurrentes sin sobrescritura;
- desactivación durante bcrypt;
- rollback entre el reinicio del intento y la sesión.

La auditoría HTTP productiva comprueba la página, errores, login correcto,
cookie, caché, robots, referrer, ausencia de datos internos y rechazo de origen.

Resultados de cierre:

- Prisma format, validate y generate: correctos, sin cambios de schema;
- TypeScript estricto y build productivo: correctos;
- unitarias: 256/256;
- PostgreSQL aislado: 60/60;
- carreras críticas de login: 11/11, repetidas tres veces;
- ESLint: cero errores y ocho advertencias `<img>` preexistentes;
- HTTP productivo: `GET /login` 200; fallos indistinguibles 401; origen
  ausente/externo 403; éxito 303; cookie y headers correctos;
- `git diff --check`, secretos, logs, cookie y redirects: correctos.

## Exclusiones y riesgos posteriores

No se implementan logout, revocación manual, sesión actual, guards, middleware,
roles, recuperación o cambio de contraseña, MFA, OAuth, refresh tokens, SMTP ni
conversión del portal legacy.

El principal riesgo pendiente es que la nueva sesión todavía no protege ni
personaliza una ruta de cuenta. Un PR posterior debe validar la cookie mediante
el servicio existente y conectar una ruta autenticada antes de sustituir el
portal legacy. También debe definir logout y revocación operativa sin debilitar
la política aquí implementada.
