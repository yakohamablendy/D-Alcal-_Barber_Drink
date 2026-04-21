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
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<any>(null)
  const [selectedTime, setSelectedTime] = useState<any>(null)
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" })
  const [isComplete, setIsComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({})
  const [extraCharge, setExtraCharge] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [days, setDays] = useState<any[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])

  // 1. Cargar Datos
  useEffect(() => {
    // Servicios en tiempo real
    const unsubServs = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)))
    })

    // Configuración
    const loadConfig = async () => {
      const schedSnap = await getDoc(doc(db, "config", "schedule"))
      if (schedSnap.exists()) {
        const data = schedSnap.data()
        setSchedule(data.days)
        setExtraCharge(data.extraCharge || 0)
        setDays(getNextDays(10, data.days))
      }
      const brandSnap = await getDoc(doc(db, "config", "branding"))
      if (brandSnap.exists()) setLogoUrl(brandSnap.data().logoUrl || "")
    }

    loadConfig()
    return () => unsubServs()
  }, [])

  // 2. Cargar Ocupación
  useEffect(() => {
    if (!selectedDate) return
    const fetchOccupied = async () => {
      const q = query(collection(db, "bookings"), where("date", "==", selectedDate.fullLabel), where("status", "!=", "cancelled"))
      const snap = await getDocs(q)
      setBookedTimes(snap.docs.map(d => d.data().time))
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

      // Correo
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
    <div className="max-w-[600px] mx-auto px-8 py-20 text-center">
      <div className="w-12 h-0.5 bg-gold mx-auto mb-8" />
      <h2 className="font-serif text-4xl text-white mb-6">Cita <em className="italic text-gold">Confirmada</em></h2>
      <div className="bg-ink-2 p-6 rounded-sm border border-rule text-sm text-dim leading-loose mb-10">
        <strong className="text-white">{formData.name}</strong><br />
        {selectedService?.name} — ${currentTotal}<br />
        {selectedDate?.fullLabel} a las {selectedTime?.label}
      </div>
      <button onClick={() => window.location.reload()} className="text-gold text-xs uppercase tracking-widest border-b border-gold pb-1">Hacer otra reserva</button>
    </div>
  )

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14">
      {/* Header con Logo */}
      <div className="flex flex-col items-center mb-14">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-20 mb-6 object-contain" /> : <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold italic font-serif text-2xl mb-6">A</div>}
        <div className="text-[10px] tracking-[0.2em] uppercase text-dim mb-2">Alcala Barber Drink</div>
        <h1 className="font-serif text-4xl text-white text-center">Reserva tu <em className="italic text-gold">experiencia.</em></h1>
      </div>

      <div className="flex justify-center gap-4 mb-12">
        {[1, 2, 3].map(n => <div key={n} className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] transition-all ${step >= n ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>{n}</div>)}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden">
          {services.map(s => (
            <button key={s.id} onClick={() => setSelectedService(s)} className={`flex justify-between p-6 bg-ink-2 text-left hover:bg-ink-3 transition-colors ${selectedService?.id === s.id ? "bg-ink-3" : ""}`}>
              <div><div className="text-white text-base">{s.name}</div><div className="text-xs text-dim mt-1 font-light">{s.description}</div></div>
              <div className="text-gold font-mono text-lg">${s.price}</div>
            </button>
          ))}
          {services.length === 0 && <div className="p-20 text-center bg-ink-2 text-dim italic">No hay servicios disponibles.</div>}
          <div className="p-6 bg-ink flex justify-end border-t border-rule">
            <button disabled={!selectedService} onClick={() => setStep(2)} className="px-8 py-3 bg-white text-ink text-xs uppercase font-bold rounded-sm disabled:opacity-20">Elegir Horario</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden h-fit">
            {days.map(d => (
              <button key={d.sub} onClick={() => {setSelectedDate(d); setSelectedTime(null)}} className={`p-4 bg-ink-2 text-left flex justify-between items-center ${selectedDate?.sub === d.sub ? "bg-ink-3" : ""}`}>
                <span className="text-white text-sm">{d.label}</span><span className="text-[10px] text-dim font-mono">{d.sub}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map(s => (
                <button key={s.time} disabled={s.occupied} onClick={() => setSelectedTime(s)} className={`p-3 text-[11px] font-mono rounded-sm border transition-all ${s.occupied ? "opacity-10 line-through" : selectedTime?.time === s.time ? "border-gold text-gold bg-gold/10" : "border-rule text-dim hover:border-rule-2"}`}>
                  {s.time} {s.isExtra ? "★" : ""}
                </button>
              ))}
            </div>
            {selectedTime?.isExtra && <div className="mt-4 text-[10px] text-gold italic">★ Este horario tiene un recargo de ${extraCharge}</div>}
            <div className="flex justify-between items-center mt-10">
              <button onClick={() => setStep(1)} className="text-dim text-[10px] uppercase tracking-widest">Volver</button>
              <button disabled={!selectedTime} onClick={() => setStep(3)} className="px-8 py-3 bg-white text-ink text-xs uppercase font-bold rounded-sm disabled:opacity-20">Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-[600px] mx-auto">
          <div className="bg-ink-2 border border-rule p-6 rounded-sm mb-8 flex justify-between items-center">
            <div className="text-left"><div className="text-[9px] uppercase text-dim mb-1">Total a pagar</div><div className="text-2xl text-gold font-serif">${currentTotal}</div></div>
            <div className="text-right text-[11px] text-dim">{selectedService?.name}<br/>{selectedDate?.fullLabel} a las {selectedTime?.label}</div>
          </div>
          <div className="flex flex-col gap-4">
            <input type="text" placeholder="Nombre completo *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/50" />
            <input type="tel" placeholder="Teléfono *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/50" />
            <input type="email" placeholder="Correo electrónico *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/50" />
            <textarea placeholder="Notas u observaciones" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-ink-2 border border-rule p-4 rounded-sm text-white outline-none focus:border-gold/50 min-h-[100px]" />
            <div className="flex justify-between items-center mt-6">
              <button onClick={() => setStep(2)} className="text-dim text-[10px] uppercase tracking-widest">Volver</button>
              <button disabled={isLoading} onClick={handleConfirm} className="px-10 py-4 bg-white text-ink text-xs uppercase font-black rounded-sm hover:bg-gold hover:text-white transition-all">{isLoading ? "Procesando..." : "Confirmar Cita"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
