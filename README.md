# Trashpanda Garage

Web fullstack en Next.js + TypeScript para portfolio publico, galerias privadas de seleccion, comentarios de cliente y entrega manual por Google Drive.

## Stack

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- Zod
- Nodemailer
- Docker Compose

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Ajusta `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `PHOTO_STORAGE_ROOT`.
3. Genera un `AUTH_SECRET` de al menos 32 caracteres, por ejemplo con `openssl rand -base64 32`, y pegalo en `.env`.
4. Instala dependencias:

```bash
npm install
```

5. Crea el esquema y el admin:

```bash
npm run prisma:migrate -- --name init
npm run db:seed
```

> `prisma:migrate` genera y aplica una migracion versionada (la que tambien usa Docker via `migrate deploy`). `npm run prisma:push` sigue disponible para iterar rapido el schema en desarrollo sin crear una migracion, pero no debe usarse para generar el historial que luego se commitea en `prisma/migrations/`.

6. Levanta Next:

```bash
npm run dev
```

## Docker

```bash
docker compose up --build
```

El servicio `app` monta `/mnt/trashpanda/photos` en `/data/photos` y fuerza `DATABASE_URL` hacia el servicio `db`.

> **Primera vez:** el servicio `app` corre `npx prisma migrate deploy` al arrancar, pero este repo todavia no incluye ninguna migracion en `prisma/migrations/`. Si intentas `docker compose up --build` antes de generar la migracion inicial, el contenedor levanta con la base de datos vacia (sin tablas) y sin ningun error visible. Antes del primer `docker compose up`, genera la migracion inicial una vez:
>
> ```bash
> docker compose up -d db
> DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trashpanda" npm run prisma:migrate -- --name init
> ```
>
> Ajusta la URL a las credenciales reales de tu `docker-compose.yml`. Luego commitea el directorio `prisma/migrations/` resultante. A partir de ahi, `docker compose up` aplicara esa migracion automaticamente en cada arranque via `migrate deploy`.

## Fotos

Estructura esperada:

```txt
/data/photos/2026-07-08_cliente/
  thumbs/
    IMG_2031.webp
  preview/
    IMG_2031.jpg
```

La relacion se hace por `baseName`, por ejemplo `IMG_2031`.

## Scripts

```bash
npm run gallery:import -- <gallery-id-o-folder>
npm run selection:export -- <gallery-id> [out.txt]
```

Ademas del `.txt`, la seleccion de una galeria tambien se puede exportar como `.csv` (con columnas `filename,baseName,comment`) desde el panel admin en `/admin/galleries/<id>/export/csv`.

## Rutas clave

- `/`: home publica
- `/work`, `/work/photo`, `/work/props`, `/work/fx`, `/work/builds`: portfolio base
- `/contact`: contacto
- `/g/[token]`: galeria privada
- `/admin`: panel admin
- `/admin/clients`: clientes
- `/admin/galleries`: galerias

## Notas V1

- No usa Google Drive API.
- No guarda imagenes en base de datos.
- Sirve thumbs/previews mediante endpoint controlado desde registros `Photo`.
- No expone rutas absolutas del servidor.
- El correo usa SMTP por variables de entorno.
