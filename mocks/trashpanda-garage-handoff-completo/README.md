# Trashpanda Garage — Sistema completo · Handoff técnico v1.0

Portafolio editorial + Portal del cliente + Panel administrativo.
Prototipos funcionales (HTML/CSS/JS vanilla) + mockups de alta fidelidad.

> Los prototipos son **referencia visual y de comportamiento**, no la base de código.
> El destino es Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 ·
> Framer Motion · next/image · shadcn/ui.

---

## 1. Contenido del paquete

**Sitio público (portafolio)**
- `trashpanda-garage-prototype.html` — Landing, hero carousel, galería editorial, servicios, about, contacto
- `trashpanda-garage-mockup.png` — Board de todas las páginas

**Login**
- `trashpanda-login.html` — Client Portal · login con card flotante
- `trashpanda-login-mockup.png` — Desktop + mobile

**Portal del cliente (v3)**
- `trashpanda-portal.html` — 10 vistas. Router por `?view=`
- `trashpanda-portal-mockups.png` — Board
- Vistas: `dashboard`, `empty`, `seleccion`, `lightbox`, `limite`, `confirmada`, `edicion`, `entrega`, `expirada`, `unauthorized`

**Panel administrativo (Fase 2A galerías + 2B clientes)**
- `trashpanda-admin.html` — 30+ vistas. Router por `?view=`
- `trashpanda-admin-mockups.png` — Board flujo de galerías
- `trashpanda-admin-clientes-mockups.png` — Board clientes e invitaciones

Abrir cualquier `.html` en el navegador. Cambiar de pantalla con el parámetro `?view=`
(p. ej. `trashpanda-admin.html?view=clientes`).

---

## 2. Design tokens

```css
/* Fondos */
--bg:        #0D0F12   /* fondo principal */
--bg-deep:   #090B0E   /* sidebar, modal footer */
--surface:   #14181E   /* cards, bloques, tablas */
--surface-2: #1B212A   /* hover de fila, inputs */
--surface-3: #222A34   /* tabs activos, progreso */

/* Texto */
--text:      #EAF0F6   /* principal */
--text-2:    #9AA8B8   /* secundario */
--text-3:    #6B7784   /* metadata tenue, placeholders */

/* Bordes */
--line:      rgba(234,240,246,.08)
--line-2:    rgba(234,240,246,.14)

/* Acento (único color de marca) */
--violet:    #5E4B8B   /* botones primarios, seleccionados */
--violet-b:  #8A73C4   /* hover, focus, énfasis */

/* Estados */
--blue:  #3D7EFF   --blue-l:  #8FB2FF   /* selección abierta */
--amber: #C4A15E   --amber-l: #E0C48E   /* en edición, alertas */
--green: #5EC48A   --green-l: #96E0B6   /* entrega / completado — RESERVADO */
--red:   #C45E5E   --red-l:   #E09A9A   /* destructivo, error */
--gray:  #77828F                        /* borrador, archivada */

/* Radios */
--r-s: 6px    --r-m: 10px
/* Portal: card de login 20px, botones 10px. Admin: 6–10px. */

/* Movimiento */
--ease: cubic-bezier(.22,.61,.36,1)
```

**Tipografía:** Geist (300/400/500) para UI y texto · Geist Mono (400/500) para
metadata, estados, nombres de archivo, fechas, IDs, breadcrumbs. Escala en base 8pt.

**Regla de color:** el verde es EXCLUSIVO de entrega/publicado/completado. El violeta
es el único acento de marca; nunca en grandes superficies. Nada de glassmorphism,
gradientes llamativos ni sombras fuertes.

---

## 3. Enums de estado (fuente de verdad)

Estos enums centralizan color, icono, etiqueta, acciones disponibles y transiciones
válidas. Toda la UI (chips, badges, filtros, botones de acción) deriva de aquí.
No hardcodear estados en componentes.

### 3.1 GalleryStatus

```ts
export type GalleryStatus =
  | 'draft'          // Borrador
  | 'selection_open' // Selección abierta
  | 'confirmed'      // Confirmada
  | 'editing'        // En edición
  | 'delivery'       // Entrega
  | 'archived';      // Archivada

export const GALLERY_STATUS: Record<GalleryStatus, StatusMeta> = {
  draft:          { label: 'Borrador',        tone: 'gray',   dot: true },
  selection_open: { label: 'Selección abierta',tone: 'blue',   dot: true },
  confirmed:      { label: 'Confirmada',       tone: 'violet', dot: true },
  editing:        { label: 'En edición',       tone: 'amber',  dot: true },
  delivery:       { label: 'Entrega',          tone: 'green',  dot: true },
  archived:       { label: 'Archivada',        tone: 'gray',   dot: true },
};

// Transiciones permitidas (lineales, sin saltos)
export const GALLERY_TRANSITIONS: Record<GalleryStatus, GalleryStatus[]> = {
  draft:          ['selection_open', 'archived'],
  selection_open: ['confirmed', 'archived'],
  confirmed:      ['editing', 'archived'],
  editing:        ['delivery', 'archived'],
  delivery:       ['archived'],
  archived:       [],  // reversible solo vía "restaurar" desde el archivo
};
```

Cambiar estado siempre pasa por modal con: flujo visual, transición concreta,
consecuencias explícitas, opción notificar, y registro en Actividad. Estados no
alcanzables se muestran deshabilitados (atenuados + tachados), no ocultos.

### 3.2 AccountStatus (acceso al portal)

```ts
export type AccountStatus =
  | 'no_access'    // Sin acceso  — cliente existe, sin cuenta
  | 'inactive'     // Sin activar — invitado, aún no completa registro
  | 'active'       // Activa
  | 'deactivated'  // Desactivada — por el estudio, reversible
  | 'blocked'      // Bloqueada   — automático tras intentos fallidos
  | 'archived';    // Archivada   — cliente archivado

export const ACCOUNT_STATUS: Record<AccountStatus, StatusMeta> = {
  no_access:   { label: 'Sin acceso',   tone: 'gray'  },
  inactive:    { label: 'Sin activar',  tone: 'amber' },
  active:      { label: 'Activa',       tone: 'green', dot: true },
  deactivated: { label: 'Desactivada',  tone: 'red',   dot: true },
  blocked:     { label: 'Bloqueada',    tone: 'red',   dot: true },
  archived:    { label: 'Archivada',    tone: 'gray',  dot: true },
};
```

> **Cliente ≠ Cuenta ≠ Invitación.** Un cliente puede existir sin cuenta. El correo
> de contacto puede diferir del correo de acceso (se advierte en UI cuando difieren).
> Las contraseñas nunca se muestran; la temporal se revela una sola vez.

### 3.3 InvitationStatus

```ts
export type InvitationStatus =
  | 'not_sent'   // No enviada
  | 'sent'       // Enviada
  | 'opened'     // Abierta
  | 'accepted'   // Aceptada — enlace consumido, no reutilizable
  | 'expired'    // Expirada
  | 'revoked'    // Revocada
  | 'bounced';   // Rebotada — fallo de entrega

export const INVITATION_STATUS: Record<InvitationStatus, StatusMeta> = {
  not_sent: { label: 'No enviada', tone: 'gray'  },
  sent:     { label: 'Enviada',    tone: 'blue'  },
  opened:   { label: 'Abierta',    tone: 'blue'  },
  accepted: { label: 'Aceptada',   tone: 'green' },
  expired:  { label: 'Expirada',   tone: 'amber' },
  revoked:  { label: 'Revocada',   tone: 'gray'  },
  bounced:  { label: 'Rebotada',   tone: 'red'   },
};
```

### 3.4 PhotoFlag (admin de fotografías)

```ts
// Una foto puede acumular varias flags; limitar apilado visible a ~2 (resto en tooltip).
export type PhotoFlag = 'cover' | 'client_selected' | 'in_delivery' | 'hidden';
// cover → ámbar · client_selected → violeta · in_delivery → verde · hidden → gris
// Estados de carga (no flags): uploading → processing → available | error
```

### 3.5 `tone` → clase de chip

```
gray → .chip.gray  ·  blue → .chip.blue  ·  violet → .chip.violet
amber → .chip.amber ·  green → .chip.green ·  red → .chip.red
```
Todo chip de estado combina **texto + punto/icono + color** (nunca solo color, por
accesibilidad y daltonismo).

---

## 4. Componentes clave y comportamiento

### Sitio público
- **Hero carousel:** crossfade 1.8s, 7.5s por slide, Ken Burns scale 1→1.055 en 10s,
  barra de progreso violeta, pausa en hover/tab inactivo, flechas + teclado + swipe.
- **Nav:** transparente → tras 40px de scroll fondo `rgba(13,15,18,.72)` + blur 10px.
- **Galería editorial:** roles con distinto peso (statement / hero / featured /
  standard / supporting). Statement casi full-width + 64px de margen vertical.
- **Lightbox:** Esc cierra, flechas navegan, scroll del body bloqueado.

### Portal del cliente
- Selección con contador X/Y + barra; barra fija inferior con aviso de irreversibilidad.
- Límite alcanzado en tono positivo ("Selección completa"), no de alerta.
- Lightbox de revisión: archivo + posición (`TPG-0405 · 4 de 42`).
- Timeline de edición sin porcentajes (transmite calma). Entrega con hero + ZIP.

### Admin
- **Sidebar** fijo (Operación / Sistema), colapsable a iconos ≤1200px.
- **Topbar:** breadcrumbs en mono, buscador global (⌘K), CTA primario **contextual**
  (`+ Nueva galería` / `+ Nuevo cliente` según sección).
- **Tablas densas:** thumbnail 44×32, ⋯ siempre visible (touch), "Abrir" al hover,
  6 columnas núcleo, selector de columnas.
- **Barra de lote:** resume elegibilidad ("Enviar invitación · 1 de 2 · 1 omitido"),
  deshabilita acciones incompatibles con tooltip explicativo.
- **Modales sensibles:** consecuencias explícitas + notificar + registro en Actividad.
  Archivar bloqueado si hay operaciones en curso hasta confirmar checkbox.
- **Actividad:** log con autor, fecha, transición (desde→hacia), navegador·SO·región
  (nunca IP parcial). Eventos de selección agrupados.

---

## 5. Notas de implementación para Next.js

- **Imágenes:** los prototipos usan `picsum.photos` en B/N como placeholder. Sustituir
  por `next/image` con las fotos finales. Aspect ratios por rol editorial:
  statement 21:10 · hero 3:2 · featured 4:3 · standard 3:4 · supporting 1:1.
- **Estado:** los prototipos pintan filas con `innerHTML` por simplicidad. En Next,
  componentes tipados (`<StatusChip status={g.status} />`) que consumen los enums.
- **Colores de estado:** no repetir hex en componentes; derivar de `STATUS[...]`.
- **Router del prototipo (`?view=`):** es solo un conmutador de demo. En Next son rutas
  reales del App Router (`/admin/galerias`, `/admin/clientes/[id]`, etc.).
- **Persistencia de artifacts:** N/A — los prototipos no usan storage del navegador.
- **Accesibilidad:** foco visible en tiles (`outline` violeta), `aria-checked` en
  selección, `role="checkbox"`. Mantener contraste AA (texto sobre botón violeta OK).
- **Motion:** respetar `prefers-reduced-motion` (ya implementado en el sitio público).
- **Responsive:** desktop primero. Tablet colapsa sidebar y reduce columnas. Mobile
  del admin se limita a consulta y acciones simples; el portal es totalmente responsive.

---

## 6. Roadmap cubierto vs. pendiente

Cubierto: portafolio, login, portal del cliente (selección→entrega), admin de galerías
(dashboard, lista, detalle, fotos, importación, selección, exportación, estados,
entrega, actividad), admin de clientes (lista, crear, detalle, seguridad, invitaciones,
notas, estados de borde).

Fuera de alcance de esta fase (escalable sin rediseño): reservas, tienda, blog,
selección avanzada con favoritos/colecciones, multi-idioma del portal.
