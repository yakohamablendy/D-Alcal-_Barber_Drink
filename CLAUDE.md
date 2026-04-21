# BarberPro - Contexto para IA

## Qué es este proyecto
Sistema SaaS de gestión para barberías/peluquerías. Reservas online (PWA), panel de barbero (horarios, citas, ganancias) y panel admin (métricas globales, barberías registradas, MRR). Enfocado en República Dominicana y LATAM.

## Stack
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **UI:** Diseño editorial minimalista (Playfair Display + Geist + Geist Mono)
- **PWA:** Service Worker + Web App Manifest (instalable en móvil)
- **Componentes:** shadcn/ui (base), custom components
- **Iconos:** Lucide React

## Estructura del proyecto
```
app/
├── page.tsx               → Vista cliente (reservar cita) — PWA start_url
├── barbero/page.tsx       → Panel del barbero (citas + horario)
├── admin/page.tsx         → Panel admin SaaS (métricas + barberías)
├── dev-portal/page.tsx    → Portal de desarrollo (metodología ágil)
├── api/dev-data/          → API para leer/escribir datos del portal dev
├── layout.tsx             → Root layout (fuentes, PWA meta, SW)
└── globals.css            → Variables de diseño, tema oscuro

components/barber-pro/
├── client-view.tsx        → Flujo de reserva (servicio → fecha/hora → datos → confirmación)
├── barber-view.tsx        → Dashboard barbero (citas + gestión de horario)
├── admin-view.tsx         → Dashboard admin (métricas, tabla barberías)
└── sw-registrar.tsx       → Registro del Service Worker

public/
├── manifest.json          → PWA manifest
├── sw.js                  → Service Worker
└── icons/                 → Iconos PWA (192, 512, maskable, apple)

dev-data/                  → Datos del portal ágil (JSON versionados en git)
docs/                      → Documentación detallada (8+ archivos)
```

## Rutas de la app
| Ruta | Rol | Descripción |
|------|-----|-------------|
| `/` | Cliente | Reserva de citas (PWA, instalable) |
| `/barbero` | Barbero | Citas del día + gestión de horario/disponibilidad |
| `/admin` | Admin (dev) | Panel SaaS: barberías, MRR, churn, tabla global |
| `/dev-portal` | Desarrollador | Portal ágil estilo Jira |

## Convenciones de código
- Componentes: PascalCase (`ClientView.tsx`)
- Hooks/stores: camelCase (`useStore.ts`)
- Rutas: kebab-case (`/dev-portal`)
- Estilos: Tailwind CSS con variables custom (colores: ink, rule, dim, mid, bright, gold, green, red)
- Moneda: DOP (peso dominicano), formato `$X,XXX`
- Idioma de la UI: Español
- Fuentes: `font-serif` (Playfair Display), `font-sans` (Geist), `font-mono` (Geist Mono)

## Paleta de colores
```
--ink:    #0c0c0c   (fondo principal)
--ink-2:  #141414   (cards, filas)
--ink-3:  #1c1c1c   (hover, estados)
--ink-4:  #262626   (disabled)
--rule:   rgba(255,255,255,0.07)  (bordes sutiles)
--dim:    rgba(255,255,255,0.3)   (texto terciario)
--mid:    rgba(255,255,255,0.6)   (texto secundario)
--bright: rgba(255,255,255,0.92)  (texto principal)
--gold:   #c9a84c   (acento, precios, highlights)
--green:  #5a9e76   (deltas positivos)
--red:    #c97a5a   (deltas negativos)
```

---

# FLUJO DE TRABAJO CON IA (IMPORTANTE)

## Paso 1: Identificar al desarrollador
Al inicio de cada sesión, leer el archivo `.dev-profile` en la raíz del proyecto:
```json
{ "name": "NombreDev", "ai": "Claude/Gemini/GPT" }
```
Si no existe, preguntar al dev su nombre y crear el archivo.

## Paso 2: Antes de trabajar en una historia
1. Leer `dev-data/stories.json` para ver el backlog
2. El dev indica qué historia va a trabajar (ej: "trabaja en BP-005")
3. Actualizar `dev-data/stories.json`:
   - Cambiar `status` a `"in_progress"`
   - Cambiar `assignee` al nombre del dev
4. Registrar inicio de sesión en `dev-data/sessions.json`
5. Registrar actividad en `dev-data/activity.json`

## Paso 3: Durante el trabajo
- Trabajar normalmente en el código
- Si se crea, edita o completa algo relevante, registrar en `dev-data/activity.json`

## Paso 4: Al terminar
1. Actualizar `dev-data/stories.json`:
   - Cambiar `status` a `"review"` o `"done"` según corresponda
2. Registrar fin de sesión en `dev-data/sessions.json` (calcular duración)
3. Registrar actividad final en `dev-data/activity.json`

## Paso 5: Commit
Usar este formato SIEMPRE:
```
tipo(alcance): descripción breve

Dev: @nombre-del-dev
AI: [nombre de la IA usada]
Story: BP-XXX
Hours: X.Xh

Co-Authored-By: [IA] <noreply@anthropic.com>
```

Tipos: feat, fix, chore, docs, style, refactor, test, perf

## Estructura de dev-data/
```
dev-data/
├── team.json        → Miembros del equipo
├── epics.json       → Épicas del proyecto
├── stories.json     → Historias de usuario (backlog completo)
├── sprints.json     → Definición de sprints
├── sessions.json    → Sesiones de trabajo (dev, inicio, fin, historia, IA)
├── activity.json    → Timeline de actividad
├── standups.json    → Daily standups
├── retros.json      → Retrospectivas de sprint
├── dod.json         → Definition of Done
├── changelog.json   → Historial de versiones
├── wiki.json        → Base de conocimiento
└── notifications.json → Alertas del portal
```

## Reglas para crear historias
- Al crear una historia nueva, SIEMPRE preguntar al dev en qué sprint y épica asignarla
- Si tiene sprint asignado → status `"sprint_todo"` (para que aparezca en el Board)
- Si NO tiene sprint asignado → status `"backlog"` (solo visible en tab Backlog)
- SIEMPRE asignar una épica existente de `dev-data/epics.json`
- Colores válidos para épicas: emerald, blue, purple, amber, red, cyan, pink, orange, teal, indigo

## Reglas importantes
- SIEMPRE hacer `git pull` antes de modificar archivos en `dev-data/`
- NO modificar datos de otro dev sin que lo pida
- Los archivos en `dev-data/` se versionan en git (son la fuente de verdad)
- `.dev-profile` está en `.gitignore` (es local de cada dev)
- El dev portal (`/dev-portal`) lee estos JSON via API routes
