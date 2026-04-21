"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDoc, doc, getDocs, query, where, onSnapshot } from "firebase/firestore"

interface Service {
  id: string
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

// DATOS DE PRUEBA (Respaldo)
const defaultServices: Service[] = [
  { id: "1", name: "Corte Clásico", price: 400, duration: 30, description: "Acabado prolijo a tijera y máquina." },
  { id: "2", name: "Corte + Barba", price: 600, duration: 50, description: "Corte completo y perfilado de barba." }
]

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "22:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "16:00", extraEnabled: false, extraStart: "16:00", extraEnd: "19:00" },
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
  const config = schedule[dayName] || defaultSchedule[dayName]
  if (!config || !config.enabled) return []
  const slots: { time: string; label: string; occupied: boolean; isExtra: boolean }[] = []

  const addSlotsRange = (startStr: string, endStr: string, isExtra: boolean) => {
    let [h, m] = startStr.split(":").map(Number)
    const [endH, endM] = endStr.split(":").map(Number)
    const endTotal = endH * 60 + endM
    while (h * 60 + m < endTotal) {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      const ampm = h >= 12 ? "PM" : "AM"
      const h12 = h % 12 || 12
      const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`
      const isOccupied = bookedTimes.includes(label)
      slots.push({ time: timeStr, label, occupied: isOccupied, isExtra })
      m += 30
      if (m >= 60) { h += 1; m = 0; }
    }
  }

  addSlotsRange(config.start, config.end, false)
  if (config.extraEnabled) addSlotsRange(config.extraStart || config.end, config.extraEnd || "23:00", true)
  return slots
}

export function ClientView({ showToast }: { showToast: (msg: string) => void }) {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<Service[]>(defaultServices)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<any>(null)
  const [selectedTime, setSelectedTime] = useState<any>(null)
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" })
  const [isComplete, setIsComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [extraCharge, setExtraCharge] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [days, setDays] = useState<any[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])

  useEffect(() => {
    const unsubServs = onSnapshot(collection(db, "services"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))
      if (list.length > 0) setServices(list)
    })

    const loadConfig = async () => {
      try {
        const schedSnap = await getDoc(doc(db, "config", "schedule"))
        if (schedSnap.exists()) {
          const data = schedSnap.data()
          if (data.days) {
            setSchedule(data.days)
            setDays(getNextDays(10, data.days))
          } else {
            setDays(getNextDays(10, defaultSchedule))
          }
          setExtraCharge(data.extraCharge || 0)
        } else {
          setDays(getNextDays(10, defaultSchedule))
        }
        const brandSnap = await getDoc(doc(db, "config", "branding"))
        if (brandSnap.exists()) setLogoUrl(brandSnap.data().logoUrl || "")
      } catch (e) {
        setDays(getNextDays(10, defaultSchedule))
      }
    }

    loadConfig()
    return () => unsubServs()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const fetchOccupied = async () => {
      try {
        const q = query(collection(db, "bookings"), where("date", "==", selectedDate.fullLabel), where("status", "not-in", ["cancelled", "no-show"]))
        const snap = await getDocs(q)
        setBookedTimes(snap.docs.map(d => d.data().time))
      } catch (e) {}
    }
    fetchOccupied()
  }, [selectedDate])

  const timeSlots = selectedDate ? generateTimeSlots(selectedDate.dayName, schedule, bookedTimes) : []
  const currentTotal = (selectedService?.price || 0) + (selectedTime?.isExtra ? extraCharge : 0)

  const handleConfirm = async () => {
    if (!formData.name.trim() || !formData.phone.trim() || !formData.email.trim()) return showToast("Faltan datos")
    setIsLoading(true)
    try {
      await addDoc(collection(db, "bookings"), {
        clientName: formData.name,
        clientPhone: formData.phone,
        clientEmail: formData.email.toLowerCase(),
        notes: formData.notes,
        serviceName: selectedService?.name,
        price: selectedService?.price,
        extraHourCharge: selectedTime?.isExtra ? extraCharge : 0,
        date: selectedDate.fullLabel,
        time: selectedTime?.label,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          service: selectedService?.name,
          price: currentTotal,
          date: selectedDate?.fullLabel,
          time: selectedTime?.label,
        }),
      }).catch(() => {})

      setIsComplete(true)
    } catch (e) { showToast("Error") }
    setIsLoading(false)
  }

  if (isComplete) return (
    <div className="max-w-[600px] mx-auto px-8 py-20 text-center bg-ink">
      <div className="w-12 h-0.5 bg-gold mx-auto mb-8" />
      <h2 className="font-serif text-4xl text-white mb-6 italic">Confirmada.</h2>
      <div className="bg-ink-2 p-8 rounded-sm border border-rule text-sm text-dim leading-loose mb-10 text-left">
        <div className="text-[10px] uppercase tracking-widest text-gold mb-4 border-b border-rule pb-2">Detalles de la Cita</div>
        <strong className="text-white text-base">{formData.name}</strong><br />
        <span className="text-bright">{selectedService?.name}</span> — ${currentTotal}<br />
        {selectedDate?.fullLabel} · {selectedTime?.label}
      </div>
      <button onClick={() => window.location.reload()} className="text-gold text-[10px] uppercase tracking-[0.3em] border-b border-gold/30 pb-1 hover:text-white transition-all">Nueva reserva</button>
    </div>
  )

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14">
      <div className="flex flex-col items-center mb-14">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-20 mb-6 object-contain" /> : <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold italic font-serif text-2xl mb-6 shadow-2xl shadow-gold/5">A</div>}
        <div className="text-[9px] tracking-[0.3em] uppercase text-dim mb-3">Alcala Barber Drink</div>
        <h1 className="font-serif text-[clamp(32px,6vw,48px)] text-white text-center leading-tight">Tu cita en <em className="italic text-gold">un clic.</em></h1>
      </div>

      <div className="flex justify-center gap-6 mb-16">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] transition-all duration-500 ${step >= n ? "border-gold text-gold bg-gold/5 shadow-[0_0_15px_rgba(201,168,76,0.1)]" : "border-rule text-dim"}`}>{n}</div>
            {n < 3 && <div className={`w-8 h-px ${step > n ? "bg-gold" : "bg-rule"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden animate-in fade-in duration-500">
          {services.map(s => (
            <button key={s.id} onClick={() => setSelectedService(s)} className={`flex justify-between p-7 bg-ink-2 text-left hover:bg-ink-3 transition-all ${selectedService?.id === s.id ? "bg-ink-3 border-l-2 border-l-gold" : ""}`}>
              <div><div className="text-white text-base font-normal">{s.name}</div><div className="text-[11px] text-dim mt-1 font-light tracking-wide">{s.description}</div></div>
              <div className="text-gold font-mono text-xl self-center">${s.price}</div>
            </button>
          ))}
          <div className="p-8 bg-ink flex justify-end border-t border-rule">
            <button disabled={!selectedService} onClick={() => setStep(2)} className="px-10 py-4 bg-white text-ink text-[10px] uppercase font-black tracking-widest rounded-sm disabled:opacity-10 transition-all hover:bg-gold hover:text-white">Continuar</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-12 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden h-fit shadow-xl">
            {days.map(d => (
              <button key={d.sub} onClick={() => {setSelectedDate(d); setSelectedTime(null)}} className={`p-5 bg-ink-2 text-left flex justify-between items-center hover:bg-ink-3 transition-all ${selectedDate?.sub === d.sub ? "bg-ink-3" : ""}`}>
                <span className="text-white text-sm font-medium">{d.label}</span><span className="text-[10px] text-dim font-mono tracking-tighter">{d.sub}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-dim mb-6 border-b border-rule pb-2">Horarios disponibles</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlots.map(s => (
                <button key={s.time} disabled={s.occupied} onClick={() => setSelectedTime(s)} className={`p-4 text-[11px] font-mono rounded-sm border transition-all ${s.occupied ? "opacity-5 line-through pointer-events-none" : selectedTime?.time === s.time ? "border-gold text-gold bg-gold/10 shadow-[0_0_15px_rgba(201,168,76,0.1)]" : "border-rule text-mid hover:border-rule-2"}`}>
                  {s.time} {s.isExtra ? "★" : ""}
                </button>
              ))}
            </div>
            {timeSlots.length === 0 && <div className="p-10 text-center border border-dashed border-rule text-dim italic text-xs">No hay horas para este día.</div>}
            {selectedTime?.isExtra && <div className="mt-6 p-3 bg-gold/5 border border-gold/20 rounded-sm text-[10px] text-gold italic flex items-center gap-2"><span>★</span> Horario especial con recargo de ${extraCharge}</div>}
            <div className="flex justify-between items-center mt-12 pt-6 border-t border-rule">
              <button onClick={() => setStep(1)} className="text-dim text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors">← Volver</button>
              <button disabled={!selectedTime} onClick={() => setStep(3)} className="px-10 py-4 bg-white text-ink text-[10px] uppercase font-black tracking-widest rounded-sm disabled:opacity-10 transition-all hover:bg-gold hover:text-white">Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-[550px] mx-auto animate-in zoom-in-95 duration-500">
          <div className="bg-ink-2 border border-rule p-8 rounded-sm mb-10 flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
            <div className="text-left"><div className="text-[9px] uppercase text-dim tracking-[0.2em] mb-2">Total del Servicio</div><div className="text-3xl text-gold font-serif tracking-tighter">${currentTotal}</div></div>
            <div className="text-right"><div className="text-[11px] text-white font-medium mb-1">{selectedService?.name}</div><div className="text-[10px] text-dim font-mono">{selectedDate?.fullLabel}<br/>{selectedTime?.label}</div></div>
          </div>
          <div className="flex flex-col gap-5">
            <div className="group flex flex-col gap-2">
              <label className="text-[9px] uppercase tracking-widest text-dim group-focus-within:text-gold transition-colors">Nombre completo *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/40 transition-all" />
            </div>
            <div className="group flex flex-col gap-2">
              <label className="text-[9px] uppercase tracking-widest text-dim group-focus-within:text-gold transition-colors">Teléfono de contacto *</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/40 transition-all" />
            </div>
            <div className="group flex flex-col gap-2">
              <label className="text-[9px] uppercase tracking-widest text-dim group-focus-within:text-gold transition-colors">Correo para confirmación *</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/40 transition-all" />
            </div>
            <div className="group flex flex-col gap-2">
              <label className="text-[9px] uppercase tracking-widest text-dim group-focus-within:text-gold transition-colors">Notas u observaciones</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/40 transition-all min-h-[100px] resize-none" />
            </div>
            <div className="flex justify-between items-center mt-10">
              <button onClick={() => setStep(2)} className="text-dim text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors">← Volver</button>
              <button disabled={isLoading} onClick={handleConfirm} className="px-12 py-5 bg-white text-ink text-[11px] uppercase font-black tracking-[0.2em] rounded-sm hover:bg-gold hover:text-white transition-all shadow-xl disabled:opacity-10">{isLoading ? "Cargando..." : "Confirmar Cita"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
