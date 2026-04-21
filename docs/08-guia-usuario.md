# BarberPro - Guía de Usuario

## Para Clientes

### Instalar la App
1. Abrir la URL de la barbería en el navegador del celular
2. **Android (Chrome):** Toca el banner "Agregar a pantalla de inicio" o Menu → "Instalar app"
3. **iPhone (Safari):** Compartir → "Agregar a pantalla de inicio"
4. La app aparece como un ícono en tu celular

### Reservar una Cita
1. **Paso 1 — Servicio:** Selecciona el servicio que deseas (corte, barba, etc.)
2. **Paso 2 — Fecha y hora:** Elige el día y la hora disponible
3. **Paso 3 — Tus datos:** Ingresa tu nombre y teléfono
4. Toca **"Confirmar reserva"**
5. Recibirás un recordatorio por WhatsApp antes de tu cita

---

## Para Barberos

### Acceder al Panel
1. Ir a `/barbero` en el navegador
2. Iniciar sesión con email y contraseña

### Ver Citas del Día
- En el tab **"Citas"** ves todas las citas de hoy
- Cada cita muestra: hora, nombre del cliente, teléfono, servicio y precio
- Toca **"Completar"** cuando termines un servicio
- Las métricas se actualizan automáticamente (ganancias, pendientes)

### Configurar tu Horario
1. Ir al tab **"Horario"**
2. Activa o desactiva cada día con el toggle
3. Selecciona hora de entrada y salida
4. ¿Trabajas horas extra? Toca **"+ Extra"** y configura el rango adicional
5. Toca **"Guardar horario"**
6. El resumen semanal muestra tus horas totales

---

## Para el Admin (Dueño del Software)

### Acceder al Panel
1. Ir a `/admin` en el navegador
2. Iniciar sesión con credenciales de admin

### Métricas Globales
- **Barberías activas:** Total de barberías usando el sistema
- **MRR:** Ingreso mensual recurrente (en dorado)
- **Plan Premium:** Cuántas barberías pagan
- **Churn rate:** Tasa de cancelación mensual

### Tabla de Barberías
- Busca por nombre, ciudad o cualquier dato
- Cada fila muestra: nombre, ciudad, plan (Premium/Gratis), estado, MRR, fecha de registro
- Estado **"Activa"** = barbería usando el sistema (punto verde)
- Estado **"Inactiva"** = barbería registrada pero sin uso reciente
