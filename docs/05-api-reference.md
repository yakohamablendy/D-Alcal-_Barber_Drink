# BarberPro - Referencia de API

## Estado Actual
Actualmente la app usa **datos mock** (estado local con useState). Este documento define la API objetivo para Sprint 2+.

---

## 1. Endpoints de Reservas

### POST /api/bookings
Crear una nueva reserva.

```json
// Request
{
  "barbershopId": "uuid",
  "serviceId": "uuid",
  "barberId": "uuid | null",
  "clientName": "Miguel Torres",
  "clientPhone": "+18095678901",
  "clientEmail": "miguel@email.com",
  "notes": "Prefiero fade alto",
  "date": "2026-03-25",
  "time": "14:30"
}

// Response 201
{
  "id": "uuid",
  "status": "confirmed",
  "createdAt": "2026-03-20T14:00:00Z"
}
```

### GET /api/bookings
Listar reservas (filtradas).

```
GET /api/bookings?barbershopId=uuid&date=2026-03-25
GET /api/bookings?barberId=uuid&date=2026-03-25
GET /api/bookings?status=pending
```

### PATCH /api/bookings/:id
Actualizar estado de una reserva.

```json
// Request
{ "status": "completed" }

// Status válidos: pending, confirmed, completed, cancelled, no_show
```

### DELETE /api/bookings/:id
Cancelar una reserva.

---

## 2. Endpoints de Horario

### GET /api/schedule/:barberId
Obtener horario semanal del barbero.

```json
// Response
{
  "Lunes":     { "enabled": true, "start": "09:00", "end": "18:00", "extraEnabled": false, "extraStart": "18:00", "extraEnd": "20:00" },
  "Martes":    { "enabled": true, "start": "09:00", "end": "18:00", "extraEnabled": true,  "extraStart": "18:00", "extraEnd": "20:00" },
  "Domingo":   { "enabled": false, "start": "10:00", "end": "14:00", "extraEnabled": false, "extraStart": "14:00", "extraEnd": "16:00" }
}
```

### PUT /api/schedule/:barberId
Guardar horario semanal completo.

---

## 3. Endpoints de Disponibilidad (Cliente)

### GET /api/availability
Slots disponibles para un día (usado por el flujo de reserva).

```
GET /api/availability?barbershopId=uuid&date=2026-03-25&serviceId=uuid
```

```json
// Response
{
  "date": "2026-03-25",
  "slots": [
    { "time": "09:00", "available": false },
    { "time": "09:30", "available": true },
    { "time": "10:00", "available": true },
    { "time": "14:00", "available": false }
  ]
}
```

---

## 4. Endpoints Admin

### GET /api/admin/metrics
Métricas globales del SaaS.

```json
{
  "activeBarbershops": 47,
  "mrr": 23400,
  "premiumCount": 31,
  "churnRate": 1.4,
  "totalBookingsMonth": 1250,
  "deltas": {
    "barbershops": "+5",
    "mrr": "+18%",
    "premium": "+3",
    "churn": "-0.3%"
  }
}
```

### GET /api/admin/barbershops
Lista de barberías con paginación y búsqueda.

```
GET /api/admin/barbershops?search=maestro&page=1&limit=20
```

---

## 5. Endpoints de Auth

### POST /api/auth/login
```json
{ "email": "carlos@barberia.com", "password": "..." }
```

### POST /api/auth/logout

### GET /api/auth/me
Retorna usuario actual con rol y barbershop_id.

---

## 6. Dev Portal API (Existente)

### GET /api/dev-data/[filename]
Leer archivos JSON del dev-data.

### POST /api/dev-data/[filename]
Escribir archivos JSON del dev-data.

### PATCH /api/dev-data/[filename]
Actualización parcial.
