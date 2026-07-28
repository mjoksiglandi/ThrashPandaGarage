# Graphify y Ponytail

Estas herramientas apoyan el mantenimiento local. No forman parte del build,
los tests, CI ni la ejecucion productiva de Trashpanda.

## Clasificacion

| Artefacto | Clasificacion | Politica |
| --- | --- | --- |
| `graphify-out/` | Reportes, visualizaciones y caches regenerables | Local e ignorado por Git. |
| `.graphify_*.json` | Estado temporal de deteccion, extraccion y analisis | Local e ignorado por Git. |
| `.graphify_uncached.txt` | Lista temporal de trabajo | Local e ignorada por Git. |
| Graphify `0.9.18` | Herramienta Python externa | No se agrega a `package.json`. |
| Ponytail | Plugin externo de revision y simplificacion | Se conserva fuera del repositorio. |

El snapshot retirado contenia 311 archivos generados y referencias obsoletas.
Su cache `stat-index.json` indexaba rutas absolutas, tamanos y `mtime_ns`, por
lo que no era portable ni estable entre equipos. Antes de retirarlo se
registraron estos SHA-256:

- `graphify-out/cache/stat-index.json`:
  `3F680017AC6622C2259E6150C5A680E7BDAD0033D14B4FE1C9D7A845450CF16D`
- `.graphify_detect.json`:
  `2C89D721A109A9026FF1C015B802D37D51D5A45B30EEC920FB2627CFEA91AADE`

Ponytail no tiene archivos, dependencias, scripts, hooks ni callers dentro del
repositorio. Graphify tampoco depende de Ponytail. Por eso no corresponde
eliminar ni reemplazar ninguna de las dos herramientas en este PR.

## Ejecucion canonica

Instala la version auditada de Graphify en tu entorno Python:

```powershell
python -m pip install graphifyy==0.9.18
```

Desde la raiz del repositorio, genera el grafo estructural de los modulos:

```powershell
python -m graphify extract src/modules --code-only --out . --max-workers 1 --no-cluster
```

`src/modules` mantiene el corpus bajo el limite operativo de Graphify. El modo
`--code-only`, un solo worker y `--no-cluster` evitan llamadas LLM y reducen
fuentes de no determinismo. Las salidas quedan en `graphify-out/`, son locales
y no deben agregarse a Git.

Dos ejecuciones consecutivas deben terminar sin cambios en archivos
versionados:

```powershell
git status --short
```

Para una exploracion semantica puntual se puede ejecutar `/graphify
src/modules`; sus resultados siguen siendo locales y no sustituyen las pruebas,
TypeScript, lint ni build.
