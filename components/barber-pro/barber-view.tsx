"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc 
} from "firebase/firestore"

// ── Types ──

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  clientEmail: string
  serviceName: string
  price: number
  status: "pending" | "completed" | "cancelled"
  date: any // Usamos any para ser resistentes a datos viejos
  time: string
  notes?: string
  createdAt: any
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
  extraStart: string
  extraEnd: string
  extraEnabled: boolean
}

type Tab = "citas" | "horario" | "config"

const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "21:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "17:00" },
  Domingo:   { enabled: false, start: "10:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "16:00" },
}

const timeOptions: string[] = []
for (let h = 6; h <= 23; h++) {
  for (const m of ["00", "30"]) {
    timeOptions.push(`${String(h).padStart(2, "0")}:${m}`)
  }
}

interface Props {
  showToast: (msg: string) => void
}

export function BarberView({ showToast }: Props) {
  const [tab, setTab] = useState<Tab>("citas")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [loading, setLoading] = useState(true)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [dateTag, setDateTag] = useState("")

  // Configuración de recordatorios
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [reminderHours, setReminderHours] = useState(2)
  const [reminderMessage, setReminderMessage] = useState("¡Hola [Cliente]! Te recordamos tu cita en Alcala Barber Drink para el [Fecha] a las [Hora]. ¡Te esperamos! 💈🥃")
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  useEffect(() => {
    // Generar fecha solo en cliente para evitar error de hidratación
    const today = new Date()
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    setDateTag(`${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`)

    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"))
    const unsubscribeAppts = onSnapshot(q, (snapshot) => {
      const appts: Appointment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))
      setAppointments(appts)
    }, (error) => {
      console.error("Error en snapshot:", error)
    })

    const loadData = async () => {
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore")
        const schedSnap = await getDoc(fsDoc(db, "config", "schedule"))
        if (schedSnap.exists()) setSchedule(schedSnap.data() as Record<string, DaySchedule>)
        
        const configSnap = await getDoc(fsDoc(db, "config", "notifications"))
        if (configSnap.exists()) {
          const data = configSnap.data()
          setRemindersEnabled(data.enabled ?? true)
          setReminderHours(data.hours ?? 2)
          setReminderMessage(data.message ?? "")
        }
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    return () => unsubscribeAppts()
  }, [])

  const handleComplete = async (id: string) => {
    try {
      const docRef = doc(db, "bookings", id)
      await updateDoc(docRef, { status: "completed" })
      showToast("Cita completada")
    } catch (error) {
      console.error("Error al completar cita:", error)
      showToast("Error al actualizar la cita")
    }
  }

  const sendWhatsAppReminder = (appt: Appointment) => {
    const displayDate = typeof appt.date === 'object' && appt.date !== null ? appt.date.fullLabel : appt.date
    let msg = reminderMessage
      .replace("[Cliente]", appt.clientName || "Cliente")
      .replace("[Fecha]", displayDate || "")
      .replace("[Hora]", appt.time || "")

    const cleanPhone = (appt.clientPhone || "").replace(/\D/g, "")
    if (!cleanPhone) return showToast("No hay teléfono válido")
    const finalPhone = cleanPhone.startsWith("1") ? cleanPhone : `1${cleanPhone}`
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const saveSchedule = async () => {
    setIsSavingSchedule(true)
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore")
      await setDoc(fsDoc(db, "config", "schedule"), schedule)
      showToast("Horario actualizado")
    } catch (error) {
      console.error("Error guardando horario:", error)
      showToast("Error al guardar")
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const saveConfig = async () => {
    setIsSavingConfig(true)
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore")
      await setDoc(fsDoc(db, "config", "notifications"), {
        enabled: remindersEnabled,
        hours: reminderHours,
        message: reminderMessage,
        updatedAt: new Date()
      })
      showToast("Configuración guardada")
    } catch (error) {
      console.error("Error guardando config:", error)
      showToast("Error al guardar")
    } finally {
      setIsSavingConfig(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "citas", label: "Citas" },
    { id: "horario", label: "Horario" },
    { id: "config", label: "Avisos" },
  ]

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14">
      {/* Top line */}
      <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-dim mb-3">Panel Admin</div>
          <h1 className="font-serif text-[clamp(28px,5vw,42px)] text-white">Alcala Barber <em className="italic text-gold">Drink</em></h1>
        </div>
        {dateTag && (
          <div className="text-[10px] text-dim font-mono px-3 py-1.5 border border-rule rounded-sm bg-ink-2">
            {dateTag}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-rule mb-10">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-5 pb-3 pt-1 text-[13px] border-b-2 transition-all bg-transparent cursor-pointer ${tab === t.id ? "text-white border-b-gold" : "text-dim border-b-transparent hover:text-mid"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: CITAS ═══════ */}
      {tab === "citas" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-rule rounded-sm overflow-hidden border border-rule mb-14">
            <div className="bg-ink-2 p-6">
              <div className="text-[10px] uppercase text-dim mb-2">Citas Pendientes</div>
              <div className="font-serif text-3xl text-white">{appointments.filter(a => a.status === "pending").length}</div>
            </div>
            <div className="bg-ink-2 p-6">
              <div className="text-[10px] uppercase text-dim mb-2">Total Hoy</div>
              <div className="font-serif text-3xl text-gold">${appointments.filter(a => a.status === "completed").reduce((sum, a) => sum + (a.price || 0), 0).toLocaleString()}</div>
            </div>
            <div className="bg-ink-2 p-6 max-md:col-span-2 text-center md:text-left">
              <div className="text-[10px] uppercase text-dim mb-2">Status</div>
              <div className="text-xs text-green font-mono">Sistema en línea</div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-dim italic animate-pulse">Conectando con base de datos...</div>
          ) : appointments.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-rule rounded-sm text-dim italic">No hay citas registradas.</div>
          ) : (
            <div className="flex flex-col gap-px bg-rule rounded-sm overflow-hidden border border-rule">
              {appointments.map((appt) => {
                const displayDate = typeof appt.date === 'object' && appt.date !== null ? appt.date.fullLabel : appt.date
                return (
                  <div key={appt.id} className={`grid grid-cols-[60px_1fr_auto] items-center gap-4 p-5 bg-ink-2 ${appt.status === "completed" ? "opacity-30" : ""}`}>
                    <div className="text-center">
                      <div className="text-sm font-mono text-gold leading-none">{appt.time?.split(" ")[0] || "--:--"}</div>
                      <div className="text-[9px] text-dim mt-1">{appt.time?.split(" ")[1] || "PM"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-bright">{appt.clientName}</div>
                      <div className="text-[11px] text-dim font-mono">{appt.clientPhone}</div>
                      <div className="text-[10px] text-dim mt-1 italic">{appt.serviceName} — {displayDate}</div>
                      {appt.notes && <div className="mt-2 text-[10px] text-gold/60 border-l border-gold/30 pl-2">{appt.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      {appt.status !== "completed" && remindersEnabled && (
                        <button onClick={() => sendWhatsAppReminder(appt)} className="p-2 text-gold border border-gold/20 rounded-sm hover:bg-gold/10 transition-all">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
                        </button>
                      )}
                      {appt.status === "completed" ? (
                        <div className="px-3 py-1.5 text-[10px] text-dim border border-rule rounded-sm">Listo</div>
                      ) : (
                        <button onClick={() => handleComplete(appt.id)} className="px-4 py-1.5 text-[10px] bg-white text-ink rounded-sm hover:bg-white/80">Completar</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ TAB: HORARIO ═══════ */}
      {tab === "horario" && (
        <div className="bg-ink-2 border border-rule rounded-sm p-6">
          <p className="text-xs text-dim mb-6">Configura tus días de trabajo.</p>
          <div className="flex flex-col gap-4">
            {dayLabels.map(day => (
              <div key={day} className="flex items-center justify-between py-2 border-b border-rule/50">
                <span className="text-sm">{day}</span>
                <button onClick={() => updateDay(day, { enabled: !schedule[day].enabled })} className={`px-3 py-1 rounded-sm text-[10px] ${schedule[day].enabled ? "bg-gold text-ink" : "bg-ink-4 text-dim"}`}>
                  {schedule[day].enabled ? "Abierto" : "Cerrado"}
                </button>
              </div>
            ))}
          </div>
          <button onClick={saveSchedule} disabled={isSavingSchedule} className="mt-8 w-full py-3 bg-white text-ink rounded-sm text-xs font-medium">
            {isSavingSchedule ? "Guardando..." : "Guardar Horario"}
          </button>
        </div>
      )}

      {/* ═══════ TAB: CONFIG ═══════ */}
      {tab === "config" && (
        <div className="bg-ink-2 border border-rule rounded-sm p-8">
          <div className="mb-6">
            <label className="text-[10px] uppercase text-dim block mb-2">Mensaje WhatsApp</label>
            <textarea value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} className="w-full bg-ink-3 border border-rule p-4 text-xs text-bright rounded-sm min-h-[100px] outline-none" />
          </div>
          <button onClick={saveConfig} disabled={isSavingConfig} className="w-full py-3 bg-white text-ink rounded-sm text-xs font-medium">
            {isSavingConfig ? "Guardando..." : "Guardar Ajustes"}
          </button>
        </div>
      )}
    </div>
  )
}
