# Auditoria de refactor y limpieza

## Alcance

La revision se concentro en codigo demostrablemente sin uso, responsabilidades mezcladas en componentes y dependencias declaradas. No se eliminaron rutas de Next.js por ausencia de imports, porque el framework las consume por convencion.

## Hallazgos aplicados

| Hallazgo | Evidencia | Accion |
| --- | --- | --- |
| Variable `category` sin uso | TypeScript `noUnusedLocals` | Eliminada junto con su import exclusivo. |
| Import `vi` sin uso | TypeScript `noUnusedLocals` | Eliminado del test. |
| `clsx` sin consumidores | Knip | Dependencia eliminada. |
| `@types/bcryptjs` sin consumidores | Knip; `bcryptjs` incluye tipos | Dependencia de desarrollo eliminada. |
| `server-only` importado sin declaracion | Knip | Agregado como dependencia directa. |
| `PhotoCollage` mezclaba layout, medicion y lightbox | Revision de responsabilidades | Layout puro y lightbox separados, sin cambiar el contrato publico. |

## Verificacion requerida

- TypeScript con `noUnusedLocals` y `noUnusedParameters`.
- Knip sin dependencias sin uso ni dependencias no declaradas.
- Suite Vitest completa.
- ESLint.
- Build de produccion.
- Chequeo local de Graphify sobre el arbol final, sin versionar sus salidas.

## Fuera de alcance

- Redisenar la interfaz publica o administrativa.
- Cambiar contratos HTTP, Prisma o el formato de almacenamiento fotografico.
- Reescribir componentes pequenos que ya tienen una sola responsabilidad.
