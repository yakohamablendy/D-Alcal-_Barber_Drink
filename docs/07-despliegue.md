# BarberPro - Despliegue

## 1. Opción Recomendada: Vercel

### Setup
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy a producción
vercel --prod
```

### Variables de Entorno (en Vercel Dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Dominio Custom
1. Agregar dominio en Vercel Dashboard → Settings → Domains
2. Configurar DNS (CNAME o A record)
3. SSL automático

---

## 2. Build de Producción

```bash
# Verificar build local
npm run build

# Resultado esperado:
# ○ /           (Static)
# ○ /barbero    (Static)
# ○ /admin      (Static)
# ○ /dev-portal (Static)
```

---

## 3. PWA en Producción

El PWA funciona automáticamente en producción:
- `manifest.json` servido desde `/public`
- `sw.js` registrado al cargar la app
- Iconos disponibles en `/icons/`
- HTTPS requerido (Vercel lo provee)

### Verificar PWA
1. Abrir Chrome DevTools → Application → Manifest
2. Verificar que todos los campos estén correctos
3. Application → Service Workers → verificar registrado
4. Lighthouse → PWA audit (debe pasar)

---

## 4. CI/CD Pipeline (Futuro)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 5. Monitoreo

- **Vercel Analytics:** Integrado (ya instalado)
- **Error tracking:** Sentry (Sprint 3+)
- **Uptime:** Better Uptime o similar
- **Logs:** Vercel Functions logs
