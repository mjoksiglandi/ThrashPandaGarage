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
npm run prisma:push
npm run db:seed
```

6. Levanta Next:

```bash
npm run dev
```

## Docker

```bash
docker compose up --build
```

El servicio `app` monta `/mnt/trashpanda/photos` en `/data/photos` y fuerza `DATABASE_URL` hacia el servicio `db`.

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
