# BarberPro - Seguridad

## 1. Roles y Permisos (RBAC)

| Recurso | Cliente (público) | Barbero | Admin |
|---------|:-:|:-:|:-:|
| Ver servicios | ✅ | ✅ | ✅ |
| Crear reserva | ✅ | ✅ | ✅ |
| Ver sus citas | — | ✅ | ✅ |
| Completar cita | — | ✅ | ✅ |
| Gestionar horario | — | ✅ | ✅ |
| Ver métricas propias | — | ✅ | ✅ |
| Ver métricas globales | — | — | ✅ |
| Gestionar barberías | — | — | ✅ |
| Gestionar planes | — | — | ✅ |

---

## 2. Autenticación (Futuro — Sprint 2)

### Flujo
```
1. Barbero/Admin ingresa email + contraseña
2. Supabase Auth valida credenciales
3. JWT generado con claims: { role, barbershop_id }
4. JWT almacenado en httpOnly cookie
5. Middleware verifica JWT en cada request protegido
```

### Rutas Protegidas
| Ruta | Requiere Auth | Rol Mínimo |
|------|:---:|------------|
| `/` | No | — |
| `/barbero` | Sí | barber |
| `/admin` | Sí | admin |
| `/dev-portal` | Contraseña | developer |

---

## 3. Protección de Datos

- **Aislamiento multi-tenant:** Cada barbería solo ve sus datos (RLS en Supabase)
- **Datos del cliente:** Nombre y teléfono son PII — no exponer en logs
- **Passwords:** Manejados por Supabase Auth (bcrypt + salt)
- **HTTPS:** Forzado en producción (Vercel)

---

## 4. Checklist de Seguridad

- [ ] Proteger /barbero con auth middleware
- [ ] Proteger /admin con auth middleware
- [ ] Implementar RLS en Supabase
- [ ] Validar inputs del formulario de reserva (server-side)
- [ ] Rate limiting en endpoint de reservas
- [ ] Sanitizar búsqueda en panel admin (XSS)
- [ ] CORS configurado correctamente
- [ ] Variables sensibles en .env (no en código)
- [ ] Service Worker no cachea datos sensibles

---

## 5. OWASP Top 10 — Consideraciones

| Riesgo | Mitigación |
|--------|-----------|
| Injection | Supabase parameterized queries |
| Broken Auth | JWT + httpOnly cookies |
| Sensitive Data Exposure | HTTPS, .env para secrets |
| XSS | React escapa por defecto, sanitizar inputs |
| CSRF | SameSite cookies |
| Security Misconfiguration | Headers de seguridad en Vercel |
