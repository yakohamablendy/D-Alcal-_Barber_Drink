# BarberPro - Modelo de Datos

## 1. Diagrama de Entidades

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Barbershop  │────<│    Barber     │────<│   Schedule   │
│              │     │              │     │  (por día)   │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │                    │
       │              ┌─────┴──────┐
       └────<│   Service    │     │   Booking    │
             └──────────────┘     └──────┬───────┘
                                        │
                                  ┌─────┴──────┐
                                  │   Client    │
                                  └─────────────┘
```

---

## 2. Tablas

### barbershops
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | Nombre de la barbería |
| city | VARCHAR(100) | Ciudad |
| plan | ENUM('free','premium') | Plan de suscripción |
| status | ENUM('active','inactive') | Estado |
| mrr | INTEGER | Ingreso mensual recurrente |
| created_at | TIMESTAMP | Fecha de registro |
| owner_email | VARCHAR(255) | Email del dueño |

### barbers
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| barbershop_id | UUID | FK → barbershops |
| name | VARCHAR(100) | Nombre completo |
| email | VARCHAR(255) | Email (login) |
| phone | VARCHAR(20) | Teléfono |
| rating | DECIMAL(2,1) | Calificación (0.0-5.0) |
| review_count | INTEGER | Número de reseñas |
| created_at | TIMESTAMP | Fecha de registro |

### services
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| barbershop_id | UUID | FK → barbershops |
| name | VARCHAR(100) | Nombre del servicio |
| description | TEXT | Descripción corta |
| price | INTEGER | Precio en pesos (DOP) |
| duration | INTEGER | Duración en minutos |
| active | BOOLEAN | Si está disponible |

### schedules
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| barber_id | UUID | FK → barbers |
| day_of_week | SMALLINT | 0=Lunes ... 6=Domingo |
| enabled | BOOLEAN | Si trabaja ese día |
| start_time | TIME | Hora de inicio |
| end_time | TIME | Hora de fin |
| extra_enabled | BOOLEAN | Si tiene horas extra |
| extra_start | TIME | Inicio hora extra |
| extra_end | TIME | Fin hora extra |

### bookings
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| barbershop_id | UUID | FK → barbershops |
| barber_id | UUID | FK → barbers (nullable) |
| service_id | UUID | FK → services |
| client_name | VARCHAR(100) | Nombre del cliente |
| client_phone | VARCHAR(20) | Teléfono del cliente |
| client_email | VARCHAR(255) | Email (opcional) |
| notes | TEXT | Notas del cliente |
| date | DATE | Fecha de la cita |
| time | TIME | Hora de la cita |
| status | ENUM | 'pending','confirmed','completed','cancelled','no_show' |
| created_at | TIMESTAMP | Fecha de creación |

### clients (futuro)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| barbershop_id | UUID | FK → barbershops |
| name | VARCHAR(100) | Nombre |
| phone | VARCHAR(20) | Teléfono (unique por barbería) |
| email | VARCHAR(255) | Email |
| visit_count | INTEGER | Número de visitas |
| last_visit | DATE | Última visita |
| created_at | TIMESTAMP | Primera reserva |

---

## 3. Índices Recomendados

```sql
CREATE INDEX idx_bookings_date ON bookings(barbershop_id, date);
CREATE INDEX idx_bookings_barber ON bookings(barber_id, date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_schedules_barber ON schedules(barber_id);
CREATE INDEX idx_services_shop ON services(barbershop_id, active);
```

---

## 4. RLS Policies (Supabase)

```sql
-- Barberos solo ven datos de su barbería
CREATE POLICY barber_isolation ON bookings
  USING (barbershop_id = auth.jwt() ->> 'barbershop_id');

-- Clientes pueden crear reservas sin auth
CREATE POLICY public_booking ON bookings
  FOR INSERT WITH CHECK (true);

-- Admin ve todo
CREATE POLICY admin_all ON barbershops
  USING (auth.jwt() ->> 'role' = 'admin');
```
