# BarberPro - Arquitectura Técnica

## 1. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2 |
| UI | React | 19.2 |
| Lenguaje | TypeScript | 5.7 |
| Estilos | Tailwind CSS | 4.2 |
| Componentes | shadcn/ui (base) + custom | — |
| Fuentes | Playfair Display, Geist, Geist Mono | Google Fonts |
| Iconos | Lucide React | 0.564 |
| PWA | Service Worker + Web App Manifest | — |
| Analytics | Vercel Analytics | — |

### Backend (Sprint 2+)
| Capa | Tecnología |
|------|-----------|
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| API | Next.js API Routes |
| Notificaciones | WhatsApp Business API |
| Pagos | Stripe |

---

## 2. Estructura del Proyecto

```
peluqueria/
├── app/
│   ├── page.tsx                → / (Cliente: reserva PWA)
│   ├── barbero/page.tsx        → /barbero (Panel barbero)
│   ├── admin/page.tsx          → /admin (Panel admin SaaS)
│   ├── dev-portal/page.tsx     → /dev-portal (Portal ágil)
│   ├── api/dev-data/           → API para dev-portal
│   ├── layout.tsx              → Root layout (fuentes, PWA, SW)
│   └── globals.css             → Variables, tema, estilos base
│
├── components/
│   ├── barber-pro/             → Componentes de negocio
│   │   ├── client-view.tsx     → Vista de reserva
│   │   ├── barber-view.tsx     → Vista del barbero
│   │   ├── admin-view.tsx      → Vista admin
│   │   └── sw-registrar.tsx    → Registro service worker
│   └── ui/                     → Componentes base (shadcn/ui)
│
├── public/
│   ├── manifest.json           → PWA manifest
│   ├── sw.js                   → Service Worker
│   └── icons/                  → Iconos PWA
│
├── dev-data/                   → Datos ágiles (JSON)
├── docs/                       → Documentación
├── lib/                        → Utilidades (cn, utils)
├── hooks/                      → Custom hooks
├── CLAUDE.md                   → Contexto para IA
└── .dev-profile                → Dev actual (gitignored)
```

---

## 3. Patrón de Rutas

| Ruta | Tipo | Auth | Descripción |
|------|------|------|-------------|
| `/` | Pública | No | Reserva de citas (PWA start_url) |
| `/barbero` | Protegida | Sí (rol barber) | Panel del barbero |
| `/admin` | Protegida | Sí (rol admin) | Panel admin SaaS |
| `/dev-portal` | Interna | Contraseña | Portal desarrollo ágil |

---

## 4. Sistema de Diseño

### Paleta de Colores
```
Fondos:   ink (#0c0c0c) → ink-2 (#141414) → ink-3 (#1c1c1c) → ink-4 (#262626)
Texto:    dim (30%) → mid (60%) → bright (92%) → white (100%)
Bordes:   rule (7%) → rule-2 (12%)
Acento:   gold (#c9a84c) — precios, highlights, estados activos
Estados:  green (#5a9e76) positivo | red (#c97a5a) negativo
```

### Tipografía
```
Headings:    Playfair Display (serif, italic para acentos dorados)
Body:        Geist (sans-serif, weights 300-500)
Datos/Hora:  Geist Mono (monospace, precios y timestamps)
```

### Componentes Clave
- **Service rows:** Fila con radio indicator, precio mono dorado
- **Stepper:** Círculos numerados + líneas conectoras
- **Time grid:** Grid 3 columnas, slots ocupados tachados
- **Metric cards:** Grid con serif grande, deltas verdes/rojos
- **Data table:** Headers uppercase, plan tags, status pills
- **Buttons:** Primary (white), Ghost (border)
- **Toast:** Fixed bottom-right, slide-up animation

---

## 5. Flujo de Datos (Actual — Mock)

```
Cliente reserva → State local (useState) → Confirmación visual
Barbero completa → State local → Toast notification
Admin busca → Filtro local → Tabla actualizada
```

### Flujo Futuro (con Backend)
```
Cliente reserva → POST /api/bookings → Supabase → Confirm + WhatsApp
Barbero ve citas → GET /api/bookings?date=today → Render
Barbero guarda horario → PUT /api/schedule → Supabase
Admin ve métricas → GET /api/admin/metrics → Aggregate query
```

---

## 6. PWA Architecture

```
manifest.json
├── start_url: "/"
├── display: "standalone"
├── theme_color: "#0c0c0c"
└── icons: 192x192, 512x512 (normal + maskable)

sw.js
├── Strategy: Network-first, cache fallback
├── Precache: /, /manifest.json
└── Runtime: Cache successful GET responses
```
