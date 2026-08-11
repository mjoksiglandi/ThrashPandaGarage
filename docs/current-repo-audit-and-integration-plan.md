# Estado actual y cierre de V1

Fecha: 2026-08-09

Trashpanda Garage sigue siendo un monolito modular de Next.js, Prisma y
PostgreSQL. Esta arquitectura cubre el MVP; no hay un segundo consumidor que
justifique workspaces, paquetes compartidos o microservicios.

## Implementado

- portfolio y sesiones públicas desde filesystem;
- panel administrativo para clientes, galerías e importación de fotos;
- workflow transaccional de galerías, selección y export TXT/CSV;
- cuentas separadas de clientes, invitaciones, login, recuperación y sesiones
  revocables;
- portal autenticado con aislamiento por cuenta/cliente;
- acceso compatible por token de galería;
- migraciones incrementales, pruebas unitarias y pruebas PostgreSQL.

## Pendiente para cerrar la V1

- cablear creación de cuenta y emisión/reenvío de invitaciones en el panel;
- completar comentarios y confirmación en el portal autenticado;
- implementar o retirar el formulario de contacto decorativo;
- completar administración de fotos: orden, visibilidad, portada y soft delete;
- definir entrega, expiración y notificación operativa;
- ejecutar SMTP, importación Lightroom y el flujo E2E con datos reales;
- cerrar Docker, secretos, backups, observabilidad y CI.

## Criterio de terminado

Una pantalla está terminada cuando tiene regla de dominio, persistencia,
autorización, interfaz real, estados vacío/error y una prueba del flujo crítico.
La V1 está terminada cuando el recorrido administrador → invitación → login →
selección → confirmación → entrega pasa de extremo a extremo en el ambiente de
despliegue y existe recuperación documentada de base de datos y fotografías.

## Decisiones vigentes

- conservar `app/components → modules → repositories/db`;
- mantener PostgreSQL y el adapter de filesystem;
- mantener Google Drive como entrega manual mientras no exista otro requisito;
- no crear microservicios, colas, abstracción multi-storage ni design system
  publicado antes de que un caso real los requiera.
