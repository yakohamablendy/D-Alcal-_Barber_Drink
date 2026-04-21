# BarberPro - Guía de Desarrollo

## 1. Setup Inicial

```bash
# Clonar e instalar
git clone <repo-url>
cd peluqueria
npm install

# Iniciar dev server
npm run dev
```

### Variables de Entorno
```env
# .env.local (crear a partir de .env.example)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 2. Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar build de producción |
| `npm run lint` | Linter |
| `node scripts/generate-icons.js` | Regenerar iconos PWA |

---

## 3. Convenciones de Código

### Nombrado
| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componentes | PascalCase | `ClientView.tsx` |
| Hooks | camelCase con `use` | `useToast.ts` |
| Rutas | kebab-case | `/dev-portal` |
| Variables CSS | kebab-case con `--` | `--ink-2` |
| JSON dev-data | kebab-case | `stories.json` |

### Estilos
- **Solo Tailwind CSS** con variables custom del tema
- Usar colores del tema: `text-gold`, `bg-ink-2`, `border-rule`
- `font-serif` para headings, `font-mono` para datos numéricos
- NO usar CSS modules ni styled-components

### Componentes
```tsx
// Estructura recomendada
"use client"              // Solo si usa hooks/estado
import { useState } from "react"

interface Props {
  showToast: (msg: string) => void
}

export function MyComponent({ showToast }: Props) {
  // Estado
  // Handlers
  // Render
}
```

---

## 4. Flujo Git

### Ramas
```
main              → Producción estable
├── develop       → Integración
├── feature/BP-XXX-descripcion → Features
├── fix/BP-XXX-descripcion     → Bug fixes
└── chore/descripcion          → Mantenimiento
```

### Formato de Commit
```
tipo(alcance): descripción breve

Dev: @nombre-del-dev
AI: [nombre de la IA usada]
Story: BP-XXX
Hours: X.Xh

Co-Authored-By: [IA] <noreply@anthropic.com>
```

**Tipos:** feat, fix, chore, docs, style, refactor, test, perf

### Ejemplo
```
feat(barbero): agregar gestión de horario semanal

Dev: @Michael
AI: Claude
Story: BP-006
Hours: 1.5h

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 5. Cómo Agregar un Feature Nuevo

1. **Crear historia** en `dev-data/stories.json` (o pedirle al IA)
2. **Crear rama** `feature/BP-XXX-nombre`
3. **Implementar** siguiendo las convenciones
4. **Verificar** que compila: `npm run build`
5. **Commit** con el formato estándar
6. **Actualizar** story status a `"done"`

---

## 6. Estructura de Colores (Tailwind)

```
Fondos:
  bg-ink       → Fondo principal (#0c0c0c)
  bg-ink-2     → Cards, filas (#141414)
  bg-ink-3     → Hover, seleccionado (#1c1c1c)
  bg-ink-4     → Disabled (#262626)

Texto:
  text-dim     → Terciario (30%)
  text-mid     → Secundario (60%)
  text-bright  → Principal (92%)
  text-white   → Énfasis (100%)
  text-gold    → Acento/precio (#c9a84c)

Bordes:
  border-rule   → Sutil (7%)
  border-rule-2 → Hover (12%)
  border-gold   → Acento activo

Estados:
  text-green   → Positivo (#5a9e76)
  text-red     → Negativo (#c97a5a)
```

---

## 7. Testing (Futuro)

```
tests/
├── unit/          → Jest + React Testing Library
├── integration/   → API routes testing
└── e2e/           → Playwright
```

### Ejecutar tests
```bash
npm test           # Unit tests
npm run test:e2e   # E2E tests
```
