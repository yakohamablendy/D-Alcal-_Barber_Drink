"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDoc, doc, getDocs, query, where } from "firebase/firestore"

interface Service {
  name: string
  price: number
  duration: number
  description: string
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
  extraStart: string
  extraEnd: string
  extraEnabled: boolean
}

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "21:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "17:00" },
  Domingo:   { enabled: false, start: "10:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "16:00" },
}

function getNextDays(count: number, schedule: Record<string, DaySchedule>) {
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const today = new Date()
  const days = []
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dow = date.getDay()
    const dayName = dayNames[dow]
    
    if (schedule[dayName]?.enabled) {
      days.push({
        date,
        label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : dayName,
        sub: `${monthNames[date.getMonth()]} ${date.getDate()}`,
        fullLabel: `${i === 0 ? "Hoy" : i === 1 ? "Mañana" : dayName}, ${date.getDate()} ${monthNames[date.getMonth()]}`,
        dayName: dayName
      })
    }
  }
  return days
}

function generateTimeSlots(dayName: string, schedule: Record<string, DaySchedule>, bookedTimes: string[]) {
  const config = schedule[dayName]
  if (!config || !config.enabled) return []

  const slots: { time: string; label: string; occupied: boolean }[] = []

  const addSlotsRange = (startStr: string, endStr: string) => {
    let [h, m] = startStr.split(":").map(Number)
    const [endH, endM] = endStr.split(":").map(Number)
    const endTotal = endH * 60 + endM

    while (h * 60 + m < endTotal) {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      const ampm = h >= 12 ? "PM" : "AM"
      const h12 = h % 12 || 12
      const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`
      
      // VERIFICACIÓN REAL: ¿Está esta hora ya en la lista de reservas?
      const isOccupied = bookedTimes.includes(label)
      
      slots.push({ time: timeStr, label, occupied: isOccupied })
      
      m += 30
      if (m >= 60) {
        h += 1
        m = 0
      }
    }
  }

  addSlotsRange(config.start, config.end)
  if (config.extraEnabled) {
    addSlotsRange(config.extraStart, config.extraEnd)
  }

  return slots
}

interface Props {
  showToast: (msg: string) => void
}

const services: Service[] = [
  { name: "Corte Clásico", price: 350, duration: 30, description: "Tijera y máquina. Acabado prolijo y definido." },
  { name: "Corte + Barba", price: 520, duration: 50, description: "Corte completo más perfilado y definición de barba." },
  { name: "Afeitado Clásico", price: 290, duration: 25, description: "Navaja recta, toalla caliente y bálsamo de piel." },
  { name: "Corte Fade", price: 420, duration: 40, description: "Low fade, mid fade o high fade. Degradado limpio." },
  { name: "Tratamiento Capilar", price: 680, duration: 60, description: "Masaje capilar, hidratación profunda y corte de puntas." },
  { name: "Pack Novio", price: 900, duration: 80, description: "Corte, barba, afeitado y tratamiento facial completo." },
]

export function ClientView({ showToast }: Props) {
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<any>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" })
  const [isComplete, setIsComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [days, setDays] = useState<any[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])

  // Cargar horario
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const docRef = doc(db, "config", "schedule")
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const fetchedSchedule = docSnap.data() as Record<string, DaySchedule>
          setSchedule(fetchedSchedule)
          setDays(getNextDays(10, fetchedSchedule))
        } else {
          setDays(getNextDays(10, defaultSchedule))
        }
      } catch (error) {
        console.error("Error cargando horario:", error)
        setDays(getNextDays(10, defaultSchedule))
      }
    }
    loadSchedule()
  }, [])

  // CARGAR OCUPACIÓN REAL: Cuando el cliente elige un día, miramos qué horas están pilladas
  useEffect(() => {
    if (!selectedDate) return

    const fetchOccupiedSlots = async () => {
      try {
        const q = query(
          collection(db, "bookings"), 
          where("date", "==", selectedDate.fullLabel),
          where("status", "!=", "cancelled")
        )
        const querySnapshot = await getDocs(q)
        const times = querySnapshot.docs.map(doc => doc.data().time)
        setBookedTimes(times)
      } catch (error) {
        console.error("Error cargando huecos ocupados:", error)
      }
    }

    fetchOccupiedSlots()
  }, [selectedDate])

  const timeSlots = selectedDate ? generateTimeSlots(selectedDate.dayName, schedule, bookedTimes) : []
  const morningSlots = timeSlots.filter(s => parseInt(s.time.split(":")[0]) < 12)
  const afternoonSlots = timeSlots.filter(s => parseInt(s.time.split(":")[0]) >= 12)

  const handleConfirm = async () => {
    if (!formData.name.trim()) return showToast("El nombre es obligatorio")
    if (!formData.phone.trim()) return showToast("El teléfono es obligatorio")
    if (!formData.email.trim()) return showToast("El correo electrónico es obligatorio")

    setIsLoading(true)

    try {
      // GUARDADO UNIFICADO Y LIMPIO
      await addDoc(collection(db, "bookings"), {
        clientName: formData.name,
        clientPhone: formData.phone,
        clientEmail: formData.email.trim().toLowerCase(),
        notes: formData.notes,
        serviceName: selectedService?.name,
        price: selectedService?.price,
        duration: selectedService?.duration,
        date: selectedDate.fullLabel, // GUARDAMOS SOLO EL TEXTO (Evita error de objeto)
        time: selectedTime,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      // Enviar correo
      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            service: selectedService?.name,
            price: selectedService?.price,
            date: selectedDate?.fullLabel,
            time: selectedTime,
          }),
        })
      } catch (e) {}

      setIsComplete(true)
      showToast("Reserva confirmada con éxito")
    } catch (error) {
      console.error("Error al guardar reserva:", error)
      showToast("Error al procesar la reserva.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetBooking = () => {
    setStep(1); setSelectedService(null); setSelectedDate(null); setSelectedTime(null);
    setFormData({ name: "", phone: "", email: "", notes: "" }); setIsComplete(false);
  }

  if (isComplete) {
    return (
      <div className="max-w-[960px] mx-auto px-8 py-14">
        <div className="pt-20 pb-10 max-w-[480px]">
          <div className="w-8 h-0.5 bg-gold mb-8" />
          <h2 className="font-serif text-[clamp(28px,5vw,42px)] text-white">Reserva<br /><em className="italic text-gold">confirmada.</em></h2>
          <div className="mt-7 py-5 border-t border-b border-rule text-[13px] text-mid leading-[1.8]">
            <strong className="text-bright font-normal">{formData.name}</strong><br />
            {selectedService?.name} — ${selectedService?.price}<br />
            {selectedDate?.fullLabel} · {selectedTime}
          </div>
          <p className="text-sm text-dim mt-5">Te notificaremos por WhatsApp antes de tu cita.</p>
          <button onClick={resetBooking} className="mt-8 px-6 py-3 rounded-sm border border-rule text-dim text-xs hover:text-bright transition-all">Nueva reserva</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14">
      <div className="mb-7">
        <div className="text-[11px] tracking-widest uppercase text-dim mb-3">Alcala Barber Drink</div>
        <h1 className="font-serif text-[clamp(28px,5vw,42px)] text-white">Reserva tu <em className="italic text-gold">cita.</em></h1>
      </div>

      <div className="flex items-center mb-13 gap-4">
        {[1, 2, 3].map(n => (
          <div key={n} className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] ${step >= n ? "border-gold text-gold" : "border-rule text-dim"}`}>{n}</div>
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-px bg-rule rounded-sm overflow-hidden border border-rule">
          {services.map(s => (
            <button key={s.name} onClick={() => setSelectedService(s)} className={`flex justify-between p-6 bg-ink-2 text-left transition-colors ${selectedService?.name === s.name ? "bg-ink-3" : ""}`}>
              <div><div className="text-bright">{s.name}</div><div className="text-xs text-dim">{s.description}</div></div>
              <div className="text-gold font-mono">${s.price}</div>
            </button>
          ))}
          <div className="p-6 bg-ink border-t border-rule flex justify-end">
            <button disabled={!selectedService} onClick={() => setStep(2)} className="px-6 py-3 bg-white text-ink rounded-sm disabled:opacity-20 transition-all">Continuar</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-px bg-rule rounded-sm overflow-hidden border border-rule max-h-[400px] overflow-y-auto">
            {days.map(d => (
              <button key={d.sub} onClick={() => {setSelectedDate(d); setSelectedTime(null)}} className={`p-4 bg-ink-2 text-left flex justify-between ${selectedDate?.sub === d.sub ? "bg-ink-3" : ""}`}>
                <span className="text-bright">{d.label}</span><span className="text-xs text-dim">{d.sub}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map(s => (
                <button key={s.time} disabled={s.occupied} onClick={() => setSelectedTime(s.label)} className={`p-3 text-xs font-mono rounded-sm border ${s.occupied ? "opacity-20 line-through" : selectedTime === s.label ? "border-gold text-gold bg-gold/10" : "border-rule text-dim"}`}>
                  {s.time}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="text-dim text-xs">Volver</button>
              <button disabled={!selectedTime} onClick={() => setStep(3)} className="px-6 py-3 bg-white text-ink rounded-sm disabled:opacity-20">Continuar</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Nombre completo *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-bright outline-none focus:border-gold/50" />
            <input type="tel" placeholder="Teléfono *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-bright outline-none focus:border-gold/50" />
            <input type="email" placeholder="Correo electrónico *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-bright outline-none focus:border-gold/50" />
            <input type="text" placeholder="Notas (opcional)" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-bright outline-none focus:border-gold/50" />
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(2)} className="text-dim text-xs">Volver</button>
            <button disabled={isLoading} onClick={handleConfirm} className="px-8 py-3 bg-white text-ink rounded-sm hover:bg-gold hover:text-white transition-all">{isLoading ? "Procesando..." : "Confirmar Cita"}</button>
          </div>
        </div>
      )}
    </div>
  )
}
