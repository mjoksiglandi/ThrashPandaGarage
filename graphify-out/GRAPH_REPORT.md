# Graph Report - .  (2026-07-20)

## Corpus Check
- 97 files · ~684,227 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 284 nodes · 530 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Panel administrador|Panel administrador]]
- [[_COMMUNITY_Configuracion y soporte|Configuracion y soporte]]
- [[_COMMUNITY_Servicios de dominio|Servicios de dominio]]
- [[_COMMUNITY_Servicios de dominio|Servicios de dominio]]
- [[_COMMUNITY_UI publica|UI publica]]
- [[_COMMUNITY_Servicios de dominio|Servicios de dominio]]
- [[_COMMUNITY_Galeria cliente|Galeria cliente]]
- [[_COMMUNITY_Documentacion|Documentacion]]
- [[_COMMUNITY_Infraestructura compartida|Infraestructura compartida]]
- [[_COMMUNITY_Servicios de dominio|Servicios de dominio]]
- [[_COMMUNITY_Servicios de dominio|Servicios de dominio]]
- [[_COMMUNITY_Infraestructura compartida|Infraestructura compartida]]
- [[_COMMUNITY_Scripts operativos|Scripts operativos]]
- [[_COMMUNITY_Documentacion|Documentacion]]
- [[_COMMUNITY_Configuracion y soporte|Configuracion y soporte]]
- [[_COMMUNITY_Configuracion y soporte|Configuracion y soporte]]
- [[_COMMUNITY_Configuracion y soporte|Configuracion y soporte]]

## God Nodes (most connected - your core abstractions)
1. `AdminShell()` - 9 edges
2. `PublicNav()` - 9 edges
3. `isGalleryAccessible()` - 9 edges
4. `PublicFooter()` - 8 edges
5. `requireAdmin()` - 8 edges
6. `galleryRepository` - 8 edges
7. `resolveStoragePath()` - 8 edges
8. `buildRelativePhotoPath()` - 8 edges
9. `loadSession()` - 7 edges
10. `clientRepository` - 7 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `exportSelectionText()`  [EXTRACTED]
  scripts/export-selection.ts → src/modules/selections/selection.service.ts
- `Monolito modular` --references--> `Next.js App Router`  [EXTRACTED]
  README.md → docs/architecture.md
- `main()` --calls--> `importGalleryPhotos()`  [EXTRACTED]
  scripts/import-gallery.ts → src/modules/photos/photo-import.service.ts
- `main()` --calls--> `buildRelativePhotoPath()`  [EXTRACTED]
  scripts/import-gallery.ts → src/modules/storage/storage.service.ts
- `SessionsPage()` --calls--> `getPublicSessions()`  [EXTRACTED]
  src/app/sessions/page.tsx → src/lib/public-sessions.ts

## Import Cycles
- None detected.

## Communities (19 total, 3 thin omitted)

### Community 0 - "Panel administrador"
Cohesion: 0.06
Nodes (26): AdminShell(), AdminSidebar(), items, ClientListItem, ClientTable(), ExportSelectionButton(), GalleryPhotoManager(), PhotoWithSelection (+18 more)

### Community 1 - "Configuracion y soporte"
Cohesion: 0.09
Nodes (15): services, SessionsPage(), CategoryPage(), FeaturedCarousel(), HeroPhoto, shufflePhotos(), categories, heroPhotoFiles (+7 more)

### Community 2 - "Servicios de dominio"
Cohesion: 0.14
Nodes (15): contentTypes, GET(), getCurrentAdmin(), loginAdmin(), logoutAdmin(), signSessionValue(), SECRET, verifySessionValue() (+7 more)

### Community 3 - "Servicios de dominio"
Cohesion: 0.17
Nodes (14): main(), GET(), GET(), POST(), POST(), requireAdmin(), globalForPrisma, markSelectionConfirmed() (+6 more)

### Community 4 - "UI publica"
Cohesion: 0.19
Nodes (15): buildCollage(), buildJustifiedRows(), CollagePhoto, JustifiedRow, PhotoItem, roles, rowHeight(), shuffle() (+7 more)

### Community 5 - "Servicios de dominio"
Cohesion: 0.20
Nodes (11): PrivateGalleryPage(), ClientGallery(), createAccessToken(), slugify(), archiveGallery(), assertReadyForDeliveryAllowed(), cleanGalleryForm(), createGalleryFromForm() (+3 more)

### Community 6 - "Galeria cliente"
Cohesion: 0.20
Nodes (8): ConfirmSelectionButton(), DeliveryDriveButton(), Photo, GalleryGrid(), PhotoCard(), PhotoCommentBox(), PhotoLightbox(), SelectionCounter()

### Community 7 - "Documentacion"
Cohesion: 0.12
Nodes (17): Acceso administrador, Panel administrador, Next.js App Router, Galeria privada, Servicios de dominio, Graphify, Collage editorial, Almacenamiento fotografico (+9 more)

### Community 8 - "Infraestructura compartida"
Cohesion: 0.21
Nodes (14): generateMetadata(), SessionDetailPage(), SessionPageProps, SessionGallery(), getPublicSession(), getPublicSessions(), IMAGE_EXTENSIONS, imageFiles() (+6 more)

### Community 9 - "Servicios de dominio"
Cohesion: 0.33
Nodes (9): main(), GET(), ImageRouteProps, importGalleryPhotos(), buildRelativePhotoPath(), listImageFiles(), resolveStoragePath(), safeJoin() (+1 more)

### Community 10 - "Servicios de dominio"
Cohesion: 0.33
Nodes (4): env, envSchema, galleryEmailText(), sendGalleryEmail()

### Community 11 - "Infraestructura compartida"
Cohesion: 0.33
Nodes (4): Bucket, buckets, checkRateLimit(), resetRateLimit()

### Community 12 - "Scripts operativos"
Cohesion: 0.43
Nodes (7): Path, capture_date(), exif_data(), main(), number_label(), shutter_label(), slugify()

### Community 13 - "Documentacion"
Cohesion: 0.67
Nodes (3): Knip, TypeScript noUnused, Codigo sin uso

## Knowledge Gaps
- **45 isolated node(s):** `eslintConfig`, `nextConfig`, `contentTypes`, `ImageRouteProps`, `metadata` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PublicNav()` connect `Configuracion y soporte` to `Infraestructura compartida`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `PublicFooter()` connect `Configuracion y soporte` to `Infraestructura compartida`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `env` connect `Servicios de dominio` to `Panel administrador`, `Servicios de dominio`, `Servicios de dominio`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `contentTypes` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel administrador` be split into smaller, more focused modules?**
  _Cohesion score 0.06140350877192982 - nodes in this community are weakly interconnected._
- **Should `Configuracion y soporte` be split into smaller, more focused modules?**
  _Cohesion score 0.08536585365853659 - nodes in this community are weakly interconnected._
- **Should `Servicios de dominio` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._